// The main menu's flyover (ui/titleCamera.js) and the mall's camera shots (map.titleShots): shots play in order and loop,
// the camera glides smoothly from `from` to `to`, the picture fades through black only at the cuts, and no shot in
// the REAL mall ever puts the camera inside (or brushing) a wall, a shutter or a prop.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTitleCamera } from '../src/ui/titleCamera.js';
import { feel } from '../src/config/feel.js';

const ctx = new Proxy({}, {
  get: (target, key) => (key in target ? target[key] : (target[key] = () => ctx)),
  set: (target, key, value) => { target[key] = value; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const { buildMall } = await import('../src/maps/mall/mall.js');

const shots = [
  { from: [0, 2, 0], to: [10, 2, 0], lookFrom: [0, 2, -5], lookTo: [10, 2, -5] },
  { from: [0, 3, 10], to: [0, 3, 20], lookFrom: [5, 3, 10], lookTo: [5, 3, 20] },
];

test('shots play in order, loop, and the camera glides from `from` to `to` (eased)', () => {
  const cam = createTitleCamera(shots, { shotSeconds: 10, fadeSeconds: 1 });
  const camera = new THREE.PerspectiveCamera();
  cam.apply(camera);
  assert.deepEqual(camera.position.toArray(), [0, 2, 0], 'starts at the first shot');
  cam.update(5);
  cam.apply(camera);
  assert.ok(Math.abs(camera.position.x - 5) < 1e-9, 'halfway at half time');
  cam.update(2);
  cam.apply(camera);
  assert.ok(camera.position.x > 7 && camera.position.x < 10, 'eased: slower toward the end');
  cam.update(3);
  assert.equal(cam.shotIndex, 1, 'then the next shot');
  cam.update(25);
  assert.equal(cam.shotIndex, 1, 'loops: 0 -> 1 -> 0 -> 1');
  cam.restart();
  assert.equal(cam.shotIndex, 0);
  assert.equal(cam.shotTime, 0);
});

test('the camera looks where the shot says, and the fade is black only around the cuts', () => {
  const cam = createTitleCamera(shots, { shotSeconds: 10, fadeSeconds: 1 });
  const camera = new THREE.PerspectiveCamera();
  assert.equal(cam.apply(camera), 1, 'fully black at the very start of a shot');
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  assert.ok(dir.z < -0.99, 'looking at lookFrom (straight down -Z here)');
  cam.update(0.5);
  assert.ok(Math.abs(cam.apply(camera) - 0.5) < 1e-9, 'fading in');
  cam.update(4.5);
  assert.equal(cam.apply(camera), 0, 'clear mid-shot');
  cam.update(4.75);
  assert.ok(cam.apply(camera) > 0.7, 'fading out before the cut');
});

test('a map without shots is an error (the title would have nothing to show)', () => {
  assert.throws(() => createTitleCamera([], {}), /titleShots/);
});

test('the real mall: every title shot keeps the camera in open space, clear of every collider, all the way along', () => {
  const colliders = [];
  const map = buildMall(new THREE.Scene(), colliders);
  assert.ok(map.titleShots.length >= 4, 'a few shots');
  const p = new THREE.Vector3();
  const clearance = 0.3;
  const cam = createTitleCamera(map.titleShots, feel.titleScreen);
  const camera = new THREE.PerspectiveCamera();
  const step = 0.25;
  for (let t = 0; t < map.titleShots.length * feel.titleScreen.shotSeconds; t += step) {
    cam.apply(camera);
    p.copy(camera.position);
    const hit = colliders.find((box) => box.distanceToPoint(p) < clearance);
    assert.equal(hit, undefined, `shot ${cam.shotIndex} at ${cam.shotTime.toFixed(2)}s: camera ${p.toArray().map((v) => v.toFixed(2))} brushes a collider`);
    cam.update(step);
  }
  map.dispose();
});
