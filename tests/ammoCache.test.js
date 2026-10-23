// The ammo cache (vending machine, game/ammoCache.js + the one in the real mall's Food Court). The mall
// draws textures on <canvas>: a do-nothing one stands in for the browser's.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ammoCacheItem, ammoScreenText, buildAmmoCache } from '../src/game/features/ammoCache.js';
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
const { buildMall, LAYOUT } = await import('../src/maps/mall/mall.js');

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

// Yaw that looks AT a machine whose front faces `normal` (i.e. along -normal; yaw 0 looks along -Z, the look direction is (-sin, -cos)).
const yawToward = (normal) => Math.atan2(normal.x, normal.z);

test('the real mall has the RESTOCK-O-MATIC just inside the Food Court door, on its north wall', () => {
  const { map } = setupMall();
  assert.equal(featuresOf(map, 'ammoCache').length, 1);
  const cache = featuresOf(map, 'ammoCache')[0];
  assert.equal(cache.zone, 'foodCourt');
  const door = LAYOUT.foodCourtDoorway;
  assert.ok(cache.position.x > door.maxX && cache.position.x < door.maxX + 4, 'right beside the door, on the east side');
  assert.ok(cache.position.z < -2.3 && cache.position.z > -4.5, 'against the north wall (the hallway south wall)');
  assert.deepEqual(cache.normal.toArray(), [0, 0, -1], 'faces south, into the room');
  assert.ok(cache.screen && typeof cache.screen.show === 'function', 'it has a live screen');
});

test('the cache can be bought from in front of it, but not before its door, nor through the wall', () => {
  const { map, open, tryBuy } = setupMall();
  const cache = featuresOf(map, 'ammoCache')[0];
  const p = cache.position;
  const facing = yawToward(cache.normal); // looking at it (the direction opposite its front)
  open('startShutter');
  assert.equal(tryBuy(p.x, p.z - 1.2, facing), false, 'the Food Court is still closed');
  open('foodCourt');
  assert.equal(tryBuy(p.x, p.z - 1.2, facing), true, 'standing in front of it');
  assert.equal(tryBuy(p.x, p.z - 1.2, facing + Math.PI), false, 'with your back to it');
  assert.equal(tryBuy(p.x, p.z - 6, facing), false, 'too far away');
  // In the hallway, on the other side of the wall behind it, facing it and well within range.
  assert.equal(tryBuy(p.x, -1.0, 0), false, 'through the wall from the hallway');
  assert.equal(tryBuy(p.x, 0.5, 0), false, 'or from further back');
});

test('opening the service shortcut unlocks the cache, preserving its front-only access', () => {
  const { map, open, tryBuy } = setupMall();
  const cache = featuresOf(map, 'ammoCache')[0];
  const p = cache.position;
  const facing = yawToward(cache.normal);
  open('startShutter');
  open('serviceCorridor');
  assert.equal(tryBuy(p.x, p.z - 1.2, facing), false, 'Food Court still locked');
  open('serviceCorridorFoodCourt');
  assert.equal(map.zones.foodCourt.open, true);
  assert.equal(tryBuy(p.x, p.z - 1.2, facing), true, 'the same buy spot');
  assert.equal(tryBuy(p.x, -1.0, 0), false, 'no purchase through the wall from the hallway');
  map.dispose();
});

test('the machine is solid and too tall to climb; its front is open floor zombies can reach, and the door lane stays clear', () => {
  const { map, colliders, open } = setupMall();
  const cache = featuresOf(map, 'ammoCache')[0];
  const p = cache.position;
  const inside = new THREE.Vector3(p.x - 0.3, 1.0, p.z + 0.4);
  const body = colliders.find((b) => b.containsPoint(inside));
  assert.ok(body, 'a collider where the machine stands');
  assert.ok(body.max.y >= 2.0, 'taller than a jump peak (about 1.05m) plus a step-up');
  assert.ok(overlapsSolid(new THREE.Vector3(inside.x, 0, inside.z), 0.35, 1.8, colliders, 0.3), 'you cannot stand in it');
  // The door lane and the way along the wall to the east bench stay open.
  const door = LAYOUT.foodCourtDoorway;
  assert.ok(body.min.x > door.maxX + 0.5, 'clear of the door lane');
  open('startShutter');
  open('foodCourt');
  const shopper = zombieTypes.shopper;
  const nav = createNavigation(colliders, { radius: shopper.radius, height: shopper.height });
  const front = new THREE.Vector3(p.x, 0, p.z - 1.2);
  nav.update(dt, front);
  assert.ok(Number.isFinite(nav.distanceToTarget(0, -8)), 'the middle of the Food Court reaches the machine front');
  assert.ok(Number.isFinite(nav.distanceToTarget(0, -3.5)), 'and so does the spot just inside the door');
});

test('the screen shows the gun in hand and its ammo: the price when it needs a refill, FULL when it does not, SALE on a discount', () => {
  const gun = loadout(weapons.nailGun);
  assert.deepEqual(ammoScreenText({ gun, price: 400 }), { title: 'NAIL GUN', line: 'FULL', note: `${gun.weapon.magazine} / ${gun.weapon.reserve}`, tone: '#7dffb0' });
  gun.weapon.magazine = 3;
  gun.weapon.reserve = 12;
  const need = ammoScreenText({ gun, price: 400 });
  assert.equal(need.line, '400 PTS');
  assert.equal(need.note, '3 / 12');
  assert.match(ammoScreenText({ gun, price: 200, sale: true }).note, /SALE$/);
  // Redraws only when the words change.
  const shown = [];
  const screen = { show: (text) => shown.push(text) };
  const item = buildAmmoCache({ zone: 'foodCourt', position: new THREE.Vector3(), screen }, {
    map: { zones: { foodCourt: { open: true } } }, gun, pricing: { priceOf: () => 400, discountOf: () => 0 }, interactions: { add() {} },
  });
  assert.equal(shown.length, 1, 'drawn once when built');
  item.update();
  assert.equal(shown.length, 2, 'the hook asks again each tick; the screen itself skips unchanged words');
  assert.equal(shown.at(-1).line, '400 PTS');
});
