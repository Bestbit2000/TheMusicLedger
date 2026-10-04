-- ML-424: Quick piece entry - a piece entered as an outline (bars, rehearsal marks, the exceptions, the
-- extras) that the app turns into the same blocks the bar-by-bar editor makes. Nothing about how a piece
-- is stored changes; this adds the feature switch and widens the ML-199 stopwatch so the two ways of
-- entering a piece can be compared, and so the next thing to speed up can be seen rather than guessed.

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('piece_quick_entry', 'Quick piece entry', 'Add a piece by its outline: how many bars, where the rehearsal marks are, which bars have a different time signature or speed, then repeats and the other extras - all by the bar numbers on the music. Makes the same blocks as "Create your own".', true)
ON CONFLICT (feature_key) DO NOTHING;

-- creation_source learns 'quick'. 'manual' stays the bar-by-bar editor, so every figure already
-- recorded keeps its meaning and "manual vs quick" is one GROUP BY.
ALTER TABLE flow_authoring_sessions DROP CONSTRAINT IF EXISTS flow_authoring_sessions_creation_source_check;
ALTER TABLE flow_authoring_sessions ADD CONSTRAINT flow_authoring_sessions_creation_source_check
    CHECK (creation_source IN ('manual', 'from_file', 'quick'));

-- How much work it was, not just how long: taps (pointer presses) and keys (key presses) while the
-- session was live - counted for both ways of entering a piece. 0 on rows recorded before this.
ALTER TABLE flow_authoring_sessions ADD COLUMN IF NOT EXISTS tap_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE flow_authoring_sessions ADD COLUMN IF NOT EXISTS key_count INTEGER NOT NULL DEFAULT 0;

-- Quick entry only: where the time went, step by step -
--   [{ "step": "howLong"|"marks"|"time"|"speed"|"extras", "seconds": n, "taps": n, "keys": n, "visits": n }]
-- (visits over 1 = went back to it). NULL for the bar-by-bar editor, which has no steps. Also what the
-- piece held, so times can be compared like for like: { "marks": n, "exceptions": n, "speeds": n, "extras": n }.
ALTER TABLE flow_authoring_sessions ADD COLUMN IF NOT EXISTS steps JSONB;
ALTER TABLE flow_authoring_sessions ADD COLUMN IF NOT EXISTS outline_counts JSONB;
