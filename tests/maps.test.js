import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { wallSegments, slabPieces } from '../src/world/mapKit.js';
import { createDoor, toggleDoors } from '../src/world/door.js';
import { createNavigation } from '../src/zombies/navigation.js';
import { markCollidersChanged } from '../src/world/collision.js';

const bounds = (b) => [...b.min, ...b.max];

test('wallSegments: a plain wall is one box, along X or Z', () => {
  assert.deepEqual(wallSegments({ along: 'x', from: -5, to: 5, at0: 1, at1: 1.3, height: 4 }).map(bounds), [[-5, 0, 1, 5, 4, 1.3]]);
  assert.deepEqual(wallSegments({ along: 'z', from: 2, to: 8, at0: -1.3, at1: -1, height: 3 }).map(bounds), [[-1.3, 0, 2, -1, 3, 8]]);
});

test('wallSegments: a doorway leaves a gap with a lintel above; a full-height gap has none', () => {
  const door = wallSegments({ along: 'x', from: -5, to: 5, at0: 6, at1: 6.3, height: 6, openings: [{ from: -2, to: 2, top: 3 }] });
  assert.deepEqual(door.map((b) => [b.part, ...bounds(b)]), [
    ['segment', -5, 0, 6, -2, 6, 6.3],
    ['segment', 2, 0, 6, 5, 6, 6.3],
    ['lintel', -2, 3, 6, 2, 6, 6.3],
  ]);
  const gap = wallSegments({ along: 'z', from: 0, to: 10, at0: 0, at1: 0.3, height: 6, openings: [{ from: 4, to: 6 }] });
  assert.deepEqual(gap.map(bounds), [[0, 0, 0, 0.3, 6, 4], [0, 0, 6, 0.3, 6, 10]]);
});

test('wallSegments: several openings in any order, including one at the very end', () => {
  const pieces = wallSegments({
    along: 'x', from: 0, to: 20, at0: 0, at1: 0.3, height: 5,
    openings: [{ from: 12, to: 14, top: 3 }, { from: 2, to: 4 }, { from: 18, to: 20 }],
  });
  assert.deepEqual(pieces.filter((p) => p.part === 'segment').map((p) => [p.min[0], p.max[0]]), [[0, 2], [4, 12], [14, 18]]);
  assert.deepEqual(pieces.filter((p) => p.part === 'lintel').map(bounds), [[12, 3, 0, 14, 5, 0.3]]);
});

test('two doors into the same zone: either opens it, it only locks when both are closed', () => {
  const zones = { foodCourt: { label: 'Food Court', open: false } };
  const barrier = () => ({ opened: 0, closed: 0, open() { this.opened++; }, close() { this.closed++; }, update() {} });
  const a = createDoor({ id: 'a', label: 'A', price: 1000, opensZone: 'foodCourt', zones, barrier: barrier(), position: null });
  const b = createDoor({ id: 'b', label: 'B', price: 1000, opensZone: 'foodCourt', zones, barrier: barrier(), position: null });
  a.open();
  assert.equal(zones.foodCourt.open, true);
  assert.equal(b.isOpen, false, 'the other door still has to be bought separately');
  b.open();
  a.reset();
  assert.equal(zones.foodCourt.open, true, 'still open through door B');
  b.toggle();
  assert.equal(zones.foodCourt.open, false, 'locked once both are closed');
  assert.throws(() => createDoor({ id: 'c', opensZone: 'nowhere', zones, barrier: barrier() }));
});

test('shortcut doors open several zones and share their independent zone holders', () => {
  const zones = { food: { open: false }, mart: { open: false }, service: { open: false } };
  const barrier = () => ({ open() {}, close() {}, update() {} });
  const make = (id, spec) => createDoor({ id, zones, barrier: barrier(), ...spec });
  const food = make('food', { opensZone: 'food' });
  const east = make('east', { opensZones: ['food', 'mart', 'mart'] });
  const west = make('west', { opensZones: ['food', 'service'] });
  assert.deepEqual(food.opensZones, ['food'], 'legacy doors expose the same canonical list');
  assert.deepEqual(east.opensZones, ['food', 'mart']);
  east.open();
  east.open();
  assert.deepEqual(Object.values(zones).map((z) => z.open), [true, true, false]);
  food.open();
  west.open();
  east.reset();
  assert.deepEqual(Object.values(zones).map((z) => z.open), [true, false, true]);
  food.reset();
  assert.equal(zones.food.open, true, 'west shortcut still holds Food Court open');
  west.reset();
  west.reset();
  assert.deepEqual(Object.values(zones).map((z) => z.open), [false, false, false]);
  assert.throws(() => make('empty', { opensZones: [] }), /at least one zone/);
  assert.throws(() => make('bad', { opensZones: ['food', 'missing'] }), /unknown zone/);
  assert.throws(() => make('inherited', { opensZone: 'toString' }), /unknown zone/);
  assert.equal(zones.food.open, false, 'validation does not partially open zones');
});

test('debug door toggle synchronizes a partially bought map instead of closing its purchased entrance', () => {
  const zones = { hall: { open: false }, food: { open: false }, mart: { open: false } };
  const make = (id, opensZones) => createDoor({ id, opensZones, zones, barrier: { open() {}, close() {}, update() {} } });
  const doors = [make('start', ['hall']), make('food', ['food']), make('shortcut', ['food', 'mart'])];
  doors[0].open();
  toggleDoors(doors);
  assert.ok(doors.every((d) => d.isOpen));
  assert.ok(Object.values(zones).every((z) => z.open), 'hallway and its shops remain unlocked');
  toggleDoors(doors);
  assert.ok(doors.every((d) => !d.isOpen));
  assert.ok(Object.values(zones).every((z) => !z.open), 'all shared zone holders release together');
  toggleDoors(doors);
  assert.ok(doors.every((d) => d.isOpen), 'a completely shut map opens too');
  doors[1].reset();
  toggleDoors(doors);
  assert.ok(doors.every((d) => d.isOpen), 'any mixed state opens completely');
});

test('the navigation grid rebuilds when colliders change, even if the count stays the same', () => {
  const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  // A floor split in two by a wall with a 2m gap; a plug blocks the gap.
  const plug = box(-1, 0, -0.15, 1, 3, 0.15);
  const colliders = [
    box(-10, -0.2, -10, 10, 0, 10),
    box(-10, 0, -0.15, -1, 3, 0.15),
    box(1, 0, -0.15, 10, 3, 0.15),
    plug,
  ];
  const nav = createNavigation(colliders, { radius: 0.32, height: 1.75 });
  const player = new THREE.Vector3(0, 0, 5);
  nav.update(1 / 60, player);
  assert.equal(nav.distanceToTarget(0, -5), Infinity, 'gap plugged: no way through');
  // Same tick: the plug goes (a door opens) and another box appears elsewhere (another door closes).
  colliders.splice(colliders.indexOf(plug), 1);
  colliders.push(box(5, 0, 5, 6, 3, 6));
  markCollidersChanged(colliders);
  nav.update(1 / 60, player);
  assert.ok(Number.isFinite(nav.distanceToTarget(0, -5)), 'the grid was rebuilt: the gap is open now');
});

test('slabPieces: a slab with a hole is four pieces covering everything but the hole', () => {
  const rect = { minX: -10, maxX: 10, minZ: -5, maxZ: 5 };
  assert.deepEqual(slabPieces(rect, null), [rect]);
  assert.deepEqual(slabPieces(rect, { minX: 20, maxX: 30, minZ: 0, maxZ: 1 }), [rect], 'hole outside: whole slab');
  const hole = { minX: -2, maxX: 3, minZ: -1, maxZ: 2 };
  const pieces = slabPieces(rect, hole);
  assert.equal(pieces.length, 4);
  const area = (r) => (r.maxX - r.minX) * (r.maxZ - r.minZ);
  assert.equal(pieces.reduce((sum, r) => sum + area(r), 0), area(rect) - area(hole));
  const inside = (r, x, z) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
  assert.ok(!pieces.some((r) => inside(r, 0, 0)), 'nothing covers the hole');
  for (const [x, z] of [[-9, 0], [9, 0], [0, -4], [0, 4]]) assert.ok(pieces.some((r) => inside(r, x, z)), `(${x}, ${z}) covered`);
  // A hole running off the edge is clipped: three pieces.
  assert.equal(slabPieces(rect, { minX: 5, maxX: 15, minZ: -1, maxZ: 1 }).length, 3);
});

test('wallSegments: overlapping openings are an error; touching ones are fine', () => {
  const base = { along: 'x', from: 0, to: 10, at0: 0, at1: 0.3, height: 4 };
  assert.throws(() => wallSegments({ ...base, openings: [{ from: 2, to: 5, top: 3 }, { from: 4, to: 7, top: 2 }] }), /overlap/);
  assert.throws(() => wallSegments({ ...base, openings: [{ from: 4, to: 7 }, { from: 2, to: 5 }] }), /overlap/, 'in any order');
  const touching = wallSegments({ ...base, openings: [{ from: 2, to: 4, top: 3 }, { from: 4, to: 6, top: 2 }] });
  assert.equal(touching.filter((b) => b.part === 'lintel').length, 2);
});
