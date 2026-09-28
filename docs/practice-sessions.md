# Practice sessions, Levels, practice lists and skills (epic ML-314)

How the practice session builder fits together. Read this before changing any part of it. The owner's
agreed concept and every decision behind it are in the ML-314 epic (and the concept page linked from
it).

| Part | Ticket | Where |
|---|---|---|
| Levels 1-5 per chunk of bars, the chunk length rule, the heat map | ML-315, ML-316 | `public/flowJourney.js` ("Practice Levels" in [flow-journey.md](flow-journey.md)), My Levels screen (`#pieceLevelsView`), `piece_chunks` |
| Practising a chunk at its Level (Rehearse's practice mode) | ML-317 | `flowSession` in app.js |
| The session: planner, runner, 4:30 nudge, templates, resume | ML-320 | `public/practicePlan.js`, `#sessionPlanView`, `#sessionRunView`, the session bar |
| Practice lists, readiness forecast, join-up groups, band lists | ML-319 | `PracticePlan.forecast`, `#practiceListView` (on Rehearse), `server/services/practiceLists.js` |
| Skills lists | ML-321 | `SKILLS` in app.js, `#skillsView`, `server/services/skills.js` |
| Other "Level" labels renamed (Help, Notes, Difficulty, Account type) | ML-318 | - |
| Cleaning up challenges | ML-324 (to do) | - |

Everything is behind the `practice_levels` feature. With it on, **Start a practice session**
replaces **Start a challenge** on the home screen.

## The session (ML-320)

- **Blocks:** a session is 5-120 minutes, one 5-minute block per 5 minutes. At 5 and 10 minutes you
  choose every block yourself. From 15 minutes a template fills them:
  - **Standard:** Warm-up, Scales, then the focus.
  - **Concert:** Warm-up, then the focus.
  - **Your own:** saved as a name, the opening blocks in order, a focus and a length
    (`practice_templates`).
- **Focus:** Skills, Rehearsal or Both. Both splits the rest in half, and an odd block goes to
  Rehearsal.
- **What fills the blocks:**
  - **Rehearsal** blocks take chunks weakest first, then the one practised longest ago
    (`/api/practice/chunks`).
  - **Skills** blocks take the skill on your list practised longest ago. With an empty list they
    rotate through the playing tools.
  - From a practice list, only that list's pieces are used.
  - **A Rehearsal block with no Levels to use** never holds up the start. Its choices are:
    - **Set up <piece>** for each piece with no Levels yet. This goes through that piece's "How well can you play it?" on My Levels, and saving comes straight back to the plan with the block on the new bars (`setUpPieceForBlock` / `backToPlanAfterSetup`). The planner also has a **Set up a piece** button when you have no Levels at all.
    - **Any piece**, which opens Rehearse to pick one and play it your way.
- **The runner** counts each block by the wall clock.
  - **At 4:30** the sound stops. Play Flow pauses; any other tool is left for the session screen,
    and leaving a tool stops it. A 30-second nudge then moves you on.
  - **Keep going** nudges again 5 minutes later.
  - **A Rehearsal block** asks "How did it go?" before moving on. **A Warm-ups or Scales skill**
    asks "Got it?".
- **Logging:** a session that ends, or is ended early, is saved as one `sessions` row plus a
  `session_segments` row per block (with the block's seconds, chunk and tool), so Stats and history
  see it.
- **Resume:** the running session is kept on the server (`active_practice_sessions`, one per account)
  whenever it changes. The current block's start is stored by the database clock, so a reload, or
  another device, picks it up with the right time left.
  - A session untouched for 3 hours or more is saved as it stood (the block you stopped in counts up
    to its 5 minutes) and cleared.
- **Rules and tests:** `public/practicePlan.js` (blocks, filling, the nudge states, the forecast), in
  `server/test/practicePlan.test.js`.
- **Local test hook:** with `tml.testClock` on localhost, `window.__sessionTest` gives `run()`,
  `plan()`, `skip(seconds)`, `skills()` and `drillSaved(tool, level, grade)`.

## Levels (ML-315/316/317)

See "Practice Levels" in [flow-journey.md](flow-journey.md): speeds as a % of the piece's tempo, session
sub-beats, the 4:30 chunk length rule, the heat map, and the practice mode.

## Practice lists and the forecast (ML-319)

- **A list** is a concert's pieces, with its date, sessions a week and minutes per session. It's
  personal, or a band's: any member of the band can create and change a band's list.
- **The forecast** assumes one block moves one chunk up one Level.
  - **Nothing is guessed:** pieces not set up, and chunks with no Level, are named as "not counted".
  - **Join-up groups** (`piece_chunks` kind `group`): the chunks only need Level 4, then each group
    needs a run-through block until it's at Level 5.
  - **Sessions needed** is blocks ÷ rehearsal blocks per session. **Sessions available** is days to
    the date × sessions a week ÷ 7.
  - **When you're behind**, it suggests the first change that gets you there: Concert template, then
    Rehearsal focus, then more sessions a week. "Plan a session for this" applies it.
- **Each member's forecast** uses their own Levels.

## Skills (ML-321)

- **A skill** is a playing tool plus its steps in order (`SKILLS` in app.js):

  | Skill | Steps |
  |---|---|
  | Tempo | its help steps |
  | Pulse | its drills |
  | Pitch (Play it back) | its note sets |
  | Scales - major / minor (harmonic) | key by key, fewest sharps or flats first |
  | Warm-ups, per kind | the exercises of that kind, in order |
| Rhythm - words / one beat / two beats / triplets / 6/8 (ML-306) | the set's rhythms in order, passed at grade 4 or 5 ([rhythm.md](rhythm.md)) |
| Range - top / bottom notes (ML-305) | the note just beyond your range (it moves with your range - see [range.md](range.md)) |

- **Passing a step:**
  - Tempo, Pulse and Pitch pass at **grade 4 or 5**. `saveDrill` hands each saved round to
    `skillDrillSaved`.
  - Warm-ups and Scales ask **"Got it?"**, at the end of a Skills block or with the Got it button on
    My skills.
- **Server tables:** `skill_list_items` holds your list and where you're up to; `skill_step_results`
  holds every go.
- **Range (ML-305)** is built: moving your range passes its step ([range.md](range.md)). **Rhythm
  (ML-306, with its crib sheet)** is built too ([rhythm.md](rhythm.md)).
