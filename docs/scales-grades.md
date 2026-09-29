# Scales: the ABRSM grade lists and the grade grid (ML-357)

The Scales tool's **My scales** pop-up is a list of the scales ABRSM asks for at the grades you tick, on
the instrument you play. Previous, Next and Shuffle go round it. The grid in the pop-up shows the whole
list at a glance: what's in it, what needs another octave, what's outside your range for now, what the
instrument can't play at all, and what isn't needed at those grades.

Code: [`public/scaleGrades.js`](../public/scaleGrades.js) (data and rules, no DOM) and the Scales section
of `public/app.js` (the pop-ups and Previous / Next / Shuffle). Scale shapes are
`TheoryEngine.buildScale` ([theory-practice.md](theory-practice.md)). The screen is
[`specs/components/scales.md`](../specs/components/scales.md). Tests: `server/test/scaleGrades.test.js`
and back-test #20 (`tests/generated/tc_20.spec.ts`).

## Where the lists come from

ABRSM's own syllabuses, checked 2026-09-29 (the URLs are in `ScaleGrades.SOURCES`):

- **Brass**: the 2023 practical syllabus (revised January 2026).
- **Woodwind**: the specification from 2026 (the scales are the same as 2022).

Only Grades 1-4 and only brass and woodwind for now. Each grade is a **standalone** list, not a
running total, so ticking Grades 2 and 3 gives both lists (a scale in both appears once).

| List (`DATA` id) | Clef | Pitch |
|---|---|---|
| Trumpet, cornet and flugelhorn (`trumpet-cornet-flugel`) | treble | written |
| E♭ tenor horn (`eb-tenor-horn`) | treble | written |
| Horn (`horn-f`) | treble | written |
| Trombone, treble clef / bass clef | treble / bass | written / concert |
| Baritone and euphonium, treble clef / bass clef | treble / bass | written / concert |
| Tuba / brass band bass, treble clef | treble | written |
| E♭, B♭, C and F tuba, bass clef | bass | concert |
| Flute, oboe, clarinet, bassoon, saxophone | treble (bassoon bass) | written |

**Pitch world.** Treble-clef brass lists and all woodwind lists are at written pitch. Bass-clef brass
lists are at concert pitch. So when someone who plays a baritone (read in treble in a brass band) picks
the bass clef, their written range is moved down by the instrument's transposition
(`writtenToConcert`, e.g. -14 for B♭ baritone) to compare it with the list. "See your range" then shows
the notes at concert pitch too, and says so.

### Data format

`DATA[listId].grades[grade]` is a list of strings `"kind|keyId|form|octaves|pattern|start"`:

- **kind**: `scale`, `arpeggio`, `chromatic` (starting on the key's tonic) or `dom7` (the dominant 7th
  in that key).
- **form**: `major`, or for minors `natural` / `harmonic` / `melodic`. Where ABRSM lets you choose the
  minor form, each form is its own entry (and its own grid row): Grades 1-2 allow natural, harmonic or
  melodic, and Grades 3-4 allow harmonic or melodic. A minor arpeggio is stored as `harmonic` because
  its notes are the same in every form, and it's shown as "D minor arpeggio".
- **octaves**: `1`, `1.5` (ABRSM's "a 12th") or `2`.
- **pattern**: `toDominant`, meaning one octave up, then down to the dominant below and back up to the
  tonic. Otherwise empty.
- **start**: `octaveUp` means from the tonic an octave above the lowest one.

To change a list, edit `DATA` in `scaleGrades.js` directly. The file was generated once from the
syllabus tables, but there's no generator to re-run. `scaleGrades.test.js` checks that every entry is a
real key and shape and builds in its list's clef, that chromatic scales don't come before Grade 3, and
that dominant 7ths don't come before Grade 4.

**Open question, ML-358:** Bassoon Grade 3, B♭ major, "a 12th". This is the one value that couldn't be
confirmed from the page layout. It's in the backlog to check against a printed syllabus.

### Which list an instrument uses

`ScaleGrades.groupFor(instrumentName, clef)` matches the instrument's catalogue name (`RULES`, checked
top to bottom). The **clef in the Octaves and clef tile** picks between an instrument's treble and bass
lists:

- **Trombone.** Treble uses the treble list. Bass or tenor uses the bass list. Bass trombone uses the
  tenor trombone lists (owner decision).
- **Baritone and euphonium.** Treble or bass lists.
- **Tuba.** Treble uses the brass band bass list. Bass uses the E♭, B♭, C or F tuba list, by the
  instrument's key. Sousaphone and helicon count as B♭ tuba.
- **Horn.** Treble only. Horn in the bass clef has no list.
- **Woodwind.** One list whatever the clef.
- **Anything else** (strings, keyboards, percussion) has no list. The pop-up says so, and the Key and
  Type tiles still work.

## The grid

Two sections, **Major keys** and **Minor keys**. Each has 15 columns in **chromatic order** (owner
decision), keeping both spellings where a key has two:

- Major: C C♯ D♭ D E♭ E F F♯ G♭ G A♭ A B♭ B C♭
- Minor: C C♯ D D♯ E♭ E F F♯ G G♯ A♭ A A♯ B♭ B

Chromatic scales use the major columns (the starting note is all that matters). Dominant 7ths go in the
column of the key they belong to.

**Rows.** There's one row per kind, form and length, and only where the ticked grades need one
(`ROW_ORDER` × `LENGTHS`):

- Major keys: scales, arpeggios, chromatic, dominant 7ths.
- Minor keys: natural minor (Grades 1-2 only), harmonic minor, melodic minor, arpeggios, dominant 7ths.

Each has its length under it: "1 octave", "1 octave, down to the dominant", "a 12th", "2 octaves".

**Cells.** "Not needed" wins over everything: a scale the grades don't ask for is never checked at
all. Otherwise `ScaleGrades.placement` decides the state:

| State | Looks | Meaning | In the list? |
|---|---|---|---|
| `ready` | solid green | fits your range where it's usually written | yes |
| `other` | pale green, "8" | fits your range an octave up or down | yes, in that octave |
| `locked` | amber, lock | the instrument can play it, but no octave fits your range yet | no |
| `beyond` | grey, cross | the instrument can't play it in any octave | no |
| `no` | dashed | not needed at these grades | no |

**Placement rule.** This is an assumption for the owner to check. "Usually written" is where the Scales
tool puts the scale anyway: the bottom tonic on or just under the stave (`buildScale`'s default
`tonicOctave`), an octave higher where the list says `octaveUp`. If the instrument's outer range can't
reach that, it moves to the nearest octave it can. It is **not** "as low as the instrument goes",
because the catalogue's outer ranges include pedal notes, which would put every low-brass scale in the
pedals.

The instrument's outer range is `rangeLow` / `rangeHigh` from the catalogue. Your range is
`bottomNote` / `topNote` from the Range tool (ML-322). If your range isn't set, everything the
instrument can play counts as ready, and "See your range" offers to set it.

**The list** is the ready and other cells, in grid order: the major rows top to bottom, then the minor
rows, each left to right. Every entry carries the octave it goes in (`tonicOctave`), so Next plays it
where the grid says. Picking a key, type, length or clef by hand goes back to the usual placement.

## The shapes

These are the shapes the grades need that `buildScale` didn't have before:

- **Chromatic.** Sharps going up, flats coming down, no key signature ("Chromatic scale on A♭").
- **Dominant 7th.** Degrees 5-7-9-11 of the key, up and down over the octave, then **up a 4th to the
  tonic** ("Dominant 7th in A♭ major": E♭ G B♭ D♭ E♭ D♭ B♭ G E♭ A♭). The resolution note is an
  assumption for the owner to check, because ABRSM's printed books show it resolving. In a minor key
  it's the harmonic minor's dominant (the raised 7th).
- **A 12th.** An octave and a 5th, up and back.
- **Down to the dominant.** One octave up, down to the dominant below, and back to the tonic.
- **Down and up.** The Direction tile's fourth choice.

## Later

Practice sessions will reuse the grid, with an ability level on each box in place of plain green (the
owner's plan, ML-314/320). Other exam boards (Trinity), Grades 5-8 and strings would each add lists to
`DATA` and rules to `RULES`.
