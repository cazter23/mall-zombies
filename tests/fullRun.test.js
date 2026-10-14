// Whole runs of the REAL game in Node (game/createGame.js via tests/helpers/headlessGame.js): systems
// working together, the way a player uses them. This is the safety net for changes that cut across
// several systems (buying, rounds, shooting, points, dying, Play again).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot } from './helpers/headlessGame.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';

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
  assert.equal(g.wallet.points, economy.startingPoints - economy.doors.startShutter);
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

test('dying: the world keeps going, the results screen comes up after the delay', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(10);
  g.health.takeDamage(10_000);
  t.tick(1);
  assert.equal(g.state.over, true);
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
  // What perks / wardrobe / a skill tree will do: change the player's stats mid-run.
  g.stats.walkSpeed *= 1.25;
  g.stats.damageMultiplier = 2;
  g.stats.maxHealth += 50;
  g.pricing.setDiscount('weapon', 0.5); // a Flash Sale running when you die
  t.tick(60 * 8);
  g.rounds.skipRound();
  t.tick(60 * 4);
  g.health.takeDamage(10_000);
  t.tick(60 * 5);
  assert.equal(g.state.over, true);
  assert.notDeepEqual(snapshot(g), fresh, 'the run changed things');

  g.resetRun();
  assert.deepEqual(snapshot(g), fresh);
});
