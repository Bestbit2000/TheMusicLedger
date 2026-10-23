-- ML-589: the Scales tool's settings, saved on the account so they follow the person to every device, as Warm-ups'
-- (ML-586, accounts.warmup_prefs): own pace or with the metronome, the speed, notes a beat, how many times each
-- scale plays (or keep repeating), the count-in, the volume, how much to show, the direction, shuffle, lighting the
-- note, the grades and the instrument. They were kept per device (localStorage 'tml.scales' - which scale you were
-- on stays there); the device's copy is saved here the first time. The music size is Warm-ups' (shared, owner
-- 23 Oct 2026). JSON so a new setting needs no migration; ScaleGrades.cleanPrefs (public/scaleGrades.js) checks the
-- keys and values. {} = nothing chosen yet.

ALTER TABLE accounts ADD COLUMN scale_prefs JSONB NOT NULL DEFAULT '{}';
