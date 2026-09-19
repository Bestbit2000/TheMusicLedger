-- Expands the "beat note" picker (shared by Quick Play, the ad-hoc Metronome Blocks tool, and Flow
-- blocks - see metroSegNoteModal/METRO_NOTE_TYPES client-side) from 5 note values to the full 8,
-- adding semiquaver, dotted quaver and dotted minim alongside the existing quaver, crotchet,
-- dotted-crotchet, minim and semibreve. Same column (023_segment_note_value.sql), just a wider
-- CHECK constraint - drop and recreate since Postgres has no ALTER CHECK.
ALTER TABLE metronome_segments DROP CONSTRAINT metronome_segments_note_value_check;
ALTER TABLE metronome_segments ADD CONSTRAINT metronome_segments_note_value_check
  CHECK (note_value IS NULL OR note_value IN (
    'semiquaver', 'quaver', 'dotted-quaver', 'crotchet', 'dotted-crotchet', 'minim', 'dotted-minim', 'semibreve'
  ));
