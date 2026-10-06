# Band directory

The shared list of bands players pick from (account page → My bands → add a band) and super admins
manage (Admin → Bands). It's the `bands` table, rows of kind `directory`.

## Three kinds of row (ML-473, migration 108)

The `bands` table holds three different things, told apart by `bands.kind`. Until migration 108 nothing
told them apart, which is how a member's private label came to be listed to everyone as a band anyone
could join (site security review, ML-231).

| Kind | What it is | Who sees it |
|---|---|---|
| `directory` | An entry in this directory: name, website, where it rehearses. No members, owns nothing | Everyone |
| `group` | A band's **shared space**: its members (`band_members`), its pieces and its practice lists. May point at the directory entry it is the space for (`directory_band_id`) | Its members only |
| `label` | One member's own name for who a rehearsal or performance was with (the old "organisation") | That member only |

**Joining is by invitation only** (the owner's decision, 6 Oct 2026: he does not want to be the one who
confirms who runs a band, so nobody has to be).

- Picking a band from the directory **starts your own space** for it; you are its first member and its
  first **organiser**. It never puts you into a space someone else started.
- Two people who pick the same band get **two separate spaces** and neither can see the other. So claiming
  a band's name gains nothing: a space holds only the people its members invited.
- The way into a space is an **invitation from one of its organisers**, addressed to the email address the
  other person signs in with. They see it on My bands and say yes or no. No email is sent, nothing tells
  the sender whether that address has an account, and an invitation nobody answers goes after 30 days
  (`band_invites`).
- **What a member may do is set by the organiser who invites them** (the owner, 6 Oct 2026: control stays
  with the person who started the band), and any organiser can change it afterwards. `band_members.role`,
  migration 109:

  | On screen | `role` | May |
  |---|---|---|
  | **Organiser** | `admin` | Everything below; invite, remove, cancel an invitation, set what others may do |
  | **Can change music** | `member` | Add pieces and practice lists to the band, and change the band's |
  | **Can play** | `player` | See and play the band's pieces and lists; change nothing. Can still copy a piece into their own library; their Levels are their own |

  "Organiser" is the owner's word - not "Librarian", which is a real post in a band and may not be this
  person. "Can play" is enforced in `flows.js` (`assertFlowAccess` / `assertBandMembership`) and
  `practiceLists.js` (`BAND_CAN_CHANGE_SQL`, `flowPermissions.js`); the screens follow `canEdit`.
  Whoever added a piece is still the one who can delete it or take it out (ML-411).
- A band always has an organiser: the only one can't step down, and if the last one leaves, whoever has
  been in it longest takes over (`ensureOrganiser`).
- A member sees the other members' **names**, never their email addresses.
- A practice session's "who" is always one of the member's own labels. The "who" box also offers the
  names of the bands they are in (`listWhoOptions`); picking one makes a label of that name.

Code: `server/services/bands.js`; tests `server/test/bandGroups.test.js` (dev database); screens
`specs/components/band-members.md` (My bands: the invitations waiting for you, and a band's Members page).

**Said at the moment of sharing (ML-468):** an invitation says the band will see your name; giving a piece
to a band says everyone in it will see and play it with its recordings and documents, and that it stays
with the band if you leave; a band's practice list says the same.

## What a band has

| Column | What | Notes |
|---|---|---|
| `name`, `website` | as the band writes them | the website is how duplicates are found |
| `ensemble_type` | Brass Band, Concert Band, Wind Band, Youth Brass Band, Youth Wind Band, Training Band, Brass Ensemble, Massed Band | the picker groups by these |
| `town`, `county`, `rehearsal_postcode` | where it rehearses | postcode only when a page states it |
| `section_level` | Championship, First, Second, Third, Fourth, Non-contesting | brass bands only (brassbandresults.co.uk) |
| `parent_band_id` | the main band a youth, training or second band belongs to | one level only |
| `notes` | anything else a player should know | e.g. "Meets once a year", "invitation-only" |

All of these came in with migration 073 and are optional. Admin → Bands edits them.

## How a band's name is shown (ML-405)

A band is named as it's said - **The Cobham Band** - wherever one band is named (My bands, Add a piece, My music's
band pills, "part of ...", confirm messages): `displayName`. It sorts by its name without "The", and only an A-Z
list shows that form, with a comma - **Cobham Band, The** (`listName`): the Choose a band to join picker and
Admin → Bands. Both come from `server/services/bands.js` (`toDirectoryBand`).

## Adding an area

Use the **band-directory** skill (`.claude/skills/band-directory/SKILL.md`): agree a centre and
radius, research and check every band on a real web page, save the checked list in `db/band-lists/`,
then `scripts/band-seed-migration.mjs` turns it into a migration. The rule that matters: nothing goes
in that wasn't found on a real page - a first draft of the Surrey list had invented bands.

The migration adds new bands and updates existing ones - matched by the same name, an `old_names`
label, or (for a main band) the same website domain - and never deletes. It's safe to run a list
again: it only updates.

## Areas covered

| List | Area | Bands | Migration |
|---|---|---|---|
| `db/band-lists/2026-09-29-woking-guildford.json` | ~15 miles of Woking and Guildford, incl. just over the Hampshire, Berkshire and Greater London borders | 45 | `073_band_directory_details.sql` |

## Later (not built)

- **Distance search:** latitude/longitude from each postcode (postcodes.io, free) so "bands near me"
  is a distance query - worth doing before going national. Written up with rehearsal nights as **ML-380** (Find a local band).
- **A yearly refresh:** re-check each list (step 6 of the skill), flag folded bands and section changes.
- **Player suggestions:** "add a band" on the account page could go to Admin → Bands for review.
