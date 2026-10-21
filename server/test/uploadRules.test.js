// Security re-check 21 Oct 2026: every upload of music asks the server that the member has confirmed the right to
// upload it (ML-278 - before, only the app asked), and every upload token holds the upload to its own folder.
// The account part runs against the dev database (node --env-file=../.env --test test/uploadRules.test.js from
// server/); under plain `npm test` it is skipped.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { default: pool } = await import('../config/db.js');
const { assertUploadRightsConfirmed, confirmUploadRights } = await import('../services/accounts.js');

const accounts = [];
after(async () => {
  if (onDev) for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  await pool.end().catch(() => {});
});

// The handler of each upload-token route, as written in api.js
const api = fs.readFileSync(new URL('../routes/api.js', import.meta.url), 'utf8');
const route = (path) => {
  const at = api.indexOf(`router.post('${path}'`);
  assert.ok(at > 0, path);
  return api.slice(at, api.indexOf('\n});', at));
};

test('every upload of music asks that the right to upload has been confirmed', () => {
  for (const path of ['/flows/:id/recordings/upload-token', '/flows/:id/documents/upload-token', '/flows/from-file/upload-token', '/recordings/upload-token', '/piece-read/upload-token']) {
    assert.match(route(path), /await assertUploadRightsConfirmed\(req\.accountId\)/, path);
  }
});

test('every upload token holds the upload to its own folder', () => {
  assert.match(route('/flows/:id/recordings/upload-token'), /assertUploadFolder\(pathname, `flows\/\$\{Number\(req\.params\.id\)\}\/recordings\/`\)/);
  assert.match(route('/flows/:id/documents/upload-token'), /assertUploadFolder\(pathname, `flows\/\$\{Number\(req\.params\.id\)\}\/documents\/`\)/);
  assert.match(route('/flows/from-file/upload-token'), /assertUploadFolder\(pathname, fromFileFolder\(req\.accountId\)\)/);
  assert.match(route('/recordings/upload-token'), /startsWith\(`recordings\/\$\{req\.accountId\}\/`\)/);
  assert.match(route('/piece-read/upload-token'), /readUploadPrefix\(req\.accountId\)/);
  assert.match(route('/account/bands/:id/logo/upload-token'), /band-logos\/\$\{bandId\}\//);
  // and the import reads only from the member's own import folder
  assert.match(route('/flows/from-file'), /startsWith\(fromFileFolder\(req\.accountId\)\)/);
});

// ML-574: the sign-in token goes to an upload-token route as a header, never in the address (where it reaches
// request logs and the browser's history). Every upload goes through uploadToStore, which adds the header.
test('the app sends the sign-in token for an upload as a header, not in the address', () => {
  const app = fs.readFileSync(new URL('../../public/app.js', import.meta.url), 'utf8');
  for (const m of app.matchAll(/handleUploadUrl:\s*`([^`]*)`/g)) assert.doesNotMatch(m[1], /token=/, m[1]);
  assert.ok([...app.matchAll(/handleUploadUrl:/g)].length >= 7, 'every upload found');
  assert.doesNotMatch(app.replace(/function uploadToStore[\s\S]*?\n {4}\}/, ''), /window\.vercelBlobUpload\(/, 'every upload goes through uploadToStore');
  assert.match(app, /function uploadToStore\(pathname, body, options\)[\s\S]*?Authorization: `Bearer \$\{auth\.token\}`/);
});

test('an account that has not confirmed is refused, and is let through once it has', { skip: !onDev && 'needs the dev database' }, async () => {
  const id = Number((await pool.query(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, 'Up', 'Load') RETURNING id`, [`upload-rules-${Date.now()}@themusicledger.local`])).rows[0].id);
  accounts.push(id);
  await assert.rejects(assertUploadRightsConfirmed(id), (e) => e.status === 409 && e.reason === 'needs-upload-rights');
  await confirmUploadRights(id);
  await assertUploadRightsConfirmed(id);
});
