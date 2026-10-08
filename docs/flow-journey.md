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
the next bar's first beat. "Bar X of Y", the highlighted bar and the bpm update from each click's own
position, never early.

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
  100%. Level 1 = 40 ÷ the **slowest** conducted-beat tempo in the chunk (ramps included), rounded
  **up** to 5%, so no bar drops below 40 bpm. Levels 2-4 are equal steps between, rounded to 5%.
  120 bpm → 35 / 50 / 70 / 85 / 100. At or below 40 bpm every Level is 100%.
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
  cutting go section by section), `bitsFromBars` (painted bars -> focus bits: a run of one Level in a section,
  split at every knife cut), `playthroughParts` (once every bar is at Level 4: the whole piece if it plays once in
  a block at 4, else the fewest equal parts that do - two halves for most) and `partBlockMinutes` (5, 10 for
  "one long go", or null). Focus bits go up to Level 4 (`LEVELS.TARGET`), then the play-through takes them to 5.
- **The heat map** (`barLevels`): each bar's Level from the chunks; where they overlap (a hard passage
  on top of the whole piece) the narrowest wins; null = not set.

Tests: `server/test/practiceLevels.test.js`.

**Practising at a Level (ML-317).** The play screen has a practice mode (`flowSession` in app.js),
started from a piece's path ("Practise the weakest bars", "Play it through") and from session blocks. ML-390
adds `mode: 'runthrough'` - Prepare's run-through: the whole piece once at the chosen Level, no loop and no
Level up; at the end (or Done) it goes on to painting the bars.

- **The loop:** it repeats the chunk with Repeat bars (`restBars: 1`, the gap bar the chunk length rule
  assumes). This is set in memory only, so the piece's own saved repeat setting isn't touched.
- **Speed and sub-beats:** the speed is the Level's %, and `flowSubBeatsMode = 'session'` asks
  `sessionSubBeats` for every bar.
- **The tiles:** repeat, sub beats and speed are swapped for **Level** (a live status), **Level up** (the
  same bars at the next Level straight away, saved as `during`) and **Finish**.
- **Finish:** "Did you nail it?" (ML-390) - Yes (up one, a short star celebration) / Not yet (stay) in one tap;
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
| `pieceRunSeconds(blocks, percent)`, `pieceSections(blocks)`, `bitsFromBars(levels, sectionStarts, cuts)` | ML-390: the run-through's time; the sections to paint in; painted bars -> focus bits. |
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

**Screenshot baselines** live in `tests/visual-baselines/` (committed). When a change to the look is
intended, re-run with `--update-snapshots`, **check each new image by eye**, and commit it.
