// ML-579: adding pieces is free; a stored file on your own piece needs "Files on a piece" (piece_files, Premium),
// while files on a band's piece and a YouTube link stay free. Checked from the source, so no file route can lose
// the check and the migration can't hand the switch to Standard.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('every file upload to a piece asks assertCanAddFiles on the server; a YouTube link does not', () => {
  const api = read('server/routes/api.js');
  for (const route of ["'/flows/:id/recordings/upload-token'", "'/flows/:id/documents/upload-token'", "'/flows/:id/recordings', requireAuth", "'/flows/:id/documents', requireAuth"]) {
    const at = api.indexOf(route);
    assert.ok(at > -1, route);
    assert.ok(api.slice(at, at + 900).includes('assertCanAddFiles(req.accountId, req.params.id)'), route);
  }
  const yt = api.indexOf("'/flows/:id/recordings/youtube'");
  assert.ok(!api.slice(yt, yt + 300).includes('assertCanAddFiles'), 'a YouTube link stays free');
});

test("a band's piece is free; your own needs piece_files", () => {
  const flows = read('server/services/flows.js');
  const at = flows.indexOf('export async function assertCanAddFiles');
  const fn = flows.slice(at, at + 400);
  assert.ok(fn.includes('if (score.owner_band_id) return score;'));
  assert.ok(fn.includes("isFeatureEnabled('piece_files')"));
});

test('the migration gives piece_files to Premium and the types with its features, not Standard, and leaves Add a piece alone', () => {
  const sql = read('db/migrations/145_piece_files.sql');
  assert.ok(sql.includes("('standard_member', false), ('premium_member', true), ('beta_tester', true), ('teacher', true), ('band_admin', true)"));
  assert.ok(!/UPDATE\s+feature_access/i.test(sql), 'Add a piece is switched on for Standard after the release, on Admin -> Feature access');
});

test('the edit screen hides the upload buttons on your own piece without it, with a note', () => {
  const app = read('public/app.js');
  assert.ok(app.includes("function pieceFilesAllowed() { return !!(currentFlowDetail && currentFlowDetail.ownerBandId) || isFeatureEnabled('piece_files'); }"));
  const html = read('public/app.html');
  assert.ok(html.includes('id="flowRecordingFilesNote"') && html.includes('id="flowDocumentFilesNote"'));
});
