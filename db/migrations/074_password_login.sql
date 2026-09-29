-- ML-355 batch 1: email + password login, alongside Google. Invite-only: a super admin invites an email
-- address, and accepting the invite sets the password (which also proves the address). Forgot password
-- emails a one-time link. The email address is the username, so the same email is the same account
-- whichever way you log in. Everything is behind the password_login feature (off here - switch it on in
-- Admin -> Feature access when email sending is set up). 2FA is batch 2, admin tools batch 3.
-- See docs/password-login.md.

-- Bumped on a password change or reset: every token signed with an older number stops working
-- (server/utils/authToken.js), so a reset signs you out everywhere - Google sessions included.
ALTER TABLE accounts ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- An account's password (scrypt, server/services/passwords.js). No row = no password login.
CREATE TABLE account_passwords (
    account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Too many wrong passwords in a row locks password login for a while (not Google login).
    failed_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ
);

-- One-time links sent by email: an invite (7 days) or a password reset (1 hour). Only a SHA-256 of
-- the link's secret is stored, so a copy of this table can't be used to log in.
CREATE TABLE auth_email_links (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'reset')),
    token_hash TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    -- An invite's details, used only if the account doesn't exist yet.
    first_name TEXT,
    surname TEXT,
    account_level TEXT,
    created_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_email_links_email ON auth_email_links (lower(email), purpose, created_at DESC);

-- Rate limiting that works across serverless instances: one row per attempt, counted over a window
-- (server/services/passwordAuth.js). Rows older than a day are cleared as new ones arrive.
CREATE TABLE auth_rate_events (
    kind TEXT NOT NULL,
    key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_rate_events ON auth_rate_events (kind, key, created_at DESC);

-- MAIL_PROVIDER=log (local and dev): emails are written here instead of sent, so they can be read
-- (and back-tests can follow the links). Nothing is written here when real email is set up.
CREATE TABLE email_outbox (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    body_html TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('password_login', 'Email and password login', 'Log in with an email and password as well as Google (ML-355): invite-only sign-up, forgot password by email. Needs email sending set up (MAIL_PROVIDER). Only Live counts - it is used before anyone has logged in.', false)
ON CONFLICT (feature_key) DO NOTHING;
