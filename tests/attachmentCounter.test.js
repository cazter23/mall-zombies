// Store attachment counters (map feature 'attachmentCounter', game/features/attachmentCounter.js) in the REAL
// game and mall: where they are (each slot at its store, one LAYOUT entry moves a counter), buying with real F
// holds (gun in hand only, replaces the slot, pricing's price, nothing that doesn't fit or is already fitted),
// and the counters themselves (solid cases you can't climb, a pegboard that keeps its aisle clear).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { featuresOf } from '../src/game/features/index.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { attachmentsOf } from '../src/weapons/upgrades.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { overlapsSolid } from '../src/world/collision.js';

const spotOf = (g, id) => featuresOf(g.map, 'attachmentCounter').find((f) => f.attachment === id);
// Yaw that faces the counter (yaw 0 faces -Z; the spot's normal points out of the counter, toward you).
const yawFacing = (normal) => (Math.atan2(normal.x, normal.z) * 180) / Math.PI;

// A real game with every door open, nothing spawning, points to spend.
function openMall() {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.zombies.clear();
  g.rounds.update = () => {};
  for (const d of g.map.doors) d.open();
  t.tick(120);
  g.wallet.earn(50_000);
  const bought = [];
  g.events.on('purchase', (p) => bought.push(p));
  const standAt = (id, back = 1.3) => {
    const s = spotOf(g, id);
    t.standAt(s.position.x + s.normal.x * back, s.position.z + s.normal.z * back, yawFacing(s.normal));
  };
  const buy = (id) => { standAt(id); t.press('KeyF', 30); };
  return { t, g, bought, standAt, buy };
}

test('every attachment has a counter spot at its own store: sights Byte Me, grips Good Sports, magazines Play Time Toys, barrels Mega Mart hardware', () => {
  const { g } = headlessGame();
  const spots = featuresOf(g.map, 'attachmentCounter');
  assert.deepEqual(spots.map((s) => s.attachment).sort(), Object.keys(upgrades.attachments).sort());
  const zoneOf = { sight: 'foodCourt', grip: 'foodCourt', magazine: 'foodCourt', barrel: 'megaMart' };
  for (const s of spots) assert.equal(s.zone, zoneOf[upgrades.attachments[s.attachment].slot], s.name);
  // Byte Me / Play Time Toys are on the north wall, Good Sports on the south, the pegboard on the Mart's east wall.
  assert.ok(spotOf(g, 'laserPointer').position.x > 9 && spotOf(g, 'laserPointer').position.z > -4);
  assert.ok(spotOf(g, 'jumboPack').position.x < -9 && spotOf(g, 'jumboPack').position.z > -4);
  assert.ok(spotOf(g, 'gripTape').position.x < -9 && spotOf(g, 'gripTape').position.z < -12);
  assert.ok(spotOf(g, 'sawnOff').position.x > 32 && spotOf(g, 'sawnOff').position.z < -12);
});

test('buying at a counter fits the attachment to the gun in hand, replaces that slot, charges the pricing price, and announces it', () => {
  const { t, g, bought, buy } = openMall();
  g.gun.give(weapons.priceGun); t.tick(40);
  for (const id of ['laserPointer', 'gripTape', 'jumboPack', 'sawnOff']) {
    const before = g.wallet.points;
    buy(id);
    assert.equal(before - g.wallet.points, economy.upgrades.attachments[id], `${id} price`);
    assert.equal(attachmentsOf(g.gun.modsFor('priceGun'))[upgrades.attachments[id].slot], id);
    assert.equal(bought.at(-1).kind, 'attachment');
    assert.equal(bought.at(-1).id, id);
  }
  assert.equal(g.gun.def.magazineSize, Math.round(weapons.priceGun.magazineSize * 1.3), 'the Jumbo Pack works');
  buy('zoomLens'); // same slot as the Laser Pointer
  assert.deepEqual(attachmentsOf(g.gun.modsFor('priceGun')), { sight: 'zoomLens', grip: 'gripTape', magazine: 'jumboPack', barrel: 'sawnOff' });
  assert.deepEqual(g.gun.modsFor('stapleGun'), [], 'the other gun is untouched');
});

test('no prompt for an attachment the gun already has, one that does nothing on it, before its area is open, or mid switch', () => {
  const { t, g, buy, standAt } = openMall();
  buy('speedLoader');
  standAt('speedLoader'); t.tick(2);
  assert.ok(!g.interactions.prompt?.label.startsWith('Speed Loader'), 'already fitted');
  g.gun.give(weapons.nailGun); t.tick(40);
  standAt('extendedNozzle'); t.tick(2);
  assert.ok(!g.interactions.prompt?.label.startsWith('Extended Nozzle'), 'the Nail Gun has no falloff to extend');
  g.gun.give(weapons.priceGun); // starts a switch
  standAt('laserPointer'); t.tick(1);
  assert.equal(g.interactions.prompt, null, 'mid switch');
  t.tick(40);
  assert.equal(g.interactions.prompt?.label, 'Laser Pointer on the Price Gun · Tighter hip fire; looser when aimed', 'names the gun in hand');
  assert.equal(g.interactions.prompt.verb, 'fit');
  // A fresh game: the Food Court is shut.
  const fresh = headlessGame();
  fresh.tick(1);
  const s = spotOf(fresh.g, 'laserPointer');
  fresh.standAt(s.position.x, s.position.z - 1.3, 180); fresh.tick(2);
  assert.equal(fresh.g.interactions.prompt, null, 'its area is closed');
});

test('the glass cases are solid and too tall to climb; the pegboard leaves the hardware aisle clear', () => {
  const { g } = openMall();
  for (const id of ['laserPointer', 'gripTape', 'jumboPack']) {
    const s = spotOf(g, id);
    const inside = s.position.clone().addScaledVector(s.normal, -0.45);
    assert.ok(overlapsSolid(new THREE.Vector3(inside.x, 0, inside.z), 0.3, 1, g.colliders, 0.05), `${id}: case is solid`);
    const top = Math.max(...g.colliders.filter((c) => c.containsPoint(new THREE.Vector3(inside.x, 0.5, inside.z))).map((c) => c.max.y));
    assert.ok(top >= 1.2, `${id}: case collider ${top} m`);
    const front = s.position.clone().addScaledVector(s.normal, 0.5);
    assert.ok(!overlapsSolid(new THREE.Vector3(front.x, 0, front.z), 0.35, 1.8, g.colliders, 0.05), `${id}: room to stand in front`);
  }
  // Mega Mart aisle 4 (between the east gondola, x 31.5, and the east wall, x 34) stays walkable past the pegboard.
  for (const z of [-15, -14, -13]) assert.ok(!overlapsSolid(new THREE.Vector3(32.75, 0, z), 0.35, 1.8, g.colliders, 0.05), `aisle at z ${z}`);
});

test('moving a counter = changing its LAYOUT.attachmentCounters entry', () => {
  const entry = LAYOUT.attachmentCounters.find((c) => c.slot === 'sight');
  const before = entry.center;
  try {
    entry.center = 6;
    const { g } = headlessGame();
    const xs = ['laserPointer', 'zoomLens'].map((id) => spotOf(g, id).position.x);
    assert.ok(xs.every((x) => Math.abs(x - 6) < 1.3), `both sight spots moved: ${xs}`);
  } finally {
    entry.center = before;
  }
});
