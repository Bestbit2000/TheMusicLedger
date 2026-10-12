-- ML-517: set-up for a new member - three short steps the first time they sign in (what they play, how
-- the app looks, who they play with), every one of which can be left empty, and which can be gone
-- through again from Settings.
--
-- accounts.setup_done_on is the day the member finished or left set-up. NULL = not seen yet, which is
-- what brings it up after signing in. Every account that already exists is marked as done here, so
-- nobody who has been using the app is asked. It is personal information: named in the privacy policy
-- and cleared when an account is deleted (server/services/accountDeletion.js).

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS setup_done_on DATE;
UPDATE accounts SET setup_done_on = CURRENT_DATE WHERE setup_done_on IS NULL;

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('member_setup', 'Set-up for new members', 'Three steps the first time a new member signs in (ML-517): what they play (and the clef they read), how the app looks, and who they play with. Every step can be left empty. "Set up again" in Settings goes through it again.', false)
ON CONFLICT (feature_key) DO NOTHING;
