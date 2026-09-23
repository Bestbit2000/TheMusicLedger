#!/usr/bin/env node
// ML-198: regenerates specs/tokens/token-reference.md from public/tokens.css, so the master token
// map can never drift from the real values. Usage notes come from each token's trailing comment in
// tokens.css - document a new token there, then run `npm run token-reference`.
// `--check` exits 1 if the committed reference is stale (used by scripts/design-gate.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'public/tokens.css'), 'utf8');
const OUT = path.join(ROOT, 'specs/tokens/token-reference.md');

const rootStart = src.indexOf(':root {');
const darkStart = src.indexOf('body.dark-mode {');
const rootBlock = src.slice(rootStart, darkStart);
const darkBlock = src.slice(darkStart);
const layer2Block = rootBlock.slice(rootBlock.indexOf('LAYER 2'));

const decls = (block) => [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]);
const raw = Object.fromEntries(decls(rootBlock));
const dark = Object.fromEntries(decls(darkBlock));
const resolve = (v, scope = raw, depth = 0) => depth > 10 ? v : v.replace(/var\((--[\w-]+)(?:\s*,\s*((?:[^()]|\([^()]*\))*))?\)/g,
    (_, name, fb) => scope[name] !== undefined ? resolve(scope[name], scope, depth + 1) : (raw[name] !== undefined ? resolve(raw[name], raw, depth + 1) : (fb ?? name)));

// Walk Layer 2 line by line so section headings and trailing comments stay attached.
const groups = [];
let current = null;
for (const line of layer2Block.split('\n')) {
    const heading = line.match(/^\s*\/\*\s*([A-Z][^*]*?)\s*\*\/\s*$/);
    if (heading && !/LAYER/.test(heading[1])) { current = { title: heading[1].replace(/ - .*/, ''), note: heading[1].includes(' - ') ? heading[1].split(' - ').slice(1).join(' - ') : '', rows: [] }; groups.push(current); continue; }
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?/);
    if (m && current) current.rows.push({ name: m[1], alias: m[2].trim(), value: resolve(m[2].trim()), dark: dark[m[1]] ? resolve(dark[m[1]]) : '', use: m[3] || '' });
}

const esc = s => s.replace(/\|/g, '\\|');
let md = `# Token reference

> Generated from \`public/tokens.css\` by \`npm run token-reference\` - do not edit by hand.
> To change a value or its usage note, edit \`tokens.css\` and re-run the script.

Components (Layer 3) may use **only** the Layer 2 tokens below. The \`--ds-*\` primitives
(Layer 1, listed at the end) exist so Layer 2 has something to point at and so dark mode
can remap an alias onto a different primitive - never reference them from component CSS.
\`npm run token-audit\` enforces both rules.

Related: [color](../foundations/color.md) - [spacing](../foundations/spacing.md) -
[typography](../foundations/typography.md) - [radius](../foundations/radius.md) -
[elevation](../foundations/elevation.md) - [motion](../foundations/motion.md)

`;
for (const g of groups) {
    const hasDark = g.rows.some(r => r.dark);
    md += `## ${g.title}\n\n${g.note ? g.note + '\n\n' : ''}`;
    md += hasDark ? '| Token | Light | Dark | Use for |\n|---|---|---|---|\n' : '| Token | Value | Use for |\n|---|---|---|\n';
    for (const r of g.rows) {
        md += hasDark
            ? `| \`${r.name}\` | \`${esc(r.value)}\` | ${r.dark ? '`' + esc(r.dark) + '`' : '(same)'} | ${esc(r.use)} |\n`
            : `| \`${r.name}\` | \`${esc(r.value)}\` | ${esc(r.use)} |\n`;
    }
    md += '\n';
}

md += '## Layer 1 primitives (reference only - never use in components)\n\n| Primitive | Value |\n|---|---|\n';
for (const [k, v] of Object.entries(raw)) if (k.startsWith('--ds-')) md += `| \`${k}\` | \`${esc(v)}\` |\n`;

// --check (used by the design gate): fail instead of writing if the committed file is stale.
if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== md) { console.log('specs/tokens/token-reference.md is out of date - run: npm run token-reference'); process.exit(1); }
    process.exit(0);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md);
console.log(`Wrote ${path.relative(ROOT, OUT)} (${groups.reduce((n, g) => n + g.rows.length, 0)} Layer 2 tokens)`);
