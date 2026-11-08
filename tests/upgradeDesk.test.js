// The Customer Service desk (map feature 'upgradeDesk', game/features/upgradeDesk.js): Extended Warranty
// tiers for the gun in your hand, bought one at a time in the REAL game, and the desk itself in the REAL mall
// (where it is, that one LAYOUT entry moves it, solid and too tall to climb).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { featuresOf } from '../src/game/features/index.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { tierOf } from '../src/weapons/upgrades.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { overlapsSolid } from '../src/world/collision.js';

const FACING_NORTH = Math.PI; // yaw 0 faces -Z; the desk is on the hallway's north wall, facing -Z

// A real game in the hallway, in front of the desk, with points to spend.
function atDesk() {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.zombies.clear();
  g.rounds.update = () => {};
  g.map.doors.find((d) => d.id === 'startShutter').open();
  t.tick(120);
  const desk = featuresOf(g.map, 'upgradeDesk')[0];
  const stand = () => t.standAt(desk.position.x, desk.position.z - 1.4, 180);
  const bought = [];
  g.events.on('purchase', (p) => bought.push(p));
  return { t, g, desk, stand, bought, buy: () => { stand(); t.press('KeyF', 30); } };
}

test('the mall has ONE Customer Service booth: hallway north wall, between the start doorway and the elevator', () => {
  const { g } = headlessGame();
  const desks = featuresOf(g.map, 'upgradeDesk');
  assert.equal(desks.length, 1);
  const [desk] = desks;
  assert.equal(desk.zone, 'hallway');
  assert.deepEqual(desk.normal.toArray(), [0, 0, -1], 'faces into the hallway');
  assert.ok(desk.position.x > 2 && desk.position.x < LAYOUT.elevator.centerX - 1.1, 'clear of the doorway and the elevator');
  assert.ok(desk.position.z > 3.5 && desk.position.z < 5, 'at the booth window, in front of the north wall');
});

test('moving the desk = changing LAYOUT.serviceDesk (the prop, its collider and its buy spot all follow)', () => {
  const before = LAYOUT.serviceDesk.center;
  try {
    LAYOUT.serviceDesk.center = -9; // somewhere else on the same wall
    const { g } = headlessGame();
    const desk = featuresOf(g.map, 'upgradeDesk')[0];
    assert.equal(desk.position.x, -9);
    const body = { position: new THREE.Vector3(-9, 0, 5.5) };
    assert.ok(overlapsSolid(body.position, 0.3, 1, g.colliders, 0.05), 'its collider moved with it');
    assert.ok(!overlapsSolid(new THREE.Vector3(7, 0, 5.5), 0.3, 1, g.colliders, 0.05), 'nothing left at the old spot');
  } finally {
    LAYOUT.serviceDesk.center = before;
  }
});

test('the booth is solid from the wall to the counter (full height), nobody gets inside, and you can stand right in front of it', () => {
  const { g, desk } = atDesk();
  const x = desk.position.x;
  for (const z of [5.1, 5.5, 5.9]) assert.ok(overlapsSolid(new THREE.Vector3(x, 0, z), 0.3, 1, g.colliders, 0.05), `solid at z ${z}`);
  const top = Math.max(...g.colliders.filter((c) => c.containsPoint(new THREE.Vector3(x, 0.5, 5.5))).map((c) => c.max.y));
  assert.ok(top >= 2.5, `booth collider ${top} m: a full-height block, not a counter you can climb`);
  assert.ok(!overlapsSolid(new THREE.Vector3(x, 0, desk.position.z - 0.6), 0.35, 1.8, g.colliders, 0.05), 'room for the player at the counter');
});

test('buying tiers at the desk: one at a time, charged from pricing, gun in hand only, no ammo refill, nothing past Platinum', () => {
  const { t, g, buy, bought, stand } = atDesk();
  g.wallet.earn(20_000);
  g.gun.weapon.magazine = 3;
  let points = g.wallet.points;
  for (const [tierId, name] of [['deluxe', 'Deluxe'], ['premium', 'Premium'], ['platinum', 'Platinum']]) {
    buy();
    assert.equal(tierOf(g.gun.modsFor('stapleGun')), tierId);
    assert.equal(points - g.wallet.points, economy.upgrades.tiers[tierId], `${tierId} price`);
    assert.deepEqual(bought.at(-1), { label: `Staple Gun → ${name}`, cost: economy.upgrades.tiers[tierId], kind: 'tier', id: tierId });
    points = g.wallet.points;
  }
  assert.equal(g.gun.weapon.magazine, 3, 'buying a tier does NOT refill the magazine');
  assert.equal(g.gun.def.magazineSize, Math.round(weapons.stapleGun.magazineSize * upgrades.tiers.at(-1).effects.magazine), 'but the magazine is bigger now');
  assert.equal(g.gun.def.damage, weapons.stapleGun.damage * upgrades.tiers.at(-1).effects.damage);
  stand();
  t.tick(2);
  assert.equal(g.interactions.prompt, null, 'no prompt once Platinum');
  buy();
  assert.equal(g.wallet.points, points, 'and nothing more to pay');
});

test('the desk upgrades the gun IN HAND; each carried gun keeps its own tier; a Flash Sale discounts tiers', () => {
  const { t, g, buy } = atDesk();
  g.wallet.earn(20_000);
  g.gun.give(weapons.priceGun); t.tick(40);
  g.pricing.setDiscount('tier', 0.5);
  const before = g.wallet.points;
  buy();
  assert.equal(before - g.wallet.points, economy.upgrades.tiers.deluxe / 2, 'sale price');
  assert.equal(tierOf(g.gun.modsFor('priceGun')), 'deluxe');
  assert.equal(tierOf(g.gun.modsFor('stapleGun')), 'standard', 'the other gun is untouched');
  t.press('Digit1', 1); t.tick(40); // switch to the staple gun
  assert.equal(g.gun.def.id, 'stapleGun');
  t.standAt(featuresOf(g.map, 'upgradeDesk')[0].position.x, featuresOf(g.map, 'upgradeDesk')[0].position.z - 1.4, 180);
  t.tick(2);
  assert.equal(g.interactions.prompt.label, 'Staple Gun → Deluxe', 'the prompt follows the gun in hand');
});

test('the Platinum purchase frame and a switch to a Platinum gun have no stale desk prompt', () => {
  const { t, g, buy, stand } = atDesk();
  g.wallet.earn(20_000);
  buy(); buy();
  stand();
  const before = g.wallet.points;
  t.input.pressed.add('KeyF');
  t.input.held.add('KeyF');
  // Stop on the purchase tick: another tick would clear the stale focus and hide the bug.
  for (let ticks = 0; tierOf(g.gun.modsFor('stapleGun')) !== 'platinum' && ticks < 30; ticks++) t.tick();
  t.input.held.delete('KeyF');
  assert.equal(tierOf(g.gun.modsFor('stapleGun')), 'platinum');
  assert.equal(before - g.wallet.points, economy.upgrades.tiers.platinum);
  assert.equal(g.interactions.prompt, null, 'safe to render immediately after buying the final tier');

  g.gun.give(weapons.priceGun); t.tick(40);
  stand();
  assert.equal(g.interactions.prompt.label, 'Price Gun → Deluxe');
  t.press('Digit1'); // interactions run before gun switching in this tick
  assert.equal(g.interactions.prompt, null, 'safe to render the first switching frame');
  t.tick(40);
  assert.equal(g.gun.def.id, 'stapleGun');
  assert.equal(g.interactions.prompt, null, 'Platinum gun is not upgradeable');
  t.press('Digit2'); t.tick(40); stand();
  assert.equal(g.interactions.prompt.label, 'Price Gun → Deluxe', 'the other gun remains upgradeable');
});

test('no prompt before the hallway is open, mid weapon switch, or facing away; Play again resets every tier', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.zombies.clear(); g.rounds.update = () => {};
  const desk = featuresOf(g.map, 'upgradeDesk')[0];
  t.standAt(desk.position.x, desk.position.z - 1.4, 180); t.tick(2);
  assert.equal(g.interactions.prompt, null, 'the hallway is still closed');
  g.map.doors.find((d) => d.id === 'startShutter').open(); t.tick(120);
  t.standAt(desk.position.x, desk.position.z - 1.4, 0); t.tick(2);
  assert.equal(g.interactions.prompt, null, 'back to the desk');
  g.gun.give(weapons.priceGun); // starts a switch
  t.standAt(desk.position.x, desk.position.z - 1.4, 180); t.tick(1);
  assert.equal(g.interactions.prompt, null, 'mid switch');
  t.tick(40);
  assert.equal(g.interactions.prompt.verb, 'upgrade');
  g.wallet.earn(5000);
  t.press('KeyF', 30);
  assert.equal(tierOf(g.gun.modsFor('priceGun')), 'deluxe');
  g.resetRun(); t.tick(1);
  assert.deepEqual(g.gun.modsFor('stapleGun'), []);
});
