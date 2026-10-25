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
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/app.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

// The app's own rules (public/usage.js, loaded with vm): which tool a screen, pop-up or builder function
// belongs to (Usage.GROUPS - the heat map groups taps the same way) and the naming rule for buttons.
const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'public/usage.js'), 'utf8'), sandbox);
const Usage = sandbox.self.Usage;
const GROUPS = Usage.GROUPS;
const groupOf = Usage.groupOf;

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
// (an icon's name - "tune", "chevron_right" - is the text of its span, not words on the button)
const words = (s) => s.replace(/<span[^>]*material-symbols-outlined[^>]*>[^<]*<\/span>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\$\{[^}]*\}/g, '…').replace(/&[a-z]+;/g, ' ').replace(/material-symbols-outlined/g, '').replace(/\s+/g, ' ').trim();
// The name a tap is counted by - or null. The app's own rule (Usage.buttonName in public/usage.js, loaded
// with vm), given the button's attributes in order. An id made as the app runs (id="tile-${n}") is left
// for the app to fill in, so the list shows the button's next name.
function countName(tag) {
  const attrs = [...tag.slice(7).matchAll(/\s([a-zA-Z][a-zA-Z0-9:-]*)(?:="([^"]*)")?/g)].map(([, n, v]) => [n, v || '']).filter(([n, v]) => !(n === 'id' && v.includes('${')));
  return Usage.buttonName(attrs, /class="[^"]*modal-close-x/.test(tag));
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
  // words that are mostly code (`${...}`, a quote mark) say nothing - the page names the button by its name instead
  const said = words(after).slice(0, 60);
  const plain = /[`'"{}]|^[…\s.]*$/.test(said) ? '' : said;
  const aria = attr(m[0], 'aria-label') || '';
  items.push({ group: fixed ? fixed[1] : groupOf(where.replace(PREFIX, '')), where: `${where}()`, name: countName(m[0]), label: plain || (aria.includes('${') ? '' : aria) });
}

// The screens in app.html, for "screens never opened"
const views = [...new Set([...html.matchAll(/<div\b[^>]*\bid="([a-zA-Z0-9]+View)"/g)].map((m) => m[1]))].sort();
// What server/usage/buttons.json holds: each button's tool, where it is, its name and its words (to find it
// by); html - it is on a screen in app.html, so a tap names that screen (a built one names the function)
export function buttonsFile() {
  return { views, buttons: items.filter((it) => it.name).map((it) => ({ group: it.group, where: it.where, name: it.name, label: it.label.slice(0, 80), html: !it.where.endsWith('()') })) };
}
// The list, for server/test/usageCounts.test.js (every button has a name)
export { items };

// 3. Write it out - only when run, not when the test imports the list
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
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
  // Admin -> Usage reads this for the buttons and screens never used (server/services/usageReport.js); the
  // test fails when it is out of date
  fs.writeFileSync(path.join(root, 'server/usage/buttons.json'), `${JSON.stringify(buttonsFile(), null, 1)}\n`);
console.log(`${items.length} buttons, ${unnamed.length} need a name - written to docs/usage-buttons.md`);
for (const g of order) { const l = byGroup.get(g); if (l.length) console.log(`  ${g}: ${l.length} (${l.filter((it) => !it.name).length} need a name)`); }
}
