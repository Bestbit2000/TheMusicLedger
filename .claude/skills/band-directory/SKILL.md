---
name: band-directory
description: Find, check and add concert, wind and brass bands (and their youth/training bands) around a town to the shared band directory, or re-check the bands already listed. Use when asked to find bands near somewhere, add an area's bands, extend the band list, or refresh/re-check the band directory.
---

# Band directory research

Builds a **checked list** of bands around a place, saves it in `db/band-lists/`, and turns it into a
migration with `scripts/band-seed-migration.mjs`. Read `docs/band-directory.md` first - it has the
columns, the matching rules and what's been covered so far (the lists in `db/band-lists/`).

The one rule that matters: **a band only goes in if you found it on a real web page in this session**
(its own site if it has one). Directory listings go stale and search summaries invent things - the
first draft of the Surrey list had two made-up bands and wrong postcodes. Never guess a postcode,
section or website.

## 1. Agree the brief with the owner

- The centre (one or more towns) and the radius - 15 miles was used for Woking/Guildford.
- Whether to include youth, training and county music service ensembles, and bands just over a
  county border (both were yes last time).
- Mode: **new area**, or **refresh** (re-check an existing list - see step 6).

Check what's already covered: the lists in `db/band-lists/` and the directory itself (dev:
`SELECT name, town, ensemble_type FROM bands WHERE active`). Production can be read (never written)
with the Neon MCP `run_sql` on project `little-haze-42527245`'s default branch - only if the owner
wants duplicates checked against live data.

## 2. Research (a background general-purpose agent works well - it's ~100 web requests)

Sources, in this order:
| Source | For |
|---|---|
| brassbandresults.co.uk region pages (e.g. `/regions/london-and-southern-counties`) | every brass band in a region, its **section**, and which bands are **extinct** |
| The county music service's ensembles page (e.g. Surrey Arts, Hampshire Music Hub) | youth and training ensembles, with venues |
| concert-bands.co.uk "by location" (county) | concert and wind bands |
| amateurorchestras.org.uk regional pages | concert/wind bands, venues (often out of date - confirm on the band's site) |
| makingmusic.org.uk group directory | members of Making Music, incl. one-off/occasional groups |
| Each band's own website | the name as the band writes it, where it rehearses, youth/training bands, recent concerts |

For each band record: `name`, `ensemble_type` (Brass Band, Concert Band, Wind Band, Youth Brass Band,
Youth Wind Band, Training Band, Brass Ensemble, Massed Band), `town`, `county`, `miles` (rough,
from the nearest centre), `rehearsal_postcode` (only if a page states it), `section_level`
(Championship, First, Second, Third, Fourth, Non-contesting - brass only, from BBR or the band's own
site if newer), `website`, `parent_name` (a youth/training/second band's main band - one level only;
a county music service is **not** a parent, say so in `notes`), `notes` (e.g. "Meets once a year"),
`sources` (the pages used), and whether it's still active (2025+ concerts or posts).

**Leave out:** contact emails, phone numbers and people's names (the script refuses emails);
university/student ensembles; church bands with no recent activity; anything only on one stale
directory. List those separately as "mentioned but not confirmed" for the owner.

## 3. Show the owner

Save the list as `db/band-lists/<yyyy-mm-dd>-<area>.json` (same shape as
`2026-09-29-woking-guildford.json`: `area`, `centre`, `radius_miles`, `checked_on`, `sources`, `bands`).
Send it (SendUserFile) with a short table - counts by type, what's over the border, anything unsure,
and the "not confirmed" list. Ask before going further; the owner may drop or add bands.

## 4. Make the migration

```bash
node --env-file=.env scripts/band-seed-migration.mjs db/band-lists/<list>.json --dry-run   # dev only, rolled back
node scripts/band-seed-migration.mjs db/band-lists/<list>.json                             # writes db/migrations/NNN_bands_<area>.sql
```

The dry run says how many bands would be added vs updated, and which existing bands would be renamed.
**Check every "updated" line**: an update renames the existing band to the list's name. If an existing
band is really the same band under an old label (production had "Bourne", "Cobham Main"), put that
label in the band's `old_names` so it's matched deliberately. If a match is wrong, fix the list and
regenerate - never hand-edit the migration.

Then apply to dev only: `node --env-file=.env db/migrate.js` (check `NEON_BRANCH=dev` first -
`docs/environments.md`), look at it in the app (account page band picker, Admin -> Bands), add the
migration to `docs/migrations.md`, and add the area to "Areas covered" in `docs/band-directory.md`.

## 5. Commit

Commit locally (the list, the migration, the docs). Push/release only when the owner says -
`docs/release-process.md`. Production gets the bands when the migration runs at release.

## 6. Refresh an existing list

Re-check every band in the list against its own site and BBR: still active? section changed? moved?
new youth/training band? Update the list file (`checked_on`, the changed fields) and regenerate - the
migration updates in place. A band that has folded is **not** deleted by the script: tell the owner,
and archive it from Admin -> Bands if they agree (a band with members or history is archived, never
removed).
