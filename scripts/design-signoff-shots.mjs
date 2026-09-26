#!/usr/bin/env node
// ML-198: pictures for the design sign-off. The owner signs off on what they can see, not on a list
// of class names, so before asking for sign-off Claude runs this and sends the pictures in the chat.
//
//   npm run design-signoff            (the local server must be running: npm run dev)
//
// 1. Runs the design gate, which writes public/design-new.json (everything new since origin/sandbox).
// 2. Opens Admin -> Design on the local server with "Only what's new" switched on - each example that
//    uses something new is marked NEW with the new classes it uses; the panel at the top lists new
//    tokens and any new class no example shows yet.
// 3. Saves light and dark screenshots to design-signoff/ (gitignored), split into pages a phone can read.
//
// The local test account (local-dev@themusicledger.local) is raised to super_admin to open the admin
// panel and put back afterwards. dev branch only (NEON_BRANCH=dev from .env) - never production.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.SIGNOFF_BASE_URL || 'http://localhost:3000';
const OUT = path.join(ROOT, 'design-signoff');
const EMAIL = 'local-dev@themusicledger.local';
const PAGE_HEIGHT = 2400; // CSS px per picture

if (process.env.NEON_BRANCH !== 'dev') {
    console.error(`design-signoff: NEON_BRANCH is "${process.env.NEON_BRANCH || ''}", not "dev" - it only runs against the dev branch (see docs/environments.md).`);
    process.exit(1);
}

const gate = spawnSync(process.execPath, [path.join(ROOT, 'scripts/design-gate.mjs')], { cwd: ROOT, encoding: 'utf8' });
if (gate.status === 1) { console.error(gate.stdout); console.error('design-signoff: the hard checks fail - fix those first.'); process.exit(1); }
if (!fs.existsSync(path.join(ROOT, 'public/design-new.json'))) { console.error(gate.stdout); console.error('design-signoff: no public/design-new.json - is origin/sandbox fetched?'); process.exit(1); }
const whatsNew = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/design-new.json'), 'utf8'));

try { await fetch(BASE_URL); } catch { console.error(`design-signoff: nothing at ${BASE_URL} - start the local server (npm run dev) first.`); process.exit(1); }

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows } = await db.query('SELECT account_level FROM accounts WHERE email = $1', [EMAIL]);
if (!rows.length) { console.error(`design-signoff: ${EMAIL} has no account yet - log in locally once first.`); process.exit(1); }
const previousLevel = rows[0].account_level;
await db.query("UPDATE accounts SET account_level = 'super_admin' WHERE email = $1", [EMAIL]);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const files = [];
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1.5 });
    await page.goto(`${BASE_URL}/auth/login`);
    await page.goto(`${BASE_URL}/admin.html`);
    await page.locator('.admin-nav-item[data-section="design"]').click();
    await page.locator('#designWhatsNew').waitFor({ timeout: 20000 });
    await page.locator('label:has(#designOnlyNew) .toggle-switch').click();
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['light', 'dark']) {
        await page.locator(`.admin-design-theme [data-theme="${theme}"]`).click();
        await page.waitForTimeout(500);
        const box = await page.locator('#designCatalogue').boundingBox();
        const pages = Math.ceil(box.height / PAGE_HEIGHT);
        for (let i = 0; i < pages; i++) {
            const file = path.join(OUT, `whats-new-${theme}-${i + 1}-of-${pages}.png`);
            await page.screenshot({ path: file, fullPage: true, clip: { x: box.x, y: box.y + i * PAGE_HEIGHT, width: box.width, height: Math.min(PAGE_HEIGHT, box.height - i * PAGE_HEIGHT) } });
            files.push(file);
        }
    }
} finally {
    await browser.close();
    await db.query('UPDATE accounts SET account_level = $1 WHERE email = $2', [previousLevel, EMAIL]);
    await db.end();
}

console.log(`What's new since ${whatsNew.base}: ${whatsNew.classes.length} classes, ${whatsNew.tokens.length} tokens, ${whatsNew.specsNew.length} new specs, ${whatsNew.specsChanged.length} changed specs.`);
console.log('Pictures (send these with the sign-off list):');
files.forEach(f => console.log('  ' + path.relative(ROOT, f)));
