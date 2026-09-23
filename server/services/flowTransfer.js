// ML-204: moving flows between environments as MusicXML - the admin Flows page's list/export/
// import (server/routes/admin.js), plus the local dev scripts. flowMusicXml.js/flowMusicXmlReader.js
// do the actual conversion; this file is the DB side.
//
// No ownership checks on the admin read side: those callers are super-admin-only, since copying
// flows between environments needs to read ANY flow on the branch, not just the admin's own (the
// one user-facing export, exportFlowForUser, does its own access check). Imports
// always land as the importing admin's own private flow (no band, not public) - publishing or
// moving to a band afterwards goes through the normal, reversible actions in flows.js.

import JSZip from 'jszip';
import pool from '../config/db.js';
import { withStatus, assertFlowAccess, createFlow, updateFlowMetadata, addYouTubeRecording, deleteFlow } from './flows.js';
import { listFlowBlocksUnchecked, createFlowBlock } from './flowBlocks.js';
import { validateSegmentPayload } from './metronomeSegments.js';
import { flowToMusicXml, musicXmlFileName } from './flowMusicXml.js';
import { musicXmlToFlow } from './flowMusicXmlReader.js';
import { extractMusicXmlText, resolveBlocksForAccount } from './scoreImport.js';
export { musicXmlFileName } from './flowMusicXml.js';

// Comfortably inside Vercel's ~4.5MB request body cap - a flow exports to single-digit KB, so this
// is hundreds of flows per import.
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
const MAX_FLOWS_PER_IMPORT = 200;
const VALID_DENOMINATORS = [1, 2, 4, 8, 16, 32];

// ---------- list ----------

export async function listFlowsForAdmin() {
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.composer, s.is_public, s.owner_account_id, s.owner_band_id, s.created_at,
            a.first_name, a.surname, a.email, b.name AS band_name,
            (SELECT COUNT(*) FROM metronome_segments ms WHERE ms.parent_score_id = s.id) AS block_count,
            (SELECT COALESCE(SUM(ms.bar_count), 0) FROM metronome_segments ms WHERE ms.parent_score_id = s.id AND NOT ms.is_lead_in) AS total_bars, -- lead-in excluded from bar counts
            (SELECT COUNT(*) FROM score_recordings r WHERE r.score_id = s.id AND r.type = 'youtube') AS youtube_count,
            (SELECT COUNT(*) FROM score_recordings r WHERE r.score_id = s.id AND r.type <> 'youtube')
              + (SELECT COUNT(*) FROM score_documents d WHERE d.score_id = s.id) AS file_media_count
     FROM scores s
     LEFT JOIN accounts a ON a.id = s.owner_account_id
     LEFT JOIN bands b ON b.id = s.owner_band_id
     ORDER BY s.created_at DESC, s.id DESC`
  );
  return rows.map(r => ({
    id: Number(r.id),
    title: r.title,
    composer: r.composer,
    ownership: r.is_public ? 'public' : r.owner_band_id !== null ? 'band' : 'personal',
    ownerName: r.owner_account_id !== null ? [r.first_name, r.surname].filter(Boolean).join(' ') || r.email : null,
    ownerEmail: r.email,
    bandName: r.band_name,
    blockCount: Number(r.block_count),
    totalBars: Number(r.total_bars),
    youtubeCount: Number(r.youtube_count),
    fileMediaCount: Number(r.file_media_count),
    createdAt: r.created_at
  }));
}

// ---------- export ----------

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

// A user's own "Export to MusicXML" (library ⋮ menu, feature flow_export_musicxml): any personal or
// band flow they can access (assertFlowAccess's own rules), but not public library flows - those
// are the content most likely to be commercialised, so they stay in-app only. Checked on the flow's
// current state, not the caller's role: a super admin exporting a public flow uses the admin page.
export async function exportFlowForUser(accountId, scoreId, opts = {}) {
  const row = await assertFlowAccess(accountId, scoreId);
  if (row.is_public) throw withStatus(403, "Public library flows can't be exported.");
  const { flow, xml } = await exportFlowAsMusicXml(scoreId, opts);
  return { fileName: musicXmlFileName(flow.title, scoreId), body: Buffer.from(xml, 'utf8') };
}

// One flow -> one .musicxml file; several -> a .zip of them (one file per flow, rather than
// MusicXML's own multi-score "opus" format, which almost nothing else can open).
export async function exportFlows(ids, opts = {}) {
  const unique = [...new Set(ids.map(Number).filter(Number.isInteger))];
  if (!unique.length) throw withStatus(400, 'Choose at least one flow to export.');
  const files = [];
  for (const id of unique) {
    const { flow, xml } = await exportFlowAsMusicXml(id, opts);
    files.push({ id, name: musicXmlFileName(flow.title, id), xml });
  }
  if (files.length === 1) {
    return { fileName: files[0].name, contentType: 'application/vnd.recordare.musicxml+xml', body: Buffer.from(files[0].xml, 'utf8') };
  }
  // Two flows with the same title would otherwise overwrite each other inside the zip.
  const used = new Set();
  const zip = new JSZip();
  for (const f of files) {
    let name = f.name;
    if (used.has(name.toLowerCase())) name = name.replace(/\.musicxml$/, ` (${f.id}).musicxml`);
    used.add(name.toLowerCase());
    zip.file(name, f.xml);
  }
  const date = (opts.encodingDate || new Date().toISOString().slice(0, 10));
  return {
    fileName: `flows-${opts.envName || 'export'}-${date}.zip`,
    contentType: 'application/zip',
    body: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  };
}

// ---------- import ----------

// .musicxml/.xml text, a compressed .mxl, or a .zip of any of those (what exportFlows produces for
// more than one flow). An .mxl is itself a zip, told apart by its META-INF/container.xml.
async function unpackImportFile(buffer, fileName) {
  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) return [{ fileName, xml: buffer.toString('utf8') }];
  const zip = await JSZip.loadAsync(buffer).catch(() => { throw withStatus(422, "That file doesn't look like a valid .zip or .mxl."); });
  if (zip.file('META-INF/container.xml')) return [{ fileName, xml: await extractMusicXmlText(buffer) }];
  const entries = Object.values(zip.files)
    .filter(f => !f.dir && /\.(musicxml|xml|mxl)$/i.test(f.name) && !f.name.startsWith('__MACOSX/'))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!entries.length) throw withStatus(422, 'No .musicxml, .xml or .mxl files found inside that .zip.');
  if (entries.length > MAX_FLOWS_PER_IMPORT) throw withStatus(422, `That .zip has ${entries.length} files - import at most ${MAX_FLOWS_PER_IMPORT} at a time.`);
  const out = [];
  for (const e of entries) {
    const name = e.name.split('/').pop();
    out.push({
      fileName: name,
      xml: /\.mxl$/i.test(e.name) ? await extractMusicXmlText(await e.async('nodebuffer')) : await e.async('string')
    });
  }
  return out;
}

// Every problem that would stop a block saving, found up front with the same validation a real
// save runs - so an import either goes ahead for every flow or writes nothing at all.
function validateParsedFlow(parsed) {
  const errors = [];
  if (!parsed.blocks.length) errors.push('No bars found.');
  if (parsed.blocks.filter(b => b.isLeadIn).length > 1) errors.push('More than one lead-in block.');
  parsed.blocks.forEach((block, i) => {
    const { numerator, denominator } = block.timeSignature;
    if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32 || !VALID_DENOMINATORS.includes(denominator)) {
      errors.push(`Block ${i + 1}: unsupported time signature ${numerator}/${denominator}.`);
      return;
    }
    const { timeSignature, ...rest } = block;
    try {
      // Placeholder id - the real one is resolved per account at commit time.
      validateSegmentPayload({ ...rest, timeSignatureId: 1, accountTimeSignatureId: null });
    } catch (err) {
      errors.push(`Block ${i + 1}: ${err.message}`);
    }
  });
  return errors;
}

// "Title", then "Title (imported)", "Title (imported 2)"... - unique against the admin's own
// flows and everything else in the same import.
async function uniqueTitles(accountId, titles) {
  const { rows } = await pool.query('SELECT title FROM scores WHERE owner_account_id = $1', [accountId]);
  const taken = new Set(rows.map(r => String(r.title).toLowerCase()));
  return titles.map(title => {
    let candidate = title;
    for (let n = 1; taken.has(candidate.toLowerCase()); n++) {
      candidate = `${title} (imported${n > 1 ? ` ${n}` : ''})`;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}

/**
 * Parses and checks every flow in the file without writing anything. `ok` is false if any flow
 * has an error - commitImport refuses to write anything in that case.
 */
export async function previewImport(accountId, buffer, fileName) {
  if (!buffer || !buffer.length) throw withStatus(400, 'The file is empty.');
  const files = await unpackImportFile(buffer, fileName);
  const items = files.map(({ fileName: name, xml }) => {
    try {
      const parsed = musicXmlToFlow(xml);
      const title = (parsed.title || name.replace(/\.[^.]+$/, '') || 'Imported flow').trim();
      return {
        fileName: name, title, parsed,
        errors: validateParsedFlow(parsed),
        warnings: parsed.warnings,
        blockCount: parsed.blocks.length,
        totalBars: parsed.blocks.filter(b => !b.isLeadIn).reduce((s, b) => s + b.barCount, 0), // lead-in excluded from bar counts
        ownFormat: parsed.ownFormat,
        youtubeCount: parsed.recordings.length,
        skippedMediaCount: (parsed.skippedMedia.recordings || 0) + (parsed.skippedMedia.documents || 0)
      };
    } catch (err) {
      return { fileName: name, title: name, parsed: null, errors: [err.message], warnings: [], blockCount: 0, totalBars: 0, ownFormat: false, youtubeCount: 0, skippedMediaCount: 0 };
    }
  });
  const finalTitles = await uniqueTitles(accountId, items.map(i => i.title));
  items.forEach((item, i) => { item.importTitle = finalTitles[i]; });
  return { ok: items.every(i => !i.errors.length), items };
}

// The client-facing shape - the full parse stays server-side.
export function previewSummary(preview) {
  return {
    ok: preview.ok,
    flows: preview.items.map(({ parsed, ...rest }) => rest)
  };
}

/**
 * Imports every flow in the file as the admin's own private flow. All-or-nothing across the file:
 * everything is validated first (previewImport), and a flow that still fails while being written
 * (a DB error mid-way) is deleted again along with every flow already written by this call.
 */
export async function commitImport(accountId, buffer, fileName) {
  const preview = await previewImport(accountId, buffer, fileName);
  if (!preview.ok) {
    const problems = preview.items.filter(i => i.errors.length).map(i => `${i.fileName}: ${i.errors.join(' ')}`);
    throw withStatus(422, `Nothing was imported - fix these first. ${problems.join(' | ')}`);
  }
  const created = [];
  try {
    for (const item of preview.items) {
      const { parsed } = item;
      const flow = await createFlow(accountId, { name: item.importTitle });
      created.push({ id: flow.id, title: item.importTitle, fileName: item.fileName, warnings: item.warnings });
      const { composer, arranger, publisher, description } = parsed;
      await updateFlowMetadata(accountId, flow.id, { composer, arranger, publisher, description });
      for (const r of parsed.recordings) {
        await addYouTubeRecording(accountId, flow.id, { url: `https://www.youtube.com/watch?v=${r.youtubeVideoId}`, title: r.title });
      }
      // Sequential - createFlowBlock assigns order_index as "current max + 1".
      for (const block of await resolveBlocksForAccount(accountId, parsed.blocks)) {
        await createFlowBlock(accountId, flow.id, block);
      }
    }
  } catch (err) {
    for (const c of created) await deleteFlow(accountId, c.id).catch(() => {});
    throw err;
  }
  return { imported: created };
}
