// Sheets-to-database cutover (see docs/sheets-to-database-cutover.md).
// Nothing here calls the Google Sheets API any more - every route in this
// file is now Postgres-backed, which also means the old per-request Google
// access-token refresh dance (X-Refreshed-Token) is gone: there's nothing
// left in this file that needs a Google token at all.

import express from 'express';
import { requireAuth, resolveAccount } from '../middleware/auth.js';
import pool from '../config/db.js';
import { listBands, getOrCreateBand, renameBand, isBandUsedInHistory, archiveOrDeleteBand, unarchiveBand } from '../services/bands.js';
import { listTutors, getOrCreateTutor, renameTutor, isTutorUsedInHistory, archiveOrDeleteTutor, unarchiveTutor } from '../services/tutors.js';
import { listDurationOptions } from '../services/durationOptions.js';
import { listTimeSignatureOptions, createCustomTimeSignature, listCustomTimeSignaturesWithUsage, setCustomTimeSignatureActive, deleteCustomTimeSignature } from '../services/timeSignatures.js';
import { listAdhocSetups, createAdhocSetup, renameAdhocSetup, saveAdhocSetup, deleteAdhocSetup, getAdhocSetupWithSegments, getOrCreateScratchSetup, createNamedAdhocSetup, duplicateAdhocSetup } from '../services/metronomeSetups.js';
import { createSegment, updateSegment, deleteSegment } from '../services/metronomeSegments.js';

const router = express.Router();

// The sheet's category names (British "Practise") vs the schema's
// session_type enum (American "practice") - one explicit map, not a case
// change, so it's obvious this is deliberate.
const CATEGORY_TO_SESSION_TYPE = {
  'Practise': 'practice',
  'Rehearsal': 'rehearsal',
  'Lesson': 'lesson',
  'Performance': 'performance'
};
const SESSION_TYPE_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_TO_SESSION_TYPE).map(([category, type]) => [type, category])
);

// pg returns BIGINT columns (ids) as strings, to avoid silent precision loss
// on values outside JS's safe integer range - but the frontend does a
// strict === comparison assuming `row` is a number (public/app.js, openEdit).
// `row`/challenge-item ids are always Number()-wrapped in responses below to
// preserve that, rather than touching the frontend.
function toIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// The sheet only ever stored a date, not a time of day, and this app
// originally followed suit by stamping every session at midday GMT/UTC
// regardless of when it was actually logged (ML-68) - that made same-day
// sessions impossible to order relative to each other and threw away any
// chance of time-of-day stats. Real times are used now, computed in SQL
// (Postgres's own tzdata handles the BST/GMT switch correctly, which a
// fixed offset can't) rather than in JS:
//   - a new session's time-of-day is "now", in Europe/London - this app's
//     only audience so far (see docs/environments.md)
//   - editing a session keeps its existing time-of-day and only swaps the
//     calendar date, so fixing a typo'd duration doesn't erase real data
// Both are expressed as `<date> + <time>) AT TIME ZONE 'Europe/London'`
// directly in the query SQL below rather than as reusable snippets, since
// the "what time" half differs (NOW() vs the existing row's own started_at)
// while the "combine and convert" shape is identical either way.
const LONDON_TZ = 'Europe/London';

// Resolves a session's "who" to a band or tutor depending on category -
// lessons reference a tutor, rehearsals/performances reference a band,
// practice sessions have no "who" at all.
async function resolveWho(accountId, sessionType, who) {
  if (!who) return { bandId: null, tutorId: null };
  if (sessionType === 'lesson') return { bandId: null, tutorId: await getOrCreateTutor(who) };
  if (sessionType === 'rehearsal' || sessionType === 'performance') {
    return { bandId: await getOrCreateBand(accountId, who), tutorId: null };
  }
  return { bandId: null, tutorId: null };
}

// ========================================
// DROPDOWN OPTIONS
// ========================================
router.get('/dropdown-options', requireAuth, resolveAccount, async (req, res) => {
  try {
    const [organisations, teachers, durations] = await Promise.all([
      listBands(req.accountId),
      listTutors(),
      listDurationOptions()
    ]);
    res.json({ organisations, teachers, durations });
  } catch (error) {
    console.error('Dropdown options error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SESSIONS (Practice logging)
// ========================================
router.post('/sessions', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { category, duration, who, date } = req.body;
    const sessionType = CATEGORY_TO_SESSION_TYPE[category];
    if (!sessionType) return res.status(400).json({ error: 'Invalid category' });

    const { bandId, tutorId } = await resolveWho(req.accountId, sessionType, who);

    const { rows } = await pool.query(
      `INSERT INTO sessions (session_type, account_id, band_id, tutor_id, started_at, total_duration_minutes)
       VALUES ($1, $2, $3, $4, ($5::date + (NOW() AT TIME ZONE $7)::time) AT TIME ZONE $7, $6) RETURNING id`,
      [sessionType, req.accountId, bandId, tutorId, date, Number(duration), LONDON_TZ]
    );

    res.json({ message: `Saved ${duration} mins!`, category, row: Number(rows[0].id) });
  } catch (error) {
    console.error('Session save error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.session_type,
              to_char(s.started_at AT TIME ZONE $2, 'YYYY-MM-DD') AS date_str,
              s.total_duration_minutes, b.name AS band_name, t.display_name AS tutor_name
       FROM sessions s
       LEFT JOIN bands b ON b.id = s.band_id
       LEFT JOIN tutors t ON t.id = s.tutor_id
       WHERE s.account_id = $1
       ORDER BY s.started_at DESC`,
      [req.accountId, LONDON_TZ]
    );

    res.json(rows.map(r => ({
      row: Number(r.id),
      category: SESSION_TYPE_TO_CATEGORY[r.session_type],
      dateStr: r.date_str,
      duration: r.total_duration_minutes,
      who: r.band_name || r.tutor_name || ''
    })));
  } catch (error) {
    console.error('Sessions fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/sessions/:row', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { row } = req.params;
    const { category, duration, who, date } = req.body;
    const sessionType = CATEGORY_TO_SESSION_TYPE[category];
    if (!sessionType) return res.status(400).json({ error: 'Invalid category' });

    const { bandId, tutorId } = await resolveWho(req.accountId, sessionType, who);

    await pool.query(
      `UPDATE sessions SET session_type = $1, band_id = $2, tutor_id = $3,
         started_at = ($4::date + (started_at AT TIME ZONE $8)::time) AT TIME ZONE $8,
         total_duration_minutes = $5
       WHERE id = $6 AND account_id = $7`,
      [sessionType, bandId, tutorId, date, Number(duration), row, req.accountId, LONDON_TZ]
    );

    res.json({ message: 'Session updated', row });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:row', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { row } = req.params;
    await pool.query('DELETE FROM sessions WHERE id = $1 AND account_id = $2', [row, req.accountId]);
    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Session delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SETTINGS (Organisations & Teachers)
// ========================================
router.post('/settings/organisations', requireAuth, resolveAccount, async (req, res) => {
  try {
    await getOrCreateBand(req.accountId, req.body.name);
    const [organisations, teachers] = await Promise.all([listBands(req.accountId), listTutors()]);
    res.json({ organisations, teachers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/teachers', requireAuth, resolveAccount, async (req, res) => {
  try {
    await getOrCreateTutor(req.body.name);
    const [organisations, teachers] = await Promise.all([listBands(req.accountId), listTutors()]);
    res.json({ organisations, teachers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings/organisations', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    await renameBand(req.accountId, oldName, newName);
    res.json({ message: 'Organisation renamed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings/teachers', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    await renameTutor(oldName, newName);
    res.json({ message: 'Teacher renamed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manage Lists needs to know, per item, whether it's referenced in history
// so it can label the archive/remove action correctly before the user acts -
// dropdown-options stays cheap for the common app-load path by not doing this.
router.get('/settings/lists-with-usage', requireAuth, resolveAccount, async (req, res) => {
  try {
    const [organisations, teachers] = await Promise.all([listBands(req.accountId), listTutors()]);

    const organisationsWithUsage = await Promise.all(
      organisations.map(async o => ({ ...o, usedInHistory: await isBandUsedInHistory(req.accountId, o.name) }))
    );
    const teachersWithUsage = await Promise.all(
      teachers.map(async t => ({ ...t, usedInHistory: await isTutorUsedInHistory(t.name) }))
    );

    res.json({ organisations: organisationsWithUsage, teachers: teachersWithUsage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/settings/organisations/:name', requireAuth, resolveAccount, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const archived = await archiveOrDeleteBand(req.accountId, name);
    res.json({
      message: archived ? 'Organisation archived (still used in history)' : 'Organisation deleted',
      archived
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/settings/teachers/:name', requireAuth, resolveAccount, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const archived = await archiveOrDeleteTutor(name);
    res.json({
      message: archived ? 'Teacher archived (still used in history)' : 'Teacher deleted',
      archived
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/organisations/:name/unarchive', requireAuth, resolveAccount, async (req, res) => {
  try {
    await unarchiveBand(req.accountId, decodeURIComponent(req.params.name));
    res.json({ message: 'Organisation unarchived' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/teachers/:name/unarchive', requireAuth, resolveAccount, async (req, res) => {
  try {
    await unarchiveTutor(decodeURIComponent(req.params.name));
    res.json({ message: 'Teacher unarchived' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CHALLENGES
// ========================================
router.get('/challenges', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id AS challenge_id, c.type, c.name AS challenge_name, c.challenge_priority,
              ci.id AS item_id, ci.piece_name, ci.ref, ci.bar_from, ci.bar_to, ci.target_bpm,
              ci.status, ci.item_priority,
              COALESCE(SUM(cl.duration_minutes), 0) AS time_spent,
              COUNT(cl.id) AS sessions
       FROM challenges c
       JOIN challenge_items ci ON ci.challenge_id = c.id
       LEFT JOIN challenge_logs cl ON cl.challenge_item_id = ci.id
       WHERE c.account_id = $1
       GROUP BY c.id, ci.id
       ORDER BY COALESCE(c.challenge_priority, 999), COALESCE(ci.item_priority, 999)`,
      [req.accountId]
    );

    res.json(rows.map(r => ({
      row: Number(r.item_id),
      id: String(r.challenge_id),
      type: r.type || '',
      who: '',
      name: r.challenge_name || '',
      piece: r.piece_name || '',
      ref: r.ref || '',
      barFrom: r.bar_from ?? '',
      barTo: r.bar_to ?? '',
      bpm: r.target_bpm ?? '',
      timeSpent: Number(r.time_spent) || 0,
      sessions: Number(r.sessions) || 0,
      status: r.status || 'To do',
      challPriority: r.challenge_priority ?? 999,
      itemPriority: r.item_priority ?? 999
    })));
  } catch (error) {
    console.error('Challenges fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/challenges', requireAuth, resolveAccount, async (req, res) => {
  const client = await pool.connect();
  try {
    const { items } = req.body;
    await client.query('BEGIN');

    let challengeId = null;
    if (items[0].id) {
      const existing = await client.query(
        'SELECT id FROM challenges WHERE id = $1 AND account_id = $2',
        [items[0].id, req.accountId]
      );
      if (existing.rows.length) challengeId = existing.rows[0].id;
    }

    if (!challengeId) {
      const maxPriority = await client.query(
        'SELECT COALESCE(MAX(challenge_priority), 0) AS max FROM challenges WHERE account_id = $1',
        [req.accountId]
      );
      const nextPriority = items[0].id ? items[0].challPriority : Number(maxPriority.rows[0].max) + 1;

      const inserted = await client.query(
        'INSERT INTO challenges (account_id, name, type, challenge_priority) VALUES ($1, $2, $3, $4) RETURNING id',
        [req.accountId, items[0].name || '', items[0].type || '', nextPriority]
      );
      challengeId = inserted.rows[0].id;
    }

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      await client.query(
        `INSERT INTO challenge_items (challenge_id, piece_name, ref, bar_from, bar_to, target_bpm, status, item_priority)
         VALUES ($1, $2, $3, $4, $5, $6, 'To do', $7)`,
        [challengeId, item.piece || null, item.ref || null, toIntOrNull(item.barFrom), toIntOrNull(item.barTo), toIntOrNull(item.bpm), idx + 1]
      );
    }

    await client.query('COMMIT');
    res.json({ newId: String(challengeId) });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.put('/challenges/:row', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { row } = req.params;
    const { timeSpent, status, piece, ref, barFrom, barTo, bpm, priority } = req.body;

    // Editing a task's details (piece/ref/bars/bpm), logging practise progress
    // (timeSpent/status), and reordering (priority, from dragging a task within
    // a challenge) are independent - only touch whichever ones the caller
    // actually sent.
    if ([piece, ref, barFrom, barTo, bpm].some(v => v !== undefined)) {
      await pool.query(
        `UPDATE challenge_items ci SET piece_name = $1, ref = $2, bar_from = $3, bar_to = $4, target_bpm = $5
         FROM challenges c
         WHERE ci.challenge_id = c.id AND ci.id = $6 AND c.account_id = $7`,
        [piece || null, ref || null, toIntOrNull(barFrom), toIntOrNull(barTo), toIntOrNull(bpm), row, req.accountId]
      );
    }

    if (priority !== undefined) {
      await pool.query(
        `UPDATE challenge_items ci SET item_priority = $1 FROM challenges c
         WHERE ci.challenge_id = c.id AND ci.id = $2 AND c.account_id = $3`,
        [priority, row, req.accountId]
      );
    }

    if (timeSpent !== undefined || status !== undefined) {
      if (status !== undefined) {
        await pool.query(
          `UPDATE challenge_items ci SET status = $1 FROM challenges c
           WHERE ci.challenge_id = c.id AND ci.id = $2 AND c.account_id = $3`,
          [status, row, req.accountId]
        );
      }
      // A logged instance, even one with no extra time (e.g. just a status
      // change) - matches the old sheet counting every such update as one
      // more session, not just ones with time > 0.
      await pool.query(
        `INSERT INTO challenge_logs (challenge_item_id, duration_minutes)
         SELECT ci.id, $1 FROM challenge_items ci JOIN challenges c ON c.id = ci.challenge_id
         WHERE ci.id = $2 AND c.account_id = $3`,
        [timeSpent || 0, row, req.accountId]
      );
    }

    res.json({ message: 'Challenge updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Appends a new task to an existing challenge group (mirrors what POST
// /challenges does for a brand-new challenge, but for one more task under
// an existing one).
router.post('/challenges/group/:id/items', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { id } = req.params;
    const { piece, ref, barFrom, barTo, bpm } = req.body;

    const existing = await pool.query('SELECT id FROM challenges WHERE id = $1 AND account_id = $2', [id, req.accountId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Challenge not found' });

    const maxPriority = await pool.query(
      'SELECT COALESCE(MAX(item_priority), 0) AS max FROM challenge_items WHERE challenge_id = $1',
      [id]
    );

    await pool.query(
      `INSERT INTO challenge_items (challenge_id, piece_name, ref, bar_from, bar_to, target_bpm, status, item_priority)
       VALUES ($1, $2, $3, $4, $5, $6, 'To do', $7)`,
      [id, piece || null, ref || null, toIntOrNull(barFrom), toIntOrNull(barTo), toIntOrNull(bpm), Number(maxPriority.rows[0].max) + 1]
    );

    res.json({ message: 'Task added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Whole-challenge operations act on every item sharing a challenge id, not a
// single item - renaming or deleting "the challenge" means every task
// under it.
router.put('/challenges/group/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, priority } = req.body;

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push(`name = $${fields.length + 1}`); values.push(name); }
    if (priority !== undefined) { fields.push(`challenge_priority = $${fields.length + 1}`); values.push(priority); }

    let updated = 0;
    if (fields.length) {
      values.push(id, req.accountId);
      const result = await pool.query(
        `UPDATE challenges SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND account_id = $${values.length}`,
        values
      );
      updated = result.rowCount;
    }

    res.json({ message: 'Challenge updated', updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/challenges/group/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { id } = req.params;
    const itemCount = await pool.query('SELECT COUNT(*) AS count FROM challenge_items WHERE challenge_id = $1', [id]);
    await pool.query('DELETE FROM challenges WHERE id = $1 AND account_id = $2', [id, req.accountId]);
    res.json({ message: 'Challenge deleted', deleted: Number(itemCount.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Closes every not-yet-complete task in a challenge in one go, marking them
// "Closed" rather than "Complete" so abandoned work doesn't read as finished.
router.put('/challenges/:id/close', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE challenge_items ci SET status = 'Closed'
       FROM challenges c
       WHERE ci.challenge_id = c.id AND c.id = $1 AND c.account_id = $2 AND ci.status != 'Complete'`,
      [id, req.accountId]
    );
    res.json({ message: 'Challenge closed', updated: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/challenges/:row', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { row } = req.params;
    await pool.query(
      `DELETE FROM challenge_items ci USING challenges c
       WHERE ci.challenge_id = c.id AND ci.id = $1 AND c.account_id = $2`,
      [row, req.accountId]
    );
    res.json({ message: 'Challenge deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// MULTI-BAR METRONOME (Jira ML-35) - ad-hoc/standalone only this release,
// see docs/database-schema.md "Scores & metronome segments (Jira ML-35)".
// Services throw errors with a `.status` (e.g. 404/400 for ownership/
// validation failures) - respond with that instead of always 500.
// ========================================
router.get('/time-signatures', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listTimeSignatureOptions(req.accountId));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/time-signatures/custom', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { numerator, denominator } = req.body;
    res.json(await createCustomTimeSignature(req.accountId, Number(numerator), Number(denominator)));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// The block editor's "Your custom time signatures" management list - every
// custom signature the account has (active or archived) plus how many blocks
// actually use each one.
router.get('/time-signatures/custom', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listCustomTimeSignaturesWithUsage(req.accountId));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/time-signatures/custom/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    await setCustomTimeSignatureActive(req.accountId, req.params.id, !!req.body.active);
    res.json({ message: 'Updated' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/time-signatures/custom/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    await deleteCustomTimeSignature(req.accountId, req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/metronome/setups', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listAdhocSetups(req.accountId));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/metronome/setups', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name } = req.body;
    res.json(await createAdhocSetup(req.accountId, name));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// The builder's landing state - reuses or creates the account's one scratch
// setup, seeded with a default block. Registered before the ":id" route
// below so "scratch" isn't swallowed as an id.
router.get('/metronome/setups/scratch', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await getOrCreateScratchSetup(req.accountId));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// "+ Add new set" - names a fresh setup and seeds it with a default block,
// both in the one step the popup triggers.
router.post('/metronome/setups/named', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    res.json(await createNamedAdhocSetup(req.accountId, name.trim()));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/metronome/setups/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await getAdhocSetupWithSegments(req.accountId, req.params.id));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/metronome/setups/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name } = req.body;
    await renameAdhocSetup(req.accountId, req.params.id, name);
    res.json({ message: 'Setup updated' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/metronome/setups/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    await deleteAdhocSetup(req.accountId, req.params.id);
    res.json({ message: 'Setup deleted' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// "Copy this setup" - clones a setup (all its blocks, lead-in included) under a
// new name, as a starting point for a variant.
router.post('/metronome/setups/:id/duplicate', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    res.json(await duplicateAdhocSetup(req.accountId, req.params.id, name.trim()));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// "Save for later" - names a scratch setup (saved_at still NULL) and moves
// it into the account's saved list in one step. Distinct from the plain
// rename PUT above, which only ever touches an already-saved setup's name.
router.post('/metronome/setups/:id/save', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required to save.' });
    await saveAdhocSetup(req.accountId, req.params.id, name.trim());
    res.json({ message: 'Setup saved' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/metronome/setups/:id/segments', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await createSegment(req.accountId, req.params.id, req.body));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/metronome/segments/:segId', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await updateSegment(req.accountId, req.params.segId, req.body));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/metronome/segments/:segId', requireAuth, resolveAccount, async (req, res) => {
  try {
    await deleteSegment(req.accountId, req.params.segId);
    res.json({ message: 'Block deleted' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
