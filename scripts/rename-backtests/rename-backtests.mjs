// ONE-OFF, for the release that renames the app: run with --db when the renamed code becomes the code
// everyone runs on dev (the back-test cases live in the dev database, shared with the main folder), then
// delete this folder.
// The back-test cases that say the old name, the Gmail address or use the name switch, brought up to
// the rename. Two ways to run it, from the worktree root:
//   node rename-backtests.mjs --files     patch tests/generated/tc_<id>.spec.ts only (nothing shared changes)
//   node --env-file=<root .env> rename-backtests.mjs --db   write the same scripts to test_cases on dev
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2];
const NEW_59 = fs.readFileSync(path.join(here, 'tc_59_new.ts'), 'utf8');

const EDITS = {
  9: [['getByText(/TheMusicLedger export/)', 'getByText(/Notably Better export/)']],
  43: [
    [`expect(invite.subject).toBe("You're invited to The Music Ledger");`, `expect(invite.subject).toBe("You're invited to Notably Better");`],
    [`expect(reset.subject).toBe('Your Music Ledger password');`, `expect(reset.subject).toBe('Your Notably Better password');`],
  ],
  47: [[`toContainText('themusicledgerapp@gmail.com')`, `toContainText('noreply@notablybetter.com')`]],
  57: [[`toBe('Confirm your new email address for The Music Ledger')`, `toBe('Confirm your new email address for Notably Better')`]],
  58: [[
    `    // the app's name on screen - one of three while a new name is tried out (ML-484), so ask which
    const NAMES: Record<string, string> = { 'music-ledger': 'The Music Ledger', 'notably-better': 'Notably Better', fivetto: 'Fivetto' };
    const brand = (await (await page.request.get('/api/brand')).json()).brand as string;
    await expect(page.locator('#topTitle')).toHaveText(NAMES[brand]);`,
    `    await expect(page.locator('#topTitle')).toHaveText('Notably Better'); // the app's name, at the top of Home`,
  ]],
  66: [['" from The Music Ledger`', '" from Notably Better`']],
};
const TITLE_59 = 'The app is called Notably Better: the sign-in screen, Home, the rail, the tab, the installed app and the legal pages';
const PASSES_59 = 'Signed out, the sign-in picture, the tab title and icon and the manifest say Notably Better and every icon loads. /api/brand and /api/admin/brand answer 404 and the admin menu has no App name. Signed in, Home shows the name with its mark and other screens show their own name. On a wide screen the rail carries the mark and the name, and the mark alone when folded. The privacy policy and the terms have the new name and hello@notablybetter.com, name Brevo and Fasthosts, give no Gmail address and say the app was called The Music Ledger until October 2026.';

const patch = (id, script) => {
  let s = script;
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  for (const [a, b] of EDITS[id]) {
    const from = a.replace(/\r?\n/g, nl), to = b.replace(/\r?\n/g, nl);
    if (!s.includes(from)) throw new Error(`case ${id}: text not found: ${a.slice(0, 60)}`);
    s = s.split(from).join(to);
  }
  return s;
};

if (mode === '--files') {
  for (const id of Object.keys(EDITS)) {
    const file = `tests/generated/tc_${id}.spec.ts`;
    fs.writeFileSync(file, patch(id, fs.readFileSync(file, 'utf8')));
    console.log('patched', file);
  }
  const f59 = 'tests/generated/tc_59.spec.ts';
  const head = fs.readFileSync(f59, 'utf8').split(/\r?\n/).slice(0, 2).join('\n'); // the TEST_CASE_ID and FEATURES lines
  fs.writeFileSync(f59, `${head}\n${NEW_59}`);
  console.log('rewrote', f59);
} else if (mode === '--db') {
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('this writes to the dev branch only');
  const require = createRequire(path.join(process.cwd(), 'server/'));
  const pg = require('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  for (const id of Object.keys(EDITS)) {
    const { rows } = await pool.query('SELECT script FROM test_cases WHERE id = $1', [id]);
    await pool.query('UPDATE test_cases SET script = $1, updated_at = now() WHERE id = $2', [patch(id, rows[0].script), id]);
    console.log('updated case', id);
  }
  await pool.query('UPDATE test_cases SET script = $1, title = $2, passes_if_criteria = $3, updated_at = now() WHERE id = 59', [NEW_59, TITLE_59, PASSES_59]);
  console.log('rewrote case 59');
  await pool.end();
} else {
  console.log('say --files or --db');
}
