-- ML-170: in-app feedback, so an issue spotted while using the app can be written down the moment
-- it's noticed instead of being remembered later (or not).
--
-- The capture form is deliberately nothing but a text box. Categorisation happens at triage
-- (category is NULL until an admin sets it), because anything that stands between noticing a
-- problem and recording it is a reason not to bother - and a category chosen in a hurry would need
-- correcting at triage anyway, which is where the decision is actually being made.
--
-- Deliberately not PostHog (public/analytics.js): that's anonymous autocapture of clicks. This is
-- addressed, attributed prose that gets replied to and worked through, which is a database row.
CREATE TABLE feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    message TEXT NOT NULL,

    -- NULL means untriaged, which is a real and useful state (it's the admin list's default
    -- filter), not missing data - hence nullable with no default rather than a 'none' member of
    -- the CHECK. Set by an admin in the review drawer; freely changeable, since a miscategorised
    -- row is otherwise unfindable once the filters are how you navigate.
    category TEXT CHECK (category IN ('bug', 'suggestion', 'comment')),

    -- ML-170 lists three different status sets in three places (the user-facing badges, the admin
    -- filter tabs, and the admin dropdown - the last one alone mentions 'in_progress' and
    -- 'resolved', neither of which has a badge colour or a filter anywhere else). This is the
    -- reconciled set: every member gets a colour and a filter, so the three lists can't drift apart
    -- again. 'under_review' is where everything starts - it's what the submitter is told, and it
    -- doubles as "not looked at yet".
    status TEXT NOT NULL DEFAULT 'under_review'
        CHECK (status IN ('under_review', 'planned', 'in_progress', 'not_progressing', 'resolved')),

    -- The reply shown back to the submitter once the "My Feedback" view is built (ML-170's
    -- closing-the-loop section, deliberately a follow-up). Written at triage regardless, so there's
    -- something to show the day that view exists rather than a backlog of silent rows.
    admin_response TEXT,

    -- Context captured silently at submit, per the ticket. The point is that a report written in
    -- the moment ("this button did nothing") is still actionable a week later, because the row
    -- remembers where "this" was. route/user_agent come from the browser; device_kind and
    -- app_version reuse exactly what ML-199 established (044_flow_authoring_stats.sql) - short-edge
    -- classification, and the version read server-side from public/releases.json rather than being
    -- client-supplied, so it always names a release that can actually be pointed at.
    route TEXT,
    user_agent TEXT,
    device_kind TEXT CHECK (device_kind IN ('mobile', 'tablet', 'desktop')),
    app_version TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Moved to now() by the admin PATCH (ML-170's own "sets updated_at" requirement) - i.e. "when
    -- was this last looked at", not "when was it written", which is what created_at is for.
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The admin list's own shape: filtered by status and/or category, newest first.
CREATE INDEX idx_feedback_status ON feedback (status, created_at DESC);
CREATE INDEX idx_feedback_category ON feedback (category, created_at DESC);
-- For the user's own "My Feedback" list (ML-170 follow-up) - added now so that view doesn't need a
-- migration of its own just to read rows this table already has.
CREATE INDEX idx_feedback_account ON feedback (account_id, created_at DESC);

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('feedback', 'In-app feedback', 'Send feedback from the hamburger menu - a plain text box that silently captures the current screen, device and app version. Reviewed and categorised by super admins under the admin panel''s Feedback tab.', true)
ON CONFLICT (feature_key) DO NOTHING;
