-- ML-383: limits by account type - a number per account type, set on Admin -> Feature access (Limits),
-- so a limit can change without a code update. The first is how many Metronome plays "Show history"
-- lists: 10 for Standard members, 100 for everyone else (Premium's, as Beta tester/Teacher get
-- Premium's features). Favourites count towards it. Every play is still kept (ML-366) - the limit is
-- only how many are shown, so moving up a type shows the older ones straight away.
-- Unlike feature_access, Super admin has a row too (it's a number, not an on/off, so "always" doesn't
-- apply). A type with no row falls back to the default the code asks with (server/services/features.js).
CREATE TABLE IF NOT EXISTS feature_limits (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    limit_key TEXT NOT NULL UNIQUE,
    feature_id BIGINT REFERENCES features(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_limit_values (
    limit_id BIGINT NOT NULL REFERENCES feature_limits(id) ON DELETE CASCADE,
    account_level TEXT NOT NULL CHECK (account_level IN ('super_admin', 'band_admin', 'premium_member', 'standard_member', 'beta_tester', 'teacher')),
    value INTEGER NOT NULL CHECK (value BETWEEN 0 AND 100000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (limit_id, account_level)
);

INSERT INTO feature_limits (limit_key, feature_id, name, description)
SELECT 'metronome_history_shown', f.id, 'Metronome history',
       'How many plays the Metronome''s Show history lists (favourites included). The app says "Limited to the last N metronome plays".'
  FROM (SELECT 1) one LEFT JOIN features f ON f.feature_key = 'metronome_history'
ON CONFLICT (limit_key) DO NOTHING;

INSERT INTO feature_limit_values (limit_id, account_level, value)
SELECT l.id, t.level, t.value
  FROM feature_limits l
 CROSS JOIN (VALUES ('standard_member', 10), ('premium_member', 100), ('beta_tester', 100), ('teacher', 100), ('band_admin', 100), ('super_admin', 100)) AS t(level, value)
 WHERE l.limit_key = 'metronome_history_shown'
ON CONFLICT (limit_id, account_level) DO NOTHING;
