-- ML-103: wires up the navigation/articulation markup on a block (repeat
-- start/end, endings, rehearsal mark, coda, D.C., intro/count-in, tempo
-- ramp, fermatas). Most of the columns this needs already exist and have
-- sat dormant since 002_scores_and_metronome.sql (Jira ML-35) - this
-- migration only adds the handful of genuinely new pieces that design
-- didn't anticipate.

-- Total number of times the repeated passage plays (e.g. 2 for "2x").
-- Meaningful only on a row where is_repeat_end = true; NULL elsewhere.
ALTER TABLE metronome_segments ADD COLUMN repeat_play_count SMALLINT;

-- How many bars after ramp_start_bar_offset/ramp_start_beat_offset the tempo
-- ramp takes to reach the NEXT segment's bpm - may land before this block
-- itself ends. NULL alongside a set ramp start preserves the original
-- ramp_start_* design (002_scores_and_metronome.sql): runs to the end of
-- the block.
ALTER TABLE metronome_segments ADD COLUMN ramp_duration_bars SMALLINT;

-- A block can hold multiple fermatas (sustained holds), each on its own
-- bar/beat within the block - a separate table rather than a fixed field
-- pair since there's no cap on how many a block might need.
CREATE TABLE metronome_segment_fermatas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    segment_id BIGINT NOT NULL REFERENCES metronome_segments(id) ON DELETE CASCADE,
    bar_offset SMALLINT NOT NULL DEFAULT 0,
    beat_offset SMALLINT NOT NULL,
    hold_beats SMALLINT NOT NULL CHECK (hold_beats BETWEEN 1 AND 4)
);
CREATE INDEX idx_metronome_segment_fermatas_segment ON metronome_segment_fermatas (segment_id);
