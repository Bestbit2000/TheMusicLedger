# Email + password login (ML-355)

Logging in with an email address and a password, next to Google. **Off until switched on**: it's the
`password_login` feature (Admin → Feature access), and only its **Live** switch counts - it's used
before anyone has logged in. A feature missing from the table reads as off (`isFeatureLive`).

Owner decisions (2026-09-29): invite-only; the email address is the username; 2FA optional for
everyone but required for super admins; a dedicated
Gmail account (SMTP) for email until the app has its own domain. (Resend was the first plan for that; the owner
dropped it on 7 October 2026 - he wants a provider based in Europe - and its code was taken out. Any provider
that offers SMTP works with no new code.)

| Batch | What | Status |
|---|---|---|
| 1 | Password login, invites, forgot / reset password, email sending, dev outbox | built |
| 2 | Two-step sign-in (authenticator app + recovery codes); required for super admins | built |
| 3 | Admin tools: login method per account, unlock, send a reset link, turn off 2FA, sign out everywhere; change (or add) your password in the app | built |

## How it works

- **One account per email address**, however you log in. Accepting an invite for an email that already
  logs in with Google adds a password to that same account (its name and type stay as they are).
- **Invite-only.** Any member can invite from the main menu's **Invite someone** (ML-402: feature `invite_members`,
  always a Standard member, 5 a day - the `invites_per_day` limit - and you see and cancel only your own; a super admin
  also picks the type there; `/api/invites`, `specs/components/invite.md`). The admin page keeps its own: Admin → Accounts → "+ Invite by email": email, name, account type (not super admin -
  promoting a super admin stays a deliberate change there). The email's link (`/?invite=…`, 7 days, once) opens "choose a password"; saving it
  creates the account (with the invite's name and type) and logs in. A newer invite replaces an older
  one. Unused invites are listed there and can be cancelled.
- **Log in** with email + password on the login screen (under Google's button). The server answers with
  the app's usual signed token as JSON; the page stores it like Google's.
- **What the token holds, and how a Google sign-in hands it over (ML-475).** The token says who it is
  (`userId`, name, `tv`) and nothing of Google's: Google's access and refresh keys are dropped in
  `server/config/passport.js`, and the sign-in no longer asks for offline access. After Google's callback the
  token goes back to the page after the `#` (`handBack` in `server/routes/auth.js`) - the part of an address
  that is never sent to a server - and `AuthManager.handleCallback` stores it and takes it out of the address.
  A token signed before 0.48.0 still works; on its next request the member is handed the same sign-in
  without Google's keys (`X-Refreshed-Token`, same end date) and the old refresh key is cancelled at Google
  (`dropGoogleKeys` in `server/middleware/auth.js` - it can be taken out once those tokens have run out,
  30 days after 0.48.0). Tests: `server/test/signInToken.test.js`.
- **Forgot your password?** emails a link (`/?reset=…`, 1 hour, once). The answer is always "if that
  email has an account, we've sent it a link" - it never says whether an account exists. Any account
  can use it, including a Google one (that's how a Google user adds a password).
- **Setting a new password signs you out everywhere**: `accounts.token_version` goes up, and every token
  carries the version it was signed with (`tv`) - older ones get a 401 (`server/services/tokenVersions.js`,
  checked in `requireAuth`, cached 30 s per email). Google logins carry it too. A database error in that
  check answers 500, never 401, so a blip can't log anyone out (ML-48).
- **Super admins** can use password login only with two-step sign-in: their first password login
  (or accepting an invite / resetting) takes them through setting it up, and they can't turn it off.

## Two-step sign-in (batch 2)

- **What it is:** after the password, a 6-digit code from an authenticator app (Google Authenticator,
  Microsoft Authenticator, 1Password...) - TOTP, RFC 6238 (HMAC-SHA1, 30 s steps, the step before and
  after also accepted for clock drift; a code can't be used twice). `server/services/twoStep.js`, no
  package. Only password logins ask for it - Google logins rely on Google's own 2-Step Verification.
- **Set up** in My account → **Sign-in and security** (the row shows once `password_login` is Live):
  "Add to my authenticator app" opens the `otpauth:` link (on a phone that's the authenticator app
  itself), or type the setup key; then a code from the app turns it on and shows **10 recovery codes**
  once (each works once if the phone's lost). There: new recovery codes, and turn it off - each needs a
  current code (turning off also takes a recovery code). No QR code yet - adding one needs a package.
- **Logging in:** password → the server answers with a 10-minute **challenge** (signed like a token but
  with no `userId`, so it can never be used as a login) → the code (or "Use a recovery code instead") →
  logged in. Logging in with a recovery code says how many are left. An invite or reset link goes
  through the same step, so an emailed link can't skip two-step sign-in.
- **Required for super admins:** a super admin's password login without it gets a challenge to set it
  up on the login screen first. They can't turn it off.
- **Wrong codes:** 5 in a row pause app codes for 15 minutes (recovery codes still work); 30 attempts per
  15 minutes per IP across the two-step endpoints.
- **Storage:** the TOTP secret is encrypted (AES-256-GCM) with a key from `TWO_STEP_KEY`, or derived from
  `SESSION_SECRET` if that's not set - changing it means everyone sets two-step sign-in up again.
  Recovery codes are stored as SHA-256 only. Tables: `account_two_step`, `account_recovery_codes`
  (migration 075).

## Changing your password, and the admin tools (batch 3)

- **My account → Sign-in and security → Change password:** the current password (wrong ones count
  towards the lock, like logging in), then the new one twice. Every other device is signed out; this one
  gets a fresh token (`POST /api/account/password`). A **Google-only** account sees **Add a password**
  instead (no current password) - then it can also log in with its email.
- **Admin → Accounts** shows how each account logs in ("Google" or "Google or email + password"),
  whether two-step is on, the last password login, and a lock ("locked until …, too many wrong tries").
  Buttons, each asking first:
  - **Send a reset link** (or "…to add a password" for a Google-only account) - emails the 1-hour link
    as if they'd asked (needs `password_login` on).
  - **Unlock** (only while locked) - clears the pause after wrong passwords or codes.
  - **Turn off two-step** (only while it's on) - for a lost phone with no recovery codes; only once
    you're sure it's them. A super admin is asked to set it up again at their next password login.
  - **Sign out everywhere** - bumps their token version, so every device (Google too) logs in again.
  Routes: `POST /api/admin/accounts/:id/send-reset | unlock | two-step/off | sign-out`.

## Security details

- Passwords: scrypt (N=32768, r=8, p=1, 16-byte salt), stored as `scrypt$N$r$p$salt$hash` so the cost
  can rise later (`server/services/passwords.js`). At least 10 characters, at most 200, and not in a
  known breach - checked with Have I Been Pwned's range API, which is sent only the first 5 characters
  of the password's SHA-1 (skipped if unreachable; `PASSWORD_BREACH_CHECK=off` turns it off for tests).
- A wrong email takes as long as a wrong password (a dummy hash is checked), and gets the same message.
- 5 wrong passwords in a row pause password login for that account for 15 minutes (Google login still
  works, and a reset unlocks it).
- Rate limits across serverless instances (`auth_rate_events`): 30 logins / 15 min per IP; 10 forgot-
  password requests / hour per IP and 3 per email; 60 link opens / 15 min per IP.
- Emailed links: 32 random bytes; only a SHA-256 is stored (`auth_email_links`). They leave the address
  bar as soon as the page opens them.
- Links point at `APP_URL`. With real email that's required - a request's Host header is the caller's
  to choose, and a link pointing somewhere else would hand them the account.

## Email

`server/services/mail.js`. The service is a setting:

| `MAIL_PROVIDER` | Where | Needs |
|---|---|---|
| `log` (default) | written to the `email_outbox` table, never sent - local, dev and sandbox; back-tests read the links from it. The app says so wherever it would say "sent" (ML-479: `emailOutcome` / `sentOrHeld` in `mail.js`) - invites, band invitations, the admin's reset link, and "Forgot your password?", which answers "This site doesn't send emails, so no link has been sent." for every address alike | - |
| `smtp` | any SMTP server - e.g. a dedicated Gmail account | `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (a Google **app password**, needs 2-step verification on that Gmail account), and `npm install nodemailer` in `server/` |

Plus `MAIL_FROM` (e.g. `The Music Ledger <musicledger.mail@gmail.com>`) and `APP_URL` (e.g.
`https://the-music-ledger.vercel.app`) wherever real email is sent. Gmail allows ~500 emails a day,
plenty for invite-only.

**New sign-up alerts (ML-392):** when an account is created - a first Google login, or an invite accepted
with a password - `server/services/signupAlert.js` emails `SIGNUP_ALERT_EMAIL` the name, email, date (UK
time), how they signed up and the device (from the User-Agent; Chrome on Android adds the model through the
`Sec-CH-UA-Model` hint, asked for with `Accept-CH` in `server/app.js` - iPhones never say their model).
Unset = no alert. Set in Vercel for Production only (2026-10-01), so sandbox and dev don't alert; on dev it
would go to `email_outbox` like every other email. A failed alert is logged and never stops the sign-up.

## Turning it on (sandbox, then production)

1. Create the Gmail account, turn on 2-step verification, make an app password.
2. `npm install nodemailer` in `server/` (a release).
3. In Vercel (that environment): `MAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
   `SMTP_PASS`, `MAIL_FROM`, `APP_URL`.
4. Admin → Feature access: switch **Email and password login** Live.
5. Invite yourself at a plus-address (`you+test1@gmail.com`) - each one is a separate account, all in
   your inbox.

## Where things are

`db/migrations/074_password_login.sql` (tables), `server/services/passwordAuth.js` (the flows),
`passwords.js`, `mail.js`, `tokenVersions.js`, `server/routes/auth.js` (`/auth/methods`,
`/auth/password/login|forgot|reset`, `/auth/link/:purpose/:secret`, `/auth/invite/accept`),
`server/routes/admin.js` (`/api/admin/invites`), `server/services/twoStep.js` + `/auth/two-step*` + `/api/account/security`, `/api/account/two-step/*` (batch 2), the login screen in `public/index.html` +
`public/app.js` (search ML-355), Admin → Accounts (`public/admin.js`). Unit tests:
`server/test/passwords.test.js`, `server/test/twoStep.test.js` (the RFC 6238 test vectors).

## Changing your email address (ML-465)

The address is the account's identity: both ways of signing in find the account by it, sign-in tokens
carry it, and band invitations are addressed to it. So it is not edited like a name - the new address is
proved first. The owner's decision (6 Oct 2026), the same for Google and for email + password:

1. **My details → Email** (feature `change_email`; Super admin only until switched on in Feature access).
   The member types the new address; one who signs in with a password gives it too. An address that
   already has an account is refused. Five requests a day (`limitCalls`, `change-email`).
2. **A link goes to the new address** (`/?change-email=...`, works once, for 60 minutes). Nothing changes
   until it is used. The email shows the old address mostly hidden (`maskEmail`) - the new one may have
   been mistyped.
3. **The link opens a screen, signed in or not**, that says what will change and waits for a tap (an
   email scanner following the link changes nothing): `GET /auth/email-change/:secret`, then
   `POST /auth/email-change/confirm`.
4. **On confirming** (`confirmEmailChange`, one transaction): `accounts.email` is the new address;
   `token_version` goes up, so every device is signed out; the old address is left a marker
   (`deleted_account_markers`, the table a deleted account leaves one in) so a token that still names it
   is refused and can't start a new, empty account under it; band invitations waiting for the old address
   move to the new one; every other emailed link for either address is spent. **The old address is
   emailed** that it happened (the new one mostly hidden).
5. They **sign in with the new address** - with Google, the Google account for that address. The
   password, two-step sign-in and everything else hang off the account, not the address, so nothing else
   moves.

**A super admin can start it** for someone who has lost the old address: Admin → Accounts → the row's
menu → **Change their email address**. No password is asked, but the link still goes to the new address,
so it is still the inbox that proves it.

**The half minute after.** Token versions are cached for 30 seconds per server (`tokenVersions.js`), so
a request with an old token could reach a server that hasn't heard. `getOrCreateAccount` is now told the
token's number and refuses (401) to start an account under an address whose marker is newer - which
closes the same gap for a deleted account.

**Offline (ML-220).** The copy on a device belongs to one member, known by their address. The device
that confirms the change hands its copy to the new address (`Offline.rename`), so nothing waiting to be
sent is lost there. **Another device** signed in as the old address is signed out and, when it signs in
with the new one, starts a fresh copy - anything logged offline on it and not yet sent is lost. The
pop-up says to let other devices sync first.

Emails follow ML-479: on a site that only keeps its emails (dev, sandbox) the app says the link has not
gone anywhere.

Code: `server/services/emailChange.js`; tests `server/test/emailChange.test.js` (dev database) and
back-test 57; migration `114_change_email.sql` (`auth_email_links.purpose` gains `change-email`, and
`for_account_id`).
