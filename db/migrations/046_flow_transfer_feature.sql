-- ML-204: catalog entry for the admin panel's Flows page - export flows as MusicXML and import them
-- into another environment (production -> dev/sandbox for testing). No schema change: exports read
-- existing tables, imports write ordinary scores/metronome_segments rows through the same service
-- layer the block editor uses. Catalog-only (not a kill switch - nothing checks `enabled` for this
-- one): the page is super-admin-only already, and there's no third-party dependency to gate.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('flow_transfer', 'Flow export/import (MusicXML)', 'Admin panel Flows page: export any flow as MusicXML (one .musicxml, or a .zip of several) and import such files as the importing admin''s own private flows - used to copy real flows from production into dev/sandbox for testing. The same MusicXML reader also powers Create from file.', true)
ON CONFLICT (feature_key) DO NOTHING;
