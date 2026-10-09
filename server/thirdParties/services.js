// ML-267: services the live app needs. See register.js for what each field means.
// Facts read from each provider's own pages on 2026-10-04.

const CHECKED = '2026-10-04';

export default [
  {
    key: 'neon',
    policyName: 'Neon',
    name: 'Neon',
    group: 'service',
    personalData: true, // ML-469: a data processing agreement and a transfer safeguard are recorded for it
    // Was 'attention' until the owner signed Neon's data processing agreement (his word, 6 October 2026).
    status: 'in_use',
    who: 'Databricks, Inc. (USA) - parent of Neon, LLC',
    provides: 'The Postgres database: every account, piece, session and setting. Three branches - production, sandbox, dev.',
    usedIn: 'server/config/db.js (DATABASE_URL); docs/environments.md',
    plan: 'Free plan',
    cost: 'Free',
    licence: 'Neon terms of service, under the Databricks Master Cloud Services Agreement',
    terms: [
      { label: 'Terms of service', url: 'https://neon.com/terms-of-service', dated: '5 Aug 2026' },
      { label: 'Master agreement', url: 'https://www.databricks.com/legal/mcsa', dated: '20 Feb 2026' },
      { label: 'Privacy notice', url: 'https://www.databricks.com/legal/privacynotice', dated: '9 Jan 2026' },
      { label: 'Data processing agreement', url: 'https://www.databricks.com/legal/dpa' },
      { label: 'Acceptable use', url: 'https://www.databricks.com/legal/aup' },
      { label: 'Pricing', url: 'https://neon.com/pricing' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'Free services come as they are, with no warranty.',
      'Carrying on using it counts as agreeing to changes in the terms and prices. No notice period is given.',
      'They can suspend at once if they suspect a breach. Either side can end it with 30 days\' notice.',
      'For a UK customer the agreement is under the law of England and Wales.',
      'Neon is a processor of our users\' data. The parent company is in the USA; transfers rely on the Data Privacy Framework (UK Extension) and standard clauses.'
    ],
    asks: [
      { text: 'No card payment details (PCI data) in the database.' },
      { text: 'We must have the right to hold the data we put in it.' }
    ],
    watch: [
      'Data processing agreement: signed by the owner on 6 October 2026 (his own record - the signed copy belongs with the compliance documents). Which plan it is tied to, and its date, were not read here; note them in "My reference" on this card.',
      'The production database is in London (AWS eu-west-2), checked 4 Oct 2026. The region is fixed when the project is made.',
      'The data processing agreement is a PDF that could not be read - whether it applies automatically on the Free plan is not confirmed.',
      'Free keeps only 6 hours of history to restore from.'
    ],
    limits: [
      { what: 'Compute', allowance: '100 CU-hours a month per project' },
      { what: 'Storage', allowance: '1 GB per project' },
      { what: 'Data sent out (egress)', allowance: '5 GB a month per project' },
      { what: 'Branches', allowance: '10 per project (we use 3)' },
      { what: 'History to restore from', allowance: '6 hours, up to 1 GB of changes' }
    ],
    overLimit: 'Blocked, not billed, and nothing is deleted: compute is suspended until next month, and writes fail when storage is full.',
    nextTier: 'Launch - pay for what you use, no monthly minimum: $0.106 per CU-hour, $0.35 per GB-month of storage, 7 days of history.',
    usageSource: 'Neon API: GET /projects/{id} gives compute seconds, data transfer and storage size for the period on the Free plan (the fuller consumption API is paid plans only). Keys are not read-only; the narrowest is a project-scoped key.',
    hosts: ['neon.tech', 'neon.com']
  },
  {
    key: 'vercel',
    policyName: 'Vercel',
    name: 'Vercel',
    group: 'service',
    personalData: true, // ML-469: a data processing agreement and a transfer safeguard are recorded for it
    status: 'in_use',
    who: 'Vercel Inc. (USA)',
    provides: 'Hosting: serves the app\'s pages and runs the server (one function). Every push to main deploys to production.',
    usedIn: 'vercel.json, api/[...slug].js; docs/release-process.md',
    plan: 'Pro plan (since 7 Oct 2026)',
    cost: '$20 a month plus VAT (about $24), which includes $20 of usage',
    licence: 'Vercel terms of service',
    terms: [
      { label: 'Terms of service', url: 'https://vercel.com/legal/terms', dated: '1 Jun 2026' },
      { label: 'Fair use guidelines', url: 'https://vercel.com/docs/limits/fair-use-guidelines', dated: '14 Sep 2026' },
      { label: 'Acceptable use', url: 'https://vercel.com/legal/acceptable-use-policy', dated: '21 Apr 2026' },
      { label: 'Privacy policy', url: 'https://vercel.com/legal/privacy-policy', dated: '1 Jun 2026' },
      { label: 'Data processing agreement', url: 'https://vercel.com/legal/dpa', dated: '31 Mar 2026' },
      { label: 'Pro plan', url: 'https://vercel.com/docs/plans/pro-plan', dated: '15 Sep 2026' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      // The app moved from Hobby to Pro on 7 Oct 2026 (the owner): Hobby is non-commercial only and
      // has no data processing agreement, which was gap 11 of the GDPR assessment.
      'The data processing agreement covers Pro and Enterprise. It is binding from the moment the plan is taken - nothing to sign. The owner keeps a copy.',
      'For information sent from the UK, the agreement includes the UK international data transfer addendum (its schedules 3 and 5).',
      'Pro allows commercial use, so Premium can be sold or advertised.',
      'Changes to the terms apply when posted or emailed.',
      'Vercel is a US company and processes mainly in the USA; our server code is set to run in London (vercel.json).'
    ],
    asks: [
      // ML-476: every deploy installs exactly the package versions in the two lockfiles (npm ci), so a
      // new release of a package only goes live when someone chose it. Until then package-lock.json was
      // in .gitignore and each deploy took whatever was newest that day.
      { text: 'The build installs from the lockfile (npm ci), not whatever is newest.', check: { path: 'vercel.json', includes: 'npm ci && cd server && npm ci' } },
      { text: 'The root lockfile is in the repo.', check: { path: 'package-lock.json', includes: '"lockfileVersion"' } },
      { text: 'The server lockfile is in the repo.', check: { path: 'server/package-lock.json', includes: '"lockfileVersion"' } },
      { text: 'No content that infringes someone\'s rights - members upload recordings and sheet music, so the terms say how to ask for something to be taken down.', check: { path: 'public/terms.html', includes: 'take it down' } },
      { text: 'One account only - no second account to get round the limits.' }
    ],
    watch: [
      'The server runs in London (lhr1, set in vercel.json since ML-425) - next to the database. It ran in Washington DC before, which made every database call cross the Atlantic.',
      'Usage past what is included is billed, not blocked. Vercel emails at 75% of the $20; its spending notice is at $200 a month unless a lower limit is set in Vercel (Billing, Spend management).'
    ],
    limits: [
      { what: 'Usage credit (server time, memory, file storage and the rest)', allowance: '$20 a month' },
      { what: 'CDN requests', allowance: '1,000,000 a month' },
      { what: 'Data transfer', allowance: '1 TB a month' }
    ],
    overLimit: 'Billed, not blocked: once the $20 is used, the rest is charged at the rates below.',
    nextTier: 'Past what is included (rates on 7 Oct 2026): $0.177 per hour of server CPU, $0.0146 per GB-hour of memory, $0.15 per GB transferred, $2.40 per million CDN requests.',
    usageSource: 'Vercel API: GET /v1/billing/charges gives what was used and what it cost, per service per day. Read daily once VERCEL_API_TOKEN is set (Costs and usage: "Where Vercel\'s usage is going").',
    hosts: ['vercel.app', 'vercel.com']
  },
  {
    key: 'vercel-blob',
    policyName: 'Vercel',
    name: 'Vercel Blob',
    group: 'service',
    personalData: true, // ML-469: a data processing agreement and a transfer safeguard are recorded for it
    status: 'in_use',
    who: 'Vercel Inc. (USA)',
    provides: 'File storage: members\' mp3 and mp4 recordings, and PDF, MusicXML, Sibelius and MuseScore documents attached to a piece.',
    usedIn: 'server/routes/api.js, server/services/flows.js (BLOB_READ_WRITE_TOKEN); the browser uploads straight to it',
    plan: 'Pro plan (the same account as Vercel)',
    cost: 'Comes out of Vercel\'s $20 a month of included usage',
    licence: 'Vercel terms of service (same as Vercel)',
    terms: [
      { label: 'Terms of service', url: 'https://vercel.com/legal/terms', dated: '1 Jun 2026' },
      { label: 'Usage and pricing', url: 'https://vercel.com/docs/vercel-blob/usage-and-pricing', dated: '23 Sep 2026' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'The same terms and the same data processing agreement as Vercel hosting (Pro since 7 Oct 2026).',
      'Looking through the store in Vercel\'s dashboard counts as operations too.'
    ],
    asks: [],
    watch: [
      'Recordings can hold personal data (voices, faces). They are covered by Vercel\'s data processing agreement now the account is on Pro.',
      'Storing a file is cheap; playing recordings back is what costs ($0.05 a GB).'
    ],
    limits: [
      { what: 'Storage, operations and transfer', allowance: 'No allowance of their own - paid from Vercel\'s $20 a month of usage' }
    ],
    overLimit: 'Billed, not blocked, once Vercel\'s $20 a month is used.',
    nextTier: 'Rates on 7 Oct 2026: $0.024 per GB stored a month, $0.05 per GB transferred, $0.42 per million reads, $5.30 per million uploads.',
    usageSource: 'The app already stores every file\'s size (score_recordings, score_documents), so storage can be added up from our own tables. Operations and transfer come from Vercel\'s billing API or dashboard.',
    hosts: ['vercel-storage.com']
  },
  {
    key: 'google-sign-in',
    policyName: 'Google',
    name: 'Google sign-in',
    group: 'service',
    personalData: true, // ML-469: a data processing agreement and a transfer safeguard are recorded for it
    status: 'attention',
    who: 'Google LLC (USA)',
    provides: '"Sign in with Google" - login only. We ask for the basic profile and email address, nothing else.',
    usedIn: 'server/config/passport.js (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET); the button picture public/icons/google-sign-in-light.svg',
    plan: 'No plan',
    cost: 'Free (no price is published)',
    licence: 'Google APIs Terms of Service and the API Services User Data Policy',
    terms: [
      { label: 'APIs terms of service', url: 'https://developers.google.com/terms', dated: '9 Nov 2021' },
      { label: 'User data policy', url: 'https://developers.google.com/terms/api-services-user-data-policy', dated: '15 Feb 2024' },
      { label: 'OAuth policies', url: 'https://developers.google.com/identity/protocols/oauth2/policies', dated: '5 Aug 2026' },
      { label: 'Sign-in button guidelines', url: 'https://developers.google.com/identity/branding-guidelines', dated: '7 Jul 2026' }
    ],
    termsCheckedOn: CHECKED,
    attention: [
      'The sign-in consent screen is still in "Testing" in the Google Cloud console: only listed test users can sign in with Google. Publishing it opens Google sign-in to anyone - the owner\'s decision.',
      'The app now has a domain of its own (notablybetter.com). Add it to the consent screen (home page, privacy policy and terms links) and apply for brand verification, so the sign-in screen shows the app\'s name.'
    ],
    says: [
      'Google can end access at any time.',
      'An app left in "Testing" is limited to 100 test users, and each sign-in permission runs out after 7 days.',
      'Showing the app\'s name and logo on the consent screen needs brand verification: a home page on a domain we have verified, describing the app, with the privacy policy linked.',
      'Asking for more than profile and email later (Drive, Calendar...) brings a much heavier review.'
    ],
    asks: [
      { text: 'A privacy policy that says what Google data we collect and how we use it, linked from the home page.', check: { path: 'public/index.html', includes: 'href="/privacy.html"' } },
      { text: 'The same privacy policy address on the sign-in consent screen (set in the Google Cloud console).' },
      { text: 'Ask only for what we need: profile and email.', check: { path: 'server/config/passport.js', includes: ['profile', 'email'] } },
      { text: 'The button is Google\'s own "Sign in with Google" picture, unaltered (from their asset pack, downloaded 4 Oct 2026) - never restyled, recoloured or redrawn.', check: { path: 'public/index.html', includes: ['icons/google-sign-in-light.svg', 'aria-label="Sign in with Google"'] } },
      { text: 'Their picture is still in the repo.', check: { path: 'public/icons/google-sign-in-light.svg' } },
      { text: 'It is no less prominent than any other third-party sign-in choice.' },
      { text: 'Keep the client secret out of the code - it lives in the environment settings only.' },
      { text: 'Never suggest Google endorses the app.' }
    ],
    watch: [
      'Whether the app is "In production" or still "Testing" in the Google Cloud console, and its verification status - not checked.',
      'The redirect address Google sends people back to is https://notablybetter.com/auth/callback (GOOGLE_REDIRECT_URI in Vercel) - it must be listed on the sign-in client in the Google Cloud console.'
    ],
    limits: [
      { what: 'Users while in "Testing"', allowance: '100 test users' }
    ],
    // oauth2.googleapis.com (ML-475): only to cancel the old refresh key left in a sign-in token signed before 0.48.0 -
    // nothing about a member is sent, just Google's own key back to Google (server/middleware/auth.js, dropGoogleKeys)
    hosts: ['accounts.google.com', 'policies.google.com', 'oauth2.googleapis.com']
  },
  {
    key: 'gmail-smtp',
    policyName: 'Google',
    name: 'Gmail (sent the app\'s email until Brevo)',
    group: 'service',
    // Not in use since the app was renamed Notably Better: Brevo sends the emails and the mailbox is at
    // Fasthosts. Kept as the record of what was used, and what is left to clear up.
    status: 'not_in_use',
    statusNote: 'Replaced by Brevo (sending) and Fasthosts (the mailbox) when the app was renamed. Still to do by hand: delete the app password, clear Sent and the Bin once more after the switch, and look at the old inbox now and then - the old policy gave that address.',
    who: 'Google LLC (USA)',
    provides: 'Sends the app\'s emails - invites, band invitations, password resets, retention warnings, sign-up and upgrade alerts - from a Gmail account the owner set up for the app, over SMTP (MAIL_PROVIDER "smtp"). A copy of every email sent stays in that account\'s Sent folder.',
    usedIn: 'server/services/mail.js (SMTP_HOST smtp.gmail.com, SMTP_USER, SMTP_PASS - an app password, MAIL_FROM); the nodemailer package',
    plan: 'A free personal Gmail account',
    cost: 'Free',
    licence: 'Google Terms of Service and the Gmail Program Policies',
    terms: [
      { label: 'Google terms of service', url: 'https://policies.google.com/terms' },
      { label: 'Gmail program policies', url: 'https://support.google.com/mail/answer/10178035' },
      { label: 'Gmail sending limits', url: 'https://support.google.com/mail/answer/22839' },
      { label: 'Google privacy policy', url: 'https://policies.google.com/privacy' },
      { label: 'Google Workspace data regions (the paid alternative)', url: 'https://knowledge.workspace.google.com/admin/compliance/choose-a-geographic-location-for-your-data' }
    ],
    termsCheckedOn: '2026-10-06',
    attention: [
      'A free personal Gmail account comes with no data processing agreement: Google\'s agreement and its choice of where data is kept (the USA or Europe) are part of Google Workspace, the paid service. So the names and addresses in the app\'s emails are held by a US company on its ordinary consumer terms - decide whether to move the sending account to Google Workspace (with the Europe data region), or to an email service based in the EU.',
      'Sent emails stay in the account\'s Sent folder until someone deletes them - nothing clears them. Either tidy it by hand every month or so, or set up a way to clear it; the privacy policy says how long they are kept.',
      'Only the sending limits page was read on 6 Oct 2026; the terms and program policies have not been read through yet.'
    ],
    says: [
      'A personal account can send about 500 emails in a day; past that, sending stops with an error and comes back within 1 to 24 hours.'
    ],
    asks: [
      { text: 'Use an app password for SMTP_PASS (never the account\'s own password), and keep two-step verification on for that account.' },
      { text: 'Only email people who expect it: an invite or invitation asked for by a member, a reset the member asked for. No marketing.' },
      { text: 'The package that talks to Gmail is in the register.', check: { path: 'server/thirdParties/librariesAndTools.js', includes: 'nodemailer' } }
    ],
    watch: [
      'The daily limit is shared by everything the app sends. Each member can send 5 invites a day and each band organiser 20 band invitations, so about 25 busy organisers in one day would reach it - and then password resets stop too until it comes back.',
      'Email from a gmail.com address sent by an app often lands in junk; Google can also suspend an account it thinks is sending in bulk. A domain of our own, with a proper sending service, is the lasting answer.',
      'Nothing counts these emails yet (Admin - Costs and usage has no meter for them).'
    ],
    limits: [
      { what: 'Emails in a day', allowance: 'about 500 (a personal account)' }
    ],
    overLimit: 'Blocked: sending is refused for 1 to 24 hours. The app tells the member the email could not be sent.',
    nextTier: 'Google Workspace - a paid account per user, about 2,000 emails a day, with a data processing agreement and a choice of data region. Price not checked.',
    usageSource: 'No reading. Gmail does not report a count over SMTP; the app would have to count what it sends.',
    hosts: ['smtp.gmail.com']
  },
  {
    // The owner opened the account on 8 Oct 2026 to take over from the Gmail account, with the app's own
    // domain (notablybetter.com). The live site sends through it once its SMTP settings are changed on
    // the day of the release that renames the app - the same release names it in the privacy policy.
    key: 'brevo',
    policyName: 'Brevo',
    name: 'Brevo (sends the app\'s email)',
    group: 'service',
    personalData: true, // it will carry names and email addresses; its data processing agreement is part of its terms
    status: 'in_use',
    who: 'Sendinblue SAS, trading as Brevo (France)',
    provides: 'Sends the app\'s emails - invites, band invitations, password resets, retention warnings, sign-up and upgrade alerts - over SMTP, from noreply@notablybetter.com. It can also hold a mailing list people sign up to (none yet). It does not give us a mailbox to read - that is Fasthosts.',
    usedIn: 'server/services/mail.js (MAIL_PROVIDER "smtp": SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS - Brevo\'s SMTP key, MAIL_FROM); the nodemailer package; the domain\'s DNS records',
    plan: 'Free plan',
    cost: 'Free',
    licence: 'Brevo Terms of Service',
    terms: [
      { label: 'Terms of service (the data processing agreement is its Appendix 3)', url: 'https://www.brevo.com/legal/termsofuse/', dated: '1 Oct 2025' },
      { label: 'Acceptable use policy (Appendix 7)', url: 'https://www.brevo.com/legal/antispampolicy/' },
      { label: 'Privacy policy', url: 'https://www.brevo.com/legal/privacypolicy/', dated: '1 Oct 2025' },
      { label: 'Pricing', url: 'https://www.brevo.com/pricing/' }
    ],
    termsCheckedOn: '2026-10-08',
    says: [
      'The data processing agreement is part of the terms, so it applies from the moment the account is made - nothing to sign. Brevo is the processor and we are the controller.',
      'Its own hosting is in France and Belgium (OVH and Google Cloud). Some of the companies it uses are in the USA - Cloudflare in front of its site, Zendesk for support - under standard contractual clauses or the EU-US Data Privacy Framework.',
      'It tells us without undue delay if there is a data breach.',
      'Prices can change on a subscription\'s anniversary, with at least 30 days\' notice. Prices are shown without VAT.',
      'The free service can be suspended, limited or ended at any time without notice. A paid one needs 30 days\' notice unless we have broken the terms.',
      'An account nobody has signed in to or used for six months can be deleted, after an email warning.',
      'When the plan\'s sending limit is reached, sending stops.',
      'The agreement is under French law, in the Commercial Court of Paris.',
      'It may name us as a customer in its own marketing unless we email to say no.'
    ],
    asks: [
      { text: 'Only email people who expect it. App emails go to someone a member asked us to write to, or who asked themselves.' },
      { text: 'A mailing list is only people who ticked a box themselves (never ticked for them) knowing what they will be sent, and we can show when each one agreed.' },
      { text: 'Every email that was not set off by the person\'s own action has an unsubscribe link that is easy to find.' },
      { text: 'Never a bought or collected list of addresses - for app emails as well as a mailing list.' },
      { text: 'Keep "Anonymous email tracking" on for the app\'s emails (Brevo: Settings, Transactional emails, Tracking - the owner switched it on, 8 Oct 2026). Brevo has no switch that turns tracking off; with this on, opens and clicks are counted but not tied to a person.' },
      { text: 'Keep the SMTP key out of the code - it lives in the environment settings only.' },
      { text: 'The privacy policy says who sends our emails and that opens and clicks are counted, not who by.', check: { path: 'public/privacy.html', includes: ['Brevo', 'but not who by'] } },
      { text: 'Leave "Block unauthorized IP addresses" off for SMTP keys: the app runs on Vercel, which has no fixed address, so switching it on stops every email.' },
      { text: 'The package that talks to it is in the register.', check: { path: 'server/thirdParties/librariesAndTools.js', includes: 'nodemailer' } }
    ],
    watch: [
      'Only parts of the terms were read on 8 Oct 2026: the general terms on prices, ending and the law, and the data processing agreement\'s transfers, breach notice and list of companies used. Of the acceptable use policy only the start was read (bought lists, consent, the unsubscribe link); its list of content it will not carry and any limits on bounces and complaints were not - read the rest before the first email to a mailing list.',
      'The agreement\'s definitions count the United Kingdom with the EEA, and no separate UK addendum was found. France is covered by the UK\'s adequacy decision for the EU; whether that is enough for the US companies it uses was not settled here.',
      'Brevo keeps a log of every email sent (to whom, the subject, whether it arrived). How long, and whether it can be shortened, was not found - the privacy policy\'s line about copies of emails depends on it.',
      'Brevo still sends every link in an email through its own counting address first (r.mail on our domain) and adds a picture that counts an open.',
      'The daily limit is shared by everything the account sends, the app\'s emails and any mailing list together.',
      'Sign in to Brevo at least every few months: whether emails sent by the app count as "using" the account for the six-month rule is not stated.',
      'Whether the free plan puts Brevo\'s logo on emails sent by the app over SMTP, or only on campaigns made in its editor, is not confirmed - the first email sent through it will show.'
    ],
    limits: [
      { what: 'Emails in a day (free plan)', allowance: '300, once Brevo has approved the account for sending' }
    ],
    overLimit: 'Blocked: sending stops until the next day. The app tells the member the email could not be sent.',
    nextTier: 'Starter - £6 a month plus VAT for 5,000 emails a month and 500 contacts, no daily limit. Removing Brevo\'s logo is shown as an extra £7.20 a month on Starter, or is included in Standard at £13 a month (prices on 8 Oct 2026).',
    usageSource: 'No reading yet. Brevo\'s API reports what was sent; a meter could be added to Costs and usage once it is sending.',
    hosts: ['brevo.com']
  },
  {
    key: 'fasthosts',
    policyName: 'Fasthosts',
    name: 'Fasthosts (the domain and our mailbox)',
    group: 'service',
    personalData: true, // emails people send us are stored in the mailbox; its data processing agreement is part of its terms
    status: 'in_use',
    who: 'Fasthosts Internet Limited (UK), part of the IONOS group (Germany)',
    provides: 'The domain notablybetter.com and its DNS records (which point the site at Vercel and prove our emails are ours), and one mailbox, hello@notablybetter.com - the address the privacy policy and terms give for questions, privacy requests, complaints and reports.',
    usedIn: 'Nothing in the code. The DNS records are kept in Fasthosts\' control panel (Advanced DNS): an A record and www for Vercel, Brevo\'s DKIM and brand records, the Brevo code, SPF and DMARC, and Fasthosts\' own mail records.',
    plan: 'A .com domain and one Mail Basic mailbox (2 GB), on a 12-month contract from October 2026',
    cost: 'Not written here - the owner enters it on Costs and usage',
    paid: true,
    licence: 'Fasthosts General Terms and Conditions, with its Data Processing Agreement and Acceptable Use Policy',
    terms: [
      { label: 'General terms and conditions', url: 'https://www.fasthosts.co.uk/terms/general-terms-and-conditions', dated: 'May 2026' },
      { label: 'Data processing agreement (PDF)', url: 'https://static.fasthosts.co.uk/legal/dpa/fasthosts-dpa.pdf' },
      { label: 'Acceptable use policy', url: 'https://www.fasthosts.co.uk/terms/policies/acceptable-use-policy' },
      { label: 'Privacy notice', url: 'https://www.fasthosts.co.uk/terms/policies/privacy-notice' }
    ],
    termsCheckedOn: '2026-10-09',
    says: [
      'The data processing agreement is part of the terms (they take it in by reference), so it applies from the moment the account is made - nothing to sign.',
      'Services run for at least 12 months and renew by themselves for the same length again unless cancelled at least 30 days before the renewal date. A domain\'s automatic renewal can be switched off.',
      'Prices and the service can change with 30 days\' notice by email; a new price starts when the current term ends.',
      'Fasthosts can end a service for any reason with 30 days\' notice, and suspend at once if it thinks its acceptable use policy has been broken.',
      'It may reset passwords or suspend access without notice to keep an account safe.',
      'The agreement is under English law.'
    ],
    asks: [
      { text: 'Keep a working card or PayPal account on the Fasthosts account - without one, access is restricted.' },
      { text: 'Keep the contact details on the account right: renewal and price notices go to that email address.' },
      { text: 'The privacy policy says where an email sent to us is kept.', check: { path: 'public/privacy.html', includes: 'Fasthosts' } },
      { text: 'The mailbox is for reading and answering by hand. The app\'s own emails go through Brevo, never through this mailbox.' }
    ],
    watch: [
      'If the domain lapses, the site\'s address, every email link and the mailbox all stop together. Leave automatic renewal on, and note the renewal date.',
      'The data processing agreement is a PDF that could not be read here, and the acceptable use policy and privacy notice were not read. Where the mailbox is kept (Fasthosts says its data centres are in the UK) is not confirmed from the agreement.',
      'The first-year price is usually an offer: check what the domain and the mailbox cost at renewal.',
      'Emails sent to hello@ stay in the mailbox until deleted. Clear out ones that have been dealt with from time to time - the privacy policy says they are kept until we delete them.',
      'Give the mailbox its own strong password, and two-step sign-in on the Fasthosts account if it is offered.'
    ],
    limits: [
      { what: 'Mailbox size', allowance: '2 GB' }
    ],
    overLimit: 'A full mailbox turns new emails away - the sender gets an error.',
    usageSource: 'No reading. The mailbox size shows in Fasthosts\' control panel.',
    hosts: ['fasthosts.co.uk', 'livemail.co.uk']
  },
  {
    key: 'posthog',
    policyName: 'PostHog',
    name: 'PostHog',
    group: 'service',
    personalData: true, // ML-469: a data processing agreement and a transfer safeguard are recorded for it
    status: 'in_use',
    who: 'PostHog Inc. (USA); EU cloud, data held in Frankfurt',
    provides: 'Usage analytics: records button taps so we can see which features are used. Anonymous: no cookie, nothing kept in the browser, and it is never told who is signed in (ML-430). Its script is loaded from PostHog\'s servers.',
    usedIn: 'public/analytics.js; the dashboard link on Admin → Usage',
    plan: 'Free plan',
    cost: 'Free',
    licence: 'PostHog terms',
    terms: [
      { label: 'Terms', url: 'https://posthog.com/terms', dated: '29 Jun 2026' },
      { label: 'Privacy policy', url: 'https://posthog.com/privacy', dated: '29 Jun 2026' },
      { label: 'Data processing agreement', url: 'https://posthog.com/dpa' },
      { label: 'Sub-processors', url: 'https://posthog.com/subprocessors' },
      { label: 'Pricing', url: 'https://posthog.com/pricing' }
    ],
    termsCheckedOn: CHECKED,
    statusNote: 'The data processing agreement is signed (the owner, 6 October 2026; he holds the signed copy).',
    says: [
      'Price rises need 30 days\' notice. Either side can end it with 30 days\' notice.',
      'Terms can change at PostHog\'s discretion; carrying on counts as accepting.',
      'Section 5 lets PostHog use customer content to develop its products and machine-learning models unless we opt out. Only part of this clause was read.',
      'No credit or attribution is asked for.'
    ],
    asks: [
      { text: 'Tell users about PostHog in the privacy policy.', check: { path: 'public/privacy.html', includes: 'PostHog' } },
      { text: 'No cookie and nothing kept in the browser, so no consent banner is needed.', check: { path: 'public/analytics.js', includes: "persistence: 'memory'" } },
      { text: 'Set it up so it doesn\'t collect sensitive personal data.' },
      { text: 'Don\'t try to get round the plan limits.' }
    ],
    watch: [
      'Autocapture records every tap, so the event count grows with traffic.',
      'Decide whether to opt out of the product and model development clause (find the setting).',
      'What happens at 1 million events with no card on file is not stated - most likely recording just stops.'
    ],
    limits: [
      { what: 'Analytics events', allowance: '1,000,000 a month (9,390 used in the cycle to 12 Oct 2026)' },
      { what: 'Projects', allowance: '1' },
      { what: 'Data kept for', allowance: '1 year' }
    ],
    overLimit: 'Emails at 80% and 100%. Data over a limit is dropped and lost.',
    nextTier: 'Pay-as-you-go - no base price, same free allowance, then $0.00005 per event from 1 to 2 million (about $50 for the second million), less after that. 6 projects, 7 years of data.',
    usageSource: 'No usage endpoint. Events can be counted through PostHog\'s query API with a personal API key; whether a read-only scope exists is not confirmed.',
    hosts: ['posthog.com']
  },
  {
    key: 'pwned-passwords',
    policyName: 'Have I Been Pwned',
    name: 'Have I Been Pwned - Pwned Passwords',
    group: 'service',
    status: 'in_use',
    who: 'Superlative Enterprises Pty Ltd (Australia) - Troy Hunt',
    provides: 'Checks whether a new password has appeared in a known data breach. Only the first 5 characters of a scrambled form of the password are sent, never the password.',
    usedIn: 'server/services/passwords.js (PASSWORD_BREACH_CHECK=off turns it off)',
    plan: 'No plan',
    cost: 'Free - no key or subscription needed',
    licence: 'Have I Been Pwned terms of use',
    terms: [
      { label: 'Terms of use', url: 'https://haveibeenpwned.com/TermsOfUse', dated: 'Mar 2026' },
      { label: 'API', url: 'https://haveibeenpwned.com/API/v3' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'The Pwned Passwords check is free, with no rate limit and no licence or credit required (a credit is welcomed).',
      'It comes as it is, with no promise it will be available. Our check is skipped if it can\'t be reached.'
    ],
    asks: [
      { text: 'Don\'t use it to harm people caught in a breach, or to build a rival breach-search service.' }
    ],
    watch: [
      'The general terms bar using the free services "for commercial benefit" for a third party without permission, while the API page says Pwned Passwords is free with no licence needed. Before Premium launches, an email to them would settle it.'
    ],
    hosts: ['pwnedpasswords.com']
  },
  {
    key: 'jsdelivr',
    policyName: 'jsDelivr',
    name: 'jsDelivr',
    group: 'service',
    status: 'in_use',
    who: 'Volentio JSD Limited (England and Wales)',
    provides: 'Sends one script to the browser: the Vercel Blob upload code, pinned to an exact version.',
    usedIn: 'public/index.html (the @vercel/blob import)',
    plan: 'No plan',
    cost: 'Free, for personal and commercial use',
    licence: 'jsDelivr terms of use',
    terms: [
      { label: 'Terms of use', url: 'https://github.com/jsdelivr/jsdelivr/blob/master/Terms%20of%20Use.md', dated: '30 May 2026' },
      { label: 'Privacy policy', url: 'https://github.com/jsdelivr/jsdelivr/blob/master/Privacy%20Policy.md', dated: '23 Nov 2023' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'Free with no limit on requests. No promise of availability - it can be withdrawn or restricted.',
      'No cookies. IP address and browser details are logged as usage data.'
    ],
    asks: [
      { text: 'Keep the script pinned to an exact version.', check: { path: 'public/blob-upload.js', includes: 'cdn.jsdelivr.net/npm/@vercel/blob@' } },
      { text: 'Mention in the privacy policy that the browser fetches a script from jsDelivr.', check: { path: 'public/privacy.html', includes: 'jsDelivr' } }
    ],
    watch: [
      'A script from someone else\'s server runs inside the app. Hosting that one file ourselves would remove both the risk and the dependency for uploads.'
    ],
    hosts: ['jsdelivr.net']
  },
  {
    key: 'youtube',
    policyName: 'YouTube',
    name: 'YouTube',
    group: 'service',
    status: 'attention',
    who: 'Google LLC (USA)',
    provides: 'A member can attach a YouTube link to a piece. It plays in YouTube\'s standard player (privacy-enhanced mode), with YouTube\'s thumbnail picture.',
    usedIn: 'public/app.js (the youtube-nocookie.com player), server/services/flows.js (thumbnails)',
    plan: 'No plan',
    cost: 'Free',
    licence: 'YouTube Terms of Service, API Services Terms and Developer Policies (they cover the embedded player too)',
    terms: [
      { label: 'Terms of service (UK)', url: 'https://www.youtube.com/static?template=terms&gl=GB', dated: '17 Mar 2025' },
      { label: 'API services terms', url: 'https://developers.google.com/youtube/terms/api-services-terms-of-service', dated: '14 Sep 2026' },
      { label: 'Developer policies', url: 'https://developers.google.com/youtube/terms/developer-policies', dated: '14 Sep 2026' },
      { label: 'Player rules', url: 'https://developers.google.com/youtube/terms/required-minimum-functionality', dated: '14 Sep 2026' }
    ],
    termsCheckedOn: CHECKED,
    attention: [
      'Don\'t make YouTube playback a paid-only feature: the policies don\'t allow charging for what YouTube gives free. Selling the app itself is fine.'
    ],
    says: [
      'The API terms and developer policies apply to every use of the embedded player, even without the data API.',
      'Privacy-enhanced mode stops a view shaping the viewer\'s YouTube recommendations. It doesn\'t stop tracking once they click through to YouTube.',
      'YouTube can change or withdraw the player at will.'
    ],
    asks: [
      { text: 'Use the privacy-enhanced player.', check: { path: 'public/app.js', includes: 'www.youtube-nocookie.com/embed/' } },
      { text: 'The player is at least 200 by 200 pixels, with nothing laid over it and none of its controls or branding hidden.' },
      { text: 'No background play, and no splitting the sound from the picture.' },
      { text: 'Our terms link to YouTube\'s Terms of Service.', check: { path: 'public/terms.html', includes: 'https://www.youtube.com/t/terms' } },
      { text: 'Our privacy policy says we use YouTube and links to Google\'s privacy policy.', check: { path: 'public/privacy.html', includes: 'https://policies.google.com/privacy' } },
      { text: 'No ads or sponsorship on or around the player.' }
    ],
    watch: [
      'Many members are children. Apps aimed at children have extra duties for "Made for Kids" videos.',
      'The terms for YouTube\'s thumbnail pictures were not found.'
    ],
    hosts: ['youtube.com', 'youtube-nocookie.com', 'youtu.be']
  },
  {
    key: 'omr-service',
    name: 'Audiveris and solfascribe-omr',
    group: 'service',
    status: 'not_in_use',
    statusNote: 'Not deployed. PDF import stays off until the security conditions on Admin → Security are met.',
    who: 'Audiveris project (open source); solfascribe-omr by James Eissah Aidoo',
    provides: 'Reads a scanned score (PDF) and turns it into MusicXML, for "Create from file". It would run as our own separate service that the app calls.',
    usedIn: 'server/services/scoreImport.js (AUDIVERIS_SERVICE_URL, AUDIVERIS_SERVICE_TOKEN); docs/omr-security-review.md',
    plan: 'Self-hosted',
    cost: 'Free software; hosting it would cost something (not chosen yet)',
    licence: 'Audiveris: GNU AGPL v3. solfascribe-omr: MIT. It also bundles Tesseract (Apache 2.0).',
    terms: [
      { label: 'Audiveris licence', url: 'https://github.com/Audiveris/audiveris/blob/development/LICENSE' },
      { label: 'solfascribe-omr licence', url: 'https://github.com/James-Aidoo/solfascribe-omr/blob/main/LICENSE' },
      { label: 'AGPL v3', url: 'https://www.gnu.org/licenses/agpl-3.0.en.html' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'AGPL does not forbid commercial use.',
      'Run unmodified as a separate service the app calls: nothing has to be published, and the app\'s own code is not pulled under the AGPL.',
      'If we change Audiveris, everyone who uses it over the network must be offered our changed source, free, under the AGPL.',
      'If we hand the built image to anyone else, the licence and source (or a link to it) must go with it.'
    ],
    asks: [
      { text: 'Run Audiveris unmodified, as a separate service - never copy its code into the app.' },
      { text: 'Keep a link to the Audiveris source (it is in this entry).' },
      { text: 'Keep the wrapper\'s MIT notice if we copy or change it.' }
    ],
    watch: [
      'The wrapper is one person\'s new project - see the security review before turning PDF import on.'
    ]
  }
];
