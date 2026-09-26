// Sheets-to-database cutover (see docs/sheets-to-database-cutover.md).
// Nothing here calls the Google Sheets API any more - every route in this
// file is now Postgres-backed, which also means the old per-request Google
// access-token refresh dance (X-Refreshed-Token) is gone: there's nothing
// left in this file that needs a Google token at all.

import express from 'express';
import { assertWarmupsEnabled, listActiveWarmups } from '../services/warmups.js';
import { requireAuth, resolveAccount, requireAuthFromQueryOrHeader } from '../middleware/auth.js';
import { sendError } from '../utils/httpErrors.js';
import pool from '../config/db.js';
import { listBands, getOrCreateBand, renameBand, isBandUsedInHistory, archiveOrDeleteBand, unarchiveBand, listAllBands, getAccountBands, joinBand, leaveBand, createSharedBand, deleteBandIfSoleMember } from '../services/bands.js';
import { getAccountProfile, updateAccountProfile, getPracticeYearSetting, updatePracticeYearSetting } from '../services/accounts.js';
import { listTutors, getOrCreateTutor, renameTutor, isTutorUsedInHistory, archiveOrDeleteTutor, unarchiveTutor } from '../services/tutors.js';
import { listDurationOptions, getDefaultDurationMinutes } from '../services/durationOptions.js';
import { listTimeSignatureOptions, createCustomTimeSignature, listCustomTimeSignaturesWithUsage, setCustomTimeSignatureActive, deleteCustomTimeSignature } from '../services/timeSignatures.js';
import { listAdhocSetups, createAdhocSetup, renameAdhocSetup, saveAdhocSetup, deleteAdhocSetup, getAdhocSetupWithSegments, getOrCreateScratchSetup, createNamedAdhocSetup, duplicateAdhocSetup, createQuickPlaySetup, listQuickPlayHistory, setAdhocSetupFavorite, overwriteQuickPlayHistorySegments, duplicateQuickPlayHistory } from '../services/metronomeSetups.js';
import { createSegment, updateSegment, deleteSegment } from '../services/metronomeSegments.js';
import { listActivePlaybackSpeeds } from '../services/playbackSpeeds.js';
import { handleUpload } from '@vercel/blob/client';
import { put } from '@vercel/blob';
import { createFlow, listFlows, getFlowDetail, updateFlowMetadata, moveFlowToBand, removeFlowFromBand, publishFlow, unpublishFlow, deleteFlow, duplicateFlow, assertFlowAccess, addUploadedRecording, addYouTubeRecording, deleteRecording, addDocument, deleteDocument, getFlowDefaultBlockSettings, withStatus } from '../services/flows.js';
import { listFlowBlocks, createFlowBlock, updateFlowBlock, deleteFlowBlock, duplicateFlowBlock, reorderFlowBlocks, copyAllFlowBlocks } from '../services/flowBlocks.js';
import { importScoreFromFile, isOwnBlobUrl, readCappedBody, MAX_SCORE_FILE_BYTES } from '../services/scoreImport.js';
import { isFeatureEnabled, listEnabledFeatureKeys } from '../services/features.js';
import { getActiveTimerSession, upsertActiveTimerSession, clearActiveTimerSession } from '../services/timerSessions.js';
import { startAuthoringSession, updateAuthoringSession, currentAppVersion } from '../services/flowAuthoringStats.js';
import { exportFlowForUser } from '../services/flowTransfer.js';
import { submitFeedback } from '../services/feedback.js';
import { listNotificationsForAccount, markNotificationRead, markAllNotificationsRead } from '../services/notifications.js';
import { saveTheoryAttempt, getTheoryHistory, getTheorySummary, getTheoryWeights } from '../services/theoryPractice.js';
import { assertDrillEnabled, saveDrillAttempt, getDrillHistory, getDrillSummary } from '../services/drills.js';

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
// NOTIFICATIONS (ML-201) - polled by every open client (on open, on resume, and every ~5 minutes),
// so it's one cheap query. appVersion is the release this deployment is running (from
// public/releases.json, same source as the About page and feedback's version stamp): the client
// compares it with the version its own in-memory code loaded as, and shows an "update available -
// reload" notice when the server's is newer - see checkNotifications in public/app.js.
// ========================================
async function assertNotificationsEnabled() {
  if (!(await isFeatureEnabled('notifications'))) throw withStatus(403, "This feature isn't available right now.");
}

router.get('/notifications', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertNotificationsEnabled();
    res.json({ ...(await listNotificationsForAccount(req.accountId)), appVersion: currentAppVersion() });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/notifications/read-all', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertNotificationsEnabled();
    res.json({ ...(await markAllNotificationsRead(req.accountId)), appVersion: currentAppVersion() });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/notifications/:id/read', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertNotificationsEnabled();
    res.json({ ...(await markNotificationRead(req.accountId, req.params.id)), appVersion: currentAppVersion() });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// WARM-UPS (ML-294) - the switched-on exercises for the Warm-ups tool. Editing is admin-only
// (routes/admin.js). See db/migrations/055_warmups.sql and public/warmups.js.
// ========================================
router.get('/warmups', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertWarmupsEnabled();
    res.json({ exercises: await listActiveWarmups() });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// THEORY PRACTICE (ML-260/ML-265) - quiz rounds, history and personal bests. The quizzes themselves
// run entirely in the browser (public/theoryEngine.js); only finished rounds come here. See
// db/migrations/052_theory_quiz.sql and docs/theory-practice.md.
// ========================================
async function assertTheoryEnabled() {
  if (!(await isFeatureEnabled('theory_practice'))) throw withStatus(403, "This feature isn't available right now.");
}

router.get('/theory/summary', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertTheoryEnabled();
    res.json(await getTheorySummary(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-269 Smart learn: this account's weak questions, loaded at the start of each round. Behind its own
// theory_smart_learn gate (returns enabled: false, and nothing is recorded, when it's off).
router.get('/theory/weights', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertTheoryEnabled();
    res.json(await getTheoryWeights(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/theory/attempts', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertTheoryEnabled();
    res.json(await getTheoryHistory(req.accountId, req.query.settingsKey));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/theory/attempts', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertTheoryEnabled();
    res.json(await saveTheoryAttempt(req.accountId, req.body));
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// DRILLS (ML-298 Tap tempo, ML-295 Gap trainer, ML-296 Ear) - finished rounds, history and bests. The
// drills run in the browser (public/drills.js); the server re-scores each round from its taps/answers.
// See db/migrations/057_drills.sql and docs/drills.md.
// ========================================
router.get('/drills/:tool/summary', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertDrillEnabled(req.params.tool);
    res.json(await getDrillSummary(req.accountId, req.params.tool));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/drills/:tool/attempts', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertDrillEnabled(req.params.tool);
    res.json(await getDrillHistory(req.accountId, req.params.tool, req.query.level));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/drills/:tool/attempts', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertDrillEnabled(req.params.tool);
    res.json(await saveDrillAttempt(req.accountId, { ...req.body, tool: req.params.tool }));
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// DROPDOWN OPTIONS
// ========================================
router.get('/dropdown-options', requireAuth, resolveAccount, async (req, res) => {
  try {
    const [organisations, teachers, durations, enabledFeatures, defaultDuration, practiceYear] = await Promise.all([
      listBands(req.accountId),
      listTutors(),
      listDurationOptions(),
      // ML-190: every enabled feature_key in one list, so the client can gate UI at app-load time
      // without a request per feature - see server/services/features.js.
      listEnabledFeatureKeys(),
      // ML-236: the quick timer's fallback length when there's no practise history to go on.
      getDefaultDurationMinutes(),
      // ML-234: loaded with the rest of the app's startup data since the stats screen needs it.
      getPracticeYearSetting(req.accountId)
    ]);
    res.json({ organisations, teachers, durations, enabledFeatures, defaultDuration, practiceYear });
  } catch (error) {
    console.error('Dropdown options error:', error);
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
  }
});

router.delete('/sessions/:row', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { row } = req.params;
    await pool.query('DELETE FROM sessions WHERE id = $1 AND account_id = $2', [row, req.accountId]);
    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Session delete error:', error);
    sendError(res, error);
  }
});

// ========================================
// ACTIVE TIMER SESSION (ML-197 - lets an in-progress practice timer survive an accidental
// reload/relogin, e.g. mobile pull-to-refresh. See db/migrations/043_active_timer_sessions.sql -
// this is deliberately separate from the SESSIONS routes above, which only ever record a
// finished session's authoritative total.)
// ========================================
router.get('/timer/active', requireAuth, resolveAccount, async (req, res) => {
  try {
    const activeSession = await getActiveTimerSession(req.accountId);
    res.json({ activeSession });
  } catch (error) {
    console.error('Active timer fetch error:', error);
    sendError(res, error);
  }
});

router.put('/timer/active', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { targetSeconds, elapsedSeconds, running } = req.body;
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      return res.status(400).json({ error: 'Invalid elapsedSeconds' });
    }
    if (targetSeconds !== null && targetSeconds !== undefined && !Number.isFinite(targetSeconds)) {
      return res.status(400).json({ error: 'Invalid targetSeconds' });
    }
    await upsertActiveTimerSession(req.accountId, {
      targetSeconds: targetSeconds === null || targetSeconds === undefined ? null : Number(targetSeconds),
      elapsedSeconds: Number(elapsedSeconds),
      running: !!running
    });
    res.json({ message: 'Active timer synced' });
  } catch (error) {
    console.error('Active timer sync error:', error);
    sendError(res, error);
  }
});

router.delete('/timer/active', requireAuth, resolveAccount, async (req, res) => {
  try {
    await clearActiveTimerSession(req.accountId);
    res.json({ message: 'Active timer cleared' });
  } catch (error) {
    console.error('Active timer clear error:', error);
    sendError(res, error);
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
    sendError(res, error);
  }
});

router.post('/settings/teachers', requireAuth, resolveAccount, async (req, res) => {
  try {
    await getOrCreateTutor(req.body.name);
    const [organisations, teachers] = await Promise.all([listBands(req.accountId), listTutors()]);
    res.json({ organisations, teachers });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/settings/organisations', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    await renameBand(req.accountId, oldName, newName);
    res.json({ message: 'Organisation renamed' });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/settings/teachers', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    await renameTutor(oldName, newName);
    res.json({ message: 'Teacher renamed' });
  } catch (error) {
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
  }
});

router.post('/settings/organisations/:name/unarchive', requireAuth, resolveAccount, async (req, res) => {
  try {
    await unarchiveBand(req.accountId, decodeURIComponent(req.params.name));
    res.json({ message: 'Organisation unarchived' });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/settings/teachers/:name/unarchive', requireAuth, resolveAccount, async (req, res) => {
  try {
    await unarchiveTutor(decodeURIComponent(req.params.name));
    res.json({ message: 'Teacher unarchived' });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// ACCOUNT (ML-77) - the logged-in user's own profile + shared band
// membership. Distinct from /settings/organisations above, which is the
// private per-account "who was this session for" label list and is
// untouched by any of this.
// ========================================
router.get('/account', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await getAccountProfile(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-234: Settings -> Stats "Use my own practice year" (on/off + start day and month).
router.put('/account/practice-year', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { enabled, startMonth, startDay } = req.body;
    await updatePracticeYearSetting(req.accountId, { enabled, startMonth, startDay });
    res.json({ practiceYear: await getPracticeYearSetting(req.accountId) });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/account', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { firstName, surname } = req.body;
    await updateAccountProfile(req.accountId, { firstName, surname });
    res.json({ message: 'Account updated' });
  } catch (error) {
    sendError(res, error);
  }
});

// The shared band directory (ML-89) alongside which of those the account
// already belongs to, for the account page's band picker.
router.get('/account/bands', requireAuth, resolveAccount, async (req, res) => {
  try {
    const [allBands, myBands] = await Promise.all([listAllBands(), getAccountBands(req.accountId)]);
    res.json({ allBands, myBands });
  } catch (error) {
    sendError(res, error);
  }
});

// Adds a brand new band to the shared directory and joins the creator to it
// in one step (ML-89: "if the band isn't in the list, you can add one - you
// don't have to be an admin"). Same createSharedBand the admin panel's Bands
// tab uses (server/routes/admin.js), just a different caller/permission gate.
router.post('/account/bands', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name, website } = req.body;
    res.json({ band: await createSharedBand(req.accountId, name, website) });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/account/bands/:id/join', requireAuth, resolveAccount, async (req, res) => {
  try {
    await joinBand(req.accountId, req.params.id);
    res.json({ message: 'Joined band' });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/account/bands/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    await leaveBand(req.accountId, req.params.id);
    res.json({ message: 'Left band' });
  } catch (error) {
    sendError(res, error);
  }
});

// Distinct from the plain leave above (ML-89 follow-up) - only permitted when this account is the
// band's sole member and it has no session history; re-checked server-side regardless of what the
// client's own canDelete flag last said (see deleteBandIfSoleMember).
router.delete('/account/bands/:id/full', requireAuth, resolveAccount, async (req, res) => {
  try {
    await deleteBandIfSoleMember(req.accountId, req.params.id);
    res.json({ message: 'Band deleted' });
  } catch (error) {
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
  }
});

router.delete('/challenges/group/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { id } = req.params;
    const itemCount = await pool.query('SELECT COUNT(*) AS count FROM challenge_items WHERE challenge_id = $1', [id]);
    await pool.query('DELETE FROM challenges WHERE id = $1 AND account_id = $2', [id, req.accountId]);
    res.json({ message: 'Challenge deleted', deleted: Number(itemCount.rows[0].count) });
  } catch (error) {
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
  }
});

// ML-109: Metronome Blocks' play-speed presets, previously hardcoded in index.html - now admin-
// managed (server/routes/admin.js), same shape as duration_options.
router.get('/metronome/playback-speeds', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listActivePlaybackSpeeds());
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/time-signatures/custom', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { numerator, denominator } = req.body;
    res.json(await createCustomTimeSignature(req.accountId, Number(numerator), Number(denominator)));
  } catch (error) {
    sendError(res, error);
  }
});

// The block editor's "Your custom time signatures" management list - every
// custom signature the account has (active or archived) plus how many blocks
// actually use each one.
router.get('/time-signatures/custom', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listCustomTimeSignaturesWithUsage(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/time-signatures/custom/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    await setCustomTimeSignatureActive(req.accountId, req.params.id, !!req.body.active);
    res.json({ message: 'Updated' });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/time-signatures/custom/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    await deleteCustomTimeSignature(req.accountId, req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/metronome/setups', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listAdhocSetups(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-34: Quick Play's "Show history" list - registered before the "/metronome/setups/:id"
// route below for the same reason "scratch" is (a literal path segment, not an id).
router.get('/metronome/history', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listQuickPlayHistory(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/metronome/setups', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name } = req.body;
    res.json(await createAdhocSetup(req.accountId, name));
  } catch (error) {
    sendError(res, error);
  }
});

// The builder's landing state - reuses or creates the account's one scratch
// setup, seeded with a default block. Registered before the ":id" route
// below so "scratch" isn't swallowed as an id.
router.get('/metronome/setups/scratch', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await getOrCreateScratchSetup(req.accountId));
  } catch (error) {
    sendError(res, error);
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
    sendError(res, error);
  }
});

router.get('/metronome/setups/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await getAdhocSetupWithSegments(req.accountId, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/metronome/setups/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name } = req.body;
    await renameAdhocSetup(req.accountId, req.params.id, name);
    res.json({ message: 'Setup updated' });
  } catch (error) {
    sendError(res, error);
  }
});

// ML-34: star/unstar a history entry - "Set as favourite" / "Remove from favourites".
router.put('/metronome/setups/:id/favorite', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { isFavorite } = req.body;
    await setAdhocSetupFavorite(req.accountId, req.params.id, isFavorite);
    res.json({ message: 'Setup updated' });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/metronome/setups/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    await deleteAdhocSetup(req.accountId, req.params.id);
    res.json({ message: 'Setup deleted' });
  } catch (error) {
    sendError(res, error);
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
    sendError(res, error);
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
    sendError(res, error);
  }
});

// Quick Play (front page): writes the whole set of blocks in as one history
// row per Play press - see createQuickPlaySetup. One request rather than a
// setup-create + N segment-create round trip since nothing needs to exist
// server-side while the user is still composing blocks.
router.post('/metronome/quick-play', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name, blocks } = req.body;
    if (!name || !Array.isArray(blocks) || !blocks.length) {
      return res.status(400).json({ error: 'Name and at least one block are required.' });
    }
    res.json(await createQuickPlaySetup(req.accountId, name, blocks));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-34 follow-up: once a history entry has been loaded back into Quick Play, Play overwrites that
// same row's bars instead of writing a fresh history entry every time.
router.put('/metronome/history/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { blocks } = req.body;
    if (!Array.isArray(blocks) || !blocks.length) {
      return res.status(400).json({ error: 'At least one block is required.' });
    }
    res.json(await overwriteQuickPlayHistorySegments(req.accountId, req.params.id, blocks));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/metronome/history/:id/duplicate', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    res.json(await duplicateQuickPlayHistory(req.accountId, req.params.id, name.trim()));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/metronome/setups/:id/segments', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await createSegment(req.accountId, req.params.id, req.body));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/metronome/segments/:segId', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await updateSegment(req.accountId, req.params.segId, req.body));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/metronome/segments/:segId', requireAuth, resolveAccount, async (req, res) => {
  try {
    await deleteSegment(req.accountId, req.params.segId);
    res.json({ message: 'Block deleted' });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// FLOWS (Jira ML-179) - score-backed practice flows. See docs/database-schema.md's
// "Flow" vs "Score" naming note: the table is `scores`, but the concept/every
// route here is "Flow". Recordings/documents live in Vercel Blob, not Postgres -
// see server/services/flows.js.
// ========================================
router.get('/flows', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listFlows(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

// A flow always starts with exactly one block now (ML-179 follow-up), same as Quick Play's own
// single default bar - never a truly empty flow with nothing to play.
router.post('/flows', requireAuth, resolveAccount, async (req, res) => {
  try {
    const flow = await createFlow(req.accountId, req.body || {});
    const defaults = await getFlowDefaultBlockSettings();
    await createFlowBlock(req.accountId, flow.id, defaults);
    res.json(await getFlowDetail(req.accountId, flow.id));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/flows/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await getFlowDetail(req.accountId, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/flows/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await updateFlowMetadata(req.accountId, req.params.id, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/flows/:id/move-to-band', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await moveFlowToBand(req.accountId, req.params.id, req.body?.bandId));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/flows/:id/remove-from-band', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await removeFlowFromBand(req.accountId, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/flows/:id/publish', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await publishFlow(req.accountId, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/flows/:id/unpublish', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await unpublishFlow(req.accountId, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/flows/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    await deleteFlow(req.accountId, req.params.id);
    res.json({ message: 'Flow deleted' });
  } catch (error) {
    sendError(res, error);
  }
});

// Personal-flows-only for now (duplicateFlow enforces this) - the library list's own Duplicate row
// action.
router.post('/flows/:id/duplicate', requireAuth, resolveAccount, async (req, res) => {
  try {
    const newId = await duplicateFlow(req.accountId, req.params.id);
    await copyAllFlowBlocks(req.params.id, newId);
    res.json(await getFlowDetail(req.accountId, newId));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-204: "Export to MusicXML" (library ⋮ menu) - the same file the admin Flows page exports, so it
// opens in notation software and re-imports losslessly via "Import from MusicXML". Personal and band
// flows only (exportFlowForUser). Gated by flow_export_musicxml - the one place a per-plan check
// would go if export is ever commercialised.
router.get('/flows/:id/musicxml', requireAuth, resolveAccount, async (req, res) => {
  try {
    if (!(await isFeatureEnabled('flow_export_musicxml'))) throw withStatus(403, "This feature isn't available right now.");
    const { fileName, body } = await exportFlowForUser(req.accountId, req.params.id, { appVersion: currentAppVersion() });
    res.setHeader('Content-Type', 'application/vnd.recordare.musicxml+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(body);
  } catch (error) {
    sendError(res, error);
  }
});

// Client-upload token for mp3/mp4 recordings (@vercel/blob/client's upload()
// calls this) - the file goes straight from the browser to Blob storage, never
// through this function (Vercel's ~4.5MB request body cap rules out proxying
// anything but the smallest clips through it). onUploadCompleted is a
// deliberate no-op: that webhook is only reachable on a real deployed URL,
// never in local dev, so the actual DB row is written by POST
// /flows/:id/recordings below instead, called by the client right after its
// own upload() resolves.
router.post('/flows/:id/recordings/upload-token', requireAuthFromQueryOrHeader, resolveAccount, async (req, res) => {
  try {
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => {
        await assertFlowAccess(req.accountId, req.params.id);
        return {
          allowedContentTypes: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'video/mp4'],
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {}
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/flows/:id/recordings', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await addUploadedRecording(req.accountId, req.params.id, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/flows/:id/recordings/youtube', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await addYouTubeRecording(req.accountId, req.params.id, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/flows/:id/recordings/:recordingId', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await deleteRecording(req.accountId, req.params.id, req.params.recordingId));
  } catch (error) {
    sendError(res, error);
  }
});

// Same client-upload shape as recordings, for PDF/MusicXML/Sibelius/MuseScore
// score files - allowedContentTypes deliberately includes application/octet-stream
// since browsers rarely report a specific MIME type for the proprietary
// .sib/.musx formats (the file picker's own accept=".pdf,.musicxml,.mxl,.sib,.musx"
// already narrows what's offered before this even runs).
router.post('/flows/:id/documents/upload-token', requireAuthFromQueryOrHeader, resolveAccount, async (req, res) => {
  try {
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => {
        await assertFlowAccess(req.accountId, req.params.id);
        return {
          allowedContentTypes: ['application/pdf', 'application/vnd.recordare.musicxml+xml', 'application/vnd.recordare.musicxml', 'application/xml', 'text/xml', 'application/octet-stream'],
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {}
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/flows/:id/documents', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await addDocument(req.accountId, req.params.id, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/flows/:id/documents/:documentId', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await deleteDocument(req.accountId, req.params.id, req.params.documentId));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-79: "Create from file" - PDF/MusicXML/.mxl. No flow exists yet at upload time, unlike every
// other /flows/:id/documents/... route above, so this isn't scoped to one. application/pdf is
// back in the allowed list as of Phase 2 (OMR via runOmr - scoreImport.js); until
// AUDIVERIS_SERVICE_URL is actually configured a PDF still uploads fine here, it just fails with a
// clear message at the /flows/from-file step below, same as any other OMR failure.
// application/octet-stream stays in for the same reason the general documents route keeps it -
// browsers frequently don't have a registered MIME type for either MusicXML format and fall back
// to it.
//
// Two gates (ML-204): flow_import_musicxml covers .musicxml/.mxl (no third-party dependency);
// flow_import_from_file (ML-190) now means PDF/scan import only - off until the OMR dependency,
// solfascribe-omr, has had its security review. Checked here too, not just the entry-screen button
// being hidden - otherwise a file would still upload to Blob (wasted storage) even though the
// actual import at /flows/from-file below would then refuse it anyway.
async function fileImportGates() {
  const [pdf, musicxml] = await Promise.all([isFeatureEnabled('flow_import_from_file'), isFeatureEnabled('flow_import_musicxml')]);
  return { pdf, musicxml };
}
const PDF_NOT_AVAILABLE = "PDF import isn't available right now - use a MusicXML or .mxl file instead.";

router.post('/flows/from-file/upload-token', requireAuthFromQueryOrHeader, resolveAccount, async (req, res) => {
  try {
    const gates = await fileImportGates();
    if (!gates.pdf && !gates.musicxml) throw withStatus(403, "This feature isn't available right now.");
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (/\.pdf$/i.test(pathname) && !gates.pdf) throw withStatus(403, PDF_NOT_AVAILABLE);
        return {
          allowedContentTypes: [
            ...(gates.pdf ? ['application/pdf'] : []),
            'application/vnd.recordare.musicxml+xml', 'application/vnd.recordare.musicxml', 'application/xml', 'text/xml', 'application/octet-stream'
          ],
          // ML-192: Blob enforces this at upload time, so nothing bigger ever reaches /flows/from-file.
          maximumSizeInBytes: MAX_SCORE_FILE_BYTES,
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {}
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

// The actual import: parses the file already sitting in Blob (see scoreImport.js), creates the
// flow from what it found, and attaches the file to the new flow's Media regardless of how much
// of it the parse actually used ("store it anyway, may reuse it for dynamics later" per the
// request) - re-parsing later reads this same file back rather than needing a re-upload. For a
// PDF, the MusicXML that OMR produced along the way gets saved too, as a second Media document
// (uploaded server-side, not by the browser - see put() below) - a future re-parse (e.g. once
// dynamics are supported) can read that clean structured file directly rather than re-running OMR
// on the original scan. Deletes the auto-seeded starter block POST /flows always creates before
// writing the real ones - same fix ML-163's "Save metronome to Flows" needed, and for the same
// reason (a metronome/file import's own blocks ARE the content, not a placeholder to build on top
// of).
router.post('/flows/from-file', requireAuth, resolveAccount, async (req, res) => {
  try {
    const gates = await fileImportGates();
    if (!gates.pdf && !gates.musicxml) throw withStatus(403, "This feature isn't available right now.");
    const { blobUrl, blobPathname, fileName, fileSizeBytes, mimeType } = req.body || {};
    if (!blobUrl || !blobPathname || !fileName) throw withStatus(400, 'Missing uploaded file details.');
    // ML-192: only ever fetch from this app's own Blob store, at the pathname the upload returned -
    // never an arbitrary URL from the request body (server-side request forgery).
    if (!isOwnBlobUrl(blobUrl, blobPathname)) throw withStatus(400, "That doesn't look like a file uploaded to this app.");

    const fileResponse = await fetch(blobUrl, { redirect: 'error' }).catch(() => null);
    // 422, not the more "correct" 502 - sendError only passes a withStatus message through to the
    // client below 500 (see scoreImport.js's runOmr, same reasoning).
    if (!fileResponse?.ok) throw withStatus(422, "Couldn't read the uploaded file - try uploading it again.");
    const buffer = await readCappedBody(fileResponse, MAX_SCORE_FILE_BYTES, 'That file is larger than this app accepts.');
    // By content, not the file name - the name is the client's to choose.
    const isPdf = buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF';
    if (isPdf ? !gates.pdf : !gates.musicxml) {
      throw withStatus(403, isPdf ? PDF_NOT_AVAILABLE : "MusicXML import isn't available right now.");
    }

    const { flow: parsed, blocks, omrXmlText } = await importScoreFromFile(req.accountId, buffer);

    const flow = await createFlow(req.accountId, { name: parsed.title || undefined });
    const { composer, arranger, publisher, description } = parsed;
    if (composer || arranger || publisher || description) {
      await updateFlowMetadata(req.accountId, flow.id, { composer, arranger, publisher, description });
    }
    // Only ever present in this app's own exports (ML-204) - a notation app's file has none.
    for (const r of parsed.recordings) {
      await addYouTubeRecording(req.accountId, flow.id, { url: `https://www.youtube.com/watch?v=${r.youtubeVideoId}`, title: r.title });
    }

    // Sequential, not Promise.all - each block's order_index is assigned server-side as
    // "current max + 1" (createFlowBlock) and would race if these ran in parallel.
    const seededBlocks = await listFlowBlocks(req.accountId, flow.id);
    for (const seeded of seededBlocks) await deleteFlowBlock(req.accountId, seeded.id);
    for (const block of blocks) await createFlowBlock(req.accountId, flow.id, block);

    await addDocument(req.accountId, flow.id, { blobUrl, blobPathname, fileName, fileSizeBytes, mimeType });

    if (omrXmlText) {
      const derivedName = `${fileName.replace(/\.[^.]+$/, '')} (converted).musicxml`;
      const derivedBlob = await put(`flows/from-file/${Date.now()}-${derivedName}`, omrXmlText, {
        access: 'public', contentType: 'application/vnd.recordare.musicxml+xml', addRandomSuffix: true
      });
      await addDocument(req.accountId, flow.id, {
        blobUrl: derivedBlob.url, blobPathname: derivedBlob.pathname,
        fileName: derivedName, fileSizeBytes: Buffer.byteLength(omrXmlText), mimeType: 'application/vnd.recordare.musicxml+xml'
      });
    }

    // importWarnings: anything in the file the reader couldn't represent exactly (see
    // flowMusicXmlReader.js) - additive to the usual flow detail shape.
    res.json({ ...(await getFlowDetail(req.accountId, flow.id)), importWarnings: parsed.warnings });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// FLOW BLOCKS (Jira ML-179 Phase 2) - score-backed metronome_segments (parent_score_id).
// Mirrors /metronome/setups/:id/segments and /metronome/segments/:segId's own shape - see
// server/services/flowBlocks.js for how the CRUD itself reuses metronomeSegments.js's shared
// validation/column helpers.
// ========================================
router.get('/flows/:id/blocks', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listFlowBlocks(req.accountId, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/flows/:id/blocks', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await createFlowBlock(req.accountId, req.params.id, req.body));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/flows/:id/blocks/reorder', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await reorderFlowBlocks(req.accountId, req.params.id, req.body?.orderedIds || []));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/flows/blocks/:blockId', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await updateFlowBlock(req.accountId, req.params.blockId, req.body));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/flows/blocks/:blockId', requireAuth, resolveAccount, async (req, res) => {
  try {
    await deleteFlowBlock(req.accountId, req.params.blockId);
    res.json({ message: 'Block deleted' });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/flows/blocks/:blockId/duplicate', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await duplicateFlowBlock(req.accountId, req.params.blockId));
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// FLOW AUTHORING STATS (Jira ML-199) - how long building a Flow actually takes, so manual bar
// entry has a measured baseline to compare a redesigned Bars tab against. See
// server/services/flowAuthoringStats.js for why the client owns the clock, and
// db/migrations/044_flow_authoring_stats.sql for the table's own reasoning.
//
// These two routes are the only ones in this file whose failure is deliberately invisible to the
// user: the client never surfaces an error from them (see flowStatsRequest in public/app.js).
// Losing a measurement is an acceptable outcome; interrupting someone mid-flow to tell them a
// stopwatch failed is not.
// ========================================
router.post('/flows/:id/authoring-sessions', requireAuth, resolveAccount, async (req, res) => {
  try {
    // Gated at START only - see the migration's note on why an already-running session is still
    // allowed to finalise after the feature is switched off. 204 rather than 403: "not recording"
    // is a normal configuration, not an error the client did anything wrong to cause.
    if (!(await isFeatureEnabled('flow_authoring_stats'))) return res.status(204).end();
    const { kind, creationSource, deviceKind, idleThresholdSeconds, blockCountStart } = req.body || {};
    res.json(await startAuthoringSession(req.accountId, req.params.id, {
      kind, creationSource, deviceKind, idleThresholdSeconds, blockCountStart
    }));
  } catch (error) {
    sendError(res, error);
  }
});

// Both the periodic heartbeat and the final write (the latter carries `outcome`) - one route, so a
// session whose final write never arrives is still a correctly-shaped row. Not scoped under
// /flows/:id: the session id alone identifies the row, and it deliberately outlives the flow it
// measured (score_id is ON DELETE SET NULL), so requiring a still-existing flow id here would make
// it impossible to finalise a session for a flow that was just deleted.
router.put('/flows/authoring-sessions/:sessionId', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await updateAuthoringSession(req.accountId, req.params.sessionId, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// FEEDBACK (Jira ML-170) - the capture half. Triage lives in server/routes/admin.js; the user's own
// "My Feedback" list is a deliberate follow-up, not part of this.
// ========================================
router.post('/feedback', requireAuth, resolveAccount, async (req, res) => {
  try {
    if (!(await isFeatureEnabled('feedback'))) {
      return res.status(403).json({ error: 'Feedback is currently switched off.' });
    }
    // Only `message` is taken from the body. route/deviceKind come from the client too but are
    // context, not content - and user_agent is read from the request header rather than the body,
    // since the body's version is whatever a client chose to type. Everything else on the row
    // (status, category, admin_response, app_version) is set by the server or by an admin later.
    const { message, route, deviceKind } = req.body || {};
    res.json(await submitFeedback(req.accountId, {
      message, route, deviceKind, userAgent: req.get('user-agent')
    }));
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
