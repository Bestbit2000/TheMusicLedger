# Scales: the ABRSM grade lists and the grade grid (ML-357)

The Scales tool's list is the scales ABRSM asks for at the grades you tick, on the instrument you play,
plus Everything else if you tick it. Previous, Next and Shuffle go round it, and Select picks one. The
grid in the **Scales** pop-up (the first button of the setting row) shows the whole list at a glance:
what's in it, what needs another octave, what's outside your range for now, what the instrument can't
play at all, and what isn't needed at those grades.

Code: [`public/scaleGrades.js`](../public/scaleGrades.js) (data and rules, no DOM) and the Scales section
of `public/app.js` (the screen, the pop-ups, Previous / Next / Shuffle / Select). Scale shapes are
`TheoryEngine.buildScale` ([theory-practice.md](theory-practice.md)). The screen is
[`specs/components/scales.md`](../specs/components/scales.md). Tests: `server/test/scaleGrades.test.js`
and back-test #20 (`tests/generated/tc_20.spec.ts`).

## Where the lists come from

ABRSM's own syllabuses, checked 2026-09-29 (the URLs are in `ScaleGrades.SOURCES`):

- **Brass**: the 2023 practical syllabus (revised January 2026).
- **Woodwind**: the specification from 2026 (the scales are the same as 2022).

Grades 1-8, brass and woodwind. Each grade is a **standalone** list, not a running total, so ticking
Grades 2 and 3 gives both lists (a scale in both appears once).

| List (`DATA` id) | Clef | Pitch |
|---|---|---|
| Trumpet, cornet and flugelhorn (`trumpet-cornet-flugel`) | treble | written |
| E♭ soprano cornet (`eb-soprano-cornet`): its own tables at Grades 6-8, the trumpet list below that | treble | written |
| E♭ tenor horn (`eb-tenor-horn`) | treble | written |
| Horn (`horn-f`) | treble | written |
| Trombone, treble clef / bass clef | treble / bass | written / concert |
| Bass trombone (`bass-trombone`): its own at Grades 6-8 (ABRSM has no Grade 1-5 bass trombone exam), the tenor trombone's (bass clef) below that - owner's call | bass | concert |
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

- **kind**: `scale`, `arpeggio`, `thirds` (a scale in thirds), `dom7` (the dominant 7th in that key), or
  one that starts on a note - `chromatic`, `wholetone`, `dim7` (diminished 7th) - whose keyId's tonic is
  just the starting note, so it can be a note with no key of its own ("G# major" = a diminished 7th on G♯).
- **form**: `major`, or for minors `natural` / `harmonic` / `melodic`. Where ABRSM lets you choose the
  minor form, or asks for both, each form is its own entry (and its own grid row): Grades 1-2 allow
  natural, harmonic or melodic; Grades 3-5 harmonic or melodic; Grades 6-8 ask for both (the examiner
  names one). A minor arpeggio is stored as `harmonic` because its notes are the same in every form, and
  it's shown as "D minor arpeggio". Extended-range minor scales are harmonic only.
- **octaves**: `1`, `1.5` (ABRSM's "a 12th"), `2`, `2.5` (oboe and saxophone Grade 8) or `3`.
- **pattern**: `toDominant` - one octave up, then down to the dominant below and back up to the tonic;
  or `extended:<start>:<top>:<bottom>` - Grades 7-8's extended range: from the start tonic up to the
  printed top note, down to the printed bottom note and back, at exactly those written pitches (for
  example trumpet D major: `extended:D4:F#5:F#3`). Otherwise empty.
- **start**: `octaveUp` means from the tonic an octave above the lowest one. Horn Grade 7 B♭ is asked in
  both the lower and the upper two octaves, so it has an entry each way and a grid row each.

To change a list, edit `DATA` in `scaleGrades.js` directly. It was generated from the syllabus tables
(the research files are in the ML-357 session), but there's no generator in the repo to re-run.
`scaleGrades.test.js` checks that every entry is a real key and shape, builds in its list's clef and
lands in exactly one grid cell; that every extended-range entry reaches its printed top and bottom
notes; that chromatic scales don't come before Grade 3, dominant 7ths before Grade 4, or scales in
thirds before Grade 6; and that from Grade 5 every list has a diminished 7th and both minor forms.

**Left out, ML-360:** ABRSM doesn't print the extended-range notes for the B♭, C and F tuba (bass clef)
Grade 7-8 extended-range scales and arpeggios (6 each - the syllabus points to a page that only has E♭
tuba examples), and the E♭ tuba Grade 7 F major extended-range scale's example is a misprint (it's the
bass trombone's B major). Those 19 aren't in the lists until they're checked against ABRSM's printed
tuba scale books.

**Open question, ML-358:** Bassoon Grade 3, B♭ major, "a 12th", couldn't be confirmed from the page
layout.

**Not drawn:** Grades 7-8's articulations (legato-tongued, staccato - the examiner chooses) and the E♭
soprano cornet's melodic minor "down to the dominant" ending (drawn like the standard one).

### Which list an instrument uses

`ScaleGrades.groupFor(instrumentName, clef)` matches the instrument's catalogue name (`RULES`, checked
top to bottom). The **clef** button on the Scales screen picks between an instrument's treble and bass
lists:

- **Trombone.** Treble uses the treble list. Bass or tenor uses the bass list. **Bass trombone**, bass or
  tenor: its own list (Grades 1-5 the tenor trombone's).
- **E♭ soprano cornet.** Its own list (Grades 1-5 the trumpet's).
- **Baritone and euphonium.** Treble or bass lists.
- **Tuba.** Treble uses the brass band bass list. Bass uses the E♭, B♭, C or F tuba list, by the
  instrument's key. Sousaphone and helicon count as B♭ tuba.
- **Horn.** Treble only. Horn in the bass clef has no list.
- **Woodwind.** One list whatever the clef.
- **Anything else** (strings, keyboards, percussion) has no list. The pop-up says so, and Everything
  else gives every scale.

## The grid

Two sections, **Major keys** and **Minor keys**. Each has 15 columns in **chromatic order** (owner
decision), keeping both spellings where a key has two:

- Major: C C♯ D♭ D E♭ E F F♯ G♭ G A♭ A B♭ B C♭
- Minor: C C♯ D D♯ E♭ E F F♯ G G♯ A♭ A A♯ B♭ B

Chromatic, whole-tone and diminished 7ths are by starting note, in the major columns; a sharp start with
no major key (G♯, D♯, A♯) sits in its flat twin's column, but keeps its own spelling on the stave and in
Choose a scale. Dominant 7ths go in the column of the key they belong to.

**Rows.** There's one row per kind, form and length, and only where the ticked grades need one
(`ROW_ORDER` × `LENGTHS`):

- Major keys: scales, arpeggios, scales in thirds, chromatic, whole-tone, dominant 7ths, diminished 7ths.
- Minor keys: natural minor (Grades 1-2 only), harmonic minor, melodic minor, arpeggios, dominant 7ths.

Each has its length under it: "1 octave", "1 octave, down to the dominant", "a 12th", "2 octaves",
"2½ octaves", "3 octaves", "extended range" - and ", an octave up" for horn Grade 7's upper B♭.

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
pedals. An extended-range scale is always at its printed pitches: ready if they're in your range,
locked if not, beyond if the instrument can't reach them.

The instrument's outer range is `rangeLow` / `rangeHigh` from the catalogue. Your range is
`bottomNote` / `topNote` from the Range tool (ML-322). If your range isn't set, everything the
instrument can play counts as ready, and "See your range" offers to set it.

**The list** is the ready and other cells, in grid order: the major rows top to bottom, then the minor
rows, each left to right. Every entry carries the octave it goes in (`tonicOctave`, and the printed
notes for an extended range), so Next plays it where the grid says.

**Everything else** (the grade `'else'`) adds every key and kind the ticked grades don't already ask
for: scales (major; natural, harmonic, melodic minor), arpeggios, scales in thirds and dominant 7ths
in every key (a minor key's dominant 7th is the major key's chord, so it's once, under the major), and
chromatic, whole-tone and diminished 7ths on each of the 12 starting notes - each at the longest length
that fits your range (2 octaves, a 12th, 1 octave; never a 12th for scales in thirds, whole-tone or
chromatic, which ABRSM doesn't ask for at that length), or 1 octave when neither range is known. It's
also the whole list for an instrument with no ABRSM list.

## The shapes

These are the shapes the grades need that `buildScale` didn't have before:

- **Chromatic.** Sharps going up, flats coming down, no key signature ("Chromatic scale on A♭").
- **Dominant 7th.** Degrees 5-7-9-11 of the key, up and down over its length (1 octave to 3), then
  **up a 4th to the tonic** ("Dominant 7th in A♭ major": E♭ G B♭ D♭ E♭ D♭ B♭ G E♭ A♭). ABRSM says
  dominant 7ths "resolve on the tonic"; up a 4th (rather than down a 5th) is an assumption for the owner
  to check. In a minor key it's the harmonic minor's dominant (the raised 7th).
- **Diminished 7th.** Minor 3rds from the starting note, spelled by letters a 3rd apart, respelled
  where that gives a double sharp or flat or E♯/F♭/B♯/C♭ - G B♭ D♭ E, as ABRSM prints it. No key
  signature.
- **Whole-tone.** Whole tones from the starting note, sharps going up, flats coming down (ABRSM doesn't
  prescribe a spelling). No key signature.
- **Scale in thirds.** Up in broken thirds (1-3, 2-4 ... 7-9 each octave), the top tonic, down (8-6, 7-5
  ... 2-7), and the tonic - ABRSM's B♭ example note for note.
- **Extended range.** From the tonic in the middle of the range up to the printed top note, down to the
  printed bottom note, and back - a scale or an arpeggio (only the arpeggio's notes).
- **A 12th, 2½ octaves.** An octave (or two) and a 5th, up and back.
- **Down to the dominant.** One octave up, down to the dominant below, and back to the tonic.
- **Down and up.** The Direction button's fourth choice.

## Later

Practice sessions will reuse the grid, with an ability level on each box in place of plain green (the
owner's plan, ML-314/320). Other exam boards (Trinity) and strings would each add lists to `DATA` and
rules to `RULES`.
