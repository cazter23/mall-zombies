// No z-fighting (flicker) in the stores, the Customer Service booth and the RESTOCK-O-MATIC: two surfaces on the same plane, facing the same
// way, with different looks, fight over the pixels and shimmer as you move. This builds the REAL mall and checks every
// box face and sign inside the store rooms and the booth against every other: a pair is a problem if its faces lie
// within 4 mm of each other, face the same way, overlap, look different, and aren't hidden against a solid behind them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildMall, LAYOUT } from '../src/maps/mall/mall.js';
import { storeRoom } from '../src/maps/mall/stores.js';

const ctx = new Proxy({}, {
  get: (target, key) => (key in target ? target[key] : (target[key] = () => ctx)),
  set: (target, key, value) => { target[key] = value; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };

const EPS = 0.004; // planes closer than this fight at normal viewing distances
const MIN_AREA = 0.0005; // m2

const looks = (mesh) => {
  const m = mesh.material;
  return m.map ? `map:${m.map.uuid}` : `${m.color?.getHexString?.()}|${m.opacity}|${m.type}`;
};

/** Every flat face of an axis-aligned box or a sign plane: { axis, c, dir, lo: [a, b], hi: [a, b], mesh }. */
function facesOf(mesh) {
  const g = mesh.geometry;
  const p = mesh.position;
  const out = [];
  if (g.type === 'BoxGeometry') {
    const { width: w, height: h, depth: d } = g.parameters;
    const min = [p.x - w / 2, p.y - h / 2, p.z - d / 2];
    const max = [p.x + w / 2, p.y + h / 2, p.z + d / 2];
    for (let a = 0; a < 3; a++) {
      const o1 = (a + 1) % 3;
      const o2 = (a + 2) % 3;
      out.push({ axis: a, c: min[a], dir: -1, lo: [min[o1], min[o2]], hi: [max[o1], max[o2]], mesh });
      out.push({ axis: a, c: max[a], dir: 1, lo: [min[o1], min[o2]], hi: [max[o1], max[o2]], mesh });
    }
  } else if (g.type === 'PlaneGeometry') {
    const { width: w, height: h } = g.parameters;
    const nx = Math.round(Math.sin(mesh.rotation.y));
    const nz = Math.round(Math.cos(mesh.rotation.y));
    if (nz !== 0) out.push({ axis: 2, c: p.z, dir: nz, lo: [p.x - w / 2, p.y - h / 2], hi: [p.x + w / 2, p.y + h / 2], mesh });
    else out.push({ axis: 0, c: p.x, dir: nx, lo: [p.y - h / 2, p.z - w / 2], hi: [p.y + h / 2, p.z + w / 2], mesh });
  }
  return out;
}

const overlap = (a, b) => [0, 1].map((i) => Math.min(a.hi[i], b.hi[i]) - Math.max(a.lo[i], b.lo[i]));

test('no coplanar (flickering) surfaces inside the stores, the Customer Service booth and the RESTOCK-O-MATIC', () => {
  const scene = new THREE.Scene();
  const map = buildMall(scene, []);
  scene.updateMatrixWorld(true);

  // The regions to check: each store room (with its walls), and the booth.
  const T = LAYOUT.wallThickness;
  const regions = LAYOUT.stores.map((s) => {
    const r = storeRoom(s, LAYOUT.foodCourt, T);
    return { name: s.id, minX: s.from - T - 0.1, maxX: s.to + T + 0.1, minZ: Math.min(r.zBack, r.zOut) - T - 0.1, maxZ: Math.max(r.zBack, r.zOut) + 0.3 };
  });
  const desk = LAYOUT.serviceDesk;
  regions.push({ name: 'booth', minX: desk.center - 2.1, maxX: desk.center + 2.1, minZ: desk.wallAt - 2.3, maxZ: desk.wallAt + 0.1 });
  const restock = LAYOUT.restockMachine; // the RESTOCK-O-MATIC, its pad and its signs
  regions.push({ name: 'restock', minX: restock.x - 1.2, maxX: restock.x + 1.2, minZ: LAYOUT.foodCourt.maxZ - 2.4, maxZ: LAYOUT.foodCourt.maxZ + 0.1 });
  const at = LAYOUT.atrium.rect; // the Grand Atrium, its fountain, kiosks and both floors
  regions.push({ name: 'atrium', minX: at.minX - 0.4, maxX: at.maxX + 0.4, minZ: at.minZ - 0.7, maxZ: at.maxZ + 0.4 });
  const ds = LAYOUT.departmentStore.rect; // HOFFMAN'S: its counters, racks, mannequins, fitting rooms, shoe wall and the gate
  regions.push({ name: 'departmentStore', minX: ds.minX - 0.4, maxX: ds.maxX + 0.4, minZ: ds.minZ - 0.7, maxZ: ds.maxZ + 0.4, maxY: LAYOUT.hallway.height });
  const upper = LAYOUT.level2.rect;
  regions.push({ name: 'promenade', minX: upper.minX - .4, maxX: upper.maxX + .4, minZ: upper.minZ - .4,
    maxZ: Math.max(...LAYOUT.level2.sections.map(s => s.maxZ)) + .4, minY: LAYOUT.hallway.height + .3 });
  regions.push({ name: 'cinema', minX: LAYOUT.cinema.lobby.minX - .4, maxX: LAYOUT.cinema.passage.maxX + .4,
    minZ: LAYOUT.cinema.lobby.minZ - .4, maxZ: LAYOUT.cinema.auditorium.maxZ + .4, minY: LAYOUT.hallway.height + .3 });
  regions.push({ name: 'cinemaStairwell', minX: LAYOUT.cinemaStairs.shaft.minX - .4, maxX: LAYOUT.cinemaStairs.shaft.maxX + .4,
    minZ: LAYOUT.cinemaStairs.shaft.minZ - .4, maxZ: LAYOUT.cinemaStairs.shaft.maxZ + .4 });
  regions.push({ name: 'cinemaReturn', minX: LAYOUT.cinemaStairs.returnHall.minX - .4, maxX: LAYOUT.cinemaStairs.connector.maxX + .4,
    minZ: LAYOUT.cinemaStairs.connector.minZ, maxZ: LAYOUT.cinemaStairs.returnHall.maxZ + .4 });
  const inRegion = (m) => regions.some((r) => m.position.x > r.minX && m.position.x < r.maxX && m.position.z > r.minZ && m.position.z < r.maxZ
    && (r.minY === undefined || m.position.y >= r.minY) && (r.maxY === undefined || m.position.y < r.maxY));

  const all = [];
  map.group.traverse((o) => { if (o.isMesh && o.geometry && !o.rotation.x && !o.rotation.z) all.push(...facesOf(o)); });
  const mine = all.filter((f) => inRegion(f.mesh));
  const sorted = [...all].sort((a, b) => a.c - b.c);
  const hidden = (f, ox) => sorted.some((c) => c.axis === f.axis && c.dir === -f.dir && Math.abs(c.c - f.c) < EPS && c.mesh !== f.mesh
    && overlap(f, c).every((v, i) => v > 0 && Math.min(f.hi[i], c.hi[i]) - Math.max(f.lo[i], c.lo[i]) >= ox[i] - 1e-6));

  const problems = new Map();
  for (const a of mine) {
    for (const b of all) {
      // Upstairs tile skins sit over structural slabs; their concealed side and
      // underside contacts with walls are not exposed decorative surfaces.
      if ((a.mesh.name === 'floor' || b.mesh.name === 'floor')
        && a.mesh.position.y >= LAYOUT.hallway.height + .3 && b.mesh.position.y >= LAYOUT.hallway.height + .3) continue;
      if (a.mesh === b.mesh || a.axis !== b.axis || a.dir !== b.dir || Math.abs(a.c - b.c) > EPS) continue;
      if (a.mesh.id > b.mesh.id && inRegion(b.mesh)) continue; // count each pair once
      const ox = overlap(a, b);
      if (ox[0] <= 0 || ox[1] <= 0 || ox[0] * ox[1] < MIN_AREA) continue;
      if (looks(a.mesh) === looks(b.mesh)) continue;
      // A bottom face resting on the floor, or any face pressed against a solid behind it, is never seen.
      if (a.axis === 1 && a.dir === -1 && a.c < 0.01) continue;
      if (hidden(a, ox) || hidden(b, ox)) continue;
      const key = `${a.mesh.name || a.mesh.geometry.type} vs ${b.mesh.name || b.mesh.geometry.type} on ${'xyz'[a.axis]}=${a.c.toFixed(3)} facing ${a.dir > 0 ? '+' : '-'}`;
      const at = `(${a.mesh.position.x.toFixed(1)}, ${a.mesh.position.y.toFixed(1)}, ${a.mesh.position.z.toFixed(1)})`;
      problems.set(`${key} near ${at}`, ox[0] * ox[1]);
    }
  }
  map.dispose();
  assert.deepEqual([...problems.entries()].map(([k, v]) => `${k}: ${v.toFixed(3)} m2`), [], 'these surfaces share a plane and would flicker');
});
