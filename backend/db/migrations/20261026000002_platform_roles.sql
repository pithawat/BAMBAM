-- +goose Up
-- settings Stage 1 (repair CR-007 A, settings CR-001, D-049): roles become data. Each role has a
-- stable key (glossary keys for the seeded roles, `r_` + 8 hex for new ones) and a set of stored
-- permissions. The fixed `settings.*` keys are granted in code from the role key and never stored.
-- repair CR-024: there is no `executive` role; its users become `employee`.

CREATE TABLE platform.roles (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key           text NOT NULL UNIQUE,
    name          text NOT NULL,
    description   text NOT NULL DEFAULT '',
    -- is_system: cannot be deleted (employee, super_admin); is_locked: permissions cannot be edited (super_admin)
    is_system     boolean NOT NULL DEFAULT false,
    is_locked     boolean NOT NULL DEFAULT false,
    sort_order    integer NOT NULL DEFAULT 1000,
    created_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL,
    updated_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX roles_name_key ON platform.roles (lower(name));

-- UUIDv5 ids (namespace uuid5(URL, 'https://bambam/platform/roles'), name = key) so every
-- environment has the same ids. Order: super_admin, then the glossary order (contract `Role`).
INSERT INTO platform.roles (id, key, name, description, is_system, is_locked, sort_order) VALUES
    ('7f35e48b-245b-5d5c-a1af-eb43d9181a3c', 'super_admin', 'Superadmin', 'ดูแลระบบทั้งหมด รวมผู้ใช้และสิทธิ์', true, true, 0),
    ('5f75bf9d-49de-5619-af0a-53b0d96f5058', 'employee', 'พนักงานทั่วไป', 'แจ้งซ่อมและติดตามงานของตัวเอง', true, false, 1),
    ('b1c735a0-4a1e-5e0a-af94-f8c879af66eb', 'housekeeper_lead', 'หัวหน้าแม่บ้าน', 'บันทึกและติดตามงานที่ทีมดำเนินการเอง', false, false, 2),
    ('1b93abea-52ba-5e69-92d0-46d66c9689ec', 'security_lead', 'หัวหน้ารปภ.', 'บันทึกและติดตามงานที่ทีมดำเนินการเอง', false, false, 3),
    ('3c83d3f8-f274-599c-ae39-111c9e23defa', 'technician', 'ช่างเทคนิค', 'รับเรื่อง ดำเนินการ และบันทึกผลซ่อม', false, false, 4),
    ('b736a006-ba77-5545-90ac-9f5387f981ba', 'admin', 'Admin', 'จัดการงานซ่อม สถานที่ อุปกรณ์ และหมวดงาน', false, false, 5);

CREATE TABLE platform.role_permissions (
    role_id    uuid NOT NULL REFERENCES platform.roles (id) ON DELETE CASCADE,
    permission text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission)
);

-- Defaults = repair behaviour before roles became data (settings 01-users.md → Permission catalog).
-- super_admin is granted every key in code as well (BR-F25-1).
INSERT INTO platform.role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM platform.roles r
JOIN (VALUES
    ('housekeeper_lead', 'repair.ticket.team_handle'),
    ('security_lead', 'repair.ticket.team_handle'),
    ('technician', 'repair.ticket.view_all'),
    ('technician', 'repair.ticket.work'),
    ('technician', 'repair.contractor.manage'),
    ('admin', 'repair.ticket.view_all'),
    ('admin', 'repair.ticket.close_any'),
    ('admin', 'repair.ticket.handover_any'),
    ('admin', 'repair.overview.view'),
    ('super_admin', 'repair.ticket.view_all'),
    ('super_admin', 'repair.ticket.work'),
    ('super_admin', 'repair.ticket.close_any'),
    ('super_admin', 'repair.ticket.team_handle'),
    ('super_admin', 'repair.ticket.handover_any'),
    ('super_admin', 'repair.contractor.manage'),
    ('super_admin', 'repair.overview.view')
) AS p (role_key, permission) ON p.role_key = r.key;

-- The matrix version for optimistic concurrency (D-051). Exactly one row.
CREATE TABLE platform.permission_matrix (
    id            boolean PRIMARY KEY DEFAULT true CHECK (id),
    version       integer NOT NULL DEFAULT 1,
    updated_by_id uuid REFERENCES platform.users (id) ON DELETE SET NULL,
    updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform.permission_matrix (id) VALUES (true);

-- user_roles: the text role becomes a reference. repair CR-024: executive → employee.
ALTER TABLE platform.user_roles ADD COLUMN role_id uuid REFERENCES platform.roles (id);
UPDATE platform.user_roles SET role = 'employee' WHERE role = 'executive';
UPDATE platform.user_roles ur SET role_id = r.id FROM platform.roles r WHERE r.key = ur.role;
ALTER TABLE platform.user_roles ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE platform.user_roles DROP COLUMN role;
CREATE INDEX user_roles_role_id_idx ON platform.user_roles (role_id);

-- S26 audit list, newest first (settings Stage 3).
CREATE INDEX audit_log_created_at_idx ON platform.audit_log (created_at DESC);

-- +goose Down
DROP INDEX platform.audit_log_created_at_idx;

-- Roles the old CHECK does not know (super_admin, custom roles) fall back to employee.
ALTER TABLE platform.user_roles ADD COLUMN role text;
UPDATE platform.user_roles ur SET role = CASE
        WHEN r.key IN ('employee', 'housekeeper_lead', 'security_lead', 'technician', 'admin') THEN r.key
        ELSE 'employee' END
FROM platform.roles r WHERE r.id = ur.role_id;
ALTER TABLE platform.user_roles ALTER COLUMN role SET NOT NULL;
ALTER TABLE platform.user_roles ADD CONSTRAINT user_roles_role_check
    CHECK (role IN ('employee', 'housekeeper_lead', 'security_lead', 'technician', 'admin', 'executive'));
DROP INDEX platform.user_roles_role_id_idx;
ALTER TABLE platform.user_roles DROP COLUMN role_id;

DROP TABLE platform.permission_matrix;
DROP TABLE platform.role_permissions;
DROP TABLE platform.roles;
