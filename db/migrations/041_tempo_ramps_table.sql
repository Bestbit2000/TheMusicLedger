-- ML-179 follow-up: Flow's new "Tempo ramps" picker (mirrors the Pauses picker's list shape,
-- 039_fermata_caesura_kind.sql) needs a block to hold MULTIPLE gradual speed changes - the
-- existing ramp_start_bar_offset/ramp_start_beat_offset/ramp_duration_bars columns
-- (002_scores_and_metronome.sql, 028_block_navigation_markup.sql) only ever supported one ramp
-- per block (a fixed field triple, not a list). Same "superseded, not removed" precedent as
-- metronome_segments.rehearsal_mark (028_block_navigation_markup.sql) - those three columns stay
-- in place unused rather than dropped; only the ad-hoc Metronome Blocks tool's own "Speed change"
-- card still reads/writes them (its UI wasn't part of this request).
--
-- Each ramp has its own start (bar/beat offset within the block), an end point - either the end
-- of the block, or a specific bar/beat - and a target speed - either the next block's own bpm, or
-- a custom bpm. "Next block" only makes sense once the ramp is known to run all the way to the
-- block boundary, so end_mode = 'specific' always forces target_mode = 'custom' (enforced in
-- server/services/metronomeSegments.js's validateSegmentPayload, mirroring how a caesura forces
-- playback_mode = 'silent' there).
CREATE TABLE metronome_segment_ramps (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    segment_id BIGINT NOT NULL REFERENCES metronome_segments(id) ON DELETE CASCADE,
    start_bar_offset SMALLINT NOT NULL DEFAULT 0,
    start_beat_offset SMALLINT NOT NULL,
    end_mode TEXT NOT NULL DEFAULT 'block_end' CHECK (end_mode IN ('block_end', 'specific')),
    end_bar_offset SMALLINT,
    end_beat_offset SMALLINT,
    target_mode TEXT NOT NULL DEFAULT 'custom' CHECK (target_mode IN ('next_block', 'custom')),
    target_bpm SMALLINT
);
CREATE INDEX idx_metronome_segment_ramps_segment ON metronome_segment_ramps (segment_id);
