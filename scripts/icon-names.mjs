// ML-650: which Material Symbols icons the app uses. An icon is a word that the icon font turns into a picture, so
// the small font in public/fonts/ (made by scripts/icon-font.mjs) holds only these. They are found the simple, safe
// way: every word in the app's pages and scripts (and in the migrations, which seed the rest messages' icons) that is
// the name of an icon. An extra icon costs a few hundred bytes; a missing one would show as its name.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Every icon name in Material Symbols Outlined (Google's codepoints file, kept beside the full font in fonts-src/)
export function allIconNames() {
  return new Set(readFileSync(join(root, 'fonts-src/material-symbols-outlined.codepoints'), 'utf8')
    .split('\n').map((l) => l.trim().split(' ')[0]).filter(Boolean));
}

function filesUnder(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'fonts') out.push(...filesUnder(p, exts)); }
    else if (exts.includes(extname(name))) out.push(p);
  }
  return out;
}

// The icons the app's own files name, A-Z
export function usedIconNames() {
  const names = allIconNames();
  const files = [...filesUnder(join(root, 'public'), ['.js', '.mjs', '.html']), ...filesUnder(join(root, 'db/migrations'), ['.sql'])];
  const used = new Set();
  for (const f of files) for (const w of readFileSync(f, 'utf8').match(/[a-z0-9_]+/g) || []) if (names.has(w)) used.add(w);
  return [...used].sort();
}

// The list the small font was made from (public/fonts/icons.json)
export function fontIconNames() {
  return JSON.parse(readFileSync(join(root, 'public/fonts/icons.json'), 'utf8')).icons;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const used = usedIconNames();
  console.log(`${used.length} icons`);
  console.log(used.join(','));
}
