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

test('every attachment has a counter spot INSIDE its own store: sights Byte Me, grips Good Sports, magazines Play Time Toys, barrels Nuts & Bolts', () => {
  const { g } = headlessGame();
  const spots = featuresOf(g.map, 'attachmentCounter');
  assert.deepEqual(spots.map((s) => s.attachment).sort(), Object.keys(upgrades.attachments).sort());
  for (const s of spots) assert.equal(s.zone, 'foodCourt', s.name);
  // Byte Me (east) and Play Time Toys (west) are pods against the hallway wall; Good Sports and Nuts & Bolts are
  // rooms behind the Food Court's south wall (z < -14.6).
  const inPod = (id, sign) => { const p = spotOf(g, id).position; return p.x * sign > 10.6 && p.x * sign < 16.4 && p.z < -2.3 && p.z > -6.8; };
  assert.ok(inPod('laserPointer', 1) && inPod('zoomLens', 1), 'Byte Me pod');
  assert.ok(inPod('jumboPack', -1) && inPod('speedLoader', -1), 'Play Time Toys pod');
  for (const id of ['gripTape', 'wristband']) assert.ok(spotOf(g, id).position.x < -9 && spotOf(g, id).position.z < -14.6, `${id}: Good Sports`);
  for (const id of ['extendedNozzle', 'sawnOff']) assert.ok(spotOf(g, id).position.x > 9 && spotOf(g, id).position.z < -14.6, `${id}: Nuts and Bolts`);
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
  assert.equal(g.gun.def.magazineSize, Math.round(weapons.priceGun.magazineSize * 1.5), 'the Jumbo Pack works');
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
  assert.equal(g.interactions.prompt?.label, 'Laser Pointer on the Price Gun', 'names the gun in hand');
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

test('a shot blocked by the top of a display case hits visible case geometry', () => {
  const { g } = openMall();
  g.map.group.updateMatrixWorld(true);
  for (const id of ['laserPointer', 'gripTape', 'jumboPack']) {
    const spot = spotOf(g, id);
    const inside = spot.position.clone().addScaledVector(spot.normal, -0.45);
    const box = g.colliders.find((c) => c.containsPoint(new THREE.Vector3(inside.x, 0.5, inside.z)));
    assert.ok(box, `${id}: found its case collider`);
    const z = (box.min.z + box.max.z) / 2;
    // Downward shot along the counter, from a standing eye to a zombie's chest beyond it.
    const origin = new THREE.Vector3(box.min.x - 0.5, 1.6, z);
    const target = new THREE.Vector3(box.max.x + 0.8, 0.98, z);
    const direction = target.clone().sub(origin).normalize();
    const hit = new THREE.Ray(origin, direction).intersectBox(box, new THREE.Vector3());
    assert.ok(hit && hit.y > box.max.y - 0.01, `${id}: shot crosses the collider's top`);
    const visible = new THREE.Raycaster(origin, direction, 0, origin.distanceTo(target))
      .intersectObject(g.map.group, true).find((h) => h.object.name === 'attachment_case_glass');
    assert.ok(visible, `${id}: blocked shot has a visible surface`);
    assert.ok(Math.abs(visible.distance - origin.distanceTo(hit)) < 0.05,
      `${id}: rendered top and bullet collider agree within 5 cm`);
  }
});

test('moving a store = changing its LAYOUT.stores entry (the whole store, counter and spots follow)', () => {
  const entry = LAYOUT.stores.find((s) => s.slot === 'sight');
  const [from, to] = [entry.from, entry.to];
  try {
    entry.from -= 1.5; entry.to -= 1.5; // slide Byte Me west along the hallway wall
    const { g } = headlessGame();
    const xs = ['laserPointer', 'zoomLens'].map((id) => spotOf(g, id).position.x);
    assert.ok(xs.every((x) => x > from - 1.5 && x < to - 1.5), `both sight spots moved with the store: ${xs}`);
  } finally {
    entry.from = from; entry.to = to;
  }
});

test('stores are real rooms: walls and a ceiling, the counter seals the clerk strip, and you can walk in through the door', () => {
  const { t, g, standAt } = openMall();
  for (const store of LAYOUT.stores) {
    const south = store.side === 'south';
    const cx = (store.from + store.to) / 2;
    const zBack = south ? -14.6 - store.depth : -2.3;
    const dir = south ? 1 : -1;
    const at = (d, x = cx) => new THREE.Vector3(x, 0, zBack + dir * d);
    const clear = (v) => !overlapsSolid(v, 0.35, 1.8, g.colliders, 0.05);
    assert.ok(clear(at(store.depth - 0.5)), `${store.id}: the door end is walkable`);
    assert.ok(clear(at(store.depth + 0.8)), `${store.id}: the doorway and outside are walkable`);
    assert.ok(clear(at(2.4)), `${store.id}: the middle is walkable`);
    // The counter runs wall to wall (solid across the whole width), so nobody gets round it to the clerk strip.
    for (const x of [store.from + 0.4, cx, store.to - 0.4]) assert.ok(!clear(at(1.3, x)), `${store.id}: counter is solid at x ${x}`);
    assert.ok(!clear(at(2.4, store.from - 0.15)), `${store.id}: west wall`);
    assert.ok(!clear(at(2.4, store.to + 0.15)), `${store.id}: east wall`);
  }
  // A real player standing in front of each counter gets its prompt.
  for (const id of ['laserPointer', 'gripTape', 'jumboPack', 'extendedNozzle']) {
    standAt(id, 1.3); t.tick(2);
    assert.ok(g.interactions.prompt?.label.startsWith(upgrades.attachments[id].name), `${id}: prompt at the counter`);
  }
});

test('the store windows are glass: solid to walking, and you can see through them', () => {
  const { g } = openMall();
  const store = LAYOUT.stores.find((s) => s.id === 'goodSports');
  const x = store.from + 0.9; // inside a window (between the pier and the door)
  assert.ok(overlapsSolid(new THREE.Vector3(x, 0, -14.45), 0.2, 1.8, g.colliders, 0.05), 'window blocks walking');
  g.map.group.updateMatrixWorld(true);
  const origin = new THREE.Vector3(x, 1.7, -12);
  const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1), 0, 8).intersectObject(g.map.group, true)
    .find((h) => h.object.name.endsWith('_window'));
  assert.ok(hit, 'the glass is there to see');
});
