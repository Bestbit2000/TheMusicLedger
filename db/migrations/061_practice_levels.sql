-- ML-315 (epic ML-314): practice Levels 1-5 on a piece, bar by bar.
--
-- Each account sets up a piece as chunks with a Level: the whole piece ("All of it"), hard passages
-- on top of a whole-piece Level ("Most of it, but some bars are hard"), or separate chunks ("Not yet -
-- break it up"). The heat map's per-bar Level comes from these (FlowJourney.barLevels: where chunks
-- overlap, the narrowest wins). Per account, so bandmates keep their own Levels on a shared band piece.
-- Level null = not set yet (the forecast leaves it out rather than guessing).
--
-- Bars are the piece's own bar numbers (1-based, lead-in excluded) - the numbering Repeat bars uses.
-- There's no bar table, so bars_total_at_setup records the piece's length when the chunks were saved;
-- if the piece's blocks change later the app warns "bars changed - check your Levels".
CREATE TABLE IF NOT EXISTS piece_chunks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    score_id BIGINT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('whole', 'hard', 'chunk')),
    start_bar INTEGER NOT NULL CHECK (start_bar >= 1),
    end_bar INTEGER NOT NULL,
    level SMALLINT CHECK (level BETWEEN 1 AND 5),
    label TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    bars_total_at_setup INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_bar >= start_bar)
);
CREATE INDEX IF NOT EXISTS piece_chunks_account_score ON piece_chunks (account_id, score_id);

-- Every Level change: when a piece is set up or edited, a Level up during a block, or the rating after
-- it. Later this gives each account its own rate of progress for the readiness forecast (ML-319).
-- Kept when a chunk is deleted (chunk_id goes null), so the history isn't lost when a piece is re-chunked.
CREATE TABLE IF NOT EXISTS chunk_level_changes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chunk_id BIGINT REFERENCES piece_chunks(id) ON DELETE SET NULL,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    score_id BIGINT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    level_before SMALLINT CHECK (level_before BETWEEN 1 AND 5),
    level_after SMALLINT CHECK (level_after BETWEEN 1 AND 5),
    source TEXT NOT NULL CHECK (source IN ('setup', 'edit', 'during', 'rating')),
    percent_played SMALLINT CHECK (percent_played BETWEEN 1 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chunk_level_changes_account_score ON chunk_level_changes (account_id, score_id, created_at);

-- In a practice session sub-beats switch on by themselves when a bar's beat at its Level is below this
-- speed (the tools keep the player's own sub-beat setting). A setting because it varies by player.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS practice_sub_beats_below SMALLINT NOT NULL DEFAULT 100
    CHECK (practice_sub_beats_below BETWEEN 30 AND 200);

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('practice_levels', 'Practice Levels', 'Levels 1-5 on a piece, bar by bar (ML-314/ML-315): set up how well you can play a piece (all of it, hard passages, or chunks), a gold/silver heat map, and Rehearse''s practice-session mode where the Level sets the speed and sub-beats. Off until the screens are released.', false)
ON CONFLICT (feature_key) DO NOTHING;
