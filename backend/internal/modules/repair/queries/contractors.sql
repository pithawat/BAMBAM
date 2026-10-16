-- name: ListContractorTypes :many
SELECT id, name FROM repair.contractor_types
ORDER BY lower(name);

-- name: GetContractorTypeByName :one
SELECT id, name FROM repair.contractor_types
WHERE lower(name) = lower(@name);

-- name: InsertContractorType :one
-- A concurrent insert of the same name keeps the first row (unique on lower(name)).
INSERT INTO repair.contractor_types (name, created_by_id) VALUES (@name, @created_by_id)
ON CONFLICT ((lower(name))) DO NOTHING
RETURNING id, name;

-- name: CountContractorTypes :one
SELECT count(*) FROM repair.contractor_types WHERE id = ANY(@ids::uuid[]);

-- name: ListContractors :many
SELECT c.id, c.name, c.contact_name, c.phone, c.note, c.is_active, c.created_at, c.updated_at,
       (SELECT count(*) FROM repair.tickets t WHERE t.contractor_id = c.id) AS job_count,
       (SELECT COALESCE(avg(t.contractor_rating), 0)::float8 FROM repair.tickets t WHERE t.contractor_id = c.id AND t.contractor_rating IS NOT NULL) AS avg_rating,
       (SELECT count(t.contractor_rating) FROM repair.tickets t WHERE t.contractor_id = c.id) AS rated_count
FROM repair.contractors c
WHERE (@include_inactive::boolean OR c.is_active)
  AND (sqlc.narg('q')::text IS NULL OR c.name ILIKE '%' || sqlc.narg('q')::text || '%'
       OR c.contact_name ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('type_id')::uuid IS NULL OR EXISTS (
        SELECT 1 FROM repair.contractor_type_links l WHERE l.contractor_id = c.id AND l.type_id = sqlc.narg('type_id')::uuid))
ORDER BY c.is_active DESC, lower(c.name), c.id
LIMIT @page_limit OFFSET @page_offset;

-- name: CountContractors :one
SELECT count(*) FROM repair.contractors c
WHERE (@include_inactive::boolean OR c.is_active)
  AND (sqlc.narg('q')::text IS NULL OR c.name ILIKE '%' || sqlc.narg('q')::text || '%'
       OR c.contact_name ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('type_id')::uuid IS NULL OR EXISTS (
        SELECT 1 FROM repair.contractor_type_links l WHERE l.contractor_id = c.id AND l.type_id = sqlc.narg('type_id')::uuid));

-- name: GetContractor :one
SELECT c.id, c.name, c.contact_name, c.phone, c.note, c.is_active, c.created_at, c.updated_at,
       (SELECT count(*) FROM repair.tickets t WHERE t.contractor_id = c.id) AS job_count,
       (SELECT COALESCE(avg(t.contractor_rating), 0)::float8 FROM repair.tickets t WHERE t.contractor_id = c.id AND t.contractor_rating IS NOT NULL) AS avg_rating,
       (SELECT count(t.contractor_rating) FROM repair.tickets t WHERE t.contractor_id = c.id) AS rated_count
FROM repair.contractors c
WHERE c.id = @id;

-- name: ListTypesForContractors :many
SELECT l.contractor_id, ty.id, ty.name FROM repair.contractor_type_links l
JOIN repair.contractor_types ty ON ty.id = l.type_id
WHERE l.contractor_id = ANY(@contractor_ids::uuid[])
ORDER BY l.contractor_id, lower(ty.name);

-- name: InsertContractor :exec
INSERT INTO repair.contractors (id, name, contact_name, phone, note, created_by_id)
VALUES (@id, @name, @contact_name, @phone, @note, @created_by_id);

-- name: UpdateContractor :execrows
UPDATE repair.contractors
SET name = @name, contact_name = @contact_name, phone = @phone, note = @note, is_active = @is_active, updated_at = now()
WHERE id = @id;

-- name: DeleteContractorTypeLinks :exec
DELETE FROM repair.contractor_type_links WHERE contractor_id = @contractor_id;

-- name: InsertContractorTypeLinks :exec
INSERT INTO repair.contractor_type_links (contractor_id, type_id)
SELECT @contractor_id, unnest(@type_ids::uuid[]);

-- name: ActiveContractorExists :one
SELECT EXISTS (SELECT 1 FROM repair.contractors WHERE id = @id AND is_active);

-- name: ListContractorJobs :many
-- Tickets done by the contractor, newest first (S18 history).
SELECT t.id, t.ticket_no, t.status, t.category_id, c.name AS category_name,
       t.resolved_at, t.contractor_rating, t.contractor_rating_comment, t.rating
FROM repair.tickets t
JOIN repair.categories c ON c.id = t.category_id
WHERE t.contractor_id = @contractor_id
ORDER BY t.resolved_at DESC NULLS LAST, t.id
LIMIT @page_limit OFFSET @page_offset;

-- name: CountContractorJobs :one
SELECT count(*) FROM repair.tickets WHERE contractor_id = @contractor_id;
