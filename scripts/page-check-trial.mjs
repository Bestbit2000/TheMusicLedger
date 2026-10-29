// ML-657 part 3: the page check's trial. Each file (a PDF, or a folder of them) is shown to each model with the page
// check's prompt (server/services/pieceReader.js, checkPagesFromFiles) and what it found is printed: the problems it
// would stop for, the pages it would turn, the time signature it read at the start, the seconds and the cost. Clean
// publisher's PDFs should come back with nothing (a finding there is a false alarm); a known problem file (a sideways
// march card) should be caught. Nothing is stored. Usage:
//   node --env-file=server/.env scripts/page-check-trial.mjs <file or folder>... [--models a,b] [--json out.json]
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_URL ||= 'postgres://unused@localhost/unused'; // pieceReads.js reaches the pool through its imports
const { checkPagesFromFiles } = await import('../server/services/pieceReader.js');
const { costUsd } = await import('../server/services/pieceReads.js');

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const models = (flag('--models') || 'anthropic/claude-haiku-5.5,google/gemini-3.8-flash').split(',');
const jsonOut = flag('--json');
const files = [];
for (const a of args) {
  if (fs.statSync(a).isDirectory()) fs.readdirSync(a).filter(f => /\.(pdf|jpe?g|png|webp)$/i.test(f)).sort().forEach(f => files.push(path.join(a, f)));
  else files.push(a);
}
const out = [];
for (const model of models) {
  let cost = 0, seconds = 0, flagged = 0, failed = 0;
  console.log(`\n=== ${model}`);
  for (const file of files) {
    try {
      const r = await checkPagesFromFiles([fs.readFileSync(file)], { model });
      const c = costUsd(model, r.usage.inputTokens, r.usage.outputTokens) || 0;
      cost += c; seconds += r.ms / 1000;
      const j = r.judged;
      if (j.problems.length || j.turns.length) flagged++;
      console.log(`${path.basename(file).padEnd(44)} ${(r.ms / 1000).toFixed(1).padStart(5)} s  ${(c * 100).toFixed(2).padStart(5)}c  time ${j.time ? `${j.time.beats}/${j.time.beatType}` : 'not read'}${j.turns.length ? `  turn ${j.turns.map(t => `p${t.page}x${t.quarters}`).join(' ')}` : ''}${j.problems.length ? `\n      ${j.problems.map(p => `[${p.kind}] ${p.text}`).join('\n      ')}` : ''}${(j.notes || []).length ? `\n      noted, not stopped for: ${j.notes.map(p => p.kind).join(', ')}` : ''}`);
      out.push({ model, file: path.basename(file), ms: r.ms, cost: c, judged: j, raw: r.raw });
    } catch (e) {
      failed++;
      console.log(`${path.basename(file).padEnd(44)} FAILED ${e.message}`);
      out.push({ model, file: path.basename(file), failed: e.message });
    }
  }
  console.log(`--- ${model}: ${files.length} files, ${flagged} flagged, ${failed} failed, ${seconds.toFixed(0)} s in all, $${cost.toFixed(3)}`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 2));
