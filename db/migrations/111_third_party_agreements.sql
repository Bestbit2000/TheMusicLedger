-- ML-469: UK GDPR expects a written contract (a data processing agreement) with every company that
-- holds personal information for the app, and a named safeguard where that information can be reached
-- from outside the UK. The assessment (ML-221) found neither was recorded anywhere. They are facts the
-- owner changes as he signs things, so they sit with his other records about a third party
-- (third_party_records, ML-462) - on the site, not in the code.
--
--   agreement_status    '' (not recorded yet) | in_place | not_in_place | not_needed
--   agreement_on        the day it was signed or accepted, when in place and known
--   transfer_safeguard  '' (not recorded yet) | data_bridge (the UK-US data bridge) | uk_addendum (the
--                       UK addendum in its agreement) | adequacy (a country the UK treats as adequate,
--                       e.g. the EU) | not_needed
-- Which third parties this is asked of is in the register (`personalData: true`).
ALTER TABLE third_party_records
    ADD COLUMN agreement_status TEXT NOT NULL DEFAULT '' CHECK (agreement_status IN ('', 'in_place', 'not_in_place', 'not_needed')),
    ADD COLUMN agreement_on DATE,
    ADD COLUMN transfer_safeguard TEXT NOT NULL DEFAULT '' CHECK (transfer_safeguard IN ('', 'data_bridge', 'uk_addendum', 'adequacy', 'not_needed'));

-- Where things stood on 6 October 2026, as the owner said: Neon signed that day; PostHog signed
-- (no date given); Vercel has no agreement on the Hobby plan (its agreement covers Pro), and Vercel
-- Blob is the same account; the Gmail account that sends the app's email has none. Google sign-in and
-- every transfer safeguard are left for him to record. He can change any of these on the page.
INSERT INTO third_party_records (party_key, agreement_status, agreement_on) VALUES
    ('neon', 'in_place', DATE '2026-10-06'),
    ('posthog', 'in_place', NULL),
    ('vercel', 'not_in_place', NULL),
    ('vercel-blob', 'not_in_place', NULL),
    ('gmail-smtp', 'not_in_place', NULL)
ON CONFLICT (party_key) DO UPDATE SET agreement_status = EXCLUDED.agreement_status, agreement_on = EXCLUDED.agreement_on, updated_at = now();
