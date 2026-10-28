-- ML-646: Admin -> Waiting list's Let in can put someone straight into the band they asked to join (owner, 28 Oct 2026),
-- and band invitations get a quarterly allowance as well as a daily one.
--
-- 1. from_request: a band place made when the owner let someone in from the waiting list. They asked to join that
--    band, so it is accepted for them at their first sign-in (bands.js joinBandsAskedFor) - no Join tap. An
--    ordinary invitation (false) still waits for a yes.
ALTER TABLE band_invites ADD COLUMN IF NOT EXISTS from_request BOOLEAN NOT NULL DEFAULT false;

-- 2. Every band invitation email an organiser sends, so the day's and the quarter's count survive the invitation
--    being answered (band_invites rows go when it is). Deleted with the account; the band may go first.
CREATE TABLE band_invite_sends (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    band_id BIGINT REFERENCES bands(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_band_invite_sends_account ON band_invite_sends (account_id, sent_at);

-- 3. The two limits, by account type, on Admin -> Feature access (Limits). Not tied to one feature - inviting is part
--    of sharing a band. The day's was a fixed 20; a whole band of 25 may be let in at once, so it is raised. A quarter
--    is a calendar quarter in UK time, as the photo reads' allowance.
INSERT INTO feature_limits (limit_key, feature_id, name, description) VALUES
  ('band_invites_per_day', NULL, 'Band invitations a day', 'How many band invitations one organiser can send in 24 hours (each sends an email to an address they typed). Letting people in to a band from the waiting list counts too.'),
  ('band_invites_per_quarter', NULL, 'Band invitations a quarter', 'How many band invitations one organiser can send in a quarter (from 1 January, 1 April, 1 July and 1 October, UK time).')
ON CONFLICT (limit_key) DO NOTHING;

INSERT INTO feature_limit_values (limit_id, account_level, value)
SELECT l.id, t.level, v.value
  FROM feature_limits l
 CROSS JOIN (VALUES ('standard_member', 50, 300), ('premium_member', 50, 300), ('beta_tester', 50, 300), ('teacher', 50, 300),
                    ('band_admin', 50, 300), ('super_admin', 200, 2000)) AS t(level, per_day, per_quarter)
 CROSS JOIN LATERAL (SELECT CASE WHEN l.limit_key = 'band_invites_per_day' THEN t.per_day ELSE t.per_quarter END AS value) v
 WHERE l.limit_key IN ('band_invites_per_day', 'band_invites_per_quarter')
ON CONFLICT (limit_id, account_level) DO NOTHING;
