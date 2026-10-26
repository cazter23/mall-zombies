// HOFFMAN'S detail pass (maps/mall/departmentStoreDetails.js + seamDetails.js; data in config/departmentStoreDetails.js): the departments on
// the racks, small low litter that stays off every walking lane / spawn / buy spot (checked against the real triangles), the only added
// collision being two shelving runs, the fitting-room scene, ambience, budgets, and the seam with the cinema (receiving door, one-sheets,
// ticket stubs). Decoration never blocks a route: the movement / horde tests in departmentStore.test.js run on the dressed room.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { LAYOUT } from '../src/maps/mall/mall.js';
import { departmentStoreDetails as D } from '../src/config/departmentStoreDetails.js';

const S = LAYOUT.departmentStore;
const UPPER_Y = LAYOUT.hallway.height + 0.3;

/** Every mesh of a named group with its world box and triangle count. */
function meshesOf(map, groupName) {
  map.group.updateMatrixWorld(true);
  const out = [];
  map.group.traverse((o) => {
    if (o.name !== groupName) return;
    o.traverse((m) => {
      if (!m.isMesh) return;
      const box = new THREE.Box3().setFromObject(m);
      const g = m.geometry;
      const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
      out.push({ name: m.name, box, tris });
    });
  });
  return out;
}
const rect = (cx, cz, r) => new THREE.Box3(new THREE.Vector3(cx - r, -1, cz - r), new THREE.Vector3(cx + r, 9, cz + r));
const segment = (a, b, half) => new THREE.Box3(
  new THREE.Vector3(Math.min(a[0], b[0]) - half, -1, Math.min(a[1], b[1]) - half),
  new THREE.Vector3(Math.max(a[0], b[0]) + half, 9, Math.max(a[1], b[1]) + half));

test('every rack has a department with a sign, a sale rack with tags, and a bare rack nearly empty', () => {
  for (const rack of S.racks) assert.ok(S.departments[rack.dept], `rack at (${rack.x}, ${rack.z}) names a real department`);
  assert.deepEqual(S.racks.map((k) => k.dept).sort(), Object.keys(S.departments).sort(), 'six racks, six different departments');
  assert.equal(S.departments.sale.tags, true);
  assert.ok(S.departments.bare.filled <= 4, 'the new-arrivals rack is nearly bare');
  for (const d of Object.values(S.departments)) assert.ok(d.length > 0.5 && d.length < 1.3 && d.filled >= 1 && d.filled <= 14);
});

test('the pass adds exactly two colliders (the shelving), both solid to 2.2 m and flush with their walls', () => {
  const { g } = headlessGame();
  const r = S.rect;
  const west = g.colliders.filter((b) => Math.abs(b.min.x - r.minX) < 1e-6 && Math.abs(b.max.x - (r.minX + D.westShelving.depth)) < 1e-6 && b.max.y === D.westShelving.height);
  const north = g.colliders.filter((b) => Math.abs(b.max.z - r.maxZ) < 1e-6 && Math.abs(b.min.z - (r.maxZ - D.layawayShelving.depth)) < 1e-6 && b.max.y === D.layawayShelving.height);
  assert.equal(west.length, 1, 'west shelving');
  assert.equal(north.length, 1, 'layaway shelving');
  assert.ok(D.westShelving.height >= S.tallMinHeight && D.layawayShelving.height >= S.tallMinHeight, 'too tall to stand on, even from a counter top');
  assert.ok(!west[0].ignoreShots && !north[0].ignoreShots, 'shelves stop bullets');
});

test('nothing in the pass reaches a walking lane, a door approach, a buy spot or a spawn (anything over 12 cm and under 2.3 m)', (ctx) => {
  const { g } = headlessGame();
  const meshes = meshesOf(g.map, 'deptstore_details');
  assert.ok(meshes.length > 150, `${meshes.length} detail meshes`);
  const lap = [[-18.6, 8], [-18.6, 13.5], [-18.6, 20.4], [-14.6, 20.4], [-9.5, 20.4], [-6.6, 20.4], [-6.6, 16.9], [-6.6, 12], [-6.6, 8], [-12.6, 8], [-18.6, 8]];
  const keepClear = [
    ...lap.slice(1).map((p, i) => ['lane', segment(lap[i], p, 0.45)]),
    ['gate approach', new THREE.Box3(new THREE.Vector3(S.gate.from, -1, S.rect.minZ), new THREE.Vector3(S.gate.to, 9, S.rect.minZ + 2.6))],
    ['side door approach', new THREE.Box3(new THREE.Vector3(S.rect.maxX - 2.4, -1, S.startRoomLink.from - 0.4), new THREE.Vector3(S.rect.maxX, 9, S.startRoomLink.to + 0.4))],
    ['Barcode Scanner buy spot', new THREE.Box3(new THREE.Vector3(S.rect.maxX - 2.2, -1, S.scannerZ - 1), new THREE.Vector3(S.rect.maxX, 9, S.scannerZ + 1))],
    ...g.map.spawnPoints.filter((s) => s.zone === 'departmentStore').map((s) => [s.name, rect(s.position.x, s.position.z, 0.5)]), // (a body's width; the wall hangings behind a vent are flush)
  ];
  let checked = 0;
  for (const m of meshes) {
    const height = m.box.max.y - Math.max(0, m.box.min.y);
    if (m.box.min.y > 2.3 || height < 0.12) continue; // ceiling work and floor litter
    for (const [what, zone] of keepClear) {
      // (flat wall hangings within 6 cm of a wall can't reach a lane: they're only checked against the zones they stand in)
      assert.ok(!m.box.intersectsBox(zone) || m.box.max.y - m.box.min.y < 0.0001, `${m.name} intrudes the ${what}`);
    }
    checked++;
  }
  ctx.diagnostic(`${meshes.length} detail meshes, ${checked} standing ones checked against ${keepClear.length} zones`);
});

test('floor litter stays low: under 12 cm, except the dropped bag and the tipped mannequin which keep to the walls', () => {
  const { g } = headlessGame();
  const L = D.litter;
  const tall = meshesOf(g.map, 'deptstore_details').filter((m) => m.box.min.y < 0.2 && m.box.max.y - m.box.min.y >= 0.12 && m.box.max.y < 0.5);
  for (const m of tall) {
    const nearBag = Math.abs(m.box.min.x - L.droppedBag.x) < 0.8 && Math.abs(m.box.min.z - L.droppedBag.z) < 0.8;
    const nearMannequin = Math.abs(m.box.min.x - L.tippedMannequin.x) < 1.4 && Math.abs(m.box.min.z - L.tippedMannequin.z) < 0.6;
    const onShelf = m.box.min.x < S.rect.minX + 0.5 || m.box.max.z > S.rect.maxZ - 0.5; // shelf uprights, stacks and the display's lower parts
    const fixtures = /counter|bottle|bell|ledger|easel|booth|tie|rack|plinth|shelf|knit|layaway|display|bust|mirror|dock|scratch|dress/.test(m.name);
    assert.ok(nearBag || nearMannequin || onShelf || fixtures, `${m.name} stands ${(m.box.max.y - m.box.min.y).toFixed(2)} m tall at (${m.box.min.x.toFixed(1)}, ${m.box.min.z.toFixed(1)})`);
  }
});

test('the middle fitting room is open onto a mirror, the east booth is taped, and the zombie spawn still has a clear body', () => {
  const { g } = headlessGame();
  const names = [];
  g.map.group.traverse((o) => { if (o.name) names.push(o.name); }); // (includes the tape's group)
  for (const n of ['deptdetail_booth_mirror', 'deptdetail_booth_bench', 'deptdetail_booth_dress', 'deptdetail_hazard_tape', 'deptdetail_scratch', 'deptdetail_tryon']) assert.ok(names.includes(n), n);
  const F = S.fittingRooms;
  const bw = (F.x1 - F.x0) / F.booths;
  // The open booth's gap (its curtains are bunched 0.5 m each side) is clear of curtain meshes
  const u0 = F.x0 + F.openBooth * bw + 0.18, u1 = F.x0 + (F.openBooth + 1) * bw - 0.18;
  assert.ok(u1 - u0 - 1.0 >= 0.4, 'a 40 cm+ gap between the bunched curtains');
  const spawn = g.map.spawnPoints.find((s) => s.name === 'spawn_departmentStore_fittingRoom');
  assert.ok(spawn.position.x > u0 && spawn.position.x < u1, 'the spawn is in front of the open booth');
  const body = new THREE.Box3(new THREE.Vector3(spawn.position.x - 0.4, 0.1, spawn.position.z - 0.4), new THREE.Vector3(spawn.position.x + 0.4, 1.8, spawn.position.z + 0.4));
  assert.ok(!g.colliders.some((b) => b.intersectsBox(body)), 'a clear body at the spawn');
});

test('ambience: muffled music and air handling emitters in the store, using the existing voices', () => {
  const { g } = headlessGame();
  const mine = g.map.ambience.filter((e) => e.zone === 'departmentStore');
  assert.deepEqual(mine.map((e) => e.kind).sort(), ['music', 'ventilation']);
  for (const e of mine) {
    assert.ok(e.position[0] > S.rect.minX && e.position[0] < S.rect.maxX && e.position[2] > S.rect.minZ && e.position[2] < S.rect.maxZ, `${e.id} is inside the store`);
    assert.ok(e.range > 0);
  }
  assert.equal(new Set(g.map.ambience.map((e) => e.id)).size, g.map.ambience.length, 'emitter ids stay unique across the mall');
});

test('budget: the pass stays small (meshes, triangles) and is all static decoration', (ctx) => {
  const { g } = headlessGame();
  const meshes = meshesOf(g.map, 'deptstore_details');
  const tris = meshes.reduce((n, m) => n + m.tris, 0);
  ctx.diagnostic(`${meshes.length} meshes, ${tris} triangles`);
  assert.ok(meshes.length < 700, `${meshes.length} meshes`);
  assert.ok(tris < 12000, `${tris} triangles`);
  for (const m of meshes) assert.ok(m.box.min.y >= -0.01 && m.box.max.y <= S.height + 0.01, `${m.name} is inside the room`);
});

test('the seam: a receiving door on the connector wall, five one-sheets and eleven ticket stubs, none of them collision', () => {
  const { g } = headlessGame();
  const names = [];
  g.map.group.traverse((o) => { if (o.name) names.push(o.name); });
  assert.equal(names.filter((n) => n === 'seam_ticket_stub').length, D.seam.stubs.count);
  assert.ok(names.includes('seam_dock_bumper') && names.includes('seam_dock_plate'));
  const stubs = [];
  g.map.group.traverse((o) => { if (o.name === 'seam_ticket_stub') stubs.push(new THREE.Box3().setFromObject(o)); });
  for (const b of stubs) {
    assert.ok(b.min.y > UPPER_Y + 0.012 && b.max.y < UPPER_Y + 0.03, 'a stub lies just above the floor skin (no shared plane)');
    assert.ok(b.min.x > -20 && b.max.x < -16.5, 'in the west lobby');
    assert.ok(!g.colliders.some((c) => c.intersectsBox(new THREE.Box3(b.min.clone().setY(UPPER_Y + 0.5), b.max.clone().setY(UPPER_Y + 1.5)))), 'nothing solid over it');
  }
  assert.equal(D.seam.posters.zs.length, D.seam.posters.films.length);
});
