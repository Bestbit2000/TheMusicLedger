# Public page and pricing

## 1. Metadata
- **Name:** Public page and pricing (`style.css`: `.public-*` - `.public-body`, `.public-wrap`, `.public-band`,
  `.public-top`, `.public-hero`, `.public-phone`, `.public-bars`, `.public-cards`, `.public-card`, `.public-more`,
  `.public-strip`, `.public-key`, `.public-chips`, `.public-promises`, `.public-story`, `.public-join`, `.public-foot`
  and the rest; `.pricing-*` - `.pricing-plans`, `.pricing-plan`, `.pricing-badge`, `.pricing-table`, `.pricing-group`;
  states `.is-l*`, `.is-now`, `.is-done`, `.is-premium`, `.is-on-light`, `.is-yes`, `.is-no`, `.is-coming`)
- **Category:** Page
- **Status:** New (ML-242, 22 Oct 2026). Designed with the owner on a Claude Design canvas.

## 2. Overview
The two pages a visitor reads before signing in: `index.html`, the front door `/` (what Notably Better is, who it's for, how to join)
and `pricing.html` (Standard and Premium). The owner's rule for them: **a summary first, the detail when you ask for
it** - every section is a line or two, and the longer text opens from "Read more" (`<details>`, so there is no
script in the page). The picture is the app's own idea - a piece's bars coloured by Level - drawn in markup, so no
image or icon font is loaded.

**Use** only on these public pages. **Don't** use them inside the app: its screens have their own top bar, tiles and
cards. Words follow the No pressure rule (`specs/README.md`): no urgency, no member numbers, no comparison between
players, no price, no "most popular" badge, no crossed-out prices. The owner's own words (marked in the page) are
changed only on his say-so.

## 3. Anatomy
- `body.public-body` - a page of full-width bands, not the app's centred column. `.public-wrap` keeps the content to
  `--page-max-public`, with the page's side gutter.
- `.public-band` - a dark band (`--public-band-*`), the same in both themes, like the sign-in splash: the top, the
  headline, "Invite only, for now" and the footer. `.public-tint` - a band in the page's tint.
- `.public-top` - the name with its [brand mark](brand-mark.md), then How it works, Pricing and Log in (outlined,
  `.public-top-login`). The current page is underlined (`aria-current="page"`). Wraps under the name on a phone.
- `.public-hero` - `.public-kicker` (who it's for), `.public-hero-title`, `.public-hero-sub`, and
  `.public-hero-actions`: one `.btn-submit.public-cta` and a quiet note. Beside it, `.public-phone`: a drawing of the
  app - a piece's bars by Level (`.public-bars`, `.is-l1` to `.is-l5`, the bars being worked on `.is-now`) and the
  five-minute go (`.public-phone-now`, `.public-goes` with `.is-done`). It is one picture (`role="img"` and a label).
- `.public-cards` / `.public-card` - three `<details>`: the `<summary>` holds `.public-card-kicker`,
  `.public-card-title`, `.public-card-sum` and `.public-more` ("Read more" / "Show less", with a drawn chevron).
- `.public-strip` - a piece's 32 bars by Level, with `.public-key`. One picture with a label.
- `.public-tools` / `.public-chips` - the everyday tools as a row of chips.
- `.public-promises` - three short promises, each a line-drawn icon (`.public-icon`, inline SVG), a heading and a line.
- `.public-detail` - a `<details>` under a section for the rest (privacy and reading, the owner's story, the full
  pricing table).
- `.public-story` - `.public-quote` (the owner's own line), `.public-person` (`.public-person-initials` until there is
  a photo, his name and what he is) and his full story in a `.public-detail`.
- `.public-join` - "Invite only, for now", Log in (`.public-cta-outline`), and the **Ask to join form** (ML-580,
  `docs/waiting-list.md`): `.public-join-form`, a light card holding the app's own fields (`.form-group`, `label`,
  `input`, `select`, `.toggle-switch`); `.public-form-row` puts first and last name side by side when there is room;
  `.public-form-optional` and `.public-form-hint` for the quieter words; `.public-check` is the age tick as a toggle
  switch with its words; `.public-trap` the field only robots fill in (off the page, never focused, hidden from a
  screen reader); `.public-join-status` says what happened (`.is-done`: the thanks, in place of the fields).
- `.public-foot` - small links and "Made in the UK".
- Pricing: `.pricing-plans` holds two `.pricing-plan` cards - Standard, and Premium (`.is-premium`, dark, with a
  `.pricing-badge` "Coming"): a name, `.pricing-plan-price`, `.pricing-plan-list` with drawn ticks. Under them,
  "Compare everything" (`.public-detail.pricing-compare`) opens `.pricing-table` in a sideways-scrolling box
  (`.pricing-scroll`): groups (`.pricing-group`), and cells `td.is-yes` (a drawn tick, "Included" for a screen
  reader), `td.is-no` (a dash, "Not included"), `td.is-coming`, or a number. A `td.is-coming` with a
  `data-feature` stays "Coming" until that feature is on for its plan, then shows the tick (ML-578: MuseScore).

## 4. Tokens used
`--public-band-bg`, `--public-band-raised`, `--public-band-edge`, `--public-band-text`, `--public-band-muted`,
`--public-band-accent` (new, not remapped in dark mode); `--page-max-public` (new), `--page-max-narrow`,
`--pane-col-min`, `--stat-col-min`, `--touch-target`; `--level-1` to `--level-5`; `--container-bg`, `--bg-color`,
`--text-color`, `--label-color`, `--link-color`, `--input-border`, `--primary-action`, `--primary-action-text`;
`--font-sm` to `--font-3xl`, `--font-weight-*`, `--line-height-*`; `--radius-xs` to `--radius-xl`, `--radius-pill`,
`--radius-circle`; `--shadow-xl`; `--space-*`; `--icon-xl`.

## 5. Props / API
- `public/pricing.js` fills every `td[data-plan]` from `GET /api/pricing` (open, `server/services/pricing.js`):
  `data-plan` is the account type, `data-feature` the features that must all be on (space-separated), `data-limit`
  and `data-format` a number (`{n}`). A key the answer doesn't have keeps what is typed; so does the whole table if
  the answer can't be read. The two plan cards' lists and the rows with no data attributes are typed - check them
  when a gate changes.

## 6. States
`<details>` closed (the summary and "Read more") and open ("Show less", the chevron turned). Pricing cells: included /
not included / coming / a number. Top links: the current page underlined. Buttons and links: the app's own hover and
focus.

## 7. Code example
```html
<details class="public-card">
  <summary>
    <span class="public-card-kicker">Learning to play</span>
    <span class="public-card-title">The basics, from your first notes to the higher grades</span>
    <span class="public-card-sum">Scales, note names, keys and rhythm, in short focused goes.</span>
    <span class="public-more"><span class="public-more-open">Read more</span><span class="public-more-close">Show less</span></span>
  </summary>
  <p>The owner's full text.</p>
</details>
```

## 8. Cross-references
[brand-mark](brand-mark.md), [button](button.md), [level-map](level-map.md) (the Level colours),
[layout](../foundations/layout.md), `docs/feature-access-plan.md` (the switches the table reads), Jira ML-242,
ML-579, ML-580.

## 9. Accessibility
- One `h1` a page; sections have headings (the story's is hidden: the quote and the name say it).
- A `<summary>` is a real button: Tab reaches it, Enter and Space open it, and it says whether it is open. Each is at
  least 44px tall, as is every link.
- The two drawings (the phone and the strip) are `role="img"` with a label saying what they show; their pieces are
  hidden from a screen reader. The Level colours are never the only way something is said.
- The pricing table is a real table with `scope` on its heads; "Included" / "Not included" are read out.
- Colours: the new dark-band pairs are in `specs/accessibility/contrast-pairs.json` and pass in both themes.
