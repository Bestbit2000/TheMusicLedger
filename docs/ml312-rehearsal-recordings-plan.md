# ML-312: rehearsal recordings and the rehearsal score - the plan

Version 3, 7 October 2026, for the owner.

**Built on 7-8 October 2026, in the order A, C, B** - not released, and Super admin only until switched on.
What was built, and what is still to do before members get it, is in [`rehearsal-score.md`](rehearsal-score.md).
This plan is kept as written, for the reasoning and the decisions.

## What this is for

The metronome gets you able to play the notes. Then you have to play it with others. Practising with a
recording of the band, or a YouTube video, does that - but finding the bit you want, and dragging the
little slider back to the same place over and over, is a pain. **That is the problem to solve.**

The answer is a **rehearsal score: the piece's bars mapped onto the recording, so you choose bars and that
part repeats.** It works the same for an uploaded recording and a YouTube video.

## Decided so far (the owner, 7 October 2026)

| | Decision |
|---|---|
| Recording | **Not in the app.** A rehearsal is recorded with the phone's own recorder and the file uploaded. The privacy policy's line about the microphone stays true. |
| Upload | A bigger file is allowed for a rehearsal recording than for a recording put straight on a piece. |
| Where they live | **A new tool.** Recordings are uploaded there, then given to pieces. |
| Who can do what | **Anyone can upload** a recording and use it on their own pieces. **Only a band's organiser can put a cut on a band's piece.** |
| Public pieces | A copy of a public piece takes the inputs only - **no music goes with it**. So no recording and no map is ever passed on with a public piece. |
| How many | **A limit set per account type** (Standard, Premium and so on), like the other limits on Admin → Feature access. Low for Standard. It counts **your own** recordings only: a recording a band provides on its pieces is free to use and counts against nobody but whoever uploaded it. |
| Band organisers | **A more generous limit: enough for one concert at a time, about 20.** Delete a concert's recordings once it has been played; keep the files off the app and upload them again if the music comes back. |
| Where it is heading | The rehearsal score: bars mapped to the recording, and to YouTube videos the same way. |

## The one decision everything else follows from

**Never change the sound file. Keep it whole, and remember where things are in it as numbers.**

- A **cut** is two numbers: where a piece starts and ends in the recording.
- A **mark** is one number: where a bar falls.

That gives one file for many pieces, cuts and marks that can always be corrected, no sound processing on
the server, nothing heavy on the phone - and exactly the same thing for a YouTube video, where there is no
file at all, only the numbers.

## Suggested order

| Step | What | Why this order |
|---|---|---|
| **A** | Set start and end on a recording or a YouTube video already on a piece | Small. Useful at once. Proves that jumping to a place works on phones. |
| **C** | The rehearsal score: map the bars, repeat any bars, play slower | The point of it all. Works with a YouTube video or an mp3 already on a piece. |
| **B** | The Recordings tool: the bigger upload, one file given to several pieces, who has it | Gets the band's own rehearsal onto its pieces. Uses A's pop-up. |

Each is a release of its own. B and C do not depend on each other. I have put **C before B** because it
is the part you want most and needs nothing new stored - say if you would sooner have B first (question 1).

## Step A: start and end

On a piece's Media tab, each recording and each video gets **Set start and end**. One pop-up:

1. Play, and a slider to move through it.
2. **Starts here** and **Ends here** buttons: tap them while listening.
3. Small nudges either side of each (1 second back, 1 second on) and **Play from the start mark** to check it.

The play screen then starts at the first mark and stops at the second.

No waveform picture. Drawing one for an hour-long file means holding the whole recording in the phone's
memory, which a phone cannot do reliably. Listening and tapping is how people find a place anyway.

## Step C: the rehearsal score

### What the player gets

On the play screen, with a recording or video showing:

- **Repeat bars.** Choose "bars 33 to 48" just as Rehearse's repeat bars does for the metronome today. The
  recording plays those bars, goes back, plays them again. No slider.
- **Start from a bar.** Tap a bar; the recording starts there.
- **Slower.** Play the band at three-quarter or half speed, at the same pitch. Phones and YouTube can both
  do it, and it is what makes playing along possible before you are up to speed.
- **The bars follow the sound.** The current bar is lit as the recording plays, so you can see where the
  band is.

### How the bars get mapped - mostly worked out for you

You said the pauses and speeds should mark it out approximately. They can. The piece already knows how
many bars there are, the time signature and speed of each, where it slows down or speeds up, the pauses,
the repeats and endings, and so the order the bars are really played in. From that the app works out how
long each bar *should* last.

1. **One mark is enough to start.** Say where bar 1 falls (step A's start mark). The app lays out every
   other bar from the piece's own speeds and pauses. If the band plays at the marked speeds, that is
   already close.
2. **A real band drifts.** It takes the slow section slower and holds the pause longer. So add a mark where
   it has gone out: play the recording, and when the band reaches letter C, tap **This is bar 33**. The
   app stretches or squeezes the bars between two marks to fit, keeping their proportions - a slow bar
   stays longer than a fast one.
3. **More marks, closer fit.** A handful - the start, each change of speed, after each pause, the end -
   gets most pieces to within a beat or so. That is close enough to repeat a passage.
4. **Tap along, for the keen.** Play the recording and tap once at the start of every bar, or every
   fourth. Quick for a short piece, and exact.

Nothing listens to the recording to find the bars for you. Working out bar lines from the sound of a band
in a hall is unreliable and would need an outside service. Marks by ear plus the piece's own speeds are
dependable and cost nothing.

### YouTube, the same way

A video on a piece gets the same start and end, the same bar marks and the same repeat. Only the numbers
are stored; the video stays on YouTube. Two things to know:

- **Jumping is a little less exact** than with an uploaded file: YouTube lands within about half a second.
  Fine for repeating a passage.
- **Adverts** are YouTube's. The app cannot skip one. They should not move the marks, which count from the
  video's own start - to be checked when it is built.

The play screen already controls YouTube's player (it pauses it when you leave). Jumping and changing
speed use the same control. YouTube's terms are in the third-party register and get re-read when this is
built.

### Whose map is it

A map belongs to the recording on the piece.

- **Your own piece:** yours.
- **A band's piece:** one person maps it and the whole band has it. That is the band sharing its music,
  which is what the app is for. Since only an organiser can put a recording on a band's piece, I suggest
  the organiser maps it too - or anyone in the band may, since a map harms nothing (question 4).
- **A public piece:** nothing. No music goes with a copy, so no map does either. Someone who copies a
  public piece adds their own recording or video and maps that.

### Where I would be careful

- **Repeats.** In a piece with a repeat, bar 20 is played twice. The map has to follow the order the bars
  are played in, not the bar numbers, and "repeat bars 17 to 24" has to mean one time through. The journey
  engine already works in that order; it is the part most likely to go wrong, so it gets the most tests.
- **A recording that stops and starts.** If the conductor stops the band at bar 40 and goes back to 33,
  the recording no longer matches the piece from there. First version: map a run-through, and end the cut
  where the band stops. Mapping a stop-and-go take is for later, if at all.
- **How close is close enough.** Aim for "starts within a beat, a touch early" and say so on screen. A
  short lead-in - a second or so of the bar before - makes a slightly-out map feel right.
- **Keep marking quick.** If mapping takes more than a couple of minutes nobody will do it. One mark must
  give something usable, and each extra mark must visibly improve it.

## Step B: the Recordings tool

A new tool on All tools (name: question 5). It is where an uncut recording lives.

1. **Record, outside the app.** The tool has a short "How to record a rehearsal" note: use the phone's own
   recorder, put the phone where it hears the whole band, use the ordinary quality setting, upload on wifi.
2. **Upload** the whole file to the tool.
3. **Give it to pieces.** Open the recording, tap **Add a piece**, choose the piece, set where it starts and
   ends (step A's pop-up). Repeat for each piece in the file. Each one appears on its piece's Media tab,
   already cut. The tool lists them: "Jupiter 04:10 to 11:32", "Nimrod 14:05 to 18:40".
4. **Who:** anyone can give a recording to their own pieces. Only a band's organiser can give one to a
   band's piece; for anyone else the band's pieces are not offered in the list.

### The bigger upload

- **Today a recording can be 25 MB.** A phone's recorder at its ordinary setting makes roughly 30 MB an
  hour, so a two-hour rehearsal is about 60 MB. Suggested limit in the tool: **100 MB**. A recording put
  straight on a piece stays at 25 MB.
- **File types.** The app already takes mp3, m4a, wav and mp4. An iPhone's Voice Memos makes m4a, and so do
  most Android recorders. Two messages to get right:
  - a **wav** or "lossless" recording is about ten times the size - the message should say "record at the
    ordinary quality setting", not just "too big";
  - a few Android recorders save other types (3gp, amr, ogg), and an iPhone cannot play some of them - the
    message should say "save as m4a or mp3".
- **Sent in parts.** Today a file goes up in one go: if the connection drops at 90%, it starts again. At
  100 MB from a band room that will happen. The file store can take a file in parts and carry on after a
  dropped one. It is a setting on the upload the app already uses, not a new service, but it needs trying
  on a real phone on mobile data before the limit is raised.

## Storage and cost

- **Storing** 1 GB is about $0.024 a month, so ten two-hour rehearsals is under 2 cents a month.
- **Listening** is $0.05 a GB. A 60 MB file that 30 players each play through once is about 9 cents. A
  player repeating their own four minutes downloads only that part, once.
- **YouTube costs nothing** to store or play.
- **Keeping it in hand:** a limit on how many recordings an account keeps in the tool, set per account
  type on Admin → Feature access (the same kind of limit as favourite tools and Home stats). Low for
  Standard, more for Premium. Only your own uploads count; listening to a band's recording counts for
  nothing. At the limit the tool says so once and offers to delete one - it blocks nothing else (the
  no-pressure rule). When a recording is deleted its cuts go with it and the file is removed. "Where
  Vercel's usage is going" will show what it all adds up to.
- **A band organiser gets a more generous limit (the owner, 7 October 2026): enough for one concert at a
  time, about 20.** The app has to be usable for free, even if it is a bit of a pain. Once a concert has
  been played its recordings can be deleted - the music is unlikely to come back out, and if it does, the
  files are still on the organiser's own phone or computer and can be uploaded again. So the limit is not
  a store for ever; it is room for what the band is working on now. It is the Band admin account type's
  number on Admin → Feature access - no new counting.
- **What is counted: uploaded files.** A file costs storage; a cut is only two numbers. One rehearsal file
  given to five pieces counts as one. So 20 covers a concert even if every piece has a file of its own, and
  goes much further when a whole rehearsal is one file. (If you meant 20 *pieces with a recording*
  whatever the number of files, say so - it is a different count but no harder.)
- **Clearing up after a concert** should be one action, not twenty: on a practice list, "Delete this
  concert's recordings" removes the files behind its pieces (yours only) after asking once. Worth having,
  because the limit depends on people doing it.
- **To check when it is built:** the limit goes by account type, and "organiser" is also a role within a
  band. Someone who organises a band but whose account is not the Band admin type would get the Standard
  number. Either organisers are always that account type, or the limit looks at the role instead.
- **Premium:** each step is a feature that starts Super admin only; you choose who gets it on Admin →
  Feature access. The tool, the bigger upload, or the rehearsal score itself could each be the Premium line.

## What still needs your say-so

1. **The privacy policy.** The microphone line stays true. The policy says it holds "the recordings and
   documents you add" to a piece; the tool holds a recording before it is on any piece, so that sentence
   may want a few words more. The wording is yours.
2. **Other people are in a rehearsal recording** - their playing and the conductor's voice, and in a youth
   band, children. Your rule covers sharing: it stays private to whoever uploaded it until an organiser
   puts a cut on a band's piece. Nothing checks what is in an uploaded file, today or after this; the
   take-down wording in the terms is the backstop.
3. **"Nobody marks anybody."** No comments on a recording, no marking of places "where it went wrong".
   Marks say where a bar is and nothing else.
4. **Children's Code.** Storing recordings of a youth band is the kind of thing the self-assessment asks
   about. Checked and written down before step B is released.
5. **Deleting an account and "Download my information".** A member's recordings in the tool are theirs:
   deleted with the account, listed in the download. A cut an organiser put on a band's piece stays with
   the band, as a band piece does now - so the file behind it stays too.

## What changes underneath (for whoever builds it)

- **Step A.** `score_recordings` gains `clip_start_ms` and `clip_end_ms` (both empty = all of it), for an
  upload and a YouTube row alike. The pop-up, and the play screen and editor honouring the two numbers: an
  upload through its `<audio>` element, a video through the YouTube player object the play screen already
  holds.
- **Step C.** A table of marks per recording (`score_recording_marks`: the recording, the place in the
  journey - not just a bar number, because of repeats - and the time in milliseconds). The sums go in
  `public/flowJourney.js` beside `loopPlan`, pure and unit-tested: from the journey's steps (each bar's
  expected length, from `tempoAt`, the ramps and `pausesInBar`) and the marks, give the time of any step
  and the step at any time. Rehearse's repeat bars (ML-302) then drives the recording instead of the
  metronome: `currentTime` and `playbackRate` on an upload; `seekTo`, `getCurrentTime` and
  `setPlaybackRate` on a video. Read `docs/flow-journey.md` first.
- **Step B.** A new table for the uncut file (`rehearsal_recordings`: who added it, title, the day
  recorded, the file, its length). A cut is a `score_recordings` row pointing at the same file. Today the
  code refuses to attach a file that is already attached (`assertOwnUnusedBlob`) and removes a file when
  its last row goes (`delUnreferenced`): the first has to allow a cut of your own recording, the second
  already does the right thing. A second upload route with its own size limit, sent in parts (`multipart`
  on the file store's upload). A new tool on All tools (`specs/foundations/layout.md`: a list page).
- A new table with an account column: read `docs/account-deletion.md`, add it to the export, name it in
  the privacy policy.
- Copying a public piece must go on leaving recordings, cuts and marks behind - a test should hold that.
- One feature for each step, Super admin only to start, and limits for the file size and how many.
- Not kept offline, like every recording (`docs/offline.md`).
- No new outside service or package. No change to the security headers.
- Every choice is one button and one pop-up, each with its X.

## Questions for you

1. **Order:** A, then C, then B. Or B before C?
2. **File size** in the Recordings tool: 100 MB (about three hours at a phone's ordinary setting)?
3. **How many** recordings for Standard, and for Premium? A band organiser has about 20. (Say 2 for
   Standard and 20 for Premium to start - they are numbers you can change on the admin page.) And is it
   files that are counted, as the plan has it, or pieces with a recording?
4. **Mapping a band's piece:** the organiser only, or anyone in the band?
5. **The tool's name on screen:** "Recordings"? "Rehearsal recordings"?
6. **Slower playback:** three-quarter and half speed to start with, or a slider?
7. **Which of these is Premium** - the tool, the bigger upload, the rehearsal score, or none yet?
