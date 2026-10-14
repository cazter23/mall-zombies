// Buying (game/interactions.js) against the REAL mall: you can buy things from where you'd really
// stand, but not through walls or from another floor. The mall draws textures on <canvas>: a
// do-nothing one stands in for the browser's.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createInteractions } from '../src/game/interactions.js';
import { feel } from '../src/config/feel.js';

const ctx = new Proxy({}, {
  get: (target, key) => (key in target ? target[key] : (target[key] = () => ctx)),
  set: (target, key, value) => { target[key] = value; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const { buildMall } = await import('../src/maps/mall/mall.js');

const dt = 1 / feel.simulation.tickRate;
const FACE = { toward: { posX: -Math.PI / 2, negX: Math.PI / 2, posZ: Math.PI, negZ: 0 } }; // yaw 0 faces -Z

// The mall with every buyable registered the way main.js does it. `buy(x, y, z, yaw)` stands the
// player there, holds the interact button for a second, and returns what got bought.
function setup() {
  const colliders = [];
  const map = buildMall(new THREE.Scene(), colliders);
  const player = { position: new THREE.Vector3(), yaw: 0, eyeHeight: feel.player.eyeHeight };
  const input = {
    pressed: new Set(),
    isDown: () => false,
    actionDown: () => true,
    consumeAction: () => true,
  };
  const bought = [];
  const interactions = createInteractions({ input, player, wallet: { spend: () => true, canAfford: () => true }, colliders });
  for (const door of map.doors) {
    interactions.add({
      label: door.label, verb: 'open', cost: door.price, position: door.position,
      seeThrough: [door.barrier.collider], available: () => !door.isOpen, use: () => bought.push(door.id),
    });
  }
  for (const wb of map.wallBuys) {
    interactions.add({
      label: wb.weapon, verb: 'buy', cost: 1, position: wb.position,
      available: () => map.zones[wb.zone].open, use: () => bought.push(wb.name),
    });
  }
  const openDoor = (id) => {
    map.doors.find((d) => d.id === id).open();
    for (let t = 0; t < feel.world.shutterOpenSeconds + 0.5; t += dt) map.update(dt);
  };
  const buy = (x, y, z, yaw) => {
    bought.length = 0;
    interactions.reset();
    player.position.set(x, y, z);
    player.yaw = yaw;
    for (let i = 0; i < 40; i++) interactions.update(dt);
    return [...new Set(bought)]; // (the stub never lets go of the button, so a buy can repeat)
  };
  return { map, openDoor, buy };
}

test('every door can be bought from the spot in front of it', () => {
  const { buy } = setup();
  assert.deepEqual(buy(0, 0, 8.5, FACE.toward.negZ), ['startShutter'], 'start shutter, from the start room');
});

test('the hub doors can be bought from the hallway', () => {
  const { buy, openDoor } = setup();
  openDoor('startShutter');
  assert.deepEqual(buy(17.8, 0, 2, FACE.toward.posX), ['megaMart'], 'Mega Mart (east end)');
  assert.deepEqual(buy(0, 0, -0.4, FACE.toward.negZ), ['foodCourt'], 'Food Court (south wall)');
  assert.deepEqual(buy(-18.2, 0, 2, FACE.toward.negX), ['serviceCorridor'], 'Service Corridor (west wall)');
});

test('wall buys work from the room they hang in', () => {
  const { buy, openDoor } = setup();
  assert.deepEqual(buy(3.5, 0, 10, FACE.toward.posX), ['wallbuy_startRoom'], 'Price Gun');
  openDoor('startShutter');
  assert.deepEqual(buy(11, 0, -0.6, FACE.toward.negZ), ['wallbuy_hallway'], 'Nail Gun from the hallway');
});

test('the Nail Gun cannot be bought through its wall from the Food Court', () => {
  const { buy, openDoor } = setup();
  openDoor('startShutter');
  openDoor('foodCourt');
  // Food Court side of the hallway's south wall, right behind the gun, facing it, in range.
  assert.deepEqual(buy(11, 0, -2.66, FACE.toward.posZ), [], 'nothing bought through the wall');
  assert.deepEqual(buy(11, 0, -3.2, FACE.toward.posZ), []);
  assert.deepEqual(buy(11, 0, -0.6, FACE.toward.negZ), ['wallbuy_hallway'], 'still fine from the hallway');
});

test('a door cannot be bought through a wall from the room behind it', () => {
  const { buy, openDoor } = setup();
  openDoor('startShutter');
  // Mega Mart's shutter is at the hallway's east end. From inside the Mega Mart (door closed, so you
  // can't really be there) the same spot is behind the wall: use the Service Corridor side instead.
  // The Food Court door is straight across from the start door: from the start room, far away.
  assert.deepEqual(buy(0, 0, 12, FACE.toward.negZ), [], 'too far from every door');
  // Just on the hallway side of the Food Court door but facing away from it.
  assert.deepEqual(buy(0, 0, -0.4, FACE.toward.posZ), [], 'facing away from it');
});

test('buy spots on another floor are out of reach (3D distance from the eye)', () => {
  const { buy, openDoor } = setup();
  openDoor('startShutter');
  // Level 2 is at y 6.3: standing straight above the Nail Gun, facing down the hallway.
  assert.deepEqual(buy(11, 6.3, -0.6, FACE.toward.negZ), []);
  assert.deepEqual(buy(11, 6.3, -2.2, FACE.toward.negZ), []);
});

test('facing still matters: with your back to it you cannot buy', () => {
  const { buy, openDoor } = setup();
  openDoor('startShutter');
  assert.deepEqual(buy(11, 0, -0.1, FACE.toward.posZ), [], 'back to the Nail Gun (not right next to it)');
});
