-- ML-497 / ML-501: notices the app sends itself when something happens to a member's things, and the member's
-- choice of which ones they get. The owner's answers, 21 Oct 2026:
--   * four kinds: an invitation to a band is waiting; what you can do in a band has changed, or you were taken out
--     of it; your band has new pieces or practice lists; a piece you added to a band was deleted by someone else;
--   * they name the band, never the person who did it; the list and the red dot only (never urgent);
--   * new pieces and practice lists are one notice a day per band, added to while it is unread;
--   * every kind is on until the member switches it off (Settings -> Notifications);
--   * behind their own feature switch, Super admin only until it is switched on for account types.
--
-- notifications.kind: what made an app-made notice (NULL = written by a super admin, or ML-490's notice about a
-- removed recording). details: what the notice is about, kept so its words can be worked out again (a band news
-- notice shows each piece's name as it is now). group_key: the notice a later event adds to - one band's news for
-- one member on one day ('band_news:<band>:<account>:<day>'), or an invitation ('band_invite:<invite id>', withdrawn
-- once it has been answered).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind TEXT
    CHECK (kind IN ('band_invite', 'band_level', 'band_removed', 'band_news', 'piece_deleted'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_key TEXT;
CREATE INDEX IF NOT EXISTS idx_notifications_group_key ON notifications (group_key) WHERE group_key IS NOT NULL;

-- Which kinds a member has switched off. No row = on (the owner's default). The kinds a member chooses between:
-- band_invite, band_change (what you can do changed, or taken out), band_news, piece_deleted.
CREATE TABLE IF NOT EXISTS notice_preferences (
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('band_invite', 'band_change', 'band_news', 'piece_deleted')),
    enabled BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, kind)
);

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('auto_notices', 'Automatic notices', 'Notices the app sends itself (ML-497): an invitation to a band is waiting; what you can do in a band has changed or you were taken out of it; new pieces and practice lists in your band (one a day per band); a piece you added to a band was deleted by someone else. They name the band, never the person. Each member can switch each kind off in Settings -> Notifications (ML-501). Needs the Notification centre too.', true)
ON CONFLICT (feature_key) DO NOTHING;
