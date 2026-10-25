#!/usr/bin/env node
// ML-22: every button a member can press, grouped by tool, and the name each is counted by.
// A tap is counted by the screen or pop-up it is on and the button's own name - its id, its data-act
// (and a fixed data-arg), or another data-* attribute - never its words, which can hold a piece's title
// or someone's name. A button with no such name is listed as "needs a name": it can't be counted until it
// gets an id (or data-count="...").
//
// Reads public/app.html (the screens and pop-ups) and public/app.js (the buttons the app builds as it
// goes), and writes docs/usage-buttons.md. Run: node scripts/usage-buttons.mjs
// See docs/usage-stats.md ("Every button").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/app.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

// Which tool a screen, pop-up or builder function belongs to - first match wins
const GROUPS = [
  ['Practice session', /^(session|sess|plan|pl[A-Z]|skillRate|scaleUp|paintType|cutType|levels|prepare|piecePath|block)/i],
  ['Metronome (Quick Play)', /^(quickPlay|qp)/i],
  ['Tuner', /^tuner/i],
  ['Tuning fork', /^tuningFork|^fork/i],
  ['Timer', /^timer/i],
  ['Warm-ups', /^warmup/i],
  ['Scales', /^scale/i],
  ['Theory', /^(theory|smartLearn)/i],
  ['Skills: Tempo, Pulse, Pitch, Rhythm', /^(skills|tapTempo|gapTrainer|ear|rhythm|drill|toolResults)/i],
  ['Range', /^range/i],
  ['Pieces: Rehearse, play, edit', /^(rehearse|flow|metroBlk|metroSeg|metroBuilder|barMap|clip|outline|pieceOutline|listItem)/i],
  ['Add a piece', /^(addPiece|flowFromFile)/i],
  ['Recordings', /^recording/i],
  ['Practice lists', /^practiceList/i],
  ['Home and All tools', /^(main|tools|home)/i],
  ['Stats', /^(stats|history|streak)/i],
  ['Instrument support', /^support|^instrumentSupport/i],
  ['Set-up', /^setup/i],
  ['My bands', /^(accountBand|band|tidyBands)/i],
  ['My account, instruments, settings', /^(account|settings|avatar|security)/i],
  ['Signing in', /^(login|password|forgot|setPassword|twoStep|emailChange)/i],
  ['Menu, notices and the rest', /./]
];
const groupOf = (where) => (GROUPS.find(([, re]) => re.test(where)) || GROUPS[GROUPS.length - 1])[0];

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
const words = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\$\{[^}]*\}/g, '…').replace(/&[a-z]+;/g, ' ').replace(/material-symbols-outlined/g, '').replace(/\s+/g, ' ').trim();
// The name a tap is counted by - or null
function countName(tag) {
  const id = attr(tag, 'id');
  if (id && !id.includes('${')) return `#${id}`;
  const own = attr(tag, 'data-count');
  if (own) return own;
  const act = attr(tag, 'data-act');
  if (act) { const arg = attr(tag, 'data-arg'); return arg && /^[a-zA-Z_-]+$/.test(arg) ? `${act}(${arg})` : act; }
  const data = [...tag.matchAll(/\sdata-([a-z0-9-]+)(?:="([^"]*)")?/g)].filter(([, n]) => !['modal-x', 'tooltip'].includes(n));
  if (data.length) {
    const [, n, v] = data[0];
    // a value that is a word stays (data-setup="next"); an id or a run-time value is left off (data-setup="inst:44")
    const fixed = v && /^[a-zA-Z_-]+$/.test(v) ? `=${v}` : '';
    return `data-${n}${fixed}`;
  }
  if (/class="[^"]*modal-close-x/.test(tag)) return 'close (X)';
  return null;
}

const items = []; // { group, where, name, label }

// 1. The screens and pop-ups in app.html: each button belongs to the innermost screen or pop-up around it.
//    Where each <div> ends is found by counting <div> and </div>.
const ranges = [];
const open = [];
for (const m of html.matchAll(/<div\b[^>]*>|<\/div>/g)) {
  if (m[0] === '</div>') { const d = open.pop(); if (d && d.id) ranges.push({ id: d.id, from: d.at, to: m.index }); continue; }
  const id = attr(m[0], 'id');
  open.push({ at: m.index, id: id && /^(navMenu|[a-zA-Z0-9]+(View|Modal))$/.test(id) ? id : null });
}
for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
  const c = ranges.filter((r) => r.from < m.index && m.index < r.to).sort((a, b) => (a.to - a.from) - (b.to - b.from))[0];
  const where = c ? (c.id === 'navMenu' ? 'menu' : c.id) : 'top bar';
  const tag = m[0].match(/^<button\b[^>]*>/)[0];
  // outside any screen: the menu, the top bar, and the ⋮ menus and bars every screen shares - grouped by the button's own name
  const own = (countName(tag) || '').replace(/^#|^data-/, '');
  const group = where === 'menu' || /^(top|nav|view-menu|logout|update|offline|toast|close-toast|reload|notice|preview)/.test(own) ? 'Menu, notices and the rest' : groupOf(where === 'top bar' ? own || 'zz' : where);
  items.push({ group, where, name: countName(tag), label: words(m[1]) || attr(tag, 'aria-label') || '' });
}

// 2. Buttons the app builds as it goes (app.js template strings): grouped by the named function that builds
//    them (a small helper inside it - row(), tile() - says nothing, so the function around it is used)
const fns = [...js.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(|const\s+([a-zA-Z0-9_]{9,})\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)].map((m) => ({ at: m.index, name: m[1] || m[2] }));
const PREFIX = /^(render|open|draw|build|show|start|load|refresh|wire|update|make)(?=[A-Z])/;
const TOOL_OF_FN = [[/^(paint|cut|path|levelRate|pathMap|renderPath|renderPaint|renderCut|openLevelRating|weakRow)/i, 'Practice session'], [/^recScore/i, 'Pieces: Rehearse, play, edit'], [/(Password|TwoStep|Recovery|Passkey)/, 'My account, instruments, settings'], [/^setup/i, 'Set-up'], [/Support/, 'Instrument support']];
for (const m of js.matchAll(/<button\b[^>]*>/g)) {
  const fn = fns.filter((x) => x.at < m.index).pop();
  const where = fn ? fn.name : 'app.js';
  const after = js.slice(m.index + m[0].length, m.index + m[0].length + 200).split('</button>')[0];
  const fixed = TOOL_OF_FN.find(([re]) => re.test(where));
  items.push({ group: fixed ? fixed[1] : groupOf(where.replace(PREFIX, '')), where: `${where}()`, name: countName(m[0]), label: words(after).slice(0, 60) || attr(m[0], 'aria-label') || '' });
}

// 3. Write it out
const order = GROUPS.map(([g]) => g);
const byGroup = new Map(order.map((g) => [g, []]));
items.forEach((it) => byGroup.get(it.group).push(it));
const unnamed = items.filter((it) => !it.name);
const esc = (s) => String(s).replace(/\|/g, '\\|');
let out = `# Every button, grouped by tool (ML-22)

**Made by \`node scripts/usage-buttons.mjs\` - don't edit it by hand.** What counts as a use, and how a tap is
counted, is in [usage-stats.md](usage-stats.md) ("Every button").

${items.length} buttons: ${items.length - unnamed.length} have a name a tap can be counted by, ${unnamed.length} need one.
A button on a screen is listed under the screen or pop-up it is on; one the app builds as it goes, under
the function that builds it (shown with ()). The words are only to help find it - a tap is never counted by
its words.

| Tool | Buttons | Need a name |
|---|---|---|
${order.filter((g) => byGroup.get(g).length).map((g) => `| ${g} | ${byGroup.get(g).length} | ${byGroup.get(g).filter((it) => !it.name).length} |`).join('\n')}
`;
for (const g of order) {
  const list = byGroup.get(g);
  if (!list.length) continue;
  out += `\n## ${g}\n\n| Where | Counted as | Words on it |\n|---|---|---|\n`;
  out += list.map((it) => `| ${esc(it.where)} | ${it.name ? `\`${esc(it.name)}\`` : '**needs a name**'} | ${esc(it.label.slice(0, 70))} |`).join('\n') + '\n';
}
fs.writeFileSync(path.join(root, 'docs/usage-buttons.md'), out);
console.log(`${items.length} buttons, ${unnamed.length} need a name - written to docs/usage-buttons.md`);
for (const g of order) { const l = byGroup.get(g); if (l.length) console.log(`  ${g}: ${l.length} (${l.filter((it) => !it.name).length} need a name)`); }
