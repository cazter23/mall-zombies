import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Raycaster, Vector3 } from 'three';
import { createRoomCulling } from '../src/fx/roomCulling.js';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { economy } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { bossVouchers } from '../src/config/bosses.js';
import { powerUps } from '../src/config/powerUps.js';
import { wardrobeItems, statBetter } from '../src/config/wardrobe.js';
import { hasStatNumber } from '../src/config/effectWords.js';
import { weapons } from '../src/config/weapons.js';
import { zombieTypes } from '../src/config/zombies.js';
import { aimAssist as assistCfg } from '../src/config/controls.js';
import { createAim } from '../src/weapons/aim.js';
import { createAimAssist } from '../src/weapons/aimAssist.js';
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

const roomOf = (game, name) => game.g.features.list.find(({ feature }) => feature.name === name);

// Hold interact at a fitting room's mirror: the picker opens. Returns the room's instance ({ picker, view }).
function openPicker(game, feature) {
  standAt(game, feature);
  assert.equal(game.g.interactions.prompt.kind, 'fittingRoom', feature.name);
  game.press('KeyF', holdTicks);
  assert.equal(game.g.state.menu, 'fittingRoom', feature.name);
  return game.g.features.list.find((built) => built.feature === feature).instance;
}

// Put `id` on through the open picker with real key presses. Returns the presses spent inside its slot (move + confirm).
function choose(game, room, id) {
  const { slot } = wardrobeItems[id];
  for (let i = 0; room.view.slot !== slot; i++) {
    assert.ok(i < 4, `slot ${slot} reachable`);
    game.press('KeyD');
  }
  const items = room.view.slots.find((s) => s.id === slot).items;
  const from = items.findIndex((item) => item.selected);
  const to = items.findIndex((item) => item.id === id);
  const down = (to - from + items.length) % items.length;
  let presses = 0;
  for (let i = 0; i < Math.min(down, items.length - down); i++, presses++) game.press(down <= items.length - down ? 'KeyS' : 'KeyW');
  if (!items[to].worn) { game.press('KeyF'); presses++; }
  return presses;
}

test('all 12 racks sell through mall input with words on the ticket, the three fitting rooms open the picker, and it all resets with the run', (t) => {
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
  assert.notEqual(g.interactions.prompt?.kind, 'fittingRoom', 'nothing to change into yet');
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
  for (const rack of racks) {
    const { item: id } = rack;
    const { slot, ticket } = wardrobeItems[id];
    const position = standAt(game, rack);
    assert.equal(overlapsSolid(position, feel.player.radius, feel.player.height, g.colliders, 0), false, rack.name);
    const previous = g.wardrobe.wearing(slot);
    const prompt = g.interactions.prompt;
    assert.equal(prompt.id, id, rack.name);
    assert.equal(prompt.kind, 'wardrobe');
    assert.equal(prompt.cost, economy.wardrobe[id]);
    const terms = prompt.detail.split(' · ');
    assert.equal(terms[0], ticket, 'the joke line first');
    assert.ok(prompt.detailLines.length >= 2, `${id}: an upside and a downside`);
    assert.ok(prompt.detailLines.some(l => l.good) && prompt.detailLines.some(l => !l.good), id);
    for (const { text } of prompt.detailLines) {
      assert.ok(terms.includes(text), `${id}: "${text}" on the ticket`);
      assert.ok(!/\d/.test(text), `${id}: "${text}" shows a number`);
    }
    assert.equal(terms.at(-1), previous ? `Replaces ${wardrobeItems[previous].name}` : `${slot[0].toUpperCase()}${slot.slice(1)} slot`);
    const before = g.wallet.points;
    game.press('KeyF', holdTicks);
    assert.equal(before - g.wallet.points, economy.wardrobe[id]);
    assert.equal(g.wardrobe.owns(id), true);
    assert.equal(g.wardrobe.wearing(slot), id);
    assert.deepEqual(changes.at(-1), { slot, worn: id, removed: previous });
    assert.deepEqual(purchases.at(-1), { kind: 'wardrobe', id, label: wardrobeItems[id].name, cost: economy.wardrobe[id] });
    assertFactors(g.stats, base, g.wardrobe.status.worn);
    assert.notEqual(g.interactions.prompt?.id, id, 'bought rack stops offering the item');
  }
  assert.equal(g.wardrobe.status.owned.length, 12);
  assert.equal(g.wardrobe.wear('nope'), false);
  assert.equal(g.wardrobe.wear(g.wardrobe.wearing('head')), false, 'already on');

  const points = g.wallet.points;
  for (const feature of rooms) {
    const position = standAt(game, feature);
    assert.equal(overlapsSolid(position, feel.player.radius, feel.player.height, g.colliders, 0), false, feature.name);
    assert.equal(g.interactions.prompt.priceLabel, 'Free');
    assert.equal(g.interactions.prompt.title, 'Change your outfit');
    const sold = purchases.length;
    const room = openPicker(game, feature);
    assert.equal(purchases.length, sold, 'opening the picker is not a purchase');
    assert.equal(room.view.slots.length, 4);
    assert.ok(room.view.slots.every(s => s.items.length === 3));
    const target = g.wardrobe.ownedIn('feet').find(id => id !== g.wardrobe.wearing('feet'));
    choose(game, room, target);
    assert.equal(g.wardrobe.wearing('feet'), target);
    assert.deepEqual(purchases.at(-1), { kind: 'fittingRoom', id: target, label: wardrobeItems[target].name, cost: 0 });
    assertFactors(g.stats, base, g.wardrobe.status.worn);
    game.press('KeyQ');
    assert.equal(g.state.menu, null, 'back closes it');
    assert.equal(room.view, null);
  }
  assert.equal(g.wallet.points, points);

  openPicker(game, rooms[0]);
  g.resetRun();
  assert.equal(g.state.menu, null, 'Play again closes an open picker');
  const fresh = headlessGame();
  t.after(() => fresh.g.map.dispose());
  assert.deepEqual(snapshot(g), snapshot(fresh.g));
});

test('the picker reaches every one of the 81 outfits, in at most two presses per slot', (t) => {
  const game = scenario(t), { g } = game;
  g.debug.run('doors');
  const base = { ...g.stats };
  g.debug.run('wardrobe');
  const bySlot = Object.fromEntries(['head', 'torso', 'feet', 'accessory'].map(slot => [slot, g.wardrobe.ownedIn(slot)]));
  assert.deepEqual(Object.values(bySlot).map(ids => ids.length), [3, 3, 3, 3]);
  const room = openPicker(game, g.map.features.find(f => f.name === 'fittingRoom_shoePerSale'));
  const points = g.wallet.points;
  const seen = new Set();
  for (const head of bySlot.head) for (const torso of bySlot.torso) for (const feet of bySlot.feet) for (const accessory of bySlot.accessory) {
    const outfit = { head, torso, feet, accessory };
    for (const id of Object.values(outfit)) assert.ok(choose(game, room, id) <= 2, `${id}: two presses at most`);
    assert.deepEqual(g.wardrobe.status.worn, outfit);
    assertFactors(g.stats, base, outfit);
    seen.add(Object.values(outfit).join());
  }
  assert.equal(seen.size, 81);
  assert.equal(g.state.menu, 'fittingRoom', 'it stays open while you change');
  assert.equal(g.wallet.points, points);
});

test('the picker closes on a zombie hit, on being moved away and on death, and the player stands still meanwhile', (t) => {
  const game = scenario(t), { g } = game;
  g.debug.run('doors');
  g.debug.run('wardrobe');
  const feature = g.map.features.find(f => f.name === 'fittingRoom_staffLockers');
  const room = openPicker(game, feature);
  const at = g.player.position.clone();
  game.press('KeyW', 30); // (menuUp, not walking)
  assert.ok(g.player.position.distanceTo(at) < 1e-6, 'frozen while it is open');
  assert.ok(room.view);

  g.events.emit('playerHit', { damage: 10 });
  assert.equal(g.state.menu, null, 'a hit closes it');
  assert.equal(room.view, null);

  openPicker(game, feature);
  g.player.teleport({ position: g.map.playerSpawn.position ?? g.player.position.clone().add(new Vector3(0, 0, 8)), yaw: 0 });
  game.tick();
  assert.equal(g.state.menu, null, 'leaving the mirror closes it');

  openPicker(game, feature);
  g.health.takeDamage(10000);
  assert.equal(g.state.menu, null, 'death closes it');
});

test('the fitting room keeps PadX tap-to-reload, a hold opens the picker, and the nearby HOFFMAN’S spawn stays shut', (t) => {
  const game = scenario(t), { g } = game;
  g.debug.run('doors');
  for (const id of ['paperHat', 'aviators']) g.wardrobe.buy(id);
  const feature = g.map.features.find(f => f.name === 'fittingRoom_hoffmans');
  const room = roomOf(game, feature.name).instance;
  standAt(game, feature);
  assert.equal(g.interactions.prompt.kind, 'fittingRoom');
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
  assert.equal(room.view, null, 'a tap is a reload');
  g.gun.weapon.cancelReload();
  game.press('PadX', holdTicks * 3);
  game.tick();
  assert.equal(g.gun.weapon.isReloading, false);
  assert.equal(g.state.menu, 'fittingRoom');
  assert.equal(g.wardrobe.wearing('head'), 'aviators', 'opening changes nothing');
  assert.equal(room.view.slot, 'head');
  game.press('PadDown');
  assert.equal(room.view.title, wardrobeItems.paperHat.name);
  assert.ok(room.view.lines.some(l => l.good) && room.view.lines.some(l => !l.good));
  game.press('PadA');
  assert.equal(g.wardrobe.wearing('head'), 'paperHat');
  assert.equal(g.player.velocity.y, 0, 'PadA confirmed: it did not jump');
  game.press('PadB');
  assert.equal(g.state.menu, null);
});

test('Apparel Flash Sales require an available rack and stack with a coupon and Discount Code; a fitting-room change spends neither', (t) => {
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
  const base = economy.wardrobe.goldCard;
  const sale = Math.round(base * (1 - g.flashSales.active.discount) / 10) * 10;
  const coupon = powerUps.types.employeeDiscount;
  const afterCoupon = sale - Math.min(coupon.maxSaving, Math.floor(sale * coupon.fraction / 10) * 10);
  const expected = afterCoupon - Math.floor(afterCoupon * bossVouchers.discountCode.fraction / 10) * 10;
  g.wallet.earn(1000);
  g.pricing.setVoucher(bossVouchers.discountCode);
  collect(game, 'employeeDiscount');

  const wallet = g.wallet.points;
  const room = openPicker(game, g.map.features.find(f => f.name === 'fittingRoom_staffLockers'));
  choose(game, room, 'paperHat');
  assert.equal(g.wardrobe.wearing('head'), 'paperHat');
  game.press('KeyQ');
  assert.equal(g.wallet.points, wallet, 'free');
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

test('clothing stacks with live incentives, caps health and sprint, and scales zombie hits and knockback but not a fall', (t) => {
  const game = scenario(t), { g } = game;
  const { stats, player, wardrobe } = g;
  const base = { ...stats };
  const shift = powerUps.types.shiftBonus;
  const loss = powerUps.types.lossPrevention;
  wardrobe.buy('cardigan');
  near(stats.maxHealth, base.maxHealth * 1.25, 'Cardigan capacity');
  assert.equal(stats.health, base.health);
  near(player.sprintMeter, stats.sprintDuration, 'shorter sprint clamps the meter');
  stats.health = stats.maxHealth;

  collect(game, 'shiftBonus');
  collect(game, 'lossPrevention');
  wardrobe.buy('sandwichBoard');
  near(stats.health, base.health, 'removing Cardigan clamps health');
  assert.ok(player.sprintMeter < stats.sprintDuration, 'restored sprint cap does not fill the meter');
  wardrobe.buy('hiVisVest');
  wardrobe.buy('foamFinger');
  wardrobe.buy('fannyPack');
  wardrobe.buy('lightUpSneakers');
  for (const id of ['cardigan', 'sandwichBoard', 'foamFinger']) assert.equal(wardrobe.wear(id), true);
  near(stats.reloadSpeed, base.reloadSpeed * shift.reloadMultiplier * 0.9, 'shift bonus and finger');
  near(stats.sprintSpeed, base.sprintSpeed * shift.speedMultiplier * 1.1, 'shift bonus and shoes');
  near(stats.meleeDamageMultiplier, base.meleeDamageMultiplier * loss.damageMultiplier * 1.5, 'loss prevention and finger');
  g.powerUps.update(120);
  assertFactors(stats, base, wardrobe.status.worn);

  player.onFall({ drop: 6, damage: 10 });
  near(stats.health, base.health - 10, 'a board does not cushion a fall');
  player.velocity.set(0, 0, 0);
  g.events.emit('playerHit', { damage: 40, knockback: { x: 6, z: -4 } });
  near(stats.health, base.health - 10 - 32, 'Sandwich Board: a Shopper hit is 32');
  assert.deepEqual(player.velocity.toArray(), [3, 0, -2]);
  wardrobe.wear('hiVisVest');
  g.events.emit('playerHit', { damage: 40 });
  near(stats.health, base.health - 10 - 32 - 48, 'Hi-Vis Vest: a Shopper hit is 48 (three still down you)');
  player.onFall({ drop: 6, damage: 5 });
  near(stats.health, base.health - 10 - 32 - 48 - 5, 'nor does a vest worsen one');
});

test('ticket lines are words only: each factor has a direction and one line, sizes come from the fixed bands, and no player-facing text carries a number', (t) => {
  const game = scenario(t), { g } = game;
  const { stats, wardrobe } = g;
  for (const [id, item] of Object.entries(wardrobeItems)) {
    for (const stat of Object.keys(item.factors)) {
      assert.ok(['higher', 'lower'].includes(statBetter[stat]), `${id}: ${stat} has a direction`);
      assert.ok(stat in stats, `${id}: ${stat} is a declared stat`);
      assert.equal(item.lines.filter((l) => l.effect === stat).length, 1, `${id}: exactly one line for ${stat}`);
    }
    for (const line of item.lines) assert.ok(line.effect in item.factors, `${id}: a line for a factor it has`);
    assert.equal(item.lines.length, Object.keys(item.factors).length, id);
    assert.ok(item.ticket && Number.isInteger(item.color) && item.icon, `${id}: joke line, colour and icon`);
  }
  assert.equal(new Set(Object.values(wardrobeItems).map(i => i.color)).size, 12, 'a signature colour each');
  assert.equal(new Set(Object.values(wardrobeItems).map(i => i.icon)).size, 12, 'an icon each');

  const texts = (id) => wardrobe.statLines(id).map(l => l.text);
  assert.deepEqual(wardrobe.statLines('cardigan'), [
    { stat: 'maxHealth', good: true, text: 'Noticeably more health' },
    { stat: 'sprintDuration', good: false, text: 'Sprints noticeably shorter' },
  ]);
  assert.deepEqual(texts('hiVisVest'), ['Reloads noticeably faster', "Your own blasts can't hurt you", 'Zombie hits hurt noticeably more']);
  assert.equal(wardrobe.ticketDetail('hiVisVest'), `${wardrobeItems.hiVisVest.ticket} · Reloads noticeably faster · Your own blasts can't hurt you · Zombie hits hurt noticeably more · Torso slot`);
  for (const id of Object.keys(wardrobeItems)) {
    for (const line of wardrobe.statLines(id)) assert.ok(!hasStatNumber(line.text) && !/\d/.test(line.text), `${id}: "${line.text}"`);
    assert.ok(!hasStatNumber(wardrobe.ticketDetail(id)), id);
    // an upside is a factor that moves its stat the good way
    for (const line of wardrobe.statLines(id)) {
      const factor = wardrobeItems[id].factors[line.stat];
      assert.equal(line.good, (factor > 1) === (statBetter[line.stat] === 'higher'), `${id}: ${line.stat}`);
    }
    assert.ok(wardrobe.statLines(id).some((l) => l.good) && wardrobe.statLines(id).some((l) => !l.good), `${id}: an upside and a downside`);
  }

  // Running incentives change the stats but not the words: the lines are about the item.
  collect(game, 'shiftBonus');
  const before = texts('lightUpSneakers');
  assert.deepEqual(before, ['Sprints a little faster', 'Sprints a little shorter']);
  const quick = stats.sprintSpeed;
  wardrobe.buy('lightUpSneakers');
  near(stats.sprintSpeed, quick * 1.1, 'the item still does what its words say');
  assert.deepEqual(texts('lightUpSneakers'), [], 'nothing changes for what you wear');
  assert.deepEqual(wardrobe.wornLines('lightUpSneakers').map((l) => l.text), before, 'the pause screen says the same words');
  assert.deepEqual(texts('orthopedicWalkers'), ['Sprints noticeably longer', 'Sprint recovers much sooner', 'Sprints a little slower']);
  wardrobe.buy('hiVisVest');
  assert.deepEqual(texts('sandwichBoard'), ['Zombie hits hurt noticeably less', 'Shoved much less', 'Strafes noticeably slower']);
  assert.ok(wardrobe.ticketDetail('sandwichBoard').endsWith('Replaces Hi-Vis Vest'));
});

test('limits: no item raises jump, vault height or walk speed, and the fastest outfit still sprints slower than a Cart charge', () => {
  const fastest = {};
  for (const [id, item] of Object.entries(wardrobeItems)) {
    for (const stat of ['jumpVelocity', 'vaultMaxHeight', 'walkSpeed']) assert.ok((item.factors[stat] ?? 1) <= 1, `${id} raises ${stat}`);
    for (const factor of Object.values(item.factors)) assert.ok(factor > 0, id);
    assert.ok(Object.values(item.factors).some(f => f !== 1), id);
    fastest[item.slot] = Math.max(fastest[item.slot] ?? 1, item.factors.sprintSpeed ?? 1);
  }
  const top = feel.movement.sprintSpeed * Object.values(fastest).reduce((a, b) => a * b, 1);
  assert.ok(top < zombieTypes.cartPusher.charge.speed, `sprint ${top} vs the Cart's ${zombieTypes.cartPusher.charge.speed}`);
  assert.ok(top > feel.movement.sprintSpeed, 'and something does make you faster');
});

test("'regenStart' fires once each time health begins to climb back", (t) => {
  const game = scenario(t), { g } = game;
  let starts = 0;
  g.events.on('regenStart', () => starts++);
  game.tick(30);
  assert.equal(starts, 0, 'nothing to heal');
  const delayTicks = Math.ceil(g.stats.regenDelay / dt) + 2;
  g.events.emit('playerHit', { damage: 40 });
  game.tick(delayTicks - 10);
  assert.equal(starts, 0, 'still waiting');
  game.tick(12);
  assert.equal(starts, 1);
  game.tick(60);
  assert.equal(starts, 1, 'once, not every tick');
  g.events.emit('playerHit', { damage: 10 });
  game.tick(delayTicks);
  assert.equal(starts, 2, 'a new hit, a new recovery');
  game.tick(60 * 30);
  assert.equal(g.stats.health, g.stats.maxHealth);
  g.wardrobe.buy('cardigan'); // (a bigger maximum leaves a gap to fill)
  game.tick(2);
  assert.equal(starts, 3);
});

test('the debug command gives every item without undressing you, and marks the run assisted', (t) => {
  const game = scenario(t), { g } = game;
  g.wardrobe.buy('glasses');
  assert.equal(g.state.assisted, false);
  assert.equal(g.debug.resolve('KeyH', true).id, 'wardrobe');
  assert.equal(g.debug.run('wardrobe'), 'Gave 11 Wardrobe items');
  assert.equal(g.state.assisted, true);
  assert.equal(g.wardrobe.status.owned.length, 12);
  assert.equal(g.wardrobe.wearing('head'), 'glasses', 'what you wore stays on');
  assert.deepEqual(Object.values(g.wardrobe.status.worn).filter(Boolean).length, 4, 'empty slots get dressed');
  assert.equal(g.debug.run('wardrobe'), 'You already own every Wardrobe item');
  assert.equal(g.wallet.totalSpent, 0);
});

test('the Aviators strengthen controller aim assist (rotational follow) and nothing for a mouse', () => {
  const follow = (multiplier, device = 'gamepad') => {
    const box = new Box3(new Vector3(-0.3, 0, -6.3), new Vector3(0.3, 1.8, -5.7));
    const target = { isAlive: true, state: 'chase', hitboxes: [{ part: 'body', box }] };
    const player = {
      stats: { aimAssistMultiplier: multiplier }, yaw: 0, pitch: 0, viewKick: 0, clampPitch() {},
      getAim(origin, direction) { origin.set(0, 1.8 * assistCfg.chestHeightFraction, 0); direction.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); },
    };
    const input = { device, padMove: { x: 1, y: 0 }, padLook: { x: 0, y: 0 } };
    const assist = createAimAssist({ player, input, shootables: [target], colliders: [] });
    const aim = { amount: 0, justStartedAiming: false };
    assist.update(dt, aim);
    box.translate(new Vector3(0.2, 0, 0));
    assist.update(dt, aim);
    return player.yaw;
  };
  const plain = follow(1);
  assert.ok(Math.abs(plain) > 1e-4, 'the aim follows the target');
  near(follow(1.2) / plain, 1.2, 'x1.2');
  assert.equal(follow(1.2, 'mouse'), 0);
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
  near(hitDamage(def, head, 0, g.stats), before * 1.5, 'head bonus');
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

test('Gold Card boosts rounded base credit for any kill source, with Commission Day and bonuses applied once', (t) => {
  const game = scenario(t), { g } = game;
  const makeKill = (source, part = 'body') => {
    const zombie = g.zombies.spawn('shopper', new Vector3(0, 0, 11));
    const points = g.wallet.points;
    zombie.takeHit({ damage: zombie.health + 1, source, part, melee: source === 'melee' });
    return g.wallet.points - points;
  };
  assert.equal(makeKill('hazard'), 60);
  g.wardrobe.buy('goldCard');
  assert.equal(makeKill('hazard'), 80); // 60 x 1.25 = 75, paid in tens
  assert.equal(makeKill('gun', 'head'), 120);
  collect(game, 'commissionDay');
  // Base 60 * 1.25 (goldCard -> 80) + 70 (meleeKillBonus) = 150, doubled to 300 once via Commission Day.
  assert.equal(makeKill('melee'), 300);
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

  // (Showpieces are checked in tests/showpieces.test.js.)
  for (const spot of g.map.features.filter(f => (f.kind === 'wardrobeRack' && !f.showpiece) || f.kind === 'fittingRoom')) {
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
