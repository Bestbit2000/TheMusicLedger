#!/usr/bin/env node
// ML-198: the design gate for a dev -> sandbox release (and a safety net on main).
// See docs/release-process.md "Dev -> sandbox: design gate".
//
//   npm run design-gate                          hard checks + sign-off list vs origin/sandbox
//   npm run design-gate -- --base <git-ref>      compare against another ref
//   npm run design-gate -- --no-signoff          hard checks only (used on pushes to main)
//
// Hard checks (exit 1 - always fix, never bypass):
//   1. token audit: zero errors (scripts/token-audit.mjs)
//   2. every CSS class in style.css/admin.css belongs to a spec in specs/components/
//   3. every Layer 2 token in tokens.css has a usage comment
//   4. specs/tokens/token-reference.md is up to date
//   5. accessibility (scripts/a11y-audit.mjs): no violations outside specs/accessibility/baseline.json,
//      and that baseline may only shrink (ML-210)
//   6. every component spec has a section on the Admin -> Design page (public/admin-design.js),
//      and every Design page section points at a spec that exists
//
// Sign-off (exit 2 - must be shown to and approved by the product owner before pushing):
//   anything that's new to the design system since <base>: new CSS classes, new or changed
//   tokens, new or changed component/foundation specs. Once approved, push with
//   DESIGN_APPROVED=1. Nothing here is ever approved on the owner's behalf.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argVal = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const BASE = argVal('--base') || 'origin/sandbox';
const NO_SIGNOFF = argv.includes('--no-signoff');
const CSS_FILES = ['public/style.css', 'public/admin.css'];
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readAt = (ref, p) => { try { return execFileSync('git', ['show', `${ref}:${p}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const listAt = (ref, dir) => { try { return execFileSync('git', ['ls-tree', '--name-only', `${ref}:${dir}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean); } catch { return []; } };

// ---------------------------------------------------------------- parsing helpers

function cssClasses(css) {
    const out = new Set();
    for (const block of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
        if (/^\s*@/.test(block[1])) continue;
        for (const m of block[1].matchAll(/\.([a-zA-Z][\w-]*)/g)) out.add(m[1]);
    }
    return out;
}
function layer2Tokens(tokensCss) {
    const out = new Map();
    const root = tokensCss.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf('body.dark-mode {'));
    const l2 = root.slice(root.indexOf('LAYER 2'));
    for (const line of l2.split('\n')) {
        const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?/);
        if (m) out.set(m[1], { value: m[2].trim(), comment: m[3] || '' });
    }
    return out;
}
function allTokens(tokensCss) {
    const out = new Map();
    for (const m of (tokensCss || '').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        if (!out.has(m[1])) out.set(m[1], m[2].trim());
    }
    return out;
}
function specPatterns() {
    const pats = [];
    for (const f of fs.readdirSync(path.join(ROOT, 'specs/components'))) {
        const meta = read(`specs/components/${f}`).split('## 2.')[0];
        for (const m of meta.matchAll(/`\.([\w-]+)(\*)?/g)) pats.push({ name: m[1], wild: !!m[2], spec: f });
    }
    return pats;
}
const covering = (pats, c) => pats.find(p => c === p.name || c.startsWith(p.name + (p.wild ? '' : '-')));

// ---------------------------------------------------------------- hard checks

const failures = [];

const audit = spawnSync(process.execPath, [path.join(ROOT, 'scripts/token-audit.mjs'), '--errors'], { cwd: ROOT, encoding: 'utf8' });
if (audit.status !== 0) failures.push(['Token audit has errors (raw values instead of tokens)', audit.stdout.trim().split('\n').filter(l => /error/.test(l)).slice(0, 25)]);

const pats = specPatterns();
const classesNow = new Set(CSS_FILES.flatMap(f => [...cssClasses(read(f))]));
const uncovered = [...classesNow].filter(c => !covering(pats, c)).sort();
if (uncovered.length) failures.push(['CSS classes not described by any spec in specs/components/', uncovered.map(c => '.' + c)]);

const tokensNow = read('public/tokens.css');
const undocumented = [...layer2Tokens(tokensNow)].filter(([, t]) => !t.comment).map(([k]) => k);
if (undocumented.length) failures.push(['Layer 2 tokens with no usage comment in tokens.css', undocumented]);

const ref = spawnSync(process.execPath, [path.join(ROOT, 'scripts/build-token-reference.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
if (ref.status !== 0) failures.push(['Token reference is stale', ['run: npm run token-reference']]);

// ML-210: accessibility. No violation outside the known baseline, and the baseline may only shrink.
const a11y = spawnSync(process.execPath, [path.join(ROOT, 'scripts/a11y-audit.mjs'), '--quiet'], { cwd: ROOT, encoding: 'utf8' });
if (a11y.status !== 0) failures.push(['New accessibility violations (npm run a11y-audit -- --all for detail)', a11y.stdout.trim().split('\n').filter(l => /^\s{2}[A-Z]\d/.test(l)).slice(0, 40)]);
const baselineCount = (text) => { try { return JSON.parse(text).entries.length; } catch { return null; } };
const a11yNow = baselineCount(read('specs/accessibility/baseline.json'));
const a11yBaseRef = argVal('--base') || (NO_SIGNOFF ? 'origin/main' : BASE);
const a11yThen = baselineCount(readAt(a11yBaseRef, 'specs/accessibility/baseline.json') || '');
if (a11yThen !== null && a11yNow > a11yThen) failures.push([`Accessibility baseline grew (${a11yThen} -> ${a11yNow} known violations since ${a11yBaseRef}) - it may only shrink`, ['fix the new violations instead of adding them to specs/accessibility/baseline.json']]);
if (/fixed and removed|baseline entr/.test(a11y.stdout)) failures.push(['Accessibility baseline is stale (some entries are fixed)', ['run: npm run a11y-audit -- --update-baseline']]);

const specs = fs.readdirSync(path.join(ROOT, 'specs/components')).map(f => f.replace(/\.md$/, ''));
const noA11ySection = specs.filter(s => !/^## 9\. Accessibility/m.test(read(`specs/components/${s}.md`)));
if (noA11ySection.length) failures.push(['Component specs with no "## 9. Accessibility" section (ML-210)', noA11ySection]);
const designJs = read('public/admin-design.js');
const designSpecs = new Set([...designJs.matchAll(/\bspec:\s*'([\w-]+)'/g)].map(m => m[1]));
const missingOnPage = specs.filter(s => !designSpecs.has(s));
const orphanOnPage = [...designSpecs].filter(s => !specs.includes(s));
if (missingOnPage.length) failures.push(['Component specs with no example on the Admin -> Design page (public/admin-design.js)', missingOnPage]);
if (orphanOnPage.length) failures.push(['Design page sections pointing at a spec that does not exist', orphanOnPage]);

// ---------------------------------------------------------------- sign-off list

const signoff = [];
if (!NO_SIGNOFF) {
    const baseOk = readAt(BASE, 'package.json') !== null;
    if (!baseOk) {
        signoff.push([`Base ref "${BASE}" not found - can't tell what's new. Fetch it (git fetch origin) or pass --base <ref>.`, []]);
    } else {
        const classesBase = new Set(CSS_FILES.flatMap(f => [...cssClasses(readAt(BASE, f) || '')]));
        const newClasses = [...classesNow].filter(c => !classesBase.has(c)).sort();
        if (newClasses.length) signoff.push(['New CSS classes', newClasses.map(c => `.${c}  (spec: ${covering(pats, c)?.spec || 'none'})`)]);

        const tBase = allTokens(readAt(BASE, 'public/tokens.css'));
        const tNow = allTokens(tokensNow);
        const l2Now = layer2Tokens(tokensNow);
        const added = [...tNow].filter(([k]) => !tBase.has(k));
        const changed = [...tNow].filter(([k, v]) => tBase.has(k) && tBase.get(k) !== v);
        const removed = [...tBase.keys()].filter(k => !tNow.has(k));
        const fmt = ([k, v]) => `${k}: ${v}${l2Now.get(k)?.comment ? '  - ' + l2Now.get(k).comment : ''}`;
        // Primitives only exist to back an alias, so the alias is what gets reviewed - just count them.
        const addedAliases = added.filter(([k]) => !k.startsWith('--ds-'));
        const addedPrims = added.length - addedAliases.length;
        if (addedAliases.length) signoff.push(['New tokens', addedAliases.map(fmt)]);
        if (addedPrims) signoff.push([`New Layer 1 primitives behind them: ${addedPrims} (raw values, see specs/tokens/token-reference.md)`, []]);
        if (changed.length) signoff.push(['Changed token values', changed.map(([k, v]) => `${k}: ${tBase.get(k)} -> ${v}`)]);
        if (removed.length) signoff.push(['Removed tokens', removed]);

        for (const dir of ['specs/components', 'specs/foundations']) {
            const baseFiles = new Set(listAt(BASE, dir));
            const nowFiles = fs.readdirSync(path.join(ROOT, dir));
            const newSpecs = nowFiles.filter(f => !baseFiles.has(f));
            const changedSpecs = nowFiles.filter(f => baseFiles.has(f) && (readAt(BASE, `${dir}/${f}`) || '').replace(/\r\n/g, '\n') !== read(`${dir}/${f}`).replace(/\r\n/g, '\n'));
            if (newSpecs.length) signoff.push([`New specs (${dir})`, newSpecs]);
            if (changedSpecs.length) signoff.push([`Changed specs (${dir})`, changedSpecs]);
        }
    }
}

// ---------------------------------------------------------------- report

const section = (title, items) => { console.log(`\n  ${title}${items.length ? ` (${items.length})` : ''}`); items.slice(0, 200).forEach(i => console.log(`    - ${i}`)); if (items.length > 200) console.log(`    ... and ${items.length - 200} more`); };

console.log('Design gate (ML-198)');
if (failures.length) {
    console.log('\nFAILED - fix these before releasing:');
    failures.forEach(([t, i]) => section(t, i));
} else {
    console.log('\nHard checks: all passed (token audit clean, accessibility within baseline, every class spec\'d, tokens documented, reference current, Design page complete).');
}
if (!NO_SIGNOFF) {
    if (signoff.length) {
        console.log(`\nDESIGN SIGN-OFF NEEDED - new to the design system since ${BASE}.`);
        console.log('Show this list to the product owner and get explicit approval before pushing.');
        console.log('Check each item on Admin -> Design first. Once approved: DESIGN_APPROVED=1 git push origin sandbox');
        signoff.forEach(([t, i]) => section(t, i));
    } else {
        console.log(`\nNothing new to the design system since ${BASE} - no sign-off needed.`);
    }
}
process.exit(failures.length ? 1 : (signoff.length && !process.env.DESIGN_APPROVED ? 2 : 0));
