// ML-411: who may delete a piece - its owner, the person who added a band piece (or a super admin),
// a super admin for a public piece. And the pieces service asks this rule before it deletes anything.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canDeleteFlow } from '../services/flowPermissions.js';

const personal = { owner_account_id: '7', owner_band_id: null, is_public: false, added_by_account_id: null };
const band = (addedBy) => ({ owner_account_id: null, owner_band_id: '3', is_public: false, added_by_account_id: addedBy });
const publicPiece = { owner_account_id: '1', owner_band_id: null, is_public: true, added_by_account_id: null };

test('a personal piece: its owner only', () => {
    assert.equal(canDeleteFlow(personal, 7), true);
    assert.equal(canDeleteFlow(personal, '7'), true); // ids arrive as strings from pg and as numbers from the route
    assert.equal(canDeleteFlow(personal, 8), false);
    assert.equal(canDeleteFlow(personal, 8, true), false); // a super admin can't reach it anyway
});

test('a band piece: the person who added it, not the rest of the band', () => {
    assert.equal(canDeleteFlow(band('7'), 7), true);
    assert.equal(canDeleteFlow(band('7'), 8), false);
});

test('a band piece with no known adder: nobody but a super admin', () => {
    assert.equal(canDeleteFlow(band(null), 7), false);
    assert.equal(canDeleteFlow(band(undefined), 7), false);
    assert.equal(canDeleteFlow(band(null), 7, true), true);
});

test('a super admin can delete any piece of a band they are in', () => {
    assert.equal(canDeleteFlow(band('7'), 9, true), true);
});

test('a public piece: a super admin only, even for the account that published it', () => {
    assert.equal(canDeleteFlow(publicPiece, 1), false);
    assert.equal(canDeleteFlow(publicPiece, 1, true), true);
});

test('no piece, no delete', () => {
    assert.equal(canDeleteFlow(null, 7, true), false);
});

// The service: delete and take-out-of-band both ask the rule, and the adder is written whenever a
// piece becomes a band piece and cleared when it stops being one.
test('the pieces service asks the rule before deleting or taking a piece out of its band', () => {
    const flows = fs.readFileSync(new URL('../services/flows.js', import.meta.url), 'utf8');
    const body = (name) => flows.slice(flows.indexOf(`export async function ${name}(`), flows.indexOf('\n}\n', flows.indexOf(`export async function ${name}(`)));
    for (const name of ['deleteFlow', 'removeFlowFromBand']) assert.match(body(name), /canDeleteFlow\(/, name);
    assert.match(body('createFlow'), /added_by_account_id/);
    assert.match(body('moveFlowToBand'), /added_by_account_id = \$/);
    for (const name of ['removeFlowFromBand', 'publishFlow']) assert.match(body(name), /added_by_account_id = NULL/, name);
});
