-- name: ListActiveCategories :many
SELECT id, name, icon FROM repair.categories
WHERE is_active
ORDER BY sort_order, name;

-- name: ListActiveSymptoms :many
SELECT s.id, s.category_id, s.name FROM repair.symptoms s
JOIN repair.categories c ON c.id = s.category_id
WHERE s.is_active AND c.is_active
ORDER BY s.sort_order, s.name;

-- name: ListActiveBuildings :many
SELECT id, name FROM repair.buildings
WHERE is_active
ORDER BY sort_order, name;

-- name: ListActiveFloors :many
SELECT f.id, f.building_id, f.name, f.level FROM repair.floors f
JOIN repair.buildings b ON b.id = f.building_id
WHERE f.is_active AND b.is_active
ORDER BY f.level;

-- name: CountCategories :one
SELECT count(*) FROM repair.categories;

-- name: InsertCategory :exec
INSERT INTO repair.categories (id, name, icon, sort_order) VALUES (@id, @name, @icon, @sort_order);

-- name: InsertSymptom :exec
INSERT INTO repair.symptoms (id, category_id, name, sort_order) VALUES (@id, @category_id, @name, @sort_order);

-- name: InsertBuilding :exec
INSERT INTO repair.buildings (id, name, sort_order) VALUES (@id, @name, @sort_order);

-- name: InsertFloor :exec
INSERT INTO repair.floors (id, building_id, name, level) VALUES (@id, @building_id, @name, @level);

-- name: LockActiveCategory :one
-- Locks the category so it cannot be deactivated while a ticket is created in it.
SELECT id FROM repair.categories
WHERE id = @id AND is_active
FOR NO KEY UPDATE;

-- name: CountActiveSymptomsInCategory :one
SELECT count(*) FROM repair.symptoms
WHERE id = ANY(@ids::uuid[]) AND category_id = @category_id AND is_active;

-- name: ActiveFloorInBuilding :one
SELECT EXISTS (
    SELECT 1 FROM repair.floors f
    JOIN repair.buildings b ON b.id = f.building_id
    WHERE f.id = @floor_id AND f.building_id = @building_id AND f.is_active AND b.is_active
);

-- name: GetSettings :one
SELECT ticket_prefix, ticket_year_format, ticket_digits FROM repair.settings WHERE id;

-- name: NextTicketCounter :one
-- The upsert locks the year's row until the transaction ends, so concurrent creates get distinct numbers.
INSERT INTO repair.ticket_counters (year, last_no) VALUES (@year, 1)
ON CONFLICT (year) DO UPDATE SET last_no = repair.ticket_counters.last_no + 1, updated_at = now()
RETURNING last_no;
