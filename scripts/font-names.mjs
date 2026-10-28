// ML-651: every font in public/fonts/ is named after its contents - name.<8 hex of its SHA-256>.woff2 - so a changed
// font is a new address, and vercel.json can let browsers keep fonts for a year (immutable) without one ever being
// out of date. `npm run font-names` after adding or changing a font (npm run icon-font runs it): it renames each font
// to its fingerprint and puts the new name everywhere the old one was. server/test/fontNames.test.js fails until then.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const FONTS = join(root, 'public/fonts');
// Where a font's file name is written
export const FONT_REFERENCES = ['public/style.css', 'public/app.html', 'public/sw.js', 'server/thirdParties/assetsAndContent.js', 'brand-trials/build.mjs'];
const HASHED = /^(.+)\.([0-9a-f]{8})\.woff2$/;

export const fingerprint = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 8);
// "inter-latin.3f2a91c0.woff2" -> "inter-latin"; "inter-latin.woff2" -> "inter-latin"
export const baseName = (file) => (file.match(HASHED) || [null, file.replace(/\.woff2$/, '')])[1];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function nameFonts() {
  const files = readdirSync(FONTS).filter((f) => f.endsWith('.woff2'));
  const byBase = new Map();
  for (const f of files) {
    const b = baseName(f);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(f);
  }
  const renamed = [];
  for (const [base, versions] of byBase) {
    // A plain name (just written - npm run icon-font) wins over an older fingerprinted one, which goes
    const fresh = versions.find((f) => !HASHED.test(f)) || versions[0];
    for (const old of versions) if (old !== fresh) unlinkSync(join(FONTS, old));
    const name = `${base}.${fingerprint(readFileSync(join(FONTS, fresh)))}.woff2`;
    if (fresh !== name) { renameSync(join(FONTS, fresh), join(FONTS, name)); renamed.push(`${fresh} -> ${name}`); }
    const any = new RegExp(`fonts/${escape(base)}(\\.[0-9a-f]{8})?\\.woff2`, 'g');
    for (const rel of FONT_REFERENCES) {
      const path = join(root, rel);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, 'utf8');
      const next = text.replace(any, `fonts/${name}`);
      if (next !== text) writeFileSync(path, next);
    }
  }
  return renamed;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const renamed = nameFonts();
  console.log(renamed.length ? renamed.join('\n') : 'Every font already carries its fingerprint.');
}
