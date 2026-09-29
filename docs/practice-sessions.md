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

- **Blocks:** a session is 5-120 minutes (−/+ and a slider in 5-minute steps, ML-337), one 5-minute
  block per 5 minutes. At 5 and 10 minutes you choose every block yourself. From 15 minutes a template
  fills them:
  - **Standard:** Warm-up, Scales, then Skills and Rehearsal (focus Both).
  - **Concert:** Warm-up, then Rehearsal (focus Rehearsal).
  - **Your own:** saved as a name, the opening blocks in order, a focus and a length
    (`practice_templates`).
- **Focus** is part of the template (ML-342) - the planner doesn't ask. Skills, Rehearsal or Both;
  Both splits the rest in half, and an odd block goes to Rehearsal. A line under the template pills
  says what the chosen one does (`PracticePlan.templateFocus`).
- **Skills list and warm-up list** (ML-339 / ML-343): the planner picks which of your skills lists
  the Skills blocks use and which warm-up list the Warm-up blocks play (both remembered per device).
- **What fills the blocks:**
  - **Rehearsal** blocks take chunks weakest first, then the one practised longest ago
    (`/api/practice/chunks`).
  - **Skills** blocks take the skill on your list practised longest ago. With an empty list they
    rotate through the playing tools.
  - From a practice list, only that list's pieces are used.
  - **Warm-up** blocks play the chosen warm-up list: its exercises (`PracticePlan.warmupSequence`)
    in the Warm-ups tool, or with **External warm-up** nothing at all - you stay on the session
    screen while the block's timer runs.
  - **A Rehearsal block with no Levels to use** never holds up the start. Its choices are:
    - **Prepare <piece> for practice** (ML-334's name for it) for each piece with no Levels yet. This goes through that piece's "How well can you play it?" on My Levels, and saving comes straight back to the plan with the block on the new bars (`setUpPieceForBlock` / `backToPlanAfterSetup`). The planner also has a **Set up a piece** button when you have no Levels at all.
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

## Practice lists and the forecast (ML-319, reworked by ML-332/333/334)

- **A list** is the pieces you're working towards, with an optional **target date** (a concert, an
  exam, a lesson - ML-332: a button opening a pop-up, "No target date" or "Pick a date"; ML-348: the
  button is one fixed quarter-width cell of the 4-across grid, showing dd mmm yy). Each piece row
  has a ⋮ menu (ML-349): **Prepare levels** (**Edit levels** once it has them), then **Delete**,
  which asks first and offers Undo. **Add pieces** (ML-351) is the same pick list as Add skills,
  offering only pieces not on the list yet, filtered like My music (All / Mine / each band / Public,
  plus search); Select all / Unselect all act on what the filter shows. It's
  personal, or a band's: any member of the band can create and change a band's list. There's nothing
  else to type in (ML-333 took out sessions a week and minutes each; the columns stay, unused).
- **The forecast** (`PracticePlan.forecast`) counts five-minute blocks, assuming one block moves one
  chunk up one Level:
  - **A piece not set up yet** is fine on a list: it counts one block, **preparation for practice**
    (ML-334 - giving it its Levels). Its row says so and "Prepare it now" opens My Levels. After
    that its Levels decide.
  - **Nothing else is guessed:** chunks with no Level are named as "not counted".
  - **Join-up groups** (`piece_chunks` kind `group`): the chunks only need Level 4, then each group
    needs a run-through block until it's at Level 5.
  - **With a target date** it shows the pace: blocks a day (rounded up) and the minutes that is. No
    on-track / behind verdict - there's nothing to compare against.
  - **"Plan a session for this"** opens the planner on the list's pieces with the Concert template.
- **Each member's forecast** uses their own Levels.

## Skills (ML-321; lists ML-339, grades ML-338)

- **Skills lists (ML-339):** you can keep several named lists (`skill_lists`), each a set of skills in
  order. My skills shows one at a time (a pill each, + New list, Rename, Delete). Where you're up to
  on a skill (`skill_list_items`) is shared by every list it's on and kept when it comes off one.
  Rows show the skill and where you're up to only (ML-341) - practising happens in sessions.
- **Adding skills (ML-340):** tick several in Add skills, then Add (ML-353: a pick list - tick boxes,
  Select all / Unselect all on the grade showing, "Add N skills" pinned at the bottom; see
  `specs/components/pick-list.md`). **Grades (ML-338):** the pop-up
  filters by Grade 1-5. Each skill belongs to a span of grades (`SKILLS[k].grades` in app.js), a first
  cut the owner can adjust:

  | Skill | Grades |
  |---|---|
  | Tempo, Pulse, Pitch, Range | 1-5 |
  | Scales - all major keys / all minor keys | 1-5 / 2-5 |
  | Scales - Grade N major keys | N: keys up to N sharps or flats (Grade 5: all) |
  | Scales - Grade N minor keys (harmonic) | N = 2-5: keys up to N-1 sharps or flats (Grade 5: all) |
  | Warm-ups: long tones, articulation, finger patterns / lip slurs / flexibility / easy melodies | 1-5 / 2-5 / 3-5 / 1-3 |
  | Rhythm: words / one beat / two beats / triplets / 6/8 | 1-2 / 1-3 / 2-4 / 3-5 / 4-5 |

- **Warm-up lists (ML-343):** also on My skills. Everyone has **External warm-up** (just the timer),
  **One of each kind**, **Brass basics** (long tones, then lip slurs) and **Everything, random**
  (`PracticePlan.WARMUP_LISTS`). Your own (`warmup_lists`) are kinds of warm-up, in order or random.

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
