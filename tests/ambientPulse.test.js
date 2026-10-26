import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAmbientPulse } from '../src/audio/ambientPulse.js';
import { atmosphere } from '../src/config/environment.js';

test('the projector relay is a quiet, bounded tick with silence between clicks and no random draws', context => {
  context.mock.method(Math, 'random', () => { throw Error('no random draws for ambience'); });
  const rate = 1000, def = atmosphere.ambience.voices.projectorRelay;
  const ctx = { sampleRate: rate, createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; } };
  const buffer = makeAmbientPulse(ctx, { getChannelData: () => new Float32Array([1, -.8, .5, -.3]) }, def);
  const samples = buffer.getChannelData(0), end = Math.ceil(rate * def.clickSeconds);
  assert.equal(samples.length, Math.ceil(rate * def.clickEverySeconds));
  assert.ok(samples.slice(0, end).some(x => Math.abs(x) > .01));
  assert.ok(samples.slice(end).every(x => x === 0), 'silence for the rest of the seven-second loop');
  assert.ok(Math.abs(samples[0]) < 1e-6 && Math.abs(samples[end - 1]) < 1e-6, 'no discontinuous edges');
  assert.ok(samples.every(Number.isFinite)); assert.ok(def.gain < atmosphere.ambience.voices.projector.gain);
});
