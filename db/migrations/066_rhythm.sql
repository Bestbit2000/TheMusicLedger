-- ML-306: the Rhythm tool - word rhythms and the Takadimi crib sheet, tapped (scored strictly) or
-- clapped / sung / played into the microphone (scored leniently). Rounds are drill rounds: saved in
-- drill_attempts (tool 'rhythm', level = a rhythm id or 'sheet:<set>') and re-scored by the server with
-- public/rhythm.js, so they get the drill tools' history, bests and results screen. See docs/rhythm.md.
ALTER TABLE drill_attempts DROP CONSTRAINT IF EXISTS drill_attempts_tool_check;
ALTER TABLE drill_attempts ADD CONSTRAINT drill_attempts_tool_check CHECK (tool IN ('tapTempo', 'gapTrainer', 'ear', 'rhythm'));

-- Each rhythm's speed Level for a player (0-5: the fastest Level speed passed at grade 4+; never goes
-- down) and their own word for it (optional - "Pineapple" for ta ka di, say).
CREATE TABLE IF NOT EXISTS rhythm_pattern_levels (
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    pattern_id TEXT NOT NULL CHECK (length(pattern_id) BETWEEN 1 AND 40),
    level SMALLINT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
    word TEXT CHECK (word IS NULL OR length(word) BETWEEN 1 AND 40),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, pattern_id)
);

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('rhythm_trainer', 'Rhythm', 'Home screen Rhythm tool (ML-306): word rhythms (Plum, Ap-ple, Pom-e-gran-ate, Am-ster-dam) and the Takadimi crib sheet (15 one-beat rhythms, two-beat, triplets, 6/8). Tap along (scored strictly) or clap, sing or play into the microphone (scored leniently); each rhythm has a speed Level 1-5. Saved like the drill tools; also a Skills list entry.', false)
ON CONFLICT (feature_key) DO NOTHING;
