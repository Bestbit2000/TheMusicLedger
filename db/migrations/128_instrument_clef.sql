-- ML-528: the clef a player reads their instrument in is chosen once per person, not per tool per device
-- (the owner, 12 Oct 2026).
--
-- The app reads each instrument in one clef (instruments.theory_clef - brass band treble where there is
-- one), and written_to_concert, range_low / range_high and a player's own bottom_note / top_note are all
-- written pitches in that clef. Some brass is read two ways: a euphonium, baritone, tenor trombone or tuba
-- is a transposing treble-clef part in a brass band and a concert-pitch bass-clef part in a wind band.
--
--   instruments.other_clefs     the other clefs the instrument is read in, each with its own transposition
--                               (concert = written + writtenToConcert): [{"clef":"bass","writtenToConcert":0}]
--   account_instruments.clef    the one this player reads. NULL = the instrument's own (theory_clef).
--
-- Nothing stored moves: ranges, Levels and goes stay written in the instrument's own clef, and the server
-- shifts them into the player's clef on the way out and back on the way in (server/services/instrumentClef.js).

ALTER TABLE instruments ADD COLUMN IF NOT EXISTS other_clefs JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE account_instruments ADD COLUMN IF NOT EXISTS clef TEXT CHECK (clef IN ('treble', 'bass', 'alto', 'tenor'));

UPDATE instruments SET other_clefs = '[{"clef":"bass","writtenToConcert":0}]'::jsonb
 WHERE code IN ('bb_baritone_horn', 'bb_euphonium', 'valve_trombone', 'eb_tuba', 'bb_tuba');
UPDATE instruments SET other_clefs = '[{"clef":"bass","writtenToConcert":0},{"clef":"tenor","writtenToConcert":0}]'::jsonb
 WHERE code = 'tenor_trombone';
