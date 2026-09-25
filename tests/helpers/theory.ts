// ML-266: shared helpers for the Theory practice back-test (ML-260).
//
//  - enableTestClock(page)       (from flowPlayback.ts) switches on window.__theoryTest too - call before
//                                the first page.goto. localhost only.
//  - startRound(page, ...)       starts a round with a fixed seed, straight onto the question screen.
//  - answer(page, right)         taps the right answer, or the first wrong one, on screen (after moving
//                                the round's clock past the 0.3 s double-tap guard).
//  - clearTheoryAttempts()       deletes the local-dev account's saved rounds, so every run starts with
//                                "your first round" and repeat runs don't pile up rows.
import { Page } from '@playwright/test';
import pg from 'pg';

const TEST_ACCOUNT_EMAIL = 'local-dev@themusicledger.local';

export async function clearTheoryAttempts() {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        await client.query(
            `DELETE FROM theory_quiz_attempts WHERE account_id = (SELECT id FROM accounts WHERE email = $1)`,
            [TEST_ACCOUNT_EMAIL]
        );
    } finally {
        await client.end();
    }
}

export async function startRound(page: Page, quiz: string, options: Record<string, unknown>, round: string, seed = 1) {
    await page.evaluate(([q, o, r, s]) => (window as any).__theoryTest.start(q, o, r, s), [quiz, options, round, seed] as const);
}

export const question = (page: Page) => page.evaluate(() => (window as any).__theoryTest.question());
export const state = (page: Page) => page.evaluate(() => (window as any).__theoryTest.state());
export const result = (page: Page) => page.evaluate(() => (window as any).__theoryTest.result());

// Taps an answer button like a person would. Returns the question it answered.
export async function answer(page: Page, right: boolean) {
    const q = await question(page);
    await page.evaluate(() => (window as any).__theoryTest.advance(400));
    const id = right ? q.correct : q.answers.find((a: any) => a.id !== q.correct).id;
    await page.locator(`#theoryAnswers .theory-answer[data-id="${id}"]`).click();
    return q;
}

// Waits until the next question is on screen (after the 150 ms / 1.5 s feedback pause).
export async function nextQuestion(page: Page, answeredBefore: number) {
    await page.waitForFunction((n) => {
        const s = (window as any).__theoryTest.state();
        return !s || (s.answered === n && !s.locked);
    }, answeredBefore, { timeout: 5000 });
}
