# Working offline (ML-220)

The app can be used where there is no internet. It opens from a copy of the member's data kept on the
device, the practice tools run, and what is logged waits on the device and is sent when the connection is
back. Agreed with the owner on 6 October 2026: **playing and logging work offline; editing needs a
connection; recordings are not kept offline.**

## Where things are

| | |
|---|---|
| The rules and the on-device store | [`public/offline.js`](../public/offline.js) (`window.Offline`) |
| The part that needs the app | `apiCall`, `offlineAnswer`, `syncOffline`, `renderOfflineBar`, `keepOfflineCopy` in `public/app.js` |
| The app's own files, kept for offline | [`public/sw.js`](../public/sw.js) |
| Not counting a write twice | [`server/services/clientWrites.js`](../server/services/clientWrites.js), called from `resolveAccount` in `server/middleware/auth.js`; table `client_writes` (migration 105) |
| Tests | `server/test/offline.test.js` (the rules, pure) |
| What it looks like | [`specs/components/offline-status.md`](../specs/components/offline-status.md) |

## How it works

Every server call in the app goes through one function, `apiCall`. That is where offline is handled, so no
screen has code of its own for it.

**With a connection**, nothing changes, except that the answer to every read (GET) is also kept on the
device (IndexedDB `music-ledger-offline`, store `answers`), keyed by its address.

**With no connection** (the `fetch` itself fails - a refusal from the server is an answer, not "offline"):

- **A read** is answered from the kept copy. If that read was never made on this device, it fails with "You
  are offline, and this has not been saved on this device yet."
- **A write that only logs something** waits in the `outbox` store and the caller is told
  `{ queued: true, message }`. The list is `QUEUE` in `offline.js`: a session, a practice session, a Theory
  round, a Skills round, a Level on a piece, a scale answer or Level, a skill step, a range go, Quick Play
  history. These are records of something done, so they can never clash with a change made elsewhere.
- **A write that keeps the server in step with something running now** (the timer, a session in progress, a
  notification read) is dropped quietly (`QUIET`): there is nothing to sync.
- **Everything else needs a connection** and fails with "You are offline. This needs a connection." - making
  or editing a piece, Prepare (painting and cutting bars), practice lists, bands, the account, invites,
  uploads, changing your range, editing or deleting a session.

**To add something to the offline list**, add it to `QUEUE` *and* check every place the app uses that call's
answer: offline it gets `{ queued: true }` instead of the server's answer. Each of today's callers copes
(look for "ML-220" in `app.js`).

### The copy for offline use

Reads are kept as they happen, so anything opened once is there. On top of that, once a day (8 seconds
after start-up, with a connection) `keepOfflineCopy` reads the lists the tools open with and every piece
(details, bars, Levels; up to 100), one at a time, so pieces are on the device before the connection goes -
not only the ones opened lately. It costs a few dozen small requests a day per device.

Not kept: what is running now (`/api/timer/active`, `/api/practice/active`), notifications, the data
export, two-step set-up, invites, admin answers (`NO_COPY`). Nothing is kept while previewing the app as
another account type. Recordings and documents are files, not answers: they are not kept (owner's decision).

### Syncing

`syncOffline` sends the outbox oldest first, straight to the server (not through `apiCall`, so a failure
can't queue an item twice). It runs at start-up, when the browser says the connection is back, after the
first call that gets through, every minute while something is waiting, and from **Sync now**.

- Each item is sent with `X-Client-Write-Id` (its own id, made on the device) and `X-Client-Write-At`.
- **No connection, signed out (401), too many requests or a server error:** stop, and try again later.
  Nothing after it is tried, so the order is kept.
- **The server refuses it for good (another 4xx):** the item stays in the list marked "not synced" with the
  reason, and can be removed by the member. The rest carry on.
- After a sync the stats and history are read again.

### Never counted twice

If the answer to a send is lost, the device sends the item again. `resolveAccount` sees the id: the first
arrival is recorded in `client_writes` and goes ahead; a later one is answered `{ alreadySaved: true }`
and nothing runs. If the handler fails, the id is given back so the next try goes through. Rows older than
60 days are cleared as new ones arrive.

### When it happened

A session logged offline keeps its own date (it is in the form). A practice session sends `endedAt`, so it
lands at the time it really ended (the server believes a time up to 60 days old and not in the future).
Theory and Skills rounds carry their own start time. A Level, a scale answer and a range go are dated when
they arrive.

## Whose copy it is (privacy)

- The copy belongs to one member. `Offline.start(owner)` wipes everything if a different member signs in.
- **Signing out** wipes the kept answers and anything the service worker kept. If the member chose to sign
  out (or deleted the account) the outbox goes too - the confirmation says how many things haven't synced
  and will be lost. After a sign-out they didn't choose (an expired sign-in), the outbox stays and is sent
  when they sign back in.
- The service worker keeps **the app's own files only**. Before ML-220 it also kept every answer from the
  server and never cleared them, which left one member's data on the device for the next. `CACHE_NAME` was
  bumped to drop that cache.
- The privacy policy says a copy is kept on the device and when it is removed. Keep the two in step.

## What the member sees

A bar under the top bar (hidden when online with nothing waiting), a pop-up listing what is waiting, and
three toasts. All in `specs/components/offline-status.md`.

## Limits worth knowing

- **Signing in needs a connection**, and a sign-in lasts 30 days. Longer offline than that means signing in
  again; what is waiting is kept and sent then.
- **A new device needs a connection once**, to get its copy.
- **An iPhone can clear a web app's saved data** if it isn't opened for a while. Adding the app to the Home
  Screen makes that much less likely (the app also asks the browser to keep its storage).
- **What the server works out comes after the sync.** Offline, a Theory or Skills round shows its result but
  not its Level; a range go shows what was held but not the Level; a Level set on a piece shows on the
  screen you are on, but the copy on the device still has the old one until the sync. Scale answers move
  their Level straight away (the same rule runs in the browser).
- **A timer or practice session running when the page is reloaded offline is lost** - it is only kept on the
  server while it runs. The time can still be logged by hand.
- If IndexedDB can't be used (a private window), the app behaves as before: online only.

## Not built (the owner said no)

Recordings kept on the device, and editing or adding pieces offline.

## A changed email address (ML-465)

The copy on a device is one member's, known by the address they sign in with (`Offline.start(owner)`). When
a member changes their address, the device they confirm it on hands its copy to the new address
(`Offline.rename`) - the cached answers and the outbox stay. Any **other** device is signed out and starts a
fresh copy when it signs in with the new address, so something logged offline there and not yet sent is
lost; the change-email pop-up says to let other devices sync first. See docs/password-login.md.
