// Settings > Video > Visual effects (High / Low / Off) and "Dust and flickering lights": the post-processing pipeline's
// three quality levels (fx/postProcessing.js, on a stand-in renderer: no GPU in Node), the settings and the Video presets
// that drive them, and the ambient-extras switch in the real mall (dust motes hidden, flicker / emergency lights dimmed).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { settingDefs, settingPresets } from '../src/config/settings.js';
import { atmosphere } from '../src/config/environment.js';
import { createSettings } from '../src/game/settings.js';

globalThis.window.innerWidth = 800;
globalThis.window.innerHeight = 600;
const { createPostProcessing } = await import('../src/fx/postProcessing.js');

// A renderer that records what it was asked to draw.
function fakeRenderer() {
  const calls = [];
  return {
    calls,
    getPixelRatio: () => 1,
    setPixelRatio() {},
    getSize: (v) => v.set(800, 600),
    getDrawingBufferSize: (v) => v.set(800, 600),
    getRenderTarget: () => null,
    getClearColor: (c) => c.set(0),
    getClearAlpha: () => 0,
    setRenderTarget: (t) => calls.push(['setRenderTarget', t === null ? 'screen' : 'target']),
    clear: () => calls.push(['clear']),
    clearDepth: () => calls.push(['clearDepth']),
    render: (scene) => calls.push(['render', scene.name]),
    autoClear: false,
    toneMapping: 0,
    toneMappingExposure: 1,
    info: { autoReset: true, reset() {} },
  };
}
function pipeline() {
  const renderer = fakeRenderer();
  const scene = Object.assign(new THREE.Scene(), { name: 'world' });
  const viewmodel = { scene: Object.assign(new THREE.Scene(), { name: 'gun' }), camera: new THREE.PerspectiveCamera() };
  const post = createPostProcessing({ renderer, scene, camera: new THREE.PerspectiveCamera(), viewmodel });
  return { post, renderer };
}

test('post-processing starts on High and switches between High, Low and Off by flags (nothing is rebuilt)', () => {
  const { post } = pipeline();
  assert.equal(post.quality, 'high');
  assert.equal(post.bloomPass.enabled, true);
  assert.equal(post.lensPass.enabled, true);
  const high = post.composer.renderTarget1.samples;
  assert.ok(high >= 1, 'MSAA on High');
  const passes = [...post.composer.passes];

  post.setQuality('low');
  assert.equal(post.quality, 'low');
  assert.equal(post.bloomPass.enabled, false);
  assert.equal(post.lensPass.enabled, false);
  assert.equal(post.composer.renderTarget1.samples, 0);
  assert.equal(post.composer.renderTarget2.samples, 0);

  post.setQuality('off');
  assert.equal(post.quality, 'off');

  post.setQuality('high');
  assert.equal(post.bloomPass.enabled && post.lensPass.enabled, true, 'back to the full look');
  assert.equal(post.composer.renderTarget1.samples, high);
  assert.equal(post.composer.renderTarget2.samples, high);
  assert.deepEqual(post.composer.passes, passes, 'the same pass objects: nothing was rebuilt');
  assert.throws(() => post.setQuality('ultra'), /unknown quality/);
});

test('Off draws the world, then the gun with depth cleared, straight to the screen and never touches the composer', () => {
  const { post, renderer } = pipeline();
  let composed = 0;
  post.composer.render = () => { composed += 1; };
  post.setQuality('off');
  post.render({ showViewmodel: true });
  assert.deepEqual(renderer.calls, [
    ['setRenderTarget', 'screen'], ['clear'], ['render', 'world'], ['clearDepth'], ['render', 'gun'],
  ]);
  assert.equal(composed, 0);
  renderer.calls.length = 0;
  post.render({ showViewmodel: false }); // dead / the title screen: no gun
  assert.deepEqual(renderer.calls, [['setRenderTarget', 'screen'], ['clear'], ['render', 'world']]);

  post.setQuality('low');
  post.render({ showViewmodel: true });
  post.setQuality('high');
  post.render({ showViewmodel: true });
  assert.equal(composed, 2, 'Low and High go through the composer');
});

test('the settings: Visual effects defaults to High and drives the pipeline; presets set it with the resolution', () => {
  const def = settingDefs.find((d) => d.id === 'visualEffects');
  assert.equal(def.default, 'high');
  assert.deepEqual(def.options.map((o) => o.value), ['high', 'low', 'off']);
  const seen = [];
  for (const v of ['off', 'low', 'high']) def.apply(v, { postProcessing: { setQuality: (q) => seen.push(q) } });
  assert.deepEqual(seen, ['off', 'low', 'high']);
  assert.doesNotThrow(() => def.apply('low', {}), 'headless / tests have no pipeline');

  const [low, medium, high] = settingPresets.Video;
  assert.deepEqual([low, medium, high].map((p) => p.values.visualEffects), ['off', 'low', 'high']);
  assert.deepEqual([low, medium, high].map((p) => p.values.ambientEffects), [false, true, true]);
  const ambient = settingDefs.find((d) => d.id === 'ambientEffects');
  assert.equal(ambient.default, true);
  assert.equal(atmosphere.ambient.enabled, true, 'the shipped game has the dust and lights on');
});

test('saving: the effects settings are stored and come back, and a bad saved value falls back to the default', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const qualities = [];
  const ctx = {
    renderer: { setPixelRatio() {} }, sound: { setMasterVolume() {} }, hud: { setFpsVisible() {} },
    postProcessing: { setQuality: (q) => qualities.push(q) },
  };
  try {
    const settings = createSettings(ctx);
    settings.set('visualEffects', 'low');
    settings.set('ambientEffects', false);
    assert.equal(qualities.at(-1), 'low');
    assert.equal(atmosphere.ambient.enabled, false);
    qualities.length = 0;
    const again = createSettings(ctx); // a page reload
    assert.equal(again.get('visualEffects'), 'low');
    assert.equal(again.get('ambientEffects'), false);
    assert.equal(qualities.at(-1), 'low', 'applied at startup');
    store.set('mallZombies.settings', JSON.stringify({ visualEffects: 'ultra', ambientEffects: 'yes' }));
    const bad = createSettings(ctx);
    assert.equal(bad.get('visualEffects'), 'high');
    assert.equal(bad.get('ambientEffects'), true);
  } finally {
    atmosphere.ambient.enabled = true;
    delete globalThis.localStorage;
  }
});

test('the real mall: switching the ambient extras off hides the dust and zeroes the flicker / emergency lights; on brings them back', () => {
  const t = headlessGame();
  const group = t.g.map.group;
  const dust = group.getObjectByName('mall_dust_motes');
  const flickerColors = [atmosphere.flicker.hallwayLightColor, atmosphere.flicker.emergencyLightColor];
  const pointLights = () => { const out = []; group.traverse((o) => { if (o.isPointLight) out.push(o); }); return out; };
  const flickering = pointLights().filter((l) => flickerColors.includes(l.color.getHex()));
  assert.ok(dust, 'the dust motes exist');
  assert.ok(flickering.length >= 3, 'the hallway flicker light and two emergency lights exist');
  const lightCount = pointLights().length;
  const firstDust = () => Array.from(dust.geometry.attributes.position.array.slice(0, 6)).join();

  t.tick(30);
  assert.equal(dust.visible, true);
  assert.ok(flickering.every((l) => l.intensity > 0));
  const dustThen = firstDust();

  try {
    atmosphere.ambient.enabled = false;
    t.tick(30);
    assert.equal(dust.visible, false, 'dust hidden');
    assert.ok(flickering.every((l) => l.intensity === 0), 'lights dimmed to zero');
    assert.equal(pointLights().length, lightCount, 'the lights stay in the scene (switching never recompiles shaders)');
    const frozen = firstDust();
    t.tick(30);
    assert.equal(firstDust(), frozen, 'and the dust is not animated while off');
  } finally {
    atmosphere.ambient.enabled = true;
  }
  t.tick(30);
  assert.equal(dust.visible, true, 'back on');
  assert.ok(flickering.every((l) => l.intensity > 0), 'lights back');
  assert.notEqual(firstDust(), dustThen, 'and the dust drifts again');
});
