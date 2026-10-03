-- ML-402: any member can invite someone to the app from the main menu (it used to be Admin -> Accounts
-- only). A feature, so it can be switched off or limited by account type on Admin -> Feature access;
-- on for every type to start. A member's invite always makes a Standard member; a super admin picks the
-- type. It also needs password_login to be Live - an invite is an email-and-password account.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('invite_members', 'Invite someone', 'The main menu''s Invite someone (ML-402): send an email invite to join as a Standard member, see your own invites that are waiting and cancel them. A super admin also picks the account type. Needs Email and password login to be Live.', true)
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO feature_access (feature_id, account_level, enabled)
SELECT f.id, t.level, true
  FROM features f
 CROSS JOIN (VALUES ('standard_member'), ('premium_member'), ('beta_tester'), ('teacher'), ('band_admin')) AS t(level)
 WHERE f.feature_key = 'invite_members'
ON CONFLICT (feature_id, account_level) DO NOTHING;

-- How many invites one person can send in 24 hours (Admin -> Feature access, Limits). 5 to start.
INSERT INTO feature_limits (limit_key, feature_id, name, description)
SELECT 'invites_per_day', f.id, 'Invites a day', 'How many invites one person can send in 24 hours from the main menu''s Invite someone.'
  FROM features f WHERE f.feature_key = 'invite_members'
ON CONFLICT (limit_key) DO NOTHING;

INSERT INTO feature_limit_values (limit_id, account_level, value)
SELECT l.id, t.level, 5
  FROM feature_limits l
 CROSS JOIN (VALUES ('standard_member'), ('premium_member'), ('beta_tester'), ('teacher'), ('band_admin'), ('super_admin')) AS t(level)
 WHERE l.limit_key = 'invites_per_day'
ON CONFLICT (limit_id, account_level) DO NOTHING;
