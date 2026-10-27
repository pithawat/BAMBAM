-- +goose Up
-- settings Stage 4 (D-048, CR-001 / CR-002): buildings and floors become shared data in `platform`
-- next to rooms, assets and asset types. Ids and foreign keys stay (ALTER … SET SCHEMA keeps them), so
-- repair tickets, floor plans and rooms keep pointing at the same rows. Settings renames buildings and
-- rooms (concurrency by updated_at, D-051) and edits asset types, so those rows record who changed them.

ALTER TABLE repair.buildings SET SCHEMA platform;
ALTER TABLE repair.floors SET SCHEMA platform;

ALTER TABLE platform.buildings ADD COLUMN updated_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL;
ALTER TABLE platform.rooms ADD COLUMN updated_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL;
ALTER TABLE platform.asset_types ADD COLUMN updated_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL;

-- #51 / #52: type names and code prefixes are unique (case-insensitive, prefixes stored upper-case).
CREATE UNIQUE INDEX asset_types_name_key ON platform.asset_types (lower(name));
CREATE UNIQUE INDEX asset_types_code_prefix_key ON platform.asset_types (upper(code_prefix));

-- +goose Down
DROP INDEX platform.asset_types_code_prefix_key;
DROP INDEX platform.asset_types_name_key;
ALTER TABLE platform.asset_types DROP COLUMN updated_by_id;
ALTER TABLE platform.rooms DROP COLUMN updated_by_id;
ALTER TABLE platform.buildings DROP COLUMN updated_by_id;
ALTER TABLE platform.floors SET SCHEMA repair;
ALTER TABLE platform.buildings SET SCHEMA repair;
