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
- **ML-269:** Smart learn (weak questions dealt first; gated for the paid tier).

## Files

| File | What |
|---|---|
| `public/notation.js` | **Notation**: the app's one notation renderer (SVG, Bravura glyphs). Pure, no DOM. |
| `public/fonts/bravura.woff2` + `Bravura-LICENSE.txt` | Bravura 1.x (Steinberg, SMuFL, SIL OFL 1.1), from npm `@vexflow-fonts/bravura@1.0.2`. Self-hosted, in the service-worker app shell. |
| `public/theoryEngine.js` | **TheoryEngine**: quizzes, options, question dealing, scoring. Pure, no DOM. |
| `public/app.js`, THEORY PRACTICE section | The four screens: the round's clock, taps, feedback, saving, history. |
| `server/services/theoryPractice.js` | Saves rounds (re-scoring them from their answers with the same engine), history, bests. |
| `db/migrations/052_theory_quiz.sql` | `theory_quiz_attempts`, `theory_quiz_answers`, the `theory_practice` feature flag. |
| `server/test/notation.test.js`, `server/test/theoryEngine.test.js` | Unit tests. |
| `specs/components/notation.md`, `specs/components/theory-quiz.md` | Design specs. Admin → Design shows both, and the Notation entry is a live reference sheet. |

Both browser files load before `app.js` (notation first). Node and the server load them with `vm`,
because this package is ESM and they're browser scripts. That's the same approach as `flowJourney.js`.

## Notation

**Rule: all notation is drawn by `Notation` in Bravura.** Never hand-drawn paths, and never Unicode music
characters, which depend on the phone's fonts. Only the things every notation program draws itself are
lines or curves here: staff and ledger lines, time-bar and intro brackets, hairpins, and ties and slurs
(a filled crescent at Bravura's tie thicknesses). Plain ♯/♭ in a button label ("C♯", "B♭ major") is
text, not notation.

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
    - items: `note` (with `head`, `above`/`below` marks and `dots`), `barline`, `mark` (breath mark,
      caesura, rests), `timeSig`, `text` (Fine), `space`.
    - spans: `volta`, `intro`, `hairpin`, `tie`, `slur`.
  - `symbol(glyph)`, `hairpin(dir)`, `textMark(text, { italic | bold })`.
- **Engraving:**
  - Articulations are centred on the notehead, in the nearest space outside it. Augmentation dots
    sit in a space.
  - A fermata sits above the staff. A caesura sits on the top line.
  - A semibreve rest hangs from the 4th line; every other rest is centred on the middle line.
  - Time-signature digits sit centred on steps 6 and 2; C and ¢ on the middle line.
  - Words: tempo words (Allegro) bold and upright; expression words (rit., legato, Fine) italic.
- **Labels:** a `label` makes the SVG `role="img"`. Without one it's `aria-hidden`.

## The quizzes

All answers are **one tap on a button**. Four quizzes (confirmed on ML-260, 2026-09-25):

| Quiz | Asks | Options |
|---|---|---|
| **Note names** | A whole note on a staff → 7 letters, or 12 notes spelled one way (sharps **or** flats) | Clef (multi-select), range (on the staff / 2 / 4 / 6 ledger lines, above and below), sharps and flats (none / sharps / flats) |
| **Keys** | A key signature → "Which major/minor key?"; or a scale written out with accidentals → "Which scale is this?". 4 keys each | Clef, show (key signatures / scales / both), up to 3 / 5 / 7 ♯/♭ (C major and A minor always in), sharp / flat keys / both, major or major + minor, minor scales: harmonic / melodic / both (only with minor keys and scales) |
| **Symbols** | A symbol → its name, or a meaning → the symbol (terms: the word → its meaning, or a meaning → the word). 4 choices | Set: Basics / Dynamics / Rhythm / Structure / Terms / Everything; ask: names / meanings / both |
| **Mixed** | Every question type in turn: a note, a key signature, a scale, a symbol name, a symbol meaning | Clef, level (beginner / intermediate / advanced) |

**Symbol sets:**

| Set | Count | What's in it |
|---|---|---|
| Basics | 13 | Clefs, sharp, flat, natural, fermata, breath mark, caesura, staccato, accent, tenuto, tie, slur |
| Dynamics | 9 | pp, p, mp, mf, f, ff, sfz, crescendo, diminuendo |
| Rhythm | 17 | Semibreve to semiquaver and the dotted minim; their rests; 4/4, 3/4, 2/4, 6/8, common and cut time |
| Structure | 11 | Repeats, double and final bar lines, segno, coda, D.C., D.S., Fine, 1st-time bar, intro brackets |
| Terms | 15 | Largo, Adagio, Andante, Moderato, Allegro, Presto, rit., accel., a tempo, legato, dolce, cantabile, sempre, poco a poco, molto |

**Mixed levels:**

| Level | Notes | Keys | Symbols |
|---|---|---|---|
| Beginner | On the staff, no sharps or flats | Up to 3, major | Basics, Dynamics, Rhythm |
| Intermediate | 2 ledger lines, no sharps or flats | Up to 5, major and minor (harmonic) | + Structure |
| Advanced | 4 ledger lines, sharps and flats | Up to 7, major and minor (both forms) | Everything |

**Ranges**, lowest to highest note:

| Range | Treble | Bass |
|---|---|---|
| On the staff | D4-G5 | F2-B3 |
| 2 ledger lines | A3-C6 | C2-E4 |
| 4 ledger lines | D3-G6 | F1-B4 |
| 6 ledger lines | G2-D7 | B0-F5 |

The staff stays the same height for the whole round.

**How many different questions** (`questionSource(...).size`), for one clef - double for both clefs,
except Symbols:

| Quiz | Smallest | Default | Largest |
|---|---|---|---|
| Note names | 11 (on the staff, none) | 11 | 57 (6 ledger lines, sharps or flats) |
| Keys | 4 (key signatures only, up to 3, sharp or flat keys only) | 14 (up to 3, both, major; both shown) | 75 (up to 7, major and minor, both forms, both shown) |
| Symbols | 9 (Dynamics, one direction) | 26 (Basics, both directions) | 130 (Everything, both directions) |

**Dealing:** every quiz deals each of its questions **once, in a shuffled order, before any comes
round again** (and never the same one twice running, across a reshuffle too). Mixed takes the five
question types in turn (a shuffled order each turn) so none swamps the round, and each type deals its
own questions the same way. A small selection still repeats in a long round, but evenly.

**Other rules:**
- **Wrong answers** are plausible: the nearest keys round the circle of fifths (plus the relative
  major/minor for scales when minor is on), and symbols from the right answer's own set first.
- **Minor scales** are shown harmonic or melodic, because a natural minor scale has exactly its relative
  major's notes.
- **Scale placement:** a scale starts at staff step -2 to 4, so it sits on the staff.
- **Naming:** letters, or solfège if that's the tuner's note-name setting. Solfège uses Do Re Mi Fa Sol
  La Ti, spelled with the sharp or flat (Do♯, Ti♭). That differs from the tuner's chromatic Di/Te,
  because here the spelling matters.
- **Seeded:** `questionSource(quiz, options, { seed })` - the same seed deals the same round.
- **Options** are remembered per quiz on the device (`localStorage` `tml.theory.<quiz>`).

## Smart learn (ML-269)

Behind its own gate, **`theory_smart_learn`** (intended for the paid tier; on for now). Without it, rounds
are the plain shuffle above, with no memory.

- **Weights:** every question has a weight per person, 0-10, starting at 0. Wrong **+2** (up to 10, so
  5 misses reach the top), right **−1** (down to 0, so it takes two rights to undo each wrong). Stored in
  `theory_question_weights` (migration 053) under the question id, so the same question shares one
  weight whichever quiz asked it (Note names and Mixed, say).
- **Updated** by the server from every **finished** round's answers, in order, in the same transaction
  as the round (`applySmartLearn`, using the engine's `nextWeight`). Abandoned rounds don't count.
- **Used** at round start: the app loads the account's weights (`GET /api/theory/weights`, 3 s timeout,
  falling back to the plain shuffle) and passes them to `questionSource(..., { weights })`. `record()` updates
  them as the round goes, so a later deal in the same round already knows.
- **What it changes: the order, not what's asked.** Every question still comes once per deal. Each deal is
  a weighted random shuffle (Efraimidis-Spirakis sampling): key = `random ^ (1 / (1 + weight × 0.5))`,
  dealt from the highest key down. So each next question is exactly (1 + weight × 0.5) times as likely
  as one you know: 3× at weight 4, 6× at 10. With no weights in a deal it's exactly the plain shuffle.
  (The first idea, 0.75 × random + 0.25 × random × weight/10, caps the boost at a quarter of the range:
  in simulation a weight-10 question in 30 moved only from 15th to 11th on average, against 5th here.)
  Tune with `SMART.strength`.
- **On screen:** the options screen says Smart learn is on; the results screen says how many of the
  round's questions it will bring back.
- **Retry in the round:** a missed question comes back `SMART.retryGap` (3) questions later in the same
  round (the 3rd question after), and again if it's missed again. Retries count like any answer.
- **Review:** a question not asked for a week gets a temporary boost when weights are loaded: +1, then
  +1 more each further week, up to +3 (`reviewBoost`, `effectiveWeight`). So things you knew a while ago
  come back to be checked. Every answered question is stored (weight 0 included), and `updated_at` is
  when it was last asked. The stored weight itself only moves with answers.
- **Slow right answers:** a right answer slower than 2 × its question's par time (`SMART.slowFactor`)
  leaves the weight where it is: you got there, but it isn't known yet.
- **Your weak spots:** with Smart learn on, the quiz list ends with a "Your weak spots" row (`WEAK_SPOTS`,
  quiz id `weakSpots`). Its options screen lists every question with a stored weight above 0, weakest
  first (`describeQuestion`: "B♭4 on the treble staff", "Needs work: 6 of 10 · missed 3, right 0"), and
  its round asks only those, dealt by their stored weights (a review boost isn't a weak spot). Any
  question can be rebuilt from its id (`itemFromId`), whichever quiz first asked it. With nothing to
  work on it says so and offers no Start.

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
- **Timed:** each question type has a **par time** - how long it should take. The score is
  100 × (the par of the right answers − the par of the wrong ones) ÷ the round's length, kept between
  0 and 100. So answering every question in its par time scores 100, and faster can't score more.
  A Mixed round simply adds up the pars of whatever it asked.
- **Fixed:** score = 100 × (right − wrong) ÷ questions. Time is recorded, but doesn't count.

**Par times** (`PAR`) - the confirmed top paces, per question:

| Question type | Par | = per minute |
|---|---|---|
| Note name | 1.5 s | 40 |
| Symbol name | 2 s | 30 |
| Key signature | 2.5 s | 24 |
| Symbol meaning | 2.5 s | 24 |
| Scale | 4 s | 15 |

**Grade:**

| Score | Grade |
|---|---|
| 90 or more | 5 |
| 70-89 | 4 |
| 50-69 | 3 |
| 30-49 | 2 |
| Below 30 | 1 |

The limits live in `TheoryEngine` (`PAR`, `GRADE_LIMITS`, `TIMING`).

## Saving and history

- **Only finished rounds are saved.** Leaving part-way asks first.
- **Saving:** `POST /api/theory/attempts` with the quiz, round type, options, naming, duration, start
  time and every answer (`questionId`, `answerId`, `correct`, `ms`).
  - The server scores the round **from its answers** with the engine (the question id's first part is
    its type, which sets its par), and stores it.
  - It returns: `isFirst`, `isNewBest`, `previousBest`, `best`, and `recent` (the last 8 rounds, oldest
    first).
- **History:** `GET /api/theory/attempts?settingsKey=` returns the recent rounds and the best.
- **Quiz list:** `GET /api/theory/summary` returns the last round per quiz.
- **The settings key** groups comparable rounds: quiz, round type, and every visible option. Hidden
  options, like minor scales when minor is off, don't count, and neither does letters/solfège.
- **Best** is the highest score. A tie goes to the quicker round, then the earlier one.
- **All endpoints** are behind the `theory_practice` feature flag. So are the home tile and the ☰ menu
  entry.
- **Practice time:** theory counts as practice time, but isn't linked to practice sessions yet.
  `session_segment_id` is there, nullable, for when it is.

## Testing

**Unit tests** (`node --test "server/test/**/*.test.js"`):
- **Notation:** pitch to staff position, ledger lines for every range, and key-signature order.
- **Engine:** every quiz with every option combination (the answer buttons, right answer included,
  no repeats); every question dealt once before any repeat; Mixed takes each type in turn; every
  scale's step pattern in both clefs; key tables; symbol sets; par scoring.

**Test hook (local only):** with `localStorage['tml.testClock'] = '1'` on localhost,
`window.__theoryTest` offers:

| Call | Does |
|---|---|
| `start(quiz, options, round, seed)` | Starts a round with a fixed seed (a round already running is dropped). |
| `question()` | The current question. |
| `state()` | Right, wrong, answered, and whether it's waiting. |
| `advance(ms)` | Moves the round's clock on. |
| `result()` | The finished round's result. |

The back-test helpers `setWeights` / `getWeights` (`tests/helpers/theory.ts`) read and write Smart learn
weights directly; `clearTheoryAttempts` clears them too.

**Back-test:** case #18 in the Neon `test_cases` table. It covers each quiz on screen, right and wrong
feedback, both round types, Mixed, rhythm and terms, saving, and screenshot baselines.
