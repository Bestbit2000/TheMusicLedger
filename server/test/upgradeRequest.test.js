// ML-396: the "Upgrade now" email to the owner - what it says, and who it goes to.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { upgradeRequestEmail, upgradeRequestRecipient, UPGRADE_FEATURES } from '../services/upgradeRequest.js';

describe('upgrade request', () => {
    test('the email: who asked, for what, when (UK time), and what to do', () => {
        const { subject, text } = upgradeRequestEmail({ firstName: 'Sam', surname: 'Lee', email: 'sam@example.com', accountLevel: 'standard_member', featureName: 'SmartLearn', at: new Date('2026-10-02T13:05:00Z') });
        assert.equal(subject, 'Upgrade request: Sam Lee - SmartLearn');
        assert.match(text, /Name: Sam Lee\nEmail: sam@example\.com\nAccount type: standard_member\nAsked for: SmartLearn\nWhen: Friday, 2 October 2026 at 14:05/);
        assert.match(text, /Admin -> Feature access/);
        assert.equal(upgradeRequestEmail({ email: 'x@example.com', featureName: 'F' }).subject, 'Upgrade request: (no name given) - F');
    });
    test('goes to UPGRADE_REQUEST_EMAIL, else the sign-up alert address; real mail with neither has nowhere to go', () => {
        const keep = { u: process.env.UPGRADE_REQUEST_EMAIL, s: process.env.SIGNUP_ALERT_EMAIL, m: process.env.MAIL_PROVIDER };
        try {
            process.env.SIGNUP_ALERT_EMAIL = 'owner@example.com';
            delete process.env.UPGRADE_REQUEST_EMAIL;
            assert.equal(upgradeRequestRecipient(), 'owner@example.com');
            process.env.UPGRADE_REQUEST_EMAIL = 'sales@example.com';
            assert.equal(upgradeRequestRecipient(), 'sales@example.com');
            delete process.env.UPGRADE_REQUEST_EMAIL;
            delete process.env.SIGNUP_ALERT_EMAIL;
            process.env.MAIL_PROVIDER = 'smtp';
            assert.equal(upgradeRequestRecipient(), null);
            process.env.MAIL_PROVIDER = 'log';
            assert.equal(upgradeRequestRecipient(), 'owner@themusicledger.local'); // dev: the outbox
        } finally {
            for (const [k, v] of [['UPGRADE_REQUEST_EMAIL', keep.u], ['SIGNUP_ALERT_EMAIL', keep.s], ['MAIL_PROVIDER', keep.m]]) {
                if (v === undefined) delete process.env[k]; else process.env[k] = v;
            }
        }
    });
    test('only listed features can be asked for', () => {
        assert.deepEqual(Object.keys(UPGRADE_FEATURES), ['theory_smart_learn']);
    });
});
