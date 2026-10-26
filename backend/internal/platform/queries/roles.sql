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
