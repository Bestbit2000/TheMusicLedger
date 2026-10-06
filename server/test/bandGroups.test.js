// ML-473: a member's own labels are theirs alone, and a band's shared space is by invitation only
// (server/services/bands.js) - against a real database, because the point is what one member can see
// or do of another's. Also the time signature owner check (metronomeSetups.js). Runs only when pointed
// at the dev branch:
//   node --env-file=../.env --test test/bandGroups.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. Everything it makes belongs to throwaway accounts
// and one throwaway directory entry, which it removes again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const bands = await import('../services/bands.js');
const { assertOwnTimeSignatures } = await import('../services/metronomeSetups.js');
const flows = await import('../services/flows.js');
const lists = await import('../services/practiceLists.js');

const stamp = Date.now();
const accounts = [];
const made = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const emailOf = (name) => `ml473-${name}-${stamp}@themusicledger.local`;
const account = async (name) => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, $2, 'Test') RETURNING id`, [emailOf(name), name])).id);
  accounts.push(id);
  return id;
};
const directoryBand = async (creator) => {
  const id = Number((await one(`INSERT INTO bands (name, website, created_by_account_id, kind) VALUES ($1, $2, $3, 'directory') RETURNING id`, [`ML-473 Test Band ${stamp}`, `https://ml473-${stamp}.example`, creator])).id);
  made.push(id);
  return id;
};
const status = (code) => (e) => e.status === code;
const skip = !onDev && 'needs the dev database';

after(async () => {
  if (onDev) {
    await pool.query(`DELETE FROM scores WHERE owner_account_id = ANY($1) OR added_by_account_id = ANY($1)`, [accounts]).catch(() => {});
    await pool.query(`DELETE FROM bands WHERE kind = 'group' AND created_by_account_id = ANY($1)`, [accounts]).catch(() => {});
    await pool.query(`DELETE FROM sessions WHERE account_id = ANY($1)`, [accounts]).catch(() => {});
    await pool.query(`DELETE FROM bands WHERE created_by_account_id = ANY($1) OR id = ANY($2)`, [accounts, made]).catch(() => {});
    for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
    // An invitation emails its address (the outbox, on dev) and may make a newcomer's link
    await pool.query('DELETE FROM email_outbox WHERE to_email LIKE $1', [`%-${stamp}@%`]).catch(() => {});
    await pool.query('DELETE FROM auth_email_links WHERE email LIKE $1', [`%-${stamp}@%`]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test("a member's own labels are theirs alone: not in the directory, not joinable, not another member's to change", { skip }, async () => {
  const anna = await account('anna');
  const ben = await account('ben');
  const label = await bands.getOrCreateBand(anna, `Anna's quartet ${stamp}`);
  assert.deepEqual((await bands.listBands(anna)).map((b) => b.name), [`Anna's quartet ${stamp}`]);
  assert.deepEqual(await bands.listBands(ben), []);
  assert.ok(!(await bands.listAllBands()).some((b) => b.id === Number(label)), 'a label is not in the directory');
  await assert.rejects(bands.startBandGroup(ben, label), status(404));
  await assert.rejects(bands.deleteBandIfSoleMember(ben, label), status(404));
  await assert.rejects(bands.listBandMembers(ben, label), status(404));
  await bands.renameBand(ben, `Anna's quartet ${stamp}`, 'Hijacked');
  await bands.archiveOrDeleteBand(ben, `Anna's quartet ${stamp}`);
  assert.deepEqual((await bands.listBands(anna)).map((b) => b.name), [`Anna's quartet ${stamp}`]);
  assert.equal((await pool.query('SELECT 1 FROM band_members WHERE band_id = $1', [label])).rows.length, 0);
});

test('picking a band from the directory starts your own space - never a way into someone else\'s', { skip }, async () => {
  const anna = await account('anna2');
  const ben = await account('ben2');
  const entry = await directoryBand(anna);
  const annas = await bands.startBandGroup(anna, entry);
  assert.equal(await bands.startBandGroup(anna, entry), annas, 'asking again gives the same space');
  const bens = await bands.startBandGroup(ben, entry);
  assert.notEqual(bens, annas);

  const mine = await bands.getAccountBands(anna);
  assert.deepEqual(mine.map((b) => [b.id, b.isOrganiser, b.canDelete, b.directoryBandId, b.website]), [[annas, true, true, entry, `https://ml473-${stamp}.example`]]);
  // The directory entry itself has no members, and nothing says who has a space for it
  const listed = (await bands.listAllBands()).find((b) => b.id === entry);
  assert.equal(listed.memberCount, undefined);
  // Ben can't see into, invite to, join or delete Anna's space
  await assert.rejects(bands.listBandMembers(ben, annas), status(404));
  await assert.rejects(bands.inviteToBand(ben, annas, emailOf('ben2')), status(404));
  await assert.rejects(bands.setBandMemberLevel(ben, annas, ben, 'organiser'), status(404));
  await assert.rejects(bands.startBandGroup(ben, annas), status(404));
  await assert.rejects(bands.deleteBandIfSoleMember(ben, annas), status(404));
  await assert.rejects(bands.removeBandMember(ben, annas, anna), status(404));
  // The "who" box offers the band you are in, as well as your own labels
  assert.deepEqual((await bands.listWhoOptions(anna)).map((o) => o.name), [`ML-473 Test Band ${stamp}`]);
});

const join = async (organiser, space, who, name, level) => {
  await bands.inviteToBand(organiser, space, emailOf(name), level);
  await bands.acceptBandInvite(who, (await bands.listMyBandInvites(who))[0].id);
};

test('the way in is an organiser\'s invitation to your sign-in address: accept, decline, cancel, and who can see them', { skip }, async () => {
  const anna = await account('anna3');
  const ben = await account('ben3');
  const cara = await account('cara3');
  const dan = await account('dan3');
  const space = await bands.startBandGroup(anna, await directoryBand(anna));

  await assert.rejects(bands.inviteToBand(anna, space, 'not an address'), status(400));
  await assert.rejects(bands.inviteToBand(anna, space, emailOf('ben3'), 'boss'), status(400));
  await assert.rejects(bands.inviteToBand(anna, space, emailOf('anna3')), status(409)); // already in it
  await bands.inviteToBand(anna, space, `  ${emailOf('ben3').toUpperCase()} `); // "play" unless said
  await bands.inviteToBand(anna, space, emailOf('ben3'), 'change'); // again: still one, with the new level
  await bands.inviteToBand(anna, space, emailOf('cara3'));
  await bands.inviteToBand(anna, space, `nobody-${stamp}@example.com`); // no account: nothing says so

  // Ben sees his invitation, who it is from and what he will be able to do - not Cara's
  const bens = await bands.listMyBandInvites(ben);
  assert.deepEqual(bens.map((i) => [i.bandId, i.invitedBy, i.level]), [[space, 'anna3 Test', 'change']]);
  // He can't accept Cara's, and Dan (not invited) has none and can't use Ben's
  const caras = await bands.listMyBandInvites(cara);
  await assert.rejects(bands.acceptBandInvite(ben, caras[0].id), status(404));
  assert.deepEqual(await bands.listMyBandInvites(dan), []);
  await assert.rejects(bands.acceptBandInvite(dan, bens[0].id), status(404));

  assert.equal(await bands.acceptBandInvite(ben, bens[0].id), space);
  await bands.declineBandInvite(cara, caras[0].id);
  assert.deepEqual(await bands.listMyBandInvites(cara), []);

  // The members, by name and what they may do - never an email address. Anna (organiser) sees the open
  // invitation; Ben only that there is one. Ben can't invite or cancel.
  const forAnna = await bands.listBandMembers(anna, space);
  assert.deepEqual(forAnna.members.map((m) => [m.name, m.level, m.isYou]), [['anna3 Test', 'organiser', true], ['ben3 Test', 'change', false]]);
  assert.ok(!JSON.stringify(forAnna.members).includes('@'));
  assert.deepEqual(forAnna.invites.map((i) => [i.email, i.level]), [[`nobody-${stamp}@example.com`, 'play']]);
  const forBen = await bands.listBandMembers(ben, space);
  assert.deepEqual([forBen.isOrganiser, forBen.yourLevel, forBen.invites.length, forBen.openInvites], [false, 'change', 0, 1]);
  await assert.rejects(bands.inviteToBand(ben, space, emailOf('dan3')), status(403));
  await assert.rejects(bands.cancelBandInvite(ben, space, forAnna.invites[0].id), status(403));
  await bands.cancelBandInvite(anna, space, forAnna.invites[0].id);
  assert.equal((await bands.listBandMembers(anna, space)).openInvites, 0);

  // An invitation nobody answered goes after 30 days
  await bands.inviteToBand(anna, space, emailOf('dan3'));
  await pool.query(`UPDATE band_invites SET created_at = now() - interval '31 days' WHERE band_id = $1`, [space]);
  const stale = (await one('SELECT id FROM band_invites WHERE band_id = $1', [space])).id;
  await assert.rejects(bands.acceptBandInvite(dan, stale), status(404));
  assert.deepEqual(await bands.listMyBandInvites(dan), []);
  assert.equal((await pool.query('SELECT 1 FROM band_invites WHERE band_id = $1', [space])).rows.length, 0);
});

test('organisers: only they remove or set what a member may do; a band always has one', { skip }, async () => {
  const anna = await account('anna4');
  const ben = await account('ben4');
  const cara = await account('cara4');
  const space = await bands.startBandGroup(anna, await directoryBand(anna));
  await join(anna, space, ben, 'ben4', 'change');
  await join(anna, space, cara, 'cara4', 'play');
  const levels = async () => (await bands.listBandMembers(cara, space)).members.map((m) => `${m.name.split(' ')[0]}:${m.level}`);
  assert.deepEqual(await levels(), ['anna4:organiser', 'ben4:change', 'cara4:play']);

  await assert.rejects(bands.removeBandMember(ben, space, cara), status(403));
  await assert.rejects(bands.setBandMemberLevel(ben, space, ben, 'organiser'), status(403));
  await assert.rejects(bands.setBandMemberLevel(anna, space, ben, 'boss'), status(400));
  await assert.rejects(bands.removeBandMember(anna, space, anna), status(400));
  await assert.rejects(bands.setBandMemberLevel(anna, space, anna, 'change'), status(409)); // the only organiser
  await assert.rejects(bands.deleteBandIfSoleMember(anna, space), status(409)); // others are in it

  await bands.setBandMemberLevel(anna, space, cara, 'change');
  await bands.setBandMemberLevel(anna, space, ben, 'organiser');
  await bands.setBandMemberLevel(anna, space, anna, 'play'); // steps down: Ben is left
  assert.deepEqual(await levels(), ['anna4:play', 'ben4:organiser', 'cara4:change']);
  // The last organiser leaves: whoever has been in the band longest takes over
  await bands.leaveBand(ben, space);
  assert.deepEqual(await levels(), ['anna4:organiser', 'cara4:change']);
  await bands.removeBandMember(anna, space, cara);
  await assert.rejects(bands.listBandMembers(cara, space), status(404));
  await bands.deleteBandIfSoleMember(anna, space);
  assert.deepEqual(await bands.getAccountBands(anna), []);

  // The last person out of an empty band takes it with them; one with music in it has to be deleted on purpose
  const empty = await bands.startBandGroup(anna, await directoryBand(anna));
  await bands.leaveBand(anna, empty);
  assert.equal((await pool.query('SELECT 1 FROM bands WHERE id = $1', [empty])).rows.length, 0);
  const full = await bands.startBandGroup(anna, await directoryBand(anna));
  await lists.createPracticeList(anna, { name: 'ML-473 kept', bandId: full });
  await assert.rejects(bands.leaveBand(anna, full), status(409));
  assert.equal((await bands.getAccountBands(anna)).length, 1);
  await assert.rejects(bands.leaveBand(ben, full), status(404)); // not in it
});

test('a "play" member sees and plays the band\'s pieces and lists and changes nothing; a "change" member can', { skip }, async () => {
  const anna = await account('anna6');
  const ben = await account('ben6');
  const cara = await account('cara6');
  const space = await bands.startBandGroup(anna, await directoryBand(anna));
  await join(anna, space, ben, 'ben6', 'play');
  await join(anna, space, cara, 'cara6', 'change');
  const piece = (await flows.createFlow(anna, { name: 'ML-473 band piece', bandId: space })).id;
  const list = (await lists.createPracticeList(anna, { name: 'ML-473 band list', bandId: space })).id;
  const forbidden = (e) => e.status === 403 && /play this band's music but not change it/.test(e.message);

  // Ben (play): reads the piece and the list, sees he can't edit, and every change is refused
  assert.equal((await flows.getFlowDetail(ben, piece)).canEdit, false);
  assert.equal((await flows.listFlows(ben)).find((f) => f.id === piece).canEdit, false);
  assert.equal((await lists.getPracticeList(ben, list)).canEdit, false);
  assert.equal((await lists.listPracticeLists(ben)).find((l) => l.id === list).canEdit, false);
  await assert.rejects(flows.updateFlowMetadata(ben, piece, { title: 'Hijacked' }), forbidden);
  await assert.rejects(flows.deleteFlow(ben, piece), forbidden);
  await assert.rejects(flows.createFlow(ben, { name: 'Sneaked in', bandId: space }), forbidden);
  await assert.rejects(lists.updatePracticeList(ben, list, { name: 'Hijacked' }), forbidden);
  await assert.rejects(lists.setPracticeListPieces(ben, list, []), forbidden);
  await assert.rejects(lists.deletePracticeList(ben, list), forbidden);
  await assert.rejects(lists.createPracticeList(ben, { name: 'Sneaked in', bandId: space }), forbidden);
  // ...but he can copy the piece into his own library, and that copy is his to change
  const copy = await flows.duplicateFlow(ben, piece);
  assert.equal((await flows.getFlowDetail(ben, copy)).canEdit, true);

  // Cara (change): can
  assert.equal((await flows.getFlowDetail(cara, piece)).canEdit, true);
  await flows.updateFlowMetadata(cara, piece, { title: 'ML-473 band piece, edited' });
  await lists.setPracticeListPieces(cara, list, [piece]);
  assert.equal((await lists.getPracticeList(ben, list)).pieces.length, 1);
  // An organiser lets Ben change things: now he can
  await bands.setBandMemberLevel(anna, space, ben, 'change');
  await lists.updatePracticeList(ben, list, { name: 'ML-473 band list, renamed' });
  assert.equal((await flows.getFlowDetail(ben, piece)).canEdit, true);
});

test("a block can't name another member's time signature - unless the piece already uses it", { skip }, async () => {
  const anna = await account('anna5');
  const ben = await account('ben5');
  const sig = Number((await one('INSERT INTO account_time_signatures (account_id, numerator, denominator) VALUES ($1, 13, 8) RETURNING id', [anna])).id);
  await assertOwnTimeSignatures(anna, [{ accountTimeSignatureId: sig }, { accountTimeSignatureId: null }]);
  await assertOwnTimeSignatures(ben, [{ timeSignatureId: 1 }]); // none of the member's own: nothing to check
  await assert.rejects(assertOwnTimeSignatures(ben, [{ accountTimeSignatureId: sig }]), status(400));
  await assert.rejects(assertOwnTimeSignatures(ben, [{ accountTimeSignatureId: 'x' }]), status(400));

  // A piece that already has a bar in Anna's 13/8 (a band piece, a copy): Ben can save that bar again
  const piece = Number((await one(`INSERT INTO scores (title, owner_account_id) VALUES ('ML-473 piece', $1) RETURNING id`, [ben])).id);
  await pool.query('INSERT INTO metronome_segments (parent_score_id, order_index, bar_count, bpm, account_time_signature_id) VALUES ($1, 0, 4, 100, $2)', [piece, sig]);
  await assertOwnTimeSignatures(ben, [{ accountTimeSignatureId: sig }], { scoreId: piece });
  const other = Number((await one(`INSERT INTO scores (title, owner_account_id) VALUES ('ML-473 other', $1) RETURNING id`, [ben])).id);
  await assert.rejects(assertOwnTimeSignatures(ben, [{ accountTimeSignatureId: sig }], { scoreId: other }), status(400));
});
