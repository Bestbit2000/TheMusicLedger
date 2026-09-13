-- ML-103 follow-up: the reworked block editor (Landmarks/Jumps/Articulation sections) needs a
-- few concepts the previous pass (028_block_navigation_markup.sql) didn't cover.

-- A plain double barline marking a phrase/section boundary - visually and musically distinct from
-- a repeat start (no dots, no repeat implication). Separate from is_repeat_start.
ALTER TABLE metronome_segments ADD COLUMN is_section_boundary BOOLEAN NOT NULL DEFAULT false;

-- Segno sign + its two jump instructions, alongside the existing is_coda/goto_coda/goto_start_dc.
-- goto_segno is "D.S." (back to the sign); goto_segno_then_coda is "D.S. al Coda" (back to the
-- sign, then on to the coda next time through) - a distinct instruction from a plain goto_segno,
-- not just goto_segno + goto_coda both set.
ALTER TABLE metronome_segments ADD COLUMN is_segno BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE metronome_segments ADD COLUMN goto_segno BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE metronome_segments ADD COLUMN goto_segno_then_coda BOOLEAN NOT NULL DEFAULT false;

-- A block can carry more than one rehearsal mark (e.g. a long block spanning several bars) -
-- supersedes the single metronome_segments.rehearsal_mark column from 002_scores_and_metronome.sql,
-- left in place unused rather than dropped (same "superseded, not removed" precedent as other
-- dormant columns - see docs/database-schema.md).
CREATE TABLE metronome_segment_rehearsal_marks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    segment_id BIGINT NOT NULL REFERENCES metronome_segments(id) ON DELETE CASCADE,
    mark TEXT NOT NULL,
    bar_offset SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_metronome_segment_rehearsal_marks_segment ON metronome_segment_rehearsal_marks (segment_id);

-- How a fermata actually sounds during its hold: a continuous tone, silence, or a distinct
-- click - previously only the hold length was configurable.
ALTER TABLE metronome_segment_fermatas ADD COLUMN playback_mode TEXT NOT NULL DEFAULT 'tone'
  CHECK (playback_mode IN ('tone', 'silent', 'count'));
