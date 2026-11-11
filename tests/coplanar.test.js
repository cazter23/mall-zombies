// No z-fighting (flicker) in the stores, the Customer Service booth and the RESTOCK-O-MATIC: two surfaces on the same plane, facing the same
// way, with different looks, fight over the pixels and shimmer as you move. This builds the REAL mall and checks every
// box face and sign inside the store rooms and the booth against every other: a pair is a problem if its faces lie
// within 4 mm of each other, face the same way, overlap, look different, and aren't hidden against a solid behind them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildMall, LAYOUT } from '../src/maps/mall/mall.js';
import { storeRoom } from '../src/maps/mall/stores.js';
import { clawMachine } from '../src/config/clawMachine.js';
import { kiosk } from '../src/config/kiosk.js';

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
    if (mesh.rotation.x || mesh.rotation.z) return out;
    const { width, height: h, depth } = g.parameters;
    const turns = mesh.rotation.y / (Math.PI / 2);
    if (Math.abs(turns - Math.round(turns)) > 1e-6) return out;
    const sideways = Math.abs(Math.round(turns)) % 2 === 1;
    const [w, d] = sideways ? [depth, width] : [width, depth];
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
  regions.push({ name: 'parkingLot', minX: LAYOUT.parkingLot.rect.minX - .4,
    maxX: LAYOUT.parkingLot.rect.maxX + .4, minZ: LAYOUT.parkingLot.rect.minZ - .4,
    maxZ: LAYOUT.parkingLot.rect.maxZ + .4 });
  regions.push({ name: 'booth', minX: desk.center - 2.1, maxX: desk.center + 2.1, minZ: desk.wallAt - 2.3, maxZ: desk.wallAt + 0.1 });
  const restock = LAYOUT.restockMachine; // the RESTOCK-O-MATIC, its pad and its signs
  for (const site of clawMachine.sites) { // GRAB-A-GUN's cabinets (mall/clawCabinet.js), with a margin round each
    const r = 1.9;
    regions.push({ name: `claw_${site.id}`, minX: site.back.x - r, maxX: site.back.x + r, minZ: site.back.z - r, maxZ: site.back.z + r,
      minY: site.floorY - 0.1, maxY: site.floorY + 2.6 });
  }
  for (const site of kiosk.sites) { // Kiosk Kevin's carts (mall/kioskCart.js), with a margin round each
    const r = 1.9;
    regions.push({ name: `kiosk_${site.id}`, minX: site.x - r, maxX: site.x + r, minZ: site.z - r, maxZ: site.z + r,
      minY: site.floorY - 0.1, maxY: site.floorY + 2.6 });
  }
  { // the Prize Counter booth (mall/prizeCounter.js)
    const { back } = clawMachine.prizeCounter.site, r = 1.9;
    regions.push({ name: 'prizeCounter', minX: back.x - r, maxX: back.x + r, minZ: back.z - r, maxZ: back.z + r, maxY: 2.8 });
  }
  regions.push({ name: 'restock', minX: restock.x - 1.2, maxX: restock.x + 1.2, minZ: LAYOUT.foodCourt.maxZ - 2.4, maxZ: LAYOUT.foodCourt.maxZ + 0.1 });
  const at = LAYOUT.atrium.rect; // the Grand Atrium, its fountain, kiosks and both floors
  regions.push({ name: 'atrium', minX: at.minX - 0.4, maxX: at.maxX + 0.4, minZ: at.minZ - 0.7, maxZ: at.maxZ + 0.4 });
  const ds = LAYOUT.departmentStore.rect; // HOFFMAN'S: its counters, racks, mannequins, fitting rooms, shoe wall and the gate
  regions.push({ name: 'westSide', minX: -60, maxX: -5, minZ: 6, maxZ: 30 }); // HOFFMAN'S + the cinema + the stair connector between them, every floor
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
  const apparelSigns = new Set(map.features.filter((f) => f.kind === 'wardrobeRack' || f.kind === 'fittingRoom').map((f) => f.name));
  const inRegion = (m) => apparelSigns.has(m.parent?.name) || regions.some((r) => m.position.x > r.minX && m.position.x < r.maxX && m.position.z > r.minZ && m.position.z < r.maxZ
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

// The test above reads each mesh's Euler angles, so a sign hung with a flipped rotation (atmosphere.js signs are rotated by pi round X and Z, which is
// the same as a turn round Y) is skipped, and it only looks inside listed regions. This one takes the planes' real world normals and checks EVERY
// flat sign in the mall against every axis-aligned box face: the hallway directory once flickered against a boarded vent's planks this way.
test('no sign anywhere shares a plane with a box face that faces the same way (whatever Euler angles the sign was hung with)', () => {
  const scene = new THREE.Scene();
  const map = buildMall(scene, []);
  scene.updateMatrixWorld(true);
  const boxes = [];
  const planes = [];
  const normal = new THREE.Vector3();
  const bounds = new THREE.Box3();
  map.group.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return; // (a cabinet's live model is switched off while the machine is at another site)
    if (o.geometry.type === 'BoxGeometry' && !o.rotation.x && !o.rotation.z) boxes.push(...facesOf(o));
    if (o.geometry.type !== 'PlaneGeometry' || o.material.transparent) return;
    o.getWorldDirection(normal);
    const axis = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)].findIndex((v) => v > 0.999);
    if (axis < 0 || axis === 1) return; // (only upright signs facing along x or z)
    bounds.setFromObject(o);
    const others = [0, 1, 2].filter((a) => a !== axis);
    planes.push({ axis, c: (bounds.min.getComponent(axis) + bounds.max.getComponent(axis)) / 2, dir: Math.sign(normal.getComponent(axis)),
      lo: others.map((a) => bounds.min.getComponent(a)), hi: others.map((a) => bounds.max.getComponent(a)), mesh: o });
  });
  const problems = [];
  for (const sign of planes) {
    for (const face of boxes) {
      if (face.axis !== sign.axis || face.dir !== sign.dir || Math.abs(face.c - sign.c) > EPS) continue;
      const ox = overlap(sign, face);
      if (ox[0] <= 0 || ox[1] <= 0 || ox[0] * ox[1] < MIN_AREA) continue;
      // Hidden behind something (a cabinet stood in front of a wall poster): nobody sees the two fight. A ray from 3 m out (clear of a cabinet's depth), onto the middle of the overlap.
      const others = [0, 1, 2].filter((a) => a !== sign.axis);
      const centre = new THREE.Vector3();
      others.forEach((a, i) => centre.setComponent(a, (Math.max(sign.lo[i], face.lo[i]) + Math.min(sign.hi[i], face.hi[i])) / 2));
      centre.setComponent(sign.axis, sign.c);
      const out = new THREE.Vector3().setComponent(sign.axis, sign.dir);
      const hit = new THREE.Raycaster(centre.clone().addScaledVector(out, 3), out.clone().negate(), 0, 3 - 0.02).intersectObject(map.group, true).find((h) => h.object.visible && !h.object.material?.transparent);
      if (hit) continue;
      problems.push(`${sign.mesh.name || 'sign'} at (${sign.mesh.position.x.toFixed(1)}, ${sign.mesh.position.y.toFixed(2)}, ${sign.mesh.position.z.toFixed(1)}) vs ${face.mesh.name || 'box'} (${face.mesh.material.color?.getHexString?.()} at ${face.mesh.position.toArray().map((n) => n.toFixed(2))}, parent ${face.mesh.parent?.name}) on ${'xyz'[face.axis]}=${face.c.toFixed(3)}: ${(ox[0] * ox[1]).toFixed(3)} m2`);
    }
  }
  map.dispose();
  assert.deepEqual([...new Set(problems)], [], 'these signs share a plane with a box face and would flicker');
});
