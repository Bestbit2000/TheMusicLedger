-- Vercel moved to the Pro plan on 7 October 2026: usage past the $20 a month it includes is billed,
-- where the free plan just stopped. So the owner needs to see what is being used and what it costs,
-- service by service, to judge where the bill is heading (Admin -> Costs and usage).
--
-- One row is what one service cost and used on one day, as the provider's billing API reported it
-- (Vercel: GET /v1/billing/charges, FOCUS format), added up across projects and regions. Read
-- daily; a day that is read again replaces what was there, since a provider can restate a day.
--
--   category  the provider's kind of charge: Usage, Purchase (the plan's fee), Credit, Tax, Adjustment
--   quantity  how much was used, in `unit` ('' and 0 when the charge isn't measured in units)
--   cost      US dollars
--
-- party_key is a key in server/thirdParties/register.js; no foreign key, because the register is a
-- file. No account column: it is the business's bill, not anything about a member
-- (docs/account-deletion.md).
CREATE TABLE third_party_usage_lines (
    party_key TEXT NOT NULL,
    day DATE NOT NULL,
    sku TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Usage',
    service TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT '',
    quantity NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (party_key, day, sku, category)
);
