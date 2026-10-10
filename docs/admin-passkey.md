# The admin panel's "prove it's you" check (ML-518)

The admin panel holds every member's email address, and can delete accounts and take music down. Being
signed in as a super admin used to be enough to open it, so an unlocked phone or a signed-in browser was
enough. Since ML-518 a super admin also **proves it is them** when the panel opens: with a **passkey** - the
device's own fingerprint, face or PIN - or, on a device without one, a **code from their authenticator app**
(or a recovery code).

The owner's decisions (10 October 2026):

1. A check lasts **15 minutes without use**, and 8 hours at most.
2. Lost every device: **recovery codes**, the ones two-step sign-in already has.
3. **Every admin page** needs it - the check is on opening the admin panel.
4. Passkeys are for **super admins only**. Ordinary members are not offered them.

## What a passkey is, and what is held

The fingerprint or face never leaves the device. The device checks it, then signs a question the server
asked with a key only that device holds; the server checks the signature with the public half of the key.
What is kept (`admin_passkeys`, migration 124) is that public half, the name the admin gave the device,
and when it was made and last used. The privacy policy says so ("How you sign in").

A passkey belongs to **one web address**. Dev, sandbox and the live site each need their own, and a
passkey made on `notablybetter.com` does not work on another address the site also answers at. The address
is `APP_URL` where that is set (as for emailed links), otherwise the one the request came to
(`relyingParty` in `server/services/adminCheck.js`).

## How it works

- **Opening the admin panel** (`public/admin.js`, `checkAccessAndLoad`) asks `GET /api/admin/gate`. If the
  check is needed and not fresh, the panel stays shut and `public/admin-passkeys.js` draws the screen:
  "Use my passkey", or a code.
- **The server enforces it.** Every `/api/admin` route carries `requireAdminCheck` after
  `requireSuperAdmin` (`server/middleware/auth.js`) and answers 403 `{ adminCheck: 'needed' }` without a
  fresh check. The only admin routes without it are the seven under `/gate` that make the check.
  `server/test/siteSecurity.test.js` fails a release where an admin route has lost the guard, and names the
  seven, so an eighth can't be added quietly.
- **Where the check is kept.** In the sign-in token itself, as `adm: { at, seen, how }` - when it was made,
  when the panel was last used, and whether it was made with a passkey or a code. Only the server can sign a
  token, so the page can't write its own. While the panel is in use the server hands the token back with
  `seen` moved on (the `X-Refreshed-Token` header, at most once a minute); the page keeps it where the app
  keeps the sign-in. Nothing is looked up in the database per request. The rules are
  `server/services/adminCheckRules.js` (pure; tests in `server/test/adminCheck.test.js`).
- **When it runs out** mid-session, the next request is refused and the screen is drawn over the page as it
  stands - passing it shows the page again, so nothing typed is lost. **Lock the admin panel now** (My
  passkeys) takes the check out of the token at once.
- **Signing out everywhere** (a new password, or Admin → Accounts) ends the check too, as it ends the token.

## The first time, and a new device

- A super admin who signs in **with Google** has never been asked for an authenticator app (two-step
  sign-in was only for password sign-ins). The first time they open the admin panel where the check is on,
  it walks them through setting one up (`POST /api/admin/gate/authenticator`, then `.../confirm`) - a QR code
  to scan from a computer's screen (ML-519: drawn on the server by `qrImage`, sent as a picture with the setup
  key and never kept; the `qrcode-generator` package), a button for someone reading on the phone itself, and
  the key to type - shows the
  ten recovery codes once, and offers to add a passkey to the device.
  **That first set-up is the one moment the check rests on the sign-in alone** - so each super admin should
  open the admin panel and do it straight after the release, and straight after being made a super admin.
  Admin → Security's "Administrators' sign-in" check warns while any super admin has not.
- **A new device** has no passkey, so the way in is a code. Straight after, the panel offers to add one.
- **Adding a passkey needs a check made with a code**, not with another passkey (`requireCodeCheck`). On a
  check made with a passkey, "Add a passkey" asks for the code in the same pop-up.
- **Lost the phone:** a recovery code at the code box. Each works once; **My passkeys → New recovery
  codes** makes a new set for a current code (the app's own Sign-in and security screen offers that only to
  someone with a password).
- **Lost the phone and the recovery codes:** another super admin uses Admin → Accounts → **Turn off
  two-step** for them, and they set up again the next time they open the panel. With only one super admin
  it is a change in the database (`DELETE FROM account_two_step WHERE account_id = ...`).

## Admin → My passkeys

Under Release and checks (`admin.html#passkeys`). The admin's own passkeys for the address they are on -
add, rename, remove - how the check works, recovery codes left and a new set, and Lock. Built from the
panel's existing pieces; no styles of its own.

## Where it is not asked

On a developer's machine with the local sign-in switched on (`NODE_ENV=development` and
`ALLOW_LOCAL_DEV_LOGIN=true` - the two settings that open `/auth/login?as=admin`), so the back-tests can
reach the admin panel. Anything running on Vercel always asks, whatever else is set there (`VERCEL_ENV` is
Vercel's own). **No setting switches it off anywhere else.** `ADMIN_CHECK=on` asks for it on a developer's
machine too, to try it out.

## Limits and wrong tries

- Wrong authenticator codes lock as they do at sign-in: 5 in a row pause app codes for 15 minutes; recovery
  codes still work.
- Every try at the check, and every passkey made, counts towards 40 an hour per account (`admin-check` in
  `limitCalls`).
- The server's question to a device is used once and lasts five minutes (`admin_passkey_challenges`).
- Ten passkeys per account per address.

## The package

`@simplewebauthn/server` (MIT) does the signing sums on the server - it is in the third-party register. The
browser half is our own two functions in `public/admin-passkeys.js` (`makePasskey`, `usePasskey`), which
only turn the browser's own passkey prompt's answer into text and back; no script is loaded from anywhere.
The content security policy needed no change.

## Account deletion and "Download my information"

Both tables have an account column, so account deletion clears them without being told. A member's
download includes `admin_passkeys` (the name and dates are theirs); `admin_passkey_challenges` is the app's
own workings and is left out (`HOUSEKEEPING` in `accountExport.js`).

## Trying it

- Unit tests: `server/test/adminCheck.test.js` (the rules and the guard), `server/test/siteSecurity.test.js`
  (every admin route has the guard).
- Back-test: My passkeys with a virtual passkey device (add, rename, remove) - the check itself is off on
  dev, so the back-test covers the page and the passkey being made and stored.
- The whole check, switched on: run a local server with `ADMIN_CHECK=on` and open `/admin.html` as the local
  admin. Chrome's DevTools → WebAuthn gives a virtual passkey device.

## After a release that turns it on (sandbox, then the live site)

Each super admin, on each address: open the admin panel, set up the authenticator app, save the recovery
codes, add a passkey. Then on every other device they use: a code once, and add a passkey there.
