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
- **My instrument** (Theory page, from My account → My instruments) sets the clef each quiz
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

## Intervals, chords, technical names, chromatic scale (ML-309 C1)

Owner decisions (2026-09-28): **grades only** (no custom options), **new quizzes** are fine, **written
only** (nothing played). Two new quizzes, **Intervals** and **Chords**, have only a grade picker (their
own grades, no Custom) and the clef; the app leaves them off the list while `theory_grades` is off, and
the server refuses their rounds then. Keys and Mixed pick up the new types at a grade too.

| Grade | Intervals quiz | Keys (with scales shown) | Chords quiz |
|---|---|---|---|
| 2 | Number only (2nd-octave) above the tonic of the grade's major keys | | |
| 3 | Number and quality (major/minor/perfect) above the tonic of the major and minor keys | | |
| 4 | + any two notes within an octave, augmented and diminished | Technical names (a note in a key → tonic ... leading note); the chromatic scale (Yes/No: written correctly?) | I, IV, V (tonic, subdominant, dominant) in root position |
| 5 | + compound intervals (named "Compound major 3rd") | | + II; root position, 1st and 2nd inversion (a, b, c); "Which position?"; cadences: perfect V-I, plagal IV-I, imperfect I/II/IV-V |

- **Groups:** each new type is its own group in a round, taken in turn with the others, so a large
  pool (every interval between any two notes) doesn't swamp a small one (cadences). Keys at Grade 4+
  alternates key questions, technical names and chromatic scales - but only with Show = scales or
  both. Mixed at a grade adds intervals, technical names and chords (chords + inversions + cadences as one group).
- **Intervals** are shown melodic or harmonic at random (same question id). Wrong answers are the
  nearest intervals in semitones (a diminished 4th for a major 3rd is fair game from Grade 4);
  Grades 2-3 never offer augmented or diminished.
- **Chords** are close-position triads on one staff with the key signature; a minor key's chords come
  from the harmonic minor (major V, diminished II). A cadence is two root-position chords.
- **Chromatic scale:** the right version is the harmonic chromatic scale (tonic and dominant once,
  every other letter twice) on the Grade 4 major tonics that need no double sharps/flats (C G D A E B
  F B♭ E♭). The wrong version respells one note so a letter is used three times or skipped; the
  feedback says which ("it's wrong - D is used 3 times"). One right and one wrong per tonic and clef.
- **Question ids** (Smart learn): `intervalNumber|interval:<clef>:<low>:<high>`, `degree:<clef>:<key>:<1-7>`,
  `chromatic:<clef>:<tonic>:ok|<n>`, `chord|inversion:<clef>:<key>:<1|2|4|5>:<0-2>`, `cadence:<clef>:<key>:<from>-<to>`.
- Engraving: `Notation.staff` gained a `chord` item (see docs/theory-practice.md, "Notation").
- Admin → Theory grades lists these per grade ("topics" in `gradeSummary()`).

**Not asked yet** (ML-309 C2/C3 - see `docs/ml309-handover.md`): transposition (octave, and B♭/A/F
instruments), triplets/irregular groupings, grouping and beaming, time signature from a bar, missing
bar-lines, instruments and voices. Grades 6-8 are ML-309 E.

Tests: `server/test/theoryEngine.test.js` → "Theory grades (ML-309)".
