// ML-610: Instrument support's rules that don't need the database - how far, the drive time, postcodes, and what a
// business may be saved with. docs/instrument-support.md.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL ||= 'postgres://test@localhost/test'; // the service loads the pool; nothing here uses it
const { milesBetween, driveMinutes, cleanPostcode, cleanBusiness, LOOKING_FOR, OFFERS, MAX_MINUTES } = await import('../services/instrumentSupport.js');

const WOKING = { lat: 51.3190, lng: -0.5580 };
const GUILDFORD = { lat: 51.2362, lng: -0.5704 };
const SE1 = { lat: 51.5010, lng: -0.0940 };

describe('distance and drive time', () => {
  test('miles between two towns, as the crow flies', () => {
    const m = milesBetween(WOKING, GUILDFORD);
    assert.ok(m > 5.2 && m < 6.2, `Woking to Guildford is about 5.7 miles, got ${m}`);
    assert.equal(milesBetween(WOKING, WOKING), 0);
  });
  test('a drive time is rounded to 5 minutes and never under 5', () => {
    assert.equal(driveMinutes(0), 5);
    assert.equal(driveMinutes(milesBetween(WOKING, GUILDFORD)) % 5, 0);
    assert.ok(driveMinutes(milesBetween(WOKING, GUILDFORD)) <= 15);
  });
  test('central London takes longer: SE1 is not within 45 minutes of Woking', () => {
    const miles = milesBetween(WOKING, SE1);
    assert.ok(driveMinutes(miles) <= MAX_MINUTES, 'without the London allowance it would look near');
    assert.ok(driveMinutes(miles, SE1) > MAX_MINUTES, `with it, ${driveMinutes(miles, SE1)} minutes`);
  });
});

describe('postcodes', () => {
  test('tidied to the usual form', () => {
    assert.equal(cleanPostcode('gu21 6xr'), 'GU21 6XR');
    assert.equal(cleanPostcode('KT81RB'), 'KT8 1RB');
  });
  test('rubbish is refused', () => {
    assert.equal(cleanPostcode('not a postcode'), null);
    assert.equal(cleanPostcode(''), null);
  });
});

describe('what a business is saved with', () => {
  const ok = { name: 'A Repairer', offers: ['repairs-brass'], link: 'https://example.com', source: 'website' };
  test('a plain business', () => {
    const b = cleanBusiness(ok);
    assert.equal(b.name, 'A Repairer');
    assert.equal(b.linkKind, 'website');
    assert.equal(b.ukWide, false);
  });
  test('a Facebook page is its link', () => {
    assert.equal(cleanBusiness({ ...ok, link: 'https://www.facebook.com/profile.php?id=1' }).linkKind, 'facebook');
  });
  test('needs a name and something it offers, from the list', () => {
    assert.throws(() => cleanBusiness({ ...ok, name: ' ' }), /name/);
    assert.throws(() => cleanBusiness({ ...ok, offers: [] }), /offers/);
    assert.throws(() => cleanBusiness({ ...ok, offers: ['insurance'] }), /offers/);
  });
  test('a link is a web address (https, or http for a site that has no https - ML-613), and one checked on its website must have one', () => {
    assert.equal(cleanBusiness({ ...ok, link: 'http://example.com' }).link, 'http://example.com');
    assert.throws(() => cleanBusiness({ ...ok, link: 'javascript:alert(1)' }), /web address/);
    assert.throws(() => cleanBusiness({ ...ok, link: 'ftp://example.com' }), /web address/);
    assert.throws(() => cleanBusiness({ ...ok, link: 'example.com' }), /web address/);
    assert.throws(() => cleanBusiness({ ...ok, link: '' }), /website/);
    assert.equal(cleanBusiness({ ...ok, link: '', source: 'owner' }).link, null);
  });
  test('email and postcode are checked', () => {
    assert.throws(() => cleanBusiness({ ...ok, email: 'nope' }), /email/);
    assert.throws(() => cleanBusiness({ ...ok, postcode: 'nope' }), /postcode/);
    assert.equal(cleanBusiness({ ...ok, postcode: 'gu21 6xr' }).postcode, 'GU21 6XR');
  });
});

describe('looking for', () => {
  test('every choice is made of real offers, and Everything is all of them', () => {
    for (const [key, offers] of Object.entries(LOOKING_FOR)) {
      assert.ok(offers.length && offers.every(o => OFFERS.includes(o)), key);
    }
    assert.deepEqual(LOOKING_FOR.all, OFFERS);
  });
  test('no insurers or teachers (owner, 24 Oct 2026)', () => {
    assert.ok(!OFFERS.some(o => /insur|teach|lesson/.test(o)));
  });
});
