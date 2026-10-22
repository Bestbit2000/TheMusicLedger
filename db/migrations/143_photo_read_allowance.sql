-- ML-246: how many pieces one person can have read from a photo or PDF each quarter (Admin -> Feature access,
-- Limits). Built ready for the owner to open the feature up (21 Oct 2026); it stays Super admin only until he
-- does. His thinking: none for Standard, about 30 a quarter for Premium - Beta tester, Teacher and Band admin
-- have Premium's, as with the other limits. Super admin too (the owner, 22 Oct 2026: he wants to see the
-- count in action) - raised on Admin -> Feature access if his testing needs more.
-- A quarter is a calendar quarter (from 1 January, 1 April, 1 July and 1 October, UK time). Only a read that
-- gave an answer counts - not one that failed, and not a super admin's "Read again" of a kept test.
INSERT INTO feature_limits (limit_key, feature_id, name, description)
SELECT 'photo_reads_per_quarter', f.id, 'Photo reads a quarter',
       'How many times one person can have a piece read from a photo or PDF in a quarter (from 1 January, 1 April, 1 July and 1 October). A read that fails doesn''t count. Each read costs money (Admin -> Third parties, Vercel AI Gateway).'
  FROM features f WHERE f.feature_key = 'piece_from_photo'
ON CONFLICT (limit_key) DO NOTHING;

INSERT INTO feature_limit_values (limit_id, account_level, value)
SELECT l.id, t.level, t.value
  FROM feature_limits l
 CROSS JOIN (VALUES ('standard_member', 0), ('premium_member', 30), ('beta_tester', 30), ('teacher', 30), ('band_admin', 30), ('super_admin', 30)) AS t(level, value)
 WHERE l.limit_key = 'photo_reads_per_quarter'
ON CONFLICT (limit_id, account_level) DO NOTHING;
