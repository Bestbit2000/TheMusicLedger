-- Registry for the on-request back-test workflow (ML-29). Unlike the rest of
-- this schema, these tables aren't read or written by the running app - they
-- back a Claude Code-driven procedure (see .claude/skills/backtest) that
-- writes Playwright specs for new/changed features, runs them against the
-- dev branch, and keeps a history of what passed. Deliberately no GitHub
-- Actions workflow and no separate ANTHROPIC_API_KEY billing here: Claude
-- Code itself writes the test scripts and root-causes failures when asked,
-- inside a normal session already covered by whatever plan is running that
-- chat - see the "cost" discussion on ML-29 for why that's the trigger.

CREATE TABLE features (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    feature_key TEXT UNIQUE NOT NULL, -- e.g. "timer_start_pause_stop"
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE test_cases (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    jira_ticket_key TEXT,
    title TEXT NOT NULL,
    passes_if_criteria TEXT NOT NULL,
    script TEXT NOT NULL, -- full Playwright TypeScript spec, authored by Claude
    is_active BOOLEAN NOT NULL DEFAULT true,
    version_added TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE test_runs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trigger_source TEXT NOT NULL DEFAULT 'manual', -- always 'manual' for now - no automated trigger exists
    triggered_by_ticket TEXT,
    git_commit_sha TEXT,
    total_tests INTEGER NOT NULL DEFAULT 0,
    passed_tests INTEGER NOT NULL DEFAULT 0,
    failed_tests INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE test_run_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    test_run_id BIGINT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    test_case_id BIGINT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('PASS', 'FAIL', 'SKIPPED')),
    error_message TEXT,
    root_cause_analysis TEXT, -- filled in by Claude when asked to investigate a failure, not an automated call
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_features_key ON features (feature_key);
CREATE INDEX idx_test_cases_active ON test_cases (is_active);
CREATE INDEX idx_test_run_results_run ON test_run_results (test_run_id);
