-- Global feature gates (ML-190). Extends the existing `features` catalog (admin panel's Features
-- page, ML-26/012_test_registry.sql/014_features_catalog.sql) so the running app actually reads
-- it, instead of it being purely admin/back-test-registry tooling. Deliberately not reusing
-- `plan_feature_flags` (008_monetization.sql) - that's per-subscription-plan gating for future
-- billing, a different concern from "an admin can switch a feature off for everyone right now".
ALTER TABLE features ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;

-- First real consumer: ML-79's "Create from file" starts disabled - it calls out to an unreviewed
-- third-party OMR dependency (solfascribe-omr) pending a security review. Replaces the app's own
-- hardcoded FEATURE_FLAGS.createFromFile placeholder with this real, admin-toggleable one.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('flow_import_from_file', 'Create flow from file', 'Import a Flow''s title/composer/tempo/measure blocks from an uploaded MusicXML/.mxl file (or, once OMR is wired up, a PDF/scanned score) instead of building it manually.', false)
ON CONFLICT (feature_key) DO NOTHING;
