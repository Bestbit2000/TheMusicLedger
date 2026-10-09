// The app is called Notably Better (docs/app-name.md). It was "The Music Ledger" until October 2026, and for
// two days before the rename a super admin could switch the name on screen between three (ML-484). These
// tests keep the name in step everywhere it is written, and keep the old name and the switch from coming back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const NAME = 'Notably Better';
const url = (file) => new URL(`../../${file}`, import.meta.url);
const read = (file) => fs.readFileSync(url(file), 'utf8');
const exists = (file) => fs.existsSync(url(file));

test('the pages, the installed app and Brand.name() all say the same name', () => {
  assert.match(read('public/brand.js'), /const NAME = 'Notably Better';/);
  const index = read('public/index.html');
  assert.ok(index.includes(`<title>${NAME}</title>`), 'the tab title');
  assert.ok(index.includes(`<meta name="apple-mobile-web-app-title" content="${NAME}">`), 'the name on an iPhone home screen');
  assert.ok(index.includes(`alt="${NAME}" class="splash-image"`), "the sign-in picture's alt text");
  assert.ok(index.includes(`id="topTitle" tabindex="-1">${NAME}</h1>`), 'the top bar');
  assert.ok(index.includes(`id="railBrandName">${NAME}</span>`), "the menu rail's head");
  const manifest = JSON.parse(read('public/manifest.json'));
  assert.equal(manifest.name, NAME);
  assert.equal(manifest.short_name, NAME);
});

test('every picture the pages and the manifest point at is there', () => {
  const index = read('public/index.html');
  for (const file of ['images/brands/notably-better-mark.svg', 'images/brands/notably-better-tab.svg', 'images/brands/notably-better-tab.png', 'images/brands/notably-better-splash.jpg', 'icons/apple-touch-icon.png']) {
    assert.ok(index.includes(file), `index.html does not use ${file}`);
    assert.ok(exists(`public/${file}`), `${file} is missing`);
  }
  for (const icon of JSON.parse(read('public/manifest.json')).icons) assert.ok(exists(`public/${icon.src}`), `${icon.src} is missing`);
  // the mark is in the service worker's list, so it is right with no connection (ML-220)
  assert.ok(read('public/sw.js').includes("'/images/brands/notably-better-mark.svg'"));
  for (const page of ['admin.html', 'privacy.html', 'terms.html']) assert.ok(read(`public/${page}`).includes('images/brands/notably-better-tab.svg'), `${page}: the tab icon`);
});

// Names inside the machinery that keep the old name on purpose (docs/app-name.md) - and the two legal
// pages' one sentence saying what the app used to be called.
const ALLOWED = [
  /musicledger:/g,                       // the MusicXML extension prefix: every exported file carries it
  /@themusicledger\.local/g,             // local test accounts
  /music-ledger-(offline|v\d+)/g,        // the on-device database and the service worker's cache
  /TheMusicLedger-security-review/g,     // a User-Agent the security review sends to GitHub
  /Bestbit2000\/TheMusicLedger/g,        // the repository
  /the app was called The Music Ledger/g,
  /It was "The Music Ledger" \(a working title\)/g // brand.js's own comment
];
const stripped = (text) => ALLOWED.reduce((s, re) => s.replace(re, ''), text);
const OLD = /music\s*ledger/i;

test('nothing a member reads still says the old name', () => {
  const files = ['public/index.html', 'public/app.js', 'public/admin.html', 'public/admin.js', 'public/privacy.html', 'public/terms.html', 'public/manifest.json', 'public/brand.js', 'public/sw.js', 'public/offline.js'];
  for (const dir of ['server/services', 'server/routes']) for (const f of fs.readdirSync(url(dir))) if (f.endsWith('.js')) files.push(`${dir}/${f}`);
  for (const file of files) {
    const line = stripped(read(file)).split(/\r?\n/).find((l) => OLD.test(l));
    assert.equal(line, undefined, `${file} still says the old name: ${String(line).trim().slice(0, 140)}`);
  }
});

test('the old contact address is gone, and the legal pages give the new one', () => {
  for (const file of ['public/index.html', 'public/app.js', 'public/admin.js', 'public/privacy.html', 'public/terms.html']) assert.ok(!read(file).includes('themusicledgerapp@gmail.com'), `${file} still gives the Gmail address`);
  for (const file of ['public/privacy.html', 'public/terms.html']) {
    assert.ok(read(file).includes('hello@notablybetter.com'), `${file}: the contact address`);
    assert.ok(read(file).includes('Until October 2026 the app was called The Music Ledger.'), `${file}: what the app used to be called`);
  }
});

test('emails and two-step codes carry the name, from the app\'s own address', () => {
  assert.ok(read('server/services/twoStep.js').includes(`export const ISSUER = '${NAME}';`), 'the name an authenticator app shows');
  assert.ok(read('server/services/mail.js').includes(`'${NAME} <noreply@notablybetter.com>'`), 'the sender when MAIL_FROM is not set');
});

test('the name trial has gone: no switch, no open route, no page', () => {
  for (const file of ['server/services/brand.js', 'public/admin-brand.js', 'public/images/brands/fivetto-mark.svg', 'public/images/brands/music-ledger-mark.svg']) assert.ok(!exists(file), `${file} is back`);
  assert.ok(!read('server/services/siteSecurityReview.js').includes("'GET /brand'"), 'the open route is off the list');
  assert.ok(!read('server/routes/api.js').includes("'/brand'"));
  assert.ok(!read('server/routes/admin.js').includes("'/brand'"));
  assert.ok(!read('public/admin.html').includes('data-section="brand"'));
  assert.ok(!read('public/brand.js').includes('fetch('), 'brand.js asks the server nothing');
  assert.ok(!read('public/style.css').includes('data-brand-ready'), 'nothing is held back waiting for a name');
});
