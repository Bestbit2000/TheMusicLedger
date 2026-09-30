-- ML-377: the avatar next to the home greeting - one of the app's drawn avatars (instruments and other
-- musical things), chosen in My account > My details. Null = your initials. No photos. The ids are
-- checked by AVATAR_IDS in server/services/accounts.js (a new avatar needs no migration).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar TEXT
    CHECK (avatar IS NULL OR avatar ~ '^[a-z][a-z-]{1,30}$');
