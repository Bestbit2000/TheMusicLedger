-- ML-498: a band's notice to its members, and ML-499: an email copy of urgent and important notices.
-- The owner's answers, 23 Oct 2026 (docs/notifications.md, "A band's notice" and "Email copies"):
--   * one way only - a title and a message to everyone in the band, nobody replies;
--   * sent by an organiser, a member who can change music, or the band leader;
--   * 3 a day and 10 a week per band (limits on Admin -> Feature access), title up to 120, message up to 1000;
--   * the member sees who sent it and which band ("From Sam Smith, The Cobham Band");
--   * a member can switch them off (Settings -> Notifications) - on until they do;
--   * an urgent or important notice can also go by email: the form says how many it will send and refuses more
--     than the day's allowance; a member can switch email copies of urgent notices off, never of important ones.
-- (Numbered 150: 148 and 149 belong to the Warm-ups and Scales branches, not released yet.)

-- A band's notice is one more kind of app-made notice, for named members (who is in the band when it is sent,
-- less anyone who switched them off). created_by_account_id is the sender; details holds { bandId }.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
    CHECK (kind IN ('band_invite', 'band_level', 'band_removed', 'band_news', 'piece_deleted', 'band_notice'));
CREATE INDEX IF NOT EXISTS idx_notifications_band_notice ON notifications (((details->>'bandId')::bigint), created_at)
    WHERE kind = 'band_notice';

-- ML-499: email_copy - asked for on the form; emailed_count / email_failed_count / emailed_at - how many went, once
-- they have been sent (when the notice is published). An edit never sends it again.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_copy BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_count INTEGER;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_failed_count INTEGER;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

-- The member's switches: band_notice (notices from my bands) and email_urgent (an email copy of urgent notices).
-- No row = on, as for the others.
ALTER TABLE notice_preferences DROP CONSTRAINT IF EXISTS notice_preferences_kind_check;
ALTER TABLE notice_preferences ADD CONSTRAINT notice_preferences_kind_check
    CHECK (kind IN ('band_invite', 'band_change', 'band_news', 'piece_deleted', 'band_notice', 'email_urgent'));

-- A band's notice can be reported, like anything else one member shows another (ML-507).
ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_kind_check;
ALTER TABLE content_reports ADD CONSTRAINT content_reports_kind_check CHECK (kind IN ('piece', 'band', 'list', 'notice'));

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('band_notices', 'Band notices', 'A band''s organisers, the members who can change its music and its band leader can send everyone in the band a notice - a title and a message, one way only, with their name on it (ML-498). Up to 3 a day and 10 a week per band. Members can switch them off in Settings -> Notifications. Needs the Notification centre too.', true),
    ('notice_emails', 'Email copies of notices', 'An urgent or important notice from Admin -> Notifications can also be emailed to the people it is for (ML-499). Members can switch off email copies of urgent notices in Settings -> Notifications; important ones always go. Only the account types switched on here get the emails.', true)
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO feature_limits (limit_key, feature_id, name, description)
SELECT v.limit_key, f.id, v.name, v.description
  FROM (VALUES
    ('band_notices_day', 'band_notices', 'Band notices a day', 'How many notices one band can send in 24 hours (ML-498).'),
    ('band_notices_week', 'band_notices', 'Band notices a week', 'How many notices one band can send in 7 days (ML-498).'),
    ('notice_emails_day', 'notice_emails', 'Notice emails a day', 'How many email copies of notices can go in 24 hours (ML-499). Brevo''s free plan sends 300 emails a day in all, so this leaves room for invitations and password resets.')
  ) AS v(limit_key, feature_key, name, description)
  JOIN features f ON f.feature_key = v.feature_key
ON CONFLICT (limit_key) DO NOTHING;

INSERT INTO feature_limit_values (limit_id, account_level, value)
SELECT l.id, t.level, CASE l.limit_key WHEN 'band_notices_day' THEN 3 WHEN 'band_notices_week' THEN 10 ELSE 250 END
  FROM feature_limits l
 CROSS JOIN (VALUES ('standard_member'), ('premium_member'), ('beta_tester'), ('teacher'), ('band_admin'), ('super_admin')) AS t(level)
 WHERE l.limit_key IN ('band_notices_day', 'band_notices_week', 'notice_emails_day')
ON CONFLICT (limit_id, account_level) DO NOTHING;
