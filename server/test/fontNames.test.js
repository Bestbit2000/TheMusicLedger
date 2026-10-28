// ML-651: a font is named after its contents, so browsers may keep it for a year. These read the real files on every
// release: a font changed without being renamed would be served stale from people's caches for up to a year.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fingerprint, baseName, FONT_REFERENCES } from '../../scripts/font-names.mjs';

const root = new URL('../../', import.meta.url);
const fontDir = new URL('public/fonts/', root);
const fonts = fs.readdirSync(fontDir).filter((f) => f.endsWith('.woff2'));
const read = (rel) => fs.readFileSync(new URL(rel, root), 'utf8');

test('every font is named after its contents - run npm run font-names if not', () => {
  assert.ok(fonts.length > 5);
  for (const f of fonts) {
    const m = f.match(/^(.+)\.([0-9a-f]{8})\.woff2$/);
    assert.ok(m, `${f} has no fingerprint in its name`);
    assert.equal(m[2], fingerprint(fs.readFileSync(new URL(f, fontDir))), `${f} has changed since it was named - run npm run font-names`);
  }
  assert.equal(new Set(fonts.map(baseName)).size, fonts.length, 'two versions of one font');
});

test('every font named in the app is there, and every font there is used', () => {
  const named = new Set();
  for (const rel of FONT_REFERENCES.filter((r) => r.startsWith('public/'))) {
    for (const m of read(rel).matchAll(/fonts\/([a-z0-9.-]+\.woff2)/g)) {
      assert.ok(fonts.includes(m[1]), `${rel} names fonts/${m[1]}, which isn't there`);
      named.add(m[1]);
    }
  }
  const css = read('public/style.css');
  for (const f of fonts) assert.ok(css.includes(`fonts/${f}`), `${f} isn't declared in style.css`);
});

test('fonts are kept for a year (vercel.json)', () => {
  const config = JSON.parse(read('vercel.json'));
  const rule = config.headers.find((h) => h.source === '/fonts/(.*)');
  assert.ok(rule, 'no headers rule for /fonts/ - run npm run sync-vercel-headers');
  assert.deepEqual(rule.headers, [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
});
