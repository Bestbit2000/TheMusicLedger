// ML-319 (epic ML-314): practice lists - a named list of pieces for a concert, with its date and how
// you plan to practise for it (sessions a week, session length). Personal (owner_account_id) or a
// band's (owner_band_id) - any member of the band can create and change a band's list; each member's
// forecast still uses their own Levels. The readiness forecast is worked out in the browser from what
// getPracticeList returns (PracticePlan.forecast). See db/migrations/063_practice_lists.sql.
import pool from '../config/db.js';
import { withStatus, assertFlowReadAccess } from './flows.js';
import { BAND_CAN_CHANGE_SQL, PLAY_ONLY_MESSAGE } from './flowPermissions.js';

function toList(row) {
  return {
    id: Number(row.id),
    name: row.name,
    eventDate: row.event_date ? toIsoDate(row.event_date) : null,
    sessionsPerWeek: Number(row.sessions_per_week),
    sessionMinutes: Number(row.session_minutes),
    pieceCount: row.piece_count == null ? undefined : Number(row.piece_count),
    bandId: row.owner_band_id == null ? null : Number(row.owner_band_id),
    bandName: row.band_name || null,
    canEdit: row.can_edit !== false, // ML-473: false for a band's list when you are a "play" member
  };
}
// DATE columns come back as a local-midnight Date; keep them as the plain calendar day.
function toIsoDate(d) {
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function validateFields(data, partial) {
  const out = {};
  if (!partial || data.name !== undefined) {
    const name = String(data.name || '').trim().slice(0, 80);
    if (!name) throw withStatus(400, 'Give the list a name.');
    out.name = name;
  }
  if (data.eventDate !== undefined) {
    if (data.eventDate === null || data.eventDate === '') out.eventDate = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.eventDate)) || Number.isNaN(Date.parse(data.eventDate))) throw withStatus(400, 'The date should look like 2026-10-11.');
    else out.eventDate = String(data.eventDate);
  }
  if (data.sessionsPerWeek !== undefined) {
    const n = Math.round(Number(data.sessionsPerWeek));
    if (!(n >= 1 && n <= 14)) throw withStatus(400, 'Sessions a week must be 1-14.');
    out.sessionsPerWeek = n;
  }
  if (data.sessionMinutes !== undefined) {
    const n = Math.round(Number(data.sessionMinutes) / 5) * 5;
    if (!(n >= 5 && n <= 120)) throw withStatus(400, 'A session is 5-120 minutes.');
    out.sessionMinutes = n;
  }
  return out;
}

// Yours, or a band's you're a member of. `toChange`: a band's list is changed only by a member who may
// change the band's things (ML-473) - a "play" member reads it and plans from it.
async function assertListOwner(accountId, listId, toChange = false) {
  const { rows } = await pool.query(
    `SELECT pl.*, b.name AS band_name, COALESCE(pl.owner_account_id = $2 OR ${BAND_CAN_CHANGE_SQL}, false) AS can_edit
       FROM practice_lists pl
       LEFT JOIN bands b ON b.id = pl.owner_band_id
       LEFT JOIN band_members bm ON bm.band_id = pl.owner_band_id AND bm.account_id = $2
      WHERE pl.id = $1 AND (pl.owner_account_id = $2 OR bm.account_id IS NOT NULL)`,
    [listId, accountId]);
  if (!rows.length) throw withStatus(404, 'Practice list not found');
  if (toChange && !rows[0].can_edit) throw withStatus(403, PLAY_ONLY_MESSAGE);
  return rows[0];
}

export async function listPracticeLists(accountId) {
  const { rows } = await pool.query(
    `SELECT pl.*, b.name AS band_name, (SELECT COUNT(*) FROM practice_list_scores s WHERE s.practice_list_id = pl.id) AS piece_count,
            COALESCE(pl.owner_account_id = $1 OR ${BAND_CAN_CHANGE_SQL}, false) AS can_edit
       FROM practice_lists pl LEFT JOIN bands b ON b.id = pl.owner_band_id
       LEFT JOIN band_members bm ON bm.band_id = pl.owner_band_id AND bm.account_id = $1
      WHERE pl.owner_account_id = $1 OR bm.account_id IS NOT NULL
      ORDER BY pl.event_date NULLS LAST, pl.created_at DESC`,
    [accountId]
  );
  return rows.map(toList);
}

export async function createPracticeList(accountId, data = {}) {
  const f = validateFields(data, false);
  const bandId = data.bandId == null || data.bandId === '' ? null : Number(data.bandId);
  if (bandId !== null) {
    const { rows: member } = await pool.query(`SELECT ${BAND_CAN_CHANGE_SQL} AS can_change FROM band_members bm WHERE bm.band_id = $1 AND bm.account_id = $2`, [bandId, accountId]);
    if (!member.length) throw withStatus(403, 'You are not a member of that band.');
    if (!member[0].can_change) throw withStatus(403, PLAY_ONLY_MESSAGE);
  }
  const { rows } = await pool.query(
    `INSERT INTO practice_lists (owner_account_id, owner_band_id, name, event_date, sessions_per_week, session_minutes)
     VALUES ($1, $2, $3, $4, COALESCE($5, 3), COALESCE($6, 45)) RETURNING *`,
    [bandId === null ? accountId : null, bandId, f.name, f.eventDate ?? null, f.sessionsPerWeek ?? null, f.sessionMinutes ?? null]
  );
  return getPracticeList(accountId, Number(rows[0].id));
}

export async function updatePracticeList(accountId, listId, data = {}) {
  await assertListOwner(accountId, listId, true);
  const f = validateFields(data, true);
  const sets = [], vals = [listId];
  const col = { name: 'name', eventDate: 'event_date', sessionsPerWeek: 'sessions_per_week', sessionMinutes: 'session_minutes' };
  for (const [k, v] of Object.entries(f)) { vals.push(v); sets.push(`${col[k]} = $${vals.length}`); }
  if (sets.length) await pool.query(`UPDATE practice_lists SET ${sets.join(', ')} WHERE id = $1`, vals);
  return getPracticeList(accountId, listId);
}

export async function deletePracticeList(accountId, listId) {
  await assertListOwner(accountId, listId, true);
  await pool.query('DELETE FROM practice_lists WHERE id = $1', [listId]);
  return { deleted: true };
}

// The list's pieces, in order (any the account can read - its own, its bands', public ones).
export async function setPracticeListPieces(accountId, listId, scoreIds) {
  await assertListOwner(accountId, listId, true);
  if (!Array.isArray(scoreIds) || scoreIds.length > 50) throw withStatus(400, 'A list has up to 50 pieces.');
  const ids = [...new Set(scoreIds.map(Number))];
  for (const id of ids) await assertFlowReadAccess(accountId, id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM practice_list_scores WHERE practice_list_id = $1', [listId]);
    for (let i = 0; i < ids.length; i++) {
      await client.query('INSERT INTO practice_list_scores (practice_list_id, score_id, order_index) VALUES ($1, $2, $3)', [listId, ids[i], i]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return getPracticeList(accountId, listId);
}

// The list, and for each piece its bars and this account's chunks - everything the list screen and
// the forecast need.
export async function getPracticeList(accountId, listId) {
  const list = toList(await assertListOwner(accountId, listId));
  const { rows: pieces } = await pool.query(
    `SELECT s.id, s.title,
            (SELECT COALESCE(SUM(ms.bar_count), 0)::int FROM metronome_segments ms WHERE ms.parent_score_id = s.id AND NOT ms.is_lead_in) AS total_bars
       FROM practice_list_scores pls JOIN scores s ON s.id = pls.score_id
      WHERE pls.practice_list_id = $1 ORDER BY pls.order_index`,
    [listId]
  );
  const ids = pieces.map(p => Number(p.id));
  const { rows: chunks } = ids.length
    ? await pool.query(
      `SELECT id, score_id, kind, start_bar, end_bar, level, label FROM piece_chunks
        WHERE account_id = $1 AND score_id = ANY($2::bigint[]) ORDER BY sort_order, start_bar, id`,
      [accountId, ids])
    : { rows: [] };
  list.pieces = pieces.map(p => ({
    scoreId: Number(p.id),
    title: p.title,
    totalBars: p.total_bars,
    chunks: chunks.filter(c => Number(c.score_id) === Number(p.id)).map(c => ({
      id: Number(c.id), kind: c.kind, startBar: c.start_bar, endBar: c.end_bar, level: c.level == null ? null : Number(c.level), label: c.label,
    })),
  }));
  return list;
}
