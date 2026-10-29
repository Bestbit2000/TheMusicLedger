// ML-657 part 2: the instant checks on a photo of a page (public/pageCheck.js), against made-up pages - a page of
// staves, the same page blurred, dark, faint and on its side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// loaded as the browser loads it (as pieceReader.js loads pieceRead.js)
const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/pageCheck.js', import.meta.url), 'utf8'), sandbox);
const PageCheck = sandbox.self.PageCheck;

const W = 600, H = 800;
// White paper, staves of five lines (2 px, every 10 px) every 90 px, a bar line every 120 px down each stave,
// and some note heads
function page() {
    const g = new Uint8ClampedArray(W * H).fill(240);
    const dot = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y * W + x] = 25; };
    for (let top = 40; top + 40 < H; top += 90) {
        for (let l = 0; l < 5; l++) for (let x = 30; x < W - 30; x++) { dot(x, top + l * 10); dot(x, top + l * 10 + 1); }
        for (let x = 30; x < W - 30; x += 120) for (let y = top; y <= top + 41; y++) { dot(x, y); dot(x + 1, y); }
        for (let x = 60; x < W - 40; x += 30) for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) dot(x + dx, top + 15 + ((x / 30) % 5) * 5 + dy);
    }
    return g;
}
function blur(g, r) {
    const out = new Uint8ClampedArray(g.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let s = 0, n = 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const yy = y + dy, xx = x + dx;
            if (yy >= 0 && yy < H && xx >= 0 && xx < W) { s += g[yy * W + xx]; n++; }
        }
        out[y * W + x] = s / n;
    }
    return out;
}
const map = (g, f) => Uint8ClampedArray.from(g, f);
// A quarter turn: what was W x H becomes H x W
function turned(g) {
    const out = new Uint8ClampedArray(g.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[x * H + (H - 1 - y)] = g[y * W + x];
    return out;
}
const kinds = (g, w = W, h = H, nw = 2400, nh = 3200) => [...PageCheck.problems(PageCheck.measure(g, w, h), nw, nh)].map(p => p.kind); // (an array of this realm, not the sandbox's)

test('a clear photo of a page has nothing to say', () => {
    assert.deepEqual(kinds(page()), []);
});
// a light 3 x 3 smoothing, again and again, is close to how a shaken or out-of-focus photo spreads a line
const blurred = (passes) => { let g = page(); for (let k = 0; k < passes; k++) g = blur(g, 1); return g; };
test('a blurred photo is said to be blurred', () => {
    assert.ok(kinds(blurred(5)).includes('blurred'));
    assert.ok(!kinds(blurred(1)).includes('blurred'), 'a little softness is fine');
});
test('a very dark or washed-out photo says so', () => {
    assert.deepEqual(kinds(map(page(), v => v * 0.22)), ['dark']);
    assert.deepEqual(kinds(map(page(), v => 205 + v / 8)), ['faint']);
});
test('a page on its side is spotted', () => {
    assert.deepEqual(kinds(turned(page()), H, W, 3200, 2400), ['sideways']);
});
test('a photo too small to read the bar lines says so', () => {
    assert.deepEqual(kinds(page(), W, H, 480, 640), ['small']);
});
test('every problem is said in words', () => {
    PageCheck.problems({ sharpness: 0, mean: 200, contrast: 200, sideways: 5 }, 100, 100).forEach(p => assert.ok(p.text.length > 10));
});

test('the warnings read past are kept only as known kinds and real page numbers', async () => {
    process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
    const { cleanPageWarnings } = await import('../services/pieceReads.js');
    assert.deepEqual(cleanPageWarnings([{ page: 2, kinds: ['blurred', 'blurred', '<script>'] }, { page: 'x', kinds: ['dark'] }, { page: 40, kinds: ['dark'] }, { page: 3, kinds: [] }]), [{ page: 2, kinds: ['blurred'] }]);
    assert.equal(cleanPageWarnings('nothing'), null);
    assert.equal(cleanPageWarnings([]), null);
});
