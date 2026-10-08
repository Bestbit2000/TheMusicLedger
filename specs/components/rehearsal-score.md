# Rehearsal score

## 1. Metadata
- **Name:** Rehearsal score - a recording's start and end (`#clipModal`), the bars on a recording (the play
  screen's recording slides and `#barMapModal`), and the Recordings tool (`#recordingsView`). **No classes
  of its own**: the value box `.metroBlk-ctrl-value-btn`, `.metro-transport-grid`, `.flow-action-btn`,
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
- **The bars on a recording** (ML-488, `rehearsal_score`): on the play screen, a recording's slide has three
  value boxes - repeat, play speed, bars marked - and a line saying which bar is playing.
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

**On a recording's slide (play screen)** - under the player, `.metro-transport-grid` with up to three
`button.metroBlk-ctrl-value-btn`: "off" or "5–8" over **repeat** (`.metroBlk-ctrl-value-btn-on` while on);
"100%" over **play speed**; a number or "none" over **bars marked** (only for someone who can change the
piece). Then `p.theory-best-line`: "Bar 37 of 96".

**Mark the bars pop-up** - `#barMapModal.modal` › `.modal-close-x` › `h2` › the recording's name › help ›
`#barMapPlayerHost` › `.section-title` "Which bar" with the bar on the right › `.flex-row.gap-sm` with
**Bar before** / **Next bar** (`.btn-text`) › `.form-group` "Or type a bar number" (a number field and **Go**)
› **This is bar N** (`.btn-submit`) › `.section-title` "Marked" with the count › a `.history-item` per mark
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
| Repeat on (a recording's slide) | the repeat box is `.metroBlk-ctrl-value-btn-on` and shows the bars |
| No bars marked | "none" over "bars marked"; the map follows the piece's own speeds from the start mark |
| A bar mark out of order | refused with a toast naming the mark it clashes with |
| A bar outside the repeat tapped | a toast: turn repeat off to play from there |
| Uploading | the upload button is off and the progress bar shows the file's name and percent |
| At the limit | the upload button is off and the count line says so, once; nothing else is blocked |
| A recording is playing | the bar tile it is in is lit (`.metroBlk-tile-active`), as for the metronome, and is scrolled into view if it is off the screen |
| First upload of music (ML-278) | the confirm pop-up "Before you upload" - **I have the right to upload it** / Cancel; asked once per account |
| A practice list with pieces | **Delete this list's recordings** (`.btn-text.btn-text-danger`) above Delete this list; it says what will go before anything does |
| A piece has recordings | its row in My music and Rehearse ends "• 2 recordings"; My music's filter gains "With a recording" |
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
- The times in the pop-ups are `aria-live="polite"`, so a mark being set is announced. The bar line on a
  recording's slide is `role="status"` with `aria-live="off"`: it changes every bar, which would talk over
  the music; it can be read when wanted.
- Both pop-ups close on Escape and their X; the start-and-end pop-up also closes on a tap outside (it has
  no field to type into), the Mark the bars pop-up does not (it has one). Every way of closing stops the
  pop-up's player.
- Nothing depends on colour: a repeat that is on shows its bars, not just a tint.
- The players are the browser's own `<audio>` controls and YouTube's own player, keyboard and screen-reader
  support included.
- The limit is stated once in plain words and blocks nothing but another upload (the no-pressure rule).
- Keeping the playing tile in view scrolls smoothly unless the device asks for less motion
  (`prefers-reduced-motion`), and never while nothing is playing.
