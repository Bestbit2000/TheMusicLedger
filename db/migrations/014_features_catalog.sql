-- `features` (from 012_test_registry.sql) started as something test_cases
-- pointed at. It's now also the app-wide feature catalog behind the admin
-- panel's "Features" list (ML-26) - a record of what the tool actually does
-- today, which is meant to grow into feature gating and billing later (see
-- the already-designed but unwired plan_feature_flags.feature_key in
-- docs/database-schema.md - this is the canonical list that will resolve
-- against). Only features with real, wired-up app code are listed here,
-- matching CLAUDE.md's note that scores/practice lists/scales/technique/
-- monetization are schema-only so far.

-- Broaden the ML-7-specific "timer_start_stop_save_prompt" row (added when
-- only the back-test used this table) into the general Timer feature, rather
-- than creating a second, overlapping row.
UPDATE features
SET feature_key = 'timer',
    name = 'Practice timer',
    description = 'Countdown practice timer with presets from duration_options, minimises to a bar under the top nav when you navigate away, and offers to log the elapsed time as a practice session on finish.'
WHERE feature_key = 'timer_start_stop_save_prompt';

INSERT INTO features (feature_key, name, description) VALUES
    ('session_logging', 'Log practice/rehearsal/lesson/performance time', 'Record a session (category, duration, who with, date); view, edit, and delete past sessions in history.'),
    ('metronome', 'Metronome', 'Configurable metronome - notes BPM, beats per bar, conductor beat linking, tap tempo, speed override, mute/volume, headphone latency compensation, and setting parameters from music markings.'),
    ('tuner', 'Tuner', 'Microphone-based instrument tuner with transposition (concert/Bb/Eb/F) and flats/sharps display preference.'),
    ('challenges', 'Challenges', 'Grouped practice/performance challenge items tracked to completion, with progress logging per item.'),
    ('stats_and_streaks', 'Stats, streaks, and history', 'Dashboard totals, detailed stats over selectable time periods, practice/playing streaks, and full session history.'),
    ('manage_lists', 'Manage organisations and teachers', 'Add, rename, and archive the organisations/teachers used when logging rehearsals, performances, and lessons.'),
    ('google_login', 'Google login', 'Google OAuth 2.0 sign-in (server/config/passport.js) - the only supported login method today.')
ON CONFLICT (feature_key) DO NOTHING;
