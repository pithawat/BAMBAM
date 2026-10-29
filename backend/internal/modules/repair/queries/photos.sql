-- name: InsertPhoto :exec
INSERT INTO repair.photos (id, uploader_id, content_type, size_bytes, storage_key, thumb_key, thumb_content_type)
VALUES (@id, @uploader_id, @content_type, @size_bytes, @storage_key, @thumb_key, @thumb_content_type);

-- name: GetPhoto :one
SELECT p.id, p.uploader_id, p.content_type, p.storage_key, p.thumb_key, p.thumb_content_type, tp.ticket_id
FROM repair.photos p
LEFT JOIN repair.ticket_photos tp ON tp.photo_id = p.id
WHERE p.id = @id;

-- name: LockAttachablePhotos :many
-- Photos the uploader may attach: theirs, not attached yet, not expired.
SELECT id FROM repair.photos
WHERE id = ANY(@ids::uuid[]) AND uploader_id = @uploader_id AND attached_at IS NULL AND created_at > @not_before
FOR UPDATE;

-- name: MarkPhotosAttached :exec
UPDATE repair.photos SET attached_at = now(), updated_at = now() WHERE id = ANY(@ids::uuid[]);

-- name: InsertTicketPhotos :exec
INSERT INTO repair.ticket_photos (photo_id, ticket_id, kind, event_id, sort_order)
SELECT p.photo_id, @ticket_id, @kind, sqlc.narg('event_id')::uuid, p.ord::integer - 1
FROM unnest(@photo_ids::uuid[]) WITH ORDINALITY AS p (photo_id, ord);

-- name: ListTicketPhotos :many
SELECT photo_id, kind, event_id FROM repair.ticket_photos
WHERE ticket_id = @ticket_id
ORDER BY kind, sort_order;

-- name: DeleteUnattachedPhotos :many
DELETE FROM repair.photos
WHERE attached_at IS NULL AND created_at < @older_than
RETURNING storage_key, thumb_key;
