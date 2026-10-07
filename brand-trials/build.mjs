// Draws the trial brand artwork (splash + icon for Notably Better and Fivetto) as SVG and
// renders it to PNG with Playwright. Run from the repo root: node brand-trials/build.mjs
// Music symbols are Bravura glyphs (the app's notation font); the wordmark is Lexend.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BG = '#0a0a0a';
const GLYPH = { gClef: '', quarterUp: '', quarterDown: '', head: '' };

const defs = (w) => `
  <defs>
    <linearGradient id="gold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="0">
      <stop offset="0" stop-color="#b8922e"/><stop offset="0.3" stop-color="#f5d78e"/>
      <stop offset="0.55" stop-color="#d4af37"/><stop offset="0.8" stop-color="#f5d78e"/>
      <stop offset="1" stop-color="#b8922e"/>
    </linearGradient>
  </defs>`;

const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const poly = (fn, x0, x1, step = 8) => {
  let d = '';
  for (let x = x0; x <= x1; x += step) d += (d ? ' L' : 'M') + x + ',' + fn(x).toFixed(1);
  return d;
};

// ---------- Notably Better: a stave that climbs, with a scale climbing on it ----------
function splashNotablyBetter() {
  const W = 1376, H = 768, s = 24;
  const top = (x) => 520 - 210 * smooth((x - 240) / 980);   // y of the top line at x
  const line = (i) => (x) => top(x) + i * s;                 // i = 0 (top) .. 4 (bottom)
  let art = '';
  for (let i = 0; i < 5; i++) art += `<path d="${poly(line(i), -10, W + 10)}" fill="none" stroke="url(#gold)" stroke-width="3"/>`;
  art += `<text x="56" y="${line(3)(90)}" font-family="Bravura" font-size="${s * 4}" fill="url(#gold)">${GLYPH.gClef}</text>`;
  const n = 8;
  for (let k = 0; k < n; k++) {
    const x = 290 + k * 128;
    const y = line(4)(x + 14) - k * (s / 2);                 // k staff steps above the bottom line
    const glyph = k >= 4 ? GLYPH.quarterDown : GLYPH.quarterUp;
    const o = (0.38 + 0.62 * (k / (n - 1))).toFixed(2);
    art += `<text x="${x}" y="${y.toFixed(1)}" font-family="Bravura" font-size="${s * 4}" fill="url(#gold)" opacity="${o}">${glyph}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs(W)}
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <text x="${W / 2}" y="150" text-anchor="middle" font-family="Lexend" font-weight="300" font-size="78" letter-spacing="9" fill="url(#gold)">NOTABLY BETTER</text>
    <text x="${W / 2}" y="214" text-anchor="middle" font-family="Lexend" font-weight="300" font-size="27" letter-spacing="7" fill="#cfcfcf">NOTE BY NOTE</text>
    ${art}</svg>`;
}

// ---------- Fivetto: five loose strands settle into a five-line stave with five notes ----------
function splashFivetto() {
  const W = 1376, H = 768, s = 26, mid = 470;
  const amp = [70, -52, 84, -60, 66], freq = [0.0105, 0.0128, 0.0092, 0.0117, 0.0139], phase = [0.4, 1.9, 3.1, 4.4, 5.6];
  const line = (i) => (x) => mid + (i - 2) * s + amp[i] * Math.sin(freq[i] * x + phase[i]) * (1 - smooth((x - 140) / 560));
  let art = '';
  for (let i = 0; i < 5; i++) art += `<path d="${poly(line(i), -10, W + 10, 6)}" fill="none" stroke="url(#gold)" stroke-width="3"/>`;
  for (let k = 0; k < 5; k++) {                              // one note on each line, bottom to top
    const x = 770 + k * 112;
    const y = mid + (2 - k) * s;
    const glyph = k >= 2 ? GLYPH.quarterDown : GLYPH.quarterUp;
    art += `<text x="${x}" y="${y}" font-family="Bravura" font-size="${s * 4}" fill="url(#gold)">${glyph}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs(W)}
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <text x="${W / 2}" y="150" text-anchor="middle" font-family="Lexend" font-weight="300" font-size="86" letter-spacing="14" fill="url(#gold)">FIVETTO</text>
    <text x="${W / 2}" y="214" text-anchor="middle" font-family="Lexend" font-weight="300" font-size="27" letter-spacing="7" fill="#cfcfcf">FIVE MINUTES AT A TIME</text>
    ${art}</svg>`;
}

// ---------- Icons (512, full bleed so a phone can mask them) ----------
const iconShell = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${defs(512)}
  <rect width="512" height="512" fill="${BG}"/>${inner}</svg>`;
const staveBehind = (ys, x0, x1) => ys.map((y) => `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="url(#gold)" stroke-width="5" opacity="0.38"/>`).join('');

// Each mark is letters drawn as music: the first stroke is a note's stem with its notehead.
// With the stave it is the app's mark; without it, bolder and larger, it is the browser-tab icon,
// which has to read at 16 pixels.
const MARKS = {
  'music-ledger': {
    ys: [156, 206, 256, 306, 356],
    strokes: 'M150,346 L150,156 L220,290 L290,156 L290,356 M340,156 L340,356 H424',
    head: [119, 350, 37, 26],
  },
  'notably-better': {
    ys: [156, 206, 256, 306, 356],
    strokes: 'M158,346 L158,156 L270,356 L270,156 M322,156 L322,356 M322,156 H366 a48,50 0 0 1 0,100 H322 M322,256 H376 a50,50 0 0 1 0,100 H322',
    head: [127, 350, 37, 26],
  },
  fivetto: {
    ys: [150, 203, 256, 309, 362],
    strokes: 'M212,352 L212,150 H392 M212,256 H340',
    head: [176, 356, 44, 31],
  },
};
function mark(key, { stave }) {
  const m = MARKS[key];
  const [cx, cy, rx, ry] = m.head;
  const width = stave ? (key === 'fivetto' ? 28 : 24) : (key === 'fivetto' ? 40 : 34);
  const art = `<path d="${m.strokes}" fill="none" stroke="url(#gold)" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(-22 ${cx} ${cy})" fill="url(#gold)"/>`;
  return iconShell(stave ? staveBehind(m.ys, 70, 442) + art : `<g transform="translate(256 256) scale(1.3) translate(-256 -256)">${art}</g>`);
}

const pieces = {
  'notably-better-splash': { svg: splashNotablyBetter(), w: 1376, h: 768, scale: 2 },
  'fivetto-splash': { svg: splashFivetto(), w: 1376, h: 768, scale: 2 },
  'music-ledger-icon': { svg: mark('music-ledger', { stave: true }), w: 512, h: 512, scale: 1 },
  'notably-better-icon': { svg: mark('notably-better', { stave: true }), w: 512, h: 512, scale: 1 },
  'fivetto-icon': { svg: mark('fivetto', { stave: true }), w: 512, h: 512, scale: 1 },
  'music-ledger-favicon': { svg: mark('music-ledger', { stave: false }), w: 512, h: 512, scale: 1 },
  'notably-better-favicon': { svg: mark('notably-better', { stave: false }), w: 512, h: 512, scale: 1 },
  'fivetto-favicon': { svg: mark('fivetto', { stave: false }), w: 512, h: 512, scale: 1 },
};

const fontCss = `
  @font-face { font-family: Lexend; src: url('../public/fonts/lexend-latin.woff2') format('woff2'); font-weight: 100 900; }
  @font-face { font-family: Bravura; src: url('../public/fonts/bravura.woff2') format('woff2'); }
  html, body { margin: 0; background: ${BG}; }
  svg { display: block; }`;

const browser = await chromium.launch();
for (const [name, p] of Object.entries(pieces)) {
  writeFileSync(join(here, name + '.svg'), p.svg);
  const htmlPath = join(here, '_render.html');
  writeFileSync(htmlPath, `<!doctype html><meta charset="utf-8"><style>${fontCss}</style>${p.svg}`);
  const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: p.scale });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(here, name + '.png') });
  await page.close();
}

// One sheet showing each icon at the sizes a phone uses, and as the mark beside the name in a top bar.
const row = (key, label) => `
  <div class="row"><img src="${key}-icon.png" width="192"><img src="${key}-icon.png" width="96"><img src="${key}-icon.png" width="48">
    <div class="bar"><img src="${key}-icon.png" width="40"><span>${label}</span></div>
    <div class="tab"><img src="${key}-favicon.png" width="32"><img src="${key}-favicon.png" width="16"><span>${label}</span></div></div>`;
const sheet = `<!doctype html><meta charset="utf-8"><style>${fontCss}
  body { background: #2a2a2a; padding: 32px; font-family: Lexend; color: #f5d78e; }
  .row { display: flex; align-items: center; gap: 28px; margin-bottom: 36px; }
  .row img { border-radius: 22%; display: block; }
  .bar { display: flex; align-items: center; gap: 12px; background: ${BG}; padding: 10px 22px 10px 12px; border-radius: 10px; font-size: 22px; }
  .bar img { border-radius: 8px; }
  .tab { display: flex; align-items: center; gap: 10px; background: #dee1e6; color: #1f1f1f; padding: 10px 18px 10px 12px; border-radius: 10px 10px 0 0; font-family: Inter, Arial, sans-serif; font-size: 13px; }
  .tab img { border-radius: 3px; }</style>
  ${row('music-ledger', 'The Music Ledger')}${row('notably-better', 'Notably Better')}${row('fivetto', 'Fivetto')}`;
const sheetPath = join(here, '_sheet.html');
writeFileSync(sheetPath, sheet);
const page = await browser.newPage({ viewport: { width: 1120, height: 740 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(sheetPath).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: join(here, 'icons-at-small-sizes.png') });
await browser.close();
console.log('done');
