-- settings Stage 5 (F27, F28, #32–#45): what ตั้งค่าระบบ edits of repair's master data, through
-- SettingsAdmin. `in_use` = referenced by any ticket (categories, symptoms) or contractor (types) → delete refused.

-- name: AdminListCategories :many
SELECT c.id, c.name, c.icon, c.sort_order, c.is_active, c.default_priority, c.is_other, c.updated_at,
       (SELECT count(*) FROM repair.symptoms s WHERE s.category_id = c.id)::bigint AS symptom_count,
       (SELECT count(*) FROM repair.symptoms s WHERE s.category_id = c.id AND s.is_active)::bigint AS active_symptom_count,
       (EXISTS (SELECT 1 FROM repair.tickets t WHERE t.category_id = c.id))::boolean AS in_use,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM repair.categories c
LEFT JOIN platform.users ub ON ub.id = c.updated_by_id
ORDER BY c.sort_order, c.name;

-- name: AdminLockCategory :one
SELECT c.id, c.name, c.icon, c.sort_order, c.is_active, c.default_priority, c.is_other, c.updated_at,
       (EXISTS (SELECT 1 FROM repair.tickets t WHERE t.category_id = c.id))::boolean AS in_use
FROM repair.categories c WHERE c.id = @id FOR UPDATE;

-- name: AdminCategoryNameTaken :one
SELECT EXISTS (SELECT 1 FROM repair.categories WHERE lower(name) = lower(@name::text) AND id <> @self_id)::boolean;

-- name: AdminInsertCategory :exec
-- A new category goes last (the "อื่น ๆ" category stays last in the form by is_other).
INSERT INTO repair.categories (id, name, icon, default_priority, sort_order, updated_by_id)
VALUES (@id, @name, @icon, @default_priority, (SELECT coalesce(max(sort_order), 0) + 1 FROM repair.categories), @actor_id);

-- name: AdminUpdateCategory :exec
UPDATE repair.categories SET name = @name, icon = @icon, default_priority = @default_priority, is_active = @is_active,
    updated_by_id = @actor_id, updated_at = now()
WHERE id = @id;

-- name: AdminCategoryAreaTypes :many
SELECT area_type FROM repair.category_area_types WHERE category_id = @category_id ORDER BY area_type;

-- name: AdminClearCategoryAreaTypes :exec
DELETE FROM repair.category_area_types WHERE category_id = @category_id;

-- name: AdminInsertCategoryAreaType :exec
INSERT INTO repair.category_area_types (category_id, area_type) VALUES (@category_id, @area_type) ON CONFLICT DO NOTHING;

-- name: AdminCategoryHasUsedSymptom :one
SELECT EXISTS (SELECT 1 FROM repair.ticket_symptoms ts JOIN repair.symptoms s ON s.id = ts.symptom_id WHERE s.category_id = @category_id)::boolean;

-- name: AdminDeleteCategoryChildren :exec
-- Before deleting a category: its (unused) symptoms, area types and asset-type links go with it.
DELETE FROM repair.symptoms WHERE category_id = @category_id;

-- name: AdminDeleteCategoryLinks :exec
DELETE FROM repair.asset_type_categories WHERE category_id = @category_id;

-- name: AdminDeleteCategory :exec
DELETE FROM repair.categories WHERE id = @id;

-- name: AdminSetCategoryOrder :exec
UPDATE repair.categories SET sort_order = @sort_order, updated_at = now(), updated_by_id = @actor_id WHERE id = @id;

-- name: AdminListSymptoms :many
SELECT s.id, s.category_id, s.name, s.sort_order, s.is_active, s.priority, s.updated_at,
       (EXISTS (SELECT 1 FROM repair.ticket_symptoms ts WHERE ts.symptom_id = s.id))::boolean AS in_use,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM repair.symptoms s
LEFT JOIN platform.users ub ON ub.id = s.updated_by_id
WHERE s.category_id = @category_id
ORDER BY s.sort_order, s.name;

-- name: AdminLockSymptom :one
SELECT s.id, s.category_id, s.name, s.sort_order, s.is_active, s.priority, s.updated_at, c.name AS category_name,
       (EXISTS (SELECT 1 FROM repair.ticket_symptoms ts WHERE ts.symptom_id = s.id))::boolean AS in_use
FROM repair.symptoms s JOIN repair.categories c ON c.id = s.category_id
WHERE s.id = @id FOR UPDATE OF s;

-- name: AdminSymptomNameTaken :one
SELECT EXISTS (SELECT 1 FROM repair.symptoms WHERE category_id = @category_id AND lower(name) = lower(@name::text) AND id <> @self_id)::boolean;

-- name: AdminInsertSymptom :exec
INSERT INTO repair.symptoms (id, category_id, name, priority, sort_order, updated_by_id)
VALUES (@id, @category_id, @name, @priority,
        (SELECT coalesce(max(sort_order), 0) + 1 FROM repair.symptoms WHERE category_id = @category_id), @actor_id);

-- name: AdminUpdateSymptom :exec
UPDATE repair.symptoms SET name = @name, priority = @priority, is_active = @is_active, updated_by_id = @actor_id, updated_at = now()
WHERE id = @id;

-- name: AdminDeleteSymptom :exec
DELETE FROM repair.symptoms WHERE id = @id;

-- name: AdminSetSymptomOrder :exec
UPDATE repair.symptoms SET sort_order = @sort_order, updated_at = now(), updated_by_id = @actor_id WHERE id = @id;

-- name: AdminListContractorTypes :many
-- Thai name order; created_by_technician = made by someone who is not a Superadmin (S23 badge "สร้างโดยช่าง").
SELECT t.id, t.name, t.is_active, t.created_at, t.updated_at,
       (SELECT count(DISTINCT l.contractor_id) FROM repair.contractor_type_links l WHERE l.type_id = t.id)::bigint AS contractor_count,
       cb.id AS created_by_user_id, cb.employee_code AS created_by_employee_code,
       cb.first_name_th AS created_by_first_name_th, cb.last_name_th AS created_by_last_name_th,
       cb.first_name_en AS created_by_first_name_en, cb.last_name_en AS created_by_last_name_en,
       cb.department AS created_by_department,
       (cb.id IS NOT NULL AND coalesce((SELECT r.key FROM platform.user_roles ur JOIN platform.roles r ON r.id = ur.role_id
                                        WHERE ur.employee_code = cb.employee_code), 'employee') <> 'super_admin')::boolean AS created_by_technician,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM repair.contractor_types t
LEFT JOIN platform.users cb ON cb.id = t.created_by_id
LEFT JOIN platform.users ub ON ub.id = t.updated_by_id
ORDER BY t.name COLLATE "th-x-icu";

-- name: AdminLockContractorType :one
SELECT t.id, t.name, t.is_active, t.updated_at,
       (EXISTS (SELECT 1 FROM repair.contractor_type_links l WHERE l.type_id = t.id))::boolean AS in_use
FROM repair.contractor_types t WHERE t.id = @id FOR UPDATE;

-- name: AdminContractorTypeNameTaken :one
SELECT EXISTS (SELECT 1 FROM repair.contractor_types WHERE lower(name) = lower(@name::text) AND id <> @self_id)::boolean;

-- name: AdminInsertContractorType :exec
INSERT INTO repair.contractor_types (id, name, created_by_id, updated_by_id) VALUES (@id, @name, @actor_id, @actor_id);

-- name: AdminUpdateContractorType :exec
UPDATE repair.contractor_types SET name = @name, is_active = @is_active, updated_by_id = @actor_id, updated_at = now() WHERE id = @id;

-- name: AdminDeleteContractorType :exec
DELETE FROM repair.contractor_types WHERE id = @id;
