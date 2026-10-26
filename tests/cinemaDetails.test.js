import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js';
import { headlessGame } from './helpers/headlessGame.js';
import { cinema as C } from '../src/config/cinema.js';
import { cinemaDetails as D } from '../src/config/cinemaDetails.js';
import { createMapKit } from '../src/world/mapKit.js';
import { createLookKit } from '../src/maps/mall/lookKit.js';
import { buildCinemaDetails } from '../src/maps/mall/cinemaDetails.js';
import { batchStatic } from '../src/world/staticBatch.js';
import { areaAt, visibleAreas } from '../src/fx/roomCulling.js';

const Y = 6.3;
function make() {
  const kit = createMapKit(new THREE.Group(), []), looks = createLookKit({ kit, colliders: kit.colliders });
  for (const [id, r] of [['lobby', C.lobby], ['screen', C.auditorium], ['passage', C.passage]])
    kit.box(r.minX, Y - .3, r.minZ, r.maxX, Y, r.maxZ, kit.mat(C.colors.carpet), { collide: false, name: `cinema_floor_${id}` });
  const details = buildCinemaDetails({ kit, looks, layout: C, floorY: Y }); return { kit, details };
}
const space = (x0, z0, x1, z1, height = 2.7) => new THREE.Box3(new THREE.Vector3(x0, Y + .08, z0), new THREE.Vector3(x1, Y + height, z1));

test('cinema dressing leaves real triangles clear of doors, fighting lanes, vents and the display vault', () => {
  const { kit } = make(), spaces = [
    space(-22.7, -3.8, -19.4, -2.0), space(-40.4, 4.8, -37.8, 6.5), space(-23.1, 4.8, -20.9, 6.5),
    space(-24.8, 22.4, -22.8, 25.0), space(-41.1, 7.2, -40.3, 26.7),
    space(-33.5, 8.5, -32.5, 23.0), space(-23.0, 6.6, -21, 26.2),
    new THREE.Box3(new THREE.Vector3(-35, Y + C.island.height + .08, -4.4), new THREE.Vector3(-32, Y + 2.7, -.7)),
    space(-40.2, C.seats.rows[0][1] + .05, -25.4, C.seats.rows[1][0] - .1),
  ];
  for (const s of C.spawns) spaces.push(space(s.x - .42, s.z - .42, s.x + .42, s.z + .42, 2.2));
  const tri = new THREE.Triangle(); let count = 0;
  kit.group.updateMatrixWorld(true); kit.group.traverse(m => {
    assert.ok(!m.isLight, 'no extra lights');
    if (!m.isMesh || m.name.startsWith('cinema_floor') || m.name === 'cinema_projector_beam') return;
    const p = m.geometry.attributes.position, index = m.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      [tri.a, tri.b, tri.c].forEach((v, j) => v.fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(m.matrixWorld));
      assert.ok([tri.a, tri.b, tri.c].every(v => v.toArray().every(Number.isFinite)));
      for (const b of spaces) assert.ok(!b.intersectsTriangle(tri), `${m.name} intrudes near ${tri.a.toArray()}`);
      count++;
    }
  });
  assert.ok(count > 1000); assert.equal(kit.colliders.length, 0); kit.dispose();
});

test('cinema details batch within a small budget and all presentation resources are owned by the map', ctx => {
  const { kit } = make(); let triangles = 0; const resources = new Set();
  kit.group.traverse(m => {
    if (!m.isMesh) return;
    triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
    resources.add(m.geometry); resources.add(m.material); if (m.material.map) resources.add(m.material.map);
  });
  const disposed = new Set(); for (const r of resources) r.addEventListener('dispose', () => disposed.add(r));
  kit.dispose(); assert.equal(disposed.size, resources.size);
  const b = make(); batchStatic(b.kit.group); let meshes = 0;
  b.kit.group.traverse(m => { if (m.isMesh) meshes++; });
  assert.ok(triangles < D.budgets.triangles, `${triangles} triangles`); assert.ok(meshes < D.budgets.meshes, `${meshes} meshes`);
  assert.ok(b.details.screen.parent && b.details.beam.parent, 'animated presentation survives batching');
  b.details.update(C.presentation.slideSeconds + .1); assert.equal(b.details.screen.userData.slideIndex, 1);
  ctx.diagnostic(`${triangles} detail triangles / ${meshes} meshes after isolated batching`); b.kit.dispose();
});

test('cinema has its three combat rooms plus the stairwell and return portals', () => {
  const t = headlessGame(), { g } = t, camera = new THREE.PerspectiveCamera(75, 16 / 9, .05, 200);
  const params = { areas: g.map.cullAreas, portals: g.map.cullPortals, camera };
  camera.position.set(-22, Y + 1.6, 1); camera.lookAt(-18, Y + 1.6, -2.9); camera.updateMatrixWorld();
  assert.equal(areaAt(params.areas, camera.position).id, 'cinemaLobby');
  assert.ok(!visibleAreas({ ...params, isOpen: () => false }).has('level2'));
  assert.ok(visibleAreas({ ...params, isOpen: () => true }).has('level2'));
  for (const [x, z, id] of [[-33, 15, 'cinemaScreen'], [-22, 15, 'cinemaPassage']])
    assert.equal(areaAt(params.areas, new THREE.Vector3(x, Y + 1.6, z)).id, id);
  assert.equal(params.portals.filter(p => p.a.startsWith('cinema')).length, 7);
  g.map.dispose();
});

test('the real Promenade trim and cinema dressing do not bridge the open entrance', () => {
  const t = headlessGame(), { g } = t, opening = space(-20.42, -3.85, -19.75, -1.95, 2.4);
  const tri = new THREE.Triangle(); g.map.group.updateMatrixWorld(true);
  g.map.group.traverse(m => {
    if (!m.isMesh) return;
    // The shutter is intentionally present while closed; this assertion checks
    // the surrounding fixed geometry, especially the old orange wall stripe.
    for (let a = m; a; a = a.parent) if (a.userData.kind === 'shutter') return;
    if (m.geometry.type !== 'BoxGeometry' && m.geometry.type !== 'PlaneGeometry') return;
    const p = m.geometry.attributes.position, index = m.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      [tri.a, tri.b, tri.c].forEach((v, j) => v.fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(m.matrixWorld));
      assert.ok(!opening.intersectsTriangle(tri), `${m.name} spans the entrance near ${tri.a.toArray()}`);
    }
  });
  g.map.dispose();
});
