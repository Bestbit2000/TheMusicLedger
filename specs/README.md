# The Music Ledger - design system specs (ML-198)

Structured, LLM-readable specs for every visual decision in the app. **Before writing or
modifying any UI code, read the relevant spec here.**

| Where | What |
|---|---|
| [`public/tokens.css`](../public/tokens.css) | The tokens themselves - Layer 1 primitives (`--ds-*`) and Layer 2 aliases |
| [`tokens/token-reference.md`](tokens/token-reference.md) | Master map of every token, its value (light/dark) and when to use it - generated, don't hand-edit |
| [`foundations/`](foundations/) | The rules per category: [color](foundations/color.md), [spacing](foundations/spacing.md), [typography](foundations/typography.md), [radius](foundations/radius.md), [elevation](foundations/elevation.md), [motion](foundations/motion.md), [accessibility](foundations/accessibility.md) |
| [`components/`](components/) | One spec per component that exists in the app |
| [`public/styleguide.html`](../public/styleguide.html) | Live rendered examples (open `/styleguide.html` on any environment) |

## The three layers

```
Layer 1  --ds-gold-500: #d4af37;                          primitives - tokens.css only
Layer 2  --primary-action: var(--ds-gold-500, #d4af37);   aliases - the only names components use
Layer 3  .btn-submit { background: var(--primary-action); }   components - style.css, admin.css, inline styles
```

Dark mode is Layer 2 only: `body.dark-mode` in `tokens.css` points an alias at a different primitive.
A component never needs its own `body.dark-mode` colour override, so if you find yourself writing
one, you're probably missing an alias. Add the alias instead.

## Workflow

1. Read the component spec (or the foundation spec for a new component).
2. Use only Layer 2 tokens. If nothing fits, add a Layer 2 alias to `tokens.css` with a usage
   comment. Don't reach for a raw value.
3. `npm run token-reference` if you touched `tokens.css`.
4. `npm run token-audit`. Zero errors is required before committing.
5. New component? Add `specs/components/<name>.md` using the template below.

## Component spec template

1. Metadata (name, category, status)
2. Overview (when to use / when not to use)
3. Anatomy
4. Tokens used
5. Props / API (classes, modifiers, JS helpers)
6. States (default, hover, active, focus, disabled, error)
7. Code example
8. Cross-references
9. Accessibility (keyboard, ARIA, focus, touch target, anything not conveyed by colour)
