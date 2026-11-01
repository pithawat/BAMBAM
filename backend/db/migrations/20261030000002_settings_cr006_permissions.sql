-- +goose Up
-- settings CR-006 (D-125): platform-wide permission catalog. Data only, no schema change.
--  * service access `repair.ticket.report`, `car_booking.use`, `room_booking.use`: every role except
--    technician — custom roles included, since every role could report before (reporting was a base right);
--  * `repair.building3d.view`: admin (sub-permission of `repair.overview.view`);
--  * the settings keys are stored from now on (before: granted from the role key in code, D-111):
--    admin gets all 8, incl. the new `settings.users.view`; custom roles none.
-- super_admin is granted every key in code; its rows are seeded like the other keys (20261026000002).
INSERT INTO platform.role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM platform.roles r
CROSS JOIN (VALUES ('repair.ticket.report'), ('car_booking.use'), ('room_booking.use')) AS p (permission)
WHERE r.key <> 'technician'
ON CONFLICT DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM platform.roles r
CROSS JOIN (VALUES
    ('repair.building3d.view'),
    ('settings.locations.manage'),
    ('settings.assets.manage'),
    ('settings.categories.manage'),
    ('settings.contractor_types.manage'),
    ('settings.users.view'),
    ('settings.users.manage'),
    ('settings.roles.manage'),
    ('settings.audit.view')
) AS p (permission)
WHERE r.key IN ('admin', 'super_admin')
ON CONFLICT DO NOTHING;

-- an S24 page open since before this migration gets VERSION_CONFLICT instead of saving over it
UPDATE platform.permission_matrix SET version = version + 1, updated_at = now();

-- +goose Down
-- The keys did not exist (or were not stored) before CR-006.
DELETE FROM platform.role_permissions
WHERE permission IN ('repair.ticket.report', 'car_booking.use', 'room_booking.use', 'repair.building3d.view')
   OR permission LIKE 'settings.%';

UPDATE platform.permission_matrix SET version = version + 1, updated_at = now();
