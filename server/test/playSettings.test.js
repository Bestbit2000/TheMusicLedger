// ML-627: what a member chose to see and hear on a piece's play screen - only the four known keys are kept, and the
// recording must be one of the piece's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPlaySettings } from '../services/playSettings.js';

test('cleanPlaySettings: the four keys, nothing else', () => {
  assert.deepEqual(cleanPlaySettings({ see: true, hear: false, along: true, recordingId: 409, extra: 'x' }, [409, 410]),
    { see: true, hear: false, along: true, recordingId: 409 });
});

test('cleanPlaySettings: see and hear are on unless switched off; play along is off unless switched on', () => {
  assert.deepEqual(cleanPlaySettings({}, []), { see: true, hear: true, along: false, recordingId: null });
  assert.deepEqual(cleanPlaySettings(null, []), { see: true, hear: true, along: false, recordingId: null });
  assert.equal(cleanPlaySettings({ along: 'yes' }, []).along, false);
});

test('cleanPlaySettings: a recording that is not the piece\'s own is not kept', () => {
  assert.equal(cleanPlaySettings({ along: true, recordingId: 99 }, [409]).recordingId, null);
  assert.equal(cleanPlaySettings({ along: true, recordingId: '409' }, [409]).recordingId, 409);
  assert.equal(cleanPlaySettings({ along: true, recordingId: 'drop table' }, [409]).recordingId, null);
});
