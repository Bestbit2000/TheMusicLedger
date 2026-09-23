# Color

Status: stable. Tokens: [token-reference.md#surfaces](../tokens/token-reference.md).

## Principles

- **Gold is the one brand accent.** `--primary-action` marks the primary action, the selected
  state, and the thing the user is currently working on. Don't use it for decoration.
- **Silver is navigation.** `--nav-action` buttons move you somewhere. Gold buttons do something.
- **Colour always has a semantic job.** Pick the alias by what the colour *means*, not what it
  looks like. `--danger-color` is for destructive or error, and nothing else is red.
- **Every colour works in both themes.** Components reference aliases only, and `body.dark-mode`
  remaps them. A component never hardcodes a dark-mode colour.

## Roles

| Role | Tokens | Rule |
|---|---|---|
| Page / surfaces | `--bg-color`, `--container-bg`, `--secondary-color`, `--input-bg` | `--input-bg` means "you can tap/type here". Display-only cards use `--container-bg` so dark mode separates the two |
| Text | `--text-color`, `--label-color` | One body colour, one muted colour. No other greys for text (`#666`/`#888` etc. are drift, so use `--label-color`) |
| Text on colour | `--primary-action-text`, `--nav-action-text`, `--text-on-accent`, `--text-on-warning` | Always pair a filled background with its matching "on" token |
| Borders | `--input-border` | The single hairline/outline/divider colour |
| Primary action | `--primary-action`, `--primary-action-tint` | Filled = primary button. Outline + tint + gold text = selected tile/option |
| Navigation | `--nav-action` | Secondary/navigation buttons, tool tiles |
| Selection | `--selection-color` (orange) | Toggle "on" and Edit actions only |
| Feedback | `--success-color`, `--warning-color`, `--danger-color`, `--info-color` | Toasts, status, destructive actions |
| Categories | `--cat-practise/-rehearsal/-lesson/-performance` | Session category everywhere it's shown (chips, bars, history stripe) |
| Data viz | `--heat-time-0..4`, `--heat-sess-0..4`, `--chart-*` | Charts and heatmaps only - never UI chrome |
| Overlays | `--overlay-bg`, `--surface-inverse` | Modal scrim; dark snackbar toasts |

## The "selected" pattern

There is exactly **one** selected look in the app (ML-218 removed the old blue radio fill). A selectable tile, radio option, value option or pill shows selection with all three together, never just one:

```css
border-color: var(--primary-action-strong);
background: var(--primary-action-tint);
color: var(--primary-action-strong);
```

See [selectable-tile.md](../components/selectable-tile.md).

## Contrast

- Body text on every surface meets WCAG AA in both themes. `--label-color` was lightened in dark
  mode specifically because it failed AA on `--input-bg`.
- Gold text (`--primary-action`) on white is below AA for small text. Use it only for bold,
  larger-than-body labels (tile values, selected option text), never for paragraph copy.

## Don't

- Don't write hex, `rgb()`, or named colours (`white`, `black`) in a component. `npm run token-audit` flags them.
- Don't use `--ds-*` primitives in components.
- Don't add `opacity` to fake a muted text colour. Use `--label-color`, or `--opacity-muted` for whole blocks of de-emphasised content.
