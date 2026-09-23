-- ML-192: repeatable security review of third-party services this app depends on - first (and so far
-- only) target: solfascribe-omr, the OMR service behind "Create from file" PDF import. Admin ->
-- Security shows the checks, their latest results and the full history of runs, and can re-run the
-- automated ones on demand. See docs/omr-security-review.md.
--
-- Two kinds of run feed the same page:
--   * 'automated' - "Run now" in the admin panel (server/services/securityReview.js). Only the checks
--     a Vercel function can do (GitHub/OSV API calls, config rules, a live probe of the deployed
--     service, our own guard self-tests). Those runs are rows here, per environment.
--   * 'assisted' - the deep checks (manual code read, Gitleaks, ESLint, OSV-Scanner, ...) need local
--     tools and a person, so Claude Code runs them in a session and records the result in the repo
--     (server/securityReviews/<target>.js) - NOT in this table. That file ships with the code, so
--     every environment shows the same deep-review history without anything writing to production
--     from a laptop; git history is its audit trail.
-- Check definitions live in code (securityReview.js), not a table: a check is code, and its key is
-- the stable identifier results hang off.

CREATE TABLE security_review_runs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    target_key TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'automated' CHECK (kind IN ('automated')),
    triggered_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    -- The upstream commit the run looked at, so a later run can say "changed since".
    upstream_commit_sha TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_security_review_runs_target ON security_review_runs (target_key, started_at DESC);

CREATE TABLE security_review_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES security_review_runs(id) ON DELETE CASCADE,
    check_key TEXT NOT NULL,
    -- pass / warn / fail as usual; info = recorded for context, not a verdict; not_run = the check
    -- couldn't apply this time (e.g. no service deployed to probe); error = the check itself broke.
    status TEXT NOT NULL CHECK (status IN ('pass', 'warn', 'fail', 'info', 'not_run', 'error')),
    summary TEXT NOT NULL,
    -- Evidence lines shown under the result (plain strings; never rendered as HTML).
    details JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, check_key)
);
