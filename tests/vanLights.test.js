import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createVanLights } from '../src/fx/vanLights.js';
import { closingTime } from '../src/config/closingTime.js';
import { parkingLot } from '../src/config/parkingLot.js';
import { audio } from '../src/config/audio.js';

const cfg = closingTime.vanShow;
const van = parkingLot.vehicles.find(({ id }) => id === 'abandoned');
const near = new THREE.Vector3(van.x + 3, 1.6, van.z);

function setup() {
  const scene = new THREE.Scene();
  const played = [];
  const lights = createVanLights({ scene, sound: { play: (name, opts) => played.push({ name, ...opts }) }, doc: null });
  return { scene, lights, played };
}
const lit = (lights) => lights.root.visible ? lights.root.children.filter((m) => m.visible) : [];

test('the van stays dark until the run can be won, then its hazards blink and click near you', () => {
  const { lights, played } = setup();
  for (let i = 0; i < 60; i++) lights.update(1 / 60, { ready: false, won: false, listener: near });
  assert.equal(lights.root.visible, false);
  let blinks = 0, wasOn = false;
  for (let i = 0; i < 180; i++) {
    lights.update(1 / 60, { ready: true, won: false, listener: near });
    const on = lit(lights).length > 0;
    if (on && !wasOn) blinks++;
    wasOn = on;
    assert.ok(lit(lights).every((m) => m.material.color.r > 0.5 && m.material.color.b < 0.5), 'only the amber hazards');
  }
  assert.ok(Math.abs(blinks - cfg.hazardHz * 3) <= 1, `about ${cfg.hazardHz} blinks a second (${blinks} in 3 s)`);
  assert.ok(played.length >= blinks && played.every((p) => p.name === cfg.tick.sound && p.volume > 0));
  played.length = 0;
  const far = new THREE.Vector3(van.x + cfg.tick.hearMeters + 1, 1.6, van.z);
  for (let i = 0; i < 120; i++) lights.update(1 / 60, { ready: true, won: false, listener: far });
  assert.equal(played.length, 0, 'out of earshot, no relay click');
  lights.dispose();
});

test('Start the van: the starter, then the engine, the lights, and the receipt once, after the fade', () => {
  const { lights, played } = setup();
  let receipts = 0;
  lights.update(1 / 60, { ready: true, won: false, listener: near });
  played.length = 0;
  lights.start(() => receipts++);
  assert.equal(played[0].name, cfg.starter);
  let t = 0;
  while (t < cfg.receiptSeconds - 0.05) {
    lights.update(1 / 60, { ready: false, won: true, listener: near });
    t += 1 / 60;
    if (t < cfg.catchSeconds - 0.02) assert.ok(!played.some((p) => p.name === cfg.engine), 'still cranking');
  }
  assert.ok(played.some((p) => p.name === cfg.engine), 'the engine caught');
  assert.equal(receipts, 0, 'not before the screen is black');
  assert.ok(lit(lights).length >= 6, 'headlights, beams, pool and tail lights');
  for (let i = 0; i < 30; i++) lights.update(1 / 60, { ready: false, won: true, listener: near });
  assert.equal(receipts, 1);
  assert.equal(lights.starting, false);
  // Overtime: it idles, lit, with the hazards off. A new run: dark again.
  assert.ok(lit(lights).length >= 6);
  lights.update(1 / 60, { ready: false, won: false, listener: near });
  assert.equal(lights.root.visible, false);
  lights.dispose();
});

test('the van\'s sounds exist and its lenses stand clear of the van\'s own lamp faces', () => {
  for (const name of [cfg.starter, cfg.engine, cfg.tick.sound]) assert.ok(audio.sounds[name], name);
  // The van's lamps are 4 cm deep on its faces, and the cracked cover on the third van's lamp is 7 cm proud.
  assert.ok(cfg.proud >= 0.07 + 0.02 - 1e-9, 'at least 2 cm in front of anything on the van (no z-fighting)');
});
