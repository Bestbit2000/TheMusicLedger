# Pill / badge

## 1. Metadata
- **Name:** Pill / badge (`.flow-pill`, `.notif-count`, `.filter-strip-badge`, `.metroSeg-count-badge`, `.admin-badge`, `.admin-chip`, `.admin-stat-pill`, `.admin-feedback-badge`, `.notification-status-*`, `.status-*`, `.admin-nav-count`)
- **Category:** Data display
- **Status:** Stable. Several near-duplicates should converge on the variants below

## 2. Overview
A small non-interactive label for a count, status or tag. `--radius-pill` is reserved for these
(and filter pills). **A pill is never a button.**

| Variant | Surface | Use |
|---|---|---|
| Neutral tag | `--input-bg` + 1px `--input-border`, `--label-color` text | Metadata ("Band", "3 blocks") |
| Count | `--danger-color` + `--text-on-accent` | Unread counts |
| Accent count | `--primary-action` + `--primary-action-text` | Active-filter count |
| Status (admin) | `--success-color` / `--danger-color` / `--nav-action` / `--input-border` | pass / fail / skipped / never |
| Status (admin, security review) | `--status-amber-bg`/`-fg` (`.admin-badge.warn`), `--status-blue-bg`/`-fg` (`.admin-badge.info`) | warn / info - ML-192 check results that are neither a pass nor a failure |
| Chip (admin) | `--secondary-color` | Feature/account tags |

## 3. Anatomy
`span` › text (optionally uppercase for admin status).

## 4. Tokens used
`--radius-pill` (`--radius-sm` for the square-ish `.metroSeg-count-badge`), `--space-0-5`,
`--space-1`, `--space-2`, `--space-3`, `--font-xs`, `--font-sm`, `--font-weight-bold`, plus the
colours above.

## 5. Props / API
None. Purely presentational.

## 6. States
Static. Variant is chosen by meaning, not toggled.

## 7. Code example
```html
<span class="flow-pill">Band</span>
<span class="admin-badge pass">Pass</span>
```

## 8. Cross-references
[filter-strip](filter-strip.md) · [notification-centre](notification-centre.md) · [admin-shell](admin-shell.md)

## 9. Accessibility
- Text badges are read as part of their parent; a count needs context in the parent's name ("Notifications, 2 unread").
- Status colour is never the only cue - the badge text says the status.

See [accessibility foundation](../foundations/accessibility.md).
