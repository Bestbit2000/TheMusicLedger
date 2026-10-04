// ML-267: the legal check on release - is everything we depend on in the register
// (server/thirdParties/register.js), and are the things its terms ask of us still in place?
// Run by `npm run third-party-audit` (scripts/third-party-audit.mjs), by the release gate
// (scripts/design-gate.mjs) and by server/test/thirdParties.test.js. Reads the repo's own files, so
// it runs on a developer's machine or in the gate's worktree - never on Vercel.
// See docs/third-party-providers.md.

import fs from 'node:fs';
import path from 'node:path';

export const GROUPS = ['service', 'library', 'asset', 'content', 'build'];
export const STATUSES = ['in_use', 'not_in_use', 'attention'];

// How long a "terms checked on" date stays good, in days. Services can change their terms and
// prices under us; a licence file for a fixed version of a font or library can't.
const TERMS_STALE_DAYS = { service: 183, build: 365, content: 365, library: 730, asset: 730 };

// Where an outside web address in our code would mean we depend on someone.
const SCAN = [
  { dir: 'public', ext: ['.html', '.js', '.css'], skip: ['demo-scores', 'licences'] },
  { dir: 'server', ext: ['.js'], skip: ['node_modules', 'test', 'thirdParties'] },
  { dir: 'api', ext: ['.js'], skip: [] },
  { dir: 'scripts', ext: ['.mjs', '.cjs', '.js'], skip: [] },
  { dir: 'db', ext: ['.js'], skip: ['migrations', 'band-lists'] }
];

function walk(root, dir, ext, skip, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(root, rel, ext, skip, out);
    else if (ext.includes(path.extname(entry.name))) out.push(rel);
  }
  return out;
}

const hostMatches = (host, pattern) => host === pattern || host.endsWith(`.${pattern}`);

// Every outside host named in our code, with the files that name it.
export function findHosts(root) {
  const hosts = new Map();
  for (const { dir, ext, skip } of SCAN) {
    for (const file of walk(root, dir, ext, skip)) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      for (const m of text.matchAll(/https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?![a-z0-9.-]*\$\{)/gi)) {
        const host = m[1].toLowerCase();
        if (!hosts.has(host)) hosts.set(host, new Set());
        hosts.get(host).add(file);
      }
    }
  }
  return hosts;
}

// The font families asked for from Google Fonts in our pages.
export function findGoogleFontFamilies(root) {
  const families = new Set();
  for (const file of walk(root, 'public', ['.html'], ['demo-scores', 'licences'])) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const link of text.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/g)) {
      for (const fam of link[1].matchAll(/family=([^:&"']+)/g)) families.add(decodeURIComponent(fam[1].replace(/\+/g, ' ')));
    }
  }
  return families;
}

function readJson(root, rel) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return null; }
}

// Every npm package named in either package.json: name -> { dev, where }.
export function findPackages(root) {
  const found = new Map();
  for (const where of ['package.json', 'server/package.json']) {
    const pj = readJson(root, where);
    if (!pj) continue;
    for (const [dev, deps] of [[false, pj.dependencies || {}], [true, pj.devDependencies || {}]]) {
      for (const name of Object.keys(deps)) {
        const seen = found.get(name);
        found.set(name, { dev: seen ? seen.dev && dev : dev, where: seen ? `${seen.where}, ${where}` : where });
      }
    }
  }
  return found;
}

// The licence an installed package declares, or null when it isn't installed here (the gate's
// worktree has no node_modules - the check is then skipped, not failed).
export function installedLicence(root, name) {
  for (const base of ['server/node_modules', 'node_modules']) {
    const pj = readJson(root, `${base}/${name}/package.json`);
    if (pj) return typeof pj.license === 'string' ? pj.license : JSON.stringify(pj.license || pj.licenses || null);
  }
  return null;
}

function checkObligation(root, entry, ob) {
  const check = ob.check;
  if (!check) return null; // checked by hand on release
  const abs = path.join(root, check.path);
  if (!fs.existsSync(abs)) return `${entry.name}: "${ob.text}" - ${check.path} is missing`;
  if (check.includes) {
    const text = fs.readFileSync(abs, 'utf8');
    const missing = [].concat(check.includes).filter((needle) => !text.includes(needle));
    if (missing.length) return `${entry.name}: "${ob.text}" - ${check.path} no longer contains ${missing.map((s) => `"${s}"`).join(', ')}`;
  }
  return null;
}

export function auditThirdParties({ root, register, today = new Date() }) {
  const errors = [];
  const warnings = [];
  const entries = register.entries;

  // 1. Each entry is complete enough to be worth having.
  const keys = new Set();
  for (const e of entries) {
    const label = e.name || e.key || '(unnamed entry)';
    if (!e.key || keys.has(e.key)) errors.push(`${label}: key missing or used twice`);
    keys.add(e.key);
    for (const field of ['name', 'who', 'provides', 'usedIn', 'licence', 'cost', 'termsCheckedOn']) {
      if (!e[field]) errors.push(`${label}: no "${field}"`);
    }
    if (!GROUPS.includes(e.group)) errors.push(`${label}: group must be one of ${GROUPS.join(', ')}`);
    if (!STATUSES.includes(e.status)) errors.push(`${label}: status must be one of ${STATUSES.join(', ')}`);
    if (!Array.isArray(e.terms) || (!e.terms.length && !e.noTermsLink)) errors.push(`${label}: no link to its terms or licence (or set noTermsLink with the reason)`);
    if (!Array.isArray(e.asks)) errors.push(`${label}: no "asks" list (use [] when the terms ask nothing of us)`);
    if (e.licenceFile && !fs.existsSync(path.join(root, e.licenceFile))) errors.push(`${label}: licence copy ${e.licenceFile} is missing`);
    if (e.group === 'library' && !e.licenceFile && !e.noLicenceFile) errors.push(`${label}: no copy of its licence (run npm run third-party-licences, or set noLicenceFile with the reason)`);
    if (e.termsCheckedOn) {
      const age = Math.floor((today - new Date(e.termsCheckedOn)) / 86400000);
      const limit = TERMS_STALE_DAYS[e.group] || 365;
      if (Number.isNaN(age)) errors.push(`${label}: termsCheckedOn isn't a date`);
      else if (age > limit) warnings.push(`${label}: terms last checked ${e.termsCheckedOn} (${age} days ago) - re-check them and update the date`);
    }
    for (const ob of e.asks || []) {
      const problem = checkObligation(root, e, ob);
      if (problem) errors.push(problem);
    }
  }

  // 2. Every npm package is registered, with the licence it really has.
  const claimed = new Map();
  for (const e of entries) for (const p of e.packages || []) claimed.set(p, e);
  const packages = findPackages(root);
  for (const [name, info] of packages) {
    const entry = claimed.get(name);
    if (!entry) { errors.push(`npm package "${name}" (${info.where}) is not in the register`); continue; }
    const licence = installedLicence(root, name);
    if (licence && licence !== entry.licence) errors.push(`npm package "${name}": the register says ${entry.licence}, the installed package says ${licence}`);
  }
  for (const [name, entry] of claimed) {
    if (!packages.has(name)) warnings.push(`${entry.name}: package "${name}" is no longer in package.json - remove the entry`);
  }

  // 3. Every outside web address in our code belongs to someone in the register.
  const ignore = register.notDependencies || [];
  const hostPatterns = entries.flatMap((e) => (e.hosts || []).map((h) => [h, e]));
  for (const [host, files] of findHosts(root)) {
    if (ignore.some((i) => hostMatches(host, i.host))) continue;
    if (hostPatterns.some(([h]) => hostMatches(host, h))) continue;
    errors.push(`"${host}" is used in ${[...files].slice(0, 3).join(', ')} but nobody in the register owns it (add it to an entry's hosts, or to notDependencies with the reason)`);
  }

  // 4. Every font we host, and every font we load from Google, is registered.
  const fontDir = path.join(root, 'public/fonts');
  const claimedFiles = new Set(entries.flatMap((e) => e.files || []));
  if (fs.existsSync(fontDir)) {
    for (const f of fs.readdirSync(fontDir)) {
      const rel = `public/fonts/${f}`;
      if (/LICEN[SC]E/i.test(f)) continue;
      if (!claimedFiles.has(rel)) errors.push(`${rel} is not in the register (add it to an entry's files, with its licence)`);
    }
  }
  for (const rel of claimedFiles) {
    if (!fs.existsSync(path.join(root, rel))) errors.push(`${rel} is in the register but not in the repo`);
  }
  const googleFonts = new Set(entries.flatMap((e) => e.googleFonts || []));
  for (const family of findGoogleFontFamilies(root)) {
    if (!googleFonts.has(family)) errors.push(`Google Fonts family "${family}" is loaded by a page but is not in the register`);
  }

  return { errors, warnings };
}
