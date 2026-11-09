import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Raycaster, Vector3 } from 'three';
import { createRoomCulling } from '../src/fx/roomCulling.js';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { economy } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { bossVouchers } from '../src/config/bosses.js';
import { powerUps } from '../src/config/powerUps.js';
import { wardrobeItems } from '../src/config/wardrobe.js';
import { weapons } from '../src/config/weapons.js';
import { createAim } from '../src/weapons/aim.js';
import { hitDamage } from '../src/weapons/gunStats.js';
import { withTier } from '../src/weapons/upgrades.js';
import { overlapsSolid } from '../src/world/collision.js';

const holdTicks = Math.ceil(feel.interact.holdSeconds / dt) + 1;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} vs ${expected}`);

function scenario(t) {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  game.tick();
  game.g.rounds.update = () => {};
  game.g.zombies.clear();
  return game;
}

function standAt(game, spot, floor = spot.zone === 'upstairs' || spot.zone === 'cinema' ? game.g.map.cinema.floorY : 0) {
  const position = spot.position.clone().addScaledVector(spot.normal, 0.8).setY(floor);
  const yaw = Math.atan2(spot.normal.x, spot.normal.z);
  game.g.player.teleport({ position, yaw });
  game.tick();
  return position;
}

function collect(game, id) {
  assert.equal(game.g.powerUps.debugDrop(id), true);
  game.g.powerUps.update(dt);
  assert.equal(game.g.powerUps.pickup, null);
}

function assertFactors(stats, base, worn) {
  const expected = { ...base };
  for (const id of Object.values(worn).filter(Boolean)) {
    for (const [key, factor] of Object.entries(wardrobeItems[id].factors)) expected[key] *= factor;
  }
  for (const key of Object.keys(expected)) {
    if (key !== 'health') near(stats[key], expected[key], key);
  }
}

test('all 12 racks and three fitting rooms work through mall input and reset with the run', (t) => {
  const game = scenario(t), { g } = game;
  const racks = g.map.features.filter(f => f.kind === 'wardrobeRack');
  const rooms = g.map.features.filter(f => f.kind === 'fittingRoom');
  assert.equal(racks.length, 12);
  assert.equal(rooms.length, 3);
  const base = { ...g.stats };
  standAt(game, racks[0]);
  assert.notEqual(g.interactions.prompt?.kind, 'wardrobe', 'locked area');
  g.debug.run('doors');
  const upstairsRack = racks.find(r => r.zone === 'upstairs');
  standAt(game, upstairsRack, 0);
  assert.notEqual(g.interactions.prompt?.id, upstairsRack.item, 'floor below cannot buy');

  standAt(game, rooms[0]);
  assert.notEqual(g.interactions.prompt?.kind, 'fittingRoom', 'no bag item yet');
  standAt(game, racks[0]);
  assert.equal(g.interactions.prompt.canAfford, false);
  const poor = g.wallet.points;
  game.press('KeyF', holdTicks);
  assert.equal(g.wallet.points, poor);
  assert.equal(g.wardrobe.owns(racks[0].item), false);
  assert.equal(g.interactions.prompt.denied, true);

  g.wallet.earn(20000);
  const purchases = [];
  g.events.on('purchase', p => purchases.push(p));
  const changes = [];
  g.events.on('wardrobeChange', p => changes.push(p));
  const expectedBag = [];
  for (const rack of racks) {
    const { item: id } = rack;
    const { slot, tradeoff } = wardrobeItems[id];
    const position = standAt(game, rack);
    assert.equal(overlapsSolid(position, feel.player.radius, feel.player.height, g.colliders, 0), false, rack.name);
    const previous = g.wardrobe.wearing(slot);
    assert.equal(g.interactions.prompt.id, id, rack.name);
    assert.equal(g.interactions.prompt.kind, 'wardrobe');
    assert.equal(g.interactions.prompt.cost, economy.wardrobe[id]);
    assert.ok(g.interactions.prompt.detail.includes(tradeoff));
    if (previous) {
      assert.ok(g.interactions.prompt.detail.includes(`Replaces ${wardrobeItems[previous].name}`));
      expectedBag.push(previous);
    }
    const before = g.wallet.points;
    game.press('KeyF', holdTicks);
    assert.equal(before - g.wallet.points, economy.wardrobe[id]);
    assert.equal(g.wardrobe.owns(id), true);
    assert.equal(g.wardrobe.wearing(slot), id);
    assert.deepEqual(g.wardrobe.status.bag, expectedBag);
    assert.deepEqual(changes.at(-1), { slot, worn: id, removed: previous });
    assert.deepEqual(purchases.at(-1), { kind: 'wardrobe', id, label: wardrobeItems[id].name, cost: economy.wardrobe[id] });
    assertFactors(g.stats, base, g.wardrobe.status.worn);
    assert.notEqual(g.interactions.prompt?.id, id, 'bought rack stops offering the item');
  }
  assert.equal(g.wardrobe.status.owned.length, 12);

  const points = g.wallet.points;
  const expectedCycle = [...expectedBag];
  for (const [index, next] of expectedCycle.entries()) {
    const room = rooms[index % rooms.length];
    const position = standAt(game, room);
    assert.equal(overlapsSolid(position, feel.player.radius, feel.player.height, g.colliders, 0), false, room.name);
    const previous = g.wardrobe.wearing(wardrobeItems[next].slot);
    assert.equal(g.interactions.prompt.kind, 'fittingRoom', room.name);
    assert.equal(g.interactions.prompt.priceLabel, 'Free');
    assert.equal(g.interactions.prompt.id, next);
    assert.equal(g.interactions.prompt.title, `Change into ${wardrobeItems[next].name}`);
    game.press('KeyF', holdTicks);
    assert.equal(g.wardrobe.wearing(wardrobeItems[next].slot), next);
    expectedBag.shift();
    expectedBag.push(previous);
    assert.deepEqual(g.wardrobe.status.bag, expectedBag);
    assert.equal(purchases.at(-1).id, next);
    assert.equal(purchases.at(-1).cost, 0);
    assertFactors(g.stats, base, g.wardrobe.status.worn);
  }
  assert.equal(g.wallet.points, points);

  g.resetRun();
  const fresh = headlessGame();
  t.after(() => fresh.g.map.dispose());
  assert.deepEqual(snapshot(g), snapshot(fresh.g));
});

test('the fitting room keeps PadX tap-to-reload, holds once per press, and the nearby HOFFMAN’S spawn stays shut', (t) => {
  const game = scenario(t), { g } = game;
  g.debug.run('doors');
  for (const id of ['paperHat', 'aviators']) g.wardrobe.buy(id);
  const room = g.map.features.find(f => f.name === 'fittingRoom_hoffmans');
  standAt(game, room);
  assert.equal(g.interactions.prompt.id, 'paperHat');
  const marker = g.map.spawnPoints.find(p => p.name === 'spawn_departmentStore_fittingRoom');
  const original = [...g.map.spawnPoints];
  g.map.spawnPoints.splice(0, original.length, marker);
  try {
    assert.equal(g.zombies.spawn('shopper', null, { nearest: true }), null);
  } finally {
    g.map.spawnPoints.splice(0, 1, ...original);
  }

  g.gun.weapon.magazine--;
  game.press('PadX');
  game.tick();
  assert.equal(g.gun.weapon.isReloading, true);
  assert.equal(g.wardrobe.wearing('head'), 'aviators');
  g.gun.weapon.cancelReload();
  game.press('PadX', holdTicks * 3);
  game.tick();
  assert.equal(g.gun.weapon.isReloading, false);
  assert.equal(g.wardrobe.wearing('head'), 'paperHat');
  assert.equal(g.wardrobe.next, 'aviators');
});

test('Apparel Flash Sales require an available rack and stack with a coupon and Discount Code', (t) => {
  const game = scenario(t), { g } = game;
  const groups = economy.flashSales.groups;
  economy.flashSales.groups = groups.filter(({ id }) => id === 'apparel');
  t.after(() => { economy.flashSales.groups = groups; });
  assert.equal(g.flashSales.startNow(), false, 'all racks locked');
  g.debug.run('doors');
  assert.equal(g.flashSales.startNow(), true);
  assert.equal(g.flashSales.active.id, 'apparel');
  assert.match(game.hud.calls.find(([method, pa]) => method === 'showAnnouncement' && pa.text.startsWith('Apparel'))[1].text, /off/);
  g.wardrobe.buy('paperHat');
  g.wardrobe.buy('aviators');

  const rack = g.map.features.find(f => f.item === 'goldCard');
  const room = g.map.features.find(f => f.name === 'fittingRoom_staffLockers');
  const base = economy.wardrobe.goldCard;
  const sale = Math.round(base * (1 - g.flashSales.active.discount) / 10) * 10;
  const coupon = powerUps.types.employeeDiscount;
  const afterCoupon = sale - Math.min(coupon.maxSaving, Math.floor(sale * coupon.fraction / 10) * 10);
  const expected = afterCoupon - Math.floor(afterCoupon * bossVouchers.discountCode.fraction / 10) * 10;
  g.wallet.earn(1000);
  g.pricing.setVoucher(bossVouchers.discountCode);
  collect(game, 'employeeDiscount');

  standAt(game, room);
  game.press('KeyF', holdTicks);
  assert.equal(g.pricing.voucher, bossVouchers.discountCode);
  assert.ok(g.powerUps.effects.some(e => e.id === 'employeeDiscount'));
  standAt(game, rack);
  assert.equal(g.interactions.prompt.cost, expected);
  const before = g.wallet.points;
  game.press('KeyF', holdTicks);
  assert.equal(before - g.wallet.points, expected);
  assert.equal(g.pricing.voucher, null);
  assert.ok(!g.powerUps.effects.some(e => e.id === 'employeeDiscount'));
  assert.equal(g.pricing.priceOf('wardrobe', 'goldCard'), sale);

  for (const id of Object.keys(wardrobeItems)) g.wardrobe.buy(id);
  g.flashSales.update(economy.flashSales.durationSeconds);
  assert.equal(g.pricing.priceOf('wardrobe', 'goldCard'), base);
  assert.equal(g.flashSales.startNow(), false, 'all racks owned');
});

test('clothing stacks with live incentives, caps health and sprint, and scales damage and knockback', (t) => {
  const game = scenario(t), { g } = game;
  const { stats, player, wardrobe } = g;
  const base = { ...stats };
  const express = powerUps.types.expressCheckout;
  const overtime = powerUps.types.overtimeApproved;
  const loss = powerUps.types.lossPrevention;
  wardrobe.buy('cardigan');
  near(stats.maxHealth, base.maxHealth * 1.25, 'Cardigan capacity');
  assert.equal(stats.health, base.health);
  near(player.sprintMeter, stats.sprintDuration, 'shorter sprint clamps the meter');
  stats.health = stats.maxHealth;

  collect(game, 'expressCheckout');
  collect(game, 'overtimeApproved');
  collect(game, 'lossPrevention');
  wardrobe.buy('sandwichBoard');
  near(stats.health, base.health, 'removing Cardigan clamps health');
  assert.ok(player.sprintMeter < stats.sprintDuration, 'restored sprint cap does not fill the meter');
  wardrobe.buy('hiVisVest');
  wardrobe.buy('foamFinger');
  wardrobe.buy('fannyPack');
  wardrobe.buy('lightUpSneakers');
  wardrobe.wearNext(); // Cardigan
  wardrobe.wearNext(); // Sandwich Board
  wardrobe.wearNext(); // Foam Finger
  near(stats.reloadSpeed, base.reloadSpeed * express.reloadMultiplier * 0.9, 'express and finger');
  near(stats.sprintSpeed, base.sprintSpeed * overtime.speedMultiplier * 1.08, 'overtime and shoes');
  near(stats.meleeDamageMultiplier, base.meleeDamageMultiplier * loss.damageMultiplier * 1.5, 'loss prevention and finger');
  g.powerUps.update(120);
  assertFactors(stats, base, wardrobe.status.worn);

  player.velocity.set(0, 0, 0);
  g.events.emit('playerHit', { damage: 40, knockback: { x: 6, z: -4 } });
  near(stats.health, base.health - 36, 'Sandwich Board damage');
  assert.deepEqual(player.velocity.toArray(), [3, 0, -2]);
  wardrobe.wearNext(); // Hi-Vis Vest
  g.events.emit('playerHit', { damage: 40 });
  near(stats.health, base.health - 36 - 44, 'Hi-Vis Vest damage');
});

test('Aviators speed both aim transitions and 3D Glasses only boost head hits', (t) => {
  const { g, input } = scenario(t);
  const def = g.gun.def;
  const aim = createAim({ def, input, player: g.player });
  input.held.add('Mouse2');
  aim.update(def.ads.seconds * 0.8);
  assert.ok(aim.amount < 1);
  aim.reset();
  g.wardrobe.buy('aviators');
  aim.update(def.ads.seconds * 0.8);
  near(aim.amount, 1, 'ADS entry');
  input.held.delete('Mouse2');
  aim.update(def.ads.seconds * 0.8);
  near(aim.amount, 0, 'ADS exit');
  const head = { part: 'head', distance: 2 };
  const body = { part: 'body', distance: 2 };
  const before = hitDamage(def, head, 0, g.stats);
  const bodyBefore = hitDamage(def, body, 0, g.stats);
  g.wardrobe.buy('glasses');
  near(hitDamage(def, head, 0, g.stats), before * 1.1, 'head bonus');
  assert.equal(hitDamage(def, body, 0, g.stats), bodyBefore);
});

test('Fanny Pack adds refill capacity to live ammo sources and preserves excess after a swap', (t) => {
  const game = scenario(t), { g } = game;
  const weapon = g.gun.weapon;
  const base = weapon.reserve;
  g.wardrobe.buy('fannyPack');
  const cap = Math.round(base * 1.25);
  assert.equal(weapon.reserveCap, cap);
  assert.equal(weapon.reserve, base);
  assert.equal(weapon.isFull, false);
  collect(game, 'stockroomDelivery');
  assert.equal(weapon.reserve, cap);

  const id = g.gun.def.id;
  g.gun.setMods(id, withTier(g.gun.def.base, [], 'platinum'));
  weapon.magazine = weapon.reserve = 0;
  game.tick();
  assert.equal(weapon.reserve, weapon.reserveCap, 'Platinum claim reads the current cap');
  weapon.reserve = 0;
  assert.equal(g.gun.handOver(weapons.stapleGun), true);
  assert.equal(g.gun.collect(), true);
  assert.equal(weapon.reserve, weapon.reserveCap, 'Build-A-Blaster return reads the current cap');
  const aboveBase = weapon.reserve;
  g.wardrobe.buy('goldCard');
  assert.ok(weapon.reserveCap < aboveBase);
  weapon.refill();
  assert.equal(weapon.reserve, aboveBase);
});

test('Gold Card boosts rounded base credit for any kill source, with Blue Light and bonuses applied once', (t) => {
  const game = scenario(t), { g } = game;
  const makeKill = (source, part = 'body') => {
    const zombie = g.zombies.spawn('shopper', new Vector3(0, 0, 11));
    const points = g.wallet.points;
    zombie.takeHit({ damage: zombie.health + 1, source, part, melee: source === "melee" });
    return g.wallet.points - points;
  };
  assert.equal(makeKill('hazard'), 60);
  g.wardrobe.buy('goldCard');
  assert.equal(makeKill('hazard'), 70);
  assert.equal(makeKill('gun', 'head'), 110);
  collect(game, 'blueLightSpecial');
  assert.equal(makeKill('melee'), 200);
  g.health.takeDamage(10000);
  assert.equal(makeKill('gun'), 0);
});

test('apparel displays clear the solid map and stay visible from their aisle views', (t) => {
  const game = scenario(t), { g } = game;
  g.debug.run('doors');
  game.tick(120);
  const camera = g.player.camera;
  const { group, cullAreas, cullPortals } = g.map;
  const culling = createRoomCulling({ areas: cullAreas, portals: cullPortals, camera, isOpen: () => true });
  culling.tag(group);
  const ray = new Raycaster();
  ray.layers.enableAll();

  for (const spot of g.map.features.filter(f => f.kind === 'wardrobeRack' || f.kind === 'fittingRoom')) {
    const display = group.getObjectByName(spot.name);
    const labels = display.children.filter(mesh => mesh.geometry.type === 'PlaneGeometry');
    assert.ok(labels.length > 0, spot.name);
    for (const mesh of display.children) {
      const bounds = new Box3().setFromObject(mesh).expandByScalar(-0.007);
      assert.ok(!g.colliders.some(solid => bounds.intersectsBox(solid)), `${spot.name}: display intersects a solid`);
    }

    const right = new Vector3(spot.normal.z, 0, -spot.normal.x);
    const views = [[0.95, 0], [2.65, 0], [1.6, -0.82], [1.6, 0.82]];
    // Approach around the KNITS rack, within the locker corridor, and inside the Good Sports glass.
    if (spot.item === 'cardigan') views[1] = [2.1, -0.6];
    if (spot.item === 'staffLockers') views[1] = [1.67, 0];
    if (spot.item === 'foamFinger') views[3] = [1.6, 0.43];

    for (const [distance, side] of views) {
      camera.position.copy(spot.position).addScaledVector(spot.normal, distance).addScaledVector(right, side);
      camera.position.y += feel.player.eyeHeight - 1.4;
      camera.lookAt(labels.at(-1).position);
      culling.update();
      assert.ok(display.children.every(mesh => camera.layers.test(mesh.layers)), `${spot.name}: room culls the display from its aisle`);
      for (const sign of labels) {
        const sight = sign.position.clone().sub(camera.position);
        ray.far = sight.length() - 0.007;
        ray.set(camera.position, sight.normalize());
        const blocker = ray.intersectObject(group, true).find(hit => hit.object.isMesh && hit.object.parent !== display);
        assert.ok(!blocker, `${spot.name}: label blocked by ${blocker?.object.name || 'mall scenery'}`);
      }
    }
  }
});
