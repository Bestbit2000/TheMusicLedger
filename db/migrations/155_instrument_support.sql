-- ML-610: Instrument support - a plain list of repairers, shops and hire near a player's bands (the "anyone know a
-- ...?" WhatsApp question). The owner adds every listing, from the business's own website, or one he knows personally
-- that has agreed to be listed; nobody adds themselves. No reviews, ratings or endorsements. Contact is outside the
-- app (the business's website or Facebook page, phone or email). Off until switched on (Admin -> Feature access).
-- docs/instrument-support.md.

CREATE TABLE IF NOT EXISTS support_businesses (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          TEXT NOT NULL,
    -- what it offers: repairs-brass, repairs-woodwind, repairs-percussion, shop-brass, shop-woodwind, shop-percussion, hire
    offers        TEXT[] NOT NULL DEFAULT '{}',
    -- also shown everywhere, under "Anywhere in the UK" (it works by post or courier, delivers, or sells online)
    uk_wide       BOOLEAN NOT NULL DEFAULT false,
    town          TEXT,
    county        TEXT,
    postcode      TEXT,
    -- where it is, looked up from its postcode (or town) - "within about 45 minutes" is measured from here
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    link_url      TEXT,
    link_kind     TEXT NOT NULL DEFAULT 'website' CHECK (link_kind IN ('website', 'facebook')),
    phone         TEXT,
    email         TEXT,
    what_they_do  TEXT,
    -- 'website': checked on its own website; 'owner': known to the owner, and agreed to be listed
    source        TEXT NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'owner')),
    checked_on    DATE,
    checked_url   TEXT,
    hidden        BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS support_businesses_name_key ON support_businesses (lower(name));

-- What people looked for, counted per day - never who. "near" is the place the list was for (a town, or
-- "My bands' towns"); empty_searches counts the ones with nothing within 45 minutes.
CREATE TABLE IF NOT EXISTS support_search_counts (
    day             DATE NOT NULL,
    looked_for      TEXT NOT NULL,
    near            TEXT NOT NULL,
    searches        INTEGER NOT NULL DEFAULT 0,
    empty_searches  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, looked_for, near)
);
-- How often each listing was shown, per day (for the owner now; for a business that claims its listing, later)
CREATE TABLE IF NOT EXISTS support_listing_counts (
    day          DATE NOT NULL,
    business_id  BIGINT NOT NULL REFERENCES support_businesses(id) ON DELETE CASCADE,
    shown        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, business_id)
);

-- Where a postcode or a town is, looked up once with postcodes.io and kept (a band's rehearsal postcode or town,
-- a town someone picked, a business's postcode). key: 'postcode:GU22 9PR' or 'place:woking'.
CREATE TABLE IF NOT EXISTS place_locations (
    key           TEXT PRIMARY KEY,
    label         TEXT,
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    looked_up_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('instrument_support', 'Instrument support', 'Repairers, shops and hire near your bands (ML-610): a menu item under My instruments, and a link from My instruments. A plain list the owner keeps - within about 45 minutes of your bands'' towns, nearest first, then UK-wide ones that post or sell online. Contact is outside the app. Searches are counted, never who searched. Admin -> Instrument support.', false)
ON CONFLICT (feature_key) DO NOTHING;
