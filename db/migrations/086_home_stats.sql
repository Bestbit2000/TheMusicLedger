-- ML-387: the stats on your home screen ("My stats") - numbers from the Stats page, chosen there with
-- "Choose Home stats". Null = the default (Practice time this week, Current practise streak). The ids are
-- checked by HOME_STAT_IDS in server/services/accounts.js (a new stat needs no migration).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS home_stats TEXT[];

-- How many fit is a limit by account type (ML-383), set on Admin -> Feature access (Limits): Standard 2,
-- everyone else 4 to start. Only how many show - home_stats keeps every choice.
INSERT INTO feature_limits (limit_key, feature_id, name, description)
VALUES ('home_stats', NULL, 'Home stats',
        'How many stats can be on Home (My stats), chosen on the Stats page. Two to a row.')
ON CONFLICT (limit_key) DO NOTHING;

INSERT INTO feature_limit_values (limit_id, account_level, value)
SELECT l.id, t.level, t.value
  FROM feature_limits l
 CROSS JOIN (VALUES ('standard_member', 2), ('premium_member', 4), ('beta_tester', 4), ('teacher', 4), ('band_admin', 4), ('super_admin', 4)) AS t(level, value)
 WHERE l.limit_key = 'home_stats'
ON CONFLICT (limit_id, account_level) DO NOTHING;
