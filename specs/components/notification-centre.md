# Notification centre

## 1. Metadata
- **Name:** Notification centre (`.notif-dot`, `.notif-count`, `.notifications-toolbar`, `.notification-row`, `.has-clear` (a row whose notification can be cleared), `.notification-clear-btn`, `.is-cleared`, `.notification-restore` (ML-556), `.notification-item`, `.notification-head`, `.notification-unread-dot`, `.notification-date`, `.notification-body`, `.notification-update`, `.notification-release`, `.notifications-empty`, `.notifications-empty-art`, `.notifications-empty-title`, `.notification-important` (the "Before you continue..." pop-up's content, ML-463), `.notification-urgent` (the urgent pop-up's content), `.notification-urgent-tag`, `.admin-who-list` (Admin → Notifications' "Who has seen it", ML-492/493))
- **Category:** Feedback
- **Status:** Stable (ML-201). Behaviour documented in [docs/notifications.md](../../docs/notifications.md)

## 2. Overview
The red dot on ☰, the unread count in the menu, and the Notifications list screen (admin
announcements plus the automatic "update available - reload" card). **Don't use** for transient
confirmations. Those are [toasts](toast.md).

## 3. Anatomy
List: `.notifications-toolbar` (**Mark all as read** while anything is unread, **Clear all** while anything can be cleared - each
shown only when it has something to do) › `.notification-row[.has-clear]` › `.notification-item[.unread][.expanded]` › `.notification-head` (`.notification-unread-dot` + title) › `.notification-date` › `.notification-body` (2-line clamp until expanded), and beside it
the row's `.notification-clear-btn` (ML-556).
Cleared ones (ML-556, owner 21 Oct 2026): clearing shows the Undo [toast](toast.md); under the list a `.btn-text`
**Show cleared (N)** (`aria-expanded`; "Hide cleared" when open; only there while something is cleared) opens
`#notificationsClearedList`: each a `.notification-item.is-cleared` (a dashed edge - out of the list; not a button) with
the title, date and message and a `.notification-restore` text button (**Restore**, gold `--primary-action-strong`,
underlined, a full touch target) that puts it back, still read. Clear all's question says it can be brought back from
there.
Clearing (ML-556): the × top right of a notification - a bare icon button (no fill, `--label-color`, a full
`--touch-target`), the notification padded on the right so its title never runs under it - clears it out of the
list for good, at once, with no question (it reads it too). **Clear all** asks first, in the confirm pop-up
("Clear all notifications?" / **Clear all**). An urgent or important notification still waiting for Got it has
no ×, and Clear all leaves it. There is no history of cleared ones. Needs a connection.
Update card: `.notification-item.notification-update` with a `.btn-submit` Reload button.
Urgent (ML-167): in the list, an amber `.notification-urgent-tag` "Urgent" after the title. While unread it also
pops up - `#urgentNotificationModal` (`role=dialog`) › `.modal-content.notification-urgent` › the tag ›
`h2` title › `.notification-date` › `.notification-body` (in full, no clamp) › a `.btn-submit` **Got it** that
marks it read. No × - Got it is the way out; closed any other way it comes back on the next check.
Important (ML-463): a notice a member should not find out by accident (a change to how their information is
used). In the list, the same amber tag reading "Important". It pops up **when the app is next opened, or come
back to - before anything else, never in the middle of something**: `#importantNoticeModal` (`role=dialog`,
`data-no-dismiss`) › `.modal-content.notification-important` › `h2` "Before you continue..." › the notice's
title as a `.section-title` › `.notification-date` › `.notification-body` (in full) › optionally an
`.external-link` "Read the privacy policy" (the app's own page, in a new tab) › "N more to read after this."
(`.text-sm.text-muted`) when several wait › a `.btn-submit` **Got it**. No ×, and a tap outside doesn't close
it. Got it is remembered on the account, so no other device shows it again; several show one at a time,
oldest first; an urgent one waits its turn behind it. It doesn't depend on the `notifications` feature -
every member sees it - and with no connection nothing is shown.
Admin → Notifications' form (ML-496): **Who is it for** - a `.metroBlk-ctrl-value-btn` (Everyone / An account type / A
band / Named members) and, beside it, one for which; each opens `#notificationAudienceModal` (a sticky-footer modal
over the form, `--z-modal-stacked`): `.flow-choice-option` rows, a search for bands and members, and for named members
[pick list](pick-list.md) rows with **Done - N members**. On an edit both boxes are disabled with a line saying why.
Admin → Notifications (ML-492/493): each notice says who it is for in a `.admin-feedback-badge` ("For everyone" /
"For 2 members") and "Read by N of M" out of those people. A notice for named members (**Who it's for**) or an urgent or
important one (**Who has seen it**) has a button opening `#notificationWhoModal`: the title › "For ..." ›
`.admin-stat-section-title` "Not seen yet (n)" › `ul.admin-who-list` (name, then the email in `.text-muted` when the name
isn't the email) › "Seen (n)" › the same list with the day each saw it. For the owner only - never offered to a band
organiser about their members.
Empty: `.notifications-empty` › a line drawing (`svg.notifications-empty-art`, someone relaxing back in a deckchair
with a euphonium; `aria-hidden`; lines in `--label-color`, the instrument a `.is-solid` group filled with
`--container-bg` so it hides the lines behind it) › `h2.notifications-empty-title` "You're all caught up!" ›
a `.text-muted` line: "This is where you'll see what's new in each release, and news from the Notably Better
team." (Only what actually feeds the list - releases and super-admin announcements. No milestones.)
› a `.btn-nav` **Start practising** button to Home, so the screen isn't a dead end (Home has the practice
session, the tools and the timer).

## 4. Tokens used
`--danger-color` (dots, count), `--text-on-accent`, `--container-bg` (dot ring), `--input-bg`,
`--input-border`, `--primary-action` (unread/update outline), `--text-color`, `--label-color`,
`--status-amber-bg`/`--status-amber-fg` (urgent tag - an existing checked pair), `--font-xs`, `--font-weight-bold`, `--space-0-5`,
`--radius-md`, `--radius-pill`, `--radius-circle`, `--touch-target`, `--space-1` (the clear ×), `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--font-sm`, `--font-lg`, `--line-height-base`.

## 5. Props / API
See [docs/notifications.md](../../docs/notifications.md) for the data flow and the update-available check.

## 6. States
Unread (gold outline + red dot) · Read (plain outline) · Collapsed (2-line clamp) · Expanded · Empty (`.notifications-empty`) · Urgent (tag; pop-up until Got it) · Clearable (×) / not clearable (unread urgent or important: no ×).

## 7. Code example
```html
<button class="notification-item unread">
  <div class="notification-head"><span class="notification-unread-dot"></span><strong>New feature</strong></div>
  <div class="notification-date">23 Sep 2026</div>
  <p class="notification-body">…</p>
</button>
```

## 8. Cross-references
[top-bar](top-bar.md) · [dropdown-menu](dropdown-menu.md) · [pill-badge](pill-badge.md) · [toast](toast.md)

## 9. Accessibility
- The important notice (ML-463) is a dialog labelled by its heading and described by its message; focus goes
  to **Got it**; the privacy policy link says it opens in a new tab. Its words are friendly, not an alarm.
- The clear × is a separate `<button>` beside the notification (never inside it), named "Clear" + the title. After
  clearing one, focus goes to the notification that took its place (or the one before, or Start practising).
- Each item is a `<button>`; unread state is shown by the dot **and** the outline, and should be in the name ("Unread: …") if the dot is the only cue.
- The unread count badge in the menu is text, so it is read out with the item.

See [accessibility foundation](../foundations/accessibility.md).
