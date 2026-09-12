-- Generic key/value config store (ML-47) for small admin-editable settings that shouldn't need a
-- release to change - the PostHog dashboard link is the first case (may need to point somewhere
-- else later if another dashboard/project replaces it). Not for secrets (readable by any super
-- admin via /api/admin/config, same trust boundary as the rest of that router) and not a
-- replacement for env vars or the features table - just small display-only values like a URL.

CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_config (key, value) VALUES
    ('posthog_dashboard_url', 'https://eu.posthog.com/project/272745/dashboard/948676');
