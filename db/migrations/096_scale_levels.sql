-- ML-391: Scales Levels. A practice session's Scales block gives three scales, each at its own Level 1-5
-- (the notes slowly, the notes faster, just the key, just the name, just the name at full speed), and the
-- player says Got it or Not yet for each. Got it at Level 5 makes a scale learnt; a learnt one comes back
-- about every two weeks. The rules are PracticePlan.scale* (public/practicePlan.js); this is the record.
--
-- One row per account, instrument and scale. Per instrument (owner, 4 Oct 2026): a baritone's Levels and
-- a euphonium's are separate, because their lists and clefs can differ. scale_key is PracticePlan.scaleKey:
-- "kind|key|form|octaves|pattern" - the same scale asked for by two grades is one row.
-- A scale with no row is at Level 1 and has never been played.
CREATE TABLE IF NOT EXISTS scale_levels (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    instrument_id BIGINT NOT NULL REFERENCES instruments(id),
    scale_key TEXT NOT NULL,
    level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
    learnt_at TIMESTAMPTZ,            -- Got it at Level 5; null again if it's put back to Level 4
    last_played_at TIMESTAMPTZ,       -- the last answer, either way - "played longest ago" goes by it
    last_up_on DATE,                  -- the player's own day it last went up: one Level a day at most
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, instrument_id, scale_key)
);

-- Every answer, and every Level set by hand (got_it null), so Stats can use them later.
CREATE TABLE IF NOT EXISTS scale_level_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    instrument_id BIGINT NOT NULL REFERENCES instruments(id),
    scale_key TEXT NOT NULL,
    level SMALLINT NOT NULL,          -- the Level it was played at
    got_it BOOLEAN,                   -- null = set by hand
    outcome TEXT NOT NULL,            -- up / learnt / held / kept / back / stay / set
    level_after SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scale_level_results_account ON scale_level_results (account_id, created_at);

-- Its own switch (owner: part of SmartLearn, but it can be off even when SmartLearn is on - and it doesn't
-- need SmartLearn on). Live, with no account type ticked: Super admin only until it's switched on for the
-- others on Admin -> Feature access, as every new feature is (ML-345). Off, a Scales block opens the
-- Scales tool as before.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('scales_levels', 'Scales Levels (SmartLearn)', 'A practice session''s Scales block gives three scales, each at its own Level 1-5 (the notes slowly, faster, just the key, just the name, the name at full speed), with Got it / Not yet (ML-391). The Scales tool shows each scale''s Level. Needs Practice sessions. Off: a Scales block just opens the Scales tool.', true)
ON CONFLICT (feature_key) DO NOTHING;
