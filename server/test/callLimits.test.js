// ML-476: the limit on repeated calls that cost something (limitCalls, passwordAuth.js), the 25 MB limit
// on a piece's files, and the lockfiles the build installs from. The first two run against a real
// database, only when pointed at the dev branch:
//   node --env-file=../.env --test test/callLimits.test.js      (from server/)
// Under plain `npm test` (no database) they are skipped. Everything they make belongs to a throwaway
// account, which is removed again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const { limitCalls } = await import('../services/passwordAuth.js');
const { addUploadedRecording, addDocument } = await import('../services/flows.js');
const { MAX_PIECE_FILE_BYTES } = await import('../services/blobUrls.js');

const stamp = Date.now();
const accounts = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const account = async (name) => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, $2, 'Test') RETURNING id`, [`ml476-${name}-${stamp}@themusicledger.local`, name])).id);
  accounts.push(id);
  return id;
};
const skip = !onDev && 'needs the dev database';

after(async () => {
  if (onDev) {
    await pool.query(`DELETE FROM auth_rate_events WHERE kind LIKE 'call:%' AND key = ANY($1)`, [accounts.map(String)]).catch(() => {});
    await pool.query('DELETE FROM scores WHERE owner_account_id = ANY($1)', [accounts]).catch(() => {});
    for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('the build installs from committed lockfiles', () => {
  const root = new URL('../../', import.meta.url);
  const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
  assert.match(JSON.parse(read('vercel.json')).buildCommand, /^npm ci && cd server && npm ci$/);
  assert.ok(!/^package-lock\.json$/m.test(read('.gitignore')), 'package-lock.json must not be ignored');
  for (const [lock, pkg] of [['package-lock.json', 'package.json'], ['server/package-lock.json', 'server/package.json']]) {
    const locked = JSON.parse(read(lock)).packages[''];
    const wanted = JSON.parse(read(pkg));
    // every package the app asks for is in its lockfile, at the same range (so `npm ci` won't refuse the build)
    assert.deepEqual(locked.dependencies || {}, wanted.dependencies || {}, `${lock} is out of step with ${pkg} - run npm install there and commit the lockfile`);
    assert.deepEqual(locked.devDependencies || {}, wanted.devDependencies || {}, `${lock} is out of step with ${pkg}`);
  }
});

test('a call that costs something is refused after its limit, per account, and says so in words', { skip }, async () => {
  const anna = await account('anna');
  const ben = await account('ben');
  for (let i = 0; i < 10; i++) await limitCalls('add-band', anna);
  await assert.rejects(limitCalls('add-band', anna), (e) => e.status === 429 && /a lot of bands added in a day - try again tomorrow/.test(e.message));
  await limitCalls('add-band', ben); // someone else's count is their own
  await limitCalls('feedback', anna); // and so is another kind of call
  await assert.rejects(limitCalls('made-up', anna), /No call limit/);
});

test('a recording or document bigger than 25 MB is refused when it is attached', { skip }, async () => {
  assert.equal(MAX_PIECE_FILE_BYTES, 25 * 1024 * 1024);
  const anna = await account('anna2');
  const piece = Number((await one(`INSERT INTO scores (title, owner_account_id) VALUES ('ML-476 piece', $1) RETURNING id`, [anna])).id);
  const file = { blobUrl: 'https://example.public.blob.vercel-storage.com/flows/1/recordings/x.mp3', blobPathname: 'flows/1/recordings/x.mp3', fileName: 'x.mp3', mimeType: 'audio/mpeg' };
  const tooBig = (e) => e.status === 413 && /bigger than 25 MB/.test(e.message);
  await assert.rejects(addUploadedRecording(anna, piece, { ...file, fileSizeBytes: MAX_PIECE_FILE_BYTES + 1 }), tooBig);
  await assert.rejects(addDocument(anna, piece, { ...file, fileSizeBytes: MAX_PIECE_FILE_BYTES + 1 }), tooBig);
  // (a file of the right size goes on to the "is this really this piece's file" check - blobUrls.test.js)
  await assert.rejects(addUploadedRecording(anna, piece, { ...file, fileSizeBytes: 1000 }), (e) => e.status !== 413);
});
