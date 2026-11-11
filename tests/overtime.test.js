// Closing Time phase 10, HARDER OVERTIME (config/closingTime.js `overtime`, game/closingTime.js, zombies/zombieManager.js):
// every zombie and boss spawned in overtime has extra health compounding per overtime round, and kills pay more through the
// stats object's killPayMultiplier. Nothing changes before the win or after a Clock out. (Its own file, so it grows apart
// from tests/closingTime.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame, snapshot } from './helpers/headlessGame.js';
import { closingTime } from '../src/config/closingTime.js';
import { bossTypes } from '../src/config/bosses.js';
import { zombieHealthFor } from '../src/config/economy.js';
import { pointsForHit } from '../src/game/wallet.js';

const { healthPerRound, killPay } = closingTime.overtime;
const bossIds = Object.keys(closingTime.lines);
const WIN_ROUND = 15; // a late win, so the numbers are the ones a real overtime would see

function memoryStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
  };
}

// The map is built first, THEN Math.random is seeded (CLAUDE.md).
function fixture(t, options = {}, seed = true) {
  const game = headlessGame(options);
  if (seed) t.mock.method(Math, 'random', () => 0.12);
  t.after(() => { game.g.resetRun(); game.g.map.dispose(); });
  game.tick();
  return game;
}

// Stand in for completed duties, paid validation and the returned boss, as the receipt fixtures in closingTime.test.js do.
// Those tests cover the real machine and encounter; these isolate overtime's health, pay and saved state.
function win(g, round = WIN_ROUND) {
  g.rounds.jumpTo(round);
  for (const id of bossIds) assert.match(g.debug.run('closing', 'grant', id), /Granted/);
  g.events.emit('fountainKill', {}); // (one of each duty's events at a time would be slow: finish the counts directly)
  for (let i = 1; i < closingTime.lines.janitor.needed; i++) g.events.emit('fountainKill', {});
  for (let i = 0; i < closingTime.lines.guard.needed; i++) g.events.emit('purchase', { label: 'Night Safe', cost: 0, kind: 'closing', id: 'nightSafe' });
  g.events.emit('ritualCollect', {});
  assert.ok(g.closing.readyToValidate);
  g.events.emit('purchase', { kind: 'closing', id: 'validation', cost: 0 });
  g.events.emit('bossDefeated', { zombie: { type: bossTypes.lastCustomer, position: g.player.position }, round });
  assert.ok(g.closing.readyToLeave);
  g.state.assisted = false;
  g.events.emit('escapeVanStart');
  assert.equal(g.state.won, true);
  assert.equal(g.state.winPending, true, 'the receipt is up: Clock out or Stay for overtime');
}

// The live wave is discarded, so the first overtime round is round + 1.
function winAndStay(g, round = WIN_ROUND) {
  win(g, round);
  assert.ok(g.stayForOvertime());
}

// The health a zombie of `typeId` spawned now would have, read off a real spawn.
function spawnedHealth(g, typeId = 'shopper') {
  const zombie = g.zombies.spawn(typeId);
  assert.ok(zombie, typeId + ' spawned');
  const { health } = zombie;
  g.zombies.clear(); // (no reuse cooldown or alive cap to get in the way of the next probe)
  return health;
}

test('before the win and in a normal run, every spawn has the round\'s normal health and kill pay is untouched', (t) => {
  const { g, tick } = fixture(t);
  g.rounds.jumpTo(WIN_ROUND);
  tick();
  assert.equal(g.closing.healthMultiplier, 1);
  assert.equal(g.stats.killPayMultiplier, 1);
  for (const id of ['shopper', 'mallWalker', 'cartPusher']) {
    assert.equal(spawnedHealth(g, id), zombieHealthFor(id, WIN_ROUND), id);
  }
  // The receipt's pending choice is not overtime either.
  win(g);
  assert.equal(g.stats.killPayMultiplier, 1);
  assert.equal(g.closing.healthMultiplier, 1);
  assert.equal(g.overtimeFrom, null);
});

test('overtime rounds 1, 5 and 10 have the normal health x healthPerRound^n, for zombies and bosses', (t) => {
  const control = fixture(t, {}, false); // (a second game in this test: both are built before Math.random is seeded)
  const game = fixture(t);
  const { g, tick } = game;
  winAndStay(g);
  const first = g.overtimeFrom;
  assert.equal(first, WIN_ROUND + 1);
  assert.equal(g.closing.healthMultiplier, healthPerRound, 'the first overtime round is already tougher');

  const report = [];
  for (const n of [1, 5, 10]) {
    const round = first + n - 1;
    g.rounds.jumpTo(round);
    tick();
    control.g.rounds.jumpTo(round);
    control.tick();
    assert.equal(g.rounds.round, round);
    const expected = Math.pow(healthPerRound, n);
    assert.ok(Math.abs(g.closing.healthMultiplier - expected) < 1e-12, 'overtime round ' + n);

    for (const id of ['shopper', 'mallWalker', 'cartPusher']) {
      const normal = zombieHealthFor(id, round);
      assert.equal(spawnedHealth(control.g, id), normal, id + ': the control run (no overtime) is the normal health');
      assert.equal(spawnedHealth(g, id), Math.round(normal * expected), `${id} at overtime round ${n} (round ${round})`);
    }
    // A boss gets it too.
    const boss = g.bosses.summon('janitor');
    assert.ok(boss);
    assert.equal(boss.health, Math.round(zombieHealthFor('janitor', round) * expected), 'boss at overtime round ' + n);
    g.zombies.clear();
    report.push({ n, round, normal: zombieHealthFor('shopper', round), overtime: spawnedHealth(g) });
    // (clear the arena so the alive cap never gets in the way)
    g.rounds.skipRound();
  }
  assert.equal(report.length, 3);
});

test('counts, spawn pace and the alive cap do not change in overtime', (t) => {
  const control = fixture(t, {}, false);
  const { g, tick } = fixture(t);
  const round = WIN_ROUND + 4;
  winAndStay(g);
  g.rounds.jumpTo(round);
  control.g.rounds.jumpTo(round);
  tick();
  control.tick();
  assert.equal(g.rounds.remainingToSpawn, control.g.rounds.remainingToSpawn);
  assert.equal(g.rounds.maxAlive, control.g.rounds.maxAlive);
});

test('overtime pay is applied once, stacks with the Gold Card and pays on a real kill', (t) => {
  const { g, tick } = fixture(t);
  g.wardrobe.buy('goldCard');
  const card = g.stats.killPayMultiplier;
  assert.ok(card > 1, 'the Gold Card raises kill pay');
  g.rounds.jumpTo(WIN_ROUND);
  tick();
  const kill = (typeId) => {
    const before = g.wallet.points;
    const zombie = g.zombies.spawn(typeId);
    zombie.takeHit({ damage: zombie.health, part: 'body', source: 'gun' });
    return g.wallet.points - before;
  };
  const paid = (typeId, multiplier) => pointsForHit({ target: { type: { id: typeId } }, killed: true, killPayMultiplier: multiplier });
  assert.equal(kill('mascot'), paid('mascot', card), 'before the win: the Gold Card alone');

  winAndStay(g);
  assert.ok(Math.abs(g.stats.killPayMultiplier - card * killPay) < 1e-12, 'the Gold Card and overtime multiply');
  g.rounds.jumpTo(g.overtimeFrom);
  tick();
  assert.equal(kill('mascot'), paid('mascot', card * killPay), 'a real kill in overtime pays the stacked amount');
  assert.ok(paid('mascot', card * killPay) > paid('mascot', card));

  // Never again: not per round, not on a pause or a new round.
  g.rounds.skipRound();
  tick(10);
  assert.ok(Math.abs(g.stats.killPayMultiplier - card * killPay) < 1e-12);
});

test('a Clock out leaves the run frozen: no overtime pay and no overtime health', (t) => {
  const { g } = fixture(t);
  win(g);
  assert.ok(g.clockOut());
  assert.equal(g.stats.killPayMultiplier, 1);
  assert.equal(g.closing.healthMultiplier, 1);
  assert.equal(g.overtimeFrom, null);
});

test('a save in overtime round 3 loads with the right health and pay, not doubled', (t) => {
  const storage = memoryStorage();
  const { g, tick } = fixture(t, { saveStorage: storage });
  g.wardrobe.buy('goldCard');
  const card = g.stats.killPayMultiplier;
  winAndStay(g);
  const round = g.overtimeFrom + 2; // overtime round 3
  g.rounds.jumpTo(round);
  tick();
  assert.equal(g.saveGame.saveAndQuit(), true);
  const savedPay = g.stats.killPayMultiplier;
  assert.ok(Math.abs(savedPay - card * killPay) < 1e-12);

  const loaded = headlessGame({ saveStorage: storage });
  t.after(() => { loaded.g.resetRun(); loaded.g.map.dispose(); });
  assert.equal(loaded.g.saveGame.load(), true);
  const l = loaded.g;
  assert.equal(l.rounds.round, round);
  assert.equal(l.overtimeFrom, g.overtimeFrom);
  assert.equal(l.state.won, true);
  assert.ok(Math.abs(l.closing.healthMultiplier - Math.pow(healthPerRound, 3)) < 1e-12, 'overtime round 3');
  assert.ok(Math.abs(l.stats.killPayMultiplier - savedPay) < 1e-12, 'pay is as saved: not multiplied a second time');
  loaded.tick(5);
  assert.ok(Math.abs(l.stats.killPayMultiplier - savedPay) < 1e-12, 'nor by the runLoaded or the ticks after it');
  assert.equal(spawnedHealth(l, 'shopper'), Math.round(zombieHealthFor('shopper', round) * Math.pow(healthPerRound, 3)));
});

test('Play again after overtime puts health and pay back to normal', (t) => {
  const { g, tick } = fixture(t);
  const fresh = snapshot(g);
  winAndStay(g);
  g.rounds.jumpTo(g.overtimeFrom + 4);
  tick();
  assert.ok(g.stats.killPayMultiplier > 1);
  assert.ok(g.closing.healthMultiplier > 1);
  g.resetRun();
  tick();
  assert.equal(g.stats.killPayMultiplier, 1);
  assert.equal(g.closing.healthMultiplier, 1);
  assert.equal(g.overtimeFrom, null);
  g.rounds.jumpTo(WIN_ROUND);
  tick();
  assert.equal(spawnedHealth(g), zombieHealthFor('shopper', WIN_ROUND));
  assert.equal(fresh.won, false);
});
