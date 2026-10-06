# Invite someone

## 1. Metadata
- **Name:** Invite someone (`#inviteView` - no classes of its own: `.theory-intro`, `.level-notice`, `.form-group`,
  the value box `.metroBlk-ctrl-value-btn.w-full`, `.btn-submit`, `.theory-best-line`, `.history-item`,
  `.btn-text.btn-text-danger`)
- **Category:** Flow / input
- **Status:** New (ML-402)

## 2. Overview
The main menu's **Invite someone**: any member can invite someone to the app by email, without the admin
page. Feature `invite_members` (Admin → Feature access; on for every account type to start), and only while
email-and-password login (`password_login`) is Live - an invite is that kind of account.
- **A member's invite always makes a Standard member.** A **super admin** also gets an account type value
  box (every type but Super admin) - the server only honours a type from a super admin.
- **Up to 5 invites in 24 hours** each (the `invites_per_day` limit, Admin → Feature access › Limits). Every
  invite sent counts, whether it has since been used, cancelled or replaced.
- **You see and cancel only your own** invites that haven't been used. One whose link has run out (7 days)
  stays on the list, saying so, until the 30-day clear-up - with **Send again** on every row: a fresh link and
  a fresh email, counted as one of today's.
- **The junk warning is always shown**: the email comes from themusicledgerapp@gmail.com and will probably
  land in junk.
- It's a **page, not a pop-up**: the account type is a value box with its own pop-up, and pop-ups don't stack.
- **Don't use** it for admin-only invite work (every pending invite, any account) - that stays on Admin → Accounts.

## 3. Anatomy
`#inviteView` › `p.theory-intro` (what they get) › `p.level-notice` (the junk-folder warning, amber) ›
`.form-group` × 3 (their email, first name, surname) › (super admin) `button.metroBlk-ctrl-value-btn.w-full`
"account type" opening `#flowChoiceModal` › **Send invite** (`.btn-submit`) › `p.theory-best-line` ("You can send 4
more invites today.") › `.section-title` "My invites that haven't been used" › `.history-item` per invite
(`.history-details`: the email in bold, then name · sent · works until) with a `.btn-text.btn-text-danger` Cancel.

## 4. Tokens used
None of its own. The warning is `.level-notice` (`--status-amber-bg` / `--status-amber-fg`); the rest as
[form-field](form-field.md), [button](button.md), [list-row](list-row.md) and [metronome](metronome.md) (the value box).

## 5. Props / API
- app.js, "INVITE SOMEONE (ML-402)": `renderInviteNav` (the menu item: the feature and `/auth/methods`),
  `openInviteView` (a fresh visit clears the form; Back keeps it), `renderInvite`.
- Server: `GET /api/invites` → `{ enabled, limit, left, invites, levels }` (`levels` only for a super admin);
  `POST /api/invites { email, firstName, surname, accountLevel? }`; `DELETE /api/invites/:id` (your own only).
  `server/services/passwordAuth.js`: `listMyInvites`, `invitesSentToday`, `cancelMyInvite`, and the admin page's
  `createInvite`. Migration 092.

## 6. States
| State | Treatment |
|---|---|
| Not switched on (feature off, or password login not Live) | the menu item is hidden; the page says "Invites aren't switched on at the moment." and Send is disabled |
| No email typed | a warning toast, focus in the email field, nothing sent |
| Sent | the form clears, a toast reminds about junk, the invite joins the waiting list, the count goes down |
| Limit reached | Send is disabled; "You've sent 5 invites in the last day - you can send more tomorrow." |
| Cancel | asks first ("Are you sure?" pop-up: Cancel invite / Keep it); the emailed link stops working |

## 7. Code example
```html
<p class="level-notice"><strong>Tell them to look in their junk folder.</strong> The email comes from themusicledgerapp@gmail.com and will probably land there.</p>
<div class="form-group"><label for="inviteEmailInput">Their email</label><input type="email" id="inviteEmailInput" autocomplete="off" data-form-type="other"></div>
<button type="button" class="btn-submit">Send invite</button>
<p class="theory-best-line" role="status" aria-live="polite">You can send 4 more invites today.</p>
```

## 8. Cross-references
[form-field](form-field.md) · [button](button.md) · [list-row](list-row.md) · [modal](modal.md) ·
docs/password-login.md · docs/feature-access-plan.md.

## 9. Accessibility
- Every field has a visible label ("Their email", "Their first name", "Their surname"); the fields carry
  `autocomplete="off"` and `data-form-type="other"` so a password manager doesn't fill in the inviter's own details.
- The count line is `role="status"` / `aria-live="polite"`, so sending or reaching the limit is announced.
- Each Cancel is a real button named for its invite ("Cancel the invite to sam@example.com"); cancelling asks first.
- The warning doesn't rely on its colour: it says what to do in words, with the key phrase in bold.

See [accessibility foundation](../foundations/accessibility.md).
