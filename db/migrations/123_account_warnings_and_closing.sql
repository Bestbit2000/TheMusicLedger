-- ML-502: a member who breaks the terms can be warned, and their account closed. The terms say "we may
-- close the account of someone who shares it" - until now there was no way to (docs/account-closing.md).

-- 1. A closed account can't sign in: every sign-in token for it is refused and no new one is given.
--    Nothing is deleted - closing can be undone (Reopen) if the member appeals. Cleared when the
--    account is deleted.
ALTER TABLE accounts ADD COLUMN closed_at TIMESTAMPTZ;

-- 2. The record of each warning, closing and reopening: when, why, what the member was told, who by
--    (a name as text, as recording_removals keeps it). It is about the member, so it is theirs: an
--    account column, in "Download my information", and it goes when the account is deleted.
CREATE TABLE account_actions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('warning', 'closed', 'reopened')),
    reason TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    by_name TEXT NOT NULL DEFAULT '',
    emailed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_account_actions_account ON account_actions (account_id, created_at DESC);

-- 3. The block list: the email address of a closed account, as a keyed hash (the same one
--    deleted_account_markers uses - not the address, and not reversible without SESSION_SECRET). It is
--    what stops the same address signing up or being invited again, and it OUTLIVES the account: there
--    is no account column, so deleting the account leaves it. Reopening an account takes its entry out.
--    No IP address or anything else about the device is kept (the owner, 10 October 2026).
CREATE TABLE blocked_emails (
    email_hash TEXT PRIMARY KEY,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
