# Flow ⇄ MusicXML (ML-204)

One file format, one parser, for every way a Flow leaves or enters the app as notation:

| Use | Entry point | Gate (`features`) |
|---|---|---|
| Copy flows between environments (e.g. production → dev/sandbox for testing) | Admin panel → **Flows** (export / import, bulk, any owner) | super admin only |
| Create a flow from a `.musicxml`/`.mxl` file | Flow start screen → **Import from MusicXML** (`/api/flows/from-file`) | `flow_import_musicxml` |
| Create a flow from a PDF/scan | Same screen, shown as **Create from file** when this is on - OMR/AI turns the scan into MusicXML first (`scoreImport.js`'s `runOmr`), then the same parser | `flow_import_from_file` (off until the OMR dependency's security review) |
| Download one of your flows | Flow library ⋮ → **Export to MusicXML** (`GET /api/flows/:id/musicxml`) | `flow_export_musicxml` |
| Local dev | `scripts/seed-flow-fixtures.mjs`, `scripts/export-flow-musicxml.mjs` |

Code:

| File | What it does |
|---|---|
| `server/services/flowMusicXml.js` | `flowToMusicXml` - the writer. Pure, no DB. |
| `server/services/flowMusicXmlReader.js` | `musicXmlToFlow` - the reader. Pure, no DB. |
| `server/services/flowTransfer.js` | DB side: admin list, export (single file / `.zip`), import preview + commit |
| `server/services/scoreImport.js` | Create-from-file front end: `.mxl` unzipping, OMR for PDFs, time-signature id resolution |
| `server/test/` | `npm test` in `server/` - see "Tests" below |

## Why MusicXML (not a private JSON format)

Flows had to come *in* as MusicXML anyway (create-from-file, and PDF import via OMR/AI, which
produces MusicXML). Using the same format for environment-to-environment copies means there's
exactly one parser, and every improvement to it helps both jobs. MusicXML already has a standard
element for almost every Flow field; the few app-only settings travel in MusicXML's own extension
slots, which other software ignores - so an exported flow also opens meaningfully in MuseScore,
Sibelius, etc.

## What's in an exported file

Every bar is a gap - rests only, no pitches (a Flow is rhythm/structure, not notation). A bar is
one whole-bar rest, or one rest per beat when something (a fermata, caesura, or tempo ramp) needs
to sit on a specific beat. One part, one-line percussion staff.

### Standard MusicXML (source of truth for everything it can express)

| Flow field | MusicXML |
|---|---|
| title / composer / arranger | `<work-title>`, `<creator type="composer">`, `<creator type="arranger">` |
| time signature | `<time>` (only when it changes) |
| bpm + beat note (`noteValue`) | `<metronome>` showing the block's own "note = bpm" label + `<sound tempo>` (quarter notes/min) - see "Tempo" |
| pickup lead-in (`pickupBeats`) | first measure `implicit="yes"`, one rest per pickup beat |
| `isRepeatStart` | left `<barline>` `heavy-light` + `<repeat direction="forward"/>` |
| `isRepeatEnd` + `repeatPlayCount` | right `<barline>` `light-heavy` + `<repeat direction="backward" times="n"/>` (`times` written whenever set, even 2) |
| `repeatEndingNumbers` / `repeatEndingStartBar` | `<ending number="1, 3" type="start">` on the volta's first bar; `type="stop"` (ends in a repeat) or `"discontinue"` (last-time ending) on the block's last bar |
| `isSectionBoundary` / `isFine` | right barline `light-light` |
| `isFinalBarline` | right barline `light-heavy` |
| `rehearsalMarks` (bar offsets) | `<rehearsal>` on that bar |
| `isSegno` / `isCoda` | `<segno/>` / `<coda/>` on the block's first bar, with `<sound segno="segno">` / `<sound coda="coda">` |
| `gotoCoda` | words "To Coda" + `<sound tocoda="coda">` at the block's end |
| `gotoSegno` / `gotoSegnoThenCoda` | words "D.S." / "D.S. al Coda" + `<sound dalsegno="segno">` |
| `gotoStartDc` / `gotoStartDcThenCoda` | words "D.C." / "D.C. al Coda" + `<sound dacapo="yes">` |
| `isFine` | words "Fine" + `<sound fine="yes">` |
| fermata / caesura (bar + beat) | `<fermata>` / `<articulations><caesura/>` on that beat's rest |
| tempo ramps | words "accel." / "rit." + `<dashes type="start">` at the start beat; `<dashes type="stop">` + `<sound tempo>` (the target) at the end |

### Extension data (app-only - other software ignores it)

- **Whole flow:** `<identification><miscellaneous><miscellaneous-field name="musicledger:flow">`
  holding JSON: `formatVersion`, `publisher`, `description`, YouTube `recordings`, and
  `skippedMedia` (how many uploaded files weren't carried - see "Media").
- **Per block:** a hidden `<direction><direction-type><other-direction print-object="no">` on the
  block's first bar, text `musicledger:` + JSON. Its presence marks **where each block starts**
  (so re-import gives back identical blocks, even ones you split between identical bars). It
  carries only what standard MusicXML can't:
  `isLeadIn`, `repeatLeadIn`, `quietSecondsBeforeLeadIn`, `noteValueUnset`, intro start/end
  offsets, fermata `holdBeats`/`playbackMode`, ramp `endMode`/`targetMode`, legacy columns
  (`rehearsalMark`, `isFirstTimeBar`/`isSecondTimeBar`, the single legacy ramp), and raw offsets
  that are stale (past the end of a block that was shortened after they were set).

`formatVersion` is 1. A reader seeing a newer version imports what it understands and warns.

### Tempo

A block's stored `bpm` counts the **time signature's own denominator note** - the block editor's
displayed "note = bpm" label is a rescale of it by `noteValue` (`setMetroSegBpmFromDisplayed`,
`public/app.js`). So 6/8 at bpm 180 with a dotted-crotchet beat note displays "♩. = 60". The
writer prints exactly that label in `<metronome>`, and `<sound tempo>` (always quarter notes per
minute) is `bpm × 4 / denominator` = 90. The reader reverses it. (The pre-ML-204 parser read the
metronome number straight into `bpm`, which was wrong for any beat note other than the
denominator's.)

## Reading files

`musicXmlToFlow` picks its mode automatically:

- **Our own export** (block markers present): block boundaries from the markers, fields from the
  standard elements, app-only fields from the extension. **Lossless** - proven by the round-trip
  test for every fixture, and end-to-end on dev (file → DB → file is byte-identical).
- **Anything else** (notation apps, OMR/AI output, or one of our exports edited and re-saved in
  another program - which drops the extension): standard elements only. Bars are grouped into
  blocks wherever something structural starts or ends (time/tempo change, repeat, volta, sign,
  jump, rehearsal mark, double/final barline, the pickup), so identical bars in between become one
  multi-bar block. Handles the ways real files actually encode things:
  - jumps as `<words>` only (no `<sound>`), or `<sound>` only (no words);
    "D.S. al Fine"/"D.C. al Fine" stay plain D.S./D.C. (Fine is its own marker); a bare D.S./D.C.
    in a piece that also has a To Coda is read as "al Coda";
  - "To" + coda glyph; "Coda" words or glyph at a bar start as the coda landing;
  - "rit."/"rall."/"accel." with or without dashes; the target tempo from a `<sound tempo>` or
    `<metronome>` at the dashes' stop; "più/meno mosso" are immediate changes, not ramps;
  - markings on any part/staff (deduped - the same "rit." printed on every staff is one ramp);
  - chords, `<backup>`/`<forward>`, grace notes, different `<divisions>` per part;
  - composite time signatures ("3+3"), `per-minute` text like "c. 120";
  - a pickup bar before the first tempo marking takes that first tempo.

Things that can't be represented exactly are **reported as warnings**, never silently dropped:
a tempo change partway through a bar (applied from the next block), a repeat count outside 2-10,
a coda sign on a barline with no jump information, a speed change with nowhere to go, no tempo
marking at all (100 bpm).

## For every user

"For every action there should be a re-action": if you can import MusicXML, you can export it.

- **Import from MusicXML** (Flow start screen): one `.musicxml`/`.mxl` file → a new personal flow,
  the file itself attached to its Media. The start-screen label, help text, accepted file types
  and screen title follow whichever import gates are on (`applyFlowImportFormats`, `app.js`), so
  it never offers a format the server would refuse - and the server enforces the same split by
  file *content* (a PDF is detected by its `%PDF` header, not its name). Any reader warnings are
  listed on the result card under "Worth checking".
- **Export to MusicXML** (library ⋮ menu): **personal and band flows** only - not public library
  flows, the content most likely to be commercialised (`exportFlowForUser`, `flowTransfer.js`).
  Band flows get a ⋮ menu with just this item; Edit/Duplicate/Delete stay personal-only.
- Both gates are global on/off switches today (no per-plan gating exists yet). Each is checked in
  exactly one place server-side and one client-side - where a plan check would go if these are
  commercialised.
- Bulk (`.zip`) import/export stays on the admin page.

## Admin: Flows page

- **List:** every flow on the environment (any owner), filterable, with blocks/bars/media counts.
- **Export:** per row, or tick several → *Export selected*. One flow downloads as
  `<title>.musicxml`; several as `flows-<env>-<date>.zip` (one `.musicxml` per flow - not
  MusicXML's multi-score "opus" format, which almost nothing opens).
- **Import:** `.musicxml`, `.xml`, `.mxl`, or a `.zip` of any of those. Two steps:
  1. **Preview** - every flow parsed and every block validated with `validateSegmentPayload`
     (the same check every real save runs). Shows block/bar counts, warnings, errors, renamed
     titles, and skipped media. Nothing written.
  2. **Import** - re-validates, then writes. **All-or-nothing:** if any flow in the file has an
     error, nothing is imported; if a write fails partway, every flow already written by that
     import is deleted again.
- Imported flows are always the **importing admin's own private flow** (no band, not public).
  Publish or move to a band afterwards with the normal, reversible actions. A title that's
  already one of your flows gets " (imported)", " (imported 2)", ...
- The file goes up as the raw request body (limit 4MB - a flow is single-digit KB, so that's
  hundreds of flows), not via Blob storage.

### Media

YouTube links are carried. Uploaded mp3/mp4 recordings and PDF/MusicXML/Sibelius documents
(Vercel Blob) are **not** - copying them would mean duplicating the files or pointing another
environment at production's storage. The export records how many were skipped, and the import
preview says so.

## Tests (`npm test` in `server/`)

| File | Covers |
|---|---|
| `flowMusicXml.test.js` | Writer output, element by element; committed fixture files match a fresh render |
| `musicXmlSchema.test.js` | Every written file validates against the official MusicXML 4.0 XSD (`test/schema/`, via `xmllint-wasm`) |
| `flowMusicXmlRoundTrip.test.js` | Lossless write → read for every fixture, compared after `validateSegmentPayload` |
| `flowMusicXmlForeign.test.js` | Hand-written notation-app-style and OMR-style files, the demo score, and our own exports with the extension stripped |

Fixture flows (`server/test/fixtures/flowFixtures.js`) cover every block-editor option across
five flows (jumps are one-per-piece, so D.S. al Coda / D.S. al Fine / D.C. al Coda / D.C. al Fine
each get their own). `scripts/seed-flow-fixtures.mjs --account <id>` creates them on dev/sandbox
(refuses anything else); `scripts/export-flow-musicxml.mjs --fixtures` re-exports the committed
`.musicxml` copies after a deliberate writer change. `.gitattributes` keeps those files LF so the
byte-for-byte comparison survives `core.autocrlf`.
