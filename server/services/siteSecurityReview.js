// ML-231: a repeatable security review of this site itself, shown on Admin -> Security beside the
// OMR service's review (ML-192) and built on the same pieces (securityReview.js): a list of checks in
// sections, automated ones re-run by "Run now" and kept in the database, and deep ones done by Claude
// Code in a session and recorded in server/securityReviews/site.js. Full write-up:
// docs/site-security-review.md.
//
// The automated checks only read: they look at the live site's own answers (its headers, and what it
// says to someone who isn't signed in), at this deployment's settings and installed packages, and at
// the route files for a route that has lost its guard. They change nothing and send nothing harmful.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';
import { buildReview, saveRun, osvLookup } from './securityReview.js';
import { currentAppVersion } from './flowAuthoringStats.js';
import { headerFindings } from '../middleware/securityHeaders.js';
import { mailIsReal } from './mail.js';
import assistedHistory from '../securityReviews/site.js';

export const TARGET = {
  key: 'site',
  name: 'The Music Ledger (this site)',
  repo: 'Bestbit2000/TheMusicLedger',
  branch: 'main',
  jiraKey: 'ML-231',
  changeLabel: 'Releases since the deep review'
};

export const SECTIONS = [
  { key: 'access', title: '1. Who can reach what' },
  { key: 'input', title: '2. What members can type or upload' },
  { key: 'signin', title: '3. Signing in and staying signed in' },
  { key: 'browser', title: '4. The browser\'s own protections' },
  { key: 'supply', title: '5. Packages and secrets' },
  { key: 'running', title: '6. How it is run' }
];

const DEEP = 'Ask Claude Code: "re-run the ML-231 site security review" (docs/site-security-review.md says how).';
export const CHECKS = [
  { key: 'auto.route-guards', section: 'access', mode: 'automated', title: 'Every route still has its guard',
    rerun: 'Run now. Reads the route files: every admin route needs requireSuperAdmin, and every app route needs a signed-in account unless it is on the short list of deliberate exceptions.' },
  { key: 'auto.signed-out-probe', section: 'access', mode: 'automated', title: 'What the live site says to someone not signed in',
    rerun: 'Run now. Asks this site for a member\'s data, an admin page\'s data and the daily job with no sign-in and with a made-up one; each must be refused. Also checks the test logins are shut.' },
  { key: 'object-access', section: 'access', mode: 'assisted', title: 'Can a member reach another member\'s things? (every route that takes an id)', rerun: DEEP },
  { key: 'shared-data', section: 'access', mode: 'assisted', title: 'Things that are shared by design: bands, teachers, organisations', rerun: DEEP },

  { key: 'cross-site-scripting', section: 'input', mode: 'assisted', title: 'Member-typed text put on the page (cross-site scripting)', rerun: DEEP },
  { key: 'sql-injection', section: 'input', mode: 'assisted', title: 'Database queries built from request input', rerun: DEEP },
  { key: 'server-side-fetch', section: 'input', mode: 'assisted', title: 'Addresses the server fetches for a member', rerun: DEEP },
  { key: 'file-uploads', section: 'input', mode: 'assisted', title: 'Uploaded files: where they may come from, how big, who can delete them', rerun: DEEP },

  { key: 'auto.admin-sign-in', section: 'signin', mode: 'automated', title: 'Administrators\' sign-in',
    rerun: 'Run now. Counts super admin accounts and checks that any with a password also has two-step sign-in.' },
  { key: 'sessions-and-tokens', section: 'signin', mode: 'assisted', title: 'The sign-in token: where it is kept, how long it lasts, what is in it', rerun: DEEP },
  { key: 'test-logins', section: 'signin', mode: 'assisted', title: 'The local and test logins can\'t be used on the live site', rerun: DEEP },
  { key: 'rate-limits', section: 'signin', mode: 'assisted', title: 'Limits on repeated tries', rerun: DEEP },

  { key: 'auto.security-headers', section: 'browser', mode: 'automated', title: 'Security headers on the live site',
    rerun: 'Run now. Fetches this site\'s front page and checks its headers (server/middleware/securityHeaders.js).' },
  { key: 'device-storage', section: 'browser', mode: 'assisted', title: 'What is left on a member\'s device', rerun: DEEP },

  { key: 'auto.dependencies', section: 'supply', mode: 'automated', title: 'Installed packages against known advisories (OSV)',
    rerun: 'Run now. Reads the version of every package the app depends on directly, as installed in this deployment, and asks api.osv.dev about each.' },
  { key: 'dependency-audit', section: 'supply', mode: 'assisted', title: 'npm audit of everything installed, and whether builds are repeatable', rerun: `${DEEP} Runs npm audit --omit=dev in the root and in server/.` },
  { key: 'secrets-in-repo', section: 'supply', mode: 'assisted', title: 'No secret in the code or its history', rerun: DEEP },

  { key: 'auto.settings', section: 'running', mode: 'automated', title: 'This deployment\'s settings',
    rerun: 'Run now. Checks the secrets are set and long enough, the test logins are off, and the app knows its own address - without showing any value.' },
  { key: 'error-messages', section: 'running', mode: 'assisted', title: 'What an error tells the outside world', rerun: DEEP }
];

const worst = (levels) => (levels.includes('fail') ? 'fail' : levels.includes('warn') ? 'warn' : 'pass');
const TIMEOUT_MS = 10000;

// ---------------------------------------------------------------- route guards (pure - tested)

// Routes that are meant to work without a signed-in account, and why.
export const OPEN_ROUTES = {
  'GET /cron/usage-readings': 'the daily job - checks CRON_SECRET itself',
  'GET /instruments': 'the shared list of instruments - needs a sign-in, not an account'
};
// Routes that take their sign-in from the address as well as the header (the upload client can't set a header).
const QUERY_AUTH = 'requireAuthFromQueryOrHeader';

// Every route in a routes file: { method, path, guards } - the names in its middleware chain.
// The call's arguments are read properly (brackets and strings followed to the call's own closing
// bracket), so a handler wrapped in a helper - restRoute(req => ...) - is still one argument: the last.
export function routesIn(source) {
  const out = [];
  const re = /router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2\s*,/g;
  let m;
  while ((m = re.exec(source))) {
    const args = [];
    let depth = 0; let current = ''; let quote = null;
    for (let i = re.lastIndex; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) { current += ch; if (ch === '\\') { current += source[i += 1] || ''; } else if (ch === quote) quote = null; continue; }
      if (ch === '\'' || ch === '"' || ch === '`') { quote = ch; current += ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth += 1;
      if (ch === ')' || ch === ']' || ch === '}') { if (depth === 0) break; depth -= 1; }
      if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    if (current.trim()) args.push(current.trim());
    // everything before the last argument (the handler) is the chain of guards
    out.push({ method: m[1].toUpperCase(), path: m[3], guards: args.slice(0, -1) });
  }
  return out;
}
// What is wrong with a routes file. kind: 'admin' (every route needs requireSuperAdmin) or 'app'.
export function routeGuardFindings(source, kind) {
  const routes = routesIn(source);
  const problems = [];
  for (const r of routes) {
    const has = (g) => r.guards.includes(g);
    const name = `${r.method} ${r.path}`;
    if (kind === 'admin') {
      if (!(has('requireAuth') && has('resolveAccount') && has('requireSuperAdmin'))) problems.push(`${name} is not limited to super admins`);
    } else if (!OPEN_ROUTES[name]) {
      const signedIn = has('requireAuth') || has(QUERY_AUTH);
      if (!signedIn) problems.push(`${name} does not need a sign-in`);
      else if (!has('resolveAccount') && !has(QUERY_AUTH)) problems.push(`${name} does not work out whose account it is`);
    }
  }
  return { count: routes.length, problems };
}

// ---------------------------------------------------------------- the automated checks

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

async function checkRouteGuards() {
  const admin = routeGuardFindings(read('../routes/admin.js'), 'admin');
  const app = routeGuardFindings(read('../routes/api.js'), 'app');
  const problems = [...admin.problems.map((p) => `Admin: ${p}`), ...app.problems.map((p) => `App: ${p}`)];
  if (admin.count < 50 || app.count < 100) return { status: 'error', summary: 'The route files could not be read properly, so this check proves nothing.', details: [`${admin.count} admin routes and ${app.count} app routes found - far fewer than there are.`] };
  return {
    status: problems.length ? 'fail' : 'pass',
    summary: problems.length ? `${problems.length} route${problems.length === 1 ? ' has' : 's have'} lost a guard.` : `All ${admin.count} admin routes are limited to super admins, and all ${app.count} app routes need a signed-in account.`,
    details: problems.length ? problems : Object.entries(OPEN_ROUTES).map(([r, why]) => `Deliberately open: ${r} - ${why}`)
  };
}

async function ask(origin, path, options = {}) {
  const res = await fetch(`${origin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), ...options });
  return { status: res.status, location: res.headers.get('location') || '', headers: Object.fromEntries(res.headers.entries()) };
}

async function checkSignedOutProbe({ origin }) {
  const wrong = { Authorization: 'Bearer not.a.real.token' };
  const tries = [
    ['A member\'s account, not signed in', '/api/account', {}, (r) => r.status === 401],
    ['A member\'s pieces, not signed in', '/api/flows', {}, (r) => r.status === 401],
    ['A member\'s account, with a made-up sign-in', '/api/account', { headers: wrong }, (r) => r.status === 401],
    ['The accounts list (admin), not signed in', '/api/admin/accounts', {}, (r) => r.status === 401],
    ['The accounts list (admin), with a made-up sign-in', '/api/admin/accounts', { headers: wrong }, (r) => r.status === 401],
    ['The daily job, with no secret', '/api/cron/usage-readings', {}, (r) => r.status === 401],
    ['The test login', '/auth/test-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'guess' }) }, (r) => r.status === 404],
    ['The local "sign in as admin" shortcut', '/auth/login?as=admin', {}, (r) => r.status >= 300 && r.status < 400 && /accounts\.google\.com/.test(r.location)]
  ];
  const details = [];
  const bad = [];
  for (const [what, path, options, fine] of tries) {
    try {
      const r = await ask(origin, path, options);
      const ok = fine(r);
      details.push(`${ok ? 'Refused' : 'NOT REFUSED'}: ${what} (${path} answered ${r.status})`);
      if (!ok) bad.push(what);
    } catch (e) {
      details.push(`Could not ask: ${what} (${e.message})`);
      bad.push(what);
    }
  }
  // On a local or test server the shortcut logins are meant to work; only the live site must refuse them.
  const live = process.env.VERCEL_ENV === 'production';
  const serious = live ? bad : bad.filter((b) => !/test login|shortcut/.test(b));
  return {
    status: serious.length ? 'fail' : bad.length ? 'info' : 'pass',
    summary: serious.length ? `${serious.length} thing${serious.length === 1 ? '' : 's'} that should be refused got an answer.`
      : bad.length ? 'Members\' and admin data are refused. The test logins answer here, which is expected: this is not the live site.'
        : 'Everything that should be refused was refused.',
    details
  };
}

async function checkSecurityHeaders({ origin }) {
  const r = await ask(origin, '/');
  const findings = headerFindings(r.headers);
  // Vercel adds Strict-Transport-Security on the live site; a local server has none, and that is fine
  const relevant = findings.filter((f) => origin.startsWith('https://') || !/strict-transport-security/.test(f.text));
  const missing = relevant.filter((f) => !f.ok);
  return {
    status: worst(missing.map((f) => f.level)),
    summary: missing.length ? `${missing.length} header${missing.length === 1 ? '' : 's'} missing or weak.` : 'Every security header is set.',
    details: relevant.map((f) => `${f.ok ? 'OK' : f.level === 'fail' ? 'MISSING' : 'To improve'} - ${f.text}`)
  };
}

function installed() {
  const require = createRequire(import.meta.url);
  const out = new Map();
  for (const file of ['../package.json', '../../package.json']) {
    let pkg;
    try { pkg = JSON.parse(read(file)); } catch { continue; }
    for (const name of Object.keys(pkg.dependencies || {})) {
      if (out.has(name)) continue;
      try {
        let dir = require.resolve(name);
        // walk up from the entry file to the package's own folder
        while (dir && !fs.existsSync(`${dir}/package.json`)) dir = dir.replace(/[\\/][^\\/]+$/, '');
        let json = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8'));
        while (json.name !== name && /[\\/]/.test(dir)) { dir = dir.replace(/[\\/][^\\/]+$/, ''); if (fs.existsSync(`${dir}/package.json`)) json = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8')); }
        if (json.name === name) out.set(name, json.version);
      } catch { out.set(name, null); }
    }
  }
  return out;
}

async function checkDependencies() {
  const versions = installed();
  const known = [...versions].filter(([, v]) => v);
  const unknown = [...versions].filter(([, v]) => !v).map(([n]) => n);
  if (!known.length) return { status: 'error', summary: 'The installed packages could not be read.', details: unknown };
  const accepted = new Map((assistedRuns()[0]?.acceptedAdvisories || []).map((a) => [a.id, a]));
  const answers = await osvLookup(known.map(([name, version]) => ({ package: { name, ecosystem: 'npm' }, version })));
  const open = [];
  const noted = [];
  answers.forEach((a) => a.vulns.forEach((v) => {
    const line = `${a.query.package.name}@${a.query.version}: ${v.id}${v.summary ? ` - ${v.summary}` : ''} (${v.severity})`;
    const ok = accepted.get(v.id) || v.aliases.map((x) => accepted.get(x)).find(Boolean);
    if (ok) noted.push(`${line} - accepted: ${ok.reason}`); else open.push(line);
  }));
  return {
    status: open.length ? 'fail' : 'pass',
    summary: open.length ? `${open.length} advisor${open.length === 1 ? 'y' : 'ies'} against a package the app depends on directly.` : `No open advisories against the ${known.length} packages the app depends on directly.`,
    details: [...open, ...noted, 'Packages those packages bring in are covered by the deep review\'s npm audit, not by this check.', ...(unknown.length ? [`Could not read: ${unknown.join(', ')}`] : [])]
  };
}

async function checkSettings({ origin }) {
  const live = process.env.VERCEL_ENV === 'production';
  const out = [];
  const say = (ok, level, text) => out.push({ ok, level, text });
  const long = (name, min) => (process.env[name] || '').length >= min;
  say(long('SESSION_SECRET', 32), 'fail', `SESSION_SECRET (signs every sign-in): ${process.env.SESSION_SECRET ? (long('SESSION_SECRET', 32) ? 'set and long enough' : 'set, but shorter than 32 characters') : 'not set'}`);
  say(!process.env.CRON_SECRET || long('CRON_SECRET', 24), 'warn', `CRON_SECRET (the daily job, which can delete unused accounts): ${process.env.CRON_SECRET ? (long('CRON_SECRET', 24) ? 'set and long enough' : 'set, but shorter than 24 characters') : 'not set - the daily job is off'}`);
  if (live) {
    say(process.env.NODE_ENV === 'production', 'fail', `NODE_ENV on the live site: ${process.env.NODE_ENV || 'not set'}`);
    say(process.env.ALLOW_LOCAL_DEV_LOGIN !== 'true', 'fail', `The local "sign in as" shortcut: ${process.env.ALLOW_LOCAL_DEV_LOGIN === 'true' ? 'SWITCHED ON' : 'off'}`);
    say(!process.env.TEST_LOGIN_SECRET, 'warn', `TEST_LOGIN_SECRET: ${process.env.TEST_LOGIN_SECRET ? 'set - not needed on the live site (the test login refuses there anyway)' : 'not set'}`);
    say(/^https:\/\//.test(process.env.APP_URL || ''), mailIsReal() ? 'fail' : 'warn', `APP_URL (the address put in emails): ${process.env.APP_URL ? (/^https:\/\//.test(process.env.APP_URL) ? 'set, https' : 'set, but not https') : 'not set'}`);
  } else {
    say(true, 'warn', `This is not the live site (${origin}), so the live-only settings were not checked.`);
  }
  say(process.env.CSP_ENFORCE === 'true', 'warn', `Content security policy: ${process.env.CSP_ENFORCE === 'true' ? 'enforced' : 'report-only (CSP_ENFORCE is not "true")'}`);
  const bad = out.filter((f) => !f.ok);
  return {
    status: worst(bad.map((f) => f.level)),
    summary: bad.length ? `${bad.length} setting${bad.length === 1 ? '' : 's'} to look at.` : 'Settings are in order.',
    details: out.map((f) => `${f.ok ? 'OK' : f.level === 'fail' ? 'WRONG' : 'To improve'} - ${f.text}`)
  };
}

async function checkAdminSignIn() {
  const { rows } = await pool.query(
    `SELECT a.id, (p.account_id IS NOT NULL) AS has_password, (t.enabled_at IS NOT NULL) AS two_step
       FROM accounts a LEFT JOIN account_passwords p ON p.account_id = a.id LEFT JOIN account_two_step t ON t.account_id = a.id
      WHERE a.account_level = 'super_admin' AND a.deleted_at IS NULL`);
  const exposed = rows.filter((r) => r.has_password && !r.two_step).length;
  return {
    status: exposed ? 'fail' : rows.length > 3 ? 'warn' : 'pass',
    summary: exposed ? `${exposed} super admin account${exposed === 1 ? ' has' : 's have'} a password but no two-step sign-in.` : `${rows.length} super admin account${rows.length === 1 ? '' : 's'}; none can sign in with a password alone.`,
    details: [`${rows.filter((r) => r.has_password).length} with a password (all need two-step); ${rows.filter((r) => !r.has_password).length} sign in through Google only.`,
      ...(rows.length > 3 ? ['More than three super admins: check each one is still needed (Admin → Accounts).'] : [])]
  };
}

const AUTOMATED = {
  'auto.route-guards': checkRouteGuards,
  'auto.signed-out-probe': checkSignedOutProbe,
  'auto.security-headers': checkSecurityHeaders,
  'auto.dependencies': checkDependencies,
  'auto.settings': checkSettings,
  'auto.admin-sign-in': checkAdminSignIn
};

// ---------------------------------------------------------------- the page's data, and a run

export function assistedRuns() {
  return [...(assistedHistory.runs || [])].sort((a, b) => String(b.reviewedAt).localeCompare(String(a.reviewedAt)));
}

const DUE_AFTER_DAYS = 30; // ML-231: monthly

export async function getSiteSecurityReview() {
  const review = await buildReview({ target: TARGET, sections: SECTIONS, checks: CHECKS, assisted: assistedRuns(), dueAfterDays: DUE_AFTER_DAYS });
  // "changed since the deep review" for the site means a release has gone out since
  const version = currentAppVersion();
  const last = assistedRuns()[0];
  return { ...review, appVersion: version, upstreamChangedSinceDeepReview: !!(last && version && last.upstreamCommitSha !== version) };
}

let running = null;
export async function runSiteSecurityReviewNow(accountId, origin) {
  if (running) throw withStatus(409, 'A run is already in progress - wait for it to finish.');
  running = (async () => {
    const ctx = { origin: String(origin || '').replace(/\/+$/, '') };
    const results = await Promise.all(Object.entries(AUTOMATED).map(async ([key, fn]) => {
      try { return { key, ...(await fn(ctx)) }; } catch (e) { return { key, status: 'error', summary: 'The check itself failed to run.', details: [e.message] }; }
    }));
    return saveRun(TARGET.key, accountId, currentAppVersion(), results);
  })();
  try { return await running; } finally { running = null; }
}
