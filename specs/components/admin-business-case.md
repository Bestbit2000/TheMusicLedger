# Admin business case

## 1. Metadata
- **Name:** Admin business case (`admin.css`: `.admin-bc-settings`, `.admin-bc-cards`, `.admin-bc-card`, `.admin-bc-card-name`, `.admin-bc-card-value`, `.admin-bc-card-line`, `.admin-bc-good`, `.admin-bc-bad`, `.admin-bc-head`, `.admin-bc-table`, `.admin-bc-text`, `.admin-bc-group`, `.admin-bc-total`, `.admin-bc-off`, `.admin-bc-fields`, `.admin-bc-field`, `.admin-bc-num`, `.admin-bc-income`, `.admin-bc-income-head`, `.admin-bc-chart-card`, `.admin-bc-chart-host`, `.admin-bc-chart`, `.admin-bc-chart-grid`, `.admin-bc-chart-zero`, `.admin-bc-chart-other`, `.admin-bc-chart-line`, `.admin-bc-chart-dot`, `.admin-bc-chart-end`, `.admin-bc-chart-tip`, `.admin-bc-chart-tip-row`, `.admin-bc-*`, `.is-current`)
- **Category:** Admin panel page
- **Status:** New (ML-443, 2026-10-06)

## 2. Overview
Admin → Business case: what each way of rolling the app out costs and could earn, month by month for
up to five years, and when the money comes back. The owner changes any figure and everything redraws;
changes wait in the Save bar. The sums are `public/businessCase.js`; the page is
`public/admin-business.js`; the rules are in [docs/business-case.md](../../docs/business-case.md).

It is built from pieces the panel already has: stat tiles (`.admin-stat-tiles`), tables
(`.admin-stat-table`), sub-tabs (`.admin-subtabs`), small buttons (`.admin-stat-exclude-btn`), the
[toggle switch](toggle-switch.md), status badges (`.admin-badge`), disclosures
(`.admin-security-details`), the Save bar from [Feature access](admin-feature-access.md)
(`.admin-access-savebar`) and the value box (`.metroBlk-ctrl-value-btn`) that opens a pop-up. Only what
is new to this page has an `.admin-bc-` class.
**Don't use** these classes anywhere else, and don't add a chart library: the chart is one small SVG.

## 3. Anatomy
- **Plan settings** - `.admin-bc-settings`: a row of value boxes (launch month, years to look at, dollars
  to the pound, how it is counted). Each opens a pop-up.
- **Tabs** - `.admin-subtabs`: Overview, then one per scenario (the `role="tablist"` group, which wraps on a
  narrow screen), and beside them **+ Add a scenario** - an `.admin-subtab-item` outside the tablist, since
  it is an action, not a tab. The owner can have as many scenarios as he likes.
- **Overview**
  - Today: `.admin-stat-tiles` (members, spent so far, costing now, the database's free hours).
  - The scenarios: `.admin-bc-cards` › `button.admin-bc-card` (`.admin-bc-card-name`, `.admin-bc-card-value`,
    `.admin-bc-card-line` × 2). The one the owner is in now has `.is-current`. A card opens its scenario.
  - The chart: `.admin-bc-chart-card` › `.admin-bc-head` (title, the verdict in words, a value box choosing
    the scenario shown in gold) › `.admin-bc-chart-host` › `svg.admin-bc-chart` + `.admin-bc-chart-tip`.
  - The comparison table: `.admin-stat-table.admin-bc-table`, a row per scenario.
  - Two disclosures with `.admin-bc-fields`: how the database cost is worked out, and what is taken from
    each payment.
- **A scenario**
  - `.admin-bc-head`: its name, what it is, **Rename** and **Copy** (`.admin-stat-exclude-btn` - the two
    things done most, so they are not hidden in a menu), and a ⋮ (`.list-item-menu-btn`, the shared
    `#adminRowMenu`) for the rest: This is where I am now, Move earlier, Move later, Delete this scenario.
    Two scenarios can't have the same name. A copy is suggested the name "<name> - copy" and opens at once.
  - `.admin-stat-tiles`: where it ends, when the money is back, the most out of pocket, the running cost,
    the paying members that cover it, the paying share that would get the money back.
  - Members: `.admin-bc-fields` › `label.admin-bc-field` › `input.admin-bc-num`, one per year.
  - Costs: `table.admin-stat-table.admin-bc-table` - a `tr.admin-bc-group` per group with its total, then a
    row per cost: a toggle (in or out), the name with its basis badge, note and source link
    (`th.admin-bc-text`), the amount, when it is paid, what it comes to over the plan, and Change. A cost
    that is left out is `tr.admin-bc-off`.
  - Income: a `.admin-bc-income` block per kind (`.admin-bc-income-head`: toggle, name, total; then
    `.admin-bc-fields`). Left out = `.admin-bc-off`.
  - Year by year and month by month: `.admin-bc-table` with `tr.admin-bc-total` for Money out, Money in
    and Result.
- **Save bar** - `.admin-access-savebar`, shown while there are changes.

## 4. Tokens used
`--container-bg`, `--input-bg`, `--input-border`, `--control-border`, `--text-color`, `--label-color`,
`--primary-action-strong` (the chosen line, its dots, the current card's edge), `--success-text` /
`--danger-text` (a result that is up / down), `--info-text` (source links), `--touch-target`,
`--radius-sm`, `--radius-md`, `--shadow-md`, `--z-raised`, `--opacity-muted`, `--space-0-5`…`--space-5`,
`--font-xs`, `--font-sm`, `--font-lg`, `--font-xl`, `--font-sans`, `--font-weight-normal`,
`--font-weight-semibold`, `--font-weight-bold`.

## 5. Props / API
- **Width.** Like the other table pages it uses the whole width beside the menu; its reading text, tiles and
  boxes keep 900px. Tables scroll sideways inside `.admin-stat-table-wrap` on a narrow screen.
- **One button, one pop-up.** Every choice from a list (years, how it is counted, how Premium is paid, which
  year to show month by month, the scenario in gold) is a value box that opens `#bcChoiceModal`; it is made
  on a pick. Short forms (launch month, the dollar rate, a scenario's name, a new kind of income) open
  `#bcFormModal`; a cost opens `#bcCostModal`. A yes/no (a cost or an income in or out) is the toggle switch.
- **Up or down.** `.admin-bc-good` / `.admin-bc-bad` colour a result green or red. The figure always carries a
  plus or minus sign as well.
- **A cost's basis** is an `.admin-badge`: Paying now (`pass`), Published price (`info`), Estimate (`warn`),
  Mine (`never` - the owner typed it). A changed figure shows what it was underneath.
- **The chart** (`drawChart`, admin-business.js) is drawn at the width of its box and redrawn on resize.
  Every scenario's running total is a line: the chosen one `.admin-bc-chart-line` (3px,
  `--primary-action-strong`) with a dot at the end and at the month the money is back; the others
  `.admin-bc-chart-other` (1px, `--label-color`), numbered at the right in tab order. `.admin-bc-chart-grid`
  is a grid line; `.admin-bc-chart-zero` the nought line, the launch line and the pointer's line.
  The read-out `.admin-bc-chart-tip` is placed with the run-time properties `--tip-x` / `--tip-y`.
- **Numbers typed into a box** change the plan at once and redraw what is worked out; the box itself is left
  alone, so typing isn't interrupted.

## 6. States
Card: default / current (`.is-current`). Cost row and income block: in / left out (`.admin-bc-off`). Result:
up (`.admin-bc-good`) / down (`.admin-bc-bad`) / nought. Save bar: hidden / shown / saving (Save disabled).
Chart read-out: hidden / shown at a month.

## 7. Code example
```html
<div class="admin-bc-cards">
  <button type="button" class="admin-bc-card is-current">
    <span class="admin-bc-card-name">2. Invite only · where I am now</span>
    <span class="admin-bc-card-value admin-bc-bad">−£2,863</span>
    <span class="admin-bc-card-line">No income: costs only</span>
    <span class="admin-bc-card-line">£40.93 a month once going</span>
  </button>
</div>
<div class="admin-bc-fields">
  <label class="admin-bc-field">At launch<input type="number" class="admin-bc-num" min="0" value="40"></label>
</div>
```

## 8. Cross-references
[admin-shell](admin-shell.md) · [admin-feature-access](admin-feature-access.md) (the Save bar) ·
[toggle-switch](toggle-switch.md) · [modal](modal.md) · [tabs](tabs.md) · [pill-badge](pill-badge.md) ·
[charts](charts.md) (the app's bar charts - not used here)

## 9. Accessibility
- Every switch says what it includes and where ("Include Insurance in Premium"); every number box is inside
  its own label; a value box has `aria-haspopup="dialog"`; the ⋮ has a name and `aria-haspopup="menu"`.
- The tabs are `role="tab"` with `aria-selected`. The Save bar is a named region and its text is `aria-live`.
- A result's direction is never colour alone: it has a plus or minus sign, and the verdict is written out in
  words ("not paid back within 5 years...").
- The chart is `role="img"` with a label, and can be read without a pointer: focus it and use the left and
  right arrow keys to move month by month; the read-out is `role="status"`. Every figure in it is also in
  the comparison table underneath and in each scenario's year-by-year table.
- Number boxes and cards are at least 44px (`--touch-target`) tall. The chosen line and the grey lines meet
  3:1 against the chart's background in both themes (`specs/accessibility/contrast-pairs.json`).

See [accessibility foundation](../foundations/accessibility.md).
