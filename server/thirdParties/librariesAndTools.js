// ML-267: the open-source code the app is built from (npm packages), and the tools used to build
// it. See register.js for what each field means.
//
// A copy of each package's licence is in public/licences/npm/ (npm run third-party-licences).
// Only the packages named in package.json and server/package.json are listed - not the packages
// those bring in with them.

const CHECKED = '2026-10-04';

const licenceCopy = (pkg) => `public/licences/npm/${pkg.replace(/^@/, '').replace(/\//g, '__')}.txt`;

// One npm package. `where` says whether it runs in the live app or only on a developer's machine.
function npm(pkg, licence, who, provides, where, extra = {}) {
  return {
    key: `npm-${pkg.replace(/^@/, '').replace(/\//g, '-')}`,
    name: pkg,
    group: 'library',
    status: 'in_use',
    who,
    provides,
    usedIn: where,
    cost: 'Free',
    licence,
    terms: [{ label: 'npm', url: `https://www.npmjs.com/package/${pkg}` }],
    licenceFile: extra.noLicenceFile ? undefined : licenceCopy(pkg),
    termsCheckedOn: CHECKED,
    asks: [],
    packages: [pkg],
    ...extra
  };
}

const LIVE = 'Runs in the live app (server)';
const DEV = 'Developer\'s machine only - never sent to users';

export const libraries = [
  npm('express', 'MIT', 'OpenJS Foundation and contributors', 'The web server every request goes through.', LIVE),
  npm('body-parser', 'MIT', 'Express contributors', 'Reads the data sent with a request.', LIVE),
  npm('cors', 'MIT', 'Express contributors', 'Decides which web addresses may call the server.', LIVE),
  npm('pg', 'MIT', 'Brian Carlson', 'Talks to the Postgres database.', LIVE),
  npm('passport', 'MIT', 'Jared Hanson', 'Sign-in framework.', LIVE),
  npm('passport-google-oauth20', 'MIT', 'Jared Hanson', 'The Google part of sign-in.', LIVE),
  npm('@vercel/blob', 'Apache-2.0', 'Vercel Inc.', 'Uploads, reads and deletes files in Vercel Blob. The browser half is loaded from jsDelivr.', LIVE),
  npm('fast-xml-parser', 'MIT', 'Amit Gupta (NaturalIntelligence)', 'Reads MusicXML files.', LIVE),
  npm('jszip', '(MIT OR GPL-3.0-or-later)', 'Stuart Knightley and contributors', 'Opens compressed MusicXML (.mxl) files.', LIVE, {
    says: ['Offered under either licence - we use it under the MIT licence, which asks only that the notice is kept.']
  }),
  npm('nodemailer', 'MIT-0', 'Andris Reinman', 'Sends email over SMTP, when MAIL_PROVIDER is "smtp".', LIVE),
  npm('@simplewebauthn/server', 'MIT', 'Matthew Miller', 'Checks a passkey\'s signed answer when a super admin opens the admin panel (ML-518). The browser half is our own file - nothing is loaded from anywhere else.', LIVE, {
    termsCheckedOn: '2026-10-10',
    says: ['It brings in about two dozen packages of its own (the @peculiar/asn1 family, tiny-cbor, tsyringe and others) to read the certificates and encodings a passkey uses. All run on our server only; nothing is sent to their authors.']
  }),
  npm('dotenv', 'BSD-2-Clause', 'Scott Motte', 'Reads the .env settings file on a developer\'s machine.', LIVE),
  npm('axios', 'MIT', 'Matt Zabriskie and contributors', 'Web requests in the release scripts (cut-release, sync-releases).', 'Release scripts on a developer\'s machine; also listed for the server, which doesn\'t use it'),
  npm('@neon/config', 'Apache-2.0', 'Neon (Databricks, Inc.)', 'Neon\'s project settings file (neon.ts).', DEV),
  npm('@neon/env', 'Apache-2.0', 'Neon (Databricks, Inc.)', 'Neon\'s project settings file (neon.ts).', DEV),
  npm('@playwright/test', 'Apache-2.0', 'Microsoft Corporation', 'Runs the back-tests in a real browser.', DEV),
  npm('@axe-core/playwright', 'MPL-2.0', 'Deque Systems, Inc.', 'The accessibility scan (npm run a11y-scan).', DEV, {
    says: ['MPL 2.0 only asks for something if we change its files and pass them on. We run it unchanged and never ship it.']
  }),
  npm('husky', 'MIT', 'typicode', 'Runs the checks before a push (the pre-push hook).', DEV),
  npm('xmllint-wasm', 'MIT', 'noppa', 'Checks our MusicXML against the official definition, in tests.', DEV, {
    noLicenceFile: 'The package ships no licence file; its package.json declares MIT.'
  })
];

export const build = [
  {
    key: 'github',
    name: 'GitHub',
    group: 'build',
    status: 'in_use',
    who: 'GitHub, Inc. (USA)',
    provides: 'Holds the code (one private repository); Vercel deploys from it. Admin → Security also reads a public repository through GitHub\'s API.',
    usedIn: 'The git remote; server/services/securityReview.js (optional GITHUB_TOKEN)',
    plan: 'Free plan',
    cost: 'Free',
    licence: 'GitHub terms of service',
    terms: [
      { label: 'Terms of service', url: 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service', dated: '27 Apr 2026' },
      { label: 'Plans', url: 'https://docs.github.com/en/get-started/learning-about-github/githubs-plans' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'A free private repository may be used for commercial work.',
      'GitHub may look into a private repository for security, support or legal reasons, and may suspend an account without notice.'
    ],
    asks: [
      { text: 'One person per login - no sharing accounts or tokens.' }
    ],
    watch: [
      'Without a token the API allows 60 requests an hour per IP address, and Vercel shares its addresses - so set GITHUB_TOKEN for Admin → Security.',
      'Free has no branch protection on a private repository.'
    ],
    limits: [
      { what: 'Private repositories', allowance: 'Unlimited' },
      { what: 'File size', allowance: 'Blocked above 100 MB; keep the repository under 1 GB' },
      { what: 'API requests', allowance: '60 an hour without a token, 5,000 with one' },
      { what: 'Actions minutes (not used)', allowance: '2,000 a month' }
    ],
    nextTier: 'Pro - $4 a month: branch protection on private repositories, 3,000 Actions minutes.',
    hosts: ['github.com', 'githubusercontent.com']
  },
  {
    key: 'jira',
    name: 'Jira',
    group: 'build',
    status: 'in_use',
    who: 'Atlassian Pty Ltd (Australia)',
    provides: 'The list of work (ML- issues) and the release history. The About page\'s release notes are copied from it into public/releases.json.',
    usedIn: 'scripts/cut-release.mjs, scripts/sync-releases.mjs; links from the admin pages',
    plan: 'Free plan',
    cost: 'Free',
    licence: 'Atlassian Customer Agreement',
    terms: [
      { label: 'Customer agreement', url: 'https://www.atlassian.com/legal/atlassian-customer-agreement', dated: '1 Oct 2026' },
      { label: 'Pricing', url: 'https://www.atlassian.com/software/jira/pricing' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'Free products come with no warranty, support or uptime promise, and Atlassian may end or change free use.',
      'For a UK customer the agreement is under Irish law.'
    ],
    asks: [
      { text: 'Keep logins private; users must be 16 or over.' }
    ],
    watch: [
      'The release history lives in Jira. public/releases.json is the safety copy - keep committing it.',
      'From 3 Dec 2026 automation is counted in steps (each trigger, condition and action).'
    ],
    limits: [
      { what: 'Users', allowance: '10' },
      { what: 'File storage', allowance: '2 GB' },
      { what: 'Automation', allowance: '150 steps a month' }
    ],
    nextTier: 'Standard - about $7.91 per user a month (US price as shown; the user band was not confirmed).',
    hosts: ['atlassian.net', 'atlassian.com']
  },
  {
    key: 'claude-code',
    name: 'Claude Code',
    group: 'build',
    status: 'attention',
    paid: true,
    who: 'Anthropic Ireland, Limited (for UK customers)',
    provides: 'Writes and reviews the app\'s code, and runs the deep security review.',
    usedIn: 'The whole repository; CLAUDE.md and .claude/ hold its instructions',
    plan: 'Claude Max (5x)',
    cost: '$100 a month',
    licence: 'Anthropic Consumer Terms (Max is a consumer plan) and Usage Policy',
    terms: [
      { label: 'Consumer terms', url: 'https://www.anthropic.com/legal/consumer-terms', dated: '8 Oct 2025' },
      { label: 'Commercial terms', url: 'https://www.anthropic.com/legal/commercial-terms', dated: '17 Jun 2025' },
      { label: 'Usage policy', url: 'https://www.anthropic.com/legal/aup', dated: '15 Sep 2025' },
      { label: 'Which terms apply to Claude Code', url: 'https://code.claude.com/docs/en/legal-and-compliance' }
    ],
    termsCheckedOn: CHECKED,
    attention: [
      'Max is covered by the Consumer Terms. Their UK liability section includes an agreement not to use the service for commercial or business purposes. Nothing was found that stops Claude-written code going into a commercial product, but before Premium is sold it is worth asking Anthropic in writing, or moving to a plan under the Commercial Terms.'
    ],
    says: [
      'Anthropic passes to us whatever rights it has in what Claude writes.',
      'What Claude writes may be wrong and should be checked.',
      'The Consumer Terms give no protection against a copyright claim over the output; the Commercial Terms do.'
    ],
    asks: [
      { text: 'The Max login is for the owner\'s own use. Any AI feature inside the app would need an API key under the Commercial Terms.' },
      { text: 'Don\'t use it to build a competing AI product or to train AI models.' }
    ],
    watch: [
      'Whether code written by an AI has copyright at all is unsettled law.',
      'The price is shown in US dollars only.'
    ],
    limits: [
      { what: 'Usage', allowance: 'A shared allowance that resets through the week; not a fixed number' }
    ],
    hosts: ['anthropic.com', 'claude.com']
  },
  {
    key: 'ico',
    name: 'ICO data protection fee',
    group: 'build',
    status: 'in_use',
    who: 'Information Commissioner\'s Office (UK)',
    provides: 'The UK regulator for personal data. Anyone who holds people\'s personal information - sole traders included - pays a yearly fee unless exempt.',
    usedIn: 'Not in the code: it applies because the app holds members\' names and email addresses',
    plan: 'Smallest tier',
    cost: 'Paid - registered on 6 October 2026. A yearly fee: the owner\'s figure is £52, £47 by direct debit',
    licence: 'A legal duty, not a licence (Data Protection (Charges and Information) Regulations 2018)',
    terms: [
      { label: 'Data protection fee', url: 'https://ico.org.uk/for-organisations/data-protection-fee/' },
      { label: 'Self-assessment', url: 'https://ico.org.uk/for-organisations/data-protection-fee/self-assessment/' }
    ],
    termsCheckedOn: CHECKED,
    statusNote: 'Registered and paid (the owner, 6 October 2026). The registration\'s own numbers are kept on this page under "My reference", not in the code.',
    says: [
      'Organisations (including sole traders) that use personal information need to pay, unless they are exempt.',
      'The amounts and the list of exemptions were not readable on the pages checked - the self-assessment gives both.'
    ],
    asks: [
      { text: 'Pay the fee each year once registered, and keep the registration details up to date.' }
    ],
    hosts: ['ico.org.uk']
  },
  {
    key: 'osv',
    name: 'OSV',
    group: 'build',
    status: 'in_use',
    who: 'Google (open-source project)',
    provides: 'The list of known security holes in open-source code, looked up by the security review.',
    usedIn: 'server/services/securityReview.js, scripts/omr-security-review.mjs',
    plan: 'No plan',
    cost: 'Free (no price is published)',
    licence: 'No terms of service found. The data is under open licences, mostly CC-BY 4.0.',
    terms: [
      { label: 'API', url: 'https://google.github.io/osv.dev/api/' },
      { label: 'Data sources and licences', url: 'https://google.github.io/osv.dev/data/' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'No key needed and, for now, no limits.',
      'With no formal terms there is no promise it stays that way.'
    ],
    asks: [
      { text: 'If advisory text is shown to anyone beyond the admin page, credit OSV and the GitHub Advisory Database.' }
    ],
    hosts: ['osv.dev']
  },
  {
    key: 'nodejs',
    name: 'Node.js and npm',
    group: 'build',
    status: 'in_use',
    who: 'OpenJS Foundation (Node.js); npm, Inc., part of GitHub (the package registry)',
    provides: 'What the server runs on (Node 24, on Vercel and on a developer\'s machine), and where the code libraries are downloaded from.',
    usedIn: 'package.json ("engines"), every npm install',
    plan: 'No plan',
    cost: 'Free',
    licence: 'Node.js: MIT. npm registry: npm\'s open-source terms.',
    terms: [
      { label: 'Node.js licence', url: 'https://github.com/nodejs/node/blob/main/LICENSE' },
      { label: 'npm terms', url: 'https://docs.npmjs.com/policies/open-source-terms' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'Free to use, including commercially.'
    ],
    asks: [],
    hosts: ['npmjs.com', 'nodejs.org']
  }
];
