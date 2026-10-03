# Rhythm: the rhythm tool (ML-306)

A home-screen tool (Learn group) for playing common rhythms: pick one, a bar's count-in, then tap it
on the pad or clap / sing / play it into the microphone. Behind the feature **`rhythm_trainer`**
(migration `066`, off by default). Read this before changing a rhythm, a Level or the scoring.
Owner decisions: 2026-09-27 (the practice session builder chat: words, crib sheet, Takadimi, 6/8)
and 2026-09-28 (this release's chat: taps scored strictly, the microphone leniently, speed Levels).

## The rhythms (`Rhythm.PATTERNS` in `public/rhythm.js`)

| Set | What's in it |
|---|---|
| **Words** | Plum (crotchet), Ap-ple (2 quavers), Pom-e-gran-ate (4 semiquavers), Am-ster-dam (2 quavers + crotchet, two beats). Pineapple (triplet or dotted) is left for later. |
| **One beat** | The Takadimi crib sheet: all 15 one-beat semiquaver rhythms (slots ta ka di mi) - 8 start on the beat, 7 with a rest - in teaching order. |
| **Two beats** | ta - a (minim), ta - - di (dotted crotchet + quaver), ta di - di (quaver crotchet quaver). |
| **Triplets** | A beat in three (ta ki da): ta ki da, ta - da, ta ki -, - ki da. |
| **6/8** | Dotted-crotchet beats (ta ki da; semiquavers ta va ki di da ma): ta, ta ki da, ta - da, ta ki -, ta - di da, ta va ki di da ma. |

Each rhythm has its Takadimi name (or its word), written under the notes. A player can give any
crib-sheet rhythm **their own word** (stored per player; shown on its tile).

## A round

- **One rhythm:** a bar's count-in, then **2 bars** of it (repeated to fill each bar; shown as one bar
  between repeat signs). **Play through the whole set:** one bar of each rhythm in the set, in order.
- The click counts beats: crotchets in 4/4, **dotted crotchets in 6/8**. The note playing is lit gold.
- **Tap:** a tap on the pad for every note start. **Clap, sing or play:** the microphone listens for
  note starts (`Rhythm.onsetDetector`: a jump in loudness, then it waits for a dip before hearing another,
  so a held note is one start).

## Scoring (`Rhythm.scoreRound`)

Each written note is matched to the nearest tap / heard start within half the gap to its neighbours.

| | On time (full marks) | Worth nothing | Extra tap / note |
|---|---|---|---|
| **Tap** | within 40 ms | 150 ms | −4 each |
| **Microphone** (lenient) | within 90 ms, after taking out a steady delay (up to 300 ms - the phone's lag, or playing a touch behind) | 250 ms | −1 each |

A note with nothing near it scores 0. Score = the average, less the extras, 0-100; grade 1-5 as Theory.
Taps and heard starts are timed on the metronome's audio clock, less the output delay set in Settings.

## Speed Levels

Each rhythm has a **Level 1-5**: the fastest Level speed you've played it well at (a round the engine grades 4
or 5 - the grade itself is never shown, ML-406; the screens only say "play it well at this speed").
Levels never go down.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 4/4 (crotchets a minute) | 60 | 72 | 84 | 96 | 108 |
| 6/8 (dotted crotchets a minute) | 40 | 48 | 56 | 64 | 72 |

The speed box's pop-up lists the five Level speeds; picking a rhythm starts on your next Level's speed, and
reaching it moves you on. Playing through a set gives each rhythm its own Level from its own bar.

## Saving

Rounds are **drill rounds**: `drill_attempts`, tool `rhythm`, level = the rhythm id (`w-apple`,
`b-takadimi`...) or `sheet:<set>`; the server re-scores them with `public/rhythm.js`
(`server/services/drills.js`), so they get the drill tools' results screen, history and bests
([drills.md](drills.md)). Levels and words: `rhythm_pattern_levels`, `/api/rhythm`,
`PUT /api/rhythm/:patternId/word`.

## Skills

"Rhythm - words / one beat / two beats / triplets / 6/8" (`rhythm:<set>`) are Skills entries: the steps
are the set's rhythms in order, passed at grade 4 or 5 (like Tempo, Pulse and Pitch).

## Notation

The rhythms are drawn by `Notation.staff`'s `group` item (beams, flags, rests, dots, triplets, words) in
Bravura - see [theory-practice.md](theory-practice.md) "Notation" and `specs/components/notation.md`.
The same beaming is the base for the Theory rhythm questions (ML-309 C2).

## Where it lives

| What | Where |
|---|---|
| Rules | `public/rhythm.js` (`window.Rhythm`) |
| Screens | RHYTHM section of `public/app.js`; `#rhythmView`, `#rhythmPlayView` |
| Server | `server/services/drills.js` (scoring, Levels, words), `/api/rhythm*` and `/api/drills/rhythm/*` |
| Tables | `db/migrations/066_rhythm.sql` |
| Tests | `server/test/rhythm.test.js`, the rhythm-group tests in `server/test/notation.test.js`; back-test "Rhythm" |
