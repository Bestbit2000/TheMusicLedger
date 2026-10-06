// ML-478: one "My bands" list (server/services/bands.js, "My bands") - against a real database,
// because the point is what happens to one member's bands, sessions and shared spaces, and that none
// of it is ever another member's to see or change. Runs only when pointed at the dev branch:
//   node --env-file=../.env --env-file=.env --test test/myBands.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. Everything it makes belongs to throwaway accounts
// and throwaway directory entries, which it removes again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const bands = await import('../services/bands.js');

const stamp = Date.now();
const accounts = [];
const made = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const emailOf = (name) => `ml478-${name}-${stamp}@themusicledger.local`;
const account = async (name) => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, $2, 'Test') RETURNING id`, [emailOf(name), name])).id);
  accounts.push(id);
  return id;
};
const directoryBand = async (creator, name) => {
  const id = Number((await one(`INSERT INTO bands (name, website, created_by_account_id, kind, town) VALUES ($1, $2, $3, 'directory', 'Testville') RETURNING id`,
    [`${name} ${stamp}`, `https://ml478-${made.length}-${stamp}.example`, creator])).id);
  made.push(id);
  return id;
};
// A rehearsal logged with one of the member's bands, the way the app does it (by name)
const rehearsal = async (accountId, who) => {
  const bandId = await bands.getOrCreateBand(accountId, who);
  await pool.query(`INSERT INTO sessions (account_id, session_type, band_id, started_at, total_duration_minutes) VALUES ($1, 'rehearsal', $2, now(), 60)`, [accountId, bandId]);
  return Number(bandId);
};
const names = async (accountId) => (await bands.listMyBands(accountId)).filter((b) => !b.hidden).map((b) => b.name);
const entry = async (accountId, name) => (await bands.listMyBands(accountId)).find((b) => b.name === name);
const status = (code) => (e) => e.status === code;
const skip = !onDev && 'needs the dev database';

after(async () => {
  if (onDev) {
    await pool.query(`DELETE FROM sessions WHERE account_id = ANY($1)`, [accounts]).catch(() => {});
    await pool.query(`DELETE FROM bands WHERE kind = 'group' AND created_by_account_id = ANY($1)`, [accounts]).catch(() => {});
    await pool.query(`DELETE FROM bands WHERE created_by_account_id = ANY($1) OR id = ANY($2)`, [accounts, made]).catch(() => {});
    for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM email_outbox WHERE to_email LIKE $1', [`%-${stamp}@%`]).catch(() => {});
    await pool.query('DELETE FROM auth_email_links WHERE email LIKE $1', [`%-${stamp}@%`]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('adding a band is private: it is on my list and in my "Who with?" box, with no shared space and nobody else told', { skip }, async () => {
  const anna = await account('anna');
  const ben = await account('ben');
  const cobham = await directoryBand(anna, 'The Cobham Band');

  const id = await bands.addBandFromDirectory(anna, cobham);
  assert.equal(await bands.addBandFromDirectory(anna, cobham), id, 'asking again gives the same entry');
  const own = await bands.addOwnBand(anna, `  Kitchen Quartet ${stamp} `);
  assert.equal(await bands.addOwnBand(anna, `kitchen quartet ${stamp}`), own, 'the same name, however it is typed, is the same band');
  await assert.rejects(bands.addOwnBand(anna, '   '), status(400));
  await assert.rejects(bands.addOwnBand(anna, 'x'.repeat(81)), status(400));

  const mine = await bands.listMyBands(anna);
  assert.deepEqual(mine.map((b) => [b.name, b.directoryBandId, b.shared, b.hidden, b.needsTidy, b.sessions]), [
    [`The Cobham Band ${stamp}`, cobham, null, false, false, 0],
    [`Kitchen Quartet ${stamp}`, null, null, false, false, 0]
  ]); // sorted without "The"; the directory entry's details come with it
  assert.equal(mine[0].town, 'Testville');
  // No shared space was made, and nobody is a member of anything
  assert.deepEqual(await bands.getAccountBands(anna), []);
  assert.equal((await pool.query(`SELECT 1 FROM bands WHERE kind = 'group' AND created_by_account_id = $1`, [anna])).rows.length, 0);
  // The "Who with?" box is exactly this list
  assert.deepEqual((await bands.listWhoOptions(anna)).map((o) => o.name).sort(), [`Kitchen Quartet ${stamp}`, `The Cobham Band ${stamp}`]);
  // ...and it is nobody else's: Ben sees none of it and can do nothing to it
  assert.deepEqual(await bands.listMyBands(ben), []);
  assert.deepEqual(await bands.listWhoOptions(ben), []);
  for (const act of [bands.setUpSharing, bands.hideMyBand, bands.showMyBand, bands.keepMyBand]) await assert.rejects(act(ben, id), status(404));
  await assert.rejects(bands.linkMyBandToDirectory(ben, own, cobham), status(404));
  const bens = await bands.addOwnBand(ben, 'Ben Band');
  await assert.rejects(bands.mergeMyBands(ben, own, bens), status(404));
  await assert.rejects(bands.mergeMyBands(ben, bens, own), status(404));
  // Only a directory entry can be picked - not a label, not a group, not a number that isn't there
  await assert.rejects(bands.addBandFromDirectory(ben, own), status(404));
  await assert.rejects(bands.addBandFromDirectory(ben, 'abc'), status(404));
});

test('Set up sharing is deliberate: it makes me the organiser of a space that shows on that band - and only then', { skip }, async () => {
  const anna = await account('anna2');
  const ben = await account('ben2');
  const dir = await directoryBand(anna, 'Sharing Band');
  const id = await bands.addBandFromDirectory(anna, dir);
  const space = await bands.setUpSharing(anna, id);
  assert.equal(await bands.setUpSharing(anna, id), space, 'asking again gives the same space');
  const e = await entry(anna, `Sharing Band ${stamp}`);
  assert.deepEqual(e.shared, { bandId: space, level: 'organiser', isOrganiser: true, members: 1, onlyYou: true });
  assert.deepEqual((await bands.getAccountBands(anna)).map((b) => [b.id, b.isOrganiser, b.directoryBandId]), [[space, true, dir]]);
  // Ben adding the same band gets nothing of Anna's: his is private, and sharing it makes a second space
  const bens = await bands.addBandFromDirectory(ben, dir);
  assert.equal((await entry(ben, `Sharing Band ${stamp}`)).shared, null);
  await assert.rejects(bands.listBandMembers(ben, space), status(404));
  assert.notEqual(await bands.setUpSharing(ben, bens), space);
  // A shared band can't be hidden until it is left; stopping sharing (only me in it) leaves the band on my list
  await assert.rejects(bands.hideMyBand(anna, id), status(409));
  await bands.deleteBandIfSoleMember(anna, space);
  assert.equal((await entry(anna, `Sharing Band ${stamp}`)).shared, null);
  assert.deepEqual(await names(anna), [`Sharing Band ${stamp}`]);
});

test('an invitation attaches to the band I already have: the same directory entry, or the same name, without asking', { skip }, async () => {
  const anna = await account('anna3');
  const ben = await account('ben3');
  const cara = await account('cara3');
  const dir = await directoryBand(anna, 'The Invite Band');
  const space = await bands.setUpSharing(anna, await bands.addBandFromDirectory(anna, dir));

  // Ben already has the band from the directory, with a rehearsal logged
  const bensLabel = await bands.addBandFromDirectory(ben, dir);
  await rehearsal(ben, `The Invite Band ${stamp}`);
  await bands.inviteToBand(anna, space, emailOf('ben3'), 'play');
  const [bensInvite] = await bands.listMyBandInvites(ben);
  assert.deepEqual([bensInvite.sameAs, bensInvite.choices], [{ id: bensLabel, name: `The Invite Band ${stamp}` }, []]);
  assert.equal(await bands.acceptBandInvite(ben, bensInvite.id), space);
  const bens = await bands.listMyBands(ben);
  assert.deepEqual(bens.map((b) => [b.id, b.name, b.sessions, b.shared && b.shared.bandId, b.shared && b.shared.level]),
    [[bensLabel, `The Invite Band ${stamp}`, 1, space, 'play']]); // one entry: his sessions and the shared music together

  // Cara had only typed the name (no directory entry), in her own capitals - and had hidden it
  const carasLabel = await rehearsal(cara, `the invite band ${stamp}`);
  await bands.hideMyBand(cara, carasLabel);
  await bands.inviteToBand(anna, space, emailOf('cara3'), 'change');
  const [carasInvite] = await bands.listMyBandInvites(cara);
  assert.equal(carasInvite.sameAs.id, carasLabel);
  await bands.acceptBandInvite(cara, carasInvite.id);
  const caras = await bands.listMyBands(cara);
  assert.deepEqual(caras.map((b) => [b.id, b.name, b.hidden, b.directoryBandId, b.sessions, b.shared.bandId]),
    [[carasLabel, `The Invite Band ${stamp}`, false, dir, 1, space]]); // shown again, with the band's proper name and its directory entry
});

test('if the names don\'t match, the invitation says which of my bands it could be - pick one (they become one) or say it is new', { skip }, async () => {
  const anna = await account('anna4');
  const ben = await account('ben4');
  const cara = await account('cara4');
  const space = await bands.setUpSharing(anna, await bands.addBandFromDirectory(anna, await directoryBand(anna, 'The Proper Name Band')));
  const proper = `The Proper Name Band ${stamp}`;

  const short = await rehearsal(ben, `Proper ${stamp}`);
  await rehearsal(ben, `Proper ${stamp}`);
  const other = await bands.addOwnBand(ben, `Something Else ${stamp}`);
  await bands.inviteToBand(anna, space, emailOf('ben4'), 'play');
  const [invite] = await bands.listMyBandInvites(ben);
  assert.equal(invite.sameAs, null);
  assert.deepEqual(invite.choices.map((c) => c.id).sort(), [short, other].sort());
  // Not one of his, or not one that can take it
  await assert.rejects(bands.acceptBandInvite(ben, invite.id, { labelId: 999999999 }), status(409));
  assert.equal((await bands.listMyBandInvites(ben)).length, 1, 'a refused answer leaves the invitation waiting');
  assert.deepEqual(await bands.getAccountBands(ben), [], '...and him outside the band');
  // "It is the same as Proper": one entry, the band's name, both sessions, the shared music
  await bands.acceptBandInvite(ben, invite.id, { labelId: short });
  assert.deepEqual((await bands.listMyBands(ben)).map((b) => [b.id, b.name, b.sessions, !!b.shared]).sort(),
    [[short, proper, 2, true], [other, `Something Else ${stamp}`, 0, false]].sort());
  assert.deepEqual((await bands.listWhoOptions(ben)).map((o) => o.name).sort(), [`Something Else ${stamp}`, proper].sort());

  // Cara says it is a new one: her own band is untouched, and the shared band is a second entry
  const hers = await rehearsal(cara, `Cara's lot ${stamp}`);
  await bands.inviteToBand(anna, space, emailOf('cara4'), 'play');
  const [carasInvite] = await bands.listMyBandInvites(cara);
  assert.deepEqual(carasInvite.choices, [{ id: hers, name: `Cara's lot ${stamp}` }]);
  await bands.acceptBandInvite(cara, carasInvite.id);
  assert.deepEqual((await bands.listMyBands(cara)).map((b) => [b.name, b.sessions, !!b.shared]).sort(),
    [[`Cara's lot ${stamp}`, 1, false], [proper, 0, true]].sort());
});

test('a band I already share keeps its space: an invitation to someone else\'s space for it is a second entry, marked with who invited me', { skip }, async () => {
  const anna = await account('anna5');
  const ben = await account('ben5');
  const dir = await directoryBand(anna, 'Twice Shared Band');
  const annas = await bands.setUpSharing(anna, await bands.addBandFromDirectory(anna, dir));
  const bensLabel = await bands.addBandFromDirectory(ben, dir);
  const bens = await bands.setUpSharing(ben, bensLabel);
  await bands.inviteToBand(anna, annas, emailOf('ben5'), 'play');
  const [invite] = await bands.listMyBandInvites(ben);
  assert.deepEqual([invite.sameAs, invite.choices], [null, []]); // his only band is already shared: nothing to ask
  await assert.rejects(bands.acceptBandInvite(ben, invite.id, { labelId: bensLabel }), status(409));
  await bands.acceptBandInvite(ben, invite.id);
  assert.deepEqual((await bands.listMyBands(ben)).map((b) => [b.name, b.shared.bandId, b.shared.level]).sort(), [
    [`Twice Shared Band ${stamp}`, bens, 'organiser'],
    [`Twice Shared Band ${stamp} (anna5 Test)`, annas, 'play']
  ].sort());
  // Two shared bands can't be made one
  const both = await bands.listMyBands(ben);
  await assert.rejects(bands.mergeMyBands(ben, both[0].id, both[1].id), status(409));
  // Leaving Anna's space leaves the entry on his list, no longer shared; being removed does the same
  await bands.leaveBand(ben, annas);
  assert.equal((await entry(ben, `Twice Shared Band ${stamp} (anna5 Test)`)).shared, null);
  assert.equal((await entry(ben, `Twice Shared Band ${stamp}`)).shared.bandId, bens);
  await bands.inviteToBand(anna, annas, emailOf('ben5'), 'play');
  const [again] = await bands.listMyBandInvites(ben);
  assert.equal(again.sameAs.name, `Twice Shared Band ${stamp} (anna5 Test)`); // invited back: it is the entry he was left with (the same directory band)
});

test('tidying: a name becomes a directory band, two names become one, one is kept as my own, one is hidden - sessions never lost', { skip }, async () => {
  const anna = await account('anna6');
  const dir = await directoryBand(anna, 'The Tidy Band');
  const proper = `The Tidy Band ${stamp}`;
  const short = await rehearsal(anna, `Tidy ${stamp}`);
  await rehearsal(anna, `Tidy ${stamp}`);
  const typo = await rehearsal(anna, `Tidy Bnad ${stamp}`);
  const mine = await rehearsal(anna, `My trio ${stamp}`);
  const old = await rehearsal(anna, `Old Band ${stamp}`);
  const unused = await bands.addOwnBand(anna, `Never Played ${stamp}`);
  // As migration 110 leaves the names that were there before: each is asked about once
  await pool.query(`UPDATE bands SET needs_tidy = true WHERE created_by_account_id = $1 AND kind = 'label'`, [anna]);
  assert.equal((await bands.listMyBands(anna)).filter((b) => b.needsTidy).length, 5);
  const total = async () => Number((await one('SELECT COUNT(*) AS n FROM sessions WHERE account_id = $1', [anna])).n);
  assert.equal(await total(), 5);

  // Same as a directory band: it becomes that band, name and all, keeping its sessions
  assert.equal(await bands.linkMyBandToDirectory(anna, short, dir), short);
  assert.deepEqual([(await entry(anna, proper)).directoryBandId, (await entry(anna, proper)).sessions, (await entry(anna, proper)).needsTidy], [dir, 2, false]);
  // Same as another of mine: merged into it
  await assert.rejects(bands.mergeMyBands(anna, typo, typo), status(400));
  assert.equal(await bands.mergeMyBands(anna, typo, short), short);
  assert.equal((await entry(anna, proper)).sessions, 3);
  assert.equal(await entry(anna, `Tidy Bnad ${stamp}`), undefined);
  // ...and saying a second name is that directory band merges it too, rather than making two entries for one band
  const again = await rehearsal(anna, `Tidy again ${stamp}`);
  assert.equal(await bands.linkMyBandToDirectory(anna, again, dir), short);
  assert.equal((await entry(anna, proper)).sessions, 4);
  // Keep as my own: nothing changes but that it is no longer asked about
  await bands.keepMyBand(anna, mine);
  assert.deepEqual([(await entry(anna, `My trio ${stamp}`)).needsTidy, (await entry(anna, `My trio ${stamp}`)).sessions], [false, 1]);
  // I don't play with them now: hidden from the "Who with?" box, kept on the history; shown again on request
  assert.deepEqual(await bands.hideMyBand(anna, old), { hidden: true });
  assert.ok(!(await names(anna)).includes(`Old Band ${stamp}`));
  assert.deepEqual((await bands.listWhoOptions(anna)).find((o) => o.name === `Old Band ${stamp}`), { name: `Old Band ${stamp}`, archived: true });
  assert.deepEqual([(await entry(anna, `Old Band ${stamp}`)).hidden, (await entry(anna, `Old Band ${stamp}`)).sessions], [true, 1]);
  await bands.showMyBand(anna, old);
  assert.ok((await names(anna)).includes(`Old Band ${stamp}`));
  // ...and one with nothing logged is simply removed
  assert.deepEqual(await bands.hideMyBand(anna, unused), { hidden: false });
  assert.equal(await entry(anna, `Never Played ${stamp}`), undefined);
  assert.equal(await total(), 6, 'every session is still there');
  assert.equal((await bands.listMyBands(anna)).filter((b) => b.needsTidy).length, 0); // hiding was an answer too: shown again, it isn't asked about twice
});

test('a merged band takes the other one\'s shared space and directory entry when it has none', { skip }, async () => {
  const anna = await account('anna7');
  const dir = await directoryBand(anna, 'Carry Over Band');
  const shared = await bands.addBandFromDirectory(anna, dir);
  const space = await bands.setUpSharing(anna, shared);
  const plain = await rehearsal(anna, `Carry ${stamp}`);
  // The shared entry is merged INTO the plain name: the plain one now shows the space and the directory entry
  assert.equal(await bands.mergeMyBands(anna, shared, plain), plain);
  const [only] = await bands.listMyBands(anna);
  assert.deepEqual([only.id, only.name, only.directoryBandId, only.shared.bandId, only.sessions], [plain, `Carry ${stamp}`, dir, space, 1]);
  assert.deepEqual((await bands.getAccountBands(anna)).map((b) => b.id), [space], 'still its organiser');
});
