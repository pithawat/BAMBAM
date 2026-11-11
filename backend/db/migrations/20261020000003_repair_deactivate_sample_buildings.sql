-- +goose Up
-- Owner 2026-10-20 (CR-018, D-088): the two SAMPLE buildings (old seed.go, dev / UAT only) are switched
-- off, never deleted (D-047): they disappear from S03, S11 filters and S29; old tickets keep their
-- references. The API no longer seeds sample locations. Production never had them: no-op there.
UPDATE repair.buildings SET is_active = false, updated_at = now()
WHERE id IN ('5fefabed-d12b-5155-bc79-9d75f3bf6404', '33a8fd5a-a010-5ae4-8bfc-021e96ddc6f1') AND is_active;

-- +goose Down
UPDATE repair.buildings SET is_active = true, updated_at = now()
WHERE id IN ('5fefabed-d12b-5155-bc79-9d75f3bf6404', '33a8fd5a-a010-5ae4-8bfc-021e96ddc6f1');
