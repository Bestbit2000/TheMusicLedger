# Feature access by account type - plan (ML-345, with ML-346)

Status: **built on dev** (2026-09-29): migration `071_feature_access.sql`, `server/services/features.js`,
`resolveAccount` (server/middleware/auth.js), `renderFeatureGates` (app.js), Admin → Feature access
(admin.js, spec `specs/components/admin-feature-access.md`). Read this before adding a feature gate.

**Adding a feature gate:** add the feature with "+ Add feature" on Admin → Feature access (ML-414: the old Features page is folded into it - each feature's ⋮ has Edit and Delete) or in a migration, check it with
`isFeatureEnabled('key')` on the server and in `renderFeatureGates` in the app, then switch it on for
the account types that should have it on Admin → Feature access. Until then only super admins have it.

## Why

A first outside user is about to use the basic app, on production. Everything not yet signed off has
to be hidden from them, while the owner, beta testers, teachers and paying members keep it. Today a
feature is one global on/off (`features.enabled`), so it's all or nothing. We need **a feature list per
account type**, not per person.

## The model

- **Account types** (`accounts.account_level`), after ML-346:

  | Type | Who |
  |---|---|
  | Standard member | Everyone by default, free |
  | Premium member | Paid tier (billing is still to come) |
  | Beta tester | Premium's features, free (ML-346) |
  | Teacher | **New** (ML-346). Premium's features plus teacher-only ones (none exist yet) |
  | Band admin | Already exists |
  | Super admin | The owner |

- **New table `feature_access`**: `feature_id` → `features`, `account_level`, `enabled`, primary key
  (`feature_id`, `account_level`). One row per feature per account type.
- **`features.enabled` stays**, renamed on screen to **Live**. It's the master switch: off means off
  for everyone, whatever the account type (the kill switch). A feature is on for someone only when
  it's Live **and** on for their account type.
- **A feature with no row for an account type** (a brand-new feature) is on only for Super admin until
  it's switched on for others. That's safer on production than today's "no row = on".
- **Not per person.** An individual's features come only from their account type.

## New gates (ML-345's list)

| ML-345 asks for | Feature key | Exists? | Wired in the app today? |
|---|---|---|---|
| Rehearse | `rehearse` | **new** | - |
| Warm-ups | `warmups` | yes | yes |
| Scales | `scales_practice` | yes | yes |
| Every Learn tool (Theory, Pitch, Tempo, Pulse, Range, Rhythm) | `theory_practice`, `theory_grades`, `ear_training`, `tap_tempo`, `gap_trainer`, `range_trainer`, `rhythm_trainer` | yes | yes |
| Practice sessions | `practice_levels` | yes | yes |
| Show history on the Metronome | `metronome_history` | **new** | - |
| Rewind history on the Tuner | `tuner_rewind` | **new** | - |
| Challenges in the menu | `challenges` | yes | **no - to wire** (menu item and "Start a challenge") |
| My music in the menu | `flow_manage` | yes | yes |
| Export to MusicXML | `flow_export_musicxml` | yes | yes |
| Add a piece (the tool, and in My music - ML-400) | `flow_create` | **new** | - |
| Invite someone in the menu (ML-402; also needs `password_login` Live) | `invite_members` | **new** | yes |
| My teachers in My account | `manage_tutor` | yes | **no - to wire** |

Standard member starts with all of these **off**. Everything else (Metronome, Tuner, Timer, Log time,
Stats, Notifications, Send feedback...) stays on. Save to flow and Import from MusicXML go off too,
since they need My music.

## Server

1. **One lookup** loads the whole access table (a few hundred rows) into memory for 30 seconds, so a
   check costs nothing per request.
2. `resolveAccount` also sets `req.accountLevel` and runs the rest of the request inside
   `featureContext` (AsyncLocalStorage), so every `isFeatureEnabled('key')` - the 13 existing checks
   included - answers for the caller's account type without being changed.
3. The startup bootstrap (`/api/dropdown-options` → `enabledFeatures`) returns the account's own list,
   so the client code (`isFeatureEnabled` in app.js) doesn't change.
4. **Server checks for the new gates** where there's an endpoint:
   - creating a piece (`POST /api/flows`) needs `flow_create` or `metronome_save_to_flow`
   - Metronome history (`/api/metronome/*` history) needs `metronome_history`
   - challenges endpoints need `challenges`
   - teachers endpoints need `manage_tutor`

   Tuner rewind and the Rehearse tile are browser-only.

## App

Wire the new and unwired gates in `renderFeatureGates`:

- the Rehearse tile, the Metronome's Show history link, the Tuner's rewind controls
- Challenges (menu item and "Start a challenge")
- Add a piece (the All tools tile and My music's button, ML-400)
- My account's My teachers row

When Challenges and Practice sessions are both off, the home screen keeps just **Add session time**.

## Admin → Feature access (the new page)

- **A new admin section.** Features stays the catalogue (add, rename, describe, delete).
- **All account types** (desktop):
  - A grid: features down the side, grouped (Tools - Everyday / My routine / Practise / Learn, Practice
    sessions, Menu, My music, Metronome and tuner, Core), with **Live** then one column per account
    type.
  - A tick per cell. A changed cell is outlined until saved.
  - "Same as Premium" under Beta tester.
- **One account type** (a tab each - the phone view):
  - A switch per feature with its description.
  - "14 of 34 features on".
  - **Copy from…** another type.
- **Save / Discard bar.** Changes are saved together, not one tap at a time, because this changes
  production for real people. It shows how many changes are waiting.
- **Preview the app as…** opens the app as a chosen account type, for a super admin only, to check
  what that person would see. The server honours it for super admins, so refusals are real too.
- **Accounts page:** the account type picker gets Teacher.
- **New classes:**
  - `.admin-access-table`, `.admin-access-group`, `.admin-access-live`, `.admin-access-cell`
    (`.is-changed`), `.admin-access-copy`, `.admin-access-savebar`, `.admin-access-row`,
    `.admin-access-toolbar`
  - a spec (`specs/components/admin-feature-access.md`) and an Admin → Design entry
  - design sign-off before sandbox

## Tests

- Unit tests for the rule: Live AND type row; no row = Super admin only.
- **The local test account is a standard member.** Once Standard is gated, most back-tests would
  fail. So:
  - the dev account `local-dev` becomes a **beta tester** on dev
  - a third dev login (`/auth/login?as=standard`) is a standard member, for a new back-test that
    checks what a standard member does and doesn't see, in the app and from the server
- Back-test for the admin page (change a cell, save, preview as).

## Migrations and rollout

1. `071_feature_access.sql`:
   - `teacher` added to the `account_level` check
   - `feature_access` created and filled from today's `features.enabled` for every type
   - the four new features added
   - Standard member's ML-345 gates switched off
   - local-dev → beta tester (dev only; the migration skips it when the account isn't there)
2. Dev → sandbox (design sign-off) → production, with 071 applied to sandbox and production before
   the new user signs in. Production's current per-feature settings carry over to every type, so
   nobody loses anything except Standard members' gated items.

## Decisions (owner, 2026-09-29)

1. **Beta tester:** its own column, copied from Premium once ("Same as Premium" copies, it doesn't
   link).
2. **Teacher and Band admin:** both start as copies of Premium, then are set separately.
3. **Super admin:** always everything. The column is locked on, and "Preview the app as…" is how to
   check what another type sees.
4. **A brand-new feature:** Super admin only until it's switched on for other account types.

Related: [database-schema.md](database-schema.md) (`features`, the dormant `plan_feature_flags` for
billing later), [ML-190 gates](sheets-to-database-cutover.md).

## Limits (ML-383)

Some things aren't on/off but **how much**: a number per account type, set on Admin → Feature access
(a **Limits** group, last in both layouts, saved with the rest) - so it can change without a code update.

- Tables: `feature_limits` (`limit_key`, name, description, optional `feature_id`) and
  `feature_limit_values` (`limit_id`, `account_level`, `value` 0-100000) - `084_feature_limits.sql`.
  Unlike `feature_access`, Super admin has a value too.
- Server: `getLimit('key', fallback)` (server/services/features.js) for the request's account type;
  a type with no value gets the fallback. The app gets its own type's limits at startup as
  `appData.limits` (`GET /api/dropdown-options`). Cached for 30 seconds like the features.
- **`metronome_history_shown`** - how many plays the Metronome's Show history lists: Standard 10,
  everyone else 100 to start. **Favourites count towards it** (owner decision): favourites first, then the
  most recent, that many in all. Every play is still kept (ML-366), so moving up a type shows the older
  ones straight away. Under the list: "Limited to the last N metronome plays". Standard members only see
  it once `metronome_history` is switched on for them.
- **`home_tools`** (ML-388, migration 085) - how many favourite tools a player can have on Home ("My favourite tools"; the limit is named Favourite tools on the admin page, ML-412): Standard 4,
  everyone else 8 to start (the owner may raise it to 12 as more tools get used). The app reads
  `appData.limits.home_tools` (4 if unset). Only how many *show*: `accounts.home_tools` keeps every
  favourite, so moving down a type hides the later ones and moving back up brings them back. The tile row
  is four to a row, so 8 is two rows.
- **`home_stats`** (ML-387, migration 086) - how many stats can be on Home ("My stats"): Standard 2,
  everyone else 4. The app reads `appData.limits.home_stats` (2 if unset); choices past it are kept, just
  not shown. See docs/home-greeting.md "My stats".

**Adding a limit:** a migration inserting the `feature_limits` row and a value per type, then
`getLimit('your_key', default)` where it's used (and `appData.limits.your_key` in the app if the app
shows it).
