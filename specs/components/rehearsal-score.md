# Rehearsal score

## 1. Metadata
- **Name:** Rehearsal score - a recording's start and end (`#clipModal`), the bars on a recording (the play
  screen - playing along, ML-627 - and `#barMapModal`), and the Recordings tool (`#recordingsView`). **One class
  of its own**, `.flow-media-have` (ML-627, the piece's recordings as icons on the play screen); otherwise the value box `.metroBlk-ctrl-value-btn`, `.metro-transport-grid`, `.flow-action-btn`,
  `.btn-text`, `.btn-submit`, `.section-title`, `.flow-card`, `.history-item`, `.flow-upload-progress`,
  `.flow-media-player-audio` / `.flow-media-player-video`, `.theory-best-line`, `.metro-help-text`.
- **Category:** Flow / media
- **Status:** New (ML-312, ML-488, ML-489). Each part has its own feature, Super admin only to start.

## 2. Overview
Practising with a recording of the band, or a YouTube video, without hunting for the place. The sound is
never changed: where things are in it is kept as numbers. Full description: `docs/rehearsal-score.md`.
- **Start and end** (ML-312, `recording_clip`): every recording and video on a piece's Media tab has one
  value box, "start and end", showing the answer ("0:12 to 3:40", "All of it"). It opens a pop-up where the
  two are set by listening and tapping.
- **Which movement** (ML-531): on a piece in movements, a second value box under it (`.metroBlk-ctrl-value-btn.w-full.mt-2`),
  "all" or the movement's number over "movement", opening one pop-up (the whole piece, or each movement with the bar
  it starts at). The Recordings tool asks the same between the piece and its start and end; a cut's row adds "· Mvt 2".
- **The bars on a recording** (ML-488, `rehearsal_score`): on the play screen the recording being played along to
  (ML-627) sits in the metronome's card under the bar line; the clicks follow it from its marked bars. Its repeat and
  speed are the play screen's own four buttons - see "On the play screen" below.
- **Match the piece's speeds** (ML-533): in "Mark the bars", a `.btn-nav` under Save, "Match the piece's speeds to these
  marks". It asks first in the shared confirm pop-up (what changes, how near the marks will be; "Change the speeds" /
  "Leave them"), then an Undo toast.
- **A YouTube video in the tool** (ML-532): a second `.flow-action-btn.flow-action-btn-wide` under Upload, "Add a YouTube
  video", opening the piece's YouTube pop-up (`#flowYouTubeModal`) worded for the tool. Its card says "YouTube video".
- **The Recordings tool** (ML-489, `rehearsal_recordings`): a page of whole rehearsal recordings, each a card
  with the pieces it has been given to.
- **One button, one pop-up** throughout: every choice is a value box showing the answer.
- **Don't** add a waveform picture (a phone can't hold an hour of sound in memory), comments on a recording,
  or any way to mark "where it went wrong" - marks say where a bar is and nothing else ("nobody marks anybody").
- **Don't** add recording in the app: the owner decided against it (7 Oct 2026).

## 3. Anatomy
**Start and end pop-up** - `#clipModal.modal` › `.modal-content` › `.modal-close-x` › `h2` › the recording's
name (`p.metro-help-text` › `strong`) › one line of help › `#clipPlayerHost` (an `<audio>` or a YouTube
frame) › `.section-title` "Start" with the time on the right › **Starts here** (`.flow-action-btn.flow-action-btn-wide`)
› `.flex-row.gap-sm` with two `.btn-text` nudges › the same three for "End" › `p.theory-best-line`
("Plays: 0:12 to 3:40.") › **Play from the start mark** (`.btn-text`) › **Use all of it**
(`.btn-text.btn-text-danger`, only when something is set) › **Done** (`.btn-submit`) › **Cancel**.

**On the Media tab** - under each recording's player, `button.metroBlk-ctrl-value-btn.w-full`: the answer
over "start and end".

**On the play screen (ML-627)** - `.metroBlk-row-current` › `.metroBlk-row-head` (the bar line, then the cog
`button.metroBlk-row-volume-btn#flowSeeHearBtn`, a `settings` icon) › `#flowAlongHost` (the recording: an `audio.flow-media-player-audio`
under `.flow-media-slide-header`, or `.flow-media-player-video` with the YouTube frame; the count-in ring `.count-in-cover`
over it in a practice) › the beat dots (hidden while the metronome isn't seen). Under the card the transport,
`.metro-transport-grid#flowTransport`: four `button`s of one width - **repeat** and **playback** (`.metroBlk-ctrl-value-btn`:
"off" or "5–8" over repeat, the speed over playback), **reset** and **play** (`.metro-play-grid-btn`). Beside the piece's
details, at the end of its time-and-bars line (`#flowPlaySummary`), `span.flow-media-have` - the piece's videos and recordings as
small icons ("×2" for more than one), read only (`role="img"`, "1 video and 2 recordings"); choosing is the cog.

**What to see and hear** - `#flowSeeHearModal.modal` › `.modal-close-x` › `h2` › `h3.warmups-settings-head` "Metronome" ›
two `.display-toggle-row` (See the metronome, Hear the clicks - a `.toggle-switch` each; the last one on is `disabled` when
nothing plays along) › `h3` "Recordings" › a `.display-toggle-row` "Play along to ..." and, with more than one recording
and it on, a `.flow-choice-option` per recording (its title, and Video or Recording); or `p.metro-help-text` "No recordings
or videos for this piece" and a `.btn-text` "Add a recording or video" › `h3` "Volume" › `p.metro-help-text` › today's
volume controls (`.metro-speed-row` with − / + and `.metro-volume-row` with the mute button and the slider).

**Playback** - `#flowSubdivideModal.modal` › `h2` "Playback" › `h3.warmups-settings-head` "Play speed" ›
`.metroBlk-speed-options` (the speeds as `.metroBlk-timesig-opt` boxes, the one playing `.selected`) › "Use sub beats"
(`.radio-group.compact` Off / Auto / Fixed) › the − 2 + card and slider when Fixed › `.btn-submit` Done.

**Mark the bars pop-up** - `#barMapModal.modal` › `.modal-close-x` › `h2` › the recording's name › help ›
`#barMapPlayerHost` › `.section-title` "Which bar" with the bar on the right › `.flex-row.gap-sm` with
one `.flex-row`: **Bar before** (`.btn-text`), the bar's number in a number field (`.text-center`, "Bar number" -
typing one goes straight there, no Go; one the piece hasn't got is put back with why when the field is left), **Next
bar** (`.btn-text`) (ML-644) › **Mark the start of this bar** (`.btn-submit`) › `.section-title` "Marked" with the count › a `.history-item` per mark
(the bar in bold, "at 1:42", then **Play** and **Remove**) › **Save** › **Cancel**.

**The Recordings tool** - `#recordingsView` › `p.theory-intro` › how to record (`p.metro-help-text`) ›
**Upload a rehearsal recording (up to 100 MB)** (`.flow-action-btn.flow-action-btn-wide`) ›
`.flow-upload-progress` while it goes up › `p.theory-best-line` ("3 of 20 recordings kept.") › a
`section.flow-card` per recording: `.flow-card-header` (its name, size and day; a `.flow-pill` "2 pieces") ›
a `.history-item` per piece it is on (the piece in bold, "4:10 to 11:32 · the band", then **Change** and
**Remove**) › **Give it to a piece** (`.flow-action-btn.flow-action-btn-wide`, opens the choice pop-up, then
the start and end pop-up) › **Delete this recording** (`.btn-text.btn-text-danger`).

**Admin → Content → Recordings** (ML-490, desktop first) - `#recordings-section` › `h1` › `p.admin-intro` ›
a search (`input.admin-flows-filter`) › `table.admin-stat-table` (recording, kind, added by, the pieces it is
on, size, added, **Remove** as `.admin-stat-exclude-btn`) › "Removed", the record, as a second table.
**Remove this recording** - `#recordingRemoveModal` › `.modal-close-x` › what it is and what will happen
(`p.admin-intro`) › `.form-group` "Why is it being removed?" (a select) › `.form-group` "What they will be
told" (a textarea, written for him and his to change) › who it goes to › **Cancel** / **Remove it and tell
them**. No classes of its own.

## 4. Tokens used
None of its own - see [metronome](metronome.md) (the value box and the transport grid), [button](button.md),
[modal](modal.md), [card](card.md), [list-row](list-row.md), [flow-editor](flow-editor.md) (the media
players, the upload progress bar and the action button).

## 5. Props / API
- **The sums** are `FlowJourney` (`public/flowJourney.js`): `cleanClip`, `nudgeClip`, `clipLabel`,
  `clockText`, `clipAction`; `journeyPlaces`, `placeLabel`, `usableMarks`, `recordingMap`, `placeAt`, `mapLoop`.
- **app.js**, sections headed ML-312, ML-488, ML-489: `openClipPopup({ title, type, blobUrl | youtubeVideoId,
  mimeType, clip, onSave })` (the one start-and-end pop-up, used by the Media tab and the tool);
  `keepPlayerToClip`; `recScoreControlsHtml`, `renderRecScoreControls`, `recTick`, `recJumpToBlock`;
  `openBarMapModal`; `openRecordings`, `renderRecordings`.
- **Clicks** are `data-act` entries in `CLICK_ACTIONS`: `flow-recording-clip`, `clip-*`, `rec-loop`,
  `rec-speed`, `rec-map`, `barmap-*`, `recordings-*`.
- **Server:** `PUT /api/flows/:id/recordings/:rid/clip`, `PUT /api/flows/:id/recordings/:rid/marks`,
  `GET|POST /api/recordings`, `POST /api/recordings/upload-token`, `POST /api/recordings/:id/cuts`,
  `DELETE /api/recordings/:id`.

## 6. States
| State | Treatment |
|---|---|
| Nothing set | the value box says "All of it"; the pop-up says "The very start" / "The very end"; **Use all of it** is hidden |
| Only one end set | "From 0:12" or "Up to 3:40" |
| A mark tapped past the other one | the other mark is let go - the one just tapped is the one meant |
| A clip that can't be (under a second) | a warning toast saying why; nothing changes |
| Repeat on | the repeat box is `.metroBlk-ctrl-value-btn-on` and shows the bars |
| Playing along, nothing marked | the clicks take bar 1 at 0:00 at the piece's speeds; under the recording `#flowAlongHint`, one line "Timing of the video still to be confirmed" ("recording" for an upload): for whoever can change the piece `button.flow-along-hint-link` (the help text's size, `--link-color`, underlined, a 44px target; opens Edit → Media), for anyone else `p.metro-help-text` (ML-635) |
| Nothing plays along, one of See / Hear left | that switch is `disabled` (greyed) and says it stays on |
| A bar mark out of order | refused with a toast naming the mark it clashes with |
| A bar outside the repeat tapped | a toast: turn repeat off to play from there |
| Uploading | the upload button is off and the progress bar shows the file's name and percent |
| At the limit | the upload button is off and the count line says so, once; nothing else is blocked |
| A recording is playing | the bar tile it is in is lit (`.metroBlk-tile-active`), as for the metronome, and is scrolled into view if it is off the screen |
| First upload of music (ML-278) | the confirm pop-up "Before you upload" - **I have the right to upload it** / Cancel; asked once per account |
| A practice list with pieces | **Delete this list's recordings** (`.btn-text.btn-text-danger`) above Delete this list; it says what will go before anything does |
| A piece has recordings | its row in My music and Rehearse ends "• 2 recordings"; My music's Filter gains "Has: A recording" |
| No recordings | "No recordings here yet." |
| A recording on no piece | "Not on a piece yet." |
| Offline | saving a clip, marks or a recording needs a connection (`docs/offline.md`) |

## 7. Code example
```html
<button type="button" class="metroBlk-ctrl-value-btn w-full" data-act="flow-recording-clip" data-arg="12" aria-haspopup="dialog"
        aria-label="Start and end of Band rehearsal: 0:12 to 3:40 - tap to change">
  <strong>0:12 to 3:40</strong><span class="metroBlk-ctrl-value-label">start and end</span>
</button>

<div class="metro-transport-grid">
  <button type="button" class="metroBlk-ctrl-value-btn metroBlk-ctrl-value-btn-on" data-act="rec-loop" aria-haspopup="dialog"><strong>33–48</strong><span class="metroBlk-ctrl-value-label">repeat</span></button>
  <button type="button" class="metroBlk-ctrl-value-btn" data-act="rec-speed" aria-haspopup="dialog"><strong>75%</strong><span class="metroBlk-ctrl-value-label">play speed</span></button>
  <button type="button" class="metroBlk-ctrl-value-btn" data-act="rec-map" data-arg="12" aria-haspopup="dialog"><strong>4</strong><span class="metroBlk-ctrl-value-label">bars marked</span></button>
</div>
<p class="theory-best-line" role="status" aria-live="off">Bar 37 of 96</p>
```

## 8. Cross-references
[metronome](metronome.md) · [modal](modal.md) · [flow-editor](flow-editor.md) · [card](card.md) ·
[list-row](list-row.md) · [button](button.md) · docs/rehearsal-score.md · docs/flow-journey.md ·
docs/feature-access-plan.md.

## 9. Accessibility
- Every control is a real `<button>`, 44px or more. Each value box's `aria-label` says the answer and
  "tap to change", and carries `aria-haspopup="dialog"`.
- The two nudges on each end are named for what they do ("Start 1 second earlier"), since their visible
  words are the same for the start and the end. Each Change, Remove and Play is named for its piece or bar.
- The times in the pop-ups are `aria-live="polite"`, so a mark being set is announced. The play screen's bar line changes every bar
  and is not announced, which would talk over the music. The playback button and the media button say what
  they hold ("Playback - 80% speed, auto sub beats", "1 video and 2 recordings - choose what to play along to").
- Both pop-ups close on Escape and their X; the start-and-end pop-up also closes on a tap outside (it has
  no field to type into), the Mark the bars pop-up does not (it has one). Every way of closing stops the
  pop-up's player.
- Nothing depends on colour: a repeat that is on shows its bars, not just a tint.
- The players are the browser's own `<audio>` controls and YouTube's own player, keyboard and screen-reader
  support included.
- The limit is stated once in plain words and blocks nothing but another upload (the no-pressure rule).
- Keeping the playing tile in view scrolls smoothly unless the device asks for less motion
  (`prefers-reduced-motion`), and never while nothing is playing.
