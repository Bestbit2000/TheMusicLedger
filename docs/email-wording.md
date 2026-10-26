# Email wording (ML-617)

What the app's emails say can be changed on **Admin → Content → Email wording**, without a release. Built 26 Oct
2026, starting with one email, the **invitation**, plus a **signature** at the bottom of every email a member gets.
Other emails (the band invitation, password reset...) can join the page one at a time.

## The page

`public/admin-email-wording.js`; the editor is `.admin-rich-toolbar` + `.admin-rich-text`
(`specs/components/admin-email-wording.md`). For each email: what it is and when it is sent, whether it is the
built-in wording or was changed (by whom, on which day), and:

- **Subject** - up to 100 characters.
- **Words** - up to 1,500 characters as read. Formatting buttons: **Bold**, **Italic**, **Underline**, **Bulleted list**
  (Ctrl+B / I / U work too). **Edit as HTML** swaps the box for its HTML. No links and no pictures in the words.
- **Button** - the button's words, up to 30 characters ("Get started").

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

Written in curly brackets, case and spacing don't matter (`{First Name}` works). For the invitation:

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
- **The last line**: "This link works for 7 days. If you weren't expecting it, you can ignore this email." It is what
  tells a stranger they can ignore it. The signature goes just above it.
- **The invitation to someone who already has an account** (gaining a password as well as Google) stays built-in.

## How it works

- **Cleaning** - `server/services/emailHtml.js`, with `sanitize-html` (in the third-party register; keep it at 2.18.1
  or later). The words keep `p br strong b em i u ul ol li` and no attributes. The signature also keeps `div span
  small a img table thead tbody tr td th hr font`, a few attributes and simple styles (colours, fonts, sizes, spacing,
  borders), links whose scheme is https, mailto or tel (each given `rel="noopener noreferrer"`), and an `img` only if
  its address is the uploaded logo's. Scripts, styles blocks, frames and forms go with their content. Cleaned before
  it is saved and again when it is read. `htmlToText` makes the plain-text copy every email carries.
- `email_wording` and `email_signature` (migration 161). No row = the built-in wording / no signature. Who saved it
  empties if that account is ever deleted; the wording stays.
- `server/services/emailWording.js`: `EMAILS` (each email's name, when it is sent, fill-ins, required fill-ins,
  built-in wording as HTML, fixed last line, preview sample), `checkWording`, `buildEmail` (fill-ins filled, then
  `emailBodyHtml` from `mail.js` with the button and the last line), `wordingFor` (the saved wording if it passes the
  checks, otherwise the built-in one - so a broken saved wording never stops an email), and the admin functions.
- `server/services/emailSignature.js`: the signature for sending (`emailSignature()`, read at most once a minute; it
  never throws - an email goes without it rather than not at all), and saving, the logo and removing.
- `server/services/mail.js`: `sendMail` / `sendMailBatch` add the signature (`withSignature`) unless `toOwner`.
  `emailBody` / `emailBodyHtml` mark its place (`SIGNATURE_MARK`, before the small print); an email with no mark goes
  with it at the end, and a text-only email is given a plain HTML copy so the signature's formatting shows.
- The invitation: `invitationEmail` / `createInvite` in `server/services/passwordAuth.js` read `wordingFor('invitation')`.
  It goes out from Let in on the Waiting list, Invite by email on Accounts, and Invite someone.
- Routes, all super admins behind the admin check: `/api/admin/email-wording` (list), `PUT` / `DELETE /:key` (save /
  reset), `POST /:key/preview`, `POST /:key/test`; `/api/admin/email-signature` (`GET`, `PUT`, `DELETE`), `POST
  /email-signature/logo/upload-token`, `PUT` / `DELETE /email-signature/logo`.
- The built-in invitation is the owner's choice of 26 Oct 2026 ("option 1"). To change the built-in wording itself
  (what Reset brings back), change `EMAILS` in the code.

## Adding an email

1. Add it to `EMAILS` with its built-in wording (today's text as HTML paragraphs, with fill-ins), its fill-ins, which
   are required, its fixed last line and a preview sample.
2. Where the email is built, read `wordingFor(key)` and call `buildEmail(key, wording, values)` with the fill-ins and
   the button's url.
3. Give the route's preview and test the right values (`sampleValues` in `server/routes/admin.js`).
4. Tests in `server/test/emailWording.test.js`.

A new email to the owner (an alert) passes `toOwner: true` to `sendMail`, so it goes without the signature.

## Checks

`server/test/emailWording.test.js` (the checks, building, the cleaning of the words and the signature, the
plain-text copy, where the signature goes and that alerts to the owner go without it, preview, the routes' guards, a
test going only to the super admin, the logo's folder, the fall-back) and `server/test/signInWays.test.js` (the
invitation with the built-in and a saved wording).
