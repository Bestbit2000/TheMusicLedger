-- 014_features_catalog.sql's UPDATE ... WHERE feature_key = 'timer_start_stop_save_prompt'
-- assumed that row already existed - true on `dev` (created by hand while
-- building the ML-7 back-test spec, before 014 was written), but never true
-- on a fresh environment like `production` (or `sandbox`, or a recreated
-- `dev` after its 7-day TTL). Those environments silently ended up with no
-- "timer" feature at all. Idempotent fix, safe to run everywhere.

INSERT INTO features (feature_key, name, description)
VALUES (
    'timer',
    'Practice timer',
    'Countdown practice timer with presets from duration_options, minimises to a bar under the top nav when you navigate away, and offers to log the elapsed time as a practice session on finish.'
)
ON CONFLICT (feature_key) DO NOTHING;
