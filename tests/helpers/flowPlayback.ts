// ML-193: shared helpers for the Flow editor / Play Flow back-tests.
//
//  - enableTestClock(page)  switches Play Flow's metronome onto the silent, step-by-step test clock
//                           (localStorage 'tml.testClock', read by flowTestHook in app.js - localhost
//                           only). Call before the first page.goto.
//  - seedFlow(page, def)    creates a Flow for the local-dev test account through the app's own API
//                           (same validation as the editor). def uses the ML-204 fixture block shape:
//                           time signature as { numerator, denominator }, fermata/ramp bar offsets
//                           0-based, intro bars and repeatEndingStartBar 1-based.
//  - openPlayFlow / openBarsTab   land on a seeded Flow's Play screen / Bars tab.
//  - T.*                    thin wrappers round window.__flowTest (runToEnd, step, state, journey, issues).
//  - deleteTestFlows(page)  removes every Flow this suite created (title prefix).
import { Page, expect } from '@playwright/test';

export const TEST_FLOW_PREFIX = 'ML-193 test';

export type Ts = { numerator: number; denominator: number };
export type BlockDef = Record<string, unknown> & { timeSignature: Ts; barCount: number; bpm: number };
export type FlowDef = { title: string; blocks: BlockDef[] };

export async function enableTestClock(page: Page) {
    await page.addInitScript(() => { localStorage.setItem('tml.testClock', '1'); });
}

// Creates the Flow and its blocks in order; returns { flowId, blockIds } (lead-in included, in order).
export async function seedFlow(page: Page, def: FlowDef): Promise<{ flowId: number; blockIds: number[] }> {
    return page.evaluate(async (d) => {
        const w = (window as any).__flowTest;
        const sigs = await w.api.metronomeBlocks.timeSignatures.list();
        const idFor = async (ts: { numerator: number; denominator: number }) => {
            const pub = sigs.public.find((s: any) => s.numerator === ts.numerator && s.denominator === ts.denominator);
            if (pub) return { timeSignatureId: pub.id, accountTimeSignatureId: null };
            let custom = (sigs.custom || []).find((s: any) => s.numerator === ts.numerator && s.denominator === ts.denominator);
            if (!custom) { custom = await w.api.metronomeBlocks.timeSignatures.createCustom(ts.numerator, ts.denominator); sigs.custom = [...(sigs.custom || []), custom]; }
            return { timeSignatureId: null, accountTimeSignatureId: custom.id };
        };
        const flow = await w.api.flows.create({ name: d.title });
        // A new Flow always starts with one bar ("Create your own" seeds it) - clear it so the Flow is
        // exactly the blocks given.
        for (const existing of await w.api.flows.blocks.list(flow.id)) await w.api.flows.blocks.delete(existing.id);
        const blockIds: number[] = [];
        for (const b of d.blocks) {
            const { timeSignature, ...rest } = b as any;
            const created = await w.api.flows.blocks.create(flow.id, { ...rest, ...(await idFor(timeSignature)) });
            blockIds.push(created.id);
        }
        return { flowId: flow.id, blockIds };
    }, def);
}

export async function deleteTestFlows(page: Page) {
    await page.evaluate(async (prefix) => {
        const w = (window as any).__flowTest;
        const flows = await w.api.flows.list();
        for (const f of flows) if ((f.title || '').startsWith(prefix)) await w.api.flows.delete(f.id);
    }, TEST_FLOW_PREFIX);
}

// Straight to Play Flow for a Flow (fetches it fresh, as the library does).
export async function openPlayFlow(page: Page, flowId: number, layout: '1' | '2' | '4' = '4') {
    await page.evaluate(async (id) => { await (window as any).__flowTest.openPlay(id); }, flowId);
    await expect(page.locator('#flowPlayView')).toBeVisible();
    // The layout switch itself (the layout is remembered per device, so it may already be on this one).
    const btn = page.locator(`[data-flow-play-layout="${layout}"]`);
    if (await btn.getAttribute('aria-pressed') !== 'true') await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
}

// The Bars tab of a Flow - Edit mode (changes staged until Save) or Create mode (each change saved at
// once, finished with Open player).
export async function openBarsTab(page: Page, flowId: number, layout: '1' | '2' | '4' = '1', mode: 'edit' | 'create' = 'edit') {
    await page.evaluate(({ id, mode }) => { (window as any).__flowTest.openBars(id, mode); }, { id: flowId, mode });
    await expect(page.locator('#flowEditBlocksTab')).toBeVisible();
    await expect(page.locator('#flowBlocksList')).not.toBeEmpty();
    const btn = page.locator(`[data-flow-layout="${layout}"]`);
    if (await btn.getAttribute('aria-pressed') !== 'true') await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
}

export type Snap = {
    ended: boolean; playing: boolean; passage: number; kind: string | null; blockId: number | null; blockIndex: number | null;
    bar: number | null; click: number | null; pass: number | null; via: string | null; bpm: number | null; time: number | null;
    intervalMs: number | null; holding: boolean; holdRemaining: number | null; label: string; activeTiles: number[];
    markers: string[]; dotCount: number;
};
export type Row = Pick<Snap, 'passage' | 'kind' | 'blockId' | 'bar' | 'click' | 'pass' | 'bpm' | 'time' | 'holding' | 'ended'>;
export const T = {
    play: (page: Page) => page.evaluate(() => (window as any).__flowTest.play()) as Promise<Snap>,
    state: (page: Page) => page.evaluate(() => (window as any).__flowTest.state()) as Promise<Snap>,
    step: (page: Page, n = 1) => page.evaluate((k) => (window as any).__flowTest.step(k), n) as Promise<Snap[]>,
    runToEnd: (page: Page) => page.evaluate(() => (window as any).__flowTest.runToEnd()) as Promise<Row[]>,
    journey: (page: Page) => page.evaluate(() => (window as any).__flowTest.journey()),
    issues: (page: Page) => page.evaluate(() => (window as any).__flowTest.issues()) as Promise<Array<{ code: string; severity: string; blockIds: number[]; message: string }>>
};

// The bars actually played, as "A1 A2 B1 ..." - one entry each time playback moves into a bar (a new
// passage or a new bar within it), main piece only unless withIntro. names maps block ids to letters.
export function barsPlayed(rows: Row[], names: Map<number, string>, withIntro = false) {
    const out: string[] = [];
    let prev = '';
    rows.forEach(r => {
        if (r.ended) return;
        const key = `${r.passage}:${r.bar}`;
        if (key === prev) return;
        prev = key;
        if (r.kind === 'main' || (withIntro && r.kind === 'intro')) out.push(`${r.kind === 'intro' ? 'i:' : ''}${names.get(r.blockId as number)}${r.bar}`);
    });
    return out.join(' ');
}

// A block in the fixture shape with everything off - override what a test needs.
export function bar(o: Partial<BlockDef> & { barCount?: number } = {}): BlockDef {
    return { timeSignature: { numerator: 4, denominator: 4 }, barCount: 1, bpm: 120, noteValue: 'crotchet', ...o } as BlockDef;
}
