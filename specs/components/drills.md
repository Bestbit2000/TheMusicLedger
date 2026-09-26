# Drills (Tempo, Pulse, Pitch)

On screen the three tools are **Tempo**, **Pulse** and **Pitch** (tool groups, 2026-09-26). In the code, ids, features and
this spec's history they are Tap tempo (`tapTempo`, `tap_tempo`), Gap trainer (`gapTrainer`, `gap_trainer`) and
Ear (`ear`, `ear_training`).

## 1. Metadata
- **Name:** Drills (`.drill-pad`, `.drill-feedback`, `.drill-meter`, `.drill-meter-track`, `.drill-meter-mark`, `.drill-meter-needle`, `.drill-meter-labels`, `.drill-beats`, `.drill-bar`, `.drill-beat`, `.drill-listen`, `.drill-ear-icon`, `.drill-result-list`, `.is-hit`; states `.is-silent`, `.is-now` on `.drill-beat`)
- **Category:** Tool screen
- **Status:** New (ML-298, ML-295, ML-296)

## 2. Overview
Three home-screen tools built on one engine ([`public/drills.js`](../../public/drills.js)) and one results
screen. Each tool has:

1. **A setup screen**: a short intro (`.theory-intro`), one-tap option pills (the Theory options look:
   `.form-group` › `.radio-group`, with a `.metro-help-text` line describing the chosen level), your best
   at that level (`.theory-best-line`) and **Start** (`.btn-submit`).
2. **A play screen**:
   - **Tap tempo:** "Speed 2 of 5 · 4 of 9 taps" (`.theory-status`), the speed as a Bravura metronome
     mark (`Notation.tempoMark`) or an Italian speed name (`.theory-prompt`), the live meter
     (`.drill-meter`, *Listen first* and *With a guide* only), a feedback line (`.drill-feedback`), the
     **pad** (`.drill-pad`), then **Next speed**.
   - **Gap trainer:** "Bar 3 of 8" and the speed, the 8 bars of 4 beats (`.drill-beats` › `.drill-bar` ›
     `.drill-beat`: a silent beat is an empty ring, `.is-silent`; the beat now is gold, `.is-now`), the
     feedback line, the pad, and **Stop**.
   - **Ear:** "3 of 10 · 2 right", the question, a listening icon (`.drill-ear-icon`), which becomes the
     note on a treble staff once answered, then the answer buttons (Theory's `.theory-answer`: 2-5
     notes in two columns, 7 letters, or the 12-note keyboard `.theory-answers-keyboard`), **Play again**,
     **Skip** (*Play it back* only, with "Listening… G", `.drill-listen`), then **Next note**.
3. **The results screen** (`#drillResultsView`, shared): the tool and level, the grade dots
   (`.theory-grade-lg`), best-line, four stat cards (`.stat-card`), a line per speed / gap / note
   (`.drill-result-list`), your last rounds at this level (the Theory trend bars), **Again** and
   **Change level**.

**The pad** is the one big target a drill is played on: gold like Play (`--primary-action`), round,
4 touch targets wide, and it gives under the finger (`.is-hit`, scale 0.94, `--duration-instant`). It
is played on **pointerdown** - a click lands too late to time a beat by - and a click with no pointer
behind it (keyboard, switch access, a screen reader) counts too.

**The live meter** (Tap tempo) is a track with a centre mark and a needle at `--pos` (-1 much too slow,
0 on it, +1 much too fast; set from JS), labelled slower / on it / faster. It's decorative
(`aria-hidden`): the same verdict is read out in the feedback line ("A bit faster").

## 3. Anatomy
`#tapTempoView` / `#gapTrainerView` / `#earView` › `.theory-intro` · `#…Options` (`.form-group` › `.radio-group`
› `.metro-help-text`) · `.theory-best-line` · `.btn-submit`.
`#tapTempoPlayView` › `.theory-status` · `.theory-question` · `.theory-prompt` · `.drill-meter` (`.drill-meter-track`
› `.drill-meter-mark` + `.drill-meter-needle`; `.drill-meter-labels`) · `.drill-feedback` · `.drill-pad` · `.btn-submit`.
`#gapTrainerPlayView` › `.theory-status` · `.drill-beats` › `.drill-bar` › `.drill-beat` · `.drill-feedback` · `.drill-pad` · `.btn-nav`.
`#earPlayView` › `.theory-status` · `.theory-question` · `.theory-prompt` (`.drill-ear-icon` / a staff) · `.drill-feedback`
· `.theory-answers` · `.drill-listen` · `.btn-nav` ×2 · `.btn-submit`.
`#drillResultsView` › `.theory-results-options` · `.theory-grade-block` · `.dashboard-grid` › `.stat-card` · `.drill-result-list` · `.theory-trend` · buttons.

## 4. Tokens used
`--primary-action`, `--primary-action-text` (the pad), `--primary-action-strong` (needle, the beat now),
`--control-off-bg` (meter track), `--label-color` (meter mark and labels, beats, listening line, icon),
`--container-bg`, `--input-border` (bars, result lines), `--text-color` (feedback), `--touch-target`,
`--radius-circle`, `--radius-pill`, `--radius-md`, `--icon-xl`, `--font-lg`, `--font-md`, `--font-sm`, `--font-xs`,
`--font-weight-bold`, `--opacity-disabled`, `--duration-instant`, `--duration-fast`, `--ease-standard`, `--space-*`.

## 5. Props / API
- Engine: `Drills.tapTargets / tapScoreOne / tapLive / tapScoreRound`, `Drills.gapSchedule / gapScoreRound`,
  `Drills.earQuestions / earAnswers / earConcertMidi / earHeard / earScoreRound`, `Drills.scoreRound(tool,
  level, details)` (what the server re-scores with). Rules and numbers: [docs/drills.md](../../docs/drills.md).
- Data: `drill_attempts` (db/migrations/057_drills.sql); `GET /api/drills/:tool/summary`,
  `GET/POST /api/drills/:tool/attempts`. Features `tap_tempo`, `gap_trainer`, `ear_training`.
- The metronome player gained `setClickFilter(fn)` (silence chosen clicks) and `audioNow()` (the audio
  clock taps are timed on) for the Gap trainer; nothing else uses them.
- On the device: `localStorage tml.drills.<tool>` (the chosen level / drill / speed / mode).

## 6. States
Setup: a level chosen (its description under it) · tried before (best line) or not.
Tap tempo: listening (Listen first) · tapping (count, meter) · done (feedback, pad off, Next).
Gap trainer: count-in · playing (bar n, "Silent - keep going") · finished → results.
Ear: waiting (icon) · answered right / wrong (buttons marked, the staff, "It was E") · Play it back:
listening (the note it hears) · nothing heard (after 8 s, or Skip).
Leaving a play screen stops the round (and the mic); it isn't saved.

## 7. Code example
```html
<button type="button" class="drill-pad" id="tapTempoPad">Tap</button>
<div class="drill-meter" aria-hidden="true">
  <div class="drill-meter-track"><span class="drill-meter-mark"></span><span class="drill-meter-needle" style="--pos:-0.4"></span></div>
  <div class="drill-meter-labels"><span>slower</span><span>on it</span><span>faster</span></div>
</div>
```

## 8. Cross-references
[theory-quiz](theory-quiz.md) · [notation](notation.md) · [metronome](metronome.md) · [button](button.md) · [stat-card](stat-card.md)

## 9. Accessibility
- The pad is a `<button>` (Space / Enter tap it) at 4 touch targets; its label says what to do ("Tap",
  "Tap the beat").
- Everything the meter and the beat dots show is also in text: the feedback line (`aria-live="polite"`)
  says faster / slower / on it, "Silent - keep going", and the result.
- Ear's answers are buttons with the note name as their label; right / wrong are marked with a tick or a
  cross as well as colour. The note shown afterwards is a labelled image ("E on the treble staff").
- Timing drills can't be done without timing, so each has a no-pressure part: Tap tempo's *Listen
  first*, the Gap trainer's slowest speed and *3 on, 1 off*. Nothing is timed on the setup screens.
- Reduced motion: the pad and the needle don't animate.

See [accessibility foundation](../foundations/accessibility.md).
