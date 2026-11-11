-- Settings audit log (F30, #9 role history, #11, #12). Only settings entity types and actions are
-- listed (the dev role switch also writes rows). `data` = { entityName, parentName?, changes }.
-- `exists` = no later `delete` row for the same entity, so names of deleted items still read.

-- name: ListAudit :many
SELECT a.id, a.created_at, a.action, a.target_type, a.target_id, a.data,
       a.actor_user_id, au.employee_code AS actor_employee_code, au.first_name_th AS actor_first_name_th,
       au.last_name_th AS actor_last_name_th, au.first_name_en AS actor_first_name_en,
       au.last_name_en AS actor_last_name_en, au.department AS actor_department,
       NOT EXISTS (SELECT 1 FROM platform.audit_log d
                   WHERE d.target_type = a.target_type AND d.target_id = a.target_id AND d.action = 'delete')::boolean AS entity_exists
FROM platform.audit_log a
LEFT JOIN platform.users au ON au.id = a.actor_user_id
WHERE a.target_type = ANY(@types::text[])
  AND a.action = ANY(@actions::text[])
  AND (sqlc.narg(actor_id)::uuid IS NULL OR a.actor_user_id = sqlc.narg(actor_id)::uuid)
  AND (sqlc.narg(from_time)::timestamptz IS NULL OR a.created_at >= sqlc.narg(from_time)::timestamptz)
  AND (sqlc.narg(to_time)::timestamptz IS NULL OR a.created_at <= sqlc.narg(to_time)::timestamptz)
  AND (sqlc.narg(q)::text IS NULL
       OR a.data->>'entityName' ILIKE '%' || sqlc.narg(q)::text || '%'
       OR a.data->>'parentName' ILIKE '%' || sqlc.narg(q)::text || '%')
ORDER BY a.created_at DESC, a.id
LIMIT @lim OFFSET @off;

-- name: CountAudit :one
SELECT count(*)::bigint
FROM platform.audit_log a
WHERE a.target_type = ANY(@types::text[])
  AND a.action = ANY(@actions::text[])
  AND (sqlc.narg(actor_id)::uuid IS NULL OR a.actor_user_id = sqlc.narg(actor_id)::uuid)
  AND (sqlc.narg(from_time)::timestamptz IS NULL OR a.created_at >= sqlc.narg(from_time)::timestamptz)
  AND (sqlc.narg(to_time)::timestamptz IS NULL OR a.created_at <= sqlc.narg(to_time)::timestamptz)
  AND (sqlc.narg(q)::text IS NULL
       OR a.data->>'entityName' ILIKE '%' || sqlc.narg(q)::text || '%'
       OR a.data->>'parentName' ILIKE '%' || sqlc.narg(q)::text || '%');

-- name: ListAuditActors :many
-- #12: everyone with a settings audit row, by name.
SELECT u.id, u.employee_code, u.first_name_th, u.last_name_th, u.first_name_en, u.last_name_en, u.department
FROM platform.users u
WHERE u.id IN (SELECT a.actor_user_id FROM platform.audit_log a
               WHERE a.target_type = ANY(@types::text[]) AND a.action = ANY(@actions::text[]))
ORDER BY concat_ws(' ', u.first_name_th, u.last_name_th) COLLATE "th-x-icu", u.employee_code;

-- name: ListUserRoleHistory :many
-- #9: role changes of one user, newest first.
SELECT a.created_at, a.data,
       a.actor_user_id, au.employee_code AS actor_employee_code, au.first_name_th AS actor_first_name_th,
       au.last_name_th AS actor_last_name_th, au.first_name_en AS actor_first_name_en,
       au.last_name_en AS actor_last_name_en, au.department AS actor_department
FROM platform.audit_log a
LEFT JOIN platform.users au ON au.id = a.actor_user_id
WHERE a.target_type = 'user' AND a.target_id = @target_id AND a.action = 'role_change'
ORDER BY a.created_at DESC
LIMIT 50;
