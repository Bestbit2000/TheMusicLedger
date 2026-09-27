# Theory grades (ML-309 B)

Any Theory quiz (Note names, Keys, Notation, Mixed) can be set to **Grade 1-5** instead of its own
options, behind the feature **`theory_grades`** (migration `060`, off by default - switch it on per
environment in Admin → Features). It may become a paid feature.

- **Per quiz.** The grade is part of that quiz's stored options (`tml.theory.<quiz>`), so Keys can be
  on Grade 3 while Note names is on Custom.
- **Cumulative.** Grade N asks everything in Grades 1..N, not only what Grade N adds.
- **What the player still chooses:** the clef (from the grade's clefs), Keys' Show (key signatures /
  scales / both) and Notation's Ask (names / meanings / both). Every other option is the grade's
  (`gradeKeep` on the option in `public/theoryEngine.js`).
- **No progress tracking here.** Rounds save and score exactly as custom rounds do (the settings key
  starts `grade=N;`). Grade progress belongs to practice sessions later, not the quick tools.
- **Server:** `theoryPractice.js` treats a round as custom (`grade: 0`) while the feature is off.
- **Your instrument** (Theory page, from My account → Your instruments) sets the clef each quiz
  starts on: the instrument's `theory_clef` (brass band treble for baritone/euphonium/basses, bass
  clef for bass trombone, both clefs for keyboards). Picking another instrument there moves every
  quiz to its clef. Per device (`tml.theory.instrument`).

## Where it lives

- `THEORY_GRADES` in `public/theoryEngine.js`: what each grade **adds** for note names (clefs,
  ledger-line range, spellings) and keys (key list, minor forms). `gradeContent(g)` combines 1..g.
- Each symbol/term's `grade` (`SYMBOL_GRADE` for the original ones; the grade-only ones carry
  `grade` + `gradeOnly: true`). Grade-only symbols are **not** in the custom sets, so custom rounds,
  their question counts and personal bests are unchanged.
- **Admin → Theory grades** lists it all, grade by grade, straight from the engine, for review.
- Alto and tenor clefs (Grades 4 and 5) were added to `public/notation.js` (C clef, standard key
  signature positions); the custom Clef option offers them too.

## The draft (from the ABRSM Music Theory syllabus, Grades 1-5)

| Grade | Note names | Keys | Also adds |
|---|---|---|---|
| 1 | Treble and bass, on the stave, naturals | C, G, D, F major | Basic symbols, dynamics, note values and rests, 2/4 3/4 4/4 and C, repeats, D.C./Fine, first terms |
| 2 | Up to 2 ledger lines, sharps and flats | + A, B♭, E♭ major; A, E, D minor (harmonic) | 2/2 3/2 4/2 and ¢, sfz, tenuto, D.S./segno, 1st-time bar, D.C. al Fine, more terms |
| 3 | Up to 4 ledger lines | Up to 4 ♯/♭, major and minor; melodic minor too | Compound time (6/8 3/8 9/8 12/8 6/4), demisemiquaver, coda, D.S. al Coda, caesura, more terms |
| 4 | + alto clef | Up to 5 ♯/♭ | Double sharp/flat, ornaments (trill, turn, mordents, acciaccatura, appoggiatura), breve, more terms |
| 5 | + tenor clef | Up to 6 ♯/♭ | 5/4 and 7/8, more terms |

The **terms per grade** are a draft of common Italian terms at each level (the full list and their
meanings are on Admin → Theory grades). ABRSM doesn't publish a single terms-per-grade list in the
syllabus, and its syllabus notice says listings may not be reproduced without permission, so these
are our own selection and wording, to be checked against the recommended books.

**Not asked yet** (they need new question types, ML-309 C - see `docs/ml309-handover.md`):
intervals, triads/chords and inversions, cadences, transposition (octave, and B♭/A/F instruments),
the chromatic scale, technical names of scale degrees, triplets/irregular groupings, grouping and
beaming, instruments and voices. Grades 6-8 are ML-309 E.

Tests: `server/test/theoryEngine.test.js` → "Theory grades (ML-309)".
