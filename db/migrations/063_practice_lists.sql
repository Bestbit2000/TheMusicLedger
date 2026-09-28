-- ML-319 (epic ML-314): practice lists for a concert, the readiness forecast, and join-up groups.
--
-- practice_lists (004, unused until now) gets the concert date and how you plan to practise for it:
-- sessions a week and a session's length. The forecast itself is worked out in the browser
-- (PracticePlan.forecast, public/practicePlan.js) from the list's pieces and their chunks.
ALTER TABLE practice_lists ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE practice_lists ADD COLUMN IF NOT EXISTS sessions_per_week SMALLINT NOT NULL DEFAULT 3
    CHECK (sessions_per_week BETWEEN 1 AND 14);
ALTER TABLE practice_lists ADD COLUMN IF NOT EXISTS session_minutes SMALLINT NOT NULL DEFAULT 45
    CHECK (session_minutes BETWEEN 5 AND 120);
CREATE INDEX IF NOT EXISTS practice_lists_owner_account ON practice_lists (owner_account_id) WHERE owner_account_id IS NOT NULL;

-- Join-up groups are chunks too: kind 'group' covers several neighbouring chunks and is played through
-- once they're all at Level 4 (off unless a piece has one). Groups may overlap each other (a group of
-- groups); the heat map still shows each bar's narrowest chunk.
ALTER TABLE piece_chunks DROP CONSTRAINT IF EXISTS piece_chunks_kind_check;
ALTER TABLE piece_chunks ADD CONSTRAINT piece_chunks_kind_check CHECK (kind IN ('whole', 'hard', 'chunk', 'group'));
