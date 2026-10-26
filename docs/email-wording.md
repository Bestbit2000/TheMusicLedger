# Email wording (ML-617, ML-618)

What the app's emails say can be changed on **Admin → Content → Email wording**, without a release - **every email
the app sends** (ML-618, 26 Oct 2026), plus a **signature** at the bottom of every email a member gets (ML-617). Each
email's built-in wording is the words it was sent with before it came onto the page, so nothing changes for anyone
until the owner changes it there.

## The emails

All in `server/services/emailCatalogue.js` (`EMAILS`), in three groups (`GROUPS`):

- **Emails to members** (14): the invitation; the invitation for someone who already signs in with Google; the band
  invitation for someone with no account (with the band's logo, and every way in - `{ways in}` - since ML-618) and for
  a member; forgot your password; a password link sent from Admin → Accounts; confirm a new email address (asked by
  the member, or started by the owner); email address changed; account deleted as asked; the three retention emails;
  account open again.
- **Messages you write** (6): a warning, account closed, something removed, band renamed, and the email copies of urgent
  and important notices. The owner's message (or the notice's words) is `{message}`, which must be a paragraph of its
  own; the page holds the words around it. The **starting text** each pop-up offers (the "Why:" and "What to do next:"
  lines for each reason) is still in `public/admin.js` - next on the list (ML-618 stage 4).
- **Alerts to you** (5): a new sign-up, an upgrade request, something reported, a service near its limit, a new request
  to join. `toOwner` - no signature.

Small changes that came with moving them: a member with no first name is greeted "Hi there," / "Hello there," (was
"Hi," / "Hello,"), and the retention warnings' way back in is the email's button (it was a link inside a sentence).

## The page

`public/admin-email-wording.js`; the editor is `.admin-rich-toolbar` + `.admin-rich-text`
(`specs/components/admin-email-wording.md`). The emails are listed in their groups, each saying when it is sent and
whether it is the built-in wording or was changed (by whom, on which day); **Change** opens one in the editor below
(asking first if the one open has unsaved changes):

- **Subject** - up to 100 characters.
- **Words** - up to 1,500 characters as read. Formatting buttons: **Bold**, **Italic**, **Underline**, **Bulleted list**
  (Ctrl+B / I / U work too). **Edit as HTML** swaps the box for its HTML. No links and no pictures in the words.
- **Button** - the button's words, up to 30 characters ("Get started"). Only for an email that has a button.

Buttons: **Save** (wakes up once something has changed; the next email sent uses it), **Preview** (the email as it
will arrive - HTML, for "Bert", with the ways in switched on on that site, and the signature as it stands on the
page, saved or not), **Send me a test** (to the super admin's own address only, with the saved signature; its button
just opens the app; on dev and sandbox it lands in `email_outbox`), and **Reset to the original** (only when changed).

### The signature

Below the email: the signature at the bottom of **every email a member gets** - invitations, band invitations,
password and email-address emails, notices, retention warnings, account closing and deletion, recording removals.
**Not** the alerts the app sends the owner (a new request to join, a report, a cost warning, a sign-up, an upgrade
request): those call `sendMail` with `toOwner: true`. Owner's decisions, 26 Oct 2026.

- Paste it in from an email program, or type and format it (the same buttons). **Edit as HTML** for the code.
- **Links** (https, mailto, tel) are allowed here - and only here.
- **One picture: the logo**, uploaded on the page (**Upload a logo** - PNG, JPEG or WebP, up to 1 MB; the browser sends
  it straight to the file store's `email-signature/` folder, like a band's logo). **Insert the logo** puts it where the
  cursor is. Any other picture is taken out when it is saved, so nothing in an email loads from somewhere else.
  **Replace the logo** swaps it in the signature too; **Remove the logo** takes it out and deletes the file.
- **Remove the signature** - emails go without one; the logo file is deleted too.
- Saving says when the cleaning took something out ("anything an email can't carry was taken out").

## Fill-ins

Written in curly brackets, case and spacing don't matter (`{First Name}` works). Each email lists its own on the page
(`{band}`, `{invited by}`, `{new address}`, `{deletion date}`, `{message}`...). Two that many share:

- `{first name}` - their first name, or "there" when we don't have one ("Hi {first name}," becomes "Hi there,").
  Escaped when it goes into the HTML.
- `{ways in}` - how they can get in, from `SIGN_IN_WAYS` (`waysInWords` in `server/services/signInWays.js`): "sign in
  with Google if this email address is a Google account, or choose a password" where both are on, only Google where
  password login is off. A way added later appears here by itself. **It must be in the words**, so nobody is left not
  knowing how to get in.

A fill-in the email doesn't know, a bracket left open, or formatting part-way through a fill-in (`{first <b>name</b>}`
- format the whole of it or none) is refused with words saying which.

## What can't be changed

- **The button's link.** The app adds it; a link in the words is refused, so the button is the only link above the
  signature.
- **The small print** after the button where an email has it (the invitation's "This link works for 7 days. If you
  weren't expecting it, you can ignore this email.", a password link's "If it wasn't you, ignore this email..."). It is
  what tells a stranger they can ignore it. The signature goes just above it.

## How it works

- **Cleaning** - `server/services/emailHtml.js`, with `sanitize-html` (in the third-party register; keep it at 2.18.1
  or later). The words keep `p br strong b em i u ul ol li` and no attributes. The signature also keeps `div span
  small a img table thead tbody tr td th hr font`, a few attributes and simple styles (colours, fonts, sizes, spacing,
  borders), links whose scheme is https, mailto or tel (each given `rel="noopener noreferrer"`), and an `img` only if
  its address is the uploaded logo's. Scripts, styles blocks, frames and forms go with their content. Cleaned before
  it is saved and again when it is read. `htmlToText` makes the plain-text copy every email carries.
- `email_wording` and `email_signature` (migration 161; 162 lets an email with no button be saved). No row = the built-in wording / no signature. Who saved it
  empties if that account is ever deleted; the wording stays.
- `server/services/emailCatalogue.js`: `EMAILS` - each email's group, name, when it is sent, fill-ins, required
  fill-ins, block fill-ins (`{message}`), built-in wording as HTML, button or none, fixed small print, preview sample.
- `server/services/emailBuild.js` (pure - no database, so every email builds in a test): `checkWording`, `buildEmail`
  (fill-ins filled and escaped, a block fill-in made into paragraphs, an empty optional line dropped, then
  `emailBodyHtml` from `emailLayout.js`), `nameOrThere`, `previewEmail`.
- `server/services/emailWording.js`: `wordingFor` (the saved wording if it passes the checks, otherwise the built-in
  one - so a broken saved wording never stops an email), `emailFor(key, values)` (what every sender calls), and the
  admin functions.
- `server/services/emailLayout.js` (pure): the layout - `emailBody`, `emailBodyHtml` (button, small print and a
  picture all optional), `withSignature`. `mail.js` re-exports them.
- `server/services/emailSignature.js`: the signature for sending (`emailSignature()`, read at most once a minute; it
  never throws - an email goes without it rather than not at all), and saving, the logo and removing.
- `server/services/mail.js`: `sendMail` / `sendMailBatch` add the signature (`withSignature`) unless `toOwner`.
  The layout marks its place (`SIGNATURE_MARK`, before the small print); an email with no mark goes
  with it at the end, and a text-only email is given a plain HTML copy so the signature's formatting shows.
- Each sender asks for its email by key - `emailFor('password_reset', { ... })`, or, where the email is built by a
  pure function its tests call (the alerts, the retention and deletion emails, notice copies), that function takes the
  wording as its last argument and the sender passes `await wordingFor(key)`.
- Routes, all super admins behind the admin check: `/api/admin/email-wording` (list), `PUT` / `DELETE /:key` (save /
  reset), `POST /:key/preview`, `POST /:key/test`; `/api/admin/email-signature` (`GET`, `PUT`, `DELETE`), `POST
  /email-signature/logo/upload-token`, `PUT` / `DELETE /email-signature/logo`.
- The built-in invitation is the owner's choice of 26 Oct 2026 ("option 1"). To change the built-in wording itself
  (what Reset brings back), change `EMAILS` in the code.

## Adding an email

1. Add it to `EMAILS` in `emailCatalogue.js`: its group, name and when it is sent, its built-in wording (HTML
   paragraphs, with fill-ins), its button's words or `null`, its fill-ins and which are required, its small print or
   `() => null`, and a sample for the preview.
2. Where it is sent: `sendMail({ to, ...(await emailFor(key, { fill-ins..., url })) })`.
3. A test fails if any email is built by hand (`emailBody(` outside the layout) or a key is asked for that isn't in
   the list - `server/test/emailWording.test.js`.

A new email to the owner (an alert) passes `toOwner: true` to `sendMail`, so it goes without the signature.

## Checks

`server/test/emailWording.test.js` (the checks, building, the cleaning of the words and the signature, the
plain-text copy, where the signature goes and that alerts to the owner go without it, preview, the routes' guards, a
test going only to the super admin, the logo's folder, the fall-back; ML-618: every built-in wording passes its
checks and fills every fill-in, alerts and only alerts go without the signature, nothing builds an email by hand) and `server/test/signInWays.test.js` (the
invitation with the built-in and a saved wording).
