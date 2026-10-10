-- ML-518: opening the admin panel asks a super admin to prove it is them - a passkey (the device's
-- fingerprint, face or PIN), or a code from their authenticator app (docs/admin-passkey.md).

-- 1. A super admin's passkeys, one per device. What is held is the public half of a key the device made,
--    the name they gave it and when it was used - never a fingerprint or a face, which stay on the
--    device. A passkey only works on the address it was made on (rp_id), so dev, sandbox and the live
--    site each have their own. It is the account's: an account column, so it is in "Download my
--    information" and goes when the account is deleted.
CREATE TABLE admin_passkeys (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports TEXT[] NOT NULL DEFAULT '{}',
    rp_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX idx_admin_passkeys_account ON admin_passkeys (account_id);

-- 2. The question the server asks a device while a passkey is being made or checked. Each is used
--    once and lasts five minutes; old ones are cleared as new ones are made. Housekeeping, not
--    information about the member.
CREATE TABLE admin_passkey_challenges (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('register', 'check')),
    challenge TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_admin_passkey_challenges_account ON admin_passkey_challenges (account_id);
