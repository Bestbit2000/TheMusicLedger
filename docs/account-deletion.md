# Delete my account (ML-430)

A member deletes their own account from **Account → My details → Delete my account**. It happens at once
and can't be undone. Decided with the owner on 4 Oct 2026: the member is in charge of it, and the practice
history is kept as statistics with nobody attached.

- Code: [`server/services/accountDeletion.js`](../server/services/accountDeletion.js), `DELETE /api/account`
  (the body must be `{ "confirm": "DELETE" }`), the pop-up `#accountDeleteModal` in `index.html`.
- Database: [`db/migrations/099_account_deletion.sql`](../db/migrations/099_account_deletion.sql) -
  `accounts.deleted_at` and `deleted_account_markers`.
- Test: `server/test/accountDeletion.test.js` - needs the dev database, so it is skipped by `npm test`. Run it
  from `server/` with `node --env-file=../.env --env-file=.env --test test/accountDeletion.test.js`.
- What members are told: the pop-up, and the privacy policy (`public/privacy.html`). **Keep the three in step**
  - if what is kept or deleted changes here, change the words there.

## What happens

The `accounts` row is **not removed**. 39 tables delete their rows when an account row goes, which would take
the practice history with it. It is anonymised in place instead.

| | What | How |
|---|---|---|
| **Scrubbed** | Name, email, display name, avatar, account type, home screen choices, display and practice-year settings | The row becomes "Deleted account", email `deleted-<id>@deleted.invalid`, `deleted_at` set |
| **Deleted** | Sign-in details (password, two-step, recovery codes), the member's own pieces with their blocks, recordings and documents (the stored files too), practice lists, plans, skill and warm-up lists, Levels, range, scales and rhythm progress, saved metronome set-ups and time signatures, feedback notes, band memberships, teacher links, invites and emails held under their address | Every table that points at an account is found from the database and cleared, unless it is in `KEPT` |
| **Kept, anonymous** | Practice sessions, Theory quiz results, drill results, piece-entry timings | They stay attached to the anonymised row |
| **Kept for others** | A band the member started, and pieces they added to a band | The band points at the anonymised row; `scores.added_by_account_id` becomes empty |

**Deleting is the default.** The service asks the database which columns point at `accounts(id)`; a table is
only spared if it is named in `KEPT`. A new table with an account column is therefore cleared without
anyone remembering to list it - add it to `KEPT` (and to the privacy policy) only if its rows are meant to
survive as statistics, and check it holds nothing that says who the member was.

A super admin account can't be deleted by the button (it owns the public library): change its type first.

## Signed out everywhere, and signing up again

A login token is tied to an email and to `accounts.token_version`. Once the row no longer carries the
email, an old token on another device would look like a first login and quietly make a new account. So the
deletion leaves a **marker**: a keyed hash of the email (HMAC with `SESSION_SECRET` - not the address) with
the number an old token must beat. `currentTokenVersion` reads it when there is no account, so old tokens
are refused.

The same email can sign up again and gets a fresh, empty account, which takes over the marker's number
(`getOrCreateAccount`, and the invite path in `passwordAuth.js`) - so sign-ins from before the deletion
stay out. The marker is dropped then, and after 31 days in any case (tokens last 30).

## In the admin panel

- Accounts doesn't list a deleted account.
- Usage → Recent sessions shows its runs under "Deleted account".
- The stored files are removed after the database change. If that fails the account is still deleted and
  the failure is logged on the server ("Account deletion: N stored file(s) could not be removed").
