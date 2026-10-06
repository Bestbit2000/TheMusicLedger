# Band members and invitations

## 1. Metadata
- **Name:** Band members and invitations (`#bandMembersView`, and `#accountBandInvites` on My bands - no classes
  of their own: `.metro-help-text`, `.section-title`, `.form-group`, the value box
  `.metroBlk-ctrl-value-btn.w-full`, `.btn-submit`, `.btn-cancel.btn-inline`, `.history-item`, `.band-row-text`)
- **Category:** Flow / input
- **Status:** New (ML-473)

## 2. Overview
A band's shared space is **by invitation only** (the owner's decision, 6 Oct 2026 - nobody has to confirm
who runs a band). Two places:
- **My bands** shows, above your bands, any **invitation waiting for you**: who invited you, what you will be
  able to do, and that everyone in the band will see your name (ML-468). **Join** or **No thanks**. This is the
  only way into a band someone else set up. Each of your bands shows what you can do in it under its name.
- **Members** (a band's ⋮ menu) is a **page, not a pop-up** - its rows open the choice pop-up, and pop-ups
  don't stack. Everyone in the band sees who is in it and what each may do: names, never email addresses.
  An **organiser** also invites (by the email address the other person signs in with - they are sent a short email),
  changes what a member may do, and removes.
- **Where the site doesn't send email** (dev and sandbox, ML-479) the help line (`#bandInviteHelp`), the toast
  after Invite and the "Send the email again" row all say so, and say to tell the person yourself.
- **A name comes first** (ML-479): inviting, sending again and **Join** are refused for an account with no name.
  The usual confirm pop-up opens - "Add your name", the server's reason, **Go to My details** / Cancel
  (`bandNameNeeded`). No new styles.
- **What a member may do** is one of three, chosen by the organiser who invites them: **Organiser** (runs the
  band here), **Can change music**, **Can play**. "Organiser" is the owner's word - not "Librarian", which is
  a real post in a band.
- **One button, one pop-up:** a member, an invitation waiting and the level of a new invitation are each a
  value box (the answer over what it is) that opens `#flowChoiceModal`. Remove and Cancel are options in that
  pop-up, not buttons on the row.
- **Don't use** it for the directory (Admin → Bands) or for a member's own "who" labels.

## 3. Anatomy
- `#accountBandInvites` › per invitation: `.section-title` "You are invited to join ..." › `p.metro-help-text` ›
  `.flex-row.items-center.gap-sm` with **Join ...** (`.btn-submit.btn-inline`) and **No thanks**
  (`.btn-cancel.btn-inline`).
- `#bandMembersView` › `p.metro-help-text` (how many people; for an organiser, "Tap someone to change what they
  can do") › a row per member - for an organiser `button.metroBlk-ctrl-value-btn.w-full` (level over name), for
  everyone else `.history-item` › `.band-row-text` (name, then level in `.text-sm.text-muted`) › (not an
  organiser) `p.metro-help-text` "One more person has been invited." › (organiser) `.section-title` "Invite
  someone" › help line › `.form-group` (their email address) › the level value box › **Invite** (`.btn-submit`) ›
  `.section-title` "Waiting for an answer" › a value box per invitation (the address over level · invited date).

## 4. Tokens used
None of its own - see [form-field](form-field.md), [button](button.md), [list-row](list-row.md) and
[metronome](metronome.md) (the value box).

## 5. Props / API
- app.js, by `renderAccountBandsList`: `BAND_LEVELS`, `renderAccountBandInvites`, `loadBandMembers`,
  `renderBandMembers`, `bandMembersDo`.
- Server (`server/services/bands.js`, rules in `docs/band-directory.md`): `GET /api/account/bands` →
  `{ allBands, myBands, invites }`; `GET /api/account/bands/:id/members`; `POST .../invites { email, level }`;
  `DELETE .../invites/:inviteId`; `PUT .../members/:memberId { level }`; `DELETE .../members/:memberId`;
  `POST /api/account/band-invites/:inviteId/accept` and `/decline`. `level` is `organiser`, `change` or `play`.

## 6. States
- **No invitations:** `#accountBandInvites` is hidden.
- **Arriving from the email** (`/?band-invite=1`): the sign-in screen's line says "You have been invited to join
  a band. Sign in with the email address the invitation was sent to..."; once signed in, My bands opens.
- **Organiser:** members are value boxes; the invite form and the waiting list show.
- **Not an organiser:** members are plain rows; no form; a count of people invited, if any.
- **Yourself:** your own pop-up has no "Remove from the band" (Leave is on the band's menu). The only
  organiser can't step down until someone else is one - the server says so in a toast.
- **A "Can play" member** elsewhere: a band piece has no Edit, and a band's practice list has its name and
  date boxes disabled and no "+ Add pieces" or "Delete this list".

## 7. Code example
```html
<button type="button" class="metroBlk-ctrl-value-btn w-full mb-2" data-member="12" aria-haspopup="dialog"
        aria-label="Sam Reed: Can play - tap to change">
  <strong>Can play</strong><span class="metroBlk-ctrl-value-label">Sam Reed</span>
</button>
```

## 8. Cross-references
[invite](invite.md) (inviting someone to the app itself - a different thing), [list-row](list-row.md),
[modal](modal.md) (the choice pop-up), `docs/band-directory.md`.

## 9. Accessibility
- Every row an organiser can act on is a `<button>` with `aria-haspopup="dialog"` and a label that says the
  person, what they can do now, and "tap to change". A member who can't act gets plain text, not a disabled button.
- The level is words on every row, never a colour or an icon alone.
- **No thanks** carries an `aria-label` naming the band, so two invitations can be told apart.
- Touch targets: the value boxes and buttons are the shared ones (44px or more). No new colour pairs, no gestures.
- The email box is `type="email"` with `autocapitalize="off"`; an error is a toast, in words.
