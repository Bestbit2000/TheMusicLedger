# Database schema design (pre-implementation)

Status: **design only — no migration or code has been written yet.** This document
captures the target relational schema agreed in conversation, so any future session
(human or Claude) has the full context before touching implementation.

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
| `adhoc_metronome_setups` | Standalone manual multi-section setup, individual-only | id, account_id, name, created_at |
| `metronome_segments` | One row per section, on either a score or an ad-hoc setup (never both) | id, parent_score_id, parent_adhoc_setup_id, order_index, rehearsal_mark, bar_count, bpm, time_signature, conductor_beats_per_bar, is_repeat_start, is_repeat_end, pickup_beats, goto_coda, goto_start_dc, is_coda, intro_start_bar_offset, intro_start_beat_offset, intro_end_bar_offset, intro_end_beat_offset, is_first_time_bar, is_second_time_bar, ramp_start_bar_offset, ramp_start_beat_offset, notes |
| `metronome_run_logs` | History of every playback, score-driven or ad-hoc | id, account_id, source_type, source_id, session_segment_id, run_at, completed |

Notes on fields that took a few passes to nail down:
- **No `subdivide` anywhere** — it's a live runtime override on the metronome player,
  never saved against a score or segment.
- **Intro handling** (carols use case): `intro_start_bar_offset`/`intro_start_beat_offset`
  mark the exact note the intro starts on; `intro_end_bar_offset`/`intro_end_beat_offset`
  mark where it ends. Played once, skipped on the repeat.
- **Tempo ramp**: anchored at its *start*, not its landing point —
  `ramp_start_bar_offset`/`ramp_start_beat_offset` mark where acceleration begins within
  this segment; it ramps forward and lands on the *next* segment's own `bpm` at the
  segment boundary. No separate target-tempo field.

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

### Monetization

| Table | Purpose | Key columns |
|---|---|---|
| `subscription_plans` | Plans you sell | id, name, price, billing_interval, applies_to (account/band), is_active |
| `subscriptions` | Who's on which plan (polymorphic subscriber) | id, subscriber_type (account/band), subscriber_id, plan_id, status, started_at, current_period_end, external_payment_ref |
| `plan_feature_flags` | Feature gating per plan | plan_id, feature_key, enabled |

`external_payment_ref` deliberately just points at whatever payment processor gets
picked later (e.g. Stripe) rather than storing billing detail directly.

## Open questions (not yet resolved)

1. Should a subscription ever be band-held to unlock features for all members at once
   (vs. only individual accounts paying)? Currently modeled as possible via
   `subscriber_type`, but no band plans are planned at launch.
2. `progress_view_grants` currently grants blanket visibility of a student's progress
   to a tutor. May need scoping (per band, per score) later.

## Explicitly out of scope for now

- Actual SQL/Prisma/Drizzle schema and migrations — not started.
- Choice between Neon vs. Supabase — leaning Neon for free branching, not locked in.
- Auth provider/mechanism — decoupled from this schema by design.
