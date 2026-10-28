// ML-650: the icon font in public/fonts/ holds only the icons the app uses (it was Google's full 4 MB font, slow
// enough on a poor line that members saw the icons' names). An icon missing from it would show as nothing, so these
// read the real files on every release: every icon name in the app's pages, scripts and migrations must be in the
// font (public/fonts/icons.json), and the font must be the small one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { usedIconNames, fontIconNames, allIconNames } from '../../scripts/icon-names.mjs';

test('every icon the app names is in the icon font', () => {
  const inFont = new Set(fontIconNames());
  const missing = usedIconNames().filter((n) => !inFont.has(n));
  assert.deepEqual(missing, [], `Not in the icon font: ${missing.join(', ')} - run npm run icon-font and commit the font and icons.json`);
});

test('the icon font list holds only real icon names', () => {
  const all = allIconNames();
  assert.deepEqual(fontIconNames().filter((n) => !all.has(n)), []);
});

test('the icon font is the small one', () => {
  const font = fs.readFileSync(new URL('../../public/fonts/material-symbols-outlined.woff2', import.meta.url));
  assert.equal(font.subarray(0, 4).toString(), 'wOF2');
  assert.ok(font.length < 1024 * 1024, `the icon font is ${Math.round(font.length / 1024)} KB - it should be the small one from npm run icon-font`);
});

test('the app page asks for the icon font straight away, and icons stay blank until it is here', () => {
  const app = fs.readFileSync(new URL('../../public/app.html', import.meta.url), 'utf8');
  assert.match(app, /<link rel="preload" href="\/fonts\/material-symbols-outlined\.woff2" as="font" type="font\/woff2" crossorigin>/);
  const css = fs.readFileSync(new URL('../../public/style.css', import.meta.url), 'utf8');
  assert.match(css, /html\[data-icons\] \.material-symbols-outlined \{ visibility: hidden;/);
  const prefs = fs.readFileSync(new URL('../../public/display-prefs.js', import.meta.url), 'utf8');
  assert.match(prefs, /setAttribute\('data-icons', 'loading'\)/);
});
