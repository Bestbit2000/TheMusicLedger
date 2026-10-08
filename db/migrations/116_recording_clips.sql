-- ML-312 (the rehearsal score, step A): where a recording or a YouTube video starts and ends on a
-- piece. A recording of a band has talk before the piece and after it; a rehearsal file may hold
-- several pieces. The sound file is never changed - a "cut" is these two numbers kept beside it,
-- so it can always be corrected, one file can serve several pieces (step B, ML-489), and a YouTube
-- video, where there is no file at all, is cut the same way. See docs/rehearsal-score.md.
--
--   clip_start_ms  where playing starts, in milliseconds from the start (NULL = from the start)
--   clip_end_ms    where playing stops (NULL = to the end)
ALTER TABLE score_recordings
    ADD COLUMN clip_start_ms INTEGER CHECK (clip_start_ms IS NULL OR clip_start_ms >= 0),
    ADD COLUMN clip_end_ms INTEGER CHECK (clip_end_ms IS NULL OR clip_end_ms > 0),
    ADD CONSTRAINT score_recordings_clip_order CHECK (clip_start_ms IS NULL OR clip_end_ms IS NULL OR clip_end_ms > clip_start_ms);

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('recording_clip', 'Recordings: set start and end', 'On a piece''s Media tab, a recording or a YouTube video can be given a start and an end, so playing it starts at the piece and stops when it is over. The file itself is never changed.', true)
ON CONFLICT (feature_key) DO NOTHING;
