-- +goose Up
-- repair CR-036 / settings CR-007 (Stage 5B): what was on an asset's printed QR label. `labelStatus`
-- (never / current / moved / changed) is computed on read by comparing the snapshot with today's data.
-- label_snapshot = { code, name, buildingId, buildingName, floorId, floorName, roomId, roomName }.
ALTER TABLE platform.assets
    ADD COLUMN label_printed_at timestamptz NULL,
    ADD COLUMN label_printed_by uuid NULL REFERENCES platform.users (id) ON DELETE SET NULL,
    ADD COLUMN label_snapshot   jsonb NULL;

-- +goose Down
ALTER TABLE platform.assets
    DROP COLUMN label_snapshot,
    DROP COLUMN label_printed_by,
    DROP COLUMN label_printed_at;
