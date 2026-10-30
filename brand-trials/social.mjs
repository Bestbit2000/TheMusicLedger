// Draws the social-media profile pictures from the NB mark: a 1080 x 1080 square that
// still reads when Facebook (or Instagram, YouTube...) cuts it to a circle, plus a preview
// of how the circle looks big and small. Run from the repo root: node brand-trials/social.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'social');
mkdirSync(out, { recursive: true });
const BG = '#0a0a0a';
const SIZE = 1080;
const MARK = 800; // the 512 drawing scaled to this, centred: everything stays well inside the circle

const inner = (file) => readFileSync(join(here, file), 'utf8')
  .replace(/ width="512" height="512"/, ` width="${MARK}" height="${MARK}"`);

const pieces = {
  'facebook-profile-nb': inner('notably-better-icon.svg'),          // NB on a stave
  'facebook-profile-nb-bold': inner('notably-better-favicon.svg'),  // no stave, bolder strokes
};

const page = (svg) => `<!doctype html><meta charset="utf-8"><style>
  html, body { margin: 0; background: ${BG}; }
  .sq { width: ${SIZE}px; height: ${SIZE}px; display: flex; align-items: center; justify-content: center; background: ${BG}; }
  .sq svg { display: block; }</style><div class="sq">${svg}</div>`;


// ---------- Facebook cover photo: the sign-in splash re-laid for a wide, short banner ----------
// Uploaded at 1640 x 624. Desktop shows all of it; a phone shows only the middle (about 1110 wide),
// so the name and the line under it stay in the centre, and the stave can run off both edges.
const CW = 1640, CH = 624, S = 22;
const GOLD = '<defs><linearGradient id="gold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + CW + '" y2="0">'
  + '<stop offset="0" stop-color="#b8922e"/><stop offset="0.3" stop-color="#f5d78e"/><stop offset="0.55" stop-color="#d4af37"/>'
  + '<stop offset="0.8" stop-color="#f5d78e"/><stop offset="1" stop-color="#b8922e"/></linearGradient></defs>';
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
// Five loose, wobbly strands on the left that settle into a straight five-line stave on the right
// (the picture that used to open the app), with a scale climbing on the settled stave and getting
// brighter as it goes. The settled part, and all eight notes, sit inside what a phone shows.
const MID = 420;                                                         // the stave's middle line once settled
const AMP = [86, -64, 98, -70, 80], FREQ = [0.0098, 0.0121, 0.0087, 0.0112, 0.0133], PHASE = [0.4, 1.9, 3.1, 4.4, 5.6];
const coverLine = (i) => (x) => MID + (i - 2) * S + AMP[i] * Math.sin(FREQ[i] * x + PHASE[i]) * (1 - smooth((x - 300) / 620));
const polyline = (fn) => { let d = ''; for (let x = -10; x <= CW + 10; x += 6) d += (d ? ' L' : 'M') + x + ',' + fn(x).toFixed(1); return d; };
function coverSvg() {
  let art = '';
  for (let i = 0; i < 5; i++) art += '<path d="' + polyline(coverLine(i)) + '" fill="none" stroke="url(#gold)" stroke-width="3"/>';
  const bottom = MID + 2 * S;
  for (let k = 0; k < 8; k++) {
    const x = 935 + k * 54;      // all eight inside what a phone shows
    const y = bottom - k * (S / 2);                                       // k staff steps above the bottom line
    const o = (0.45 + 0.55 * (k / 7)).toFixed(2);
    art += '<text x="' + x + '" y="' + y + '" font-family="Bravura" font-size="' + S * 4 + '" fill="url(#gold)" opacity="' + o + '">' + (k >= 4 ? '\uE1D6' : '\uE1D5') + '</text>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + CW + ' ' + CH + '" width="' + CW + '" height="' + CH + '">' + GOLD
    + '<rect width="' + CW + '" height="' + CH + '" fill="' + BG + '"/>'
    + '<text x="' + CW / 2 + '" y="150" text-anchor="middle" font-family="Lexend" font-weight="300" font-size="84" letter-spacing="10" fill="url(#gold)">NOTABLY BETTER</text>'
    + '<text x="' + CW / 2 + '" y="212" text-anchor="middle" font-family="Lexend" font-weight="300" font-size="28" letter-spacing="7" fill="#cfcfcf">NOTE BY NOTE</text>'
    + art + '</svg>';
}
// ---------- YouTube channel banner ----------
// 2560 x 1440. A TV shows all of it, a computer the middle band (2560 x 423), and a phone only the
// centre 1546 x 423 - so the name, the line under it, the wobble and all eight notes sit in that centre.
const YW = 2560, YH = 1440, YS = 24, YMID = 826;
const YGOLD = '<defs><linearGradient id="ygold" gradientUnits="userSpaceOnUse" x1="507" y1="0" x2="2053" y2="0">'
  + '<stop offset="0" stop-color="#b8922e"/><stop offset="0.3" stop-color="#f5d78e"/><stop offset="0.55" stop-color="#d4af37"/>'
  + '<stop offset="0.8" stop-color="#f5d78e"/><stop offset="1" stop-color="#b8922e"/></linearGradient></defs>';
const YAMP = [62, -48, 66, -46, 44], YFREQ = [0.0092, 0.0118, 0.0081, 0.0106, 0.0127];
const bannerLine = (i) => (x) => YMID + (i - 2) * YS + YAMP[i] * Math.sin(YFREQ[i] * x + PHASE[i]) * (1 - smooth((x - 760) / 640));
const bannerPath = (fn) => { let d = ''; for (let x = -10; x <= YW + 10; x += 6) d += (d ? ' L' : 'M') + x + ',' + fn(x).toFixed(1); return d; };
function bannerSvg() {
  let art = '';
  for (let i = 0; i < 5; i++) art += '<path d="' + bannerPath(bannerLine(i)) + '" fill="none" stroke="url(#ygold)" stroke-width="3.5"/>';
  const bottom = YMID + 2 * YS;
  for (let k = 0; k < 8; k++) {
    const x = 1440 + k * 74;
    const y = bottom - k * (YS / 2);
    const o = (0.45 + 0.55 * (k / 7)).toFixed(2);
    art += '<text x="' + x + '" y="' + y + '" font-family="Bravura" font-size="' + YS * 4 + '" fill="url(#ygold)" opacity="' + o + '">' + (k >= 4 ? '\uE1D6' : '\uE1D5') + '</text>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + YW + ' ' + YH + '" width="' + YW + '" height="' + YH + '">' + YGOLD
    + '<rect width="' + YW + '" height="' + YH + '" fill="' + BG + '"/>'
    + '<text x="' + YW / 2 + '" y="630" text-anchor="middle" font-family="Lexend" font-weight="300" font-size="116" letter-spacing="14" fill="url(#ygold)">NOTABLY BETTER</text>'
    + '<text x="' + YW / 2 + '" y="694" text-anchor="middle" font-family="Lexend" font-weight="300" font-size="34" letter-spacing="9" fill="#cfcfcf">NOTE BY NOTE</text>'
    + art + '</svg>';
}
const fontCss = "@font-face { font-family: Lexend; src: url('../public/fonts/lexend-latin.ebfa2276.woff2') format('woff2'); font-weight: 100 900; }"
  + "@font-face { font-family: Bravura; src: url('../public/fonts/bravura.5c25278c.woff2') format('woff2'); }";

const browser = await chromium.launch();
for (const [name, svg] of Object.entries(pieces)) {
  const html = join(here, '_social.html');
  writeFileSync(html, page(svg));
  const p = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  await p.goto(pathToFileURL(html).href);
  await p.screenshot({ path: join(out, name + '.png') });
  await p.close();
}

// Preview: each picture cut to a circle, as Facebook shows it on a Page and beside a post.
const row = (name, label) => `<div class="row">
  <img src="${name}.png" width="320"><img src="${name}.png" width="96"><img src="${name}.png" width="40">
  <div class="post"><img src="${name}.png" width="40"><div><b>Notably Better</b><br><span>${label}</span></div></div></div>`;
writeFileSync(join(out, '_preview.html'), `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 32px; background: #f0f2f5; font-family: Arial, sans-serif; }
  .row { display: flex; align-items: center; gap: 28px; margin-bottom: 32px; }
  .row img { border-radius: 50%; display: block; }
  .post { display: flex; align-items: center; gap: 10px; background: #fff; padding: 12px 18px; border-radius: 8px; font-size: 15px; color: #050505; }
  .post span { color: #65676b; font-size: 13px; }</style>
  ${row('facebook-profile-nb', 'With the stave')}${row('facebook-profile-nb-bold', 'Bold, no stave')}`);
const p = await browser.newPage({ viewport: { width: 900, height: 820 }, deviceScaleFactor: 2 });
await p.goto(pathToFileURL(join(out, '_preview.html')).href);
await p.screenshot({ path: join(out, 'profile-preview.png') });

// The cover, and a preview of how desktop and a phone show it with the profile picture over it.
{
  const html = join(here, '_social.html');
  writeFileSync(html, '<!doctype html><meta charset="utf-8"><style>' + fontCss + ' html,body{margin:0;background:' + BG + '} svg{display:block}</style>' + coverSvg());
  const p = await browser.newPage({ viewport: { width: CW, height: CH } });
  await p.goto(pathToFileURL(html).href);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(out, 'facebook-cover.png') });
  await p.close();
  writeFileSync(join(out, '_cover-preview.html'), '<!doctype html><meta charset="utf-8"><style>'
    + 'body{margin:0;padding:28px;background:#f0f2f5;font-family:Arial,sans-serif;color:#65676b;font-size:14px}'
    + '.desk{position:relative;width:820px;height:312px;background:url(facebook-cover.png) center/cover;border-radius:8px;margin-bottom:90px}'
    + '.desk img{position:absolute;left:24px;bottom:-70px;width:168px;border-radius:50%;border:4px solid #fff}'
    + '.phone{position:relative;width:360px;height:202px;background:url(facebook-cover.png) center/cover;margin-bottom:70px}'
    + '.phone img{position:absolute;left:12px;bottom:-56px;width:112px;border-radius:50%;border:4px solid #fff}'
    + 'p{margin:0 0 8px}</style>'
    + '<p>Desktop</p><div class="desk"><img src="facebook-profile-nb-bold.png"></div>'
    + '<p>Phone</p><div class="phone"><img src="facebook-profile-nb-bold.png"></div>');
  const q = await browser.newPage({ viewport: { width: 880, height: 820 }, deviceScaleFactor: 2 });
  await q.goto(pathToFileURL(join(out, '_cover-preview.html')).href);
  await q.screenshot({ path: join(out, 'cover-preview.png') });
  await q.close();
}

// The YouTube banner, and a preview of the three crops YouTube uses.
{
  const html = join(here, '_social.html');
  writeFileSync(html, '<!doctype html><meta charset="utf-8"><style>' + fontCss + ' html,body{margin:0;background:' + BG + '} svg{display:block}</style>' + bannerSvg());
  const p = await browser.newPage({ viewport: { width: YW, height: YH } });
  await p.goto(pathToFileURL(html).href);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(out, 'youtube-banner.png') });
  await p.close();
  const box = (w, h, label) => '<p>' + label + '</p><div class="b" style="--w:' + w + ';--h:' + h + '"></div>';
  writeFileSync(join(out, '_banner-preview.html'), '<!doctype html><meta charset="utf-8"><style>'
    + 'body{margin:0;padding:24px;background:#f0f2f5;font-family:Arial,sans-serif;color:#65676b;font-size:14px}p{margin:0 0 6px}'
    + '.b{width:calc(var(--w)*0.42px);height:calc(var(--h)*0.42px);background:url(youtube-banner.png) center/calc(2560*0.42px) calc(1440*0.42px) no-repeat;margin-bottom:18px;border-radius:6px}'
    + '.t{width:calc(2560*0.42px);height:calc(1440*0.42px);background:url(youtube-banner.png) center/cover;border-radius:6px}</style>'
    + box(1546, 423, 'Phone (all devices)') + box(2560, 423, 'Computer')
    + '<p>TV</p><div class="t"></div>');
  const q = await browser.newPage({ viewport: { width: 1130, height: 1010 }, deviceScaleFactor: 2 });
  await q.goto(pathToFileURL(join(out, '_banner-preview.html')).href);
  await q.screenshot({ path: join(out, 'banner-preview.png') });
  await q.close();
}
await browser.close();
console.log('done');
