-- +goose Up
-- CR-006: who does the work (in house / contractor) is decided when the technician assesses the
-- ticket, no longer when resolving it. Assessments made before this change have no `work_by`;
-- send those back to "waiting for assessment" so the technician fills it in.
UPDATE repair.tickets
SET expected_done_on = NULL, assessed_at = NULL, updated_at = now()
WHERE status = 'in_progress' AND work_by IS NULL AND expected_done_on IS NOT NULL;

-- +goose Down
-- data fix only, nothing to undo
SELECT 1;
