# UK GDPR assessment (ML-221)

**This is version 3, 7 October 2026.** It is a check of the app against the UK GDPR's principles and the
rules around them, kept as a running record: each review adds a version, says what has happened since the
last one, and shows how each gap is being filled. It is a careful reading by Claude, **not legal advice**.

## Version history

| Version | Date | By | What it is |
|---|---|---|---|
| 1 | 6 October 2026 | Claude, for Andrew Storey | The first assessment: every principle checked against the code, the live site, the policy, the third-party register and the three databases. 21 gaps found. Kept in full at the end of this document, as written. |
| 2 | 6 October 2026 | Claude, for Andrew Storey | After the owner's decisions the same day: 4 gaps closed, 6 built or drafted and waiting on the owner, 8 with a ticket, 3 with the owner. |
| 3 | 7 October 2026 | Claude, for Andrew Storey | A re-run after releases 0.47.0 and 0.48.0, at the owner's request: every gap checked again against the code, the live site and the three databases. 9 closed, 12 still open - none of them needs anything new built; all 12 wait on the owner. One new finding. |

**Next review:** 6 October 2027, or sooner if what the app holds, or who receives it, changes. Each review:
re-read the evidence named in version 1's rows, update the gap register below, add a row above, and write a
"what has happened since" section. (The reminder is built, ML-470: Admin → Security → Reviews.) The same history is in
git: every version of this file is a commit.

## Where it stands now (version 3)

| | Principle or rule | Version 2 | Version 3 | Why |
|---|---|---|---|---|
| 1 | Lawfulness, fairness and transparency | Mostly met | Mostly met | The lawful reason for every item is now in the live policy, signed off. What keeps it at "mostly": members were never told in the app about the last-seen date (no notice has been published on production). |
| 2 | Purpose limitation | Met | Met | dev and sandbox still hold one real-looking address each. |
| 3 | Data minimisation | Met | **Met, better** | A teacher is a name only (the unused columns are gone), and the sign-in token no longer carries Google's keys. |
| 4 | Accuracy | Mostly met | Mostly met | Changing an email address is built and released, but switched on for Super admin only. |
| 5 | Storage limitation | Mostly met | Mostly met | The daily clear-up runs and nothing is past its time. The unused-accounts rule is released but **off** on production and sandbox. |
| 6 | Integrity and confidentiality (security) | Mostly met | **Mostly met, closer** | Teachers and labels are private (ML-472, ML-473), the five headers are on the live site (checked), no script is written in a page. Left: the content security policy is still report-only. |
| 7 | Accountability | Partly met, much closer | **Partly met** | Neon signed; reviews and reminders built; a place to record agreements. Still open: Vercel and Gmail have no agreement, no transfer safeguard is recorded, and the five documents are not yet confirmed as read. |
| - | People's rights | Met | Met | - |
| - | Transfers outside the UK | Mostly met | Mostly met | Every provider's safeguard is blank on production. |
| - | Cookies and the device (PECR) | Met | Met | - |
| - | Children | Met, with actions | Met, with actions | The three actions are done (policy lines for young players, who sees what in a band, the no-pressure rule). The two conditions stand: Vercel under contract, organisers told. |
| - | Data breaches | In place | In place (drafted) | The plan exists; not yet confirmed as read through. |

## Gap register at version 3

Checked on 7 October 2026 against release 0.48.0 (commit `94c0d8d`), the live site and read-only counts on
the three databases. The fuller history of each gap is in the version 2 register further down.

**Closed (9)**

| # | Gap | How it was checked |
|---|---|---|
| 1 | No lawful reason stated for three items | "Why we hold it" in the live policy names all seven purposes and which are legitimate interests. Wording signed off by the owner. |
| 3 | Policy date | Live page says 7 October 2026, the day of its last change. |
| 4 | People who are not members | `tutors` is a name and an owner only (migration 107); the policy says a teacher is not told; invites are cleared after 30 days. |
| 7 | Dead invites and old feedback never cleared | The daily job runs `clearOldRecords` whether or not the retention rule is on. Production: 0 invites past 30 days. |
| 10 | No security review; teachers and labels shared | Review done; ML-472 and ML-473 released in 0.47.0. |
| 12 | PostHog's agreement | Recorded as in place on production. |
| 17 | Complaints route | In the live policy. |
| 18 | No regular review | Admin → Security → Reviews is live; `review_log` on production has the three first entries. |
| 21 | ICO fee | Registered and paid. |

**Still open (12) - all with the owner**

| # | Gap | What is left | Weight |
|---|---|---|---|
| 11 | **Vercel has no data processing agreement** | Move to Pro, then record it on Admin → Third parties. Recorded as "not in place" on production. | **High** |
| 13 | **The email provider has no agreement** | Neon's half is closed (signed 6 Oct). Email goes through a personal Gmail account with no agreement, and it keeps every sent email. Needs a provider with an agreement, sending from the app's own domain. | **High** |
| 19 | Transfer safeguards not recorded | The boxes exist; all five are blank on production. Google sign-in is not recorded either. | Medium |
| 14, 15, 16, 20 | The five documents | Drafted and on his machine. To do: read them, fill in the ICO registration number and provider columns, say they stand. | Medium |
| 2 | Members never told about the last-seen date | The "Before you continue..." notice is built (ML-463). No notice of any kind has been published on production - that includes the agreed "My bands has changed" one. | Medium |
| 6 | Unused accounts kept for ever | Built and released; the rule is off on production and sandbox. The policy already states it as fact. No account can reach 22 months before July 2028, so nobody is misled yet. Waits on gap 13 (email from the app's own domain). | Low for now |
| 9 | Content security policy | The headers are closed. The policy is still report-only on the live site; switching it on is a small release of its own (`docs/site-security-review.md`). | Medium |
| 5 | Email address can't be changed in the app | Built (ML-465); Live, but no account type has it, so Super admin only. Switch on in Admin → Feature access; then the policy's "where it is switched on for your account" can go. | Low |
| 8 | Sign-up emails in the owner's inbox | A habit or an inbox rule: delete after 12 months. Can't be checked from here. | Low |

**New at version 3**

- **Production has three accounts with real-looking email addresses, not one.** Version 2 said the owner was
  the only member. Besides his own and one local test account there are two others (created 27 September
  and 1 October 2026; neither has used the app since last-seen began). If they are his own, nothing changes.
  If they are other people, gaps 11 and 13 are no longer "before anyone is invited" - other people's names
  and emails are already passing through Vercel and Gmail with no agreement. **The owner to say whose they are.**
  - **The owner's answer, 7 October 2026:** they are two people reviewing the site for him - his wife and
    his band's conductor. His teacher also has access (no third account was on production when checked).
    So other people's names and emails **are** now held, and gaps 11 and 13 apply today, not "before anyone
    is invited". All are adults known to him, which keeps the risk small, but the two agreements are now
    the first thing to close, and nobody further should be invited until they are.
- **The five documents (gaps 14, 15, 16, 20):** the owner has read them (7 October 2026) and keeps his own
  copies. Those four gaps are closed, leaving 8 open. The ICO registration number does not need to be in
  them; it is on the ICO's public register and his certificate.
- **Resend is gone (7 October 2026, the owner):** it was never used on the live site and he wants an email
  provider based in Europe. Its register entry, sending code and usage meters were taken out; where older
  parts of this document say "Resend", read "the email provider", which today is Gmail.
- **Re-checked on production later on 7 October 2026**, after the owner's updates there:
  - Gap 5 **closed**: "change my email" is on for every account type. The policy's "where it is switched
    on for your account" can now go (the owner's wording to agree).
  - Gap 19 part done: Neon and PostHog each have "the UK addendum in its agreement" recorded. Google
    sign-in has nothing recorded yet; Vercel and Gmail wait on their agreements.
  - Unchanged: no notice published (gap 2), retention off (6), the content security policy report-only (9),
    Vercel (11) and Gmail (13) with no agreement.
  - **14 closed, 7 open.** Only gaps 13 and 6 need a domain name.
- **Gap 2 signed off by the owner, 7 October 2026.** The last-seen date began with 0.45.0 on 6 October;
  production shows a last-seen date for his account only, so nothing was collected about anyone who had
  not been told. The two reviewers will be covered by the privacy policy, which names it, when they next
  sign in. No notice is to be sent. **15 closed, 6 open.**
- The privacy policy's rights paragraph no longer says "where it is switched on for your account" (gap 5).
- **Gap 9 closed, 7 October 2026 (0.50.0, ML-486):** the content security policy is enforced on the pages and the
  server's answers, after the owner's sandbox walk. **16 closed, 5 open**: Vercel's agreement (11), Google sign-in's
  safeguard (19), an email provider with an agreement (13), retention switched on (6), sign-up emails (8).
- The monthly site security review is next due about 6 November 2026; re-running it will record ML-474 and
  ML-475 as closed.

---

## Where it stood at version 2

| | Principle or rule | Version 1 | Version 2 | Why it moved |
|---|---|---|---|---|
| 1 | Lawfulness, fairness and transparency | Mostly met | Mostly met | The policy now has a complaints route and the right date. The lawful reason for three items is drafted in the policy (ML-466, 0.48.0) - the wording is the owner's to check. |
| 2 | Purpose limitation | Met | Met | - |
| 3 | Data minimisation | Met | Met | - |
| 4 | Accuracy | Mostly met | Mostly met | Changing an email address is still by request (ML-465). |
| 5 | Storage limitation | **Partly met** | **Mostly met** | A retention rule is built and in the policy: emails at 22 and 23 months, deletion at 24; old invites and feedback cleared. It is off until switched on in each environment. |
| 6 | Integrity and confidentiality (security) | Mostly met | Mostly met | The site security review is done and its headers are in (ML-231). It stays "mostly" because the review found teachers and private organisation names are shared between all members (ML-472, ML-473) - to be fixed before anyone else joins. |
| 7 | Accountability | **Partly met** | **Partly met, much closer** | ICO registered. PostHog's agreement signed. The three records are drafted. A complaints route exists. Still open: Vercel has no agreement, Neon's and Resend's are unconfirmed, and nothing reminds anyone to review (ML-470). |
| - | People's rights | Met | Met | Now includes complaining to us first. |
| - | Transfers outside the UK | Mostly met | Mostly met | There is now a place to record it: each provider's card on Admin → Third parties (ML-469, 0.48.0). The owner still has to record each one. |
| - | Cookies and the device (PECR) | Met | Met | - |
| - | Children | Mostly met | **Met, with actions** | The Children's Code self-assessment (12 of 15 met, 2 with an action, 1 not applicable) and the impact assessment are written. Two conditions before other people's children use the app: Vercel under contract, and band organisers told how band sharing works. |
| - | Data breaches | **Not in place** | **In place** | A breach response plan and log are drafted. |

## What has happened since version 1

- **ICO.** The owner has registered and paid the data protection fee; he holds the registration number and
  is waiting for the certificate.
- **PostHog.** The data processing agreement is signed; the owner holds the signed copy. The third-party
  register no longer lists it as needing attention.
- **The privacy policy** (`public/privacy.html`) now:
  - has the right "Last updated" date;
  - says to **complain to us first** by email, that a complaint is acknowledged within 30 days and
    answered, and then gives the ICO. Confirmed on the ICO's site: this has been required since 19 June
    2026 (Data (Use and Access) Act 2025);
  - states the **retention rule** and how long invites and feedback are kept.
- **Five records drafted** as Word documents for the owner to keep on his own machine (never in the
  repo): the record of processing activities, the legitimate interests assessment, the data breach
  response plan, the Children's Code self-assessment and the data protection impact assessment. The owner
  is reviewing them.
- **Retention built** (ML-464, `docs/retention.md`): an account not used for 22 months gets an email,
  another at 23, and is deleted at 24 by the ordinary account deletion. The unit and the three numbers are
  set on Admin → Retention, so it can be tried on sandbox in hours. It is off until switched on; no step
  counts unless its email was sent; super admins are never touched; using the app starts the clock again.
  The same run clears invites 30 days after they were used or expired and feedback 12 months after it was
  resolved.
- **Every release now asks whether members need telling** about something in it (the owner's rule;
  `docs/release-process.md`, step 1), so a change to what is held about people can't go out unannounced
  again as the last-seen date did.
- **A ticket for every remaining gap that needs the site to change** - see the register.
- **The site security review was carried out** (ML-231, `docs/site-security-review.md`) and can be re-run from
  Admin → Security. It matters here because two of its open findings are about personal data: every member
  can see every other member's teacher names (ML-472) and private organisation names (ML-473). There is only
  one member today, so nothing has been exposed; both must be fixed before anyone else is invited.

## Gap register as at version 2

*Superseded by "Gap register at version 3" above; kept for the detail of how each gap was filled.*

Every gap found in version 1, and where it stood. **Closed** = done and checked. **Built / Drafted** =
done by Claude, waiting on the owner to review, switch on or release. **Ticket** = recorded, not started.
**Owner** = only the owner can do it.

| # | Gap (version 1) | Principle | Status | How it is being filled |
|---|---|---|---|---|
| 1 | No lawful reason stated for the last-seen date, the sign-up email and feedback | 1 | **Drafted** | ML-466: "Why we hold it" now gives the reason for each - a legitimate interest, as the legitimate interests assessment sets out. Also drafted there: a few lines for a young player at the top of "Young players", and a line on a teacher's name a member types in. The wording waits for the owner's check. |
| 2 | The last-seen date went out without telling members in the app | 1 | Ticket | ML-463 (an important notice that pops up). Accepted for now: the owner is the only member. The release process now asks the question every time. |
| 3 | The policy's date was out of date | 1 | **Closed** | Corrected 6 October 2026. |
| 4 | People who are not members: an invitee, and a teacher a member names | 1 | Ticket | ML-467 (teachers stay a name only - **built**: the unused first name, surname and email columns are gone, migration 107, and each member now has their own teachers, ML-472), ML-466 (say it in the policy). Invite records are now cleared after 30 days (ML-464). |
| 5 | An email address can't be changed in the app | 4 | Ticket | ML-465 (decide how, for each way of signing in). |
| 6 | Accounts nobody uses are kept for ever | 5 | **Built** | ML-464. To do: release it, try it on sandbox, switch it on in production once the app sends email from its own domain. |
| 7 | Dead invites and old feedback are never cleared | 5 | **Built** | Part of ML-464. |
| 8 | Sign-up emails sit in the owner's inbox with no end date | 5 | Owner | Delete them after 12 months (a habit, or an inbox rule). |
| 9 | No security headers beyond HSTS; the sign-in token is in browser storage | 6 | **Built**, part open | Headers are now sent on every answer (ML-231). The content security policy is report-only until the pages' inline handlers are moved out (ML-474). |
| 10 | No security review of this site | 6 | **Built** | Done 6 October 2026 (ML-231, `docs/site-security-review.md`): verdict conditional. It found five ways one member could affect another: three fixed the same day, two with tickets that **must be done before anyone else is invited** - teachers are shared between all members (ML-472) and private organisation names are listed to everyone (ML-473). Both are also personal-data matters: one member can see another's teachers and organisations. |
| 11 | Vercel holds personal information with no data processing agreement | 7 | Owner | Move to Vercel Pro (the agreement covers Pro). The owner is looking at it. |
| 12 | PostHog's agreement not signed | 7 | **Closed** | Signed 6 October 2026. |
| 13 | Neon's and Resend's agreements not confirmed | 7 | Owner | **Neon (found by the owner, 6 October 2026):** its compliance page says it follows GDPR by self-declaration, and a contract appears to come only with its Scale plan, not Free. Not confirmed by Neon; a self-declaration is not a contract. So Neon may be in the same position as Vercel (gap 11). To do: ask Neon whether its data processing addendum covers Free; if not, the paid plan is a cost for the business case, needed before other people's information is held. Resend: still to check. ML-469 will record each provider's agreement on the site. |
| 14 | No record of processing activities | 7 | **Drafted** | Document 1. The owner is reviewing; the provider columns have blanks to fill. |
| 15 | No legitimate interests assessment | 7 | **Drafted** | Document 2. |
| 16 | No breach plan | Breaches | **Drafted** | Document 3, with a breach log. To do: read it through once, and walk through a made-up breach at each yearly review. |
| 17 | No way to complain to the owner first | 7 | **Closed** | In the privacy policy. |
| 18 | No regular review | 7 | **Built** | ML-470: Admin → Security → Reviews lists each review with when it was last done, by whom and when it is due; "Mark as reviewed" keeps every entry (`review_log`); one that is due is under "Needs you" on the Dashboard. This document's version history is still the written trail of the assessment itself. |
| 19 | Which transfer safeguard covers which provider isn't recorded | Transfers | **Built - the owner records them** | ML-469: Admin → Third parties has "Data processing agreement" and "Transfer safeguard" on each provider that handles personal information; anything missing shows as "Needs attention" and on the Dashboard. Seeded with what he said on 6 Oct 2026 (Neon signed that day, PostHog signed, Vercel and Gmail none). The blanks in document 1 are filled from the same facts. |
| 20 | No written Children's Code check or impact assessment | Children | **Drafted** | Documents 4 and 5. Actions from them: a few lines for young players in the policy (ML-466), say who sees what when sharing with a band (ML-468), no-pressure design rule (ML-471). |
| 21 | ICO fee | 7 | **Closed** | Registered and paid, October 2026. |

**Counts:** 4 closed, 8 built or drafted, 6 with a ticket, 3 with the owner.

### What only the owner can do

1. Read the five documents; fill in the ICO registration number and the provider columns.
2. Vercel: decide on Pro. Neon and Resend: confirm their agreements. **Update, 6 October 2026 (later the same day): the live site does not use Resend. Email goes out through a free personal Gmail account (`MAIL_PROVIDER=smtp`), which has no data processing agreement and keeps every sent email until it is deleted - see the Gmail entry on Admin → Third parties. Read "Resend" in this document as "the email provider"; the gap is now Gmail's.**
3. Delete sign-up emails older than 12 months.
4. Before a band with young players is invited: tell the organiser how band sharing works.
5. After release: try retention on sandbox, then switch it on in production when email is sent from the
   app's own domain.

### Tickets raised from this assessment

ML-231 site security review and headers (done; open findings ML-472 to ML-476) · ML-463 important notice at next sign-in · ML-464 retention
(built) · ML-465 change an email address (**built**, 0.48.0 - My details → Email, behind the `change_email` feature) · ML-466 privacy policy additions · ML-467 teachers: a name only ·
ML-468 say who sees what when sharing with a band · ML-469 record each provider's agreement · ML-470 reviews
and reminders · ML-471 no-pressure design rule for young players.

---

## Version 1, as written on 6 October 2026

*Kept unchanged so the starting point can always be seen. Where it says something is missing, check the
gap register above for what has happened since.*

**Assessed:** 6 October 2026, against the code on branch `ml-220-offline` (release 0.45.0 plus ML-461,
ML-462 and ML-220), the live site's headers, the privacy policy, the third-party register and the three
databases.

**What this is:** a check of the app against the UK GDPR's principles and the rules that sit around them,
with the evidence for each. It is a careful reading by Claude, **not legal advice**. Where something rests
on a legal point rather than on what the code does, it says so.

**How to re-run it:** each row names its evidence (a file, a page, a query). Re-read those and update the
verdicts. The ticket also asks for a review button or a reminder in the admin panel; that is not built yet
(see "Next" at the end).

### The short version

For an app of this size the handling of personal data is in good shape: very little is collected, members
can see, download and delete their own data without asking, nothing is sold or profiled, and sign-in is
well protected. **Five of the seven principles are met or mostly met.** The two weak ones are **storage
limitation** (nothing is ever removed for inactivity) and **accountability** (the paperwork behind what the
app already does well: contracts with two providers, three short written records, and a complaints route).

| | Principle or rule | Verdict |
|---|---|---|
| 1 | Lawfulness, fairness and transparency | Mostly met |
| 2 | Purpose limitation | Met |
| 3 | Data minimisation | Met |
| 4 | Accuracy | Mostly met |
| 5 | Storage limitation | **Partly met** |
| 6 | Integrity and confidentiality (security) | Mostly met |
| 7 | Accountability | **Partly met** |
| - | People's rights | Met |
| - | Transfers outside the UK | Mostly met |
| - | Cookies and the device (PECR) | Met |
| - | Children | Mostly met |
| - | Data breaches | **Not in place** |

### The seven principles

#### 1. Lawfulness, fairness and transparency - mostly met

*You need a lawful reason for everything you hold, and you must say plainly what you do.*

- **Met.** The privacy policy (`public/privacy.html`) is in plain English, reachable signed out, and says
  who is responsible, what is held, why, who it goes to, how long, and the rights. The third-party audit
  fails a release if a service in use isn't named in it (`npm run third-party-audit`).
- **Met.** A lawful reason is given: running the service is "performing our agreement"; anonymous usage
  counting is a "legitimate interest". Nothing relies on consent, so there is no consent to manage.
- **Gap, small.** Three things the policy lists have no lawful reason stated beside them: the date last
  seen (added in 0.45.0), the sign-up email to the owner, and feedback. All three fit "legitimate interest"
  comfortably, but the policy should say so, and a legitimate interest needs a short written balancing
  test (see principle 7).
- **Gap, small.** The policy promises "if the change matters to how your information is used, we will also
  tell you in the app". The last-seen date is a new piece of information about members and went out
  without an in-app notice. A one-line announcement (Admin → Notifications) would honour the promise.
- **Fixed in this pass.** The policy's "Last updated" still said 4 October after two changes on 6 October.
- **Gap, small.** Two kinds of people who are not members have details in the app: someone invited (name
  and email, in `auth_email_links`) and a teacher a member types in (`tutors`: a name, and room for an
  email - 2 rows on dev, none with an email). An invitee gets an email, which tells them. A teacher is told
  nothing. Keeping it to a name, as now, keeps this minor; the policy could mention it.

#### 2. Purpose limitation - met

*Use data only for the reasons you collected it.*

- No adverts, no selling, no profiling; usage counting is anonymous and cookieless (PostHog is never told
  who is signed in). Stated in the policy and true in the code.
- The test databases are a different purpose from running the service, so it matters what is in them.
  Checked: `dev` has 8 accounts and `sandbox` 3, and in each only **one** has a real-looking email address
  (the rest are local test accounts). So members' data is not being used for testing. Keep it that way: do
  not refresh `dev` or `sandbox` from `production` once other people's data is in it.

#### 3. Data minimisation - met

*Hold no more than you need.*

- Account: name and email only. No date of birth, address, phone or payment details.
- The microphone's sound never leaves the device. Last seen is a date, not a time. The offline copy
  (ML-220) holds only the member's own data, on their own device.
- Worth a glance, not a gap: the sign-up email to the owner includes the browser and device, and feedback
  attaches the screen, device and app version. Both are proportionate to their purpose.

#### 4. Accuracy - mostly met

*Keep it right, and let people correct it.*

- A member can change their name, display name and picture in the app (`PUT /api/account`).
- **Gap, small.** The email address can't be changed in the app (it is the sign-in identity). It can only be
  corrected by emailing the owner, which the policy covers in general terms. Fine at this size.

#### 5. Storage limitation - partly met

*Don't keep it longer than you need.*

- **Met.** Deleting an account is immediate and self-service, the policy says exactly what goes and what
  stays, and what stays is anonymous (`docs/account-deletion.md`). The 31-day sign-out marker and the
  provider's one-day backups are disclosed.
- **Gap.** "For as long as you have an account" has no end. An account nobody has used for years is kept
  for ever. The usual answer is a stated rule - for example: after 24 months without use, email a warning,
  then delete a month later. The last-seen date added in 0.45.0 is what makes such a rule possible.
- **Gap, small.** Nothing clears old rows that have done their job: used or expired invites
  (`auth_email_links` - 1 on dev), feedback once dealt with, and on dev the `email_outbox`. The sign-up
  emails also sit in the owner's inbox indefinitely. A stated period for each (say 30 days for dead
  invites, 12 months for resolved feedback) and a small clean-up job would close it.

#### 6. Integrity and confidentiality - mostly met

*Keep it secure.*

- **Met.** HTTPS everywhere with a two-year HSTS header (checked on the live site). Passwords are scrambled
  with scrypt (`server/services/passwords.js`), checked against known breaches, and wrong tries lock the
  login. Two-step sign-in exists and is required for super admins. "Sign out everywhere" works
  (`accounts.token_version`). The admin panel is closed to everyone but super admins on the server, not
  just hidden. The one outside service that handles uploads (PDF import) has had a recorded security
  review and stays switched off until its conditions are met (`docs/omr-security-review.md`).
- **Met, new.** The app no longer leaves a member's data on a shared device after sign-out (ML-220).
- **Gap.** The live site sends HSTS but no Content-Security-Policy, X-Content-Type-Options, X-Frame-Options
  or Referrer-Policy. The sign-in token is kept in the browser's storage, so a script-injection bug would
  expose it; a content security policy is the standard second line of defence.
- **Gap.** There has been no security review of this site itself, only of the PDF import service. ML-231
  asks for one, monthly and repeatable. It would cover this principle properly.
- **Gap, covered under 7.** Security also means the providers are bound to protect the data: see the
  contracts below.

#### 7. Accountability - partly met

*Be able to show you comply.*

- **Met.** The ICO data protection fee is paid (the owner, 6 October 2026). There is a privacy policy, a
  register of every third party with what their terms ask (`server/thirdParties/register.js`, checked on
  every release), and written accounts of deletion, export, sign-in and offline storage.
- **Gap, the most important one.** A provider that holds personal data for you must be under a written
  contract (a data processing agreement).
  - **Vercel** runs the app and stores recordings and documents. Its agreement covers the Pro plan only;
    the app is on Hobby, so **there is no contract** for the names, emails and files that pass through it.
    This is already flagged on Admin → Third parties. Moving to Pro closes it.
  - **PostHog**'s agreement is free but has to be signed on their site. Not signed yet. (The data it gets
    is anonymous, which makes this low risk, but UK law still expects it.)
  - **Neon** and **Resend**: their agreements should be confirmed as in place and noted in the register.
    Not checked in this pass.
- **Gap.** Three short written records are expected of any organisation and do not exist yet:
  1. **A record of processing** - one page: what data, why, the lawful reason, who receives it, how long.
     Almost all of it can be lifted from the privacy policy.
  2. **A legitimate interests assessment** - half a page for usage counting, last seen, the sign-up email
     and feedback: the purpose, why it is needed, why it doesn't override members' interests.
  3. **A breach plan** - see "Data breaches" below.
- **Gap.** **A complaints route.** The policy sends anyone unhappy straight to the ICO. From my reading on
  5 October 2026, the Data (Use and Access) Act 2025 has required since June 2026 that people can complain
  to the organisation itself first, that the complaint is acknowledged within 30 days, and that it is
  answered without undue delay. *This is a legal point: worth confirming on the ICO's site.* The fix is a
  paragraph in the policy ("email us first; we will acknowledge within 30 days") above the ICO link.
- **Gap.** No regular review. This document is the first; the ticket's review button or reminder would make
  it a habit.

### The rules around the principles

#### People's rights - met

| Right | How it is met |
|---|---|
| To be told | The privacy policy |
| To see their data, and take it elsewhere | Account → My details → Download my information (`server/services/accountExport.js`): one file of everything, without asking |
| To have it corrected | Name and picture in the app; email by request |
| To have it deleted | Account → My details → Delete my account: immediate, and the policy says what stays and why |
| To object, or restrict | By email; the policy promises an answer within one month, which is the legal limit |
| Not to be subject to automated decisions | None are made |

The self-service export and deletion go further than the law asks.

#### Transfers outside the UK - mostly met

- The database is in **London** (Neon, AWS `eu-west-2`) and the app runs in **London** (Vercel `lhr1`). The
  providers are US companies, so the data can be reached from the US; the policy says so and names the
  safeguards in general terms (the UK-US data bridge, standard contract terms).
- **Gap, small.** Which safeguard applies to which provider isn't recorded anywhere. It belongs in the
  record of processing, and it depends on the same contracts as principle 7.

#### Cookies and the device (PECR) - met

No cookies at all. What is kept in the browser's storage (the sign-in token, settings, the offline copy) is
needed for the service the member asked for, which needs no consent. Usage counting stores nothing on the
device. The policy describes all of it. No cookie banner is needed.

#### Children - mostly met

- The app is likely to be used by children (through teachers and bands), which brings in the ICO's
  Children's Code. In spirit it is already followed: nothing beyond name and email, no adverts, no
  profiling, no location, anonymous usage counting, and privacy-protective settings with nothing to switch
  off. The policy has a plain section for young players.
- Nothing relies on consent, so the age-13 consent rule doesn't bite.
- **Gap.** The Code expects a short written check against its 15 standards, and a data protection impact
  assessment for a service children are likely to use. Neither is written down. The business case should
  also keep in mind the question already noted there: how many invited players are under 13.

#### Data breaches - not in place

A breach that risks people's rights must be reported to the ICO within **72 hours** of being discovered,
and the people affected told if the risk is high. There is no written plan: who decides, how members would
be told (there is a notification centre and email), what is recorded. One page is enough, and a log of any
incident, even one that doesn't need reporting.

#### Not applicable

No special category data (health, beliefs and so on), no marketing emails, no automated decisions, no
selling or sharing for others' purposes.

### What to do, in order

1. **Processor contracts.** Sign PostHog's agreement (free, a form). Decide on Vercel: Pro closes the gap,
   and the business case already has it starting when the first band joins. Confirm Neon's and Resend's.
2. **The complaints paragraph** in the privacy policy (the wording is the owner's), after confirming the
   legal point.
3. **Three short records**: the record of processing, the legitimate interests assessment, the breach plan.
   Claude can draft all three from what is already written.
4. **A retention rule** for unused accounts and a clean-up of dead invites and old feedback, then say it in
   the policy.
5. **Tell members about last seen** with a one-line in-app announcement.
6. **Security headers**, and the site security review (ML-231).
7. **The Children's Code check** and a short impact assessment.

### Done since the assessment (6 October 2026)

- **Complaints route** - the privacy policy now says to tell us first by email, that it is acknowledged within 30 days, and then the ICO. Confirmed on the ICO's site: the duty has been in force since 19 June 2026 (Data (Use and Access) Act 2025).
- **The three records, and two more** - drafted as Word documents for the owner to keep on his own machine (folder `compliance-documents/`, which git ignores - they are never in the repo): the record of processing activities, the legitimate interests assessment, the data breach response plan, the Children's Code self-assessment and the data protection impact assessment. The generator is not in the repo either; if they need redrafting, ask Claude.
- **Policy date** corrected.
- **Planned, with a ticket each:** the retention rule - 24 months without use, emails at 22, 23 and 24 months (ML-464); an important notice that pops up at the next sign-in, first used to tell members about the last-seen date (ML-463); the repeatable site security review, with the security headers (ML-231).
- **Still with the owner:** the provider contracts (Vercel Pro; PostHog, Neon and Resend agreements confirmed and noted on Admin → Third parties).
- **The design rule that keeps standards 5, 12 and 13 met (ML-471):** written into `specs/README.md` ("No
  pressure - young players use this") and asked at every release (`docs/release-process.md`, step 1). The
  SmartLearn upgrade prompt was checked against it and passes.
- **Built (ML-470, 0.48.0):** the regular review - Admin → Security → **Reviews**. Each review (data protection,
  the Children's Code and impact assessment, the breach plan walk-through - yearly; the two security reviews -
  monthly) shows when it was last done, by whom, a note, and when it is due. The app checks what it can: the
  privacy policy's date against the last review, providers with no agreement recorded (ML-469), and whether
  the daily clear-up has left anything past its time. Code: `server/services/reviewRules.js` (the rules, tested)
  and `reviews.js`; table `review_log` (migration 112).
- **Was still to build:** the regular review itself - a list of reviews in the admin panel (data protection and the Children's Code yearly, site security monthly), each with the date last done, and a "review due" item on the Dashboard. To be built with ML-231, which reshapes the same page.

### Next (the rest of ML-221)

The ticket also asks for a way to run this again from the admin panel, or at least a reminder. The natural
shape is the one Admin → Security already has: a list of checks, each with its evidence and its last
verdict, some re-checked automatically (the policy date against the last change, the headers on the live
site, contracts recorded on Third parties, old rows waiting to be cleared) and the rest marked by hand,
with a "review due" item on the Dashboard after a set number of months. Not built yet.
