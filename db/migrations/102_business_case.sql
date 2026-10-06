-- ML-443: Admin -> Business case. The owner's plan of what each way of rolling the app out costs and
-- could earn, month by month for up to five years: the launch month, a price list of costs, and the
-- scenarios that choose from it. See docs/business-case.md.
--
-- The whole plan is one JSON document. It is one person's working model, read and saved as a whole
-- and reshaped as the owner changes how the app is run, so it is not split into tables: the sums
-- (public/businessCase.js) tidy and check it on every save. There is one row today - the plan being
-- worked on. Until the owner saves a change there is no row, and the page shows the starting plan
-- (server/services/businessCaseDefaults.js). More rows are left open for kept copies later.
--
-- No account column: it is the business's plan, not a member's, so deleting an account never touches it.
CREATE TABLE business_plans (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'My plan',
    plan JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
