# Drills (Tempo, Pulse, Pitch)

On screen the three tools are **Tempo**, **Pulse** and **Pitch** (tool groups, 2026-09-26). In the code, ids, features and
this spec's history they are Tap tempo (`tapTempo`, `tap_tempo`), Gap trainer (`gapTrainer`, `gap_trainer`) and
Ear (`ear`, `ear_training`).

## 1. Metadata
- **Name:** Drills (`.drill-pad`, `.drill-feedback`, `.drill-meter`, `.drill-meter-track`, `.drill-meter-mark`, `.drill-meter-needle`, `.drill-meter-labels`, `.drill-beats`, `.drill-bar`, `.drill-beat`, `.drill-listen`, `.drill-ear-icon`, `.drill-result-list`, `.is-hit`; states `.is-silent`, `.is-now` on `.drill-beat`)
- **Category:** Tool screen
- **Status:** New (ML-298, ML-295, ML-296)

## 2. Overview
**Rhythm (ML-306)** shares this screen set too: its setup screen adds a `.flow-tile-grid.flow-tile-grid-3` of `.flow-picker-tile` rhythms (each a small Bravura stave, its name and Level) and an optional "your own word" field; its play screen is `.theory-status`, the bar on a `.scales-staff` (the note playing `.is-now`), `.drill-feedback`, the `.drill-pad` (Tap) and Stop; its rounds use the drill results screen. Rules: [`public/rhythm.js`](../../public/rhythm.js), docs/rhythm.md.

The drill tools (Pitch, Tempo, Pulse, and Rhythm - see docs/rhythm.md), built on one engine
([`public/drills.js`](../../public/drills.js)) and one results screen. **They open from Skills (ML-406)** - one
tile in All tools › Learn, between Theory and Range - not from tiles of their own.

0. **The Skills list** (`#skillsHubView`, `renderSkillsHub`): Theory's list, reused as it is - a
   `.theory-quiz-row` per tool that's switched on (a Material icon in `.theory-quiz-icon`, the name, one line
   saying what it is) with the Level of the last round played (`.level-chip`) or a "New" pill. Back from a tool
   lands here; the results screen's **Another skill** comes back here too.
1. **A setup screen**: a short intro (`.theory-intro`), then **one value box per option, two to a row**
   (`.metro-transport-grid.metro-transport-grid-2` › `.metroBlk-ctrl-value-btn`: the choice over what it is -
   as Theory's options, owner 3 Oct 2026: rows of pills were overwhelming). A box opens the choice pop-up
   (`#flowChoiceModal`), where **each choice has its explanation under it** (what the help line under the
   pills used to say). Rhythm's "rhythm" box opens the same pop-up holding the set's notation tiles
   (`.flow-tile-grid-3` › `.flow-picker-tile`); its "your own word" is a `.btn-text` link to the prompt
   pop-up, nothing more. Then your best with those options as a Level (`.theory-best-line`), the SmartLearn
   strip where it applies, **Start** (`.btn-submit`), and **What I've played** - Theory's rows again: a row per
   set of options played, newest first, with its last Level; a row opens the set pop-up (`#theorySetModal`:
   its last rounds as Level bars, then "Use these options").
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
3. **The results screen** (`#drillResultsView`, shared): **a Level 1-5, exactly as Theory's (ML-406)** - the
   five steps with yours ringed (`.theory-steps`), a positive best-line ("Level 3 · your best yet with these
   options"), a stat card or two that says what happened without a score ("Right 8 out of 10", "Drift in the
   gaps"), a line per speed / gap / note (`.drill-result-list`), **My last rounds** as Level bars
   (`.theory-level-trend` › `.theory-level-bars`), **Again**, then **Change options / Another skill / Home**
   (`.theory-exits`). No score and no "grade" on screen; the stored column is still `grade`. **Rhythm** shows the
   rhythm's own Level (the fastest Level speed it's been played well at) and says "Level 2 reached" or what's
   next; a Rhythm round has no Level of its own, so it has no last-rounds bars.

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

### SmartLearn (ML-399)
Pitch and Tempo carry Theory's SmartLearn pieces unchanged ([theory-quiz](theory-quiz.md)): the strip
(`.smartlearn-note`, `.is-on` = "SmartLearn applied") on their setup screens under the best line, and on
the shared results screen its box (`#drillResultSmartBox`, plain outline) just above Again - "SmartLearn
will bring back 2 notes you took a little longer over". Both have Learn more (`#smartLearnModal`). Pulse
and Rhythm don't show them. No new classes.

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
