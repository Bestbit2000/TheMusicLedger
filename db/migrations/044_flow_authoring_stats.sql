-- ML-199: how long it actually takes to build a Flow by hand. The point of this table is a
-- BASELINE - a measured "this is what manual bar entry costs today" that a redesigned Bars tab
-- can later be compared against, rather than an after-the-fact guess about whether it got better.
-- One row per authoring attempt: kind='create' for the "Create your own" -> Play journey,
-- kind='edit' for every later return into an existing flow (the ticket asks for those as separate
-- rows, so total time can be split between initial creation and cumulative editing).
--
-- Deliberately NOT a PostHog concern (public/analytics.js): that's autocapture, i.e. click counts
-- with no notion of a session that starts here, ends there, and has a duration. And deliberately
-- not a column on `scores` - a flow accumulates many authoring sessions over its life, and the
-- whole comparison depends on keeping them individually attributable to an app version.
--
-- Two durations, because one is not enough to be trustworthy:
--   elapsed_seconds - raw wall clock, started_at -> ended_at. Honest, but a single session where
--                     the phone rang inflates it without limit.
--   active_seconds  - the same span with idle trimmed out: the client stops accumulating after
--                     idle_threshold_seconds with no pointer/keyboard input, and whenever the page
--                     is hidden. THIS is the baseline figure; elapsed is kept alongside it as a
--                     sanity check, never as the headline.
-- idle_threshold_seconds is stored per row on purpose. "Active time" is only a meaningful number
-- if you know the rule that produced it, and retuning that rule later must not silently make new
-- rows incomparable with old ones - it makes the change visible in the data instead.
--
-- bars_active_seconds narrows that further to the Bars tab specifically (including time inside the
-- per-block inspector/pickers, which is where bar entry actually happens). ML-199 originally asked
-- for a whole-journey figure; Details/Media are a handful of optional text fields by comparison,
-- so bar entry is measured as its own number rather than being averaged in with them. Both are
-- kept: active_seconds answers "what does a flow cost", bars_active_seconds answers "what does the
-- part we're about to redesign cost".
CREATE TABLE flow_authoring_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    -- ON DELETE SET NULL, NOT CASCADE, and a denormalised flow_title beside it. Establishing a
    -- baseline means building and binning a lot of throwaway flows, and deleting the flow must not
    -- delete the measurement of how long it took to build - that measurement is the entire asset
    -- here. flow_title is snapshotted (at start, refreshed on finalise) so the ticket's "against
    -- the user and the flow name" still holds for a flow that no longer exists.
    score_id BIGINT REFERENCES scores(id) ON DELETE SET NULL,
    flow_title TEXT,

    kind TEXT NOT NULL CHECK (kind IN ('create', 'edit')),

    -- ML-79's "Create from file" arrives at the Bars tab with the blocks already populated from a
    -- MusicXML import, so those sessions measure reviewing an import, not manual entry. Separated
    -- rather than excluded, since "how much faster is import" is the obvious next question.
    creation_source TEXT NOT NULL DEFAULT 'manual' CHECK (creation_source IN ('manual', 'from_file')),

    -- 'in_progress' is the state a row is CREATED in and, for a closed tab or a crash, the state it
    -- stays in - there is no reliable end event in that case. Stats treat an in_progress row whose
    -- last_heartbeat_at has gone stale as abandoned rather than pretending it completed; the
    -- heartbeat is what keeps its seconds roughly right instead of zero. Abandoned attempts are
    -- recorded on purpose: a create that never reached Play is a strong signal about the UI, and
    -- writing the row only on success would throw exactly that signal away.
    outcome TEXT NOT NULL DEFAULT 'in_progress' CHECK (outcome IN ('in_progress', 'completed', 'abandoned')),

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,

    elapsed_seconds INTEGER NOT NULL DEFAULT 0,
    active_seconds INTEGER NOT NULL DEFAULT 0,
    bars_active_seconds INTEGER NOT NULL DEFAULT 0,
    idle_threshold_seconds INTEGER NOT NULL,

    -- block_count_start is 1 for a normal create (POST /api/flows always seeds exactly one block)
    -- and whatever already existed for an edit. "Average time per block" divides by block_count_end
    -- for a create; for an edit, dividing by the whole flow is misleading - divide by the blocks
    -- actually touched, which is what the three mutation counters are for. Lead-in blocks are
    -- excluded from all of these, same convention as blockCount everywhere else.
    block_count_start INTEGER NOT NULL DEFAULT 0,
    block_count_end INTEGER NOT NULL DEFAULT 0,
    total_bars_end INTEGER NOT NULL DEFAULT 0,
    blocks_added INTEGER NOT NULL DEFAULT 0,
    blocks_edited INTEGER NOT NULL DEFAULT 0,
    blocks_deleted INTEGER NOT NULL DEFAULT 0,

    -- Thumbing a phone and typing on a desktop are different activities with different costs.
    -- Without this the baseline silently averages two populations, and a later "improvement" could
    -- just be a shift in which device was used.
    device_kind TEXT CHECK (device_kind IN ('mobile', 'tablet', 'desktop')),

    -- The whole before/after comparison hangs on this: it makes "before the redesign vs after" a
    -- GROUP BY rather than a guess at which side of a date a row falls on. Read server-side from
    -- public/releases.json (the same source the About page uses), never sent by the client.
    app_version TEXT,

    -- A run you know was interrupted can be dropped from the averages without deleting the
    -- evidence. Matters far more than usual here: the baseline sample is small enough that one bad
    -- run visibly moves it.
    is_excluded BOOLEAN NOT NULL DEFAULT false,
    exclusion_reason TEXT
);

CREATE INDEX idx_flow_authoring_sessions_account ON flow_authoring_sessions (account_id, started_at DESC);
CREATE INDEX idx_flow_authoring_sessions_score ON flow_authoring_sessions (score_id);
-- The shape every admin stat actually groups by (ML-199's own "average per flow" / "per block",
-- split before/after a UI change), with the rows that must never reach an average filtered out.
CREATE INDEX idx_flow_authoring_sessions_reporting ON flow_authoring_sessions (app_version, kind, creation_source)
    WHERE outcome = 'completed' AND is_excluded = false;

-- Kill switch, same admin-toggleable pattern as ML-190's flow_import_from_file. Starts enabled -
-- unlike that one there's no third-party dependency to review here, and the table is useless until
-- it's actually collecting. Checked when a session STARTS; a session already running when it's
-- switched off still finalises, rather than being left as a permanent in_progress row.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('flow_authoring_stats', 'Flow authoring time tracking', 'Records how long each Flow create/edit session takes (active time, with idle trimmed), so manual bar entry has a measured baseline to compare UI changes against. Super-admin-visible only.', true)
ON CONFLICT (feature_key) DO NOTHING;
