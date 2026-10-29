-- +goose Up
-- CR-027 (D-124, D-126): อาคาร 2 (4 floors, 24 × 15 m) with its rooms traced from
-- attachments/building plan/2-อาคาร 2.pdf (3 m grid: x 0–24 = columns 1–9, z 0 / 6 / 9 / 15 = rows A–D;
-- every floor adds up to 360 m²), the 3D shape key per building, and the campus site layout of S29.

-- Which procedural 3D shape draws the building (frontend registry); NULL = no 3D shape.
ALTER TABLE platform.buildings ADD COLUMN model_key text CHECK (model_key ~ '^[a-z0-9_-]{1,20}$');

-- S29 site view (D-126): one box per building frame of `Cpac map.png`, numbered as in
-- `รายชื่ออาคาร.txt`. Position / size are approximate (the map is a screenshot, owner 2026-10-29);
-- a block linked to a building uses that building's plan footprint instead of width / depth.
-- x / z: metres from the centre of อาคาร 1 (x east, z south); rot_deg: clockwise on the map, north up,
-- of the block's long side. Not a building: blocks never show in the report form or settings.
CREATE TABLE platform.site_blocks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    map_no      smallint NOT NULL UNIQUE,
    name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    building_id uuid UNIQUE REFERENCES platform.buildings (id),
    x_m         numeric(7, 2) NOT NULL,
    z_m         numeric(7, 2) NOT NULL,
    rot_deg     numeric(5, 1) NOT NULL CHECK (rot_deg > -180 AND rot_deg <= 180),
    width_m     numeric(6, 2) NOT NULL CHECK (width_m > 0),
    depth_m     numeric(6, 2) NOT NULL CHECK (depth_m > 0),
    storeys     smallint NOT NULL CHECK (storeys BETWEEN 1 AND 30),
    -- CR-028: the site view shows one side at a time (1 ฝั่งสำนักงานใหญ่, 2 ฝั่ง Riverside)
    side        smallint NOT NULL CHECK (side IN (1, 2)),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

UPDATE platform.buildings SET model_key = 'b1' WHERE id = 'c016b1d0-0000-4000-8000-000000000001';

-- อาคาร 2 (stops here when a building with this name already exists: rename it in settings first).
INSERT INTO platform.buildings (id, name, sort_order, building_type_id, model_key) VALUES
    ('c027b1d0-0000-4000-8000-000000000002', 'อาคาร 2', 2, 'c025b700-0000-4000-8000-000000000001', 'b2')
ON CONFLICT (id) DO UPDATE SET model_key = EXCLUDED.model_key; -- kept by a Down while in use
INSERT INTO platform.floors (id, building_id, name, level)
SELECT ('c027f200-0000-4000-8000-00000000000' || n)::uuid, 'c027b1d0-0000-4000-8000-000000000002', n::text, n
FROM generate_series(1, 4) AS n
ON CONFLICT DO NOTHING;
INSERT INTO platform.floor_plans (floor_id, width_m, depth_m)
SELECT ('c027f200-0000-4000-8000-00000000000' || n)::uuid, 24, 15
FROM generate_series(1, 4) AS n
ON CONFLICT DO NOTHING;

-- Unlabelled rooms are named by Claude (owner 2026-10-29), renamed later in settings S22: meeting rooms
-- "อ.2 ห้อง {floor}{nn}" like อาคาร 1, open offices "พื้นที่ทำงาน ชั้น {n}". ห้องน้ำ lies inside the
-- common area (the core with the stairs); a point belongs to the smallest room around it.
INSERT INTO platform.rooms (id, floor_id, name, area_type, sort_order, plan_shape) VALUES
    ('c027e201-0000-4000-8000-000000000001', 'c027f200-0000-4000-8000-000000000001', 'ห้องเก็บของ', 'other', 1, '[[0,0],[6,0],[6,6],[0,6]]'),
    ('c027e201-0000-4000-8000-000000000002', 'c027f200-0000-4000-8000-000000000001', 'Co-working 1', 'office', 2, '[[15,0],[18,0],[18,3],[15,3]]'),
    ('c027e201-0000-4000-8000-000000000003', 'c027f200-0000-4000-8000-000000000001', 'Co-working 2', 'office', 3, '[[15,3],[18,3],[18,6],[15,6]]'),
    ('c027e201-0000-4000-8000-000000000004', 'c027f200-0000-4000-8000-000000000001', 'Co-working 3', 'office', 4, '[[18,0],[24,0],[24,6],[18,6]]'),
    ('c027e201-0000-4000-8000-000000000005', 'c027f200-0000-4000-8000-000000000001', 'Co-working space', 'office', 5, '[[0,6],[24,6],[24,15],[0,15]]'),
    ('c027e201-0000-4000-8000-000000000006', 'c027f200-0000-4000-8000-000000000001', 'ห้องน้ำ', 'restroom', 6, '[[6,0],[12,0],[12,6],[6,6]]'),
    ('c027e201-0000-4000-8000-000000000099', 'c027f200-0000-4000-8000-000000000001', 'พื้นที่ส่วนกลางชั้น 1', 'common_area', 1000, '[[6,0],[15,0],[15,6],[6,6]]'),
    ('c027e202-0000-4000-8000-000000000001', 'c027f200-0000-4000-8000-000000000002', 'อ.2 ห้อง 201', 'meeting_room', 1, '[[0,0],[3,0],[3,6],[0,6]]'),
    ('c027e202-0000-4000-8000-000000000002', 'c027f200-0000-4000-8000-000000000002', 'อ.2 ห้อง 202', 'meeting_room', 2, '[[3,0],[6,0],[6,3],[3,3]]'),
    ('c027e202-0000-4000-8000-000000000003', 'c027f200-0000-4000-8000-000000000002', 'อ.2 ห้อง 203', 'meeting_room', 3, '[[6,0],[9,0],[9,4],[6,4]]'),
    ('c027e202-0000-4000-8000-000000000004', 'c027f200-0000-4000-8000-000000000002', 'อ.2 ห้อง 204', 'office', 4, '[[6,4],[9,4],[9,6],[6,6]]'),
    ('c027e202-0000-4000-8000-000000000005', 'c027f200-0000-4000-8000-000000000002', 'ทีม B2B SCG Distribution and Retail Business', 'office', 5, '[[15,0],[24,0],[24,6],[15,6]]'),
    ('c027e202-0000-4000-8000-000000000006', 'c027f200-0000-4000-8000-000000000002', 'อ.2 ห้อง 205', 'meeting_room', 6, '[[21,6],[24,6],[24,9],[21,9]]'),
    ('c027e202-0000-4000-8000-000000000007', 'c027f200-0000-4000-8000-000000000002', 'ทีม Marketing and Branding', 'office', 7, '[[0,9],[12,9],[12,12],[3,12],[3,15],[0,15]]'),
    ('c027e202-0000-4000-8000-000000000008', 'c027f200-0000-4000-8000-000000000002', 'พื้นที่ทำงาน ชั้น 2', 'office', 8, '[[12,9],[24,9],[24,15],[3,15],[3,12],[12,12]]'),
    ('c027e202-0000-4000-8000-000000000009', 'c027f200-0000-4000-8000-000000000002', 'ห้องน้ำ', 'restroom', 9, '[[9,0],[12,0],[12,6],[9,6]]'),
    ('c027e202-0000-4000-8000-000000000099', 'c027f200-0000-4000-8000-000000000002', 'พื้นที่ส่วนกลางชั้น 2', 'common_area', 1000, '[[9,0],[15,0],[15,6],[21,6],[21,9],[0,9],[0,6],[3,6],[3,3],[6,3],[6,6],[9,6]]'),
    ('c027e203-0000-4000-8000-000000000001', 'c027f200-0000-4000-8000-000000000003', 'อ.2 ห้อง 301', 'meeting_room', 1, '[[0,0],[3,0],[3,6],[0,6]]'),
    ('c027e203-0000-4000-8000-000000000002', 'c027f200-0000-4000-8000-000000000003', 'WP', 'meeting_room', 2, '[[3,0],[6,0],[6,3],[3,3]]'),
    ('c027e203-0000-4000-8000-000000000003', 'c027f200-0000-4000-8000-000000000003', 'อ.2 ห้อง 302', 'meeting_room', 3, '[[6,0],[9,0],[9,4],[6,4]]'),
    ('c027e203-0000-4000-8000-000000000004', 'c027f200-0000-4000-8000-000000000003', 'อ.2 ห้อง 303', 'office', 4, '[[6,4],[9,4],[9,6],[6,6]]'),
    ('c027e203-0000-4000-8000-000000000005', 'c027f200-0000-4000-8000-000000000003', 'พื้นที่ทำงาน ชั้น 3', 'office', 5, '[[15,0],[24,0],[24,6],[15,6]]'),
    ('c027e203-0000-4000-8000-000000000006', 'c027f200-0000-4000-8000-000000000003', 'น.BIM', 'office', 6, '[[22.5,6],[24,6],[24,9],[22.5,9]]'),
    ('c027e203-0000-4000-8000-000000000007', 'c027f200-0000-4000-8000-000000000003', 'น. Digital Construction', 'office', 7, '[[0,9],[24,9],[24,15],[0,15]]'),
    ('c027e203-0000-4000-8000-000000000008', 'c027f200-0000-4000-8000-000000000003', 'ห้องน้ำ', 'restroom', 8, '[[9,0],[12,0],[12,6],[9,6]]'),
    ('c027e203-0000-4000-8000-000000000099', 'c027f200-0000-4000-8000-000000000003', 'พื้นที่ส่วนกลางชั้น 3', 'common_area', 1000, '[[9,0],[15,0],[15,6],[22.5,6],[22.5,9],[0,9],[0,6],[3,6],[3,3],[6,3],[6,6],[9,6]]'),
    ('c027e204-0000-4000-8000-000000000001', 'c027f200-0000-4000-8000-000000000004', 'WPS', 'office', 1, '[[0,0],[3,0],[3,6],[0,6]]'),
    ('c027e204-0000-4000-8000-000000000002', 'c027f200-0000-4000-8000-000000000004', 'Data and Digitization', 'office', 2, '[[3,0],[6,0],[6,3],[3,3]]'),
    ('c027e204-0000-4000-8000-000000000003', 'c027f200-0000-4000-8000-000000000004', 'Marketing and Branding', 'office', 3, '[[6,0],[9,0],[9,1.5],[6,1.5]]'),
    ('c027e204-0000-4000-8000-000000000004', 'c027f200-0000-4000-8000-000000000004', 'WPS พื้นที่ห้องประชุม', 'meeting_room', 4, '[[15,0],[24,0],[24,6],[15,6]]'),
    ('c027e204-0000-4000-8000-000000000005', 'c027f200-0000-4000-8000-000000000004', 'น. Marketing and Branding', 'office', 5, '[[0,9],[24,9],[24,15],[0,15]]'),
    ('c027e204-0000-4000-8000-000000000006', 'c027f200-0000-4000-8000-000000000004', 'ห้องน้ำ', 'restroom', 6, '[[9,0],[12,0],[12,6],[9,6]]'),
    ('c027e204-0000-4000-8000-000000000099', 'c027f200-0000-4000-8000-000000000004', 'พื้นที่ส่วนกลางชั้น 4', 'common_area', 1000, '[[9,0],[15,0],[15,6],[24,6],[24,9],[0,9],[0,6],[3,6],[3,3],[6,3],[6,1.5],[9,1.5]]')
ON CONFLICT (id) DO UPDATE SET plan_shape = EXCLUDED.plan_shape, updated_at = now();

-- Site blocks from the map frames (scale bar 50 m = 96 px): position and rotation from the frame, size and
-- floors from each building's plan in attachments/building plan/ (owner 2026-10-29). Frame size where the
-- plan gives none (16 โรงอาหาร, 17 ห้องประชุม 60 ปี: one irregular plan for both) and for 13 (plan 80 × 40 m
-- does not fit its frame — owner checks). No. 14 is not on the map yet; no. 15 was a typo (owner).
INSERT INTO platform.site_blocks (id, map_no, name, building_id, x_m, z_m, rot_deg, width_m, depth_m, storeys, side) VALUES
    ('c0275b00-0000-4000-8000-000000000001', 1, 'อาคาร 1', 'c016b1d0-0000-4000-8000-000000000001', 0, 0, 17.1, 32, 15, 6, 1),
    ('c0275b00-0000-4000-8000-000000000002', 2, 'อาคาร 2', 'c027b1d0-0000-4000-8000-000000000002', -62.5, 22.2, 17.1, 24, 15, 4, 1),
    ('c0275b00-0000-4000-8000-000000000003', 3, 'อาคาร 3', NULL, 48.5, 61.1, 7.6, 72, 17, 1, 1),
    ('c0275b00-0000-4000-8000-000000000004', 4, 'อาคาร 4', NULL, 103.4, 26.7, -83.9, 38, 10, 2, 1),
    ('c0275b00-0000-4000-8000-000000000005', 5, 'อาคาร TrialMix และห้องทดสอบหินทราย', NULL, 65.8, -44.2, 7.1, 43.5, 13.7, 1, 1),
    ('c0275b00-0000-4000-8000-000000000006', 6, 'อาคาร riverside อเนกประสงค์', NULL, -122.2, 124.6, -24.4, 32, 20, 1, 2),
    ('c0275b00-0000-4000-8000-000000000007', 7, 'อาคาร Riverside 1', NULL, -188.9, 147.0, -24.4, 24, 15, 3, 2),
    ('c0275b00-0000-4000-8000-000000000008', 8, 'อาคาร Riverside 2', NULL, -162.0, 111.9, -27.9, 26, 14.6, 3, 2),
    ('c0275b00-0000-4000-8000-000000000009', 9, 'อาคาร Riverside 3', NULL, -136.4, 98.1, -27.9, 15, 10, 2, 2),
    ('c0275b00-0000-4000-8000-000000000010', 10, 'อาคาร CCTC', NULL, -258.5, 202.1, -61.7, 57, 17.7, 2, 2),
    ('c0275b00-0000-4000-8000-000000000011', 11, 'CPAC Warehouse 1 (3D print)', NULL, -200.0, 90.8, -28.3, 68.5, 15, 1, 2),
    ('c0275b00-0000-4000-8000-000000000012', 12, 'CPAC Warehouse 2', NULL, -287.9, 181.1, -61.4, 40, 15, 1, 2),
    ('c0275b00-0000-4000-8000-000000000013', 13, 'CPAC Warehouse 3', NULL, -298.9, 200.6, -61.9, 18.0, 17.3, 1, 2),
    ('c0275b00-0000-4000-8000-000000000016', 16, 'โรงอาหาร', NULL, -40.6, -12.2, -76.0, 24.4, 11.4, 1, 1),
    ('c0275b00-0000-4000-8000-000000000017', 17, 'ห้องประชุม 60 ปี', NULL, -25.8, -7.7, -75.7, 24.5, 11.4, 1, 1),
    ('c0275b00-0000-4000-8000-000000000018', 18, 'อาคารโรงเรือน CPAC', NULL, -276.1, 230.7, -60.9, 36.1, 16.5, 1, 2);

-- +goose Down
-- อาคาร 2 goes only when no ticket or asset uses it; otherwise it stays (without its 3D key).
DROP TABLE platform.site_blocks;
DELETE FROM platform.rooms r USING platform.floors f
WHERE r.floor_id = f.id AND f.building_id = 'c027b1d0-0000-4000-8000-000000000002'
    AND NOT EXISTS (SELECT 1 FROM repair.tickets t WHERE t.building_id = f.building_id)
    AND NOT EXISTS (SELECT 1 FROM platform.assets a JOIN platform.rooms ar ON ar.id = a.room_id
                    JOIN platform.floors af ON af.id = ar.floor_id WHERE af.building_id = f.building_id);
DELETE FROM platform.floor_plans fp USING platform.floors f
WHERE fp.floor_id = f.id AND f.building_id = 'c027b1d0-0000-4000-8000-000000000002'
    AND NOT EXISTS (SELECT 1 FROM platform.rooms r WHERE r.floor_id = f.id);
DELETE FROM platform.floors f WHERE f.building_id = 'c027b1d0-0000-4000-8000-000000000002'
    AND NOT EXISTS (SELECT 1 FROM platform.rooms r WHERE r.floor_id = f.id);
DELETE FROM platform.buildings b WHERE b.id = 'c027b1d0-0000-4000-8000-000000000002'
    AND NOT EXISTS (SELECT 1 FROM platform.floors f WHERE f.building_id = b.id);
ALTER TABLE platform.buildings DROP COLUMN model_key;
