# Notification centre

## 1. Metadata
- **Name:** Notification centre (`.notif-dot`, `.notif-count`, `.notifications-toolbar`, `.notification-item`, `.notification-head`, `.notification-unread-dot`, `.notification-date`, `.notification-body`, `.notification-update`, `.notification-release`, `.notifications-empty`)
- **Category:** Feedback
- **Status:** Stable (ML-201). Behaviour documented in [docs/notifications.md](../../docs/notifications.md)

## 2. Overview
The red dot on ☰, the unread count in the menu, and the Notifications list screen (admin
announcements plus the automatic "update available - reload" card). **Don't use** for transient
confirmations. Those are [toasts](toast.md).

## 3. Anatomy
List: `.notifications-toolbar` (Mark all read) › `.notification-item[.unread][.expanded]` › `.notification-head` (`.notification-unread-dot` + title) › `.notification-date` › `.notification-body` (2-line clamp until expanded).
Update card: `.notification-item.notification-update` with a `.btn-submit` Reload button.

## 4. Tokens used
`--danger-color` (dots, count), `--text-on-accent`, `--container-bg` (dot ring), `--input-bg`,
`--input-border`, `--primary-action` (unread/update outline), `--text-color`, `--label-color`,
`--radius-md`, `--radius-pill`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--font-sm`, `--line-height-base`.

## 5. Props / API
See [docs/notifications.md](../../docs/notifications.md) for the data flow and the update-available check.

## 6. States
Unread (gold outline + red dot) · Read (plain outline) · Collapsed (2-line clamp) · Expanded · Empty (`.notifications-empty`).

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
