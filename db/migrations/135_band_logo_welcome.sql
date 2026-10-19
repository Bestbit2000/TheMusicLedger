-- ML-534: a band's logo, and "Welcome to the band" for someone who arrives from a band invitation.
--
-- The logo is on the band's shared space (a group): an image an organiser uploads to the file store, in the band's
-- own folder (band-logos/<band id>/...). It belongs to the band, not to whoever uploaded it - it stays when they
-- leave or delete their account (logo_set_by is then empty), and goes, file and all, with the band. Shown to the
-- band's members, and on the welcome to someone invited to it. The owner can take one down (Admin -> Shared music).

ALTER TABLE bands ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS logo_pathname TEXT;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS logo_set_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS logo_set_at TIMESTAMPTZ;

-- A take-down of a logo is kept like the other take-downs (Admin -> Shared music, "Removed").
ALTER TABLE recording_removals DROP CONSTRAINT IF EXISTS recording_removals_kind_check;
ALTER TABLE recording_removals ADD CONSTRAINT recording_removals_kind_check CHECK (kind IN ('rehearsal', 'piece', 'video', 'document', 'score', 'list', 'band', 'logo'));

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('band_welcome', 'A band''s logo and welcome', 'An organiser can give the band a logo (My bands -> the band''s Members page). Someone who arrives from a band''s invitation is welcomed by the band: its logo, who invited them, and what the band shares here - its pieces, practice lists and concert dates, recordings - with one button to join, then set-up straight away (ML-534).', true)
ON CONFLICT (feature_key) DO NOTHING;
