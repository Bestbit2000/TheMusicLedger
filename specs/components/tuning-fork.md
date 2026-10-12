# Tuning fork

## 1. Metadata
- **Name:** Tuning fork (`#tuningForkView`, `#tuningForkModal`, `#forkPanel`: `.fork`, `.fork-sound`, `.fork-waves`, `.fork-waves-left`, `.fork-wave`, `.fork-wave-1` / `-2` / `-3`, `.is-sounding`; `.tuner-card-fork-btn`)
- **Category:** Tool
- **Status:** New (ML-158)

## 2. Overview
A note to tune to. You pick it on a stave, press play, and it sounds until you stop it. It is a tool of its
own (All tools, Everyday) and a pop-up from the Tuner's card - the same panel in both. Feature
`tuning_fork`. How it behaves is in `docs/tuning-fork.md`.

The owner's decisions (12 Oct 2026): the note is shown **as written for your instrument** with what it
sounds as underneath; it starts on the instrument's **usual tuning note**; opened from the Tuner, **the
tuner stops listening while the note sounds**; and it is called **Tuning fork**.

It is built from the range picker's stave and −/+ ([range](range.md)), the play button and volume slider
([metronome](metronome.md), [slider](slider.md)) and the value box. What is new is the sound waves either
side of the stave, and a second button on the Tuner's card.

## 3. Anatomy
- **The panel** `.fork` (a column, `--space-3` apart):
  - `.fork-sound` - three across: `.fork-waves.fork-waves-left` › three `.fork-wave` arcs · the stave,
    `button.range-stave-btn` (one note, in the clef you read; tap near a note to pick it) ·
    `.fork-waves` › three arcs. The arcs grow outwards (`.fork-wave-1` to `-3`); the left set is the right
    set mirrored. They are decoration (`aria-hidden`).
  - `.metro-speed-row` - `.metro-bpm-step` − · `.metro-speed-readout` (the note, "C5", over
    `.metro-speed-sub` "sounds as concert B♭", or "concert pitch") · `.metro-bpm-step` +. A semitone a tap.
  - a value box `.metroBlk-ctrl-value-btn.w-full` ("B♭ Cornet" over "instrument"), only with more than
    one instrument; it opens the choice pop-up. With no instrument, one line saying it is at concert pitch.
  - `.metro-play-grid-btn` - play / stop (the icon and the word under it change).
  - `.metro-volume-row` - `.metro-mute-btn` and the slider. On the panel, not behind a button: the ticket
    asks for the volume to be showing.
  - `.btn-text` "Back to the usual tuning note" (off while it is on that note).
- **The pop-up** `#tuningForkModal`: X · "Tuning fork" · one line, "The tuner stops listening while the
  note sounds." · the panel.
- **On the Tuner's card:** `.tuner-card-settings-btn.tuner-card-fork-btn`, the cog's twin in the opposite
  (top left) corner.
- **The tile:** an ordinary `.tool-icon-btn` in Everyday, after Timer. Its icon is not a tuning fork - the
  Tuner's already is.

## 4. Tokens used
| Part | Property | Token |
|---|---|---|
| `.fork` | gap | `--space-3` |
| `.fork-sound` | gap | `--space-2` |
| `.fork-waves` | gap / colour at rest | `--space-0-5` / `--input-border` |
| `.fork.is-sounding .fork-waves` | colour | `--primary-action-strong` |
| `.fork-wave` | width / radius | `--space-2` / `--radius-circle` |
| `.fork-wave-1`, `-2`, `-3` | height | `--space-5`, `--space-7`, `--space-9` |
| `.fork.is-sounding .fork-wave` | animation | `fork-wave`, `--duration-pulse`; the 2nd and 3rd arcs start `--duration-fast` and `--duration-base` later |
| `.tuner-card-fork-btn` | left | `--space-3` |

Everything else is its own component's.

## 5. Props / API
- `openTuningForkView()` / `openTuningForkPopup()` / `closeTuningForkPopup()` - the panel is one element,
  moved into whichever is open.
- `forkStart()` / `forkStop()` / `forkSounding()`; `setForkNote(pitch)`; `setForkVolume(0-100)`.
- `forkUsualNote(instrument)` - the usual tuning note, written for that instrument.
- Kept on the device only (`tml.fork`): the note for each instrument, the instrument chosen here, the volume.

## 6. States
- **At rest:** the arcs are grey; the button says play.
- **Sounding** (`.fork.is-sounding`): the arcs are gold and ripple outwards; the button says stop. With
  reduced motion they are simply gold and still.
- **Muted:** `.metro-volume-row.is-muted`, as on the metronome.
- **No instrument:** treble clef at concert pitch, starting on A; a line says how to get the written note.
- It stops by itself when you leave the screen, close the pop-up (any way) or the app goes to the background.

## 7. Code example
```html
<div class="fork is-sounding">
    <div class="fork-sound">
        <span class="fork-waves fork-waves-left" aria-hidden="true"><span class="fork-wave fork-wave-1"></span><span class="fork-wave fork-wave-2"></span><span class="fork-wave fork-wave-3"></span></span>
        <button type="button" class="range-stave-btn" aria-label="Tuning note: C5. Tap the stave near a note to pick it"><!-- Notation.staff --></button>
        <span class="fork-waves" aria-hidden="true"><span class="fork-wave fork-wave-1"></span><span class="fork-wave fork-wave-2"></span><span class="fork-wave fork-wave-3"></span></span>
    </div>
    <div class="metro-speed-row no-margin" role="group" aria-label="Tuning note">
        <button type="button" class="metro-bpm-step" aria-label="A semitone lower">&minus;</button>
        <div class="metro-speed-readout"><div>C5</div><div class="metro-speed-sub">sounds as concert B♭</div></div>
        <button type="button" class="metro-bpm-step" aria-label="A semitone higher">+</button>
    </div>
</div>
```

## 8. Cross-references
[range](range.md) · [tuner](tuner.md) · [metronome](metronome.md) · [slider](slider.md) ·
[notation](notation.md) · `docs/tuning-fork.md` · `specs/foundations/motion.md`

## 9. Accessibility
- The stave is a `<button>` that says the note in its name; a tap needs a pointer, so **− and +** are the
  keyboard's way to pick a note, and the note is announced as it changes (`aria-live`).
- Play / stop is one button with `aria-pressed` and a name that says the note ("Play C5", "Stop the note").
- The volume is the app's slider (`role="slider"`, arrow keys).
- The waves are decoration: hidden from a screen reader, never the only sign that it is sounding (the
  button says so), and still under reduced motion.
- The note and its concert pitch are words, not colour.
