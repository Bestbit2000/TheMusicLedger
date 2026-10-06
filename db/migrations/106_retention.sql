-- ML-464: retention. An account nobody has used for a set time is warned by email twice and then
-- deleted (the owner's rule, 6 Oct 2026: emails at 22 and 23 months, deletion at 24). The rule itself
-- - a switch, a unit and three numbers - is a row in app_config ('retention_rule'), set on
-- Admin -> Retention; with no row it is OFF. See docs/retention.md.
--
-- retention_stage: how far an account has got - 0 nothing, 1 first email sent, 2 second email sent.
-- retention_stage_at: when that email went. Both go back to nothing the next time the account is used
-- (touchLastSeen). They say nothing about the member beyond "was warned", and go with the account.
ALTER TABLE accounts
    ADD COLUMN retention_stage SMALLINT NOT NULL DEFAULT 0 CHECK (retention_stage BETWEEN 0 AND 2),
    ADD COLUMN retention_stage_at TIMESTAMPTZ;
