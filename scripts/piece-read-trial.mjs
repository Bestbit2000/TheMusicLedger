// ML-246: tries the photo / PDF reader (server/services/pieceReader.js) on real files and says how it did -
// the rating and the places to look for each piece, what the read cost, and, where the piece's own
// MusicXML export sits next to the file under the same name, how the read compares with it.
//
//   node --env-file=server/.env scripts/piece-read-trial.mjs <file or folder> [...]  [--json <dir>]
//
// Needs AI_GATEWAY_API_KEY (Vercel -> AI Gateway -> API keys). A folder is read file by file (PDF, JPEG,
// PNG, WebP); several photos of one piece are given as  a.jpg+b.jpg  . Nothing is uploaded or stored by
// the app: the pages go to the model and the answer is printed here. --json also writes each answer to a
// folder (keep that folder out of the repo: the answers are about somebody's sheet music).
// PIECE_READER_MODEL tries another model against the same files.

import fs from 'node:fs';
import path from 'node:path';

// flowMusicXmlReader.js reaches the DB pool through its imports; nothing here queries it.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const jsonDir = jsonAt > -1 ? args.splice(jsonAt, 2)[1] : null;
if (!args.length) {
  console.error('Usage: node --env-file=server/.env scripts/piece-read-trial.mjs <file or folder> [...] [--json <dir>]');
  process.exit(1);
}

const { readPieceFromFiles, pieceReaderConfigured } = await import('../server/services/pieceReader.js');
const { musicXmlToFlow } = await import('../server/services/flowMusicXmlReader.js');
if (!pieceReaderConfigured()) {
  console.error('AI_GATEWAY_API_KEY is not set. Make a key in Vercel (AI Gateway -> API keys), put it in server/.env and run again.');
  process.exit(1);
}

const READABLE = /\.(pdf|jpe?g|png|webp)$/i;
const jobs = [];
for (const arg of args) {
  if (arg.includes('+')) { jobs.push(arg.split('+')); continue; }
  if (fs.statSync(arg).isDirectory()) fs.readdirSync(arg).filter(f => READABLE.test(f)).sort().forEach(f => jobs.push([path.join(arg, f)]));
  else jobs.push([arg]);
}

// The hand-entered piece, as the same plain facts the read gives: bars, each bar's time signature, the
// rehearsal marks, the repeats and where the speed changes.
function factsOfFlow(xml) {
  const blocks = musicXmlToFlow(xml).blocks.filter(b => !b.isLeadIn);
  const facts = { bars: 0, sigs: [], marks: [], repeats: [], speedBars: [] };
  let repeatFrom = null, bpm = null;
  blocks.forEach(b => {
    const from = facts.bars + 1;
    for (let i = 0; i < b.barCount; i++) facts.sigs.push(`${b.timeSignature.numerator}/${b.timeSignature.denominator}`);
    facts.bars += b.barCount;
    if (b.rehearsalMark) facts.marks.push(from);
    if (b.isRepeatStart) repeatFrom = from;
    if (b.isRepeatEnd && repeatFrom) { facts.repeats.push(`${repeatFrom}-${facts.bars}`); repeatFrom = null; }
    if (b.bpm !== bpm) { facts.speedBars.push(from); bpm = b.bpm; }
  });
  return facts;
}
function factsOfRead(read) {
  const sigs = [];
  let cur = '4/4';
  for (let b = 1, i = 0; b <= read.bars; b++) {
    while (i < read.time.length && read.time[i].bar <= b) { cur = `${read.time[i].beats}/${read.time[i].beatType}`; i++; }
    sigs.push(cur);
  }
  return { bars: read.bars, sigs, marks: read.marks.map(m => m.bar), repeats: read.repeats.map(r => `${r.from}-${r.to}`), speedBars: read.speeds.map(s => s.bar) };
}
const found = (truth, got) => `${truth.filter(x => got.includes(x)).length} of ${truth.length}` + (got.filter(x => !truth.includes(x)).length ? `, plus ${got.filter(x => !truth.includes(x)).join(', ')} not in the piece` : '');
function compare(truth, got) {
  const bars = Math.min(truth.bars, got.bars);
  let sigWrong = 0;
  for (let i = 0; i < bars; i++) if (truth.sigs[i] !== got.sigs[i]) sigWrong++;
  return [
    `bars: ${got.bars} read, ${truth.bars} in the piece${got.bars === truth.bars ? '' : '  <-- differs'}`,
    `time signatures: ${sigWrong ? `${sigWrong} bar${sigWrong === 1 ? '' : 's'} differ` : 'every bar agrees'}`,
    `rehearsal marks: ${found(truth.marks, got.marks)}`,
    `repeats: ${found(truth.repeats, got.repeats)}`,
    `places the speed changes: ${found(truth.speedBars, got.speedBars)}`
  ];
}

// The piece's own export beside the file. An export is named after the piece and the file after whatever
// the scan was called, so the names are matched loosely: case, punctuation, a "(1)" and a leading "The" or
// trailing word ("Wallace and Gromit" / "Wallace and Gromit Theme") don't matter. An exact name wins.
const plainName = (f) => path.basename(f).replace(/\.[^.]+$/, '').replace(/\(\d+\)/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function answerFor(file) {
  const dir = path.dirname(file), want = plainName(file);
  const answers = fs.readdirSync(dir).filter(f => /\.musicxml$/i.test(f)).sort((a, b) => a.length - b.length);
  const hit = answers.find(f => plainName(f) === want) || answers.find(f => ` ${plainName(f)} `.includes(` ${want} `) || ` ${want} `.includes(` ${plainName(f)} `));
  return hit ? path.join(dir, hit) : null;
}

if (jsonDir) fs.mkdirSync(jsonDir, { recursive: true });
const totals = { files: 0, input: 0, output: 0, ms: 0, levels: { high: 0, medium: 0, low: 0 } };
for (const files of jobs) {
  const name = path.basename(files[0]).replace(/\.[^.]+$/, '');
  console.log(`\n=== ${files.map(f => path.basename(f)).join(' + ')}`);
  let result;
  try {
    result = await readPieceFromFiles(files.map(f => fs.readFileSync(f)));
  } catch (err) {
    console.log(`  could not be read: ${err.message}`);
    continue;
  }
  totals.files++; totals.input += result.usage.inputTokens; totals.output += result.usage.outputTokens; totals.ms += result.ms;
  console.log(`  ${result.model}, ${(result.ms / 1000).toFixed(0)} s, ${result.usage.inputTokens} tokens in, ${result.usage.outputTokens} out`);
  if (jsonDir) fs.writeFileSync(path.join(jsonDir, `${name}.json`), JSON.stringify(result, null, 2));

  const answerFile = answerFor(files[0]);
  const truth = answerFile ? factsOfFlow(fs.readFileSync(answerFile, 'utf8')) : null;
  if (answerFile && path.basename(answerFile, '.musicxml') !== name) console.log(`  compared with ${path.basename(answerFile)}`);
  result.pieces.forEach((p, i) => {
    totals.levels[p.rating.level]++;
    console.log(`  ${result.pieces.length > 1 ? `[${i + 1}] ` : ''}${p.about.name || '(no title read)'} - ${p.outline.bars} bars - ${p.rating.level.toUpperCase()}`);
    p.rating.checks.forEach(c => console.log(`      ${c.level.padEnd(6)} ${c.text}`));
    if (truth && result.pieces.length === 1) compare(truth, factsOfRead(p.read)).forEach(line => console.log(`      vs the piece  ${line}`));
  });
  // ML-529: the movements of one work, put together as one piece in movements
  if (result.whole) {
    const w = result.whole;
    console.log(`  [as one piece] ${w.about.name || '(no title read)'} - ${w.outline.bars} bars - ${w.rating.level.toUpperCase()}`);
    console.log(`      movements: ${w.outline.movements.map(m => `${m.bar}${m.title ? ` ${m.title}` : ''}`).join(' | ')}`);
    console.log(`      marks: ${w.outline.marks.map(m => `${m.label}@${m.bar}`).join(' ')}`);
    w.rating.checks.forEach(c => console.log(`      ${c.level.padEnd(6)} ${c.text}`));
    if (truth) compare(truth, factsOfRead(w.read)).forEach(line => console.log(`      vs the piece  ${line}`));
  }
}
console.log(`\n${totals.files} file${totals.files === 1 ? '' : 's'} read: ${totals.levels.high} high, ${totals.levels.medium} medium, ${totals.levels.low} low.`);
console.log(`${totals.input} tokens in, ${totals.output} out, ${(totals.ms / 1000).toFixed(0)} s in all. Cost: these two numbers against the model's price on Vercel -> AI Gateway -> Models.`);
