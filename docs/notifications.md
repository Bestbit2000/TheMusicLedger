# Notification centre (ML-201)

A red dot on the ☰ menu button (no extra top-bar icon), a **Notifications** entry in the menu with
the unread count, and a Notifications screen. Two kinds of item feed it:

| Kind | Where it comes from | Stored? |
|---|---|---|
| **Announcements** | Written by a super admin in Admin → **Notifications** - publish now or at a set time, optional expiry | `notifications` / `notification_reads` (`048_notifications.sql`) |
| **Update available** | Automatic: this device is running an older release than the server | No - worked out on the device |

Gate: feature `notifications` (admin Features page) - switches off the dot, the menu entry, the
screen and the API together.

## Why "update available" exists

The app's service worker (`public/sw.js`) is network-first, so any *fresh* load gets the latest
code. But an installed app resumed from the background keeps its old JavaScript in memory - while
the About page fetches `releases.json` fresh, so it showed the new version number even though the
old code was still running. Closing and reopening fixed it; nothing told you to.

So the client records the release its code was loaded as (`runningAppVersion` - read from
`releases.json` once, at startup, from the same deployment the code came from) and every poll of
`GET /api/notifications` returns the server's `appVersion` (from the deployed `releases.json`, the
same source as the About page and feedback's version stamp). When the server's is newer:

- the red dot shows (it counts as one unread item),
- Notifications shows **Update available: vX** at the top, with the release notes for everything
  newer than the running version and a **Reload now** button (reloading = closing and reopening),
- About says "This device is running vY" above the current release.

Nothing to do at release time - it follows from `npm run sync-releases` updating `releases.json`.

## When things appear

No scheduler or cron: "live" is computed from the clock at query time -
`publish_at <= now()`, not expired, not withdrawn. Clients poll:

- at startup,
- whenever the app comes back to the foreground (at most once a minute),
- every 5 minutes while it's open,
- and when the Notifications screen is opened.

So a notification scheduled for 09:00 shows for someone with the app open by about 09:05, and for
everyone else the next time they open it. A notification published before an account existed is
still shown to it until it expires (agreed for ML-201 - a new user still hears about a recent
feature).

## Reading

Tapping a notification opens its full text and marks it read (reading *is* marking as read).
**Mark all as read** does every live one. Read state is per account (`notification_reads`), so
it follows you across devices. Titles/messages are plain text - line breaks kept, nothing rendered
as HTML.

## Admin

Admin → **Notifications**: create (title up to 120 characters, message up to 4000; publish now or
at a date/time in your browser's local time; optional expiry), edit, **Withdraw** (hides it from
everyone but keeps its read count; **Restore** puts it back), or **Delete** (removes it and its read
history). Each shows its status - Scheduled / Live / Expired / Withdrawn - and "Read by N of M"
accounts.

## Not built (yet)

- **Push notifications** that arrive while the app is closed (Web Push) - everything here is
  in-app.
- **Targeting** (a band, an account level, a plan) - `notifications.audience` exists, always
  `'all'` for now, so this can be added without reshaping the table.

## Code and tests

| File | What |
|---|---|
| `db/migrations/048_notifications.sql` | Tables + the `notifications` feature row |
| `server/services/notifications.js` | Live query, read/read-all, admin CRUD |
| `server/routes/api.js` (`/api/notifications*`), `server/routes/admin.js` (`/api/admin/notifications*`) | Routes |
| `public/app.js` (NOTIFICATIONS section) | Polling, dot/badge, screen, update card, About note |
| `public/admin.js` / `admin.html` | Admin section |
| Back-test case 11 (`tests/helpers/seedNotifications.ts`) | Dot until read, scheduled/expired hidden, update notice for an older running release |
