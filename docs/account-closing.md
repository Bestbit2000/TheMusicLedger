# Warning a member and closing an account (ML-502)

The terms say what may not be shared and that "we may close the account of someone who shares it". This
is how the owner does it: **Admin → Members → Accounts**, a row's ⋮ menu. Built 10 October 2026.

The owner's decisions (10 October 2026): block by email address only - **no IP address or anything else
about the device is kept**; closing stops sign-in and deletes nothing, so an appeal can be undone; the
privacy policy says what is kept; members were told in a notice.

## What the owner can do

| | What happens | The member is told |
|---|---|---|
| **Warn them** | A line on their record. Nothing else changes | In the app (an urgent notice only they get) and by email, in the owner's words |
| **Close this account** | They are signed out everywhere and can't sign back in. Their email address goes on the block list. **Nothing is deleted** | By email (they can't see the app) |
| **Reopen this account** | They can sign in again with everything as it was. The address comes off the block list | By email |
| **Unblock an address** | For an address still blocked after its account was deleted: the owner types it | No |

- The pop-up shows what has been done about the account so far, a reason, and the message - written from
  the reason, shown to the owner and sent as he leaves it (as removing a recording does).
- Reasons: shared something that breaks the terms; how they have treated other members; carried on
  after a warning; another reason. There is no fixed "three strikes": the record shows the warnings and
  the owner decides.
- A super admin's account is offered none of it, and nobody can act on their own account.
- What the member shared with a band **stays with the band**. Take a thing down on Admin → Shared music.
- The Accounts table shows "1 warning" / "Closed" on the row, with **Warned** and **Closed** filters.

## How sign-in is stopped

One place decides: `lookUp` in `server/services/tokenVersions.js`, read on every request (held for 30
seconds, like the token number). An address is **shut out** when its account has `closed_at` set, or -
with no account - when its hash is in `blocked_emails`.

- `tokenIsCurrent` is false for a shut-out address, whatever number the token carries. So
  `requireAuth` answers 401 to every request, and - because `requireAuth` always runs before
  `resolveAccount` - a blocked address can never start a new account by signing in with Google.
- Where a sign-in is about to be given, the person is told why instead of being bounced: the Google
  callback (and dev's local sign-in) redirect to `/#closed` and the sign-in screen says "This account has
  been closed..."; password login, an invite and the two-step code answer 403 with the same words
  (`emailIsShutOut`, `SHUT_OUT_MESSAGE`).
- Closing also adds one to `accounts.token_version`, so a sign-in from before the closing stays out even
  after a reopening.

## What is kept

| Table | What | When it goes |
|---|---|---|
| `accounts.closed_at` | When the account was closed | Cleared on reopening and on deletion |
| `account_actions` | Each warning, closing and reopening: when, the reason, the message, who by (a name as text), whether an email went | With the account (an account column: deleted with it, and in Download my information) |
| `blocked_emails` | The closed account's email address as a keyed hash - the same hash `deleted_account_markers` uses; not the address, and not reversible without `SESSION_SECRET` | **Outlives the account** (no account column). Removed by Reopen or Unblock an address |

Because the block list holds no addresses it can't be read back: the Accounts page says how many
addresses are still blocked after their account was deleted, and **Unblock an address** takes one off
when the owner types it. Changing `SESSION_SECRET` would empty the block list in effect (and the
deleted-account markers with it).

## Deleting a closed account

A closed member can't sign in to delete their own account or download their information: they email, and
the owner uses **Delete this account** (ML-514) or sends the download. Deletion is the ordinary one
(`docs/account-deletion.md`): the record goes, `closed_at` is cleared, and the address stays blocked.
Retention (`docs/retention.md`) treats a closed account like any other that isn't used.

## Known limits

- A new email address gets round the block. Bands are by invitation, and an organiser can take a member
  out of a band.
- A member who changes their address to a blocked one is not stopped (they are already a member).
- A band whose only organiser is closed has no organiser until the account is reopened.
- A closed account still gets the retention warning emails, which say "sign in to keep it".

## Tests

`server/test/accountClosing.test.js` (who can still sign in, the record, the block outliving a deletion)
and back-test 70 (the admin screens, and the sign-in screen's message). `server/test/signInToken.test.js`
allows the one redirect that carries no token (`closedPage`).
