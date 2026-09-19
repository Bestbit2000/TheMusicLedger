-- Admin-editable default name for a brand new Flow - "Create your own" now pre-fills the name
-- field with this instead of leaving it blank, same app_config pattern as the flow_default_* block
-- settings (033_flow_default_block_settings.sql). See server/services/flows.js's
-- getUniqueDefaultFlowName for how a collision against an existing personal flow of the same name
-- is resolved (appends an incrementing number: "Untitled", "Untitled 1", "Untitled 2", ...).
INSERT INTO app_config (key, value) VALUES
    ('flow_default_name', 'Untitled');
