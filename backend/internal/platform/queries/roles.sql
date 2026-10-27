-- Roles as data (settings Stage 1, D-049). Order: super_admin, the seeded roles, then custom roles
-- by creation (settings 04-api-contract.md `Role`).

-- name: ListRoles :many
-- user_count excludes demo users; people without a user_roles row count as `employee`.
SELECT sqlc.embed(r),
       (SELECT count(*) FROM platform.users u
        LEFT JOIN platform.user_roles ur ON ur.employee_code = u.employee_code
        WHERE NOT u.is_demo AND (ur.role_id = r.id OR (ur.role_id IS NULL AND r.key = 'employee')))::bigint AS user_count,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM platform.roles r
LEFT JOIN platform.users ub ON ub.id = r.updated_by_id
ORDER BY r.sort_order, r.created_at, r.key;

-- name: GetRoleByKey :one
SELECT * FROM platform.roles WHERE key = @key;

-- name: ListRolePermissions :many
SELECT permission FROM platform.role_permissions WHERE role_id = @role_id ORDER BY permission;

-- ---- settings Stage 2: roles CRUD and the permission matrix (F29, contract #2–#7) ----

-- name: LockRole :one
SELECT * FROM platform.roles WHERE id = @id FOR UPDATE;

-- name: InsertRole :one
INSERT INTO platform.roles (key, name, description, created_by_id, updated_by_id)
VALUES (@key, @name, @description, @actor_id, @actor_id)
RETURNING *;

-- name: UpdateRole :one
UPDATE platform.roles
SET name = @name, description = @description, updated_by_id = @actor_id, updated_at = now()
WHERE id = @id
RETURNING *;

-- name: DeleteRole :exec
DELETE FROM platform.roles WHERE id = @id;

-- name: CountRealUsersInRole :one
-- Same rule as ListRoles.user_count: demo users do not count.
SELECT count(*)::bigint FROM platform.users u
LEFT JOIN platform.user_roles ur ON ur.employee_code = u.employee_code
WHERE NOT u.is_demo AND (ur.role_id = @role_id OR (ur.role_id IS NULL AND @role_key::text = 'employee'));

-- name: DeleteDemoUserRoles :many
-- Unassigns the demo users of a role before it is deleted; returns their employee codes.
DELETE FROM platform.user_roles ur
USING platform.users u
WHERE u.employee_code = ur.employee_code AND u.is_demo AND ur.role_id = @role_id
RETURNING ur.employee_code;

-- name: DeleteDemoUser :exec
DELETE FROM platform.users WHERE employee_code = @employee_code AND is_demo;

-- name: ListAllRolePermissions :many
SELECT role_id, permission FROM platform.role_permissions ORDER BY role_id, permission;

-- name: GrantRolePermission :exec
INSERT INTO platform.role_permissions (role_id, permission) VALUES (@role_id, @permission)
ON CONFLICT DO NOTHING;

-- name: RevokeRolePermission :exec
DELETE FROM platform.role_permissions WHERE role_id = @role_id AND permission = @permission;

-- name: GetPermissionMatrix :one
SELECT m.version, m.updated_at,
       ub.id AS updated_by_user_id, ub.employee_code AS updated_by_employee_code,
       ub.first_name_th AS updated_by_first_name_th, ub.last_name_th AS updated_by_last_name_th,
       ub.first_name_en AS updated_by_first_name_en, ub.last_name_en AS updated_by_last_name_en,
       ub.department AS updated_by_department
FROM platform.permission_matrix m
LEFT JOIN platform.users ub ON ub.id = m.updated_by_id;

-- name: LockPermissionMatrix :one
-- Serialises matrix saves (D-051): the second writer waits, then sees the new version.
SELECT version FROM platform.permission_matrix FOR UPDATE;

-- name: BumpPermissionMatrix :exec
UPDATE platform.permission_matrix SET version = version + 1, updated_by_id = @actor_id, updated_at = now();
