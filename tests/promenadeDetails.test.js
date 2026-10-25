import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { createMapKit } from '../src/world/mapKit.js';
import { createLookKit } from '../src/maps/mall/lookKit.js';
import { buildPromenadeDetails } from '../src/maps/mall/promenadeDetails.js';
import { batchStatic } from '../src/world/staticBatch.js';
import { areaAt, visibleAreas } from '../src/fx/roomCulling.js';
import { headlessGame } from './helpers/headlessGame.js';

const Y = LAYOUT.hallway.height + .3;
function make() {
  const kit = createMapKit(new THREE.Group(), []);
  const looks = createLookKit({ kit, colliders: kit.colliders });
  buildPromenadeDetails({ kit, looks, layout: LAYOUT.level2, floorY: Y });
  return kit;
}
const region = (x0, z0, x1, z1, h = 2.9) => new THREE.Box3(new THREE.Vector3(x0, Y + .05, z0), new THREE.Vector3(x1, Y + h, z1));

test('authored details keep actual triangles clear of fighting lanes, entrances, vents, vaults and expansion approaches', () => {
  const kit = make(), spaces = [
    region(-19.3, -3.5, 19.3, -2.7), // full southern sprint/slide lane
    region(10.7, -2.8, 11.5, 4.3), region(16.7, -2.8, 17.5, 4.3),
    region(10.7, 3.2, 18, 4.0), region(12.5, 3.8, 13.5, 6.4),
    region(-7.35, 7.2, -6.65, 10.0), // display vault with full standing headroom
  ];
  for (const e of LAYOUT.level2.shoeStore.entrances) spaces.push(region(e.from + .2, 4.8, e.to - .2, 7.6));
  for (const c of LAYOUT.level2.expansionConnections) spaces.push(c.wall === 'north'
    ? region(c.from + .1, 4.5, c.to - .1, 5.65, 2.4)
    : region(c.wall === 'west' ? -19.7 : 18.4, c.from + .2, c.wall === 'west' ? -18.4 : 19.7, c.to - .2));
  for (const v of LAYOUT.level2.vents) {
    const x = v.wall === 'east' ? 19.2 : v.at;
    const z = v.wall === 'south' ? -3.7 : v.wall === 'north' ? 5.2 : v.at;
    spaces.push(region(x - .45, z - .45, x + .45, z + .45, 2.3));
  }
  kit.group.updateMatrixWorld(true);
  const tri = new THREE.Triangle();
  let checked = 0;
  kit.group.traverse(m => {
    assert.ok(!m.isLight, 'no additional real lights');
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position, index = m.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      [tri.a, tri.b, tri.c].forEach((v, j) => v.fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(m.matrixWorld));
      assert.ok([tri.a, tri.b, tri.c].every(v => v.toArray().every(Number.isFinite)));
      for (const b of spaces) assert.ok(!b.intersectsTriangle(tri), `${m.name} enters a protected route near ${tri.a.toArray()}`);
      checked++;
    }
  });
  assert.ok(checked > 1000); assert.equal(kit.colliders.length, 0);
  kit.dispose();
});

test('detail resources are map-owned and the static display remains within a small rendering budget', ctx => {
  const kit = make(), resources = new Set(); let triangles = 0;
  kit.group.traverse(m => {
    if (!m.isMesh) return;
    resources.add(m.geometry); resources.add(m.material);
    if (m.material.map) resources.add(m.material.map);
    triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
  });
  const disposed = new Set();
  for (const r of resources) r.addEventListener('dispose', () => disposed.add(r));
  kit.dispose(); assert.equal(disposed.size, resources.size);
  assert.ok(triangles < 10000, `${triangles} triangles`);
  const batched = make(); batchStatic(batched.group); let meshes = 0;
  batched.group.traverse(m => { if (m.isMesh) meshes++; });
  assert.ok(meshes < 65, `${meshes} meshes after batching`);
  ctx.diagnostic(`${triangles} detail triangles; ${meshes} meshes after isolated static batching (includes the neon sign)`);
  batched.dispose();
});

test('room culling includes the wider lane and shoe-store room and shows both entrances from inside', () => {
  const t = headlessGame(), { g } = t;
  const cam = new THREE.PerspectiveCamera(75, 16 / 9, .05, 200);
  cam.position.set(-8, Y + 1.6, 9.9); cam.lookAt(-7, Y + 1.6, 4); cam.updateMatrixWorld();
  assert.equal(areaAt(g.map.cullAreas, cam.position)?.id, 'shoePer');
  assert.equal(areaAt(g.map.cullAreas, new THREE.Vector3(14, Y + 1.6, -3.1))?.id, 'level2');
  const visible = visibleAreas({ areas: g.map.cullAreas, portals: g.map.cullPortals, camera: cam, isOpen: () => false });
  assert.ok(visible.has('shoePer') && visible.has('level2'), 'shop and visible promenade draw together');
  assert.equal(g.map.cullPortals.filter(p => p.a === 'level2' && p.b === 'shoePer').length, 2);
  g.map.dispose();
});
