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
