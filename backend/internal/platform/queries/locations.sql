-- Plan locations (settings Stage 4, CR-002, #13 / #15 / #27): buildings → floors → rooms come from the building
-- plan; settings only reads the active tree and renames buildings and rooms.

-- name: ListPlanBuildings :many
SELECT b.id, b.name, b.updated_at, bt.id AS building_type_id, bt.name AS building_type_name,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM platform.buildings b
JOIN platform.building_types bt ON bt.id = b.building_type_id
LEFT JOIN platform.users ub ON ub.id = b.updated_by_id
WHERE b.is_active
ORDER BY b.sort_order, b.name;

-- name: ListPlanFloors :many
-- Floors bottom first (the order of the floor buttons).
SELECT f.id, f.building_id, f.name, f.level
FROM platform.floors f
JOIN platform.buildings b ON b.id = f.building_id AND b.is_active
WHERE f.is_active
ORDER BY f.building_id, f.level;

-- name: ListPlanRooms :many
SELECT r.id, r.floor_id, r.name, r.area_type, r.updated_at,
       (SELECT count(*) FROM platform.assets a WHERE a.room_id = r.id AND a.is_active)::bigint AS active_asset_count,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM platform.rooms r
JOIN platform.floors f ON f.id = r.floor_id AND f.is_active
LEFT JOIN platform.users ub ON ub.id = r.updated_by_id
WHERE r.is_active
ORDER BY r.floor_id, r.sort_order, r.name;

-- name: LockBuilding :one
SELECT b.id, b.name, b.updated_at, b.building_type_id, bt.name AS building_type_name
FROM platform.buildings b JOIN platform.building_types bt ON bt.id = b.building_type_id
WHERE b.id = @id AND b.is_active FOR UPDATE OF b;

-- name: BuildingNameTaken :one
SELECT EXISTS (SELECT 1 FROM platform.buildings WHERE lower(name) = lower(@name::text) AND id <> @self_id)::boolean;

-- name: UpdateBuilding :exec
-- #15: rename and (CR-005) change the building type.
UPDATE platform.buildings SET name = @name, building_type_id = @building_type_id, updated_by_id = @actor_id, updated_at = now() WHERE id = @id;

-- name: LockRoom :one
-- The room with its floor and building names (audit `parentName`, rename dialog subtitle).
SELECT r.id, r.floor_id, r.name, r.updated_at, f.name AS floor_name, b.name AS building_name
FROM platform.rooms r
JOIN platform.floors f ON f.id = r.floor_id
JOIN platform.buildings b ON b.id = f.building_id
WHERE r.id = @id AND r.is_active
FOR UPDATE OF r;

-- name: RoomNameTaken :one
SELECT EXISTS (SELECT 1 FROM platform.rooms WHERE floor_id = @floor_id AND lower(name) = lower(@name::text) AND id <> @self_id)::boolean;

-- name: RenameRoom :exec
UPDATE platform.rooms SET name = @name, updated_by_id = @actor_id, updated_at = now() WHERE id = @id;

-- name: GetRoomPlace :one
-- An active room (on an active floor of an active building) with its names; no row = unknown or inactive.
SELECT r.id, r.floor_id, r.name, f.name AS floor_name, b.id AS building_id, b.name AS building_name
FROM platform.rooms r
JOIN platform.floors f ON f.id = r.floor_id AND f.is_active
JOIN platform.buildings b ON b.id = f.building_id AND b.is_active
WHERE r.id = @id AND r.is_active;

-- Building types (settings Stage 4P, CR-005, #53–#55). Which categories a type uses lives in repair.

-- name: ListBuildingTypes :many
-- All types, active first, in sort_order; building_count = active buildings of the type.
SELECT t.id, t.name, t.sort_order, t.is_active, t.updated_at,
       (SELECT count(*) FROM platform.buildings b WHERE b.building_type_id = t.id AND b.is_active)::bigint AS building_count,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM platform.building_types t
LEFT JOIN platform.users ub ON ub.id = t.updated_by_id
ORDER BY t.is_active DESC, t.sort_order, t.name;

-- name: GetActiveBuildingType :one
SELECT id, name FROM platform.building_types WHERE id = @id AND is_active;

-- name: LockBuildingType :one
SELECT t.id, t.name, t.is_active, t.updated_at,
       (EXISTS (SELECT 1 FROM platform.buildings b WHERE b.building_type_id = t.id AND b.is_active))::boolean AS in_use
FROM platform.building_types t WHERE t.id = @id FOR UPDATE;

-- name: BuildingTypeNameTaken :one
SELECT EXISTS (SELECT 1 FROM platform.building_types WHERE lower(name) = lower(@name::text) AND id <> @self_id)::boolean;

-- name: InsertBuildingType :exec
-- A new type goes last.
INSERT INTO platform.building_types (id, name, sort_order, updated_by_id)
VALUES (@id, @name, (SELECT coalesce(max(sort_order), 0) + 1 FROM platform.building_types), @actor_id);

-- name: UpdateBuildingType :exec
UPDATE platform.building_types SET name = @name, is_active = @is_active, updated_by_id = @actor_id, updated_at = now() WHERE id = @id;
