-- Accounts, bands, tutors. See docs/database-schema.md "Identity, bands & tutors".

CREATE TABLE accounts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bands (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    website TEXT,
    contact_email TEXT,
    created_by_account_id BIGINT NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE band_members (
    band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (band_id, account_id)
);

-- Soft lookup, deliberately not accounts: a tutor doesn't need to ever log in.
CREATE TABLE tutors (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    display_name TEXT NOT NULL,
    first_name TEXT,
    surname TEXT,
    email TEXT,
    active BOOLEAN NOT NULL DEFAULT true
);

-- Connects a tutor lookup row to a real login, only if/when that tutor has one.
CREATE TABLE tutor_account_links (
    tutor_id BIGINT NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tutor_id, account_id)
);

-- Points at tutor_id (not account_id) so a grant can exist before the tutor
-- has linked a login - it just resolves once tutor_account_links connects them.
CREATE TABLE progress_view_grants (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tutor_id BIGINT NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    UNIQUE (student_account_id, tutor_id)
);

CREATE INDEX idx_band_members_account ON band_members (account_id);
