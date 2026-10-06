-- ML-473: the bands table held three different things with nothing to tell them apart, which is how
-- a member's private "organisation" came to be listed to everyone as a band anyone could join, and how
-- joining any band gave edit rights on everything it had (site security review, ML-231). Now each row
-- says what it is:
--
--   directory  an entry in the shared band directory: a name, a website, where it rehearses. Public
--              information, the same for everyone. It has no members and owns nothing.
--   group      a band's shared space: its members (band_members), its pieces and its practice lists.
--              Started by a member; the only way in is an invitation from someone already in it
--              (the owner's decision, 6 Oct 2026 - nobody has to confirm who anyone is). It can point
--              at the directory entry it is the space for (directory_band_id); two groups can point
--              at the same entry, and neither can see the other.
--   label      one member's own name for who a rehearsal or performance was with (the old Sheet's
--              "organisation"). Theirs alone: never listed to anyone else, never joinable.
--
-- No default on kind, on purpose: anything that adds a band has to say which it is.

ALTER TABLE bands
    ADD COLUMN kind TEXT,
    ADD COLUMN directory_band_id BIGINT REFERENCES bands(id) ON DELETE SET NULL,
    ADD COLUMN split_from BIGINT; -- only for this migration; dropped at the end

-- 1. What each row is today. Anything with members, pieces or practice lists is a group, whatever
--    else it is; of the rest, anything with directory details is a directory entry; the rest are labels.
UPDATE bands b SET kind = CASE
    WHEN EXISTS (SELECT 1 FROM band_members m WHERE m.band_id = b.id)
      OR EXISTS (SELECT 1 FROM scores s WHERE s.owner_band_id = b.id)
      OR EXISTS (SELECT 1 FROM practice_lists p WHERE p.owner_band_id = b.id) THEN 'group'
    WHEN b.website IS NOT NULL OR b.ensemble_type IS NOT NULL OR b.town IS NOT NULL OR b.county IS NOT NULL
      OR b.rehearsal_postcode IS NOT NULL OR b.section_level IS NOT NULL OR b.parent_band_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM bands c WHERE c.parent_band_id = b.id) THEN 'directory'
    ELSE 'label' END;

-- 2. A group that is also a directory entry is split in two. The row that has the members keeps its
--    id (so its pieces, lists and members don't move) and becomes the group; a new row takes over as
--    the directory entry, with the details.
INSERT INTO bands (name, website, contact_email, created_by_account_id, created_at, active, ensemble_type, town, county,
                   rehearsal_postcode, section_level, parent_band_id, notes, kind, split_from)
SELECT b.name, b.website, b.contact_email, b.created_by_account_id, b.created_at, b.active, b.ensemble_type, b.town, b.county,
       b.rehearsal_postcode, b.section_level, b.parent_band_id, b.notes, 'directory', b.id
  FROM bands b
 WHERE b.kind = 'group'
   AND (b.website IS NOT NULL OR b.ensemble_type IS NOT NULL OR b.town IS NOT NULL OR b.county IS NOT NULL
     OR b.rehearsal_postcode IS NOT NULL OR b.section_level IS NOT NULL OR b.parent_band_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM bands c WHERE c.parent_band_id = b.id));

-- A youth or training band's main band is the directory entry, not the group it was split from.
UPDATE bands c SET parent_band_id = d.id FROM bands d WHERE d.split_from = c.parent_band_id;

UPDATE bands g
   SET directory_band_id = d.id, website = NULL, contact_email = NULL, ensemble_type = NULL, town = NULL, county = NULL,
       rehearsal_postcode = NULL, section_level = NULL, parent_band_id = NULL, notes = NULL
  FROM bands d
 WHERE d.split_from = g.id;

-- 3. A practice session's "who" is always a label of the member whose session it is. Where it pointed
--    at a directory entry or a group (the member who added a band to the directory and then logged a
--    rehearsal with it), that member gets a label of the same name and the sessions move onto it.
INSERT INTO bands (name, created_by_account_id, kind)
SELECT DISTINCT b.name, s.account_id, 'label'
  FROM sessions s JOIN bands b ON b.id = s.band_id
 WHERE (b.kind <> 'label' OR b.created_by_account_id <> s.account_id)
   AND NOT EXISTS (SELECT 1 FROM bands l WHERE l.kind = 'label' AND l.created_by_account_id = s.account_id AND l.name = b.name);

UPDATE sessions s
   SET band_id = (SELECT min(l.id) FROM bands l WHERE l.kind = 'label' AND l.created_by_account_id = s.account_id AND l.name = b.name)
  FROM bands b
 WHERE b.id = s.band_id AND (b.kind <> 'label' OR b.created_by_account_id <> s.account_id);

-- 4. Every group has someone who looks after it (band_members.role 'admin' - on screen "Librarian").
--    Where nobody does, it is whoever has been in it longest.
UPDATE band_members m SET role = 'admin'
 WHERE NOT EXISTS (SELECT 1 FROM band_members o WHERE o.band_id = m.band_id AND o.role IN ('admin', 'owner'))
   AND m.account_id = (SELECT f.account_id FROM band_members f WHERE f.band_id = m.band_id ORDER BY f.joined_at, f.account_id LIMIT 1);

ALTER TABLE bands
    DROP COLUMN split_from,
    ALTER COLUMN kind SET NOT NULL,
    ADD CONSTRAINT bands_kind_check CHECK (kind IN ('directory', 'group', 'label')),
    ADD CONSTRAINT bands_directory_link_check CHECK (directory_band_id IS NULL OR kind = 'group');
CREATE INDEX idx_bands_kind ON bands (kind);

-- An invitation into a group: the only way in. It is addressed to an email address; the person who
-- signs in with that address sees it and says yes or no. No email is sent. An invitation nobody has
-- answered goes after 30 days (cleared whenever invitations are read or written), and with the group,
-- the member who sent it, or - by address - the account it was for.
CREATE TABLE band_invites (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    invited_by_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (band_id, email)
);
CREATE INDEX idx_band_invites_email ON band_invites (lower(email));
