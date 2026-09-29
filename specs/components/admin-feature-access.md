# Admin feature access

## 1. Metadata
- **Name:** Admin feature access (`admin.css`: `.admin-access-toolbar`, `.admin-access-table`, `.admin-access-group`, `.admin-access-live`, `.admin-access-cell`, `.admin-access-copy`, `.admin-access-row`, `.admin-access-savebar`, `.is-changed`)
- **Category:** Admin panel page
- **Status:** New (ML-345, 2026-09-29)

## 2. Overview
Admin → Feature access: which account types can use each feature (`feature_access`), plus **Live**
(`features.enabled`, the master switch). Two layouts: **All account types**, a grid of every feature
against every type, and **one account type** at a time, a list of switches (the one that suits a
phone). Changes wait in a Save bar and are saved together, because they change production for real
people. The rules are in [docs/feature-access-plan.md](../../docs/feature-access-plan.md).
**Don't use** it for anything but feature access. Other admin tables stay `.admin-stat-table`.

## 3. Anatomy
- `.admin-subtabs` (role `tablist`) › `.admin-subtab-item` - All account types, then one per type.
- `.admin-access-toolbar` - the count ("Standard member - 15 of 37 features on"), **Copy from…** (one type only), **Preview the app as…** + Preview.
- **Grid:** `.admin-stat-table-wrap` › `table.admin-stat-table.admin-access-table`
  - `thead`: Feature, Live (`.admin-access-live`), one column per type. Beta tester's header has `.admin-access-copy` ("Same as Premium", copies once).
  - `tbody`: a `tr.admin-access-group` › `th[scope=rowgroup]` per group (Tools - Everyday / Practise / Learn, Practice sessions, Menu, My music, Metronome and tuner, Core and other), then a row per feature:
    - `th[scope=row]` - the name and its description (`small`, two lines, the whole text in its title), sticky on the left
    - Live - a `.toggle-switch`
    - one `label.admin-access-cell` › checkbox per type; Super admin's are ticked and disabled
- **One type:** `.admin-stat-section-title` per group › `.admin-access-row` per feature (name, description, `.toggle-switch`).
- `.admin-access-savebar` (sticky at the bottom, hidden with nothing to save): "N changes not saved yet", Discard, Save.

## 4. Tokens used
`--container-bg`, `--input-bg`, `--input-border`, `--text-color`, `--label-color`, `--primary-action`
(checkbox accent, the changed outline), `--touch-target` (each cell), `--icon-md` (the checkbox),
`--radius-sm`, `--radius-md`, `--shadow-md` (the Save bar), `--z-sticky` (the feature column),
`--z-float` (the Save bar), `--space-1`…`--space-4`, `--font-xs`, `--font-weight-normal`,
`--font-weight-bold`.

## 5. Props / API
- A changed cell or row gets `.is-changed` (a `--primary-action` outline) until it's saved or discarded.
- The grid scrolls sideways inside `.admin-stat-table-wrap` on a narrow screen, with the feature column staying put.
- Copy from… and Same as Premium only fill in the waiting changes - nothing is saved until Save.
- Preview opens the app in a new tab as that type (`/?preview=<type>`, kept for the tab). The app shows a `.level-notice` banner with Stop previewing, and the server honours the preview for super admins only.

## 6. States
Cell: on / off / changed (`.is-changed`) / locked (Super admin, disabled). Live: on / off (off = the row is off for everyone; one-type rows say so). Save bar: hidden / shown with a count / saving (Save disabled).

## 7. Code example
```html
<table class="admin-stat-table admin-access-table">
  <thead><tr><th scope="col">Feature</th><th scope="col" class="admin-access-live">Live</th><th scope="col">Standard member</th></tr></thead>
  <tbody>
    <tr class="admin-access-group"><th scope="rowgroup" colspan="3">Tools - Practise</th></tr>
    <tr><th scope="row"><strong>Rehearse</strong><small>Play your pieces along with the metronome</small></th>
      <td class="admin-access-live"><label class="toggle-switch"><input type="checkbox" checked aria-label="Rehearse live for everyone"><span class="toggle-slider"></span></label></td>
      <td><label class="admin-access-cell is-changed"><input type="checkbox" aria-label="Rehearse for Standard member"></label></td></tr>
  </tbody>
</table>
```

## 8. Cross-references
[admin-shell](admin-shell.md) · [tabs](tabs.md) · [toggle-switch](toggle-switch.md)

## 9. Accessibility
- Every checkbox and switch has a name saying which feature and which type ("Rehearse for Standard member"); Super admin's say "(always)" and are disabled.
- Each cell is a 44px (`--touch-target`) label round its checkbox. The grid uses `th` for columns, rows and groups.
- The tabs are `role="tab"` with `aria-selected`. The Save bar is a named region, and its count is `aria-live`.
- A change is shown by the checkbox itself and by the outline - never colour alone.

See [accessibility foundation](../foundations/accessibility.md).
