# Usage statistics: what counts as a use (ML-22)

**Status: checked by the owner (25 Oct 2026) - his answers are at the end. The counting is built (step 2,
"How it is counted" below); the page that shows it, Admin → Usage → Heat map, is step 3 and not built yet.**

ML-22 asks how much each feature is used, so the owner can see what is used a lot and what is barely
used. This page says, tool by tool, what one use is. Every count built later follows this page, so a
change to what counts as a use is made here first.

## The rules for every item

- **Two numbers per item: started and finished.** A use *starts* when someone sets the thing going. It
  *finishes* when they get to the natural end, the point where the tool has done its job. Finished ÷ started
  shows where people give up.
- **On its own, or in a practice session.** A tool opened from Home, All tools or the menu is *on its own*.
  The same tool played as a block of a practice session is *in a session*. Each is counted on its own line,
  so Scales played in sessions can be told apart from Scales chosen on its own.
- **Counted, never who.** Counts are kept as a number per item per day, with no account on them (as
  Instrument support already counts its looks). Nobody's own use is ever shown or kept by these counts.
- **What is already recorded is used.** Where the app already keeps a row for each use (a practice session,
  a drill round, a Theory round...), the count comes from that row, which also gives the history back to
  launch. Only the rest gets a new counter, from the day it is switched on.
- **A use is only counted once.** Pressing Play, Stop, Play again within a minute is one use, not two.
  Leaving a tool and coming back to it later is another use.
- **Tests and admins.** The local test accounts are left out. Super admins' own use is counted (the
  owner plays the app too), but can be filtered out on the page.

Column **Recorded?**: **Yes** means rows exist already; **New** means a new counter.

## Everyday tools

| Item | Switch | Started | Finished | Recorded? |
|---|---|---|---|---|
| Metronome | `metronome` | Play pressed | It played for at least 30 seconds | New |
| Metronome: Quick Play setup saved | `metronome_history` | — | A setup saved to Quick Play's history | Yes (`adhoc_metronome_setups`) |
| Metronome: Save to a piece | `metronome_save_to_flow` | — | Saved as a piece | Yes (`scores`) |
| Tuner | `tuner` | The microphone turned on | A note was heard and shown | New |
| Tuner rewind | `tuner_rewind` | — | Rewind used | New |
| Tuning fork | `tuning_fork` | A note played | It sounded for at least 5 seconds | New |
| Timer | `timer` | Start pressed | It ran to the end | New |
| Timer: "Just another 5 minutes?" | `timer` | — | Tapped | New |
| Log time (by hand) | `session_logging` | — | A session saved | Yes (`sessions`) |

## Practice sessions

| Item | Switch | Started | Finished | Recorded? |
|---|---|---|---|---|
| A practice session ("Start a practice session") | `practice_levels` | Started (after step 3) | Every block played, or ended and logged | Partly (`sessions` and `session_segments` hold the ones logged; one started and left isn't kept) |
| Standard plan / Concert plan / my own / Build my plan | — | The plan picked for a session that started | (as the session) | New (the plan's name on the counter) |
| A block in a session (Warm-ups, Scales, Skills, Pieces, Theory) | — | The block began | Played to its end | Yes (`session_segments`, with `actual_seconds`) |
| The 30-second rest | — | — | Skipped early, or ran out | New |
| "+5 minutes" when the time is up | — | — | Tapped | New |
| Keep going (an open-ended session's next block) | — | — | A block added | New |
| Resuming a session left running | — | — | Resumed | New |

## Practise and learn tools

| Item | Switch | Started | Finished | Recorded? |
|---|---|---|---|---|
| Warm-ups | `warmups` | Play pressed on an exercise | Played to the end of the exercise | New (in a session: Yes, as a block) |
| Scales | `scales_practice` | Play pressed on a scale | Got it or Not yet answered (with Levels on), or played to the end | Partly (`scale_level_results` has each Got it / Not yet) |
| Scales Levels | `scales_levels` | (as Scales) | A Level changed | Yes (`scale_level_results`) |
| Theory | `theory_practice` | A quiz begun | A round finished | Yes (`theory_quiz_attempts`) |
| Theory grades / SmartLearn | `theory_grades`, `theory_smart_learn` | (as Theory) | A round finished in that mode | Yes (`theory_quiz_attempts.settings_key`) |
| Pitch | `ear_training` | A round begun | A round finished | Yes (`drill_attempts`, tool `ear`) |
| Tempo | `tap_tempo` | A round begun | A round finished | Yes (`drill_attempts`, tool `tapTempo`) |
| Pulse | `gap_trainer` | A round begun | A round finished | Yes (`drill_attempts`, tool `gapTrainer`) |
| Rhythm | `rhythm_trainer` | A round begun | A round finished | Yes (`drill_attempts`, tool `rhythm`) |
| Range | `range_trainer` | A go begun | A go finished | Yes (`range_goes`) |
| A skill step (Skills lists) | — | — | A step passed or not | Yes (`skill_step_results`) |

## Pieces: Rehearse, My music, Add a piece, Prepare

| Item | Switch | Started | Finished | Recorded? |
|---|---|---|---|---|
| Rehearse: play a piece | `rehearse`, `flow_playback` | Play pressed | Played to the end, or for at least 1 minute | New |
| Rehearse: repeat bars | `rehearse` | — | A stretch of bars set to repeat | New |
| Rehearse: a recording or video played with the bars | `rehearsal_score` | Play pressed | Played for at least 30 seconds | New |
| Add a piece | `flow_create` | Add a piece opened | A piece saved | Yes (`scores.created_at`, how it was made in `flow_authoring_sessions`) |
| Quick entry | `piece_quick_entry` | Quick entry begun | The piece saved | Yes (`flow_authoring_sessions`) |
| Import from MusicXML / MuseScore | `flow_import_musicxml`, `flow_import_musescore` | A file chosen | The piece saved | Partly (`flow_authoring_sessions.creation_source`) |
| A piece from a photo or PDF | `piece_from_photo` | Pages sent | A piece saved from the read | Yes (`piece_reads`) |
| Export to MusicXML | `flow_export_musicxml` | — | A file made | New |
| A copy of a public piece | — | — | Copied | Yes (`scores.copied_from_score_id`) |
| Editing a piece's bars | `flow_editor` | The editor opened | Saved | Yes (`flow_authoring_sessions`) |
| A piece in movements | `piece_movements` | — | A piece saved with movements | Yes (from the blocks) |
| Prepare: a piece's path | `practice_levels` | A piece's path opened | A step done (run-through, bars painted, cut into focus bits) | Partly (`chunk_level_changes`) |
| Files on a piece | `piece_files` | — | A file added | Yes (`score_documents`) |
| A recording on a piece | `recording_clip` | — | Added, or its start and end set | Yes (`score_recordings`) |
| Recordings tool | `rehearsal_recordings` | Opened | A recording given to a piece | Yes (`rehearsal_recordings`, `score_recordings`) |
| Practice lists | — | — | A list made, or a piece added to one | Yes (`practice_lists`, `practice_list_scores`) |

## The menu and the rest

| Item | Switch | Started | Finished | Recorded? |
|---|---|---|---|---|
| Stats | `statistics` | Opened | — | New |
| My instruments | — | Opened | An instrument added or changed | New |
| Instrument support | `instrument_support` | Opened | A business opened | Yes (`support_search_counts`, `support_listing_counts`) |
| Set-up for new members | `member_setup` | Begun | Finished (rather than left part-way) | New |
| Invite someone | `invite_members` | Opened | An invitation sent | Yes (`auth_email_links`, an invitation link) |
| Send feedback | `feedback` | Opened | Sent | Yes (`feedback`) |
| Notifications | `notifications` | The list opened | — | New |
| Band notices | `band_notices` | — | A notice sent | Yes (`notifications`, kind `band_notice`) |
| Band leader's summary | `band_levels_summary` | — | Looked at | New |
| A band's welcome | `band_welcome` | Shown | Joined | New |
| Choose favourite tools | — | — | Favourites saved | New |

## Not counted

These are switches for how the app works rather than things a member chooses to use, so a count would
say nothing about value: `google_login`, `password_login`, `change_email`, `navigation_menu`,
`auto_notices`, `notice_emails`, `flow_authoring_stats`, `flow_consistency_check`, `flow_transfer` (admin
only), `manage_lists`, `manage_tutor`, `waiting_list` (requests are already on Admin → Waiting list).

## Every button (owner, 25 Oct 2026)

As well as the uses above, **every button that can be pressed is counted**, so a button nobody uses shows
up - Back on Scales, a setting in a pop-up, a ⋮ menu item. The full list, grouped by tool, is
[usage-buttons.md](usage-buttons.md), made by `node scripts/usage-buttons.mjs` (885 buttons when it was
first run, 10 without a name yet).

- **A tap is counted by where it was pressed and the button's own name** - its `id`, its `data-act` (with a
  fixed `data-arg`), or another `data-*` attribute - **never by its words**, which can hold a piece's title
  or someone's name. A number in a name (`data-setup="inst:44"`) is left off, so every instrument row counts
  as one button.
- **Where it was pressed** is the screen or pop-up the button is on. A button every screen shares - the top
  bar's Back, the timer pill, a ⋮ menu, the choice pop-up - is counted with the screen it was pressed on, so
  "Back on Scales" and "Back on Warm-ups" are two numbers.
- **In a practice session or on its own**, as for the uses above.
- **A button with no name can't be counted.** The script lists them as "needs a name"; each gets an `id` or
  `data-count="..."` before the counting goes live, and a unit test then fails a release that adds a button
  without one.
- **Close (X) and Done** are told apart where it matters by giving one of them `data-count`.

## How it is counted (step 2)

- **`public/usage.js`** (window.Usage, loaded before app.js) holds the list of uses (`USES`, with the time
  after which one counts as finished), the naming rule for buttons (`buttonName`) and the counting. The
  server (`server/services/usageRules.js`) and the button list (`scripts/usage-buttons.mjs`) load the same
  file, so all three follow one rule.
- **Three kinds:** `use` (a tool's start and finish, from the hooks in app.js marked "ML-22"), `tap` (every
  button, by one click listener on the page, before the button's own code runs) and `view` (every screen
  opened, in `switchView`). Play, Stop, Play again within a minute is one use; a use that finishes after a time
  (30 seconds of metronome) waits while it is paused.
- **On the device** the counts are added up and sent every 30 seconds, and when the app goes into the
  background, to `POST /api/usage` - straight, not through `apiCall`: a count that can't be sent waits for
  the next try and is lost if the app closes; none waits in the offline outbox. Nothing is counted while a
  super admin previews the app as another account type.
- **Members:** the device remembers which items it has used today (`localStorage` `tml.usageSeen`, cleared
  each day and at sign-out - in the privacy policy) and marks the first use of each as "first today"; the
  server adds those up as `members`.
- **On the server** each row is checked (a known kind, place and use; a name, never typed text; small whole
  numbers) and added to that day's row in **`usage_counts`** (migration 160): day (London), kind, item,
  place (`own` / `session`), who (`member` / `admin` / `test` - the account is used for nothing else), started,
  finished, members. No account column, so nothing in it is about anyone.
- **A new button needs a name.** `server/test/usageCounts.test.js` reads every button (the same scan as
  `scripts/usage-buttons.mjs`) and fails if one has no id, no `data-*` attribute and no `data-count`. A tile
  built from a list gets `data-option` (`usageOptionKey` in app.js), so each choice is counted on its own.
  Run `node scripts/usage-buttons.mjs` after adding buttons to bring [usage-buttons.md](usage-buttons.md) up
  to date.
- **A new tool** gets a line in `USES` and a `window.Usage?.begin / end / finish` where it starts, pauses
  and gets to its end - and a line in the tables above.

## The owner's answers (25 Oct 2026)

1. **The time limits:** yes - 30 seconds for a metronome or a recording, 5 seconds for the Tuning fork, 1
   minute for a piece in Rehearse.
2. **The Tuner** finishes when a note is heard.
3. **Scales on its own** finishes when the scale has been played to its end, with Levels on or off.
4. **Every button** is counted, grouped by tool (above).
5. **No split by account type** for now. **How many members used it** goes on the page, as a number only:
   from the rows that already record practice, and - for what is newly counted - from a second number per
   item per day: the app on the device says when it is the first time today that this member used the item,
   and the server adds one. No account is kept on it. Someone on two devices in a day counts twice, so it is
   "about how many members".
