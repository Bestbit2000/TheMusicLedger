-- ML-496: the owner chooses who a notice is for on Admin -> Notifications - everyone, an account type, a band,
-- or named members. Owner, 8 Oct 2026:
--   * an account type is a rule: whoever has that type while the notice is live gets it;
--   * a band is a rule too: its members, and someone who joins while the notice is still live gets it as well;
--   * named members are a list, fixed when it is sent (notification_recipients, ML-490).
-- So the first two are kept as the rule itself, not as a list of people: audience 'account_level' with the type,
-- audience 'band' with the band (a shared band - kind 'group' - whose members are band_members). Every query a
-- member's notices come from checks it (FOR_ACCOUNT in server/services/notifications.js).
-- A band that is later deleted leaves its notices for nobody (ON DELETE SET NULL), with their read counts kept.
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS audience_account_level TEXT,
    ADD COLUMN IF NOT EXISTS audience_band_id BIGINT REFERENCES bands(id) ON DELETE SET NULL;

ALTER TABLE notifications
    DROP CONSTRAINT notifications_audience_check,
    ADD CONSTRAINT notifications_audience_check CHECK (audience IN ('all', 'accounts', 'account_level', 'band')),
    ADD CONSTRAINT notifications_audience_level_check CHECK ((audience = 'account_level') = (audience_account_level IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_notifications_audience_band ON notifications (audience_band_id) WHERE audience_band_id IS NOT NULL;
