# Public page and pricing

## 1. Metadata
- **Name:** Public page (`style.css`: `.public-page`, `.public-top`, `.public-hero`, `.public-actions`, `.public-tiles`,
  `.public-tile`, `.public-story`, `.public-foot`) and pricing table (`.pricing-table`, `.pricing-group`,
  `.pricing-plan-note`; cells `.is-yes`, `.is-no`, `.is-coming`)
- **Category:** Page
- **Status:** New (ML-242, 22 Oct 2026)

## 2. Overview
The two pages a visitor reads before signing in: `welcome.html` (what Notably Better is, who it's for, how to join)
and `pricing.html` (Standard and Premium side by side). Plain pages like the policies - readable signed out, no
script in the page, no icon font (so a first visit loads little).

**Use** only on these public pages. **Don't** use them inside the app: the app's screens have their own top bar,
tiles and cards. Words on these pages follow the No pressure rule (`specs/README.md`): no urgency, no member
numbers, no comparison between players, no price, no "most popular" badge, no crossed-out prices.

## 3. Anatomy
- `main.container.public-page` - the page, the narrow card's width (`--page-max-narrow`): a "reading" page
  ([layout](../foundations/layout.md)). The phone column on a phone.
- `.public-top` - the name with its [brand mark](brand-mark.md) (`.public-top-brand`, back to the public page) and
  `.public-top-links`: Pricing and Log in. Log in, the last link, is outlined; the page you're on is underlined
  (`aria-current="page"`). Wraps under the name on a narrow phone.
- `.public-hero` - centred: `.public-hero-title` (the headline), `.public-hero-sub` (the line under it), one
  sentence, `.public-actions`, and `.public-hero-image` (the sign-in picture).
- `.public-actions` - two buttons as links: the main one `.btn-submit`, the other `.btn-nav.btn-cancel` (outlined).
  Side by side when each can be 200px wide, stacked on a phone.
- `.section-title` headings and plain paragraphs and lists between them (the policies' own styles).
- `.public-tiles` / `.public-tile` - a list of tools: the name in bold, one line under it in the muted colour. As
  many to a row as fit at `--stat-col-min`.
- `.public-story` - the owner's own words, with a gold line down the left.
- `.public-foot` - small links (Pricing or About, the policies, the email address) and "Made in the UK".
- `.pricing-table` - a real table: a hidden caption, the two plans as column heads with a note under each
  (`.pricing-plan-note`: Free, Coming), groups of rows (`.pricing-group`), a row head per thing, and a cell per plan:
  - `td.is-yes` - a drawn tick (gold), with "Included" for a screen reader;
  - `td.is-no` - a dash, with "Not included" for a screen reader;
  - `td.is-coming` - the word "Coming", small and muted;
  - a number cell (a limit) - just the number ("Last 10", "4").

## 4. Tokens used
`--page-max-narrow`, `--line-height-relaxed`, `--line-height-tight`, `--line-height-snug`, `--link-color`,
`--text-color`, `--label-color`, `--primary-action`, `--primary-action-strong`, `--input-bg`, `--input-border`,
`--touch-target`, `--stat-col-min`, `--radius-md`, `--shadow-lg`, `--font-3xl`, `--font-lg`, `--font-md`,
`--font-base`, `--font-sm`, `--font-xs`, `--font-weight-*`, `--space-1` to `--space-8`.

## 5. Props / API
- `public/pricing.js` fills every `td[data-plan]` from `GET /api/pricing` (open, `server/services/pricing.js`):
  `data-plan` is the account type, `data-feature` the features that must all be on (space-separated),
  `data-limit` and `data-format` a number (`{n}`). A key the answer doesn't have keeps what is typed in the page,
  and so does the whole table if the answer can't be read. Rows with no data attributes are typed: check them when
  a gate changes.

## 6. States
Pricing cells: included / not included / coming / a number. Top links: the current page underlined.
Buttons and links: the app's own hover and focus.

## 7. Code example
```html
<header class="public-top">
  <a class="public-top-brand" href="/welcome.html"><img class="brand-mark" src="images/brands/notably-better-mark.svg" alt="" aria-hidden="true"><span>Notably Better</span></a>
  <nav class="public-top-links" aria-label="Notably Better"><a href="/pricing.html">Pricing</a><a href="/">Log in</a></nav>
</header>
<table class="pricing-table">
  <tr><th scope="row">Tuner rewind</th>
    <td class="is-no" data-plan="standard_member" data-feature="tuner_rewind"><span class="visually-hidden">Not included</span></td>
    <td class="is-yes" data-plan="premium_member" data-feature="tuner_rewind"><span class="visually-hidden">Included</span></td></tr>
</table>
```

## 8. Cross-references
[brand-mark](brand-mark.md), [button](button.md), [layout](../foundations/layout.md),
`docs/feature-access-plan.md` (the switches the table reads), Jira ML-242, ML-579, ML-580.

## 9. Accessibility
- One `h1` a page; sections are `h2`. The top links are a `nav` with a name.
- Every link and button is at least 44px tall (`--touch-target`), the footer's small links too.
- The pricing table is a real table: column heads and row heads have `scope`, group heads span the row, and
  "Included" / "Not included" are read out - the tick and dash are never the only sign.
- The hero picture is decoration (`alt=""`): the headline says what it says.
- Colours are the app's audited pairs (link on the page, muted text on a tile, gold on the page) in both themes.
