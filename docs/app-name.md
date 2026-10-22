# The app's name: Notably Better

The app is called **Notably Better**. It lives at **https://notablybetter.com**, sends its emails from
`noreply@notablybetter.com` and is written to at `hello@notablybetter.com`.

"The Music Ledger" was a working title. The owner chose the new name on 8 October 2026, after trying three
candidates on screen for two days (ML-484: a switch on Admin → App name between The Music Ledger, Notably
Better and Fivetto). That switch, its page, its route (`/api/brand`) and the other two names' artwork were
taken out when the app was renamed.

## Where the name is written

| Place | What |
|---|---|
| On screen | `Brand.name()` in `public/brand.js` - the Home title and the browser tab. **Write the name with `Brand.name()`, never as a new literal in `app.js`.** The pages themselves (`app.html`: the tab title, the sign-in picture's alt text, the top bar, the menu rail's head) say it in their markup, so it is there before any script runs |
| The installed app | `public/manifest.json` (`name`, `short_name`) and `apple-mobile-web-app-title` in `app.html` |
| Emails | The subject and wording of each email, in the service that sends it (`passwordAuth.js`, `bands.js`, `emailChange.js`, `retentionRules.js` and others); the sender is `MAIL_FROM` |
| Two-step sign-in | `ISSUER` in `server/services/twoStep.js` - the name an authenticator app shows beside the code |
| The legal pages | `public/privacy.html`, `public/terms.html` - both say the app was called The Music Ledger until October 2026 |
| A member's download | `app` in `server/services/accountExport.js` |

## What still says "Music Ledger", on purpose

These are names inside the machinery. Changing them would break something and nobody sees them:

- **`musicledger:`** - the prefix on the app's own fields in a MusicXML file (`EXTENSION_PREFIX`,
  `docs/flow-musicxml.md`). Every file already exported carries it; the reader must go on recognising it.
- **`tml.…`** keys in the browser's storage, the `music-ledger-offline` database on the device and the
  service worker's cache name.
- **`…@themusicledger.local`** - the local test accounts on dev and in the back-tests.
- **The repository, the Vercel project and the Jira project** (`TheMusicLedger`, `the-music-ledger`, `ML`),
  and `the-music-ledger.vercel.app`, which still serves the app (see below).
- **Release history** (`public/releases.json`) and old notifications: they say what was true when written.

## The address

`notablybetter.com` is registered at Fasthosts, whose DNS points it at Vercel; `www.` and
`notablybetter.app` (a free domain from Vercel) are there too. Nothing in the code knows the address: every
link the app makes is relative to the address it was opened on, and the two that leave the app come from
settings in Vercel's Production environment -

- `APP_URL` - the address put in every email link;
- `GOOGLE_REDIRECT_URI` - where Google sends someone back after signing in. It must also be listed on the
  sign-in client in the Google Cloud console.

`the-music-ledger.vercel.app` is the address the app had before. It still works, and signing in with Google
from it lands on `notablybetter.com`. Leave it serving the app: a copy installed from it, or practice logged
offline there and not yet sent, belongs to that address.

A sign-in belongs to the address it was made on, so everyone signed in once more after the move.

### The front door and /app (ML-242)

`notablybetter.com/` is the **public page** (`public/index.html`, with `public/pricing.html`); the **app** is at
`notablybetter.com/app` (`public/app.html`). The public page is the file called `index.html` because Vercel
answers `/` itself with `public/index.html`, before the server is asked - the first sandbox push, with the app
still in `index.html`, showed the sign-in screen at the front door. Only the path moved, not the address, so nobody was signed out and nothing kept on a
device was lost. Every link the server makes into the app goes through `appLink()` in
`server/utils/appPath.js` - email links (`APP_URL` + `/app?invite=...`), and the sign-in hand-back
(`/app#authToken=...`). `APP_URL` and `GOOGLE_REDIRECT_URI` did not change.

- **Old links still work.** A request for the front door carrying something the app reads (`?invite=`,
  `?reset=`, `?band-invite=`, `?change-email=`, `?flow=`, `?preview=`) is forwarded to `/app` with it - by
  the public page's `public/public-hop.js` (on Vercel the server never sees the front door), and by
  `server/app.js` on a local server. A sign-in hand-back after the `#` is forwarded by `public-hop.js` too.
- **A member is never shown the public page by accident.** `public-hop.js`, first in the page's head, sends a
  device that holds a sign-in straight to `/app` - unless they followed a link from our own pages to read it. That
  covers an app installed before the move: Android picks up the new start address (`manifest.json`
  `start_url: /app`), an iPhone keeps opening `/` for ever and is hopped on.
- **Offline:** the service worker keeps `/app` (and `/`), and a page never kept falls back to `/app`.
- `/app` is served without a trailing slash, so the page's relative links (`tokens.css`, `app.js`) still resolve
  from the root; `/app/` is sent to `/app`. Back-tests sign in through `/auth/login`, which hands back to `/app`.

## Email

Emails are sent by **Brevo** (France) over SMTP, and the mailbox is at **Fasthosts** (UK). Both are in the
third-party register, with what to keep an eye on; the settings are in `docs/password-login.md` ("Email").
Before the rename the app sent from a free Gmail account and gave a Gmail address as its contact.

## The artwork

Drawn by `brand-trials/build.mjs` (`node brand-trials/build.mjs`, from the repo root), which still draws the
two names that were not chosen - only Notably Better's files are copied into the app:

| In the app | From | What |
|---|---|---|
| `public/images/brands/notably-better-mark.svg` | `notably-better-icon.svg` | the mark beside the name ([brand-mark](../specs/components/brand-mark.md)) |
| `…/notably-better-tab.svg`, `.png` (64px) | `notably-better-favicon.svg` / `.png` | the browser-tab icon: no stave, bolder |
| `…/notably-better-splash.jpg` (1376 wide) | `notably-better-splash.png` | the sign-in picture, as a JPG to keep it light |
| `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `icon-maskable-512.png` | `notably-better-icon.svg`, by `node brand-trials/install-icons.mjs` | the installed app's icons; the "maskable" one is the mark drawn smaller so a phone can cut it to a circle |

If a drawing changes, rebuild it and copy it across again. A phone that already has the app installed keeps
its old icon and name until the app is removed and installed again.

## Tests

`server/test/appName.test.js`: the pages, the manifest and `Brand.name()` agree on the name; the pictures
they point at exist; nothing in the app's pages or emails still says the old name; and the name-trial's open
route has not come back.
