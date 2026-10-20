-- ML-557: seeing how far a piece has come - each bar's Level now against where it started, with the practice
-- sessions and minutes it has taken - and a weekly plan on a practice list. Owner's answers, 20 Oct 2026.
--
-- 1. Where each bar started. A Level change doesn't record its bars, so cutting a piece into new focus sections
--    lost where its bars began. piece_level_starts keeps every bar's first Level for each member: saved when the
--    piece is first prepared, and a bar given its first Level later (another movement prepared afterwards) is
--    filled in then. levels[n] is bar n's (1-based, like the piece's own bar numbers); 0 = no Level yet. For a
--    piece prepared before this, the start is worked out once from the history that still lines up
--    (rebuilt = true) and "start not known" is shown where it doesn't.
CREATE TABLE IF NOT EXISTS piece_level_starts (
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    score_id BIGINT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    levels SMALLINT[] NOT NULL,
    rebuilt BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, score_id)
);

-- 2. Which bars a practice block was on. A block records its focus section (chunk_id), but that link goes when the
--    piece is cut again; the bars stay, so sessions and minutes can be counted bar by bar. Filled from the chunk
--    when a block is logged; the blocks logged so far get their chunk's bars where the chunk is still there.
ALTER TABLE session_segments ADD COLUMN IF NOT EXISTS start_bar INTEGER;
ALTER TABLE session_segments ADD COLUMN IF NOT EXISTS end_bar INTEGER;
UPDATE session_segments s SET start_bar = c.start_bar, end_bar = c.end_bar
  FROM piece_chunks c WHERE c.id = s.chunk_id AND s.start_bar IS NULL;
CREATE INDEX IF NOT EXISTS session_segments_score_bars ON session_segments (score_id, start_bar, end_bar) WHERE start_bar IS NOT NULL;

-- 3. A weekly plan on a practice list: sessions a week, minutes a session and the warm-up in it. Each member's own -
--    a band's list is shared, but how often someone practises is never shown to the band (product values) - so it
--    is kept per member, not on the list (the sessions_per_week / session_minutes columns ML-333 took off the screen
--    stay unused). set_at is when the plan was made: progress is counted from then. No row = no plan, and the list
--    works as it always has.
CREATE TABLE IF NOT EXISTS practice_list_plans (
    list_id BIGINT NOT NULL REFERENCES practice_lists(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    sessions_per_week SMALLINT CHECK (sessions_per_week BETWEEN 1 AND 14),
    session_minutes SMALLINT CHECK (session_minutes BETWEEN 10 AND 120 AND session_minutes % 5 = 0),
    warmup_minutes SMALLINT NOT NULL DEFAULT 0 CHECK (warmup_minutes BETWEEN 0 AND 30 AND warmup_minutes % 5 = 0),
    set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (list_id, account_id)
);
