-- +goose Up
-- Owner 2026-10-20 (D-086): every ticket of the two SAMPLE buildings (seed.go, dev / UAT only) moves to
-- อาคาร 1 so the S29 model shows real data. Same floor level (levels above 6 → 6); a restroom goes to
-- the floor's ห้องน้ำ when it has one, everything else to พื้นที่ส่วนกลางชั้น {n}; the old room name is
-- kept in front of the extra spot (location_detail). The car park (พื้นที่ภายนอกอาคาร) is not touched.
-- Then duplicates in อาคาร 1 — same room + category + symptoms — keep the oldest ticket only.
-- Production has no sample buildings, so nothing happens there. No temp tables: sqlc reads this file.

UPDATE repair.tickets t SET
    building_id = 'c016b1d0-0000-4000-8000-000000000001',
    floor_id = m.floor_id,
    room_id = m.room_id,
    location_detail = m.location_detail,
    updated_at = now()
FROM (
    SELECT t2.id AS ticket_id,
           tf.id AS floor_id,
           COALESCE(
               CASE WHEN old_room.area_type = 'restroom' THEN (
                   SELECT r.id FROM platform.rooms r
                   WHERE r.floor_id = tf.id AND r.area_type = 'restroom' AND r.is_active
                   ORDER BY r.sort_order LIMIT 1) END,
               (SELECT r.id FROM platform.rooms r
                WHERE r.floor_id = tf.id AND r.area_type = 'common_area' AND r.is_active
                ORDER BY r.sort_order LIMIT 1)
           ) AS room_id,
           CASE
               WHEN old_room.name IS NULL OR old_room.area_type = 'common_area' THEN t2.location_detail
               WHEN t2.location_detail IS NULL OR t2.location_detail = '' THEN left(old_room.name, 100)
               ELSE left(old_room.name || ' · ' || t2.location_detail, 100)
           END AS location_detail
    FROM repair.tickets t2
    JOIN repair.floors old_floor ON old_floor.id = t2.floor_id
    LEFT JOIN platform.rooms old_room ON old_room.id = t2.room_id
    JOIN repair.floors tf ON tf.building_id = 'c016b1d0-0000-4000-8000-000000000001'
        AND tf.level = LEAST(old_floor.level, 6)
    WHERE t2.building_id IN ('5fefabed-d12b-5155-bc79-9d75f3bf6404', '33a8fd5a-a010-5ae4-8bfc-021e96ddc6f1')
) m
WHERE t.id = m.ticket_id;

-- Duplicates in อาคาร 1: same room, category (or typed category) and symptoms (picked + typed); the oldest
-- stays. Their photos become unattached, so the photo purge job removes the files; symptoms, events,
-- photo links and followers go with the ticket (ON DELETE CASCADE).
WITH dups AS (
    SELECT id FROM (
        SELECT t.id,
               row_number() OVER (
                   PARTITION BY t.room_id, t.category_id, COALESCE(t.category_other, ''), COALESCE(t.symptom_other, ''),
                       COALESCE((SELECT string_agg(ts.symptom_id::text, ',' ORDER BY ts.symptom_id)
                                 FROM repair.ticket_symptoms ts WHERE ts.ticket_id = t.id), '')
                   ORDER BY t.created_at, t.id) AS n
        FROM repair.tickets t
        WHERE t.building_id = 'c016b1d0-0000-4000-8000-000000000001'
    ) ranked
    WHERE n > 1
), released AS (
    UPDATE repair.photos p SET attached_at = NULL, updated_at = now()
    FROM repair.ticket_photos tp
    WHERE tp.photo_id = p.id AND tp.ticket_id IN (SELECT id FROM dups)
    RETURNING p.id
)
DELETE FROM repair.tickets WHERE id IN (SELECT id FROM dups);

-- +goose Down
-- Not reversible: the moved tickets stay in อาคาร 1 and deleted duplicates are gone.
SELECT 1;
