// ML-319 (epic ML-314): practice lists - a named list of pieces for a concert, with its date and how
// you plan to practise for it (sessions a week, session length). Personal (owner_account_id) or a
// band's (owner_band_id) - any member of the band can create and change a band's list; each member's
// forecast still uses their own Levels. The readiness forecast is worked out in the browser from what
// getPracticeList returns (PracticePlan.forecast). See db/migrations/063_practice_lists.sql.
import pool from '../config/db.js';
import { withStatus, assertFlowReadAccess, FlowJourney } from './flows.js';
import { BAND_CAN_CHANGE_SQL, PLAY_ONLY_MESSAGE } from './flowPermissions.js';
import { noticeBandNews } from './autoNotices.js'; // ML-497

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
    // Archived (see setPracticeListArchived): for this member, and whether that is on the list itself
    archived: !!(row.archived_at || row.archived_mine),
    archivedForAll: !!row.archived_at,
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
    `SELECT pl.*, b.name AS band_name, COALESCE(pl.owner_account_id = $2 OR ${BAND_CAN_CHANGE_SQL}, false) AS can_edit,
            EXISTS (SELECT 1 FROM archived_practice_lists ar WHERE ar.account_id = $2 AND ar.practice_list_id = pl.id) AS archived_mine
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
            COALESCE(pl.owner_account_id = $1 OR ${BAND_CAN_CHANGE_SQL}, false) AS can_edit,
            EXISTS (SELECT 1 FROM archived_practice_lists ar WHERE ar.account_id = $1 AND ar.practice_list_id = pl.id) AS archived_mine
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
  if (bandId !== null) await noticeBandNews(bandId, accountId, { type: 'list', id: rows[0].id }); // ML-497
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

// Archive a list that is done with, or bring it back - the same two ways as a piece (setFlowArchived in
// flows.js): just for this member, or on the list itself for everyone who can see it, which only someone
// who may change the list can do. Its pieces are not archived with it.
export async function setPracticeListArchived(accountId, listId, { archived, forAll } = {}) {
  await assertListOwner(accountId, listId, !!forAll);
  if (forAll) await pool.query('UPDATE practice_lists SET archived_at = CASE WHEN $2 THEN COALESCE(archived_at, now()) ELSE NULL END WHERE id = $1', [listId, !!archived]);
  if (archived && !forAll) {
    await pool.query('INSERT INTO archived_practice_lists (account_id, practice_list_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [accountId, listId]);
  } else if (!archived) {
    await pool.query('DELETE FROM archived_practice_lists WHERE account_id = $1 AND practice_list_id = $2', [accountId, listId]);
  }
  return getPracticeList(accountId, listId);
}

// The list's pieces, in order (any the account can read - its own, its bands', public ones). Each is a piece id,
// or { scoreId, movement } - ML-530: one movement of a piece in movements (movement null: the whole piece). A plain
// id keeps the movement the piece already had on the list, so a caller that only knows ids never loses it.
export async function setPracticeListPieces(accountId, listId, items) {
  await assertListOwner(accountId, listId, true);
  if (!Array.isArray(items) || items.length > 50) throw withStatus(400, 'A list has up to 50 pieces.');
  const { rows: before } = await pool.query('SELECT score_id, movement_number FROM practice_list_scores WHERE practice_list_id = $1', [listId]);
  const had = new Map(before.map(r => [Number(r.score_id), r.movement_number == null ? null : Number(r.movement_number)]));
  const seen = new Set();
  const pieces = [];
  for (const item of items) {
    const plain = item === null || typeof item !== 'object';
    const id = Number(plain ? item : item.scoreId);
    if (!Number.isInteger(id) || id < 1 || seen.has(id)) continue;
    seen.add(id);
    let movement = plain ? (had.get(id) ?? null) : (item.movement == null ? null : Number(item.movement));
    if (movement !== null && !(Number.isInteger(movement) && movement >= 1 && movement <= 99)) throw withStatus(400, 'That movement is not one of the piece\'s.');
    pieces.push({ id, movement });
  }
  for (const p of pieces) await assertFlowReadAccess(accountId, p.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM practice_list_scores WHERE practice_list_id = $1', [listId]);
    for (let i = 0; i < pieces.length; i++) {
      await client.query('INSERT INTO practice_list_scores (practice_list_id, score_id, order_index, movement_number) VALUES ($1, $2, $3, $4)', [listId, pieces[i].id, i, pieces[i].movement]);
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

// ML-530: each piece's movements when it has more than one, by piece id - [{ number, title, startBar, endBar }].
async function movementsByPiece(ids) {
  if (!ids.length) return new Map();
  const { rows } = await pool.query(
    `SELECT parent_score_id, bar_count, movement_start, movement_title FROM metronome_segments
      WHERE parent_score_id = ANY($1::bigint[]) AND NOT is_lead_in ORDER BY parent_score_id, order_index`, [ids]);
  const out = new Map();
  ids.forEach(id => {
    const blocks = rows.filter(r => Number(r.parent_score_id) === id).map(r => ({ barCount: r.bar_count, movementStart: r.movement_start, movementTitle: r.movement_title }));
    const moves = FlowJourney.movements(blocks);
    out.set(id, moves.length > 1 ? moves.map(m => ({ number: m.number, title: m.title, startBar: m.startBar, endBar: m.endBar })) : []);
  });
  return out;
}

// The list, and for each piece its bars and this account's chunks - everything the list screen and
// the forecast need. ML-530: a piece on the list as one movement has that `movement` and only the chunks inside
// it, so the forecast and the sessions count just its bars; `movements` lists the piece's movements (none when it
// has only one) for choosing.
// ===== ML-557: a weekly plan on a practice list =====
// Sessions a week, minutes a session and the warm-up in it - three optional boxes. Each member's own, even on a
// band's list (how often someone practises is never shown to the band), so it is kept per member
// (practice_list_plans), not on the list. With sessions and minutes set, the list says about how many weeks it
// takes (PracticePlan.weeklyPlan, worked out in the browser) and how far you've come since the plan was made: the
// practice sessions (that ended after it) and five-minute blocks on the list's pieces since then. Never "behind" or "on track".
function toPlan(row) {
  return {
    sessionsPerWeek: row.sessions_per_week == null ? null : Number(row.sessions_per_week),
    sessionMinutes: row.session_minutes == null ? null : Number(row.session_minutes),
    warmupMinutes: Number(row.warmup_minutes || 0),
    setAt: row.set_at,
  };
}
async function listPlanFor(accountId, listId, scoreIds) {
  const { rows } = await pool.query('SELECT * FROM practice_list_plans WHERE list_id = $1 AND account_id = $2', [listId, accountId]);
  if (!rows.length) return null;
  const plan = toPlan(rows[0]);
  const { rows: done } = scoreIds.length
    ? await pool.query(
      `SELECT COUNT(DISTINCT s.id)::int AS sessions, COUNT(seg.id)::int AS blocks
         FROM session_segments seg JOIN sessions s ON s.id = seg.session_id AND s.account_id = $1
        WHERE seg.score_id = ANY($2::bigint[]) AND seg.start_bar IS NOT NULL AND s.started_at + make_interval(mins => s.total_duration_minutes) >= $3`,
      [accountId, scoreIds, rows[0].set_at])
    : { rows: [{ sessions: 0, blocks: 0 }] };
  return { ...plan, sessionsSince: done[0].sessions, blocksSince: done[0].blocks };
}
const PLAN_LIMITS = { sessionsPerWeek: [1, 14, 1], sessionMinutes: [10, 120, 5], warmupMinutes: [0, 30, 5] };
// Any member who can see the list sets their own plan (a "play" member too: it changes nothing anyone else sees).
// Every box empty takes the plan away; a plan made again counts from then.
export async function setPracticeListPlan(accountId, listId, data = {}) {
  await assertListOwner(accountId, listId);
  const v = {};
  for (const [key, [min, max, step]] of Object.entries(PLAN_LIMITS)) {
    const raw = data[key];
    if (raw === null || raw === undefined || raw === '') { v[key] = key === 'warmupMinutes' ? 0 : null; continue; }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max || n % step) throw withStatus(400, `${key} must be ${min}-${max}${step > 1 ? ` in steps of ${step}` : ''}.`);
    v[key] = n;
  }
  if (v.sessionsPerWeek === null && v.sessionMinutes === null && !v.warmupMinutes) {
    await pool.query('DELETE FROM practice_list_plans WHERE list_id = $1 AND account_id = $2', [listId, accountId]);
  } else {
    if (v.sessionMinutes !== null && v.warmupMinutes >= v.sessionMinutes) throw withStatus(400, 'The warm-up must be shorter than the session.');
    await pool.query(
      `INSERT INTO practice_list_plans (list_id, account_id, sessions_per_week, session_minutes, warmup_minutes) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (list_id, account_id) DO UPDATE SET sessions_per_week = $3, session_minutes = $4, warmup_minutes = $5, updated_at = now()`,
      [listId, accountId, v.sessionsPerWeek, v.sessionMinutes, v.warmupMinutes]);
  }
  return getPracticeList(accountId, listId);
}

export async function getPracticeList(accountId, listId) {
  const list = toList(await assertListOwner(accountId, listId));
  const { rows: pieces } = await pool.query(
    `SELECT s.id, s.title, pls.movement_number,
            (SELECT COALESCE(SUM(ms.bar_count), 0)::int FROM metronome_segments ms WHERE ms.parent_score_id = s.id AND NOT ms.is_lead_in) AS total_bars,
            (s.archived_at IS NOT NULL OR EXISTS (SELECT 1 FROM archived_scores ar WHERE ar.account_id = $2 AND ar.score_id = s.id)) AS archived
       FROM practice_list_scores pls JOIN scores s ON s.id = pls.score_id
      WHERE pls.practice_list_id = $1 ORDER BY pls.order_index`,
    [listId, accountId]
  );
  const ids = pieces.map(p => Number(p.id));
  const { rows: chunks } = ids.length
    ? await pool.query(
      `SELECT id, score_id, kind, start_bar, end_bar, level, label FROM piece_chunks
        WHERE account_id = $1 AND score_id = ANY($2::bigint[]) ORDER BY sort_order, start_bar, id`,
      [accountId, ids])
    : { rows: [] };
  const moves = await movementsByPiece(ids);
  list.plan = await listPlanFor(accountId, list.id, ids); // ML-557: this member's own weekly plan
  list.pieces = pieces.map(p => {
    const movements = moves.get(Number(p.id)) || [];
    const movement = p.movement_number == null ? null : movements.find(m => m.number === Number(p.movement_number)) || null;
    const inside = (c) => !movement || (c.start_bar >= movement.startBar && c.end_bar <= movement.endBar);
    return {
      scoreId: Number(p.id),
      title: p.title,
      totalBars: p.total_bars,
      movement,
      movements,
      archived: !!p.archived, // an archived piece stays on the list but is not counted or planned
      chunks: chunks.filter(c => Number(c.score_id) === Number(p.id) && inside(c)).map(c => ({
        id: Number(c.id), kind: c.kind, startBar: c.start_bar, endBar: c.end_bar, level: c.level == null ? null : Number(c.level), label: c.label,
      })),
    };
  });
  return list;
}
