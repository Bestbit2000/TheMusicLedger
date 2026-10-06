# Admin shell

## 1. Metadata
- **Name:** Admin shell (`admin.css`: `.admin-shell`, `.admin-sidebar*`, `.admin-nav-item`, `.admin-nav-group*`, `.admin-nav-fold`, `.is-nav-folded`, `.admin-dash-*`, `.admin-content`, `.admin-intro`, `.admin-link`, `.admin-subtabs`, `.admin-feature*`, `.admin-stat-*`, `.admin-run-*`, `.admin-test-case*`, `.admin-flows-*`, `.admin-feedback-*`, `.admin-badge`, `.admin-chip`, `.admin-*`, `.admin-accounts-table`)
- **Category:** Page layout (admin panel only)
- **Status:** Stable (ML-26 onward)

## 2. Overview
The desktop-first admin panel (`/admin.html`): fixed sidebar + wide content column (max 900px),
with feature cards, stat tiles, data tables, test-run history and the Flows import/export page.
It reuses `tokens.css` and the app's `style.css` components (buttons, modals, form fields).
**Don't** redefine tokens or re-implement app components in `admin.css`.

## 3. Anatomy
`body.admin-body` › `.admin-shell` › `.admin-sidebar` (`.admin-sidebar-head` › `.admin-sidebar-title` (+ `.admin-sidebar-current`) , `.admin-nav-fold` and `.admin-nav-toggle`; `.admin-nav-items` › `.admin-back-link`, the Dashboard `.admin-nav-item`, then `.admin-nav-group` × 4 › `button.admin-nav-group-head` (`.admin-nav-group-name`, a `.admin-nav-count`, an arrow icon) + `.admin-nav-group-items` › `.admin-nav-item` × n with `.admin-nav-count`) › `.admin-content` (`h1`, `.admin-intro`, section content).

## 4. Tokens used
`--bg-color`, `--container-bg`, `--secondary-color`, `--input-bg`, `--input-border`, `--text-color`,
`--label-color`, `--primary-action`, `--success-color`, `--danger-color`, `--warning-color`,
`--nav-action`, `--nav-action-text`, `--status-amber-bg`/`-fg`, `--status-blue-bg`/`-fg`, `--info-text`, `--touch-target`, `--text-on-accent`, `--font-mono`, `--radius-xs`/`-md`/`-pill`,
`--space-*`, `--font-xs`…`--font-lg`, `--font-weight-semibold`, `--font-weight-bold`, `--app-max-width`.

## 5. Props / API
- **The menu stays put (ML-277):** on a desktop `.admin-sidebar` is sticky at the top, the height of the window, and
  scrolls by itself if it is taller - only the page beside it scrolls. On a phone it is part of the page as before.
- **Phone width (≤700px, ML-240):** the sidebar becomes a head row - "Admin" + the open section's name (`.admin-sidebar-current`, `--label-color`) and a ☰ `<button class="admin-nav-toggle">` (48px, `--touch-target`, `aria-expanded`/`aria-controls`). Tapping it adds `.expanded` to `.admin-sidebar`, which shows `.admin-nav-items` as a vertical list (each item at least `--touch-target` tall); picking a section or pressing Esc closes it. On wider screens the toggle and current-section label are hidden and the list is the fixed sidebar. Nothing in the panel may make the page wider than the screen: grids use `minmax(0, 1fr)` columns and `.admin-content` wraps long words.
- Tables: wrap in `.admin-stat-table-wrap` so wide tables scroll inside the column (`.admin-content` has `min-width: 0`).
- Status badges: see [pill-badge](pill-badge.md).
- Security review (ML-192, Admin → Security): `.admin-security-toolbar` (run button + live status text), `.admin-security-head` (a check's title and status badge on one line - **not** clickable, unlike `.admin-test-case-head`), `.admin-security-details` (a native `<details>`/`<summary>` disclosure for evidence and run history - the summary is a 48px (`--touch-target`) row in `--info-text`, keeping the browser's disclosure triangle), `.admin-security-evidence` (the evidence list, `--font-xs`).
- The Design page (`.admin-design-*`, `public/admin-design.js`) is page chrome around the design-system specimens. Its own classes are admin-only and never used in the app.

### Table pages: Accounts and Flows (ML-415, ML-416)

- **Full width.** Like Feature access, the Accounts and Flows pages drop `.admin-content`'s 900px cap so their
  tables use the window; their intro text keeps it.
- **One line per row** in an `.admin-stat-table` (`.admin-accounts-table`: text columns read from the left;
  `.admin-flows-table`), inside `.admin-stat-table-wrap` so it scrolls sideways on a phone.
- **A ⋮ on each row** (`.list-item-menu-btn`, the app's own) opens **one shared floating menu**
  (`#adminRowMenu`: `.dropdown-menu.account-band-menu` of `.dropdown-item`s with an icon - `openRowMenu` in
  admin.js). A link item (View, Edit) opens a new tab; a destructive one takes `.account-band-menu-delete`. It
  closes on a pick, a click elsewhere, Escape (focus goes back to the ⋮) or the page scrolling.
- **Accounts:** Name, Email, Account type, Signs in with, Joined, Last seen (ML-443: Today / Yesterday / N days
  ago, "Not yet" until the member next uses the app, and a "Lapsed" `.admin-feedback-badge` after 30 days; the
  filter strip has Seen this week and Not seen for 30 days). A search (name or email) and the standard
  [filter strip](filter-strip.md): All, each account type that has someone, Google only, Email + password,
  Invites not accepted - each with its count. An invite that hasn't been accepted is a line too ("Invited").
  The ⋮: Change account type (a pop-up of `.flow-choice-option`s, the current one selected - it saves on a
  pick), Send a reset link, Unlock, Turn off two-step (each only when it applies), Sign out everywhere; an
  invite's ⋮: Cancel invite.
- **Flows:** the ⋮ holds View, Edit, Publish / Unpublish (not a band's piece) and Export - they were four
  buttons a row.
- **Third parties (ML-462):** each card can hold the owner's own **reference and note** (shown as
  `.admin-run-notes` lines; a `.admin-stat-exclude-btn` opens the `#partyRecordModal` form), and each "Needs
  attention" line has a `.admin-stat-exclude-btn` **Mark as done** - it then reads "Dealt with <date>" in
  `.text-muted` with **Undo**. No new classes.
- **Features (ML-414):** there is no Features page any more - the catalogue is folded into
  [Feature access](admin-feature-access.md): "+ Add feature" in its toolbar, and each feature's ⋮ has Edit (name,
  description, key) and Delete. The form has no Enabled switch - that was the same switch as **Live** in the grid.
  The panel opens on the Dashboard (ML-443).

### The menu in groups (ML-443)

- **Four groups, by the job being done**, with the Dashboard above them: **Members** (Accounts, Bands, Feature
  access, Notifications, Feedback), **Content** (Flows, Warm-ups, Rest messages, Theory grades, Metadata lists),
  **Business** (Business case, Costs and usage, Usage) and **Release and checks** (Release tests, Security,
  Third parties, Design). A new page goes in the group whose job it does.
- **A heading opens and closes its group.** It is a `<button>` with `aria-expanded` and `aria-controls`, at
  least `--touch-target` tall, in `--label-color`; its arrow points down when open and right when shut. Which
  groups are shut is remembered on that device (`localStorage`, a convenience - the menu works without it).
  Going to a page opens its group.
- **A shut group still says something is waiting.** Feedback (not looked at), Costs and usage (a limit getting
  near or nearly full) and Third parties (needs attention) carry a `.admin-nav-count`; a shut group's heading
  shows the total of the counts inside it. Open, the heading shows none - the items do.
- **The whole menu folds away on a wide screen** - `.admin-nav-fold` (the double arrow beside "Admin") puts
  `.is-nav-folded` on `.admin-shell`: the sidebar becomes a strip holding only that button, and a wide table
  gets the window. Remembered on the device. On a phone the button is hidden - the ☰ toggle does that job.
- **Every page has its own address** (`admin.html#accounts`). A reload stays on the page, Back and Forward
  work, and a link can go straight to a page. No address means the Dashboard.
- **Costs and usage** is its own page (it was the top of Third parties); the same server answer draws both.

### Dashboard (ML-443)

The page the panel opens on (`public/admin-dashboard.js`, `/api/admin/dashboard`,
`server/services/adminDashboard.js`, rules tested in `server/test/adminDashboard.test.js`). Four blocks, each
an `.admin-stat-section-title` over `.admin-stat-tiles`:

- **People** - members (by account type), new this week (and invites not accepted), members active in the last
  7 days (with how many practised, and how many have lapsed - seen before, but not for 30 days), practice
  logged this week. "Active" is read from `accounts.last_seen_on`, the day a member last used the app.
- **The build** - version and release date, the last back-test run, features on for Standard members, days to
  the launch month set in the business case.
- **Money** - spent so far and costing now (Costs and usage), and the forecast and payback month of the
  scenario marked "where I am now" in the business case.
- **Needs you** - one list of what is waiting: failing back-tests, a limit getting near, a security review
  due, feedback not looked at, third-party items needing attention. Empty says "Nothing needs you today."

How it is built:

- **A box is a button** - `button.admin-stat-tile.admin-dash-tile` (the stat tile's own look, with `span`s
  inside) that opens the page behind it; its edge darkens on hover. A figure that is up or down borrows
  `.admin-bc-good` / `.admin-bc-bad` from the [business case](admin-business-case.md).
- **Needs you** is `.admin-feature.admin-dash-needs` › `button.admin-dash-need` rows: an `.admin-badge`
  (**Now** `fail`, **Soon** `warn`, **Waiting** `info`), the words (`.admin-dash-need-text`) and a
  chevron. The badge's word carries the urgency, not its colour alone.
- It reads only what the app already holds and stores nothing. A block the server couldn't read says so and
  the rest still shows. It is read again each time the page is opened.

## 6. States
Menu group: open / shut (heading `aria-expanded`, count shown only when shut). Whole menu: shown / folded (`.admin-shell.is-nav-folded`, wide screens only). Dashboard box and Needs-you row: default / hover / focus. Nav item: default / active (`--secondary-color` + gold left border) / disabled. Phone menu: closed (only the head row) / open (`.admin-sidebar.expanded`). Table row: hover (`--input-bg`) / excluded (`.admin-stat-row-excluded`, `--opacity-muted`).

## 7. Code example
```html
<div class="admin-shell">
  <nav class="admin-sidebar"><div class="admin-sidebar-title">Admin</div>
    <button class="admin-nav-item active">Release tests</button></nav>
  <main class="admin-content"><h1>Release tests</h1><p class="admin-intro">…</p></main>
</div>
```

## 8. Cross-references
[tabs](tabs.md) · [stat-card](stat-card.md) · [pill-badge](pill-badge.md) · [modal](modal.md)

## 9. Accessibility
- The ☰ toggle is a real `<button>` with an accessible name that says what it does ("Show admin sections" / "Hide admin sections") and `aria-expanded`; Esc closes the open list and returns focus to the toggle.
- A group heading and the fold-away button are real `<button>`s with `aria-expanded` (the fold button's name says what it will do: "Hide the admin menu" / "Show the admin menu"); a shut group's items are hidden from everyone, not just from view. Dashboard boxes and Needs-you rows are `<button>`s at least `--touch-target` tall, read as "label, figure, detail".
- Admin uses the same `a11y.js`, focus ring and dialog rules. Tables use `<th>` headers; status chips carry their status as text.

See [accessibility foundation](../foundations/accessibility.md).
