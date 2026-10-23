import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createImpactMarks } from '../src/fx/impactMarks.js';
import { impacts } from '../src/config/impacts.js';
import { weapons } from '../src/config/weapons.js';
import { castShot } from '../src/weapons/hitscan.js';

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
  assert.equal(f.marks.count, 5);
  assert.equal(f.group.children.length, 5, 'one instanced draw per signature/variant used');
  assert.equal(new Set(f.group.children.map((m) => m.name.split(':')[0])).size, 5);
  const matrix = new THREE.Matrix4(), normal = new THREE.Vector3();
  for (let slot = 0; slot < 5; slot++) {
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
  f.map.removeFromParent(); f.marks.update(); assert.equal(f.marks.count, 0);
  let freed = 0;
  for (const m of batches) {
    m.geometry.addEventListener('dispose', () => freed++);
    m.material.addEventListener('dispose', () => freed++);
  }
  f.marks.dispose(); assert.equal(freed, batches.length * 2); assert.equal(f.group.parent, null);
});

test('marks follow the surface transform without adding gameplay objects', () => {
  const f = fixture(); f.add(); f.wall.position.x += 2; f.marks.update();
  const matrix = new THREE.Matrix4(); f.group.children[0].getMatrixAt(0, matrix);
  assert.ok(Math.abs(matrix.elements[12] - 2) < 1e-5);
  assert.equal(f.map.children.length, 1, 'marks are not physical map geometry'); f.marks.dispose();
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

test('real guns leave world signatures without paying points/hits; Cannon is capped and Play again clears them', () => {
  for (const def of Object.values(weapons)) {
    const t = headlessGame(), { g } = t;
    t.tick(); g.zombies.clear(); g.rounds.update = () => {};
    if (def.id !== 'stapleGun') { g.gun.give(def); t.tick(40); }
    t.standAt(2, 12, -90);
    const points = g.wallet.points, ammo = g.gun.weapon.magazine;
    t.press('Mouse0');
    assert.equal(g.runStats.shotsFired, 1, def.id); assert.equal(g.runStats.shotsHit, 0);
    assert.equal(g.wallet.points, points); assert.equal(g.gun.weapon.magazine, ammo - 1);
    assert.ok(g.effects.counts.marks >= 1, `${def.id}: real wall impact`);
    assert.ok(g.effects.counts.marks <= (def.pellets ? impacts.maxPelletMarks : 1));
    g.resetRun(); assert.equal(g.effects.counts.marks, 0);
  }
});
