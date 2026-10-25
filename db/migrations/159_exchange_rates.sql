-- ML-612: what a US dollar cost in pounds, month by month. Most of what the app pays for is charged in
-- dollars, and the rate moves; each payment on Admin -> Costs and usage (and in the business case's
-- actual v forecast) is changed into pounds at the rate for the month it was paid in. The rate is HMRC's
-- monthly exchange rate - the one HMRC accepts for tax - read from its published file by the daily job
-- (server/services/exchangeRates.js). The owner can type a month's rate in on the page; a typed one is
-- never overwritten by HMRC's. app_config 'usd_per_gbp' stays as the fallback for when there is none.
-- No account column: it is a fact about money, not about anyone (docs/account-deletion.md).
CREATE TABLE exchange_rates (
    month DATE PRIMARY KEY CHECK (extract(day FROM month) = 1), -- the first of the month
    usd_per_gbp NUMERIC(10, 4) NOT NULL CHECK (usd_per_gbp > 0),
    source TEXT NOT NULL CHECK (source IN ('hmrc', 'manual')),
    read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
