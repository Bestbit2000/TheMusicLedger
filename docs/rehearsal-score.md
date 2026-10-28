# The rehearsal score (ML-312, ML-488, ML-489)

Built 7-8 October 2026. **Not released, and all three features are Super admin only** until switched on
(Admin → Feature access). The plan it was built from, with the owner's decisions, is
[`ml312-rehearsal-recordings-plan.md`](ml312-rehearsal-recordings-plan.md).

## What it is for

The metronome gets a player able to play the notes; then they have to play with others. Practising with
a recording of the band, or a YouTube video, does that - but finding the bit you want and dragging the
slider back to it over and over is a pain. The rehearsal score maps the piece's bars onto the recording,
so a player chooses bars and that part repeats.

Three parts, three features:

| Part | Ticket | Feature | What |
|---|---|---|---|
| A | ML-312 | `recording_clip` | A recording or video on a piece has a start and an end |
| C | ML-488 | `rehearsal_score` | The bars are mapped onto it: repeat bars, start from a bar, play slower |
| B | ML-489 | `rehearsal_recordings` | The Recordings tool: a whole rehearsal uploaded once and given to pieces |

## The rule everything rests on

**The sound file is never changed.** Where things are in it is kept as numbers beside it:

- a **cut** is two numbers - where the piece starts and ends (`score_recordings.clip_start_ms`,
  `clip_end_ms`; empty = the very start / the very end);
- a **mark** is one number - where a bar begins (`score_recording_marks`).

So a cut can always be corrected, one file can serve several pieces, nothing is processed on the server,
and a YouTube video - where there is no file at all - works exactly the same way.

**The app does not record** (the owner, 7 Oct 2026). A rehearsal is recorded on the phone's own recorder
and the file uploaded. The privacy policy's line that microphone sound is never sent or stored stays true.

## A: start and end (ML-312)

- **Where:** a piece's Media tab. Each recording and video has a value box, "start and end", showing
  "0:12 to 3:40" / "From 0:12" / "Up to 3:40" / "All of it". It opens `#clipModal`.
- **The pop-up:** the player, **Starts here** and **Ends here** (the mark goes where the player is now),
  a one-second nudge either way on each, **Play from the start mark**, **Use all of it**, Done. Its player
  is made when it opens and taken away when it closes, however it closes (ML-487's lesson).
- **Saving:** in Edit it is kept until Save, like everything else on that screen (`saveFlowMediaEdits`
  sends it); a new piece being made saves it at once.
- **Keeping to it:** the play screen's `<audio>` goes to the start when Play is pressed outside the clip
  and stops at the end (`keepPlayerToClip`). A YouTube frame is told by `start=` and `end=` on its
  address (whole seconds: start rounded down, end rounded up). The editor's own preview does the same
  (an upload by the standard `#t=start,end`).
- **The rules** are in `public/flowJourney.js` and run on the server too: `cleanClip` (a clip that makes
  no sense is refused with a reason, never mended), `nudgeClip`, `clipLabel`, `clockText`, `clipAction`.
  Tests: `server/test/recordingClip.test.js`.
- **Server:** `PUT /api/flows/:id/recordings/:recordingId/clip` `{ startMs, endMs }`; the two add-recording
  calls take `clipStartMs` / `clipEndMs`.

## C: the bars mapped onto a recording (ML-488)

### On the play screen: playing along (ML-627)

Designed with the owner on 28 Oct 2026 (Claude Design canvas "Play flow: clicks with the video"). Until then the
play screen was a swipeable carousel (ML-166): the metronome and each recording were slides, with a row of icons
above them, and only one could play at a time. Members wanted the clicks and the recording together, so:

- **The card** holds the bar line, the recording or video being played along to (`#flowAlongHost`, under the bar
  line) and the beat dots, full size with room for the pauses above them. A video stays in full view and
  uncovered - YouTube's terms - so it is never shrunk to a strip or covered by the dots.
- **Four buttons, all the same size: repeat | playback | reset | play** - the two settings, then the two actions.
  They work for the recording as for the metronome; the recording has no boxes of its own any more.
  - **repeat** - the piece's own repeat-bars setting (ML-302). With it on, the recording plays those bars and goes
    round again; the clicks join it at the start each time.
  - **playback** shows the play speed; its pop-up (`#flowSubdivideModal`, "Playback") has the speeds as boxes - the
    app's one list (Admin → Playback speeds, ML-596) - and today's sub beats controls (Off / Auto / Fixed and the
    − 2 + card). Every choice applies straight away, so it has Done, not Cancel and Save. **It is the recording's
    play speed too** (ML-599), at the same pitch: an upload plays at any speed on the list; a YouTube video only at
    its own speeds (`getAvailablePlaybackRates` - usually 25% to 200% in 25s), so it plays the nearest of them -
    70% is 75% on a video, and the clicks follow the video. That holds in a practice too: a Level's speed with a
    video is YouTube's nearest (65% plays at 75%) - the owner, 28 Oct 2026; an upload plays the Level's exact speed. In a practice the button is the practice's own Playback
    (the Level or a Custom speed, sub beats, the count-in - ML-587/588) and the buttons are reset, playback, play,
    finish.
  - **reset** takes the recording back to the first bar (the repeat's first, when repeating) as well.
  - **play** starts the recording where the metronome is (the repeat's start when repeating); the clicks join it
    once it is playing. In a practice the practice's count-in comes first (ML-587). Pause stops both.
- **The cog** at the top right of the card (where the speaker used to be) opens **What to see and hear**
  (`#flowSeeHearModal`):
  - **See the metronome** and **Hear the clicks**, each on its own - hear it and not see it, or the other way round.
  - **Recordings** - "Play along to the video / recording" (a switch, with its name) when the piece has one; "Play
    along to a recording" and then the list when it has more than one; "No recordings or videos for this piece" when
    it has none, with **Add a recording or video** (to the piece's Edit → Media tab) for whoever can change the piece.
  - **Volume**, last - today's volume controls, for everything on the screen: the clicks and the recording together.
    Mute mutes both. "Hear the clicks" is the clicks alone.
  - **Never an empty screen**: with nothing playing along, the last of See / Hear still on is locked on (greyed,
    with "Stays on while there's nothing to hear / see"). With a recording playing along both may be off. Switching
    play-along off with both off turns See the metronome back on.
- **What the piece has** - its videos and recordings as small icons ("×2" for more than one) at the end of its
  time-and-bars line (`.flow-media-have`), read only - choosing is the cog (the owner, 28 Oct 2026). No dot and no
  one-off message (the owner).
- **Each member's choices are remembered per piece** - see, hear, play along and which recording - in
  `piece_play_settings` (the server, so they follow to other devices; `PUT /api/flows/:id/play-settings`, private to
  the member) and in `tml.pieceView` on the device (offline - the write is a quiet one, `public/offline.js`; the
  newer of the two wins). **No choice yet: the metronome seen and heard, and the piece's first YouTube video playing
  along when it has one** (the owner, 28 Oct 2026) - that is what shows people a piece has a video. A remembered
  recording that has gone (or isn't offered for the movement chosen) falls back to that video. The volume is not kept.

**How the clicks follow the recording** (`alongJoin` / `alongOnBeat`, app.js). The recording leads. Each bar plays
at the speed the recording takes it - the piece's speed for the bar times how long the bar should last over how long it
lasts on the recording - so between two marks the clicks keep pace by themselves. At each bar's first click the screen
works out where the recording was when that click sounded; further out than 70 ms for an upload or 140 ms for a video,
twice running (or 400 ms once), the clicks join it again: at its next beat - the place it is at on the map
(`FlowJourney.recordingMap`), the click in that bar - after exactly the wait that lands that click on time. They join
the same way when the recording starts by itself (its own Play or slider, going again after loading, a new speed).

**Every start the app makes is led by the clicks (ML-640).** A recording says it is playing a while after it has
started: a loaded YouTube video starts 40-70 ms after it is told to (or after it is moved while playing) and only says
so 260-300 ms after (measured on 28 Oct 2026). Joining the clicks to it once it said so lost the bar's first beat
whenever there was nothing before the bar to start it early on - bar 1 at 0:00, as for a recording with nothing marked
- and the first circle never lit, after a count-in or without one (the owner, sandbox). So Play, a bar tile, Reset, the
end of a count-in or a rest, a practice's count-in and the next go round a repeat with no rest bars all put the bar's
first click at a set time on the metronome's clock (`playAt`), and set the recording going - loaded and waiting at the
bar, or up to 0.4 s before it when it has that (`ALONG_START_LEAD_MS`, never before its start mark) - so that it
reaches the bar at that moment (`alongStartAt`). The clicks never wait to be told it is playing. Loading first
(`alongPrepare`): a video not played yet only loads when it plays, so it is played silently and paused as soon as it is
going (also one moved far from where it is); one that has played is paused and moved; an upload is moved. How long the
recording takes to get going is learnt as it goes (`alongLag`, starting at 60 ms for a video, 30 for an upload). Once
its clock moves, the start is checked (`alongWatchStart`): out by more than half the drift allowance, the clicks are
re-timed from their next beat. A click once sounded is never sounded again (`alongHeard`) - not when the recording
stops to load and goes again, nor when the clicks are re-timed - unless the recording has been moved back before it.
While a start is made, and until the recording reaches the bar it waits a little before (often in the block before),
the tile of the bar started at stays lit and the bar line says it straight away (`alongHoldTile`, ML-641) - lighting
the block before looked as if the tap had missed (the owner, 28 Oct 2026).
Measured on dev (28 Oct 2026), every first click and the recording within 40 ms, every click heard: after the
count-in, with no count-in, a tile, Reset, a practice's count-in, each go round with and without rest bars, and with
bar 1 at 0:00 and marked.

**A repeat's rest bars** (between goes, and the count-in before the first) aren't on the recording: while they click -
as rest bars, on the metronome's own clock, at the speed the recording comes back in at - the recording waits at the
repeat's start, paused, and as the rest ends it is set going to meet the repeat's first click, so the go's number carries
on (`alongRestBegin` / `alongRestBeat`, ML-634). A video not played yet is loaded silently during the count-in
(ML-637). With no rest bars, on a go's last click the recording is moved back to the repeat's first bar to meet the next
go's first click (`alongGoRound`). The count-in and every rest count down in the bar line ("Count-in **3** get ready",
`showFlowBarCount`, ML-638) - nothing may cover a YouTube video (its terms), and the beats and buttons stay in view
(the owner, 28 Oct 2026); a practice's own count-in before a recording does the same. Not with a practice's count-in
every time round, which has its own (ML-587). A fermata held on a bar's first beat repeats that beat for each beat of the hold - not a new bar,
so it is never checked. When the clicks join again because they got ahead (a pause the band held longer than written),
they never go back over a beat already heard - they wait, silent, for the recording to reach the next one; in a bar with
a pause they join at the next bar line (its beats aren't evenly spaced). Pausing or joining again takes back any click
already queued (`cancelPendingBlips`), so nothing from the old timing sounds beside the new. YouTube only reports its time every so often, so between reports the time is carried on
by the clock (`ytSmoothMs`). The clicks and the recording come out of the same speakers, so the headphone delay
(Settings) needs no correction between them. **A recording with nothing marked** - no start mark and no marked bar
(`alongMapped`) - **is taken to start bar 1 at 0:00 and to keep to the piece's own speeds** (the owner, 28 Oct 2026), so
the clicks play at once; nothing is saved on the piece. One line under it says "Timing of the video still to be
confirmed" ("recording" for an upload; `#flowAlongHint`, `renderFlowAlongHint`) - for whoever can change the piece the
line is itself the link to Edit → Media (`.flow-along-hint-link`), for anyone else plain help text; nobody needs telling
it starts at the start (the owner, ML-635). It goes once a start or a bar is marked, and when the metronome is neither
seen nor heard. Marking stays on Edit → Media (ML-597). Nothing listens to the sound.

Unchanged from ML-488:

- **No "bars marked" on the play screen (ML-597, owner 23 Oct 2026).** Marking the bars, and matching the piece's
  speeds to them, is set up on the piece's **Edit → Media** tab only. See "Marking" below.
- **Gone from the play screen with ML-627:** the line saying which bar the recording is on (the bar line says it) and
  the "how long it takes" line (ML-598) - the stretches are still shown when marking on the Media tab.
- Tapping a **bar tile** while playing along starts the recording at that bar, and the clicks join it there.
- **The bar tiles light up** for where the recording is while it plays (`flowActiveTileBlockId`), otherwise where the
  metronome is.
- **The playing tile is kept at the top** - for a recording and for the metronome alike. Where you are and
  the controls (`.play-side`) stay pinned under the top bar, on a phone as on a wide screen (not on a screen
  under 600px tall), and when the lit tile changes while something is playing the tiles scroll so its row
  is the first one under them (`flowKeepLitTileInView`; `--play-pin-h` is the top bar's height plus the pinned part's). Only
  while playing, so looking around the piece is never undone; pressing Play brings it back. Smooth unless
  the device asks for less motion.
- **Rest bars are for the metronome only.** With the clicks seen or heard, the recording waits for them (ML-634, above);
  with neither, a repeat on a recording goes straight round.

### Who can map a piece (the owner, 8 Oct 2026)

- **Your own piece:** you.
- **A band's piece:** the band's organisers, and anyone an organiser has let change the band's music (the
  "change music" level a member is given when invited, or later). A member who can only play cannot. This
  is `assertFlowAccess` - the same rule as changing the piece's bars - so the band keeps control through
  who it gives that level to.

### How the map is worked out

`FlowJourney.recordingMap(blocks, { leadIn }, marks, clip)`. Nothing listens to the sound.

- A **place** is a bar's position in the order the piece is played, counted from 0, the lead-in bar left
  out (it is the metronome's count-in). A bar inside a repeat has two places - which is why a mark is on a
  place and not just a bar number.
- The piece says how long each bar should last (`barSeconds`: its speed, changes of speed, pauses).
- **Fixed points:** the recording's start mark is where bar 1 begins (for a recording of one movement, ML-531, that movement's first bar); its end mark, if set, is where the
  last bar ends; each mark pins its bar. A mark on bar 1 wins over the start mark.
- **Between** two fixed points the bars share the time in proportion to their own lengths, so a slow bar
  stays longer than a fast one.
- **Beyond** the first and last fixed point the bars run at the piece's speeds, scaled by how far out the
  nearest stretch was - a band that is 10% slow is assumed to carry on 10% slow.
- With nothing marked at all, bar 1 is at the start mark and everything follows the piece's own speeds.

`placeAt(map, ms)` is the bar playing at a time. `mapLoop(map, startBar, endBar, leadMs)` is the stretch
of recording that a repeat is, by the same rule as `loopPlan` (from the first time the start bar plays to
the next time the end bar plays). It starts 0.4 seconds early, never earlier than the bar before, so a map
that is a touch out still catches the first note. **Rest bars aren't on a recording** - the clicks play them while it
waits (ML-634).

### Marking

**Start, bars and end** (`#barMapModal`, ML-597 - it was "Mark the bars" on the play screen plus a separate start-and-end
pop-up): one pop-up, opened from a recording's **start, bars and end** value box on the piece's **Edit → Media** tab
(the box shows "0:12 to 4:05 · 6 bars marked"). Its own player; **Starts here** (with a second's nudge either way); a bar
to mark (Bar before / Next bar, or type a bar number) - **This is bar N** puts the mark where the player is and steps on
to the next bar, so tapping along bar by bar marks a run of them; **Ends here**; then **How long it takes** (ML-598).
A mark that would make the recording run backwards is refused, saying which mark it clashes with. **Done** keeps the
start, the end and the whole list of marks - **in Edit, until Save**, like everything else on that screen (the marks are
saved after the bars, `saveFlowMarkEdits`, keeping only the ones that still fit them); a new piece being made saves them
at once. The Recordings tool still uses the start-and-end pop-up on its own (`openClipPopup`).

**How long it takes (ML-598, owner 23 Oct 2026):** `FlowJourney.recordingStretches` - the recording split at its fixed
points (the start mark, each usable mark, the end mark; with only a start and an end it is one stretch), each with how
long it lasts on the recording and at the piece's own speeds. Shown in the pop-up and under the recording on the Media
tab, one line a stretch, and on the play screen for the stretch it's in. With no end mark the bars after the last fixed
point aren't measured. Tests: "how long each stretch of a recording takes" in `server/test/rehearsalScore.test.js`.

`usableMarks` drops a mark the map can't use: outside the piece, at a time that isn't a time, out of
order, or made on a bar that is no longer the same bar (each mark remembers its bar number and which time
through, so changing the piece's bars later drops the marks it has moved under - it never misuses them).
The server runs the same check and refuses a list it would have to drop from.

- **Server:** `PUT /api/flows/:id/recordings/:recordingId/marks` `{ marks: [{ place, number, pass, atMs }] }`,
  for whoever can change the piece (`assertFlowAccess`). Marks come back on each recording in the piece's detail.
- **Tests:** `server/test/rehearsalScore.test.js` (22: places, repeats, stretching, extrapolating, marks
  dropped, the bar playing, repeat ranges).

### Known limits

- **A stop-and-go take does not match the piece.** If the conductor stops at bar 40 and goes back to 33,
  the recording is off from there. Map a run-through, and end the cut where the band stops.
- **YouTube lands within about half a second**, and plays its own adverts.

## A recording of one movement (ML-531)

A piece in movements (ML-529) can have a recording of just **one** of its movements - a concert recording of
movement 2, or a cut of a whole rehearsal that covers one movement. `score_recordings.movement_number` (migration
133; NULL = the whole piece) - the movement's number, so editing the piece moves it with the music, and a number the
piece no longer has reads as the whole piece.

- **The map:** `journeyPlaces(blocks, { movement })` is that movement's journey (`movementJourney`), so place 0 - and
  so the recording's start mark - is **the movement's first bar**, and its marks are its own places. `recordingMap`,
  `placeAt` and `mapLoop` work unchanged; repeat bars in another movement are simply not in it.
- **Setting it:** a piece's Media tab gives each recording a **movement** value box next to start and end, for a
  piece in movements only (the whole piece, or a movement - one pop-up). Kept until Save in Edit, like the clip
  (`saveFlowMediaEdits`). `PUT /api/flows/:id/recordings/:recordingId/movement` `{ movement }`; the add calls take
  `movementNumber`. **Changing it takes the recording's bar marks off**: they were counted from the old first bar.
  The pop-up says so when there are any.
- **The Recordings tool:** "Give it to a piece" asks **which movement** between the piece and its start and end, for a
  piece in movements; a piece can take a recording once for the whole piece and once per movement. A cut's row says
  "· Mvt 2". `addCut` takes `movement`.
- **The play screen:** a recording of a movement says so on its slide; the bar line reads "Bar 93 · Mvt 2, bars
  87-150"; a tap on a bar of another movement says the recording is of that movement. **With one movement chosen in
  Rehearse (ML-530), a recording of another movement isn't offered**; one of the whole piece always is.
- **Marks that no longer fit** - after the piece's bars change, or it is made a piece in movements and its jumps now
  stay inside each movement - are left out, as before; now the member is told once a visit how many ("2 bar marks on
  ... no longer fit the piece's bars"), and "bars marked" counts only the ones that fit.

Tests: "a recording of one movement (ML-531)" in `server/test/rehearsalScore.test.js`; back-test 82.

## Matching the piece's speeds to a recording (ML-533)

Mark the bars makes the **recording** follow the bars. When the piece's own speeds are off - The Snowman against a
YouTube performance, 19 Oct 2026 - the **metronome** can be made to follow the recording too: the Start, bars and end
pop-up has **Match the piece's speeds to these marks** (for whoever can change the piece). It keeps the marks, then says what
would change ("1 speed would change, by up to 13 bpm (bars 1-8: 120 to 107). The metronome would then meet the bars
you marked to within 0.06 seconds."), changes the speeds only when asked, and Undo puts them back. On a band's piece it
says plainly that everyone in the band will play at these speeds (ML-597). In Edit the new speeds are kept until Save,
like any other change to the bars.

**The speeds from before (ML-597, owner 23 Oct 2026):** the first match keeps every bar block's speed and speed changes
on the piece (`scores.speeds_before_match`, migration 152: `{ recordingId, blocks: [{ id, bpm, ramps }] }`; matching again
keeps the first ones). **Put the original speeds back** is under the matched recording on the Media tab (or under the
videos, once that recording has gone). It is **offered, never done on its own**, when the matched recording is taken
off or where it starts or ends changes. Saved through the piece's own update (`PUT /api/flows/:id`,
`cleanSpeedsBeforeMatch`); blocks added since keep their speed.

`FlowJourney.matchSpeeds(blocks, opts, marks, clip)`:
- each block's speed is scaled by how long its bars last on the recording against how long they last at its own
  speed, every time it plays, over the stretch the fixed points measure (`recordingMap`'s `span`); a block outside it
  keeps its speed;
- speeds are whole numbers (bpm is a SMALLINT): the rounding left over is carried into the next block, so the error
  never builds up across the piece;
- a ramp to a set speed is scaled with its block;
- a mark that isn't on a block's first bar can only be met roughly - a speed changes at a block - and the message says
  so. Splitting a block at such a mark, or speeds with decimals, would be the next step if that isn't near enough.

Tests: "matching the piece's speeds to a recording (ML-533)" in `server/test/rehearsalScore.test.js`; back-test 83.

## B: the Recordings tool (ML-489)

All tools → Practise → **Recordings** (`#recordingsView`, `data-tool="recordings"`).

- **Upload** a whole rehearsal: up to **100 MB** (`MAX_REHEARSAL_FILE_BYTES`; about three hours at a phone
  recorder's ordinary setting), **sound only**: mp3, m4a or wav. A video is refused (the Children's Code
  check below). A recording put straight on a piece stays at 25 MB.
  It is sent **in parts** (`multipart: true`), so a part that fails is sent again instead of the whole file.
  It goes to the member's own folder in the file store, `recordings/<account id>/`; the server keeps an
  address only from that folder (`isRehearsalFileUrl`).
- **Give it to a piece:** choose the piece (one pop-up), then set where it starts and ends (the start-and-end
  pop-up). That makes a **cut**: an ordinary recording on the piece (`score_recordings`) pointing at the same
  stored file, with `rehearsal_recording_id` saying which upload it came from. Change and Remove are on
  each cut; Remove takes it off the piece and leaves the recording.
- **Delete** a recording: its cuts go with it - on the member's pieces and on a band's - and the file is
  removed once nothing points at it.

### A YouTube video in the tool (ML-532)

**Add a YouTube video** (under Upload) puts a video in the tool - a whole concert, or a whole film score - to give to
pieces, or movements (ML-531), with a start and end each, as an upload is. It opens the piece's own YouTube pop-up,
worded for the tool. Only the video's id is kept (`rehearsal_recordings.youtube_video_id`, migration 134; `blob_url`
is empty for it - exactly one of the two is set), so it **doesn't count against the limit**, and the same video can't
be added twice. A cut of it is an ordinary YouTube recording on the piece (`score_recordings` type youtube, with
`rehearsal_recording_id`), so Mark the bars, repeat bars and matching the speeds work as for any recording. Deleting
it takes its cuts off; there is no file to remove. `POST /api/recordings/youtube` `{ url, title }`.

### The owner's rules (7 October 2026)

- **Anyone can upload** and use a recording on their own pieces. **Only a band's organiser** can give one to
  a band's piece: the list of pieces offered is the member's own pieces plus the pieces of bands they
  organise, and the server checks again (`addCut`).
- **How many** a member may keep is the `rehearsal_recordings_max` limit (Admin → Feature access, Limits):
  5 for Standard, 20 for everyone else to start (the owner, 8 Oct 2026). **A band organiser's is meant to be enough for one concert
  at a time, about 20** - delete a concert's recordings once it has been played, and keep the files off the
  app in case the music comes back. It counts **uploaded files**; only a member's own count; using a
  recording a band has put on its pieces counts for nothing.
- **At the limit** the tool says so once and the upload button is off. Nothing else is blocked
  (`specs/README.md`, "No pressure").
- **The app must stay usable for free**, even if it is a bit of a pain.
- **A copy of a public piece takes no music**, so no recording, cut or map goes with it. (Nothing copies
  `score_recordings`; keep it so.)

### Keeping within the limit

- **Delete this list's recordings**, on a practice list (`plClearRecordings`): for once a concert has been
  played. It is about the member's own uploads in the tool. One that is only on this list's pieces is
  deleted, file and all; one that is also on a piece outside the list only comes off this list's pieces.
  It says what it will do, and to keep your own copy of the files, before it does anything.
- **Which pieces have a recording:** My music's Filter has "Has: A recording" (it appears once any piece
  has one), and a piece's row in My music and Rehearse says "2 recordings". The count is every recording and
  video on the piece (`recordingCount` from the pieces list), not only ones from the tool.

### The right to upload (ML-278)

Before a member's **first upload of music** - a recording, a score or a part, anywhere in the app - they
are asked once: "Only upload music you have the right to use: your own, your band's, or something you have
permission for... If it is a recording of people, make sure they know it is being shared." The button is
**I have the right to upload it**. The day is kept on the account (`accounts.upload_rights_confirmed_on`,
migration 119, `POST /api/account/upload-rights`); after that it is not asked again.

- Every button that opens a file chooser for music goes through `withUploadRights` (app.js): a piece's
  recording and document, Quick entry's two, Import from MusicXML, the Recordings tool and a photo or PDF read.
- **The server asks too (ML-574, security re-check 21 Oct 2026):** each of those upload tokens is refused
  (409, reason `needs-upload-rights`) until the account has confirmed - `assertUploadRightsConfirmed`
  (`server/services/accounts.js`). The app waits for the day to be saved before it uploads (`uploadToStore`),
  so a member who has just said yes is never refused. The terms of use carry the same rule for everyone.
- Each upload token also holds the upload to its own folder: a piece's `flows/<piece>/recordings/` or
  `/documents/`, the member's own `flows/from-file/<account>/` for Import from MusicXML, `recordings/<account>/`
  for the Recordings tool. What is kept is the file's real size and type, read from the file store
  (`server/services/storedFiles.js`).
- The date is the member's own information: it is in Download my information and is cleared when the
  account is deleted. **The privacy policy has to name it** (the owner's wording) before this is released.

### An organiser is an adult, and "Report this" (ML-506, ML-507)

Both came out of the two run-throughs (`docs/childrens-code-assessment.md`, `docs/online-safety-assessment.md`).

- **An organiser is an adult.** Setting up sharing for a band, or inviting someone to one, is refused by the
  server until the member has confirmed once that they are 18 or over and responsible for the band
  (`requireAdult` in `bands.js`, reason `needs-adult`; `accounts.organiser_adult_confirmed_on`;
  `POST /api/account/organiser-adult`). The app asks at that moment and then carries on with what they were
  doing (`organiserAdultNeeded`). No proof is asked for. The back-tests' three local accounts are marked as
  having confirmed when they sign in (`tests/helpers/auth.ts`).
- **Report this.** The menu of a band's piece, or a public one, in My music has **Report**: an optional line
  of text, sent to the owner (`content_reports`, `POST /api/reports`, `server/services/contentReports.js`).
  Not behind a feature switch. A member's own private piece has no such item. Nobody in the band is told
  who reported it, and a removal notice never says.
- **Admin → Shared music** is the page that was Admin → Recordings: members' reports (closed with a line
  saying what was done), recordings and videos, documents, and the pieces a band shares or that are public.
  **Remove** now also takes down a document, or a whole piece with everything on it.
- **Report, everywhere a member meets shared things (ML-510).** The same pop-up is on the play screen's
  menu (a band's or a public piece), on a shared band in My bands ("Report the name" - `kind` `band`, the
  band's shared space) and on a band's practice list ("Report this list" - `kind` `list`). Something only
  the member can see - their own list, a band they are alone in - has no Report, and the server refuses it.
- **Practice lists and band names on Shared music (ML-511).** "Bands and their practice lists" lists both.
  **Remove** takes a band's practice list away (its pieces stay). A band can't be removed - its members,
  pieces and lists hang off it - so a name that breaks the terms is changed with **Rename**
  (`renameBandOnRequest`, `POST /api/admin/recordings/rename-band`): the shared space gets the new name,
  and so does each member's own My bands entry for it where it still had the old one. The band's
  organisers are told either way, and both are kept in `recording_removals` (`kind` `list` or `band`;
  for a band, `title` is the name it had). Migration `122_report_bands_and_lists.sql`; back-test 69.

### Removing a recording on request (ML-490)

The privacy policy says: "A recording may have other people in it. If you are in a recording in the app
and want it removed, email hello@notablybetter.com." When that email comes, the owner acts on it from
**Admin → Content → Recordings** (`admin.html#recordings`).

- **The page** lists every recording and video held - a whole rehearsal in the Recordings tool, a recording
  put straight on a piece, a YouTube link - with who added it and the pieces it is on, and a search.
- **Remove** opens one pop-up: why (someone in it asked / copyright / another reason) and the message the
  members will be sent. The message is written for him from the reason - what happened, why, what to do
  next - and is his to change before it goes.
- **One action** (`removeRecordingOnRequest`, `server/services/recordingRemovals.js`):
  - the recording comes off **every** piece that uses the same stored file, the tool's own row goes, and the
    file is deleted from the store. It cannot stay anywhere once one person objects (the owner, 8 Oct 2026);
  - **the people it belonged to are told**: whoever uploaded it, the owner of each piece it was on, and for
    a band's piece the band's organisers and whoever added the piece. They get an **urgent notification**
    that only they see, and an **email**;
  - a line is kept in `recording_removals`: when, by whom, why, what, how many pieces, whether the file
    went, how many were told. It is shown under "Removed" on the page.
- **Nothing about the person who asked is written down anywhere** - only the reason.
- If the file store refuses to delete the file the page says so and the record shows "No - check the
  file store"; everything else has still happened.
- **Notifications for particular members** came with this: `notifications.audience` can now be
  `accounts`, with who it is for in `notification_recipients` (`createTargetedNotification`). Every query
  a member's notifications come from checks it, so nobody else sees one. `docs/notifications.md`.
- It does not stop the same file being uploaded again; the message asks them not to.

### Deleting an account, and the download

`rehearsal_recordings` has an account column, so both find it from the database:

- **Delete my account** removes the member's recordings. A cut an organiser gave to a **band's** piece
  stays with the band, as a band piece does (`rehearsal_recording_id` is SET NULL, not CASCADE), and so its
  file stays: after a deletion a stored file is only removed if nothing still points at it.
- **Download my information** lists them.

## The Children's Code check (8 October 2026)

Done because the owner asked for the Recordings tool to be switched on for every account type. The full
note is his to keep with the self-assessment (`compliance-documents/`, not in the repo). In short:

| Standard | Finding |
|---|---|
| Best interests, detrimental use | A recording of the band is the band's music. No comments, no marking of places, nothing that singles out a player. Met. |
| Impact assessment | Recordings of rehearsals with children in them is new. **The impact assessment needs a section on it** (drafted in the note). |
| Transparency | The policy's "Young players" part says what is known about a young player "is all" - it needs a line on recordings. **The owner's wording; a draft is in the note.** |
| Default settings | A recording is private to whoever uploaded it. On a band's piece, only an organiser - or a member an organiser has given "change music" - can add one; through the Recordings tool, only an organiser. Nobody can give anyone else that right except an organiser (the owner, 20 Oct 2026, ML-231 review). Met. |
| Data minimisation | **Changed:** the tool now takes sound only. A video of a youth band is far more than practising needs. |
| Data sharing | Heard only by the band it was given to. A public piece never carries a recording. Vercel, which stores it, is under contract. Met. |
| Nudge techniques, profiling | The limit is said once and blocks nothing else. Nothing is worked out about a player from a recording. Met. |
| Online tools | Anyone in a recording can ask for it to be removed, and it is removed everywhere in one action (ML-490). The how-to now says to tell the band, and in a youth band the parents. Met, once the policy line for young players is in. |

**Verdict: it can be switched on for everyone once the "Young players" line is in the privacy policy.** That
line went out in 0.52.0 on 8 October 2026, and the three features were switched on for every account type the
same day. The whole app was then run through the Children's Code (`docs/childrens-code-assessment.md`,
ML-506) and the Online Safety Act (`docs/online-safety-assessment.md`, ML-507); the upload confirmation and
the tool's how-to now ask for a parent's agreement for anyone under 16 in a recording. The condition from the first assessment still stands too: a band's organiser
is told how sharing with a band works before a band with young players is invited.

## Still to do before any of it is switched on for members

1. **The owner's sign-off on the new screens**, with pictures (the design gate).
2. **The privacy policy** was changed on 8 Oct 2026 with the owner's agreed wording (recordings held
   before they are on a piece, a recording's marks, the day the right to upload was confirmed, a band keeping
   a recording put on its piece, and how to ask for a recording to be removed), and the terms gained one
   sentence. "Why we hold it" gained the reason for the upload date, as a fifth legitimate interest.
3. **Children's Code:** storing recordings of a youth band is checked against the self-assessment, and the
   answer written down, before B is switched on.
4. **A real phone.** The tests upload a small file from a test browser. Not yet tried: a 60 MB m4a from a
   phone on mobile data; jumping about in a long m4a on an iPhone; repeat bars on a real YouTube video
   (the tests use a stand-in for YouTube's player).
5. **Still open:** whether an organiser's limit follows the account type or the role (now: the account type).

## Where the code is

| What | Where |
|---|---|
| The sums (clips, places, the map, repeat ranges) | `public/flowJourney.js` - the ML-312 and ML-488 sections |
| Their tests | `server/test/recordingClip.test.js`, `server/test/rehearsalScore.test.js` |
| The pop-ups, the play screen's controls, the tool | `public/app.js` - sections headed ML-312, ML-488, ML-489 |
| Clips and marks on the server | `server/services/flows.js` (`setRecordingClip`, `setRecordingMarks`) |
| The Recordings tool on the server | `server/services/rehearsalRecordings.js`, `server/services/blobUrls.js` |
| Removing a recording on request | `server/services/recordingRemovals.js`; `public/admin.js` (`initRecordingsAdmin`) |
| Migrations | `134_rehearsal_youtube.sql` (ML-532), `133_recording_movement.sql` (ML-531), `116_recording_clips.sql`, `117_recording_marks.sql`, `118_rehearsal_recordings.sql`, `119_upload_rights.sql`, `120_recording_removals.sql`, `121_reports_and_organisers.sql` |
| Back-tests | 62 (start and end), 63 (the bars on a recording), 64 (the Recordings tool), 65 (the right to upload, the filter, clearing a list), 66 (removing a recording on request), 67 (an organiser is an adult, Report this, the owner taking a piece down), 82 (a recording of one movement), 83 (a YouTube video in the tool; matching the speeds) |
| Design spec | `specs/components/rehearsal-score.md` |
