-- ML-529: a piece in movements. A suite is one piece whose bar numbers carry on from movement to movement,
-- while its rehearsal letters start again at A in each. A movement starts at a block: movement_start marks
-- the block its first bar is in (the first block always starts the first movement), and movement_title is
-- its name (on the first block, the first movement's name). Each movement has its own repeats, D.C., D.S.,
-- Coda and Fine, and the next movement follows straight on (public/flowJourney.js). A piece with no
-- movement starts is one movement, as every piece was before.

ALTER TABLE metronome_segments ADD COLUMN IF NOT EXISTS movement_start BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE metronome_segments ADD COLUMN IF NOT EXISTS movement_title TEXT;

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('piece_movements', 'A piece in movements', 'A piece can be in movements (ML-529): Quick entry and the edit screen say where each movement starts and what it is called, and a photo or PDF of a suite is read in as one piece with its movements rather than one piece a movement. Each movement has its own repeats and jumps, and they play straight on. A piece that already has movements plays and shows them whoever opens it.', true)
ON CONFLICT (feature_key) DO NOTHING;
