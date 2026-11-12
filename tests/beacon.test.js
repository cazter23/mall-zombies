// Beacons (fx/beacon.js): the light column and pulsing ring over things to go and get. Geometry is shared, materials by
// colour; the ring pulses out and fades; a power-up on the floor and a dropped Closing Time key each show one, in their
// colour, and hide it when they go; Kevin's cart shows one only while he is at it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBeacon } from '../src/fx/beacon.js';
import { createPowerUpView } from '../src/fx/powerUpView.js';
import { createClosingKeyView } from '../src/fx/closingKeyView.js';
import { look } from '../src/config/look.js';
import { closingTime } from '../src/config/closingTime.js';

const beaconsIn = (root) => { const out = []; root.traverse((o) => { if (o.name === 'beacon') out.push(o); }); return out; };

test('a beacon is a column plus a ring; beacons share geometry and same-colour column materials; the ring pulses out', () => {
  const a = createBeacon({ color: 0xff0000 });
  const b = createBeacon({ color: 0xff0000 });
  const c = createBeacon({ color: 0x00ff00, ring: false });
  assert.equal(a.root.children.length, 2);
  assert.equal(c.root.children.length, 1, 'no ring when asked');
  assert.equal(a.root.children[0].geometry, b.root.children[0].geometry);
  assert.equal(a.root.children[0].material, b.root.children[0].material);
  assert.notEqual(a.root.children[0].material, c.root.children[0].material);
  for (const mesh of a.root.children) {
    assert.equal(mesh.material.blending, THREE.AdditiveBlending);
    assert.equal(mesh.material.depthWrite, false);
  }
  const ring = a.root.children[1];
  a.update(0);
  const start = { scale: ring.scale.x, opacity: ring.material.opacity };
  a.update(look.beacons.pulseSeconds * 0.9);
  assert.ok(ring.scale.x > start.scale, 'the ring grows');
  assert.ok(ring.material.opacity < start.opacity, 'and fades');
});

test('a power-up on the floor and a dropped key show a beacon in their colour, and lose it when they go', () => {
  const scene = new THREE.Scene();
  const colliders = [];
  const view = createPowerUpView(scene, colliders);
  const shown = () => beaconsIn(view.root).filter((o) => o.visible);
  view.update(null, null, 0, []);
  assert.equal(shown().length, 0);
  const pickup = { id: 'blueLightSpecial', position: new THREE.Vector3(3, 0, 4), remaining: 20, age: 1 };
  view.update(pickup, null, 1 / 60, []);
  assert.equal(shown().length, 1);
  assert.deepEqual(shown()[0].position.toArray(), [3, 0, 4], 'standing on the floor under the prop');
  view.update(null, null, 1 / 60, []);
  assert.equal(shown().length, 0);

  const keys = createClosingKeyView(scene);
  const keyRoot = scene.getObjectByName('closingKeys');
  const id = Object.keys(closingTime.lines)[0];
  keys.drop(id, new THREE.Vector3(1, 0, 2));
  keys.update(0.5);
  assert.equal(beaconsIn(keyRoot).filter((o) => o.visible).length, 1);
  keys.remove(id);
  assert.equal(beaconsIn(keyRoot).filter((o) => o.visible).length, 0);
});
