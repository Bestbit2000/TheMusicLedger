// ML-267: services the live app needs. See register.js for what each field means.
// Facts read from each provider's own pages on 2026-10-04.

const CHECKED = '2026-10-04';

// The app has no privacy policy or terms page yet - several sets of terms below need one.
const NO_PRIVACY_PAGE = 'The app has no privacy policy page yet.';

export default [
  {
    key: 'neon',
    name: 'Neon',
    group: 'service',
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
      'Which region the project is in (London and Frankfurt exist) - it is fixed when the project is made. Not checked yet.',
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
    name: 'Vercel',
    group: 'service',
    status: 'attention',
    who: 'Vercel Inc. (USA)',
    provides: 'Hosting: serves the app\'s pages and runs the server (one function). Every push to main deploys to production.',
    usedIn: 'vercel.json, api/[...slug].js; docs/release-process.md',
    plan: 'Hobby plan',
    cost: 'Free',
    licence: 'Vercel terms of service',
    terms: [
      { label: 'Terms of service', url: 'https://vercel.com/legal/terms', dated: '1 Jun 2026' },
      { label: 'Fair use guidelines', url: 'https://vercel.com/docs/limits/fair-use-guidelines', dated: '14 Sep 2026' },
      { label: 'Acceptable use', url: 'https://vercel.com/legal/acceptable-use-policy', dated: '21 Apr 2026' },
      { label: 'Privacy policy', url: 'https://vercel.com/legal/privacy-policy', dated: '1 Jun 2026' },
      { label: 'Data processing agreement', url: 'https://vercel.com/legal/dpa', dated: '31 Mar 2026' },
      { label: 'Hobby plan', url: 'https://vercel.com/docs/plans/hobby' }
    ],
    termsCheckedOn: CHECKED,
    attention: [
      'The Hobby plan is for non-commercial personal use only. Taking payment from visitors, or advertising a paid product, counts as commercial - so the app must move to Pro ($20 a month) before Premium is sold or advertised.',
      'Vercel\'s data processing agreement covers Pro and Enterprise only. On Hobby there is no processor contract for the names, emails and files held there.'
    ],
    says: [
      'Hobby is for personal, non-commercial use. Asking for donations is not commercial; taking payment, advertising a sale, being paid to build the site, or carrying ads is.',
      'They can disable or remove a Hobby project with or without notice, and end the account at once if limits are passed.',
      'Changes to the terms apply when posted or emailed.',
      'Processing is mainly in the USA. Functions run in US East unless the region was changed.'
    ],
    asks: [
      { text: 'Stay non-commercial while on Hobby: no payments, no advertising of a paid product, no ads.' },
      { text: 'No content that infringes someone\'s rights - members upload recordings and sheet music, so we need a way to take something down when asked.' },
      { text: 'One account only - no second account to get round the limits.' }
    ],
    watch: [
      'Which region the function runs in - not checked.',
      'A scheduled job (cron) on Hobby can run at most once a day.'
    ],
    limits: [
      { what: 'Fast data transfer', allowance: '100 GB a month' },
      { what: 'Fast origin transfer', allowance: '10 GB a month' },
      { what: 'CDN requests', allowance: '1,000,000 a month' },
      { what: 'Function invocations', allowance: '1,000,000 a month' },
      { what: 'Function active CPU', allowance: '4 hours a month' },
      { what: 'Function memory', allowance: '360 GB-hours a month' },
      { what: 'Deployments', allowance: '100 a day' },
      { what: 'Function run time', allowance: '300 seconds at most' }
    ],
    overLimit: 'Blocked, not billed: in most cases the feature stops until 30 days have passed.',
    nextTier: 'Pro - $20 a month, which includes $20 of usage. Beyond that, pay for what you use (London rates: $0.15 per GB transferred, $0.60 per million invocations).',
    usageSource: 'Vercel API: GET /v1/billing/charges gives the amount used per service per day. Whether it answers for a Hobby account is not confirmed.',
    hosts: ['vercel.app', 'vercel.com']
  },
  {
    key: 'vercel-blob',
    name: 'Vercel Blob',
    group: 'service',
    status: 'in_use',
    who: 'Vercel Inc. (USA)',
    provides: 'File storage: members\' mp3 and mp4 recordings, and PDF, MusicXML, Sibelius and MuseScore documents attached to a piece.',
    usedIn: 'server/routes/api.js, server/services/flows.js (BLOB_READ_WRITE_TOKEN); the browser uploads straight to it',
    plan: 'Hobby plan',
    cost: 'Free',
    licence: 'Vercel terms of service (same as Vercel)',
    terms: [
      { label: 'Terms of service', url: 'https://vercel.com/legal/terms', dated: '1 Jun 2026' },
      { label: 'Usage and pricing', url: 'https://vercel.com/docs/vercel-blob/usage-and-pricing', dated: '23 Sep 2026' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'The same terms as Vercel hosting, including the non-commercial rule on Hobby.',
      'Reading a file also counts against the general Hobby transfer and request allowances.',
      'Looking through the store in Vercel\'s dashboard counts as operations too.'
    ],
    asks: [],
    watch: [
      'Going over a limit makes every recording and document unreachable for up to 30 days - for those features that is an outage.',
      'Recordings can hold personal data (voices, faces). On Hobby they sit outside the data processing agreement.'
    ],
    limits: [
      { what: 'Storage', allowance: '1 GB (monthly average)' },
      { what: 'Simple operations (reads)', allowance: '10,000 a month' },
      { what: 'Advanced operations (uploads, lists)', allowance: '2,000 a month' },
      { what: 'Data transfer', allowance: '10 GB a month' }
    ],
    overLimit: 'No charge, but the store can\'t be reached until 30 days have passed. Vercel emails as the limit gets near.',
    nextTier: 'On Pro (London rates): $0.024 per GB-month stored, $0.05 per GB transferred, $5.30 per million uploads.',
    usageSource: 'The app already stores every file\'s size (score_recordings, score_documents), so storage can be added up from our own tables. Operations and transfer come from Vercel\'s billing API or dashboard.',
    hosts: ['vercel-storage.com']
  },
  {
    key: 'google-sign-in',
    name: 'Google sign-in',
    group: 'service',
    status: 'attention',
    who: 'Google LLC (USA)',
    provides: '"Sign in with Google" - login only. We ask for the basic profile and email address, nothing else.',
    usedIn: 'server/config/passport.js (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)',
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
      `${NO_PRIVACY_PAGE} Google's rules need one that says what Google data we collect and how it is used, linked from the home page and from the sign-in consent screen.`
    ],
    says: [
      'Google can end access at any time.',
      'An app left in "Testing" is limited to 100 test users, and each sign-in permission runs out after 7 days.',
      'Showing the app\'s name and logo on the consent screen needs brand verification: a home page on a domain we have verified, describing the app, with the privacy policy linked.',
      'Asking for more than profile and email later (Drive, Calendar...) brings a much heavier review.'
    ],
    asks: [
      { text: 'A privacy policy that says what Google data we collect and how we use it - on the home page and on the consent screen.' },
      { text: 'Ask only for what we need: profile and email.', check: { path: 'server/config/passport.js', includes: ['profile', 'email'] } },
      { text: 'The button says "Sign in with Google" (or "Continue with Google") with Google\'s standard coloured G, and is no less prominent than any other sign-in choice.' },
      { text: 'Keep the client secret out of the code - it lives in the environment settings only.' },
      { text: 'Never suggest Google endorses the app.' }
    ],
    watch: [
      'Whether the app is "In production" or still "Testing" in the Google Cloud console, and its verification status - not checked.',
      'A domain of our own is needed for brand verification - there isn\'t one yet.'
    ],
    limits: [
      { what: 'Users while in "Testing"', allowance: '100 test users' }
    ],
    hosts: ['accounts.google.com']
  },
  {
    key: 'posthog',
    name: 'PostHog',
    group: 'service',
    status: 'attention',
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
    attention: [
      'The data processing agreement is free on any plan but is not automatic - it has to be filled in and signed on PostHog\'s site. UK data law expects one.',
      `${NO_PRIVACY_PAGE} PostHog's terms make us responsible for telling users and having any consent needed (UK cookie rules).`
    ],
    says: [
      'Price rises need 30 days\' notice. Either side can end it with 30 days\' notice.',
      'Terms can change at PostHog\'s discretion; carrying on counts as accepting.',
      'Section 5 lets PostHog use customer content to develop its products and machine-learning models unless we opt out. Only part of this clause was read.',
      'No credit or attribution is asked for.'
    ],
    asks: [
      { text: 'Tell users about PostHog in the privacy policy.' },
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
    key: 'resend',
    name: 'Resend',
    group: 'service',
    status: 'in_use',
    who: 'Plus Five Five, Inc. (USA)',
    provides: 'Sends the app\'s emails: invites, password resets, sign-up and upgrade alerts. Only when MAIL_PROVIDER is "resend"; on dev, emails are just written to the database.',
    usedIn: 'server/services/mail.js (RESEND_API_KEY, MAIL_FROM)',
    plan: 'Free plan',
    cost: 'Free',
    licence: 'Resend terms of service',
    terms: [
      { label: 'Terms of service', url: 'https://resend.com/legal/terms-of-service', dated: '27 Aug 2026' },
      { label: 'Acceptable use', url: 'https://resend.com/legal/acceptable-use', dated: '27 Aug 2026' },
      { label: 'Privacy policy', url: 'https://resend.com/legal/privacy-policy', dated: '27 Aug 2026' },
      { label: 'Data processing agreement', url: 'https://resend.com/legal/dpa', dated: '31 Dec 2025' },
      { label: 'Pricing', url: 'https://resend.com/pricing' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'The data processing agreement applies as soon as the terms are accepted - nothing to sign.',
      'Resend is a processor of the addresses and messages. Processing is mainly in the USA.',
      'Sent emails, links included, stay in Resend\'s logs for 30 days.',
      'Price changes come with reasonable notice; terms changes apply when posted.',
      'A free account that goes over its limits can be changed or closed.'
    ],
    asks: [
      { text: 'Only email people who expect it. Password resets are asked for by the member. Invites go to people who haven\'t signed up, so keep them one-off, clearly from the named person, with no marketing.' },
      { text: 'Keep bounces under 4% and spam complaints under 0.08%, or sending can be paused without warning. A mistyped invite address counts as a bounce.' },
      { text: 'No bought or collected lists.' }
    ],
    watch: [
      'The daily cap of 100 is the one most likely to be hit first: each member can send 5 invites a day.',
      'Use a "sending only" API key, not a full-access one.',
      'A domain of our own is needed to send from a proper address - there isn\'t one yet.'
    ],
    limits: [
      { what: 'Emails', allowance: '3,000 a month' },
      { what: 'Emails in a day', allowance: '100' },
      { what: 'Sending domains', allowance: '3' }
    ],
    overLimit: 'Blocked: the send is refused until the day or month rolls over.',
    nextTier: 'Pro - $20 a month for 50,000 emails with no daily cap; then $0.90 per 1,000.',
    usageSource: 'Every reply from Resend says how many emails have been used this month and today, so the app can record it when it sends. The app also keeps its own log of what it sent.',
    hosts: ['resend.com']
  },
  {
    key: 'pwned-passwords',
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
      { text: 'Keep the script pinned to an exact version.', check: { path: 'public/index.html', includes: 'cdn.jsdelivr.net/npm/@vercel/blob@' } },
      { text: 'Mention in the privacy policy that the browser fetches a script from jsDelivr.' }
    ],
    watch: [
      'A script from someone else\'s server runs inside the app. Hosting that one file ourselves would remove both the risk and the dependency for uploads.'
    ],
    hosts: ['jsdelivr.net']
  },
  {
    key: 'youtube',
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
      'There are no terms of use or privacy policy in the app. YouTube\'s policies ask that our terms link to YouTube\'s Terms of Service, and that our privacy policy says we use YouTube and links to Google\'s privacy policy.',
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
      { text: 'Our terms link to YouTube\'s Terms of Service; our privacy policy says we use YouTube and links to Google\'s privacy policy.' },
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
