-- A test_case could only belong to one feature via test_cases.feature_id.
-- ML-26/ML-29 chat asked for reuse across features - one spec (e.g. "add a
-- session, then check stats") legitimately exercises both session_logging
-- and stats_and_streaks. Replace the single FK with a join table.

CREATE TABLE test_case_features (
    test_case_id BIGINT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    PRIMARY KEY (test_case_id, feature_id)
);

CREATE INDEX idx_test_case_features_feature ON test_case_features (feature_id);

-- Carry over every existing test_cases.feature_id link before dropping it.
INSERT INTO test_case_features (test_case_id, feature_id)
SELECT id, feature_id FROM test_cases WHERE feature_id IS NOT NULL;

ALTER TABLE test_cases DROP COLUMN feature_id;
