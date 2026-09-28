-- ML-320 follow-ups and ML-321 (epic ML-314).

-- Your own session templates: a name, the opening blocks in order, the focus for the rest and a length.
-- The built-in Standard and Concert templates stay in code (public/practicePlan.js).
CREATE TABLE IF NOT EXISTS practice_templates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    lead_blocks TEXT[] NOT NULL DEFAULT '{}',
    focus TEXT NOT NULL DEFAULT 'both' CHECK (focus IN ('skills', 'both', 'rehearsal')),
    minutes SMALLINT NOT NULL DEFAULT 45 CHECK (minutes BETWEEN 5 AND 120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (lead_blocks <@ ARRAY['warmup', 'scales', 'skills', 'rehearsal']::text[]),
    CHECK (cardinality(lead_blocks) <= 24)
);
CREATE INDEX IF NOT EXISTS practice_templates_account ON practice_templates (account_id);

-- The practice session running now, if any - one per account, so it carries on after a reload or on
-- another device (same idea as active_timer_sessions). state is the runner's plan and progress;
-- block_started_at is the current block's start by the database clock, so every device agrees on the
-- time left. Deleted when the session ends.
CREATE TABLE IF NOT EXISTS active_practice_sessions (
    account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    block_started_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ML-321: your skills list - the playing skills you're working on, each at a step of its tool's own
-- ladder (Tempo's help steps, Pulse's drills, Pitch's Play it back sets, a warm-up type's exercises,
-- the major or minor scales key by key). skill_key names the skill (e.g. 'tapTempo', 'warmups:lip-slurs',
-- 'scales:major'); step_index is the step you're on (= the number passed). Skills blocks go to the one
-- practised longest ago.
CREATE TABLE IF NOT EXISTS skill_list_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    skill_key TEXT NOT NULL,
    step_index INTEGER NOT NULL DEFAULT 0 CHECK (step_index >= 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    last_practised TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, skill_key)
);

-- Every go at a skill step: passed at grade 4+ in a drill, or "Got it" for Warm-ups and Scales.
CREATE TABLE IF NOT EXISTS skill_step_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    skill_key TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    grade SMALLINT CHECK (grade BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skill_step_results_account ON skill_step_results (account_id, skill_key, created_at);
