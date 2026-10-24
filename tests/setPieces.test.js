// Set pieces (maps/mall/setPieces.js): each solid one is a single collider, too tall to climb, clear of every spawn, buy spot
// and door; the TV wall and the arcade attract screen animate (and hold still with Dust and flickering lights off); the
// pyramid adds no collision; everything goes when the map unloads.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (stubs <canvas>)
import { atmosphere } from '../src/config/environment.js';

const { buildMall } = await import('../src/maps/mall/mall.js');
const { SET_PIECES } = await import('../src/maps/mall/setPieces.js');

function build() {
  const colliders = [];
  const map = buildMall(new THREE.Scene(), colliders);
  return { map, colliders };
}
const named = (colliders, name) => colliders.find((c) => c.name === name);
const gap = (box, p) => Math.hypot(Math.max(box.min.x - p.x, 0, p.x - box.max.x), Math.max(box.min.z - p.z, 0, p.z - box.max.z));

test('the solid set pieces are one collider each, too tall to climb, and clear of spawns, buy spots and doors', () => {
  const { map, colliders } = build();
  const solids = ['setpiece_arcade', 'setpiece_tv_wall', 'setpiece_mannequins'].map((n) => named(colliders, n));
  for (const box of solids) assert.ok(box, 'collider exists');
  for (const box of solids) {
    const floor = box.min.y;
    assert.ok(box.max.y - floor >= 1.9, `${box.name}: too tall to jump onto`);
    for (const s of map.spawnPoints) {
      if (Math.abs(s.position.y - floor) > 1) continue; // (another floor)
      assert.ok(gap(box, s.position) >= 1.0, `${box.name} keeps clear of ${s.name}`);
    }
    for (const f of map.features) {
      if (Math.abs(f.position.y - 1.5 - floor) > 1.5) continue;
      assert.ok(gap(box, f.position) >= 1.5, `${box.name} keeps clear of ${f.name ?? f.kind}`);
    }
    for (const d of map.doors) {
      if (Math.abs((d.position?.y ?? 0) - floor) > 3) continue;
      assert.ok(gap(box, d.position) >= 1.5, `${box.name} keeps clear of door ${d.id}`);
    }
  }
  assert.ok(!colliders.some((c) => c.name === 'setpiece_pyramid'), 'the spilled pyramid adds no collision');
  assert.ok(SET_PIECES.pyramid.x0 > 33 && SET_PIECES.pyramid.x1 <= 34, 'the cans stay in the strip along the Mart\'s east wall');
  map.dispose();
});

test('the TV wall plays static and the SALE ad, the arcade attract mode cycles, and both hold still when switched off', () => {
  const { map } = build();
  const screens = [];
  let attract = null;
  map.group.traverse((o) => {
    if (o.name === 'tv_screen') screens.push(o);
    if (o.name === 'arcade_attract_screen') attract = o;
  });
  assert.equal(screens.length, 12);
  assert.ok(attract);
  const live = screens.filter((s) => s.material.map);
  assert.equal(live.length, 11, 'one set has died for good');
  const snapshot = () => [live.map((s) => [s.material.map.uuid, s.material.map.offset.x]), attract.material.color.getHex()];
  const was = JSON.stringify(snapshot());
  for (let i = 0; i < 90; i++) map.update(1 / 60);
  assert.notEqual(JSON.stringify(snapshot()), was, 'they animate');
  const ads = new Set();
  for (let i = 0; i < 60 * 7; i++) { map.update(1 / 60); for (const s of live) ads.add(s.material.map.image); }
  assert.ok(ads.size >= 3, 'static plus both ad frames show over a cycle');

  const saved = atmosphere.ambient.enabled;
  try {
    atmosphere.ambient.enabled = false;
    const still = JSON.stringify(snapshot());
    for (let i = 0; i < 90; i++) map.update(1 / 60);
    assert.equal(JSON.stringify(snapshot()), still, 'Dust and flickering lights off: the screens hold still');
  } finally { atmosphere.ambient.enabled = saved; }

  let inStatic = 0;
  map.group.traverse((o) => { if ((o.name === 'tv_screen' || o.name === 'arcade_attract_screen') && !o.parent.userData.dynamic) inStatic++; });
  assert.equal(inStatic, 0, 'animated screens sit in a dynamic group (never static-batched)');
  map.dispose();
});
