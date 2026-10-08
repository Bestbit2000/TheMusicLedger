-- ML-489 (the rehearsal score, step B): the Recordings tool. A band's rehearsal is recorded on a
-- phone's own recorder and the whole file uploaded here; it is then "given" to pieces - each piece
-- gets a cut of it (a start and an end, ML-312) and the file is stored once. See docs/rehearsal-score.md.
--
-- rehearsal_recordings is the uncut file: who uploaded it, its name, the day it was recorded if they
-- say, and the stored file. It is the member's own (account_id): deleted with the account and listed
-- in "Download my information" - both find it from the database (docs/account-deletion.md).
CREATE TABLE rehearsal_recordings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    recorded_on DATE,
    blob_url TEXT NOT NULL UNIQUE,
    blob_pathname TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rehearsal_recordings_account ON rehearsal_recordings (account_id, created_at DESC);

-- A cut is an ordinary recording on a piece that points at the same stored file, and remembers which
-- upload it came from. SET NULL, not CASCADE: when a member's account is deleted, a cut an organiser
-- put on a BAND's piece stays with the band (as a band piece does), and the file stays with it.
-- Deleting a recording in the tool removes its cuts in code first (rehearsalRecordings.js).
ALTER TABLE score_recordings
    ADD COLUMN rehearsal_recording_id BIGINT REFERENCES rehearsal_recordings(id) ON DELETE SET NULL;
CREATE INDEX idx_score_recordings_rehearsal ON score_recordings (rehearsal_recording_id) WHERE rehearsal_recording_id IS NOT NULL;

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('rehearsal_recordings', 'Recordings tool', 'A tool for whole rehearsal recordings: upload one made on a phone''s own recorder (bigger than a recording put straight on a piece may be), then give it to pieces, each with where it starts and ends in the file. Only a band''s organiser can give one to a band''s piece.', true)
ON CONFLICT (feature_key) DO NOTHING;

-- How many recordings an account may keep in the tool (Admin -> Feature access, Limits). The owner,
-- 7 October 2026: low for Standard - the app has to be usable for free, even if it is a bit of a pain;
-- a band organiser has enough for one concert at a time, about 20, and deletes them once it is played.
-- Only a member's own uploads count; using a recording a band provides counts for nothing.
-- 5 for Standard and 20 for the rest to start (the owner, 8 October 2026).
INSERT INTO feature_limits (limit_key, feature_id, name, description)
SELECT 'rehearsal_recordings_max', f.id, 'Recordings kept', 'How many rehearsal recordings one person can keep in the Recordings tool at a time. Only their own uploads count.'
  FROM features f WHERE f.feature_key = 'rehearsal_recordings'
ON CONFLICT (limit_key) DO NOTHING;

INSERT INTO feature_limit_values (limit_id, account_level, value)
SELECT l.id, t.level, t.value
  FROM feature_limits l
 CROSS JOIN (VALUES ('standard_member', 5), ('premium_member', 20), ('beta_tester', 20), ('teacher', 20), ('band_admin', 20), ('super_admin', 20)) AS t(level, value)
 WHERE l.limit_key = 'rehearsal_recordings_max'
ON CONFLICT (limit_id, account_level) DO NOTHING;
