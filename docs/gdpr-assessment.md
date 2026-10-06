# UK GDPR assessment (ML-221)

**Assessed:** 6 October 2026, against the code on branch `ml-220-offline` (release 0.45.0 plus ML-461,
ML-462 and ML-220), the live site's headers, the privacy policy, the third-party register and the three
databases.

**What this is:** a check of the app against the UK GDPR's principles and the rules that sit around them,
with the evidence for each. It is a careful reading by Claude, **not legal advice**. Where something rests
on a legal point rather than on what the code does, it says so.

**How to re-run it:** each row names its evidence (a file, a page, a query). Re-read those and update the
verdicts. The ticket also asks for a review button or a reminder in the admin panel; that is not built yet
(see "Next" at the end).

## The short version

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

## The seven principles

### 1. Lawfulness, fairness and transparency - mostly met

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

### 2. Purpose limitation - met

*Use data only for the reasons you collected it.*

- No adverts, no selling, no profiling; usage counting is anonymous and cookieless (PostHog is never told
  who is signed in). Stated in the policy and true in the code.
- The test databases are a different purpose from running the service, so it matters what is in them.
  Checked: `dev` has 8 accounts and `sandbox` 3, and in each only **one** has a real-looking email address
  (the rest are local test accounts). So members' data is not being used for testing. Keep it that way: do
  not refresh `dev` or `sandbox` from `production` once other people's data is in it.

### 3. Data minimisation - met

*Hold no more than you need.*

- Account: name and email only. No date of birth, address, phone or payment details.
- The microphone's sound never leaves the device. Last seen is a date, not a time. The offline copy
  (ML-220) holds only the member's own data, on their own device.
- Worth a glance, not a gap: the sign-up email to the owner includes the browser and device, and feedback
  attaches the screen, device and app version. Both are proportionate to their purpose.

### 4. Accuracy - mostly met

*Keep it right, and let people correct it.*

- A member can change their name, display name and picture in the app (`PUT /api/account`).
- **Gap, small.** The email address can't be changed in the app (it is the sign-in identity). It can only be
  corrected by emailing the owner, which the policy covers in general terms. Fine at this size.

### 5. Storage limitation - partly met

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

### 6. Integrity and confidentiality - mostly met

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

### 7. Accountability - partly met

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

## The rules around the principles

### People's rights - met

| Right | How it is met |
|---|---|
| To be told | The privacy policy |
| To see their data, and take it elsewhere | Account → My details → Download my information (`server/services/accountExport.js`): one file of everything, without asking |
| To have it corrected | Name and picture in the app; email by request |
| To have it deleted | Account → My details → Delete my account: immediate, and the policy says what stays and why |
| To object, or restrict | By email; the policy promises an answer within one month, which is the legal limit |
| Not to be subject to automated decisions | None are made |

The self-service export and deletion go further than the law asks.

### Transfers outside the UK - mostly met

- The database is in **London** (Neon, AWS `eu-west-2`) and the app runs in **London** (Vercel `lhr1`). The
  providers are US companies, so the data can be reached from the US; the policy says so and names the
  safeguards in general terms (the UK-US data bridge, standard contract terms).
- **Gap, small.** Which safeguard applies to which provider isn't recorded anywhere. It belongs in the
  record of processing, and it depends on the same contracts as principle 7.

### Cookies and the device (PECR) - met

No cookies at all. What is kept in the browser's storage (the sign-in token, settings, the offline copy) is
needed for the service the member asked for, which needs no consent. Usage counting stores nothing on the
device. The policy describes all of it. No cookie banner is needed.

### Children - mostly met

- The app is likely to be used by children (through teachers and bands), which brings in the ICO's
  Children's Code. In spirit it is already followed: nothing beyond name and email, no adverts, no
  profiling, no location, anonymous usage counting, and privacy-protective settings with nothing to switch
  off. The policy has a plain section for young players.
- Nothing relies on consent, so the age-13 consent rule doesn't bite.
- **Gap.** The Code expects a short written check against its 15 standards, and a data protection impact
  assessment for a service children are likely to use. Neither is written down. The business case should
  also keep in mind the question already noted there: how many invited players are under 13.

### Data breaches - not in place

A breach that risks people's rights must be reported to the ICO within **72 hours** of being discovered,
and the people affected told if the risk is high. There is no written plan: who decides, how members would
be told (there is a notification centre and email), what is recorded. One page is enough, and a log of any
incident, even one that doesn't need reporting.

### Not applicable

No special category data (health, beliefs and so on), no marketing emails, no automated decisions, no
selling or sharing for others' purposes.

## What to do, in order

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

## Done since the assessment (6 October 2026)

- **Complaints route** - the privacy policy now says to tell us first by email, that it is acknowledged within 30 days, and then the ICO. Confirmed on the ICO's site: the duty has been in force since 19 June 2026 (Data (Use and Access) Act 2025).
- **The three records, and two more** - drafted as Word documents for the owner to keep on his own machine (folder `compliance-documents/`, which git ignores - they are never in the repo): the record of processing activities, the legitimate interests assessment, the data breach response plan, the Children's Code self-assessment and the data protection impact assessment. The generator is not in the repo either; if they need redrafting, ask Claude.
- **Policy date** corrected.
- **Planned, with a ticket each:** the retention rule - 24 months without use, emails at 22, 23 and 24 months (ML-464); an important notice that pops up at the next sign-in, first used to tell members about the last-seen date (ML-463); the repeatable site security review, with the security headers (ML-231).
- **Still with the owner:** the provider contracts (Vercel Pro; PostHog, Neon and Resend agreements confirmed and noted on Admin → Third parties).
- **Still to build:** the regular review itself - a list of reviews in the admin panel (data protection and the Children's Code yearly, site security monthly), each with the date last done, and a "review due" item on the Dashboard. To be built with ML-231, which reshapes the same page.

## Next (the rest of ML-221)

The ticket also asks for a way to run this again from the admin panel, or at least a reminder. The natural
shape is the one Admin → Security already has: a list of checks, each with its evidence and its last
verdict, some re-checked automatically (the policy date against the last change, the headers on the live
site, contracts recorded on Third parties, old rows waiting to be cleared) and the rest marked by hand,
with a "review due" item on the Dashboard after a set number of months. Not built yet.
