# Admin shell

## 1. Metadata
- **Name:** Admin shell (`admin.css`: `.admin-shell`, `.admin-sidebar*`, `.admin-nav-item`, `.admin-content`, `.admin-intro`, `.admin-link`, `.admin-subtabs`, `.admin-feature*`, `.admin-stat-*`, `.admin-run-*`, `.admin-test-case*`, `.admin-flows-*`, `.admin-feedback-*`, `.admin-badge`, `.admin-chip`, `.admin-*`)
- **Category:** Page layout (admin panel only)
- **Status:** Stable (ML-26 onward)

## 2. Overview
The desktop-first admin panel (`/admin.html`): fixed sidebar + wide content column (max 900px),
with feature cards, stat tiles, data tables, test-run history and the Flows import/export page.
It reuses `tokens.css` and the app's `style.css` components (buttons, modals, form fields).
**Don't** redefine tokens or re-implement app components in `admin.css`.

## 3. Anatomy
`body.admin-body` › `.admin-shell` › `.admin-sidebar` (`.admin-sidebar-head` › `.admin-sidebar-title` (+ `.admin-sidebar-current`) and `.admin-nav-toggle`; `.admin-nav-items` › `.admin-back-link`, `.admin-nav-item` × n with `.admin-nav-count`) › `.admin-content` (`h1`, `.admin-intro`, section content).

## 4. Tokens used
`--bg-color`, `--container-bg`, `--secondary-color`, `--input-bg`, `--input-border`, `--text-color`,
`--label-color`, `--primary-action`, `--success-color`, `--danger-color`, `--warning-color`,
`--nav-action`, `--nav-action-text`, `--status-amber-bg`/`-fg`, `--status-blue-bg`/`-fg`, `--info-text`, `--touch-target`, `--text-on-accent`, `--font-mono`, `--radius-xs`/`-md`/`-pill`,
`--space-*`, `--font-xs`…`--font-lg`, `--font-weight-semibold`, `--font-weight-bold`, `--app-max-width`.

## 5. Props / API
- **Phone width (≤700px, ML-240):** the sidebar becomes a head row - "Admin" + the open section's name (`.admin-sidebar-current`, `--label-color`) and a ☰ `<button class="admin-nav-toggle">` (48px, `--touch-target`, `aria-expanded`/`aria-controls`). Tapping it adds `.expanded` to `.admin-sidebar`, which shows `.admin-nav-items` as a vertical list (each item at least `--touch-target` tall); picking a section or pressing Esc closes it. On wider screens the toggle and current-section label are hidden and the list is the fixed sidebar. Nothing in the panel may make the page wider than the screen: grids use `minmax(0, 1fr)` columns and `.admin-content` wraps long words.
- Tables: wrap in `.admin-stat-table-wrap` so wide tables scroll inside the column (`.admin-content` has `min-width: 0`).
- Status badges: see [pill-badge](pill-badge.md).
- Security review (ML-192, Admin → Security): `.admin-security-toolbar` (run button + live status text), `.admin-security-head` (a check's title and status badge on one line - **not** clickable, unlike `.admin-test-case-head`), `.admin-security-details` (a native `<details>`/`<summary>` disclosure for evidence and run history - the summary is a 48px (`--touch-target`) row in `--info-text`, keeping the browser's disclosure triangle), `.admin-security-evidence` (the evidence list, `--font-xs`).
- The Design page (`.admin-design-*`, `public/admin-design.js`) is page chrome around the design-system specimens. Its own classes are admin-only and never used in the app.

## 6. States
Nav item: default / active (`--secondary-color` + gold left border) / disabled. Phone menu: closed (only the head row) / open (`.admin-sidebar.expanded`). Table row: hover (`--input-bg`) / excluded (`.admin-stat-row-excluded`, `--opacity-muted`).

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
- Admin uses the same `a11y.js`, focus ring and dialog rules. Tables use `<th>` headers; status chips carry their status as text.

See [accessibility foundation](../foundations/accessibility.md).
