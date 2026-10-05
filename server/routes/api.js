// Sheets-to-database cutover (see docs/sheets-to-database-cutover.md).
// Nothing here calls the Google Sheets API any more - every route in this
// file is now Postgres-backed, which also means the old per-request Google
// access-token refresh dance (X-Refreshed-Token) is gone: there's nothing
// left in this file that needs a Google token at all.

import express from 'express';
import { assertWarmupsEnabled, listActiveWarmups } from '../services/warmups.js';
import { assertPracticeLevelsEnabled, getPieceLevels, replacePieceChunks, setChunkLevel, setSubBeatsBelow, listPracticePieces } from '../services/practiceLevels.js';
import { nextRestMessage } from '../services/restMessages.js';
import { assertScaleLevelsEnabled, getScaleLevels, answerScale, setScaleLevel } from '../services/scaleLevels.js';
import { listPracticeChunks, savePracticeSession, listTemplates, saveTemplate, deleteTemplate, getActivePractice, putActivePractice, clearActivePractice } from '../services/practiceSessions.js';
import { recordSkillResult, getSkillsAndLists, createSkillList, updateSkillList, deleteSkillList, listWarmupLists, saveWarmupList, deleteWarmupList } from '../services/skills.js';
import { listPracticeLists, createPracticeList, updatePracticeList, deletePracticeList, setPracticeListPieces, getPracticeList } from '../services/practiceLists.js';
import { requireAuth, resolveAccount, requireAuthFromQueryOrHeader } from '../middleware/auth.js';
import { sendError } from '../utils/httpErrors.js';
import pool from '../config/db.js';
import { listBands, getOrCreateBand, renameBand, isBandUsedInHistory, archiveOrDeleteBand, unarchiveBand, listAllBands, getAccountBands, joinBand, leaveBand, createSharedBand, deleteBandIfSoleMember } from '../services/bands.js';
import { readMeters, sendUsageWarnings } from '../services/thirdPartyUsage.js';
import { deleteMyAccount } from '../services/accountDeletion.js';
import { exportMyAccount } from '../services/accountExport.js';
import { getAccountProfile, updateAccountProfile, getPracticeYearSetting, updatePracticeYearSetting, getDisplayPrefs, saveDisplayPrefs } from '../services/accounts.js';
import { listTutors, getOrCreateTutor, renameTutor, isTutorUsedInHistory, archiveOrDeleteTutor, unarchiveTutor } from '../services/tutors.js';
import { listDurationOptions, getDefaultDurationMinutes } from '../services/durationOptions.js';
import { listTimeSignatureOptions, createCustomTimeSignature, listCustomTimeSignaturesWithUsage, setCustomTimeSignatureActive, deleteCustomTimeSignature } from '../services/timeSignatures.js';
import { renameAdhocSetup, deleteAdhocSetup, getAdhocSetupWithSegments, createQuickPlaySetup, listQuickPlayHistory, HISTORY_SHOWN_DEFAULT, setAdhocSetupFavorite, overwriteQuickPlayHistorySegments, duplicateQuickPlayHistory } from '../services/metronomeSetups.js';
import { listActivePlaybackSpeeds } from '../services/playbackSpeeds.js';
import { handleUpload } from '@vercel/blob/client';
import { put } from '@vercel/blob';
import { listInstruments, listAccountInstruments, setAccountInstruments, resolveSessionInstrument } from '../services/instruments.js';
import { assertRangeEnabled, getRange, setRange, recordGo, moveRange } from '../services/range.js';
import { createFlow, listFlows, getFlowDetail, updateFlowMetadata, moveFlowToBand, removeFlowFromBand, publishFlow, setFlowAudience, unpublishFlow, deleteFlow, duplicateFlow, assertFlowAccess, assertBandMembership, addUploadedRecording, addYouTubeRecording, deleteRecording, addDocument, deleteDocument, getFlowDefaultBlockSettings, withStatus } from '../services/flows.js';
import { listFlowBlocks, createFlowBlock, updateFlowBlock, deleteFlowBlock, duplicateFlowBlock, reorderFlowBlocks, copyAllFlowBlocks, replaceAllFlowBlocks } from '../services/flowBlocks.js';
import { importScoreFromFile, isOwnBlobUrl, readCappedBody, MAX_SCORE_FILE_BYTES } from '../services/scoreImport.js';
import { isFeatureEnabled, listEnabledFeatureKeys, getLimit, listLimits } from '../services/features.js';
import { getActiveTimerSession, upsertActiveTimerSession, clearActiveTimerSession } from '../services/timerSessions.js';
import { startAuthoringSession, updateAuthoringSession, currentAppVersion } from '../services/flowAuthoringStats.js';
import { exportFlowForUser } from '../services/flowTransfer.js';
import { submitFeedback } from '../services/feedback.js';
import { requestUpgrade } from '../services/upgradeRequest.js';
import { listNotificationsForAccount, markNotificationRead, markAllNotificationsRead } from '../services/notifications.js';
import { saveTheoryAttempt, getTheoryHistory, getTheorySummary, getTheoryLevels, getTheoryWeights, getTheoryPlayed } from '../services/theoryPractice.js';
import { assertDrillEnabled, saveDrillAttempt, getDrillHistory, getDrillSummary, getDrillWeights, getRhythmLevels, setRhythmWord } from '../services/drills.js';
import { securityStatus, requirePasswordAccount, changeOwnPassword, passwordLoginEnabled, appUrl, createInvite, listMyInvites, invitesSentToday, cancelMyInvite, INVITE_LEVELS } from '../services/passwordAuth.js';
import { beginSetup, confirmSetup, newRecoveryCodes, turnOff } from '../services/twoStep.js';

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
// PRACTICE LEVELS (ML-315, epic ML-314) - a piece's chunks, each with a Level 1-5, per account; the
// heat map's per-bar Levels; Level changes in practice; the session sub-beat speed. Behind the
// practice_levels feature. See db/migrations/061_practice_levels.sql and public/flowJourney.js.
// ========================================
router.get('/flows/:id/levels', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertPracticeLevelsEnabled();
    res.json(await getPieceLevels(req.accountId, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/flows/:id/levels', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertPracticeLevelsEnabled();
    res.json(await replacePieceChunks(req.accountId, req.params.id, req.body?.chunks));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/levels/chunks/:chunkId', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertPracticeLevelsEnabled();
    res.json(await setChunkLevel(req.accountId, req.params.chunkId, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-320: the practice session builder - chunks for its Rehearsal blocks, and logging a finished session.
router.get('/practice/chunks', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertPracticeLevelsEnabled();
    res.json({ chunks: await listPracticeChunks(req.accountId) });
  } catch (error) {
    sendError(res, error);
  }
});

// ML-390: the pieces a session's Pieces blocks come from (a practice list's, your own choice, or every
// piece you've given Levels), with all their chunks - PracticePlan.piecePool picks from these.
router.get('/practice/pieces', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertPracticeLevelsEnabled();
    const ids = req.query.scoreIds ? String(req.query.scoreIds).split(',').filter(Boolean) : null;
    res.json({ pieces: await listPracticePieces(req.accountId, ids) });
  } catch (error) {
    sendError(res, error);
  }
});

// ML-390: the message for the 30-second rest between blocks - the next one from this player's deck.
router.get('/practice/rest-message', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertPracticeLevelsEnabled();
    res.json(await nextRestMessage(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/practice/sessions', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertPracticeLevelsEnabled();
    res.json(await savePracticeSession(req.accountId, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-319: practice lists (a concert's pieces, its date, sessions a week) - the forecast is worked out in the browser.
const practiceListRoute = (fn) => async (req, res) => {
  try {
    await assertPracticeLevelsEnabled();
    res.json(await fn(req));
  } catch (error) {
    sendError(res, error);
  }
};
router.get('/practice/lists', requireAuth, resolveAccount, practiceListRoute(req => listPracticeLists(req.accountId).then(lists => ({ lists }))));
router.post('/practice/lists', requireAuth, resolveAccount, practiceListRoute(req => createPracticeList(req.accountId, req.body || {})));
router.get('/practice/lists/:id', requireAuth, resolveAccount, practiceListRoute(req => getPracticeList(req.accountId, req.params.id)));
router.put('/practice/lists/:id', requireAuth, resolveAccount, practiceListRoute(req => updatePracticeList(req.accountId, req.params.id, req.body || {})));
router.delete('/practice/lists/:id', requireAuth, resolveAccount, practiceListRoute(req => deletePracticeList(req.accountId, req.params.id)));
router.put('/practice/lists/:id/pieces', requireAuth, resolveAccount, practiceListRoute(req => setPracticeListPieces(req.accountId, req.params.id, req.body?.scoreIds)));
// ML-320 follow-ups: your own templates, and the session running now (kept across reloads and devices).
router.get('/practice/templates', requireAuth, resolveAccount, practiceListRoute(req => listTemplates(req.accountId).then(templates => ({ templates }))));
router.post('/practice/templates', requireAuth, resolveAccount, practiceListRoute(req => saveTemplate(req.accountId, null, req.body || {})));
router.put('/practice/templates/:id', requireAuth, resolveAccount, practiceListRoute(req => saveTemplate(req.accountId, Number(req.params.id), req.body || {})));
router.delete('/practice/templates/:id', requireAuth, resolveAccount, practiceListRoute(req => deleteTemplate(req.accountId, Number(req.params.id))));
router.get('/practice/active', requireAuth, resolveAccount, practiceListRoute(req => getActivePractice(req.accountId)));
router.put('/practice/active', requireAuth, resolveAccount, practiceListRoute(req => putActivePractice(req.accountId, req.body || {})));
router.delete('/practice/active', requireAuth, resolveAccount, practiceListRoute(req => clearActivePractice(req.accountId)));
// ML-321: your skills and where you're up to; ML-339: your named skills lists ({ lists, skills }).
router.get('/practice/skills', requireAuth, resolveAccount, practiceListRoute(req => getSkillsAndLists(req.accountId)));
router.post('/practice/skill-lists', requireAuth, resolveAccount, practiceListRoute(req => createSkillList(req.accountId, req.body || {})));
router.put('/practice/skill-lists/:id', requireAuth, resolveAccount, practiceListRoute(req => updateSkillList(req.accountId, req.params.id, req.body || {})));
router.delete('/practice/skill-lists/:id', requireAuth, resolveAccount, practiceListRoute(req => deleteSkillList(req.accountId, req.params.id)));
router.post('/practice/skills/result', requireAuth, resolveAccount, practiceListRoute(req => recordSkillResult(req.accountId, req.body || {}).then(skills => ({ skills }))));
// ML-391: Scales Levels - each scale's Level on an instrument, Got it / Not yet, and a Level set by hand.
// Behind its own switch (scales_levels) as well as practice sessions'.
const scaleLevelsRoute = (fn) => practiceListRoute(async (req) => { await assertScaleLevelsEnabled(); return fn(req); });
router.get('/practice/scale-levels', requireAuth, resolveAccount, scaleLevelsRoute(req => getScaleLevels(req.accountId, req.query.instrumentId)));
router.post('/practice/scale-levels/answer', requireAuth, resolveAccount, scaleLevelsRoute(req => answerScale(req.accountId, req.body || {})));
router.put('/practice/scale-levels/level', requireAuth, resolveAccount, scaleLevelsRoute(req => setScaleLevel(req.accountId, req.body || {})));
// ML-343: your own warm-up lists.
router.get('/practice/warmup-lists', requireAuth, resolveAccount, practiceListRoute(req => listWarmupLists(req.accountId).then(lists => ({ lists }))));
router.post('/practice/warmup-lists', requireAuth, resolveAccount, practiceListRoute(req => saveWarmupList(req.accountId, null, req.body || {}).then(lists => ({ lists }))));
router.put('/practice/warmup-lists/:id', requireAuth, resolveAccount, practiceListRoute(req => saveWarmupList(req.accountId, req.params.id, req.body || {}).then(lists => ({ lists }))));
router.delete('/practice/warmup-lists/:id', requireAuth, resolveAccount, practiceListRoute(req => deleteWarmupList(req.accountId, req.params.id).then(lists => ({ lists }))));

router.put('/account/practice-settings', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertPracticeLevelsEnabled();
    res.json(await setSubBeatsBelow(req.accountId, req.body?.subBeatsBelow));
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
// ML-418: the last Level of every quiz at every Theory grade - a session's Theory block picks from it
router.get('/theory/levels', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertTheoryEnabled();
    res.json(await getTheoryLevels(req.accountId));
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

// ML-396: the sets of options played in one quiz, each with its last round - the options screen's list.
router.get('/theory/played', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertTheoryEnabled();
    res.json(await getTheoryPlayed(req.accountId, req.query.quizId));
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
// ML-306: the Rhythm tool's per-rhythm speed Levels and your own words (its rounds save through
// /drills/rhythm/attempts like the other drills).
router.get('/rhythm', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertDrillEnabled('rhythm');
    res.json(await getRhythmLevels(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/rhythm/:patternId/word', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertDrillEnabled('rhythm');
    res.json(await setRhythmWord(req.accountId, req.params.patternId, req.body?.word));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/drills/:tool/summary', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertDrillEnabled(req.params.tool);
    res.json(await getDrillSummary(req.accountId, req.params.tool));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-399: what SmartLearn deals a Pitch or Tempo round by, for one level.
router.get('/drills/:tool/weights', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertDrillEnabled(req.params.tool);
    res.json(await getDrillWeights(req.accountId, req.params.tool, req.query.level));
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
    const [organisations, teachers, durations, enabledFeatures, defaultDuration, practiceYear, limits] = await Promise.all([
      listBands(req.accountId),
      listTutors(),
      listDurationOptions(),
      // ML-190: every enabled feature_key in one list, so the client can gate UI at app-load time
      // without a request per feature - see server/services/features.js.
      listEnabledFeatureKeys(),
      // ML-236: the quick timer's fallback length when there's no practice history to go on.
      getDefaultDurationMinutes(),
      // ML-234: loaded with the rest of the app's startup data since the stats screen needs it.
      getPracticeYearSetting(req.accountId),
      // ML-383: this account type's limits ({ metronome_history_shown: 10, ... }) - Admin -> Feature access
      listLimits()
    ]);
    res.json({ organisations, teachers, durations, enabledFeatures, defaultDuration, practiceYear, limits });
  } catch (error) {
    console.error('Dropdown options error:', error);
    sendError(res, error);
  }
});

// ========================================
// INSTRUMENTS (ML-309) - the catalogue, and the instruments this account plays (My account ->
// My instruments). See server/services/instruments.js.
// ========================================
router.get('/instruments', requireAuth, async (req, res) => {
  try {
    res.json(await listInstruments());
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/account/instruments', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await listAccountInstruments(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/account/instruments', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await setAccountInstruments(req.accountId, req.body?.instrumentIds, req.body?.primaryId));
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// RANGE (ML-322 / ML-305) - your comfortable range per instrument and the Range tool's goes and Levels.
// Behind the range_trainer feature. See server/services/range.js and docs/range.md.
// ========================================
router.get('/range', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertRangeEnabled();
    res.json(await getRange(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/range/:instrumentId', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertRangeEnabled();
    res.json(await setRange(req.accountId, Number(req.params.instrumentId), req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/range/:instrumentId/goes', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertRangeEnabled();
    res.json(await recordGo(req.accountId, Number(req.params.instrumentId), req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/range/:instrumentId/move', requireAuth, resolveAccount, async (req, res) => {
  try {
    await assertRangeEnabled();
    res.json(await moveRange(req.accountId, Number(req.params.instrumentId), req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// SESSIONS (Practice logging)
// ========================================
router.post('/sessions', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { category, duration, who, date, instrumentId } = req.body;
    const sessionType = CATEGORY_TO_SESSION_TYPE[category];
    if (!sessionType) return res.status(400).json({ error: 'Invalid category' });

    const { bandId, tutorId } = await resolveWho(req.accountId, sessionType, who);
    // ML-309: the instrument picked on the form, else the account's main instrument, else none.
    const sessionInstrumentId = await resolveSessionInstrument(req.accountId, instrumentId);

    const { rows } = await pool.query(
      `INSERT INTO sessions (session_type, account_id, band_id, tutor_id, started_at, total_duration_minutes, instrument_id)
       VALUES ($1, $2, $3, $4, ($5::date + (NOW() AT TIME ZONE $7)::time) AT TIME ZONE $7, $6, $8) RETURNING id`,
      [sessionType, req.accountId, bandId, tutorId, date, Number(duration), LONDON_TZ, sessionInstrumentId]
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
              s.total_duration_minutes, b.name AS band_name, t.display_name AS tutor_name,
              s.instrument_id, i.name AS instrument_name
       FROM sessions s
       LEFT JOIN bands b ON b.id = s.band_id
       LEFT JOIN tutors t ON t.id = s.tutor_id
       LEFT JOIN instruments i ON i.id = s.instrument_id
       WHERE s.account_id = $1
       ORDER BY s.started_at DESC`,
      [req.accountId, LONDON_TZ]
    );

    res.json(rows.map(r => ({
      row: Number(r.id),
      category: SESSION_TYPE_TO_CATEGORY[r.session_type],
      dateStr: r.date_str,
      duration: r.total_duration_minutes,
      who: r.band_name || r.tutor_name || '',
      instrumentId: r.instrument_id !== null ? Number(r.instrument_id) : null,
      instrumentName: r.instrument_name || null
    })));
  } catch (error) {
    console.error('Sessions fetch error:', error);
    sendError(res, error);
  }
});

router.put('/sessions/:row', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { row } = req.params;
    const { category, duration, who, date, instrumentId } = req.body;
    const sessionType = CATEGORY_TO_SESSION_TYPE[category];
    if (!sessionType) return res.status(400).json({ error: 'Invalid category' });

    const { bandId, tutorId } = await resolveWho(req.accountId, sessionType, who);
    // ML-309: only changes the instrument when the form sent one (older clients don't).
    const sessionInstrumentId = instrumentId === undefined ? undefined : await resolveSessionInstrument(req.accountId, instrumentId);

    await pool.query(
      `UPDATE sessions SET session_type = $1, band_id = $2, tutor_id = $3,
         started_at = ($4::date + (started_at AT TIME ZONE $8)::time) AT TIME ZONE $8,
         total_duration_minutes = $5,
         instrument_id = CASE WHEN $9::boolean THEN $10::bigint ELSE instrument_id END
       WHERE id = $6 AND account_id = $7`,
      [sessionType, bandId, tutorId, date, Number(duration), row, req.accountId, LONDON_TZ, sessionInstrumentId !== undefined, sessionInstrumentId ?? null]
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

// ML-356: display and reading preferences - saved on the account so they follow you to every device.
router.get('/account/display', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json({ prefs: await getDisplayPrefs(req.accountId) });
  } catch (error) {
    sendError(res, error);
  }
});
router.put('/account/display', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json({ prefs: await saveDisplayPrefs(req.accountId, req.body?.prefs) });
  } catch (error) {
    sendError(res, error);
  }
});

// ML-355 batch 2: Account -> Sign-in and security - two-step sign-in for password logins (set up,
// new recovery codes, turn off). Required for super admins, so they can't turn it off.
router.get('/account/security', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await securityStatus(req.accountId, req.realAccountLevel));
  } catch (error) {
    sendError(res, error);
  }
});
// ML-355 batch 3: change your password (or add one to a Google account). Other devices are signed out;
// this one gets a fresh token.
router.post('/account/password', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await changeOwnPassword(req.accountId, req.body?.current, req.body?.password, req.ip));
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/account/two-step/setup', requireAuth, resolveAccount, async (req, res) => {
  try {
    await requirePasswordAccount(req.accountId);
    res.json(await beginSetup(req.accountId, req.userId));
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/account/two-step/confirm', requireAuth, resolveAccount, async (req, res) => {
  try {
    await requirePasswordAccount(req.accountId);
    res.json(await confirmSetup(req.accountId, req.body?.code));
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/account/two-step/recovery-codes', requireAuth, resolveAccount, async (req, res) => {
  try {
    await requirePasswordAccount(req.accountId);
    res.json(await newRecoveryCodes(req.accountId, req.body?.code));
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/account/two-step/off', requireAuth, resolveAccount, async (req, res) => {
  try {
    await requirePasswordAccount(req.accountId);
    if (req.realAccountLevel === 'super_admin') return res.status(403).json({ error: 'Two-step sign-in is required for super admins.' });
    res.json(await turnOff(req.accountId, req.body?.code));
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

// ML-429: the daily usage reading - called by Vercel's scheduler (vercel.json "crons"), which sends
// "Authorization: Bearer <CRON_SECRET>" when that variable is set on the project. Without CRON_SECRET the
// job is off: the address does nothing for anyone. It reads the meters and emails any warning now due.
router.get('/cron/usage-readings', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) return res.status(401).json({ error: 'Not authorised.' });
  try {
    const results = await readMeters();
    const warnings = await sendUsageWarnings();
    res.json({ read: results.filter((r) => r.ok).length, notRead: results.filter((r) => !r.ok).map((r) => r.key), warnings: warnings.length });
  } catch (error) {
    sendError(res, error);
  }
});

// ML-430: download my information - everything that belongs to the account, as JSON (server/services/accountExport.js)
router.get('/account/export', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await exportMyAccount(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

// ML-430: delete my account - at once, by the member themselves. The body must carry the word typed
// in the pop-up, so a stray request can't do it. What goes and what stays: server/services/accountDeletion.js.
router.delete('/account', requireAuth, resolveAccount, async (req, res) => {
  try {
    if ((req.body || {}).confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm.' });
    res.json(await deleteMyAccount(req.accountId));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/account', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { firstName, surname, displayName, avatar, homeTools, homeStats } = req.body || {};
    await updateAccountProfile(req.accountId, { firstName, surname, displayName, avatar, homeTools, homeStats });
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
// ML-345: whole areas that are off for some account types - the server refuses them too, not just the
// app. Runs before each route's own requireAuth/resolveAccount (they run again there; cheap, cached).
const requireFeature = (...keys) => async (req, res, next) => {
  try {
    for (const k of keys) if (await isFeatureEnabled(k)) return next();
    res.status(403).json({ error: "This feature isn't available right now." });
  } catch (error) {
    sendError(res, error);
  }
};
// Reading the challenges list with challenges off just gets an empty list - the app asks for it at
// startup, before it knows which features this account has. Anything else is refused.
router.use('/challenges', requireAuth, resolveAccount, async (req, res, next) => {
  if (req.method === 'GET' && req.path === '/' && !(await isFeatureEnabled('challenges'))) return res.json([]);
  next();
}, requireFeature('challenges'));
router.use('/metronome/history', requireAuth, resolveAccount, requireFeature('metronome_history'));
router.use('/settings/teachers', requireAuth, resolveAccount, requireFeature('manage_tutor'));

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

    // Editing a task's details (piece/ref/bars/bpm), logging practice progress
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

// ML-34: Quick Play's "Show history" list - registered before the "/metronome/setups/:id"
// route below ("history" is a literal path segment, not an id). The rest of /metronome/setups/:id
// is Quick Play's history too (rename, favourite, delete, load) - the old Metronome Blocks editor's
// own setup/segment routes were removed on 2026-09-27.
router.get('/metronome/history', requireAuth, resolveAccount, async (req, res) => {
  try {
    // ML-383: how many plays this account type sees (Admin -> Feature access, Limits)
    res.json(await listQuickPlayHistory(req.accountId, await getLimit('metronome_history_shown', HISTORY_SHOWN_DEFAULT)));
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

// ========================================
// FLOWS (Jira ML-179) - score-backed practice flows. See docs/database-schema.md's
// "Flow" vs "Score" naming note: the table is `scores`, but the concept/every
// route here is "Flow". Recordings/documents live in Vercel Blob, not Postgres -
// see server/services/flows.js.
// ========================================
// ========================================
// INVITES FROM THE MAIN MENU (Jira ML-402) - any member (feature invite_members) can invite someone to
// the app: always as a Standard member, unless a super admin picks the type. Up to the invites_per_day
// limit in 24 hours; you see and cancel only your own. Needs password_login Live (an invite is an
// email-and-password account). The admin page's own invite routes are unchanged (server/routes/admin.js).
// ========================================
const INVITES_PER_DAY_DEFAULT = 5;
async function inviteState(req) {
  const on = (await isFeatureEnabled('invite_members')) && (await passwordLoginEnabled());
  const limit = await getLimit('invites_per_day', INVITES_PER_DAY_DEFAULT);
  const sent = on ? await invitesSentToday(req.accountId) : 0;
  return { on, limit, left: Math.max(0, limit - sent) };
}
router.get('/invites', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { on, limit, left } = await inviteState(req);
    res.json({ enabled: on, limit, left, invites: on ? await listMyInvites(req.accountId) : [], levels: req.accountLevel === 'super_admin' ? INVITE_LEVELS : null });
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/invites', requireAuth, resolveAccount, async (req, res) => {
  try {
    const { on, limit, left } = await inviteState(req);
    if (!on) throw withStatus(403, "This feature isn't available right now.");
    if (left <= 0) throw withStatus(429, `You've sent ${limit} invites in the last day - you can send more tomorrow.`);
    const { email, firstName, surname, accountLevel } = req.body || {};
    // Only a super admin chooses the type; anyone else's invite is a Standard member whatever was sent.
    const level = req.accountLevel === 'super_admin' && accountLevel ? accountLevel : 'standard_member';
    const invite = await createInvite({ email, firstName, surname, accountLevel: level, createdBy: req.accountId, origin: appUrl(req) });
    res.json({ invite, left: left - 1, invites: await listMyInvites(req.accountId), message: `Invite sent to ${invite.email}` });
  } catch (error) {
    sendError(res, error);
  }
});
router.delete('/invites/:id', requireAuth, resolveAccount, async (req, res) => {
  try {
    if (!(await isFeatureEnabled('invite_members'))) throw withStatus(403, "This feature isn't available right now.");
    await cancelMyInvite(req.accountId, req.params.id);
    res.json({ invites: await listMyInvites(req.accountId), message: 'Invite cancelled' });
  } catch (error) {
    sendError(res, error);
  }
});

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
    // ML-345: a new piece comes from My music's Add a piece or the Metronome's Save to flow.
    if (!(await isFeatureEnabled('flow_create')) && !(await isFeatureEnabled('metronome_save_to_flow'))) {
      return res.status(403).json({ error: "This feature isn't available right now." });
    }
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

// ML-441: who the piece is for, in one step - body { to: 'me' | 'band' | 'public', bandId }
router.put('/flows/:id/audience', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await setFlowAudience(req.accountId, req.params.id, req.body?.to, req.body?.bandId));
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
    const { blobUrl, blobPathname, fileName, fileSizeBytes, mimeType, bandId } = req.body || {};
    if (!blobUrl || !blobPathname || !fileName) throw withStatus(400, 'Missing uploaded file details.');
    // ML-400: the band picked on Add a piece - checked before the file is read, not after the parse.
    if (bandId) await assertBandMembership(req.accountId, bandId);
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

    const flow = await createFlow(req.accountId, { name: parsed.title || undefined, bandId: bandId || undefined });
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

// ML-424: Quick piece entry saves a whole piece's blocks in one go - the piece's bars are replaced by the
// ones sent, each checked by the same rules as the bar-by-bar editor's createFlowBlock (replaceAllFlowBlocks). Only for a piece you can edit; refused when the feature is off for you.
router.put('/flows/:id/blocks/all', requireAuth, resolveAccount, async (req, res) => {
  try {
    if (!(await isFeatureEnabled('piece_quick_entry'))) return res.status(403).json({ error: 'Quick piece entry is not switched on for you.' });
    const blocks = Array.isArray(req.body && req.body.blocks) ? req.body.blocks : null;
    if (!blocks || !blocks.length || blocks.length > 600) return res.status(400).json({ error: 'Send between 1 and 600 blocks.' });
    res.json({ blocks: await replaceAllFlowBlocks(req.accountId, req.params.id, blocks) }); // ML-425: written together, not one at a time
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

// ML-396: "Upgrade now" on a feature's Learn more pop-up (SmartLearn) - emails the owner that this
// account asked for it. See server/services/upgradeRequest.js.
router.post('/upgrade-requests', requireAuth, resolveAccount, async (req, res) => {
  try {
    res.json(await requestUpgrade(req.accountId, String((req.body && req.body.feature) || '')));
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
