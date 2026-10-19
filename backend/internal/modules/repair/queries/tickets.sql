-- Step (CR-005) = the progress shown to people, derived from the row:
--   closed → closed · resolved → awaiting_rating · in_progress without expected_done_on → awaiting_assessment
--   · in_progress after a send back → reworking · else in_repair.
-- The same CASE is repeated in the list / count queries; keep them identical.

-- name: InsertTicket :exec
INSERT INTO repair.tickets (
    id, ticket_no, status, priority, priority_source, category_id, category_other, symptom_other,
    building_id, floor_id, location_detail, details, asset_code, reporter_id
) VALUES (
    @id, @ticket_no, 'in_progress', @priority, @priority_source, sqlc.narg('category_id')::uuid,
    sqlc.narg('category_other')::text, sqlc.narg('symptom_other')::text,
    @building_id, @floor_id, @location_detail, @details, @asset_code, @reporter_id
);

-- name: InsertTicketSymptoms :exec
INSERT INTO repair.ticket_symptoms (ticket_id, symptom_id, sort_order)
SELECT @ticket_id, s.symptom_id, s.ord::integer - 1
FROM unnest(@symptom_ids::uuid[]) WITH ORDINALITY AS s (symptom_id, ord);

-- name: InsertTicketEvent :exec
INSERT INTO repair.ticket_events (id, ticket_id, type, actor_id, note, data, created_at)
VALUES (@id, @ticket_id, @type, @actor_id, @note, @data, @created_at);

-- name: GetTicket :one
SELECT
    t.id, t.ticket_no, t.status, t.closed_reason, t.priority, t.priority_source,
    t.category_id, c.name AS category_name, t.category_other, t.symptom_other,
    t.building_id, b.name AS building_name,
    t.floor_id, f.name AS floor_name,
    t.location_detail, t.details, t.asset_code,
    t.reporter_id, rp.name AS reporter_name, rp.department AS reporter_department,
    t.holder_id, hp.name AS holder_name, hp.department AS holder_department,
    t.result_note,
    t.resolved_by_id, rb.name AS resolved_by_name, rb.department AS resolved_by_department,
    t.rating, t.rating_comment, t.send_back_count,
    t.expected_done_on, t.assessed_at, t.work_by,
    t.contractor_id, ct.name AS contractor_name, t.contractor_rating, t.contractor_rating_comment,
    t.auto_close_at, t.resolved_at, t.closed_at, t.created_at, t.updated_at,
    EXISTS (SELECT 1 FROM repair.ticket_subscribers s WHERE s.ticket_id = t.id AND s.user_id = @viewer_id) AS viewer_subscribed,
    (SELECT count(*) FROM repair.ticket_subscribers s WHERE s.ticket_id = t.id) AS subscriber_count
FROM repair.tickets t
LEFT JOIN repair.categories c ON c.id = t.category_id
JOIN repair.buildings b ON b.id = t.building_id
JOIN repair.floors f ON f.id = t.floor_id
JOIN repair.people rp ON rp.id = t.reporter_id
LEFT JOIN repair.people hp ON hp.id = t.holder_id
LEFT JOIN repair.people rb ON rb.id = t.resolved_by_id
LEFT JOIN repair.contractors ct ON ct.id = t.contractor_id
WHERE t.id = @id;

-- name: ListTickets :many
-- Filters are shared with CountTickets and CountTicketsByStatus; keep the WHERE clauses identical.
SELECT
    t.id, t.ticket_no, t.status, t.closed_reason, t.priority, t.priority_source,
    t.category_id, c.name AS category_name, t.category_other, t.symptom_other,
    t.building_id, b.name AS building_name,
    t.floor_id, f.name AS floor_name,
    t.location_detail,
    t.reporter_id, rp.name AS reporter_name, rp.department AS reporter_department,
    t.holder_id, hp.name AS holder_name, hp.department AS holder_department,
    t.rating, t.send_back_count,
    t.expected_done_on, t.assessed_at, t.work_by,
    t.contractor_id, ct.name AS contractor_name,
    t.auto_close_at, t.resolved_at, t.closed_at, t.created_at, t.updated_at,
    EXISTS (SELECT 1 FROM repair.ticket_subscribers s WHERE s.ticket_id = t.id AND s.user_id = @viewer_id) AS viewer_subscribed
FROM repair.tickets t
LEFT JOIN repair.categories c ON c.id = t.category_id
JOIN repair.buildings b ON b.id = t.building_id
JOIN repair.floors f ON f.id = t.floor_id
JOIN repair.people rp ON rp.id = t.reporter_id
LEFT JOIN repair.people hp ON hp.id = t.holder_id
LEFT JOIN repair.contractors ct ON ct.id = t.contractor_id
WHERE (@scope_all::boolean OR (
        (@relation::text IN ('all', 'reported') AND t.reporter_id = @viewer_id)
     OR (@relation::text IN ('all', 'following') AND EXISTS (
            SELECT 1 FROM repair.ticket_subscribers s WHERE s.ticket_id = t.id AND s.user_id = @viewer_id))))
  AND (cardinality(@statuses::text[]) = 0 OR t.status = ANY(@statuses::text[]))
  AND (cardinality(@steps::text[]) = 0 OR (CASE
        WHEN t.status = 'closed' THEN 'closed'
        WHEN t.status = 'resolved' THEN 'awaiting_rating'
        WHEN t.expected_done_on IS NULL THEN 'awaiting_assessment'
        WHEN t.send_back_count > 0 THEN 'reworking'
        ELSE 'in_repair' END) = ANY(@steps::text[]))
  AND (sqlc.narg('closed_reason')::text IS NULL OR t.closed_reason = sqlc.narg('closed_reason')::text)
  AND (sqlc.narg('q')::text IS NULL OR t.ticket_no ILIKE '%' || sqlc.narg('q')::text || '%'
       OR t.location_detail ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('created_from')::timestamptz IS NULL OR t.created_at >= sqlc.narg('created_from')::timestamptz)
  AND (sqlc.narg('created_to')::timestamptz IS NULL OR t.created_at <= sqlc.narg('created_to')::timestamptz)
  AND (sqlc.narg('category_id')::uuid IS NULL OR t.category_id = sqlc.narg('category_id')::uuid)
  AND (sqlc.narg('building_id')::uuid IS NULL OR t.building_id = sqlc.narg('building_id')::uuid)
  AND (sqlc.narg('floor_id')::uuid IS NULL OR t.floor_id = sqlc.narg('floor_id')::uuid)
  AND (sqlc.narg('priority')::text IS NULL OR t.priority = sqlc.narg('priority')::text)
ORDER BY
    -- BR-F06-2: resolved tickets awaiting the viewer's rating first
    (@awaiting_first::boolean AND t.status = 'resolved' AND t.reporter_id = @viewer_id) DESC,
    -- technician work list (BR-F21-1): most urgent, then oldest
    CASE WHEN @sort::text = 'priority:asc' THEN
        CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END END ASC,
    CASE WHEN @sort::text = 'priority:asc' THEN t.created_at END ASC,
    CASE WHEN @sort::text = 'closedAt:desc' THEN t.closed_at END DESC NULLS LAST,
    CASE WHEN @sort::text = 'createdAt:desc' THEN t.created_at END DESC,
    CASE WHEN @sort::text = 'createdAt:asc' THEN t.created_at END ASC,
    t.updated_at DESC, t.id
LIMIT @page_limit OFFSET @page_offset;

-- name: CountTickets :one
SELECT count(*) FROM repair.tickets t
WHERE (@scope_all::boolean OR (
        (@relation::text IN ('all', 'reported') AND t.reporter_id = @viewer_id)
     OR (@relation::text IN ('all', 'following') AND EXISTS (
            SELECT 1 FROM repair.ticket_subscribers s WHERE s.ticket_id = t.id AND s.user_id = @viewer_id))))
  AND (cardinality(@statuses::text[]) = 0 OR t.status = ANY(@statuses::text[]))
  AND (cardinality(@steps::text[]) = 0 OR (CASE
        WHEN t.status = 'closed' THEN 'closed'
        WHEN t.status = 'resolved' THEN 'awaiting_rating'
        WHEN t.expected_done_on IS NULL THEN 'awaiting_assessment'
        WHEN t.send_back_count > 0 THEN 'reworking'
        ELSE 'in_repair' END) = ANY(@steps::text[]))
  AND (sqlc.narg('closed_reason')::text IS NULL OR t.closed_reason = sqlc.narg('closed_reason')::text)
  AND (sqlc.narg('q')::text IS NULL OR t.ticket_no ILIKE '%' || sqlc.narg('q')::text || '%'
       OR t.location_detail ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('created_from')::timestamptz IS NULL OR t.created_at >= sqlc.narg('created_from')::timestamptz)
  AND (sqlc.narg('created_to')::timestamptz IS NULL OR t.created_at <= sqlc.narg('created_to')::timestamptz)
  AND (sqlc.narg('category_id')::uuid IS NULL OR t.category_id = sqlc.narg('category_id')::uuid)
  AND (sqlc.narg('building_id')::uuid IS NULL OR t.building_id = sqlc.narg('building_id')::uuid)
  AND (sqlc.narg('floor_id')::uuid IS NULL OR t.floor_id = sqlc.narg('floor_id')::uuid)
  AND (sqlc.narg('priority')::text IS NULL OR t.priority = sqlc.narg('priority')::text);

-- name: CountTicketsByStatus :one
SELECT
    count(*) FILTER (WHERE t.status = 'in_progress') AS in_progress_count,
    count(*) FILTER (WHERE t.status = 'resolved') AS resolved_count,
    count(*) FILTER (WHERE t.status = 'closed') AS closed_count,
    count(*) FILTER (WHERE t.status = 'in_progress' AND t.expected_done_on IS NULL) AS awaiting_assessment_count,
    count(*) FILTER (WHERE t.status = 'in_progress' AND t.expected_done_on IS NOT NULL) AS in_repair_count,
    count(*) FILTER (WHERE t.status = 'resolved' AND t.reporter_id = @viewer_id) AS awaiting_my_confirmation_count
FROM repair.tickets t
WHERE (@scope_all::boolean OR (
        (@relation::text IN ('all', 'reported') AND t.reporter_id = @viewer_id)
     OR (@relation::text IN ('all', 'following') AND EXISTS (
            SELECT 1 FROM repair.ticket_subscribers s WHERE s.ticket_id = t.id AND s.user_id = @viewer_id))))
  AND (sqlc.narg('closed_reason')::text IS NULL OR t.closed_reason = sqlc.narg('closed_reason')::text)
  AND (sqlc.narg('q')::text IS NULL OR t.ticket_no ILIKE '%' || sqlc.narg('q')::text || '%'
       OR t.location_detail ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('created_from')::timestamptz IS NULL OR t.created_at >= sqlc.narg('created_from')::timestamptz)
  AND (sqlc.narg('created_to')::timestamptz IS NULL OR t.created_at <= sqlc.narg('created_to')::timestamptz)
  AND (sqlc.narg('category_id')::uuid IS NULL OR t.category_id = sqlc.narg('category_id')::uuid)
  AND (sqlc.narg('building_id')::uuid IS NULL OR t.building_id = sqlc.narg('building_id')::uuid)
  AND (sqlc.narg('floor_id')::uuid IS NULL OR t.floor_id = sqlc.narg('floor_id')::uuid)
  AND (sqlc.narg('priority')::text IS NULL OR t.priority = sqlc.narg('priority')::text);

-- name: ListSymptomsForTickets :many
SELECT ts.ticket_id, s.id, s.name FROM repair.ticket_symptoms ts
JOIN repair.symptoms s ON s.id = ts.symptom_id
WHERE ts.ticket_id = ANY(@ticket_ids::uuid[])
ORDER BY ts.ticket_id, ts.sort_order;

-- name: FirstReportPhotos :many
SELECT DISTINCT ON (ticket_id) ticket_id, photo_id FROM repair.ticket_photos
WHERE ticket_id = ANY(@ticket_ids::uuid[]) AND kind = 'report'
ORDER BY ticket_id, sort_order;

-- name: ListTicketEvents :many
SELECT e.id, e.type, e.actor_id, ap.name AS actor_name, ap.department AS actor_department,
       e.note, e.data, e.created_at
FROM repair.ticket_events e
LEFT JOIN repair.people ap ON ap.id = e.actor_id
WHERE e.ticket_id = @ticket_id
ORDER BY e.created_at DESC, e.id DESC;

-- name: GetTicketAccess :one
-- The fields the visibility rule needs (BR-F06-1), without loading the whole detail.
SELECT t.reporter_id, t.holder_id,
       EXISTS (SELECT 1 FROM repair.ticket_subscribers s WHERE s.ticket_id = t.id AND s.user_id = @viewer_id) AS viewer_subscribed
FROM repair.tickets t
WHERE t.id = @id;

-- name: LockTicket :one
-- Every status change locks the row first, so concurrent actions see each other's result.
SELECT id, status, reporter_id, expected_done_on, work_by, contractor_id, contractor_rating FROM repair.tickets
WHERE id = @id
FOR UPDATE;

-- name: AssessTicket :exec
-- CR-006: the assessment = expected finish date + who does the work. Changing the contractor drops
-- the old contractor's rating (it belonged to the previous one).
UPDATE repair.tickets
SET expected_done_on = @expected_done_on, holder_id = @technician_id,
    work_by = @work_by,
    contractor_rating = CASE WHEN contractor_id IS NOT DISTINCT FROM sqlc.narg('contractor_id')::uuid THEN contractor_rating END,
    contractor_rating_comment = CASE WHEN contractor_id IS NOT DISTINCT FROM sqlc.narg('contractor_id')::uuid THEN contractor_rating_comment END,
    contractor_id = sqlc.narg('contractor_id')::uuid,
    assessed_at = COALESCE(assessed_at, @now), updated_at = @now
WHERE id = @id;

-- name: ResolveTicket :exec
UPDATE repair.tickets
SET status = 'resolved', result_note = @note, resolved_by_id = @technician_id, holder_id = @technician_id,
    contractor_rating = COALESCE(sqlc.narg('contractor_rating')::smallint, contractor_rating),
    contractor_rating_comment = CASE WHEN sqlc.narg('contractor_rating')::smallint IS NULL THEN contractor_rating_comment
                                     ELSE sqlc.narg('contractor_rating_comment')::text END,
    resolved_at = @now, auto_close_at = @auto_close_at, updated_at = @now
WHERE id = @id;

-- name: ConfirmTicket :exec
UPDATE repair.tickets
SET status = 'closed', closed_reason = 'confirmed', rating = @rating, rating_comment = sqlc.narg('rating_comment')::text,
    closed_at = @now, auto_close_at = NULL, updated_at = @now
WHERE id = @id;

-- name: SendBackTicket :exec
UPDATE repair.tickets
SET status = 'in_progress', send_back_count = send_back_count + 1, auto_close_at = NULL, updated_at = @now
WHERE id = @id;

-- name: AutoCloseDueTickets :many
-- BR-F07-4: resolved tickets nobody rated within 3 days. Idempotent: closed rows no longer match.
UPDATE repair.tickets
SET status = 'closed', closed_reason = 'auto_closed', closed_at = @now, auto_close_at = NULL, updated_at = @now
WHERE status = 'resolved' AND auto_close_at <= @now
RETURNING id;

-- name: InsertAutoClosedEvents :exec
INSERT INTO repair.ticket_events (ticket_id, type, created_at)
SELECT unnest(@ticket_ids::uuid[]), 'auto_closed', @now;

-- name: ListRecentPlaces :many
-- "ที่เคยแจ้ง" (#28, CR-008): the reporter's last 3 distinct places on active buildings / floors.
SELECT p.building_id, p.building_name, p.floor_id, p.floor_name, p.location_detail, p.last_reported_at
FROM (
    SELECT DISTINCT ON (t.building_id, t.floor_id, COALESCE(t.location_detail, ''))
        t.building_id, b.name AS building_name, t.floor_id, f.name AS floor_name,
        t.location_detail, t.created_at AS last_reported_at
    FROM repair.tickets t
    JOIN repair.buildings b ON b.id = t.building_id AND b.is_active
    JOIN repair.floors f ON f.id = t.floor_id AND f.is_active
    WHERE t.reporter_id = @reporter_id
    ORDER BY t.building_id, t.floor_id, COALESCE(t.location_detail, ''), t.created_at DESC
) p
ORDER BY p.last_reported_at DESC
LIMIT 3;
