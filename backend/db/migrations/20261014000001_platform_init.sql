-- +goose Up
CREATE SCHEMA IF NOT EXISTS platform;

-- People who logged in through RMC SSO (claims refreshed on every login) and,
-- in dev/UAT only, the seeded demo users used by the role switcher (D-005).
CREATE TABLE platform.users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code text NOT NULL UNIQUE,
    sso_subject   text UNIQUE,
    first_name_th text,
    last_name_th  text,
    first_name_en text,
    last_name_en  text,
    email         text,
    department    text,
    division      text,
    position_th   text,
    is_demo       boolean NOT NULL DEFAULT false,
    last_login_at timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One role per person, keyed by employee_code so the seed file can assign a role
-- before the person's first login (D-003, D-004). No row = employee.
CREATE TABLE platform.user_roles (
    employee_code text PRIMARY KEY,
    role          text NOT NULL CHECK (role IN ('employee', 'housekeeper_lead', 'security_lead', 'technician', 'admin', 'executive')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- App sessions. The cookie holds a random token; only its SHA-256 is stored.
CREATE TABLE platform.sessions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash     bytea NOT NULL UNIQUE,
    user_id        uuid NOT NULL REFERENCES platform.users (id) ON DELETE CASCADE,
    -- the real SSO user behind a role-switcher session (NULL for normal sessions)
    origin_user_id uuid REFERENCES platform.users (id) ON DELETE CASCADE,
    expires_at     timestamptz NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON platform.sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON platform.sessions (expires_at);

CREATE TABLE platform.audit_log (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES platform.users (id) ON DELETE SET NULL,
    action        text NOT NULL,
    target_type   text,
    target_id     text,
    data          jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_actor_idx ON platform.audit_log (actor_user_id, created_at DESC);
CREATE INDEX audit_log_target_idx ON platform.audit_log (target_type, target_id, created_at DESC);

-- +goose Down
DROP SCHEMA platform CASCADE;
