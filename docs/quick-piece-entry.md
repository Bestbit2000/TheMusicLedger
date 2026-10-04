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

## The five steps

| Step | Asks | Stored in the outline as |
|---|---|---|
| How long | Bars, a count-in bar (yes/no), the time signature, bpm and beat note most of it is in | `bars`, `leadIn`, `mainSig`, `mainBpm`, `mainNote` |
| Marks | Bar numbers (a typed list - spaces, commas, semicolons, full stops all separate; each mark is named after its bar), letters or words (a table: bar, mark), or none | `markKind`, `marks: [{ bar, label }]` |
| Time | The bars that aren't the main time signature - tap a bar, or a first and a last bar; "All of this section" | `time: { bar: sig }` |
| Speed | A table: from bar, bpm, beat note. A row's beat note carries on from the row above unless set | `speeds: [{ bar, bpm, noteValue }]` |
| Extras | Repeat; repeat with 1st and 2nd endings; pause; speed up or slow down; sign and jump; intro | `extras: [...]` |

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
- **Pause:** a fermata (tone or silent) or a caesura on its block, at the bar and beat given.
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
