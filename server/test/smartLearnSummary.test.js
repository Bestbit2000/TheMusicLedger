// ML-407: what a round tells you SmartLearn will bring back is only what that round gave it - a
// perfect round brings nothing back, even while earlier misses are still working their way down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The function is pure; it's read out of the service so the test needs no database connection.
const src = fs.readFileSync(new URL('../services/theoryPractice.js', import.meta.url), 'utf8');
const body = /export function smartLearnSummary\(states\) \{([\s\S]*?)\n\}/.exec(src)[1];
const smartLearnSummary = new Function('states', body);

test('a perfect round brings nothing back, even with weight left from earlier rounds', () => {
    const states = Array.from({ length: 5 }, () => ({ weight: 1, wrong: 0, slow: 0 })); // each missed before, right now
    assert.deepEqual(smartLearnSummary(states), { learning: 0, missed: 0, slower: 0 });
});

test('a round counts what was missed in it and what was right but slow', () => {
    const states = [
        { weight: 2, wrong: 1, slow: 0 },   // missed
        { weight: 3, wrong: 1, slow: 1 },   // missed, then right but slow: still a miss
        { weight: 1, wrong: 0, slow: 1 },   // right, slowly
        { weight: 4, wrong: 0, slow: 0 },   // right and quick, weight left from before: not from this round
        { weight: 0, wrong: 0, slow: 0 },   // nothing to do
    ];
    assert.deepEqual(smartLearnSummary(states), { learning: 3, missed: 2, slower: 1 });
});

test('a miss that the same round cleared again is not brought back', () => {
    assert.deepEqual(smartLearnSummary([{ weight: 0, wrong: 1, slow: 0 }]), { learning: 0, missed: 0, slower: 0 });
});
