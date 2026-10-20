-- ML-543: the old PDF/scan import is removed (owner's decision, 20 October 2026). "Create flow from file"
-- (flow_import_from_file, ML-79 Phase 2 / ML-190) sent a PDF to an outside music-scanning service,
-- solfascribe-omr (Audiveris behind a small web wrapper), to be turned into MusicXML. It was never useful,
-- the service was never deployed, and the switch was off in production. "A piece from a photo or PDF"
-- (ML-246, piece_from_photo) replaces it. "Import from MusicXML" (flow_import_musicxml, ML-204) stays: it
-- shares the same screen and route, and only its PDF half has gone.
--
-- 1. The feature switch. Its rows in feature_access (071), and its links to back-test cases in
--    test_case_features (015), go with it: both reference features(id) ON DELETE CASCADE. A back-test that
--    was linked to it is moved to flow_import_musicxml first, since what it exercised is the MusicXML
--    import that is left (test cases are linked through test_case_features only - 015 dropped
--    test_cases.feature_id). feature_limits (084) is ON DELETE SET NULL, and had no limit for it.
INSERT INTO test_case_features (test_case_id, feature_id)
SELECT tcf.test_case_id, m.id
  FROM test_case_features tcf
  JOIN features f ON f.id = tcf.feature_id AND f.feature_key = 'flow_import_from_file'
  JOIN features m ON m.feature_key = 'flow_import_musicxml'
ON CONFLICT DO NOTHING;

DELETE FROM features WHERE feature_key = 'flow_import_from_file';

-- plan_feature_flags (008, not wired up) names features by key, with no reference to features(id).
DELETE FROM plan_feature_flags WHERE feature_key = 'flow_import_from_file';

-- 2. Its security review (ML-192) - the "PDF import service" tab on Admin -> Security. The automated runs
--    were kept per environment under target_key 'solfascribe-omr' (049); their results go with them
--    (security_review_results.run_id is ON DELETE CASCADE). The deep-review history was a file in the
--    repo (server/securityReviews/solfascribe-omr.js), removed in the same change; git keeps it.
--    This site's own review (target_key 'site', ML-231) is untouched.
DELETE FROM security_review_runs WHERE target_key = 'solfascribe-omr';
