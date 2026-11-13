// Save & Quit (game/saveGame.js): one slot, the run as it stood at the START of the current round, used up when loaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dt, headlessGame } from './helpers/headlessGame.js';
import { feel } from '../src/config/feel.js';
import { closingTime } from '../src/config/closingTime.js';
import { weapons } from '../src/config/weapons.js';
import { TIER_IDS, withTier } from '../src/weapons/upgrades.js';
import { save as saveConfig } from '../src/config/save.js';
import { createCareerStats } from '../src/game/careerStats.js';
import { featuresOf } from '../src/game/features/index.js';
import { ownsAttachment } from '../src/game/features/attachmentCounter.js';
import { attachmentsOf } from '../src/weapons/upgrades.js';

function memoryStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
  };
}

// A game sharing `storage` (the map is built before anything random is seeded: see CLAUDE.md).
function game(t, storage, options = {}) {
  const run = headlessGame({ saveStorage: storage, ...options });
  t.after(() => run.g.map.dispose());
  return run;
}

// A run with things bought and earned, at the start of round `n` (the snapshot is taken at the end of that tick).
function busyRunAt(t, storage, n = 6) {
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  g.map.areaUnlocks.unlock('hallway');
  g.map.areaUnlocks.unlock('foodCourt');
  g.gun.give(weapons.nailGun);
  g.gun.setMods('nailGun', withTier(weapons.nailGun, g.gun.modsFor('nailGun'), TIER_IDS[1])); // (an Extended Warranty tier)
  g.wardrobe.buy('paperHat'); // (its factors go into the stats: a load must not apply them twice)
  g.secondChance.buy();
  g.tickets.add(7);
  g.wallet.earn(4321);
  g.flashSales.startNow();
  g.rounds.jumpTo(n);
  run.tick();
  return run;
}

test('every Play again step is either saved or named transient', (t) => {
  const { g } = game(t, memoryStorage());
  const covered = new Set([...g.saveSteps, ...g.transientSteps]);
  for (const name of g.resetSteps) assert.ok(covered.has(name), `reset step "${name}" is neither saved nor transient`);
  for (const name of g.saveSteps) assert.ok(!g.transientSteps.includes(name), `"${name}" is both saved and transient`);
});

test('a load gives back the run as it was at the START of the round, not what happened since', (t) => {
  const storage = memoryStorage();
  const { g } = busyRunAt(t, storage, 6);
  const atStart = g.saveGame.serializeNow();
  assert.equal(g.saveGame.snapshot.round, 6);
  assert.deepEqual(g.saveGame.snapshot.data, atStart);

  // Mid-round: more points, another area, Second Chance spent. None of it is kept.
  g.wallet.earn(9000);
  g.map.areaUnlocks.unlock('megaMart');
  assert.equal(g.saveGame.saveAndQuit(), true);
  assert.ok(storage.items.has(saveConfig.storageKey));

  const loaded = game(t, storage);
  assert.deepEqual(loaded.g.saveGame.peek()?.round, 6);
  assert.equal(loaded.g.saveGame.load(), true);
  assert.equal(storage.items.size, 0, 'the slot is used up by the load');
  assert.equal(loaded.g.rounds.round, 6);
  assert.equal(loaded.g.rounds.state, 'break', 'the round replays from its break');
  assert.equal(loaded.g.rounds.started, true);
  assert.equal(loaded.g.wallet.points, atStart.wallet.points);
  assert.equal(loaded.g.map.zones.megaMart.open, false);
  assert.equal(loaded.g.map.zones.foodCourt.open, true);
  assert.deepEqual(loaded.g.gun.slots, g.gun.slots);
  assert.equal(loaded.g.secondChance.status, 'held');
  // Idempotent: what the loaded game would save now is exactly what was saved.
  assert.deepEqual(loaded.g.saveGame.serializeNow(), atStart);
});

test('a replay has the same draws: boss schedule, Flash Sale and claw site', (t) => {
  const storage = memoryStorage();
  const { g } = busyRunAt(t, storage, 9);
  const { bosses, flashSales, features } = g.saveGame.snapshot.data;
  g.saveGame.saveAndQuit();
  const loaded = game(t, storage);
  loaded.g.saveGame.load();
  assert.equal(loaded.g.bosses.scheduledRound, g.bosses.scheduledRound);
  assert.deepEqual(loaded.g.bosses.serialize(), bosses);
  assert.deepEqual(loaded.g.flashSales.serialize(), flashSales);
  assert.equal(loaded.g.flashSales.active?.id, g.flashSales.active?.id);
  assert.deepEqual(loaded.g.features.serialize(), features);
});

test('a gun away at Build-A-Blaster, with the Courtesy Loaner in hand, comes back the same', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  run.tick();
  const { g } = run;
  g.gun.handOver({ ...weapons.priceGun, name: 'Courtesy Loaner', loaner: true });
  g.rounds.jumpTo(3);
  run.tick();
  const saved = g.gun.serialize();
  g.saveGame.saveAndQuit();
  const loaded = game(t, storage);
  loaded.g.saveGame.load();
  assert.deepEqual(loaded.g.gun.serialize(), saved);
  assert.equal(loaded.g.gun.isLoaner, true);
  assert.equal(loaded.g.gun.away?.def.id, 'stapleGun');
});

test('saving needs a started round, a live player and full health', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  assert.equal(g.saveGame.canSave().ok, false, 'before round 1');
  run.tick();
  assert.equal(g.saveGame.canSave().ok, true);
  g.stats.health = g.stats.maxHealth - 1;
  assert.deepEqual(g.saveGame.canSave(), { ok: false, reason: saveConfig.reasons.hurt });
  assert.equal(g.saveGame.saveAndQuit(), false);
  assert.equal(storage.items.size, 0);
  g.health.takeDamage(1000);
  assert.deepEqual(g.saveGame.canSave(), { ok: false, reason: saveConfig.reasons.dead });
});

test('an older version\'s save is dropped, never half-loaded', (t) => {
  const storage = memoryStorage();
  storage.setItem(saveConfig.storageKey, JSON.stringify({ version: saveConfig.version - 1, round: 4, data: {} }));
  const { g } = game(t, storage);
  assert.equal(g.saveGame.peek(), null);
  assert.equal(g.saveGame.dropped, true);
  assert.equal(storage.items.size, 0);
  assert.equal(g.saveGame.load(), false);
  assert.equal(g.rounds.started, false);
});

test('saving is not a death: no runEnd, so career records count the run once, when it really ends', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  run.tick();
  const career = createCareerStats({ storage: memoryStorage() });
  let ended = 0;
  run.g.events.on('runEnd', ({ summary }) => { ended += 1; career.recordRun(summary); });
  assert.equal(run.g.saveGame.saveAndQuit(), true);
  assert.equal(ended, 0);
  assert.equal(career.snapshot().totals.runs, 0);
});

test('Bubble Wrap bought before the round survives a load, partly used layers included', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  run.tick();
  run.g.health.addArmour(2);
  run.g.health.absorb(15); // the outer layer is worn down, not popped
  run.g.rounds.jumpTo(3);
  run.tick();
  const layers = run.g.health.armour;
  run.g.saveGame.saveAndQuit();
  const loaded = game(t, storage);
  loaded.g.saveGame.load();
  assert.deepEqual(loaded.g.health.armour, layers);
  assert.equal(layers.length, 2);
});

test('a save made with a SPIN-O-MATIC Sentry out loads without one: it is transient, the pockets come back as of the round\'s start', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  g.equipment.give('sentry', 1);
  g.equipment.give('airHorn', 2);
  g.equipment.detonate('sentry', g.player.position.clone().setZ(g.player.position.z - 2).setY(0.16)); // (the one out)
  assert.ok(g.equipment.sentry?.deployed);
  g.rounds.jumpTo(3); // (the snapshot is taken at the end of the next tick, with the Sentry still out)
  run.tick();
  assert.ok(g.equipment.sentry, 'still out when the round began');
  assert.equal(g.saveGame.saveAndQuit(), true);

  const loaded = game(t, storage);
  assert.equal(loaded.g.saveGame.load(), true);
  assert.equal(loaded.g.equipment.sentry, null, 'no Sentry after the load');
  assert.equal(loaded.g.equipment.live.length, 0);
  assert.deepEqual(loaded.g.equipment.pockets, g.saveGame.snapshot.data.equipment.pockets);
  assert.deepEqual(loaded.g.equipment.pockets.tactical, { id: 'airHorn', count: 2 });
  loaded.tick(2);
  assert.equal(loaded.g.equipment.sentry, null, 'and none appears');
});

test("Kiosk Kevin reopens where he stood at the round's start: not the first site, and not where a mid-round move took him", (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  for (const id of ['hallway', 'foodCourt', 'upstairs']) g.map.areaUnlocks.unlock(id);
  g.rounds.jumpTo(5); // (first move round after the opening round: he moves off the Hallway)
  run.tick();
  const kevinOf = (game) => game.features.list.find(({ feature }) => feature.kind === 'kiosk').instance;
  const atStart = kevinOf(g).site.id;
  assert.notEqual(atStart, 'hallway');
  const elsewhere = ['hallway', 'foodCourt', 'upstairs'].find((id) => id !== atStart);
  assert.equal(kevinOf(g).moveNow(elsewhere)?.id, elsewhere, 'moved after the snapshot');
  assert.equal(g.saveGame.saveAndQuit(), true);

  const loaded = game(t, storage);
  const lines = [];
  loaded.g.events.on('kioskStock', ({ pa }) => lines.push(pa.text));
  assert.equal(loaded.g.saveGame.load(), true);
  const kevin = kevinOf(loaded.g);
  assert.equal(kevin.site.id, atStart);
  assert.equal(kevin.status.pending, null);
  loaded.tick();
  assert.ok(kevin.status.open, 'open for business at the start of the round');
  assert.match(lines[0], new RegExp(`open in ${kevin.site.where}`), 'the PA says where he is');
  assert.equal(kevin.site.id, atStart, 'a load is not a round start: he does not move again');
});

test('Kiosk Kevin Save & Quit mid-block reloads the same site and stock, stays put until the next block', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  const kevinOf = (gameInstance) => gameInstance.features.list.find(({ feature }) => feature.kind === 'kiosk').instance;
  run.tick();
  for (const id of ['hallway', 'foodCourt', 'upstairs']) g.map.areaUnlocks.unlock(id);

  // Move on round 5 (second block: Sparkler Cake, Bubble Wrap, Glitter Bomb; Pick Sparkler Cake).
  g.rounds.jumpTo(5);
  run.tick();
  const siteAt5 = kevinOf(g).site.id;
  assert.notEqual(siteAt5, 'hallway');

  // Advance to round 6 (mid-block): Kevin stays at siteAt5 with identical stock & Pick before Save & Quit.
  g.rounds.jumpTo(6);
  run.tick();
  assert.equal(kevinOf(g).site.id, siteAt5);
  assert.deepEqual(kevinOf(g).status.stock, ['sparklerCake', 'bubbleWrap', 'glitterBomb']);
  assert.equal(kevinOf(g).status.pick, 'sparklerCake');
  assert.equal(g.saveGame.saveAndQuit(), true);

  // Reloading mid-block restores round 6, the same site, and the same stock & Pick.
  const loaded = game(t, storage);
  const lines = [];
  loaded.g.events.on('kioskStock', (e) => lines.push(e));
  assert.equal(loaded.g.saveGame.load(), true);
  const kevin = kevinOf(loaded.g);
  assert.equal(loaded.g.rounds.round, 6);
  assert.equal(kevin.site.id, siteAt5);
  assert.deepEqual(kevin.status.stock, ['sparklerCake', 'bubbleWrap', 'glitterBomb']);
  assert.equal(kevin.status.pick, 'sparklerCake');
  loaded.tick();
  assert.equal(lines.length, 1, 'opening announcement on load tells the returning player his site');

  // Advancing to round 7 (still mid-block) keeps site, stock & Pick unchanged with no extra PA.
  loaded.g.rounds.jumpTo(7);
  loaded.tick();
  assert.equal(kevin.site.id, siteAt5);
  assert.deepEqual(kevin.status.stock, ['sparklerCake', 'bubbleWrap', 'glitterBomb']);
  assert.equal(kevin.status.pick, 'sparklerCake');
  assert.equal(lines.length, 1, 'no PA on round 7 mid-block');

  // Advancing to round 8 (next block) moves Kevin to a new site and rotates to Sentry stock / Bubble Wrap Pick.
  loaded.g.rounds.jumpTo(8);
  loaded.tick();
  assert.notEqual(kevin.site.id, siteAt5);
  assert.deepEqual(kevin.status.stock, ['sentry', 'bubbleWrap', 'airHorn']);
  assert.equal(kevin.status.pick, 'bubbleWrap');
  assert.equal(lines.length, 2, 'moved PA plays when the new block begins');
});

test('Closing Time survives a load: a key still on the floor, a held key and its duty count, and the run mode', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  g.state.closingMode = 'classic';
  g.debug.run('closing', 'grant', 'janitor'); // the Key Ring: opens the fountain duty (count 0)
  g.debug.run('closing', 'drop', 'guard'); // the Safe Key, left on the floor at the player's feet
  run.standAt(20, 4); // walk away so it isn't picked up
  g.rounds.jumpTo(8);
  run.tick();
  const saved = g.closing.serialize();
  assert.equal(saved.drops.length, 1, 'one key on the floor');
  assert.deepEqual(saved.held, ['janitor']);
  g.saveGame.saveAndQuit();
  const loaded = game(t, storage);
  loaded.g.saveGame.load();
  assert.deepEqual(loaded.g.closing.serialize(), saved);
  assert.equal(loaded.g.closing.pickups.length, 1, 'the floor key is back, so it can still be collected');
  assert.equal(loaded.g.state.closingMode, 'classic');
  assert.equal(loaded.g.state.assisted, true, 'a debug run stays one');
});

test('a save made in overtime keeps the win: Stay for overtime takes a fresh snapshot', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  for (const boss of ['janitor', 'guard', 'manager', 'influencer']) g.debug.run('closing', 'grant', boss);
  for (const line of ['janitor', 'guard', 'manager']) while (!g.closing.isDone(line)) g.events.emit(
    line === 'janitor' ? 'fountainKill' : line === 'manager' ? 'ritualCollect' : 'purchase', { kind: 'closing', id: 'nightSafe' });
  g.events.emit('purchase', { kind: 'closing', id: 'validation' });
  g.events.emit('bossDefeated', { zombie: { type: { id: 'lastCustomer' }, position: g.player.position } });
  g.events.emit('escapeVanStart');
  assert.equal(g.state.winPending, true);
  assert.equal(g.saveGame.canSave().ok, false, 'not while the win receipt is up');
  g.stayForOvertime();
  run.tick();
  assert.equal(g.saveGame.snapshot.data.runOutcome.won, true);
  g.saveGame.saveAndQuit();
  const loaded = game(t, storage);
  loaded.g.saveGame.load();
  assert.equal(loaded.g.state.won, true);
  assert.equal(loaded.g.overtimeFrom, g.overtimeFrom);
  assert.equal(loaded.g.closing.done, g.closing.done);
});

test('paid parking validation survives a round-start save and loads without replaying its PA or charging again', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  g.health.invulnerable = true;
  g.map.areaUnlocks.openAll();
  for (const boss of ['janitor', 'guard', 'manager', 'influencer']) g.debug.run('closing', 'grant', boss);
  for (const line of ['janitor', 'guard', 'manager']) while (!g.closing.isDone(line)) g.events.emit(
    line === 'janitor' ? 'fountainKill' : line === 'manager' ? 'ritualCollect' : 'purchase', { kind: 'closing', id: 'nightSafe' });
  const { validation } = g.map.features.find(({ kind }) => kind === 'escapeVan');
  const price = g.pricing.priceOf('closing', 'validation');
  g.wallet.earn(price);
  run.standAt(validation.position.x - 1, validation.position.z, -90);
  assert.equal(g.interactions.prompt?.id, 'validation');
  const points = g.wallet.points;
  run.press('KeyF', Math.ceil(feel.interact.holdSeconds / dt) + 1);
  assert.equal(g.wallet.points, points - price);
  assert.equal(g.closing.validated, true);
  assert.equal(g.saveGame.snapshot.data.closing.validated, false, 'current-round payment is rolled back until the next round starts');
  g.rounds.jumpTo(18);
  run.tick();
  const saved = g.saveGame.snapshot.data;
  assert.equal(saved.closing.validated, true);
  assert.ok(g.saveGame.saveAndQuit());

  const loaded = game(t, storage);
  const repeated = [];
  loaded.g.events.on('closingValidated', (event) => repeated.push(event));
  assert.ok(loaded.g.saveGame.load());
  assert.equal(loaded.g.closing.validated, true);
  assert.equal(loaded.g.closing.readyToLeave, false, 'the Last Customer is still to come');
  assert.equal(loaded.g.wallet.points, saved.wallet.points);
  assert.deepEqual(loaded.g.saveGame.serializeNow(), saved);
  loaded.standAt(validation.position.x - 1, validation.position.z, -90);
  loaded.press('KeyF', Math.ceil(feel.interact.holdSeconds / dt) + 1);
  assert.equal(loaded.g.wallet.points, saved.wallet.points, 'a second hold cannot charge again');
  assert.deepEqual(repeated, []);
  assert.ok(!loaded.hud.calls.some(([name, notice]) => name === 'showAnnouncement' && notice.text === closingTime.pa.validated.text));
});

test('a save in the break before Closing Time keeps the booking and reloads exactly one Last Customer, including round 20', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  g.map.areaUnlocks.openAll();
  g.health.invulnerable = true;
  g.rounds.jumpTo(19);
  for (const boss of ['janitor', 'guard', 'manager', 'influencer']) g.debug.run('closing', 'grant', boss);
  for (const line of ['janitor', 'guard', 'manager']) while (!g.closing.isDone(line)) g.events.emit(
    line === 'janitor' ? 'fountainKill' : line === 'manager' ? 'ritualCollect' : 'purchase', { kind: 'closing', id: 'nightSafe' });
  const van = g.map.features.find(({ kind }) => kind === 'escapeVan');
  run.standAt(van.validation.position.x - 1, van.validation.position.z, -90);
  const staff = g.bosses.summon('guard');
  assert.ok(staff);
  staff.takeHit({ damage: staff.health, part: 'body', source: 'hazard' });
  assert.ok(g.bosses.serialize().met.includes('guard'), 'there is an encore candidate for round 20');
  g.wallet.earn(g.pricing.priceOf('closing', 'validation'));
  run.press('KeyF', Math.ceil(feel.interact.holdSeconds / dt) + 1);
  assert.equal(g.closing.closingRound, 20);
  for (const zombie of g.zombies.zombies) if (zombie.isAlive) zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' });
  while (g.rounds.remainingToSpawn > 0) {
    const zombie = g.rounds.spawnBackup('shopper');
    assert.ok(zombie);
    zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' });
  }
  run.tick();
  assert.equal(g.rounds.round, 20);
  assert.equal(g.rounds.state, 'break');
  assert.equal(new Map(g.saveGame.snapshot.data.bosses.schedule).get(20), 'lastCustomer');
  const saved = g.saveGame.snapshot.data;
  assert.ok(g.saveGame.saveAndQuit());

  const loaded = game(t, storage);
  const bosses = [], repeatedPa = [];
  loaded.g.events.on('bossSpawn', ({ zombie }) => bosses.push(zombie.type.id));
  loaded.g.events.on('closingValidated', (event) => repeatedPa.push(event));
  assert.ok(loaded.g.saveGame.load());
  assert.deepEqual(loaded.g.saveGame.serializeNow(), saved);
  assert.equal(loaded.g.closing.closingRound, 20);
  assert.equal(loaded.g.closing.lastCustomerDefeated, false);
  assert.deepEqual(loaded.hud.calls.filter(([name]) => name === 'showRoundBanner').at(-1), ['showRoundBanner', 20, closingTime.finale.banner]);
  loaded.g.health.invulnerable = true;
  loaded.g.rounds.endBreak(0);
  loaded.tick();
  // Restored shutters and navigation settle during the break. A safe spawn can legitimately fail in an early tick;
  // retry it as the real wave does, without spending quota. Defeat regular shoppers so the alive cap stays clear.
  for (let i = 0; i < 600 && !loaded.g.bosses.active; i++) {
    loaded.g.rounds.spawnBackup('shopper');
    for (const zombie of loaded.g.zombies.zombies) if (zombie.isAlive && !zombie.type.boss) {
      zombie.takeHit({ damage: zombie.health, part: 'body', source: 'hazard' });
    }
    loaded.tick();
  }
  assert.equal(loaded.g.bosses.active?.type.id, 'lastCustomer');
  loaded.tick(120);
  assert.deepEqual(bosses, ['lastCustomer']);
  assert.deepEqual(repeatedPa, []);
  assert.ok(!loaded.g.bosses.serialize().met.includes('lastCustomer'));
});

test('the gun the Returns Desk issues uses the normal gun save step, retaining the held gun and its ammunition', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  g.rounds.update = () => {};
  g.map.areaUnlocks.unlock('hallway');
  run.tick(120);
  g.returnQuest.debug('called'); // (the quest, up to "your number is called": tests/returnQuest.test.js)
  const desk = g.map.features.find(({ kind }) => kind === 'returnsDesk');
  run.standAt(desk.position.x + desk.normal.x * 1.2, desk.position.z + desk.normal.z * 1.2, Math.atan2(desk.normal.x, desk.normal.z) * 180 / Math.PI);
  run.press('KeyF', Math.ceil(0.5 / dt) + 2); // (the desk's own hold: config/returnQuest.js desk.holdSeconds)
  run.tick(60);
  assert.equal(g.gun.def.id, 'returnToSender');
  g.gun.weapon.magazine = 3; g.gun.weapon.reserve = 7;
  g.rounds.jumpTo(4); run.tick();
  const saved = g.saveGame.snapshot.data;
  assert.ok(g.saveGame.saveAndQuit());
  const loaded = game(t, storage);
  assert.ok(loaded.g.saveGame.load());
  assert.equal(loaded.g.gun.def.id, 'returnToSender');
  assert.deepEqual([loaded.g.gun.weapon.magazine, loaded.g.gun.weapon.reserve], [3, 7]);
  assert.deepEqual(loaded.g.saveGame.serializeNow(), saved);
});

test('Speechless is transient: loading the round-start save restores a fresh full-health booked boss without a hand prompt', (t) => {
  const run = game(t, memoryStorage());
  const { g } = run;
  run.tick();
  g.rounds.update = () => {};
  g.map.areaUnlocks.openAll();
  run.tick(120);
  g.rounds.jumpTo(20);
  assert.ok(g.bosses.book(20, 'lastCustomer'));
  run.tick();
  const boss = g.bosses.summon('lastCustomer');
  assert.ok(boss);
  boss.takeHit({ damage: Infinity, part: 'body', source: 'hazard' });
  run.tick();
  assert.equal(boss.state, 'speechless');
  assert.ok(g.saveGame.saveAndQuit());
  assert.ok(g.saveGame.load());
  run.tick(120);
  const restored = g.bosses.summon('lastCustomer');
  assert.ok(restored);
  assert.equal(restored.health, restored.maxHealth);
  assert.equal(restored.state, 'spawning');
  assert.notEqual(g.interactions.prompt?.id, 'handReturn');
});

test('incentive temporary stat buffs are stripped from round-start saves and lastWasJackpot survives Save & Quit', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  g.rounds.update = () => {};
  g.powerUps.debugDrop('commissionDay');
  run.tick();
  g.powerUps.debugDrop('blackFriday');
  run.tick();
  assert.equal(g.stats.pointsMultiplier, 2);
  assert.equal(g.stats.instantKill, true);

  // Also restore a state where the last drop was a jackpot and snap at round 4 start.
  const ps = g.powerUps.serialize();
  ps.lastWasJackpot = true;
  ps.lastType = 'blackFriday';
  g.powerUps.restore(ps);
  g.rounds.jumpTo(4);
  run.tick();
  assert.ok(g.saveGame.saveAndQuit());

  const loaded = game(t, storage);
  assert.equal(loaded.g.saveGame.load(), true);
  assert.equal(loaded.g.stats.pointsMultiplier, 1, 'Commission Day multiplier does not leak across Save & Quit');
  assert.equal(loaded.g.stats.instantKill, false, 'Black Friday instantKill does not leak across Save & Quit');
  assert.equal(loaded.g.stats.bossDamageMultiplier, 1);
  assert.equal(loaded.g.powerUps.effects.length, 0);
  assert.equal(loaded.g.powerUps.lastWasJackpot, true, 'jackpot no-repeat flag survives Save & Quit');

  // Legacy version 8 saves are cleanly ignored rather than loading removed incentive types.
  storage.setItem(saveConfig.storageKey, JSON.stringify({ version: 8, round: 4, savedAt: Date.now(), data: {} }));
  const legacy = game(t, storage);
  assert.equal(legacy.g.saveGame.peek(), null);
});

test('a pending Flash Sale teaser and an active Doorbuster save cleanly at roundStart and resume or reset', (t) => {
  // 1. Pending teaser saved & restored cleanly without prematurely applying discounts.
  const storage = memoryStorage();
  const run1 = game(t, storage);
  const g1 = run1.g;
  run1.tick();
  assert.equal(g1.flashSales.teaseNow('category'), true);
  const teased = g1.flashSales.pending;
  assert.ok(teased);
  g1.rounds.jumpTo(4);
  run1.tick();
  const snap1 = g1.saveGame.serializeNow();
  assert.equal(g1.saveGame.saveAndQuit(), true);

  const loaded1 = game(t, storage);
  assert.equal(loaded1.g.saveGame.load(), true);
  assert.deepEqual(loaded1.g.flashSales.pending?.id, teased.id);
  assert.equal(loaded1.g.flashSales.active, null);
  assert.deepEqual(loaded1.g.saveGame.serializeNow(), snap1);
  // Ticking remaining teaser seconds brings the sale live.
  loaded1.tick(Math.ceil((loaded1.g.flashSales.pending.remaining + 0.5) * 60));
  assert.ok(loaded1.g.flashSales.active, 'restored teaser goes live on schedule');

  // 2. Active Doorbuster item discount saves and restores, then expires cleanly.
  const storage2 = memoryStorage();
  const run2 = game(t, storage2);
  const g2 = run2.g;
  run2.tick();
  g2.map.areaUnlocks.unlock('hallway');
  g2.rounds.jumpTo(4);
  assert.equal(g2.flashSales.startNow('doorbuster'), true);
  const dbTarget = g2.flashSales.active.target;
  const dbPrice = g2.pricing.priceOf(dbTarget.category, dbTarget.id);
  assert.ok(dbPrice < g2.pricing.basePriceOf(dbTarget.category, dbTarget.id));
  g2.rounds.jumpTo(5);
  run2.tick();
  assert.equal(g2.saveGame.saveAndQuit(), true);

  const loaded2 = game(t, storage2);
  assert.equal(loaded2.g.saveGame.load(), true);
  assert.equal(loaded2.g.flashSales.active?.kind, 'doorbuster');
  assert.equal(loaded2.g.pricing.priceOf(dbTarget.category, dbTarget.id), dbPrice);
  loaded2.tick(Math.ceil((loaded2.g.flashSales.active.remaining + 1) * 60));
  assert.equal(loaded2.g.flashSales.active, null);
  assert.equal(loaded2.g.pricing.priceOf(dbTarget.category, dbTarget.id), loaded2.g.pricing.basePriceOf(dbTarget.category, dbTarget.id));
});

test('owned attachments and Box Cutter tier survive Save & Quit, refit free on another gun, and tint the viewmodel', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;
  g.map.areaUnlocks.unlock('hallway');
  g.map.areaUnlocks.unlock('foodCourt');
  run.tick(10);
  g.wallet.earn(10000);

  // Fit Jumbo Pack at its Food Court counter for 1,000 points.
  const jumboSpot = g.map.features.find((f) => f.kind === 'attachmentCounter' && f.attachment === 'jumboPack');
  const jumboPos = jumboSpot.position.clone().addScaledVector(jumboSpot.normal, 1.1);
  jumboPos.y = 0;
  g.player.teleport({ position: jumboPos, yaw: Math.atan2(jumboSpot.normal.x, jumboSpot.normal.z) });
  run.tick();
  assert.equal(g.interactions.prompt?.id, 'jumboPack');
  assert.equal(g.interactions.prompt?.verb, 'fit');
  assert.equal(g.interactions.prompt?.cost, 1000);
  run.press('KeyF', 30);
  assert.equal(ownsAttachment(g.gun, 'jumboPack'), true);

  // Buy Sharpened Blade (1,500) and Box Cutter Pro (4,000) at Customer Service.
  const desk = featuresOf(g.map, 'upgradeDesk')[0];
  run.standAt(desk.meleePosition.x, desk.meleePosition.z - 1.4, 180);
  assert.equal(g.interactions.prompt?.id, 'sharpened');
  assert.equal(g.interactions.prompt?.cost, 1500);
  run.press('KeyF', 30);
  assert.equal(g.interactions.prompt?.id, 'pro');
  assert.equal(g.interactions.prompt?.cost, 4000);
  run.press('KeyF', 30);
  assert.equal(g.wallet.points, 4000);

  g.rounds.jumpTo(3);
  run.tick();
  assert.equal(g.saveGame.saveAndQuit(), true);

  const meleeColors = [];
  const loaded = game(t, storage, {
    viewmodel: {
      fire: () => {},
      dryFire: () => {},
      jolt: () => {},
      reset: () => {},
      getMuzzleWorldPosition: (out) => out.set(0, 1.5, 0),
      setMeleeColors: (colors) => meleeColors.push(colors),
    },
  });
  assert.equal(loaded.g.saveGame.load(), true);
  const lg = loaded.g;
  assert.equal(lg.stats.meleeTier, 2);
  assert.equal(lg.stats.meleeUpgradeDamage, 5);
  assert.equal(lg.stats.meleeHalfAngleDegrees, 70);
  assert.equal(lg.stats.meleeMaxTargets, 2);
  assert.deepEqual(meleeColors, [{ blade: 0xffd9a0, handle: 0xd62839 }]);
  assert.equal(ownsAttachment(lg.gun, 'jumboPack'), true);
  assert.equal(lg.wallet.points, 4000);

  // A second compatible gun gets a free refit from the same counter after Continue.
  lg.gun.give(weapons.priceGun);
  loaded.tick(40);
  const spot2 = lg.map.features.find((f) => f.kind === 'attachmentCounter' && f.attachment === 'jumboPack');
  const pos2 = spot2.position.clone().addScaledVector(spot2.normal, 1.1);
  pos2.y = 0;
  lg.player.teleport({ position: pos2, yaw: Math.atan2(spot2.normal.x, spot2.normal.z) });
  loaded.tick();
  assert.equal(lg.interactions.prompt?.id, 'jumboPack');
  assert.equal(lg.interactions.prompt?.verb, 'refit');
  assert.equal(lg.interactions.prompt?.cost, 0);
  assert.match(lg.interactions.prompt?.detail, /Owned this run · Free refit/);
  loaded.press('KeyF', 30);
  assert.equal(lg.wallet.points, 4000);
  assert.equal(attachmentsOf(lg.gun.modsFor('priceGun')).magazine, 'jumboPack');
});

test('a warranty on file and a used Platinum claim survive Save & Quit', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;

  // Replace a Premium Nail Gun so Premium goes on file, and put Platinum on Staple Gun.
  g.gun.give(weapons.nailGun);
  run.tick(50);
  g.gun.setMods('nailGun', withTier(weapons.nailGun, g.gun.modsFor('nailGun'), 'premium'));
  run.tick(2);
  g.gun.give(weapons.priceGun);
  run.tick(50);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'priceGun'], 'the Price Gun replaced the Nail Gun in hand');
  assert.equal(g.features.context.warranty.onFile, 'premium');
  g.gun.setMods('stapleGun', withTier(weapons.stapleGun, g.gun.modsFor('stapleGun'), 'platinum'));
  run.tick(2);

  // Consume Round 3's Platinum claim on the same tick that takes the Round 3 snapshot.
  let preClaims = 0;
  g.events.on('warrantyClaim', () => { preClaims += 1; });
  g.rounds.jumpTo(3);
  const dry = g.gun.weaponFor('stapleGun');
  dry.magazine = 0;
  dry.reserve = 0;
  run.tick();
  assert.equal(preClaims, 1);
  assert.equal(dry.magazine, 14);
  assert.equal(dry.reserve, 60);
  assert.equal(g.saveGame.saveAndQuit(), true);

  const loaded = game(t, storage);
  let postClaims = 0;
  loaded.g.events.on('warrantyClaim', () => { postClaims += 1; });
  assert.equal(loaded.g.saveGame.load(), true);
  const lw = loaded.g.features.context.warranty;
  assert.equal(lw.onFile, 'premium');
  assert.deepEqual(lw.offer('priceGun'), { kind: 'transfer', tier: 'premium', pricingId: 'transfer:premium' });

  // Running dry again in Round 3 cannot reclaim; Round 4 allows a fresh claim.
  const lDry = loaded.g.gun.weaponFor('stapleGun');
  lDry.magazine = 0;
  lDry.reserve = 0;
  loaded.tick(2);
  assert.equal(postClaims, 0);
  assert.equal(lDry.magazine, 0);
  assert.equal(lDry.reserve, 0);
  assert.equal(lw.onFile, 'premium');

  loaded.g.rounds.jumpTo(4);
  loaded.tick(2);
  assert.equal(postClaims, 1);
  assert.equal(lDry.magazine, 14);
  assert.equal(lDry.reserve, 60);
});

test('canSave pins reason strings, discard clears the slot, and a storage write failure emits no runSaved', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  let savedEvents = 0;
  g.events.on('runSaved', () => { savedEvents += 1; });

  assert.deepEqual(g.saveGame.canSave(), { ok: false, reason: 'Not clocked in yet' });
  run.tick();
  assert.deepEqual(g.saveGame.canSave(), { ok: true, reason: null });

  assert.equal(g.saveGame.saveAndQuit(), true);
  assert.equal(savedEvents, 1);
  assert.equal(storage.items.has('sunsetGalleria.save'), true);
  g.saveGame.discard();
  assert.equal(storage.items.has('sunsetGalleria.save'), false);
  assert.equal(g.saveGame.peek(), null);
  assert.equal(g.saveGame.load(), false);

  g.state.winPending = true;
  assert.deepEqual(g.saveGame.canSave(), { ok: false, reason: 'Shift complete' });
  assert.equal(g.saveGame.saveAndQuit(), false);
  assert.equal(savedEvents, 1);
  g.state.winPending = false;

  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(g.saveGame.saveAndQuit(), false);
  assert.equal(savedEvents, 1);

  g.stats.health = g.stats.maxHealth - 1;
  assert.deepEqual(g.saveGame.canSave(), { ok: false, reason: 'Full health needed' });
  g.health.takeDamage(1000);
  assert.deepEqual(g.saveGame.canSave(), { ok: false, reason: 'No longer employed' });
});

test('a save whose restore throws drops the slot, returns false, and leaves a fresh run', (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  run.tick();
  run.g.rounds.jumpTo(3);
  run.tick();
  assert.equal(run.g.saveGame.saveAndQuit(), true);

  // Corrupt the 'gun' payload so restore throws AFTER 'stats' and 'equipment' have mutated state.
  const raw = JSON.parse(storage.getItem('sunsetGalleria.save'));
  raw.data.stats.maxHealth = 150;
  raw.data.equipment.pockets.lethal = { id: 'sodaBomb', count: 2 };
  raw.data.gun.attachments = null;
  storage.setItem('sunsetGalleria.save', JSON.stringify(raw));

  const loaded = game(t, storage);
  let loadedEvents = 0;
  loaded.g.events.on('runLoaded', () => { loadedEvents += 1; });
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(loaded.g.saveGame.load(), false);
  } finally {
    console.warn = warn;
  }
  assert.equal(loadedEvents, 0);
  assert.equal(loaded.g.saveGame.dropped, true);
  assert.equal(storage.items.has('sunsetGalleria.save'), false);
  assert.equal(loaded.g.saveGame.peek(), null);
  assert.equal(loaded.g.rounds.started, false);
  assert.equal(loaded.g.rounds.round, 0);
  assert.equal(loaded.g.stats.maxHealth, 100);
  assert.deepEqual(loaded.g.equipment.pockets.lethal, { id: null, count: 0 });
});
