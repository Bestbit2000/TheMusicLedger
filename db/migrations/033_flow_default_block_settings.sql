-- Admin-editable defaults for a Flow's very first block (ML-179 follow-up) - "Create your own"
-- now always starts with exactly one block, same idea as Quick Play's own single default bar
-- (qpNewBlock: 4/4, 100bpm, 1 bar, crotchet beat unit), but these shouldn't need a release to
-- change - same app_config pattern as posthog_dashboard_url (ML-47). See
-- server/services/flows.js's getFlowDefaultBlockSettings for how they're read and validated.
INSERT INTO app_config (key, value) VALUES
    ('flow_default_time_signature', '4/4'),
    ('flow_default_bpm', '100'),
    ('flow_default_bar_count', '1'),
    ('flow_default_note_value', 'crotchet');
