-- ML-378: the tools on your home screen ("Your tools") - up to four, chosen on the All tools page.
-- Null = the default (Metronome, Tuner, Timer, Warm-ups). The ids are checked by HOME_TOOL_IDS in
-- server/services/accounts.js (a new tool needs no migration).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS home_tools TEXT[];
