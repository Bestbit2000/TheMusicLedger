// Draws the installed app's icons (public/icons/) from the Notably Better mark, notably-better-icon.svg.
// Run from the repo root: node brand-trials/install-icons.mjs
// The "maskable" icon is the same mark drawn smaller, so nothing is lost when a phone cuts the icon
// to a circle or a rounded square (the safe area is the middle 80%).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'icons');
const svg = readFileSync(join(here, 'notably-better-icon.svg'), 'utf8');
const BG = '#0a0a0a';
const icons = [
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.8 },
];

const browser = await chromium.launch();
for (const icon of icons) {
  const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    html, body { margin: 0; background: ${BG}; width: ${icon.size}px; height: ${icon.size}px; overflow: hidden; }
    svg { display: block; width: ${icon.size}px; height: ${icon.size}px; transform: scale(${icon.scale}); transform-origin: center; }
  </style>${svg}`);
  await page.screenshot({ path: join(out, icon.file) });
  await page.close();
  console.log(icon.file);
}
await browser.close();
