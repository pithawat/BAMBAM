-- name: UpsertSSOUser :one
INSERT INTO platform.users (
    employee_code, sso_subject, first_name_th, last_name_th, first_name_en, last_name_en,
    email, department, division, position_th, last_login_at
) VALUES (
    @employee_code, @sso_subject, @first_name_th, @last_name_th, @first_name_en, @last_name_en,
    @email, @department, @division, @position_th, now()
)
ON CONFLICT (employee_code) DO UPDATE SET
    sso_subject   = EXCLUDED.sso_subject,
    first_name_th = EXCLUDED.first_name_th,
    last_name_th  = EXCLUDED.last_name_th,
    first_name_en = EXCLUDED.first_name_en,
    last_name_en  = EXCLUDED.last_name_en,
    email         = EXCLUDED.email,
    department    = EXCLUDED.department,
    division      = EXCLUDED.division,
    position_th   = EXCLUDED.position_th,
    last_login_at = now(),
    updated_at    = now()
RETURNING *;

-- name: UpsertDemoUser :one
INSERT INTO platform.users (employee_code, first_name_th, last_name_th, department, position_th, is_demo)
VALUES (@employee_code, @first_name_th, @last_name_th, @department, @position_th, true)
ON CONFLICT (employee_code) DO UPDATE SET
    first_name_th = EXCLUDED.first_name_th,
    last_name_th  = EXCLUDED.last_name_th,
    department    = EXCLUDED.department,
    position_th   = EXCLUDED.position_th,
    is_demo       = true,
    updated_at    = now()
RETURNING *;

-- The user's role is their user_roles row, or `employee` when there is none (D-003).
-- Stored permissions are loaded on every request so matrix changes apply at once (D-049, BR-F29-7).

-- name: GetUserWithRole :one
SELECT sqlc.embed(u), r.key AS role, r.name AS role_name,
       ARRAY(SELECT rp.permission FROM platform.role_permissions rp WHERE rp.role_id = r.id ORDER BY rp.permission)::text[] AS permissions
FROM platform.users u
LEFT JOIN platform.user_roles ur ON ur.employee_code = u.employee_code
JOIN platform.roles r ON r.id = ur.role_id OR (ur.role_id IS NULL AND r.key = 'employee')
WHERE u.id = @id;

-- name: ListDemoUsers :many
SELECT sqlc.embed(u), r.key AS role
FROM platform.users u
LEFT JOIN platform.user_roles ur ON ur.employee_code = u.employee_code
JOIN platform.roles r ON r.id = ur.role_id OR (ur.role_id IS NULL AND r.key = 'employee')
WHERE u.is_demo
ORDER BY u.employee_code;

-- name: UpsertUserRole :execrows
-- Assigns a role by key; 0 rows = unknown role key.
INSERT INTO platform.user_roles (employee_code, role_id)
SELECT @employee_code, r.id FROM platform.roles r WHERE r.key = @role_key
ON CONFLICT (employee_code) DO UPDATE SET role_id = EXCLUDED.role_id, updated_at = now();

-- name: InsertAuditLog :exec
INSERT INTO platform.audit_log (actor_user_id, action, target_type, target_id, data)
VALUES (@actor_user_id, @action, @target_type, @target_id, @data);
