# Retention (ML-464)

Information about people who have stopped using the app shouldn't be kept for ever (UK GDPR's "storage
limitation"). An account nobody has used for a set time is warned by email, warned again, and then
deleted. The owner's rule, agreed 6 October 2026: **emails at 22 and 23 months, deletion at 24**.

## Where things are

| | |
|---|---|
| The rules (pure, tested) | [`server/services/retentionRules.js`](../server/services/retentionRules.js), `server/test/retention.test.js` |
| Reading, emailing, deleting | [`server/services/retention.js`](../server/services/retention.js), `server/test/retentionRun.test.js` (dev database only) |
| The admin page | Admin → Members → Retention (`public/admin-retention.js`, `/api/admin/retention`) |
| The daily run | `/api/cron/usage-readings` in `server/routes/api.js` (Vercel's scheduler, 06:00) |
| Database | migration 106: `accounts.retention_stage`, `accounts.retention_stage_at`; the rule is `app_config` key `retention_rule` |

## The rule

A switch, a unit (**hours, days, months or years**) and three lengths of time: first email, second email,
deletion. It is set on Admin → Retention and kept as one JSON value. **With nothing saved it is off**, and
it is saved separately in each environment - switching it on in sandbox does nothing to production.

The unit exists so the whole thing can be watched working on sandbox: set hours and 1, 2, 3, press **Run
now** each hour, and an account goes through all three steps in an afternoon. For real use it is months.

## How a run works

Once a day, and whenever **Run now** is pressed, every account that is not a super admin and not deleted
is looked at:

1. **Unused since** = the start of the day it was last seen (`accounts.last_seen_on`), or the day it was
   made if it has never been seen - and never earlier than 6 October 2026, the day last-seen recording
   began. Nobody is counted as unused for time when use wasn't being recorded.
2. Its next step is the first email, the second email or the deletion, each at its length of time from
   "unused since".
3. **A step is never taken sooner after the one before than the rule's own gap.** So if the rule is
   switched on (or shortened) when an account is already long unused, it still gets the first email, waits
   the gap, gets the second, waits the gap, and only then goes. The date in each email is worked out the
   same way, so it is the date the deletion can really happen.
4. One step per account per run. At most 50 accounts a run.

**Old records are cleared every day, whether the rule is on or off** (`clearOldRecords`, called by the
daily job and by "Run now"): **invites** to the app 30 days after they were used or ran out, **invitations
into a band** nobody answered after 30 days, and **feedback** 12 months after it was marked resolved. The
lengths are fixed in `retention.js`. Until 6 Oct 2026 this sat inside the retention run, so with the rule
off - as it is everywhere - nothing was cleared, although the privacy policy said it was.

## What keeps it safe

- **Off until switched on**, per environment.
- **No warning counts unless its email was sent.** If the email is refused, the account stays where it was
  and the run reports the problem. So nobody is deleted who was not warned twice.
- **On the live site emails must really be leaving** (`MAIL_PROVIDER` is not `log`), or the run refuses to
  start. On dev and sandbox the emails go to the test outbox (`email_outbox`), which is what makes it safe
  to try there.
- **Super admin accounts are never touched.**
- **Using the app again starts the clock again**: `touchLastSeen` sets the stage back to nothing.
- **The deletion is the ordinary one** - `deleteMyAccount`, exactly what "Delete my account" does: the row
  is anonymised, the practice history stays as statistics (`docs/account-deletion.md`). The account goes
  first and the "it has been deleted" email is sent after, so that email is never untrue.
- **Run now asks first**, and says how many accounts are due and how many would be deleted.

## The emails

Three plain-text emails (`retentionEmail`): the first says how long it has been, the date the account will
go, and that signing in is all it takes to keep it; the second says it is the last reminder; the third
says it has been done and that they are welcome back.

## Trying it on sandbox

1. Admin → Retention: choose **Hours**, set 1, 2 and 3, switch it on, Save.
2. "Who is next" lists every account with its next step and when. An account last seen before today is
   due at once.
3. **Run now.** The first emails appear in the test outbox; the accounts show "First" under emails sent.
4. An hour later, Run now again: second emails. An hour after that: the accounts are deleted.
5. Sign in as one of them in between to see it go back to the start. (With hours, an account counts as
   unused from the start of the day it was last seen, so a second visit on the *same day* doesn't move it.
   That only matters for hours and days of testing - a real warning comes months after the last visit.)
6. **Put the rule back to months and switch it off** when you have finished, and remember sandbox accounts
   that were deleted are gone.

## Before switching it on in production

- The app must be sending email from its own domain (Resend delivers only to the owner's own address
  until a domain is verified), or the run will refuse.
- The privacy policy's "How long we keep it" already describes the rule. If the numbers are changed in
  production, change the policy in the same breath.
- Nobody can reach 22 months before August 2028, so there is no hurry - but it should be on well before.
