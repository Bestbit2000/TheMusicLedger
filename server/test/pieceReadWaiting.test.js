// ML-645: the waiting screen while a photo or PDF is read - the estimate, a PDF's pages, the stopped reads Admin ->
// Photo reads counts, and (the owner, 28 Oct 2026) a read counts against the allowance only when it gives a result.
// The sums need no database; the allowance is checked against the dev database:
//   node --env-file=../.env --test test/pieceReadWaiting.test.js      (from server/)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { estimateFrom, countPdfPages, summariseStops, summariseAnswersByLevel } = await import('../services/pieceReads.js');

test('the estimate: the middle of 5 or more reads like it, else a starting guess, never past 270 s', () => {
  const photos = [30000, 40000, 50000, 60000, 90000].map((ms) => ({ ms, file_count: 1 }));
  assert.deepEqual(estimateFrom(photos, { kind: 'photos', files: 1 }), { seconds: 50, from: 'reads' });
  assert.deepEqual(estimateFrom(photos, { kind: 'photos', files: 2 }), { seconds: 75, from: 'guess' }, 'no two-photo reads yet: 45 s + 30 s');
  const pdfs = [70000, 80000, 90000, 100000, 110000].map((ms) => ({ ms, pages: 2, file_bytes: 500000 }));
  assert.equal(estimateFrom(pdfs, { kind: 'pdf', pages: 3 }).from, 'reads', 'a page either way is like it');
  assert.equal(estimateFrom(pdfs, { kind: 'pdf', pages: 6 }).seconds, 210, 'six pages: 60 s + 30 s for each extra');
  assert.equal(estimateFrom(pdfs, { kind: 'pdf', bytes: 600000 }).from, 'reads', 'no pages: by size, within half to double');
  assert.equal(estimateFrom([], { kind: 'pdf', pages: 40 }).seconds, 270, 'never more than the reader is given');
});

test("a PDF's pages: its page objects, else its page tree's count, else no answer", () => {
  assert.equal(countPdfPages(Buffer.from('%PDF-1.4 1 0 obj << /Type /Pages /Count 2 >> 2 0 obj << /Type /Page >> 3 0 obj << /Type/Page >>')), 2);
  assert.equal(countPdfPages(Buffer.from('%PDF-1.5 << /Type /Catalog >> << /Count 7 >> stream...')), 7);
  assert.equal(countPdfPages(Buffer.from('%PDF-1.5 nothing to see')), null);
});

test('stopped reads: this month, this quarter and all, by stage, how long people waited, and what they cost', () => {
  const stops = [
    { stage: 'sending', waited_ms: 4000, this_month: true, this_quarter: true },
    { stage: 'reading', waited_ms: 60000, this_month: true, this_quarter: true },
    { stage: 'reading', waited_ms: 100000, this_month: false, this_quarter: true },
    { stage: 'reading', waited_ms: 30000, this_month: false, this_quarter: false }
  ];
  const s = summariseStops(stops, [{ stoppedAt: new Date(), costUsd: 0.05 }, { stoppedAt: null, costUsd: 0.04 }, { stoppedAt: new Date(), costUsd: 0.07 }]);
  assert.deepEqual(s.month, { sending: 1, reading: 1, waitedSeconds: 60 });
  assert.deepEqual(s.quarter, { sending: 1, reading: 2, waitedSeconds: 60 });
  assert.deepEqual(s.all, { sending: 1, reading: 3, waitedSeconds: 60 });
  assert.ok(Math.abs(s.costUsd - 0.12) < 1e-9, 'only the stopped reads');
});

// ---------- against the dev database ----------
const skip = !onDev && 'needs the dev database';
const stamp = Date.now();
let pool;
let accountId = null;
if (onDev) ({ default: pool } = await import('../config/db.js'));
after(async () => {
  if (!onDev) return;
  if (accountId) {
    await pool.query('DELETE FROM piece_read_stops WHERE account_id = $1', [accountId]).catch(() => {});
    await pool.query('DELETE FROM piece_reads WHERE account_id = $1', [accountId]).catch(() => {});
    await pool.query('DELETE FROM accounts WHERE id = $1', [accountId]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('a stopped read never counts against the allowance - stopped before or after it was logged', { skip }, async () => {
  const { readAllowance, stopRead } = await import('../services/pieceReads.js');
  accountId = Number((await pool.query(`INSERT INTO accounts (email, first_name, surname, account_level) VALUES ($1, 'Wait', 'Test', 'super_admin') RETURNING id`, [`ml645-${stamp}@themusicledger.local`])).rows[0].id);
  const log = (ref) => pool.query(`INSERT INTO piece_reads (account_id, status, model, prompt_version, file_kind, file_count, ms, client_ref) VALUES ($1, 'read', 'm', 'v', 'pdf', 1, 60000, $2)`, [accountId, ref]);
  const used = async () => (await readAllowance(accountId)).used;
  await log(`ref-a-${stamp}`);
  assert.equal(await used(), 1, 'a read that gave a result counts');
  await stopRead(accountId, { ref: `ref-a-${stamp}`, stage: 'reading', waitedMs: 45000 });
  assert.equal(await used(), 0, 'stopped after it was logged: it no longer counts');
  // stopped while sending: nothing is read, but the stop is kept for Admin -> Photo reads
  await stopRead(accountId, { ref: `ref-b-${stamp}`, stage: 'sending', waitedMs: 3000 });
  const stops = (await pool.query('SELECT stage FROM piece_read_stops WHERE account_id = $1 ORDER BY id', [accountId])).rows.map((r) => r.stage);
  assert.deepEqual(stops, ['reading', 'sending']);
  await assert.rejects(stopRead(accountId, { ref: 'x', stage: 'reading' }), (e) => e.status === 400, 'a reference that is not one');
});
// ML-655: the check answers by the read's level, for Admin -> Photo reads
test('the answers by level: each level counts its own pieces and their answers', () => {
  const saved = [{ rating: 'high', answers: [{ state: 'agreed' }] }, { rating: 'low', answers: [{ state: 'changed' }, { state: 'changed' }, { state: 'open' }] }, { rating: 'low', answers: [] }];
  assert.deepEqual(summariseAnswersByLevel(saved), [
    { level: 'high', pieces: 1, agreed: 1, agreedAll: 0, changed: 0, checked: 0, open: 0 },
    { level: 'medium', pieces: 0, agreed: 0, agreedAll: 0, changed: 0, checked: 0, open: 0 },
    { level: 'low', pieces: 2, agreed: 0, agreedAll: 0, changed: 2, checked: 0, open: 1 }
  ]);
});
