// Admin panel (ML-26). Deliberately its own router/prefix, separate from
// routes/api.js, since this is expected to grow into several unrelated
// sections (Release tests, Features, Accounts, Bands today; Usage later).
//
// Auth note (ML-77): every route in this file requires requireSuperAdmin, on
// top of the usual requireAuth/resolveAccount - see that middleware for what
// "super admin" means. This used to only require being logged in at all,
// same as any other route (no admin-role gating existed anywhere in the
// app) - closed as part of shipping account levels rather than left open.

import express from 'express';
import { requireAuth, resolveAccount, requireSuperAdmin } from '../middleware/auth.js';
import { sendError } from '../utils/httpErrors.js';
import pool from '../config/db.js';
import { listWarmupsForAdmin, createWarmup, updateWarmup, setWarmupActive, moveWarmup, deleteWarmup } from '../services/warmups.js';
import { listAccountsForAdmin, setAccountLevel } from '../services/accounts.js';
import { getFeatureAccess, saveFeatureAccess, clearFeatureCache } from '../services/features.js';
import { listBandsForAdmin, createSharedBand, updateBandAdmin, deleteOrArchiveBandAdmin, setBandDetails } from '../services/bands.js';
import { createInvite, listPendingInvites, cancelInvite, passwordLoginEnabled, appUrl, adminSendReset, adminUnlock, adminSignOutEverywhere, adminTurnOffTwoStep } from '../services/passwordAuth.js';
import { listDurationOptionsForAdmin, createDurationOption, updateDurationOption, deleteDurationOption, listDurationUsageStats, listSessionMinuteCounts } from '../services/durationOptions.js';
import { listTimeSignatureOptionsForAdmin, createTimeSignatureOption, updateTimeSignatureOption, deleteOrArchiveTimeSignatureOption, listNoteValueUsage } from '../services/timeSignatures.js';
import { listPlaybackSpeedsForAdmin, createPlaybackSpeedOption, updatePlaybackSpeedOption, deletePlaybackSpeedOption } from '../services/playbackSpeeds.js';
import { getConfigValue, setConfigValue } from '../services/appConfig.js';
import { getFlowAuthoringStats, setFlowAuthoringSessionExcluded, currentAppVersion } from '../services/flowAuthoringStats.js';
import { listFeedbackForAdmin, updateFeedbackAdmin } from '../services/feedback.js';
import { listFlowsForAdmin, exportFlows, previewImport, previewSummary, commitImport, MAX_IMPORT_BYTES } from '../services/flowTransfer.js';
import { listNotificationsForAdmin, createNotification, updateNotification, setNotificationWithdrawn, deleteNotification } from '../services/notifications.js';
import { getSecurityReview, runSecurityReviewNow } from '../services/securityReview.js';
import { getSiteSecurityReview, runSiteSecurityReviewNow } from '../services/siteSecurityReview.js';
import thirdPartyRegister from '../thirdParties/register.js';
import { costsAndUsage, addCost, updateCost, deleteCost, readMeters, recordManualReading, sendUsageWarnings } from '../services/thirdPartyUsage.js';
import { getBusinessCase, saveBusinessCase, resetBusinessCase } from '../services/businessCase.js';
import { getAdminDashboard } from '../services/adminDashboard.js';
import { listRecords, saveRecord, setAttentionDone } from '../services/thirdPartyRecords.js';
import { retentionStatus, saveRule, runRetention } from '../services/retention.js';
import { applyRecords } from '../thirdParties/records.js';
import { getInstrumentUsageStats } from '../services/instruments.js';
import { listRestMessages, createRestMessage, updateRestMessage, setRestMessageActive, deleteRestMessage, moveRestMessage } from '../services/restMessages.js';

const router = express.Router();

// ========================================
// RELEASE TESTS (ML-29 back-test registry)
// ========================================
router.get('/backtest', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const [features, testCases, links, runs, results] = await Promise.all([
      pool.query('SELECT id, feature_key, name, description FROM features ORDER BY name'),
      pool.query(
        `SELECT id, jira_ticket_key, title, passes_if_criteria, is_active, version_added
         FROM test_cases ORDER BY id`
      ),
      pool.query('SELECT test_case_id, feature_id FROM test_case_features'),
      pool.query(
        `SELECT id, trigger_source, total_tests, passed_tests, failed_tests, duration_ms, started_at, completed_at
         FROM test_runs ORDER BY started_at DESC LIMIT 20`
      ),
      pool.query(
        `SELECT r.id, r.test_run_id, r.test_case_id, r.verdict, r.error_message, r.notes, r.duration_ms, r.created_at
         FROM test_run_results r
         JOIN test_runs tr ON tr.id = r.test_run_id
         ORDER BY tr.started_at DESC LIMIT 200`
      )
    ]);

    const resultsByTestCase = new Map();
    for (const row of results.rows) {
      const list = resultsByTestCase.get(row.test_case_id) || [];
      list.push({
        id: Number(row.id),
        testRunId: Number(row.test_run_id),
        verdict: row.verdict,
        errorMessage: row.error_message,
        notes: row.notes,
        durationMs: row.duration_ms,
        createdAt: row.created_at
      });
      resultsByTestCase.set(row.test_case_id, list);
    }

    // A test_case can cover several features (test_case_features, ML-26/29) -
    // it appears under every feature it's linked to, not just one.
    const featureIdsByTestCase = new Map();
    for (const link of links.rows) {
      const list = featureIdsByTestCase.get(link.test_case_id) || [];
      list.push(link.feature_id);
      featureIdsByTestCase.set(link.test_case_id, list);
    }
    const testCasesByFeature = new Map();
    for (const tc of testCases.rows) {
      const serialized = {
        id: Number(tc.id),
        jiraTicketKey: tc.jira_ticket_key,
        title: tc.title,
        passesIfCriteria: tc.passes_if_criteria,
        isActive: tc.is_active,
        versionAdded: tc.version_added,
        runs: (resultsByTestCase.get(tc.id) || []) // already ordered most-recent-first
      };
      for (const featureId of (featureIdsByTestCase.get(tc.id) || [])) {
        const list = testCasesByFeature.get(featureId) || [];
        list.push(serialized);
        testCasesByFeature.set(featureId, list);
      }
    }

    res.json({
      features: features.rows.map(f => ({
        id: Number(f.id),
        featureKey: f.feature_key,
        name: f.name,
        description: f.description,
        testCases: testCasesByFeature.get(f.id) || []
      })),
      recentRuns: runs.rows.map(r => ({
        id: Number(r.id),
        triggerSource: r.trigger_source,
        totalTests: r.total_tests,
        passedTests: r.passed_tests,
        failedTests: r.failed_tests,
        durationMs: r.duration_ms,
        startedAt: r.started_at,
        completedAt: r.completed_at
      }))
    });
  } catch (error) {
    console.error('Admin backtest fetch error:', error);
    sendError(res, error);
  }
});

// Flat list of every test case with the feature(s) it covers - ML-26's
// "link under Release tests to see the list of test cases and the features
// they're designed to test".
router.get('/test-cases', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const [testCases, links, features, results] = await Promise.all([
      pool.query(
        `SELECT id, jira_ticket_key, title, passes_if_criteria, is_active, version_added
         FROM test_cases ORDER BY title`
      ),
      pool.query('SELECT test_case_id, feature_id FROM test_case_features'),
      pool.query('SELECT id, feature_key, name FROM features'),
      pool.query(
        `SELECT r.test_case_id, r.verdict
         FROM test_run_results r
         JOIN test_runs tr ON tr.id = r.test_run_id
         ORDER BY tr.started_at DESC`
      )
    ]);

    const featureById = new Map(
      features.rows.map(f => [Number(f.id), { id: Number(f.id), featureKey: f.feature_key, name: f.name }])
    );
    const featureIdsByTestCase = new Map();
    for (const link of links.rows) {
      const list = featureIdsByTestCase.get(link.test_case_id) || [];
      list.push(Number(link.feature_id));
      featureIdsByTestCase.set(link.test_case_id, list);
    }
    const latestVerdictByTestCase = new Map();
    const totalRunsByTestCase = new Map();
    for (const r of results.rows) { // already most-recent-first
      totalRunsByTestCase.set(r.test_case_id, (totalRunsByTestCase.get(r.test_case_id) || 0) + 1);
      if (!latestVerdictByTestCase.has(r.test_case_id)) latestVerdictByTestCase.set(r.test_case_id, r.verdict);
    }

    res.json({
      testCases: testCases.rows.map(tc => ({
        id: Number(tc.id),
        title: tc.title,
        passesIfCriteria: tc.passes_if_criteria,
        jiraTicketKey: tc.jira_ticket_key,
        isActive: tc.is_active,
        versionAdded: tc.version_added,
        features: (featureIdsByTestCase.get(tc.id) || []).map(fid => featureById.get(fid)).filter(Boolean),
        latestVerdict: latestVerdictByTestCase.get(tc.id) || null,
        totalRuns: totalRunsByTestCase.get(tc.id) || 0
      }))
    });
  } catch (error) {
    console.error('Admin test-cases fetch error:', error);
    sendError(res, error);
  }
});

// ========================================
// FEATURES (app-wide catalog, ML-26) - manual CRUD so this can be curated
// by hand, not just seeded by migrations.
// ========================================
function toFeature(row) {
  return {
    id: Number(row.id),
    featureKey: row.feature_key,
    name: row.name,
    description: row.description,
    // ML-190: the one column the running app itself reads (server/services/features.js) - see
    // that file/docs/database-schema.md's "Feature catalog" note for why this is opt-in gating,
    // not a default-deny allowlist.
    enabled: row.enabled,
    createdAt: row.created_at
  };
}

router.get('/features', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, feature_key, name, description, enabled, created_at FROM features ORDER BY name'
    );
    res.json({ features: rows.map(toFeature) });
  } catch (error) {
    console.error('Admin features fetch error:', error);
    sendError(res, error);
  }
});

router.post('/features', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { featureKey, name, description, enabled } = req.body;
    if (!featureKey || !name) {
      return res.status(400).json({ error: 'featureKey and name are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO features (feature_key, name, description, enabled) VALUES ($1, $2, $3, $4)
       RETURNING id, feature_key, name, description, enabled, created_at`,
      [featureKey, name, description || null, enabled !== false]
    );
    res.json({ feature: toFeature(rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A feature with key "${req.body.featureKey}" already exists` });
    }
    console.error('Admin feature create error:', error);
    sendError(res, error);
  }
});

// ML-345: Admin -> Feature access - every feature by account type, and Live (the master switch).
// Saved together (one transaction), since it changes production for real people.
router.get('/feature-access', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await getFeatureAccess());
  } catch (error) {
    sendError(res, error);
  }
});
router.put('/feature-access', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await saveFeatureAccess(req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/features/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    clearFeatureCache(); // ML-345: Live may change
    const { featureKey, name, description, enabled } = req.body;
    if (!featureKey || !name) {
      return res.status(400).json({ error: 'featureKey and name are required' });
    }
    const { rows } = await pool.query(
      `UPDATE features SET feature_key = $1, name = $2, description = $3, enabled = $4, updated_at = now()
       WHERE id = $5 RETURNING id, feature_key, name, description, enabled, created_at`,
      [featureKey, name, description || null, enabled !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Feature not found' });
    res.json({ feature: toFeature(rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A feature with key "${req.body.featureKey}" already exists` });
    }
    console.error('Admin feature update error:', error);
    sendError(res, error);
  }
});

// Deleting a feature only removes its rows in the test_case_features join
// table (ON DELETE CASCADE there) - a test case can cover several features,
// so removing one never deletes the test case itself or its run history.
router.delete('/features/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM features WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Feature not found' });
    res.json({ message: 'Feature deleted' });
  } catch (error) {
    console.error('Admin feature delete error:', error);
    sendError(res, error);
  }
});

// ========================================
// WARM-UPS (ML-294) - super admins add, edit, reorder, switch on/off and delete the Warm-ups tool's
// exercises. Every save is checked by services/warmups.js (bars add up, pitches in range).
// ========================================
router.get('/warmups', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ exercises: await listWarmupsForAdmin() });
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/warmups', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ exercise: await createWarmup(req.body || {}) });
  } catch (error) {
    sendError(res, error);
  }
});
router.put('/warmups/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ exercise: await updateWarmup(req.params.id, req.body || {}) });
  } catch (error) {
    sendError(res, error);
  }
});
router.put('/warmups/:id/active', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ exercise: await setWarmupActive(req.params.id, req.body && req.body.isActive) });
  } catch (error) {
    sendError(res, error);
  }
});
router.put('/warmups/:id/move', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await moveWarmup(req.params.id, Number(req.body && req.body.direction));
    res.json({ exercises: await listWarmupsForAdmin() });
  } catch (error) {
    sendError(res, error);
  }
});
router.delete('/warmups/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await deleteWarmup(req.params.id);
    res.json({ message: 'Exercise deleted' });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// ACCOUNTS (ML-77) - view/manage every account's site-wide level.
// ========================================
router.get('/accounts', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ accounts: await listAccountsForAdmin() });
  } catch (error) {
    console.error('Admin accounts fetch error:', error);
    sendError(res, error);
  }
});

router.put('/accounts/:id/level', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await setAccountLevel(req.params.id, req.body.accountLevel);
    res.json({ message: 'Account level updated' });
  } catch (error) {
    sendError(res, error);
  }
});

// ML-355 batch 3: help with someone's login - email them a reset link, clear a lock after too many wrong
// tries, turn off two-step sign-in (a lost phone), or sign them out on every device.
const accountAction = (fn, message) => async (req, res) => {
  try {
    const result = await fn(req);
    res.json({ message: typeof message === 'function' ? message(result) : message });
  } catch (error) {
    sendError(res, error);
  }
};
router.post('/accounts/:id/send-reset', requireAuth, resolveAccount, requireSuperAdmin,
  accountAction((req) => adminSendReset(req.params.id, appUrl(req)), (email) => `Reset link sent to ${email}`));
router.post('/accounts/:id/unlock', requireAuth, resolveAccount, requireSuperAdmin,
  accountAction((req) => adminUnlock(req.params.id), 'Unlocked - they can try again now'));
router.post('/accounts/:id/two-step/off', requireAuth, resolveAccount, requireSuperAdmin,
  accountAction((req) => adminTurnOffTwoStep(req.params.id), 'Two-step sign-in is off for them - they can set it up again'));
router.post('/accounts/:id/sign-out', requireAuth, resolveAccount, requireSuperAdmin,
  accountAction((req) => adminSignOutEverywhere(req.params.id), 'Signed out on every device'));

// ML-355: invite someone to log in with their email and a password (password_login must be on).
router.get('/invites', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ enabled: await passwordLoginEnabled(), invites: await listPendingInvites() });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/invites', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { email, firstName, surname, accountLevel } = req.body || {};
    const invite = await createInvite({ email, firstName, surname, accountLevel, createdBy: req.accountId, origin: appUrl(req) });
    res.json({ invite, message: `Invite sent to ${invite.email}` });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/invites/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await cancelInvite(req.params.id);
    res.json({ message: 'Invite cancelled' });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// BANDS (ML-89) - manage the shared band directory. createSharedBand is the
// same function the account page's self-service "add a band" flow uses
// (server/routes/api.js's POST /account/bands) - same reachability/duplicate
// checks either way, just a different caller/permission gate.
// ========================================
router.get('/bands', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ bands: await listBandsForAdmin() });
  } catch (error) {
    console.error('Admin bands fetch error:', error);
    sendError(res, error);
  }
});

router.post('/bands', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { name, website, ...details } = req.body;
    // ML-247: adding a band to the directory doesn't make the admin a member of it.
    const band = await createSharedBand(req.accountId, name, website, { joinCreator: false });
    await setBandDetails(band.id, details); // migration 073: kind, town, section, main band...
    res.json({ band });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/bands/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await updateBandAdmin(req.params.id, req.body || {});
    res.json({ message: 'Band updated' });
  } catch (error) {
    sendError(res, error);
  }
});

// Archived rather than deleted outright if still in use (real members or
// session history) - see deleteOrArchiveBandAdmin.
router.delete('/bands/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { archived, memberCount, sessionCount } = await deleteOrArchiveBandAdmin(req.params.id);
    // ML-247: say what's still using it, not just "still in use".
    const reasons = [
      sessionCount ? `${sessionCount} session${sessionCount === 1 ? '' : 's'} still use${sessionCount === 1 ? 's' : ''} it` : null,
      memberCount ? `${memberCount} member${memberCount === 1 ? '' : 's'} still belong${memberCount === 1 ? 's' : ''} to it` : null
    ].filter(Boolean).join(' and ');
    res.json({ message: archived ? `Band archived - ${reasons}` : 'Band deleted', archived });
  } catch (error) {
    console.error('Admin band delete error:', error);
    sendError(res, error);
  }
});

// ========================================
// METADATA LISTS (ML-109) - the system-wide reference lists the app itself
// depends on: session/timer durations, the time signature catalog, note
// values (read-only usage view - see listNoteValueUsage), and Metronome
// Blocks' play-speed presets.
// ========================================
router.get('/durations', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ durations: await listDurationOptionsForAdmin() });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/durations', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ duration: await createDurationOption(req.body.minutes) });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/durations/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { minutes, sortOrder, active, isDefault } = req.body;
    await updateDurationOption(req.params.id, { minutes, sortOrder, active, isDefault });
    res.json({ message: 'Duration updated' });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/durations/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await deleteDurationOption(req.params.id);
    res.json({ message: 'Duration deleted' });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/time-signatures', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ timeSignatures: await listTimeSignatureOptionsForAdmin() });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/time-signatures', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { numerator, denominator, label } = req.body;
    res.json({ timeSignature: await createTimeSignatureOption(numerator, denominator, label) });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/time-signatures/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { numerator, denominator, label, sortOrder, active } = req.body;
    await updateTimeSignatureOption(req.params.id, { numerator, denominator, label, sortOrder, active });
    res.json({ message: 'Time signature updated' });
  } catch (error) {
    sendError(res, error);
  }
});

// Archived rather than deleted outright if any block anywhere still references it.
router.delete('/time-signatures/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const archived = await deleteOrArchiveTimeSignatureOption(req.params.id);
    res.json({ message: archived ? 'Time signature archived (still in use)' : 'Time signature deleted', archived });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// USAGE (ML-109 follow-up) - stats-only views, not management; the list-management routes for these
// same underlying tables live above (durations, time signatures, playback speeds).
// ========================================

// Read-only - note_value is a fixed CHECK constraint, not a manageable table (see listNoteValueUsage).
router.get('/usage/note-values', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ noteValues: await listNoteValueUsage() });
  } catch (error) {
    sendError(res, error);
  }
});

// ML-309: practice time by instrument (sessions.instrument_id), plus who plays what.
router.get('/usage/instruments', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await getInstrumentUsageStats());
  } catch (error) {
    sendError(res, error);
  }
});

// Matched by value against sessions.total_duration_minutes, not a real reference - see
// listDurationUsageStats.
router.get('/usage/durations', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const [durationUsage, sessionMinutes] = await Promise.all([listDurationUsageStats(), listSessionMinuteCounts()]);
    res.json({ durationUsage, sessionMinutes }); // ML-308: sessionMinutes feeds the two charts
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// FEEDBACK TRIAGE (ML-170) - reading and acting on what users submitted via POST /api/feedback.
// Super-admin-only like everything else in this file, which matters more here than most: these rows
// are attributed prose written by named users, not aggregate numbers.
// ========================================
router.get('/feedback', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await listFeedbackForAdmin({ status: req.query.status, category: req.query.category }));
  } catch (error) {
    sendError(res, error);
  }
});

// PUT rather than the PATCH the ticket names - every other update route in this app is a PUT that
// merges only the fields present (see /flows/:id, /features/:id), and the behaviour asked for is
// exactly that. Matching the house convention beats matching the verb in the ticket text.
router.put('/feedback/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { status, category, adminResponse } = req.body || {};
    res.json(await updateFeedbackAdmin(req.params.id, { status, category, adminResponse }));
  } catch (error) {
    sendError(res, error);
  }
});

// Flow authoring time (ML-199) - the baseline for how long building a Flow by hand actually takes.
// Super-admin-only like everything in this file, which is also what the ticket asked for: these
// rows are per-user timings, not aggregate product analytics.
router.get('/usage/flow-authoring', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await getFlowAuthoringStats());
  } catch (error) {
    sendError(res, error);
  }
});

// Drop a run from the statistics without destroying it - see setFlowAuthoringSessionExcluded.
router.put('/usage/flow-authoring/:id/excluded', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await setFlowAuthoringSessionExcluded(req.params.id, req.body?.isExcluded, req.body?.reason));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/playback-speeds', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ playbackSpeeds: await listPlaybackSpeedsForAdmin() });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/playback-speeds', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ playbackSpeed: await createPlaybackSpeedOption(req.body.percent) });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/playback-speeds/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { percent, active } = req.body;
    await updatePlaybackSpeedOption(req.params.id, { percent, active });
    res.json({ message: 'Playback speed updated' });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/playback-speeds/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await deletePlaybackSpeedOption(req.params.id);
    res.json({ message: 'Playback speed deleted' });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// APP CONFIG (ML-47) - small admin-editable settings, e.g. the PostHog
// dashboard link, that shouldn't need a release to change. Only known keys
// (seeded by migration) can be read/written - see services/appConfig.js.
// ========================================
router.get('/config/:key', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ key: req.params.key, value: await getConfigValue(req.params.key) });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/config/:key', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ key: req.params.key, value: await setConfigValue(req.params.key, req.body.value) });
  } catch (error) {
    sendError(res, error);
  }
});


// ========================================
// NOTIFICATIONS (ML-201) - announcements shown in every account's ☰ -> Notifications. Publish now or
// at a future time (no scheduler - "live" is computed at read time, see services/notifications.js),
// optional expiry, withdraw (keeps read stats) or delete.
// ========================================
router.get('/notifications', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await listNotificationsForAdmin());
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/notifications', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await createNotification(req.accountId, req.body));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/notifications/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await updateNotification(req.params.id, req.body));
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/notifications/:id/withdrawn', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await setNotificationWithdrawn(req.params.id, !!req.body?.withdrawn));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/notifications/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await deleteNotification(req.params.id);
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// REST MESSAGES (ML-390) - what the 30-second rest between practice blocks shows. Changed here, no
// release needed. Players draw from their own shuffled deck (services/restMessages.js).
// ========================================
const restRoute = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (error) {
    sendError(res, error);
  }
};
router.get('/rest-messages', requireAuth, resolveAccount, requireSuperAdmin, restRoute(async () => ({ messages: await listRestMessages() })));
router.post('/rest-messages', requireAuth, resolveAccount, requireSuperAdmin, restRoute(req => createRestMessage(req.body || {})));
router.put('/rest-messages/:id', requireAuth, resolveAccount, requireSuperAdmin, restRoute(req => updateRestMessage(Number(req.params.id), req.body || {})));
router.put('/rest-messages/:id/active', requireAuth, resolveAccount, requireSuperAdmin, restRoute(req => setRestMessageActive(Number(req.params.id), !!req.body?.active)));
router.put('/rest-messages/:id/move', requireAuth, resolveAccount, requireSuperAdmin, restRoute(async req => ({ messages: await moveRestMessage(Number(req.params.id), req.body?.dir) })));
router.delete('/rest-messages/:id', requireAuth, resolveAccount, requireSuperAdmin, restRoute(req => deleteRestMessage(Number(req.params.id))));

// ========================================
// FLOW TRANSFER (ML-204) - copying flows between environments (e.g. production -> dev/sandbox for
// testing) as MusicXML. See server/services/flowTransfer.js and docs/flow-musicxml.md.
// ========================================
router.get('/flows', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json({ flows: await listFlowsForAdmin() });
  } catch (error) {
    sendError(res, error);
  }
});

// One id -> a .musicxml file; several -> a .zip. Sent as a download (Content-Disposition) - the
// admin page fetches it with the auth header and saves the blob, since a plain link can't carry one.
router.post('/flows/export', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const { fileName, contentType, body } = await exportFlows(ids, {
      appVersion: currentAppVersion(),
      envName: process.env.NEON_BRANCH || process.env.VERCEL_ENV || 'export'
    });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(body);
  } catch (error) {
    sendError(res, error);
  }
});

// Import is two calls on the same file: /preview (parse + validate, writes nothing) then /import
// (writes, re-validating first). The file is sent as the raw request body - flows export to a few
// KB each, so even a large .zip is far inside the request cap and needs no Blob round-trip.
const rawImportBody = express.raw({ type: () => true, limit: MAX_IMPORT_BYTES });

router.post('/flows/import/preview', requireAuth, resolveAccount, requireSuperAdmin, rawImportBody, async (req, res) => {
  try {
    const preview = await previewImport(req.accountId, req.body, String(req.query.fileName || 'upload.musicxml'));
    res.json(previewSummary(preview));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/flows/import', requireAuth, resolveAccount, requireSuperAdmin, rawImportBody, async (req, res) => {
  try {
    res.json(await commitImport(req.accountId, req.body, String(req.query.fileName || 'upload.musicxml')));
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// SECURITY (ML-192) - repeatable review of the OMR service (solfascribe-omr). GET is the whole
// page (checks, latest results, verdict, history); POST runs the automated checks now and records
// them. The deep review's results come from the repo, not these routes - see securityReview.js.
// ========================================
router.get('/security-review', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(req.query.target === 'site' ? await getSiteSecurityReview() : await getSecurityReview());
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/security-review/run', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    // ML-231: ?target=site reviews this site; with nothing, the PDF import service (ML-192)
    if (req.query.target === 'site') {
      const runId = await runSiteSecurityReviewNow(req.accountId, process.env.APP_URL || `${req.protocol}://${req.get('host')}`);
      return res.json({ runId, ...(await getSiteSecurityReview()) });
    }
    const runId = await runSecurityReviewNow(req.accountId);
    res.json({ runId, ...(await getSecurityReview()) });
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// THIRD PARTIES (ML-267) - the register of everyone the app depends on, with their terms and what
// those ask of us. Read-only: the register is a file in the repo (server/thirdParties/register.js),
// checked on release by `npm run third-party-audit`. See docs/third-party-providers.md.
// ========================================
// ML-429: the same page also shows what each one costs and how close its plan's limit is
// (server/services/thirdPartyUsage.js). If those tables can't be read the register still shows.
const thirdPartyKeys = () => thirdPartyRegister.entries.map((e) => e.key);
async function thirdPartiesPage() {
  let money = null;
  try { money = await costsAndUsage(); } catch (error) { console.error('Third-party costs and usage not loaded:', error.message); }
  // ML-462: the owner's own reference, note and "dealt with" marks, laid over the register
  let entries = thirdPartyRegister.entries;
  try { entries = applyRecords(entries, await listRecords()); } catch (error) { console.error('Third-party records not loaded:', error.message); entries = applyRecords(entries, {}); }
  return { ...thirdPartyRegister, entries, ...(money || {}) };
}

// ML-462: what the owner records about a third party on the site - a reference and a note...
router.put('/third-parties/:key/record', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await saveRecord(req.params.key, req.body, thirdPartyKeys());
    res.json(await thirdPartiesPage());
  } catch (error) {
    sendError(res, error);
  }
});

// ...and a "needs attention" item marked as dealt with, or open again
router.post('/third-parties/:key/attention', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const entry = thirdPartyRegister.entries.find((e) => e.key === req.params.key);
    await setAttentionDone(req.params.key, String((req.body || {}).text || ''), !!(req.body || {}).done, (entry && entry.attention) || [], thirdPartyKeys());
    res.json(await thirdPartiesPage());
  } catch (error) {
    sendError(res, error);
  }
});
router.get('/third-parties', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  res.json(await thirdPartiesPage());
});

router.post('/third-parties/costs', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await addCost(req.accountId, req.body, thirdPartyKeys());
    res.json(await thirdPartiesPage());
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/third-parties/costs/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await updateCost(req.params.id, req.body, thirdPartyKeys());
    res.json(await thirdPartiesPage());
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/third-parties/costs/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await deleteCost(req.params.id);
    res.json(await thirdPartiesPage());
  } catch (error) {
    sendError(res, error);
  }
});

// "Read now": every meter that can be read without a person, then any warning that is now due.
router.post('/third-parties/usage/read', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const results = await readMeters();
    const warnings = await sendUsageWarnings();
    res.json({ results, warnings, ...(await thirdPartiesPage()) });
  } catch (error) {
    sendError(res, error);
  }
});

// A number typed in from a provider's dashboard.
router.post('/third-parties/usage/:meter', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await recordManualReading(req.params.meter, (req.body || {}).value, (req.body || {}).note);
    await sendUsageWarnings();
    res.json(await thirdPartiesPage());
  } catch (error) {
    sendError(res, error);
  }
});

// ========================================
// BUSINESS CASE (ML-443)
// ========================================
// The owner's plan of what each way of rolling the app out costs and could earn, for up to five
// years. One document, read and saved whole; the sums are public/businessCase.js, which the page runs
// itself so a changed figure redraws at once. See docs/business-case.md.
router.get('/business-case', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await getBusinessCase());
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/business-case', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await saveBusinessCase((req.body || {}).plan));
  } catch (error) {
    sendError(res, error);
  }
});

// Back to the starting figures - the saved plan is thrown away.
router.post('/business-case/reset', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await resetBusinessCase());
  } catch (error) {
    sendError(res, error);
  }
});

// ML-443: the page the panel opens on - people, the build, money and what needs the owner, all read
// from what the app already holds (server/services/adminDashboard.js).
router.get('/dashboard', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await getAdminDashboard());
  } catch (error) {
    sendError(res, error);
  }
});

// ML-464: retention - the rule (a switch, a unit, three lengths of time), who is next, and "Run now".
// The same job runs once a day from the scheduler (routes/api.js). docs/retention.md.
router.get('/retention', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await retentionStatus());
  } catch (error) {
    sendError(res, error);
  }
});
router.put('/retention', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await saveRule(req.body || {});
    res.json(await retentionStatus());
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/retention/run', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const result = await runRetention({ appUrl: process.env.APP_URL || `${req.protocol}://${req.get('host')}` });
    res.json({ result, ...(await retentionStatus()) });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
