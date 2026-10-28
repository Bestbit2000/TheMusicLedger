# Flow journey: how a Flow plays (ML-193)

Everything that decides **what Play Flow plays, in what order, at what tempo, and where on the screen
you are** lives in one place: [`public/flowJourney.js`](../public/flowJourney.js). It's pure logic with no
DOM or audio. It's loaded in the browser before `app.js` (`window.FlowJourney`) and in Node by the unit
tests, so the tested code is the code that runs. Read this before touching Play Flow playback, the
metronome player's sequence mode, the bar settings, or the consistency check. Anything that needs to know
"where in the music am I" should build on it: practice loops, repeating bars, scoring.

Related tickets:
- **ML-193:** engine and back-tests.
- **ML-248:** consistency check.
- **Playback features:** ML-249 alternate endings, ML-250 jumps/Fine/stop at end, ML-251 ramps,
  ML-252 intro, ML-253 caesura, ML-302 repeat bars.
- **Lead-in:** ML-113 (always one bar). It belongs to the piece - the notes before bar 1. **It is not the count-in:**
  the clicking bars that give a player time to get from the play button to the instrument are the player's own
  setting (see `countInBars` / `countInSteps` under Repeat bars) and play before the lead-in.
- **Bugs:** ML-254 glyph/label one beat early, ML-255 compound-metre beats, ML-256 fermata one pulse
  too long.

## The rules

Blocks are the regular bars-blocks in written order. The lead-in is separate.

**Order**
1. **Lead-in** first: always one whole bar (ML-113), in bar 1's time signature and tempo.
2. **Intro**, if a block has "Start intro": from that bar straight through to the "End intro early" bar,
   or to the first final barline or the end of the piece. It plays once, with no repeats or jumps, and
   only the final alternate ending. Then the piece starts from bar 1.
3. **Repeats.** An end repeat goes back to the nearest start repeat at or before it (a block can repeat
   itself). It never looks past an earlier repeat's own end, unless that end is in the same run of
   alternate endings. With no start repeat, it goes back to that region's start (the start of the piece
   for the first one). It plays `repeatPlayCount` times in total (default 2). The **pass** (1st, 2nd…
   time) counts up on each jump back. It resets to 1 at a new start repeat, and once a region's endings
   are behind us.
4. **Alternate endings.** A block with ending numbers plays only on those passes. "From bar N" means the
   bars before N play on every pass. An ending that's skipped also skips its own end-of-block
   instructions (repeat end, jumps, final barline).

**End of a block**, in order:
1. The repeat end (not after a jump).
2. To Coda: only after a D.S./D.C. **al Coda** jump. It goes to the coda sign.
3. D.S./D.C.: each jump happens once. D.S. goes to the segno, D.C. to bar 1. After a jump, repeats
   aren't taken again and only the final ending of each run plays. With no segno, D.S. is ignored and
   the checker flags it.
4. Fine: ends the piece, but only after a jump (al Fine).
5. Final barline: ends the piece.

**The end.** Running out of blocks, a Fine or a final barline **stops playback and resets to the start**.
The piece itself never loops (decided 2026-09-24); practising a passage over and over is the repeat
bars control below.

**Tempo.** Each block plays at its bpm, in its beat unit. A ramp goes linearly from the tempo in force
where it starts to its target: the next block's bpm or a custom one. It lands at the end of the block,
or at a chosen bar and beat, then holds. A block can have several ramps, and each starts from where the
last one left it. The metronome takes the tempo **per click**, so each beat's own length follows the
ramp. Play speed % scales every click and doesn't change the written tempo shown.

**Positions.** Fermata, caesura and ramp beats are **written** beats: "beat 4 of 6" in 6/8. They're
mapped to the metronome's clicks by `writtenBeatToClick`. That's exact with sub-beats on. With them off,
a beat lands on the conducted beat that contains it. A fermata held N beats is exactly N pulses on its
beat. After the hold, playback carries on from the next conducted beat. A caesura's beat plays, then its
length in beats of silence, then the next beat.

**Pauses between beats (ML-365).** A pause's position can fall between written beats, in quarter-beat
steps (`beat_offset` NUMERIC, migration 081). The pause picker steps in the bar's **pause steps**
(`pauseStepsPerBeat`): whole written beats, or the beat note when it's shorter - 2/2 counted in crotchets
has 2 per beat, so its positions are 1, 1.5, 2, 2.5, shown as "Beat 1-4 of 4"; 2/2 in quavers has 4. A
caesura "after beat" is after one pause step (after that crotchet, not the whole minim). With sub-beats on
the pause lands exactly; with them off, on the conducted beat that contains it (as above). Whole-beat bars
are unchanged.

**Screen.** A glyph above the dots (fermata or caesura) shows for the whole bar it's in and clears at
the next bar's first beat. The top line ("[C] · Bars 33 to 40 · **Bar 36**": the block it is in - its rehearsal
mark, boxed, and its bars, both (owner, 28 Oct 2026); no bars for a one-bar block - then the piece's own bar number,
last and in bold; no time signature or speed, ML-626) and the highlighted bar update from each click's own
position, never early.

## Movements (ML-529)

A piece can be in **movements** - a suite whose bar numbers carry on from one movement to the next, while its
rehearsal letters start again at A in each. A movement starts at a block: `movementStart` (the first block always
starts the first movement) and `movementTitle` (columns `movement_start`, `movement_title`, migration 131). A piece
with no movement starts is one movement, and every rule above is unchanged for it.

Each movement is a piece of its own for the order of play, and the next one follows **straight on** (owner, 19 Oct
2026 - no gap):

- **Repeats and endings** never reach back into the movement before: a repeat with no start goes back to the start of
  its movement, and a set of endings never runs across a movement start.
- **D.C.** goes to the movement's first bar, **D.S.** to the segno in its own movement, **To Coda** to the coda in
  its own movement. A D.S. whose only segno is in another movement is ignored, and the checker says so.
- **Fine** (after a jump) and a **final barline** end the movement; the next movement plays. Only the end of the last
  movement ends the piece.
- **A new movement starts everything over:** pass 1, and no jump taken - so the next movement's repeats play again
  after a D.S. in the one before.
- **The intro** stops at the end of the movement it starts in.
- **The checker** counts segnos, codas, D.S./D.C. and Fines per movement, and says "in movement 2" in its message.
- **`pieceSections`** starts a section at every movement, and its every-8-bars fallback counts from each movement's
  first bar - so painting and cutting never cross from one movement into the next.

`movements(blocks)` lists them (`{ number, title, startBlock, endBlock, startBar, endBar }`), `movementOfBar` finds
the one a bar is in and `movementLabel` gives "Mvt 2" or "Mvt 2: Harvest". Rehearse puts a heading over each
movement's first tile and starts the now-playing line with the movement ("Mvt 2 · Bar 93 · A") when a piece has more
than one. **The edit screen** shows the same headings in its bar list (all three layouts) and lets a bar move
only within its own movement (owner, 19 Oct 2026): the ⋮ menu's Move up / down and the bar pop-up's Move earlier /
later are not offered across a movement start, and a drag in the grid only goes to its own movement's places. Where
a movement starts belongs to the place, not the bar: when a movement's first bar is moved or deleted, the bar now
first in it starts it and takes its name (`flowRestoreMovementPlaces`), and a duplicated bar never starts a movement.
Tests: the "movements (ML-529)" group in `server/test/flowJourney.test.js`, and back-test #79. Playing or practising one
movement on its own is ML-530 (below); a recording of one movement is ML-531 (`docs/rehearsal-score.md`, "A recording
of one movement").

## One movement (ML-530)

**Rehearse** can play one movement of a piece in movements: the **Movement** box by the layout switch opens "Which
movement?" - the whole piece, or each movement with its bars. Remembered per piece on the device
(`localStorage['tml.rehearseMovement']`), like the repeat. `movementJourney(blocks, opts, number)` is the journey's steps
inside that movement (the lead-in only with the first) - movements never jump into each other, so that is exactly the
movement played on its own; the queue ends at its last bar and resets to its first. Only its tiles show; a tap on a
bar outside it says to choose the whole piece. **Repeat bars** stay inside it: `loopPlan` takes `movement` and answers
`outsideMovement` for a bar outside it, and the sheet's steppers, sliders and typed bars run over its bars only. Never
in a practice or a run-through (`flowSession`): those have their own bars, and the box is hidden.

**Practice** in a piece in movements:
- **Names:** a practice bit is named "Mvt 2 · A" (or "Mvt 2 · Bars 21-25") wherever it is shown - the piece's path,
  the rating question, a session's blocks and the block chooser. The movement is added when shown
  (`movementPrefix`; `levelsChunkName` in app.js), never saved in the label, so it can't go stale when movements are
  edited. `/api/practice/pieces` sends each bit's `mvt` and the piece's `movements`.
- **Prepare** puts the movement heading over the sections in the paint and cut screens, and **the heat map** has a
  heading per movement with its rows of ten starting again at the movement's first bar.
- **The play-through** never runs past a movement's end: `playthroughParts` cuts each movement on its own, the "whole"
  option is "Each movement whole" (or "in one go", up to 10 minutes each), and the parts are named within their
  movement (`playthroughLabels`: "Play-through, first half", shown as "Mvt 2 · Play-through, first half").

A practice list can hold just one movement of a piece, and a piece's path can be for one movement (its Movement box):
the run-through, painting, cutting, focus sections and play-through are then that movement's - `docs/practice-sessions.md`,
"One movement on a list".

## Repeat bars (ML-302)

Rehearse's **repeat** control plays a start..end bar range over and over. It's a playback setting, not
part of the piece: remembered per piece on the device (`localStorage['tml.rehearseRepeat']`, keyed by
piece id, on or off), never saved to the database. `loopPlan(blocks, { startBar, endBar, restBars, leadIn })`
works it out:

- **Bar numbers** are the piece's own (1-based, lead-in excluded) - what the tiles show.
- **It follows the piece's order.** The loop is the journey from the first time the start bar plays
  (in the piece proper, never the intro) to the next time the end bar plays. So repeats, endings,
  jumps, ramps and pauses inside it behave as in the piece, and each bar keeps its pass ("2nd time").
- **The end bar can be before the start bar** when a repeat or jump goes back there: 7 → 2 with a
  repeat at bar 8 plays 7 8 1 2. No way back → `endNotReached`; a start bar the piece never plays →
  `startNeverPlays`; a bar outside the piece → `range`.
- **Rest bars** (0-5) are clicking bars (the quieter lead-in click, no sub-beats, no pauses) in the
  start bar's time signature at the tempo in force there; play speed % still applies. They count in
  before the first pass and sit between every pass after it.
- **The lead-in** plays on the first pass only, and only when the loop starts where the piece does.
- **`countInBars`** (optional): how many clicking bars come before the *first* pass when that differs from the
  rest between passes. A practice block passes the player's own count-in (0-4 bars) and keeps one gap bar
  between goes. Left out, the count-in is the rest bars, as Rehearse's repeat has always done.
- **`countInSteps(steps, n)`**: the same clicking bars for playing a piece through *once* (the Prepare
  run-through, which has no loop) - `n` rest steps on bar 1, to put before `buildJourney`'s steps.

It returns `countIn` (first pass: rest bars, lead-in if any, the loop), `between` (every pass after:
rest bars, the loop) and `runs` (the loop as bar-number stretches, for "Plays 7–8, then 1–2"). Rest
bars are steps of `kind: 'rest'` on the start bar's block. Play Flow queues `countIn` and, each time
the scheduler reaches the end of the queue, appends another `between` - so it never stops. Passages
carry `loopPass` ("Repeat 3") and `restIndex`. Tapping a tile jumps within the current pass; a bar
outside the loop gets a "turn repeat off to play from there" note.

## Practice Levels (ML-315, epic ML-314)

A piece gets a **Level 1-5** per chunk of bars (`piece_chunks`, see `docs/database-schema.md`). In a
practice session the Level sets the speed and sub-beats for you. The rules, all in `flowJourney.js`:

- **Speed is a % of the piece's own tempo**, so ramps and tempo changes keep their shape. Level 5 =
  100%. Level 1 = **50%** (`LEVELS.MIN_PERCENT`, ML-535 - it went as low as 35%), or higher when
  that would take a bar below 40 bpm: 40 ÷ the **slowest** conducted-beat tempo in the chunk (ramps
  included), rounded **up** to 5%. Levels 2-4 are equal steps between, rounded to 5%. 80 bpm and
  faster → 50 / 65 / 75 / 90 / 100; 60 bpm → 70 / 80 / 85 / 95 / 100. At or below 40 bpm every Level is
  100%. **The % is never shown to a player** (ML-535): it differs from one focus section to the next, so a
  Level is its number and its word (`LEVEL_WORDS` in app.js - Very slow, Slow, Steady, Nearly there,
  Full speed).
- **Session sub-beats** (`sessionSubBeats`): on for a bar when its beat at that Level is below the
  account's `practice_sub_beats_below` (default 100). Practice sessions only - Rehearse, Quick Play and
  the metronome keep the player's own sub-beat setting.
- **Chunk length rule** (`chunkFit`): a block is 4:30 of playing (`LEVELS.BLOCK_SECONDS`). One run of a
  chunk follows the piece's order through `loopPlan` (a repeat inside it plays twice), with fermata
  holds and caesura silences, plus one gap bar between runs. **5+ runs = `good`, fewer = `tooLong`** (ML-390 -
  it was 4+ good, 3 ok). Checked at the chunk's current Level - Level 1 is slowest, so a chunk that fits at Level 1
  fits at every Level. `suggestSplit` gives the fewest equal parts that each fit 5+ runs.
- **Getting a piece ready (ML-390)**: `pieceRunSeconds` (the whole piece once, as played - the Prepare
  run-through's time), `pieceSections` (rehearsal marks and section boundaries, or every 8 bars - painting and
  cutting go section by section), `bitsFromBars` (painted bars -> focus sections: a run of one Level in a section,
  split at every knife cut), `playthroughParts` (once every bar is at Level 4: the whole piece if it plays once in
  a block at 4, else the fewest equal parts that do - two halves for most) and `partBlockMinutes` (5, 10 for
  "one long go", or null). Focus sections go up to Level 4 (`LEVELS.TARGET`), then the play-through takes them to 5.
- **The heat map** (`barLevels`): each bar's Level from the chunks; where they overlap (a hard passage
  on top of the whole piece) the narrowest wins; null = not set.

Tests: `server/test/practiceLevels.test.js`.

**Practising at a Level (ML-317).** The play screen has a practice mode (`flowSession` in app.js),
started from a piece's path ("Practise the weakest bars", "Play it through") and from session blocks. ML-390
adds `mode: 'runthrough'` - Prepare's run-through: the whole piece once, starting at Level 5 (ML-537), no loop and
nothing saved as it plays; at the end (or Done) it goes on to setting the level of each bar.

- **The loop:** it repeats the chunk with Repeat bars (`restBars: 1`, the gap bar the chunk length rule
  assumes). This is set in memory only, so the piece's own saved repeat setting isn't touched.
- **The count-in (ML-587, owner 23 Oct 2026):** **Off**, **First time only** (the count-in before the first go, then
  the one gap bar between goes - as before) or **Every time round** (the whole count-in before every go: `restBars` is
  the count-in, `practiceGapBars`, and every go's count-in counts down big, `flowCountInEveryGo`). How many bars is the
  player's own setting (`practiceCountInBars`, Settings and Prepare's count-in box); when is `tml.practice.countInWhen`
  on the device, and Off is 0 bars. A change mid-go takes effect for the goes still to come.
- **Speed and sub-beats:** the speed is the Level's %, and `flowSubBeatsMode = 'session'` asks
  `sessionSubBeats` for every bar (a run-through starts at `'off'`). ML-588 (owner, 23 Oct 2026 - it was an on/off
  switch, ML-537): **sub beats** is Rehearse's own button and pop-up - **Off / Auto / Fixed** (a number of sub-beats) -
  for the rest of the go; until it's touched, a block follows the Level, and the pop-up opens on Auto or Off to match.
  **Custom speed** (ML-588): under the Levels in Playback's Level row, the app's one list of **play speeds** (the
  `playback_speed_options` meta table, Admin-managed - ML-596), tapped to play straight away. A **% of the
  piece's own speed**, not a bpm (owner, 23 Oct 2026): a piece's speed can change and the bars practised can run from a
  slow bit into a fast one, so every bar keeps its shape. A speed that would take the slowest bar practised under 30
  bpm (`FLOW_CUSTOM_MIN_BPM` - under the Levels' 40 floor, so there's room below Level 1) is left out, and a line says
  where it stops ("It goes down to 50% here..."). It's the one place a % is shown (ML-535 keeps it off the Levels).
  For this go only (`flowSession.custom`): the Level isn't changed, the button shows the % ("70%" over "speed"),
  picking a Level goes back to its speed, and a Level change or rating records the speed played (`percentPlayed`, up to 100).
- **The tiles:** 4, not 5 (ML-587): reset, **Playback**, play and **Finish**. Playback takes the place of repeat,
  sub beats and play speed: one pop-up (`openFlowPlaybackModal`) showing everything at once, no show/hide arrows
  (owner, 23 Oct 2026): the **Level** as a row of the five Level tiles (pick any, faster or slower, straight away - in a
  block it's saved as `during`; ML-537), then three yes/no switches, off by default, each showing its choices under it
  when on - **My own speed** (the % tiles, ML-588; switching it off goes back to the Level), **Sub beats** (Auto or a
  number a beat) and **Count-in** (First time only / Every time round). Its button says Done: every choice takes effect
  at once. The button shows the Level's number (or the Custom %), never a Level's % (ML-535).
- **A recording or video in a practice (ML-587):** its slide gets a **Play** of its own: the count-in clicks at the
  speed of the bar the practice starts on (at the play speed), with the big count-down over the slide, then the
  recording plays from the practised bars (`recPlayInPractice`); with the count-in every time round it stops at the
  end of each go and counts in again. Its repeat shows the practised bars and can't be changed there - as on the
  metronome, a practice's bars are the practice's.
- **Finish:** "How did you get on?" (ML-390, worded by ML-559) - Good (up one, a short star celebration) / Needs a bit more (stay) in one tap;
  "Too fast? Back to Level N" is a link under them, and "Move up even further" opens the jumps to higher Levels. Saved as `rating` with the speed played.
- **Leaving:** leaving the play screen any other way ends the practice unrated. The player's own speed,
  sub-beat setting and repeat come back.

The 5-minute blocks, the sound stopping at 4:30 and the 30-second rest belong to the session runner (ML-320,
ML-390 - docs/practice-sessions.md).

## The engine's API

| Function | What for |
|---|---|
| `buildJourney(blocks, { leadIn })` | Every bar in play order: `{ kind: 'leadIn'\|'intro'\|'main', blockIndex, blockId, bar, pass, via }`. `via` marks the first bar after a jump (`repeat`/`ds`/`dc`/`coda`/`start`). Also returns `end`: `end`/`fine`/`finalBarline`/`loopGuard`. |
| `passagesOf(steps)` | Consecutive bars merged into passages, which the metronome plays in one go. |
| `loopPlan(blocks, { startBar, endBar, restBars, leadIn })` | Repeat bars (ML-302) - see above. |
| `barNumberOf(blocks, i, bar)`, `totalBars(blocks)` | The piece's bar number of a block's bar; bars in the piece. |
| `tempoAt(blocks, i, pos)` | bpm at a written-beat position in block `i`, with ramps applied. |
| `writtenBeatToClick`, `pausesInBar` | Written beats mapped to clicks; a bar's fermatas and caesuras as clicks. |
| `checkFlow(blocks, { leadIn })` | ML-248 issues: `{ code, severity, blockIds, message }`. |
| `repeatBarInvalid`, `introInvalid`, `pauseInvalid`, `rampInvalid` | The "needs updating" checks that turn a tile red. The card tiles use them too. |
| `METER_TABLE`, `meterInfo` | How each metre is conducted. The player uses the same table. |
| `LEVELS`, `levelPercents(slowestBpm)`, `levelPercent(level, slowestBpm)` | Practice Levels: the five speed %s for a chunk (ML-315). |
| `sessionSubBeats(bpm, percent, thresholdBpm)` | Whether a bar gets sub-beats in a practice session. |
| `slowestTempo(blocks, startBar, endBar)`, `barSeconds(blocks, i, bar, percent)` | The chunk's slowest beat tempo; one bar's length at a speed. |
| `chunkFit(blocks, { startBar, endBar, level \| percent })`, `suggestSplit(...)` | Runs of a chunk in a 4:30 block (`good`/`ok`/`tooLong`); a split that fits. |
| `barLevels(totalBars, chunks)` | Each bar's Level for the heat map. |
| `pieceRunSeconds(blocks, percent)`, `pieceSections(blocks)`, `bitsFromBars(levels, sectionStarts, cuts)` | ML-390: the run-through's time; the sections to paint in; painted bars -> focus sections. |
| `playthroughParts(blocks, level)`, `partBlockMinutes(blocks, a, z, level)` | ML-390: the play-through parts; a part's block length (5, 10 or null). |

The same file also holds the **rehearsal score** sums (ML-312, ML-488) - a recording's start and end
(`cleanClip`, `nudgeClip`, `clipLabel`, `clockText`, `clipAction`) and the piece's bars mapped onto a
recording (`journeyPlaces`, `placeLabel`, `usableMarks`, `recordingMap`, `placeAt`, `mapLoop`). They
are described in [`rehearsal-score.md`](rehearsal-score.md) and tested in `recordingClip.test.js` and
`rehearsalScore.test.js`. `mapLoop` follows `loopPlan`'s rule for which bars a repeat is; it ignores rest bars.

## The metronome player's sequence mode

`createMetronomePlayer()` (app.js) has an opt-in **sequence mode**, used by Play Flow only:

- `setSequence(firstPassage, onBoundary)` hands over one passage at a time.
- The **scheduler itself** calls `onBoundary()` the moment a passage's last click has been scheduled.
  So moving on can't be late because of the audio lookahead or the Bluetooth visual delay.
- Every click's beat info carries `tag` (the passage), `clickIndex`, `bpm`, `intervalSeconds` and
  `time`.
- `onBoundary` returning `null` ends the piece with a single `{ ended: true }` beat.
- Quick Play doesn't use sequence mode.

## Testing

**Unit tests** (`node --test "server/test/**/*.test.js"`): `server/test/flowJourney.test.js` covers
every rule above in several variations, every checker rule, tempo maths and beat mapping, repeat bars
(ranges, rest bars, lead-in, end before start, errors), plus the five ML-204 fixture Flows end to end.

**Test clock (local development only).** With `localStorage['tml.testClock'] = '1'` on
`localhost`/`127.0.0.1`, Play Flow's player runs silently on a virtual clock, and `window.__flowTest`
appears. It's never active on sandbox or production.

| Call | Does |
|---|---|
| `play()` | Starts playback. |
| `step(n)` | Plays exactly n clicks and returns what the screen shows after each: position, pass, bpm, time, hold, label, highlighted bars, glyphs, dot count. |
| `runToEnd()` | Plays to the end. |
| `setLoop(settings)` | Repeat bars on (`{ startBar, endBar, restBars }`) or off (`null`), as the sheet does. |
| `state()` | What the screen shows now, without playing anything. |
| `journey()` | The journey for the open Flow. |
| `issues()` | The checker's issues for the open Flow. |
| `blocks()` | What the editor currently holds. |
| `api`, `openPlay(id)`, `openBars(id, mode)` | Test setup. |

**Back-tests** (Playwright, registered in the Neon `test_cases` table; run with
`node --env-file=.env scripts/run-backtest.mjs`). The shared helpers are in
[`tests/helpers/flowPlayback.ts`](../tests/helpers/flowPlayback.ts).

| # | Test case | Covers |
|---|---|---|
| 12 | Journey | Bars heard for every repeat, ending, intro and jump variant and the fixtures; beats per bar; stop at end |
| 13 | Tempo | Ramps beat by beat and each beat's length, play speed %, sub-beats |
| 14 | Pauses | Glyph for the whole bar, hold and silence lengths, 6/8 positions; screenshots |
| 15 | Display | Label, highlighted bar and dots in 1/2/4 columns; tap to jump; screenshots |
| 16 | Editor | Every option of all 12 settings through the real pickers; saved and shown everywhere |
| 17 | Checker | The ML-248 review: messages, outlines, fix / carry on; screenshots |
| 81 | One movement on a list (ML-530) | A list piece as one movement: the row, its path, its run-through and painting, a session from the list |
| 80 | One movement (ML-530) | Rehearse plays one movement, its tiles only, the repeat inside it; practice names "Mvt 2 · ..."; the heat map's headings |
| 79 | Movements (ML-529) | Each movement's own D.S. and repeat, straight on; Rehearse and edit-screen headings; moves kept inside a movement; Quick entry's movements table |

**Screenshot baselines** live in `tests/visual-baselines/` (committed). When a change to the look is
intended, re-run with `--update-snapshots`, **check each new image by eye**, and commit it.
