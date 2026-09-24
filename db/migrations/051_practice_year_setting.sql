-- ML-234: a per-account "practice year" for the stats time-period list ("This practise year" /
-- "Last practise year"). It used to be hard-coded to start on 1 November for everyone, which only
-- ever suited the app owner. Now it's off unless an account turns it on in Settings, with its own
-- start day and month.

ALTER TABLE accounts
    ADD COLUMN practice_year_enabled BOOLEAN NOT NULL DEFAULT false,
    -- Suggested start when someone first turns it on: 1 September (the usual band/school year).
    ADD COLUMN practice_year_start_month SMALLINT NOT NULL DEFAULT 9
        CHECK (practice_year_start_month BETWEEN 1 AND 12),
    ADD COLUMN practice_year_start_day SMALLINT NOT NULL DEFAULT 1
        CHECK (practice_year_start_day BETWEEN 1 AND 31);

-- The owner keeps the practice year exactly as it was (on, starting 1 November).
UPDATE accounts
SET practice_year_enabled = true, practice_year_start_month = 11, practice_year_start_day = 1
WHERE email = 'andrew.jr.storey@gmail.com';
