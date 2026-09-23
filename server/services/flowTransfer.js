// ML-204: loads flows out of the DB for export to MusicXML (flowMusicXml.js does the actual
// conversion). No ownership checks here - every caller is super-admin-only (the admin Flows page,
// or a local dev script), since moving flows between environments needs to read any flow on the
// branch, not just the admin's own.

import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { listFlowBlocksUnchecked } from './flowBlocks.js';
import { flowToMusicXml } from './flowMusicXml.js';
export { musicXmlFileName } from './flowMusicXml.js';

export async function loadFlowForExport(scoreId) {
  const { rows } = await pool.query('SELECT * FROM scores WHERE id = $1', [scoreId]);
  if (!rows.length) throw withStatus(404, `Flow ${scoreId} not found`);
  const score = rows[0];
  const [{ rows: recordingRows }, { rows: documentRows }, blocks] = await Promise.all([
    pool.query('SELECT type, title, youtube_video_id FROM score_recordings WHERE score_id = $1 ORDER BY order_index, id', [scoreId]),
    pool.query('SELECT id FROM score_documents WHERE score_id = $1', [scoreId]),
    listFlowBlocksUnchecked(scoreId)
  ]);
  return {
    flow: {
      id: Number(score.id),
      title: score.title,
      composer: score.composer,
      arranger: score.arranger,
      publisher: score.publisher,
      description: score.description,
      recordings: recordingRows.map(r => ({ type: r.type, title: r.title, youtubeVideoId: r.youtube_video_id })),
      documents: documentRows
    },
    blocks
  };
}

export async function exportFlowAsMusicXml(scoreId, opts = {}) {
  const { flow, blocks } = await loadFlowForExport(scoreId);
  return { flow, xml: flowToMusicXml(flow, blocks, opts) };
}
