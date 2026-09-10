-- Ad-hoc metronome setups start as an unnamed scratch copy (ML-35 follow-up:
-- naming a setup before you can even press play was too much friction) and
-- only join the account's saved list once the user explicitly keeps one.
-- NULL saved_at = scratch (created, playable, but not shown in the setups
-- list); a timestamp = the moment "Save for later" was pressed.

ALTER TABLE adhoc_metronome_setups ADD COLUMN saved_at TIMESTAMPTZ;
