-- +goose Up
-- CR-008: the system sets the ticket priority from the picked symptoms (each symptom has a priority,
-- each category a default), and reporters can type "อื่นๆ" for the category and / or the symptom.

ALTER TABLE repair.categories
    ADD COLUMN default_priority text NOT NULL DEFAULT 'medium'
        CHECK (default_priority IN ('critical', 'high', 'medium', 'low'));

ALTER TABLE repair.symptoms
    ADD COLUMN priority text NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('critical', 'high', 'medium', 'low'));

ALTER TABLE repair.tickets
    ALTER COLUMN category_id DROP NOT NULL,
    -- typed category when the reporter picked "อื่นๆ" (then category_id is null)
    ADD COLUMN category_other text,
    -- typed symptom ("อาการอื่นๆ"), with or without listed symptoms
    ADD COLUMN symptom_other text,
    -- how the priority was set; 'reporter' marks tickets created before CR-008
    ADD COLUMN priority_source text NOT NULL DEFAULT 'reporter'
        CHECK (priority_source IN ('symptom', 'category', 'default', 'admin', 'reporter')),
    ADD CONSTRAINT tickets_category_or_other CHECK (category_id IS NOT NULL OR category_other IS NOT NULL);

-- "ที่เคยแจ้ง" (#28): the reporter's newest tickets
CREATE INDEX tickets_reporter_created_idx ON repair.tickets (reporter_id, created_at DESC);

-- +goose Down
DROP INDEX repair.tickets_reporter_created_idx;
ALTER TABLE repair.tickets
    DROP CONSTRAINT tickets_category_or_other,
    DROP COLUMN priority_source,
    DROP COLUMN symptom_other,
    DROP COLUMN category_other;
-- category_id becomes NOT NULL again only when no "อื่นๆ" ticket exists.
-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM repair.tickets WHERE category_id IS NULL) THEN
        ALTER TABLE repair.tickets ALTER COLUMN category_id SET NOT NULL;
    END IF;
END $$;
-- +goose StatementEnd
ALTER TABLE repair.symptoms DROP COLUMN priority;
ALTER TABLE repair.categories DROP COLUMN default_priority;
