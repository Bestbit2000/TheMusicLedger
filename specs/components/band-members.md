# My bands, band members and invitations

## 1. Metadata
- **Name:** My bands, a band's page, band members and invitations (`#accountBandsView` with `#accountBandInvites`,
  `#tidyBandsView`, `#bandView`, `#bandMembersView`, `#bandNoticeView` - no classes of their own: `.metro-help-text`,
  `.section-title`, `.form-group`, the value box `.metroBlk-ctrl-value-btn.w-full`, `.btn-submit`, `.btn-cancel.btn-inline`,
  `.btn-text`, `.history-item` (`.settings-link`, `.is-muted`), `.band-row-text`, the toggle row); ML-534 adds
  `#bandWelcomeView` and three classes: `.band-logo` (`.band-logo-sm`, `.band-logo-lg`) and
  `.band-row-main`
- **Category:** Flow / input
- **Status:** New (ML-473); My bands as one list, ML-478; a band's logo and its welcome, ML-534; one row a band, one
  page a band, and only organisers see who is in it, ML-653; Edit the band (the logo is the button, organisers rename a
  shared band), ML-659 - adds `#bandEditModal` and five classes: `.band-logo-edit`, `.band-logo-btn`,
  `.band-logo-empty-icon`, `.band-logo-badge`, `.band-logo-menu`

## 2. Overview
**My bands is every band you play with** (ML-478, the owner's model, 6 Oct 2026) - and exactly what the
"Who with?" box of a rehearsal or performance offers.
- **Adding a band is private.** Pick it from the list, or type its name if it isn't there (a website is
  only needed to put it on the list for everyone). Nothing is shared and nobody is told.
- **My bands is its own item in the ☰ menu** (ML-653, the owner, 29 Oct 2026), in "You" after My music, with a
  `.notif-count` while a band invitation is waiting - no longer a row on My account.
- **One row a band, one page a band** (ML-653). Each band is a `.settings-link` row: its logo (or the `groups` icon -
  `person` for a band just for my log), its name, and under it what I can do and how many are in it ("Organiser · 6
  members") or "Just for my practice log", and a chevron. A tap opens **the band's page** (`#bandView`); there is no ⋮
  menu. On a wide screen My bands is a list page: the list stays on the left and the band opens on the right.
- **The band's page** (`#bandView`, `renderBandPage`): the logo (`.band-logo-lg`), the name (`h2`) with a pencil beside
  it (`.list-item-menu-btn`, `#bandPageEditBtn` - a shared band's organisers and a band just for my log only), "You:
  Organiser" (or "Just for my practice log") and the website.
- **Edit the band** (`#bandEditModal`, ML-659, the owner's decisions 29 Oct 2026): the pencil's pop-up, the one place a
  band's logo and name are changed. **The logo is the button** (`.band-logo-btn`, in `.band-logo-edit`), with a pencil
  badge on its corner (`.info-row-edit-icon.band-logo-badge` - on a phone there is no hover, so the badge is always
  there). A tap opens the usual small menu under it (`.dropdown-menu.band-logo-menu`, not a pop-up, so nothing stacks):
  **Choose a new logo** · **Take the logo off** (red). With no logo the box shows a picture icon
  (`.band-logo-empty-icon`) and a **+** badge, and a tap goes straight to choosing a picture. The logo's help line under
  it. Then **Name** ("Everyone in the band sees this name." / "Only you see this name. The N sessions logged with it
  keep it."), and **Cancel** / **Save**. **Nothing changes until Save** - a picture chosen is only shown (a `blob:`
  address), and taking the logo off only marks it; Save sends the logo, then the name. The logo part is for a shared
  band's organisers (feature `band_welcome`); a band just for my log has only the name. **An organiser may rename a
  shared band** - everyone in it sees the new name, and each member's own entry follows when it still had the old one
  (`renameMyBand`). An organiser who hasn't said they are 18 or over is asked first, with the pop-up out of the way. For a shared band, **The band**: **Members** - a `.settings-link` row ("6 members · 1 invitation
  waiting") that opens the Members page **for its organisers only**; everyone else gets the same row without a
  chevron, as plain text ("14 members") - and **Tell the band** for those who can send ("A notice to everyone · 3 more
  can go now"); then **Me in this band**, the switch for sharing Levels. Then what I can do with it on my list, as
  `.btn-text` links, each only when it applies (its name is changed in Edit the band, ML-659): It's a band in the list · Same as another band of mine · I don't play
  with them now · Leave the shared band · **Stop sharing** (danger, when I'm the only one in it) · Report the band's
  name. A band just for my log says only I see it, and its one primary button is **Set up sharing** (a confirm pop-up
  first; you become its organiser).
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
  able to do, and that the band's organisers will see your name (ML-468, ML-653). **Join** or **No thanks**. This is
  the only way into a band someone else set up. Each of your bands shows what you can do in it under its name.
- **Members** (from the band's page) is a **page, not a pop-up** - its rows open the choice pop-up, and pop-ups
  don't stack. **Only the band's organisers see who is in it** (ML-653, the owner, 29 Oct 2026) and what each may
  do: names, never email addresses. The server sends the names to nobody else. On it an organiser sees the
  invitations **Waiting for an answer**, invites (by the email address the other person signs in with - they are sent
  a short email), changes what a member may do, and removes.
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
- **The band leader's summary** (ML-581, feature `band_levels_summary`; the owner's decisions, 22 Oct 2026): on the
  band's page, under **Me in this band**, every member has the switch (`#bandShareLevelsSection`, the toggle row used
  elsewhere - no new styles), in the owner's words: "I'm happy to share my piece levels anonymously at a summary level
  only to the band leader". Off until they switch it on; never asked anywhere else. Its line names the band leader (or
  says there isn't one) and what they would see - the one other member's name everyone in a band is sent (ML-653: "so
  you know who you're sharing it with"). A **band leader** shows as "· Band leader" beside what they can do on the
  Members page; an organiser makes someone one, or not, from that member's pop-up ("Make them the band leader" / "Not
  the band leader any more") - themselves included, from their own row ("Make me the band leader" / "Stop being the
  band leader"). Only an organiser can; there may be more than one band leader. Nobody else's switch is ever shown - not even to an organiser. What the band leader sees
  is [band-summary](band-summary.md).
- **Tell the band** (ML-498, feature `band_notices`; the owner's decisions, 23 Oct 2026): its own page (`#bandNoticeView`,
  ML-653), opened from a row on the band's page, for the band's organisers, the members who can change its music and
  its band leader only (no new
  styles: `.section-title`, `.metro-help-text`, two `.form-group`s, `.btn-submit`, `.history-item` rows). A title
  (up to 120) and a message (up to 1000), **Send to the band** asks first ("Everyone in X gets it in the app, with
  your name on it. It can't be changed once it has gone."), and goes as a notice to everyone in the band. **One way
  only** - nobody can reply. The help line says it has their name on it, that nobody can reply, the band's limits
  (3 a day, 10 a week) and how many can go now - or, with none left, when the next can. **Sent lately** lists the
  band's last ten (title over "From Sam Smith · 23 Oct", "taken down" once the owner withdrew it). The first time,
  a sender with no name is sent to My details (`bandNameNeeded`), and one who hasn't said they are 18 or over is asked
  (`organiserAdultNeeded`, in the notice's own words). Hidden for everyone else. How it reaches members:
  [notification-centre](notification-centre.md) and `docs/notifications.md`.
- **Don't use** it for the directory (Admin → Bands).

**A band's logo and its welcome** (ML-534, feature `band_welcome`; the owner's decisions, 19 Oct 2026):
- **The logo** - an organiser adds, changes or takes it off in **Edit the band** (ML-659, above): the logo is the button,
  its menu has Choose a new logo and Take the logo off, and both wait for Save. A PNG, JPEG or WebP up to 1 MB, kept in the file store under
  `band-logos/<band>/`. It is shown whole on a plain ground (`object-fit: contain`), never cropped.
- **On My bands** a shared band with a logo shows it small at the start of its row (`.band-logo-sm`, where the icon is).
  The picture is decoration there (`alt=""`) - the name is beside it.
- **The welcome** (`#bandWelcomeView`) - for someone arriving from a band's invitation email, once signed in.
  The logo, "Welcome to <band>", who invited them, then **What the band shares here**, built only from the
  band's own data: how many pieces, each practice list (its concert date and how many pieces), how many
  recordings. Then what they will be able to do and that the band's organisers will see their name - never anyone's practice.
  Nothing an organiser writes. **Join <band>** (one tap - it is still their own yes; the same "Is this the same
  band as one of yours?" question when it might be) and **Not now** (the invitation waits on My bands). After
  joining, set-up starts straight away when it hasn't been done; otherwise My bands.

## 3. Anatomy
- `#accountBandsView` › `#accountBandInvites` › `button.history-item.settings-link#tidyBandsLink` (hidden when
  nothing is unsorted) › `#accountBandsList`: a `button.history-item.settings-link[data-band-open]` per band ›
  `.band-logo.band-logo-sm` or `.settings-link-icon` › `.settings-link-text` (`.settings-link-title` the name,
  `.settings-link-sub` what I can do · how many, or "Just for my practice log") › `.settings-link-chevron` › help line › the
  list picker and **Add** › "Can't find your band? Add it" (name; website, optional, with a help line) ›
  `.section-title` "Bands I don't play with now" › `.history-item.is-muted` per hidden band (name, "N sessions
  on my history", `.btn-text` **Show again**).
- `#tidyBandsView` › `p.metro-help-text` › a value box per unsorted name; "All sorted" when none is left.
- `#accountBandInvites` › per invitation: `.section-title` "You are invited to join ..." › `p.metro-help-text` ›
  `.flex-row.items-center.gap-sm` with **Join ...** (`.btn-submit.btn-inline`) and **No thanks**
  (`.btn-cancel.btn-inline`).
- `#bandView` (ML-653) › `.flex-col.items-center.text-center` (`img.band-logo.band-logo-lg`, `.flex-row` with the `h2`
  and `button.list-item-menu-btn#bandPageEditBtn`, "You: ..." in `p.metro-help-text`, the website) › `#bandPageShared`: `.section-title` "The
  band" › `button.history-item.settings-link#bandPageMembersLink` (organisers) or `div.history-item.settings-link#bandPageMembersCount`
  (everyone else: no chevron, nothing to tap) › `button.history-item.settings-link#bandPageNoticeLink` › `#bandShareLevelsSection`
  (`.section-title` "Me in this band" and the toggle row) › or `#bandPageOwn` (a band just for my log) › `#bandPageActions`:
  `.btn-text` per action › `#bandPageShareBox` (help line and **Set up sharing**, `.btn-submit`).
- `#bandMembersView` (organisers) › `p.metro-help-text` (how many people, "Tap someone to change what they can do") ›
  a `button.metroBlk-ctrl-value-btn.w-full` per member (level over name) › `.section-title` "Waiting for an answer" › a
  value box per invitation (the address over level · invited date) › `.section-title` "Invite someone" › help line ›
  `.form-group` (their email address) › the level value box › **Invite** (`.btn-submit`). Anyone else who lands on it
  is told "Only the band's organisers see who is in ...".
- `#bandNoticeView` (ML-498, its own page since ML-653) › `p.metro-help-text#bandNoticeHelp` › `.form-group` (Title) ›
  `.form-group` (Message, a `textarea`) › **Send to the band** (`.btn-submit`) › `.section-title` "Sent lately" › a
  `.history-item` › `.band-row-text` per notice.
- `#bandEditModal` (ML-659) › `.modal-content` › `.modal-close-x` › `h2` "Edit the band" › `.form-group#bandEditLogoGroup`
  (organisers of a shared band): `label` "Logo" › `.band-logo-edit` (`button.band-logo.band-logo-lg.band-logo-btn` holding
  the `img` or `.band-logo-empty-icon`, and `.info-row-edit-icon.band-logo-badge` - `edit` or `add`; then
  `.dropdown-menu.band-logo-menu` with two `.dropdown-item`s, the second `.metroBlk-tile-menu-delete`) › help line ›
  hidden file input › `.form-group` (Name, its line) › `.flex-row` Cancel (`.btn-cancel.btn-nav`) / Save (`.btn-submit`).

## 4. Tokens used
None of its own - see [form-field](form-field.md), [button](button.md), [list-row](list-row.md) and
[metronome](metronome.md) (the value box). ML-659's classes use `--space-3` (the badge sits that far over the logo's
corner), `--space-4` (the menu's gap under the logo), `--icon-xl` (the empty box's picture) and `--label-color`.

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
- **No logo:** the preview is hidden and the button says **Add a logo**; My bands rows and the welcome show no picture.
- **The welcome, nothing shared yet:** "Nothing yet - the band's organisers put its music here."
- **`band_welcome` off for the account:** arriving from the email opens My bands, as before; the Members page has no logo section.
- **No bands:** "No bands yet. Add the ones you play with below."
- **Nothing to tidy:** the Tidy my bands row is hidden; the page itself says "All sorted. Nothing left to tidy."
- **Nothing hidden:** the "Bands I don't play with now" heading is hidden.
- **A shared band can't be hidden** until it is left - the menu doesn't offer it, and the server refuses.
- **Two shared bands can't be made one** - the server says so in a toast.
- **No invitations:** `#accountBandInvites` is hidden.
- **Arriving from the email** (`/?band-invite=1`): the sign-in screen's line says "You have been invited to join
  a band. Sign in with the email address the invitation was sent to..."; once signed in, My bands opens.
- **Organiser:** the band's page has Members as a row to tap and the logo buttons; on Members, members are value boxes
  and the invite form and the waiting list show.
- **Not an organiser:** the band's page says how many members, as text - no names, no invitations, nothing to tap.
- **A band just for my log:** no "The band" or "Me in this band"; "Only you see this band" and **Set up sharing**.
- **Yourself:** your own pop-up has no "Remove from the band" (Leave is on the band's page). The only
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
- My bands (ML-478, ML-653): each band's row is one `<button>` whose text is its name, what I can do and how many are
  in it - whether it is shared is said in words. The count on the ☰ menu item has words for a screen reader
  ("1 band invitation waiting", `.visually-hidden`). Each **Show
  again** names its band in its `aria-label`; a Tidy value box's label says the name, how many sessions and
  "tap to say what it is". Merging asks first, in words, and says it can't be undone.
- The email box is `type="email"` with `autocapitalize="off"`; an error is a toast, in words.
- ML-659: the pencil beside the name is a `<button>` with `aria-label="Edit the band"` and `aria-haspopup="dialog"`
  (40px with the shared 44px touch area of `.list-item-menu-btn`). In Edit the band the logo is one `<button>` (96px)
  whose label says what a tap does - "The band's logo - change it or take it off" (`aria-haspopup="menu"`,
  `aria-expanded`) or "Add a logo"; the badge is decoration (`aria-hidden`). The menu is the shared `.dropdown-menu`
  (arrow keys, Escape closes it first, focus goes back to the logo). The name's line is its `aria-describedby`.
- ML-534: the logo's preview and the welcome's logo have an `alt` naming the band; on a My bands row it is
  `alt=""` (the name is beside it). The file picker is a real `<input type="file">` with an `aria-label`, opened
  by a `<button>`. The welcome is a heading (`h2`) and plain rows - what it says is words, not the picture.
  No new colour pairs (the logo's border is `--input-border` on `--container-bg`), no gestures.
