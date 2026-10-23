// The light pool (fx/lightPool.js): a fixed number of real lights follows the camera round the map's lamps, fading
// instead of popping, copying each lamp's colour / intensity (so flicker keeps working), skipping lamps that are off,
// and never changing how many lights are lit except in setSize. Plus the Graphics setting and the real mall's lamps.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (stubs the browser globals the mall reads)
import { createLightPool, collectPointLights } from '../src/fx/lightPool.js';
import { settingDefs, settingPresets } from '../src/config/settings.js';

function row(count, spacing = 10) {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);
  const lamps = [];
  for (let i = 0; i < count; i++) {
    const lamp = new THREE.PointLight(0xffaa66, 20, 15, 2);
    lamp.position.set(i * spacing, 3, 0);
    group.add(lamp);
    lamps.push(lamp);
  }
  return { scene, group, lamps };
}
const lit = (scene) => { let n = 0; scene.traverse((o) => { if (o.isPointLight && o.visible) n++; }); return n; };
const run = (pool, at, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) pool.update(at, 1 / 60); };

test('a pool of N: exactly N real lights lit, on the lamps nearest the camera, with their colour and range', () => {
  const { scene, group, lamps } = row(10);
  const pool = createLightPool({ scene, sources: collectPointLights(group) });
  pool.setSize(3);
  assert.equal(lit(scene), 3, 'the lamps are hidden; three pool lights');
  run(pool, new THREE.Vector3(0, 1.7, 0), 1);
  const at = pool.slots.map((s) => s.light.position.x).sort((a, b) => a - b);
  assert.deepEqual(at, [0, 10, 20]);
  for (const s of pool.slots) {
    assert.equal(s.light.intensity, 20);
    assert.equal(s.light.distance, 15);
    assert.ok(s.light.color.equals(lamps[0].color));
  }
});

test('walking along: lights move to the new nearest lamps by fading, never popping, and the lit count never changes', () => {
  const { scene, group } = row(10);
  const pool = createLightPool({ scene, sources: collectPointLights(group), fadeSeconds: 0.25 });
  pool.setSize(3);
  run(pool, new THREE.Vector3(0, 1.7, 0), 1);
  const before = pool.slots.map((s) => s.light.intensity);
  let biggestJump = 0;
  const prev = new Map(pool.slots.map((s) => [s.light, s.light.intensity]));
  for (let t = 0; t < 2; t += 1 / 60) {
    pool.update(new THREE.Vector3(90, 1.7, 0), 1 / 60);
    for (const s of pool.slots) {
      biggestJump = Math.max(biggestJump, Math.abs(s.light.intensity - prev.get(s.light)));
      prev.set(s.light, s.light.intensity);
    }
    assert.equal(lit(scene), 3);
  }
  assert.ok(before.every((v) => v === 20));
  assert.ok(biggestJump <= 20 / 15 + 1e-6, `fades over ~0.25 s, never jumps (biggest step ${biggestJump.toFixed(2)})`);
  const at = pool.slots.map((s) => s.light.position.x).sort((a, b) => a - b);
  assert.deepEqual(at, [70, 80, 90], 'now on the lamps at the far end');
});

test('flicker and switched-off lamps: intensity follows the source; a lamp at 0 is skipped for one that is on', () => {
  const { scene, group, lamps } = row(4);
  const pool = createLightPool({ scene, sources: collectPointLights(group) });
  pool.setSize(1);
  run(pool, new THREE.Vector3(0, 1.7, 0), 1);
  lamps[0].intensity = 7; // (a flicker)
  pool.update(new THREE.Vector3(0, 1.7, 0), 1 / 60);
  assert.equal(pool.slots[0].light.intensity, 7);
  lamps[0].intensity = 0; // switched off (Settings: no flickering lights)
  run(pool, new THREE.Vector3(0, 1.7, 0), 1);
  assert.equal(pool.slots[0].light.position.x, 10, 'moved to the nearest lamp that is on');
});

test('"all" (High) puts every lamp back as a real light, exactly as built; dispose too', () => {
  const { scene, group, lamps } = row(6);
  const pool = createLightPool({ scene, sources: collectPointLights(group) });
  pool.setSize(2);
  assert.equal(lit(scene), 2);
  pool.setSize('all');
  assert.equal(lit(scene), 6);
  assert.ok(lamps.every((l) => l.visible && l.parent === group));
  pool.setSize(3);
  pool.dispose();
  assert.equal(lit(scene), 6, 'no pool lights left, lamps back');
});

test('the Lamps setting: costed, defaults to all, each preset picks a count; the real mall has more lamps than Potato lights', async () => {
  const def = settingDefs.find((d) => d.id === 'lampCount');
  assert.equal(def.tab, 'Graphics');
  assert.equal(def.cost, 'high');
  assert.equal(def.default, 'all');
  const counts = settingPresets.Graphics.map((p) => p.values.lampCount);
  assert.deepEqual(counts, [4, 6, 8, 'all']);
  let set = null;
  def.apply(6, { lightPool: { setSize: (n) => { set = n; } } });
  assert.equal(set, 6);
  assert.doesNotThrow(() => def.apply(4, {}), 'headless: no pool');

  const { buildMall } = await import('../src/maps/mall/mall.js');
  const map = buildMall(new THREE.Scene(), []);
  assert.ok(collectPointLights(map.group).length > 12, 'enough lamps that the pool matters');
  map.dispose();
});
