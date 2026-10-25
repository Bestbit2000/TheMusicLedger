# Usage heat map

## 1. Metadata
- **Name:** Usage heat map (`admin.css`: `.usage-heat-controls`, `.usage-heat-legend`, `.usage-heat-table`,
  `.usage-heat-name`, `.usage-heat-total`, `.usage-heat-group`, `.usage-heat-cell`, the steps `.usage-heat-0`,
  `.usage-heat-1`, `.usage-heat-2`, `.usage-heat-3`, `.usage-heat-4`, `.usage-heat-link`, `.usage-press-bar`, `.usage-chip-list`, `.usage-chip`)
- **Category:** Data display (admin panel)
- **Status:** New (ML-22)

## 2. Overview
How often each tool, button and screen in the app is used, week by week - counted, never who. It is on
**Admin → Usage**, the first two tabs:

- **Heat map** - the tools down the side (grouped: Everyday, Practice sessions, Practise and learn, Pieces,
  the rest), a week a column, a shaded square per week with its number in it, then Started, Finished and
  Members. "Showing" switches to buttons pressed (a row per tool) or screens opened. A tool's name opens
  **its buttons**: every button pressed, most first, with a bar, how much was in a session and members, then
  the buttons never pressed as chips.
- **Quiet corners** - what is switched on for members but hardly used, the buttons never pressed (a
  `<details>` per tool, chips inside) and the screens never opened.

The owner chose this layout from two on 25 Oct 2026 (Option A - "one heat map, every item by week"; the
canvas is linked from `docs/usage-stats.md`). The admin panel is desktop first: the grid scrolls sideways in
its box on a narrow window and the names keep their room.

**Use** it for counts over weeks for many items at once. **Don't use** it for one amount against a limit (the
[usage bar](usage-bar.md)) or for a member's own practice days (the Stats page's heat map, `.h-time-*`).

## 3. Anatomy
- `.usage-heat-controls` - a row of labelled `<select>`s (Showing, Where, When, Who), and on the right
  `.usage-heat-legend`: "None", five small `.usage-heat-cell`s from 0 to 4, "More".
- `table.usage-heat-table` › `thead` (a `th` per week, "3 Aug") › per group a `tr.usage-heat-group` (its name in
  a `th colspan`) › a `tr` per item: `td.usage-heat-name` (the name; a `button.usage-heat-link` when it opens a
  tool), a `td` per week holding `span.usage-heat-cell.usage-heat-N` with the number (blank for none), then
  `td.usage-heat-total` for Started, Finished and Members.
- A tool: `button.usage-heat-link` "← Heat map" › title › controls › `.admin-stat-tiles` › `table.admin-stat-table`
  (Button, Where, Pressed - the number over a `span.usage-press-bar` whose length is `--bar-w`, In a session,
  Members) › "Not pressed" › `ul.usage-chip-list` › `li.usage-chip`.
- Quiet corners: controls › `table.admin-stat-table` (features) › `details.admin-security-details` per tool with a
  `ul.usage-chip-list` › the screens as a `ul.usage-chip-list`.

The steps are fixed counts, so a week can be compared with another: none, 1-4, 5-14, 15-39, 40 or more.

## 4. Tokens used

| Part | Token |
|---|---|
| Square, steps 0-4 | `--heat-time-0` to `--heat-time-4` (the Stats page's gold ramp) |
| The number in a square | `--heat-text-0` to `--heat-text-4` (new: dark on the light steps, light on the dark - and the other way round in dark mode, where the ramp gets lighter towards the top) |
| Square size, gap | `--space-6`, `--space-1`; legend squares `--space-5` |
| Square corner | `--radius-sm` |
| Number size | `--font-xs`, tabular figures |
| Name column | at least `--space-6` × 8 |
| Group line | `--input-border` |
| Link | `--link-color` |
| Press bar | `--heat-time-4`, `--space-2` high, `--radius-pill` |
| Chip | `--input-border`, `--radius-pill`, `--font-sm` |

## 5. Props / API
`GET /api/admin/usage/heatmap?kind=use|tap|view&place=all|own|session&who=members|everyone|all&weeks=4|12|26`,
`GET /api/admin/usage/tool?name=<tool>&who&days=7|30|90`, `GET /api/admin/usage/quiet?days&below=1|5|10&who`
(`server/services/usageReport.js`; the sums `usageReportRules.js`). In `admin.js`: `reloadUsageHeatmap`,
`renderUsageHeatmap`, `renderUsageTool`, `reloadUsageQuiet`, `initUsageHeatmap`.

## 6. States
- **Nothing counted yet:** every square blank, the line under the title says "Nothing has been counted here
  yet." Once counting has begun it says the day, so an empty week before it isn't read as nobody.
- **Rounds kept since launch** (Theory, Pitch, Tempo, Pulse, Rhythm, Range) are marked so, and only shown with
  "On its own and in a session" - where they were played isn't kept.
- **Members** is the most in one day, never a sum - the counts never say who.
- **A tool with nothing pressed:** one table row says so; every button is then listed as not pressed.

## 7. Code example
```html
<table class="usage-heat-table">
  <thead><tr><th class="usage-heat-name" scope="col">Tool</th><th scope="col">12 Oct</th><th scope="col">19 Oct</th><th scope="col">Started</th><th scope="col">Finished</th><th scope="col">Members</th></tr></thead>
  <tbody>
    <tr class="usage-heat-group"><th colspan="6" scope="colgroup">Everyday</th></tr>
    <tr><td class="usage-heat-name"><button type="button" class="usage-heat-link">Metronome</button></td>
      <td><span class="usage-heat-cell usage-heat-3">21</span></td><td><span class="usage-heat-cell usage-heat-4">42</span></td>
      <td class="usage-heat-total"><strong>63</strong></td><td class="usage-heat-total">81%</td><td class="usage-heat-total">4</td></tr>
  </tbody>
</table>
```

## 8. Cross-references
[usage-bar](usage-bar.md) · `docs/usage-stats.md` · `docs/usage-buttons.md` · `specs/foundations/color.md`

## 9. Accessibility
- A real table: weeks are column headers, each group a `colgroup` header; a screen reader reads "Metronome,
  19 Oct, 42".
- Never colour alone: every square has its number; the legend is decoration (`aria-hidden`).
- The numbers pass 4.5:1 on every step in both themes (`--heat-text-N` on `--heat-time-N` in
  `specs/accessibility/contrast-pairs.json`); the press bar passes 3:1 against the card.
- Every control is a labelled `<select>` or a `<button>`; opening a tool moves the keyboard to "← Heat map",
  and back puts it on the tool's name again.
