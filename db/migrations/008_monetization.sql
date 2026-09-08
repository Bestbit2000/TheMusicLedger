-- Monetization. See docs/database-schema.md "Monetization" - sketch-level by
-- design. subscriber_id is polymorphic (account or band) with no FK
-- constraint; referential integrity is enforced at the application layer,
-- same pattern as metronome_run_logs.source_id.

CREATE TABLE subscription_plans (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
    applies_to TEXT NOT NULL CHECK (applies_to IN ('account', 'band')),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subscriber_type TEXT NOT NULL CHECK (subscriber_type IN ('account', 'band')),
    subscriber_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL REFERENCES subscription_plans(id),
    status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'canceled', 'past_due')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ,
    -- Deliberately just a bare pointer at whatever payment processor gets
    -- picked later (e.g. Stripe) - no billing detail stored here.
    external_payment_ref TEXT
);

CREATE INDEX idx_subscriptions_subscriber ON subscriptions (subscriber_type, subscriber_id);

CREATE TABLE plan_feature_flags (
    plan_id BIGINT NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (plan_id, feature_key)
);
