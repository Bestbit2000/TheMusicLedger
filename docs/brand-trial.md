# Trying out a new name (ML-484)

"The Music Ledger" is a working title. While the owner chooses a name, the name the app goes by **on
screen** can be switched between three, for everyone, so a candidate can be lived with before deciding.
**This is a trial, not a rename.** Nothing legal follows it, and it switches back in one tap.

| Key | Name on screen | Sign-in picture |
|---|---|---|
| `music-ledger` (the default) | The Music Ledger | `images/LedgeSplash.jpg` |
| `notably-better` | Notably Better | `images/brands/notably-better-splash.jpg` |
| `fivetto` | Fivetto | `images/brands/fivetto-splash.jpg` |

## Where it is set

**Admin → App name** (Content group; super admins only). One button showing the name in use, a pop-up with
the three, and a confirm - because everyone sees the change the next time they open the app, signed in or
not.

It is one row in `app_config` (`key = 'brand'`). With no row, or a value that isn't one of the three, it is
`music-ledger` - so nothing is seeded and there is no migration. `server/services/brand.js` holds the three
keys and checks every read and write.

## What follows it

1. The picture on the sign-in screen, and its alt text.
2. The name at the top of Home on a phone.
3. The name in the head of the menu rail on a tablet or computer.
4. The small mark beside the name in both places ([brand-mark](../specs/components/brand-mark.md)).
5. The browser tab: its title and its icon.

## What does not

- The privacy policy, the terms of use and anything else legal. The operator and the app's legal name stay
  "The Music Ledger".
- Emails (invites, password resets, retention and usage warnings) - the owner's decision, 7 Oct 2026. So
  someone who is invited while a trial name is showing will meet both names.
- `manifest.json`, the installed-app icons and `apple-mobile-web-app-title`: changing them needs a reinstall.
- The About screen, release history, the admin panel's own wording and other body text that names the app.
- The tab icon on the admin panel, the privacy policy and the terms: always the Music Ledger mark.

Nothing new is collected or sent anywhere, so the third-party register and the privacy policy are unchanged.

## How the app knows

`public/brand.js` runs as soon as the sign-in screen, the top bar and the menu are in the page:

1. It shows the brand **this device saw last** (`localStorage`, `tml.brand`) straight away.
2. It asks `GET /api/brand`, which is **deliberately open** (the sign-in screen needs it before anyone has
   signed in) and answers with the key and nothing else: `{ "brand": "fivetto" }`. It is on the guard test's
   list of open routes (`OPEN_ROUTES`, `server/services/siteSecurityReview.js`).
3. If the answer differs it puts the screen right and remembers it.

A device that has never been told (a first visit) holds the picture, the mark and the name back until the
answer comes - 2.5 seconds at most - so nobody sees "The Music Ledger" and then another name.

`app.js` asks `Brand.name()` wherever it writes the app's name (the Home title, the tab title).

**Offline (ML-220).** `brand.js` and the three marks are in the service worker's list, and the brand's key
is in the browser's storage, so the name and mark are right with no connection. A sign-in picture is kept
once it has been seen; one that was never seen on that device falls back to the Music Ledger picture.

## The artwork

Drawn by `brand-trials/build.mjs` (`node brand-trials/build.mjs`, from the repo root). `brand-trials/` holds
the originals; the app uses copies in `public/images/brands/`:

| In the app | From | What |
|---|---|---|
| `<key>-mark.svg` | `<key>-icon.svg` | the mark beside the name |
| `<key>-tab.svg`, `<key>-tab.png` (64px) | `<key>-favicon.svg` / `.png` | the browser-tab icon: no stave, bolder |
| `<key>-splash.jpg` (1376 wide) | `<key>-splash.png` | the sign-in picture, as a JPG to keep it light |

If a drawing changes, rebuild it and copy it across again.

## When a name is chosen

This switch is scaffolding. A real rename is a different job: the legal pages, emails, the manifest and
installed icons, the domain, Google sign-in's settings, and every "The Music Ledger" in the app's text.
Take the switch out as part of that.

## Tests

`server/test/brand.test.js` (the three keys, a bad value is the default, the route is open on purpose and
says so). Back-test case 59 switches the name on dev, checks the sign-in picture, the Home title, the rail
and the tab, and switches back - **dev must never be left on a trial name**.
