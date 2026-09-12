-- Site-wide account levels (ML-77) - a different axis from band_members.role
-- (owner/admin/member, scoped to one band): this is one level per account,
-- global across the whole app. Five tiers per the ticket; standard_member is
-- the default for everyone going forward. Plain TEXT + inline CHECK, same
-- enum pattern as band_members.role/sessions.session_type - no native
-- Postgres ENUM type used anywhere in this schema.
--
-- Bootstraps the one real account known today to super_admin so there's
-- always at least one account able to promote anyone else from the admin
-- panel; a no-op on any branch where that email hasn't logged in yet (e.g. a
-- fresh dev branch) - promote yourself by hand there once you have, same as
-- duration_options' "no admin UI yet, edited by direct SQL" precedent
-- (docs/database-schema.md).

ALTER TABLE accounts ADD COLUMN account_level TEXT NOT NULL DEFAULT 'standard_member'
  CHECK (account_level IN ('super_admin', 'band_admin', 'premium_member', 'standard_member', 'beta_tester'));

UPDATE accounts SET account_level = 'super_admin' WHERE email = 'andrew.jr.storey@gmail.com';
