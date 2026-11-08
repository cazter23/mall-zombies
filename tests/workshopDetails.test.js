// The Build-A-Blaster detail pass (maps/mall/workshopDetails.js): it dresses the room without getting in the way of playing in it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { feel } from '../src/config/feel.js';
import { overlapsSolid } from '../src/world/collision.js';
import { areaAt } from '../src/fx/roomCulling.js';
import { collectPointLights } from '../src/fx/lightPool.js';
import { batchStatic } from '../src/world/staticBatch.js';

const Y = LAYOUT.hallway.height + .3;
const W = LAYOUT.level2.workshop, H = W.hall, I = H.island;
const detailMeshes = (g) => { const list = []; g.map.group.traverse(o => { if (o.userData.workshopDetail || o.name?.startsWith('workshop_detail_')) list.push(o); }); return list; };

test('the solid pieces stay in corners and against walls: a lane of at least 2.5 m all round the island', () => {
  const { g } = headlessGame();
  const solids = g.colliders.filter(b => b.workshopDetail);
  assert.ok(solids.length >= 4, 'lockers, bales, cart, bin');
  const lane = 2.5;
  for (const b of solids) {
    const inBand = b.max.x > I.minX - lane && b.min.x < I.maxX + lane && b.max.z > I.minZ - lane && b.min.z < I.maxZ + lane;
    assert.ok(!inBand, `a collider at ${b.min.toArray()}..${b.max.toArray()} narrows a lane`);
  }
  g.map.dispose();
});

test('anything solid is either too tall to stand on or a vaultable counter', () => {
  const { g } = headlessGame();
  for (const b of g.colliders.filter(c => c.workshopDetail)) {
    const height = b.max.y - Y;
    assert.ok(height >= 2.1 || (b.vaultable && height <= 1.1), `${height.toFixed(2)} m tall at ${b.min.toArray()}`);
  }
  g.map.dispose();
});

test('the spots the game uses stay clear: entrances, bench, booth, lever, chute landings', () => {
  const { g } = headlessGame();
  const bench = g.map.features.find(f => f.kind === 'workshop');
  const st = bench.stations;
  const clear = (x, z, radius = feel.player.radius) => !overlapsSolid(new THREE.Vector3(x, Y, z), radius, feel.player.height, g.colliders, feel.movement.stepTolerance);
  for (const e of W.entrances) for (const z of [6.6, 7.4, 8.4]) assert.ok(clear((e.from + e.to) / 2, z), `entrance at z ${z}`);
  assert.ok(clear(bench.position.x, bench.position.z - 1), 'in front of the bench');
  assert.ok(clear(st.booth.x - .8, st.booth.z), 'in front of the booth');
  assert.ok(clear(st.lever.x - .8, st.lever.z), 'by the lever');
  for (const spot of st.chute) assert.ok(clear(spot.position.x, spot.position.z, .45), 'a chute landing');
  g.map.dispose();
});

test('every detail sits inside the shop or the hall, so room culling skips it when you can\'t see the room', () => {
  const { g } = headlessGame();
  const meshes = detailMeshes(g);
  assert.ok(meshes.length > 100, `${meshes.length} details`);
  const box = new THREE.Box3();
  for (const mesh of meshes) {
    box.setFromObject(mesh);
    const centre = box.getCenter(new THREE.Vector3());
    const area = areaAt(g.map.cullAreas, centre);
    // (The window decal sits in the storefront's front wall, between rooms: always drawn, which is fine for one sign.)
    const inFrontWall = centre.z >= LAYOUT.level2.rect.maxZ && centre.z <= LAYOUT.level2.rect.maxZ + LAYOUT.wallThickness;
    assert.ok(['workshop', 'workshopHall'].includes(area?.id) || inFrontWall, `${mesh.name} at ${centre.toArray().map(v => v.toFixed(2))} is in ${area?.id}`);
  }
  g.map.dispose();
});

test('it adds no lights, and stays inside a draw budget once batched', () => {
  const { g } = headlessGame();
  const lights = collectPointLights(g.map.group).filter(l => {
    const p = l.getWorldPosition(new THREE.Vector3());
    return ['workshop', 'workshopHall'].includes(areaAt(g.map.cullAreas, p)?.id);
  });
  assert.equal(lights.length, 3, 'the storefront lamp and the two hall lamps, as before');
  let triangles = 0;
  for (const mesh of detailMeshes(g)) {
    const count = (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    triangles += count * (mesh.isInstancedMesh ? mesh.count : 1);
  }
  assert.ok(triangles < 20000, `${Math.round(triangles)} triangles`);
  batchStatic(g.map.group);
  let draws = 0;
  g.map.group.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.userData.workshopDetail) draws++; });
  assert.ok(draws < 140, `${draws} detail draws still separate after batching`);
  g.map.dispose();
});
