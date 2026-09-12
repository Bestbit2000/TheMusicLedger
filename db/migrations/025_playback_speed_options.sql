-- Metronome Blocks' play-speed presets (ML-109) - previously hardcoded as a fixed row of 13 buttons
-- (30%-150%) in public/index.html's metroBlkSpeedOptions. Moved to a table so the list can be
-- managed from the admin panel without a release, same shape/reasoning as duration_options
-- (db/migrations/011_duration_options.sql) - not per-account, shared across every account, and no
-- usage-check needed on delete (a play-speed choice is a live playback setting, never stored against
-- a saved block - same as duration_options, per the ML-109 ticket's own carve-out for both lists).

CREATE TABLE playback_speed_options (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    percent INTEGER NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeded from the exact list that was hardcoded in index.html.
INSERT INTO playback_speed_options (percent) VALUES
    (30), (40), (50), (60), (70), (80), (90), (100), (110), (120), (130), (140), (150);
