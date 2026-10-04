# Quick piece entry (ML-424)

Entering a piece block by block took 8 to 15 minutes: every block needs its length worked out by subtraction
from the bar numbers on the music. **Quick entry** asks for the piece as an **outline** instead - by the bar
numbers as printed - and cuts the blocks itself. It makes exactly what "Create your own" makes, so playback,
practice Levels, MusicXML export and "go back to a mark" are untouched. New pieces only: a piece is changed
afterwards in the bar-by-bar editor, which is the precision tool.

- Rules (no screen, no server): [`public/pieceOutline.js`](../public/pieceOutline.js), tests
  `server/test/pieceOutline.test.js`.
- Screens: the QUICK PIECE ENTRY section of `public/app.js`; `#pieceOutlineView` and `#outlineExtraModal` in
  `index.html`; spec [`specs/components/piece-outline.md`](../specs/components/piece-outline.md).
- Feature: `piece_quick_entry` (Super admin only until switched on - Admin → Feature access). The way in is the
  **Quick entry** tile on Add a piece.

## The five stages (ML-428)

Five stages show across the top; each has one or more steps inside it ("Extras: 2 of 5"). A finished stage is a
button back to its first step, and Back goes back one step. Decided with the owner on 4 Oct 2026 so that the
whole piece is made in Quick entry - it never opens the edit screen, so one piece is **one** timed session.

| Stage | Step | Asks | Kept as |
|---|---|---|---|
| About | `about` | Name (**required**), composer, arranger, publisher, notes | `outline.about` |
| Structure | `howLong` | Bars, a count-in bar (yes/no), the time signature, bpm and beat note most of it is in | `bars`, `leadIn`, `mainSig`, `mainBpm`, `mainNote` |
| | `marks` | Bar numbers (a typed list - spaces, commas, semicolons, full stops all separate; each mark is named after its bar), letters or words (a table: bar, mark), or none | `markKind`, `marks: [{ bar, label }]` |
| Time and speed | `time` | The bars that aren't the main time signature - tap a bar, or a first and a last bar; "All of this section" | `time: { bar: sig }` |
| | `speed` | A table: from bar, bpm, beat note. A row's beat note carries on from the row above unless set. A row for bar 1 sets the starting speed (`mainBpm`) instead of being a change; a wholly blank row is ignored; a row that can't be used is named ("Row 3") | `speeds: [...]` |
| Extras | `xIntro` | Is there an intro? (one at most) | `extras: [...]` |
| | `xRepeats` | Are there any repeats? (plain, or with 1st and 2nd endings) | |
| | `xPauses` | Are there any pauses or breaks? | |
| | `xRamps` | Does it speed up or slow down anywhere? | |
| | `xSigns` | Are there any signs or jumps? (D.S., D.C., Coda, Fine) | |
| Media | `mAudio` | Is there a recording to add? (mp3 / mp4 files) | `outline.media.audio` (File objects) |
| | `mVideo` | Is there a YouTube link to add? | `outline.media.video` (`{ url, title }`) |
| | `mDocs` | Is there a score or part to add? (PDF, MusicXML, Sibelius, MuseScore) | `outline.media.docs` (File objects) |

**The yes/no steps.** **No** moves straight on. **Yes** opens the way to add one at once (the extra's pop-up, the
file picker, or the link boxes) and then offers "+ Add another". Anything already added counts as Yes; answering
No after adding asks before taking them out. An extra that clashes is marked where it was added and stops Next;
the last step's Save is off while anything anywhere clashes.

**Save** (the last Media step) does, in order: make the piece with its name, write the blocks (if that fails the
piece is taken away again), save composer / arranger / publisher / notes, put it on the practice list it was
made for, add the YouTube links, then upload each file (the button shows the progress) and attach it. From the
moment the blocks are written the piece is kept: anything after that which fails is named in one message ("saved,
but these couldn't be added...") and can be added from My music. Then it goes **back to where Add a piece was
opened from** (home, tools or My music).

**Timing.** One `create` session, source `quick`, with seconds / taps / keys / visits for each of the 13 steps
(`QUICK_STEPS` in `server/services/flowAuthoringStats.js`; `extras` there is the single Extras step that pieces
made on 0.39 recorded). Admin → Usage shows them stage by stage.

A time signature is the same `public:<id>` / `custom:<id>` string the shared time signature pop-up hands back.

## How the outline becomes blocks (`PieceOutline.buildBlocks`)

A new block starts at bar 1 and at every:

- rehearsal mark (so there is never more than one mark in a block, and you can go back to any of them);
- bar whose time signature differs from the bar before;
- bar with a speed row;
- first bar of a repeat, and the bar after its last (and after a 2nd ending);
- segno or coda (they sit at the start of a block), and the bar after a jump or Fine (they sit at the end).

Each block takes its time signature, speed and beat note from its first bar, and its rehearsal mark if it starts
on one. A count-in is a lead-in block of one bar in bar 1's time and speed. Then the extras are laid on:

- **Repeat:** start on the block that begins it, end and "times played" on the block that finishes it.
- **Endings:** the 1st ending starts part-way through the repeat's last block ("from bar N",
  `repeatEndingStartBar`) for passes 1 to times-1; the block(s) after it up to the 2nd ending's last bar are for
  the final pass. If something else already splits the 1st ending's bars, it starts a block of its own.
- **Pause:** a fermata or a caesura on its block, at the bar and beat given. How a held pause sounds (tone, silent,
  count through) isn't asked: it is each player's own playback setting, and playback ignores the value stored on the pause.
- **Speed up or slow down:** a ramp on its block, from a bar and beat to the end of a bar, reaching a typed bpm or
  **the next speed** - the same choices as the bar editor (`targetMode` `custom` / `next_block`, `endMode`
  `specific` / `block_end`). "To the next speed" has to end on the block's last bar.
- **Sign and jump:** segno, coda, To Coda, D.S., D.S. al Coda, D.C., D.C. al Coda, Fine.
- **Intro:** from a bar, to a bar (or to the end of the piece).

Checked against three pieces entered by hand on production (Pirates of the Caribbean, Shrek Dance Party, Mamma
Mia): the same block starts, less the few hand-made splits that had no mark and no change.

## Clashes

An extra that can't be made as asked - bars that aren't in the piece, an ending outside its repeat, a speed-up
that runs past the next rehearsal mark or change, "to the next speed" that stops short, two repeats on the same
bar - is a **clash**: its row is red with the bar editor's warning triangle and the reason, and **Save is off
until it's fixed** (owner, 4 Oct 2026). The bar editor's own check (`FlowJourney.checkFlow`, ML-248) is run on
the blocks too; an error there blocks Save the same way.

## Saving

`PUT /api/flows/:id/blocks/all` replaces the new piece's bars with the blocks sent, one request, each made by the
same `createFlowBlock` as ever. The piece is made first (in the band / on the practice list chosen on Add a
piece); if its bars can't be saved it is taken away again. Then its details open, as after "Create your own", so
it can be named.

## Measuring it (so it can keep getting faster)

The ML-199 stopwatch (`flow_authoring_sessions`, Admin → Usage → Flow authoring time) now records, for **both**
ways of entering a piece, **taps** and **keys** as well as active time, and tags a quick-entry create as
`creation_source = 'quick'`. Quick entry also stores, per step, the seconds, taps, keys and visits (`steps`), and
what the piece held (`outline_counts`: marks, exceptions, speeds, extras). The report shows "Bar by bar against
quick entry" (median time, taps, keys, seconds per bar) and "Quick entry, step by step" - the step with the most
seconds or taps is the next thing to speed up. After saving, the toast says how long it took and how many taps.
