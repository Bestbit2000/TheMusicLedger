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
| On screen | `Brand.name()` in `public/brand.js` - the Home title and the browser tab. **Write the name with `Brand.name()`, never as a new literal in `app.js`.** The pages themselves (`index.html`: the tab title, the sign-in picture's alt text, the top bar, the menu rail's head) say it in their markup, so it is there before any script runs |
| The installed app | `public/manifest.json` (`name`, `short_name`) and `apple-mobile-web-app-title` in `index.html` |
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
