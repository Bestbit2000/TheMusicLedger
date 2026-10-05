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
button back to its first step, Back goes back one step, and the dots beside "Extras: 2 of 5" are the steps of the
stage: the big one is where you are, and a step you've been to is a tap away (going on to a later one is checked
like Next). Decided with the owner on 4 Oct 2026 so that the
whole piece is made in Quick entry - it never opens the edit screen, so one piece is **one** timed session.

| Stage | Step | Asks | Kept as |
|---|---|---|---|
| About | `about` | Name (**required**), composer, arranger, publisher, notes | `outline.about` |
| Structure | `howLong` | Bars, a count-in bar (yes/no), the time signature, bpm and beat note most of it is in | `bars`, `leadIn`, `mainSig`, `mainBpm`, `mainNote` |
| | `marks` | Bar numbers (a typed list - spaces, commas, semicolons, full stops all separate; each mark is named after its bar), letters or words (a table: bar, mark), or none | `markKind`, `marks: [{ bar, label }]` |
| Tempo (was "Time and speed") | `time` | A table: from bar, the time signature (typed like `3/4`, or picked from the usual pop-up), then how long it lasts, asked two ways: **bars** and **to bar** - each fills in the other, and one of them is needed (ML-442; a row no longer "carries on to the next change"). After a row the piece is back in the main time until the next row; where rows overlap the later one wins (one 2/4 bar is one row). A typed time signature the app doesn't have is **added to the player's own list quietly** (ML-440: `outlineSigAdd`, 1-32 over 2/4/8/16 - the server checks the same); what can't be used is said per row and its box is marked (`aria-invalid`). ML-425 - it replaced tapping every bar | `outline.timeRows` → `time: { bar: sig }` (`outlineTimeApply`) |
| | `speed` | A table: from bar, bpm, beat note. A row's beat note carries on from the row above unless set. A row for bar 1 sets the starting speed (`mainBpm`) instead of being a change; a wholly blank row is ignored; a row that can't be used is named ("Row 3") | `speeds: [...]` |
| Extras | `xIntro` | Is there an intro? A **switch** (off to start with); on, its two boxes are on the step - from bar, to bar (empty = to the end). No pop-up: there is only ever one (owner, 5 Oct 2026) | `outline.intro { on, from, to }` → `extras` (`outlineIntroApply`) |
| | `xRepeats` | Are there any repeats? Yes: **a table** (ML-435) - from bar, to bar, times (2 if empty), and for 1st and 2nd time bars the bar the 1st ending starts at (the **last ending** fills itself in as the bar after the repeat - `sync` - and can be changed; played 3 or more times, the 1st ending is for every time but the last), i.e. the bar the 1st ending starts at and the bar the 2nd ending ends at | `outline.repeatRows` → `extras` (`outlineRowsApply`) |
| | `xPauses` | Are there any pauses or breaks? Yes: **a table** (ML-435) - in bar, on beat (1 if empty), beats held (2 if empty), Pause or Break | `outline.pauseRows` → `extras` |
| | `xRamps` | Does it speed up or slow down anywhere? | |
| | `xSigns` | Are there any signs or jumps? (D.S., D.C., Coda, Fine) | |
| Media | `media` | Anything to add to it? One step, three sections: MP3 / MP4 files, YouTube links, scores and parts - all optional | `outline.media.audio` / `.docs` (File objects), `.video` (`{ url, title }`) |

**The question steps (ML-448).** Extras and Media ask one question a step ("Are there any repeats?") with **no
Yes / No**: the answer is "no" until something is added, so Next just carries on, and the way to add one - the
table, "+ Add ...", the file picker or the link boxes - is on the step from the start, then "+ Add another". What
was added is taken out where it shows: an extra in its pop-up (Remove), a file or link by tapping its row, a table
row by emptying it. An extra that clashes is marked where it was added and stops Next; the last step's Save is off
while anything anywhere clashes.

**Getting about (ML-449).** One bar at the top with a piece per step (`#outlineBar`, `.step-bar`) and one line
("Tempo · step 4 of 11"); **Back** and **Next** side by side in a bar pinned to the bottom (`#outlineFoot`,
drawn by `renderOutline` - Save on the last step, off while anything clashes). Back goes one step and checks
nothing; Next checks the step (`outlineLeaveStep`). **Cancel**, under every step, asks and then throws the piece away
and leaves (leaving any other way keeps it, to be carried on with next time). The stage labels and the dots that jumped between steps are gone.

**Save** (the last Media step) does, in order: make the piece with its name, write the blocks (if that fails the
piece is taken away again), save composer / arranger / publisher / notes, put it on the practice list it was
made for, add the YouTube links, then upload each file (the button shows the progress) and attach it. From the
moment the blocks are written the piece is kept: anything after that which fails is named in one message ("saved,
but these couldn't be added...") and can be added from My music. Then it goes **back to where Add a piece was
opened from** (home, tools or My music).

**Timing.** One `create` session, source `quick`, with seconds / taps / keys / visits for each of the 11 steps
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

## Small things that save taps (5 Oct 2026)

- **The bars box starts empty with the cursor in it (ML-444).** `o.bars` is `null` until a number is typed; "e.g. 32"
  is only the box's hint. `outlineGoStep` puts the cursor there (not `renderOutline`, which also runs when a pop-up
  closes). Next asks for a number if it is left empty.
- **The beat note is its picture (ML-445).** The button on "How long" and the speed table's Start cell and row buttons
  show the note drawn (`metroNoteIconSvg`, the pop-up's own picture) with its name as the accessible name. A note not
  picked yet is shown as a crotchet - `outlineNoteKey` - which is what the bar editor shows for it too; what is saved
  is unchanged (`null` until picked). A speed row that carries on from the row above shows that row's note (`outlineSpeedRowNote`) - it no longer says "same".
- **Enter goes on into Notes (ML-446)** on "What is the piece?" - the Enter-moves-on handler counts a `textarea` as a
  place to land. Inside Notes, Enter is a new line.
- **The bpm pop-up opens like any other (ML-435, changed).** It used to open with the number already a box to type
  in, which put the slider and +/- a tap away. Now a number key pressed anywhere in the pop-up starts a new number
  (`flowBpmTypeAnywhere`, only for callers that pass `typeFirst`), and Enter takes it and closes the pop-up. On a
  phone the number is tapped to type, as in every other use of the pop-up.
- **Enter always moves on (ML-450).** In a table: along the row, then the next row; on the untouched last row it
  presses Next. Elsewhere on a step: to the next thing on it (a box, Notes, the count-in switch, a button), and Next
  when nothing comes after. On a button Enter presses it; the last step's Save is never pressed this way.
- **The count-in is a switch** (`#outlineLeadIn` in a `.display-toggle-row`, off to start with), not a Yes / No pair
  (owner, 5 Oct 2026: a yes/no on its own is the switch used elsewhere).
- **A time signature is tidied as it is typed:** two numbers with anything between them ("17 4", "17.4") become 17/4
  in the box.
- **Next says the step it goes to** ("Next: intro", "Next: recording") - no stage names, now there are no stages on
  screen.
- **Media is one step, the last** (`key: 'media'`; 11 steps in all, not 13): three sections - MP3 / MP4 files (MP3,
  M4A, WAV, MP4 - what the upload accepts), YouTube links (its two boxes show when "+ Add a YouTube link" is tapped,
  `outline.videoOpen`), Scores and parts - each with its rows and one "+" button (`OUTLINE_MEDIA`). Nothing has to be
  touched to save. It was three steps with a question each.
- **Later the same day (owner's review):** "Start again" became **Cancel** under every step; the time table's fixed
  row says "Rest of it" and its empty box "e.g. 3/4"; a speed row's beat note button shows the note it will play at
  (never "same"); a repeat's **last ending** fills itself in as the bar after the repeat (columns: 1st ending, Last
  ending); the **intro** is a switch with its two boxes on the step (no pop-up); the repeats and pauses boxes carry a
  faint hint each ("bar", "e.g. 2"); Pause / Break is picked from the usual pop-up (it was a button that flipped);
  the pauses and signs steps say what to look for, with the signs drawn (`OUTLINE_STEP_HINTS`); the ramps step is
  "speed changes" on Next and "+ Add a speed change".
