-- The note value ("crotchet", "quaver", etc.) chosen for a regular block's
-- "note = bpm" Target BPM display (ML-35 follow-up bug fix). Purely a display
-- preference - it never changes the block's own stored bpm (see
-- metroSegNoteFraction/refreshMetroSegBpmDisplay client-side, which keep
-- metroSegBpm fixed when the note selection changes) - but with nowhere to
-- persist it, re-opening a saved block to edit it had no way to know which
-- note was originally chosen and always fell back to a denominator-based
-- default, silently discarding whatever the user had actually picked.
-- NULL (the default) means "no preference recorded yet" - the client falls
-- back to its own denominator-based default in that case, same as today.
-- Never meaningful on a lead-in row (it has no independent display of its
-- own - see metroBlkEffectiveBlock client-side), so no CHECK tying it to
-- is_lead_in; the client simply never sets it for one.

ALTER TABLE metronome_segments ADD COLUMN note_value TEXT
  CHECK (note_value IS NULL OR note_value IN ('quaver', 'crotchet', 'dotted-crotchet', 'minim', 'semibreve'));
