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

-- name: GetUserWithRole :one
SELECT sqlc.embed(u), COALESCE(r.role, 'employee')::text AS role
FROM platform.users u
LEFT JOIN platform.user_roles r ON r.employee_code = u.employee_code
WHERE u.id = @id;

-- name: ListDemoUsers :many
SELECT sqlc.embed(u), COALESCE(r.role, 'employee')::text AS role
FROM platform.users u
LEFT JOIN platform.user_roles r ON r.employee_code = u.employee_code
WHERE u.is_demo
ORDER BY u.employee_code;

-- name: UpsertUserRole :exec
INSERT INTO platform.user_roles (employee_code, role)
VALUES (@employee_code, @role)
ON CONFLICT (employee_code) DO UPDATE SET role = EXCLUDED.role, updated_at = now();

-- name: InsertAuditLog :exec
INSERT INTO platform.audit_log (actor_user_id, action, target_type, target_id, data)
VALUES (@actor_user_id, @action, @target_type, @target_id, @data);
