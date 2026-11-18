// Whole runs of the REAL game in Node (game/createGame.js via tests/helpers/headlessGame.js): systems
// working together, the way a player uses them. This is the safety net for changes that cut across
// several systems (buying, rounds, shooting, points, dying, Play again).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot } from './helpers/headlessGame.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { toggleDoors } from '../src/world/door.js';
import { tierOf } from '../src/weapons/upgrades.js';

const FACE_NEG_Z = 0; // yaw 0 looks down -Z

// Stand a zombie still, straight in front of the player, `meters` away (no rising, no walking).
function zombieInFront(t, meters, health) {
  const z = t.g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 0));
  const p = t.g.player.position;
  z.position.set(p.x, 0, p.z - meters);
  z.state = 'chasing';
  z.speed = 0;
  z.health = health;
  z.updateHitboxes();
  return z;
}

test('a fresh game: 500 points, the staple gun, every door shut, nothing started', () => {
  const { g } = headlessGame();
  assert.equal(g.wallet.points, economy.startingPoints);
  assert.deepEqual(g.gun.slots, ['stapleGun']);
  assert.equal(g.rounds.started, false);
  assert.ok(g.map.doors.every((d) => !d.isOpen));
  assert.deepEqual(Object.entries(g.map.zones).filter(([, z]) => z.open).map(([id]) => id), ['startRoom']);
  assert.equal(g.state.over, false);
});

test('a real run: buy the shutter, round 1 starts, zombies come, shooting one pays the COD payouts', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  assert.equal(g.rounds.started, true, 'round 1 starts on the first live tick');
  // Hold F at the start shutter (500 points = everything we start with).
  t.standAt(0, 8.5, FACE_NEG_Z);
  t.press('KeyF', 30);
  t.tick(60 * 2);
  assert.equal(g.map.doors.find((d) => d.id === 'startShutter').isOpen, true);
  assert.equal(g.map.zones.hallway.open, true);
  assert.equal(g.wallet.points, economy.startingPoints - economy.doors.hallway);
  // Zombies arrive after the round's start delay.
  t.tick(60 * 6);
  assert.ok(g.zombies.aliveCount > 0, 'round 1 zombies spawned');

  // Shoot a 150 HP zombie standing 3 m ahead: 5 staple body hits (30 each) kill it.
  g.zombies.clear();
  t.standAt(0, 12, FACE_NEG_Z, Math.atan2(1.0 - 1.6, 3));
  const z = zombieInFront(t, 3, 150);
  for (let i = 0; i < 5; i++) {
    t.press('Mouse0', 1);
    t.tick(12);
  }
  assert.equal(z.isAlive, false, 'dead after five hits');
  const hits = 4 * economy.payouts.nonLethalHit + economy.killValues.shopper;
  assert.equal(g.wallet.points, hits, '4 non-lethal hits + the kill value');
  assert.equal(g.runStats.kills, 1);
  assert.equal(g.runStats.shotsFired, 5);
  assert.ok(t.hud.calls.some(([name]) => name === 'showHitMarker'));
});

test('dying: the world keeps going (zombies still walk to you), the results screen comes up after the delay', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.zombies.clear();
  const z = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 9)); // in the start room, 3 m away
  t.tick(60 * 2); // risen and walking
  g.health.takeDamage(10_000);
  t.tick(1);
  assert.equal(g.state.over, true);
  const at = z.position.clone();
  t.tick(30);
  assert.ok(z.position.distanceTo(at) > 0.05, 'the zombie kept moving after the death');
  assert.ok(t.hud.calls.some(([name, on]) => name === 'setDead' && on === true));
  t.tick(60 * 5);
  assert.equal(g.death.resultsShown, true);
  const results = t.hud.calls.find(([name]) => name === 'showResults')[1];
  assert.equal(results.round, g.rounds.round);
});

test('Play again puts EVERYTHING back: the game equals a freshly built one', () => {
  const fresh = snapshot(headlessGame().g);
  const t = headlessGame();
  const { g } = t;
  // A messy run: doors, guns, upgrades, points, kills, damage, rounds, then death.
  g.wallet.earn(10_000);
  t.tick(60);
  for (const d of g.map.doors) d.open();
  t.tick(120);
  g.gun.give(weapons.priceGun);
  g.gun.setMods('priceGun', [{ id: 'test', modifiers: [{ stat: 'damage', op: 'add', value: 5 }] }]);
  // What the wardrobe and power-ups do: change the player's stats mid-run.
  g.stats.walkSpeed *= 1.25;
  g.stats.damageMultiplier = 2;
  g.stats.maxHealth += 50;
  g.pricing.setDiscount('weapon', 0.5); // a Flash Sale running when you die
  g.stats.perkCharges = 4; // a perk's own counter: not a declared stat, must not survive a new run
  g.runStats.headshotKills += 2; g.runStats.meleeKills += 1; g.runStats.shotsHit += 5; // (every run stat matters)
  g.zombies.clear();
  t.tick(60 * 4);
  g.rounds.skipRound();
  g.zombies.clear();
  t.tick(60 * 2);
  // Kiosk Kevin's equipment: full pockets, one Soda Bomb thrown and still on its fuse when you die.
  g.debug.run('pockets');
  t.press('KeyG', 1);
  assert.equal(g.equipment.live.length, 1);
  g.health.takeDamage(10_000);
  t.tick(60 * 5);
  assert.equal(g.state.over, true);
  assert.notDeepEqual(snapshot(g), fresh, 'the run changed things');

  g.resetRun();
  assert.deepEqual(snapshot(g), fresh);
});

test('a natural round: round 1 spawns its zombies, killing them all moves the game to round 2 and pays for each', () => {
  const t = headlessGame();
  const { g } = t;
  const rounds = [];
  g.events.on('roundStart', ({ round }) => rounds.push(round));
  g.state.forceRun = true;
  // Kill every zombie as soon as it has risen (a perfect player), until the round flips.
  for (let i = 0; i < 60 * 120 && g.rounds.round < 2; i++) {
    t.tick(1);
    for (const z of g.zombies.zombies) if (z.isAlive && z.state === 'chasing') z.takeHit({ damage: 9999, part: 'body' });
  }
  assert.deepEqual(rounds, [1, 2], 'round 1, then round 2');
  const count = economy.waves.count.base; // round(6 + 2.5 * 0)
  assert.equal(g.runStats.kills, count, 'every zombie of round 1');
  assert.equal(g.wallet.points, economy.startingPoints + count * economy.killValues.shopper);
});

test('a real run buys Mega Mart through Food Court: both entrances open for one area purchase', (testContext) => {
  const t = headlessGame();
  const { g } = t;
  g.wallet.earn(3000); // Fund the route; purchases still use the real hold, pricing and wallet.
  const purchases = [];
  g.events.on('purchase', (event) => purchases.push(event));
  t.standAt(0, 8.5);
  t.press('KeyF', 30);
  t.tick(90);
  t.standAt(0, -0.4);
  t.press('KeyF', 30);
  t.tick(90);
  assert.equal(g.map.zones.megaMart.open, false);
  t.standAt(18.4, -8.3, -90);
  t.press('KeyF', 30);
  t.tick(90);
  assert.equal(g.map.zones.megaMart.open, true);
  assert.equal(g.map.doors.find((d) => d.id === 'megaMart').isOpen, true);
  assert.deepEqual(purchases.map(({ id, cost }) => [id, cost]), [
    ['startShutter', 500], ['foodCourt', 1000], ['foodCourtMegaMart', 750],
  ]);
  let seed = 12345;
  testContext.mock.method(Math, 'random', () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32));
  const martMarkers = g.map.spawnPoints.filter((s) => s.zone === 'megaMart');
  let spawnedInMart = false;
  // Real rounds select real markers. Kill risen zombies to keep the run moving; no explicit-position spawn.
  for (let tick = 0; tick < 60 * 120 && !spawnedInMart; tick++) {
    t.tick();
    for (const z of g.zombies.zombies) {
      if (z.state === 'spawning' && martMarkers.some((s) => s.position.equals(z.position))) spawnedInMart = true;
      if (z.isAlive && z.state === 'chasing') z.takeHit({ damage: 99999, part: 'body' });
    }
  }
  assert.equal(spawnedInMart, true, 'the newly opened zone participates in natural wave spawns');
  assert.equal(g.state.over, false);
  g.resetRun();
  assert.ok(g.map.doors.every((d) => !d.isOpen));
  assert.deepEqual(Object.keys(g.map.zones).filter((id) => g.map.zones[id].open), ['startRoom']);
});

test('a real run buys the shutter, repairs the escalator and opens the cinema, then receives natural cinema wave spawns', context => {
  const t = headlessGame(), { g } = t; g.wallet.earn(5000); g.health.invulnerable = true;
  const purchases = []; g.events.on('purchase', e => purchases.push([e.id, e.cost]));
  let seed = 1986; context.mock.method(Math, 'random', () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32));
  t.standAt(0, 8.5); t.press('KeyF', 30); t.tick(90);
  const repair = g.map.levelTwo.repair;
  t.standAt(repair.position.x + 1.5, repair.position.z, 90);
  assert.equal(g.interactions.prompt?.id, 'escalatorRepair'); t.press('KeyF', 30); t.tick(90);
  assert.equal(g.map.zones.upstairs.open, true); assert.equal(g.map.zones.cinema.open, false);
  g.player.teleport({ position: new THREE.Vector3(-18.6, g.map.cinema.floorY, -2.9), yaw: Math.PI / 2 }); t.tick();
  assert.equal(g.interactions.prompt?.id, 'cinema'); t.press('KeyF', 30); t.tick(90);
  assert.deepEqual(purchases, [['startShutter', 500], ['escalatorRepair', 1250], ['cinema', 1250]]);
  assert.equal(g.map.zones.cinema.open, true); g.rounds.jumpTo(6);
  const markers = g.map.spawnPoints.filter(s => s.zone === 'cinema');
  g.player.teleport({ position: new THREE.Vector3(-33, g.map.cinema.floorY, 24), yaw: 0 });
  let spawned = false;
  for (let i = 0; i < 60 * 30 && !spawned; i++) {
    t.tick();
    spawned = g.zombies.zombies.some(z => z.state === 'spawning' && markers.some(s => s.position.equals(z.position)));
    for (const z of g.zombies.zombies) if (z.isAlive && z.state === 'chasing') z.takeHit({ damage: 99999, part: 'body' });
  }
  assert.ok(spawned, 'real rounds select an unlocked cinema marker, with no explicit-position spawn');
  g.resetRun(); assert.ok(g.map.doors.every(d => !d.isOpen)); assert.equal(g.map.zones.cinema.open, false);
  assert.equal(g.map.cinema.presentation.screen.userData.slideIndex, 0); g.map.dispose();
});

test('the service stairs supply an alternate cinema entrance and the inside cinema purchase unlocks Promenade spawns', context => {
  const t = headlessGame(), { g } = t; g.wallet.earn(8000); g.health.invulnerable = true;
  let seed = 1945; context.mock.method(Math, 'random', () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32));
  const paid = []; g.events.on('purchase', e => paid.push([e.id, e.cost]));
  t.standAt(0, 8.5); t.press('KeyF', 30); t.tick(100);
  t.standAt(-18.6, 2, 90); t.press('KeyF', 30); t.tick(100);
  t.standAt(-21.8, 2, 180); assert.equal(g.interactions.prompt?.id, 'cinemaStairs'); t.press('KeyF', 30); t.tick(100);
  assert.equal(g.map.zones.cinema.open, true); assert.equal(g.map.zones.upstairs.open, false);
  assert.equal(g.map.doors.find(d => d.id === 'escalatorRepair').isOpen, false);
  const naturalSpawn = (zone, at) => {
    g.rounds.jumpTo(6); g.player.teleport({ position: new THREE.Vector3(...at), yaw: 0 });
    const markers = g.map.spawnPoints.filter(s => s.zone === zone); let found = false;
    for (let i = 0; i < 60 * 30 && !found; i++) {
      t.tick(); found = g.zombies.zombies.some(z => z.state === 'spawning' && markers.some(s => s.position.equals(z.position)));
      for (const z of g.zombies.zombies) if (z.isAlive && z.state === 'chasing') z.takeHit({ damage: 99999, part: 'body' });
    }
    assert.ok(found, `${zone} participates in real waves`);
  };
  naturalSpawn('cinema', [-33, 6.3, 24]);
  g.player.teleport({ position: new THREE.Vector3(-21.7, 6.3, -2.9), yaw: -Math.PI / 2 }); t.tick();
  assert.equal(g.interactions.prompt?.id, 'cinema'); t.press('KeyF', 30); t.tick(100);
  assert.equal(g.map.zones.upstairs.open, true); naturalSpawn('upstairs', [16, 6.3, 1]);
  assert.deepEqual(paid, [['startShutter', 500], ['serviceCorridor', 1000], ['cinemaStairs', 1250], ['cinema', 1250]]);
  g.resetRun(); assert.deepEqual(Object.keys(g.map.zones).filter(k => g.map.zones[k].open), ['startRoom']); g.map.dispose();
});

test('round 7 after buying the shutter: debug open-all preserves Nail Gun and Customer Service purchases', () => {
  const t = headlessGame();
  const { g } = t;
  g.wallet.earn(10_000);
  t.standAt(0, 8.5);
  t.press('KeyF', 30);
  assert.equal(g.map.doors.find((d) => d.id === 'startShutter').isOpen, true);
  assert.ok(g.map.doors.some((d) => !d.isOpen), 'partly bought map before the O action');
  for (let i = 0; i < 6; i++) g.rounds.skipRound(); // same action as N
  assert.equal(g.rounds.round, 7);
  toggleDoors(g.map.doors); // same group operation the browser's O key uses
  t.tick(90);
  assert.equal(g.map.zones.hallway.open, true);

  t.standAt(11, -0.6);
  assert.equal(g.interactions.prompt.label, 'Nail Gun');
  let before = g.wallet.points;
  t.press('KeyF', 30);
  assert.equal(before - g.wallet.points, g.pricing.priceOf('weapon', 'nailGun'));
  assert.equal(g.gun.owns('nailGun'), true);
  t.tick(40);
  const desk = g.map.features.find((f) => f.kind === 'upgradeDesk');
  t.standAt(desk.position.x, desk.position.z - 1.4, 180);
  assert.equal(g.interactions.prompt.label, 'Nail Gun → Deluxe');
  before = g.wallet.points;
  t.press('KeyF', 30);
  assert.equal(before - g.wallet.points, g.pricing.priceOf('tier', 'deluxe'));
  assert.equal(tierOf(g.gun.modsFor('nailGun')), 'deluxe');
  assert.equal(g.state.over, false);

  g.resetRun();
  assert.ok(g.map.doors.every((d) => !d.isOpen));
  assert.equal(g.map.zones.hallway.open, false);
});

test('round-2 combat earns a real incentive, collects it without F, and Play again removes all incentive state', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.skipRound();
  g.rounds.update = () => {}; // controlled combat, using the real payout and drop listeners
  g.zombies.clear();
  const drops = [];
  g.events.on('powerUpDrop', (drop) => drops.push(drop));
  t.standAt(0, 12);
  const spot = new THREE.Vector3(0, 0, 9);
  for (let i = 0; i < 20 && !g.powerUps.pickup; i++) {
    const z = g.zombies.spawn('shopper', spot);
    z.setState('chasing');
    z.takeHit({ damage: 10000, part: 'head' });
    t.tick();
  }
  assert.equal(drops.length, 1, 'actual combat earned one drop with production tuning');
  assert.ok(g.runStats.kills >= 8 && g.runStats.kills <= 16);
  assert.equal(g.state.assisted, false, 'ordinary earned reward is eligible for career stats');
  const pickup = g.powerUps.pickup;
  assert.equal(pickup.position.y, 0);
  g.player.teleport({ position: pickup.position.clone(), yaw: 0 });
  t.tick();
  assert.equal(g.powerUps.pickup, null, 'walk-through collection needs no interact input');
  assert.notEqual(pickup.id, 'stockroomDelivery', 'full inventory earns a useful reward');
  assert.ok(g.powerUps.effects.some(effect => effect.id === pickup.id), 'collected reward activates its temporary benefit');
  g.resetRun();
  assert.equal(g.powerUps.pickup, null);
  assert.equal(g.powerUps.progress, 0);
  assert.equal(g.powerUps.dropsThisRound, 0);
  assert.deepEqual(g.powerUps.effects, [], 'all temporary benefits removed on restart');
});

test('resetPlayerStats: every stat back to base, undeclared extras removed, same object', async () => {
  const { createPlayerStats, resetPlayerStats } = await import('../src/player/stats.js');
  const stats = createPlayerStats();
  const same = stats;
  stats.damageMultiplier = 3;
  stats.perkCharges = 4;
  resetPlayerStats(stats);
  assert.equal(stats, same);
  assert.deepEqual(stats, createPlayerStats());
  assert.equal('perkCharges' in stats, false);
});
