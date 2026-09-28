-- ML-322 / ML-305: your playing range, and the Range tool that stretches it.
--
-- instruments: each instrument's transposition as a number (concert = written + written_to_concert
-- semitones, in the clef the app reads it in - brass band treble where there is one) and its typical
-- written range (range_low / range_high, generous - pedal notes included for brass). The range is only
-- the OUTER LIMIT for the range picker and the Range tool, never a player's starting point. NULL range
-- = holding a note doesn't apply (keyboards, harp, percussion). Generated from
-- band_instruments_master_catalog.json by scripts/generate-instrument-ranges-migration.mjs.
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS written_to_concert SMALLINT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS range_low TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS range_high TEXT;

-- The notes YOU can play comfortably now on this instrument (written pitch, e.g. 'F#3'). NULL = not set.
ALTER TABLE account_instruments ADD COLUMN IF NOT EXISTS bottom_note TEXT;
ALTER TABLE account_instruments ADD COLUMN IF NOT EXISTS top_note TEXT;

-- A Level (1-5) for each note beyond your comfortable range: 1 sounded, 2 held 2 beats, 3 held 4,
-- 4 held 6, 5 held 8 beats three goes in a row (streak counts the 8-beat goes in a row). note_midi is
-- the written note as a MIDI number (60 = middle C); note is how it was spelled on screen.
CREATE TABLE IF NOT EXISTS range_note_levels (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    instrument_id BIGINT NOT NULL REFERENCES instruments(id),
    note_midi SMALLINT NOT NULL,
    note TEXT NOT NULL,
    level SMALLINT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
    best_beats NUMERIC(5,2) NOT NULL DEFAULT 0,
    streak SMALLINT NOT NULL DEFAULT 0,
    goes INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, instrument_id, note_midi)
);

-- Every go: the note tried, how many beats it was held, and whether the tuner measured it ('mic') or
-- the player said so themselves ('self': Held it = 8 beats, Not yet = 0).
CREATE TABLE IF NOT EXISTS range_goes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    instrument_id BIGINT NOT NULL REFERENCES instruments(id),
    direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
    note_midi SMALLINT NOT NULL,
    beats NUMERIC(5,2) NOT NULL CHECK (beats >= 0),
    bpm SMALLINT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('mic', 'self')),
    level_after SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS range_goes_account ON range_goes (account_id, created_at DESC);

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('range_trainer', 'Range', 'Your playing range per instrument (My account -> Your instruments: the notes you can play comfortably, set on a stave or measured with the tuner) and the home Range tool (ML-305/322): play up to your top note (or down to your bottom one), then hold the next note - a Level per note beyond, and at Level 5 it asks to move your range. Also a Skills list entry.', false)
ON CONFLICT (feature_key) DO NOTHING;

-- Transposition and typical written range per instrument (generated).
UPDATE instruments SET written_to_concert = 12, range_low = 'D4', range_high = 'C7' WHERE code = 'piccolo_c';
UPDATE instruments SET written_to_concert = 13, range_low = 'D4', range_high = 'A6' WHERE code = 'piccolo_db';
UPDATE instruments SET written_to_concert = 0, range_low = 'C4', range_high = 'C7' WHERE code = 'concert_flute';
UPDATE instruments SET written_to_concert = -5, range_low = 'C4', range_high = 'C7' WHERE code = 'alto_flute';
UPDATE instruments SET written_to_concert = -12, range_low = 'C4', range_high = 'C7' WHERE code = 'bass_flute';
UPDATE instruments SET written_to_concert = 0, range_low = 'Bb3', range_high = 'A6' WHERE code = 'oboe';
UPDATE instruments SET written_to_concert = -7, range_low = 'B3', range_high = 'G6' WHERE code = 'english_horn';
UPDATE instruments SET written_to_concert = -3, range_low = 'B3', range_high = 'G6' WHERE code = 'oboe_d_amore';
UPDATE instruments SET written_to_concert = 0, range_low = 'Bb1', range_high = 'E5' WHERE code = 'bassoon';
UPDATE instruments SET written_to_concert = -12, range_low = 'Bb1', range_high = 'F4' WHERE code = 'contrabassoon';
UPDATE instruments SET written_to_concert = -12, range_low = 'A3', range_high = 'G6' WHERE code = 'heckelphone';
UPDATE instruments SET written_to_concert = 10, range_low = 'E3', range_high = 'C6' WHERE code = 'ab_piccolo_clarinet';
UPDATE instruments SET written_to_concert = 3, range_low = 'E3', range_high = 'G6' WHERE code = 'eb_clarinet';
UPDATE instruments SET written_to_concert = 2, range_low = 'E3', range_high = 'G6' WHERE code = 'd_clarinet';
UPDATE instruments SET written_to_concert = -2, range_low = 'E3', range_high = 'C7' WHERE code = 'bb_soprano_clarinet';
UPDATE instruments SET written_to_concert = -3, range_low = 'E3', range_high = 'C7' WHERE code = 'a_soprano_clarinet';
UPDATE instruments SET written_to_concert = -7, range_low = 'C3', range_high = 'G6' WHERE code = 'basset_horn';
UPDATE instruments SET written_to_concert = -9, range_low = 'Eb3', range_high = 'G6' WHERE code = 'eb_alto_clarinet';
UPDATE instruments SET written_to_concert = -14, range_low = 'Eb3', range_high = 'G6' WHERE code = 'bb_bass_clarinet';
UPDATE instruments SET written_to_concert = -21, range_low = 'Eb3', range_high = 'E6' WHERE code = 'eb_contra_alto_clarinet';
UPDATE instruments SET written_to_concert = -26, range_low = 'Eb3', range_high = 'E6' WHERE code = 'bb_contrabass_clarinet';
UPDATE instruments SET written_to_concert = 14, range_low = 'Bb3', range_high = 'E6' WHERE code = 'soprillo_saxophone';
UPDATE instruments SET written_to_concert = 3, range_low = 'Bb3', range_high = 'F#6' WHERE code = 'sopranino_saxophone';
UPDATE instruments SET written_to_concert = -2, range_low = 'Bb3', range_high = 'F#6' WHERE code = 'bb_soprano_saxophone';
UPDATE instruments SET written_to_concert = -9, range_low = 'Bb3', range_high = 'F#6' WHERE code = 'eb_alto_saxophone';
UPDATE instruments SET written_to_concert = -14, range_low = 'Bb3', range_high = 'F#6' WHERE code = 'bb_tenor_saxophone';
UPDATE instruments SET written_to_concert = -21, range_low = 'Bb3', range_high = 'F#6' WHERE code = 'eb_baritone_saxophone';
UPDATE instruments SET written_to_concert = -26, range_low = 'Bb3', range_high = 'F#6' WHERE code = 'bb_bass_saxophone';
UPDATE instruments SET written_to_concert = -33, range_low = 'Bb3', range_high = 'F#6' WHERE code = 'eb_contrabass_saxophone';
UPDATE instruments SET written_to_concert = 3, range_low = 'C3', range_high = 'E6' WHERE code = 'eb_soprano_cornet';
UPDATE instruments SET written_to_concert = -2, range_low = 'C3', range_high = 'F6' WHERE code = 'bb_cornet';
UPDATE instruments SET written_to_concert = -2, range_low = 'C3', range_high = 'F6' WHERE code = 'bb_repiano_cornet';
UPDATE instruments SET written_to_concert = -2, range_low = 'C3', range_high = 'D6' WHERE code = 'bb_flugelhorn';
UPDATE instruments SET written_to_concert = 10, range_low = 'C4', range_high = 'G6' WHERE code = 'piccolo_trumpet';
UPDATE instruments SET written_to_concert = 3, range_low = 'F#3', range_high = 'D6' WHERE code = 'eb_d_trumpet';
UPDATE instruments SET written_to_concert = -2, range_low = 'C3', range_high = 'F6' WHERE code = 'bb_trumpet';
UPDATE instruments SET written_to_concert = 0, range_low = 'C3', range_high = 'F6' WHERE code = 'c_trumpet';
UPDATE instruments SET written_to_concert = -14, range_low = 'F#3', range_high = 'C6' WHERE code = 'bass_trumpet';
UPDATE instruments SET written_to_concert = -9, range_low = 'C3', range_high = 'E6' WHERE code = 'eb_tenor_horn';
UPDATE instruments SET written_to_concert = -7, range_low = 'F#2', range_high = 'C6' WHERE code = 'french_horn';
UPDATE instruments SET written_to_concert = -7, range_low = 'F#3', range_high = 'C6' WHERE code = 'mellophone';
UPDATE instruments SET written_to_concert = -2, range_low = 'C3', range_high = 'C6' WHERE code = 'wagner_tuba';
UPDATE instruments SET written_to_concert = -14, range_low = 'F#2', range_high = 'E6' WHERE code = 'bb_baritone_horn';
UPDATE instruments SET written_to_concert = -14, range_low = 'C2', range_high = 'F6' WHERE code = 'bb_euphonium';
UPDATE instruments SET written_to_concert = 0, range_low = 'A2', range_high = 'F5' WHERE code = 'alto_trombone';
UPDATE instruments SET written_to_concert = -14, range_low = 'F#2', range_high = 'G6' WHERE code = 'tenor_trombone';
UPDATE instruments SET written_to_concert = 0, range_low = 'Bb0', range_high = 'C5' WHERE code = 'bass_trombone';
UPDATE instruments SET written_to_concert = 0, range_low = 'C1', range_high = 'F4' WHERE code = 'contrabass_trombone';
UPDATE instruments SET written_to_concert = -14, range_low = 'F#3', range_high = 'F6' WHERE code = 'valve_trombone';
UPDATE instruments SET written_to_concert = -21, range_low = 'F#2', range_high = 'C6' WHERE code = 'eb_tuba';
UPDATE instruments SET written_to_concert = -26, range_low = 'F#2', range_high = 'C6' WHERE code = 'bb_tuba';
UPDATE instruments SET written_to_concert = 0, range_low = 'D1', range_high = 'F4' WHERE code = 'c_tuba';
UPDATE instruments SET written_to_concert = 0, range_low = 'F1', range_high = 'C5' WHERE code = 'f_tuba';
UPDATE instruments SET written_to_concert = 0, range_low = 'Bb0', range_high = 'F4' WHERE code = 'sousaphone';
UPDATE instruments SET written_to_concert = 0, range_low = 'Bb0', range_high = 'F4' WHERE code = 'helicon';
UPDATE instruments SET written_to_concert = -12, range_low = 'E2', range_high = 'D5' WHERE code = 'double_bass';
UPDATE instruments SET written_to_concert = 0, range_low = 'C2', range_high = 'A5' WHERE code = 'violoncello';
UPDATE instruments SET written_to_concert = 0, range_low = NULL, range_high = NULL WHERE code = 'concert_harp';
UPDATE instruments SET written_to_concert = -12, range_low = 'E2', range_high = 'C5' WHERE code = 'electric_bass';
UPDATE instruments SET written_to_concert = 0, range_low = NULL, range_high = NULL WHERE code = 'piano';
UPDATE instruments SET written_to_concert = 12, range_low = NULL, range_high = NULL WHERE code = 'celesta';
UPDATE instruments SET written_to_concert = 0, range_low = NULL, range_high = NULL WHERE code = 'synthesizer_organ';
UPDATE instruments SET written_to_concert = 0, range_low = NULL, range_high = NULL WHERE code = 'timpani';
UPDATE instruments SET written_to_concert = 24, range_low = NULL, range_high = NULL WHERE code = 'glockenspiel';
UPDATE instruments SET written_to_concert = 12, range_low = NULL, range_high = NULL WHERE code = 'xylophone';
UPDATE instruments SET written_to_concert = 0, range_low = NULL, range_high = NULL WHERE code = 'marimba';
UPDATE instruments SET written_to_concert = 0, range_low = NULL, range_high = NULL WHERE code = 'vibraphone';
UPDATE instruments SET written_to_concert = 0, range_low = NULL, range_high = NULL WHERE code = 'tubular_bells';
UPDATE instruments SET written_to_concert = 24, range_low = NULL, range_high = NULL WHERE code = 'crotales';
UPDATE instruments SET written_to_concert = NULL, range_low = NULL, range_high = NULL WHERE code = 'snare_drum';
UPDATE instruments SET written_to_concert = NULL, range_low = NULL, range_high = NULL WHERE code = 'bass_drum';
UPDATE instruments SET written_to_concert = NULL, range_low = NULL, range_high = NULL WHERE code = 'clash_cymbals';
UPDATE instruments SET written_to_concert = NULL, range_low = NULL, range_high = NULL WHERE code = 'suspended_cymbal';
UPDATE instruments SET written_to_concert = NULL, range_low = NULL, range_high = NULL WHERE code = 'tam_tam';
UPDATE instruments SET written_to_concert = NULL, range_low = NULL, range_high = NULL WHERE code = 'triangle';
UPDATE instruments SET written_to_concert = NULL, range_low = NULL, range_high = NULL WHERE code = 'tambourine';
