# Theory practice (ML-260)

A home-screen tool for practising music theory without an instrument: short quizzes, against the
clock or a set number of questions, with a 1-5 grade and personal bests. Read this before touching the
quizzes, their scoring, the notation renderer or the Bravura font.

Related tickets:
- **ML-260:** the story, with the agreed plan and the confirmed decisions in its comments.
- **ML-261:** design.
- **ML-262:** the notation font and renderer.
- **ML-263:** the quiz engine.
- **ML-264:** the screens.
- **ML-265:** saving results.
- **ML-266:** back-tests and docs.

## Files

| File | What |
|---|---|
| `public/notation.js` | **Notation**: the app's one notation renderer (SVG, Bravura glyphs). Pure, no DOM. |
| `public/fonts/bravura.woff2` + `Bravura-LICENSE.txt` | Bravura 1.x (Steinberg, SMuFL, SIL OFL 1.1), from npm `@vexflow-fonts/bravura@1.0.2`. Self-hosted, in the service-worker app shell. |
| `public/theoryEngine.js` | **TheoryEngine**: quizzes, options, question generation, scoring. Pure, no DOM. |
| `public/app.js`, THEORY PRACTICE section | The four screens: the round's clock, taps, feedback, saving, history. |
| `server/services/theoryPractice.js` | Saves rounds (re-scoring them with the same engine), history, bests. |
| `db/migrations/052_theory_quiz.sql` | `theory_quiz_attempts`, `theory_quiz_answers`, the `theory_practice` feature flag. |
| `server/test/notation.test.js`, `server/test/theoryEngine.test.js` | Unit tests. |
| `specs/components/notation.md`, `specs/components/theory-quiz.md` | Design specs. Admin → Design shows both, and the Notation entry is a live reference sheet. |

Both browser files load before `app.js` (notation first). Node and the server load them with `vm`,
because this package is ESM and they're browser scripts. That's the same approach as `flowJourney.js`.

## Notation

**Rule: all notation is drawn by `Notation` in Bravura.** Never hand-drawn paths, and never Unicode music
characters, which depend on the phone's fonts. Only the things every notation program draws as lines are
lines: staff and ledger lines, time-bar and intro brackets, and hairpins. They're drawn at Bravura's
engraving thicknesses. Plain ♯/♭ in a button label ("C♯", "B♭ major") is text, not notation.

- **Units:** 10 SVG units per staff space, glyphs at 1 em = 4 staff spaces (SMuFL). Colour is
  `currentColor`.
- **Glyph metrics:** advance, top and bottom, measured from the font in a browser. They're in `GLYPHS`.
  To add a glyph, measure it the same way: `canvas.measureText` at 40px, divided by 10.
- **Pitches:** `'C4'`, `'F#5'`, `'Bb3'`, `'Fx4'`, `'En5'` (scientific pitch, so middle C is C4).
- **Staff steps:** 0 is the bottom line and 8 the top line. `staffStep(pitch, clef)`,
  `pitchAtStep`, `ledgerSteps`, and `keySignatureSteps` (the standard order and positions).
- **Clefs:** treble and bass. Alto and tenor go in `CLEFS` when they're needed.
- **Drawing:**
  - `staff({ clef, keySignature, items, spans, stepRange, hideClef, noteGap, minWidth, label })`
    - items: `note`, `barline`, `mark` (breath mark, caesura), `text` (Fine), `space`.
    - spans: `volta`, `intro`, `hairpin`.
  - `symbol(glyph)`, `hairpin(dir)`, `textMark(text)`.
- **Engraving:**
  - Articulations are centred on the notehead, in the nearest space outside it.
  - A fermata sits above the staff.
  - A caesura sits on the top line.
- **Labels:** a `label` makes the SVG `role="img"`. Without one it's `aria-hidden`.

## The quizzes

All answers are **one tap on a button**.

| Quiz | Shown | Answers | Options |
|---|---|---|---|
| Note names | A whole note on a staff | 7 letters, or 12 notes spelled one way (sharps **or** flats) | Clef (multi-select), range (on the staff / 2 / 4 / 6 ledger lines, above and below), sharps and flats (none / sharps / flats) |
| Key signatures | A key signature; the question says "Which major key?" or "Which minor key?" | 4 keys, same mode | Clef, up to 1/3/5/7 ♯/♭ (C major/A minor always in), sharp/flat keys/both, major or major + minor |
| Symbol names | A symbol, alone or on a scrap of staff with no clef | 4 names | Set: Basics / Dynamics / Structure / Everything |
| Symbol meanings | A meaning | 4 drawn symbols | Same sets |
| Scales by their notes | One octave ascending, with accidentals, no key signature | 4 keys (the relative major/minor is always one when minor is on) | Same as key signatures, plus minor form: harmonic / melodic (ascending) / both |

**Ranges**, lowest to highest note:

| Range | Treble | Bass |
|---|---|---|
| On the staff | D4-G5 | F2-B3 |
| 2 ledger lines | A3-C6 | C2-E4 |
| 4 ledger lines | D3-G6 | F1-B4 |
| 6 ledger lines | G2-D7 | B0-F5 |

The staff stays the same height for the whole round.

**Other rules:**
- **Wrong answers** are plausible: the nearest keys round the circle of fifths, and symbols from the
  chosen set first.
- **Minor scales** are shown harmonic or melodic, because a natural minor scale has exactly its relative
  major's notes.
- **Scale placement:** a scale starts at staff step -2 to 4, so it sits on the staff.
- **Naming:** letters, or solfège if that's the tuner's note-name setting. Solfège uses Do Re Mi Fa Sol
  La Ti, spelled with the sharp or flat (Do♯, Ti♭). That differs from the tuner's chromatic Di/Te,
  because here the spelling matters.
- **No repeats:** the same question never comes twice in a row.
- **Seeded:** questions use a seeded random order (`questionSource(quiz, options, { seed })`).
- **Options** are remembered per quiz on the device (`localStorage` `tml.theory.<quiz>`).

## Rounds and scoring (confirmed on ML-260)

**Round types:**

| Round | How it runs |
|---|---|
| **Timed, 30 s or 60 s** (default 60) | The clock stops while the app is in the background. |
| **Fixed, 10 or 20 questions** | No time limit: the clock counts up. This is also the no-pressure option WCAG 2.2.1 needs. |

**Answering:**
- **Right answer:** +1. It shows as right, then the next question comes up after 150 ms.
- **Wrong answer:** −1. The tapped button turns red with a cross and the right one green with a tick.
  "Not quite: it's X" shows for 1.5 s. That costs time, so guessing doesn't pay.
- **Taps in the first 0.3 s** of a question are ignored, so a double tap can't answer two questions.

**Scores:**
- **Timed:** score = 100 × (right − wrong) ÷ (top pace × minutes), kept between 0 and 100.
- **Fixed:** score = 100 × (right − wrong) ÷ questions. Time is recorded, but doesn't count.

**Top pace**, in right answers per minute, is the perfect-score limit:

| Quiz | Top pace (per minute) |
|---|---|
| Note names | 40 |
| Symbol names | 30 |
| Key signatures | 24 |
| Symbol meanings | 24 |
| Scales | 15 |

**Grade:**

| Score | Grade |
|---|---|
| 90 or more | 5 |
| 70-89 | 4 |
| 50-69 | 3 |
| 30-49 | 2 |
| Below 30 | 1 |

The limits live in `TheoryEngine` (`QUIZZES[].topPace`, `GRADE_LIMITS`, `TIMING`).

## Saving and history

- **Only finished rounds are saved.** Leaving part-way asks first.
- **Saving:** `POST /api/theory/attempts` with the quiz, round type, options, naming, right, wrong,
  duration, start time and every answer.
  - The server re-scores the round with the engine and stores it.
  - It returns: `isFirst`, `isNewBest`, `previousBest`, `best`, and `recent` (the last 8 rounds, oldest
    first).
- **History:** `GET /api/theory/attempts?settingsKey=` returns the recent rounds and the best.
- **Quiz list:** `GET /api/theory/summary` returns the last round per quiz.
- **The settings key** groups comparable rounds: quiz, round type, and every visible option. Hidden
  options, like minor form when minor is off, don't count, and neither does letters/solfège.
- **Best** is the highest score. A tie goes to the quicker round, then the earlier one.
- **All endpoints** are behind the `theory_practice` feature flag. So are the home tile and the ☰ menu
  entry.
- **Practice time:** theory counts as practice time, but isn't linked to practice sessions yet.
  `session_segment_id` is there, nullable, for when it is.

## Testing

**Unit tests** (`node --test "server/test/**/*.test.js"`):
- **Notation:** pitch to staff position, ledger lines for every range, and key-signature order.
- **Engine:** every quiz with every option combination (the answer buttons, right answer included,
  no repeats), every scale's step pattern in both clefs, key tables, and scoring.

**Test hook (local only):** with `localStorage['tml.testClock'] = '1'` on localhost,
`window.__theoryTest` offers:

| Call | Does |
|---|---|
| `start(quiz, options, round, seed)` | Starts a round with a fixed seed. |
| `question()` | The current question. |
| `state()` | Right, wrong, answered, and whether it's waiting. |
| `advance(ms)` | Moves the round's clock on. |
| `result()` | The finished round's result. |

**Back-test:** case #18 in the Neon `test_cases` table. It covers each quiz type on screen, right and
wrong feedback, both round types, saving, and screenshot baselines.
