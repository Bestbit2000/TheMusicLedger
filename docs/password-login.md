# Email + password login (ML-355)

Logging in with an email address and a password, next to Google. **Off until switched on**: it's the
`password_login` feature (Admin → Feature access), and only its **Live** switch counts - it's used
before anyone has logged in. A feature missing from the table reads as off (`isFeatureLive`).

Owner decisions (2026-09-29): invite-only; the email address is the username; 2FA optional for
everyone but required for super admins; Resend for email once the app has its own domain, a dedicated
Gmail account (SMTP) until then.

| Batch | What | Status |
|---|---|---|
| 1 | Password login, invites, forgot / reset password, email sending, dev outbox | built |
| 2 | Two-step sign-in (authenticator app + recovery codes); required for super admins | to do |
| 3 | Admin tools: login method per account, unlock, send a reset link, turn off 2FA; change password in the app | to do |

## How it works

- **One account per email address**, however you log in. Accepting an invite for an email that already
  logs in with Google adds a password to that same account (its name and type stay as they are).
- **Invite-only.** Admin → Accounts → "+ Invite by email": email, name, account type (not super admin
  until batch 2). The email's link (`/?invite=…`, 7 days, once) opens "choose a password"; saving it
  creates the account (with the invite's name and type) and logs in. A newer invite replaces an older
  one. Unused invites are listed there and can be cancelled.
- **Log in** with email + password on the login screen (under Google's button). The server answers with
  the app's usual signed token as JSON; the page stores it like Google's.
- **Forgot your password?** emails a link (`/?reset=…`, 1 hour, once). The answer is always "if that
  email has an account, we've sent it a link" - it never says whether an account exists. Any account
  can use it, including a Google one (that's how a Google user adds a password).
- **Setting a new password signs you out everywhere**: `accounts.token_version` goes up, and every token
  carries the version it was signed with (`tv`) - older ones get a 401 (`server/services/tokenVersions.js`,
  checked in `requireAuth`, cached 30 s per email). Google logins carry it too. A database error in that
  check answers 500, never 401, so a blip can't log anyone out (ML-48).
- **Super admins** can't use password login until batch 2 (two-step sign-in is required for them).

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
| `log` (default) | written to the `email_outbox` table, never sent - local and dev; back-tests read the links from it | - |
| `smtp` | any SMTP server - e.g. a dedicated Gmail account | `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (a Google **app password**, needs 2-step verification on that Gmail account), and `npm install nodemailer` in `server/` |
| `resend` | Resend's API, once the app has its own domain verified there | `RESEND_API_KEY` |

Plus `MAIL_FROM` (e.g. `The Music Ledger <musicledger.mail@gmail.com>`) and `APP_URL` (e.g.
`https://the-music-ledger.vercel.app`) wherever real email is sent. Gmail allows ~500 emails a day,
plenty for invite-only.

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
`server/routes/admin.js` (`/api/admin/invites`), the login screen in `public/index.html` +
`public/app.js` (search ML-355), Admin → Accounts (`public/admin.js`). Unit tests:
`server/test/passwords.test.js`.
