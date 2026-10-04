// ML-267: the third-party register and its release check (server/thirdParties/).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import register from '../thirdParties/register.js';
import { auditThirdParties, findHosts, findGoogleFontFamilies, findPackages } from '../thirdParties/audit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('the register passes its own audit against this repo', () => {
  const { errors } = auditThirdParties({ root: ROOT, register });
  assert.deepEqual(errors, []);
});

test('every package and outside host in the code is found; nothing is loaded from Google Fonts (ML-430)', () => {
  assert.ok(findPackages(ROOT).has('express'));
  assert.ok(findHosts(ROOT).has('cdn.jsdelivr.net'));
  assert.equal(findHosts(ROOT).has('fonts.googleapis.com'), false);
  assert.equal(findGoogleFontFamilies(ROOT).size, 0);
});

// A tiny made-up repo, so each rule can be shown failing.
function fakeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ml267-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const entry = (over = {}) => ({
  key: 'acme', name: 'Acme', group: 'service', status: 'in_use', who: 'Acme Ltd', provides: 'Things',
  usedIn: 'public/app.js', licence: 'Terms of Service', cost: 'Free', termsCheckedOn: '2026-10-04',
  terms: [{ label: 'Terms', url: 'https://acme.example/terms' }], asks: [], ...over
});
const audit = (root, entries, extra = {}) => auditThirdParties({ root, register: { entries, notDependencies: [], ...extra }, today: new Date('2026-10-05') });

test('an outside web address nobody owns is an error', () => {
  const root = fakeRepo({ 'public/app.js': 'fetch("https://api.unknown-service.com/v1")' });
  assert.match(audit(root, [entry()]).errors.join('\n'), /api\.unknown-service\.com/);
  assert.deepEqual(audit(root, [entry({ hosts: ['unknown-service.com'] })]).errors, []);
  assert.deepEqual(audit(root, [entry()], { notDependencies: [{ host: 'unknown-service.com', why: 'test' }] }).errors, []);
});

test('an npm package that is not registered is an error', () => {
  const root = fakeRepo({ 'package.json': JSON.stringify({ dependencies: { leftpad: '1.0.0' } }) });
  assert.match(audit(root, [entry()]).errors.join('\n'), /npm package "leftpad"/);
  const lib = entry({ key: 'npm-leftpad', group: 'library', licence: 'MIT', packages: ['leftpad'], noLicenceFile: 'ships none' });
  assert.deepEqual(audit(root, [lib]).errors, []);
});

test('a registered licence that differs from the installed package is an error', () => {
  const root = fakeRepo({
    'package.json': JSON.stringify({ dependencies: { leftpad: '1.0.0' } }),
    'node_modules/leftpad/package.json': JSON.stringify({ license: 'GPL-3.0' })
  });
  const lib = entry({ key: 'npm-leftpad', group: 'library', licence: 'MIT', packages: ['leftpad'], noLicenceFile: 'ships none' });
  assert.match(audit(root, [lib]).errors.join('\n'), /register says MIT, the installed package says GPL-3\.0/);
});

test('a font file or Google font that is not registered is an error', () => {
  const root = fakeRepo({
    'public/fonts/mystery.woff2': 'x',
    'public/fonts/Mystery-LICENSE.txt': 'x',
    'public/index.html': '<link href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400&family=Inter">'
  });
  const google = entry({ hosts: ['fonts.googleapis.com'] });
  const errors = audit(root, [google]).errors.join('\n');
  assert.match(errors, /public\/fonts\/mystery\.woff2 is not in the register/);
  assert.match(errors, /"Comic Neue"/);
  assert.match(errors, /"Inter"/);
  assert.deepEqual(audit(root, [entry({ hosts: ['fonts.googleapis.com'], files: ['public/fonts/mystery.woff2'], googleFonts: ['Comic Neue', 'Inter'] })]).errors, []);
});

test('something a licence asks of us going missing is an error', () => {
  const root = fakeRepo({ 'public/index.html': '<p>We are not endorsed by Acme.</p>' });
  const ok = entry({ asks: [{ text: 'Show the disclaimer', check: { path: 'public/index.html', includes: 'not endorsed by Acme' } }] });
  assert.deepEqual(audit(root, [ok]).errors, []);
  const gone = entry({ asks: [{ text: 'Show the disclaimer', check: { path: 'public/index.html', includes: 'approved by Acme' } }] });
  assert.match(audit(root, [gone]).errors.join('\n'), /Show the disclaimer/);
  const noFile = entry({ asks: [{ text: 'Keep the licence with the font', check: { path: 'public/fonts/Acme-LICENSE.txt' } }] });
  assert.match(audit(root, [noFile]).errors.join('\n'), /Acme-LICENSE\.txt is missing/);
});

test('the privacy policy has to name every service in use (ML-430)', () => {
  const root = fakeRepo({ 'public/privacy.html': '<p>Acme Cloud holds the database.</p>' });
  assert.deepEqual(audit(root, [entry({ policyName: 'Acme Cloud' })]).errors, []);
  assert.match(audit(root, [entry({ policyName: 'Other Co' })]).errors.join('
'), /doesn't name "Other Co"/);
  assert.match(audit(root, [entry()]).errors.join('
'), /policyName/);
  assert.deepEqual(audit(root, [entry({ notInPolicy: 'handles nobody's information' })]).errors, []);
  assert.deepEqual(audit(root, [entry({ status: 'not_in_use' })]).errors, []);
});

test('terms not re-checked for too long are a warning, not an error', () => {
  const root = fakeRepo({});
  const stale = audit(root, [entry({ termsCheckedOn: '2025-01-01' })]);
  assert.deepEqual(stale.errors, []);
  assert.match(stale.warnings.join('\n'), /re-check them/);
});

test('an incomplete entry is an error', () => {
  const root = fakeRepo({});
  const errors = audit(root, [entry({ who: '', terms: [], group: 'other' })]).errors.join('\n');
  assert.match(errors, /no "who"/);
  assert.match(errors, /no link to its terms/);
  assert.match(errors, /group must be one of/);
});
