// ML-246: a piece read from a photo or PDF, for an account - what sits between the routes and the reader
// (pieceReader.js, which stores nothing). It fetches the uploaded pages from the file store and deletes them
// again, turns the read's time signatures into the account's own, and keeps the log: every read (what the
// reader said, what it cost), then the piece as it was finally saved and what differed. A read whose file
// the owner keeps is a test case, and can be read again later (Admin -> Photo reads).
// docs/piece-from-photo.md.

import { del, list } from '@vercel/blob';
import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';
import { createCustomTimeSignature } from './timeSignatures.js';
import { isOwnBlobUrl, readCappedBody } from './musicXmlImport.js';
import { assertFlowAccess } from './flows.js';
import { getLimit } from './features.js';
import { readPieceFromFiles, PieceRead, READ_VERSION, readerModel, mediaTypeOf, MAX_READ_BYTES, MAX_READ_FILES } from './pieceReader.js';

// Where the browser puts the pages: read once and deleted. And where a kept test's pages stay.
export const readUploadPrefix = (accountId) => `piece-read/${accountId}/`;
export const testUploadPrefix = (accountId) => `piece-read-tests/${accountId}/`;
export const READ_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SAVED_JSON = 80000;

// The model's list price in US dollars per million units in and out, as read on Vercel's model list on
// 10 Oct 2026 - for the estimate on Admin -> Photo reads only. Vercel's own page is the bill.
const PRICES = { 'anthropic/claude-opus-5.5': [4, 20] };
export function costUsd(model, unitsIn, unitsOut) {
  const p = PRICES[model];
  return p ? (unitsIn * p[0] + unitsOut * p[1]) / 1e6 : null;
}

// The allowance: how many reads one person can have a quarter, by account type (the feature limit
// photo_reads_per_quarter - Admin -> Feature access). A quarter is a calendar quarter in UK time, and only a
// read that gave an answer counts: not one that failed, not a "Read again" of a kept test, and (ML-645, the owner
// 28 Oct 2026) not one the member stopped waiting for - only when a result is returned.
const QUARTER_START = "date_trunc('quarter', now() AT TIME ZONE 'Europe/London')";
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sayDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
export async function readAllowance(accountId) {
  const [limit, { rows }] = await Promise.all([
    getLimit('photo_reads_per_quarter', 0),
    pool.query(
      `SELECT count(*)::int AS used, to_char(${QUARTER_START} + interval '3 months', 'YYYY-MM-DD') AS next
         FROM piece_reads WHERE account_id = $1 AND status = 'read' AND cancelled_at IS NULL AND created_at >= ${QUARTER_START} AT TIME ZONE 'Europe/London'`, [accountId])
  ]);
  const allowed = Number.isFinite(limit) && limit >= 0 ? limit : 0;
  return { limit: allowed, used: rows[0].used, left: Math.max(0, allowed - rows[0].used), startsAgainOn: rows[0].next };
}
// Refuses before the pages are sent, and again before they are read.
export async function assertReadLeft(accountId) {
  const a = await readAllowance(accountId);
  if (a.left > 0) return a;
  throw withStatus(409, a.limit === 0
    ? "Reading a piece from a photo isn't included on your account."
    : `You have used this quarter's ${a.limit} photo reads. They reset on ${sayDay(a.startsAgainOn)}.`);
}

// Only ever this app's own file store, at the pathname the upload returned, under the folder this account
// was given a token for (the same guard as "Import from MusicXML" - ML-192).
export function checkedFiles(files, prefix) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) throw withStatus(400, 'There is no photo or PDF to read.');
  if (list.length > MAX_READ_FILES) throw withStatus(413, `That is more than ${MAX_READ_FILES} photos - send the piece in fewer, or as one PDF.`);
  return list.map(f => {
    const url = f && f.blobUrl, pathname = f && f.blobPathname;
    if (!isOwnBlobUrl(url, pathname) || !String(pathname).startsWith(prefix)) throw withStatus(400, "That doesn't look like a file uploaded to this app.");
    return { url, pathname };
  });
}

// ML-553: the pages are read and deleted - also when a read is refused or fails before it starts (the daily
// limit, a file that fails its check), when one of several uploads failed, or when the tab was closed between
// the upload and the read. discardReadFiles deletes the pages an account sent (only its own, in its own read
// folder); sweepReadUploads is the daily job's clear-out of anything left in the read folders after a day, and
// clears one account's folder when the account is deleted. A super admin's kept tests (piece-read-tests/) are
// never touched.
export async function discardReadFiles(accountId, rawFiles) {
  const prefix = readUploadPrefix(accountId);
  const urls = (Array.isArray(rawFiles) ? rawFiles : [])
    .filter(f => f && isOwnBlobUrl(f.blobUrl, f.blobPathname) && String(f.blobPathname).startsWith(prefix))
    .map(f => f.blobUrl);
  if (urls.length) await del(urls).catch(() => {});
}
export async function sweepReadUploads({ prefix = 'piece-read/', olderThanMs = 24 * 60 * 60 * 1000, now = Date.now() } = {}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !prefix.startsWith('piece-read/')) return { removed: 0 };
  let cursor;
  let removed = 0;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    const old = page.blobs.filter(b => now - new Date(b.uploadedAt).getTime() > olderThanMs).map(b => b.url);
    if (old.length) { await del(old); removed += old.length; }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return { removed };
}

async function fetchBuffers(files) {
  const buffers = [];
  let total = 0;
  for (const f of files) {
    const response = await fetch(f.url, { redirect: 'error' }).catch(() => null);
    if (!response?.ok) throw withStatus(422, "Couldn't read the uploaded file - try again.");
    const buffer = await readCappedBody(response, MAX_READ_BYTES, 'That file is larger than this can read.');
    total += buffer.length;
    if (total > MAX_READ_BYTES) throw withStatus(413, 'Those files are larger than this can read in one go.');
    buffers.push(buffer);
  }
  return buffers;
}

// The read's time signatures ("3/4") as the app's own keys: the shared list first, else one of the
// account's own (made if it isn't there, as typing it into Quick entry would). One the app can't have -
// a 1 or a 32 underneath - has no key: its bars take the piece's main time, and the caller says so.
async function sigKeys(accountId, sigs) {
  const keys = new Map();
  for (const s of sigs) {
    const { rows } = await pool.query(
      'SELECT id FROM time_signature_options WHERE numerator = $1 AND denominator = $2 AND active = true LIMIT 1', [s.beats, s.beatType]);
    if (rows.length) { keys.set(s.key, `public:${Number(rows[0].id)}`); continue; }
    try { keys.set(s.key, `custom:${(await createCustomTimeSignature(accountId, s.beats, s.beatType)).id}`); } catch { keys.set(s.key, null); }
  }
  return keys;
}
export function outlineWithKeys(o, keys) {
  const lost = [];
  const main = keys.get(o.mainSig) || [...keys.values()].find(Boolean) || null;
  const time = {};
  Object.entries(o.time || {}).forEach(([bar, sig]) => {
    const key = keys.get(sig);
    if (!key) lost.push(Number(bar));
    else if (key !== main) time[bar] = key;
  });
  if (!keys.get(o.mainSig)) lost.push(1);
  return { o: { ...o, mainSig: main, time }, lost };
}

// ---- ML-645: the waiting screen ----
// How many pages a PDF has, as well as can be told without a PDF library: each page object says "/Type /Page"
// (the tree of them "/Pages"); where those are packed away, the page tree's "/Count n". Null when it can't tell.
export function countPdfPages(buffer) {
  const text = Buffer.from(buffer).toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
  if (pages) return pages;
  const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : null;
}
// How long a read like this usually takes, in seconds: the middle of the last successful reads with the same model and
// prompt, the same kind of file and about the same size (photos: how many; a PDF: its pages, or else its size). With
// fewer than 5 of those to go on, a starting guess - a photo about 45 s, a PDF about a minute, plus some for each extra
// photo, page or MB. Never more than the reader is given (PIECE_READER_TIMEOUT_MS, 270 s).
const LIKE_READS = 5;
export function estimateFrom(rows, { kind, files = 1, bytes = 0, pages = null }) {
  const similar = kind === 'photos' ? rows.filter((r) => r.file_count === files)
    : pages ? rows.filter((r) => r.pages && Math.abs(r.pages - pages) <= 1)
    : rows.filter((r) => bytes && r.file_bytes >= bytes / 2 && r.file_bytes <= bytes * 2);
  if (similar.length >= LIKE_READS) {
    const ms = similar.map((r) => Number(r.ms)).sort((a, b) => a - b);
    return { seconds: Math.min(270, Math.round(ms[Math.floor(ms.length / 2)] / 1000)), from: 'reads' };
  }
  const guess = kind === 'photos' ? 45 + 30 * (Math.max(1, files) - 1)
    : pages ? 60 + 30 * (pages - 1) : 60 + 40 * Math.max(0, bytes / (1024 * 1024) - 0.5);
  return { seconds: Math.min(270, Math.round(guess)), from: 'guess' };
}
export async function readEstimate(ask) {
  const kind = ask.kind === 'pdf' ? 'pdf' : 'photos';
  const { rows } = await pool.query(
    `SELECT ms, file_count, file_bytes, pages FROM piece_reads
      WHERE status = 'read' AND cancelled_at IS NULL AND model = $1 AND prompt_version = $2 AND file_kind = $3
      ORDER BY created_at DESC LIMIT 200`, [readerModel(), READ_VERSION, kind]);
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  return estimateFrom(rows, { kind, files: n(ask.files) || 1, bytes: n(ask.bytes) || 0, pages: n(ask.pages) });
}
// The member stopped waiting - while sending (nothing is read) or while reading (the read may still finish here: it
// is then marked, and doesn't count). Every stop is kept, so Admin -> Photo reads can count them.
const REF = /^[A-Za-z0-9-]{8,64}$/;
export async function stopRead(accountId, { ref, stage, waitedMs } = {}) {
  if (!REF.test(String(ref || ''))) throw withStatus(400, 'Which read?');
  const at = stage === 'sending' ? 'sending' : 'reading';
  await pool.query('INSERT INTO piece_read_stops (account_id, client_ref, stage, waited_ms) VALUES ($1, $2, $3, $4)',
    [accountId, ref, at, Math.max(0, Math.min(3600000, Math.round(Number(waitedMs) || 0)))]);
  await pool.query('UPDATE piece_reads SET cancelled_at = now() WHERE client_ref = $1 AND account_id = $2 AND cancelled_at IS NULL', [ref, accountId]);
  return { stopped: true };
}

// Reads the uploaded pages for an account. Returns { readId, ms, pieces: [{ index, about, outline, rating }] }.
// ML-645: clientRef - the browser's reference for this read (to stop it); estimateMs - what its waiting screen said.
// ML-529: with joinMovements, the movements of one work also come as one piece in movements - the last entry,
// with `whole: true` and its own index (it is logged as a piece found, like the others).
// The pages are deleted from the file store whatever happens. A failure is logged too - a read that the
// gateway refused or that found no music is part of how well this works.
export async function readForAccount(accountId, rawFiles, { joinMovements = false, clientRef = null, estimateMs = null } = {}) {
  const ref = REF.test(String(clientRef || '')) ? String(clientRef) : null;
  const estimate = Number.isFinite(Number(estimateMs)) && Number(estimateMs) > 0 ? Math.round(Number(estimateMs)) : null;
  const files = checkedFiles(rawFiles, readUploadPrefix(accountId));
  let buffers = [];
  let result;
  try {
    buffers = await fetchBuffers(files);
    result = await readPieceFromFiles(buffers);
  } catch (error) {
    await pool.query(
      `INSERT INTO piece_reads (account_id, status, failure, model, prompt_version, file_count, file_bytes) VALUES ($1, 'failed', $2, $3, $4, $5, $6)`,
      [accountId, String(error.message || 'failed').slice(0, 300), readerModel(), READ_VERSION, files.length, buffers.reduce((n, b) => n + b.length, 0)]
    ).catch(() => {});
    throw error;
  } finally {
    del(files.map(f => f.url)).catch(() => {}); // nothing waits for it, and a file left behind is in a folder of its own
  }

  const kind = mediaTypeOf(buffers[0]) === 'application/pdf' ? 'pdf' : 'photos';
  const pages = kind === 'pdf' ? countPdfPages(buffers[0]) : files.length; // ML-645: for the next estimates
  // ML-645: stopped before it got here - logged, and marked so it doesn't count
  const stopped = ref ? (await pool.query('SELECT 1 FROM piece_read_stops WHERE client_ref = $1 AND account_id = $2', [ref, accountId])).rows.length > 0 : false;
  const { rows } = await pool.query(
    `INSERT INTO piece_reads (account_id, status, model, prompt_version, file_kind, file_count, file_bytes, units_in, units_out, ms, pages, estimate_ms, client_ref, cancelled_at)
     VALUES ($1, 'read', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CASE WHEN $13 THEN now() END) RETURNING id`,
    [accountId, result.model, READ_VERSION, kind, files.length, buffers.reduce((n, b) => n + b.length, 0), result.usage.inputTokens, result.usage.outputTokens, result.ms, pages, estimate, ref, stopped]);
  const readId = Number(rows[0].id);

  const pieces = [];
  const found = joinMovements && result.whole ? [...result.pieces, result.whole] : result.pieces;
  for (const [index, p] of found.entries()) {
    const { o, lost } = outlineWithKeys(p.outline, await sigKeys(accountId, p.sigs));
    const rating = lost.length
      ? { level: 'low', checks: [{ level: 'low', kind: 'time', from: Math.min(...lost), to: Math.max(...lost), text: `A time signature was read that the app can't use (bar ${Math.min(...lost)}). Those bars were put in the piece's main time: set them by hand.` }, ...p.rating.checks] }
      : p.rating;
    await pool.query(
      `INSERT INTO piece_read_pieces (read_id, piece_index, title, bars, rating, read, outline, checks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [readId, index, p.about.name || null, o.bars, rating.level, JSON.stringify(p.read), JSON.stringify(o), JSON.stringify(rating.checks)]);
    pieces.push({ index, about: p.about, outline: o, rating, ...(p === result.whole ? { whole: true, movements: o.movements.length } : {}) });
  }
  return { readId, ms: result.ms, pieces };
}

async function ownRead(accountId, readId) {
  const { rows } = await pool.query('SELECT id, test_files FROM piece_reads WHERE id = $1 AND account_id = $2', [readId, accountId]);
  if (!rows.length) throw withStatus(404, 'That read was not found.');
  return rows[0];
}

// The piece has been saved in Quick entry: keep the outline as saved and what differed from the read.
// testFiles (the owner's "Keep this as a test"): the pages, uploaded again to the tests folder.
// ML-639: checkAnswers - what the member did with each check: agreed, agreedAll, changed, checked or open. Only those
// states, and only as many as there are checks, are kept.
const ANSWER_STATES = ['agreed', 'agreedAll', 'changed', 'checked', 'open'];
export function cleanAnswers(answers) {
  if (!Array.isArray(answers)) return null;
  return answers.slice(0, 200).filter((a) => a && ANSWER_STATES.includes(a.state)).map((a) => ({
    id: Number(a.id) || 0, kind: String(a.kind || '').slice(0, 30), step: String(a.step || '').slice(0, 30), state: a.state,
    from: Number.isInteger(a.from) ? a.from : null, to: Number.isInteger(a.to) ? a.to : null
  }));
}
export async function markSaved(accountId, readId, index, { flowId, saved, testFiles, checkAnswers = null } = {}) {
  await ownRead(accountId, readId);
  const { rows } = await pool.query('SELECT id, outline FROM piece_read_pieces WHERE read_id = $1 AND piece_index = $2', [readId, Number(index)]);
  if (!rows.length) throw withStatus(404, 'That read was not found.');
  if (!saved || typeof saved !== 'object' || !Number.isInteger(saved.bars) || saved.bars < 1 || JSON.stringify(saved).length > MAX_SAVED_JSON) throw withStatus(400, 'The saved piece was not sent.');
  await assertFlowAccess(accountId, flowId);
  let changes = null;
  try { changes = PieceRead.compare(rows[0].outline, saved); } catch { /* an outline the rules can't compare: kept, with no count */ }
  const answers = cleanAnswers(checkAnswers);
  await pool.query('UPDATE piece_read_pieces SET score_id = $1, saved = $2, saved_at = now(), changes = $3, check_answers = $5 WHERE id = $4',
    [flowId, JSON.stringify(saved), changes ? JSON.stringify(changes) : null, rows[0].id, answers ? JSON.stringify(answers) : null]);
  if (testFiles) {
    const kept = checkedFiles(testFiles, testUploadPrefix(accountId));
    await pool.query('UPDATE piece_reads SET test_files = $1, test_kept_at = now() WHERE id = $2', [JSON.stringify(kept), readId]);
  }
  return { changes, test: !!testFiles };
}

// ---------- Admin -> Photo reads ----------
const pieceRow = (r) => ({
  id: Number(r.id), index: r.piece_index, title: r.title, bars: r.bars, rating: r.rating, checks: r.checks,
  flowId: r.score_id ? Number(r.score_id) : null, savedAt: r.saved_at, savedBars: r.saved ? r.saved.bars : null, changes: r.changes, checkedAt: r.checked_at,
  answers: r.check_answers || null // ML-639
});

export async function listReads() {
  const reads = (await pool.query(
    `SELECT r.*, COALESCE(a.display_name, a.first_name) AS account_name FROM piece_reads r JOIN accounts a ON a.id = r.account_id ORDER BY r.created_at DESC LIMIT 300`)).rows;
  const ids = reads.map(r => r.id);
  const pieces = ids.length ? (await pool.query('SELECT * FROM piece_read_pieces WHERE read_id = ANY($1) ORDER BY read_id, piece_index', [ids])).rows : [];
  const reruns = ids.length ? (await pool.query('SELECT * FROM piece_read_reruns WHERE read_id = ANY($1) ORDER BY created_at DESC', [ids])).rows : [];
  const list = reads.map(r => ({
    id: Number(r.id), at: r.created_at, who: r.account_name, status: r.status, failure: r.failure, model: r.model, promptVersion: r.prompt_version,
    fileKind: r.file_kind, fileCount: r.file_count, unitsIn: r.units_in, unitsOut: r.units_out, seconds: Math.round(r.ms / 1000),
    costUsd: costUsd(r.model, r.units_in, r.units_out), isTest: !!r.test_files,
    pages: r.pages, estimateSeconds: r.estimate_ms ? Math.round(r.estimate_ms / 1000) : null, stoppedAt: r.cancelled_at, // ML-645
    pieces: pieces.filter(p => String(p.read_id) === String(r.id)).map(pieceRow),
    reruns: reruns.filter(x => String(x.read_id) === String(r.id)).map(x => ({ id: Number(x.id), at: x.created_at, status: x.status, failure: x.failure, model: x.model, promptVersion: x.prompt_version, seconds: Math.round(x.ms / 1000), costUsd: costUsd(x.model, x.units_in, x.units_out), pieces: x.pieces }))
  }));
  // ML-645: every stop (the owner, 28 Oct 2026: measure how often it happens)
  const stops = (await pool.query(
    `SELECT stage, waited_ms, created_at,
            created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' AS this_month,
            created_at >= date_trunc('quarter', now() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' AS this_quarter
       FROM piece_read_stops ORDER BY created_at DESC LIMIT 2000`)).rows;
  return { reads: list, summary: summarise(list, stops), model: readerModel(), promptVersion: READ_VERSION };
}
// ML-645: stops this month, this quarter and in all - while sending and while reading - how long people had waited
// (the middle one), and what the reads that were stopped but still finished cost
export function summariseStops(stops, reads) {
  const middle = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const of = (list) => ({
    sending: list.filter((s) => s.stage === 'sending').length,
    reading: list.filter((s) => s.stage === 'reading').length,
    waitedSeconds: list.length ? Math.round(middle(list.map((s) => Number(s.waited_ms))) / 1000) : null
  });
  const stoppedCosts = reads.filter((r) => r.stoppedAt && r.costUsd !== null).map((r) => r.costUsd);
  return {
    month: of(stops.filter((s) => s.this_month)), quarter: of(stops.filter((s) => s.this_quarter)), all: of(stops),
    costUsd: stoppedCosts.reduce((n, c) => n + c, 0)
  };
}

// How it is doing: reads and what they cost, then - of the pieces saved - how many needed no change, and
// how many had the right number of bars, for each rating. That last table is whether the rating is useful.
// ML-639: for each kind of check, how often it was agreed (one by one or with Agree all), changed, checked or left open -
// whether the reader's guesses of that kind are any good
export function summariseAnswers(savedPieces) {
  const byKind = {};
  for (const p of savedPieces) for (const a of p.answers || []) {
    const k = byKind[a.kind] || (byKind[a.kind] = { kind: a.kind, agreed: 0, agreedAll: 0, changed: 0, checked: 0, open: 0 });
    if (a.state in k) k[a.state] += 1;
  }
  return Object.values(byKind).sort((x, y) => x.kind.localeCompare(y.kind));
}
export function summarise(reads, stops = []) {
  const done = reads.filter(r => r.status === 'read');
  const saved = done.flatMap(r => r.pieces).filter(p => p.savedAt && p.changes);
  const byRating = ['high', 'medium', 'low'].map(level => {
    const of = saved.filter(p => p.rating === level);
    return { level, saved: of.length, same: of.filter(p => p.changes.same).length, barsRight: of.filter(p => p.changes.bars[0] === p.changes.bars[1]).length };
  });
  const costs = done.map(r => r.costUsd).filter(c => c !== null);
  return {
    reads: reads.length, failed: reads.length - done.length, pieces: done.reduce((n, r) => n + r.pieces.length, 0), saved: saved.length, tests: reads.filter(r => r.isTest).length,
    costUsd: costs.reduce((n, c) => n + c, 0), costPerRead: costs.length ? costs.reduce((n, c) => n + c, 0) / costs.length : null,
    seconds: done.length ? Math.round(done.reduce((n, r) => n + r.seconds, 0) / done.length) : null, byRating,
    stopped: summariseStops(stops, reads), // ML-645
    answers: summariseAnswers(saved) // ML-639
  };
}

export async function setChecked(pieceId, on) {
  const { rowCount } = await pool.query('UPDATE piece_read_pieces SET checked_at = $1 WHERE id = $2 AND saved IS NOT NULL', [on ? new Date() : null, pieceId]);
  if (!rowCount) throw withStatus(404, 'Only a saved piece can be marked as checked.');
}

// A kept test read again with whatever prompt and model are set now. Its pieces are compared with the
// pieces as saved (by position in the file), and it is kept beside the first read - never over it.
export async function rerunRead(readId) {
  const { rows } = await pool.query('SELECT id, account_id, test_files FROM piece_reads WHERE id = $1', [readId]);
  if (!rows.length || !rows[0].test_files) throw withStatus(404, 'That read has no file kept to read again.');
  const accountId = rows[0].account_id;
  const files = checkedFiles(rows[0].test_files.map(f => ({ blobUrl: f.url, blobPathname: f.pathname })), testUploadPrefix(accountId));
  const savedRows = (await pool.query('SELECT piece_index, saved FROM piece_read_pieces WHERE read_id = $1', [readId])).rows;
  let result;
  try {
    result = await readPieceFromFiles(await fetchBuffers(files));
  } catch (error) {
    await pool.query(`INSERT INTO piece_read_reruns (read_id, status, failure, model, prompt_version) VALUES ($1, 'failed', $2, $3, $4)`,
      [readId, String(error.message || 'failed').slice(0, 300), readerModel(), READ_VERSION]);
    throw error;
  }
  const pieces = [];
  // A read saved as one piece in movements is read again the same way (its index is after the pieces).
  const found = result.whole && savedRows.some(s => s.piece_index >= result.pieces.length) ? [...result.pieces, result.whole] : result.pieces;
  for (const [index, p] of found.entries()) {
    const { o } = outlineWithKeys(p.outline, await sigKeys(accountId, p.sigs));
    const saved = savedRows.find(s => s.piece_index === index)?.saved || null;
    let changes = null;
    if (saved) { try { changes = PieceRead.compare(o, saved); } catch { /* not comparable */ } }
    pieces.push({ title: p.about.name || null, bars: o.bars, rating: p.rating.level, outline: o, changes });
  }
  await pool.query(
    `INSERT INTO piece_read_reruns (read_id, status, model, prompt_version, units_in, units_out, ms, pieces) VALUES ($1, 'read', $2, $3, $4, $5, $6, $7)`,
    [readId, result.model, READ_VERSION, result.usage.inputTokens, result.usage.outputTokens, result.ms, JSON.stringify(pieces)]);
  return { pieces: pieces.map(({ outline, ...rest }) => rest), seconds: Math.round(result.ms / 1000), costUsd: costUsd(result.model, result.usage.inputTokens, result.usage.outputTokens) };
}

// Taking a kept test's pages out of the file store (the read itself stays in the log).
export async function dropTestFiles(readId) {
  const { rows } = await pool.query('SELECT test_files FROM piece_reads WHERE id = $1', [readId]);
  if (!rows.length || !rows[0].test_files) throw withStatus(404, 'That read has no file kept.');
  await del(rows[0].test_files.map(f => f.url)).catch(() => {});
  await pool.query('UPDATE piece_reads SET test_files = NULL, test_kept_at = NULL WHERE id = $1', [readId]);
}
