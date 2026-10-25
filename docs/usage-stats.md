# Usage statistics: what counts as a use (ML-22)

**Status: a draft for the owner to check (25 Oct 2026). Nothing here is built yet.**

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

## Questions for the owner

1. **The time limits.** Is 30 seconds right for a metronome or a recording to count as finished, 5 seconds
   for the Tuning fork, and 1 minute for a piece in Rehearse?
2. **The Tuner.** Is "a note was heard" the right finish, or should it be a note held in tune?
3. **Scales on its own.** Count a finish when the scale has been played to its end, even with Levels off?
4. **Anything missing** that you want to see used: a button, a setting (for example the Scales or Warm-ups
   settings PostHog already counts), or a screen?
5. **The two earlier calls:** no split by account type for now; and whether "how many members used it"
   (from the rows that already record practice, only ever as a number) goes on the page.
