# My bands, band members and invitations

## 1. Metadata
- **Name:** My bands, band members and invitations (`#accountBandsView` with `#accountBandInvites`,
  `#tidyBandsView`, `#bandMembersView` - no classes of their own: `.metro-help-text`, `.section-title`,
  `.form-group`, the value box `.metroBlk-ctrl-value-btn.w-full`, `.btn-submit`, `.btn-cancel.btn-inline`,
  `.btn-text`, `.history-item` (`.settings-link`, `.is-muted`), `.band-row-text`, the floating `.dropdown-menu`)
- **Category:** Flow / input
- **Status:** New (ML-473); My bands as one list, ML-478

## 2. Overview
**My bands is every band you play with** (ML-478, the owner's model, 6 Oct 2026) - and exactly what the
"Who with?" box of a rehearsal or performance offers.
- **Adding a band is private.** Pick it from the list, or type its name if it isn't there (a website is
  only needed to put it on the list for everyone). Nothing is shared and nobody is told.
- **Sharing is something a band on the list may have.** Under each name: "Shared - Organiser / Can change
  music / Can play", or "Not shared". A band becomes shared by an invitation, or by **Set up sharing** on its
  ⋮ menu (a confirm pop-up first; you become its organiser).
- **The ⋮ menu follows the band.** Not shared: Set up sharing · It's a band in the list (when it isn't yet) ·
  Same as another of mine · I don't play with them now. Shared: Members · Same as another of mine · Leave
  shared band - or **Stop sharing** when you are the only one in it (its music is deleted; the band stays on
  your list either way).
- **An invitation attaches to the band you already have.** The same band from the list, or the same name:
  no question. Otherwise **Join** asks once, in the choice pop-up, "Is this the same band as one of yours?" -
  a row per band of yours that isn't shared, and "No, it is a new band".
- **Tidy my bands** (`#tidyBandsView`) - a `.settings-link` row at the top of My bands while any name from
  before ML-478 is unsorted, never a pop-up you must answer. Each name is a value box (the name over
  "56 sessions - tap to say what it is") that opens the choice pop-up: **A band in the list** (then pick it -
  the likely ones first) · **The same as another of mine** (pick it, then confirm: it can't be undone) ·
  **Keep as my own** · **I don't play with them now**.
- **Bands I don't play with now** - at the bottom of My bands, muted rows with **Show again**. A hidden band
  is out of the "Who with?" box; its sessions stay on the history under its name. A band with nothing
  logged is removed instead of hidden.

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
- **Don't use** it for the directory (Admin → Bands).

## 3. Anatomy
- `#accountBandsView` › `#accountBandInvites` › `button.history-item.settings-link#tidyBandsLink` (hidden when
  nothing is unsorted) › `#accountBandsList`: a `.history-item` per band › `.band-row-text` (name; "Shared - ..."
  or "Not shared" in `.text-sm.text-muted`; the band's website) + `.list-item-menu-btn` (⋮) › help line › the
  list picker and **Add** › "Can't find your band? Add it" (name; website, optional, with a help line) ›
  `.section-title` "Bands I don't play with now" › `.history-item.is-muted` per hidden band (name, "N sessions
  on my history", `.btn-text` **Show again**).
- `#tidyBandsView` › `p.metro-help-text` › a value box per unsorted name; "All sorted" when none is left.
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
  `renderBandMembers`, `bandMembersDo`; ML-478: `myBandDo`, `bandSetUpSharing`, `bandPickDirectory`,
  `bandPickMerge`, `bandHide`, `renderHiddenBands`, `renderTidyBands`.
- Server (`server/services/bands.js`, rules in `docs/band-directory.md`): `GET /api/account/bands` →
  `{ allBands, myBands, invites, bands }` (`bands`: my list - `{ id, name, hidden, needsTidy, directoryBandId,
  sessions, shared: { bandId, level, isOrganiser, members, onlyYou } | null }`; `myBands`: the shared spaces
  only); `POST /api/account/bands/:id/join` (add from the list) and `POST /api/account/bands { name, website? }`;
  `POST /api/account/my-bands/:labelId/share | hide | show | keep | directory { directoryBandId } | merge { intoId }`;
  accept takes `{ labelId }` (which of my bands it is); `GET /api/account/bands/:id/members`; `POST .../invites { email, level }`;
  `DELETE .../invites/:inviteId`; `PUT .../members/:memberId { level }`; `DELETE .../members/:memberId`;
  `POST /api/account/band-invites/:inviteId/accept` and `/decline`. `level` is `organiser`, `change` or `play`.

## 6. States
- **No bands:** "No bands yet. Add the ones you play with below."
- **Nothing to tidy:** the Tidy my bands row is hidden; the page itself says "All sorted. Nothing left to tidy."
- **Nothing hidden:** the "Bands I don't play with now" heading is hidden.
- **A shared band can't be hidden** until it is left - the menu doesn't offer it, and the server refuses.
- **Two shared bands can't be made one** - the server says so in a toast.
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
- My bands (ML-478): whether a band is shared is said in words under its name. Each ⋮ button and each **Show
  again** names its band in its `aria-label`; a Tidy value box's label says the name, how many sessions and
  "tap to say what it is". Merging asks first, in words, and says it can't be undone.
- The email box is `type="email"` with `autocapitalize="off"`; an error is a toast, in words.
