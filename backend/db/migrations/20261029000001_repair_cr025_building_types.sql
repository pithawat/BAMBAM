-- +goose Up
-- CR-025 (D-117 / D-118): the reporter picks the place first and sees only the categories used in that
-- building's type. Every building has a type (platform.building_types); every category lists the types it
-- is used in (repair.category_building_types, an allow list). The "อื่น ๆ" category (is_other) is used in
-- every type and has no rows. The CR-014 hint "rooms matching the category first" is retired.

CREATE TABLE platform.building_types (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    sort_order    integer NOT NULL DEFAULT 0,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    updated_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX building_types_name_key ON platform.building_types (lower(name));

-- Stable ids: settings and tests refer to them.
INSERT INTO platform.building_types (id, name, sort_order) VALUES
    ('c025b700-0000-4000-8000-000000000001', 'อาคารสำนักงาน', 1),
    ('c025b700-0000-4000-8000-000000000002', 'โกดังเก็บของ', 2),
    ('c025b700-0000-4000-8000-000000000003', 'พื้นที่ภายนอกอาคาร', 3);

-- Every building gets a type: the outdoor "building" (car park, CR-014) → outdoor, every other → office.
ALTER TABLE platform.buildings ADD COLUMN building_type_id uuid REFERENCES platform.building_types (id);
UPDATE platform.buildings SET building_type_id = CASE
    WHEN id = 'c014b1d0-0000-4000-8000-000000000001' THEN 'c025b700-0000-4000-8000-000000000003'::uuid
    ELSE 'c025b700-0000-4000-8000-000000000001'::uuid END;
ALTER TABLE platform.buildings ALTER COLUMN building_type_id SET NOT NULL;
CREATE INDEX buildings_building_type_idx ON platform.buildings (building_type_id);

CREATE TABLE repair.category_building_types (
    category_id      uuid NOT NULL REFERENCES repair.categories (id),
    building_type_id uuid NOT NULL REFERENCES platform.building_types (id),
    PRIMARY KEY (category_id, building_type_id)
);
CREATE INDEX category_building_types_type_idx ON repair.category_building_types (building_type_id);

-- The CR-025 mapping table (owner approved 2026-10-27). office = 1, warehouse = 2, outdoor = 3.
INSERT INTO repair.category_building_types (category_id, building_type_id) VALUES
    ('c014ca70-0000-4000-8000-000000000001', 'c025b700-0000-4000-8000-000000000001'),
    ('c014ca70-0000-4000-8000-000000000001', 'c025b700-0000-4000-8000-000000000002'),
    ('c014ca70-0000-4000-8000-000000000001', 'c025b700-0000-4000-8000-000000000003'),
    ('c014ca70-0000-4000-8000-000000000002', 'c025b700-0000-4000-8000-000000000001'),
    ('c014ca70-0000-4000-8000-000000000003', 'c025b700-0000-4000-8000-000000000001'),
    ('c014ca70-0000-4000-8000-000000000003', 'c025b700-0000-4000-8000-000000000002'),
    ('c014ca70-0000-4000-8000-000000000003', 'c025b700-0000-4000-8000-000000000003'),
    ('c014ca70-0000-4000-8000-000000000004', 'c025b700-0000-4000-8000-000000000001'),
    ('c014ca70-0000-4000-8000-000000000005', 'c025b700-0000-4000-8000-000000000001'),
    ('c014ca70-0000-4000-8000-000000000005', 'c025b700-0000-4000-8000-000000000002'),
    ('c014ca70-0000-4000-8000-000000000006', 'c025b700-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

-- Categories added in settings before this migration (not in the CR-025 table) stay visible everywhere.
INSERT INTO repair.category_building_types (category_id, building_type_id)
SELECT c.id, bt.id FROM repair.categories c CROSS JOIN platform.building_types bt
WHERE NOT c.is_other AND c.id NOT IN (
    'c014ca70-0000-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000002',
    'c014ca70-0000-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000004',
    'c014ca70-0000-4000-8000-000000000005', 'c014ca70-0000-4000-8000-000000000006')
ON CONFLICT DO NOTHING;

-- Mock warehouse until the owner sends the real ones (CR-025 approval); the admin renames it in S20.
INSERT INTO platform.buildings (id, name, sort_order, building_type_id) VALUES
    ('c025b1d0-0000-4000-8000-000000000001', 'โกดังเก็บของ 1 (ตัวอย่าง)', 800, 'c025b700-0000-4000-8000-000000000002');
INSERT INTO platform.floors (id, building_id, name, level) VALUES
    ('c025f100-0000-4000-8000-000000000001', 'c025b1d0-0000-4000-8000-000000000001', '1', 1);
INSERT INTO platform.rooms (id, floor_id, name, area_type, sort_order) VALUES
    ('c025e000-0000-4000-8000-000000000001', 'c025f100-0000-4000-8000-000000000001', 'พื้นที่เก็บสินค้า', 'other', 1),
    ('c025e000-0000-4000-8000-000000000002', 'c025f100-0000-4000-8000-000000000001', 'พื้นที่ส่วนกลางชั้น 1', 'common_area', 1000);

DROP TABLE repair.category_area_types;

-- +goose Down
CREATE TABLE repair.category_area_types (
    category_id uuid NOT NULL REFERENCES repair.categories (id),
    area_type   text NOT NULL
        CHECK (area_type IN ('meeting_room', 'restroom', 'office', 'pantry', 'common_area', 'parking', 'other')),
    PRIMARY KEY (category_id, area_type)
);
INSERT INTO repair.category_area_types (category_id, area_type) VALUES
    ('c014ca70-0000-4000-8000-000000000001', 'office'),
    ('c014ca70-0000-4000-8000-000000000001', 'meeting_room'),
    ('c014ca70-0000-4000-8000-000000000001', 'common_area'),
    ('c014ca70-0000-4000-8000-000000000002', 'meeting_room'),
    ('c014ca70-0000-4000-8000-000000000002', 'office'),
    ('c014ca70-0000-4000-8000-000000000003', 'restroom'),
    ('c014ca70-0000-4000-8000-000000000003', 'pantry'),
    ('c014ca70-0000-4000-8000-000000000004', 'meeting_room'),
    ('c014ca70-0000-4000-8000-000000000005', 'common_area'),
    ('c014ca70-0000-4000-8000-000000000006', 'parking');

-- The mock warehouse goes only when no ticket (or asset) uses it; otherwise it stays, without a type.
DELETE FROM platform.rooms r WHERE r.floor_id = 'c025f100-0000-4000-8000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM repair.tickets t WHERE t.floor_id = r.floor_id)
    AND NOT EXISTS (SELECT 1 FROM platform.assets a WHERE a.room_id = r.id);
DELETE FROM platform.floors f WHERE f.id = 'c025f100-0000-4000-8000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM platform.rooms r WHERE r.floor_id = f.id);
DELETE FROM platform.buildings b WHERE b.id = 'c025b1d0-0000-4000-8000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM platform.floors f WHERE f.building_id = b.id);

DROP TABLE repair.category_building_types;
DROP INDEX platform.buildings_building_type_idx;
ALTER TABLE platform.buildings DROP COLUMN building_type_id;
DROP TABLE platform.building_types;
