// The three late guns are real wall buys: Rivet Rifle (Grand Atrium), Heavy Coil Nailer (Sunset Promenade, level 2) and
// Barcode Scanner (Byte Me Electronics' east face). Real F holds in the real game: the exact price is charged, the gun goes
// in hand, a second hold refills it for the ammo price, nothing is offered while its area is closed or through a wall, and
// each spot is clear of spawns. The balance pins for the guns themselves are in newGuns / rivetRifle / coilAndScanner tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { featuresOf } from '../src/game/features/index.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { LAYOUT } from '../src/maps/mall/mall.js';

const UPPER_Y = LAYOUT.hallway.height + 0.3;
// stand = where a player really stands (1.2-1.4 m from the wall); yawDeg faces the wall (yaw 0 faces -Z)
const GUNS = [
  { id: 'rivetRifle', zone: 'atrium', floorY: 0, stand: [9.3, 21.5], yawDeg: 90 }, // west arcade wall, facing -X
  { id: 'coilNailer', zone: 'upstairs', floorY: UPPER_Y, stand: [1.5, -3.3], yawDeg: 0 }, // Promenade south wall, facing -Z (yaw 0)
  { id: 'barcodeScanner', zone: 'foodCourt', floorY: 0, stand: [17.9, -6.2], yawDeg: 90 }, // Byte Me's east face, facing -X
];

function standing(t, gunCase, [x, z] = gunCase.stand) {
  t.g.player.teleport({ position: new THREE.Vector3(x, gunCase.floorY, z), yaw: (gunCase.yawDeg * Math.PI) / 180 });
  t.tick(2);
}
function readyGame() {
  const t = headlessGame();
  t.tick(1);
  t.g.health.invulnerable = true; // (round 1 zombies spawn on their own: these tests are about buying)
  t.g.wallet.earn(20000);
  return t;
}
function openEverything(t) {
  for (const d of t.g.map.doors) d.open();
  t.tick(120);
  t.g.zombies.clear();
}

test('each is a priced wall buy in the right area, with its debug-only flag gone', () => {
  const { g } = headlessGame();
  for (const c of GUNS) {
    assert.equal(weapons[c.id].debugOnly, undefined, `${c.id} is no longer debug-only`);
    assert.ok(economy.wallBuys[c.id].weapon > economy.wallBuys[c.id].ammo, `${c.id}: ammo is cheaper than the gun`);
    const features = featuresOf(g.map, 'wallBuy').filter((f) => f.weapon === c.id);
    assert.equal(features.length, 1, `${c.id}: one wall buy`);
    assert.equal(features[0].zone, c.zone);
    assert.equal(g.pricing.priceOf('weapon', c.id), economy.wallBuys[c.id].weapon, 'the price goes through pricing');
  }
  assert.deepEqual(GUNS.map((c) => economy.wallBuys[c.id].weapon), [1500, 1250, 1750]);
});

for (const c of GUNS) {
  test(`${c.id}: buy it for its exact price, then refill it for the ammo price, with a real F hold`, () => {
    const t = readyGame();
    const { g } = t;
    openEverything(t);
    standing(t, c);
    assert.equal(g.interactions.prompt?.id, c.id, 'the prompt offers this gun');
    assert.equal(g.interactions.prompt?.kind, 'weapon');
    const before = g.wallet.points;
    t.press('KeyF', 30);
    t.tick(20);
    assert.equal(g.gun.owns(c.id), true);
    assert.equal(g.gun.def.id, c.id, 'a free slot: it is added and switched to');
    assert.equal(before - g.wallet.points, economy.wallBuys[c.id].weapon);
    // Refill
    g.gun.weapon.magazine = 1;
    g.gun.weapon.reserve = 3;
    t.tick(5);
    assert.equal(g.interactions.prompt?.kind, 'ammo', 'now it sells ammo');
    const beforeAmmo = g.wallet.points;
    t.press('KeyF', 30);
    t.tick(20);
    assert.equal(g.gun.weapon.isFull, true);
    assert.equal(beforeAmmo - g.wallet.points, economy.wallBuys[c.id].ammo);
    // Full: nothing left to sell
    t.tick(5);
    assert.notEqual(g.interactions.prompt?.id, c.id, 'no prompt once it is full');
  });

  test(`${c.id}: nothing is offered while its area is closed`, () => {
    const t = readyGame();
    const { g } = t;
    assert.equal(g.map.zones[c.zone].open, false);
    standing(t, c);
    assert.notEqual(g.interactions.prompt?.id, c.id);
    t.press('KeyF', 30);
    assert.equal(g.gun.owns(c.id), false);
  });

  test(`${c.id}: the spot is well clear of every spawn marker on its floor`, () => {
    const { g } = headlessGame();
    const wb = featuresOf(g.map, 'wallBuy').find((f) => f.weapon === c.id);
    for (const s of g.map.spawnPoints) {
      if (Math.abs(s.position.y - c.floorY) > 1) continue;
      const d = Math.hypot(s.position.x - wb.position.x, s.position.z - wb.position.z);
      assert.ok(d >= 3, `${s.name} is ${d.toFixed(1)} m away`);
    }
  });
}

test('the Scanner cannot be bought from inside Byte Me, through the wall behind it', () => {
  const t = readyGame();
  const { g } = t;
  openEverything(t);
  standing(t, { ...GUNS[2], yawDeg: -90 }, [15.6, -6.2]); // inside the store, facing east at the same wall
  assert.notEqual(g.interactions.prompt?.id, 'barcodeScanner');
  t.press('KeyF', 30);
  assert.equal(g.gun.owns('barcodeScanner'), false);
});

test('buying all three follows the two-slot rule: each new gun replaces the one in hand', () => {
  const t = readyGame();
  const { g } = t;
  openEverything(t);
  for (const c of GUNS) {
    g.zombies.clear();
    standing(t, c);
    t.press('KeyF', 30);
    t.tick(70); // (the raise after a switch)
    assert.equal(g.gun.owns(c.id), true, c.id);
  }
  // Rivet filled the free slot; the Coil Nailer replaced it (the gun in hand); the Scanner replaced the Coil Nailer.
  assert.deepEqual(g.gun.slots, ['stapleGun', 'barcodeScanner']);
  assert.equal(g.gun.def.id, 'barcodeScanner');
  assert.equal(g.gun.owns('rivetRifle'), false);
  assert.equal(g.gun.owns('coilNailer'), false);
});

test('Play again takes the guns away and re-seals their areas', () => {
  const t = readyGame();
  const { g } = t;
  openEverything(t);
  standing(t, GUNS[0]);
  t.press('KeyF', 30);
  assert.equal(g.gun.owns('rivetRifle'), true);
  g.resetRun();
  assert.equal(g.gun.owns('rivetRifle'), false);
  for (const c of GUNS) assert.equal(g.map.zones[c.zone].open, false, `${c.zone} is sealed again`);
});
