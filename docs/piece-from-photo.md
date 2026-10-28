# A piece from a photo or PDF (ML-246)

Take a photo of a part (or make a PDF of it, in the app or outside it - Google Drive's scanner will do), and
the app reads the piece's **structure** from it: how many bars, the time signatures, speeds, rehearsal marks,
repeats, signs and pauses. That becomes a Quick entry outline, already filled in, with a **high / medium /
low** rating that says how much checking it needs. The aim is to halve entry time again: the member corrects
a draft and no longer types one.

**Where it stands (11 Oct 2026): built, and switched on for the owner alone.** The feature `piece_from_photo` is
Super admin only (Admin → Feature access), and stays so while he uses it on his own pieces to see what it
saves, what it costs and where it goes wrong. What has to happen before any member gets it is at the end.

- Rules (no screen, no server): [`public/pieceRead.js`](../public/pieceRead.js) - `normalise`, `fit`, `rate`,
  `compare`. Run on the server only; the browser does not load it.
- The call: [`server/services/pieceReader.js`](../server/services/pieceReader.js) - the prompt, the answer's
  shape, the limits. It stores nothing.
- For an account: [`server/services/pieceReads.js`](../server/services/pieceReads.js) - fetching and deleting
  the uploaded pages, the account's time signatures, the log, the test library. Routes `/api/piece-read*`
  (api.js) and `/api/admin/piece-reads*` (admin.js). Tables: migration `125_piece_from_photo.sql`.
- The screen: the "A PIECE FROM A PHOTO OR PDF" section of `public/app.js`; the admin page
  `public/admin-piece-reads.js`. Specs: `specs/components/add-piece.md`, `piece-outline.md`, `admin-shell.md`.
- Tests: `server/test/pieceRead.test.js` (no test calls a model).
- Trying it on real files: `scripts/piece-read-trial.mjs`.
- Who is depended on: the register entry `vercel-ai-gateway`.

## Why a model and not a music scanner

ML-246 began as "deploy the OMR service" (Audiveris behind solfascribe-omr, on a rented machine, for the old
"Create from file" PDF import). The owner asked for something he already uses instead. That import, the
service's register entry and its security review were removed by ML-543 (20 Oct 2026): this replaces it.

A piece here is rhythm and structure only: the reader throws the notes away. A music scanner spends minutes
working out every pitch, wants a flat 300 dpi scan, and needs a server of its own that has to be patched. A
vision model is asked only for what the app keeps, copes with a hurried phone photo, answers in about a
minute, and is reached through the Vercel account the app is already hosted on. Audiveris was kept in the
register at first as a fallback if the cost per piece turned out too high; the trial below showed it is not
one, and it left the register with the old PDF import (ML-543).

## The trial (10 Oct 2026)

Each PDF from the owner's test folder was given to a fresh reader that saw nothing else, and its answer was
compared with the piece as he had entered it by hand.

| Piece | Bars | Time signature changes | His rehearsal marks | Repeats |
|---|---|---|---|---|
| Mamma Mia | 145 of 145 | 2 of 2 | 13 of 13 | 3 of 3, with the 1st and 2nd time bars |
| Pirates of the Caribbean | 235 of 235 | 25 of 25 | 26 of 26 | none, correct |
| Shrek Dance Party | 98 of 100 | 2 of 2 | 9 of 9 | found, 2 bars out |

Four more had no answer to compare with, and the owner checked the hard parts himself: A Malvern Suite's third
movement (the sign on bar 2, "Play on D.S. only", To Coda, D.S. al Coda, the Coda printed twice) was read
right; Slaidburn's D.C. with no "Fine" printed was read as stopping at the pause over the heavy barline, which
is where its Fine is. These were hurried phone PDFs made at a band practice.

What it showed, and what the rules below are built on:

- **Where bar numbers are printed, the count holds.** The one miscount (Shrek) was in the lines after the last
  boxed number, and the reader had itself marked those lines as less sure.
- **Speeds are mostly not on the page.** Band parts print a word ("Allegro", "Disco") far more often than a
  number. The reader finds where the speed changes; the number is the member's to give.
- **Double barlines and pauses were hit and miss**, so double barlines are not asked for at all, and a pause is
  put in for the member to check.

### Which model (through the gateway, 10 Oct 2026)

The owner asked for the cheapest model that does the job. Nine were run on the three pieces that have
answers, with `scripts/piece-read-trial.mjs`. A model needs Vision, File input (PDF), Structured output and
zero data retention; 79 of the gateway's 415 had all four.

| Model | Price per million tokens, in / out | What happened |
|---|---|---|
| `anthropic/claude-opus-5.5` | $4 / $20 | Bars 145, 235, 98 (of 100); every bar's time signature right on all three; every rehearsal mark; Mamma Mia's 3 repeats. **About 14 cents a piece** (10 to 19), 35 to 75 seconds. |
| `anthropic/claude-sonnet-5.5` | $2 / $10 | As good as Opus where it finished, but it reasons at length: 20,000 tokens out on Shrek (21 cents, 160 s) and it ran out of room on Pirates even at 32,000. Dearer and slower than Opus here. |
| `google/gemini-3.1-pro-preview` | $2 / $12 | Shrek read as 110 bars; repeats wrong; ran out on Pirates. |
| `google/gemini-3.8-flash` | $0.75 / $3.75 | Mamma Mia's bars right, 1 of 3 repeats; ran out on the other two. |
| `openai/gpt-5` | $1.25 / $10 | Pirates read as 240 bars, 141 bars in the wrong time; 4 minutes. |
| `openai/gpt-5.4-mini` | $0.75 / $4.50 | Bar counts 1 or 2 out, time signatures wrong for 76 to 82 bars. |
| `anthropic/claude-haiku-5.5` | $0.10 / $0.50 | A fifth of a cent a piece, but bar counts out by up to 6 and time signatures wrong for up to 123 bars. Asking it to reason harder made no difference. |
| `google/gemini-3.5-flash-lite`, `openai/gpt-5-nano`, `openai/gpt-5.4-nano` | under $0.30 / $2.50 | Not usable: wrong time signatures, missed marks, or no answer. |

So the default stays `anthropic/claude-opus-5.5`. The cheap models are 20 to 70 times cheaper and get the
thing that matters - the count and the time signatures - wrong; a wrong draft costs the member more time than
it saves. Run the trial again when a new cheap model comes out: the script and the three answers make it a
ten-minute job. Every model also read boxed numbers the owner had not marked (35 and 129 in Mamma Mia; 11,
113, 171, 185 and 233 in Pirates), so those are on the page.

The trial changed two rules. Every model, including the right ones, said "a page is missing" when the final
barline was a few millimetres off the scan, and called its own doubts "low" on reads that were right - so
neither makes a read low any more (see the rating). And the prompt now gives a worked example of a repeat
with 1st and 2nd time bars, which Opus first read as ending on the 2nd ending.

### The whole folder, and Audiveris on the same files (10 Oct 2026)

**The model (Opus 5.5) on 23 PDFs, 26 pieces: $2.66, about 12 cents a file.** Against the 20 pieces the owner
had exported: the same bar count on 12, one bar different on 7, two on 1 (Shrek). Rehearsal marks agreed almost
everywhere. Its weak spot is a single bar in a different time (three missed in The Glory of the West, one each
in Wicked and The Greatest Showman). Some one-bar differences are the hand-entered piece's, not the read's
(The Wonderful World of Disney has its boxed "141" on bar 142); each needs a look at the page. Five reads were
rated High and three of those are among the one-bar differences - **until those are settled, High is not
proven.**

**Audiveris 5.11.0 on the same 20 PDFs, on the owner's PC** (the Windows console build with Tesseract's
English data; 30 to 95 seconds a piece, free). Its MusicXML was scored straight from the file, with every
multi-bar rest it marked opened out to its count - kinder than the old "Create from file" would have been, since the app's
reader (`flowMusicXmlReader.js`) does not open out `<multiple-rest>` at all:

- **No piece came out with the right bar count: 0 of 18**, and only one within two bars. 2 more would not
  export at all (Abba Silver, Wallace and Gromit). All but one were short - by 1 to 22 bars on the simple
  pieces, by 68 to 117 on the long ones (Wicked 140 of 257, Frozen 123 of 212, Disney 70 of 160).
- A band part is full of multi-bar rests, and their counts mostly did not survive: it marked some as multi-bar
  rests, but opening them out recovered only a few bars (The Glory of the West: 30 marked, 183 of 293 bars).
- Time signature changes: all found on 3 pieces of the 11 that have any (Pirates 22 of 25). It split one piece
  into two "movements" and three into 7 to 10 "parts".
- Rehearsal marks: some boxed numbers were in its output (5 of Mamma Mia's 13, 16 of Showman's 27), none or one
  on most. Repeats were its best side: right on 4 of the 7 pieces that have them.

So self-hosting Audiveris would cost nothing per piece and give a draft that is slower to mend than typing the
outline. It is a music scanner for full notation on clean scans; counting the bars of a part from a phone
photo is not what it is good at. **It is not a fallback for this job.** The cost of the model has to be
managed another way: one read per piece for a whole band, an allowance by account type, and trying each new
cheap model against these answers. Audiveris is unpacked at `C:\Users\andre\Audiveris-5.11.0` (not installed
system-wide; delete the folder to remove it).

### homr, and Opus thinking less (10 Oct 2026)

**homr 0.7.0** (open source, AGPL, made for phone photos; run on the owner's PC, each PDF page rendered at
200 dpi, about a minute a page without a graphics card). Scored the same generous way as Audiveris:

- **The right bar count on 2 of 19, within two bars on 4**; one piece lost a page (Wallace and Gromit). Closer
  than Audiveris on most - simple pieces were 0 to 7 out - but still 12 to 66 short on the long ones, and
  Pirates came out 21 over.
- **It gives nothing but the notes**: no rehearsal marks, no tempo words, no text of any kind in any output,
  and it missed the time signature changes on all but one of the pieces that have them (Pirates: 3/4 and 4/4
  where the piece also has 6/4, 5/4 and 2/4).

That is what its own description says it is for - pitch and rhythm - so it is not a fallback either. Both
tools are unpacked on the owner's PC in folders of their own (`C:\Users\andre\Audiveris-5.11.0`,
`C:\Users\andre\homr-test`); deleting the folders removes them.

**Opus 5.5 asked to reason less** (`PIECE_READER_EFFORT`, five pieces). "low" and "none" cut the answer by
about 40% - roughly 10 cents a piece, down from 15 - and lost accuracy where it is hardest: Pirates' time
signatures wrong for 2 to 10 bars, Wicked one bar over, Shrek's count changed. "medium" cost the same as
leaving it unset and was the only run with Mamma Mia, Pirates and Wicked all right in every bar. So
effort is left unset. A third off the price is not worth a draft that is wrong in the places that are slowest
to find.

### The owner's check of every difference, and the five rules it led to (11 Oct 2026)

The owner looked at the page for each of the eight pieces whose totals differed. The reader's total was right
once and wrong seven times: **six were a miscount on the final line** (bars of very different widths, and no
later printed number to catch it), and one came from following a misprinted boxed number (The Wonderful World
of Disney prints "141" on bar 142). Before the last line the reader was right more often than the hand-entered
pieces, which he corrected. Two of three reads rated High were wrong. Five rules followed:

1. **The last line is listed bar by bar** (`tail`: each bar and what is in it, a multi-bar rest as one entry),
   it has to agree with the line count (or the read is Low), and the last line is **always** named as a place
   to look, whatever the rating.
2. **No High without that list.**
3. **A printed number that disagrees with the count: the count is kept**, the mark keeps its printed label on
   the bar it really sits on, and the spot is Low (`numberClashes`, and worked out from the marks too). The
   exception is an edition that numbers differently throughout - Irish Tune from County Derry counts its pickup
   as bar 1 - where the printed numbering is followed.
4. **A bar with no set length** (Senza tempo, cadenza: `freeBars`) is listed for a hand count.
5. **Bar numbers at the end of a line** (`numbersAt`): Overture in D minor, a hand-copied part, prints each
   line's last bar number at the right.

**The folder again, against the corrected pieces: 17 of 20 totals right, from 13.** A Word on My Ear, Abba
Silver (with its mark 2), Frozen and Disney are now right, and Disney is rated Low with "141 is printed on
bar 142" as the reason. Still wrong: Shrek (98 of 100), O Still Small Voice (84 of 83) and Righteousness Peace
and Joy (74 of 75) - all three on the last line, where listing the bars did not help: the reader describes the
wrong number of bars with confidence (in O Still Small Voice it sees three bars where two busy ones are).
**The last two are still rated High.** So High does not vouch for the last line, which is why the last line is
always listed. Two reads also changed between runs with nothing changed on our side (Wallace and Gromit 122
then 123; Tristan's Zebra 93 then 92): a read is not exactly repeatable. Untried: sending the last line again
as a close-up, which needs the page as a picture and not a PDF.

## How a read works

1. **The pages go to the model** (`readPieceFromFiles`): one PDF, or up to 12 photos (JPEG, PNG, WebP), 24 MB
   in all. A file is known by its first bytes, never its name. The request asks for **zero data retention**,
   so it only goes to a provider that has agreed not to keep or train on it. The app stores neither the file
   nor the answer.
2. **The model answers in a fixed shape** (`READ_SCHEMA`). It counts the bars **line by line first**
   (`systems`: for each line, its first bar, how many bars, and whether a bar number is *printed* on it) and
   only then gives the total and the rest. Several pieces in one file, or several movements, come back as
   several pieces.
3. **The answer is checked** (`PieceRead.normalise`). It is somebody else's text: every bar number must be in
   the piece, every word is trimmed and cut short, an unknown sign or note is dropped. What was dropped is
   counted and lowers the rating. **Anything shown from it is escaped like member-typed text.**
4. **It is fitted to a Quick entry outline** (`PieceRead.fit`) - the same outline
   [`pieceOutline.js`](../public/pieceOutline.js) turns into blocks, so nothing downstream is new.
5. **It is rated** (`PieceRead.rate`).

### What `fit` does with each thing

| Read | Becomes |
|---|---|
| Time signatures | The one most bars are in is "most of it is in"; the rest are exceptions bar by bar. Keys are `3/4` strings and `sigs` lists them, for the caller to turn into the account's own (`public:<id>` / `custom:<id>`). |
| A printed speed | Used as it is, with its beat note. |
| A speed in pencil | Used, and listed as written in by hand. |
| A word and no number | A starting point from the word (`bpmForWords`: Allegro 132, Ballad 72... "Slower" and "Faster" work from the speed before, "Tempo I" goes back to the first), listed so the member knows it is a guess. No word that means anything: no change of speed is put in, and it is listed. |
| No speed at all | 100, listed. |
| Rehearsal marks | Bar numbers when every mark is its own bar number, otherwise letters or words. |
| Repeats and 1st / 2nd time bars, signs, pauses | The same extras Quick entry makes. A pause is held 2 beats. |
| rit., rall., accel. | Put in only when a new speed starts on the next bar ("to the next speed"); otherwise listed and left out, because the speed it reaches isn't printed. |
| "Play on D.S. only" and the like | Listed. The app plays those bars every time. |
| A pickup before bar 1 | Listed, not put in. |

**The outline always arrives ready to save.** Quick entry refuses to save a clash, so `fit` runs
`PieceOutline.buildBlocks`, takes out anything that clashes, and lists it ("Repeat bars 5 to 12 was read but
not put in...").

### The rating

Worked out from checks, **not taken on the model's word**. Each check is `{ level, kind, from, to, text }`;
the rating is the worst of them. A check at `info` (a speed to fill in) is listed and does not lower it: the
rating says how far to trust the bars and the order of play.

| Rating | When |
|---|---|
| **Low** | The lines don't add up: one doesn't start where the last stopped, or the last line doesn't end on the last bar; the last line listed bar by bar disagrees with the line count; a printed bar number is on the wrong bar. The reader's own doubts never make a read low. |
| **Medium** | No bar numbers printed at all; 8 or more bars after the last line with a printed number on it (`UNANCHORED_BARS` - where Shrek's miscount was); a line whose barlines were hard to see; an edge cut off; the final barline not seen or a page perhaps missing; anything the reader was unsure of; something read but left out; something dropped by the check. |
| **High** | None of those, with the last line listed bar by bar. The last line is still named as a place to look. |

A printed bar number proves the count up to that bar, which is why only the bars after the last one are
doubted.

## Settings

| Variable | For | Without it |
|---|---|---|
| `AI_GATEWAY_API_KEY` | The key the server calls the gateway with (Vercel → AI Gateway → API keys). On a developer's machine it goes in `server/.env`. | Reading says it isn't set up; nothing else is affected. |
| `PIECE_READER_MODEL` | Another model, to compare cost and accuracy on the same files. **Never one outside zero data retention** (the register entry names it). | `anthropic/claude-opus-5.5`. |
| `PIECE_READER_TIMEOUT_MS` | How long to wait for an answer. | 110 seconds. |

## Trying it

```bash
node --env-file=server/.env scripts/piece-read-trial.mjs "C:\path\to\Test cases"
```

Each file's pieces are printed with their rating and checks, the seconds and tokens it took, and - where
`<same name>.musicxml` sits beside the file (the piece's own export) - how the read compares: bars, each bar's
time signature, rehearsal marks, repeats, where the speed changes. `--json <folder>` keeps each answer; keep
that folder out of the repo.

## A piece in movements (ML-529)

The reader gives each movement of a work as a piece of its own (the prompt has said so since the start). Two things
follow from that, both in `pieceRead.js`:

- **A movement whose bar numbers carry on starts at bar 1** (`fromBarOne`, run by `normalise`). Its first line's
  first bar (the count line by line) says where it starts; every bar number is moved down, and a time signature given
  for a bar before that is the one in force at its first bar. Before this, movement 2 of a suite numbered from 87 came
  out as 150 bars, 86 of them empty 4/4. It is listed ("the bar numbers on the page start at 87...") and kept as
  `printedFrom`.
- **The movements of one work can be one piece** (`looksLikeOneWork`, `join`): two or more pieces with the same title
  (any case), named as movements (the first may have no name). `join` puts them end to end - the bar numbers carry on
  whatever the page did - with `movements: [{ bar, title }]`, and `fit` passes those to the outline. Where a
  movement's printed numbers carry on but don't meet the count of the movements before it, the count is kept and the
  spot is **Low** (rule 3 above). A movement with no speed printed at its start carries on at the speed before, and
  that is listed.

With the `piece_movements` feature, `readPieceFromFiles` also returns `whole` and `readForAccount` logs it as one more
piece found (the next `piece_index`), marked `whole: true`. Add a piece offers it **first** in the pop-up ("Iceni
Autumn, as one piece - with its 4 movements"), each movement on its own below it (owner, 19 Oct 2026). Choosing the
whole piece opens Quick entry with "It's in movements" on and the table filled in; choosing a movement offers the
other movements again after it is saved, as before. Reading again (Admin → Photo reads) reads a saved whole piece as
a whole piece. The letters stay as printed. A movement's own number printed with its name ("1) S.P.Q.R", "II.
Andante") is taken off it - the app numbers the movements itself. Tests: "a piece in movements (ML-529)" in
`server/test/pieceRead.test.js`.

**The first real one (19 Oct 2026): Iceni Autumn**, a 4-movement suite, one PDF. Opus 5.5, 58 seconds, 12,822 tokens
in and 7,027 out (about 19 cents). The four movements came back with their names; the printed numbers carry on (38,
145, 382) and met the count of the movements before them every time, so the whole piece - 442 bars, 1-37, 38-144,
145-381, 382-442 - was rated **High**, with the letters starting again at A in each movement, as printed. Movement 3
alone was Medium (its final barline was not seen).

## On the screen

**Add a piece → From a photo or PDF** (the third tile; it needs `piece_from_photo` and `piece_quick_entry`,
since it ends in Quick entry). The file chooser takes photos (JPEG, PNG, WebP - up to 12) or one PDF, 24 MB in
all; on a phone it offers the camera, the gallery and Google Drive, so no Drive permission is asked for. The
one-time "I have the right to upload it" (ML-278) comes first, as for any music.

1. The pages go from the browser to the file store, into `piece-read/<account>/` - a request to the server
   can't carry them (Vercel's ~4.5 MB cap). The tile's help line says how far it has got.
2. `POST /api/piece-read` fetches them (only from our own store, only from that account's folder), has them
   read, **deletes them** - also when the read is refused or fails before it starts (`discardReadFiles`); anything
   left in `piece-read/` (an upload that failed part way, a tab closed before the read) goes in the daily job after a
   day, and an account's folder is cleared when it is deleted (`sweepReadUploads`, ML-553) - turns the read's time
   signatures into the account's own (making one of the
   account's own where the shared list hasn't got it), logs the read, and answers with the outline and rating
   for each piece. A short piece takes 20 to 90 seconds and a long part a few minutes: the reader is given four
   and a half (`PIECE_READER_TIMEOUT_MS`, 270 seconds) and the server function five (`vercel.json`). It was 110
   seconds until the first long part on production timed out (ML-521); the tile now counts the time up, and a
   read that fails says so in a pop-up that stays.
3. One piece opens straight in Quick entry. Several (movements, or two pieces on one PDF) ask which first, and
   the rest are offered again after each save - the file is read, and paid for, once.
4. **Quick entry opens filled in** (`outlineOpenFromRead`): its tables' rows are set as if they had been
   typed, since that is what Quick entry works from. Every step has one button at the top - "Read from your
   PDF: Medium confidence · 2 things to check" - which opens the list of checks; tapping a check goes to the
   step it is about. A Low read's button is red.
5. **Save** is Quick entry's own. The stopwatch records the piece as `creation_source = 'photo'`, so Admin →
   Usage sets it beside Quick entry and bar by bar, release by release. Then `PUT /api/piece-read/:id/saved`
   puts the outline as saved in the log beside what was read.

**Waiting for the read** (ML-645, owner 28 Oct 2026): from the moment the files are chosen, a pop-up
(`#pieceReadWaitModal`, `specs/components/read-wait.md`) shows a turning ring, what it is doing ("Sending your PDF",
"Reading the music", "Taking a little longer than usual - still reading"), a bar - the upload's own % while sending,
then an estimate that holds at 95% - the time so far and how long reads like it usually take, the member's reads left
and when they start again, and **Cancel**. The estimate is `GET /api/piece-read/estimate` (`readEstimate`: the middle of
the last 5+ successful reads with the same model, prompt, kind and about the same size - photos by how many, a PDF by
its pages (counted as well as can be, `countPdfPages`) or else its size - and otherwise a starting guess). Each read
logs its `pages` and `estimate_ms` beside `ms`. **Cancel** while sending stops at once; while reading it asks ("Stop
reading?" - Keep waiting / Stop) and the answer, when it comes, is let go. **A read counts against the allowance only
when a result is returned** (the owner: even if it was paid for) - so a stopped read never counts: every stop goes in
`piece_read_stops` (`POST /api/piece-read/stop`, by the browser's `client_ref` for the read) and a read stopped while
reading is marked `cancelled_at`. **Admin → Photo reads** counts the stops this month, this quarter and in all, while
sending and while reading, how long people waited and what the stopped reads cost; each read shows its estimate.

Limits: 20 reads an hour per account (`CALL_LIMITS['piece-read']`), on top of the feature's gate, and **the
allowance** (built 21 Oct 2026, ready for the feature to be opened up): `photo_reads_per_quarter` on Admin →
Feature access, Limits - 0 for Standard, 30 for everyone else, Super admin included (the owner, 22 Oct 2026:
raise it there if testing needs more). The Add a piece tile shows the count for everyone - "Uses AI to import
the piece. 12 of 30 reads remaining which reset on 1 July" - and is disabled when none are left. A quarter is a calendar quarter in UK time (from 1 January, 1 April, 1 July,
1 October). Only a read that gave an answer counts (`piece_reads.status = 'read'`, not `cancelled_at`) - not a failed one, not one
the member stopped (ML-645), and not a "Read again" of a kept test. `readAllowance` / `assertReadLeft` in `pieceReads.js`: the upload token refuses
when none are left (before the pages go up), `POST /api/piece-read` refuses again, and
`GET /api/piece-read/allowance` lets the tile say so as soon as the files are chosen. Two reads at the same
moment can both pass the last one left - the hourly limit keeps that small.

## The log, and the test library

Every read is logged from the first one (owner, 11 Oct 2026), with no picture kept:

- `piece_reads` - one row per read: model, prompt version (`READ_VERSION`, which changes when the prompt or
  the answer's shape does), what kind of file, what the model charged for (`units_in` / `units_out`), how long
  it took. A read that failed is a row too.
- `piece_read_pieces` - one row per piece found: the checked read, the outline Quick entry was opened with,
  the rating and its checks; then, when it is saved, the piece, the outline as saved and **what differed**
  (`PieceRead.compare`: bar count, bars in a different time, marks, speeds, repeats, signs, pauses).

**"Keep this as a test"** is a switch on Quick entry's last step that only a super admin sees. On, the pages
are sent again when the piece is saved - to `piece-read-tests/<account>/` - and stay there. That is the test
library: a kept read can be **read again** later with whatever prompt and model are then in use
(`piece_read_reruns`), and the new read is compared with the piece as saved. It is what the folder of 20 was
for, growing from real use. A member can never keep a file: the upload token and the save both refuse it.

**Admin → Photo reads** (Release and checks) shows it all: reads, cost and seconds a read; *Is the rating
right?* - of the pieces saved, how many had the right number of bars and how many needed no change, for High,
Medium and Low; then every read with what was changed. **Mark as checked** says the saved piece has been
checked against the page (in the trial several differences were the hand-entered piece's, not the read's).
**Read again** re-reads a kept test (it costs about what the first read did). **Stop keeping the file** deletes
the pages and leaves the log.

The cost shown is an estimate at the model's list price (`PRICES` in `pieceReads.js`); Vercel's AI Gateway
page is the bill.

## Before any member can use it

- **The owner's own testing** (11 Oct 2026): more pieces, to see the time saved against Quick entry and what
  the rating is worth. The last line is still where it goes wrong, and High does not vouch for it.
- Done 21 Oct 2026: **the privacy policy** names it, in the owner's words ("Vercel AI Gateway" under "Who
  helps us run it"); **the allowance** above; **a budget** of $20 a month on AI Gateway (Vercel emails at 75%
  and 100%), and the meter "Photo reads, in dollars" on Admin → Costs and usage, added up from the log;
  `AI_GATEWAY_API_KEY` is on Production, Preview and Preview (sandbox) (since 11 Oct 2026).
- **Young players**: Anthropic's Usage Policy asks a product that lets minors reach its models to follow its
  guidelines for products serving minors. Read them, and check the Children's Code self-assessment, before
  the feature is opened to an account type a young player may have.
- **Account deletion**: the log's rows go with the account (they hang off `piece_reads.account_id`). A kept
  test's pages in the file store do not - today only a super admin can keep one. If that ever widens, deletion
  has to remove them (`docs/account-deletion.md`).
- **A back-test** for the screen (it needs a stand-in for the read, which costs money and takes a minute).
- The Online Safety and "members need telling" questions for the release that opens it up - the policy
  changing is itself a reason to tell members, once they can use it.
- Decided (ML-543, 20 Oct 2026): the old "Create from file" PDF import was removed rather than pointed at
  this, and the OMR service's register entry and security review went with it.
