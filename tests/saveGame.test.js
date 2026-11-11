// Save & Quit (game/saveGame.js): one slot, the run as it stood at the START of the current round, used up when loaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { TIER_IDS, withTier } from '../src/weapons/upgrades.js';
import { save as saveConfig } from '../src/config/save.js';
import { createCareerStats } from '../src/game/careerStats.js';

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
function game(t, storage) {
  const run = headlessGame({ saveStorage: storage });
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

test("Kiosk Kevin reopens where he stood at the round's start: not the first site, and not where a mid-round move took him", (t) => {
  const storage = memoryStorage();
  const run = game(t, storage);
  const { g } = run;
  run.tick();
  for (const id of ['hallway', 'foodCourt', 'upstairs']) g.map.areaUnlocks.unlock(id);
  g.rounds.jumpTo(4); // (one 'roundStart' after the opening round: he moves off the Hallway)
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
