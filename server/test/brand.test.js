// ML-484: the name the app goes by on screen. The rules that matter: only three values exist, anything
// else is the default, and the one open route answers with a key and nothing more. No database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { BRANDS, DEFAULT_BRAND, validBrand } = await import('../services/brand.js');
const { OPEN_ROUTES } = await import('../services/siteSecurityReview.js');
const { default: pool } = await import('../config/db.js');
test.after(() => pool.end().catch(() => {}));

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

test('there are three names, and The Music Ledger is the default', () => {
  assert.deepEqual(BRANDS, { 'music-ledger': 'The Music Ledger', 'notably-better': 'Notably Better', fivetto: 'Fivetto' });
  assert.equal(DEFAULT_BRAND, 'music-ledger');
});

test('anything that is not one of the three is the default - a bad value never reaches a page', () => {
  for (const key of Object.keys(BRANDS)) assert.equal(validBrand(key), key);
  for (const bad of [undefined, null, '', 'Fivetto', 'fivetto ', '<script>', 'constructor', '__proto__', 'toString', 7, {}, ['fivetto']]) assert.equal(validBrand(bad), 'music-ledger');
});

test('the open route is open on purpose, and answers with the key alone', () => {
  assert.match(OPEN_ROUTES['GET /brand'], /ML-484/);
  const api = read('../routes/api.js');
  const route = api.slice(api.indexOf("router.get('/brand'"), api.indexOf("router.get('/instruments'"));
  assert.match(route, /res\.json\(\{ brand: await getBrand\(\) \}\);/);
  assert.match(route, /no-store/);
});

test('the page and the server agree on the three keys, and every picture the page asks for is there', () => {
  const page = read('../../public/brand.js');
  for (const key of Object.keys(BRANDS)) {
    assert.ok(page.includes(`name: '${BRANDS[key]}'`), `brand.js does not name ${BRANDS[key]}`);
    for (const file of [`${key}-mark.svg`, `${key}-tab.svg`, `${key}-tab.png`]) assert.ok(fs.existsSync(new URL(`../../public/images/brands/${file}`, import.meta.url)), `${file} is missing`);
  }
  for (const splash of page.match(/images\/[\w/.-]+\.jpg/g)) assert.ok(fs.existsSync(new URL(`../../public/${splash}`, import.meta.url)), `${splash} is missing`);
});

test('nothing legal follows the setting: the policy, the terms and the installed app do not load it', () => {
  for (const file of ['privacy.html', 'terms.html', 'manifest.json']) assert.ok(!read(`../../public/${file}`).includes('brand.js'), `${file} loads brand.js`);
  assert.match(read('../../public/manifest.json'), /Music Ledger/);
});
