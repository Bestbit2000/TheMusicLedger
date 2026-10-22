# The waiting list (ML-580)

While Notably Better is invite only, someone can ask to join from the public page (`public/index.html`, "Invite
only, for now"). The owner sees each request on **Admin → Waiting list** and lets them in, passes it to their
band's organiser, or turns it down. Built 22 Oct 2026 with the public page (ML-242).

## The form

First name, last name, email address; optionally the band they play with and their instrument; and a tick, "I'm 13
or over, or I'm a parent or carer filling this in" - without it the form won't send (the Children's Code; under 13s
ask a parent or carer). The band box offers the **band directory** (`bands` of kind `directory`, shown as "Name
(Town)") and takes any other name typed in ("another one"); a name that matches one directory entry is kept as that
entry, anything else as typed. The instrument is a pick from the app's instrument list. Both lists come from the open
`GET /api/join/options`, which says nothing about any member.

Before sending, the form says what the details are for and that they may be passed to the band's organiser, with a
link to the privacy policy. After sending, everyone sees the same words - "Thanks - we'll email you if we can let you
in." - whether the address is new, already waiting, already a member, closed, or the sender was a robot. Asking twice
keeps one request (the latest answers).

The form works without its script: it posts to `POST /api/join` and the page comes back with `?joined=1` or
`?join-problem=`. `public/join.js` fills the lists, sends it in place and says thanks.

## What the form never does (the owner's decisions)

- **No email.** Sending the form emails nobody, so it can't be used to send emails to a stranger's address. The first
  email anyone gets is the owner's invitation.
- **No CAPTCHA, nothing loaded from outside.** Robots are kept out by a field only robots fill in (`.public-trap`), a
  check that the form wasn't sent within 3 seconds of the page opening, and 5 sends an hour per sender
  (`limitJoinRequests`). The sender is counted by a hash of their internet address, never the address itself, and the
  count is gone within a day (`auth_rate_events`). A robot is answered "thanks" and nothing is kept.

## Admin → Waiting list

`public/admin-join-requests.js`, routes in `server/routes/admin.js` (super admins, the admin check). Newest first:
who, their email, the band and instrument, when they asked; a badge if the address is already a member or a closed
account. The menu counts what is waiting, and so does the Dashboard ("people are waiting to join").

- **Let in** - the ordinary invitation email (`createInvite`, a Standard member). They add their band on My bands, or
  in the set-up steps, once they are in. It is the email-and-password invitation, so it needs **Email and password
  login** Live on Admin → Feature access; where that is off (sandbox, 22 Oct 2026) the page says so and the button is
  greyed out, instead of the invitation code's bare "Not found".
- **Pass to the organiser** - only for a band that shares its music here (a `group` for that directory entry) with an
  organiser. Its organisers get a notice (`createTargetedNotification`) saying who asked, their instrument and email,
  and how to invite them from the band's Members page; nothing is sent to the person unless an organiser invites them.
  The notice shows for 30 days. Joining a band's shared space stays by an organiser's invitation (ML-473); the owner
  chose this over putting people in himself.
- **Not now** - the request goes. Nobody is told.

## Keeping it

`join_requests` (migration 144). A request is deleted when it is dealt with, and otherwise after 90 days by the daily
job (`clearOldRecords`). It has no account column - the person has no account yet - so account deletion doesn't touch
it. The privacy policy says all of this ("If you ask to join on our website"); change both together.

The form has a **Live switch**, `waiting_list` on Admin → Feature access. It is read before anyone signs in, so only
Live counts. Off: the page says to write to hello@notablybetter.com instead.

## Checks

`server/test/joinRequests.test.js` (the form's rules; no email; the routes' guards; the 90 days). The open routes are
listed in `OPEN_ROUTES` (`server/services/siteSecurityReview.js`). The axe scan covers the page with the form.
Before release: the Online Safety run-through (an organiser is shown a non-member's name and email) and the Children's
Code self-assessment (the age tick).
