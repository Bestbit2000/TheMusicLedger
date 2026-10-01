# Practice sessions, Levels, practice lists and skills (epic ML-314)

How the practice session builder fits together. Read this before changing any part of it. The owner's
agreed concept and every decision behind it are in the ML-314 epic (and the concept page linked from
it).

| Part | Ticket | Where |
|---|---|---|
| Levels 1-5 per chunk of bars, the chunk length rule, the heat map | ML-315, ML-316 | `public/flowJourney.js` ("Practice Levels" in [flow-journey.md](flow-journey.md)), a piece's path (`#piecePathView`, was My Levels), `piece_chunks` |
| Practising a chunk at its Level (Rehearse's practice mode) | ML-317 | `flowSession` in app.js |
| The session: planner, runner, 4:30 nudge, templates, resume | ML-320 | `public/practicePlan.js`, `#sessionPlanView`, `#sessionRunView`, the session bar |
| Stepped sessions: three steps to set up, plans, Keep going, the 30-second rest and its messages, Prepare (run-through, paint, knife), Play-through, the warm-up loop | ML-390 | `public/practicePlan.js`, `public/flowJourney.js`, the "ML-390" sections of app.js, `server/services/restMessages.js`, Admin → Rest messages, migration 087 |
| Practice lists, readiness forecast, join-up groups, band lists | ML-319 | `PracticePlan.forecast`, `#practiceListView` (on Rehearse), `server/services/practiceLists.js` |
| Skills lists | ML-321 | `SKILLS` in app.js, `#skillsView`, `server/services/skills.js` |
| Other "Level" labels renamed (Help, Notes, Difficulty, Account type) | ML-318 | - |
| Cleaning up challenges | ML-324 (to do) | - |

Everything is behind the `practice_levels` feature. With it on, **Start a practice session**
replaces **Start a challenge** on the home screen.

## The session (ML-320, made into steps by ML-390)

Designed for a ten-year-old who knows nothing about music: one question a screen, time you can see, colours
that always come with an icon or a number, and a real rest between blocks. The design run-through the owner
agreed (30 September 2026) is on the ML-390 ticket; the rules are `public/practicePlan.js`.

### Setting it up - three steps, then Ready

1. **How long?** (`#sessionLengthView`) The minutes as **5-minute blocks you can count** (a new one pops in),
   − / + and the slider (5-120), quick picks (10, 20, 30, 45 min, 1 hour) and **Keep going** - no end time: it
   starts with 4 blocks and adds one each time you finish one, following the plan's pattern.
   **Same as last time** (per device, `tml.session.last`) jumps straight to Ready.
2. **Pick a plan** (`#sessionPickView`) - a "template" is a **plan** on screen. Each plan is drawn as its row of
   coloured blocks at the length picked (Warm-up orange, Scales teal, Skills violet, Pieces blue - always with
   the icon). Built in: **Standard** (Warm-up, Scales, then half Skills / half Pieces, an odd block to Pieces) and
   **Concert** (Warm-up, then Pieces). Short sessions keep at least one focus block (10 min Standard = Warm-up,
   Pieces). Your own plans are listed too; the one picked can be changed ("Change my plan").
   - **Build my plan** (`#sessionBuildView`): tap a kind of block to drop it into the next space, tap a space to
     empty it, **Surprise me** fills the gaps, **Clear**; up to 12 spaces. Saved as your own plan
     (`practice_templates.blocks`); past its end it repeats from its first Skills or Pieces block
     (`PracticePlan.stretch`), so a warm-up isn't repeated. Plans saved before ML-390 (opening blocks + a focus)
     still work.
3. **What goes in?** (`#sessionContentView`) One row per kind of block in the plan: **Warm-up** (which warm-up
   list - it plays on a loop), **Scales** (your grade's scales in the Scales tool), **Skills** (which skills
   list). **Pieces** come from a **practice list**, **pieces you choose** (one or several, the Add pieces pick
   list) or **all your pieces** with Levels. **Auto** (on by default) picks the bars; off, you pick each Pieces
   block's bars on Ready. The card shows the next goal ("every 1 up to 2") and each piece's Level bar (how many bars at each Level,
   the key under the list) and where it is on its path.
4. **Ready** (`#sessionPlanView`) - the strip and the timeline; tap a block to swap it; **Start**.

"Plan a session for this" on a practice list opens the steps on that list with the Concert plan.

### What fills the Pieces blocks (Auto - `PracticePlan.piecePool`)

- A piece with **no Levels yet** gets a **Prepare** block first (each once) - see "Getting a piece ready".
- Then every **focus bit** (a chunk below **Level 4**) across the pieces, **lowest Level first**, then practised
  longest ago - so all the 1s go up to 2 before any 2 goes to 3 ("everyone up to the next Level").
- Then **play-through parts** that are ready (every bar inside them at 4 or more), at Level 4 → 5. A part too long
  for a block gets a **10-minute block** ("one long go").
- With more blocks than items they come round again; with nothing at all, "Any piece" (opens Rehearse).
- Skills blocks take the skill on your list practised longest ago (or rotate through the playing tools).

### Running it

- **The block clock:** 5 minutes a block (10 for a long play-through). **The sound stops 30 seconds early when a
  rest follows** (`PracticePlan.playSeconds`); otherwise it runs the full 5 minutes. A **Prepare** has no end -
  you move on when it's done (the time it took is logged).
- **When a block's time is up** (or Next block): Play Flow pauses where it is and any other tool is left (which
  stops it). A Pieces block asks **"Did you nail it?"** - one tap: **Yes! Level up** (a short star celebration) or
  **Not yet**; "Too fast? Back to Level N" is a link under them, and **Move up even further** opens the jumps to
  higher Levels (owner, 1 Oct 2026). Under it, the piece's next goal with its Level bar. A Warm-ups/Scales skill asks "Got it?". Then the rest, or the next block.
- **No "Keep going" on a block** any more (owner, 30 Sept 2026): the rest always happens. For more time, pick a
  longer session or Keep going (open-ended).
- **Keep going sessions:** there's always the next block planned (the rest needs to know what's next); a new
  Pieces block takes what needs you most that isn't one of the last three, a new Skills block the skill practised
  longest ago that isn't one of the last two.
- **A Warm-up block loops its list** (`sessionWarmupLoop`): one exercise after another with the click on, round
  after round, each round 10% faster (`PracticePlan.warmupRoundBpm`), until the block ends. It's one metronome
  sequence, so the next warm-up comes in on the beat with a single bar-start click (docs/warmups.md, "Playing").
- **Logging:** a session that ends, or is ended early, is one `sessions` row plus a `session_segments` row per
  block (seconds - the rest counts with the block before it - chunk and tool), so Stats and history see it.
- **Resume:** the running session is kept on the server (`active_practice_sessions`) whenever it changes,
  including the rest (timed from its own start) and Keep going's plan. A reload or another device picks it up;
  one untouched for 3 hours is saved as it stood and cleared.

### The 30-second rest (ML-390)

In music the rest is as important as the notes. **Before every playing block except the first** (Warm-up,
Scales, Skills, Pieces practice), **never before a Prepare or a Play-through**, and none at the end
(`PracticePlan.restBefore`). A calm screen (`#sessionRestView`, [rest-screen](../specs/components/rest-screen.md)):
the countdown ring, **one message** with a picture, and Next up. **No Skip** - the next block starts by itself at 0.

- **The messages** (`rest_messages`, 80 to start in seven kinds: why we stop 12, breathe 12, loosen up 14, think
  like a musician 12, did you know? 12, look after yourself 8, kind words 10) are changed on **Admin → Rest
  messages** - add, edit, switch off, move, delete; no release needed.
- **Each player's deck** (`account_rest_decks`, `PracticePlan.drawRest`): every message once before any comes round
  again; never the same kind twice running; a breathing one at least every third rest (when the deck has none left,
  any breathing exercise again - they come round more often on purpose). A 45-minute session has 8 rests, so the
  other 68 messages last about 12 sessions.
- **Who gets what** by the player's instruments: lip messages (`brass`) to brass players, breath and air (`wind`) to
  brass and woodwind; no instruments set = everything.
- **Breathing ones** show a circle that grows for 4 seconds and shrinks for 6 (three breaths in the rest).

### Getting a piece ready: Prepare, Practise, Play-through (ML-390)

Every piece follows three stops on **its path** (`#piecePathView`, [piece-path](../specs/components/piece-path.md)),
opened from a practice list, Play Flow's menu (My Levels) and a session's Prepare block:

1. **Prepare** (once, as long as it needs):
   - **the music** - it's in My music;
   - **a run-through** (`#prepareRunView`): pick a speed you can get to the end at - Level 1-5, shown **as a % of
     the piece's own speed** (Level 5 = 100%; never bpm - a piece changes speed from bar to bar), with how long the
     whole piece takes at that speed (`FlowJourney.pieceRunSeconds`). It plays once (no loop); at the end, painting.
     "I know how it goes" skips it;
   - **paint the bars** (`#levelsPaintView`): the bars in the piece's sections (`FlowJourney.pieceSections`), a
     paint box pinned to the bottom - **Brush**, **Fill section** (its empty bars), **Fill all** (the power fill;
     then Brush comes back on), **Rubber**, **Undo**, and a Level pot. After a run-through the pot starts at the
     Level it was played at: Fill all, then brush the bars that went wrong lower. **Type bars instead** keeps the
     from-to entry;
   - **cut it into focus bits** (`#levelsCutView`): a bit is a run of bars at the same Level in a section
     (`FlowJourney.bitsFromBars`). **A focus bit must fit 5 goes in a block** (4:30, a gap bar between goes - was 3,
     ideally 4); one that doesn't is red, with **Split it for me** (`suggestSplit`). **The knife:** tap the bar where
     a new bit should start (tap again to join it up); Type bars instead for from-to. The summary shows the focus
     bits (below Level 4) and about how many blocks to get them all to 4.
   Saving replaces the piece's chunks with the bits (an old chunk with the same bars keeps its id and history).
2. **Practise** - five-minute blocks on the focus bits until **every bar is at Level 4**.
3. **Play-through** - once every bar is at 4 the server makes the piece's **play-through parts** (its join-up groups,
   `piece_chunks` kind `group`): the whole piece when it plays once in a block at Level 4, otherwise the fewest equal
   parts that do - **two halves** for most pieces (`FlowJourney.playthroughParts`). On the path you can choose
   **one long go** instead (a 10-minute block) when the piece fits one. Each part goes from 4 to 5; **a part that
   reaches 5 takes every bar inside it to 5** (the whole piece moves up together). Painting a bar back down puts
   its part back to 4 (or no Level while a bar inside is below 4).

## Levels (ML-315/316/317)

See "Practice Levels" in [flow-journey.md](flow-journey.md): speeds as a % of the piece's tempo, session
sub-beats, the 4:30 chunk length rule, the heat map, and the practice mode.

## Practice lists and the forecast (ML-319, reworked by ML-332/333/334)

- **A list** is the pieces you're working towards, with an optional **target date** (a concert, an
  exam, a lesson - ML-332: a button opening a pop-up, "No target date" or "Pick a date"; ML-348: the
  button is one fixed quarter-width cell of the 4-across grid, showing dd mmm yy). Each piece row
  has a ⋮ menu (ML-349): **Prepare this piece** (**Its path and Levels** once it has them - ML-390), then **Delete**,
  which asks first and offers Undo. **Add pieces** (ML-351) is the same pick list as Add skills,
  offering only pieces not on the list yet, filtered like My music (All / Mine / each band / Public,
  plus search); Select all / Unselect all act on what the filter shows. It's
  personal, or a band's: any member of the band can create and change a band's list. There's nothing
  else to type in (ML-333 took out sessions a week and minutes each; the columns stay, unused).
- **The forecast** (`PracticePlan.forecast`) counts five-minute blocks, assuming one block moves one
  chunk up one Level:
  - **A piece not set up yet** is fine on a list: it counts one block, **preparation for practice**
    (ML-334 - giving it its Levels). Its row says so and "Prepare it now" opens its path. After
    that its Levels decide.
  - **Nothing else is guessed:** chunks with no Level are named as "not counted".
  - **ML-390:** chunks only need Level 4, then the piece is played through: one block for each
    play-through part (join-up group) still below 5, or one play-through block while it has no parts yet.
  - **With a target date** it shows the pace: blocks a day (rounded up) and the minutes that is. No
    on-track / behind verdict - there's nothing to compare against.
  - **"Plan a session for this"** opens the three steps on the list's pieces with the Concert plan (ML-390).
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
