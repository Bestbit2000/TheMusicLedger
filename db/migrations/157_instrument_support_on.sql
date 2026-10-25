-- ML-610: Instrument support switched on for everyone from release 0.71.0 (owner, 25 Oct 2026: "I want the
-- instrument support switched on from now"). Live, and every account type has it - it is free to use, like the
-- rest of finding your way to help (the owner's rule "free to use, pay to ease"). Super admin always has it.
-- Done here rather than on Admin -> Feature access so dev, sandbox and production end up the same. It can still be
-- switched off there; this runs once.
UPDATE features SET enabled = true WHERE feature_key = 'instrument_support';

INSERT INTO feature_access (feature_id, account_level, enabled)
SELECT f.id, t.level, true
  FROM features f
  CROSS JOIN (VALUES ('standard_member'), ('premium_member'), ('beta_tester'), ('teacher'), ('band_admin')) AS t(level)
 WHERE f.feature_key = 'instrument_support'
ON CONFLICT (feature_id, account_level) DO UPDATE SET enabled = true;
