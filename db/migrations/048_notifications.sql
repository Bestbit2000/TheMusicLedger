-- ML-201: in-app notification centre. Super admins write notifications from the admin panel
-- (publish now or at a future time, optional expiry); every account sees each live one in the ☰ menu's
-- Notifications screen, with a red dot on ☰ while anything's unread. "Live" is computed at read time
-- (publish_at <= now, not expired, not withdrawn) - no scheduler/cron: a scheduled notification simply
-- starts matching that condition, and clients pick it up on their next poll (every ~5 minutes while
-- the app is open, and on every open/resume).
--
-- The "new version available - reload" notice is deliberately NOT a row here: it's about the code
-- running on one particular device, not an announcement, so the client works it out itself by
-- comparing its own running version with the server's (GET /api/notifications returns appVersion).

CREATE TABLE notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(btrim(title)) > 0 AND length(title) <= 120),
    -- Plain text; line breaks are kept on display, nothing is rendered as HTML.
    body TEXT NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 4000),
    -- Everyone, for now. Kept as a column so targeting (bands, account levels, plans) can be added
    -- without reshaping the table - the CHECK widens when a second value is actually supported.
    audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all')),
    publish_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Optional: after this, nobody sees it any more (read or not). Everyone - including accounts
    -- created after publish_at - sees a live notification until then.
    expires_at TIMESTAMPTZ,
    -- Soft "unpublish" that keeps the read statistics; a hard delete (cascading the reads) is also
    -- available from the admin panel.
    withdrawn_at TIMESTAMPTZ,
    created_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (expires_at IS NULL OR expires_at > publish_at)
);

-- The per-poll query: live, not withdrawn, newest first.
CREATE INDEX idx_notifications_publish ON notifications (publish_at DESC) WHERE withdrawn_at IS NULL;

-- One row per (notification, account) once read - absence means unread. Reading is the only write a
-- normal account ever makes to this feature.
CREATE TABLE notification_reads (
    notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (notification_id, account_id)
);
CREATE INDEX idx_notification_reads_account ON notification_reads (account_id);

-- Kill switch (checked client- and server-side), same pattern as `feedback` (045). Starts enabled.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('notifications', 'Notification centre', 'Red dot on the ☰ menu plus a Notifications screen: admin-written announcements (publish now or scheduled, optional expiry, read/unread per account), and an automatic "update available - reload" notice when the app running on a device is older than the deployed release. Managed under the admin panel''s Notifications tab.', true)
ON CONFLICT (feature_key) DO NOTHING;
