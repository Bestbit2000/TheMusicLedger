// The back-test recorder (scripts/record-backtest-run.mjs): one row per test case, from every test in
// the file. Report shapes copied from a real run (57, 30 Sept 2026): a serial file whose second test
// timed out (the rest "skipped" with expectedStatus "passed"), a file with a describe block, and a
// test skipped on purpose (expectedStatus "skipped").
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { summariseReport, verdictFor } from '../../scripts/record-backtest-run.mjs';

const t = (status, { expectedStatus = 'passed', results, message } = {}) => ({
    status, expectedStatus,
    results: results || [{ status: status === 'unexpected' ? 'timedOut' : status === 'skipped' ? 'skipped' : 'passed', duration: status === 'skipped' ? 0 : 1000.4, ...(message ? { error: { message } } : {}) }]
});
const spec = (title, test) => ({ title, ok: test.status !== 'unexpected', tests: [test] });
const file = (name, specs, suites = []) => ({ title: name, file: name, specs, suites });
const sources = { 'tc_1.spec.ts': '// TEST_CASE_ID: 1\n', 'tc_2.spec.ts': '// TEST_CASE_ID: 2\n', 'tc_3.spec.ts': '// TEST_CASE_ID: 3\n', 'tc_4.spec.ts': '// TEST_CASE_ID: 4\n', 'tc_9.spec.ts': '// TEST_CASE_ID: 9\n', 'other.spec.ts': 'no id here' };
const read = (f) => sources[f] ?? null;

describe('the back-test recorder', () => {
    test('a later failure fails the file, and the tests that didn\'t run after it are counted, not passed', () => {
        const [row] = summariseReport({ suites: [file('tc_1.spec.ts', [
            spec('time signature', t('expected')),
            spec('beat note', t('unexpected', { message: '\u001b[31mError: locator.click: Test timeout of 30000ms exceeded.\u001b[39m' })),
            spec('bar start and end', t('skipped')),
            spec('alternate ending', t('skipped'))
        ])] }, read);
        assert.equal(row.testCaseId, '1');
        assert.equal(row.verdict, 'FAIL');
        assert.equal(row.tests, 4);
        assert.match(row.errorMessage, /^1 of 4 tests failed, 2 didn't run after it\. First failure - "beat note":\nError: locator\.click/);
        assert.doesNotMatch(row.errorMessage, /\u001b/, 'no terminal colour codes');
        assert.equal(row.duration, 2001); // the two that ran
    });
    test('a describe block is part of its file: one row, not two', () => {
        const rows = summariseReport({ suites: [file('tc_2.spec.ts',
            [spec('Warm-ups is on the home screen', t('unexpected'))],
            [{ title: 'Admin -> Warm-ups editor', file: 'tc_2.spec.ts', specs: [spec('builds an exercise', t('expected'))], suites: [] }])] }, read);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].verdict, 'FAIL');
        assert.equal(rows[0].tests, 2);
        const [pass] = summariseReport({ suites: [file('tc_2.spec.ts', [spec('a', t('expected'))],
            [{ title: 'Editor', file: 'tc_2.spec.ts', specs: [spec('b', t('unexpected'))], suites: [] }])] }, read);
        assert.equal(pass.verdict, 'FAIL', 'a failure inside the describe block fails the file too');
        assert.match(pass.errorMessage, /"Editor › b"/);
    });
    test('PASS only when every test meant to run passed - a test skipped on purpose is fine, a retry that passed is fine', () => {
        const [row] = summariseReport({ suites: [file('tc_3.spec.ts', [
            spec('ramps', t('expected')),
            spec('play speed %', t('skipped', { expectedStatus: 'skipped' })),
            spec('sub-beats', t('flaky', { results: [{ status: 'failed', duration: 10 }, { status: 'passed', duration: 20 }] }))
        ])] }, read);
        assert.equal(row.verdict, 'PASS');
        assert.equal(row.errorMessage, null);
        assert.equal(row.duration, 1030);
    });
    test('a file that didn\'t run (a run cut short) is SKIPPED, not passed', () => {
        const [row] = summariseReport({ suites: [file('tc_4.spec.ts', [spec('a', t('skipped')), spec('b', t('skipped'))])] }, read);
        assert.equal(row.verdict, 'SKIPPED');
        assert.match(row.errorMessage, /2 of 2 tests didn't run/);
        assert.equal(verdictFor([]).verdict, 'SKIPPED');
    });
    test('files without a TEST_CASE_ID are left out; two files with the same id make one row', () => {
        const rows = summariseReport({ suites: [
            file('other.spec.ts', [spec('x', t('expected'))]),
            file('missing.spec.ts', [spec('y', t('expected'))]),
            file('tc_9.spec.ts', [spec('a', t('expected'))]),
            { ...file('tc_9.spec.ts', [spec('b', t('unexpected'))]) }
        ] }, read);
        assert.deepEqual(rows.map(r => [r.testCaseId, r.verdict, r.tests]), [['9', 'FAIL', 2]]);
    });
});
