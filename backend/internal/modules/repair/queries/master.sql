-- name: ListActiveCategories :many
-- The "อื่น ๆ" category is listed last (CR-014).
SELECT id, name, icon, default_priority, is_other FROM repair.categories
WHERE is_active
ORDER BY is_other, sort_order, name;

-- name: ListCategoryAreaTypes :many
SELECT category_id, area_type FROM repair.category_area_types
ORDER BY category_id, area_type;

-- name: ListActiveSymptoms :many
SELECT s.id, s.category_id, s.name, s.priority FROM repair.symptoms s
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

-- name: ListActiveRooms :many
-- Rooms of active floors (CR-014); the common area comes last by its sort order.
SELECT r.id, r.floor_id, r.name, r.area_type FROM platform.rooms r
WHERE r.is_active
ORDER BY r.sort_order, r.name;

-- Sample locations (dev / UAT only, D-032): inserted by id, existing rows are left as they are.
-- name: InsertSampleBuilding :exec
INSERT INTO repair.buildings (id, name, sort_order) VALUES (@id, @name, @sort_order)
ON CONFLICT DO NOTHING;

-- name: InsertSampleFloor :exec
INSERT INTO repair.floors (id, building_id, name, level) VALUES (@id, @building_id, @name, @level)
ON CONFLICT DO NOTHING;

-- name: InsertSampleRoom :exec
INSERT INTO platform.rooms (id, floor_id, name, area_type, sort_order) VALUES (@id, @floor_id, @name, @area_type, @sort_order)
ON CONFLICT DO NOTHING;

-- name: LockActiveCategory :one
-- Locks the category so it cannot be deactivated while a ticket is created in it; returns its default
-- priority (CR-008) and whether it is the "อื่น ๆ" category (CR-014).
SELECT default_priority, is_other FROM repair.categories
WHERE id = @id AND is_active
FOR NO KEY UPDATE;

-- name: ActiveSymptomPriorities :many
-- The priorities of the picked symptoms that are active and belong to the category (CR-008).
SELECT priority FROM repair.symptoms
WHERE id = ANY(@ids::uuid[]) AND category_id = @category_id AND is_active;

-- name: ActiveFloorInBuilding :one
SELECT EXISTS (
    SELECT 1 FROM repair.floors f
    JOIN repair.buildings b ON b.id = f.building_id
    WHERE f.id = @floor_id AND f.building_id = @building_id AND f.is_active AND b.is_active
);

-- name: ActiveRoomOnFloor :one
-- CR-014: the picked room must be active and on the picked floor.
SELECT EXISTS (
    SELECT 1 FROM platform.rooms r
    WHERE r.id = @room_id AND r.floor_id = @floor_id AND r.is_active
);

-- name: GetSettings :one
SELECT ticket_prefix, ticket_year_format, ticket_digits FROM repair.settings WHERE id;

-- name: NextTicketCounter :one
-- The upsert locks the year's row until the transaction ends, so concurrent creates get distinct numbers.
INSERT INTO repair.ticket_counters (year, last_no) VALUES (@year, 1)
ON CONFLICT (year) DO UPDATE SET last_no = repair.ticket_counters.last_no + 1, updated_at = now()
RETURNING last_no;

-- Sample data refresh (dev / UAT only, D-032, CR-008): applied by id so existing databases keep their ids.
-- name: RenameSampleBuilding :exec
UPDATE repair.buildings SET name = @new_name, updated_at = now() WHERE id = @id AND name = @old_name;
