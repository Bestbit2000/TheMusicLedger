# Band directory

The shared list of bands players pick from (account page → My bands → join a band) and super admins
manage (Admin → Bands). It's the `bands` table - also used for the older per-account session "who"
labels, see `server/services/bands.js`.

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
