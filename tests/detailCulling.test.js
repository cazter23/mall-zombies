// Small detail distance (fx/detailCulling.js, Graphics > Small detail): only small textured printed meshes are managed
// (not big signs, neon, glow, untextured props or anything under a dynamic parent); far ones hide on 'near' / 'close' and
// come back on 'all'; it never re-shows something another system hid. Potato and Low use it, Medium and High don't.
// Also: sign canvases are sized by the sign (world/mapKit.js signPixels), drawn on the same 1024-wide page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (first: it stubs the browser globals settings.js reads)
import { createDetailCulling, isSmallDetail } from '../src/fx/detailCulling.js';
import { signPixels } from '../src/world/mapKit.js';
import { look } from '../src/config/look.js';
import { settingPresets } from '../src/config/settings.js';

const map = new THREE.Texture();
function plane(name, w, h, x, z, material = new THREE.MeshBasicMaterial({ map })) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.name = name;
  m.position.set(x, 1.5, z);
  return m;
}

test('only small printed things are managed', () => {
  const root = new THREE.Group();
  const small = plane('poster', 1, 0.6, 0, 0);
  const big = plane('banner', 6, 1, 0, 0);
  const neon = plane('neon-lit', 1, 0.3, 0, 0);
  const glow = plane('pool', 1, 1, 0, 0, new THREE.MeshBasicMaterial({ map, blending: THREE.AdditiveBlending }));
  const plain = plane('box', 1, 1, 0, 0, new THREE.MeshStandardMaterial());
  const rig = new THREE.Group();
  rig.userData.dynamic = true;
  const moving = plane('label', 0.5, 0.2, 0, 0);
  rig.add(moving);
  root.add(small, big, neon, glow, plain, rig);
  root.updateMatrixWorld(true);
  assert.equal(isSmallDetail(small), true);
  for (const m of [big, neon, glow, plain, moving]) assert.equal(isSmallDetail(m), false, m.name);
  assert.equal(createDetailCulling(root).count, 1);
});

test("far details hide on 'close' and 'near', come back on 'all'; someone else's hidden mesh stays hidden", () => {
  const saved = look.runtime.detailDistance;
  try {
    const root = new THREE.Group();
    const near = plane('near', 1, 0.5, 5, 0);
    const mid = plane('mid', 1, 0.5, 18, 0);
    const far = plane('far', 1, 0.5, 40, 0);
    root.add(near, mid, far);
    const culling = createDetailCulling(root);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    camera.updateMatrixWorld();
    look.runtime.detailDistance = 'close';
    culling.update(camera);
    assert.deepEqual([near.visible, mid.visible, far.visible], [true, false, false]);
    look.runtime.detailDistance = 'near';
    culling.update(camera);
    assert.deepEqual([near.visible, mid.visible, far.visible], [true, true, false]);
    look.runtime.detailDistance = 'all';
    culling.update(camera);
    assert.deepEqual([near.visible, mid.visible, far.visible], [true, true, true]);
    near.visible = false; // (another system hides it)
    look.runtime.detailDistance = 'close';
    culling.update(camera);
    look.runtime.detailDistance = 'all';
    culling.update(camera);
    assert.equal(near.visible, false, 'never re-shown by the culling');
  } finally { look.runtime.detailDistance = saved; }
});

test('Potato and Low cull small detail, Medium and High draw it everywhere; signs get canvases sized by metres', () => {
  const of = (label) => settingPresets.Graphics.find((p) => p.label === label).values.detailDistance;
  assert.equal(of('Potato'), 'close');
  assert.equal(of('Low'), 'near');
  assert.equal(of('Medium'), 'all');
  assert.equal(of('High'), 'all');
  const { min, max } = look.signTexture;
  assert.equal(signPixels(0.1), min);
  assert.equal(signPixels(20), max);
  assert.ok(signPixels(1) > min && signPixels(1) < max);
  assert.ok(signPixels(1.5) > signPixels(1), 'a wider sign gets more pixels');
});
