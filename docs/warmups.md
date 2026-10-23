# Warm-ups (ML-294, ML-361, ML-586)

The Warm-ups tool: brass warm-up exercises one at a time, with a metronome that lights the note to
play. A building block of practice sessions, alongside Scales (ML-9).

| Piece | What it does |
|---|---|
| [`public/warmups.js`](../public/warmups.js) | The engine, shared by the tool, the admin editor, the server and the tests: checks an exercise (bars add up, pitches in range), turns it into stave rows, the bass-clef transposition, and the playback timeline. |
| [`db/migrations/055_warmups.sql`](../db/migrations/055_warmups.sql) | `warmup_exercises` and the 66 seeded exercises, plus the `warmups` feature. |
| [`db/migrations/078_warmup_slurs.sql`](../db/migrations/078_warmup_slurs.sql) | ML-361: the slurs on the seeded Lip slurs and Flexibility exercises. |
| [`server/services/warmups.js`](../server/services/warmups.js) | Reads them (`GET /api/warmups`, switched-on only) and saves them for super admins (`/api/admin/warmups`). Every save goes through the engine's `check`. |
| `app.js` "WARM-UPS" / `admin.js` "Warm-ups" | The tool and the Admin → Warm-ups editor. |
| [`specs/components/warmups.md`](../specs/components/warmups.md) | The design spec. |
| `server/test/warmups.test.js` | Engine tests, including every seeded exercise in all three clefs. Back-test case 21. |

## Exercises

- **Written for treble-clef brass**, as brass band parts are: cornet, horn, baritone, euphonium and
  bass all read the same written notes, so one exercise serves them all. The editor allows written F♯3
  to C6; the 66 seeded ones use F♯3 to G5 (most sit between C4 and C5).
- **Bass clef** (trombone, euphonium) is the same exercise **down a major 9th**
  (`Warmups.toBassClef`). That's how a treble-clef B♭ part and its bass-clef part relate, so a lip slur
  stays on the same harmonics (written C-G-C-E-G is B♭-F-B♭-D-F in bass clef).
- **Tenor clef** (ML-373: trombone and euphonium up high) reads the same pitches as bass clef, so it takes
  the same 9th down - only the clef it's drawn in differs. The Clef pop-up offers Treble, Bass and Tenor, as
  Scales does; an instrument whose own clef is tenor starts on it.
- **No rests after the last note** (owner, 1 Oct 2026): a rest bar at the end only adds a silent bar before the
  next go or the next warm-up. Saving trims them (`Warmups.trimEndRests`, server and editor alike); migration 088
  trimmed the eight seeded long tones that had one.
- **Stored** as `notes`: `[{ p: 'G4' | null (rest), d: 'w'|'h'|'q'|'e', dot?: true, sl?: true }]` and
  `beats_per_bar` - **3 or 4** (ML-539, owner 20 Oct 2026: the count-in is one bar, and the two clicks of a quick 2/4
  were too few to come in on; `Warmups.SAVE_BEATS`, checked on save; migration 136 made the seeded 2/4 March tune
  4/4 - two bars make one, no note moves. The engine's `check` still reads 2-6, so nothing old fails to draw). Bars come from the lengths; a note can't run over a bar line; the last bar
  may be short.
- **Six kinds**, in this order: long tones, lip slurs, flexibility, articulation, finger patterns,
  easy melodies. `sort_order` sets the order the tool plays them in (Previous / Next); Shuffle jumps to a random
  one of the chosen kinds.
- **The 66 seeded exercises are original to this app.** They're built from common teaching patterns
  (long tones, harmonic-series slurs, intervals, repeated-note tonguing, five-note scales, short
  tunes) that nobody owns - no copied material. About 19 minutes of playing at their own tempos, so
  about 5 × a 4-5 minute warm-up, and the day's warm-up can vary.
- **Slurs (ML-361).** `sl: true` slurs a note to the next one; a run of them is one slur. The check
  rejects a slur from a rest, off the end, or into a rest. The stave draws them with standard engraving
  (`Notation.staff` spans): under stem-up notes, over the top as soon as a stem points down; a slur that
  runs past the end of a row carries on to the next (`openEnd` / `openStart`). Migration 078 slurred the
  seeded **Lip slurs and Flexibility** exercises by rule (owner's): each bar's notes, carried on to the
  next bar when that bar is a single held note - but only where the notes were still as seeded. Long
  tones, articulation (the tonguing kind), finger patterns and easy melodies have none; phrasing those
  is for the editor.

## The tool (ML-586: two ways to use it, one Settings button)

The owner (23 Oct 2026, Jira ML-586 - "too many buttons", 14 of them): there are **two ways to use it** - **at your
own pace** (Previous / Next warm-up, when you're ready) or **with the metronome** (each warm-up at its own speed,
twice by default, then straight on to the next in time) - and everything else goes **under one Settings button**.
The design was agreed on a Claude Design canvas (linked from the Jira issue).

- **The title** is a button: it opens **My warm-ups** (the list, by topic, locked ones in place). **Settings** beside
  it holds: the **instrument**, the **clef** (the one you read your instrument in until you choose one - for the
  visit only, ML-528), the **topics** (the kinds, the standard pick list), the **music size**, **Shuffle**, and the
  **Play with the metronome** switch with, under it, **speed**, **play each one**, **count-in**, **volume** and **Light the note being played** (on to start with - the owner, 23 Oct 2026: a more advanced player may not want the gold note; with it off the lines still move up as it plays).
- **The settings are saved on the account** (`accounts.warmup_prefs`, migration 148, `GET/PUT /api/account/warmups`,
  checked by `Warmups.cleanPrefs`) so they're the same on every device - "most of the time you'll just use the
  defaults" (owner). A copy stays on the device (`tml.warmups`) for offline and for where you were; the first time
  the account has none, the device's is saved to it. The old "repeat" (once by default) isn't carried over: **play each
  one starts at twice** (owner); "until stopped" has gone - the list carries on instead. Own pace is where a new
  member starts (as ML-368's "metronome off on arrival").
- **Speed is a percentage of each warm-up's own** (80%, 90%, their own, 110% - `Warmups.SPEEDS`), not a bpm, because
  every warm-up has its own speed. The speed pop-up says so.
- **The bar at the bottom of the screen** (sticky): how far through the list, what's playing and what's next, and the
  buttons - own pace: Previous, Next warm-up; with the metronome: Previous, Play / Pause, Next. Previous goes back to
  the start of the warm-up you're on first (it took Reset's place). **The count-in shows in that bar**, in Play's
  place - it used to cover the metronome card, which sat off the bottom of the screen on a long warm-up.
- **One music size for every warm-up** (Small, Medium, Large; `Warmups.fitRows`): as many whole bars on a line as fit
  the width. Each warm-up used to be stretched to fill the card, so one with few notes was drawn big and one with many
  small (the owner's report). Scales has the same since ML-589, and the size is one setting for both (owner).
- **The line being played stays in view**: the page scrolls it up under the top bar when it or the next line would be
  hidden.
- **With the metronome, after the last warm-up** it stops: "That's the whole list - well done!". At your own pace the
  list goes round.
- **Counted**: an anonymous PostHog `warm-ups setting` event (which setting, its new value), so the screen can be
  simplified again by what's used (the owner's "measure what people actually use").
- **Range locking.** A warm-up whose notes go outside your comfortable range (the Range tool's
  `bottomNote` / `topNote`) is **locked**, and one outside the instrument's own range (`rangeLow` /
  `rangeHigh`) is **beyond** - both checked in the instrument's own clef, where those ranges are written.
  On brass and woodwind the top of that is a 4th above `rangeHigh` once your range is set (the usual top
  is soft, ML-370, docs/range.md), so a warm-up up there is locked until your range reaches it.
  They're left out of Previous / Next / Shuffle (and a practice session's warm-up list), counted in the
  Topics pop-up ("12 warm-ups · 9 locked"), and shown in My warm-ups with a lock and why. With no
  range set nothing is locked. The seeded warm-ups (F♯3 to G5) are never beyond a baritone or euphonium;
  a beginner's range of C4 to C5 locks 25 of the 66.

## Editing (Admin → Warm-ups, super admins only)

Tap-to-build: choose a length, an octave, then a key or Rest. Nothing selected adds at the end;
tap a note on the stave (or use ← / →) to select it, and the next key replaces it. Changing the
length with a note selected re-lengthens it. Undo, Delete note, and **Slur to next note** / **Remove slur**
on the selected note (ML-361). Problems show under the stave and
Save stays off until there are none - the server checks again on save. Switch an exercise off to
hide it from the tool without losing it.

## Playing

`Warmups.timeline`: the metronome clicks every crotchet, or every quaver when the exercise has quavers
or dotted crotchets (`setNotesPerBeat(2)`), and each note lights for its own length (a semibreve for
four clicks). A count-in bar before each warm-up (optional), then it plays once or twice, at its own speed times the
speed setting.

**The repeat sign (ML-538).** When the metronome plays a warm-up more than once in a row (play each one: twice) its
stave ends with a repeat sign (`Warmups.rows(..., { repeat: true })`, Bravura's `repeatRight`) instead of the final
barline. At your own pace it doesn't.

**One sequence (ML-390, ML-586).** With the metronome the list is one metronome **sequence** (the player's ML-193
sequence mode) - each warm-up is a passage (its count-in bar, then its notes once or twice), and the player asks for
the next one on the beat the last ends, so it carries straight on in time and the screen moves on with the next
warm-up's first click. (Stopping and restarting the player between warm-ups played the next bar's first click twice.)
On the tool's own it ends after the last one (`warmupsToolLoop`); in a practice session's Warm-up block
(`sessionWarmupLoop`) the list plays on a loop until the block ends, each round a little faster. **A session follows
the speed and play each one settings** (ML-586 - it used to be twice each whatever; twice is still the default), and
it **starts with the metronome** whatever the setting (ML-390); the switch in Settings changes it for that block
only, and the topics and the order are the session's.

**The count-in** (ML-542, ML-586) shows big in the bar at the bottom of the screen, in Play's place: the beats left
and a dot per beat. When a session's block runs out of time part way through an exercise, the time through it's on
is finished first (ML-541, docs/practice-sessions.md).

**Headphones (ML-586).** The owner found the gold note up to two beats ahead of the sound in his Bluetooth headphones.
Three fixes, for every tool's player (`createMetronomePlayer` in app.js):
- **The sound line is kept awake** while the Warm-ups screen is open with the metronome on (`keepAwake`): Bluetooth
  headphones, and Chrome's own power saving, switch the sound off when nothing plays, so the first second or two
  after Play was lost or held back. A signal far too quiet to hear (about -90 dB) - not silence, which is what switches
  it off - keeps it open; it stops when you leave the screen.
- **The browser's own figure for the delay** (`AudioContext.outputLatency` + `baseLatency`, where it gives one, up to
  half a second) is added to when the light comes on - only while no headphone delay has been set by hand in
  Settings → Metronome & playback (a delay set by hand already includes it).
- **The headphone delay set by hand now reaches every tool's player at once** (`allMetronomePlayers`); it used to
  reach only the Metronome, Rehearse and the test loop until the app was opened again.
A phone app wrapper (which can read the phone's real Bluetooth delay) was discussed and left until these have been
tried.
