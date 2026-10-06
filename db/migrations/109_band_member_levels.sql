-- ML-473: what a member of a band may do is set by the organiser who invites them (the owner's
-- decision, 6 Oct 2026). band_members.role gains 'player' - sees and plays the band's pieces and
-- lists, changes nothing - beside 'member' (adds and changes the band's music) and 'admin' (an
-- organiser: all of that, and invites, removes and sets what others may do). Everyone already in a
-- band keeps what they could do before. An invitation carries the role it gives; 'player' unless said.
ALTER TABLE band_members DROP CONSTRAINT band_members_role_check;
ALTER TABLE band_members ADD CONSTRAINT band_members_role_check CHECK (role IN ('owner', 'admin', 'member', 'player'));
ALTER TABLE band_invites ADD COLUMN role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'member', 'player'));
