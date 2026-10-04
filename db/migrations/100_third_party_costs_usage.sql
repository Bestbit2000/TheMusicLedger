-- ML-429: what the app costs, and how close it is to each plan's limit (release 2 of ML-267).
-- Admin -> Third parties shows both. See docs/third-party-providers.md ("Costs and usage").

-- A cost the owner has taken on: one-off, or repeating every week / month / year from started_on
-- until ended_on (still running when that is empty). Entered in the currency it is charged in -
-- most are US dollars - and shown in pounds with dollars beside it, using the owner's own rate
-- (app_config 'usd_per_gbp'). party_key is a key in server/thirdParties/register.js; no foreign
-- key, because the register is a file, not a table.
CREATE TABLE third_party_costs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    party_key TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL CHECK (currency IN ('GBP', 'USD')),
    cadence TEXT NOT NULL CHECK (cadence IN ('one_off', 'weekly', 'monthly', 'yearly')),
    started_on DATE NOT NULL,
    ended_on DATE,
    created_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ended_on IS NULL OR ended_on >= started_on)
);

-- One reading of one meter (server/thirdParties/meters.js): how much of a plan's allowance has been
-- used. Taken once a day by the scheduled job, on "Read now", when the app itself sends an email
-- (Resend tells us the count), or typed in by the owner. period_* is the billing period the reading
-- belongs to, when the source says; otherwise the calendar month it was read in.
CREATE TABLE third_party_usage_readings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    meter_key TEXT NOT NULL,
    value NUMERIC NOT NULL CHECK (value >= 0),
    source TEXT NOT NULL CHECK (source IN ('app', 'api', 'manual')),
    period_start DATE,
    period_end DATE,
    note TEXT,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_third_party_usage_readings_meter ON third_party_usage_readings (meter_key, read_at DESC);

-- A warning email goes once per meter, threshold (75, 90) and period - this is what stops it
-- going again every day until the period ends.
CREATE TABLE third_party_usage_alerts (
    meter_key TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    period_key TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (meter_key, threshold, period_key)
);

-- How many US dollars a pound buys - the owner's own figure, changed on the page. 1.30 is only a
-- starting point.
INSERT INTO app_config (key, value) VALUES ('usd_per_gbp', '1.30') ON CONFLICT (key) DO NOTHING;
