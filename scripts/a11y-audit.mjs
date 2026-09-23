#!/usr/bin/env node
// ML-210 / ML-213: accessibility audit (WCAG 2.2 AA + the 44px house rule). Run by the design gate
// on every push to sandbox/main (scripts/design-gate.mjs), and on its own:
//
//   npm run a11y-audit                        report; exit 1 on any violation NOT in the baseline
//   npm run a11y-audit -- --update-baseline   rewrite specs/accessibility/baseline.json, removing
//                                             fixed entries. Refuses to ADD entries unless
//                                             --allow-new is also passed (owner-approved exceptions only).
//
// Rules (ids match ML-210 section A, plus the semantics that keep phase 3/4 fixes from regressing):
//   A1  text contrast >= 4.5:1 (3:1 large) for every pair in specs/accessibility/contrast-pairs.json, both themes
//   A1h a fill hue (--primary-action, --danger-color, --cat-* ...) used as text colour - use its --*-text variant
//   A2  non-text contrast >= 3:1 (control edges, state indicators, focus ring) - same pairs file
//   A3  clickable element that isn't a button/link (div/span/... with onclick)
//   A4  button/input/select/textarea with no accessible name
//   A5  no global :focus-visible style using --focus-ring
//   A6  interactive control class sized under 44px with no 44px hit area (::before/::after using --touch-target)
//   A7  no prefers-reduced-motion rule
//   A8  swipe/drag gesture not registered in specs/accessibility/gestures.json with its single-tap alternative
//   S1  button that opens a picker/modal/menu without aria-haspopup
//   S2  .modal without role="dialog" + aria-modal + a label
//   S3  .toast without role="status"/aria-live
//   S4  pointerdown/mousedown/touchstart listener without an "a11y:" comment saying why it's not an activation
//   S5  .slider-thumb without role="slider" + tabindex
//   S6  <img> without alt, <html> without lang

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A11Y_DIR = path.join(ROOT, 'specs/accessibility');
const BASELINE = path.join(A11Y_DIR, 'baseline.json');
const args = new Set(process.argv.slice(2));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MARKUP_FILES = ['public/index.html', 'public/admin.html', 'public/styleguide.html', 'public/app.js', 'public/admin.js', 'public/admin-design.js'];
const CSS_FILES = ['public/style.css', 'public/admin.css'];

const violations = [];
const add = (rule, file, snippet, message) => {
    const norm = snippet.replace(/\$\{[^}]*\}/g, '${}').replace(/\s+/g, ' ').trim().slice(0, 120);
    violations.push({ rule, file, snippet: norm, message });
};

// ---------------------------------------------------------------- A1/A2 contrast from tokens.css

function tokenThemes() {
    const src = read('public/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const block = (start) => { const i = src.indexOf(start); return i < 0 ? '' : src.slice(i, src.indexOf('}', i)); };
    const decls = (b) => Object.fromEntries([...b.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
    const light = decls(block(':root {'));
    const dark = { ...light, ...decls(block('body.dark-mode {')) };
    return { light, dark };
}
function resolve(vars, v, depth = 0) {
    if (depth > 12 || v == null) return v;
    return v.replace(/var\((--[\w-]+)(?:\s*,\s*((?:[^()]|\([^()]*\))*))?\)/g, (_, n, fb) => vars[n] !== undefined ? resolve(vars, vars[n], depth + 1) : (fb ?? ''));
}
function parseColor(c) {
    c = (c || '').trim().toLowerCase();
    let m;
    if ((m = c.match(/^#([0-9a-f]{3,8})$/))) {
        let h = m[1]; if (h.length <= 4) h = [...h].map(x => x + x).join('');
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    if ((m = c.match(/^rgba?\(([^)]*)\)$/))) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    return null;
}
const over = (top, bottom) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + bottom[i] * (1 - a)).concat(1); };
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function checkContrast() {
    const pairsFile = path.join(A11Y_DIR, 'contrast-pairs.json');
    if (!fs.existsSync(pairsFile)) { add('A1', 'specs/accessibility/contrast-pairs.json', 'missing', 'contrast pairs file is missing'); return []; }
    const { pairs } = JSON.parse(fs.readFileSync(pairsFile, 'utf8'));
    const themes = tokenThemes();
    const report = [];
    for (const p of pairs) {
        for (const theme of p.themes || ['light', 'dark']) {
            const vars = themes[theme];
            const page = parseColor(resolve(vars, 'var(--container-bg)'));
            const baseBg = parseColor(resolve(vars, `var(${p.over || '--container-bg'})`)) || page;
            let bg = parseColor(resolve(vars, `var(${p.bg})`));
            let fg = parseColor(resolve(vars, `var(${p.fg})`));
            if (!bg || !fg) { add(p.kind === 'text' ? 'A1' : 'A2', 'public/tokens.css', `${p.fg} on ${p.bg} (${theme})`, `can't resolve a colour for this pair`); continue; }
            if (bg[3] < 1) bg = over(bg, baseBg);
            if (fg[3] < 1) fg = over(fg, bg);
            const r = ratio(fg, bg);
            const min = p.min ?? (p.kind === 'text' ? 4.5 : 3);
            report.push({ ...p, theme, r });
            if (r + 1e-9 < min) add(p.kind === 'text' ? 'A1' : 'A2', 'public/tokens.css', `${p.fg} on ${p.bg} (${theme})`, `${r.toFixed(2)}:1, needs ${min}:1 - ${p.use}`);
        }
    }
    return report;
}

// ---------------------------------------------------------------- CSS rules (A1h, A5, A6, A7)

const FILL_HUES = /^--(primary-action|danger-color|info-color|success-color|selection-color|warning-color|tuner-in-tune-green|cat-(practise|rehearsal|lesson|performance)|chart-[a-z]+|link-color-fill)$/;
const INTERACTIVE = /(^|-)(btn|button|toggle|step|handle|close-x|menu-btn|tab|thumb|nav-item|subtab-item)$/;

function cssRules(css) {
    const out = [];
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ selector: m[1].trim(), body: m[2] });
    return out;
}
const pxOf = (v, vars) => { if (!v) return null; const r = resolve(vars, v).trim(); const m = r.match(/^(\d*\.?\d+)(px|rem)$/); return m ? (m[2] === 'rem' ? m[1] * 16 : +m[1]) : null; };

function checkCss() {
    const { light } = tokenThemes();
    const all = CSS_FILES.map(f => ({ f, rules: cssRules(read(f)), text: read(f) }));
    const allRules = all.flatMap(x => x.rules);
    for (const { f, rules } of all) {
        for (const r of rules) {
            // A1h: a fill hue as text colour
            for (const m of r.body.matchAll(/(?:^|;)\s*color\s*:\s*var\((--[\w-]+)\)/g)) {
                if (FILL_HUES.test(m[1])) add('A1h', f, `${r.selector} { color: var(${m[1]}) }`, `${m[1]} is a fill colour and fails text contrast in light mode - use its -text variant`);
            }
            // A6: small interactive control without a hit area
            const last = r.selector.split(',').map(s => s.trim()).filter(s => !/[:]{1,2}(before|after|hover|active|disabled|focus)/.test(s));
            for (const sel of last) {
                const cls = (sel.match(/\.([\w-]+)(?![\w-])(?!.*\.)/) || [])[1];
                if (!cls || !INTERACTIVE.test(cls)) continue;
                const h = pxOf((r.body.match(/(?:^|;)\s*height\s*:\s*([^;]+)/) || [])[1], light);
                const w = pxOf((r.body.match(/(?:^|;)\s*width\s*:\s*([^;]+)/) || [])[1], light);
                const minH = pxOf((r.body.match(/min-height\s*:\s*([^;]+)/) || [])[1], light);
                const small = (h !== null && h < 44 && !(minH >= 44)) || (w !== null && w < 44 && h !== null);
                if (!small) continue;
                const hasHitArea = allRules.some(o => new RegExp(`\\.${cls}(?![\\w-])`).test(o.selector) && /::?(before|after)/.test(o.selector) && /--touch-target|4[4-8]px/.test(o.body))
                    || allRules.some(o => new RegExp(`\\.${cls}(?![\\w-])`).test(o.selector) && /min-(height|width)\s*:\s*var\(--touch-target\)/.test(o.body));
                if (!hasHitArea) add('A6', f, `${sel} { ${w ?? '?'}x${h ?? '?'}px }`, `interactive control under 44px with no 44px hit area (add a ::before/::after sized var(--touch-target))`);
            }
        }
    }
    const cssText = all.map(x => x.text).join('\n');
    if (!/:focus-visible[^{]*\{[^}]*--focus-ring/.test(cssText.replace(/\/\*[\s\S]*?\*\//g, ''))) add('A5', 'public/style.css', 'global :focus-visible', 'no :focus-visible rule using var(--focus-ring)');
    const rm = cssText.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\s*\}/);
    if (!rm || !/animation-duration/.test(rm[1]) || !/transition-duration/.test(rm[1])) add('A7', 'public/style.css', '@media (prefers-reduced-motion: reduce)', 'no reduced-motion rule turning off animations and transitions');
}

// ---------------------------------------------------------------- markup rules (A3, A4, S1-S6)

function tags(text, name) {
    const out = [];
    const re = new RegExp(`<${name}\\b((?:[^>"'\`]|"[^"]*"|'[^']*'|\`[^\`]*\`|\\$\\{[^}]*\\})*)>`, 'gi');
    for (const m of text.matchAll(re)) out.push({ attrs: m[1], index: m.index, full: m[0] });
    return out;
}
const attr = (attrs, n) => new RegExp(`(?:^|\\s)${n}\\s*=`, 'i').test(attrs);
const attrVal = (attrs, n) => (attrs.match(new RegExp(`(?:^|\\s)${n}\\s*=\\s*(["'])([^"']*)\\1`, 'i')) || [])[2];

function checkMarkup() {
    for (const f of MARKUP_FILES) {
        if (!fs.existsSync(path.join(ROOT, f))) continue;
        // Blank out comments (keeping offsets) so markup that's only mentioned in a comment isn't linted.
        const blank = (m) => m.replace(/[^\n]/g, ' ');
        const text = f.endsWith('.html')
            ? read(f).replace(/<!--[\s\S]*?-->/g, blank)
            : read(f).replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank);
        const labelFor = new Set([...text.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/g)].map(m => m[1]));

        // A3: clickable non-interactive elements
        // <label> is left out on purpose: a label wrapping a checkbox is natively interactive.
        for (const name of ['div', 'span', 'li', 'td', 'tr', 'p', 'img', 'strong', 'section', 'svg']) {
            for (const t of tags(text, name)) {
                if (!attr(t.attrs, 'onclick')) continue;
                // role="button" + tabindex is enough: public/a11y.js gives every role="button" Enter/Space activation.
                if (attrVal(t.attrs, 'role') === 'button' && attr(t.attrs, 'tabindex')) continue;
                add('A3', f, t.full, 'clickable element that is not a button - keyboard and screen-reader users can\'t use it');
            }
        }
        for (const t of tags(text, 'a')) if (attr(t.attrs, 'onclick') && !attr(t.attrs, 'href')) add('A3', f, t.full, '<a onclick> with no href is not focusable - use a <button>');

        // A4 + S1: buttons
        for (const m of text.matchAll(/<button\b((?:[^>"'`]|"[^"]*"|'[^']*'|\$\{[^}]*\})*)>([\s\S]*?)<\/button>/gi)) {
            const [full, attrs, inner] = m;
            const named = attr(attrs, 'aria-label') || attr(attrs, 'aria-labelledby') || attr(attrs, 'title');
            if (!named) {
                const visible = inner.replace(/<span[^>]*material-symbols[^>]*>[^<]*<\/span>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '');
                if (!/\$\{/.test(visible) && !/[\p{L}\p{N}]/u.test(visible)) add('A4', f, full.slice(0, 140), 'button has no accessible name (icon/glyph only) - add aria-label');
            }
            const onclick = attrVal(attrs, 'onclick') || '';
            const opensPopup = /\bopen\w*(Modal|Picker|Popup|Menu|Sheet)\s*\(/.test(onclick)
                || /class="[^"]*\b(list-item-menu-btn|qp-bar-menu-btn|metroBlk-tile-menu-btn|metroBlk-ctrl-value-btn|metroBlk-mini-ctrl-value-btn|metroBlk-mini-tuner-instrument-btn|top-bar-timer-pill)\b/.test(attrs) && !/window\.open/.test(attrs);
            if (opensPopup && !attr(attrs, 'aria-haspopup')) add('S1', f, full.slice(0, 140), 'opens a picker/modal/menu - add aria-haspopup (and aria-expanded while open)');
        }
        // A4: form fields
        for (const name of ['input', 'select', 'textarea']) {
            for (const t of tags(text, name)) {
                const type = (attrVal(t.attrs, 'type') || '').toLowerCase();
                if (type === 'hidden' || type === 'file') continue;
                if (attr(t.attrs, 'aria-label') || attr(t.attrs, 'aria-labelledby')) continue;
                const id = attrVal(t.attrs, 'id');
                if (id && labelFor.has(id)) continue;
                const before = text.slice(Math.max(0, t.index - 400), t.index);
                const lastOpen = before.lastIndexOf('<label'), lastClose = before.lastIndexOf('</label>');
                if (lastOpen > lastClose) {
                    // Wrapped in a <label> - but it only names the field if the label has text of its own
                    // (a toggle switch's <label> is just the graphic; its caption sits beside it).
                    const after = text.slice(t.index, text.indexOf('</label>', t.index));
                    const labelText = (before.slice(lastOpen) + after).replace(/<[^>]*>/g, '').replace(/\$\{[^}]*\}/g, 'x');
                    if (/[\p{L}\p{N}]/u.test(labelText)) continue;
                }
                add('A4', f, t.full, `<${name}> has no label (add <label for>, wrap it in <label>, or aria-label)`);
            }
        }
        // S2 modals, S3 toasts, S5 slider thumbs
        for (const name of ['div', 'section']) {
            for (const t of tags(text, name)) {
                const cls = (attrVal(t.attrs, 'class') || '').split(/\s+/);
                if (cls.includes('modal')) {
                    if (attrVal(t.attrs, 'role') !== 'dialog' || !attr(t.attrs, 'aria-modal') || !(attr(t.attrs, 'aria-labelledby') || attr(t.attrs, 'aria-label'))) add('S2', f, t.full, 'modal needs role="dialog", aria-modal="true" and aria-labelledby/aria-label');
                }
                if (cls.includes('toast') && !(attr(t.attrs, 'aria-live') || /^(status|alert)$/.test(attrVal(t.attrs, 'role') || ''))) add('S3', f, t.full, 'toast is not announced - add role="status"');
                if (cls.includes('slider-thumb') && !(attrVal(t.attrs, 'role') === 'slider' && attr(t.attrs, 'tabindex'))) add('S5', f, t.full, 'slider thumb needs role="slider", tabindex="0" and aria-value* (set by JS)');
            }
        }
        // S6
        for (const t of tags(text, 'img')) if (!attr(t.attrs, 'alt')) add('S6', f, t.full, '<img> without alt');
        if (f.endsWith('.html') && !/<html[^>]*\blang=/.test(text)) add('S6', f, '<html>', '<html> without lang');

        // S4 press-to-activate listeners must say why they're safe
        if (f.endsWith('.js')) {
            const lines = read(f).split('\n'); // raw text: the "a11y:" notes this looks for are comments
            lines.forEach((line, i) => {
                if (!/addEventListener\(\s*['"](pointerdown|mousedown|touchstart)['"]/.test(line)) return;
                const ctx = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
                if (!/a11y:/.test(ctx)) add('S4', f, line.trim(), 'press listener - if it activates something, move it to click/pointerup (WCAG 2.5.2); if it only starts a gesture or closes a popup, add an "// a11y: ..." comment saying so');
            });
        }
    }
}

// ---------------------------------------------------------------- A8 gestures registry

function checkGestures() {
    const reg = path.join(A11Y_DIR, 'gestures.json');
    const registered = fs.existsSync(reg) ? JSON.parse(fs.readFileSync(reg, 'utf8')).gestures : [];
    const js = read('public/app.js');
    const found = new Set([
        ...[...js.matchAll(/function\s+(wire\w*(Swipe|GrabHandle|DragHandle|DragScroll|Drag)\w*)\s*\(/g)].map(m => m[1]),
        ...(/draggable="true"/.test(js + read('public/index.html')) ? ['draggable-list'] : []),
    ]);
    for (const g of found) {
        const entry = registered.find(r => r.id === g);
        if (!entry) add('A8', 'public/app.js', g, 'swipe/drag gesture with no registered single-tap alternative in specs/accessibility/gestures.json');
        else if (!entry.alternative) add('A8', 'specs/accessibility/gestures.json', g, 'registered gesture has no "alternative" described');
    }
}

// ---------------------------------------------------------------- run + baseline

const contrast = checkContrast();
checkCss();
checkMarkup();
checkGestures();

const keyOf = (v, n) => `${v.rule}|${v.file}|${v.snippet}|${n}`;
const seen = {};
for (const v of violations) { const k = `${v.rule}|${v.file}|${v.snippet}`; seen[k] = (seen[k] || 0) + 1; v.key = keyOf(v, seen[k]); }

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { entries: [] };
const baseKeys = new Set(baseline.entries.map(e => e.key));
const nowKeys = new Set(violations.map(v => v.key));
const fresh = violations.filter(v => !baseKeys.has(v.key));
const fixed = baseline.entries.filter(e => !nowKeys.has(e.key));

if (args.has('--update-baseline')) {
    if (fresh.length && !args.has('--allow-new')) {
        console.log(`Refusing to add ${fresh.length} new violation(s) to the baseline - fix them, or pass --allow-new for an owner-approved exception.`);
        fresh.forEach(v => console.log(`  ${v.rule}  ${v.file}  ${v.snippet}\n      ${v.message}`));
        process.exit(1);
    }
    const entries = violations.map(v => ({ key: v.key, rule: v.rule, file: v.file, snippet: v.snippet, message: v.message }));
    fs.mkdirSync(A11Y_DIR, { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify({ note: 'Known accessibility violations still to fix (ML-210). Shrink-only: the design gate fails if this list grows. Regenerate with npm run a11y-audit -- --update-baseline.', updated: new Date().toISOString().slice(0, 10), entries }, null, 2) + '\n');
    console.log(`Baseline written: ${entries.length} known violation(s) (${fixed.length} fixed and removed).`);
    process.exit(0);
}

if (!args.has('--quiet')) {
    const byRule = {};
    violations.forEach(v => { byRule[v.rule] = (byRule[v.rule] || 0) + 1; });
    console.log('Accessibility audit (ML-210)');
    console.log(`  contrast pairs checked: ${contrast.length} (both themes)`);
    console.log(`  violations: ${violations.length} total - ${Object.entries(byRule).map(([k, n]) => `${k}:${n}`).join(' ') || 'none'}`);
    console.log(`  baseline (known, still to fix): ${baseline.entries.length}   fixed since baseline: ${fixed.length}   NEW: ${fresh.length}`);
    if (args.has('--all')) violations.forEach(v => console.log(`  ${baseKeys.has(v.key) ? 'known' : 'NEW  '}  ${v.rule}  ${v.file}  ${v.snippet}\n        ${v.message}`));
}
if (fresh.length) {
    console.log('\nNEW accessibility violations (not in the baseline) - fix before releasing:');
    fresh.forEach(v => console.log(`  ${v.rule}  ${v.file}  ${v.snippet}\n        ${v.message}`));
}
if (fixed.length) console.log(`\n${fixed.length} baseline entr${fixed.length === 1 ? 'y is' : 'ies are'} fixed - run: npm run a11y-audit -- --update-baseline`);
process.exit(fresh.length ? 1 : 0);
