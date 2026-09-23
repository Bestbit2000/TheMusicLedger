-- ML-204 follow-up: MusicXML import/export for every user, not just the admin Flows page ("for
-- every action there should be a re-action - if you can import, you should be able to export").
-- Two real kill switches (unlike 046's catalog-only flow_transfer row), both checked server-side and
-- client-side, and both the single place a per-plan check would go if these are commercialised
-- later (features.enabled is global today - there's no per-plan gating anywhere yet).
--
-- flow_import_musicxml is split out of flow_import_from_file deliberately: that flag also covers
-- PDF import, which depends on the external OMR service that hasn't had its security review
-- (ML-190) - MusicXML/.mxl import has no third-party dependency at all, so it no longer needs to
-- wait on that. flow_import_from_file now means PDF/scan import only.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('flow_import_musicxml', 'Import flow from MusicXML', 'Flow start screen: "Import from MusicXML" - create a flow from a .musicxml/.mxl file (notation software, or a flow exported from this app). No third-party dependency. PDF/scan import is the separate flow_import_from_file feature.', true),
    ('flow_export_musicxml', 'Export flow to MusicXML', 'Flow library ⋮ menu: "Export to MusicXML" - download a personal or band flow as .musicxml (opens in MuseScore etc., and re-imports losslessly). Public library flows can''t be exported.', true)
ON CONFLICT (feature_key) DO NOTHING;

UPDATE features
SET description = 'Flow start screen: PDF/scan import via the external OMR service (ML-79 Phase 2) - off until that dependency has had its security review. MusicXML import is the separate flow_import_musicxml feature (ML-204).'
WHERE feature_key = 'flow_import_from_file';
