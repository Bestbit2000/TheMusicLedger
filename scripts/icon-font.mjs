// ML-650: make the small icon font. `npm run icon-font` after adding an icon the app hasn't used before
// (server/test/iconFont.test.js says when). The full Material Symbols font is 4 MB; this asks Google Fonts for its own
// file holding only the icons the app names (scripts/icon-names.mjs), at the one size, weight and grade the app uses
// (opsz 24, wght 400, GRAD 0) and both fills (FILL 0..1), and keeps it in public/fonts/ - visitors still load nothing
// from Google (ML-430). The file is Google's, unchanged. public/fonts/icons.json says which icons it holds.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usedIconNames } from './icon-names.mjs';
import { nameFonts } from './font-names.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
// Google Fonts sends each browser the format it can read; this asks as a current browser, for woff2
const AS_A_BROWSER = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' };

const icons = usedIconNames();
const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${icons.join(',')}&display=block`, { headers: AS_A_BROWSER })).text();
const fontUrl = (css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/) || [])[1];
if (!fontUrl) throw new Error(`Google Fonts didn't answer with a font:\n${css.slice(0, 500)}`);
const font = Buffer.from(await (await fetch(fontUrl, { headers: AS_A_BROWSER })).arrayBuffer());
if (font.subarray(0, 4).toString() !== 'wOF2') throw new Error('The download is not a woff2 font.');

writeFileSync(join(root, 'public/fonts/material-symbols-outlined.woff2'), font);
writeFileSync(join(root, 'public/fonts/icons.json'), `${JSON.stringify({
  about: 'ML-650: the icons in material-symbols-outlined.woff2 - made by npm run icon-font, from Google Fonts (icon_names). Do not edit by hand.',
  made: new Date().toISOString().slice(0, 10),
  axes: 'opsz 24, wght 400, GRAD 0, FILL 0..1',
  icons
}, null, 2)}\n`);
// ML-651: named after its contents, and the new name put everywhere the old one was (scripts/font-names.mjs)
const renamed = nameFonts();
console.log(`${icons.length} icons, ${Math.round(font.length / 1024)} KB -> public/fonts/${renamed.length ? renamed.join(', ') : 'unchanged'}`);
