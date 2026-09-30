-- ML-388: how many tools a player can put on Home ("My tools") - a limit by account type (ML-383), set on
-- Admin -> Feature access (Limits), so it can go up (e.g. 8 -> 12) without a code update. Standard 4,
-- everyone else 8 to start (Beta tester/Teacher/Band admin get Premium's, as with metronome_history_shown).
-- Only how many show: accounts.home_tools keeps every favourite, so moving down a type hides the later
-- ones and moving back up shows them again. A type with no value gets 4 (HOME_TOOLS_MAX_DEFAULT in app.js).
INSERT INTO feature_limits (limit_key, feature_id, name, description)
VALUES ('home_tools', NULL, 'Home tools',
        'How many tools can be on Home (My tools), chosen on the All tools page. Every four is another row.')
ON CONFLICT (limit_key) DO NOTHING;

INSERT INTO feature_limit_values (limit_id, account_level, value)
SELECT l.id, t.level, t.value
  FROM feature_limits l
 CROSS JOIN (VALUES ('standard_member', 4), ('premium_member', 8), ('beta_tester', 8), ('teacher', 8), ('band_admin', 8), ('super_admin', 8)) AS t(level, value)
 WHERE l.limit_key = 'home_tools'
ON CONFLICT (limit_id, account_level) DO NOTHING;
