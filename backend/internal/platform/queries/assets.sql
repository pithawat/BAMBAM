-- Assets and asset types as settings manages them (Stage 4, CR-001 / CR-002, #46–#52). The 3D placement
-- endpoints of repair S29 (#29–#34) keep their own queries on the same tables.

-- name: ListRoomAssets :many
SELECT a.id, a.code, a.name, a.is_active, a.room_id, (a.pos_x IS NOT NULL)::boolean AS placed, a.updated_at,
       a.label_snapshot, a.label_printed_at, r.name AS room_name, f.name AS floor_name, b.name AS building_name,
       t.id AS type_id, t.key AS type_key, t.name AS type_name, t.icon AS type_icon,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM platform.assets a
JOIN platform.asset_types t ON t.id = a.asset_type_id
JOIN platform.rooms r ON r.id = a.room_id
JOIN platform.floors f ON f.id = r.floor_id
JOIN platform.buildings b ON b.id = f.building_id
LEFT JOIN platform.users ub ON ub.id = a.updated_by
WHERE a.room_id = @room_id
  AND (@include_inactive::boolean OR a.is_active)
  AND (sqlc.narg(asset_type_id)::uuid IS NULL OR a.asset_type_id = sqlc.narg(asset_type_id)::uuid)
  AND (sqlc.narg(q)::text IS NULL OR a.code ILIKE '%' || sqlc.narg(q)::text || '%' OR a.name ILIKE '%' || sqlc.narg(q)::text || '%')
ORDER BY lower(a.code);

-- name: GetAssetAdmin :one
SELECT a.id, a.code, a.name, a.is_active, a.room_id, (a.pos_x IS NOT NULL)::boolean AS placed, a.updated_at,
       a.label_snapshot, a.label_printed_at, r.name AS room_name, f.name AS floor_name, b.name AS building_name,
       t.id AS type_id, t.key AS type_key, t.name AS type_name, t.icon AS type_icon,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM platform.assets a
JOIN platform.asset_types t ON t.id = a.asset_type_id
JOIN platform.rooms r ON r.id = a.room_id
JOIN platform.floors f ON f.id = r.floor_id
JOIN platform.buildings b ON b.id = f.building_id
LEFT JOIN platform.users ub ON ub.id = a.updated_by
WHERE a.id = @id;

-- name: LockAssetAdmin :one
SELECT id, code, name, asset_type_id, room_id, is_active, updated_at, (label_printed_at IS NOT NULL)::boolean AS label_printed
FROM platform.assets WHERE id = @id FOR UPDATE;

-- name: AssetCodeInUse :one
-- Any asset, active or not, case-insensitive (repair BR-F31-1).
SELECT EXISTS (SELECT 1 FROM platform.assets WHERE lower(code) = lower(@code::text) AND id <> @self_id)::boolean;

-- name: InsertAssetAdmin :exec
INSERT INTO platform.assets (id, code, name, asset_type_id, room_id, created_by, updated_by)
VALUES (@id, @code, @name, @asset_type_id, @room_id, @actor_id, @actor_id);

-- name: UpdateAssetAdmin :exec
-- Moving to another room clears the 3D position (it is set again in repair S29).
UPDATE platform.assets SET
    code = @code, name = @name, is_active = @is_active,
    pos_x = CASE WHEN room_id = @room_id THEN pos_x END,
    pos_z = CASE WHEN room_id = @room_id THEN pos_z END,
    room_id = @room_id,
    updated_by = @actor_id, updated_at = now()
WHERE id = @id;

-- name: AssetCodesStartingWith :many
SELECT code FROM platform.assets WHERE lower(code) LIKE lower(@prefix::text) || '%';

-- name: ListAssetTypesAdmin :many
SELECT t.id, t.key, t.name, t.code_prefix, t.icon, t.mount, t.sort_order, t.updated_at,
       (SELECT count(*) FROM platform.assets a WHERE a.asset_type_id = t.id AND a.is_active)::bigint AS active_asset_count,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM platform.asset_types t
LEFT JOIN platform.users ub ON ub.id = t.updated_by_id
WHERE t.is_active
ORDER BY t.sort_order, t.name;

-- name: GetActiveAssetType :one
SELECT id, key, name, code_prefix, icon, mount, updated_at FROM platform.asset_types WHERE id = @id AND is_active;

-- name: LockAssetType :one
SELECT id, key, name, code_prefix, icon, mount, updated_at FROM platform.asset_types WHERE id = @id AND is_active FOR UPDATE;

-- name: AssetTypeNameInUse :one
SELECT EXISTS (SELECT 1 FROM platform.asset_types WHERE lower(name) = lower(@name::text) AND id <> @self_id)::boolean;

-- name: AssetTypePrefixInUse :one
SELECT EXISTS (SELECT 1 FROM platform.asset_types WHERE upper(code_prefix) = upper(@code_prefix::text) AND id <> @self_id)::boolean;

-- name: InsertAssetType :exec
-- A new type goes last.
INSERT INTO platform.asset_types (id, key, name, code_prefix, icon, mount, sort_order, updated_by_id)
VALUES (@id, @key, @name, @code_prefix, @icon, @mount,
        (SELECT coalesce(max(sort_order), 0) + 1 FROM platform.asset_types), @actor_id);

-- name: UpdateAssetType :exec
UPDATE platform.asset_types SET name = @name, code_prefix = @code_prefix, icon = @icon, mount = @mount,
    updated_by_id = @actor_id, updated_at = now()
WHERE id = @id;

-- QR labels (repair CR-036 / settings CR-007, Stage 5B, #56 / #57).

-- name: ActiveBuildingExists :one
SELECT EXISTS (SELECT 1 FROM platform.buildings WHERE id = @id AND is_active)::boolean;

-- name: ListLabelAssets :many
-- #56: active assets in active rooms of one building, floor level → room name → code.
SELECT a.id, a.code, a.name, a.label_snapshot, a.label_printed_at,
       b.id AS building_id, b.name AS building_name, f.id AS floor_id, f.name AS floor_name, f.level AS floor_level,
       r.id AS room_id, r.name AS room_name
FROM platform.assets a
JOIN platform.rooms r ON r.id = a.room_id AND r.is_active
JOIN platform.floors f ON f.id = r.floor_id AND f.is_active
JOIN platform.buildings b ON b.id = f.building_id
WHERE b.id = @building_id AND a.is_active
  AND (sqlc.narg(floor_id)::uuid IS NULL OR f.id = sqlc.narg(floor_id)::uuid)
  AND (sqlc.narg(room_id)::uuid IS NULL OR r.id = sqlc.narg(room_id)::uuid)
ORDER BY f.level, r.name, lower(a.code);

-- name: LockLabelAssets :many
-- #57: the active assets to mark printed, with today's label text; locked until the transaction ends.
SELECT a.id, a.code, a.name, b.id AS building_id, b.name AS building_name, f.id AS floor_id, f.name AS floor_name,
       r.id AS room_id, r.name AS room_name
FROM platform.assets a
JOIN platform.rooms r ON r.id = a.room_id
JOIN platform.floors f ON f.id = r.floor_id
JOIN platform.buildings b ON b.id = f.building_id
WHERE a.id = ANY(@ids::uuid[]) AND a.is_active
FOR UPDATE OF a;

-- name: MarkLabelPrinted :exec
-- Printing is not an edit: updated_at stays, so open S20 dialogs keep their version.
UPDATE platform.assets SET label_snapshot = @snapshot, label_printed_at = now(), label_printed_by = @actor_id
WHERE id = @id;
