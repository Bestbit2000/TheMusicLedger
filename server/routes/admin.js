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
import pool from '../config/db.js';
import { listAccountsForAdmin, setAccountLevel } from '../services/accounts.js';
import { listBandsForAdmin, createSharedBand, updateBandAdmin, deleteOrArchiveBandAdmin } from '../services/bands.js';

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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    createdAt: row.created_at
  };
}

router.get('/features', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, feature_key, name, description, created_at FROM features ORDER BY name'
    );
    res.json({ features: rows.map(toFeature) });
  } catch (error) {
    console.error('Admin features fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/features', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { featureKey, name, description } = req.body;
    if (!featureKey || !name) {
      return res.status(400).json({ error: 'featureKey and name are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO features (feature_key, name, description) VALUES ($1, $2, $3)
       RETURNING id, feature_key, name, description, created_at`,
      [featureKey, name, description || null]
    );
    res.json({ feature: toFeature(rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A feature with key "${req.body.featureKey}" already exists` });
    }
    console.error('Admin feature create error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/features/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { featureKey, name, description } = req.body;
    if (!featureKey || !name) {
      return res.status(400).json({ error: 'featureKey and name are required' });
    }
    const { rows } = await pool.query(
      `UPDATE features SET feature_key = $1, name = $2, description = $3, updated_at = now()
       WHERE id = $4 RETURNING id, feature_key, name, description, created_at`,
      [featureKey, name, description || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Feature not found' });
    res.json({ feature: toFeature(rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A feature with key "${req.body.featureKey}" already exists` });
    }
    console.error('Admin feature update error:', error);
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

router.put('/accounts/:id/level', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    await setAccountLevel(req.params.id, req.body.accountLevel);
    res.json({ message: 'Account level updated' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

router.post('/bands', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { name, website } = req.body;
    res.json({ band: await createSharedBand(req.accountId, name, website) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/bands/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const { name, website, contactEmail } = req.body;
    await updateBandAdmin(req.params.id, { name, website, contactEmail });
    res.json({ message: 'Band updated' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Archived rather than deleted outright if still in use (real members or
// session history) - see deleteOrArchiveBandAdmin.
router.delete('/bands/:id', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {
  try {
    const archived = await deleteOrArchiveBandAdmin(req.params.id);
    res.json({ message: archived ? 'Band archived (still in use)' : 'Band deleted', archived });
  } catch (error) {
    console.error('Admin band delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
