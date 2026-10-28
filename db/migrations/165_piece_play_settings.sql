-- ML-627: what each member chose to see and hear on a piece's play screen, remembered per piece so it opens where
-- they left it - on any device. One row per member per piece, written when they change something in the play
-- screen's "What to see and hear" pop-up. settings is { see, hear, along, recordingId }: see the metronome, hear its
-- clicks, play along to a recording, and which one (a score_recordings id, or null). No row means the defaults: the
-- metronome seen and heard, and the piece's first YouTube video playing along when it has one. Private to the
-- member - nobody else ever reads it. Deleted with the account (account deletion deletes rows in every table that
-- points at accounts) and with the piece. docs/rehearsal-score.md, "Playing along".
CREATE TABLE piece_play_settings (
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    score_id BIGINT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    settings JSONB NOT NULL CHECK (jsonb_typeof(settings) = 'object' AND pg_column_size(settings) <= 500),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, score_id)
);
CREATE INDEX piece_play_settings_score_idx ON piece_play_settings (score_id);
