# Notification centre

## 1. Metadata
- **Name:** Notification centre (`.notif-dot`, `.notif-count`, `.notifications-toolbar`, `.notification-item`, `.notification-head`, `.notification-unread-dot`, `.notification-date`, `.notification-body`, `.notification-update`, `.notification-release`, `.notifications-empty`, `.notifications-empty-art`, `.notifications-empty-title`, `.notification-urgent` (the urgent pop-up's content), `.notification-urgent-tag`)
- **Category:** Feedback
- **Status:** Stable (ML-201). Behaviour documented in [docs/notifications.md](../../docs/notifications.md)

## 2. Overview
The red dot on ☰, the unread count in the menu, and the Notifications list screen (admin
announcements plus the automatic "update available - reload" card). **Don't use** for transient
confirmations. Those are [toasts](toast.md).

## 3. Anatomy
List: `.notifications-toolbar` (Mark all read) › `.notification-item[.unread][.expanded]` › `.notification-head` (`.notification-unread-dot` + title) › `.notification-date` › `.notification-body` (2-line clamp until expanded).
Update card: `.notification-item.notification-update` with a `.btn-submit` Reload button.
Urgent (ML-167): in the list, an amber `.notification-urgent-tag` "Urgent" after the title. While unread it also
pops up - `#urgentNotificationModal` (`role=dialog`) › `.modal-content.notification-urgent` › the tag ›
`h2` title › `.notification-date` › `.notification-body` (in full, no clamp) › a `.btn-submit` **Got it** that
marks it read. No × - Got it is the way out; closed any other way it comes back on the next check.
Empty: `.notifications-empty` › a line drawing (`svg.notifications-empty-art`, someone relaxing back in a deckchair
with a euphonium; `aria-hidden`; lines in `--label-color`, the instrument a `.is-solid` group filled with
`--container-bg` so it hides the lines behind it) › `h2.notifications-empty-title` "You're all caught up!" ›
a `.text-muted` line: "This is where you'll see what's new in each release, and news from the Music Ledger
team." (Only what actually feeds the list - releases and super-admin announcements. No milestones.)
› a `.btn-nav` **Start practising** button to Home, so the screen isn't a dead end (Home has the practice
session, the tools and the timer).

## 4. Tokens used
`--danger-color` (dots, count), `--text-on-accent`, `--container-bg` (dot ring), `--input-bg`,
`--input-border`, `--primary-action` (unread/update outline), `--text-color`, `--label-color`,
`--status-amber-bg`/`--status-amber-fg` (urgent tag - an existing checked pair), `--font-xs`, `--font-weight-bold`, `--space-0-5`,
`--radius-md`, `--radius-pill`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--font-sm`, `--font-lg`, `--line-height-base`.

## 5. Props / API
See [docs/notifications.md](../../docs/notifications.md) for the data flow and the update-available check.

## 6. States
Unread (gold outline + red dot) · Read (plain outline) · Collapsed (2-line clamp) · Expanded · Empty (`.notifications-empty`) · Urgent (tag; pop-up until Got it).

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
- Each item is a `<button>`; unread state is shown by the dot **and** the outline, and should be in the name ("Unread: …") if the dot is the only cue.
- The unread count badge in the menu is text, so it is read out with the item.

See [accessibility foundation](../foundations/accessibility.md).
