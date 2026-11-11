-- +goose Up
-- CR-023: one contractor per shop name, ignoring case and repeated spaces, deactivated ones included
-- (BR-F24-6). Existing duplicates are not merged here: the migration stops and names them.
-- +goose StatementBegin
DO $$
DECLARE
    dup text;
BEGIN
    SELECT string_agg(name, ', ') INTO dup FROM (
        SELECT min(name) AS name FROM repair.contractors
        GROUP BY lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) HAVING count(*) > 1
    ) d;
    IF dup IS NOT NULL THEN
        RAISE EXCEPTION 'CR-023: duplicate contractor names, merge or rename them first: %', dup;
    END IF;
END $$;
-- +goose StatementEnd

UPDATE repair.contractors SET name = regexp_replace(btrim(name), '\s+', ' ', 'g')
WHERE name <> regexp_replace(btrim(name), '\s+', ' ', 'g');

DROP INDEX repair.contractors_name_idx;
CREATE UNIQUE INDEX contractors_name_key ON repair.contractors (lower(name));

-- +goose Down
DROP INDEX repair.contractors_name_key;
CREATE INDEX contractors_name_idx ON repair.contractors (lower(name));
