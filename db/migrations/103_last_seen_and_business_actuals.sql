-- ML-443: two things the admin Dashboard and the business case need.
--
-- 1. accounts.last_seen_on - the day (not the time) a member last used the app while signed in, so the
--    owner can see who is active and who has lapsed. Written at most once a day per member
--    (touchLastSeen in server/services/accounts.js). Empty until the member next uses the app. It is
--    personal information: it is in the privacy policy, in "Download my information", and it is
--    cleared when the account is deleted (docs/account-deletion.md).
ALTER TABLE accounts ADD COLUMN last_seen_on DATE;

-- 2. business_actuals - one row a month: what really happened (members, money paid out) beside what
--    the business case forecast for that month. The actual figures are brought up to date every day
--    of the month and then stay as they were on its last day. The forecast is written once, the first
--    time the month is recorded, and never changed - so a later change to the plan can't hide how far
--    out the forecast was (server/services/businessActuals.js, docs/business-case.md).
--    No account column: it is the business's record, not a member's.
CREATE TABLE business_actuals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    month DATE NOT NULL UNIQUE,                 -- the first day of the month
    members INTEGER NOT NULL,                   -- accounts not deleted, as last counted in the month
    paid_gbp NUMERIC(12, 2) NOT NULL,           -- payments that fell in the month (Costs and usage), in pounds
    forecast_members INTEGER,                   -- from the scenario the owner was in; NULL if the plan didn't cover the month
    forecast_out_gbp NUMERIC(12, 2),
    forecast_in_gbp NUMERIC(12, 2),
    forecast_scenario TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
