# Drills: Tempo, Pulse, Pitch (ML-298, ML-295, ML-296)

**Names:** on screen the tools are **Tempo**, **Pulse** and **Pitch**. **ML-406:** with Rhythm they open from one
**Skills** tile (All tools › Learn: Theory, Skills, Range) that lists them as Theory lists its quizzes; their set-up
screens are value boxes opening the choice pop-up, and a round's result is a **Level 1-5** shown exactly as Theory's
(steps, Level bars, What I've played) - the stored `grade`, never called a grade or shown with its score. Screens:
`specs/components/drills.md`.
In the code, ids, features and saved rounds they keep their first names: Tap tempo (`tapTempo`, `tap_tempo`),
Gap trainer (`gapTrainer`, `gap_trainer`) and Ear (`ear`, `ear_training`). This doc uses the first names.

Three home-screen tools for the things a band player practises without the music: holding a speed,
keeping the beat when nobody's giving it to you, and hearing which note is which. They share one
engine, one results table and one results screen, and grade like Theory (1-5, the same limits), so a
practice session can be built from them later.

| Piece | What it does |
|---|---|
| [`public/drills.js`](../public/drills.js) | The engine: each tool's levels, how a round is made, and the scoring. Pure - no DOM, audio or storage. Loaded by the app (after `theoryEngine.js`), by the server to re-score a saved round, and by `server/test/drills.test.js`. |
| `app.js` "DRILLS" | The screens, the pad, the Gap trainer's metronome, Ear's synthesised notes and mic. |
| [`db/migrations/057_drills.sql`](../db/migrations/057_drills.sql) | `drill_attempts` (one row per finished round, with its raw details) and the features `tap_tempo`, `gap_trainer`, `ear_training`. |
| [`server/services/drills.js`](../server/services/drills.js) | Saves a round (re-scored from its details with the same engine, so a stored score always follows these rules), history and bests. `GET /api/drills/:tool/summary`, `GET/POST /api/drills/:tool/attempts`. |
| [`specs/components/drills.md`](../specs/components/drills.md) | The design spec (Admin → Design shows it). |
| Back-test case 23 | All three, through the screens. |

## Tap tempo (ML-298)

You're given a speed and tap it on the pad: 9 taps (8 gaps), 5 speeds a round.

| Help (on screen; stored as the level id) | You see | Help |
|---|---|---|
| **Listen first** | ♩ = 116 (a Bravura metronome mark) | One bar of clicks at the speed, then silence. A meter shows faster / slower. |
| **With a guide** | ♩ = 116 | No clicks. The meter shows faster / slower as you tap. |
| **On your own** | ♩ = 116 | Nothing until you've finished that speed. |
| **Speed names** | *Andante* | Anywhere inside its range is spot on (ML-297's bands: Andante 76-107...). |

- Speeds: five different ones between 50 and 180 bpm (even numbers, at least 8 apart). Speed names:
  five different bands, each shown by one of its names (Grave or Largo...).
- **Measuring:** 60000 ÷ the *median* gap, so one fumbled tap doesn't wreck it. Steadiness is how much
  the gaps vary (standard deviation ÷ mean).
- **Score per speed:** 80% accuracy + 20% steadiness. Accuracy = 100 − 5 × the % you were off (2% off =
  90, 5% = 75, 10% = 50, 20% or more = 0). For a speed name, the % off is measured from the nearest edge
  of the range. Steadiness = 100 − 5 × the variation in % (4% = 80). Fewer than 9 taps scores 0.
- **Round score:** the average of the five. The meter says "on it" within 3% (`TAP.LIVE_ON`) and hits
  the end stop at 15% off.

## Gap trainer (ML-295)

4/4, one count-in bar (always heard), then 8 bars. **Tap every beat, heard or not**; the silent ones count most.

| Drill | What sounds |
|---|---|
| **3 on, 1 off** / **2 on, 2 off** / **1 on, 3 off** | Whole bars of clicks, then whole bars of silence (bars 3 and 7 silent / 2-3 and 6-7 / all but 0 and 4). |
| **Beats 1 and 3** | Only beats 1 and 3 click; you fill in 2 and 4. |
| **Offbeats** | It clicks only on the "and"s; you tap the beats in between (every beat is silent). The count-in is on the beat. |
| **Random 25% / 50%** | That share of bars go silent at random. Bar 1 always clicks, at least one bar is silent, and the round's seed decides which (so the server re-creates the same round). |

Speeds 60, 80, 100 or 120 bpm. The drill and speed are remembered on the device.

- **Timing:** the metronome player's click filter (`setClickFilter`) silences the chosen clicks, so the
  beat is still counted and timed on the audio clock. A tap is timed on the same clock (`audioNow()`),
  less the output delay set in Settings (you tap to what you hear, which arrives that much late).
- **Score per beat:** each beat takes the nearest unused tap within half a beat. 100 − 400 × (how far
  off ÷ the beat): 2.5% of a beat = 90, 10% = 60, 25% = 0. No tap = 0.
- **Round score:** 75% the silent beats, 25% the heard ones (or all of it, when every beat is silent).
- **Also shown:** the average early/late drift through the silent beats ("32 ms early"), how you landed
  on the first beat after each gap ("Back in after gap 1: on the beat" - within 5% of a beat), and
  beats missed.

## Ear (ML-296)

A note plays and you name it. 10 notes a round. Notes are **synthesised in the app** (two slightly
detuned sawtooths through a low-pass filter that opens on the attack - a soft brass-like tone), so there
are no recordings to licence, and they're tuned to the tuner's A4 setting.

- **Written pitch for your instrument.** Notes are named as your part is written, using the tuner's
  transposition: on a B♭ cornet the "home note" is written C, which sounds concert B♭. Transposing
  instruments sound lower than written, by the transposition.
- **By ear, a sharp and its flat are the same answer** (C♯ = D♭), and the octave doesn't matter.

| Mode | How it works | Notes (on screen; stored as the level id) |
|---|---|---|
| **With a home note** | Written C, then the mystery note (in the octave above it). | Home and 5th (C G) · Add the 3rd (C E G) · Add 2nd and 6th (C D E G A) · Major scale · All 12 notes |
| **On its own** | Just the note, over two octaves (C4-B5), so the octave gives nothing away. | No sharps or flats · All 12 notes |
| **Play it back** | The note, then you play or sing it. The tuner's pitch engine listens (only after the phone's own note has finished) and takes the first note held steady for about a fifth of a second. 8 s of nothing (or Skip) counts as nothing heard. | No sharps or flats · All 12 notes |

- Answer buttons: the level's notes (2-5 in two columns), 7 letters, or Theory's 12-note keyboard.
  Names follow the tuner's letters / solfège setting.
- After each answer the note is shown on a treble staff (Bravura), right or wrong.
- **Score:** 10 points a right answer (there's Play again, so no penalty for a wrong one).

## SmartLearn in Pitch and Tempo (ML-399)

SmartLearn is one switch for every tool it works in (the `theory_smart_learn` feature - Theory, Pitch,
Tempo). Its rules are Theory's (docs/theory-practice.md, "SmartLearn"): a weight 0-10 per item, wrong +2,
a quick right −1, a hesitation +1 up to 4. Pulse and Rhythm have nothing for it to deal: the player
picks one drill or rhythm (owner, 2026-10-02: left out).

**Pitch** - the item is a note in a mode and note set (`ear:reference:triad:7`, any octave).
- A wrong answer is a wrong answer. A right one is **hesitated** when it took well longer than your own
  usual speed in the round (Theory's rule, timed from the end of the note), or you used **Play again**
  first. Play it back has no answer time - only Play again marks it.
- Notes with a weight come up more (`earQuestions(..., weights)`: 1 + weight × 0.5 times as likely), and
  a note you get wrong comes back three notes later in the same round (`earRetry`).
- Each answer keeps `ms` and `replays` in the round's details. They never change the score.

**Tempo** - the item is a speed band at a level (`tap:solo:andante`). There's no right or wrong and no
answer time, so a speed's points stand in (`TAP_SMART`): under 70 is "to work on" (as a wrong answer),
70-89 is "close" (as a hesitation), 90 or more is known. Later rounds take more of their speeds from
your weaker bands (`tapTargets(..., weights)`).

**Where:** the weights sit with Theory's in `theory_question_weights`. `GET /api/drills/:tool/weights?level=`
loads them at the start of a round (3 s timeout, else the plain round); saving a round moves them
(`server/services/drills.js` → `applySmartLearn`) and returns `smartLearn: { learning, missed, slower }`.
The setup screens have Theory's SmartLearn strip, and the results screen its box above Again ("SmartLearn
will bring back 2 notes you took a little longer over" / "...2 speeds: 1 to get right, 1 you were close
on"). With no weights a round is exactly what it was, so a seed still gives the same round.

## Saving

`drill_attempts`: tool, level (Tap tempo's level id, the Gap trainer's drill id, or Ear's
`mode:level`), score, grade, the raw details (taps, or notes and answers), duration and start time. A
round is saved when it finishes. Leaving a play screen part way through stops it (sound and mic) and
isn't saved. Bests and history are per tool and level.

## Testing

`server/test/drills.test.js` (engine). Back-test case 23 drives the screens with
`window.__drillTest` (localhost only): it starts rounds with a fixed seed and feeds taps in directly,
since real taps can't be timed from a script. A fixed-seed round is the plain one - no SmartLearn weights
or retries - unless the test sets `__drillTest.smart = true`.
