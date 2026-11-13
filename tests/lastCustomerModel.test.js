import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bossTypes } from '../src/config/bosses.js';
import { zombieTypes } from '../src/config/zombies.js';
import { lastCustomerLook } from '../src/config/lastCustomerLook.js';
import { Zombie } from '../src/zombies/zombie.js';
import { castShot } from '../src/weapons/hitscan.js';
import { ANATOMY_GEOMETRIES } from '../src/zombies/zombieModel.js';

const TYPE = bossTypes.lastCustomer;
const make = () => new Zombie({ type: TYPE, health: 1000, position: new THREE.Vector3(), yaw: 0 });

test('Lorraine pushes a trolley of returns the size of the Cart Pusher\'s, and it adds no hitbox', (t) => {
  const zombie = make();
  t.after(() => zombie.model.dispose());
  const trolley = zombie.model.root.getObjectByName('cart');
  assert.ok(trolley, 'her trolley is drawn');
  assert.equal(trolley.parent, zombie.model.root, 'on the root, so it stays upright when she falls');
  const bounds = new THREE.Box3().setFromObject(trolley);
  assert.ok(Math.abs(bounds.min.z - trolley.userData.noseZ) < 0.06, 'the basket nose is its front');
  assert.ok(Math.abs(-trolley.userData.noseZ - TYPE.charge.noseReach) < 0.05, 'the charge reach still matches the drawn nose');
  assert.ok(bounds.max.y > lastCustomerLook.trolley.basketTop + 0.3, 'the heap of returns (the lamp) stands above the basket');
  for (const key of ['width', 'depth', 'handleY', 'handleZ']) assert.equal(TYPE.cart[key], zombieTypes.cartPusher.cart[key], key);
  assert.equal(TYPE.cartHitbox, undefined, 'no cart hitbox: her boxes are the standing ones');
  assert.equal(zombie.hitboxes.length, 2);
  assert.equal(zombie.model.root.userData.appearance, undefined, 'her own look, not a random shopper\'s');
});

test('her pushing lean stays small, so the drawn head stays inside the standing head box', (t) => {
  const zombie = make();
  t.after(() => zombie.model.dispose());
  for (const state of ['chasing', 'chargeTelegraph', 'charging', 'crashed']) {
    zombie.setState(state);
    zombie.stateTime = state === 'crashed' ? 0.6 : TYPE.charge.telegraphSeconds;
    zombie.model.update(0.016, zombie, 1);
    zombie.model.root.updateWorldMatrix(true, true);
    zombie.updateHitboxes();
    const face = zombie.model.root.getObjectByName('head').localToWorld(new THREE.Vector3(0, 0.15, -0.15));
    const origin = face.clone().add(new THREE.Vector3(0, 0, -4));
    const shot = castShot(origin, new THREE.Vector3(0, 0, 1), 6, [], [zombie]);
    assert.equal(shot.part, 'head', state + ': a shot at her drawn face is a headshot');
  }
});

test('Speechless: her mouth drops open and her arms leave the handle, then she recovers', (t) => {
  const zombie = make();
  t.after(() => zombie.model.dispose());
  const mouth = zombie.model.root.getObjectByName('lorraineMouth');
  const left = zombie.model.root.getObjectByName('leftArm');
  zombie.setState('chasing');
  zombie.model.update(0.1, zombie, 1);
  assert.equal(mouth.visible, false);
  const pushing = left.rotation.x;
  assert.ok(Math.abs(pushing - lastCustomerLook.pushing.armAngle - lastCustomerLook.pushing.hunch) < 1e-6, 'hands on the handle');
  zombie.setState('speechless');
  for (let i = 0; i < 30; i++) zombie.model.update(0.02, zombie, 1);
  assert.equal(mouth.visible, true);
  assert.ok(Math.abs(left.rotation.x - lastCustomerLook.speechless.leftArm[0]) < 1e-6, 'a hand to her pearls');
  zombie.setState('chasing');
  for (let i = 0; i < 30; i++) zombie.model.update(0.02, zombie, 1);
  assert.equal(mouth.visible, false);
  assert.ok(Math.abs(left.rotation.x - pushing) < 1e-6, 'back on the handle');
});

test('Lorraine disposes every costume and trolley buffer', () => {
  const zombie = make();
  const geometries = new Set(), materials = new Set();
  zombie.model.root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.material) materials.add(node.material);
  });
  const shared = new Set(Object.values(ANATOMY_GEOMETRIES));
  const owned = [...geometries].filter((geometry) => !shared.has(geometry));
  let disposedGeometry = 0, disposedMaterials = 0;
  for (const geometry of owned) geometry.addEventListener('dispose', () => { disposedGeometry += 1; });
  for (const material of materials) material.addEventListener('dispose', () => { disposedMaterials += 1; });
  zombie.model.dispose();
  assert.ok(owned.length > 0);
  assert.equal(disposedGeometry, owned.length);
  assert.equal(disposedMaterials, materials.size);
});
