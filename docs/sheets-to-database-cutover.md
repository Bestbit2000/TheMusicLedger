# Sheets → database cutover (app code, not data)

Status: **decisions locked in, ready to implement.** Nothing in
`server/routes/api.js` has been touched yet. This is the living reference for
this specific piece of work: swapping the running app's data layer from
Google Sheets to Postgres. It is deliberately separate from the actual
historical-data migration (moving Andrew's real practice history across),
which happens later, at a point in time Andrew chooses. Update this doc as
steps complete — it's meant to stay accurate, not be a one-time snapshot.

Related docs: [`database-schema.md`](database-schema.md) (the schema and why),
[`migrations.md`](migrations.md) (how the schema gets applied),
[`environments.md`](environments.md) (which Neon branch is which).

## Scope

**In scope now:** rewire the six endpoint groups below to read/write Postgres
via the schema already migrated to `sandbox`/`dev`. `production`'s database
has no schema yet - that's deliberate, this cutover gets proven on `sandbox`
first.

**Explicitly not in scope now:** moving Andrew's real historical Sheet data
into Postgres. `sandbox`/`dev` will simply start empty and accumulate
whatever gets entered while testing this. The real cutover of live data is a
separate, deliberate step for later.

**Also not in scope now (deliberately deferred, decided 2026-09-08):** a UI
edit screen for a band's `website`/`contact_email` fields. Those columns
exist and stay nullable - a band gets created with just a name (carried over
from the old organisation name) and `created_by_account_id` set to the one
account in the system today; filling in the rest happens later through a
proper edit screen, not as part of this cutover.

## Mapping: what exists today → what it becomes

| Today (Google Sheet) | Becomes | Notes |
|---|---|---|
| `Music time` sheet rows (Practise/Rehearsal/Lesson/Performance) | `sessions` table | `session_type` values are lowercase (`practice`, not `Practise`) - explicit mapping in code, not just a case change |
| Rehearsal/Performance "who" (free-text organisation name) | `bands` table, via `sessions.band_id` | **Decided:** organisations *are* bands now, not a separate concept. Find-or-create a `bands` row by name; `created_by_account_id` = the current (only) account; `website`/`contact_email` left null until filled in later via a future edit screen |
| Lesson "who" (free-text teacher name) | `sessions.tutor_id` → `tutors` table | Clean fit already - find-or-create by name |
| Settings tab: organisations list (name + archived flag) | `bands` table + new `bands.active` column | `bands` has no active/archived flag today - adding one (mirrors `tutors.active`) so the existing archive/unarchive behaviour carries over unchanged |
| Settings tab: teachers list (name + archived flag) | `tutors` table | `tutors.active` already exists - used inverted (`archived = !active`) rather than adding a duplicate column |
| `Challenges` tab, grouped rows sharing an `id` | `challenges` (one row) + `challenge_items` (one row per task) | The sheet's grouping *is* this exact one-to-many relationship already - clean fit |
| Challenge `piece` / `ref` (free text) | `challenge_items.piece_name` / `challenge_items.ref` (new nullable columns) | **Decided:** the long-term intent is a real `score_id` link, but a full score won't always be available, so both coexist - `score_id` set = linked; `piece_name` set = free text, same as today |
| Challenge `barFrom`/`barTo`/`bpm` | `challenge_items.bar_from`/`bar_to`/`target_bpm` | Clean fit |
| Challenge `timeSpent`/`sessions` (aggregate counters, mutated in place) | `challenge_logs` (one new row per logged practice instance) | **Behavioural change, not just storage** - see below |
| Challenge `who` | Dropped | Redundant once `challenges.account_id` exists - the sheet only needed it because one sheet could mix data |
| Session date (date only, no time) | `sessions.started_at`, stored at **12:00 GMT/UTC** on the given date | **Decided:** midday, not midnight - midnight UTC would land on the wrong calendar date for UK users roughly half the time; noon UTC is far enough from both the UK's UTC+0 and UTC+1 (BST) boundaries that the date never shifts |
| Session/challenge row identity (`row` number) | `id` (auto-increment) | Route params stay named `:row` in the API contract to avoid touching the frontend, but the value becomes a real `id` |

## Behavioural change: challenge progress logging

Today, logging practice against a challenge task **mutates two cells in
place** (adds to a running `timeSpent` total, increments a `sessions`
count). The new schema deliberately does this differently: **each logged
instance becomes its own row** in `challenge_logs`. `GET /challenges` then
needs to compute `timeSpent`/`sessions` per item as a `SUM`/`COUNT` over its
logs, rather than reading a stored total. Same numbers reach the frontend,
different mechanism underneath - and it's what gives a real history of
practice against each challenge, which the flat counters never could.

## Tasks

### 1. Migrations (two new files, additive only - nothing already applied changes)

- [ ] `009_bands_active_flag.sql` - `ALTER TABLE bands ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;`
- [ ] `010_challenge_items_free_text_bridge.sql` - add nullable `piece_name TEXT` and `ref TEXT` to `challenge_items`
- [ ] Run against `dev` and `sandbox` (`npm run migrate` with the right `DATABASE_URL`), confirm both branches match

### 2. App-level database access (doesn't exist yet)

- [ ] `server/config/db.js` - a `pg` `Pool` built from `process.env.DATABASE_URL`, exported for routes to use. Nothing in `server/` currently imports `pg` - `db/migrate.js` is a standalone script only.

### 3. Find-or-create helpers

- [ ] `getOrCreateAccount(email, firstName, surname)` - resolves the logged-in Google email to a real `accounts.id`, creating the row on first sight. Capture `firstName`/`surname` from the Google profile at login time (Passport's `profile.name.givenName`/`familyName` already has these - needs threading through `server/config/passport.js`'s verify callback into the signed token, rather than left blank).
- [ ] `getOrCreateBand(accountId, name)` - find-or-create by name, `created_by_account_id` = the resolved account.
- [ ] `getOrCreateTutor(name)` - find-or-create by `display_name`.

### 4. Rewrite `server/routes/api.js`, one group at a time, verifying each on `sandbox` before moving to the next

- [ ] **Settings** (`/api/dropdown-options`, `/api/settings/organisations`, `/api/settings/teachers`, list-with-usage, archive/unarchive/rename) → `bands`/`tutors`, using the `active` flag for archive state
- [ ] **Sessions** (`GET`/`POST`/`PUT`/`DELETE /api/sessions`) → `sessions` table; category↔`session_type` mapping; resolve `band_id`/`tutor_id` by name via the find-or-create helpers; `started_at` stored at 12:00 UTC
- [ ] **Challenges** (`GET`/`POST`/`PUT`/`DELETE /api/challenges` and the `/group/:id` variants) → `challenges`/`challenge_items`/`challenge_logs`, including the aggregate-via-`SUM`/`COUNT` change for `timeSpent`/`sessions`

Verification for each group: use the `ML-45` test-login account against
`sandbox`, enter test data through the actual UI, confirm it round-trips
correctly through Postgres (not just that the request succeeds).

### 5. Wrap-up

- [ ] Confirm the frontend needs no changes - response shapes should stay
  identical; `row` values just become real database IDs
- [ ] Leave `production` exactly as it is (still Sheets-backed) until the
  separate, deliberate data-migration step happens

## Deferred (not part of this cutover)

- UI edit screen for a band's `website`/`contact_email`
- Shrinking the Google OAuth scope (drop `spreadsheets`) once nothing reads/
  writes the Sheet anymore
- Real historical data migration
- Production cutover
