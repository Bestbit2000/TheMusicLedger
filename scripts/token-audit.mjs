#!/usr/bin/env node
// ML-198: design-token audit. Scans every stylesheet plus inline styles (HTML style="" attributes,
// <style> blocks, and styles set from JS) for hardcoded visual values that should be a token from
// public/tokens.css, and suggests the right token for each one.
//
//   npm run token-audit              errors + warnings, exit 1 if any error
//   npm run token-audit -- --errors  errors only
//   npm run token-audit -- --summary counts per file/category only
//
// Errors:   raw colours, spacing, font sizes, font weights, radii, z-index, shadows, and any
//           component use of a Layer 1 (--ds-*) primitive.
// Warnings: raw transition/animation durations, line heights, font families, letter spacing,
//           relative (em/%) font sizes.
// Escape hatch for a genuine one-off (data-driven geometry, a third-party quirk): put
// `/* token-audit-ignore: <reason> */` straight after the declaration's `;`. Use sparingly -
// every ignore needs a reason a reviewer would accept.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const TOKENS_FILE = path.join(PUBLIC, 'tokens.css');
const args = new Set(process.argv.slice(2));
const ERRORS_ONLY = args.has('--errors');
const SUMMARY = args.has('--summary');

// ---------------------------------------------------------------- token table (from tokens.css)

function parseTokens() {
    const src = fs.readFileSync(TOKENS_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rootBody = src.slice(src.indexOf(':root {'), src.indexOf('body.dark-mode {'));
    const raw = {};
    for (const m of rootBody.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) raw[m[1]] = m[2].trim();
    const resolve = (v, depth = 0) => {
        if (depth > 10) return v;
        return v.replace(/var\((--[\w-]+)(?:\s*,\s*((?:[^()]|\([^()]*\))*))?\)/g, (_, name, fb) =>
            raw[name] !== undefined ? resolve(raw[name], depth + 1) : (fb ?? ''));
    };
    const layer2 = {};
    for (const [k, v] of Object.entries(raw)) if (!k.startsWith('--ds-')) layer2[k] = resolve(v).trim();
    return layer2;
}
const TOKENS = parseTokens();
const byPrefix = (re) => Object.entries(TOKENS).filter(([k]) => re.test(k));

// ---------------------------------------------------------------- value helpers

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_FN = /\b(?:rgba?|hsla?)\([^)]*\)/g;
const NAMED_COLOR = /\b(white|black|red|green|blue|gr[ae]y|orange|yellow|purple|silver|gold|pink|navy|teal|maroon)\b/g;
const LENGTH = /-?\d*\.?\d+(px|rem|em)\b/g;

function toRgba(c) {
    c = c.trim().toLowerCase();
    let m;
    if ((m = c.match(/^#([0-9a-f]{3,8})$/))) {
        let h = m[1];
        if (h.length <= 4) h = [...h].map(x => x + x).join('');
        const n = [0, 2, 4, 6].map(i => (h.length > i ? parseInt(h.slice(i, i + 2), 16) : 255));
        return [n[0], n[1], n[2], +(n[3] / 255).toFixed(2)];
    }
    if ((m = c.match(/^rgba?\(([^)]*)\)$/))) {
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p[3] ?? 1];
    }
    const named = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], red: [255, 0, 0, 1], green: [0, 128, 0, 1], blue: [0, 0, 255, 1], gray: [128, 128, 128, 1], grey: [128, 128, 128, 1], orange: [255, 165, 0, 1], yellow: [255, 255, 0, 1], purple: [128, 0, 128, 1], silver: [192, 192, 192, 1], gold: [255, 215, 0, 1], pink: [255, 192, 203, 1] };
    return named[c] || null;
}
const COLOR_TOKENS = Object.entries(TOKENS)
    .filter(([k, v]) => !/^--(shadow|focus)/.test(k) && /^(#|rgba?\()/.test(v))
    .map(([k, v]) => [k, toRgba(v)]).filter(([, v]) => v);

function suggestColor(c) {
    const rgba = toRgba(c);
    if (!rgba) return 'a colour token from tokens.css';
    const scored = COLOR_TOKENS.map(([k, t]) => [k, Math.hypot(t[0] - rgba[0], t[1] - rgba[1], t[2] - rgba[2]) + Math.abs(t[3] - rgba[3]) * 255]).sort((a, b) => a[1] - b[1]);
    const exact = scored.filter(([, d]) => d < 1).map(([k]) => `var(${k})`);
    if (exact.length) return exact.slice(0, 3).join(' or ');
    // Data-viz ramps are only ever a suggestion on an exact match - "nearest heatmap green" is never
    // the right answer for a UI colour.
    const ui = scored.filter(([k]) => !/^--(heat|cat|chart)-/.test(k));
    return `nearest var(${ui[0][0]}) (${TOKENS[ui[0][0]]}) - or add a Layer 2 alias if this colour is intentional`;
}

const px = (len) => { const n = parseFloat(len); return /rem$/.test(len) ? n * 16 : /em$/.test(len) ? n * 16 : n; };
function nearest(entries, target, toNum) {
    return entries.map(([k, v]) => [k, v, Math.abs(toNum(v) - target)]).filter(([, , d]) => !Number.isNaN(d)).sort((a, b) => a[2] - b[2])[0];
}
const SPACE = byPrefix(/^--space-/);
const FONT = byPrefix(/^--font-(2xs|xs|sm|base|md|lg|xl|2xl|3xl)$/);
const ICON = byPrefix(/^--icon-/);
const RADIUS = byPrefix(/^--radius-/).filter(([k]) => !/pill|circle/.test(k));
const Z = byPrefix(/^--z-/);
const DURATION = byPrefix(/^--duration-/);
const SHADOW = byPrefix(/^--(shadow|focus-ring)/);

function suggestSpacing(v) {
    return v.replace(LENGTH, (len) => {
        const n = px(len);
        const neg = n < 0;
        const hit = nearest(SPACE.filter(([k]) => k !== '--space-0'), Math.abs(n), px);
        const token = `var(${hit[0]})`;
        return (neg ? `calc(-1 * ${token})` : token) + (hit[2] ? `/*was ${len}*/` : '');
    }).trim();
}
function suggestFontSize(v) {
    const len = v.match(LENGTH)?.[0];
    if (!len) return 'a --font-* token';
    const n = px(len);
    const f = nearest(FONT, n, px);
    const i = nearest(ICON, n, px);
    const out = [`var(${f[0]})${f[2] ? ` (nearest, ${f[1]})` : ''}`];
    if (/px$/.test(len) && i && i[2] <= 2) out.push(`var(${i[0]}) if this sizes an icon glyph`);
    return out.join(' or ');
}
function suggestWeight(v) {
    const w = /bold|[7-9]00/.test(v) ? 'bold' : /[56]00/.test(v) ? 'semibold' : 'normal';
    return `var(--font-weight-${w})`;
}
function suggestRadius(v) {
    if (/50%/.test(v)) return 'var(--radius-circle)';
    return v.replace(LENGTH, (len) => {
        const n = px(len);
        if (n >= 24) return 'var(--radius-pill)';
        const hit = nearest(RADIUS, n, px);
        return `var(${hit[0]})`;
    }).trim() + ' (buttons always use var(--radius-md))';
}
function suggestZ(v) { const hit = nearest(Z, parseFloat(v), Number); return `var(${hit[0]})${hit[2] ? ` (nearest rung, ${hit[1]})` : ''}`; }
function suggestShadow(v) {
    const norm = s => s.replace(/\s+/g, '').toLowerCase();
    const exact = SHADOW.find(([, t]) => norm(t) === norm(v));
    if (exact) return `var(${exact[0]})`;
    if (/^0 0 0 \d/.test(v.trim())) return 'var(--focus-ring) (or a ring built from --space-*/colour tokens)';
    const blur = parseFloat(v.trim().split(/\s+/)[2]) || 0;
    const hit = nearest(SHADOW.filter(([k]) => /shadow-(sm|md|lg|xl|2xl)$/.test(k)), blur, t => parseFloat(t.split(/\s+/)[2]));
    return `nearest var(${hit[0]})`;
}
function suggestDuration(v) {
    return v.replace(/\b\d*\.?\d+m?s\b/g, (d) => {
        const ms = /ms$/.test(d) ? parseFloat(d) : parseFloat(d) * 1000;
        if (ms === 0) return d;
        return `var(${nearest(DURATION, ms, parseFloat)[0]})`;
    }).trim();
}

// ---------------------------------------------------------------- declaration checks

const COLOR_PROPS = /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline))?(-color)?|outline(-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(-color)?|column-rule(-color)?)$/;

function stripVars(v) {
    let prev;
    do { prev = v; v = v.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, ' '); } while (v !== prev);
    return v.replace(/\$\{[^}]*\}/g, ' ').replace(/url\([^)]*\)/g, ' ').replace(/(["'])(?:(?!\1).)*\1/g, ' ');
}

function checkDecl(prop, value, report) {
    prop = prop.toLowerCase();
    if (prop.startsWith('--')) return;
    if (/var\(--ds-/.test(value)) report('error', 'layer', `${prop}: ${value}`, 'components must use Layer 2 aliases, never --ds-* primitives');
    const v = stripVars(value);
    if (!v.trim()) return;

    const colors = [...(v.match(HEX) || []), ...(v.match(COLOR_FN) || []), ...(COLOR_PROPS.test(prop) ? (v.match(NAMED_COLOR) || []) : [])];
    if (colors.length && prop !== 'box-shadow' && prop !== 'text-shadow') {
        for (const c of colors) report('error', 'color', `${prop}: ${value}`, `${c} -> ${suggestColor(c)}`);
    }
    if (/^(padding|margin)(-(top|right|bottom|left|block|inline)(-start|-end)?)?$|^(gap|row-gap|column-gap)$/.test(prop) && /[1-9]/.test(v) && LENGTH.test(v)) {
        LENGTH.lastIndex = 0;
        report('error', 'spacing', `${prop}: ${value}`, suggestSpacing(v));
    }
    LENGTH.lastIndex = 0;
    if (prop === 'font-size') {
        if (/\d*\.?\d+(px|rem)\b/.test(v)) report('error', 'font-size', `${prop}: ${value}`, suggestFontSize(v));
        else if (/\d*\.?\d+(em|%)/.test(v)) report('warning', 'font-size', `${prop}: ${value}`, 'relative size - fine inside an inline glyph, otherwise use a --font-* token');
    }
    if (prop === 'font-weight' && /\d|bold|normal|lighter/.test(v)) report('error', 'font-weight', `${prop}: ${value}`, suggestWeight(v));
    if (/^border(-[a-z]+)*-radius$/.test(prop) && /[1-9]/.test(v)) report('error', 'radius', `${prop}: ${value}`, suggestRadius(v));
    if (prop === 'z-index' && /\d/.test(v)) report('error', 'z-index', `${prop}: ${value}`, suggestZ(v));
    if ((prop === 'box-shadow' || prop === 'text-shadow') && /[1-9]|#|rgb/.test(v)) report('error', 'shadow', `${prop}: ${value}`, suggestShadow(value));
    if (/^(transition|transition-duration|animation|animation-duration|transition-delay|animation-delay)$/.test(prop) && /\b\d*\.?[1-9]\d*m?s\b/.test(v)) report('warning', 'motion', `${prop}: ${value}`, suggestDuration(v));
    if (prop === 'line-height' && /\d/.test(v)) report('warning', 'line-height', `${prop}: ${value}`, 'a --line-height-* token (or match a fixed height intentionally with a size token)');
    if (prop === 'font-family' && !/^\s*(inherit|initial|unset)\s*$/.test(v)) report('warning', 'font-family', `${prop}: ${value}`, 'var(--font-sans) / var(--font-mono) / var(--font-music)');
    if (prop === 'letter-spacing' && /[1-9]/.test(v)) report('warning', 'letter-spacing', `${prop}: ${value}`, 'keep letter-spacing to a documented one-off (see specs/foundations/typography.md)');
}

// ---------------------------------------------------------------- scanning

const lineAt = (text, idx) => { let n = 1; for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) n++; return n; };

function scanCss(css, fileText, baseOffset, file, out) {
    const ignores = [];
    const blanked = css.replace(/\/\*[\s\S]*?\*\//g, (m, off) => { if (/token-audit-ignore/.test(m)) ignores.push(off); return m.replace(/[^\n]/g, ' '); });
    for (const m of blanked.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+?)\s*(?=[;}]|$)/g)) {
        const end = m.index + m[0].length;
        const tail = blanked.slice(end, end + 200);
        const ignored = ignores.some(p => p >= end && /^[\s;]*$/.test(blanked.slice(end, p)));
        if (ignored) continue;
        // A selector like `a:hover {` never ends in ; or } so the lookahead already skips it; guard
        // against pseudo-classes that do (e.g. `...:hover}`) by requiring the value not to open a block.
        if (/^\s*\{/.test(tail)) continue;
        const line = lineAt(fileText, baseOffset + m.index);
        checkDecl(m[1], m[2], (severity, category, decl, suggestion) => out.push({ file, line, severity, category, decl: decl.replace(/\s+/g, ' ').trim(), suggestion }));
    }
}

function scanFile(abs) {
    const file = path.relative(ROOT, abs).replace(/\\/g, '/');
    const text = fs.readFileSync(abs, 'utf8');
    const out = [];
    const ext = path.extname(abs);
    if (ext === '.css') scanCss(text, text, 0, file, out);
    if (ext === '.html') for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) scanCss(m[1], text, m.index + m[0].indexOf(m[1]), file, out);
    if (ext === '.html' || ext === '.js') {
        // style="..." / style='...' / style=\"...\" attributes (HTML markup and JS-built markup)
        for (const m of text.matchAll(/\bstyle\s*=\s*(\\?["'])([\s\S]*?)\1/g)) {
            if (m[2].includes('\n') && m[2].length > 400) continue; // unbalanced quote - not an attribute
            scanCss(m[2], text, m.index + m[0].indexOf(m[2]), file, out);
        }
    }
    if (ext === '.js') {
        for (const m of text.matchAll(/\.style\.([a-zA-Z]+)\s*=\s*(["'`])((?:(?!\2).)*)\2/g)) {
            const prop = m[1] === 'cssText' ? null : m[1].replace(/[A-Z]/g, c => '-' + c.toLowerCase());
            if (!prop) { scanCss(m[3], text, m.index + m[0].indexOf(m[3]), file, out); continue; }
            const line = lineAt(text, m.index);
            checkDecl(prop, m[3], (severity, category, decl, suggestion) => out.push({ file, line, severity, category, decl, suggestion }));
        }
        for (const m of text.matchAll(/\.style\.setProperty\(\s*(["'])([\w-]+)\1\s*,\s*(["'`])((?:(?!\3).)*)\3/g)) {
            const line = lineAt(text, m.index);
            checkDecl(m[2], m[4], (severity, category, decl, suggestion) => out.push({ file, line, severity, category, decl, suggestion }));
        }
    }
    return out;
}

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) return ['demo-scores', 'icons', 'images'].includes(d.name) ? [] : walk(p);
        return /\.(css|html|js)$/.test(d.name) && p !== TOKENS_FILE && d.name !== 'sw.js' ? [p] : [];
    });
}

// ---------------------------------------------------------------- report

const findings = walk(PUBLIC).flatMap(scanFile).filter(f => !(ERRORS_ONLY && f.severity === 'warning'));
const errors = findings.filter(f => f.severity === 'error');
const warnings = findings.filter(f => f.severity === 'warning');

if (!SUMMARY) {
    for (const f of findings) {
        const tag = f.severity === 'error' ? 'error  ' : 'warning';
        console.log(`${f.file}:${f.line}  ${tag}  [${f.category}]  ${f.decl}\n    -> ${f.suggestion}`);
    }
}

const perFile = {};
for (const f of findings) {
    const r = (perFile[f.file] ||= { errors: 0, warnings: 0, cats: {} });
    r[f.severity === 'error' ? 'errors' : 'warnings']++;
    r.cats[f.category] = (r.cats[f.category] || 0) + 1;
}
console.log('\nToken audit summary');
for (const [file, r] of Object.entries(perFile).sort((a, b) => b[1].errors - a[1].errors)) {
    console.log(`  ${file.padEnd(28)} ${String(r.errors).padStart(5)} errors ${String(r.warnings).padStart(5)} warnings   ${Object.entries(r.cats).map(([k, n]) => `${k}:${n}`).join(' ')}`);
}
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)${errors.length ? ' - see specs/tokens/token-reference.md' : ' - clean'}`);
process.exit(errors.length ? 1 : 0);
