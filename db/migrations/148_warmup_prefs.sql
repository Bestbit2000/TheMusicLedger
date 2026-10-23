-- ML-586: the Warm-ups tool's settings, saved on the account so they follow the person to every device (owner,
-- 23 Oct 2026 - "most of the time you'll just use the defaults"): own pace or with the metronome, the speed (a
-- percentage of each warm-up's own), how many times each one plays, the count-in, the volume, the music size,
-- shuffle, the topics and the instrument. They were kept per device (localStorage 'tml.warmups'); the device's
-- copy is saved here the first time. JSON so a new setting needs no migration; server/services/accounts.js
-- checks the keys and values. {} = nothing chosen yet.

ALTER TABLE accounts ADD COLUMN warmup_prefs JSONB NOT NULL DEFAULT '{}';
