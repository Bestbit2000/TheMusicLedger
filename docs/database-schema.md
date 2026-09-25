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
self-serve tier includes session recording/heatmaps) — wired up client-side
via autocapture per `ML-47`, see [`docs/third-party-providers.md`](third-party-providers.md)
and `public/analytics.js`.

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
| `accounts` | A person with a login | id, first_name, surname, email, account_level, practice_year_enabled/_start_month/_start_day (`ML-234`) |
| `bands` | An ensemble | id, name, website, contact_email, created_by_account_id, active |
| `band_members` | Standing membership | band_id, account_id, role |
| `tutors` | Soft lookup, no login required | id, display_name, first_name, surname, email, active |
| `tutor_account_links` | Connects a tutor lookup row to a real account, if the tutor has one | tutor_id, account_id, linked_at |
| `progress_view_grants` | A student opting a tutor into seeing their progress | id, student_account_id, tutor_id, granted_at, revoked_at |

`progress_view_grants` points at `tutor_id`, not directly at an account, so a grant
can exist before a tutor has linked a login — it just resolves once
`tutor_account_links` connects them.

**`accounts.account_level`** (`024_account_levels.sql`, `ML-77`): a site-wide tier —
`super_admin`/`band_admin`/`premium_member`/`standard_member`/`beta_tester`, plain
`TEXT` + inline `CHECK`, same pattern as `band_members.role` below. Defaults to
`standard_member`; the migration bootstraps one real account to `super_admin` so
there's always someone able to promote others from the admin panel
(`server/routes/admin.js`'s `requireSuperAdmin`, which now gates that entire
router — see `server/middleware/auth.js`). A different axis from
`band_members.role`, which is scoped to one band, not the whole app.

**`bands`/`band_members` as a shared directory** (`ML-77`/`ML-89`): the `bands`
table already served a private, per-account purpose (the old Sheets "who was this
session for" label list, scoped by `created_by_account_id` — still exactly as-is,
see `docs/sheets-to-database-cutover.md`). `server/services/bands.js` now also
exposes a second, unrelated use of the same table: a real, shared, cross-account
directory (no `created_by_account_id` scoping) with actual membership via
`band_members` (previously unused), behind `/api/account/bands` (self-service —
anyone can add a band, duplicate-checked by website domain, reachability-checked
only, no attempt to judge "is this band-like") and `/api/admin/bands` (Super-admin
CRUD with a per-band member count). A band still linked to a real member or
session history is archived (`active = false`) rather than deleted, mirroring
`archiveOrDeleteBand`'s existing session-history-only check.

### Scores & metronome segments (Jira `ML-35`)

**"Flow" vs "Score" (ML-179)**: the product concept built on this table from
ML-179 onward is called a **Flow** everywhere outside this table itself —
service file (`server/services/flows.js`), functions (`createFlow`/`listFlows`/
etc.), endpoints (`/api/flows/*`), and all user-facing UI text. The table stays
named `scores` deliberately: a Flow is rhythm/structure only (no notes), and
"Score" is reserved for a future feature where real notation gets attached to
the same piece (via a music reader or an uploaded file) — this table is the
natural home for that later, so it isn't renamed out from under it now.

| Table | Purpose | Key columns |
|---|---|---|
| `scores` | A piece ("Flow" - see naming note above), owned by a band or an account | id, title, composer, arranger, publisher, description, owner_band_id, owner_account_id, forked_from_score_id, is_public, default_bpm, default_time_signature, default_conductor_beats_per_bar, created_at |
| `score_recordings` | Mp3/mp4 upload (via Vercel Blob) or a YouTube link, never both, attached to a Flow | id, score_id, type, title, blob_url, blob_pathname, file_size_bytes, mime_type, youtube_video_id, youtube_thumbnail_url, order_index |
| `score_documents` | PDF/MusicXML/Sibelius/MuseScore file uploads (via Vercel Blob) attached to a Flow | id, score_id, file_name, blob_url, blob_pathname, file_size_bytes, mime_type |
| `adhoc_metronome_setups` | Standalone manual multi-section setup, individual-only | id, account_id, name, created_at, saved_at, is_quick_play, is_favorite |
| `metronome_segments` | One row per section, on either a score or an ad-hoc setup (never both) | id, parent_score_id, parent_adhoc_setup_id, order_index, is_lead_in, repeat_lead_in, quiet_seconds_before_lead_in, rehearsal_mark, bar_count, bpm, time_signature_id, account_time_signature_id, conductor_beats_per_bar, is_repeat_start, is_repeat_end, repeat_play_count, pickup_beats, goto_coda, goto_start_dc, is_coda, is_segno, goto_segno, goto_segno_then_coda, is_section_boundary, intro_start_bar_offset, intro_start_beat_offset, intro_end_bar_offset, intro_end_beat_offset, is_first_time_bar, is_second_time_bar, ramp_start_bar_offset, ramp_start_beat_offset, ramp_duration_bars, notes |
| `metronome_segment_fermatas` | Zero or more sustained-hold fermatas within a block (ad-hoc only today) | id, segment_id, bar_offset, beat_offset, hold_beats, playback_mode |
| `metronome_segment_rehearsal_marks` | Zero or more rehearsal marks within a block | id, segment_id, mark, bar_offset |
| `metronome_run_logs` | History of every playback, score-driven or ad-hoc | id, account_id, source_type, source_id, session_segment_id, run_at, completed |
| `time_signature_options` | System catalog of time signatures (numerator/denominator), migration-seeded only | id, numerator, denominator, label, sort_order, active |
| `account_time_signatures` | Private custom time signatures, per account | id, account_id, numerator, denominator, active |

**Flow ownership (ML-179)**: three shapes, all fitting the existing
`scores_exactly_one_owner` CHECK with no schema change - **personal**
(`owner_account_id` = the creator, `is_public = false`), **band-owned**
(`owner_band_id`, persists across that band's own membership churn), and
**admin/public** (`owner_account_id` = a super admin, `is_public = true`,
manageable by *any* super admin, not just whoever published it). A Flow moves
between these via explicit, fully-reversible actions in `flows.js` -
`moveFlowToBand`/`removeFlowFromBand` and `publishFlow`/`unpublishFlow` - never
by editing ownership columns directly. Unpublishing (or removing from a band)
always lands on personal, owned by whoever performed the action; there's no
stored "previous owner" to revert to instead.

Notes on fields that took a few passes to nail down:
- **No `subdivide` anywhere** — it's a live runtime override on the metronome player,
  never saved against a score or segment. ML-35 briefly considered persisting it per
  block, but it may be derivable from the time signature, so it's deferred rather
  than modeled.
- **Intro handling** (carols use case): `intro_start_bar_offset`/`intro_start_beat_offset`
  mark the exact note the intro starts on; `intro_end_bar_offset`/`intro_end_beat_offset`
  mark where it ends. Played once, skipped on the repeat. **Start and end are independent pairs**
  (ML-103 follow-up), not an all-or-nothing group of four - an intro can span more than one block,
  so one block might carry just the start, another just the end, another both (a self-contained
  intro), or neither.
- **Tempo ramp** (single, legacy): `ramp_start_bar_offset`/`ramp_start_beat_offset` mark
  where acceleration begins within this segment; it ramps forward and lands on the *next*
  segment's own `bpm` at the segment boundary. **`ramp_duration_bars`** (ML-103, nullable):
  how many bars after the start offset it takes to actually reach that target - may land
  before the segment itself ends. NULL alongside a set ramp start keeps the original
  behaviour above (runs to the end of the segment); only meaningful when a ramp start is
  set. Only ever supported one ramp per segment - still read/written by the ad-hoc
  Metronome Blocks tool's own "Speed change" card, left in place unused for Flow blocks.
- **Tempo ramps (list, current)**: `metronome_segment_ramps` (ML-179 follow-up) - a block
  can hold multiple ramps, so it's a child table (`segment_id` FK, same shape as
  `metronome_segment_fermatas`) rather than fixed columns, same "superseded, not removed"
  precedent as `rehearsal_mark`/`metronome_segment_rehearsal_marks` above. Each row has its
  own `start_bar_offset`/`start_beat_offset`; an end point that's either `end_mode =
  'block_end'` (runs to the end of the block, no `end_bar_offset`/`end_beat_offset`) or
  `end_mode = 'specific'` (a mid-block landing point, both offsets set); and a target speed
  that's either `target_mode = 'next_block'` (defers to whatever bpm the following block
  ends up with - only meaningful alongside `end_mode = 'block_end'`, since a specific
  mid-block end can't defer to a value that isn't decided until the block boundary) or
  `target_mode = 'custom'` (a fixed `target_bpm`). This is Flow's own picker
  (`#flowRampModal`) - the ad-hoc tool keeps using the single legacy columns above.
- **Journey/repeat wiring** (ML-103): `is_repeat_start`/`is_repeat_end`, `is_coda`,
  `goto_coda`, `goto_start_dc`, `is_first_time_bar`/`is_second_time_bar` and
  `rehearsal_mark` were all added in the original ML-35 migration but sat dormant
  (never read or written anywhere) until ML-103 wired them into the block editor.
  None of them carry a bar offset of their own - each anchors implicitly to the
  segment's first bar (`is_repeat_start`, `rehearsal_mark`) or last bar (`is_repeat_end`,
  `is_coda`, `goto_coda`, `goto_start_dc`), which is where real notation puts them
  anyway; a marking that needs to sit mid-block is a sign the block should be split
  in two, not a reason to add offsets here. `is_first_time_bar`/`is_second_time_bar`
  describe the block as a whole (a volta ending is typically its own short block) -
  **both may be true together** ("1. 2." combined bracket, before a 3rd ending), so
  this is deliberately not a `CHECK`-enforced exclusive choice.
- **`is_section_boundary`** (ML-103 follow-up): a plain double barline marking a
  phrase/section boundary - visually and musically distinct from `is_repeat_start`
  (no repeat dots, no repeat implication). Same first-bar anchoring as the other
  journey flags above.
- **Segno** (ML-103 follow-up), alongside the existing coda fields: `is_segno` marks
  this block as the segno target; `goto_segno` is "D.S." (jump back to the sign);
  `goto_segno_then_coda` is "D.S. al Coda" (back to the sign, then on to the coda
  next time through) - a distinct instruction from `goto_segno` + `goto_coda` both
  set, so it gets its own column rather than being inferred from the other two.
- **`repeat_play_count`** (ML-103, nullable): total times the repeated passage plays
  (e.g. `2` for "2x"), written on the `is_repeat_end` row - same place real notation
  prints it, at the end-repeat barline. Meaningless (and left NULL) when
  `is_repeat_end` is false.
- **`metronome_segment_fermatas`** (ML-103): a block can hold more than one fermata
  (a sustained hold on a specific beat), so this is a proper child table rather than
  a fixed field pair on `metronome_segments` - `bar_offset` (0-based within the
  block) + `beat_offset` (1-based within that bar) locate it, `hold_beats` (1-4) is
  how many beat-lengths the metronome keeps a continuous tone instead of a click.
  `playback_mode` (ML-103 follow-up; `tone`/`silent`/`count`, default `tone`) is how
  it actually sounds during the hold. Deleted/replaced wholesale alongside the parent
  segment save (no independent add/remove endpoint) - the same "stage everything,
  batch-write on Save" flow the block editor already uses for segments themselves.
- **`metronome_segment_rehearsal_marks`** (ML-103 follow-up): a block can carry more
  than one rehearsal mark, so - same reasoning and same "replace wholesale on save"
  handling as the fermatas table above - this supersedes `metronome_segments.
  rehearsal_mark` (a single nullable column, ML-35), which is left in place unused
  rather than dropped, per this doc's usual "superseded, not removed" precedent.
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
- **`quiet_seconds_before_lead_in`** (ML-92): defaults to `0`. Seconds of
  silence scheduled immediately before the lead-in's own first click, every
  time it's about to play - the very first time, and again on every loop-back
  when `repeat_lead_in` is true. Same "only meaningful on the `is_lead_in`
  row" scoping as the other lead-in-only columns above.
- **`note_value`** (nullable, ML-35 follow-up bug fix): which note value
  ("crotchet", "quaver", ...) a regular block's Target BPM display was last
  set with - purely a display preference for the "note = bpm" label, it never
  changes `bpm` itself. Previously not stored at all, so re-opening a saved
  block to edit it always reset to a denominator-based default instead of
  showing what was actually chosen last. NULL means no preference recorded
  yet (an older row, or a lead-in, which has no independent display of its
  own - the app always resolves the lead-in's display from the current first
  regular block, same as its `bpm`/time signature).
- **`adhoc_metronome_setups.saved_at`** (ML-35 follow-up): naming a setup
  before you could even press play was too much friction, so creating one no
  longer asks for a name up front - it starts as an unnamed scratch copy,
  fully playable, with `saved_at` NULL. The setups list only shows rows where
  `saved_at IS NOT NULL`; "Save for later" is what sets both `name` and
  `saved_at` together. Abandoned scratch rows are never surfaced but aren't
  automatically cleaned up either - acceptable for now, revisit if they pile up.
- **`adhoc_metronome_setups.is_quick_play`**: Quick Play (the front-page tool
  that replaced the old single-bar Metronome page) writes one row per Play
  press straight in as history - `name` is a client-supplied local timestamp
  rather than something the user typed, and `saved_at` is set immediately
  (there's no separate "keep" step, unlike a real setup's scratch-then-save
  flow above). `is_quick_play = true` is what keeps these out of
  `listAdhocSetups`' "Saved setups" list - they're intended for a future
  history view and usage stats instead, not to clutter the library of
  setups someone actually chose to keep.
- **`adhoc_metronome_setups.is_favorite`** (`031_quick_play_history_favorite.sql`,
  ML-34): stars a row in Quick Play's "Show history" list. `listQuickPlayHistory`
  sorts favourites first, alphabetically, then everyone else by `created_at`
  descending - not restricted to `is_quick_play` rows at the column level, just
  in practice only ever set from that list today.
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
- **`score_recordings`/`score_documents`** (`032_flow_metadata_and_media.sql`,
  ML-179): file storage is Vercel Blob, not the database - these tables hold
  only the resulting URL/pathname plus display metadata. Uploads go straight
  from the browser to Blob via `@vercel/blob/client`'s token-authorized
  client-upload (a server route only issues the upload token and records the
  row on completion), not through the Express function - Vercel's serverless
  request body cap (~4.5MB) rules out proxying an mp3/mp4 through it.
  `score_recordings.type` is `'upload'` or `'youtube'`, never both
  (`score_recordings_type_shape` CHECK) - a YouTube entry never touches Blob at
  all, just stores the parsed 11-character video ID (re-parsed and validated
  server-side, never trusted from the client) and a thumbnail URL derived from
  it with no API key needed (`img.youtube.com/vi/{id}/...`). Deleting either
  row's Blob object is an explicit `del()` call in `flows.js` before the DB
  delete - `ON DELETE CASCADE` from `scores` cleans up the rows but has no way
  to reach into Blob storage itself.

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
| `active_timer_sessions` | The practice **timer** tool's currently in-progress run, if any (`ML-197`) - one row per account, synced only on start/pause/resume/snooze (not periodically) and deleted once it finishes/stops, so an accidental reload/relogin can resume it instead of losing it. `elapsed_seconds`/`updated_at` are a wall-clock anchor: while `running`, elapsed is projected forward from `updated_at` using Postgres's own clock, so a resume picks up with exactly the same time left to the second rather than "aware a timer was going" - a pause freezes that projection instead of letting the paused stretch count against it. Deliberately separate from `sessions` (whose `total_duration_minutes` is only ever written once, at completion - see "Session timing" above) rather than a status column bolted onto it | account_id (PK), target_seconds (NULL = open-ended/count-up), elapsed_seconds, running, updated_at |

### Scales

| Table | Purpose | Key columns |
|---|---|---|
| `scale_definitions` | Shared reference list (not per-account) | id, name, type |
| `scale_practice_logs` | History per account | id, account_id, scale_id, session_segment_id, logged_at, bpm_achieved, status |

### Theory practice (ML-260, wired up)

| Table | Purpose | Key columns |
|---|---|---|
| `theory_quiz_attempts` | One finished quiz round (the Theory tool). Score/grade recomputed by the server with `public/theoryEngine.js`; `settings_key` = quiz + round type + visible options, what history and personal bests group by. Counts as practice time, but not linked to sessions yet (`session_segment_id` nullable, for later) | id, account_id, quiz_id, round_type, options (JSONB), settings_key, naming, right_count, wrong_count, score, grade, duration_ms, started_at, session_segment_id |
| `theory_quiz_answers` | Every answer in a round, in order - for a later "practise your weakest notes" mode | attempt_id, seq, question_id, answer_id, correct, ms |
| `theory_question_weights` | Smart learn (ML-269, gated `theory_smart_learn`): how much each person still needs each question, 0-10 (wrong +2, right −1). Rounds deal higher weights first | account_id, question_id (PK together), weight, wrong_count, right_count, updated_at |

See `docs/theory-practice.md`.

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
| `duration_options` | Shared preset duration list (minutes) for the save-session screen and the practice timer (`ML-7`). One row can be `is_default` - the quick timer's starting length when a user has no practise sessions in the last 90 days (`ML-236`) | id, minutes, sort_order, active, is_default |
| `playback_speed_options` | Metronome Blocks' play-speed presets (`ML-109`) | id, percent, active |

Neither is per-account - each is a single tool-wide list, deliberately moved out
of hardcoded frontend HTML so it can be changed without a release. Both are
managed from the admin panel's **Metadata lists** section (`ML-109`), alongside
the (also admin-managed) `time_signature_options` catalog above and a
read-only usage view over `metronome_segments.note_value`'s fixed 5-value
CHECK constraint - the note-value set itself isn't a table, since musical
notation fixes it, not app data.

### App config (`ML-47`)

| Table | Purpose | Key columns |
|---|---|---|
| `app_config` | Generic key/value store for small admin-editable settings that shouldn't need a release to change - currently just `posthog_dashboard_url` (the admin panel's Usage-section link to the PostHog project) | key (PK), value, updated_at |

Not for secrets (readable by any super admin via `/api/admin/config`, same
trust boundary as the rest of that router) and not a replacement for env vars
or the `features` table above - just small display-only values.

### Feature catalog & back-test registry (`ML-26`, `ML-29`)

| Table | Purpose | Key columns |
|---|---|---|
| `features` | Canonical list of what the app actually does today - only things with real, wired-up code, not schema-only areas (scores/practice lists/scales/technique). Manually curated (add/edit/delete) from the admin panel's **Features** page, not just seeded by migrations. `enabled` (ML-190, `042_features_enabled.sql`) is the first column this table has that the *running app* itself reads, not just admin tooling - a global per-feature on/off switch, checked both client-side (hide the entry point) and server-side (refuse the request) wherever a feature opts into it. A feature absent from this table entirely, or present with no code checking it, is implicitly enabled - this is opt-in gating per feature, not a default-deny allowlist | id, feature_key, name, description, enabled |
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

Four of these five tables (`test_cases`, `test_case_features`, `test_runs`,
`test_run_results`) are still purely admin/tooling, never read or written by
the running app itself. `features` is the exception as of `enabled`
(ML-190, `042_features_enabled.sql`, see above) - the running app reads that
one column, for whichever features opt into checking it.

### Flow authoring stats (`ML-199`)

| Table | Purpose | Key columns |
|---|---|---|
| `flow_authoring_sessions` | One row per Flow authoring attempt — how long it took to build or edit, so manual bar entry has a measured baseline to compare a redesigned UI against | id, account_id, score_id, flow_title, kind (create/edit), creation_source (manual/from_file), outcome (in_progress/completed/abandoned), started_at, ended_at, last_heartbeat_at, elapsed_seconds, active_seconds, bars_active_seconds, idle_threshold_seconds, block_count_start, block_count_end, total_bars_end, blocks_added, blocks_edited, blocks_deleted, device_kind, app_version, is_excluded, exclusion_reason |

This exists to answer one question — *did the UI change actually make bar entry
faster* — which is why almost every column here is about keeping numbers
**comparable** rather than merely recording them:

- **Two durations, deliberately.** `elapsed_seconds` is raw wall clock;
  `active_seconds` is the same span with idle trimmed out (the client stops
  counting after `idle_threshold_seconds` with no input, and whenever the page is
  hidden). `active_seconds` is the headline figure — a single interrupted session
  would otherwise wreck an average built from a handful of runs — and `elapsed`
  sits beside it purely as a sanity check. **`idle_threshold_seconds` is stored
  per row** so retuning that rule later makes the change visible in the data
  instead of silently making new rows incomparable with old ones.
- **`bars_active_seconds`** narrows to the Bars tab (including the per-block
  inspector). ML-199 originally asked for a whole-journey figure, but Details and
  Media are a few optional text fields by comparison, so bar entry is measured as
  its own number rather than averaged in with them.
- **`app_version`** (stamped server-side from `public/releases.json`, never sent
  by the client) makes before/after a `GROUP BY` rather than a guess at which side
  of a date a row falls on. Without it the whole table is much harder to use.
- **The client owns the clock**, unlike `active_timer_sessions` (ML-197) where the
  server projects forward from an anchor. Only the browser can see the
  pointer/keyboard/visibility events that separate "entering bars" from "app left
  open", so a server-side projection would measure the wrong thing very precisely.
  The cost is that every value is clamped server-side rather than trusted.
- **`score_id` is `ON DELETE SET NULL`, not `CASCADE`**, with `flow_title`
  denormalised alongside it. Building a baseline means creating and binning a lot
  of throwaway flows, and deleting the flow must not delete the measurement of how
  long it took to build.
- **Abandoned attempts are kept.** A create that never reached Play is a strong
  signal about the UI; writing the row only on success would discard exactly that.
  A row stays `in_progress` when there's no reliable end event (closed tab, killed
  mobile app) — reporting treats a stale `in_progress` row as abandoned rather
  than this table claiming it was.
- **`blocks_edited` counts distinct blocks touched**, not individual field changes
  — one block easily takes a dozen (bpm, bar count, time signature, a repeat
  flag), which would make "seconds per block" meaningless. Lead-in blocks are
  excluded from all the counts, same convention as `blockCount` everywhere else.

Reported in the admin panel under **Usage → Flow authoring time**
(`GET /api/admin/usage/flow-authoring`). Three reporting rules live in
`server/services/flowAuthoringStats.js` and are stated on that page rather than
left implicit: statistics cover **completed, non-excluded** sessions only; an
`in_progress` row with no heartbeat for 10 minutes counts as **abandoned** (it
has no end event, so its seconds are a lower bound, never averaged); and every
figure leads with the **median plus min/max**, because at baseline sample sizes
a single interrupted run visibly moves a mean and a wide min–max is the signal
that the median isn't yet describing anything stable. Per-bar and per-block are
both reported — one 16-bar block and sixteen 1-bar blocks are the same music but
very different data entry, so per-block measures the cost of the card UI while
per-bar measures cost per unit of actual music, which is the only fair way to
compare flows of different lengths. Per-bar is deliberately NULL for edit
sessions: an edit touches an unknown subset of the flow's bars, so a per-bar
figure there would be arithmetic rather than measurement.

Gated by the `flow_authoring_stats` feature row (checked when a session
*starts*; one already running still finalises), and visible only to super admins.
Deliberately not a PostHog concern (`public/analytics.js`) — that's autocapture,
i.e. click counts with no notion of a session that starts here, ends there, and
has a duration.

### Feedback (`ML-170`)

| Table | Purpose | Key columns |
|---|---|---|
| `feedback` | In-app feedback, submitted from the hamburger menu and triaged by super admins | id, account_id, message, category, status, admin_response, route, user_agent, device_kind, app_version, created_at, updated_at |

- **The capture form is a bare text box.** `category` is NULL until an admin sets
  it at triage — categorisation is a triage decision, and anything standing
  between noticing a problem and recording it is a reason not to bother. NULL is
  a real state ("untriaged", the admin list's own filter and the count badge on
  the sidebar), not missing data, hence nullable rather than a `'none'` member of
  the CHECK.
- **The status set reconciles three inconsistent lists in the ticket.** ML-170
  gives user badges (Planned/Under Review/Not progressing), admin filters (the
  same three) and an admin dropdown that alone mentions `in_progress` and
  `resolved` — neither of which had a badge colour or a filter anywhere. All five
  are canonical here, each with a colour and a filter, so the lists can't drift
  apart again.
- **Context is captured silently at submit**, which is what lets a note written
  in five seconds still be actionable a fortnight later. `route` stores the *view
  name*, not `location.pathname` — this is a single-page app, so the path would
  read `/` for every report ever filed. `device_kind` and `app_version` reuse
  exactly what ML-199 established (short-edge classification; version read
  server-side from `public/releases.json`, never client-supplied).
- **Only `message` is accepted from the client.** Status, category,
  `admin_response` and `app_version` are set by the server or by an admin, so a
  submission can't choose its own priority or claim a version it isn't running.
- **`updated_at` means "when was this last looked at"**, moved to `now()` by the
  admin save (ML-170's own requirement), as distinct from `created_at`'s "when
  was it written".

Gated by the `feedback` feature row (client hides the menu entry, server refuses
the POST). The user-facing **"My Feedback"** view — past submissions with status
badges and the admin's reply — is a deliberate follow-up, not built yet;
`admin_response` and `idx_feedback_account` exist now so it needs no migration of
its own.

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

### Notifications (`ML-201`)

| Table | Purpose | Key columns |
|---|---|---|
| `notifications` | Announcements a super admin writes for every account's ☰ → Notifications | id, title (≤120), body (plain text, ≤4000), audience ('all' only for now), publish_at, expires_at, withdrawn_at, created_by_account_id, created_at, updated_at |
| `notification_reads` | Which account has read which notification - absence means unread | notification_id, account_id (PK together), read_at |

- **No scheduler**: "live" is computed at query time (`publish_at <= now()`, not expired, not withdrawn), and clients poll every ~5 minutes - a scheduled notification just starts matching.
- **Everyone sees every live notification**, including accounts created after it was published, until its optional expiry.
- **Withdraw vs delete**: `withdrawn_at` hides it but keeps the read history; a delete cascades the reads away.
- **`audience`** is a placeholder for targeting (bands, account levels, plans) - its CHECK widens when a second value is actually supported.
- The **"update available - reload"** notice is deliberately not a row: it's about the code running on one device, worked out client-side from the server's version. See [`docs/notifications.md`](notifications.md).

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
