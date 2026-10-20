# Notice banner

## 1. Metadata
- **Name:** Notice banner (`style.css`: `.notice-banner`, `.notice-banner-icon`, `.notice-banner-text`, `.notice-banner-close`, `.notice-banner-full`)
- **Category:** Status
- **Status:** New (ML-495)

## 2. Overview
A strip across the top of every screen for a **planned outage** ("The app will be unavailable on Saturday from 8 to
9"). It is a [notification](notification-centre.md) a super admin switched on as a **Banner** on Admin →
Notifications, shown while that notice is live - its own publish and expiry times, so it comes and goes by itself.
It reaches **everyone**: signed in on every screen, and signed out on the sign-in screen (owner, 8 Oct 2026),
whatever features an account type has. Behaviour is in [docs/notifications.md](../../docs/notifications.md).

**Use** only for something everyone needs to know before it happens. **Don't** use it for news (that is the
notification centre), for the connection (that is the [offline bar](offline-status.md)) or for an error (a
[toast](toast.md)).

## 3. Anatomy
- **The strip** - `div.notice-banner` (`role="region"`, "Notice") in `.top-bar-sticky-group`, above the offline
  bar, and a second one at the top of `#loginScreen` (`.splash-screen .notice-banner`, across the whole width):
  a `campaign` icon (`.notice-banner-icon`), the notice's title as an underlined button (`.notice-banner-text`)
  that opens the whole message, and a bare × (`.notice-banner-close`, a full touch target) that hides it **until
  the next visit** (kept for the browser tab only - it is back next time, until the notice ends).
- **The message** - `#noticeBannerModal`, an ordinary [modal](modal.md) (`.modal-content.notice-banner-full`): ×,
  the title, "Until ..." when it has an end, and the message in full (`.notification-body`, not clamped). It sits
  above the sign-in screen (`--z-over-splash`), since it opens from there too.
- One banner at a time, the oldest first; hiding it shows the next.

## 4. Tokens used
`--status-blue-bg`, `--status-blue-fg` (the "scheduled" pair - so it isn't taken for the amber offline bar or an
error), `--app-max-width`, `--touch-target`, `--radius-circle`, `--space-1`, `--space-2`, `--space-5`, `--font-sm`,
`--font-weight-semibold`, `--z-over-splash`.

## 5. Props / API
`GET /api/notices/banner` - open, no sign-in (listed in `OPEN_ROUTES`): `{ banners: [{ id, title, body, publishAt,
expiresAt }] }`, only live notices for everyone switched on as a banner, at most 3. Read once as the page opens, every
minute while it is on screen and when it comes back to the front. Nothing is kept on the device.

## 6. States
Hidden (no banner, or hidden for this visit) · Showing (one banner) · Message open.

## 7. Code example
```html
<div class="notice-banner" role="region" aria-label="Notice">
  <span class="material-symbols-outlined notice-banner-icon" aria-hidden="true">campaign</span>
  <button type="button" class="notice-banner-text">The app is unavailable on Saturday from 8 to 9</button>
  <button type="button" class="notice-banner-close" aria-label="Hide this notice until next time"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
</div>
```

## 8. Cross-references
[notification-centre](notification-centre.md) · [offline-status](offline-status.md) · [modal](modal.md) · [top-bar](top-bar.md) · [splash-screen](splash-screen.md)

## 9. Accessibility
- The strip is a labelled region, not a live region: it is there when the page opens and doesn't interrupt.
- The title is a real button (opens the message); the × is named "Hide this notice until next time".
- Blue on blue is an existing checked pair in both themes; both buttons are at least 48px tall.

See [accessibility foundation](../foundations/accessibility.md).
