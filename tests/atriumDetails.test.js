import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createMapKit } from '../src/world/mapKit.js';
import { buildAtriumDetails } from '../src/maps/mall/atriumDetails.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { atriumDetails } from '../src/config/atrium.js';
import { atmosphere } from '../src/config/environment.js';
import { batchStatic } from '../src/world/staticBatch.js';

const U = LAYOUT.hallway.height + .3, AT = LAYOUT.atrium, A = AT.rect;
const bounds = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
function make() {
  const kit = createMapKit(new THREE.Group(), []);
  return { kit, ...buildAtriumDetails(kit, AT, U) };
}

test('authored atrium triangles leave the fountain lap, entrances, vents, ring and escalator clear; no collision or lights', () => {
  const d = make();
  const spaces = [];
  const lap = [[14.6, 15], [20, 15], [25.4, 15], [25.4, 18.6], [25.4, 22.4], [20, 22.4], [14.6, 22.4], [14.6, 18.6]];
  lap.forEach(([x, z], i) => {
    const [nx, nz] = lap[(i + 1) % lap.length];
    spaces.push(bounds([Math.min(x, nx) - .4, .05, Math.min(z, nz) - .4], [Math.max(x, nx) + .4, 2.3, Math.max(z, nz) + .4]));
  });
  for (const door of [AT.gate, AT.martLink]) spaces.push(bounds([door.from + .1, .05, A.minZ - .1], [door.to - .1, 2.7, A.minZ + 2.9]));
  spaces.push(bounds([AT.link.from + .1, U + .05, A.minZ - .1], [AT.link.to - .1, U + 2.5, A.minZ + 2.9]));
  for (const v of AT.vents) {
    const x = v.wall === 'west' ? A.minX + .8 : v.wall === 'east' ? A.maxX - .8 : v.at;
    const z = v.wall === 'north' ? A.maxZ - .8 : v.wall === 'south' ? A.minZ + .8 : v.at;
    const y = v.upper ? U : 0;
    spaces.push(bounds([x - .45, y + .05, z - .45], [x + .45, y + 2.3, z + .45]));
  }
  // The outer ring's walking lanes, including the full approach to the Promenade.
  for (const z of [A.minZ + 1.5, A.maxZ - 1.5]) spaces.push(bounds([A.minX + .9, U + .05, z - .4], [A.maxX - .9, U + 2.3, z + .4]));
  for (const x of [A.minX + 1.5, A.maxX - 1.5]) spaces.push(bounds([x - .4, U + .05, A.minZ + .9], [x + .4, U + 2.3, A.maxZ - .9]));
  const E = AT.escalator;
  const slopeStart = E.bottomX + 1.4, slopeEnd = slopeStart + (U - .12) / Math.tan(Math.PI / 6);
  for (let x = E.bottomX - 1; x < slopeEnd + 1.4; x += .4) {
    const y = Math.max(0, Math.min(U, .12 + (x - slopeStart) * Math.tan(Math.PI / 6)));
    spaces.push(bounds([x - .2, y + .05, E.minZ + .15], [x + .2, y + 2.3, E.maxZ - .15]));
  }
  d.root.updateMatrixWorld(true);
  const triangle = new THREE.Triangle();
  let meshes = 0;
  d.root.traverse(m => {
    assert.ok(!m.isLight, 'uses existing room lights');
    if (!m.isMesh) return;
    meshes++;
    const p = m.geometry.attributes.position, index = m.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      [triangle.a, triangle.b, triangle.c].forEach((v, j) => {
        v.fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        assert.ok(v.toArray().every(Number.isFinite), `${m.name}: finite geometry`);
      });
      for (const space of spaces) assert.ok(!space.intersectsTriangle(triangle), `${m.name} obscures a protected route near ${triangle.a.toArray()}`);
    }
  });
  assert.ok(meshes > 100, 'checks actual authored geometry');
  assert.equal(d.kit.colliders.length, 0);
  d.kit.dispose();
});

test('both floors have varied display windows, kiosk stock and authored scenes; resources dispose and static pieces batch', t => {
  const d = make(), names = new Set(), geometries = new Set(), materials = new Set(), textures = new Set();
  let triangles = 0;
  d.root.traverse(m => {
    names.add(m.name);
    if (!m.isMesh) return;
    geometries.add(m.geometry); materials.add(m.material);
    if (m.material.map) textures.add(m.material.map);
    triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
  });
  for (const name of ['mannequin_head', 'perfume_bottle', 'suitcase', 'television_screen', 'same_employee_head',
    'covered_window', 'chunky_display_phone', 'sunglass_lens', 'fountain_dedication', 'submerged_coin',
    'atrium_floor_mosaic', 'hanging_opening_banner', 'mobile_sun', 'celebration_pennant', 'arcade_bracket',
    'employee_schedule', 'directory_floorplan', 'stranded_balloon', 'bench_drink', 'cleaning_bucket']) assert.ok(names.has(name), name);
  assert.equal(d.root.children.filter(g => g.name.startsWith('display_')).length, atriumDetails.storefronts.length);
  assert.ok(triangles < 18000, `${triangles} triangles stays modest`);
  const destroyed = new Set();
  for (const resource of [...geometries, ...materials, ...textures]) resource.addEventListener('dispose', () => destroyed.add(resource));
  d.kit.dispose();
  for (const resource of [...geometries, ...materials, ...textures]) assert.ok(destroyed.has(resource), `${resource.type}: disposed`);
  const b = make();
  const batch = batchStatic(b.root);
  let draws = 0; b.root.traverse(m => { if (m.isMesh) draws++; });
  assert.ok(batch.merged > 100);
  assert.ok(draws < 100, `${draws} meshes after batching`);
  t.diagnostic(`${triangles} triangles, ${draws} meshes after static batching`);
  b.kit.dispose();
});

test('fountain ripples and the suspended mobile reset, respect ambience off and survive static batching', () => {
  const d = make(), enabled = atmosphere.ambient.enabled;
  try {
    const mobile = d.root.getObjectByName('sunset_mobile'), ripples = [];
    d.root.traverse(m => { if (m.name === 'water_highlight') ripples.push(m); });
    assert.equal(new Set(ripples.map(m => m.material)).size, ripples.length, 'independent ripple phases');
    const initial = ripples.map(m => [m.scale.x, m.material.opacity]);
    batchStatic(d.root); d.update(2);
    assert.notEqual(mobile.rotation.y, 0); assert.notDeepEqual(ripples.map(m => [m.scale.x, m.material.opacity]), initial);
    assert.ok(mobile.parent, 'batcher retains animated hierarchy');
    d.reset(); assert.equal(mobile.rotation.y, 0); assert.deepEqual(ripples.map(m => [m.scale.x, m.material.opacity]), initial);
    atmosphere.ambient.enabled = false; d.update(9);
    assert.equal(mobile.rotation.y, 0); assert.ok(ripples.every(m => m.scale.x === 1));
  } finally { atmosphere.ambient.enabled = enabled; d.kit.dispose(); }
});

test('the fountain uses the existing distance/zone/voice-budget ambience path and falls silent when paused', () => {
  let mix = [];
  const t = headlessGame({ sound: { play() {}, setAmbience(v) { mix = v; } } });
  const { g } = t; t.tick(); g.rounds.update = () => {}; g.zombies.clear();
  const e = g.map.ambience.find(e => e.id === 'atrium_fountain');
  assert.equal(e.kind, 'fountain'); assert.ok(atmosphere.ambience.voices[e.kind]);
  t.standAt(e.position[0], e.position[2] - 1.1, 180);
  assert.ok(!mix.some(v => v.kind === 'fountain'), 'closed zone is silent');
  g.map.doors.find(d => d.id === 'atrium').open(); t.tick();
  assert.ok(mix.some(v => v.kind === 'fountain' && v.gain > 0));
  assert.ok(mix.length <= atmosphere.ambience.maxVoices);
  g.state.forceRun = false; t.tick(); assert.deepEqual(mix, []);
  g.resetRun(); assert.deepEqual(mix, []);
});
