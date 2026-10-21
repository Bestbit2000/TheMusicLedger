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

## Automatic notices (ML-497) and choosing them (ML-501)

The app sends a notice itself when something happens to a member's things (`server/services/autoNotices.js`,
`142_automatic_notices.sql`). The owner's answers, 21 Oct 2026:

| Kind | When | Words (they name the band, never the person) |
|---|---|---|
| `band_invite` | An organiser invites someone **already using the app** (anyone else gets only the email) | "You're invited to join The Cobham Band" / "See My bands to say yes or no." - withdrawn once it is answered or cancelled |
| `band_level` | An organiser changes what a member can do (not stepping down yourself) | "What you can do in The Cobham Band has changed" / "You can now change music." |
| `band_removed` | An organiser takes a member out | "You're no longer in The Cobham Band's shared space" / "It's still on your list of bands." |
| `band_news` | A piece or practice list is added to a band - **one notice a day per band** for each member but the one who added it, added to while it is unread | "New in The Cobham Band: Abide with Me", "3 new pieces in The Cobham Band", "2 new pieces and a practice list in ..." - the names in the message, **worked out again when it is read** (`bandNewsWords`), so a piece renamed after it was added shows its new name |
| `piece_deleted` | Someone else deletes a piece a member added to a band | "Abide with Me, which you added to The Cobham Band, has been deleted" |

- **The list and the red dot only** - never urgent, never a pop-up.
- Each is a notice for named members (`audience = 'accounts'`) with `kind`, `details` and `group_key`; an
  invitation's lasts 30 days, the others 90, then the 12-month clear-up takes them. **They aren't shown on Admin ->
  Notifications** (one per member would bury the owner's own notices).
- **Behind their own switch, `auto_notices`** (Super admin only until switched on for account types on Admin ->
  Feature access), and the notification centre - both checked for the member it is for, so nothing is made for
  someone who couldn't see it.
- Sending never gets in the way: a failure is logged, and what caused it carries on.
- **Choosing (ML-501):** Settings -> **Notifications** has a toggle switch for each of four kinds - Invitations to a
  band, Changes in a band (`band_level` and `band_removed`), New music in your bands, A piece you added is deleted.
  **All on** until switched off (the owner's choice); saved on the account (`notice_preferences`, no row = on),
  deleted with it and in the data download. Notices from the Notably Better team always come. Email and phone
  switches come with ML-499 / ML-500.
- Back-test case 89 (the switches); the sending was checked on dev with a throwaway band.

## Sending to a group (ML-496)

On Admin → Notifications the form's **Who is it for** box (one button, one pop-up) offers **Everyone**, **An account
type**, **A band** or **Named members**, and a second box says which (a type; a shared band - kind `group` - with
how many are in it now; members ticked from a searchable list). The owner's decisions (8 Oct 2026):

- **An account type is a rule** - whoever has that type while the notice is live gets it
  (`audience = 'account_level'`, `audience_account_level`).
- **A band is a rule too** - its members, and **someone who joins the band while the notice is still live gets it as
  well** (`audience = 'band'`, `audience_band_id`). A band deleted later leaves its notices for nobody.
- **Named members are a list**, fixed when it is sent (`audience = 'accounts'`, `notification_recipients`).
- Not by instrument or plan (there are no plans yet).

Who a notice is for is set when it is made: **an edit keeps it** (the boxes show it but can't be changed), so an edit
never turns a notice for some members into one for everyone. Only a notice for everyone can be a banner (ML-495).
The list says who each is for ("For Standard members (3 now)", "For The Cobham Band (12 now)") and counts readers
out of the people it covers now; **Who has seen it** lists them. Every query a member's notices come from checks the
rule (`FOR_ACCOUNT` in `server/services/notifications.js`, migration 140). Back-test case 87.

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
- **a strip across the top of every screen** says "A new version is ready", with **Reload** and **See what's new**
  (the same notes in a pop-up) - ML-564. Its × hides it for this visit, for that version. It **waits while a
  practice session is running** and shows once the session is over, so nobody is asked to reload mid-session
  (owner's decision, ML-565). It reaches **every member**,
  not only those with the notifications feature: the banner check (`GET /api/notices/banner`, open, every minute)
  also returns `appVersion`. Spec: `specs/components/notice-banner.md`.
- About's Release history marks "You're on this version" against the release this device is running.

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

## A banner for a planned outage (ML-495)

Switch on **Banner** in the admin form (`notifications.banner`, `139_notice_banner.sql`) and, while the notice is
live, a blue strip sits across the top of every screen with its title - **signed in or not**: the sign-in screen has
one too (owner, 8 Oct 2026). It uses the notice's own publish and expiry times, so "the app will be unavailable on
Saturday from 8 to 9" comes and goes by itself. A tap on the title opens the whole message; its × hides it **for this
visit** (the browser tab's `sessionStorage`), and it is back next time until it ends. One at a time, oldest first.

- **It reaches everyone**, whatever features their account type has: `GET /api/notices/banner` needs no sign-in and
  is not behind the `notifications` feature (it is in `OPEN_ROUTES`, `server/services/siteSecurityReview.js`).
  So only a notice **for everyone** can be a banner - never one for named members - and the answer carries only
  each banner's words and times, and the deployed release's version number (ML-564; public in `releases.json`).
- The page reads it as it opens, every minute while it is on screen, and when it comes back to the front. It is never
  kept on the device; offline, what was showing stays.
- It is still a notification like any other: in the list, read, cleared, withdrawn the same way.
- Spec: `specs/components/notice-banner.md`.

## Reading

Tapping a notification opens its full text and marks it read (reading *is* marking as read).
**Mark all as read** does every live one. Read state is per account (`notification_reads`), so
it follows you across devices. Titles/messages are plain text - line breaks kept, nothing rendered
as HTML.

## Clearing (ML-556)

Every member can clear notifications out of their list - the **×** on a notification clears that one at once, and
**Clear all** (it asks first) clears the lot. It is kept on the account (`notification_reads.cleared_at`,
`138_clear_notifications.sql`), so it is gone on every device.

**A cleared one can come back** (owner, 21 October 2026 - "ooh, what was that again?"):

- **Undo** straight after: clearing one, or Clear all, shows the usual Undo toast; Undo puts back exactly what was
  cleared (`clear-all` answers with `clearedIds`).
- **Show cleared (N)** under the list - only there while something is cleared - lists the cleared ones (newest cleared
  first, `GET /api/notifications/cleared`) with a dashed edge, each with **Restore** (`POST /api/notifications/restore`
  with `ids`). Restored, it is back in the list, still read.
- **It is not a history of every notice** (the owner's first ask, 20 Oct): a cleared notice is only there while the
  notice is live - once it expires or is withdrawn it has gone for everyone, and the 12-month clear-up (ML-494)
  removes its rows.

- **Clearing reads it too**, so the red dot and the count drop, and Admin's "Read by N of M" still counts it.
- **An urgent or important notification has to be answered with Got it first** - its pop-up is how it's read -
  so while it's unread it has no ×, Clear all leaves it, and `POST /api/notifications/:id/clear` refuses it (409).
  Once answered it clears like any other.
- **Update available** isn't stored, so it can't be cleared - it goes when the app reloads.
- A notification sent to particular members (ML-490) is cleared by them like any other.
- **The notification itself is untouched**: Withdraw, Restore and Delete on the admin page work as before. Delete
  removes the cleared rows with the read ones.
- **It needs a connection** (`docs/offline.md`): unlike reading, it isn't dropped quietly offline - the member is
  told, and the notification stays.
- Clearing again is harmless (the first `cleared_at` is kept). After the last one goes, the "You're all caught
  up!" screen shows.

## Admin

Admin → **Notifications**: create (title up to 120 characters, message up to 4000; publish now or
at a date/time in your browser's local time; optional expiry), edit, **Withdraw** (hides it from
everyone but keeps its read count; **Restore** puts it back), or **Delete** (removes it and its read
history). Each shows its status - Scheduled / Live / Expired / Withdrawn - who it is for ("For everyone" or
"For 2 members", ML-492) and "Read by N of M", out of the people it is for: the members named, or every account that
can still read it (a deleted account isn't counted). Editing a notice for named members keeps it for them.

**Who has seen it** (ML-492/493): a notice for named members (**Who it's for**) or an urgent or important one (**Who
has seen it**) opens a pop-up listing who hasn't seen it yet and who has, with the day (`GET
/api/admin/notifications/:id/audience`). "Seen" is the read record - opening it, Got it, or clearing it (ML-556). It is
for the owner only: the app telling its members something, never anyone checking on a player's practice - so it is
never offered to a band organiser about their members without a separate decision.

## Housekeeping (ML-494)

- **Old notices go.** The daily clear-up (`clearOldRecords`, docs/retention.md) deletes a notification 12 months
  after it stopped being shown - it expired, or it was withdrawn, whichever came first (owner, 8 Oct 2026) - with its
  read records and its list of who it was for. A live notice with no expiry is kept. The rule is `noticeIsOld` in
  `retentionRules.js` (tested); Admin -> Security -> Reviews flags any the job has missed.
- **A limit on repeated calls.** Reading, Mark all as read, clearing and Got it share the `notifications` call limit
  (`limitCalls`, ML-476): 300 an hour per account, far more than anyone tapping. The minute-by-minute check for new
  notices (`GET /api/notifications`) is not limited - every check would write a row to count it.

## Not built (yet) - what going properly multi-user would need (ML-381)

Roughly in the order they'd matter:

- **Targeting by instrument or plan** - a band, an account type and named members are built (ML-496).
- **Band admins notifying their own members** ("rehearsal moved to Thursday") - the biggest one for
  bands. Needs targeting plus a band-admin screen, with super-admin moderation/abuse limits.
- **Push notifications** that arrive while the app is closed (Web Push via the service worker, VAPID
  keys, a `push_subscriptions` table, iOS only as an installed PWA) - everything here is in-app, so
  an urgent notice reaches nobody who doesn't open the app.
- **Email fallback** for urgent notices (the ML-355 `MAIL_PROVIDER` plumbing already exists).
- **More ways to get a notice** - email copies (ML-499) and phone push (ML-500), and their switches and quiet hours
  in Settings -> Notifications. Urgent ones ignore them.
- **More automatic notices** - left out on purpose: milestones and streaks, and a practice list's target date
  coming up (the no-pressure rule, ML-471).
- **Real-time delivery** (SSE/websockets or a hosted pub/sub such as Pusher/Ably) if a minute's
  delay is ever too slow.

## Code and tests

| File | What |
|---|---|
| `db/migrations/048_notifications.sql` | Tables + the `notifications` feature row |
| `server/services/notifications.js` | Live query, read/read-all, admin CRUD |
| `server/routes/api.js` (`/api/notifications*`), `server/routes/admin.js` (`/api/admin/notifications*`) | Routes |
| `public/app.js` (NOTIFICATIONS section) | Polling, dot/badge, screen, update card, update strip (ML-564), urgent pop-up, clearing |
| `db/migrations/138_clear_notifications.sql` | `notification_reads.cleared_at` (ML-556) |
| `db/migrations/139_notice_banner.sql` | `notifications.banner` (ML-495) |
| `db/migrations/140_notice_audiences.sql` | `audience` 'account_level' and 'band' (ML-496) |
| `db/migrations/142_automatic_notices.sql`, `server/services/autoNotices.js` | Automatic notices and the member's choices (ML-497, ML-501) |
| `db/migrations/082_urgent_notifications.sql` | `notifications.urgent` (ML-167) |
| `db/migrations/113_important_notices.sql` | `notifications.important`, `notifications.policy_link` (ML-463) |
| Back-test case 56 (`createImportantNotice` in `tests/helpers/seedNotifications.ts`) | The pop-up on opening, must be answered, once per account, reaches a Standard member |
| `public/admin.js` / `admin.html` | Admin section |
| Back-test case 11 (`tests/helpers/seedNotifications.ts`) | Dot until read, scheduled/expired hidden, update notice for an older running release, clearing one and Clear all (ML-556) |
