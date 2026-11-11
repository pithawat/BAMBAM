-- +goose Up
-- Stage 4 (F03, BR-F03-1, CR-009 / CR-014): the duplicate check looks up open tickets by
-- category + floor + room on every report (#22 and #5). Old tickets without a room are matched on
-- the same floor by their location text; tickets_floor_idx covers that fallback.
CREATE INDEX tickets_duplicate_idx ON repair.tickets (category_id, floor_id, room_id)
WHERE status IN ('in_progress', 'resolved');

-- +goose Down
DROP INDEX IF EXISTS repair.tickets_duplicate_idx;
