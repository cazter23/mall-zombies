// First-launch auto graphics (game/autoGraphics.js): picks the best preset this computer's frame rate reaches, measures
// only visible, hitch-free frames after a warm-up, decides once, and never runs when settings were saved before.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/headlessGame.js'; // (stubs the browser globals settings.js reads)
import { createAutoGraphics, pickGraphicsPreset } from '../src/game/autoGraphics.js';
import { autoGraphics, settingPresets } from '../src/config/settings.js';
import { hasSavedSettings } from '../src/game/settings.js';

const feed = (auto, fps, seconds, extra = {}) => {
  for (let t = 0; t < seconds && !auto.done; t += 1 / fps) auto.frame(extra.frame ?? 1 / fps);
};

test('the tiers: fast = High, middling = Medium / Low, slow = Potato; every tier is a real preset', () => {
  assert.equal(pickGraphicsPreset(144), 'High');
  assert.equal(pickGraphicsPreset(60), 'High');
  assert.equal(pickGraphicsPreset(42), 'Medium');
  assert.equal(pickGraphicsPreset(30), 'Low');
  assert.equal(pickGraphicsPreset(12), 'Potato');
  for (const tier of autoGraphics.tiers) assert.ok(settingPresets.Graphics.some((p) => p.label === tier.label), tier.label);
});

test('first launch: measures a few seconds of frames, then chooses once', () => {
  const picked = [];
  const auto = createAutoGraphics({ firstLaunch: true, choose: (l) => picked.push(l) });
  feed(auto, 20, 10);
  assert.deepEqual(picked, ['Potato']);
  assert.equal(auto.chosen, 'Potato');
  auto.frame(1 / 144);
  assert.equal(picked.length, 1, 'decided once');

  const fast = [];
  const quick = createAutoGraphics({ firstLaunch: true, choose: (l) => fast.push(l) });
  feed(quick, 60, 10);
  assert.deepEqual(fast, ['High']);
});

test('a hidden / background window and hitches are not measured; a later launch never auto-picks', () => {
  const picked = [];
  let visible = false;
  const auto = createAutoGraphics({ firstLaunch: true, visible: () => visible, choose: (l) => picked.push(l) });
  feed(auto, 2, 60); // a throttled background pane: one frame every half second
  assert.equal(auto.done, false, 'nothing measured while hidden');
  visible = true;
  for (let i = 0; i < 50; i++) auto.frame(1); // tab-switch hitches
  assert.equal(auto.done, false);
  feed(auto, 60, 10);
  assert.deepEqual(picked, ['High']);

  const never = createAutoGraphics({ firstLaunch: false, choose: () => assert.fail('must not choose') });
  feed(never, 10, 10);
  assert.equal(never.done, true);
});

test('hasSavedSettings: false with nothing stored, true once settings are saved, true if storage is blocked', () => {
  const saved = globalThis.localStorage;
  try {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    assert.equal(hasSavedSettings(), false);
    store.set('mallZombies.settings', '{}');
    assert.equal(hasSavedSettings(), true);
    globalThis.localStorage = { getItem: () => { throw new Error('blocked'); } };
    assert.equal(hasSavedSettings(), true);
  } finally { globalThis.localStorage = saved; }
});
