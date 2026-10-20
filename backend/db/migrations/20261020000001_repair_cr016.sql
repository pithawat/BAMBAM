-- +goose Up
-- CR-016: equipment (assets) placed in rooms, floor plans with room outlines, and อาคาร 1 (6 floors,
-- 32 × 15 m) with its real rooms traced from attachments/building plan/1-อาคาร 1.pdf (owner checks).

-- Equipment types (master, D-078). key is stable and drives the 3D icon; deactivate, never delete (D-047).
CREATE TABLE platform.asset_types (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key         text NOT NULL UNIQUE,
    name        text NOT NULL,
    code_prefix text NOT NULL,
    icon        text NOT NULL,
    mount       text NOT NULL CHECK (mount IN ('floor', 'wall', 'ceiling')),
    sort_order  integer NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Which repair category an equipment type belongs to (QR pre-fill, Stage 5). Kept in repair so
-- platform never points at a repair table.
CREATE TABLE repair.asset_type_categories (
    asset_type_id uuid NOT NULL REFERENCES platform.asset_types (id),
    category_id   uuid NOT NULL REFERENCES repair.categories (id),
    PRIMARY KEY (asset_type_id, category_id)
);

-- One piece of equipment. Linked to the room only: floor and building come through the room (D-078).
-- pos_x / pos_z: metres on the floor plan (origin top-left, x right, z down); both NULL = not placed yet.
CREATE TABLE platform.assets (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code          text NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,50}$'),
    name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    asset_type_id uuid NOT NULL REFERENCES platform.asset_types (id),
    room_id       uuid NOT NULL REFERENCES platform.rooms (id),
    pos_x         numeric(6, 2),
    pos_z         numeric(6, 2),
    rotation_deg  smallint NOT NULL DEFAULT 0 CHECK (rotation_deg BETWEEN 0 AND 359),
    is_active     boolean NOT NULL DEFAULT true,
    created_by    uuid REFERENCES platform.users (id),
    updated_by    uuid REFERENCES platform.users (id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CHECK ((pos_x IS NULL) = (pos_z IS NULL))
);
-- BR-F31-1: a code is never reused, even by an inactive asset (BR-F31-4).
CREATE UNIQUE INDEX assets_code_key ON platform.assets (lower(code));
CREATE INDEX assets_room_active_idx ON platform.assets (room_id) WHERE is_active;

-- Geometry of a floor that has a plan (1 : 1 with the floor). floor_id follows repair.floors until
-- settings Stage 4 moves floors to platform (SET SCHEMA keeps ids).
CREATE TABLE platform.floor_plans (
    floor_id   uuid PRIMARY KEY REFERENCES repair.floors (id),
    width_m    numeric(6, 2) NOT NULL CHECK (width_m > 0),
    depth_m    numeric(6, 2) NOT NULL CHECK (depth_m > 0),
    model_file text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Room outline on its floor plan [[x, z], …] in metres; NULL = the floor has no plan for this room.
ALTER TABLE platform.rooms ADD COLUMN plan_shape jsonb;

-- Set when a ticket is reported from an asset (QR / picker, Stage 5); asset_code stays as typed.
ALTER TABLE repair.tickets ADD COLUMN asset_id uuid REFERENCES platform.assets (id);
CREATE INDEX tickets_asset_open_idx ON repair.tickets (asset_id) WHERE asset_id IS NOT NULL AND status <> 'closed';

-- ---- master data (every environment) ----

INSERT INTO platform.asset_types (id, key, name, code_prefix, icon, mount, sort_order) VALUES
    ('c016a700-0000-4000-8000-000000000001', 'aircon', 'เครื่องปรับอากาศ', 'AC', 'air-vent', 'wall', 1),
    ('c016a700-0000-4000-8000-000000000002', 'microphone', 'ไมโครโฟน', 'MIC', 'mic', 'floor', 2),
    ('c016a700-0000-4000-8000-000000000003', 'speaker', 'ลำโพง', 'SPK', 'speaker', 'ceiling', 3),
    ('c016a700-0000-4000-8000-000000000004', 'tv', 'จอทีวี', 'TV', 'tv', 'wall', 4)
ON CONFLICT (id) DO NOTHING;

-- แอร์ → ระบบปรับอากาศ; ไมค์ / ลำโพง / ทีวี → ห้องประชุมและโสตทัศนูปกรณ์ (CR-014 master ids).
INSERT INTO repair.asset_type_categories (asset_type_id, category_id) VALUES
    ('c016a700-0000-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000002'),
    ('c016a700-0000-4000-8000-000000000002', 'c014ca70-0000-4000-8000-000000000004'),
    ('c016a700-0000-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000004'),
    ('c016a700-0000-4000-8000-000000000004', 'c014ca70-0000-4000-8000-000000000004')
ON CONFLICT DO NOTHING;

-- อาคาร 1: 6 floors, each 32 × 15 m (8 bays × 4 m; rows 6 + 3 + 6 m), stable ids.
INSERT INTO repair.buildings (id, name, sort_order) VALUES
    ('c016b1d0-0000-4000-8000-000000000001', 'อาคาร 1', 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO repair.floors (id, building_id, name, level)
SELECT ('c016f100-0000-4000-8000-00000000000' || n)::uuid, 'c016b1d0-0000-4000-8000-000000000001', n::text, n
FROM generate_series(1, 6) AS n
ON CONFLICT DO NOTHING;
INSERT INTO platform.floor_plans (floor_id, width_m, depth_m)
SELECT ('c016f100-0000-4000-8000-00000000000' || n)::uuid, 32, 15
FROM generate_series(1, 6) AS n
ON CONFLICT DO NOTHING;

-- Rooms per floor with outlines, read from the PDF (one page per floor; every floor adds up to 480 m²).
-- Rooms with the same name on one floor get a number (HR 1–3 …). ห้องน้ำ lies inside the common area:
-- a point belongs to the smallest room around it. The common area of each floor is the rest of the floor.
INSERT INTO platform.rooms (id, floor_id, name, area_type, sort_order, plan_shape) VALUES
    ('c016e001-0000-4000-8000-000000000001', 'c016f100-0000-4000-8000-000000000001', 'Data and Digitization', 'office', 1, '[[0,0],[12,0],[12,6],[0,6]]'),
    ('c016e001-0000-4000-8000-000000000002', 'c016f100-0000-4000-8000-000000000001', 'ห้องย่อย', 'other', 2, '[[0,6],[4,6],[4,9],[0,9]]'),
    ('c016e001-0000-4000-8000-000000000003', 'c016f100-0000-4000-8000-000000000001', 'Marketing ทีมพี่สุ้ง', 'office', 3, '[[0,9],[12,9],[12,15],[0,15]]'),
    ('c016e001-0000-4000-8000-000000000004', 'c016f100-0000-4000-8000-000000000001', 'HR 1', 'office', 4, '[[24,0],[28,0],[28,4.35],[24,4.35]]'),
    ('c016e001-0000-4000-8000-000000000005', 'c016f100-0000-4000-8000-000000000001', 'HR 2', 'office', 5, '[[28,0],[32,0],[32,5.2],[28,5.2]]'),
    ('c016e001-0000-4000-8000-000000000006', 'c016f100-0000-4000-8000-000000000001', 'HR 3', 'office', 6, '[[24,9],[32,9],[32,15],[24,15]]'),
    ('c016e001-0000-4000-8000-000000000007', 'c016f100-0000-4000-8000-000000000001', 'ห้องน้ำ', 'restroom', 7, '[[12,0],[16,0],[16,6],[12,6]]'),
    ('c016e001-0000-4000-8000-000000000099', 'c016f100-0000-4000-8000-000000000001', 'พื้นที่ส่วนกลางชั้น 1', 'common_area', 1000, '[[12,0],[24,0],[24,4.35],[28,4.35],[28,5.2],[32,5.2],[32,9],[24,9],[24,15],[12,15],[12,9],[4,9],[4,6],[12,6]]'),
    ('c016e002-0000-4000-8000-000000000001', 'c016f100-0000-4000-8000-000000000002', 'Call center 1', 'office', 1, '[[0,0],[12,0],[12,9],[0,9]]'),
    ('c016e002-0000-4000-8000-000000000002', 'c016f100-0000-4000-8000-000000000002', 'RMC METRO - ท่าหลวง', 'office', 2, '[[20,0],[32,0],[32,9],[20,9]]'),
    ('c016e002-0000-4000-8000-000000000003', 'c016f100-0000-4000-8000-000000000002', 'Call center 2', 'office', 3, '[[0,9],[24,9],[24,15],[0,15]]'),
    ('c016e002-0000-4000-8000-000000000004', 'c016f100-0000-4000-8000-000000000002', 'RRC METRO - ท่าหลวง', 'office', 4, '[[24,9],[32,9],[32,15],[24,15]]'),
    ('c016e002-0000-4000-8000-000000000005', 'c016f100-0000-4000-8000-000000000002', 'ห้องน้ำ', 'restroom', 5, '[[12,0],[16,0],[16,6],[12,6]]'),
    ('c016e002-0000-4000-8000-000000000099', 'c016f100-0000-4000-8000-000000000002', 'พื้นที่ส่วนกลางชั้น 2', 'common_area', 1000, '[[12,0],[20,0],[20,9],[12,9]]'),
    ('c016e003-0000-4000-8000-000000000001', 'c016f100-0000-4000-8000-000000000003', 'RMC METRO - ท่าหลวง 1', 'office', 1, '[[0,0],[12,0],[12,6],[0,6]]'),
    ('c016e003-0000-4000-8000-000000000002', 'c016f100-0000-4000-8000-000000000003', 'RMC METRO - ท่าหลวง 2', 'office', 2, '[[20,0],[32,0],[32,6],[20,6]]'),
    ('c016e003-0000-4000-8000-000000000003', 'c016f100-0000-4000-8000-000000000003', 'WPS ห้องพี่มีด', 'office', 3, '[[0,9],[4,9],[4,15],[0,15]]'),
    ('c016e003-0000-4000-8000-000000000004', 'c016f100-0000-4000-8000-000000000003', 'RMC METRO - ท่าหลวง 3', 'office', 4, '[[4,9],[32,9],[32,15],[4,15]]'),
    ('c016e003-0000-4000-8000-000000000005', 'c016f100-0000-4000-8000-000000000003', 'ห้องน้ำ', 'restroom', 5, '[[12,0],[16,0],[16,6],[12,6]]'),
    ('c016e003-0000-4000-8000-000000000099', 'c016f100-0000-4000-8000-000000000003', 'พื้นที่ส่วนกลางชั้น 3', 'common_area', 1000, '[[12,0],[20,0],[20,6],[32,6],[32,9],[0,9],[0,6],[12,6]]'),
    ('c016e004-0000-4000-8000-000000000001', 'c016f100-0000-4000-8000-000000000004', 'อ.1 ห้อง 401', 'meeting_room', 1, '[[0,0],[8,0],[8,15],[0,15]]'),
    ('c016e004-0000-4000-8000-000000000002', 'c016f100-0000-4000-8000-000000000004', 'WPS ห้องกาแฟ', 'pantry', 2, '[[8,0],[12,0],[12,6],[8,6]]'),
    ('c016e004-0000-4000-8000-000000000003', 'c016f100-0000-4000-8000-000000000004', 'RMC Excellence พี่จร 1', 'office', 3, '[[20,0],[24,0],[24,6],[20,6]]'),
    ('c016e004-0000-4000-8000-000000000004', 'c016f100-0000-4000-8000-000000000004', 'RMC Excellence พี่จร 2', 'office', 4, '[[24,0],[28,0],[28,6],[24,6]]'),
    ('c016e004-0000-4000-8000-000000000005', 'c016f100-0000-4000-8000-000000000004', 'RMC Excellence พี่จร 3', 'office', 5, '[[28,0],[32,0],[32,6],[28,6]]'),
    ('c016e004-0000-4000-8000-000000000006', 'c016f100-0000-4000-8000-000000000004', 'RMC Excellence', 'office', 6, '[[8,9],[32,9],[32,15],[8,15]]'),
    ('c016e004-0000-4000-8000-000000000007', 'c016f100-0000-4000-8000-000000000004', 'ห้องน้ำ', 'restroom', 7, '[[12,0],[16,0],[16,6],[12,6]]'),
    ('c016e004-0000-4000-8000-000000000099', 'c016f100-0000-4000-8000-000000000004', 'พื้นที่ส่วนกลางชั้น 4', 'common_area', 1000, '[[12,0],[20,0],[20,6],[32,6],[32,9],[8,9],[8,6],[12,6]]'),
    ('c016e005-0000-4000-8000-000000000001', 'c016f100-0000-4000-8000-000000000005', 'RMC Network 1', 'office', 1, '[[0,0],[6,0],[6,6],[0,6]]'),
    ('c016e005-0000-4000-8000-000000000002', 'c016f100-0000-4000-8000-000000000005', 'ห้องย่อย', 'other', 2, '[[6,0],[8,0],[8,6],[6,6]]'),
    ('c016e005-0000-4000-8000-000000000003', 'c016f100-0000-4000-8000-000000000005', 'บัญชี', 'office', 3, '[[8,0],[12,0],[12,6],[8,6]]'),
    ('c016e005-0000-4000-8000-000000000004', 'c016f100-0000-4000-8000-000000000005', 'Legal & GRC ห้องเอกสาร', 'office', 4, '[[20,0],[24,0],[24,6],[20,6]]'),
    ('c016e005-0000-4000-8000-000000000005', 'c016f100-0000-4000-8000-000000000005', 'License', 'office', 5, '[[24,0],[28,0],[28,3],[24,3]]'),
    ('c016e005-0000-4000-8000-000000000006', 'c016f100-0000-4000-8000-000000000005', 'UMO', 'office', 6, '[[24,3],[28,3],[28,6],[24,6]]'),
    ('c016e005-0000-4000-8000-000000000007', 'c016f100-0000-4000-8000-000000000005', 'BSSD พี่โอ', 'office', 7, '[[28,0],[32,0],[32,6],[28,6]]'),
    ('c016e005-0000-4000-8000-000000000008', 'c016f100-0000-4000-8000-000000000005', 'RMC Network Director พี่เอ็ม', 'office', 8, '[[0,9],[4,9],[4,15],[0,15]]'),
    ('c016e005-0000-4000-8000-000000000009', 'c016f100-0000-4000-8000-000000000005', 'RMC Network 2', 'office', 9, '[[4,9],[12,9],[12,15],[4,15]]'),
    ('c016e005-0000-4000-8000-000000000010', 'c016f100-0000-4000-8000-000000000005', 'Franchise', 'office', 10, '[[12,9],[16,9],[16,15],[12,15]]'),
    ('c016e005-0000-4000-8000-000000000011', 'c016f100-0000-4000-8000-000000000005', 'Legal & GRC', 'office', 11, '[[16,9],[22,9],[22,15],[16,15]]'),
    ('c016e005-0000-4000-8000-000000000012', 'c016f100-0000-4000-8000-000000000005', 'CCM', 'office', 12, '[[22,9],[28,9],[28,15],[22,15]]'),
    ('c016e005-0000-4000-8000-000000000013', 'c016f100-0000-4000-8000-000000000005', 'BAM', 'office', 13, '[[28,9],[32,9],[32,15],[28,15]]'),
    ('c016e005-0000-4000-8000-000000000014', 'c016f100-0000-4000-8000-000000000005', 'ห้องน้ำ', 'restroom', 14, '[[12,0],[16,0],[16,6],[12,6]]'),
    ('c016e005-0000-4000-8000-000000000099', 'c016f100-0000-4000-8000-000000000005', 'พื้นที่ส่วนกลางชั้น 5', 'common_area', 1000, '[[12,0],[20,0],[20,6],[32,6],[32,9],[0,9],[0,6],[12,6]]'),
    ('c016e006-0000-4000-8000-000000000001', 'c016f100-0000-4000-8000-000000000006', 'อ.1 ห้อง CPAC Common room', 'meeting_room', 1, '[[0,0],[8,0],[8,6],[0,6]]'),
    ('c016e006-0000-4000-8000-000000000002', 'c016f100-0000-4000-8000-000000000006', 'สำรอง คจ.', 'office', 2, '[[8,0],[12,0],[12,6],[8,6]]'),
    ('c016e006-0000-4000-8000-000000000003', 'c016f100-0000-4000-8000-000000000006', 'ห้องเอกสาร Legal & GRC', 'office', 3, '[[20,0],[24,0],[24,6],[20,6]]'),
    ('c016e006-0000-4000-8000-000000000004', 'c016f100-0000-4000-8000-000000000006', 'Strategic Planning', 'office', 4, '[[24,0],[32,0],[32,6],[24,6]]'),
    ('c016e006-0000-4000-8000-000000000005', 'c016f100-0000-4000-8000-000000000006', 'Head of Concrete Business ห้องพี่หก', 'office', 5, '[[0,9],[8,9],[8,15],[0,15]]'),
    ('c016e006-0000-4000-8000-000000000006', 'c016f100-0000-4000-8000-000000000006', 'เลขา', 'office', 6, '[[8,9],[12,9],[12,15],[8,15]]'),
    ('c016e006-0000-4000-8000-000000000007', 'c016f100-0000-4000-8000-000000000006', 'อ.1 ห้อง CPAC 72 ปี', 'meeting_room', 7, '[[12,9],[24,9],[24,15],[12,15]]'),
    ('c016e006-0000-4000-8000-000000000008', 'c016f100-0000-4000-8000-000000000006', 'QMIX พี่นุ้ย', 'office', 8, '[[24,9],[29.2,9],[29.2,15],[24,15]]'),
    ('c016e006-0000-4000-8000-000000000009', 'c016f100-0000-4000-8000-000000000006', 'Strategic Planning พี่ปี', 'office', 9, '[[29.2,9],[32,9],[32,15],[29.2,15]]'),
    ('c016e006-0000-4000-8000-000000000099', 'c016f100-0000-4000-8000-000000000006', 'พื้นที่ส่วนกลางชั้น 6', 'common_area', 1000, '[[12,0],[20,0],[20,6],[32,6],[32,9],[0,9],[0,6],[12,6]]')
ON CONFLICT (id) DO UPDATE SET plan_shape = EXCLUDED.plan_shape, updated_at = now();

-- +goose Down
-- Removes อาคาร 1 only when no ticket uses it; equipment and plans are dropped.
DROP INDEX repair.tickets_asset_open_idx;
ALTER TABLE repair.tickets DROP COLUMN asset_id;
ALTER TABLE platform.rooms DROP COLUMN plan_shape;
DROP TABLE platform.floor_plans;
DROP TABLE platform.assets;
DROP TABLE repair.asset_type_categories;
DROP TABLE platform.asset_types;
DELETE FROM platform.rooms r USING repair.floors f
WHERE r.floor_id = f.id AND f.building_id = 'c016b1d0-0000-4000-8000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM repair.tickets t WHERE t.building_id = f.building_id);
DELETE FROM repair.floors f WHERE f.building_id = 'c016b1d0-0000-4000-8000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM repair.tickets t WHERE t.building_id = f.building_id);
DELETE FROM repair.buildings b WHERE b.id = 'c016b1d0-0000-4000-8000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM repair.tickets t WHERE t.building_id = b.id);
