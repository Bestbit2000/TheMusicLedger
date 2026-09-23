// ML-192: repeatable security review of solfascribe-omr (github.com/James-Aidoo/solfascribe-omr) -
// the third-party OMR service behind "Create from file" PDF import - shown in Admin -> Security.
// Full write-up: docs/omr-security-review.md.
//
// Two kinds of check, one page:
//   * AUTOMATED checks run here, from a Vercel function, when a super admin presses "Run now":
//     only what needs nothing but HTTP - GitHub/OSV lookups, rules over the upstream repo's
//     deployment files, a live probe of our deployed copy of the service, and self-tests of our
//     own import guards. Results go in security_review_runs/_results (049_security_reviews.sql).
//   * ASSISTED checks need local tools and judgement (a full code read, Gitleaks over the git
//     history, ESLint, OSV-Scanner, ...). Claude Code runs them in a session (see
//     .claude/skills/omr-security-review) and appends the run to
//     server/securityReviews/solfascribe-omr.js, which ships with the code - so every environment
//     shows the same deep-review history and nothing writes to production from a laptop.
// The repo isn't ours: nothing here ever writes to it, and the live probe only ever sends
// harmless requests to OUR deployment of it (AUDIVERIS_SERVICE_URL).

import { XMLParser } from 'fast-xml-parser';
import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';
import { isOwnBlobUrl, extractMusicXmlText, MAX_MUSICXML_BYTES } from './scoreImport.js';
import assistedHistory from '../securityReviews/solfascribe-omr.js';

export const TARGET = {
  key: 'solfascribe-omr',
  name: 'solfascribe-omr (OMR service)',
  repo: 'James-Aidoo/solfascribe-omr',
  branch: 'main',
  jiraKey: 'ML-192',
  gatedFeature: 'flow_import_from_file'
};

// The review plan's sections (ML-192's description), in display order.
export const SECTIONS = [
  { key: 'overview', title: 'Upstream changes' },
  { key: 'static', title: '1. Static analysis' },
  { key: 'dependencies', title: '2. Dependencies' },
  { key: 'manual', title: '3. Manual review' },
  { key: 'secrets', title: '4. Secrets' },
  { key: 'deployment', title: '5. Deployment hardening' },
  { key: 'auth', title: '6. Authentication and abuse' },
  { key: 'supply-chain', title: '7. Supply chain and CI' },
  { key: 'our-side', title: '8. Our side of the connection' }
];

// Every check the page knows about. `rerun` is what the page shows under "How to re-run" - for an
// assisted check, what to ask for / which command; for an automated one, what it looks at.
export const CHECKS = [
  { key: 'auto.upstream-changes', section: 'overview', mode: 'automated', title: 'Upstream repo changes since the last deep review',
    rerun: 'Run now. Compares the upstream default branch with the commit the latest deep review read (GitHub API).' },

  { key: 'manual-code-read', section: 'static', mode: 'assisted', title: 'Full read of every source file',
    rerun: 'Ask Claude Code: "re-run the ML-192 OMR security review". Reads src/*.ts line by line against the section 3 risks.' },
  { key: 'eslint-security', section: 'static', mode: 'assisted', title: 'ESLint + eslint-plugin-security',
    rerun: 'node scripts/omr-security-review.mjs (runs ESLint with eslint-plugin-security on a scratch clone).' },

  { key: 'auto.npm-dependencies', section: 'dependencies', mode: 'automated', title: 'Node dependencies vs OSV (lockfile)',
    rerun: 'Run now. Reads package-lock.json at the upstream head and queries api.osv.dev.' },
  { key: 'auto.java-dependencies', section: 'dependencies', mode: 'automated', title: 'Audiveris Java dependencies vs OSV',
    rerun: 'Run now. Reads the Audiveris version the Dockerfile builds, its app/build.gradle, and queries api.osv.dev (declared dependencies only).' },
  { key: 'npm-audit', section: 'dependencies', mode: 'assisted', title: 'npm audit + OSV-Scanner (lockfile)',
    rerun: 'node scripts/omr-security-review.mjs (npm audit --package-lock-only, osv-scanner scan source).' },
  { key: 'java-dependencies', section: 'dependencies', mode: 'assisted', title: 'Audiveris dependencies - reachability assessed',
    rerun: 'Deep review: for each advisory, decide whether batch-mode PDF/image input can reach it; accepted ones go in acceptedAdvisories.' },
  { key: 'image-os-packages', section: 'dependencies', mode: 'assisted', title: 'Built image OS packages (Trivy / OSV-Scanner on the image)',
    rerun: 'Needs Docker: docker build the upstream repo, then trivy image (or osv-scanner scan image). Not possible on the review machine without Docker.' },

  { key: 'command-injection', section: 'manual', mode: 'assisted', title: 'Command injection (spawn of Audiveris)', rerun: 'Deep review.' },
  { key: 'path-traversal', section: 'manual', mode: 'assisted', title: 'Path traversal / arbitrary file write', rerun: 'Deep review.' },
  { key: 'ssrf', section: 'manual', mode: 'assisted', title: 'Server-side request forgery', rerun: 'Deep review.' },
  { key: 'dos-limits', section: 'manual', mode: 'assisted', title: 'Resource exhaustion / file bombs', rerun: 'Deep review.' },
  { key: 'unsafe-deserialisation', section: 'manual', mode: 'assisted', title: 'Unsafe deserialisation (Java side)', rerun: 'Deep review.' },

  { key: 'secrets-history', section: 'secrets', mode: 'assisted', title: 'Gitleaks over the full git history and working tree',
    rerun: 'node scripts/omr-security-review.mjs (gitleaks git + gitleaks dir).' },
  { key: 'env-examples', section: 'secrets', mode: 'assisted', title: 'What the example env/config files expect', rerun: 'Deep review.' },

  { key: 'auto.container-hardening', section: 'deployment', mode: 'automated', title: 'Container hardening rules (Dockerfile + compose)',
    rerun: 'Run now. Rules over the upstream Dockerfile and deploy/oracle/docker-compose.yml.' },
  { key: 'container-hardening', section: 'deployment', mode: 'assisted', title: 'Deployment hardening - assessed', rerun: 'Deep review.' },

  { key: 'auto.service-auth-config', section: 'auth', mode: 'automated', title: 'Does the service or its proxy check callers?',
    rerun: 'Run now. Looks for an auth hook in src/server.ts and an auth directive in deploy/oracle/Caddyfile.' },
  { key: 'auto.live-probe', section: 'auth', mode: 'automated', title: 'Live probe of our deployment',
    rerun: 'Run now. Needs AUDIVERIS_SERVICE_URL. Sends a health check, one unauthenticated upload of a tiny invalid file (must be refused with 401/403), and a CORS check.' },
  { key: 'service-authentication', section: 'auth', mode: 'assisted', title: 'Authentication and abuse - assessed', rerun: 'Deep review.' },

  { key: 'auto.supply-chain-pinning', section: 'supply-chain', mode: 'automated', title: 'Image and dependency pinning rules',
    rerun: 'Run now. Rules over the upstream Dockerfile.' },
  { key: 'supply-chain', section: 'supply-chain', mode: 'assisted', title: 'Supply chain - assessed', rerun: 'Deep review.' },
  { key: 'ci-workflow', section: 'supply-chain', mode: 'assisted', title: 'GitHub Actions workflow', rerun: 'Deep review of .github/workflows/*.yml.' },

  { key: 'auto.our-guards', section: 'our-side', mode: 'automated', title: 'Our import guards (live self-test)',
    rerun: 'Run now. Exercises this deployment\'s own SSRF, size and zip-bomb guards and the XML parser\'s entity handling.' },
  { key: 'our-client', section: 'our-side', mode: 'assisted', title: 'Our client (scoreImport.js / from-file route) - assessed', rerun: 'Deep review.' },
  { key: 'third-party-instance', section: 'our-side', mode: 'assisted', title: 'Whose instance we call', rerun: 'Deep review.' },
  { key: 'agpl-licence', section: 'our-side', mode: 'assisted', title: 'Licences (MIT wrapper, AGPL-3.0 engine)', rerun: 'Deep review.' },
  { key: 'prior-review-notes', section: 'our-side', mode: 'assisted', title: 'Upstream\'s own "security review 2026-09-15" notes', rerun: 'Deep review.' }
];

const CHECK_KEYS = new Set(CHECKS.map((c) => c.key));
const STATUS_RANK = { fail: 5, error: 4, warn: 3, not_run: 2, info: 1, pass: 0 };
const worst = (statuses) => statuses.reduce((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a), 'pass');

// ---------------------------------------------------------------- HTTP helpers

const FETCH_TIMEOUT_MS = 10000;

function githubHeaders() {
  // Optional: raises GitHub's limit from 60/hour per IP (shared on Vercel) to 5000/hour. A
  // read-only, public-repos-only token is all it needs.
  const token = process.env.GITHUB_TOKEN;
  return { Accept: 'application/vnd.github+json', 'User-Agent': 'TheMusicLedger-security-review', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'User-Agent': 'TheMusicLedger-security-review' } });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status} for ${new URL(url).pathname}`);
  return res.text();
}

const rawUrl = (repo, ref, path) => `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;

// ---------------------------------------------------------------- assisted history (repo file)

export function assistedRuns() {
  return [...(assistedHistory.runs || [])].sort((a, b) => String(b.reviewedAt).localeCompare(String(a.reviewedAt)));
}

function acceptedAdvisoryIds() {
  const latest = assistedRuns()[0];
  return new Map((latest?.acceptedAdvisories || []).map((a) => [a.id, a]));
}

// ---------------------------------------------------------------- OSV

async function osvLookup(queries) {
  if (!queries.length) return [];
  const batch = await fetchJson('https://api.osv.dev/v1/querybatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries })
  });
  const ids = new Set();
  batch.results.forEach((r) => (r.vulns || []).forEach((v) => ids.add(v.id)));
  const details = new Map();
  await Promise.all([...ids].map(async (id) => {
    try {
      details.set(id, await fetchJson(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`));
    } catch {
      details.set(id, { id });
    }
  }));
  return batch.results.map((r, i) => ({
    query: queries[i],
    vulns: (r.vulns || []).map((v) => {
      const d = details.get(v.id) || {};
      return { id: v.id, aliases: d.aliases || [], summary: d.summary || '', severity: (d.database_specific?.severity || 'UNKNOWN').toUpperCase() };
    })
  }));
}

function describeVuln(pkg, version, v, accepted) {
  const alias = v.aliases.find((a) => a.startsWith('CVE-'));
  const base = `${pkg}@${version}: ${v.id}${alias ? ` (${alias})` : ''} ${v.severity.toLowerCase()} - ${v.summary || 'no summary'}`;
  return accepted ? `${base} [accepted: ${accepted.reason}]` : base;
}

// ---------------------------------------------------------------- pure rule helpers (exported for tests)

// package-lock.json v2/v3 -> [{ name, version, dev }]
export function lockfilePackages(lock) {
  const out = [];
  for (const [path, info] of Object.entries(lock.packages || {})) {
    if (!path || !info?.version) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    out.push({ name, version: info.version, dev: Boolean(info.dev || info.devOptional) });
  }
  return out;
}

// Audiveris app/build.gradle -> [{ name: 'group:artifact', version }], ${var} resolved from ext.
// A couple of transitive/repackaged coordinates are added where the declared one hides the real
// artifact OSV knows about.
const MAVEN_ALIASES = {
  'ch.qos.logback:logback-classic': ['ch.qos.logback:logback-core'],
  'org.apache.directory.studio:org.apache.commons.io': ['commons-io:commons-io']
};
export function gradleDependencies(gradle) {
  const ext = {};
  for (const m of gradle.matchAll(/ext\.(\w+)\s*=\s*['"]([^'"]+)['"]/g)) ext[m[1]] = m[2];
  const seen = new Map();
  for (const m of gradle.matchAll(/['"]([\w.-]+):([\w.-]+):([^'":\s]+)(?::[^'"]*)?['"]/g)) {
    const version = m[3].replace(/\$\{(\w+)\}/g, (_, v) => ext[v] ?? '');
    if (!version || version.includes('$') || version.includes('{')) continue;
    const name = `${m[1]}:${m[2]}`;
    if (name.startsWith('org.gradle') || name.startsWith('io.github.jwharm')) continue;
    seen.set(name, version);
    for (const alias of MAVEN_ALIASES[name] || []) seen.set(alias, version);
  }
  return [...seen].map(([name, version]) => ({ name, version }));
}

// Dockerfile + compose + Caddyfile -> rule results { rule, ok, severity, detail }
export function containerHardeningRules(dockerfile, compose) {
  const omrService = (compose.split(/\n\s{2}caddy:/)[0] || compose);
  const has = (re) => re.test(omrService);
  const lastUser = [...dockerfile.matchAll(/^\s*USER\s+(\S+)/gm)].pop()?.[1];
  return [
    { rule: 'Runs as a non-root user', ok: Boolean(lastUser && !/^(root|0)(:|$)/.test(lastUser)), severity: 'fail', detail: lastUser ? `USER ${lastUser}` : 'no USER instruction' },
    { rule: 'Memory limit set', ok: has(/mem_limit:|memory:/), severity: 'warn', detail: (omrService.match(/mem_limit:\s*\S+/) || ['none'])[0] },
    { rule: 'CPU limit set', ok: has(/cpus:|cpu_quota:/), severity: 'warn', detail: has(/cpus:/) ? 'set' : 'no cpus limit - a crafted score can pin every core' },
    { rule: 'All Linux capabilities dropped', ok: has(/cap_drop:[\s\S]*?-\s*ALL/i), severity: 'warn', detail: has(/cap_drop:/) ? 'cap_drop present' : 'no cap_drop' },
    { rule: 'no-new-privileges', ok: has(/no-new-privileges/), severity: 'warn', detail: has(/no-new-privileges/) ? 'set' : 'not set' },
    { rule: 'Read-only root filesystem', ok: has(/read_only:\s*true/), severity: 'warn', detail: has(/read_only:\s*true/) ? 'set' : 'not set (uploads could live on a tmpfs/volume instead)' },
    { rule: 'Process count limit', ok: has(/pids_limit:/), severity: 'warn', detail: has(/pids_limit:/) ? 'set' : 'no pids_limit' },
    { rule: 'Service port not published on the host', ok: !/\n\s{4}ports:/.test(omrService), severity: 'warn', detail: /\n\s{4}ports:/.test(omrService) ? 'omr publishes ports directly' : 'reachable only through the proxy' },
    { rule: 'No outbound network needed - egress restricted', ok: has(/internal:\s*true|network_mode:\s*none/), severity: 'warn', detail: has(/internal:\s*true/) ? 'internal network' : 'default bridge network - the engine can reach the internet' }
  ];
}

export function supplyChainRules(dockerfile) {
  const froms = [...dockerfile.matchAll(/^\s*FROM\s+(\S+)/gm)].map((m) => m[1]);
  const unpinned = froms.filter((f) => !f.includes('@sha256:'));
  const clone = dockerfile.match(/git clone[^\n]*/)?.[0] || '';
  return [
    { rule: 'Base images pinned by digest', ok: unpinned.length === 0, severity: 'warn', detail: unpinned.length ? `by tag only: ${unpinned.join(', ')}` : 'all pinned' },
    { rule: 'No curl | bash installs', ok: !/curl[^\n|]*\|\s*(ba)?sh/.test(dockerfile), severity: 'warn', detail: /curl[^\n|]*\|\s*(ba)?sh/.test(dockerfile) ? (dockerfile.match(/curl[^\n]*\|\s*(ba)?sh[^\n]*/)?.[0] || '').replace(/\s*\\$/, '').trim() : 'none' },
    { rule: 'Audiveris source pinned to a commit', ok: !clone || /[0-9a-f]{40}/.test(dockerfile), severity: 'warn', detail: clone ? `${clone.trim()} (a tag can be moved)` : 'no source clone' },
    { rule: 'npm install honours the lockfile', ok: /npm ci\b/.test(dockerfile), severity: 'warn', detail: /npm ci\b/.test(dockerfile) ? 'npm ci' : 'npm install without ci' },
    { rule: 'Dev dependencies left out of the image', ok: /--omit=dev|--production/.test(dockerfile), severity: 'warn', detail: /--omit=dev/.test(dockerfile) ? '--omit=dev' : 'dev dependencies installed' }
  ];
}

export function serviceAuthRules(serverTs, caddyfile) {
  const codeAuth = /addHook\(\s*['"](onRequest|preHandler)['"][\s\S]{0,600}?authori[sz]ation/i.test(serverTs) || /@fastify\/(auth|bearer-auth|basic-auth)/.test(serverTs);
  const proxyAuth = /\b(basic_?auth|forward_auth|jwt|@\w+\s+header\s+Authorization)\b/i.test(caddyfile) || /header\s+Authorization/i.test(caddyfile);
  return { codeAuth, proxyAuth };
}

const rulesToResult = (rules, passSummary) => {
  const failing = rules.filter((r) => !r.ok);
  return {
    status: failing.length ? worst(failing.map((r) => r.severity)) : 'pass',
    summary: failing.length ? `${failing.length} of ${rules.length} rules not met` : passSummary,
    details: rules.map((r) => `${r.ok ? 'OK' : r.severity === 'fail' ? 'FAIL' : 'WARN'} - ${r.rule}: ${r.detail}`)
  };
};

// ---------------------------------------------------------------- automated checks

async function checkUpstreamChanges(ctx) {
  const reviewed = assistedRuns()[0]?.upstreamCommitSha;
  if (!ctx.head) return { status: 'error', summary: 'Couldn\'t read the upstream head commit.', details: [ctx.headError || ''] };
  const details = [`Upstream head: ${ctx.head.slice(0, 12)} (${ctx.headDate || 'date unknown'})`];
  if (!reviewed) return { status: 'warn', summary: 'No deep review recorded yet.', details };
  details.push(`Last deep review read: ${reviewed.slice(0, 12)}`);
  if (reviewed === ctx.head) return { status: 'pass', summary: 'Unchanged since the last deep review.', details };
  const cmp = await fetchJson(`https://api.github.com/repos/${TARGET.repo}/compare/${reviewed}...${ctx.head}`, { headers: githubHeaders() });
  const files = (cmp.files || []).map((f) => `${f.status}: ${f.filename}`);
  const touchesCode = (cmp.files || []).some((f) => /^(src\/|Dockerfile|deploy\/|package(-lock)?\.json|\.github\/)/.test(f.filename));
  return {
    status: touchesCode ? 'fail' : 'warn',
    summary: `${cmp.ahead_by ?? '?'} new commit(s), ${files.length} file(s) changed since the last deep review${touchesCode ? ' - including code/deployment files: re-run the deep review before relying on it' : ''}.`,
    details: [...details, ...files.slice(0, 40), ...(files.length > 40 ? [`... and ${files.length - 40} more`] : [])]
  };
}

async function checkNpmDependencies(ctx) {
  const lock = JSON.parse(await fetchText(rawUrl(TARGET.repo, ctx.ref, 'package-lock.json')));
  const pkgs = lockfilePackages(lock);
  const results = await osvLookup(pkgs.map((p) => ({ package: { ecosystem: 'npm', name: p.name }, version: p.version })));
  const accepted = acceptedAdvisoryIds();
  const prod = [];
  const dev = [];
  results.forEach((r, i) => r.vulns.forEach((v) => (pkgs[i].dev ? dev : prod).push({ pkg: pkgs[i], v })));
  const unacceptedProd = prod.filter(({ v }) => !accepted.has(v.id));
  const severe = unacceptedProd.some(({ v }) => ['CRITICAL', 'HIGH'].includes(v.severity));
  const line = ({ pkg, v }) => describeVuln(pkg.name, pkg.version, v, accepted.get(v.id));
  return {
    status: unacceptedProd.length ? (severe ? 'fail' : 'warn') : 'pass',
    summary: `${pkgs.length} packages checked: ${prod.length} advisor${prod.length === 1 ? 'y' : 'ies'} in shipped packages (${unacceptedProd.length} not yet accepted), ${dev.length} in dev/test-only packages (not in the image).`,
    details: [...prod.map(line), ...dev.map((d) => `dev only - ${line(d)}`)]
  };
}

async function checkJavaDependencies(ctx) {
  const version = ctx.dockerfile.match(/ARG\s+AUDIVERIS_VERSION=(\S+)/)?.[1];
  if (!version) return { status: 'error', summary: 'Couldn\'t find ARG AUDIVERIS_VERSION in the Dockerfile.', details: [] };
  const deps = gradleDependencies(await fetchText(rawUrl('Audiveris/audiveris', version, 'app/build.gradle')));
  const results = await osvLookup(deps.map((d) => ({ package: { ecosystem: 'Maven', name: d.name }, version: d.version })));
  const accepted = acceptedAdvisoryIds();
  const found = [];
  results.forEach((r, i) => r.vulns.forEach((v) => found.push({ dep: deps[i], v })));
  const unaccepted = found.filter(({ v }) => !accepted.has(v.id));
  return {
    status: unaccepted.length ? 'warn' : 'pass',
    summary: `Audiveris ${version}: ${deps.length} declared dependencies checked, ${found.length} advisor${found.length === 1 ? 'y' : 'ies'} (${unaccepted.length} not yet assessed). Transitive dependencies aren't covered here.`,
    details: found.map(({ dep, v }) => describeVuln(dep.name, dep.version, v, accepted.get(v.id)))
  };
}

async function checkContainerHardening(ctx) {
  return rulesToResult(containerHardeningRules(ctx.dockerfile, ctx.compose), 'All container hardening rules met.');
}

async function checkSupplyChain(ctx) {
  return rulesToResult(supplyChainRules(ctx.dockerfile), 'All pinning rules met.');
}

async function checkServiceAuthConfig(ctx) {
  const { codeAuth, proxyAuth } = serviceAuthRules(ctx.serverTs, ctx.caddyfile);
  const details = [
    `src/server.ts: ${codeAuth ? 'has an auth hook' : 'no auth hook - every route is open to anyone who can reach it'}`,
    `deploy/oracle/Caddyfile: ${proxyAuth ? 'checks callers' : 'plain reverse_proxy, no auth'}`,
    'Our deployment must add its own check (e.g. a Caddy bearer-token match) - see docs/omr-security-review.md. The live probe verifies it.'
  ];
  return codeAuth || proxyAuth
    ? { status: 'pass', summary: 'Upstream checks callers.', details }
    : { status: 'fail', summary: 'Upstream has no authentication - our deployment has to add it.', details };
}

async function checkLiveProbe() {
  const baseUrl = process.env.AUDIVERIS_SERVICE_URL;
  if (!baseUrl) {
    return { status: 'not_run', summary: 'AUDIVERIS_SERVICE_URL isn\'t set in this environment - nothing deployed to probe.', details: ['Starts working automatically once the service is deployed and the variable is set.'] };
  }
  const details = [];
  const statuses = [];
  const health = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch((e) => ({ ok: false, status: e.name }));
  details.push(`GET /healthz -> ${health.status}`);
  statuses.push(health.ok ? 'pass' : 'warn');

  // No Authorization header, and a file the service refuses on sight (a .txt) - so even an open
  // service does no work and keeps nothing.
  const form = new FormData();
  form.append('file', new Blob(['security probe'], { type: 'text/plain' }), 'probe.txt');
  const probe = await fetch(`${baseUrl}/jobs`, { method: 'POST', body: form, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch((e) => ({ status: e.name }));
  if (probe.status === 401 || probe.status === 403) {
    details.push(`POST /jobs without a token -> ${probe.status} (refused before the service looked at the file)`);
    statuses.push('pass');
  } else {
    details.push(`POST /jobs without a token -> ${probe.status} - the request reached the service: anyone can submit jobs`);
    statuses.push('fail');
    if (probe.status === 202) {
      const body = await probe.json().catch(() => ({}));
      if (body.jobId) await fetch(`${baseUrl}/jobs/${encodeURIComponent(body.jobId)}`, { method: 'DELETE', headers: tokenHeader() }).catch(() => {});
    }
  }

  const cors = await fetch(`${baseUrl}/healthz`, { headers: { Origin: 'https://security-probe.invalid' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => null);
  const allowOrigin = cors?.headers?.get('access-control-allow-origin');
  details.push(`CORS for an unknown origin -> ${allowOrigin ? `Access-Control-Allow-Origin: ${allowOrigin}` : 'not allowed'}`);
  statuses.push(allowOrigin === '*' || allowOrigin === 'https://security-probe.invalid' ? 'warn' : 'pass');

  const status = worst(statuses);
  return { status, summary: status === 'pass' ? 'Deployment refuses unauthenticated callers.' : status === 'fail' ? 'Deployment accepts unauthenticated requests.' : 'Deployment reachable, with warnings.', details };
}

function tokenHeader() {
  return process.env.AUDIVERIS_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.AUDIVERIS_SERVICE_TOKEN}` } : {};
}

// Same options as flowMusicXmlReader.js's parser - if those change, change these.
const READER_PARSER_OPTIONS = { ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true, trimValues: true, parseTagValue: false, parseAttributeValue: false };

async function checkOurGuards() {
  const results = [];
  const attempt = async (label, fn) => {
    try {
      results.push({ label, ok: Boolean(await fn()) });
    } catch (e) {
      results.push({ label, ok: false, note: e.message });
    }
  };
  const store = 'https://abc.public.blob.vercel-storage.com';
  await attempt('Blob URL guard accepts our own store', () => isOwnBlobUrl(`${store}/flows/from-file/a.pdf`, 'flows/from-file/a.pdf'));
  for (const url of ['http://169.254.169.254/latest/meta-data/', 'http://localhost:3000/', 'https://evil.example/flows/from-file/a.pdf', 'https://public.blob.vercel-storage.com.evil.example/flows/from-file/a.pdf']) {
    await attempt(`Blob URL guard refuses ${url}`, () => !isOwnBlobUrl(url, 'flows/from-file/a.pdf'));
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('score.musicxml', 'a'.repeat(MAX_MUSICXML_BYTES + 1024));
  const bomb = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const refused = async (buffer) => {
    try {
      await extractMusicXmlText(buffer);
      return false;
    } catch (e) {
      return e.status === 413;
    }
  };
  await attempt('.mxl zip bomb refused', () => refused(bomb));
  await attempt('.mxl zip bomb with a forged small size header refused', () => {
    const forged = Buffer.from(bomb);
    // Local header (uncompressed size at +22) and central directory entry (+24) claim 100 bytes.
    for (const [signature, offset] of [[0x04034b50, 22], [0x02014b50, 24]]) {
      for (let i = 0; i + 4 <= forged.length; i++) {
        if (forged.readUInt32LE(i) === signature) { forged.writeUInt32LE(100, i + offset); break; }
      }
    }
    return refused(forged);
  });
  await attempt('XML parser does not expand an entity bomb', () => {
    const doc = '<?xml version="1.0"?><!DOCTYPE l [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">]><x>&c;&c;&c;</x>';
    let out;
    try {
      out = JSON.stringify(new XMLParser(READER_PARSER_OPTIONS).parse(doc));
    } catch {
      return true; // refusing it outright is fine too
    }
    return out.length < 1000;
  });
  await attempt('XML parser refuses external entities', () => {
    try {
      new XMLParser(READER_PARSER_OPTIONS).parse('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>');
      return false;
    } catch {
      return true;
    }
  });
  const failed = results.filter((r) => !r.ok);
  return {
    status: failed.length ? 'fail' : 'pass',
    summary: failed.length ? `${failed.length} of ${results.length} guard self-tests failed.` : `All ${results.length} guard self-tests passed.`,
    details: results.map((r) => `${r.ok ? 'OK' : 'FAIL'} - ${r.label}${r.note ? ` (${r.note})` : ''}`)
  };
}

const AUTOMATED = {
  'auto.upstream-changes': checkUpstreamChanges,
  'auto.npm-dependencies': checkNpmDependencies,
  'auto.java-dependencies': checkJavaDependencies,
  'auto.container-hardening': checkContainerHardening,
  'auto.supply-chain-pinning': checkSupplyChain,
  'auto.service-auth-config': checkServiceAuthConfig,
  'auto.live-probe': checkLiveProbe,
  'auto.our-guards': checkOurGuards
};

// Fetches the upstream files every rule needs once, up front. A file that can't be read turns the
// checks needing it into 'error' rather than aborting the run.
async function loadContext() {
  const ctx = { ref: TARGET.branch };
  try {
    const commit = await fetchJson(`https://api.github.com/repos/${TARGET.repo}/commits/${TARGET.branch}`, { headers: githubHeaders() });
    ctx.head = commit.sha;
    ctx.headDate = commit.commit?.committer?.date;
    ctx.ref = commit.sha; // read every file at exactly this commit
  } catch (e) {
    ctx.headError = e.message;
  }
  const files = { dockerfile: 'Dockerfile', compose: 'deploy/oracle/docker-compose.yml', caddyfile: 'deploy/oracle/Caddyfile', serverTs: 'src/server.ts' };
  await Promise.all(Object.entries(files).map(async ([k, path]) => {
    try {
      ctx[k] = await fetchText(rawUrl(TARGET.repo, ctx.ref, path));
    } catch (e) {
      ctx[`${k}Error`] = e.message;
    }
  }));
  return ctx;
}

const NEEDS = {
  'auto.java-dependencies': ['dockerfile'],
  'auto.container-hardening': ['dockerfile', 'compose'],
  'auto.supply-chain-pinning': ['dockerfile'],
  'auto.service-auth-config': ['serverTs', 'caddyfile']
};

export async function runAutomatedChecks(accountId) {
  const ctx = await loadContext();
  const results = await Promise.all(Object.entries(AUTOMATED).map(async ([key, fn]) => {
    const missing = (NEEDS[key] || []).filter((k) => ctx[k] === undefined);
    if (missing.length) return { key, status: 'error', summary: 'Couldn\'t read the upstream files this check needs.', details: missing.map((k) => ctx[`${k}Error`] || k) };
    try {
      return { key, ...(await fn(ctx)) };
    } catch (e) {
      return { key, status: 'error', summary: 'The check itself failed to run.', details: [e.message] };
    }
  }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [run] } = await client.query(
      `INSERT INTO security_review_runs (target_key, kind, triggered_by_account_id, upstream_commit_sha)
       VALUES ($1, 'automated', $2, $3) RETURNING id`,
      [TARGET.key, accountId || null, ctx.head || null]
    );
    for (const r of results) {
      await client.query(
        `INSERT INTO security_review_results (run_id, check_key, status, summary, details) VALUES ($1, $2, $3, $4, $5)`,
        [run.id, r.key, r.status, r.summary, JSON.stringify((r.details || []).map(String))]
      );
    }
    await client.query('UPDATE security_review_runs SET completed_at = now() WHERE id = $1', [run.id]);
    await client.query('COMMIT');
    return Number(run.id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- the page's data

const AUTOMATED_DUE_AFTER_DAYS = 30;

export async function getSecurityReview() {
  const { rows: runRows } = await pool.query(
    `SELECT r.id, r.upstream_commit_sha, r.started_at, r.completed_at, a.email AS triggered_by
     FROM security_review_runs r LEFT JOIN accounts a ON a.id = r.triggered_by_account_id
     WHERE r.target_key = $1 ORDER BY r.started_at DESC LIMIT 50`,
    [TARGET.key]
  );
  const runIds = runRows.map((r) => r.id);
  const { rows: resultRows } = runIds.length
    ? await pool.query('SELECT run_id, check_key, status, summary, details FROM security_review_results WHERE run_id = ANY($1)', [runIds])
    : { rows: [] };

  const automatedRuns = runRows.map((r) => ({
    id: `auto-${r.id}`,
    kind: 'automated',
    at: r.started_at,
    by: r.triggered_by || null,
    upstreamCommitSha: r.upstream_commit_sha,
    results: resultRows.filter((x) => x.run_id === r.id).map((x) => ({ checkKey: x.check_key, status: x.status, summary: x.summary, details: x.details || [] }))
  }));
  const deepRuns = assistedRuns().map((r) => ({
    id: `deep-${r.id}`,
    kind: 'assisted',
    at: r.reviewedAt,
    by: r.reviewer,
    upstreamCommitSha: r.upstreamCommitSha,
    verdict: r.verdict,
    tools: r.tools || [],
    results: (r.results || []).filter((x) => CHECK_KEYS.has(x.checkKey))
  }));

  // Latest result per check, whichever kind of run it came from.
  const latest = {};
  for (const run of [...automatedRuns, ...deepRuns].sort((a, b) => new Date(b.at) - new Date(a.at))) {
    for (const res of run.results) {
      if (!latest[res.checkKey]) latest[res.checkKey] = { ...res, runId: run.id, at: run.at, upstreamCommitSha: run.upstreamCommitSha };
    }
  }

  const lastDeep = deepRuns[0] || null;
  const lastAuto = automatedRuns[0] || null;
  const currentHead = lastAuto?.upstreamCommitSha || null;
  const daysSinceAuto = lastAuto ? (Date.now() - new Date(lastAuto.at)) / 86400000 : null;
  return {
    target: TARGET,
    sections: SECTIONS,
    checks: CHECKS,
    latest,
    verdict: lastDeep?.verdict || null,
    lastDeepReview: lastDeep ? { at: lastDeep.at, by: lastDeep.by, upstreamCommitSha: lastDeep.upstreamCommitSha, tools: lastDeep.tools } : null,
    lastAutomatedRun: lastAuto ? { at: lastAuto.at, by: lastAuto.by, upstreamCommitSha: lastAuto.upstreamCommitSha } : null,
    upstreamChangedSinceDeepReview: Boolean(lastDeep && currentHead && currentHead !== lastDeep.upstreamCommitSha),
    automatedRunDue: daysSinceAuto === null || daysSinceAuto > AUTOMATED_DUE_AFTER_DAYS,
    automatedDueAfterDays: AUTOMATED_DUE_AFTER_DAYS,
    history: [...automatedRuns, ...deepRuns]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .map((r) => ({ ...r, counts: r.results.reduce((acc, x) => ({ ...acc, [x.status]: (acc[x.status] || 0) + 1 }), {}) }))
  };
}

// Serialises "Run now" per instance - two presses in a row shouldn't double the GitHub/OSV calls.
let running = null;
export async function runSecurityReviewNow(accountId) {
  if (running) throw withStatus(409, 'A run is already in progress - wait for it to finish.');
  running = runAutomatedChecks(accountId);
  try {
    return await running;
  } finally {
    running = null;
  }
}
