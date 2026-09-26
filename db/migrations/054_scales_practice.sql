-- ML-9: the Scales practice tool. No tables yet - a scale's settings and "My scales" live on the
-- device (localStorage 'tml.scales', like Theory's options). Practice sessions built from scales
-- (the next step on ML-9) will add them. This seeds the feature row that shows the home tile and the
-- ☰ menu entry (Admin -> Features turns it off per environment).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('scales_practice', 'Scales practice', 'Home screen Scales tool (ML-9): any scale or arpeggio written on the stave (Bravura), 1-3 octaves, up/down, with a metronome that lights the note to play; "My scales" and Next scale pick from the keys you can play.', true)
ON CONFLICT (feature_key) DO NOTHING;
