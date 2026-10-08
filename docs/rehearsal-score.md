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

### On the play screen

A recording's or video's slide has three value boxes under the player and a line saying which bar it is on:

- **repeat** - the piece's own repeat-bars setting, the one the metronome uses (ML-302). It opens the same
  pop-up. With it on, the recording plays those bars and goes round again.
- **play speed** - 100%, 75% or 50%, at the same pitch. For this visit to the play screen only.
- **bars marked** - how many marks there are; opens "Mark the bars". Only for someone who can change the piece.
- Tapping a **bar tile** while a recording's slide is showing starts the recording at that bar.
- **The bar tiles light up** for where the recording is, as they do for the metronome (the owner, 8 Oct
  2026): `flowActiveTileBlockId` is where a recording is when its slide is showing and it has been played,
  otherwise where the metronome is.
- **The playing tile is kept in view** - for a recording and for the metronome alike. When the lit tile
  changes while something is playing it is scrolled to if it is off the screen (`flowKeepLitTileInView`):
  only while playing, so looking around the piece is never undone, and only as far as needed. Smooth
  unless the device asks for less motion.
- **Rest bars are for the metronome only.** On a recording a repeat goes straight round; nothing waits.

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
- **Fixed points:** the recording's start mark is where bar 1 begins; its end mark, if set, is where the
  last bar ends; each mark pins its bar. A mark on bar 1 wins over the start mark.
- **Between** two fixed points the bars share the time in proportion to their own lengths, so a slow bar
  stays longer than a fast one.
- **Beyond** the first and last fixed point the bars run at the piece's speeds, scaled by how far out the
  nearest stretch was - a band that is 10% slow is assumed to carry on 10% slow.
- With nothing marked at all, bar 1 is at the start mark and everything follows the piece's own speeds.

`placeAt(map, ms)` is the bar playing at a time. `mapLoop(map, startBar, endBar, leadMs)` is the stretch
of recording that a repeat is, by the same rule as `loopPlan` (from the first time the start bar plays to
the next time the end bar plays). It starts 0.4 seconds early, never earlier than the bar before, so a map
that is a touch out still catches the first note. **Rest bars are ignored on a recording.**

### Marking

"Mark the bars" (`#barMapModal`): its own player; a bar to mark (Bar before / Next bar, or type a bar
number); **This is bar N** puts the mark where the player is and steps on to the next bar - so tapping
along bar by bar marks a run of them. A mark that would make the recording run backwards is refused,
saying which mark it clashes with. Save replaces the whole list.

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
- **Which pieces have a recording:** My music has a "With a recording" filter (it appears once any piece
  has one), and a piece's row in My music and Rehearse says "2 recordings". The count is every recording and
  video on the piece (`recordingCount` from the pieces list), not only ones from the tool.

### The right to upload (ML-278)

Before a member's **first upload of music** - a recording, a score or a part, anywhere in the app - they
are asked once: "Only upload music you have the right to use: your own, your band's, or something you have
permission for... If it is a recording of people, make sure they know it is being shared." The button is
**I have the right to upload it**. The day is kept on the account (`accounts.upload_rights_confirmed_on`,
migration 119, `POST /api/account/upload-rights`); after that it is not asked again.

- Every button that opens a file chooser for music goes through `withUploadRights` (app.js): a piece's
  recording and document, Quick entry's two, Create from file, and the Recordings tool.
- It is the app asking, not the server refusing: an upload is not blocked on the server for an account
  that has not confirmed. The terms of use carry the same rule for everyone.
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

### Removing a recording on request (ML-490)

The privacy policy says: "A recording may have other people in it. If you are in a recording in the app
and want it removed, email themusicledgerapp@gmail.com." When that email comes, the owner acts on it from
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
| Default settings | A recording is private to whoever uploaded it. Only a band's organiser can put it on a band's piece. Met. |
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
| Migrations | `116_recording_clips.sql`, `117_recording_marks.sql`, `118_rehearsal_recordings.sql`, `119_upload_rights.sql`, `120_recording_removals.sql`, `121_reports_and_organisers.sql` |
| Back-tests | 62 (start and end), 63 (the bars on a recording), 64 (the Recordings tool), 65 (the right to upload, the filter, clearing a list), 66 (removing a recording on request), 67 (an organiser is an adult, Report this, the owner taking a piece down) |
| Design spec | `specs/components/rehearsal-score.md` |
