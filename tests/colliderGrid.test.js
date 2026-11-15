// The collision grid (world/colliderGrid.js) is a speed-up only: every collision function must give exactly what reading the
// whole collider list gives, on the real mall, for every kind of body and move. `noGrid` on a copy of the list is the
// reference (the plain loop). Also: the grid really is in use, it follows doors, and nothing moves a box without a mark.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { moveAndCollide, overlapsSolid, hasHeadroom, markCollidersChanged } from '../src/world/collision.js';
import { cellFor, checkColliderGrid } from '../src/world/colliderGrid.js';
import { perf } from '../src/config/performance.js';
import { weapons } from '../src/config/weapons.js';

// A small seeded generator (never Math.random: three makes object ids with it while the map is built).
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The same boxes (and ramps), read whole: the reference. */
function plainCopy(colliders) {
  const plain = [...colliders];
  plain.ramps = colliders.ramps;
  plain.noGrid = true;
  return plain;
}

/** Ask often enough that the list is sorted (config/performance.js buildAfterQueries). */
function warm(colliders) {
  for (let i = 0; i <= perf.collisionGrid.buildAfterQueries; i++) cellFor(colliders, 0, 0, 0.3);
}

/** Many bodies, several steps each, on both lists: every number must be identical. Returns how many steps were compared. */
function compareMoves(colliders, { bodies, steps, seed, bounds, speed = 9 }) {
  const plain = plainCopy(colliders);
  const random = seeded(seed);
  const between = (a, b) => a + (b - a) * random();
  let compared = 0;
  for (let n = 0; n < bodies; n++) {
    const radius = [0.3, 0.32, 0.35, 0.42, 0.42, 0.9, 1.4][Math.floor(random() * 7)]; // (the last two are wider than the grid's reach)
    const height = between(0.55, 1.9);
    const start = new THREE.Vector3(between(bounds.minX, bounds.maxX), [0, 0, 0.4, 6.3, 6.5, 11.4][Math.floor(random() * 6)], between(bounds.minZ, bounds.maxZ));
    const a = { pos: start.clone(), vel: new THREE.Vector3() };
    const b = { pos: start.clone(), vel: new THREE.Vector3() };
    for (let s = 0; s < steps; s++) {
      // (now and then a hard shove or a jump, so bodies are pushed across cells and hit ceilings)
      const vx = between(-speed, speed), vz = between(-speed, speed), vy = random() < 0.2 ? between(0, 7) : a.vel.y - 0.4;
      a.vel.set(vx, vy, vz);
      b.vel.set(vx, vy, vz);
      const dt = random() < 0.1 ? 0.25 : 1 / 60; // (a long step now and then: deep inside a box, out through its nearest side)
      const ga = moveAndCollide(a.pos, a.vel, dt, radius, height, colliders, 0.35);
      const gb = moveAndCollide(b.pos, b.vel, dt, radius, height, plain, 0.35);
      assert.deepEqual([a.pos.toArray(), a.vel.toArray(), ga.grounded], [b.pos.toArray(), b.vel.toArray(), gb.grounded],
        `body ${n} step ${s} (radius ${radius}) differs from the plain loop`);
      assert.equal(overlapsSolid(a.pos, radius, height, colliders, 0.35), overlapsSolid(b.pos, radius, height, plain, 0.35), 'overlapsSolid');
      assert.equal(hasHeadroom(a.pos, radius, 0.55, 1.8, colliders, 0.02), hasHeadroom(b.pos, radius, 0.55, 1.8, plain, 0.02), 'hasHeadroom');
      compared++;
    }
  }
  return compared;
}

const mallBounds = { minX: -46, maxX: 63, minZ: -25, maxZ: 31 };

test('the real mall: moving, overlap and headroom are identical with and without the grid', () => {
  const { g } = headlessGame();
  warm(g.colliders);
  assert.ok(g.colliders.grid?.usable, 'the mall\'s collider list is sorted into a grid');
  const cell = cellFor(g.colliders, 0, 2, 0.35);
  assert.ok(cell && cell.boxes.length < g.colliders.length / 4, `a body reads a fraction of the list (${cell?.boxes.length} of ${g.colliders.length})`);
  assert.ok(compareMoves(g.colliders, { bodies: 400, steps: 30, seed: 11, bounds: mallBounds }) >= 12000);
});

test('the grid follows the list: doors opening, a box added, a box removed', () => {
  const { g } = headlessGame();
  warm(g.colliders);
  for (const door of g.map.doors) door.open({ instant: true });
  compareMoves(g.colliders, { bodies: 120, steps: 20, seed: 12, bounds: mallBounds });
  const extra = new THREE.Box3(new THREE.Vector3(-1, 0, 1), new THREE.Vector3(1, 3, 3)); // (a pillar in the hallway)
  g.colliders.push(extra);
  markCollidersChanged(g.colliders);
  compareMoves(g.colliders, { bodies: 120, steps: 20, seed: 13, bounds: { minX: -6, maxX: 6, minZ: -2, maxZ: 6 } });
  g.colliders.splice(g.colliders.indexOf(extra), 1);
  markCollidersChanged(g.colliders);
  compareMoves(g.colliders, { bodies: 120, steps: 20, seed: 14, bounds: { minX: -6, maxX: 6, minZ: -2, maxZ: 6 } });
});

test('a body deep inside a big box is put out through the same side, across cells', () => {
  // 60 pillars and one 12 m slab of wall: a body starting in the middle of the slab leaves it metres away.
  const colliders = [];
  for (let i = 0; i < 60; i++) {
    const x = (i % 10) * 3 - 14, z = Math.floor(i / 10) * 3 - 8;
    colliders.push(new THREE.Box3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 0.8, 3, z + 0.8)));
  }
  colliders.splice(20, 0, new THREE.Box3(new THREE.Vector3(-6, 0, -6), new THREE.Vector3(6, 3, 6)));
  colliders.push(new THREE.Box3(new THREE.Vector3(-30, -0.2, -30), new THREE.Vector3(30, 0, 30))); // the floor
  warm(colliders);
  assert.ok(colliders.grid?.usable);
  compareMoves(colliders, { bodies: 300, steps: 12, seed: 15, bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 }, speed: 30 });
});

test('a short list, a throwaway list and a switched-off list are read whole', () => {
  const few = [new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1))];
  for (let i = 0; i < 40; i++) assert.equal(cellFor(few, 0.5, 0.5, 0.3), null);
  assert.equal(few.grid, undefined, 'a handful of boxes is never sorted');
  const { g } = headlessGame();
  const once = [...g.colliders];
  assert.equal(cellFor(once, 0, 2, 0.3), null, 'a list asked once is not sorted');
  assert.equal(once.grid, undefined);
  const off = plainCopy(g.colliders);
  for (let i = 0; i < 40; i++) assert.equal(cellFor(off, 0, 2, 0.3), null);
});

test('a box moved in place is noticed at the next tick, and the results follow it', () => {
  const { g, tick } = headlessGame();
  warm(g.colliders);
  const pillar = new THREE.Box3(new THREE.Vector3(-1, 0, 1), new THREE.Vector3(1, 3, 3));
  g.colliders.push(pillar);
  markCollidersChanged(g.colliders);
  warm(g.colliders);
  assert.equal(checkColliderGrid(g.colliders), false, 'nothing has moved');
  pillar.translate(new THREE.Vector3(3, 0, 0)); // (moved in place, no mark: against the rule)
  assert.equal(checkColliderGrid(g.colliders), true, 'the moved box is noticed');
  assert.equal(g.colliders.gridStale, 1);
  compareMoves(g.colliders, { bodies: 120, steps: 20, seed: 16, bounds: { minX: -6, maxX: 8, minZ: -2, maxZ: 6 } });
  pillar.translate(new THREE.Vector3(-3, 0, 0));
  tick(1); // (the game's own tick runs the check)
  assert.equal(g.colliders.gridStale, 2);
});

test('a played run never moves a box without marking the list', () => {
  const t = headlessGame();
  const { g, input } = t;
  g.debug.run('god');
  t.tick(2);
  for (const id of Object.keys(g.map.zones)) if (!g.map.zones[id].open) g.map.areaUnlocks?.unlock(id);
  g.rounds.jumpTo(16);
  g.gun.give(weapons.nailGun);
  for (let i = 0; i < 1500; i++) {
    input.held.add('Mouse0');
    if (i % 6 === 0) input.pressed.add('Mouse0');
    g.player.yaw += 0.01;
    if (i === 100) { g.debug.run('summonBoss'); g.debug.run('spawnMascot'); g.debug.run('flashSale'); }
    if (i === 200) for (const { instance } of g.features.list) if (instance?.trigger && instance.ready) instance.trigger();
    if (i === 400) { g.debug.run('pockets'); input.pressed.add('KeyG'); input.held.add('KeyG'); }
    if (i === 430) input.held.delete('KeyG');
    if (i === 600) g.debug.run('clawMove');
    if (i === 700) g.debug.run('kioskMove');
    if (i === 900) g.debug.run('doors'); // (every door shut, then open again)
    if (i === 1100) g.debug.run('doors');
    t.tick(1);
  }
  assert.ok(g.colliders.grid?.usable, 'the grid was in use for the run');
  assert.equal(g.colliders.gridStale ?? 0, 0, 'a collider box was moved in place: add / remove it and call markCollidersChanged instead');
});
