// Metal sheen (fx/metalSheen.js): only metal materials get the reflection, each once, and nothing that has its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { metalMaterials, applyMetalSheen } from '../src/fx/metalSheen.js';
import { look } from '../src/config/look.js';

function scene() {
  const root = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const steel = new THREE.MeshStandardMaterial({ metalness: 0.68 });
  const paint = new THREE.MeshStandardMaterial({ metalness: 0 });
  const mirror = new THREE.MeshStandardMaterial({ metalness: 0.9, envMap: new THREE.Texture() });
  const basic = new THREE.MeshBasicMaterial();
  for (const m of [steel, steel, paint, mirror, basic]) root.add(new THREE.Mesh(box, m));
  root.add(new THREE.Mesh(box, [paint, steel])); // a multi-material mesh
  return { root, steel, paint, mirror };
}

test('only metal materials without a reflection of their own are picked, each once', () => {
  const { root, steel } = scene();
  assert.deepEqual(metalMaterials(root, look.metalSheen.minMetalness), [steel]);
});

test('applying hands the shared map and intensity to the metal and leaves the rest alone', () => {
  const { root, steel, paint, mirror } = scene();
  const env = new THREE.Texture();
  const ownMirror = mirror.envMap;
  assert.equal(applyMetalSheen(root, env, look.metalSheen), 1);
  assert.equal(steel.envMap, env);
  assert.equal(steel.envMapIntensity, look.metalSheen.intensity);
  assert.equal(paint.envMap, null);
  assert.equal(mirror.envMap, ownMirror);
  assert.equal(applyMetalSheen(root, env, look.metalSheen), 0, 'a second pass finds nothing left to do');
});
