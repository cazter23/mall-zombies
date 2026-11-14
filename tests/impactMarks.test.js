import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createImpactMarks } from '../src/fx/impactMarks.js';
import { impacts } from '../src/config/impacts.js';
import { weapons } from '../src/config/weapons.js';
import { castShot } from '../src/weapons/hitscan.js';
import { seededRandom } from '../src/world/textures.js';
import { buildMall } from '../src/maps/mall/mall.js';
import { batchStatic } from '../src/world/staticBatch.js';
import { canGrid, buildTriangleGrid, gridRaycast } from '../src/fx/triangleGrid.js';

function fixture() {
  const scene = new THREE.Scene(), map = new THREE.Group(); scene.add(map);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 0.4), new THREE.MeshStandardMaterial());
  wall.position.set(0, 2, -4); map.add(wall); scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wall), origin = new THREE.Vector3(0, 1.5, 0);
  const marks = createImpactMarks(scene, [map]);
  const shot = (x = 0) => castShot(origin, new THREE.Vector3(x, 0, -3.8).normalize(), 20, [box], []);
  const add = (id = 'stapleGun', x = 0) => marks.add(id, origin, shot(x).worldHit);
  return { scene, map, wall, box, origin, marks, shot, add, group: scene.getObjectByName('impact_marks') };
}

test('each gun leaves a distinct visible signature on the real surface with its normal pointing out', () => {
  const f = fixture();
  for (const id of Object.keys(impacts.signatures)) assert.equal(f.add(id), true, id);
  const count = Object.keys(impacts.signatures).length;
  assert.equal(f.marks.count, count);
  assert.equal(f.group.children.length, count, 'one instanced draw per signature/variant used');
  assert.equal(new Set(f.group.children.map((m) => m.name.split(':')[0])).size, count);
  const matrix = new THREE.Matrix4(), normal = new THREE.Vector3();
  for (let slot = 0; slot < count; slot++) {
    f.group.children[slot].getMatrixAt(slot, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    assert.ok(Math.abs(position.z - (-3.8 + impacts.offset + slot * impacts.layerStep)) < 1e-5, 'offset above visible wall');
    normal.setFromMatrixColumn(matrix, 2).normalize(); assert.ok(normal.z > 0.99);
  }
  assert.ok(f.group.children.find((m) => m.name.includes('sticker')).material.map, 'printed price sticker');
  f.marks.dispose();
});

test('floor and ceiling marks orient outwards; unsupported edges and invisible proxy surfaces are skipped', () => {
  const f = fixture();
  for (const y of [0, 3]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 8), new THREE.MeshStandardMaterial());
    slab.position.set(0, y === 0 ? -0.1 : 3.1, 0); f.map.add(slab); slab.updateWorldMatrix(true, false);
    f.marks.refresh(); // (the map changed: its surfaces are listed again, as after a door opens)
    const box = new THREE.Box3().setFromObject(slab);
    const hit = castShot(f.origin, new THREE.Vector3(0, y === 0 ? -1 : 1, 0), 10, [box], []);
    assert.ok(f.marks.add('nailGun', f.origin, hit.worldHit));
    const slot = f.marks.count - 1, matrix = new THREE.Matrix4();
    const mesh = f.group.children.find((m) => { m.getMatrixAt(slot, matrix); return matrix.determinant() > 0.9; });
    assert.ok(mesh); mesh.getMatrixAt(slot, matrix);
    const normal = new THREE.Vector3().setFromMatrixColumn(matrix, 2).normalize();
    assert.ok(normal.y * (y === 0 ? 1 : -1) > 0.99);
  }
  assert.equal(f.add('priceGun', 3.99), false, 'sticker cannot hang over wall edge');
  f.wall.visible = false;
  assert.equal(f.add(), false, 'collision without visible geometry leaves no floating mark');
  f.marks.dispose();
});

test('misses, stopped target hits and shutters get no world mark; pierce reaching a wall does', () => {
  const f = fixture();
  const target = { isAlive: true, hitboxes: [{ box: new THREE.Box3(new THREE.Vector3(-0.3, 1, -2.2), new THREE.Vector3(0.3, 2, -1.8)), part: 'body' }] };
  const direction = new THREE.Vector3(0, 0, -1);
  assert.equal(castShot(f.origin, direction, 20, [], []).worldHit, null);
  assert.equal(castShot(f.origin, direction, 20, [f.box], [target]).worldHit, null);
  const pierced = castShot(f.origin, direction, 20, [f.box], [target], 2);
  assert.equal(pierced.target, target); assert.equal(pierced.hits.length, 1);
  assert.ok(f.marks.add('nailGun', f.origin, pierced.worldHit));
  f.box.noImpactMarks = true;
  assert.equal(f.add(), false, 'moving shutters deliberately excluded');
  f.marks.dispose();
});

test('one global cap recycles across gun types; clear reuses pools and unload removes their marks', () => {
  const f = fixture(), ids = Object.keys(impacts.signatures);
  for (let i = 0; i < impacts.maxMarks + 35; i++) assert.ok(f.add(ids[i % ids.length]));
  assert.equal(f.marks.count, impacts.maxMarks);
  assert.ok(f.group.children.every((m) => m.count <= impacts.maxMarks));
  const batches = [...f.group.children];
  f.marks.clear(); assert.equal(f.marks.count, 0); assert.equal(f.group.visible, false);
  assert.ok(f.group.children.every((m) => m.count === 0));
  for (const id of ids) assert.ok(f.add(id));
  assert.ok(f.group.children.every((m) => batches.includes(m)), 'no new mesh per impact');
  f.map.removeFromParent(); f.marks.refresh(); assert.equal(f.marks.count, 0);
  let freed = 0;
  for (const m of batches) {
    m.geometry.addEventListener('dispose', () => freed++);
    m.material.addEventListener('dispose', () => freed++);
  }
  f.marks.dispose(); assert.equal(freed, batches.length * 2); assert.equal(f.group.parent, null);
});

test('marks follow a moving (userData.dynamic) surface and go when it hides, without adding gameplay objects', () => {
  const f = fixture();
  const rig = new THREE.Group(); rig.userData.dynamic = true; f.map.add(rig); rig.add(f.wall); // (a moving part: the claw cabinet, Kevin's cart)
  f.add(); rig.position.x += 2; f.marks.update();
  const matrix = new THREE.Matrix4(); f.group.children[0].getMatrixAt(0, matrix);
  assert.ok(Math.abs(matrix.elements[12] - 2) < 1e-5);
  assert.equal(f.map.children.length, 1, 'marks are not physical map geometry');
  // A shot at where it stands NOW lands on it (a moving surface has no cached place).
  f.box.translate(new THREE.Vector3(2, 0, 0));
  assert.ok(f.marks.add('nailGun', new THREE.Vector3(2, 1.5, 0), castShot(new THREE.Vector3(2, 1.5, 0), new THREE.Vector3(0, 0, -1), 20, [f.box], []).worldHit));
  assert.equal(f.marks.count, 2);
  rig.visible = false; f.marks.update();
  assert.equal(f.marks.count, 0, 'the surface hid: its marks went with it');
  f.marks.dispose();
});

// --- The surface cache and the triangle grid: a shot must not walk the map ----------------------------------------------

test('a still surface is listed once: its marks cost nothing per frame, hiding is seen at the shot, refresh() relists', (ctx) => {
  const f = fixture();
  const walked = ctx.mock.method(f.wall, 'updateWorldMatrix');
  const scanned = ctx.mock.method(f.map, 'traverse');
  assert.ok(f.add()); assert.ok(f.add('nailGun', 1));
  assert.equal(scanned.mock.callCount(), 1, 'the map is walked for the first shot only');
  walked.mock.resetCalls(); // (listing it measured it once)
  for (let i = 0; i < 5; i++) f.marks.update();
  assert.equal(walked.mock.callCount(), 0, 'a mark on a still surface is not re-checked every frame');
  assert.deepEqual(f.marks.surfaceCounts, { still: 1, moving: 0 });

  // A decoration with no collision box, in the ray's way: 2 m in front of the wall it rejects the mark (the bullet "passed"
  // it); 2 cm proud of the wall it takes the mark. Either way the map is relisted only because refresh() said so.
  const sheet = (z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial()); m.position.set(0, 1.5, z); f.map.add(m); f.scene.updateMatrixWorld(true); return m; };
  const far = sheet(-1.8);
  assert.ok(f.add(), 'not listed yet: the shot still marks the wall');
  f.marks.refresh();
  assert.equal(f.add(), false, 'a decoration well in front of the collision point rejects the mark');
  assert.equal(f.add('nailGun', 2), true, 'a ray that misses it is unaffected');
  far.visible = false; // (hidden after it was listed, as Graphics > Small detail hides a far poster)
  assert.equal(f.add(), true, 'hidden: asked at the shot, no relisting needed');
  far.removeFromParent();
  const poster = sheet(-3.78); f.marks.refresh();
  const before = f.marks.count;
  assert.ok(f.add()); assert.equal(f.marks.count, before + 1);
  const matrix = new THREE.Matrix4(), slot = f.marks.count - 1;
  const mesh = f.group.children.find((m) => { m.getMatrixAt(slot, matrix); return matrix.determinant() > 0.9; });
  mesh.getMatrixAt(slot, matrix);
  assert.ok(Math.abs(matrix.elements[14] - (-3.78 + impacts.offset + slot * impacts.layerStep)) < 1e-5, 'the mark is on the poster, not the wall behind it');
  // Taking the poster down: refresh() also drops the mark that was on it; the marks on the wall stay.
  poster.removeFromParent(); f.marks.refresh();
  assert.equal(f.marks.count, before);
  assert.equal(scanned.mock.callCount(), 3, 'one walk per relisting that a shot then needed');
  f.marks.dispose();
});

test('the real mall: a shot ray-tests the few meshes its ray crosses, not the map; a barrier opening relists', (ctx) => {
  const scene = new THREE.Scene();
  const t = headlessGame({ scene }), { g } = t;
  t.tick(); g.zombies.clear(); g.rounds.update = () => {};
  const marks = createImpactMarks(scene, [g.map.group]);
  ctx.after(() => marks.dispose());
  const origin = new THREE.Vector3(2, 1.5, 12);
  const shot = castShot(origin, new THREE.Vector3(1, 0.02, 0).normalize(), 50, g.colliders, []);
  assert.ok(marks.add('stapleGun', origin, shot.worldHit), 'the start room wall takes a mark');
  const { still, moving } = marks.surfaceCounts;
  assert.ok(still > 1000 && moving > 0, `the mall lists ${still} still and ${moving} moving meshes`);
  const tested = ctx.mock.method(THREE.Mesh.prototype, 'raycast');
  const walked = ctx.mock.method(g.map.group, 'traverse');
  for (let i = 0; i < 5; i++) marks.add('stapleGun', origin, shot.worldHit);
  const perShot = tested.mock.callCount() / 5;
  tested.mock.restore();
  // (every moving mesh is still tested: no box is kept for those; the four corner probes test the hit mesh again)
  assert.ok(perShot <= moving + still / 20, `${perShot} meshes ray-tested per shot of ${still} still + ${moving} moving`);
  assert.equal(walked.mock.callCount(), 0, 'no walk of the map per shot');

  // The game's own marks relist when a barrier starts and finishes opening (createGame listens for both).
  const relisted = ctx.mock.method(g.effects, 'refreshSurfaces');
  g.wallet.earn(500);
  g.player.teleport({ position: new THREE.Vector3(0, 0, 8.5), yaw: 0 }); t.tick();
  assert.equal(g.interactions.prompt?.id, 'startShutter');
  t.press('KeyF', 30); t.tick(600);
  assert.ok(relisted.mock.callCount() >= 2, 'barrierOpening and barrierOpened');
});

test('the triangle grid gives exactly the hit three gives, on the batched mall and on a turned, stretched, inside-out mesh', () => {
  const scene = new THREE.Scene();
  const map = buildMall(scene, []);
  batchStatic(map.group);
  map.group.updateWorldMatrix(true, true);
  const big = [];
  map.group.traverse((o) => { if (canGrid(o, impacts.grid.minTriangles)) big.push({ mesh: o, grid: buildTriangleGrid(o.geometry, impacts.grid), box: new THREE.Box3().setFromObject(o) }); });
  assert.ok(big.length > 50, `${big.length} big meshes on the batched mall`);
  // A stretched, turned mesh in each side mode (a grid lives in the mesh's own space; a back face only counts when the material says so).
  for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) {
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.35, 64, 12), new THREE.MeshStandardMaterial({ side }));
    knot.position.set(2, 1.5, 12); knot.rotation.set(0.4, 1.1, -0.3); knot.scale.set(1.5, 0.6, 1); knot.updateMatrixWorld(true);
    assert.ok(canGrid(knot, impacts.grid.minTriangles));
    big.push({ mesh: knot, grid: buildTriangleGrid(knot.geometry, impacts.grid), box: new THREE.Box3().setFromObject(knot) });
  }
  const random = seededRandom(77), ray = new THREE.Raycaster(), origin = new THREE.Vector3(), direction = new THREE.Vector3();
  ray.layers.enableAll();
  let compared = 0, hits = 0;
  const same = (label) => {
    for (const { mesh, grid, box } of big) {
      if (!ray.ray.intersectsBox(box)) continue;
      const want = ray.intersectObject(mesh, false)[0] ?? null, got = gridRaycast(grid, mesh, ray);
      compared++;
      assert.equal(!!got, !!want, `${label}: ${mesh.name} hit or miss`);
      if (!want) continue;
      hits++;
      assert.ok(Math.abs(got.distance - want.distance) < 1e-6, `${label}: ${mesh.name} distance ${got.distance} vs ${want.distance}`);
      assert.ok(got.point.distanceTo(want.point) < 1e-6, `${label}: the same point`);
      assert.ok(got.face.normal.distanceTo(want.face.normal) < 1e-9, `${label}: the same face`);
      assert.equal(got.object, mesh);
    }
  };
  const spots = [[2, 12], [0, 2], [-15, 2], [15, 2], [0, -8], [27, -10], [20, 18], [-12, 16], [-21.5, -4], [48, -10], [0, 0.5], [-30, -2]];
  for (const [x, z] of spots) for (const y of [1.5, 7.8]) for (let i = 0; i < 30; i++) {
    origin.set(x + random() - 0.5, y, z + random() - 0.5);
    direction.set(random() * 2 - 1, (random() * 2 - 1) * 0.6, random() * 2 - 1).normalize();
    // (axis-aligned rays now and then: along the cell walls, the hard case for a grid walk)
    if (i % 6 === 0) direction.set(i % 12 === 0 ? 1 : 0, 0, i % 12 === 0 ? 0 : -1);
    ray.set(origin, direction); ray.near = 0; ray.far = 4 + random() * 40;
    same('a long ray');
    // A mark's corner probe: 8 cm, straight into the nearest surface found.
    const first = ray.intersectObjects(big.map((b) => b.mesh), false)[0];
    if (!first) continue;
    const normal = first.face.normal.clone().transformDirection(first.object.matrixWorld);
    ray.set(first.point.clone().addScaledVector(normal, impacts.edgeProbe), normal.negate()); ray.far = impacts.edgeProbe * 2;
    same('a corner probe');
  }
  assert.ok(compared > 2000 && hits > 700, `${compared} mesh rays compared, ${hits} hits`);
  map.dispose();
});

test('browser preparation compiles shared graphics without showing or spawning impacts', () => {
  const f = fixture(), camera = new THREE.PerspectiveCamera();
  let compiled = 0, textures = 0;
  f.marks.prepare({
    compile(group, view, world) { assert.equal(group, f.group); assert.equal(view, camera); assert.equal(world, f.scene); compiled++; },
    initTexture(texture) { assert.ok(texture.isTexture); textures++; },
  }, camera);
  assert.equal(compiled, 1); assert.equal(textures, impacts.signatures.priceGun.variants);
  assert.equal(f.marks.count, 0); assert.equal(f.group.visible, false);
  assert.ok(f.group.children.every((m) => m.count === 0)); f.marks.dispose();
});

test('camera-facing debug labels are ignored by the physical-surface ray', () => {
  const f = fixture();
  const label = new THREE.Sprite(new THREE.SpriteMaterial()); label.position.set(0, 1.5, -2); f.map.add(label);
  assert.ok(f.add(), 'a debug label in front of the wall never throws or catches the impact');
  f.marks.dispose(); label.material.dispose();
});

test('instanced props use the instance normal, including rotated/scaled stock', () => {
  const f = fixture(); f.map.remove(f.wall);
  const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial(), 1);
  const instance = new THREE.Matrix4().compose(new THREE.Vector3(0, 2, -4),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.04), new THREE.Vector3(8, 4, 0.4));
  wall.setMatrixAt(0, instance); f.map.add(wall); f.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wall);
  const shot = castShot(f.origin, new THREE.Vector3(0, 0, -1), 20, [box], []);
  assert.ok(f.marks.add('priceGun', f.origin, shot.worldHit));
  const matrix = new THREE.Matrix4(); f.group.children[0].getMatrixAt(0, matrix);
  const normal = new THREE.Vector3().setFromMatrixColumn(matrix, 2).normalize();
  assert.ok(Math.abs(normal.x - Math.sin(0.04)) < 1e-5); f.marks.dispose();
});

test('Cannon caps projection attempts even when every visible surface rejects residue', () => {
  const t = headlessGame(), { g } = t;
  t.tick(); g.zombies.clear(); g.rounds.update = () => {};
  g.gun.give(weapons.confettiCannon); t.tick(40); t.standAt(2, 12, -90);
  let attempts = 0; g.effects.impact = () => { attempts++; return false; };
  t.press('Mouse0'); assert.equal(attempts, impacts.maxPelletMarks);
});

test('real guns leave world signatures without paying points/hits; Cannon is capped and Play again clears them', ctx => {
  for (const def of Object.values(weapons).filter((d) => !d.cone && !d.projectile && !d.blast)) { // (a cone of wind, a thrown ball and a rocket mark no wall the way a ray does)
    const t = headlessGame(), { g } = t;
    t.tick(); g.zombies.clear(); g.rounds.update = () => {};
    if (def.id !== 'stapleGun') { g.gun.give(def); t.tick(40); }
    t.standAt(2, 12, -90);
    const points = g.wallet.points, ammo = g.gun.weapon.magazine;
    // Keep pellet spread repeatable without seeding map creation.
    const random = ctx.mock.method(Math, 'random', seededRandom(421));
    try {
      // (A charge gun, the Barcode Scanner, fires when its scan completes: hold for the scan, then let go.)
      t.press('Mouse0', def.charge ? Math.ceil(def.charge.seconds * 60) + 1 : 1);
    } finally { random.mock.restore(); }
    assert.equal(g.runStats.shotsFired, 1, def.id); assert.equal(g.runStats.shotsHit, 0);
    assert.equal(g.wallet.points, points); assert.equal(g.gun.weapon.magazine, ammo - 1);
    assert.ok(g.effects.counts.marks >= 1, `${def.id}: real wall impact`);
    assert.ok(g.effects.counts.marks <= (def.pellets ? impacts.maxPelletMarks : 1));
    g.resetRun(); assert.equal(g.effects.counts.marks, 0);
  }
});
