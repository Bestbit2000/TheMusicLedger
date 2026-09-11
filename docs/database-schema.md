# Database schema design

Status: **implemented.** All migrations below are applied to `production`/`sandbox`/`dev`
(see `docs/migrations.md` for the file list and `docs/environments.md` for the
branches) - this stopped being pre-implementation design as of the Sheets→Postgres
cutover (`ML-21`, release 0.6.0). Kept up to date as the schema grows, so any future
session (human or Claude) still has full context and reasoning before touching it.

## Why this exists

The app currently runs on a single Google Sheet per user (see `code.gs`,
`server/config/google.js`, `server/routes/api.js`). That works for one person logging
practice time, but breaks down for:

- Scores that have internal structure (sections/bars), not just a name.
- Multiple people sharing data via real permissions instead of sheet-sharing.
- A multi-bar metronome (see Jira `ML-35`) that needs a proper repeat/coda/tempo-ramp
  data structure per section.
- Local/sandbox/production environment separation.
- Multi-band, multi-account usage with role-based permissions.

Decision: move to **Postgres**, hosted on **Neon** (free instant branching maps
directly onto local/sandbox/prod) or **Supabase** as a fallback if DB-level
row-level-security becomes more valuable than free branching. Auth stays decoupled
from the database — whatever auth system is used just needs to resolve to an
`accounts.id`.

Heatmap/usage analytics: **PostHog** (separate concern from the database, free
self-serve tier includes session recording/heatmaps).

## Guiding principles

- **Ownership pattern**: anything a band or an individual can own (scores, ad-hoc
  metronome setups, practice lists) uses two nullable FK columns
  (`owner_band_id` / `owner_account_id`) with a constraint that exactly one is set.
- **Fork lineage**: a band taking a private copy of a score is a new `scores` row
  with `forked_from_score_id` pointing at the original. Sections are copied under
  the new `score_id`.
- **Public score list**: not a separate table — a query over `scores`/`metronome_segments`
  selecting title/time signature/bpm and excluding `notes`.
- **Individual vs. band scoping**: bar-level skip exclusions, ad-hoc metronome setups,
  and technique exercises are explicitly individual-only, never band-owned.
- **Monetization**: bands are free (distribution/marketing channel). Paid tiers apply
  to individual accounts today. The `subscriptions` table is deliberately polymorphic
  (`subscriber_type`: account/band) so band-level paid add-ons (e.g. AI score-to-section
  reading) can be added later without restructuring.
- **Session timing**: the session's own recorded total is the authoritative practice-time
  figure. Segment durations within a session are guidance only and are never summed to
  produce statistics (a 45-minute session might contain four "approximately 10 minute"
  pieces that don't add up to 45 — the session total is measured separately).

## Tables

### Identity, bands & tutors

| Table | Purpose | Key columns |
|---|---|---|
| `accounts` | A person with a login | id, first_name, surname, email |
| `bands` | An ensemble | id, name, website, contact_email, created_by_account_id |
| `band_members` | Standing membership | band_id, account_id, role |
| `tutors` | Soft lookup, no login required | id, display_name, first_name, surname, email, active |
| `tutor_account_links` | Connects a tutor lookup row to a real account, if the tutor has one | tutor_id, account_id, linked_at |
| `progress_view_grants` | A student opting a tutor into seeing their progress | id, student_account_id, tutor_id, granted_at, revoked_at |

`progress_view_grants` points at `tutor_id`, not directly at an account, so a grant
can exist before a tutor has linked a login — it just resolves once
`tutor_account_links` connects them.

### Scores & metronome segments (Jira `ML-35`)

| Table | Purpose | Key columns |
|---|---|---|
| `scores` | A piece, owned by a band or an account | id, title, owner_band_id, owner_account_id, forked_from_score_id, is_public, default_bpm, default_time_signature, default_conductor_beats_per_bar |
| `adhoc_metronome_setups` | Standalone manual multi-section setup, individual-only | id, account_id, name, created_at, saved_at |
| `metronome_segments` | One row per section, on either a score or an ad-hoc setup (never both) | id, parent_score_id, parent_adhoc_setup_id, order_index, is_lead_in, repeat_lead_in, rehearsal_mark, bar_count, bpm, time_signature_id, account_time_signature_id, conductor_beats_per_bar, is_repeat_start, is_repeat_end, pickup_beats, goto_coda, goto_start_dc, is_coda, intro_start_bar_offset, intro_start_beat_offset, intro_end_bar_offset, intro_end_beat_offset, is_first_time_bar, is_second_time_bar, ramp_start_bar_offset, ramp_start_beat_offset, notes |
| `metronome_run_logs` | History of every playback, score-driven or ad-hoc | id, account_id, source_type, source_id, session_segment_id, run_at, completed |
| `time_signature_options` | System catalog of time signatures (numerator/denominator), migration-seeded only | id, numerator, denominator, label, sort_order, active |
| `account_time_signatures` | Private custom time signatures, per account | id, account_id, numerator, denominator, active |

Notes on fields that took a few passes to nail down:
- **No `subdivide` anywhere** — it's a live runtime override on the metronome player,
  never saved against a score or segment. ML-35 briefly considered persisting it per
  block, but it may be derivable from the time signature, so it's deferred rather
  than modeled.
- **Intro handling** (carols use case): `intro_start_bar_offset`/`intro_start_beat_offset`
  mark the exact note the intro starts on; `intro_end_bar_offset`/`intro_end_beat_offset`
  mark where it ends. Played once, skipped on the repeat.
- **Tempo ramp**: anchored at its *start*, not its landing point —
  `ramp_start_bar_offset`/`ramp_start_beat_offset` mark where acceleration begins within
  this segment; it ramps forward and lands on the *next* segment's own `bpm` at the
  segment boundary. No separate target-tempo field.
- **`is_lead_in`** (ML-35, redesigned per the follow-up comment on that ticket): a
  setup has **at most one** lead-in row now, played once at the very start and
  excluded from the loop-back. The app enforces the one-per-setup rule in the
  service layer (`metronomeSegments.js`); the schema itself doesn't. A lead-in
  spanning a whole bar or two uses `bar_count` as normal; one that's only a
  partial bar (e.g. 2 beats of a 4/4 bar) uses `pickup_beats` on a `bar_count = 1`
  row instead — never combined on one row. Its own `time_signature_id`/
  `account_time_signature_id`/`bpm` are populated (to satisfy the usual
  constraints) but never actually read back — the app always resolves the
  *current* first regular segment's time signature/bpm for display and
  playback, so a stale copy on the lead-in row itself is harmless. Originally
  this allowed multiple independently-timed, freely-orderable lead-in segments
  chained together; that turned out to be confusing in practice (dragging
  blocks around could disturb "the start of the piece") and was dropped.
- **`repeat_lead_in`** (ML-85): defaults to `false` — loop-back skips the
  lead-in and rejoins at the first regular block, same as the original ML-35
  behaviour. Set `true` and the loop-back point becomes the lead-in itself, so
  it plays again before every repeat, not just once at the very start. Only
  meaningful on the one `is_lead_in` row a setup can have; ignored (but still
  stored, same as a regular block's always-null `pickup_beats`) on any other row.
- **`adhoc_metronome_setups.saved_at`** (ML-35 follow-up): naming a setup
  before you could even press play was too much friction, so creating one no
  longer asks for a name up front - it starts as an unnamed scratch copy,
  fully playable, with `saved_at` NULL. The setups list only shows rows where
  `saved_at IS NOT NULL`; "Save for later" is what sets both `name` and
  `saved_at` together. Abandoned scratch rows are never surfaced but aren't
  automatically cleaned up either - acceptable for now, revisit if they pile up.
- **Time signature split into two tables, not one with a nullable owner column**:
  `time_signature_options` is a pure system catalog (no owner at all) so it's always
  safe to seed/edit via migration and release straight to production with no risk of
  touching a user's private row. `account_time_signatures` holds exactly the
  private/custom case. `metronome_segments` points at exactly one of the two
  (`time_signature_id` / `account_time_signature_id`), enforced by
  `metronome_segments_exactly_one_time_signature`, same "exactly one" `CHECK` shape as
  the owner columns above. Whether the public catalog is sufficient is answered by
  querying how `account_time_signatures` gets used, surfaced directly in the block
  editor's time-signature picker ("Your custom time signatures": each one's usage
  count computed live via `COUNT(metronome_segments...)`, not a stored counter).
  A custom signature with zero usage can be deleted outright; one still referenced
  by existing blocks is archived instead (`active = false`) - kept for those blocks,
  just no longer offered when picking a signature for a new one.

### Individual playing preferences

| Table | Purpose | Key columns |
|---|---|---|
| `account_segment_bar_exclusions` | Bars this player skips within a segment, whenever they run it (individual only, not band-wide) | id, account_id, metronome_segment_id, bar_from, bar_to, note |

### Practice lists

| Table | Purpose | Key columns |
|---|---|---|
| `practice_lists` | Owned by an account or a band; can target an upcoming event (e.g. a concert rehearsal list) | id, owner_account_id, owner_band_id, target_session_id, name |
| `practice_list_scores` | Scores in the list, ordered | practice_list_id, score_id, order_index |
| `practice_list_segment_overrides` | Whole-segment include/exclude for this list | practice_list_id, metronome_segment_id, included |

### Sessions

| Table | Purpose | Key columns |
|---|---|---|
| `sessions` | The umbrella event (practice/rehearsal/performance/lesson) | id, session_type, account_id, band_id, tutor_id, practice_list_id, started_at, **total_duration_minutes** (actual, authoritative) |
| `session_participants` | Attendance, incl. one-off guests who aren't full band members | session_id, account_id, is_guest, role |
| `session_segments` | The up-to-4 timed chunks (warm up / scales / technique / performance) within a session | id, session_id, segment_type, order_index, **planned_duration_minutes** (guidance only), score_id, metronome_segment_id |

### Scales

| Table | Purpose | Key columns |
|---|---|---|
| `scale_definitions` | Shared reference list (not per-account) | id, name, type |
| `scale_practice_logs` | History per account | id, account_id, scale_id, session_segment_id, logged_at, bpm_achieved, status |

### Technique exercises

| Table | Purpose | Key columns |
|---|---|---|
| `technique_exercise_sets` | A reference range, e.g. "Book X, exercises 1-25" (individual only) | id, account_id, source, exercise_from, exercise_to, name |
| `technique_exercise_logs` | Which specific number was actually played and how it went — feeds "pick based on past performance" | id, technique_exercise_set_id, session_segment_id, exercise_number, logged_at, status, bpm_achieved |

### Challenges

| Table | Purpose | Key columns |
|---|---|---|
| `challenges` | A group of tasks (matches the current sheet's grouped-by-id rows) | id, account_id, name, type, challenge_priority |
| `challenge_items` | One task, pointing at a real score/segment instead of free-text | id, challenge_id, score_id, metronome_segment_id, bar_from, bar_to, target_bpm, status, item_priority |
| `challenge_logs` | Each practice instance logged against an item, replacing the sheet's aggregate counters | id, challenge_item_id, session_id, logged_at, duration_minutes, bpm_achieved |

### Tool-level settings

| Table | Purpose | Key columns |
|---|---|---|
| `duration_options` | Shared preset duration list (minutes) for the save-session screen and the practice timer (`ML-7`) | id, minutes, sort_order, active |

Not per-account - a single tool-wide list, deliberately moved out of hardcoded
frontend HTML so it can be changed without a release. No admin UI to manage it
yet (still edited by direct SQL/Claude on request); that's the natural next
step once the admin panel needs it.

### Feature catalog & back-test registry (`ML-26`, `ML-29`)

| Table | Purpose | Key columns |
|---|---|---|
| `features` | Canonical list of what the app actually does today - only things with real, wired-up code, not schema-only areas (scores/practice lists/scales/technique). Manually curated (add/edit/delete) from the admin panel's **Features** page, not just seeded by migrations | id, feature_key, name, description |
| `test_cases` | One Playwright spec, authored by Claude on request (no automated/billed API call) - can cover more than one feature | id, jira_ticket_key, title, passes_if_criteria, script, is_active |
| `test_case_features` | Join table - which feature(s) a test case covers. Deliberately many-to-many: a single flow (e.g. "log a session, then check stats") legitimately exercises more than one feature, so it's linked to each rather than forced to pick one | test_case_id, feature_id |
| `test_runs` | One row per back-test suite execution | id, trigger_source (always `manual` - no CI trigger exists), total/passed/failed_tests, started_at, completed_at |
| `test_run_results` | Per-test-case outcome of a run | id, test_run_id, test_case_id, verdict, error_message, notes (what Claude found/did about a failure), duration_ms |

`features` started life (`012_test_registry.sql`) purely as something
`test_cases` pointed at for the on-request back-test workflow
(`.claude/skills/backtest`, no `ANTHROPIC_API_KEY`/GitHub Actions - see the
ML-29 cost discussion for why). `014_features_catalog.sql` broadened it into
the app-wide feature catalog behind the admin panel's **Features** list
(`ML-26`) - the same table now doubles as both. This is deliberately the
list `plan_feature_flags.feature_key` below is meant to resolve against once
gating/billing is built; nothing wires that up yet.

`test_cases.feature_id` (a single FK) was replaced by the `test_case_features`
join table in `015_test_case_features.sql` for exactly this reuse reason. One
side effect worth knowing: deleting a `features` row now only removes its
`test_case_features` link rows (`ON DELETE CASCADE` on that join table) - it
never deletes the test case itself or its run history, even if that was the
test case's only linked feature (it just ends up with zero features linked,
still visible in the admin panel's **Test cases** list).

None of these five tables are read or written by the running app itself -
they're purely admin/tooling.

### Monetization

| Table | Purpose | Key columns |
|---|---|---|
| `subscription_plans` | Plans you sell | id, name, price, billing_interval, applies_to (account/band), is_active |
| `subscriptions` | Who's on which plan (polymorphic subscriber) | id, subscriber_type (account/band), subscriber_id, plan_id, status, started_at, current_period_end, external_payment_ref |
| `plan_feature_flags` | Feature gating per plan | plan_id, feature_key, enabled |

`external_payment_ref` deliberately just points at whatever payment processor gets
picked later (e.g. Stripe) rather than storing billing detail directly.
`feature_key` is meant to resolve against `features.feature_key` (see "Feature
catalog" above) - not enforced with a real FK since this table predates that one
and neither is wired to any endpoint yet.

## Open questions (not yet resolved)

1. Should a subscription ever be band-held to unlock features for all members at once
   (vs. only individual accounts paying)? Currently modeled as possible via
   `subscriber_type`, but no band plans are planned at launch.
2. `progress_view_grants` currently grants blanket visibility of a student's progress
   to a tutor. May need scoping (per band, per score) later.

## Explicitly out of scope for now

- ORM adoption (Prisma/Drizzle) — migrations are plain SQL by deliberate choice, see `docs/migrations.md`.
- Supabase — settled on Neon for free branching.
- Auth provider/mechanism — decoupled from this schema by design.
