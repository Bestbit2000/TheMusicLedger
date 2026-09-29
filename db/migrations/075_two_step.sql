-- ML-355 batch 2: two-step sign-in for email + password login - a 6-digit code from an authenticator app
-- (TOTP, RFC 6238) after the password, with 10 one-time recovery codes for a lost phone. Optional for
-- everyone, required for super admins (their first password login sets it up). Google logins rely on
-- Google's own 2-Step Verification. See docs/password-login.md.

CREATE TABLE account_two_step (
    account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    -- The TOTP secret, encrypted (AES-256-GCM, key from TWO_STEP_KEY or SESSION_SECRET - twoStep.js).
    secret_encrypted TEXT NOT NULL,
    -- NULL while being set up (the secret is shown, no code confirmed yet); set once a code is confirmed.
    enabled_at TIMESTAMPTZ,
    -- The last 30-second step a code was used for - the same code can't be used twice.
    last_used_step BIGINT NOT NULL DEFAULT 0,
    -- Too many wrong codes in a row pause it for a while (like wrong passwords).
    failed_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time recovery codes (SHA-256 only). A new set replaces the old.
CREATE TABLE account_recovery_codes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_account_recovery_codes ON account_recovery_codes (account_id) WHERE used_at IS NULL;
