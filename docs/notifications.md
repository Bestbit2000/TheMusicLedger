# Notification centre (ML-201)

A red dot on the ☰ menu button (no extra top-bar icon), a **Notifications** entry in the menu with
the unread count, and a Notifications screen. Two kinds of item feed it:

| Kind | Where it comes from | Stored? |
|---|---|---|
| **Announcements** | Written by a super admin in Admin → **Notifications** - publish now or at a set time, optional expiry | `notifications` / `notification_reads` (`048_notifications.sql`) |
| **Update available** | Automatic: this device is running an older release than the server | No - worked out on the device |

Gate: feature `notifications` (admin Features page) - switches off the dot, the menu entry, the
screen and the API together.

## For particular members only (ML-490)

A notification is for everyone (`audience = 'all'`) or for named members (`audience = 'accounts'`, with
who in `notification_recipients`). The second kind is not written on the admin page: the app makes one when
it has to tell particular people something about their own things - today, when a recording of theirs is
removed on request (`createTargetedNotification`, used by `server/services/recordingRemovals.js`). It is
published at once and urgent. Every query that gives a member their notifications (the list, mark as read,
mark all read, the important notices) checks the audience, so nobody else ever sees it. It appears in the
admin list like any other, where it can be withdrawn or deleted.

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
- every minute while it's on screen (a hidden tab or backgrounded app skips the poll),
- and when the Notifications screen is opened.

So a notification scheduled for 09:00 shows for someone with the app open by about 09:01, and for
everyone else the next time they open it. A notification published before an account existed is
still shown to it until it expires (agreed for ML-201 - a new user still hears about a recent
feature).

## Urgent notifications (ML-167)

Tick **Urgent** in the admin form (`notifications.urgent`, `082_urgent_notifications.sql`). An urgent
notification is a normal one (dot, list, scheduling, expiry, withdraw all work the same) that also
**pops up** over whatever the player is doing - `#urgentNotificationModal` (a dialog, focus on Got it) - within
about a minute if the app is open, or the moment they next open it. It stays until they tap **Got it**,
which marks it read; closed any other way (Escape) it comes back on the next check. Several unread
urgent ones show one at a time, oldest first. In the list and in Admin it carries an amber **Urgent** tag.

"Instant" here means *the next poll* - up to a minute. True push (server → open app in under a second)
needs a live connection (Server-Sent Events / websockets), which Vercel's serverless functions don't
hold open well; see "Not built" below.

## Important notices - "Before you continue..." (ML-463)

Some announcements matter too much to sit behind the red dot - a change to how members' information is
used, above all. The privacy policy promises: "If the change matters to how your information is used, we
will also tell you in the app." This is how.

Switch on **Important** in the admin form (`notifications.important`, `113_important_notices.sql`). Each
member then sees it as a pop-up - `#importantNoticeModal`, headed "Before you continue..." - **the next time
they open the app, or come back to it**, before anything else, and carries on once they tap **Got it**.

- It is not shown in the middle of something: only as the app opens or comes back to the foreground, never
  on the minute-by-minute poll. (Urgent is the one that interrupts.)
- It must be answered: no X, and a tap outside doesn't close it (`data-no-dismiss`).
- **Got it is remembered on the account** (`notification_reads`, as reading is), so each member sees each
  one once, on whichever device they open first. It stays in the notification centre, tagged Important.
- Several waiting: one at a time, oldest first, with "N more to read after this."
- **It reaches every member.** `GET /api/notices/important` and `POST /api/notices/important/:id/ack` are not
  behind the `notifications` feature, whatever an account type has switched on.
- **A link to the privacy policy** can be added (`notifications.policy_link`, the second switch - only offered
  with Important). It is always the app's own `/privacy.html`; no other address can be put in a notice.
- No connection: nothing new can arrive, so nothing is shown (and the answer is never kept on the device -
  `NO_COPY` in `public/offline.js`). It appears the next time the app opens with a connection.
- If "Got it" can't be recorded (the connection went), the member carries on and it is shown again next time.
- Admin shows "Read by N of M", as for any notification.

When to use it is in `docs/release-process.md`, step 1 ("does anything in it need telling to members?").

**Draft of the first one - not sent; the wording is the owner's** (the date last used has been recorded
since 0.45.0; only the owner uses the app today, so this is not urgent):

> **We now record the day you last used the app**
>
> We keep the date you last used The Music Ledger while signed in - the day, not the time.
>
> We use it to see how many members are using the app, and to delete accounts nobody has used for two
> years. It is deleted with your account.
>
> (with the link to the privacy policy switched on)

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

## Not built (yet) - what going properly multi-user would need (ML-381)

Roughly in the order they'd matter:

- **Targeting** (a band, an account type, an instrument, a plan) - `notifications.audience` exists,
  always `'all'` for now, so this can be added without reshaping the table.
- **Band admins notifying their own members** ("rehearsal moved to Thursday") - the biggest one for
  bands. Needs targeting plus a band-admin screen, with super-admin moderation/abuse limits.
- **Push notifications** that arrive while the app is closed (Web Push via the service worker, VAPID
  keys, a `push_subscriptions` table, iOS only as an installed PWA) - everything here is in-app, so
  an urgent notice reaches nobody who doesn't open the app.
- **Email fallback** for urgent notices (the ML-355 `MAIL_PROVIDER` plumbing already exists).
- **Per-user preferences** - which kinds you want by push/email, quiet hours. Urgent ones ignore them.
- **Acknowledgement report** for urgent and important notices - who has/hasn't tapped Got it (the data is already in
  `notification_reads`; Admin shows only the count).
- **Automatic notices** - milestones, streaks, a teacher's/band's new practice list, an invite, a
  practice-list deadline - generated by the app rather than typed by an admin (a `kind`/`source`
  column and per-account rows rather than one broadcast row).
- **A maintenance banner** - a persistent strip for a planned outage, separate from the list.
- **Real-time delivery** (SSE/websockets or a hosted pub/sub such as Pusher/Ably) if a minute's
  delay is ever too slow.
- **Housekeeping** - delete old read rows / expired notices once there are many accounts, and
  rate-limit the notifications endpoints.

## Code and tests

| File | What |
|---|---|
| `db/migrations/048_notifications.sql` | Tables + the `notifications` feature row |
| `server/services/notifications.js` | Live query, read/read-all, admin CRUD |
| `server/routes/api.js` (`/api/notifications*`), `server/routes/admin.js` (`/api/admin/notifications*`) | Routes |
| `public/app.js` (NOTIFICATIONS section) | Polling, dot/badge, screen, update card, About note, urgent pop-up |
| `db/migrations/082_urgent_notifications.sql` | `notifications.urgent` (ML-167) |
| `db/migrations/113_important_notices.sql` | `notifications.important`, `notifications.policy_link` (ML-463) |
| Back-test case 56 (`createImportantNotice` in `tests/helpers/seedNotifications.ts`) | The pop-up on opening, must be answered, once per account, reaches a Standard member |
| `public/admin.js` / `admin.html` | Admin section |
| Back-test case 11 (`tests/helpers/seedNotifications.ts`) | Dot until read, scheduled/expired hidden, update notice for an older running release |
