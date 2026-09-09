# Sheets → database cutover (app code, not data)

Status: **complete and live in production** (release 0.6.0, 2026-09-09).
`server/routes/api.js` is 100% Postgres-backed - nothing in the running app
talks to Google Sheets any more, on any environment. This is the
living reference for this specific piece of work: swapping the running app's
data layer from Google Sheets to Postgres. It is deliberately separate from
the actual historical-data migration (moving Andrew's real practice history
across), which happens later, at a point in time Andrew chooses. Update this
doc as steps complete — it's meant to stay accurate, not be a one-time
snapshot.

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

- [x] `009_bands_active_flag.sql` - `ALTER TABLE bands ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;`
- [x] `010_challenge_items_free_text_bridge.sql` - add nullable `piece_name TEXT` and `ref TEXT` to `challenge_items`
- [x] Run against `dev` and `sandbox`, confirmed both branches match

### 2. App-level database access (doesn't exist yet)

- [x] `server/config/db.js` - a `pg` `Pool` built from `process.env.DATABASE_URL`

### 3. Find-or-create helpers

- [x] `getOrCreateAccount(email, firstName, surname)` (`server/services/accounts.js`) - `firstName`/`surname` threaded through from the Google profile via `server/config/passport.js`
- [x] `getOrCreateBand(accountId, name)` (`server/services/bands.js`), plus list/rename/archive/unarchive/usage-check
- [x] `getOrCreateTutor(name)` (`server/services/tutors.js`), same shape

### 4. Rewrite `server/routes/api.js`

- [x] **Settings** → `bands`/`tutors`, using the `active` flag for archive state
- [x] **Sessions** → `sessions` table; category↔`session_type` mapping; `band_id`/`tutor_id` resolved by name; `started_at` stored at 12:00 UTC
- [x] **Challenges** → `challenges`/`challenge_items`/`challenge_logs`, including the aggregate-via-`SUM`/`COUNT` change for `timeSpent`/`sessions`

Verified via direct API calls (all CRUD operations, both `dev` and
`sandbox` databases, two-account data isolation) and through the real UI on
`sandbox` (main dashboard, session history + edit, manage lists, manage
challenges) using the `ML-45` test-login account.

**Found and fixed during verification:** `pg` returns `BIGINT` ids as
strings, which broke a strict `===` comparison in the frontend (`openEdit`
in `public/app.js`). Fixed by explicitly `Number()`-wrapping ids in API
responses rather than touching the frontend - see the comment above
`toIntOrNull` in `server/routes/api.js`.

**Also done, beyond the original task list:** `server/config/google.js`
deleted - nothing imports it any more now that nothing talks to Sheets.

### 5. Wrap-up

- [x] Confirmed the frontend needs no changes - response shapes stayed
  identical; `row` values are real database IDs, explicitly typed to match
- [x] Push to production - done 2026-09-09, release 0.6.0
- [x] Production's database: schema applied, real data migrated (see below),
  code deployed, verified end-to-end with a real login against production

## Real data migration - sandbox dry run (2026-09-08), then production (2026-09-09)

Andrew's real historical data was first imported into `sandbox`'s database as
a dry run (883 sessions at that point), verified against the live sheet, then
re-extracted fresh and imported into `production` the next day once more
sessions had been logged in the meantime - **883 was the sandbox snapshot,
885 was the real production count**, not a discrepancy. Both runs used a
one-off script (not committed to the repo - tied to each specific event, not
reusable tooling; deleted after use each time), authenticated with a real
Google login completed by Andrew in the Browser pane so the script had real
Sheets read access without Claude ever handling his password. The production
run also created the `accounts` row itself (via the same logic as
`getOrCreateAccount`) since production wasn't yet running the DB-backed code
at that point in the sequence (schema → env var → data → code deploy).

**Migrated into production:** 5 organisations, 1 teacher, 885 sessions, 5
challenge groups (87 items) - verified via direct DB query and against the
live UI (dashboard totals, manage lists, manage challenges) immediately after
deploy. The sandbox dry-run numbers below are kept for historical reference.

**Sandbox dry run migrated:** 4 organisations, 1 teacher, 883 sessions (709
practice / 143 rehearsal / 8 lesson / 23 performance), 5 challenge groups (87
items).

**One thing worth knowing about challenge history:** the sheet only ever
stored an aggregate total time + session count per task, never individual
logged instances. Since the new schema replaced that with a real log table
(`challenge_logs`, one row per instance - see "Behavioural change" above),
there was nothing per-instance to migrate. The migration splits each item's
old total evenly across `sessionsCount` synthetic log rows, so the
**totals** the app displays (time spent, session count) match the sheet
exactly - but those synthetic rows don't represent real individual practice
instances, just a reconstruction that preserves the two numbers that were
actually there.

**Verified against the live sheet directly** (not just "the import ran
without error"): rehearsal/lesson/performance session counts and duration
sums matched exactly; challenge groups, items, and total logged time matched
exactly. Practice sessions showed 710 in the database vs 709 on the sheet -
not a discrepancy, that's the one manual test session Andrew logged while
verifying the app earlier the same day, which was already in `sandbox`
before this import ran.

## Still deferred

- UI edit screen for a band's `website`/`contact_email`
- Shrinking the Google OAuth scope (drop `spreadsheets`) now that nothing
  reads/writes the Sheet anymore - the scope is still requested at login but
  unused
- Wiring up the rest of the schema (scores, practice lists, scales, technique
  exercises, monetization) - tables exist on all three Neon branches but no
  endpoint reads/writes them yet
