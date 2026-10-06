// ML-443: the plan Admin -> Business case starts from - the four roll-out scenarios in the ticket, and
// every cost found for them, at the prices read on each provider's or regulator's own page on
// 4-5 October 2026. It is only a starting point: the owner changes any of it on the page, and
// "Back to the starting figures" brings this back. A cost keeps its starting amount (`start`) so a
// changed figure can show what it was. When a price here is re-checked, change it and CHECKED_ON together.
//
// The links are where each price was read. Nothing is fetched from them; their hosts are listed in
// the third-party register's notDependencies (server/thirdParties/register.js) for that reason.
// What each figure rests on, and what could not be confirmed: docs/business-case.md.

const CHECKED_ON = '2026-10-05';

const GROUPS = [
  { id: 'build', name: 'Building it' },
  { id: 'host', name: 'Hosting and services' },
  { id: 'legal', name: 'Legal and compliance' },
  { id: 'reach', name: 'Website, address and app stores' },
  { id: 'company', name: 'Company and accounts' },
  { id: 'cover', name: 'Insurance' }
];

const AT_LAUNCH = { months: 0 };
const A_YEAR_IN = { months: 12 };

// basis: paying (being paid today) | published (a price read from its own page) | estimate (my guess)
const COSTS = [
  { id: 'claude-max-build', group: 'build', name: 'Claude Max (5x) while it is being built', amount: 90, currency: 'GBP', every: 'month', from: { month: '2026-09' }, until: { months: -1 }, basis: 'paying',
    note: 'The UK price with VAT ($100 in the US), from the first month of building to the month before launch.', source: { label: 'claude.com', url: 'https://claude.com/pricing' } },
  { id: 'claude-pro', group: 'build', name: 'Claude Pro after 1.0.0', amount: 18, currency: 'GBP', every: 'month', from: AT_LAUNCH, basis: 'published',
    note: 'The UK price with VAT, or £180 for a year paid up front. Includes Opus and Sonnet; the top model needs paid-for usage credits.', source: { label: 'claude.com', url: 'https://claude.com/pricing' } },
  { id: 'claude-max-after', group: 'build', name: 'Claude Max (5x) after 1.0.0 instead', amount: 90, currency: 'GBP', every: 'month', from: AT_LAUNCH, basis: 'published',
    note: 'Switch this on, and Claude Pro off, for a scenario where building carries on at full pace.', source: { label: 'claude.com', url: 'https://claude.com/pricing' } },

  { id: 'vercel-pro', group: 'host', name: 'Vercel Pro (hosting)', amount: 24, currency: 'USD', every: 'month', from: AT_LAUNCH, basis: 'published',
    note: '$20 plus UK VAT. The free plan is for non-commercial use and has no data processing contract, so this is required once anything is sold and expected once other people\'s information is held. Its $20 of included usage covers file storage.', source: { label: 'vercel.com', url: 'https://vercel.com/docs/plans/pro-plan' } },
  { id: 'database', group: 'host', name: 'Database (Neon), once it outgrows the free plan', calc: 'database', basis: 'published',
    note: 'Worked out from the member numbers and the usage figures on the Overview. Free to 100 compute-hours a month, then $0.106 an hour and $0.35 a GB.', source: { label: 'neon.com', url: 'https://neon.com/pricing' } },
  { id: 'resend-pro', group: 'host', name: 'Resend Pro (email)', amount: 20, currency: 'USD', every: 'month', from: AT_LAUNCH, minMembers: 3000, basis: 'published',
    note: 'Needed above 100 emails a day or 3,000 a month. The 3,000 members is my guess at when that happens.', source: { label: 'resend.com', url: 'https://resend.com/pricing' } },
  { id: 'pdf-server', group: 'host', name: 'A small server for PDF import', amount: 5, currency: 'GBP', every: 'month', from: AT_LAUNCH, basis: 'estimate',
    note: 'Only if "Create from file" is switched on. It may cost nothing on a pay-per-use service, or £4-£6 a month on a small server of its own.' },
  { id: 'uptime-checks', group: 'host', name: 'Uptime checks (a paid plan)', amount: 10, currency: 'GBP', every: 'month', from: AT_LAUNCH, basis: 'estimate',
    note: 'Free plans are enough at this size. One free plan describes itself as for hobby and non-profit projects, so a business may need the paid one.' },

  { id: 'ico-first', group: 'legal', name: 'ICO data protection fee, first year', amount: 47, currency: 'GBP', every: 'year', from: { month: '2026-10' }, until: { month: '2026-10' }, basis: 'published',
    note: 'Due now, because other people already have accounts. £47 by direct debit, £52 otherwise.', source: { label: 'ico.org.uk', url: 'https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/' } },
  { id: 'ico-yearly', group: 'legal', name: 'ICO fee, each year after', amount: 47, currency: 'GBP', every: 'year', from: { month: '2027-10' }, basis: 'published',
    note: 'Not needed while you are the only person using it: personal use is exempt.', source: { label: 'ico.org.uk', url: 'https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/' } },
  { id: 'solicitor', group: 'legal', name: 'Privacy policy and terms read by a solicitor', amount: 500, currency: 'GBP', every: 'once', from: AT_LAUNCH, basis: 'estimate',
    note: 'Fixed-fee services quote £100 to £1,500; solicitors\' guideline rates run £288-£579 an hour.', source: { label: 'gov.uk', url: 'https://www.gov.uk/guidance/solicitors-guideline-hourly-rates' } },
  { id: 'trade-mark', group: 'legal', name: 'Trade mark for the name', amount: 205, currency: 'GBP', every: 'once', from: AT_LAUNCH, basis: 'published',
    note: 'One class, applied for online; £60 for each extra class.', source: { label: 'legislation.gov.uk', url: 'https://www.legislation.gov.uk/uksi/2026/183/made' } },
  { id: 'prs-licence', group: 'legal', name: 'PRS for Music licence', amount: 239, currency: 'GBP', every: 'year', from: AT_LAUNCH, basis: 'published',
    note: '£199 + VAT at least. Only if members\' recordings of copyrighted music are shared with the public.' },

  { id: 'domain', group: 'reach', name: 'Domain name', amount: 10, currency: 'GBP', every: 'year', from: AT_LAUNCH, basis: 'estimate',
    note: 'A .co.uk runs from about £4 a year to £16. Without a domain, invites and password resets can only be emailed to you.', source: { label: 'porkbun.com', url: 'https://porkbun.com/tld/co.uk' } },
  { id: 'business-address', group: 'reach', name: 'A business address', amount: 47, currency: 'GBP', every: 'year', from: AT_LAUNCH, basis: 'published',
    note: '£39 + VAT. Otherwise the address an online service has to publish is your home.', source: { label: '1stformations.co.uk', url: 'https://www.1stformations.co.uk/pricing/' } },
  { id: 'google-play', group: 'reach', name: 'Google Play developer account', amount: 25, currency: 'USD', every: 'once', from: AT_LAUNCH, basis: 'published',
    note: 'One payment. The web app is wrapped for Android free.', source: { label: 'support.google.com', url: 'https://support.google.com/googleplay/android-developer/answer/6112435' } },
  { id: 'apple-developer', group: 'reach', name: 'Apple Developer Program', amount: 99, currency: 'USD', every: 'year', from: AT_LAUNCH, basis: 'published',
    note: 'Only for an iPhone app in the App Store. It also brings Sign in with Apple and, for Premium, Apple\'s 15%.', source: { label: 'developer.apple.com', url: 'https://developer.apple.com/programs/enroll/' } },

  { id: 'company-set-up', group: 'company', name: 'Set up a limited company', amount: 100, currency: 'GBP', every: 'once', from: AT_LAUNCH, basis: 'published',
    note: 'Companies House, online.', source: { label: 'gov.uk', url: 'https://www.gov.uk/government/publications/companies-house-fees/companies-house-fees' } },
  { id: 'confirmation-statement', group: 'company', name: 'Confirmation statement', amount: 50, currency: 'GBP', every: 'year', from: A_YEAR_IN, basis: 'published',
    note: 'First due a year after the company is set up.', source: { label: 'gov.uk', url: 'https://www.gov.uk/government/publications/companies-house-fees/companies-house-fees' } },
  { id: 'filing-software', group: 'company', name: 'Software to file accounts and the tax return', amount: 71, currency: 'GBP', every: 'year', from: A_YEAR_IN, basis: 'published',
    note: '£59 + VAT, the cheapest found. HMRC\'s free filing service closed in March 2026.', source: { label: 'tinytax.co.uk', url: 'https://tinytax.co.uk/pricing' } },
  { id: 'accountant', group: 'company', name: 'An accountant for the year end', amount: 479, currency: 'GBP', every: 'year', from: A_YEAR_IN, basis: 'published',
    note: '£399 + VAT, instead of filing it yourself.', source: { label: 'debitam.com', url: 'https://www.debitam.com/pricing/' } },

  { id: 'insurance', group: 'cover', name: 'Insurance: professional indemnity and cyber', amount: 18.8, currency: 'GBP', every: 'month', from: AT_LAUNCH, basis: 'published',
    note: 'Advertised starting prices (£8.14 + £10.66 a month), not a quote.', source: { label: 'policybee.co.uk', url: 'https://www.policybee.co.uk/software-developer-insurance' } }
];

const JUST_ME = ['claude-max-build', 'claude-pro', 'database', 'ico-first'];
const INVITE_ONLY = [...JUST_ME, 'vercel-pro', 'ico-yearly', 'domain'];
const FREE_TO_ANYONE = [...INVITE_ONLY, 'business-address', 'google-play', 'resend-pro'];
const PREMIUM = [...FREE_TO_ANYONE, 'solicitor', 'company-set-up', 'confirmation-statement', 'filing-software', 'insurance'];
const including = (ids) => Object.fromEntries(ids.map((id) => [id, true]));

// Income every scenario can switch on. The counts are per year (year 1 to 5) and are placeholders.
const income = (premiumOn) => ({
  premium: { on: premiumOn, payingShare: 2, priceMonth: 3.99, priceYear: 29.99, yearlyShare: 60, route: 'card' },
  extras: [
    { id: 'band-licences', name: 'Band licences', on: false, price: 60, every: 'year', counts: [3, 6, 10, 15, 20], note: 'One licence covers every member of a band. Band organiser tools charge £30-£100 a year.' },
    { id: 'teacher-plans', name: 'Teacher plans', on: false, price: 7.99, every: 'month', counts: [2, 5, 10, 15, 20], note: 'The teacher pays and their pupils get Premium free. Similar tools charge teachers £8-£14 a month.' },
    { id: 'paid-listings', name: 'Paid listings (shops, repairers, teachers)', on: false, price: 5, every: 'month', counts: [0, 5, 10, 20, 30], note: 'A teacher directory charges £4-£30 a month. Nobody pays to reach a few hundred members.' },
    { id: 'sponsor', name: 'A sponsor', on: false, price: 50, every: 'month', counts: [0, 1, 1, 1, 1], note: 'One named sponsor, shown without tracking. Plausible from about 1,000 active members.' }
  ],
  gifts: { on: false, share: 1, amount: 10 },
  ads: { on: false, activeShare: 60, visits: 12, perVisit: 3, rate: 0.75 }
});

// Members at launch, then at the end of each year. Years 2 to 5 are placeholders to type over.
const SCENARIOS = [
  { id: 'only-me', name: 'Only me', about: 'Just you. Everything stays on the free plans and the ICO fee is not renewed, because using it yourself is personal use.',
    members: [1, 1, 1, 1, 1, 1], costs: including(JUST_ME), taxRate: 0, income: income(false) },
  { id: 'invite-only', name: 'Invite only', about: 'Friends, family and your bands, free, by your invitation. The ICO fee, a domain so invites can be emailed, and hosting that comes with a data processing contract.',
    members: [15, 40, 40, 40, 40, 40], costs: including(INVITE_ONLY), taxRate: 0, income: income(false) },
  { id: 'free-to-anyone', name: 'Free to anyone', about: 'Anyone can sign up, from a website and Google Play. Nothing is charged, but there is a published address and enough members for the database to cost something.',
    members: [40, 500, 900, 1300, 1700, 2100], costs: including(FREE_TO_ANYONE), taxRate: 0, income: income(false) },
  { id: 'premium', name: 'Premium', about: 'Free to anyone, plus a paid Premium membership. Taking money makes it a business: a company, insurance and a solicitor\'s read of the terms.',
    members: [40, 500, 900, 1300, 1700, 2100], costs: including(PREMIUM), taxRate: 19, income: income(true) }
];

// A fresh copy each time, so nobody changes the one above.
export function startingPlan() {
  const plan = {
    version: 1,
    launch: '2027-01',
    buildStart: '2026-09',
    years: 5,
    usdPerGbp: 1.32,
    checkedOn: CHECKED_ON,
    current: 'invite-only',
    // How the database cost is worked out. The first three are guesses until members are using it.
    usage: { dailyShare: 35, visitMinutes: 30, windowHours: 15, devHours: 15, computeSize: 0.25, freeHours: 100, hourPrice: 0.106, storageGb: 1, storagePrice: 0.35 },
    // Card: Stripe's 1.5% for a UK card + 0.7% for running the renewals, and 20p. Stores: VAT off first, then 15%.
    fees: { cardPercent: 2.2, cardFixed: 0.2, vatRate: 20, storeCommission: 15 },
    groups: GROUPS,
    costs: COSTS.map((c) => ({ until: null, minMembers: 0, perMemberOver: null, ...c, ...(c.calc ? {} : { start: { amount: c.amount, currency: c.currency, every: c.every, basis: c.basis } }) })),
    scenarios: SCENARIOS
  };
  return JSON.parse(JSON.stringify(plan));
}
