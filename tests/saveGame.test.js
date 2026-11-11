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
