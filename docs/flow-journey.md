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
  ML-252 intro, ML-253 caesura.
- **Bugs:** ML-254 glyph/label one beat early, ML-255 compound-metre beats, ML-256 fermata one pulse
  too long.

## The rules

Blocks are the regular bars-blocks in written order. The lead-in is separate.

**Order**
1. **Lead-in** first: its bars, or one partial bar when it's a pickup.
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
There's no looping (decided 2026-09-24). Looping will come with the practice features. `repeatLeadIn`
only matters once looping exists.

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

**Screen.** A glyph above the dots (fermata or caesura) shows for the whole bar it's in and clears at
the next bar's first beat. "Bar X of Y", the highlighted bar and the bpm update from each click's own
position, never early.

## The engine's API

| Function | What for |
|---|---|
| `buildJourney(blocks, { leadIn })` | Every bar in play order: `{ kind: 'leadIn'\|'intro'\|'main', blockIndex, blockId, bar, pass, via }`. `via` marks the first bar after a jump (`repeat`/`ds`/`dc`/`coda`/`start`). Also returns `end`: `end`/`fine`/`finalBarline`/`loopGuard`. |
| `passagesOf(steps)` | Consecutive bars merged into passages, which the metronome plays in one go. |
| `tempoAt(blocks, i, pos)` | bpm at a written-beat position in block `i`, with ramps applied. |
| `writtenBeatToClick`, `pausesInBar` | Written beats mapped to clicks; a bar's fermatas and caesuras as clicks. |
| `checkFlow(blocks, { leadIn })` | ML-248 issues: `{ code, severity, blockIds, message }`. |
| `repeatBarInvalid`, `introInvalid`, `pauseInvalid`, `rampInvalid` | The "needs updating" checks that turn a tile red. The card tiles use them too. |
| `METER_TABLE`, `meterInfo` | How each metre is conducted. The player uses the same table. |

## The metronome player's sequence mode

`createMetronomePlayer()` (app.js) has an opt-in **sequence mode**, used by Play Flow only:

- `setSequence(firstPassage, onBoundary)` hands over one passage at a time.
- The **scheduler itself** calls `onBoundary()` the moment a passage's last click has been scheduled.
  So moving on can't be late because of the audio lookahead or the Bluetooth visual delay.
- Every click's beat info carries `tag` (the passage), `clickIndex`, `bpm`, `intervalSeconds` and
  `time`.
- `onBoundary` returning `null` ends the piece with a single `{ ended: true }` beat.
- Quick Play and Metronome Blocks don't use sequence mode and are unchanged.

## Testing

**Unit tests** (`node --test "server/test/**/*.test.js"`): `server/test/flowJourney.test.js` covers
every rule above in several variations, every checker rule, tempo maths and beat mapping, plus the five
ML-204 fixture Flows end to end.

**Test clock (local development only).** With `localStorage['tml.testClock'] = '1'` on
`localhost`/`127.0.0.1`, Play Flow's player runs silently on a virtual clock, and `window.__flowTest`
appears. It's never active on sandbox or production.

| Call | Does |
|---|---|
| `play()` | Starts playback. |
| `step(n)` | Plays exactly n clicks and returns what the screen shows after each: position, pass, bpm, time, hold, label, highlighted bars, glyphs, dot count. |
| `runToEnd()` | Plays to the end. |
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
