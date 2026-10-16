-- +goose Up
CREATE SCHEMA IF NOT EXISTS repair;

-- Display name + department of platform users, used by every repair query that
-- shows a person (PersonRef). Same fallback as users.User.DisplayName:
-- Thai full name → English full name → employee code.
CREATE VIEW repair.people AS
SELECT
    u.id,
    COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', NULLIF(TRIM(u.first_name_th), ''), NULLIF(TRIM(u.last_name_th), ''))), ''),
        NULLIF(TRIM(CONCAT_WS(' ', NULLIF(TRIM(u.first_name_en), ''), NULLIF(TRIM(u.last_name_en), ''))), ''),
        u.employee_code
    )::text AS name,
    u.department
FROM platform.users u;

-- Master data (phase 1: seed files; dev/UAT: sample data from ui/screens/_common.md §8).
CREATE TABLE repair.categories (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    -- lucide icon name; the FE falls back to `wrench`
    icon       text NOT NULL DEFAULT 'wrench',
    sort_order integer NOT NULL DEFAULT 0,
    is_active  boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE repair.symptoms (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES repair.categories (id),
    name        text NOT NULL,
    sort_order  integer NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX symptoms_category_idx ON repair.symptoms (category_id, sort_order);

CREATE TABLE repair.buildings (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active  boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE repair.floors (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id uuid NOT NULL REFERENCES repair.buildings (id),
    -- display name ("5"); the FE renders "{building} ชั้น {floor}"
    name        text NOT NULL,
    -- vertical order, bottom first (S12 builds the model from it)
    level       integer NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (building_id, level)
);

-- Module settings, exactly one row (BR-F02-5: ticket number format editable without code).
CREATE TABLE repair.settings (
    id                 boolean PRIMARY KEY DEFAULT true CHECK (id),
    ticket_prefix      text NOT NULL,
    -- 'be' = Buddhist year (2569), 'ce' = Gregorian year (2026)
    ticket_year_format text NOT NULL CHECK (ticket_year_format IN ('be', 'ce')),
    ticket_digits      integer NOT NULL CHECK (ticket_digits BETWEEN 1 AND 12),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
INSERT INTO repair.settings (ticket_prefix, ticket_year_format, ticket_digits) VALUES ('RP', 'be', 6);

-- Running number per year (Gregorian year in Asia/Bangkok), restarts every year (BR-F02-4).
CREATE TABLE repair.ticket_counters (
    year       integer PRIMARY KEY,
    last_no    bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uploaded photo files (D-022). Unattached rows older than 24 h are purged with their files.
CREATE TABLE repair.photos (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id  uuid NOT NULL REFERENCES platform.users (id),
    content_type text NOT NULL,
    size_bytes   bigint NOT NULL,
    storage_key  text NOT NULL,
    -- equals storage_key when no thumbnail could be made (e.g. HEIC)
    thumb_key    text NOT NULL,
    thumb_content_type text NOT NULL,
    attached_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photos_unattached_idx ON repair.photos (created_at) WHERE attached_at IS NULL;

CREATE TABLE repair.tickets (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_no        text NOT NULL UNIQUE,
    status           text NOT NULL CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    closed_reason    text CHECK (closed_reason IN ('confirmed', 'auto_closed', 'team_handled', 'admin_closed')),
    priority         text NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    category_id      uuid NOT NULL REFERENCES repair.categories (id),
    building_id      uuid NOT NULL REFERENCES repair.buildings (id),
    floor_id         uuid NOT NULL REFERENCES repair.floors (id),
    location_detail  text,
    details          text,
    asset_code       text,
    reporter_id      uuid NOT NULL REFERENCES platform.users (id),
    -- technician holding the job (in_progress) or who resolved it
    holder_id        uuid REFERENCES platform.users (id),
    -- sent-back job reserved for the same technician (CR-001, Stage 3)
    reserved_for_id  uuid REFERENCES platform.users (id),
    -- order inside the category queue while status = 'new' (gap-based, BR-F22-2)
    queue_rank       bigint,
    manually_ordered boolean NOT NULL DEFAULT false,
    result_note      text,
    resolved_by_id   uuid REFERENCES platform.users (id),
    rating           smallint CHECK (rating BETWEEN 1 AND 5),
    rating_comment   text,
    send_back_count  integer NOT NULL DEFAULT 0,
    auto_close_at    timestamptz,
    claimed_at       timestamptz,
    resolved_at      timestamptz,
    closed_at        timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CHECK ((status = 'closed') = (closed_reason IS NOT NULL))
);
CREATE INDEX tickets_reporter_idx ON repair.tickets (reporter_id, updated_at DESC);
CREATE INDEX tickets_status_idx ON repair.tickets (status, updated_at DESC);
CREATE INDEX tickets_queue_idx ON repair.tickets (category_id, status, queue_rank);
CREATE INDEX tickets_floor_idx ON repair.tickets (floor_id, status);
CREATE INDEX tickets_building_idx ON repair.tickets (building_id);
CREATE INDEX tickets_created_at_idx ON repair.tickets (created_at DESC);
CREATE INDEX tickets_closed_at_idx ON repair.tickets (closed_at DESC) WHERE status = 'closed';
CREATE INDEX tickets_holder_idx ON repair.tickets (holder_id) WHERE holder_id IS NOT NULL;
CREATE INDEX tickets_reserved_for_idx ON repair.tickets (reserved_for_id) WHERE reserved_for_id IS NOT NULL;

CREATE TABLE repair.ticket_symptoms (
    ticket_id  uuid NOT NULL REFERENCES repair.tickets (id) ON DELETE CASCADE,
    symptom_id uuid NOT NULL REFERENCES repair.symptoms (id),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ticket_id, symptom_id)
);
CREATE INDEX ticket_symptoms_symptom_idx ON repair.ticket_symptoms (symptom_id);

-- Timeline (BR-F06-3). `data` holds type-specific fields (rating, from/to, reservedFor …).
CREATE TABLE repair.ticket_events (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id  uuid NOT NULL REFERENCES repair.tickets (id) ON DELETE CASCADE,
    type       text NOT NULL CHECK (type IN ('created', 'subscribed', 'claimed', 'given_back', 'resolved', 'sent_back',
                                             'started', 'confirmed', 'auto_closed', 'team_handled', 'handed_over',
                                             'admin_closed', 'priority_changed', 'queue_moved')),
    actor_id   uuid REFERENCES platform.users (id),
    note       text,
    data       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_events_ticket_idx ON repair.ticket_events (ticket_id, created_at DESC);

-- A photo belongs to at most one ticket. event_id links follow / send-back / team photos to their timeline event.
CREATE TABLE repair.ticket_photos (
    photo_id   uuid PRIMARY KEY REFERENCES repair.photos (id) ON DELETE CASCADE,
    ticket_id  uuid NOT NULL REFERENCES repair.tickets (id) ON DELETE CASCADE,
    kind       text NOT NULL CHECK (kind IN ('report', 'result', 'send_back', 'follow', 'team')),
    event_id   uuid REFERENCES repair.ticket_events (id) ON DELETE CASCADE,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_photos_ticket_idx ON repair.ticket_photos (ticket_id, kind, sort_order);
CREATE INDEX ticket_photos_event_idx ON repair.ticket_photos (event_id) WHERE event_id IS NOT NULL;

-- People following a ticket (F03, Stage 5). The reporter is not a subscriber.
CREATE TABLE repair.ticket_subscribers (
    ticket_id  uuid NOT NULL REFERENCES repair.tickets (id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES platform.users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ticket_id, user_id)
);
CREATE INDEX ticket_subscribers_user_idx ON repair.ticket_subscribers (user_id, ticket_id);

-- +goose Down
DROP SCHEMA repair CASCADE;
