-- +goose Up
-- CR-033 (D-135): ฝั่งสำนักงานใหญ่ follows the site plan `attachments/building plan/5-…pdf` p.4 (MAR 2025, A3 1:750,
-- scanned). Fitted with อาคาร 1 at the origin, the plan's own scale (checked on the property lines 69.99 / 112.06 m
-- and the อาคาร 1 / 2 footprints) and turned −8.1° so อาคาร 1–3 keep their orientation. Blocks that were off the
-- plan by more than ~3 m move (อาคาร 2: 5.2 m, อาคาร 3: 26.3 m, ห้องประชุม 60 ปี: 5.3 m); อาคาร 4 (2.7 m) and
-- โรงอาหาร (2.7 m) move too so the traced roads do not clip them. อาคาร 4 is also turned 180° (owner). TrialMix
-- stays: the plan draws a different (new) complex there, and the current place sits on it. Data only.
UPDATE platform.site_blocks s SET x_m = v.x, z_m = v.z, rot_deg = v.r, updated_at = now()
FROM (VALUES
    (2, -59.4, 18.0, 17.1),
    (3, 74.8, 59.9, 7.6),
    (4, 101.2, 25.1, 96.1),
    (16, -38.1, -11.3, -76.0),
    (17, -22.4, -11.8, -75.7)
) AS v (map_no, x, z, r)
WHERE s.map_no = v.map_no;

-- +goose Down
UPDATE platform.site_blocks s SET x_m = v.x, z_m = v.z, rot_deg = v.r, updated_at = now()
FROM (VALUES
    (2, -62.5, 22.2, 17.1),
    (3, 48.5, 61.1, 7.6),
    (4, 103.4, 26.7, -83.9),
    (16, -40.6, -12.2, -76.0),
    (17, -25.8, -7.7, -75.7)
) AS v (map_no, x, z, r)
WHERE s.map_no = v.map_no;
