// The zombies' route field (zombies/navigation.js computeField) is drawn with a bucket queue (a speed-up). It must be the
// field the old heap drew, cell for cell, wherever the player stands: both queues are still in the file
// (createNavigation(..., { queue: 'heap' }) is the reference), and this compares them on the real mall.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { createNavigation } from '../src/zombies/navigation.js';
import { zombieTypes } from '../src/config/zombies.js';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function compareFields(g, { targets, seed }) {
  const agent = { radius: zombieTypes.shopper.radius, height: zombieTypes.shopper.height };
  const buckets = createNavigation(g.colliders, agent, g.map.navigation);
  const heap = createNavigation(g.colliders, agent, { ...g.map.navigation, queue: 'heap' });
  const random = seeded(seed);
  let reachable = 0;
  for (let n = 0; n < targets; n++) {
    // Anywhere on the map, on any floor, half way up the stairs, or off it altogether (no field at all).
    const target = { x: -45 + random() * 107, y: [0, 0, 6.3, 3.1, 11.1][Math.floor(random() * 5)], z: -24 + random() * 54 };
    buckets.update(1, target);
    heap.update(1, target);
    for (const y of [0, 6.3, 11.1]) {
      for (let x = -46; x <= 63; x += 0.5) {
        for (let z = -24; z <= 31; z += 0.5) {
          const a = buckets.distanceToTarget(x + 0.25, z + 0.25, y);
          const b = heap.distanceToTarget(x + 0.25, z + 0.25, y);
          if (a !== b) assert.fail(`target ${JSON.stringify(target)}: cell (${x}, ${y}, ${z}) is ${a} with buckets, ${b} with the heap`);
          if (a < Infinity) reachable++;
        }
      }
    }
  }
  return reachable;
}

test('the bucket queue draws the heap\'s field: start of a run (most doors shut)', () => {
  const { g, tick } = headlessGame();
  tick(2);
  assert.ok(compareFields(g, { targets: 14, seed: 3 }) > 1000, 'fields were drawn and compared');
});

test('the bucket queue draws the heap\'s field: the whole mall open, every floor and ramp', () => {
  const { g, tick } = headlessGame();
  tick(2);
  for (const id of Object.keys(g.map.zones)) if (!g.map.zones[id].open) g.map.areaUnlocks?.unlock(id, { instant: true });
  tick(2);
  assert.ok(compareFields(g, { targets: 14, seed: 4 }) > 100000, 'fields were drawn and compared');
});
