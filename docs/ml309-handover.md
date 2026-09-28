# ML-309 handover: parts C, D and E (for a new chat)

Parts **A** (instruments) and **B** (Theory grades 1-5) shipped in release 0.29.0. This is everything
a new chat needs to start **C**, **D** and **E**, without the 0.29.0 conversation. Read these first:
`CLAUDE.md`, `docs/theory-practice.md`, `docs/theory-grades.md`, `specs/components/theory-quiz.md`,
`specs/components/scales.md`, and `public/theoryEngine.js` (the whole quiz engine is one file).

## What A and B left in place

- **Instruments** (A): `instruments` meta table (76 rows, generated from
  `band_instruments_master_catalog.json` by `scripts/generate-instruments-migration.mjs` into
  migration `059`; to change the catalogue, edit the JSON and generate a *new* migration - the insert
  upserts on `code`). `account_instruments` (at most one `is_primary`). `sessions.instrument_id`
  (set server-side on POST/PUT `/api/sessions`: the picked instrument if the account plays it, else
  the main one). My account → Your instruments. Admin → Usage → Instruments. Each instrument has
  `theory_clef` (treble/bass/alto/tenor/grand/none) and `pitch_key` / `sounding_transposition`.
- **Theory grades** (B): `THEORY_GRADES`, `gradeContent(g)`, `gradeSummary()`, symbol `grade` /
  `gradeOnly` in `public/theoryEngine.js`; the grade picker per quiz (feature `theory_grades`);
  Admin → Theory grades lists the content. Alto and tenor clefs exist in `public/notation.js`.
- A second dev account for back-tests: `/auth/login?as=admin` = `local-admin@themusicledger.local`,
  super admin on dev (local-dev is an ordinary member). `loginAsLocalAdmin` in `tests/helpers/auth.ts`.

## C - new Theory quiz types (so grades 1-5 cover the whole syllabus)

**C1 is done** (2026-09-28): Intervals (Grades 2-5), technical names and the chromatic scale (Grade 4,
in Keys), triads, inversions and cadences (Grades 4-5, the Chords quiz), and the `chord` item in
`notation.js` - see "Intervals, chords..." in `docs/theory-grades.md`. Owner decisions: grades only,
new quizzes fine, written only. **C2 next:** rhythm (beams and tuplet brackets in `notation.js` first,
then triplets/irregular groups, grouping/beaming, time signature from a bar, missing bar-line).
**C3:** transposition, instruments and voices.

Each is a new entry in `QUIZZES` (or a new question type inside Mixed), following the existing
pattern: items → `build()` → a question with a fixed list of one-tap answers, an id that
`itemFromId()` can rebuild (Smart learn weak spots rely on it), a `PAR` time, and a `grade` so it
joins `gradeContent`. All notation through `Notation` (Bravura) only.

| Quiz type | Grade | Question idea |
|---|---|---|
| Intervals | 3 (number + major/minor/perfect, above the tonic of a major key); 4 (all within an octave, incl. augmented/diminished); 5 (compound) | Two notes on a staff → "Which interval?" (choices) |
| Triads and chords | 4 (tonic, subdominant, dominant triads); 5 (I, II, IV, V, root/1st/2nd inversion) | A triad in a key → "Which chord?" / "Which inversion?" |
| Cadences | 5 (perfect, plagal, imperfect) | Two chords → "Which cadence?" |
| Transposition | 3 (up/down an octave, between clefs); 5 (for B♭, A, F instruments) | A short phrase → pick the correctly transposed one (staff answers, like the `symbols` layout) |
| Chromatic scale | 4 | Is this chromatic scale written correctly? / pick the correct one |
| Technical names | 4 (tonic, supertonic ... leading note) | A note in a key → "Which degree?" |
| Triplets / irregular groups | 2 (triplets); 5 (duplets etc.) | Rhythm symbol questions, as Notation does |
| Grouping / beaming | 1-5 | Pick the correctly grouped bar |
| Instruments and voices | 4-5 | Text questions (family, clef, transposition) - the `instruments` table already has the data |

Also: time-signature *identification from a bar of rhythm* (grades 1-5, the time signatures in
`THEORY_GRADES`' symbols) and "add the missing bar-line". New glyphs: measure metrics in the browser
(canvas `measureText` on Bravura at 400px, 1 staff space = 100px - see how ML-309 did it) and add them
to `GLYPHS` in `notation.js`.

## D - Scales tool: grade picker from the practical syllabus

The **Scales practice tool** (`scalesView`, ML-9) should offer "Grade 1-8 for your instrument": the
scales and arpeggios an exam asks for that instrument and grade, instead of picking a key/form.

- Source: ABRSM **Brass Practical syllabus 2023** (the owner's copy:
  `C:\Users\andre\OneDrive\Documents\Music sheets\Music Ledger files\Brass 2023 Practical syllabus (0 ALL) 20260128 (1).pdf`).
  Text extraction without Python: `node scripts/pdf-text.cjs <in.pdf> <out.txt>` (Node only). The baritone & euphonium pages start at
  "Baritone and Euphonium from 2023 Grade 1".
- **Copyright:** the syllabus says no listing may be reproduced or published without ABRSM's
  permission. Don't paste the lists into the repo or the UI verbatim - store the requirements as data
  (key, form, octaves, articulation, range) and **confirm with the owner** whether ABRSM permission is
  needed before shipping grade-by-grade exam content (especially as a paid feature).
- Shape of the data (baritone/euphonium): each grade lists **treble clef** (brass band, transposing)
  and **bass clef** (concert pitch) versions - the same sounding scales, written a 9th apart - with
  scales (major; minor natural/harmonic/melodic at candidate's choice in lower grades, harmonic or
  melodic higher up), arpeggios, a chromatic scale from Grade 3, octaves (1 → 2), range and
  articulation (tongued / slurred). The clef comes from the account's instrument (`theory_clef`) and
  the treble/bass choice.
- Build it as data per instrument family + grade (a new table, or a JSON file generated like the
  instruments), gated like `theory_grades` (a new feature key, e.g. `scales_grades`).
- Instruments to cover first: baritone & euphonium (owner's attachment); then the others the
  practical syllabus has (horn; trumpet/B♭ cornet/E♭ soprano cornet/flugelhorn; E♭ horn; trombone;
  bass trombone; tuba).

The **Performance Grades** qualification specs (generic + brass) were also checked: they're four
pieces with no scales, aural or theory tests, so they add nothing to C, D or E. They confirm the same
brass instrument list.

## E - Theory grades 6-8

Extend `THEORY_GRADES` and the new C question types to Grades 6-8 (harmony and counterpoint,
figured bass, chords in four parts, modulation, more ornaments and terms, score reading). The ABRSM
Grades 6-8 syllabus page couldn't be reached from the 0.29.0 session - get the PDF from the owner
first. Grades 6-8 are mostly *writing* music, which one-tap questions can only partly cover:
agree with the owner which parts suit multiple choice before building.

## Process reminders

One chat per release. Design gate: new classes need a spec and an Admin → Design entry, and the owner
signs off from screenshots (`npm run design-signoff`) - never set `DESIGN_APPROVED` yourself. No
inline styles. `npm run token-audit`, `npm run a11y-audit`, unit tests (`cd server && npm test`),
back-tests on dev, migrations applied to dev → sandbox → production before the atomic release push.
