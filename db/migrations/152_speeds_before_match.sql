-- ML-597: a piece's own speeds from before they were first matched to a recording's marked bars (ML-533), so they
-- can be put back - when that recording is taken off, or its start and end change (owner, 23 Oct 2026: offered,
-- never done on its own). { "recordingId": <score_recordings.id or null>, "blocks": [{ "id", "bpm", "ramps" }] } -
-- every bar block's speed and speed changes at the first match; NULL when the speeds have never been matched, or
-- have been put back. Written through the piece's own update, by whoever can change the piece.
ALTER TABLE scores ADD COLUMN speeds_before_match JSONB;
