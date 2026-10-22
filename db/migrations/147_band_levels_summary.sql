-- ML-581: the band leader's summary (docs/practice-sessions.md, "The band leader's summary"; product value 2).
-- The owner's decisions, 22 Oct 2026:
--  - is_band_leader: a permission an organiser gives one or more members - the band leader sees an anonymous summary
--    of the Levels players chose to share on the band's own pieces. Not every organiser.
--  - shares_levels: the player's own say-so, per band, off until they switch it on - "I'm happy to share my piece
--    levels anonymously at a summary level only to the band leader". shares_levels_on: the day they switched it on.
-- Both are on the membership row, so they go when the player leaves the band and with their account (deletion, and
-- the data export takes them with the row).
ALTER TABLE band_members
    ADD COLUMN is_band_leader BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN shares_levels BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN shares_levels_on DATE;

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('band_levels_summary', 'Band leader''s summary', 'A band''s band leader (a permission an organiser gives) sees, on the band''s own pieces, the average Level and the lowest to highest - for the piece and each bar - from the players who chose to share them, and only once 3 have. Never by name. Players switch it on per band on its Members page; it is off until they do (ML-581).', true)
ON CONFLICT (feature_key) DO NOTHING;
