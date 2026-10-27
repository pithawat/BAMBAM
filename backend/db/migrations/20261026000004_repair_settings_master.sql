-- +goose Up
-- settings Stage 5 (F27, F28, repair CR-007 part C): categories, symptoms and contractor types are edited in
-- ตั้งค่าระบบ. Rows record who changed them (concurrency by updated_at, D-051). Contractor types can be
-- deactivated (never deleted once linked, BR-ALL-2); a technician typing an inactive name re-activates it.

ALTER TABLE repair.categories ADD COLUMN updated_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL;
ALTER TABLE repair.symptoms ADD COLUMN updated_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL;
ALTER TABLE repair.contractor_types
    ADD COLUMN is_active boolean NOT NULL DEFAULT true,
    ADD COLUMN updated_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE repair.contractor_types DROP COLUMN updated_by_id, DROP COLUMN is_active;
ALTER TABLE repair.symptoms DROP COLUMN updated_by_id;
ALTER TABLE repair.categories DROP COLUMN updated_by_id;
