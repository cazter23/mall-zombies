import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createMapKit } from '../src/world/mapKit.js';
import { createShutter } from '../src/world/shutter.js';
import { shutters, shutterFinish } from '../src/config/shutters.js';
import { feel } from '../src/config/feel.js';
import { batchStatic } from '../src/world/staticBatch.js';

function fixture(alongX = true, minY = 0) {
  const group = new THREE.Group(), colliders = [];
  const s = createShutter({ name: 'test', minX: -1.5, maxX: alongX ? 1.5 : -1.2,
    minZ: 2, maxZ: alongX ? 2.3 : 5, minY, height: 3,
    material: new THREE.MeshStandardMaterial(), colliders });
  group.add(s.mesh, s.frame);
  const dispose = () => {
    const geometry = new Set(), materials = new Set();
    group.traverse(m => { if (m.geometry) geometry.add(m.geometry); if (m.material) materials.add(m.material); });
    geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  };
  return { s, group, colliders, dispose };
}

test('a rolling curtain feeds into a stationary housing without squashing slats, for both wall axes and upstairs', () => {
  for (const alongX of [true, false]) for (const minY of [0, 6.3]) {
    const t = fixture(alongX, minY), { s } = t;
    t.group.updateMatrixWorld(true);
    const frame = new THREE.Box3().setFromObject(s.frame);
    s.open(); s.update(feel.world.shutterOpenSeconds / 2);
    t.group.updateMatrixWorld(true);
    const p = s.mesh.geometry.attributes.position, uv = s.mesh.geometry.attributes.uv;
    const y = Array.from({ length: p.count }, (_, i) => p.getY(i));
    assert.ok(Math.abs(Math.max(...y) - Math.min(...y) - 1.5) < 1e-5);
    const v = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
    assert.ok(Math.abs((Math.max(...y) - Math.min(...y)) / (Math.max(...v) - Math.min(...v)) - 3) < 1e-5,
      'world metres per texture unit remains constant');
    assert.ok(Math.abs(s.mesh.position.y + Math.max(...y) - (minY + 3)) < 1e-5, 'curtain top stays in the housing');
    assert.ok(Math.abs(s.mesh.position.y + Math.min(...y) - (minY + 1.5)) < 1e-5);
    assert.deepEqual(new THREE.Box3().setFromObject(s.frame), frame, 'fixed frame never rises');
    assert.equal(t.colliders.length, 1);
    s.update(feel.world.shutterOpenSeconds / 2 + .001);
    assert.equal(s.mesh.visible, false); assert.equal(s.frame.visible, true); assert.equal(t.colliders.length, 0);
    s.close(); assert.equal(t.colliders.length, 1); s.update(feel.world.shutterOpenSeconds + .001);
    assert.equal(s.state, 'closed'); assert.equal(s.mesh.visible, true);
    assert.deepEqual(Array.from(s.mesh.geometry.attributes.uv.array).filter((_, i) => i % 2), v.map(value => value * 2));
    t.dispose();
  }
});

test('shutter collision timing, immediate closing block and reversal preserve the original rules', () => {
  const t = fixture(), { s } = t;
  const thresholdSeconds = (feel.player.height + .1) / 3 * feel.world.shutterOpenSeconds;
  s.open(); s.update(thresholdSeconds - .001); assert.equal(t.colliders.length, 1);
  s.update(.002); assert.equal(t.colliders.length, 0);
  s.close(); assert.equal(t.colliders.length, 1, 'closing blocks immediately');
  s.update(.1); s.open(); s.update(.05); s.close(); s.close();
  assert.equal(t.colliders.length, 1, 'no duplicate collider');
  s.update(10); assert.equal(s.state, 'closed');
  assert.equal(s.collider.noImpactMarks, true);
  t.dispose();
});

test('painted finishes use physical aspect ratios, fixed hardware stays outside the opening, batching/disposal retain ownership', () => {
  for (const [id, alongX] of [['startShutter', true], ['serviceCorridor', false], ['atriumPromenade', true], ['megaMart', true]]) {
    const kit = createMapKit(new THREE.Group(), []), zones = { room: { open: false } };
    const door = kit.shutterDoor({ id, label: 'Door', price: 750, opensZone: 'room', zones,
      doorway: { minX: 0, maxX: alongX ? 4 : .3, minZ: 0, maxZ: alongX ? .3 : 4, height: 3 } });
    const { mesh, frame } = door.barrier;
    assert.ok(Math.abs(mesh.material.map.image.width / mesh.material.map.image.height - 4 / 3) < .01);
    assert.equal(mesh.material.roughness, shutters.paint.roughness);
    assert.equal(kit.colliders.length, 1, 'fixed frame adds no collision');
    frame.updateMatrixWorld(true);
    const opening = new THREE.Box3(kit.colliders[0].min.clone().addScalar(.005), kit.colliders[0].max.clone().addScalar(-.005));
    frame.traverse(m => { if (m.isMesh) assert.ok(!new THREE.Box3().setFromObject(m).intersectsBox(opening), `${m.name} enters passage`); });
    const guides = frame.children.filter(m => m.name === 'shutter_guide');
    const housing = frame.children.find(m => m.name === 'shutter_roller_housing');
    for (const guide of guides) {
      const bounds = new THREE.Box3().setFromObject(guide);
      const across = alongX ? [bounds.min.x, bounds.max.x] : [bounds.min.z, bounds.max.z];
      assert.ok(across[1] < -shutters.track.frameClearance / 2 || across[0] > 4 + shutters.track.frameClearance / 2,
        'guide face does not share the wall jamb plane');
      assert.ok(bounds.min.y >= shutters.track.frameClearance && bounds.max.y <= 3 - shutters.track.frameClearance,
        'guide caps do not share the floor or lintel planes');
    }
    const housingBounds = new THREE.Box3().setFromObject(housing);
    assert.ok(housingBounds.min.y >= 3 + shutters.track.frameClearance - 1e-6,
      'roller housing underside does not share the lintel plane');
    const texture = mesh.material.map; let disposed = false; texture.addEventListener('dispose', () => { disposed = true; });
    batchStatic(kit.group); assert.ok(mesh.parent, 'curtain remains dynamic');
    door.open(); door.update(10); assert.equal(mesh.visible, false);
    door.reset(); door.update(10); assert.equal(mesh.visible, true);
    kit.dispose(); assert.equal(kit.colliders.length, 0); assert.equal(disposed, true);
  }
  assert.notEqual(shutterFinish('startShutter').accent, shutterFinish('megaMart').accent);
  for (const id of ['unknown', 'constructor', '__proto__']) assert.equal(shutterFinish(id), shutters.finishes.public);
});

function atStart() {
  const t = headlessGame(); t.tick(); t.g.rounds.update = () => {}; t.g.zombies.clear();
  t.standAt(0, 8, 0); return t;
}

test('a real door purchase plays motor/roll/stop once; pause freezes progress and debug open-all is silent', () => {
  const t = atStart(), { g } = t;
  t.press('KeyF', 30);
  assert.ok(g.map.doors.find(d => d.id === 'startShutter').isOpen);
  assert.equal(t.sounds.filter(s => s === 'shutterMotor').length, 1);
  g.state.forceRun = false; t.tick(180);
  assert.equal(t.sounds.filter(s => s === 'shutterStop').length, 0, 'no wall-clock clunk while paused');
  g.state.forceRun = true; t.tick(120);
  assert.ok(t.sounds.includes('shutterRoll'));
  assert.equal(t.sounds.filter(s => s === 'shutterStop').length, 1);
  const before = t.sounds.filter(s => s.startsWith('shutter')).length;
  g.debug.run('doors'); t.tick(120);
  assert.equal(t.sounds.filter(s => s.startsWith('shutter')).length, before);
});

test('death and Play Again cancel unfinished shutter sound sequences', () => {
  for (const action of ['death', 'reset']) {
    const t = atStart(); t.press('KeyF', 30);
    if (action === 'death') t.g.health.takeDamage(1e6); else t.g.resetRun();
    const before = t.sounds.filter(s => s.startsWith('shutter')).length;
    t.tick(150);
    assert.equal(t.sounds.filter(s => s.startsWith('shutter')).length, before, action);
  }
});

test('low destination signs remain in front of the new roller housings on both sides of the staff shortcut and upstairs', () => {
  const { g } = headlessGame();
  g.map.group.updateMatrixWorld(true);
  for (const name of ['sign_staff_shortcut', 'sign_foodcourt_exit', 'sign_atrium_promenade']) {
    const sign = g.map.group.getObjectByName(name), at = sign.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(sign.matrixWorld);
    const ray = new THREE.Raycaster(at.clone().addScaledVector(normal, .8), normal.clone().negate(), 0, 1.2);
    const first = ray.intersectObject(g.map.group, true).find(h => h.object.visible && !h.object.material?.transparent);
    assert.equal(first?.object, sign, `${name}: the cassette does not hide the destination`);
  }
});
