// ML-411: who may delete a piece (or take a band piece out of its band). Pure - no database - so the
// rule has one home and a test (server/test/flowPermissions.test.js). The caller has already checked the
// account can reach the piece at all (assertFlowAccess: its owner, a member of its band, or a super
// admin for a public piece); this decides the destructive step on top of that.
//
//   personal  - its owner
//   band      - the person who added it to the band (scores.added_by_account_id), or a super admin.
//               Not every member: deleting a band piece takes it off every practice list and wipes every
//               player's Levels for it. Editing stays open to the whole band (flows.js).
//   public    - a super admin
//
// ML-473: what a member of a band may do is band_members.role, set by the organiser who invited them
// (server/services/bands.js). A 'player' sees and plays the band's pieces and lists and changes nothing.
// For a query that has band_members as `bm`: true when that member may change the band's things.
export const BAND_CAN_CHANGE_SQL = `bm.role <> 'player'`;
export const PLAY_ONLY_MESSAGE = "You can play this band's music but not change it. Ask one of the band's organisers if you need to.";

// `score` is a `scores` row (snake_case, ids as pg returns them - strings or numbers).
export function canDeleteFlow(score, accountId, isSuperAdmin = false) {
  if (!score) return false;
  const same = (a, b) => a !== null && a !== undefined && Number(a) === Number(b);
  if (score.is_public) return !!isSuperAdmin;
  if (score.owner_band_id !== null && score.owner_band_id !== undefined) {
    return !!isSuperAdmin || same(score.added_by_account_id, accountId);
  }
  return same(score.owner_account_id, accountId);
}
