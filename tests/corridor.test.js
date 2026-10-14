// The modular corridor builder (world/corridor.js + kit.corridor): pure layout checks on several
// shapes, then the real kit (with a stub canvas) feeding a real navigation grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { corridorLayout } from '../src/world/corridor.js';
import { wallSegments, createMapKit } from '../src/world/mapKit.js';
import { createNavigation } from '../src/zombies/navigation.js';

const EPS = 1e-6;

test('caps stop at shared-wall faces instead of extending into them, in every orientation', () => {
  for (const [dir, negativeRight] of [['east', false], ['west', true], ['north', true], ['south', false]]) {
    for (const side of ['right', 'left']) {
      const layout = corridorLayout({
        width: 3, height: 3.5, thickness: 0.3, start: { x: 0, z: 0 },
        startCap: true, endCap: true, segments: [{ dir, length: 8, noWall: [side] }],
      });
      const negative = side === 'right' ? negativeRight : !negativeRight;
      for (const cap of layout.caps) {
        assert.equal(negative ? cap.from : cap.to, negative ? -1.5 : 1.5, `${dir}/${side}: shared face`);
        assert.equal(negative ? cap.to : cap.from, negative ? 1.8 : -1.8, `${dir}/${side}: own wall corner`);
      }
    }
  }
});
const overlapArea = (a, b) => Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) *
  Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
const inRect = (r, x, z) => x > r.minX + EPS && x < r.maxX - EPS && z > r.minZ + EPS && z < r.maxZ - EPS;
// Every solid piece (segments + lintels) of every side wall and end cap.
const pieces = (layout) => [...layout.walls, ...layout.caps].flatMap((w) => wallSegments(w));
const footprint = (p) => ({ minX: p.min[0], maxX: p.max[0], minZ: p.min[2], maxZ: p.max[2] });
// Is (x, z) walled off at waist height (1m)?
const walledAt = (layout, x, z) => pieces(layout).some((p) => p.min[1] <= 1 && p.max[1] >= 1 && inRect(footprint(p), x, z));

// Walk just outside every edge (and diagonally off every corner) of every floor rect. Each probe
// must land on another floor (the corridor continues) or in a wall, unless `allowed(x, z)` says
// it's an intended gap (doorway, open end).
function leaks(layout, allowed = () => false) {
  const out = 0.15; // inside a 0.3m wall
  const bad = [];
  const onFloor = (x, z) => layout.floors.some((f) => inRect(f, x, z));
  const check = (x, z) => {
    if (onFloor(x, z) || walledAt(layout, x, z) || allowed(x, z)) return;
    bad.push([+x.toFixed(2), +z.toFixed(2)]);
  };
  for (const f of layout.floors) {
    for (let x = f.minX + 0.05; x < f.maxX - 0.04; x += 0.1) { check(x, f.minZ - out); check(x, f.maxZ + out); }
    for (let z = f.minZ + 0.05; z < f.maxZ - 0.04; z += 0.1) { check(f.minX - out, z); check(f.maxX + out, z); }
    for (const [x, z] of [[f.minX - out, f.minZ - out], [f.minX - out, f.maxZ + out], [f.maxX + out, f.minZ - out], [f.maxX + out, f.maxZ + out]]) check(x, z);
  }
  return bad;
}

const SHAPES = {
  straight: { width: 4, height: 3, start: { x: 0, z: 0 }, segments: [{ dir: 'east', length: 10 }], startCap: true, endCap: true },
  'L (west 2, south 18)': { width: 4, height: 3.5, start: { x: -20.3, z: 2 }, segments: [{ dir: 'west', length: 2 }, { dir: 'south', length: 18 }], startCap: true, endCap: true },
  'zig-zag': { width: 3, height: 3, start: { x: 0, z: 0 }, segments: [{ dir: 'east', length: 6 }, { dir: 'north', length: 8 }, { dir: 'east', length: 5 }, { dir: 'south', length: 4 }], startCap: true, endCap: true },
  'U-turn': { width: 4, height: 3, start: { x: 0, z: 0 }, segments: [{ dir: 'north', length: 10 }, { dir: 'east', length: 6 }, { dir: 'south', length: 10 }], startCap: true, endCap: true },
};

test('a straight corridor: one floor, two side walls outside it, an end cap across the end', () => {
  const l = corridorLayout({ width: 4, height: 3, start: { x: 0, z: 0 }, segments: [{ dir: 'east', length: 10 }] });
  // Open start (the default): the floor reaches back 0.3m, under the doorway it joins.
  assert.deepEqual(l.floors, [{ minX: -0.3, maxX: 10, minZ: -2, maxZ: 2 }]);
  assert.equal(l.walls.length, 2);
  for (const w of l.walls) {
    assert.equal(w.along, 'x');
    assert.deepEqual([w.from, w.to], [0, 10]);
    assert.ok(w.at1 <= -2 + EPS || w.at0 >= 2 - EPS, 'wall thickness is outside the walkway');
  }
  assert.equal(l.caps.length, 1, 'open start (default), closed end (default)');
  assert.deepEqual([l.caps[0].along, l.caps[0].from, l.caps[0].to, l.caps[0].at0, l.caps[0].at1], ['z', -2.3, 2.3, 10, 10.3]);
});

for (const [name, spec] of Object.entries(SHAPES)) {
  test(`${name}: floors never overlap, walls never stick into the walkway, and it is sealed`, () => {
    const l = corridorLayout(spec);
    for (let i = 0; i < l.floors.length; i++) {
      for (let j = i + 1; j < l.floors.length; j++) assert.equal(overlapArea(l.floors[i], l.floors[j]), 0, `floors ${i} and ${j} overlap`);
    }
    for (const p of pieces(l)) {
      for (const f of l.floors) assert.ok(overlapArea(footprint(p), f) < 1e-9, `a wall piece intrudes into the walkway: ${JSON.stringify(footprint(p))}`);
    }
    assert.deepEqual(leaks(l), [], 'sealed on every side and corner');
    // The centerline is inside the walkway everywhere.
    for (let r = 0; r < l.runs.length; r++) {
      for (let at = 0.2; at < l.runs[r].length - 0.1; at += 0.5) {
        const c = l.pointAt(r, at);
        assert.ok(l.floors.some((f) => c.x >= f.minX - EPS && c.x <= f.maxX + EPS && c.z >= f.minZ - EPS && c.z <= f.maxZ + EPS), `centerline (${c.x}, ${c.z}) on a floor`);
      }
    }
  });
}

test('doorways, shared-wall gaps and open ends leave holes exactly where asked', () => {
  const spec = {
    width: 4, height: 3.5, start: { x: -20.3, z: 2 }, startCap: false, endCap: { opening: { width: 2, top: 2.4 } },
    segments: [
      { dir: 'west', length: 2 },
      { dir: 'south', length: 18, noWall: ['right'], openings: [{ side: 'left', at: 6, width: 2, top: 2.4 }] },
    ],
  };
  const l = corridorLayout(spec);
  // Doorway in the left (west) wall of the south run, centered 6m down it: open below 2.4m, lintel above.
  const door = l.pointAt(1, 6, 'left');
  assert.equal(walledAt(l, door.x - 0.15, door.z), false, 'doorway is open');
  assert.ok(pieces(l).some((p) => p.part === 'lintel' && inRect(footprint(p), door.x - 0.15, door.z) && p.min[1] === 2.4), 'lintel above it');
  assert.ok(walledAt(l, door.x - 0.15, door.z + 1.5), 'wall continues beside it');
  // noWall: the right (east) side of the south run has no wall at all (another room's wall is there).
  assert.equal(l.walls.filter((w) => w.run === 1 && w.side === 'right').length, 0);
  // Open start, end cap with a doorway.
  assert.equal(l.caps.length, 1);
  assert.equal(l.caps[0].openings.length, 1);
  // Everything else is still sealed.
  const end = l.points[l.points.length - 1];
  const allowed = (x, z) =>
    (x > -20.3 - 0.5 && Math.abs(z - 2) <= 2.01) || // open start
    x > -20.3 - 0.01 || // the right side has no wall (shared)
    (Math.abs(z - door.z) <= 1 && x < -24) || // the doorway
    (Math.abs(x - end.x) <= 1 && z < end.z); // the end cap's doorway
  assert.deepEqual(leaks(l, allowed), []);
});

test('pointAt gives wall faces with inward normals; branchStart starts a branch through a side opening', () => {
  const l = corridorLayout(SHAPES['L (west 2, south 18)']);
  const p = l.pointAt(1, 5, 'left', 0.2); // south run, left = west wall
  assert.deepEqual([+p.x.toFixed(6), +p.z.toFixed(6)], [-24.1, -3]);
  assert.equal(p.normal.x, 1, 'normal points into the corridor (east)');
  assert.ok(Math.abs(p.normal.z) < EPS);
  const b = l.branchStart(1, 10, 'left');
  assert.deepEqual([+b.x.toFixed(6), +b.z.toFixed(6), b.dir], [-24.6, -8, 'west']);
  // A branch built from there: its walls don't intrude into either walkway, and it's sealed except
  // where it meets the parent's (opened) wall.
  const parent = corridorLayout({ ...SHAPES['L (west 2, south 18)'], segments: [
    { dir: 'west', length: 2 }, { dir: 'south', length: 18, openings: [{ side: 'left', at: 10, width: 3 }] }] });
  const branch = corridorLayout({ width: 3, height: 3, start: b, startCap: false, segments: [{ dir: b.dir, length: 6 }] });
  const both = {
    floors: [...parent.floors, ...branch.floors],
    walls: [...parent.walls, ...branch.walls],
    caps: [...parent.caps, ...branch.caps],
  };
  for (const piece of pieces(both)) {
    for (const f of both.floors) assert.ok(overlapArea(footprint(piece), f) < 1e-9, 'no intrusion');
  }
  // The branch's floor reaches through the parent's wall opening, so the two walkways join...
  assert.ok(branch.floors[0].maxX >= parent.floors[1].minX - EPS, 'branch floor meets the parent floor');
  // ...and together they're completely sealed.
  assert.deepEqual(leaks(both), [], 'parent + branch sealed');
});

test('bad specs are refused: a run too short for its turns, or a turn that is not 90 degrees', () => {
  assert.throws(() => corridorLayout({ width: 4, height: 3, start: { x: 0, z: 0 }, segments: [{ dir: 'east', length: 1 }, { dir: 'north', length: 5 }] }), /shorter/);
  assert.throws(() => corridorLayout({ width: 4, height: 3, start: { x: 0, z: 0 }, segments: [{ dir: 'east', length: 5 }, { dir: 'west', length: 5 }] }), /90 degrees/);
  assert.throws(() => corridorLayout({ width: 4, height: 3, start: { x: 0, z: 0 }, segments: [{ dir: 'up', length: 5 }] }), /unknown dir/);
});

// --- The real kit: meshes + colliders, and zombies can path through it ---
const ctx = new Proxy({}, {
  get: (target, key) => (key in target ? target[key] : (target[key] = () => ctx)),
  set: (target, key, value) => { target[key] = value; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };

test('kit.corridor builds a solid corridor zombies can walk from end to end (and not out of)', () => {
  const group = new THREE.Group();
  const colliders = [];
  const kit = createMapKit(group, colliders);
  const wallMat = kit.mat(0xcccccc);
  const layout = kit.corridor(SHAPES['zig-zag'], { floor: { base: '#888888' }, wall: wallMat, ceiling: wallMat });
  assert.equal(colliders.length, layout.floors.length * 2 + pieces(layout).length, 'floor + ceiling per run, every wall piece');
  assert.ok(group.children.length >= colliders.length);
  const nav = createNavigation(colliders, { radius: 0.32, height: 1.75 });
  const startPt = layout.pointAt(0, 1);
  nav.update(1 / 60, new THREE.Vector3(startPt.x, 0, startPt.z));
  const last = layout.runs.length - 1;
  const endPt = layout.pointAt(last, layout.runs[last].length - 1);
  assert.ok(Number.isFinite(nav.distanceToTarget(endPt.x, endPt.z)), 'the far end is reachable along the corridor');
  assert.ok(nav.distanceToTarget(endPt.x, endPt.z) > 15, 'by walking the corridor (not cutting through walls)');
  assert.equal(nav.isWalkableAt(3, 4), false, 'outside the corridor is not walkable');
});

test('kit.corridor: a branch through a side doorway connects (zombies path from the main run to the branch end)', () => {
  const group = new THREE.Group();
  const colliders = [];
  const kit = createMapKit(group, colliders);
  const m = kit.mat(0xcccccc);
  const main = kit.corridor({ ...SHAPES['L (west 2, south 18)'], segments: [
    { dir: 'west', length: 2 }, { dir: 'south', length: 18, openings: [{ side: 'left', at: 10, width: 3 }] }] }, { wall: m, ceiling: m });
  const b = main.branchStart(1, 10, 'left');
  const branch = kit.corridor({ width: 3, height: 3, start: b, segments: [{ dir: b.dir, length: 6 }] }, { wall: m, ceiling: m });
  const nav = createNavigation(colliders, { radius: 0.32, height: 1.75 });
  const from = main.pointAt(1, 2);
  nav.update(1 / 60, new THREE.Vector3(from.x, 0, from.z));
  const end = branch.pointAt(0, 5);
  assert.ok(Number.isFinite(nav.distanceToTarget(end.x, end.z)), 'through the doorway into the branch');
});

test('a corridor that crosses itself is an error, not overlapping floors and walls', () => {
  const loop = {
    width: 3, height: 3, start: { x: 0, z: 0 },
    segments: [{ dir: 'east', length: 10 }, { dir: 'north', length: 10 }, { dir: 'west', length: 10 }, { dir: 'south', length: 14 }],
  };
  assert.throws(() => corridorLayout(loop), /crosses itself/);
});

test('two runs so close that a wall lands in the other walkway are an error', () => {
  // A U-turn whose two long runs are only 3.2m apart (walkways 3m wide + walls 0.3m each don't fit).
  const tight = {
    width: 3, height: 3, start: { x: 0, z: 0 },
    segments: [{ dir: 'north', length: 10 }, { dir: 'east', length: 3.2 }, { dir: 'south', length: 10 }],
  };
  assert.throws(() => corridorLayout(tight), /too close|crosses itself/);
  // The same U-turn with room for both walls builds fine.
  assert.doesNotThrow(() => corridorLayout({ ...tight, segments: [{ dir: 'north', length: 10 }, { dir: 'east', length: 3.6 }, { dir: 'south', length: 10 }] }));
});
