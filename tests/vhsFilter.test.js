// The VHS filter (Graphics > VHS filter, fx/postProcessing.js VhsShader): off by default, a style choice no Graphics preset
// changes, and when on its pass runs, even with Visual effects Off (that frame goes through the composer like Low).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { settingDefs, settingPresets } from '../src/config/settings.js';
import { look } from '../src/config/look.js';

globalThis.window.innerWidth = 800;
globalThis.window.innerHeight = 600;
const { createPostProcessing, vhsStrength } = await import('../src/fx/postProcessing.js');

function pipeline() {
  const calls = [];
  const renderer = {
    getPixelRatio: () => 1, setPixelRatio() {}, getSize: (v) => v.set(800, 600), getDrawingBufferSize: (v) => v.set(800, 600),
    getRenderTarget: () => null, getClearColor: (c) => c.set(0), getClearAlpha: () => 0,
    setRenderTarget() {}, clear() {}, clearDepth() {}, render: (scene) => calls.push(scene.name),
    autoClear: false, toneMapping: 0, toneMappingExposure: 1, info: { autoReset: true, reset() {} },
  };
  const scene = Object.assign(new THREE.Scene(), { name: 'world' });
  const viewmodel = { scene: Object.assign(new THREE.Scene(), { name: 'gun' }), camera: new THREE.PerspectiveCamera() };
  const post = createPostProcessing({ renderer, scene, camera: new THREE.PerspectiveCamera(), viewmodel });
  let composed = 0;
  post.composer.render = () => { composed += 1; };
  return { post, calls, composed: () => composed };
}

test('the setting: off by default, three strengths, no cost tag and no Graphics preset touches it', () => {
  const def = settingDefs.find((d) => d.id === 'vhsFilter');
  assert.equal(def.tab, 'Graphics');
  assert.equal(def.default, 'off');
  assert.equal(def.cost, undefined);
  assert.deepEqual(def.options.map((o) => o.value), ['off', 'subtle', 'full']);
  for (const preset of settingPresets.Graphics) assert.ok(!('vhsFilter' in preset.values), `${preset.label} leaves it alone`);
  def.apply('subtle');
  assert.equal(look.runtime.vhs, 'subtle');
  assert.equal(vhsStrength(), 0.5);
  def.apply('off');
  assert.equal(vhsStrength(), 0);
});

test('the VHS pass runs only when the filter is on, and turns Visual effects Off into a composed frame', () => {
  const { post, calls, composed } = pipeline();
  post.render({ showViewmodel: true });
  assert.equal(post.vhsPass.enabled, false, 'off by default');
  look.runtime.vhs = 'full';
  post.render({ showViewmodel: true });
  assert.equal(post.vhsPass.enabled, true);
  assert.equal(post.vhsPass.uniforms.strength.value, 1);
  assert.equal(post.vhsPass.uniforms.scanlines.value, look.vhs.scanlines);

  post.setQuality('off');
  const before = composed();
  post.render({ showViewmodel: true });
  assert.equal(composed(), before + 1, 'Off + VHS goes through the composer');
  assert.equal(post.bloomPass.enabled || post.lensPass.enabled, false, 'still no bloom or lens (as Low)');
  look.runtime.vhs = 'off';
  post.render({ showViewmodel: true });
  assert.equal(composed(), before + 1, 'Off without VHS draws straight to the screen again');
  assert.deepEqual(calls.slice(-2), ['world', 'gun']);
});
