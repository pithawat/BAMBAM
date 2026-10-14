-- name: CreateSession :one
INSERT INTO platform.sessions (token_hash, user_id, origin_user_id, expires_at)
VALUES (@token_hash, @user_id, @origin_user_id, @expires_at)
RETURNING *;

-- name: GetActiveSession :one
SELECT * FROM platform.sessions
WHERE token_hash = @token_hash AND expires_at > now();

-- name: DeleteSessionByTokenHash :exec
DELETE FROM platform.sessions WHERE token_hash = @token_hash;

-- name: DeleteExpiredSessions :execrows
DELETE FROM platform.sessions WHERE expires_at <= now();
