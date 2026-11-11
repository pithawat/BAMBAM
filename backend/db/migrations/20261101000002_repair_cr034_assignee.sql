-- +goose Up
-- CR-034 (D-137): an in-house job has one responsible technician, picked in S17 (`ช่างผู้รับผิดชอบ`).
-- Contractor jobs keep NULL. Old assessed in-house tickets take the technician who holds them; the rest
-- stay NULL (S07 / S10 show `ยังไม่ระบุช่าง`).
ALTER TABLE repair.tickets ADD COLUMN assignee_id uuid REFERENCES platform.users (id);
UPDATE repair.tickets SET assignee_id = holder_id
WHERE work_by = 'in_house' AND expected_done_on IS NOT NULL AND holder_id IS NOT NULL;

-- People with their role name (no user_roles row = employee), for the assignee line and the #36 picker.
CREATE VIEW repair.staff AS
SELECT p.id, p.name, coalesce(r.key, 'employee')::text AS role_key, coalesce(r.name, e.name)::text AS role_name
FROM repair.people p
JOIN platform.users u ON u.id = p.id
LEFT JOIN platform.user_roles ur ON ur.employee_code = u.employee_code
LEFT JOIN platform.roles r ON r.id = ur.role_id
CROSS JOIN (SELECT name FROM platform.roles WHERE key = 'employee') e;

-- +goose Down
DROP VIEW repair.staff;
ALTER TABLE repair.tickets DROP COLUMN assignee_id;
