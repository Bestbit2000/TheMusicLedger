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
| `026_app_config.sql` | Adds `app_config` (ML-47) - generic key/value store for small admin-editable settings that shouldn't need a release to change; seeded with `posthog_dashboard_url` for the admin panel's Usage-section link to the PostHog project. |
| `028_block_navigation_markup.sql` | Adds `metronome_segments.repeat_play_count` and `.ramp_duration_bars` (ML-103) - total times a repeated passage plays, and how many bars a tempo ramp takes to reach the next block's bpm. Adds `metronome_segment_fermatas` (segment_id, bar_offset, beat_offset, hold_beats 1-4) - a block can hold multiple sustained-hold fermatas, so it's a child table rather than fixed columns. Most of the other ML-103 fields (repeat start/end, endings, rehearsal mark, coda, D.C., intro offsets, ramp start) already existed as dormant columns from `002_scores_and_metronome.sql` (ML-35) and are wired up in the service layer here, not migrated again. |
| `029_block_landmarks_and_jumps.sql` | ML-103 follow-up (block editor reorganised into Standard/Multiple bars/Repeats/Landmarks/Speed change/Introduction/Jumps/Articulation). Adds `metronome_segments.is_section_boundary` (plain double barline, distinct from a repeat start), `.is_segno`/`.goto_segno`/`.goto_segno_then_coda` (Segno sign + D.S. + D.S. al Coda, alongside the existing coda fields). Adds `metronome_segment_rehearsal_marks` (segment_id, mark, bar_offset) - a block can carry more than one rehearsal mark, superseding the single `rehearsal_mark` column (left in place, unused). Adds `metronome_segment_fermatas.playback_mode` (tone/silent/count) - how a fermata actually sounds during its hold. |
| `030_time_signature_family.sql` | Adds `time_signature_options.family` (ML-153, nullable, CHECK-constrained to simple/compound/asymmetric) for the redesigned time-signature picker's three preset grids. Seeded only for the 12 signatures that picker actually shows (2/4, 3/4, 4/4, 2/2 simple; 6/8, 9/8, 12/8, 3/8 compound; 5/4, 7/4, 5/8, 7/8 asymmetric) - everything else in the catalog stays NULL. |
| `031_quick_play_history_favorite.sql` | Adds `adhoc_metronome_setups.is_favorite` (ML-34) - stars a Quick Play history row so it sorts to the top of the "Show history" list, ahead of every non-favourite, alphabetically. |
| `032_flow_metadata_and_media.sql` | Adds `scores.composer`/`.arranger`/`.publisher`/`.description` (ML-179 "Flow" details card - `created_at` already covers "date uploaded", no new column needed there). Adds `score_recordings` (mp3/mp4 upload via Vercel Blob, or a YouTube link - `score_recordings_type_shape` CHECK enforces never both) and `score_documents` (PDF/MusicXML/Sibelius/MuseScore uploads). See `docs/database-schema.md`'s "Flow" naming note - the table stays `scores`, but the product concept is "Flow" throughout the service/route/UI layer. |
| `035_flow_default_name.sql` | Adds `app_config` key `flow_default_name` (`'Untitled'`) - same admin-editable pattern as the `033_flow_default_block_settings.sql` keys, but for the name a brand new flow's name field pre-fills with. See `server/services/flows.js`'s `getUniqueDefaultFlowName` for how a collision with an existing personal flow of the same name is resolved. |
| `036_flow_final_barline.sql` | Adds `metronome_segments.is_final_barline` - a third "end of bar" structure option (the actual final barline, thin+thick) distinct from the existing `is_section_boundary` (a plain mid-piece double barline). Same shared column both Flow blocks and the ad-hoc Metronome Blocks tool read/write, though only Flow's End of bar picker exposes it today. |
| `037_volta_start_bar.sql` | Adds `metronome_segments.repeat_ending_start_bar` - which bar (as an offset within the block) a multi-bar volta/alternate ending starts at, alongside the existing `repeat_ending_numbers` (`034_repeat_ending_numbers.sql`). Nullable; bounded client-side by the block's own bar count rather than a DB constraint, since that bound can change after the fact. |
| `038_jump_dc_coda_fine.sql` | Adds `metronome_segments.goto_start_dc_then_coda` ("D.C. al Coda" - the `goto_start_dc` equivalent of the existing `goto_segno_then_coda`, `029_block_landmarks_and_jumps.sql`) and `.is_fine` ("Fine" - where playback stops once a D.C./D.S. jump loops back, distinct from `is_final_barline`'s literal end of the piece, `036_flow_final_barline.sql`). Same shared columns both Flow blocks and the ad-hoc Metronome Blocks tool read/write, though only Flow's Jump picker exposes the two new options today. |
| `039_fermata_caesura_kind.sql` | Adds `metronome_segment_fermatas.kind` (`'fermata'`/`'caesura'`, default `'fermata'`) - Flow's Pauses picker now supports a silent-break Caesura alongside the existing held-beat Fermata, reusing the same child table (`028_block_navigation_markup.sql`) rather than a parallel one since both share the same bar/beat/duration shape. |
| `040_note_value_extended.sql` | Widens `metronome_segments.note_value`'s CHECK constraint (`023_segment_note_value.sql`) from 5 values to 8 - adds `semiquaver`, `dotted-quaver`, `dotted-minim` alongside the existing `quaver`, `crotchet`, `dotted-crotchet`, `minim`, `semibreve`, for the shared "beat note" picker (Quick Play/Metronome Blocks/Flow). |
| `041_tempo_ramps_table.sql` | Adds `metronome_segment_ramps` (segment_id, start_bar_offset, start_beat_offset, end_mode `block_end`/`specific`, end_bar_offset, end_beat_offset, target_mode `next_block`/`custom`, target_bpm) - Flow's new Tempo ramps picker needs a block to hold multiple gradual speed changes, same "child table for a list" shape as `metronome_segment_fermatas`. Supersedes the single-ramp `ramp_start_bar_offset`/`ramp_start_beat_offset`/`ramp_duration_bars` columns for Flow blocks (left in place, unused there); the ad-hoc Metronome Blocks tool's own "Speed change" card still uses those three columns. |
| `042_features_enabled.sql` | Adds `features.enabled` (ML-190) - the existing `features` catalog (`012_test_registry.sql`/`014_features_catalog.sql`) is read by the running app for the first time here, not just admin/back-test tooling. Separate from `plan_feature_flags` (per-subscription-plan billing gating, still unwired). Seeds `flow_import_from_file` (ML-79's "Create from file") as the first real gate, disabled pending a security review of its OMR dependency. |
| `043_active_timer_sessions.sql` | Adds `active_timer_sessions` (account_id PK, target_seconds, elapsed_seconds, running, updated_at) - ML-197's in-progress practice timer, persisted so an accidental page reload/relogin doesn't lose it. One row per account (a fresh start/sync always upserts over whatever was there); deleted once the timer finishes or is stopped. `elapsed_seconds`/`updated_at` are a wall-clock anchor rather than a periodic snapshot - `getActiveTimerSession` (`server/services/timerSessions.js`) projects `elapsed_seconds` forward from `updated_at` using Postgres's own `now()` while `running` is true, so a resume picks up with exactly the same time left to the second, and a pause (which re-syncs with `running=false`) freezes that projection instead of letting the paused stretch count against it. Deliberately not a column added to `sessions` - see that table's own "authoritative total, only written once" note above. |
| `044_flow_authoring_stats.sql` | Adds `flow_authoring_sessions` - ML-199's measurement of how long a Flow actually takes to build, so manual bar entry has a baseline to compare a redesigned Bars tab against. One row per authoring attempt (`kind` create/edit, so initial creation and cumulative editing can be split), started on entering the Hub and finalised on reaching Play (create) or Save (edit); anything else is recorded as `abandoned` rather than discarded. Records two durations on purpose - raw `elapsed_seconds` plus idle-trimmed `active_seconds`, the latter being the headline figure, with `bars_active_seconds` narrowing further to the Bars tab - and stores `idle_threshold_seconds` per row so retuning that rule can never silently make new rows incomparable with old ones. `app_version` is stamped server-side from `public/releases.json` (never client-sent), which is what makes the before/after comparison a `GROUP BY` rather than a date guess. `score_id` is `ON DELETE SET NULL` with a denormalised `flow_title` beside it - building a baseline means binning a lot of throwaway flows, and deleting one must not delete the measurement of how long it took to build. Also seeds the `flow_authoring_stats` feature row (enabled) as the admin kill switch. |
| `045_feedback.sql` | Adds `feedback` - ML-170's in-app feedback capture (hamburger menu &rarr; Send feedback) plus super-admin triage. The form is a bare text box: `category` is nullable and stays NULL until an admin sets it at triage, since NULL ("untriaged") is a real, filtered-on state rather than missing data, and asking questions at the moment something goes wrong is how a feedback form stops being used. `status` reconciles the three inconsistent status lists in the ticket into five canonical values, each with a badge colour and a filter. route/user_agent/device_kind/app_version are captured silently at submit - `route` holds the *view name*, not `location.pathname`, which would read `/` for every row in a single-page app; `device_kind`/`app_version` reuse ML-199's own conventions. Only `message` is accepted from the client. Also seeds the `feedback` feature row (enabled) as the kill switch. The user-facing "My Feedback" view is a deliberate follow-up - `admin_response` and `idx_feedback_account` are here already so it needs no migration of its own. |
| `049_security_reviews.sql` | Adds `security_review_runs` + `security_review_results` (ML-192) - the automated runs behind Admin → Security ("Run now"), per environment. The deep-review history deliberately isn't here: it lives in `server/securityReviews/*.js` and ships with the code. Check definitions are in code (`server/services/securityReview.js`), keyed by `check_key`. See `docs/omr-security-review.md`. |
| `050_duration_default.sql` | Adds `duration_options.is_default` (at most one, via a partial unique index), set on 30 minutes (ML-236). The quick timer starts on a user's most common practise length over the last 90 days, or this default when there's no history. Changed from Admin → Metadata lists → Durations. |
| `051_practice_year_setting.sql` | Adds `accounts.practice_year_enabled` / `practice_year_start_month` / `practice_year_start_day` (ML-234) - the stats "This/Last practise year" options, formerly hard-coded to 1 November. Off for everyone except the owner's account, which keeps 1 November. |

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
