import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bossTypes } from '../src/config/bosses.js';
import { Zombie } from '../src/zombies/zombie.js';
import { castShot } from '../src/weapons/hitscan.js';
import { ANATOMY_GEOMETRIES } from '../src/zombies/zombieModel.js';

test('Skylar keeps a shootable face beside the compact rig in idle, moving and flash poses', (t) => {
  const zombie = new Zombie({ type: bossTypes.influencer, health: 1000, position: new THREE.Vector3(), yaw: 0 });
  t.after(() => zombie.model.dispose());
  zombie.setState('chasing');
  for (const [speed, windup] of [[0, null], [zombie.speed, null], [0, zombie.type.flash.windupSeconds / 2], [0, 0]]) {
    zombie.velocity.z = speed;
    zombie.phoneFlashWindup = windup;
    zombie.model.update(0.1, zombie, 1);
    zombie.model.root.updateWorldMatrix(true, true);
    zombie.updateHitboxes();
    const neck = zombie.model.root.getObjectByName('head');
    const face = neck.localToWorld(new THREE.Vector3(0, 0.18, -0.17));
    const origin = face.clone().add(new THREE.Vector3(0, 0, -4));
    const direction = new THREE.Vector3(0, 0, 1);
    const shot = castShot(origin, direction, 6, [], [zombie]);
    assert.equal(shot.part, 'head');
    const visible = new THREE.Raycaster(origin, direction).intersectObject(zombie.model.root, true)[0];
    assert.ok(visible, 'the headshot ray also meets the visible face');
    let bone = visible.object;
    while (bone && bone !== neck) bone = bone.parent;
    assert.equal(bone, neck, 'the phone and outfit do not obscure the face');
    const rig = zombie.model.root.getObjectByName('skylarPhoneRig');
    const bounds = new THREE.Box3().setFromObject(rig);
    assert.ok(bounds.min.x > zombie.hitboxes[0].box.max.x, 'the rig remains beside the head');
  }
});

test('Skylar animates her ponytail and flash pose and disposes every costume buffer', () => {
  const scene = new THREE.Scene();
  const zombie = new Zombie({ type: bossTypes.influencer, health: 1000, position: new THREE.Vector3(), yaw: 0 });
  scene.add(zombie.model.root);
  zombie.setState('chasing');
  zombie.model.update(0, zombie, 1);
  const phone = zombie.model.root.getObjectByName('skylarPhoneRig');
  const idle = phone.quaternion.clone();
  zombie.phoneFlashWindup = 0;
  zombie.model.update(0, zombie, 1);
  assert.ok(phone.quaternion.angleTo(idle) > 0);
  const tail = zombie.model.root.getObjectByName('skylarPonytail');
  zombie.velocity.z = zombie.speed;
  zombie.model.update(0.15, zombie, 1);
  const before = tail.quaternion.clone();
  zombie.model.update(0.15, zombie, 1);
  assert.ok(tail.quaternion.angleTo(before) > 0);

  const geometries = new Set(), materials = new Set();
  zombie.model.root.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.material) materials.add(node.material);
  });
  // The stock anatomy buffers are shared. Costume and merged buffers belong to this model.
  let disposedGeometry = 0, disposedMaterials = 0;
  const shared = new Set(Object.values(ANATOMY_GEOMETRIES));
  const owned = [...geometries].filter(geometry => !shared.has(geometry));
  for (const geometry of owned) geometry.addEventListener('dispose', () => { disposedGeometry += 1; });
  for (const material of materials) material.addEventListener('dispose', () => { disposedMaterials += 1; });
  zombie.model.dispose();
  assert.equal(zombie.model.root.parent, null);
  assert.ok(owned.length > 0);
  assert.equal(disposedGeometry, owned.length);
  assert.equal(disposedMaterials, materials.size);
});
