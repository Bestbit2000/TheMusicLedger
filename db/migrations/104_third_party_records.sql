-- ML-462: what the owner records about a third party on the site itself (Admin -> Third parties), so
-- it doesn't need a code change: his own reference (an account or registration number), a note, and
-- which "needs attention" items he has dealt with. The register of third parties stays a file in the
-- repo (server/thirdParties/register.js); this sits beside it, keyed by the entry's key - no foreign
-- key, because the register is not a table. See docs/third-party-providers.md ("Your own records").
--
-- reference can be something private (a registration's security number): it is only ever sent to a
-- super admin, on the admin page. No account column: it is the business's record, not a member's.
CREATE TABLE third_party_records (
    party_key TEXT PRIMARY KEY,
    reference TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    attention_done JSONB NOT NULL DEFAULT '[]', -- [{ "text": the item as the register words it, "on": "2026-10-06" }]
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
