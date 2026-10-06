-- ML-465: a member can change the email address their account uses (server/services/emailChange.js).
-- The new address is proved first: a link is emailed to it, and nothing changes until it is used.
-- That link is a third kind of one-time emailed link, beside an invite and a password reset:
--   purpose 'change-email', email = the NEW address, for_account_id = the account it will change.
-- for_account_id is an account column, so deleting the account takes its links with it (ON DELETE
-- CASCADE - and account deletion clears every table that points at an account anyway,
-- docs/account-deletion.md).
ALTER TABLE auth_email_links
    DROP CONSTRAINT auth_email_links_purpose_check,
    ADD CONSTRAINT auth_email_links_purpose_check CHECK (purpose IN ('invite', 'reset', 'change-email')),
    ADD COLUMN for_account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
CREATE INDEX idx_auth_email_links_for_account ON auth_email_links (for_account_id) WHERE for_account_id IS NOT NULL;

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('change_email', 'Change my email address', 'On My details, a member can change the email address their account uses. A link is sent to the new address and nothing changes until it is opened; then they are signed out everywhere and sign in with the new address. A super admin can start the same change for a member from Admin -> Accounts.', true)
ON CONFLICT (feature_key) DO NOTHING;
