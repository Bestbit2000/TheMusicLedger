-- ML-430: "Delete my account" (Account -> My details). The member does it themselves, at once.
-- See server/services/accountDeletion.js and docs/account-deletion.md.
--
-- The accounts row is not removed: 39 tables cascade from it, which would take the practice history
-- with it. It is anonymised in place instead - name, email, picture and settings scrubbed - so the
-- sessions, quiz and drill results and piece-entry timings stay as statistics with nobody attached
-- (owner, 4 Oct 2026). Everything else the member made is deleted.

-- When the account was deleted (and so anonymised). NULL for a live account.
ALTER TABLE accounts ADD COLUMN deleted_at TIMESTAMPTZ;

-- "Signed out everywhere" has to hold after a deletion too. A login token is tied to an email and to
-- accounts.token_version; once the row no longer carries that email, an old token on another device
-- would count as a first login and quietly make a new account. This keeps the number an old token
-- must beat, against a keyed hash of the email (HMAC with SESSION_SECRET - not the address, and not
-- reversible without the secret). A row is dropped when that email signs up again, and after 31 days
-- in any case (login tokens last 30).
CREATE TABLE deleted_account_markers (
    email_hash TEXT PRIMARY KEY,
    token_version INTEGER NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
