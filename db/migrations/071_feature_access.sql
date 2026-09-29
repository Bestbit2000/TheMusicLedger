-- ML-345 / ML-346: features by account type. See docs/feature-access-plan.md.
--
-- ML-346: a Teacher account type (Premium's features plus teacher-only ones to come). Beta tester
-- already exists (Premium's features, free).
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_level_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_account_level_check
    CHECK (account_level IN ('super_admin', 'band_admin', 'premium_member', 'standard_member', 'beta_tester', 'teacher'));

-- ML-345: which account types have each feature. A feature is on for someone when features.enabled
-- (now "Live" - the master switch, off for everyone) is on AND their type's row here is on. Super admin
-- always has everything, so it has no rows. A type with no row for a feature (a brand-new feature)
-- doesn't have it until it's switched on (server/services/features.js, featureOn).
CREATE TABLE IF NOT EXISTS feature_access (
    feature_id BIGINT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    account_level TEXT NOT NULL CHECK (account_level IN ('band_admin', 'premium_member', 'standard_member', 'beta_tester', 'teacher')),
    enabled BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (feature_id, account_level)
);

-- The new gates ML-345 asks for.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('rehearse', 'Rehearse', 'The home screen''s Rehearse tool (ML-299): play your pieces along with the metronome. Gated by account type (ML-345).', true),
    ('flow_create', 'Add a piece', 'My music''s "Add a piece" - create your own or import (ML-329). Gated by account type (ML-345).', true),
    ('metronome_history', 'Metronome history', 'The Metronome''s "Show history" and the history it keeps of what you played (ML-34). Gated by account type (ML-345).', true),
    ('tuner_rewind', 'Tuner rewind', 'Rewinding the Tuner''s history to see what you played. Gated by account type (ML-345).', true)
ON CONFLICT (feature_key) DO NOTHING;

-- Everyone keeps what they have today: every feature on for every type (Live still decides globally).
INSERT INTO feature_access (feature_id, account_level, enabled)
SELECT f.id, t.level, true
  FROM features f
 CROSS JOIN (VALUES ('standard_member'), ('premium_member'), ('beta_tester'), ('teacher'), ('band_admin')) AS t(level)
ON CONFLICT (feature_id, account_level) DO NOTHING;

-- ...except Standard members, who don't get what isn't signed off yet (ML-345).
UPDATE feature_access SET enabled = false, updated_at = now()
 WHERE account_level = 'standard_member'
   AND feature_id IN (SELECT id FROM features WHERE feature_key IN (
       'rehearse', 'warmups', 'scales_practice',
       'theory_practice', 'theory_grades', 'theory_smart_learn', 'ear_training', 'tap_tempo', 'gap_trainer', 'range_trainer', 'rhythm_trainer',
       'practice_levels', 'challenges', 'flow_manage', 'manage_tutor',
       'flow_create', 'flow_import_musicxml', 'flow_import_from_file', 'flow_export_musicxml',
       'metronome_history', 'metronome_save_to_flow', 'tuner_rewind'));

-- The dev back-test account keeps everything by being a beta tester (a no-op anywhere it doesn't
-- exist). Standard members are tested with the local-standard account (/auth/login?as=standard).
UPDATE accounts SET account_level = 'beta_tester' WHERE email = 'local-dev@themusicledger.local';
