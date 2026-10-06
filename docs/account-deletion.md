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
| **Scrubbed** | Name, email, display name, avatar, the date last seen (`last_seen_on`, ML-443), account type, home screen choices, display and practice-year settings | The row becomes "Deleted account", email `deleted-<id>@deleted.invalid`, `deleted_at` set |
| **Deleted** | Sign-in details (password, two-step, recovery codes), the member's own pieces with their blocks, recordings and documents (the stored files too), practice lists, plans, skill and warm-up lists, Levels, range, scales and rhythm progress, saved metronome set-ups and time signatures, feedback notes, band memberships, teacher links, invites and emails held under their address | Every table that points at an account is found from the database and cleared, unless it is in `KEPT` |
| **Kept, anonymous** | Practice sessions, Theory quiz results, drill results, piece-entry timings | They stay attached to the anonymised row |
| **Kept for others** | A band the member started, and pieces they added to a band | The band points at the anonymised row; `scores.added_by_account_id` becomes empty |

**Deleting is the default.** The service asks the database which columns point at `accounts(id)`; a table is
only spared if it is named in `KEPT`. A new table with an account column is therefore cleared without
anyone remembering to list it - add it to `KEPT` (and to the privacy policy) only if its rows are meant to
survive as statistics, and check it holds nothing that says who the member was.

On the device, deleting the account also wipes the copy kept for offline use and anything still waiting to sync (ML-220, `docs/offline.md`); the ids in `client_writes` go with the account like any other unlisted table.

An account nobody has used for a set time is deleted by the same function, after two warning emails (ML-464, `docs/retention.md`).

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

## Download my information (the same screen)

**Account → My details → Download my information** saves one JSON file of everything the app holds that
belongs to the account - the member's answer to the UK GDPR rights of access and data portability, without
having to ask. Owner's decision, 4 Oct 2026.

- Code: [`server/services/accountExport.js`](../server/services/accountExport.js), `GET /api/account/export`.
- Test: `server/test/accountExport.test.js` (dev database only, like the deletion test).
- It works the way deletion does: the database is asked which tables have a column pointing at an account,
  and the member's rows in each are exported. Then the rows that hang off those are followed down (a piece's
  blocks and recordings, a session's parts) - but **only through tables with no account column of their own**,
  so nobody else's rows can come along. A new table is included without being listed.
- **Left out:** `account_passwords`, `account_two_step`, `account_recovery_codes`, and any column whose name
  says hash, secret or token. `signIn` in the file just says whether a password and two-step are set.
- **Not followed:** `bands`, `band_members`, `notifications`, `security_review_runs` - the member's own rows
  are exported, but what hangs off them belongs to other people (a band's other members).
- Recordings and documents are listed with the address of each file; the files themselves aren't in the JSON.

The file uses the database's own table and column names. That is deliberate: it is complete and it can't
drift from what is really held.
