-- ML-328: the Metronome's "Save to flow" (turn the bars into a piece) gets its own feature, so it can be
-- limited by who you are later (a student who shouldn't add pieces, say). On for everyone for now -
-- no change from before.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('metronome_save_to_flow', 'Metronome: Save to flow', 'The Metronome''s "Save to flow" link (ML-328): saves the bars as a new piece in My music. Off = the link is hidden. App-wide for now; per-person limits come later.', true)
ON CONFLICT (feature_key) DO NOTHING;
