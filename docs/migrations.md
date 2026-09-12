# Database migrations

Status: **written for review — not yet run anywhere.** There is no database to run
these against until the Neon project from [`ML-21`](https://bestbit2000.atlassian.net/browse/ML-21)
exists. This document is the "how"; [`docs/database-schema.md`](database-schema.md)
is the "why" — read that first if the reasoning behind a table isn't obvious here.

## Approach

Plain, numbered `.sql` files in `db/migrations/`, applied in order by a small
runner (`db/migrate.js`) rather than an ORM's migration DSL. Chosen deliberately
so every change is directly readable as SQL rather than translated through a
schema language — easiest to check line-by-line against `database-schema.md`.
Nothing stops swapping to Prisma/Drizzle later if that becomes worth it; nothing
here is ORM-specific.

The runner tracks what's been applied in a `schema_migrations` table (created
automatically on first run) and wraps each file in its own transaction — a
failed file rolls back cleanly rather than leaving a half-applied schema.

## Running

```bash
DATABASE_URL="<connection string for the target environment>" npm run migrate
```

Point `DATABASE_URL` at whichever environment's Neon branch you mean to change —
there is no default, and no safety net if you point it at the wrong one, so
double-check before running against `production`.

## File order and what's in each

Files are numbered because later tables reference earlier ones by foreign key.
Two genuine circular references exist (a practice list can target an upcoming
session, and a session can be built from a practice list; a metronome run log
can point at a session segment, and session segments are defined after
metronome_run_logs) — both are resolved by creating the column without a
constraint first, then adding the `FOREIGN KEY` via `ALTER TABLE` once the
later table exists. Each file has a comment marking where this happens.

| File | Tables |
|---|---|
| `001_identity.sql` | accounts, bands, band_members, tutors, tutor_account_links, progress_view_grants |
| `002_scores_and_metronome.sql` | scores, adhoc_metronome_setups, metronome_segments, metronome_run_logs |
| `003_bar_exclusions.sql` | account_segment_bar_exclusions |
| `004_practice_lists.sql` | practice_lists, practice_list_scores, practice_list_segment_overrides |
| `005_sessions.sql` | sessions, session_participants, session_segments (+ closes both circular FKs) |
| `006_scales_and_technique.sql` | scale_definitions, scale_practice_logs, technique_exercise_sets, technique_exercise_logs |
| `007_challenges.sql` | challenges, challenge_items, challenge_logs |
| `008_monetization.sql` | subscription_plans, subscriptions, plan_feature_flags |
| `009_bands_active_flag.sql` | bands.active (archive/unarchive, Sheets cutover) |
| `010_challenge_items_free_text_bridge.sql` | challenge_items.piece_name, challenge_items.ref |
| `011_duration_options.sql` | duration_options (ML-7 tool-level duration presets) |
| `012_test_registry.sql` | features, test_cases, test_runs, test_run_results (ML-29 on-request back-test registry, not read/written by the running app) |
| `013_test_run_results_notes.sql` | test_run_results.root_cause_analysis renamed to notes (ML-26 admin panel needs "action taken", broader than just RCA) |
| `014_features_catalog.sql` | Broadens `features` from an ML-29 test-case pointer into the app-wide feature catalog behind the admin panel's Features list (ML-26); seeds it with everything currently live |
| `015_test_case_features.sql` | Replaces `test_cases.feature_id` (single FK) with a `test_case_features` join table, so one test case can cover more than one feature |
| `016_timer_feature_fix.sql` | Fixes a missing Timer row in `features` on fresh environments |
| `017_multibar_metronome.sql` | Adds `time_signature_options` (system catalog) and `account_time_signatures` (private custom), points `metronome_segments` at exactly one via FK instead of a free-text `time_signature` column, adds `metronome_segments.is_lead_in` (ML-35, ad-hoc/standalone scope only) |
| `018_metronome_setup_saved_at.sql` | Adds `adhoc_metronome_setups.saved_at` (nullable) - NULL means an unnamed scratch setup, not yet shown in the setups list; set means the user pressed "Save for later" |
| `019_timesig_extras.sql` | Adds `3/2` to the public time signature catalog; adds `account_time_signatures.active` (a custom signature still referenced by existing blocks is archived rather than deleted) |
| `020_more_time_signatures.sql` | Rounds out the public catalog with 5/8, 7/8, 4/2, 7/4, 10/8, 11/8, 1/4, 1/8, 3/16, 5/16, 7/16 - common asymmetric/irregular meters in concert/brass band repertoire |
| `021_lead_in_repeat.sql` | Adds `metronome_segments.repeat_lead_in` (ML-85) - whether the lead-in plays again on every loop, or only once at the start; meaningful only on the setup's one `is_lead_in` row |
| `022_lead_in_quiet_seconds.sql` | Adds `metronome_segments.quiet_seconds_before_lead_in` (ML-92) - seconds of silence played immediately before the lead-in starts, every time it plays; meaningful only on the setup's one `is_lead_in` row |
| `023_segment_note_value.sql` | Adds `metronome_segments.note_value` (nullable, CHECK-constrained to the five known note-type keys) - which note value ("crotchet", "quaver", etc.) a regular block's Target BPM display was last set with; bug fix, this was previously not persisted at all so re-editing a saved block always reset to a denominator-based default instead of what was actually chosen. Never meaningful on a lead-in row. |
| `024_account_levels.sql` | Adds `accounts.account_level` (ML-77) - a site-wide 5-tier level (super_admin/band_admin/premium_member/standard_member/beta_tester), a different axis from the existing per-band `band_members.role`. Defaults new/existing accounts to `standard_member`; bootstraps the known real account to `super_admin` so there's always one account able to promote others from the admin panel. |
| `025_playback_speed_options.sql` | Adds `playback_speed_options` (ML-109) - Metronome Blocks' play-speed presets, previously hardcoded as 13 buttons in `index.html`; seeded from that exact list. Same shape/reasoning as `duration_options`, now both admin-managed from the panel's new **Metadata lists** section. |

## Decisions made translating the design doc into SQL

These weren't explicitly discussed before, so flag if any should change —
nothing has been run anywhere yet, so nothing is costly to revisit:

- **Primary keys are `BIGINT GENERATED ALWAYS AS IDENTITY`**, not UUIDs. Simpler,
  no extension dependency, and easier to read while reviewing/debugging. If
  score or practice-list IDs ever need to be unguessable in a public URL, that's
  a separate `public_slug` column later, not a reason to switch every PK to UUID.
- **"Exactly one owner" rules** (`scores`, `metronome_segments`, `practice_lists`
  each having two nullable owner columns) are enforced with a `CHECK` constraint
  that counts how many of the two are non-null, rather than relying on
  application code to get it right.
- **A system catalog and its private/custom counterpart are separate tables, not
  one table with a nullable owner column.** `time_signature_options` (system,
  no owner, migration-seeded only) and `account_time_signatures` (private,
  `account_id NOT NULL`) are the first case of this (`017_multibar_metronome.sql`);
  the referencing table (`metronome_segments`) points at exactly one via the same
  "exactly one" `CHECK` pattern as ownership. Chosen over mixing rows in one table
  specifically so a migration can always safely add/edit catalog rows and release
  to production without any chance of colliding with a user's private row. Follow
  this pattern for any future meta table that might grow a private variant
  (`features` doesn't have one today, so it isn't retrofitted here).
- **Polymorphic tables have no real foreign key on the polymorphic column.**
  `metronome_run_logs.source_id` (score or adhoc setup) and
  `subscriptions.subscriber_id` (account or band) can't have a single FK
  constraint pointing at two different tables — Postgres doesn't support
  conditional foreign keys. The `source_type`/`subscriber_type` column is
  constrained to a fixed set of values, but matching `source_id`/`subscriber_id`
  to the right row is enforced in application code, not the database. Worth
  remembering when writing the data-access layer.

## Not yet done

- Nothing has been run against any real database.
- The data migration script that reads the Google Sheet and loads history into
  `sessions`/`challenges` (per `ML-21`) is separate work, not part of these files.
- No rollback ("down") scripts — for a pre-launch schema with no real data in it
  yet, fixing forward with a new numbered file is simpler than maintaining
  reverse migrations for a schema that's still likely to shift.
