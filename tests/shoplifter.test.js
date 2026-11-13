// The Shoplifter (config/zombies.js shoplifter, game/shoplifting.js): a hit steals points, it runs away through the mall, and you get them
// back by killing it before it gets away. It took the Mall Walker's place in the waves (13 November 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { zombieTypes } from '../src/config/zombies.js';
import { economy } from '../src/config/economy.js';
import { theftAmount } from '../src/game/shoplifting.js';

const shoplifter = zombieTypes.shoplifter;
const { theft } = shoplifter;

// The real game in the Hallway at round 6, the player standing still with `points`, one Shoplifter right in front of them.
function scene(points = 2000) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.rounds.jumpTo(6);
  g.debug.run('doors');
  t.tick(5);
  g.player.teleport({ position: new THREE.Vector3(0, 0, 3), yaw: 0 });
  g.wallet.points = points;
  const events = [];
  for (const name of ['shoplifterTheft', 'shoplifterEscaped', 'shoplifterRecovered', 'kill']) g.events.on(name, (e) => events.push([name, e.points ?? null]));
  const thief = g.zombies.spawn('shoplifter', new THREE.Vector3(0, 0, 0.5));
  const waitForTheft = () => { for (let i = 0; i < 600 && !(thief.loot > 0); i++) t.tick(); };
  return { t, g, thief, events, waitForTheft };
}

test('the theft: 10% of your points, at least 50, at most 400, rounded down to 10, never more than you have', () => {
  assert.deepEqual([theft.fraction, theft.min, theft.max, theft.roundTo], [0.1, 50, 400, 10]);
  assert.equal(theftAmount(2000, theft), 200);
  assert.equal(theftAmount(1234, theft), 120, 'rounded down');
  assert.equal(theftAmount(300, theft), 50, 'at least 50');
  assert.equal(theftAmount(10000, theft), 400, 'at most 400');
  assert.equal(theftAmount(30, theft), 30, 'never more than you have');
  assert.equal(theftAmount(0, theft), 0);
});

test('a hit steals once and it runs off, away from you; after its getaway time it is gone with the points: no kill, no pay, a PA', () => {
  const { t, g, thief, events, waitForTheft } = scene(2000);
  const spent = g.wallet.totalSpent, earned = g.wallet.totalEarned;
  waitForTheft();
  assert.equal(thief.loot, 200);
  assert.equal(g.wallet.points, 1800);
  assert.equal(g.stats.health, g.stats.maxHealth - shoplifter.attack.damage, `its hit is a light ${shoplifter.attack.damage}`);
  assert.deepEqual([g.wallet.totalSpent, g.wallet.totalEarned], [spent, earned], 'a theft is neither spending nor income');
  // It runs: further from you every second for the first few seconds (down the Hallway).
  const gap = () => thief.position.distanceTo(g.player.position);
  const before = gap();
  t.tick(120);
  assert.ok(gap() > before + 5, `it ran ${(gap() - before).toFixed(1)} m in 2 s`);
  assert.equal(thief.loot, 200, 'one theft: it never steals again');
  // Gone after fleeSeconds.
  t.tick(Math.ceil((theft.fleeSeconds - 2) * 60) + 5);
  assert.equal(g.zombies.zombies.includes(thief), false, 'it got away');
  assert.equal(g.zombies.aliveCount, 0, 'and the round can end without it');
  assert.equal(g.wallet.points, 1800, 'the points went with it');
  assert.deepEqual(events, [['shoplifterTheft', 200], ['shoplifterEscaped', 200]], 'no kill was announced or paid');
});

test('killed before it gets away: every point comes back, and its kill pays as usual', () => {
  const { t, g, thief, events, waitForTheft } = scene(1500);
  waitForTheft();
  assert.equal(g.wallet.points, 1500 - 150);
  t.tick(60);
  thief.takeHit({ damage: 1e6, part: 'body', source: 'gun', weaponId: 'priceGun' });
  t.tick();
  assert.equal(g.wallet.points, 1500 + economy.killValues.shoplifter, 'the 150 back, and the kill');
  assert.equal(economy.killValues.shoplifter, 70);
  assert.ok(events.some(([name, points]) => name === 'shoplifterRecovered' && points === 150));
});

test('nothing to steal: it hits, takes nothing and stays to fight; once the run is over nothing is taken', () => {
  const broke = scene(0);
  for (let i = 0; i < 300; i++) broke.t.tick();
  assert.ok(broke.g.stats.health < broke.g.stats.maxHealth, 'it did hit');
  assert.ok(!(broke.thief.loot > 0) && !broke.thief.control, 'no loot, no getaway');
  assert.equal(broke.events.length, 0);
  const over = scene(2000);
  over.g.state.over = true;
  over.g.events.emit('playerHit', { damage: 0, zombie: over.thief });
  assert.equal(over.g.wallet.points, 2000);
  assert.ok(!(over.thief.loot > 0));
});

test('at most 3 alive at once: a fourth pick becomes a Shopper', () => {
  assert.equal(economy.zombieMix.shoplifter.maxAlive, 3);
  const { g } = scene();
  const more = [1, 2, 3].map((i) => g.zombies.spawn('shoplifter', new THREE.Vector3(i * 2, 0, -2)));
  assert.deepEqual(more.map((z) => z.type.id), ['shoplifter', 'shoplifter', 'shopper']);
});
