// ML-79: "Create from file" - turns an uploaded score into a Flow's title/composer plus a set of
// ready-to-save blocks, the same shape createFlowBlock already accepts. Phase 1 (MusicXML/.mxl,
// parsed directly, no external dependency) landed first; Phase 2 adds PDF/scan import via OMR (an
// external Audiveris service this app doesn't host - see runOmr below) to turn a scan into
// MusicXML, which then runs through this exact same parser. There is deliberately only ever one
// parser in this app: OMR's whole job is to make a scan look like a MusicXML file, not to have its
// own separate structural understanding.
//
// What this does NOT try to read: actual notes/pitches/rhythms - a Flow block is a metronome
// timing block, not real notation, so all that matters per measure is its time signature, tempo,
// and any structural markers (repeats, rehearsal marks, codas/segnos, the final barline). That's
// also why block-worthy MusicXML is so much simpler to parse than "real" OMR/notation software -
// we're deliberately throwing away everything except the bars-and-tempo skeleton.

import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';
import { createCustomTimeSignature } from './timeSignatures.js';

// Phase 2: a scan has no structure of its own to read - it has to go through an external OMR
// (Optical Music Recognition) service first, which turns it into MusicXML that then runs through
// the exact same parseMusicXmlStructure everything else does. This app never runs Audiveris
// itself (a Java OMR engine, no native REST API of its own per its own docs) - it's a subprocess/
// batch-CLI tool, which doesn't fit this app's Vercel serverless deployment (no JVM, no Docker, no
// persistent process). AUDIVERIS_SERVICE_URL points at a separate, independently-hosted wrapper
// service instead - see docs/third-party-providers.md for what's actually been verified/deployed.
//
// The contract is a real one (not a guess) - an async job API, matching the solfascribe-omr
// project (github.com/James-Aidoo/solfascribe-omr, MIT-licensed, self-hostable): submit the PDF as
// multipart, get a jobId back immediately, poll until it's done, then fetch the resulting
// MusicXML. This is a job queue rather than "one request, one response" on purpose - real OMR on a
// real scan takes real time (the reference service's own default timeout is 15 minutes), which
// doesn't fit inside a single HTTP round trip, let alone one Vercel function invocation. The poll
// loop below is still bounded (AUDIVERIS_POLL_TIMEOUT_MS) to stay inside whatever this app's own
// /flows/from-file function's own maxDuration is configured to - see docs/third-party-providers.md
// for why that number matters and how to raise it. A properly async version of OUR OWN
// /flows/from-file endpoint (return a job id, client polls) would remove that ceiling entirely -
// worth it if real scores routinely take longer than the platform allows, not built yet.
//
// withStatus is always given a 4xx here, on purpose, even where a "real" REST API might reach for
// 502/504 (upstream unavailable/timed out) - sendError (server/utils/httpErrors.js) only ever
// passes a withStatus message through to the client for status < 500; anything >= 500 is treated
// as an unexpected internal error and replaced with a generic fallback. Every message below is
// deliberately written to be read by the user, same convention as every other withStatus call in
// this codebase, so it has to stay under 500 to actually reach them.
async function runOmr(pdfBuffer) {
  const baseUrl = process.env.AUDIVERIS_SERVICE_URL;
  if (!baseUrl) {
    throw withStatus(422, "Score scanning isn't available yet - try a MusicXML/.mxl file instead, or add blocks manually.");
  }
  const authHeaders = process.env.AUDIVERIS_SERVICE_TOKEN
    ? { Authorization: `Bearer ${process.env.AUDIVERIS_SERVICE_TOKEN}` } : {};

  const form = new FormData();
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'score.pdf');
  let submitResponse;
  try {
    submitResponse = await fetch(`${baseUrl}/jobs`, { method: 'POST', headers: authHeaders, body: form });
  } catch {
    throw withStatus(422, "Couldn't reach the score-scanning service - try again shortly, or use a MusicXML/.mxl file instead.");
  }
  if (submitResponse.status !== 202) {
    const detail = await submitResponse.json().catch(() => null);
    throw withStatus(422, `Score scanning couldn't start${detail?.error ? `: ${detail.error}` : '.'}`);
  }
  const { jobId } = await submitResponse.json();

  const pollIntervalMs = 3000;
  const maxWaitMs = Number(process.env.AUDIVERIS_POLL_TIMEOUT_MS) || 50000;
  const deadline = Date.now() + maxWaitMs;
  let job;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const statusResponse = await fetch(`${baseUrl}/jobs/${jobId}`, { headers: authHeaders }).catch(() => null);
    if (!statusResponse?.ok) {
      throw withStatus(422, 'Lost contact with the score-scanning service partway through - try again.');
    }
    job = await statusResponse.json();
    if (job.status === 'done' || job.status === 'failed') break;
    if (Date.now() > deadline) {
      // Best-effort - doesn't hold up the error response waiting to see if this succeeds.
      fetch(`${baseUrl}/jobs/${jobId}`, { method: 'DELETE', headers: authHeaders }).catch(() => {});
      throw withStatus(422, 'Score scanning is taking longer than this can wait for - try again in a few minutes, or use a MusicXML/.mxl file instead.');
    }
  }

  if (job.status === 'failed') {
    const reason = job.failure?.detail || job.failure?.class || 'unknown error';
    throw withStatus(422, `Score scanning couldn't read this file (${reason}) - try a clearer scan, or use a MusicXML/.mxl file instead.`);
  }
  if (!job.movements?.length) {
    throw withStatus(422, "Score scanning didn't find anything to import in this file.");
  }

  // Only the first movement - a multi-movement scan (several distinct pieces in one PDF) only
  // imports the first one, same "start simple" scope as Phase 1 only reading the first <part>.
  const fileResponse = await fetch(`${baseUrl}/jobs/${jobId}/files/${encodeURIComponent(job.movements[0].filename)}`, { headers: authHeaders });
  if (!fileResponse.ok) throw withStatus(422, "Couldn't retrieve the scanned score's MusicXML - try again.");
  const xmlText = await fileResponse.text();

  fetch(`${baseUrl}/jobs/${jobId}`, { method: 'DELETE', headers: authHeaders }).catch(() => {});
  return xmlText;
}

// .mxl is just a zip container (a compressed MusicXML - META-INF/container.xml points at the
// real root entry, same idea as a .docx/.xlsx being a zip of XML parts). "PK" magic bytes are
// enough to tell the two apart without trusting the browser-reported mimeType, which is
// unreliable for both (see the upload-token route's own comment on this).
async function extractMusicXmlText(buffer) {
  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) return buffer.toString('utf8');

  const zip = await JSZip.loadAsync(buffer).catch(() => { throw withStatus(422, "That .mxl file doesn't look like a valid compressed score."); });
  const container = await zip.file('META-INF/container.xml')?.async('string');
  let rootPath = null;
  if (container) {
    const match = container.match(/<rootfile[^>]*full-path="([^"]+)"/);
    rootPath = match?.[1] || null;
  }
  // Falls back to "the first .xml/.musicxml entry that isn't the container manifest itself" -
  // some exporters omit META-INF/container.xml even though the format calls for it.
  const entry = (rootPath && zip.file(rootPath))
    || Object.values(zip.files).find(f => !f.dir && /\.(musicxml|xml)$/i.test(f.name) && !f.name.includes('META-INF'));
  if (!entry) throw withStatus(422, "Couldn't find a MusicXML file inside this .mxl archive.");
  return entry.async('string');
}

const BEAT_UNIT_TO_NOTE_VALUE = {
  '16th': 'semiquaver', eighth: 'quaver', quarter: 'crotchet', half: 'minim', whole: 'semibreve'
};
// Mirrors metronomeSegments.js's own NOTE_VALUES (the note_value CHECK constraint) - only
// quaver/crotchet/minim have a valid dotted counterpart in this app's schema, so a dotted
// sixteenth/whole-note tempo marking (rare, but legal MusicXML) falls back to its plain form
// rather than producing a value the DB would reject outright.
const VALID_NOTE_VALUES = ['semiquaver', 'quaver', 'dotted-quaver', 'crotchet', 'dotted-crotchet', 'minim', 'dotted-minim', 'semibreve'];

// fast-xml-parser gives back a bare object (not an array) for any element that only occurred
// once - every place below that reads a repeatable child (part/measure/direction/direction-type/
// creator/barline) has to go through this rather than assuming an array.
function asArray(x) { return x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]; }
// Mixed text+attribute nodes (e.g. <creator type="composer">Bach</creator>) come back as
// { '@_type': 'composer', '#text': 'Bach' }; a plain text-only node comes back as a bare string.
function textOf(x) { return typeof x === 'string' ? x : (x?.['#text'] ?? null); }

export function parseMusicXmlStructure(xmlString) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: true });
  let doc;
  try {
    doc = parser.parse(xmlString);
  } catch {
    throw withStatus(422, "That file doesn't look like valid MusicXML.");
  }
  const score = doc['score-partwise'];
  if (!score) throw withStatus(422, 'Only partwise MusicXML scores are supported right now.');

  const title = textOf(score.work?.['work-title']) || textOf(score['movement-title']) || null;
  const creators = asArray(score.identification?.creator);
  const composerNode = creators.find(c => c?.['@_type'] === 'composer') || creators[0];
  const composer = textOf(composerNode);

  const firstPart = asArray(score.part)[0];
  if (!firstPart) throw withStatus(422, 'No parts found in this score.');
  const measureNodes = asArray(firstPart.measure);
  if (!measureNodes.length) throw withStatus(422, 'This score has no measures to import.');

  // Carries forward from whichever measure last set it - MusicXML only repeats <attributes>/
  // <sound tempo> when something actually changes, not on every measure.
  let numerator = 4, denominator = 4, noteValue = 'crotchet', bpm = 100;

  return {
    title, composer,
    measures: measureNodes.map((measure, i) => {
      const time = measure.attributes?.time;
      if (time) {
        numerator = Number(time.beats) || numerator;
        denominator = Number(time['beat-type']) || denominator;
      }

      let rehearsalMark = null;
      let isSegno = false, isCoda = false, isFine = false;
      let gotoStartDc = false, gotoSegno = false, gotoCoda = false;
      let tempoSetThisMeasure = false;

      for (const direction of asArray(measure.direction)) {
        for (const dt of asArray(direction['direction-type'])) {
          if (dt.metronome) {
            const unit = dt.metronome['beat-unit'];
            if (BEAT_UNIT_TO_NOTE_VALUE[unit]) {
              const plain = BEAT_UNIT_TO_NOTE_VALUE[unit];
              const dotted = `dotted-${plain}`;
              noteValue = dt.metronome['beat-unit-dot'] !== undefined && VALID_NOTE_VALUES.includes(dotted) ? dotted : plain;
            }
            if (dt.metronome['per-minute']) { bpm = Number(dt.metronome['per-minute']) || bpm; tempoSetThisMeasure = true; }
          }
          if (dt.rehearsal !== undefined) rehearsalMark = textOf(dt.rehearsal);
          if (dt.segno !== undefined) isSegno = true;
          if (dt.coda !== undefined) isCoda = true;
        }
        const sound = direction.sound;
        if (sound) {
          // <sound tempo="..."> is always quarter-note bpm per the MusicXML spec - only trust it
          // for OUR bpm/noteValue pair when no <metronome> mark (a specific beat-unit) already set
          // it this measure, since a metronome mark in a compound/simple-vs-compound mismatch
          // (e.g. "dotted quarter = 140") means something different from a bare quarter-note bpm.
          if (sound['@_tempo'] && !tempoSetThisMeasure) { bpm = Number(sound['@_tempo']) || bpm; noteValue = 'crotchet'; }
          if (sound['@_dacapo'] === 'yes') gotoStartDc = true;
          if (sound['@_dalsegno'] !== undefined) gotoSegno = true;
          if (sound['@_tocoda'] !== undefined) gotoCoda = true;
          if (sound['@_fine'] === 'yes') isFine = true;
        }
      }

      let isRepeatStart = false, isRepeatEnd = false, isFinalBarline = i === measureNodes.length - 1;
      for (const barline of asArray(measure.barline)) {
        const repeatDir = barline.repeat?.['@_direction'];
        if (repeatDir === 'forward') isRepeatStart = true;
        if (repeatDir === 'backward') isRepeatEnd = true;
        if (textOf(barline['bar-style']) === 'light-heavy') isFinalBarline = true;
      }

      // A short first measure (an upbeat/pickup) - MusicXML marks this either explicitly
      // (implicit="yes") or just by the measure's own notes adding up to less than a full bar;
      // either way it becomes the Flow's lead-in block rather than an ordinary short bar (Flow has
      // no other way to represent "less than one full bar" - see docs/database-schema.md).
      const isLeadIn = i === 0 && (measure['@_implicit'] === 'yes' || measureNoteBeats(measure) < numerator);

      return {
        numerator, denominator, noteValue, bpm,
        rehearsalMark, isRepeatStart, isRepeatEnd, isFinalBarline,
        isSegno, isCoda, isFine, gotoStartDc, gotoSegno, gotoCoda, isLeadIn
      };
    })
  };
}

// Sums <note><duration> (skipping chord notes/rests aren't relevant here, just total beat length)
// against <attributes><divisions> to get the measure's actual beat count - only used to spot a
// pickup measure above, never for anything else (see the file-level comment on why real note
// content is otherwise ignored entirely).
function measureNoteBeats(measure) {
  const divisions = Number(measure.attributes?.divisions) || 1;
  const totalDivisions = asArray(measure.note)
    .filter(n => n.chord === undefined)
    .reduce((sum, n) => sum + (Number(n.duration) || 0), 0);
  return totalDivisions / divisions;
}

function measuresShareABlock(a, b) {
  return a.numerator === b.numerator && a.denominator === b.denominator
    && a.noteValue === b.noteValue && a.bpm === b.bpm;
}
// Anything that has to land visibly on ITS OWN block (a repeat/rehearsal mark/coda/segno/etc. is a
// block-level field, not a per-bar one) forces a break even if the neighbouring bar is otherwise
// identical - same reasoning as ML-163's own merge rule, just with more trigger conditions.
function hasStructuralMarkers(m) {
  return !!(m.rehearsalMark || m.isRepeatStart || m.isRepeatEnd || m.isFinalBarline
    || m.isSegno || m.isCoda || m.isFine || m.gotoStartDc || m.gotoSegno || m.gotoCoda || m.isLeadIn);
}

// Collapses consecutive identical, marker-free measures into one multi-bar block - the same
// "minimise the number of blocks" default ML-163's own merge screen uses, just computed once here
// up front rather than offered as an editable choice (Blocks Studio, where the user lands next,
// already lets them split/adjust any block from here).
export function collapseMeasuresIntoBlocks(measures) {
  const blocks = [];
  let openMeasure = null;
  for (const m of measures) {
    const canExtend = openMeasure && !hasStructuralMarkers(m) && !hasStructuralMarkers(openMeasure)
      && measuresShareABlock(openMeasure, m);
    if (canExtend) {
      blocks[blocks.length - 1].barCount++;
    } else {
      const { numerator, denominator, ...rest } = m;
      blocks.push({ barCount: 1, timeSignature: { numerator, denominator }, ...rest });
    }
    openMeasure = m;
  }
  return blocks;
}

// Resolves each block's {numerator, denominator} into the timeSignatureId/accountTimeSignatureId
// pair createFlowBlock expects - the public catalog first, falling back to (idempotently)
// creating one of the account's own custom signatures, exactly what the manual block-editor's own
// time signature picker does when you type in a signature that isn't a preset.
export async function resolveBlocksForAccount(accountId, blocks) {
  const cache = new Map();
  const resolved = [];
  for (const block of blocks) {
    const { numerator, denominator } = block.timeSignature;
    const key = `${numerator}/${denominator}`;
    if (!cache.has(key)) {
      const { rows } = await pool.query(
        'SELECT id FROM time_signature_options WHERE numerator = $1 AND denominator = $2 AND active = true LIMIT 1',
        [numerator, denominator]
      );
      if (rows.length) {
        cache.set(key, { timeSignatureId: Number(rows[0].id), accountTimeSignatureId: null });
      } else {
        const custom = await createCustomTimeSignature(accountId, numerator, denominator);
        cache.set(key, { timeSignatureId: null, accountTimeSignatureId: custom.id });
      }
    }
    const { timeSignature, ...rest } = block;
    resolved.push({ ...rest, ...cache.get(key) });
  }
  return resolved;
}

// The whole pass, front to back - what the /flows/from-file route calls. Takes the raw uploaded
// bytes (already in Blob by the time this runs - see the route) and gets back everything needed
// to create the flow: a title/composer to seed it with, a resolved, ready-for-createFlowBlock
// block list, and - only for a PDF/scan, where OMR had to run first - the MusicXML that OMR
// produced (omrXmlText), so the route can save that too ("store it anyway, may reuse it for
// dynamics later" per the request) rather than throwing away the one clean structured artifact a
// scan gets turned into. Throws (withStatus 422/502/503) on anything that isn't parseable, or
// isn't parseable yet - the route never creates a flow/attaches a document for a file this
// couldn't make sense of.
export async function importScoreFromFile(accountId, buffer) {
  const isPdf = buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF';
  const xmlText = isPdf ? await runOmr(buffer) : await extractMusicXmlText(buffer);

  const { title, composer, measures } = parseMusicXmlStructure(xmlText);
  const rawBlocks = collapseMeasuresIntoBlocks(measures);
  const blocks = await resolveBlocksForAccount(accountId, rawBlocks);
  return { title, composer, blocks, omrXmlText: isPdf ? xmlText : null };
}
