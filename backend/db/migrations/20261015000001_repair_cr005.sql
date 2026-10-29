-- +goose Up
-- CR-005: one in-house technician, no queue. Tickets start `in_progress` and wait for the
-- technician's assessment (expected finish date). The technician records who did the work
-- (in house / contractor) when resolving and rates the contractor.

CREATE TABLE repair.contractor_types (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    created_by_id uuid REFERENCES platform.users (id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contractor_types_name_idx ON repair.contractor_types (lower(name));

-- External contractors, entered and rated by the in-house technician (F24). Never deleted: deactivate.
CREATE TABLE repair.contractors (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    contact_name  text,
    phone         text,
    note          text,
    is_active     boolean NOT NULL DEFAULT true,
    created_by_id uuid REFERENCES platform.users (id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contractors_name_idx ON repair.contractors (lower(name));

CREATE TABLE repair.contractor_type_links (
    contractor_id uuid NOT NULL REFERENCES repair.contractors (id) ON DELETE CASCADE,
    type_id       uuid NOT NULL REFERENCES repair.contractor_types (id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (contractor_id, type_id)
);
CREATE INDEX contractor_type_links_type_idx ON repair.contractor_type_links (type_id);

-- No queue any more: every open ticket goes straight to the technician.
DROP INDEX repair.tickets_queue_idx;
DROP INDEX repair.tickets_reserved_for_idx;
UPDATE repair.tickets SET status = 'in_progress' WHERE status = 'new';
ALTER TABLE repair.tickets DROP CONSTRAINT tickets_status_check;
ALTER TABLE repair.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('in_progress', 'resolved', 'closed'));
ALTER TABLE repair.tickets
    DROP COLUMN queue_rank,
    DROP COLUMN manually_ordered,
    DROP COLUMN reserved_for_id,
    DROP COLUMN claimed_at;

ALTER TABLE repair.tickets
    -- assessment (BR-F21-2): NULL = waiting for the technician
    ADD COLUMN expected_done_on date,
    ADD COLUMN assessed_at timestamptz,
    -- who did the work, recorded on resolve (BR-F21-4)
    ADD COLUMN work_by text CHECK (work_by IN ('in_house', 'contractor')),
    ADD COLUMN contractor_id uuid REFERENCES repair.contractors (id),
    ADD COLUMN contractor_rating smallint CHECK (contractor_rating BETWEEN 1 AND 5),
    ADD COLUMN contractor_rating_comment text,
    ADD CONSTRAINT tickets_contractor_check CHECK ((work_by = 'contractor') = (contractor_id IS NOT NULL));
CREATE INDEX tickets_open_order_idx ON repair.tickets (status, priority, created_at);
CREATE INDEX tickets_contractor_idx ON repair.tickets (contractor_id, resolved_at DESC) WHERE contractor_id IS NOT NULL;

ALTER TABLE repair.ticket_events DROP CONSTRAINT ticket_events_type_check;
ALTER TABLE repair.ticket_events ADD CONSTRAINT ticket_events_type_check CHECK (type IN (
    'created', 'subscribed', 'assessed', 'assessment_changed', 'resolved', 'sent_back', 'confirmed',
    'auto_closed', 'team_handled', 'handed_over', 'admin_closed', 'priority_changed'));

-- +goose Down
ALTER TABLE repair.ticket_events DROP CONSTRAINT ticket_events_type_check;
DELETE FROM repair.ticket_events WHERE type IN ('assessed', 'assessment_changed');
ALTER TABLE repair.ticket_events ADD CONSTRAINT ticket_events_type_check CHECK (type IN (
    'created', 'subscribed', 'claimed', 'given_back', 'resolved', 'sent_back', 'started', 'confirmed',
    'auto_closed', 'team_handled', 'handed_over', 'admin_closed', 'priority_changed', 'queue_moved'));

DROP INDEX repair.tickets_contractor_idx;
DROP INDEX repair.tickets_open_order_idx;
ALTER TABLE repair.tickets
    DROP CONSTRAINT tickets_contractor_check,
    DROP COLUMN contractor_rating_comment,
    DROP COLUMN contractor_rating,
    DROP COLUMN contractor_id,
    DROP COLUMN work_by,
    DROP COLUMN assessed_at,
    DROP COLUMN expected_done_on;
ALTER TABLE repair.tickets
    ADD COLUMN queue_rank bigint,
    ADD COLUMN manually_ordered boolean NOT NULL DEFAULT false,
    ADD COLUMN reserved_for_id uuid REFERENCES platform.users (id),
    ADD COLUMN claimed_at timestamptz;
ALTER TABLE repair.tickets DROP CONSTRAINT tickets_status_check;
ALTER TABLE repair.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('new', 'in_progress', 'resolved', 'closed'));
CREATE INDEX tickets_queue_idx ON repair.tickets (category_id, status, queue_rank);
CREATE INDEX tickets_reserved_for_idx ON repair.tickets (reserved_for_id) WHERE reserved_for_id IS NOT NULL;

DROP TABLE repair.contractor_type_links;
DROP TABLE repair.contractors;
DROP TABLE repair.contractor_types;
