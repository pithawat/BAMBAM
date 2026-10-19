-- +goose Up
-- CR-014: real category / symptom master (attachments/REPAIR-CATEGORY-SYMPTOM-MASTER.md), the
-- "อื่น ๆ" category in the DB, and the required room picked from platform.rooms.

-- Rooms per floor (D-048 planned them for settings Stage 4; CR-014 creates them now with an area type).
-- floor_id follows repair.floors until settings Stage 4 moves floors to platform (SET SCHEMA keeps ids).
CREATE TABLE platform.rooms (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id   uuid NOT NULL REFERENCES repair.floors (id),
    name       text NOT NULL,
    area_type  text NOT NULL
        CHECK (area_type IN ('meeting_room', 'restroom', 'office', 'pantry', 'common_area', 'parking', 'other')),
    sort_order integer NOT NULL DEFAULT 0,
    is_active  boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rooms_floor_name_key ON platform.rooms (floor_id, lower(name));

-- One "อื่น ๆ" category per system; it can never be deactivated (D-072).
ALTER TABLE repair.categories
    ADD COLUMN is_other boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT categories_other_active CHECK (NOT is_other OR is_active);
CREATE UNIQUE INDEX categories_one_other_key ON repair.categories (is_other) WHERE is_other;

-- Area types where a category's problems usually happen: S03 lists those rooms first (a hint, D-073).
CREATE TABLE repair.category_area_types (
    category_id uuid NOT NULL REFERENCES repair.categories (id),
    area_type   text NOT NULL
        CHECK (area_type IN ('meeting_room', 'restroom', 'office', 'pantry', 'common_area', 'parking', 'other')),
    PRIMARY KEY (category_id, area_type)
);

-- Null only on tickets created before CR-014; the API requires it for new tickets.
ALTER TABLE repair.tickets ADD COLUMN room_id uuid REFERENCES platform.rooms (id);
CREATE INDEX tickets_room_idx ON repair.tickets (room_id);

-- ---- master data (every environment) ----

-- Categories 1–7 with stable ids; re-running keeps the ids and re-applies names, icons and priorities.
INSERT INTO repair.categories (id, name, icon, default_priority, sort_order, is_other) VALUES
    ('c014ca70-0000-4000-8000-000000000001', 'ไฟฟ้าและแสงสว่าง', 'zap', 'medium', 1, false),
    ('c014ca70-0000-4000-8000-000000000002', 'ระบบปรับอากาศ', 'snowflake', 'medium', 2, false),
    ('c014ca70-0000-4000-8000-000000000003', 'ประปาและสุขาภิบาล', 'droplets', 'medium', 3, false),
    ('c014ca70-0000-4000-8000-000000000004', 'ห้องประชุมและโสตทัศนูปกรณ์', 'presentation', 'medium', 4, false),
    ('c014ca70-0000-4000-8000-000000000005', 'อาคารและพื้นที่ส่วนกลาง', 'building-2', 'medium', 5, false),
    ('c014ca70-0000-4000-8000-000000000006', 'ลานจอด / ไม้กั้น', 'square-parking', 'medium', 6, false),
    ('c014ca70-0000-4000-8000-000000000007', 'อื่น ๆ', 'ellipsis', 'medium', 7, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, icon = EXCLUDED.icon, default_priority = EXCLUDED.default_priority,
    sort_order = EXCLUDED.sort_order, is_other = EXCLUDED.is_other, is_active = true, updated_at = now();

-- Symptoms with the priorities the owner accepted (CR-014 table). The list items "อื่นๆ" /
-- "อื่นๆ โปรดระบุ" are not rows: they are the typed symptom (symptomOther).
INSERT INTO repair.symptoms (id, category_id, name, priority, sort_order) VALUES
    ('c0145e00-0001-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000001', 'ไฟไม่ติด/ไฟกะพริบ', 'medium', 1),
    ('c0145e00-0001-4000-8000-000000000002', 'c014ca70-0000-4000-8000-000000000001', 'ปลั๊กไม่มีไฟ/สวิตช์เสีย', 'medium', 2),
    ('c0145e00-0001-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000001', 'ไฟตกหรือดับ', 'high', 3),
    ('c0145e00-0001-4000-8000-000000000004', 'c014ca70-0000-4000-8000-000000000001', 'มีกลิ่นไหม้/ประกายไฟ', 'critical', 4),
    ('c0145e00-0002-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000002', 'แอร์ไม่เย็น', 'medium', 1),
    ('c0145e00-0002-4000-8000-000000000002', 'c014ca70-0000-4000-8000-000000000002', 'น้ำหยด/รั่วซึม', 'high', 2),
    ('c0145e00-0002-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000002', 'มีเสียงดัง', 'medium', 3),
    ('c0145e00-0002-4000-8000-000000000004', 'c014ca70-0000-4000-8000-000000000002', 'มีกลิ่น', 'low', 4),
    ('c0145e00-0002-4000-8000-000000000005', 'c014ca70-0000-4000-8000-000000000002', 'เปิดไม่ติด', 'high', 5),
    ('c0145e00-0002-4000-8000-000000000006', 'c014ca70-0000-4000-8000-000000000002', 'รีโมทเสีย', 'low', 6),
    ('c0145e00-0003-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000003', 'น้ำไม่ไหล', 'high', 1),
    ('c0145e00-0003-4000-8000-000000000002', 'c014ca70-0000-4000-8000-000000000003', 'น้ำรั่วซึม', 'high', 2),
    ('c0145e00-0003-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000003', 'ท่อตัน', 'medium', 3),
    ('c0145e00-0003-4000-8000-000000000004', 'c014ca70-0000-4000-8000-000000000003', 'ก๊อก/วาล์วเสีย', 'medium', 4),
    ('c0145e00-0003-4000-8000-000000000005', 'c014ca70-0000-4000-8000-000000000003', 'ชักโครกเสีย', 'medium', 5),
    ('c0145e00-0003-4000-8000-000000000006', 'c014ca70-0000-4000-8000-000000000003', 'ที่กดน้ำยาเช็ดฝาชักโครก/กล่องทิชชู่ชำรุด', 'low', 6),
    ('c0145e00-0004-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000004', 'ไมค์ไม่มีเสียง/เสียงขาด', 'medium', 1),
    ('c0145e00-0004-4000-8000-000000000002', 'c014ca70-0000-4000-8000-000000000004', 'ลำโพงไม่ดัง', 'medium', 2),
    ('c0145e00-0004-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000004', 'จอไม่แสดงผล/ไม่ติด', 'medium', 3),
    ('c0145e00-0004-4000-8000-000000000004', 'c014ca70-0000-4000-8000-000000000004', 'กล้องไม่ทำงาน', 'medium', 4),
    ('c0145e00-0004-4000-8000-000000000005', 'c014ca70-0000-4000-8000-000000000004', 'สายสัญญาณ HDMI เสีย', 'medium', 5),
    ('c0145e00-0005-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000005', 'ฝ้า/ผนังชำรุด', 'medium', 1),
    ('c0145e00-0005-4000-8000-000000000002', 'c014ca70-0000-4000-8000-000000000005', 'พื้นแตก/ร่อน', 'medium', 2),
    ('c0145e00-0005-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000005', 'ประตู/กระจกเสีย', 'medium', 3),
    ('c0145e00-0005-4000-8000-000000000004', 'c014ca70-0000-4000-8000-000000000005', 'หลังคารั่ว', 'high', 4),
    ('c0145e00-0005-4000-8000-000000000005', 'c014ca70-0000-4000-8000-000000000005', 'สีลอก', 'low', 5),
    ('c0145e00-0005-4000-8000-000000000006', 'c014ca70-0000-4000-8000-000000000005', 'เสี่ยงหล่นใส่คน', 'critical', 6),
    ('c0145e00-0006-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000006', 'ไม้กั้นค้าง/ไม่ยกลง', 'high', 1),
    ('c0145e00-0006-4000-8000-000000000002', 'c014ca70-0000-4000-8000-000000000006', 'ไม้กั้นไม่ทำงาน', 'high', 2),
    ('c0145e00-0006-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000006', 'ไม้กั้นหัก/ชำรุด', 'medium', 3),
    ('c0145e00-0006-4000-8000-000000000004', 'c014ca70-0000-4000-8000-000000000006', 'ที่จอดรถชำรุด/พื้นแตก', 'low', 4),
    ('c0145e00-0006-4000-8000-000000000005', 'c014ca70-0000-4000-8000-000000000006', 'เส้นจราจรลบเลือน', 'low', 5),
    ('c0145e00-0006-4000-8000-000000000006', 'c014ca70-0000-4000-8000-000000000006', 'ป้าย/สัญญาณจราจรเสีย', 'medium', 6),
    ('c0145e00-0006-4000-8000-000000000007', 'c014ca70-0000-4000-8000-000000000006', 'ไฟส่องสว่างลานจอดดับ', 'medium', 7),
    ('c0145e00-0007-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000007', 'ใช้งานไม่ได้', 'medium', 1),
    ('c0145e00-0007-4000-8000-000000000002', 'c014ca70-0000-4000-8000-000000000007', 'มีเสียง/กลิ่นผิดปกติ', 'medium', 2),
    ('c0145e00-0007-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000007', 'รั่วซึมชำรุด', 'medium', 3),
    ('c0145e00-0007-4000-8000-000000000004', 'c014ca70-0000-4000-8000-000000000007', 'มีความเสี่ยงอันตราย', 'critical', 4)
ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id, name = EXCLUDED.name, priority = EXCLUDED.priority,
    sort_order = EXCLUDED.sort_order, is_active = true, updated_at = now();

-- Area type hints per category (CR-014 examples; proposals for the rest, editable in settings S22).
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
    ('c014ca70-0000-4000-8000-000000000006', 'parking')
ON CONFLICT DO NOTHING;

-- Every other (sample) category is switched off, never deleted: old tickets keep their references.
UPDATE repair.categories SET is_active = false, updated_at = now()
WHERE is_active AND id NOT IN (
    'c014ca70-0000-4000-8000-000000000001', 'c014ca70-0000-4000-8000-000000000002',
    'c014ca70-0000-4000-8000-000000000003', 'c014ca70-0000-4000-8000-000000000004',
    'c014ca70-0000-4000-8000-000000000005', 'c014ca70-0000-4000-8000-000000000006',
    'c014ca70-0000-4000-8000-000000000007');

-- ลานจอด / ไม้กั้น has no building: one outdoor "building" with the car park as its only floor
-- and room (owner answer 2026-10-19). Real zones are added later as floors / rooms.
INSERT INTO repair.buildings (id, name, sort_order) VALUES
    ('c014b1d0-0000-4000-8000-000000000001', 'พื้นที่ภายนอกอาคาร', 900)
ON CONFLICT (id) DO NOTHING;
INSERT INTO repair.floors (id, building_id, name, level) VALUES
    ('c014f100-0000-4000-8000-000000000001', 'c014b1d0-0000-4000-8000-000000000001', 'ลานจอดรถ', 1)
ON CONFLICT DO NOTHING;
INSERT INTO platform.rooms (id, floor_id, name, area_type, sort_order) VALUES
    ('c014e000-0000-4000-8000-000000000001', 'c014f100-0000-4000-8000-000000000001', 'ลานจอดรถ', 'parking', 1)
ON CONFLICT DO NOTHING;

-- Every floor of a real building has a common area, so the required room always has a valid choice.
INSERT INTO platform.rooms (floor_id, name, area_type, sort_order)
SELECT f.id, 'พื้นที่ส่วนกลางชั้น ' || f.name, 'common_area', 1000
FROM repair.floors f
WHERE f.is_active AND f.building_id <> 'c014b1d0-0000-4000-8000-000000000001'
ON CONFLICT DO NOTHING;

-- +goose Down
-- Drops the room on every ticket. The master rows stay (old tickets may use them); the sample
-- categories are not switched back on.
DROP INDEX repair.tickets_room_idx;
ALTER TABLE repair.tickets DROP COLUMN room_id;
DROP TABLE repair.category_area_types;
DROP INDEX repair.categories_one_other_key;
ALTER TABLE repair.categories DROP CONSTRAINT categories_other_active, DROP COLUMN is_other;
DROP TABLE platform.rooms;
DELETE FROM repair.floors f WHERE f.id = 'c014f100-0000-4000-8000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM repair.tickets t WHERE t.floor_id = f.id);
DELETE FROM repair.buildings b WHERE b.id = 'c014b1d0-0000-4000-8000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM repair.floors f WHERE f.building_id = b.id);
