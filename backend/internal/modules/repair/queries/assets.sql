-- CR-016: dashboard overview (#27), floor plans (#30) and equipment (#29, #31–#34).

-- name: OverviewCounts :one
-- BR-F23-1: the same step rules as S11 (CountTicketsByStatus); "today" / "last 7 days" start at
-- Bangkok midnight, passed in by the service.
SELECT
    count(*) FILTER (WHERE t.status <> 'closed') AS open_count,
    count(*) FILTER (WHERE t.status = 'in_progress' AND t.expected_done_on IS NULL) AS awaiting_assessment_count,
    count(*) FILTER (WHERE t.status = 'in_progress' AND t.expected_done_on IS NOT NULL) AS in_repair_count,
    count(*) FILTER (WHERE t.status = 'in_progress' AND t.expected_done_on IS NOT NULL AND t.send_back_count > 0) AS reworking_count,
    count(*) FILTER (WHERE t.status = 'resolved') AS awaiting_rating_count,
    count(*) FILTER (WHERE t.status = 'in_progress' AND t.expected_done_on < @today::date) AS overdue_count,
    count(*) FILTER (WHERE t.created_at >= @day_start::timestamptz) AS reported_today_count,
    count(*) FILTER (WHERE t.status = 'closed' AND t.closed_at >= @day_start::timestamptz) AS closed_today_count,
    count(*) FILTER (WHERE t.status = 'closed' AND t.closed_at >= @week_start::timestamptz) AS closed_last7_count,
    count(*) FILTER (WHERE t.status = 'closed' AND t.closed_at >= @week_start::timestamptz AND t.rating IS NOT NULL) AS rated_last7_count,
    COALESCE(sum(t.rating) FILTER (WHERE t.status = 'closed' AND t.closed_at >= @week_start::timestamptz), 0)::bigint AS rating_sum_last7
FROM repair.tickets t;

-- name: OldestAwaitingAssessment :one
SELECT created_at FROM repair.tickets
WHERE status = 'in_progress' AND expected_done_on IS NULL
ORDER BY created_at
LIMIT 1;

-- name: NextAutoClose :one
SELECT auto_close_at::timestamptz FROM repair.tickets
WHERE status = 'resolved' AND auto_close_at IS NOT NULL
ORDER BY auto_close_at
LIMIT 1;

-- name: OverviewFloors :many
-- Every active floor with its open tickets per priority and per step (S11 rules, CR-017); floors without
-- open tickets included.
SELECT f.id, f.building_id, f.name, f.level,
    count(t.id) FILTER (WHERE t.priority = 'critical') AS critical_count,
    count(t.id) FILTER (WHERE t.priority = 'high') AS high_count,
    count(t.id) FILTER (WHERE t.priority = 'medium') AS medium_count,
    count(t.id) FILTER (WHERE t.priority = 'low') AS low_count,
    count(t.id) FILTER (WHERE t.status = 'in_progress' AND t.expected_done_on IS NULL) AS awaiting_assessment_count,
    count(t.id) FILTER (WHERE t.status = 'in_progress' AND t.expected_done_on IS NOT NULL) AS in_repair_count,
    count(t.id) FILTER (WHERE t.status = 'resolved') AS awaiting_rating_count
FROM repair.floors f
JOIN repair.buildings b ON b.id = f.building_id
LEFT JOIN repair.tickets t ON t.floor_id = f.id AND t.status <> 'closed'
WHERE f.is_active AND b.is_active
GROUP BY f.id
ORDER BY f.level;

-- name: BuildingsWithPlans :many
-- Buildings with a floor plan and their footprint (the largest plan of the building, CR-017).
SELECT f.building_id, max(fp.width_m)::float8 AS width_m, max(fp.depth_m)::float8 AS depth_m
FROM platform.floor_plans fp
JOIN repair.floors f ON f.id = fp.floor_id
WHERE f.is_active
GROUP BY f.building_id;

-- name: AttentionTicketIDs :many
-- #27 attention: overdue first, then reworking, then critical / high, oldest report first.
SELECT t.id FROM repair.tickets t
WHERE t.status = 'in_progress'
  AND ((t.expected_done_on IS NOT NULL AND (t.expected_done_on < @today::date OR t.send_back_count > 0))
       OR t.priority IN ('critical', 'high'))
ORDER BY
    (t.expected_done_on IS NOT NULL AND t.expected_done_on < @today::date) DESC,
    (t.expected_done_on IS NOT NULL AND t.send_back_count > 0) DESC,
    (t.priority = 'critical') DESC,
    t.created_at, t.id
LIMIT @row_limit;

-- name: ListActiveAssetTypes :many
SELECT id, key, name, code_prefix, icon, mount FROM platform.asset_types
WHERE is_active
ORDER BY sort_order, name;

-- name: GetFloorPlan :one
SELECT f.id, f.name, f.level, b.id AS building_id, b.name AS building_name,
    COALESCE(fp.width_m, 0)::float8 AS width_m, COALESCE(fp.depth_m, 0)::float8 AS depth_m, fp.model_file,
    (fp.floor_id IS NOT NULL)::boolean AS has_plan
FROM repair.floors f
JOIN repair.buildings b ON b.id = f.building_id
LEFT JOIN platform.floor_plans fp ON fp.floor_id = f.id
WHERE f.id = @id AND f.is_active AND b.is_active;

-- name: ListFloorRooms :many
-- Active rooms of a floor with their open tickets per priority.
SELECT r.id, r.name, r.area_type, r.plan_shape,
    count(t.id) FILTER (WHERE t.priority = 'critical') AS critical_count,
    count(t.id) FILTER (WHERE t.priority = 'high') AS high_count,
    count(t.id) FILTER (WHERE t.priority = 'medium') AS medium_count,
    count(t.id) FILTER (WHERE t.priority = 'low') AS low_count
FROM platform.rooms r
LEFT JOIN repair.tickets t ON t.room_id = r.id AND t.status <> 'closed'
WHERE r.floor_id = @floor_id AND r.is_active
GROUP BY r.id
ORDER BY r.sort_order, r.name;

-- name: ListFloorAssets :many
SELECT a.id, a.code, a.name, at.id AS type_id, at.key AS type_key, at.name AS type_name,
    r.id AS room_id, r.name AS room_name, COALESCE(a.pos_x, 0)::float8 AS pos_x, COALESCE(a.pos_z, 0)::float8 AS pos_z, (a.pos_x IS NOT NULL)::boolean AS placed, a.rotation_deg,
    (SELECT count(*) FROM repair.tickets t WHERE t.asset_id = a.id AND t.status <> 'closed') AS open_tickets
FROM platform.assets a
JOIN platform.asset_types at ON at.id = a.asset_type_id
JOIN platform.rooms r ON r.id = a.room_id
WHERE r.floor_id = @floor_id AND a.is_active
ORDER BY a.code;

-- name: GetAsset :one
SELECT a.id, a.code, a.name, at.id AS type_id, at.key AS type_key, at.name AS type_name,
    r.id AS room_id, r.name AS room_name, COALESCE(a.pos_x, 0)::float8 AS pos_x, COALESCE(a.pos_z, 0)::float8 AS pos_z, (a.pos_x IS NOT NULL)::boolean AS placed, a.rotation_deg,
    (SELECT count(*) FROM repair.tickets t WHERE t.asset_id = a.id AND t.status <> 'closed') AS open_tickets
FROM platform.assets a
JOIN platform.asset_types at ON at.id = a.asset_type_id
JOIN platform.rooms r ON r.id = a.room_id
WHERE a.id = @id AND a.is_active;

-- name: LockAsset :one
-- The asset as it is before a change (audit "before"); locked until the transaction ends.
SELECT a.id, a.code, a.name, a.asset_type_id, a.room_id, COALESCE(a.pos_x, 0)::float8 AS pos_x, COALESCE(a.pos_z, 0)::float8 AS pos_z, (a.pos_x IS NOT NULL)::boolean AS placed,
    a.rotation_deg, a.is_active
FROM platform.assets a
WHERE a.id = @id
FOR UPDATE;

-- name: GetActiveAssetType :one
SELECT id, key, code_prefix FROM platform.asset_types WHERE id = @id AND is_active;

-- name: GetPlacementRoom :one
-- The room an asset goes into, with its floor's plan size (NULL when the floor has no plan).
SELECT r.id, r.floor_id, r.plan_shape, COALESCE(fp.width_m, 0)::float8 AS width_m, COALESCE(fp.depth_m, 0)::float8 AS depth_m,
    (fp.floor_id IS NOT NULL)::boolean AS has_plan
FROM platform.rooms r
JOIN repair.floors f ON f.id = r.floor_id
LEFT JOIN platform.floor_plans fp ON fp.floor_id = r.floor_id
WHERE r.id = @id AND r.is_active AND f.is_active;

-- name: ListRoomShapesOnFloor :many
SELECT id, plan_shape FROM platform.rooms
WHERE floor_id = @floor_id AND is_active AND plan_shape IS NOT NULL;

-- name: AssetCodeTaken :one
-- BR-F31-1: unique ignoring case, inactive assets included.
SELECT EXISTS (
    SELECT 1 FROM platform.assets WHERE lower(code) = lower(@code) AND id <> @exclude_id
);

-- name: ListAssetCodesWithPrefix :many
SELECT code FROM platform.assets WHERE lower(code) LIKE lower(@prefix::text) || '%';

-- name: GetActiveFloorName :one
SELECT f.name FROM repair.floors f WHERE f.id = @id AND f.is_active;

-- name: InsertAsset :exec
INSERT INTO platform.assets (id, code, name, asset_type_id, room_id, pos_x, pos_z, rotation_deg, created_by, updated_by)
VALUES (@id, @code, @name, @asset_type_id, @room_id, sqlc.narg('pos_x')::float8, sqlc.narg('pos_z')::float8,
    @rotation_deg, @actor_id, @actor_id);

-- name: UpdateAsset :exec
UPDATE platform.assets SET code = @code, name = @name, room_id = @room_id,
    pos_x = sqlc.narg('pos_x')::float8, pos_z = sqlc.narg('pos_z')::float8, rotation_deg = @rotation_deg,
    updated_by = @actor_id, updated_at = now()
WHERE id = @id;

-- name: DeactivateAsset :exec
UPDATE platform.assets SET is_active = false, updated_by = @actor_id, updated_at = now() WHERE id = @id;

-- name: InsertAssetAudit :exec
-- BR-F31-5: every add / move / edit / deactivate (actor, before → after).
INSERT INTO platform.audit_log (actor_user_id, action, target_type, target_id, data)
VALUES (@actor_id, @action, 'asset', @target_id, @data);
