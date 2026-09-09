-- Tool-level list of preset session/timer durations (Jira ML-7). Previously
-- hardcoded as radio buttons in public/index.html; moved to a table so the
-- list can be managed without a release and reused by both the save-session
-- screen and the practice timer. Not per-account - a shared reference list,
-- same shape as scale_definitions.

CREATE TABLE duration_options (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    minutes INTEGER NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeded from the exact list that was hardcoded in index.html.
INSERT INTO duration_options (minutes, sort_order) VALUES
    (10, 1), (15, 2), (20, 3), (25, 4), (30, 5),
    (40, 6), (45, 7), (60, 8), (105, 9), (120, 10);
