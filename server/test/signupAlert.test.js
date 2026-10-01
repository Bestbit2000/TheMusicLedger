// ML-392: the new sign-up email - what it says about the device, and the email itself.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDevice, signupAlertEmail, sendSignupAlert } from '../services/signupAlert.js';

describe('describeDevice', () => {
    test('phones, tablets and computers', () => {
        assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'), 'iPhone · iOS 17.4 · Safari');
        assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'), 'iPhone · iOS 18.0 · Chrome');
        assert.equal(describeDevice('Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'), 'iPad · iPadOS 16.6 · Safari');
        assert.equal(describeDevice('Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36'), 'Android phone (SM-S911B) · Android 13 · Samsung Internet');
        assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0'), 'Windows PC · Edge');
        assert.equal(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'), 'Mac (or an iPad) · Safari');
        assert.equal(describeDevice(''), 'Unknown device');
    });
    test("Chrome on Android hides the model ('K') - the Sec-CH-UA-Model hint fills it in", () => {
        const ua = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
        assert.equal(describeDevice(ua), 'Android phone · Android 10 · Chrome');
        assert.equal(describeDevice(ua, '"Pixel 8"'), 'Android phone (Pixel 8) · Android 10 · Chrome');
        assert.equal(describeDevice(ua.replace(' Mobile', '')), 'Android tablet · Android 10 · Chrome');
    });
});

describe('the email', () => {
    test('name, email, when (UK time), how and the device', () => {
        const { subject, text } = signupAlertEmail({ firstName: 'Sam', surname: 'Lee', email: 'sam@example.com', method: 'Google', device: 'iPhone · iOS 17.4 · Safari', at: new Date('2026-10-01T13:05:00Z') });
        assert.equal(subject, 'New sign-up: Sam Lee');
        assert.match(text, /Name: Sam Lee\nEmail: sam@example\.com\nSigned up: Thursday, 1 October 2026 at 14:05\nHow: Google\nDevice: iPhone · iOS 17\.4 · Safari/);
        assert.equal(signupAlertEmail({ email: 'x@example.com', method: 'Google', device: '?' }).subject, 'New sign-up: (no name given)');
    });
    test('nothing is sent while SIGNUP_ALERT_EMAIL is unset', async () => {
        const before = process.env.SIGNUP_ALERT_EMAIL;
        delete process.env.SIGNUP_ALERT_EMAIL;
        try { assert.equal(await sendSignupAlert({ email: 'x@example.com', method: 'Google' }), false); }
        finally { if (before !== undefined) process.env.SIGNUP_ALERT_EMAIL = before; }
    });
});
