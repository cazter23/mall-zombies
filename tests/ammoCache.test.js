// The ammo cache (vending machine, game/ammoCache.js + the one in the real mall's Food Court). The mall
// draws textures on <canvas>: a do-nothing one stands in for the browser's.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ammoCacheItem } from '../src/game/features/ammoCache.js';
import { featuresOf } from '../src/game/features/index.js';
import { createInteractions } from '../src/game/interactions.js';
import { Weapon } from '../src/weapons/weapon.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { overlapsSolid } from '../src/world/collision.js';
import { createNavigation } from '../src/zombies/navigation.js';
import { zombieTypes } from '../src/config/zombies.js';

const ctx = new Proxy({}, {
  get: (target, key) => (key in target ? target[key] : (target[key] = () => ctx)),
  set: (target, key, value) => { target[key] = value; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const { buildMall } = await import('../src/maps/mall/mall.js');

const dt = 1 / feel.simulation.tickRate;

// A stand-in for the player's loadout: the gun in hand.
const loadout = (def) => ({ def, weapon: new Weapon(def, { reloadSpeed: 1 }) });
const cacheAt = { zone: 'foodCourt', position: new THREE.Vector3() };

test('the cache refills the gun in hand, whichever gun it is, for the flat price', () => {
  for (const def of [weapons.stapleGun, weapons.priceGun, weapons.nailGun]) {
    const gun = loadout(def);
    const item = ammoCacheItem({ cache: cacheAt, zones: { foodCourt: { open: true } }, gun, price: () => economy.ammoCache.price });
    assert.equal(item.available(), false, `${def.name}: full = nothing to buy`);
    gun.weapon.magazine = 1;
    gun.weapon.reserve = 3;
    assert.equal(item.available(), true, `${def.name}: low`);
    assert.equal(item.cost, economy.ammoCache.price);
    assert.ok(item.label.includes(def.name), 'the prompt says which gun it is for');
    item.use();
    assert.equal(gun.weapon.magazine, def.magazineSize);
    assert.equal(gun.weapon.reserve, def.startingReserve);
    assert.equal(item.available(), false, 'full again');
  }
});

test('the cache follows the gun in hand and only works once its area is open', () => {
  const zones = { foodCourt: { open: false } };
  const gun = loadout(weapons.stapleGun);
  gun.weapon.magazine = 0;
  const item = ammoCacheItem({ cache: cacheAt, zones, gun, price: 400 });
  assert.equal(item.available(), false, 'its area is still closed');
  zones.foodCourt.open = true;
  assert.equal(item.available(), true);
  assert.ok(item.label.includes('Staple Gun'));
  Object.assign(gun, loadout(weapons.nailGun)); // switched guns
  assert.ok(item.label.includes('Nail Gun'), 'the label follows the gun in hand');
  assert.equal(item.available(), false, 'the new gun is full');
  assert.equal(item.cost, 400, 'a plain number price works too');
});

// --- the real mall ---

function setupMall() {
  const colliders = [];
  const map = buildMall(new THREE.Scene(), colliders);
  const gun = loadout(weapons.stapleGun);
  gun.weapon.magazine = 2;
  gun.weapon.reserve = 5;
  const player = { position: new THREE.Vector3(), yaw: 0, eyeHeight: feel.player.eyeHeight };
  const input = { pressed: new Set(), isDown: () => false, actionDown: () => true, consumeAction: () => true };
  const interactions = createInteractions({ input, player, wallet: { spend: () => true, canAfford: () => true }, colliders });
  for (const cache of featuresOf(map, 'ammoCache')) interactions.add(ammoCacheItem({ cache, zones: map.zones, gun, price: 1 }));
  const open = (id) => {
    map.doors.find((d) => d.id === id).open();
    for (let t = 0; t < feel.world.shutterOpenSeconds + 0.5; t += dt) map.update(dt);
  };
  // Stand at (x, z), facing yaw, hold the button for a second, and say whether the gun got refilled.
  const tryBuy = (x, z, yaw) => {
    gun.weapon.magazine = 2;
    gun.weapon.reserve = 5;
    interactions.reset();
    player.position.set(x, 0, z);
    player.yaw = yaw;
    for (let i = 0; i < 40; i++) interactions.update(dt);
    return gun.weapon.magazine === weapons.stapleGun.magazineSize;
  };
  return { map, colliders, open, tryBuy };
}

test('the real mall has a Food Court ammo cache in front of the west wall', () => {
  const { map } = setupMall();
  assert.equal(featuresOf(map, 'ammoCache').length, 1);
  const cache = featuresOf(map, 'ammoCache')[0];
  assert.equal(cache.zone, 'foodCourt');
  assert.ok(cache.position.x < -19 && cache.position.x > -20, 'on the Food Court west wall');
  assert.deepEqual(cache.normal.toArray(), [1, 0, 0], 'faces into the room');
});

test('the cache can be bought from in front of it, but not before its door, nor through the wall', () => {
  const { map, open, tryBuy } = setupMall();
  const p = featuresOf(map, 'ammoCache')[0].position;
  const FACING_WEST = Math.PI / 2; // yaw 0 faces -Z; +90 degrees faces -X
  open('startShutter');
  assert.equal(tryBuy(p.x + 1.5, p.z, FACING_WEST), false, 'the Food Court is still closed');
  open('foodCourt');
  assert.equal(tryBuy(p.x + 1.5, p.z, FACING_WEST), true, 'standing in front of it');
  assert.equal(tryBuy(p.x + 1.5, p.z, -FACING_WEST), false, 'with your back to it');
  assert.equal(tryBuy(p.x + 6, p.z, FACING_WEST), false, 'too far away');
  open('serviceCorridor');
  // Behind the wall in the Service Corridor (x -23.3..-20.3), facing the machine, well within range.
  assert.equal(tryBuy(-21.4, p.z, -FACING_WEST), false, 'through the wall from the Service Corridor');
});

test('opening the service shortcut unlocks the cache, preserving its front-only access', () => {
  const { map, open, tryBuy } = setupMall();
  const p = featuresOf(map, 'ammoCache')[0].position;
  open('startShutter');
  open('serviceCorridor');
  assert.equal(tryBuy(p.x + 1.5, p.z, Math.PI / 2), false, 'Food Court still locked');
  open('serviceCorridorFoodCourt');
  assert.equal(map.zones.foodCourt.open, true);
  assert.equal(tryBuy(p.x + 1.5, p.z, Math.PI / 2), true, 'unchanged Food Court buy spot');
  assert.equal(tryBuy(-21.4, p.z, -Math.PI / 2), false, 'no purchase through the shared wall');
  assert.equal(tryBuy(-21.4, -12.2, -Math.PI / 2), false, 'not reachable through the new opening');
  map.dispose();
});

test('the machine is solid and too tall to climb; its front is open floor zombies can reach', () => {
  const { map, colliders, open } = setupMall();
  const p = featuresOf(map, 'ammoCache')[0].position;
  const body = colliders.find((b) => b.containsPoint(new THREE.Vector3(p.x - 0.3, 1.0, p.z)));
  assert.ok(body, 'a collider where the machine stands');
  assert.ok(body.max.y >= 1.9, 'taller than a jump peak (about 1.05m) plus a step-up');
  assert.ok(overlapsSolid(new THREE.Vector3(p.x - 0.3, 0, p.z), 0.35, 1.8, colliders, 0.3), 'you cannot stand in it');
  open('startShutter');
  open('foodCourt');
  // A zombie can walk to the spot in front of it (flow field from the player standing there).
  const shopper = zombieTypes.shopper;
  const nav = createNavigation(colliders, { radius: shopper.radius, height: shopper.height });
  const front = new THREE.Vector3(p.x + 1.2, 0, p.z);
  nav.update(dt, front);
  assert.ok(Number.isFinite(nav.distanceToTarget(0, -4)), 'the middle of the Food Court reaches the machine front');
});
