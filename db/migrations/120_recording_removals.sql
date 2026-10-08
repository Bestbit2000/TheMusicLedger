-- ML-490: acting on a request to remove a recording. The privacy policy says anyone who is in a recording
-- can ask for it to be removed. When they do, the owner removes it from Admin -> Recordings: the stored
-- file and every piece it was on, in one go - it cannot stay anywhere once one person objects - and the
-- people it belonged to are told what happened, why, and what to do next. docs/rehearsal-score.md.

-- A notification could only go to everyone. One for particular members is audience 'accounts', with
-- who it is for in notification_recipients (an account column: cleared with the account).
ALTER TABLE notifications
    DROP CONSTRAINT notifications_audience_check,
    ADD CONSTRAINT notifications_audience_check CHECK (audience IN ('all', 'accounts'));
CREATE TABLE notification_recipients (
    notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    PRIMARY KEY (notification_id, account_id)
);
CREATE INDEX idx_notification_recipients_account ON notification_recipients (account_id);

-- The record of each removal: when, by whom, why, what, and how many people were told. It is the
-- business's record of having acted on a request, so it must outlive the accounts involved: names are
-- kept as text as they were that day (as review_log does), there is no account column, and nothing
-- about the person who asked is written here - only the reason.
CREATE TABLE recording_removals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    removed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_by TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL CHECK (reason IN ('person', 'copyright', 'other')),
    title TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL CHECK (kind IN ('rehearsal', 'piece', 'video')),
    pieces INTEGER NOT NULL DEFAULT 0,
    file_removed BOOLEAN NOT NULL DEFAULT false,
    people_told INTEGER NOT NULL DEFAULT 0,
    emails_sent INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT ''
);
