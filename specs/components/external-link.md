# External link

## 1. Metadata
- **Name:** External link (`.external-link`, `.external-link-text` (the underlined address), `.external-link-icon`; in a band row `.band-row-text`)
- **Category:** Navigation
- **Status:** Stable (ML-375)

## 2. Overview
A link that leaves the app - today a band's website, in My account → My bands (under each of your bands,
and under "Choose a band to join" for the band you've picked, so you can look before joining). It shows
just the address (`bournebrass.org.uk`, no `https://www.`), underlined in the link colour, with **↗**
(Material Symbol `open_in_new`) after it, and opens in a new tab. **Don't use** it for anything inside the
app - that's a button.

## 3. Anatomy
`a.external-link[target=_blank][rel="noopener noreferrer"]` › the address › `span.external-link-icon`
(`open_in_new`, `aria-hidden`) › `span.visually-hidden` " (opens in a new tab)". In a band row the band's
name and the link stack in a `.band-row-text` column, left of the row's ⋮ menu.

## 4. Tokens used
`--link-color`, `--font-sm`, `--icon-sm`, `--space-1`, `--touch-target`.

## 5. Props / API
`bandWebsiteLinkHtml(url)` (app.js) builds it from a band's `website`: http(s) only (anything else shows
nothing), `https://` added when the stored address has no scheme. `renderBandPickerWebsite` shows the
picked band's.

## 6. States
Default · Focus (`--focus-ring`) · Visited (the browser's own - not restyled).

## 7. Code example
```html
<a class="external-link" href="https://www.bournebrass.org.uk/" target="_blank" rel="noopener noreferrer"><span class="external-link-text">bournebrass.org.uk</span><span class="material-symbols-outlined external-link-icon" aria-hidden="true">open_in_new</span><span class="visually-hidden"> (opens in a new tab)</span></a>
```

## 8. Cross-references
[list-row](list-row.md) · [button](button.md)

## 9. Accessibility
- A real `<a href>` (it goes somewhere), named by the address; the ↗ is decorative and the hidden
  " (opens in a new tab)" says it leaves the app (WCAG 3.2.5 advice).
- At least `--touch-target` tall so it's easy to tap inside a list row.
- `--link-color` on the page is an existing checked pair (4.5:1, both themes).

See [accessibility foundation](../foundations/accessibility.md).
