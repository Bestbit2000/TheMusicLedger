# Waiting while a piece is read

## 1. Metadata
- **Name:** Waiting while a piece is read (`#pieceReadWaitModal`; `style.css`: `.read-wait`, `.read-wait-ring`,
  `.read-wait-stage`, `.read-wait-sub`, `.read-wait-bar`, `.read-wait-bar-fill`, `.read-wait-nums`, `.read-wait-allow`,
  `.read-wait-stay`; `admin.css`: `.read-wait-example-60`, the Design page's example at 60%)
- **Category:** Feedback / progress
- **Status:** New (ML-645, design approved by the owner 28 Oct 2026)

## 2. Overview
A photo or PDF takes from half a minute to a few minutes to read (docs/piece-from-photo.md). This pop-up says what is
happening the whole time: what it is doing, how far along, how long so far and how long it usually takes, how many
reads the member has left and when they start again - and lets them stop. It replaced a line of words on the Add a
piece tile and a toast.

**Use** it only while a piece is read from a photo or PDF. **Don't** use the ring or the bar for anything quick: a
toast says that.

## 3. Anatomy
A [modal](modal.md), must-answer (`data-no-dismiss`): only **Cancel** or the X close it, and while reading both ask
first ("Stop reading?" - Keep waiting / Stop, the ordinary confirm pop-up).
- `.read-wait-ring` - a ring turning once a second (`--duration-pulse`), the icon inside it: `upload` while sending,
  `photo_camera` while reading. Reduce motion stops it, like every animation.
- `.read-wait-stage` (`aria-live="polite"`, said once per stage, not every second) - "Sending your PDF", "Reading the
  music", then "Taking a little longer than usual - still reading" once past the estimate.
- `.read-wait-sub` - one quieter line: "Nothing is read until it has all arrived." / "It looks for the bars, time
  signatures, speeds, rehearsal marks, repeats and signs."
- `.read-wait-bar` (`role="progressbar"`) with `.read-wait-bar-fill`, its width the run-time `--read-wait-done`. While
  sending it is the upload's own %; while reading, an estimate that never reaches 100% before the answer and holds at
  95%. With no estimate it has no value.
- `.read-wait-nums` - "About 60%" (or "45% sent") and "1:23 so far · usually about 2 minutes".
- `.read-wait-allow` - "This read is 13 of your 30 this quarter - 17 left after it. They reset on Friday 1 January
  2027 at 00:00. A read only counts when it gives a result."
- `.read-wait-stay` - "Stay on this screen until it's done."
- **Cancel** - `.btn-cancel.btn-nav.w-full` (the only button; nothing here is primary).

## 4. Tokens used
`--read-wait-ring` (new, Layer 2: the ring's size), `--primary-action` (the ring's turning part), `--primary-action-strong` (the bar - 3:1 against its track),
`--primary-action-tint` (the ring), `--primary-action-strong` (the icon), `--input-border` (the bar's track),
`--input-bg`, `--control-border` (the allowance box), `--label-color`, `--icon-xl`, `--font-lg`, `--font-sm`,
`--font-xs`, `--font-weight-bold`, `--radius-circle`, `--radius-pill`, `--radius-md`, `--space-1` to `--space-5`,
`--duration-pulse`, `--duration-slow`, `--ease-linear`, `--ease-standard`.

## 5. Props / API
`pieceReadStart` / `pieceReadWaitOpen` in `app.js`. The estimate is `GET /api/piece-read/estimate` (`readEstimate` in
`server/services/pieceReads.js`: the middle of the last successful reads like it, or a starting guess); stopping is
`POST /api/piece-read/stop`.

## 6. States
| State | Ring icon | Stage | Bar |
|---|---|---|---|
| Sending | upload | Sending your PDF / photo / photos | the upload's % |
| Reading | photo_camera | Reading the music | the estimate, up to 95% |
| Past the estimate | photo_camera | Taking a little longer than usual - still reading | held at 95% |
| No estimate | photo_camera | Reading the music | no value - just the time |

## 7. Code example
```html
<div class="modal-content read-wait">
  <div class="read-wait-ring" aria-hidden="true"><span class="material-symbols-outlined">photo_camera</span></div>
  <p class="read-wait-stage" aria-live="polite">Reading the music</p>
  <div class="read-wait-bar" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100"><span class="read-wait-bar-fill"></span></div>
</div>
```

## 8. Cross-references
[modal](modal.md) · [button](button.md) · docs/piece-from-photo.md ("Waiting for the read").

## 9. Accessibility
- The stage line is announced once per stage; the time and % are not announced every second.
- The bar is a `progressbar` labelled by the stage, with `aria-valuenow` only when there is a figure to give.
- The ring is decoration (`aria-hidden`) and stops under Reduce motion; nothing is shown only by its turning.
- Cancel and the X are real buttons, 44px; while reading they ask before stopping.
- Contrast: the icon (`--primary-action-strong`) on the page passes 4.5:1; the bar's fill against its track is a
  non-text pair (3:1).
