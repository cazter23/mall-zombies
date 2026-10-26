// The event bus (game/events.js) and everything wired through it in the REAL game: COD payouts for every
// way a zombie can die, run stats, purchases, rounds, player hits, death and Play again.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEvents } from '../src/game/events.js';
import { headlessGame } from './helpers/headlessGame.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';

const KILL = economy.killValues.shopper;
const HIT = economy.payouts.nonLethalHit;

test('bus: listeners run in order, can unsubscribe (even mid-emit) without skipping anyone', () => {
  const events = createEvents();
  const log = [];
  const offA = events.on('x', (p) => { log.push(['a', p.n]); offA(); });
  events.on('x', (p) => log.push(['b', p.n]));
  events.emit('x', { n: 1 });
  events.emit('x', { n: 2 });
  events.emit('nobody listens');
  assert.deepEqual(log, [['a', 1], ['b', 1], ['b', 2]]);
  assert.equal(events.count('x'), 1);
});

// A zombie standing still `meters` straight ahead of the player, with `health` HP.
function zombieAhead(t, meters, health) {
  const z = t.g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 0));
  const p = t.g.player.position;
  z.position.set(p.x, 0, p.z - meters);
  z.state = 'chasing';
  z.speed = 0;
  z.health = health;
  z.updateHitboxes();
  return z;
}

// A game in the start room, nothing spawning on its own, collecting every event.
function setup() {
  const t = headlessGame();
  t.tick(1);
  t.g.zombies.clear();
  t.g.rounds.update = () => {}; // (no round spawns in the way of these measurements)
  const seen = [];
  for (const name of ['shot', 'hit', 'kill', 'playerHit', 'playerDeath', 'runEnd', 'roundStart', 'typeIntro', 'purchase', 'runReset']) {
    t.g.events.on(name, (p) => seen.push([name, p]));
  }
  t.g.wallet.points = 0;
  return { t, g: t.g, seen, points: () => t.g.wallet.points };
}

const aim = (meters, height) => Math.atan2(height - 1.6, meters);

test('payouts: a body-shot kill pays the kill value, each earlier hit +10', () => {
  const { t, g, points } = setup();
  t.standAt(0, 12, 0, aim(3, 1.0));
  const z = zombieAhead(t, 3, 2 * weapons.stapleGun.damage); // dies on the 2nd body hit
  t.press('Mouse0'); t.tick(12); t.press('Mouse0'); t.tick(12);
  assert.equal(z.isAlive, false);
  assert.equal(points(), HIT + KILL);
  assert.equal(g.runStats.kills, 1);
});

test('payouts: a headshot kill adds the headshot bonus', () => {
  const { t, g, points, seen } = setup();
  t.standAt(0, 12, 0, aim(3, 1.6));
  const z = zombieAhead(t, 3, weapons.stapleGun.damage * weapons.stapleGun.headshotMultiplier);
  t.press('Mouse0'); t.tick(2);
  assert.equal(z.isAlive, false);
  assert.equal(points(), KILL + economy.payouts.headshotKillBonus);
  assert.equal(g.runStats.headshotKills, 1);
  const kill = seen.find(([n]) => n === 'kill')[1];
  assert.deepEqual([kill.headshot, kill.melee, kill.source], [true, false, 'gun']);
});

test('payouts: a box-cutter kill adds the melee bonus', () => {
  const { t, g, points, seen } = setup();
  t.standAt(0, 12, 0, aim(1.3, 1.0));
  const z = zombieAhead(t, 1.3, 100);
  t.press('KeyV'); t.tick(30);
  assert.equal(z.isAlive, false);
  assert.equal(points(), KILL + economy.payouts.meleeKillBonus);
  assert.equal(g.runStats.meleeKills, 1);
  assert.equal(seen.find(([n]) => n === 'kill')[1].source, 'melee');
});

test('payouts: a shotgun blast pays ONCE per zombie, not per pellet', () => {
  const { t, g, points } = setup();
  g.gun.give(weapons.confettiCannon); t.tick(40);
  t.standAt(0, 12, 0, aim(2, 1.0));
  const tough = zombieAhead(t, 2, 100_000);
  t.press('Mouse0'); t.tick(2);
  assert.ok(tough.isAlive);
  assert.equal(points(), HIT, 'one +10 for a blast that landed many pellets');
  g.zombies.clear(); g.wallet.points = 0; t.tick(40);
  const weak = zombieAhead(t, 2, 150);
  t.press('Mouse0'); t.tick(2);
  assert.equal(weak.isAlive, false);
  assert.equal(points(), KILL, 'one kill payout');
});

test('payouts: a kill by something other than a player attack (a future hazard) still pays and counts', () => {
  const { t, g, points, seen } = setup();
  const z = zombieAhead(t, 6, 150);
  z.takeHit({ damage: 9999, part: 'body', source: 'hazard' });
  assert.equal(points(), KILL, 'the kill value, and no +10 (it was not a player hit)');
  assert.equal(g.runStats.kills, 1);
  assert.deepEqual(seen.filter(([n]) => n === 'hit'), [], 'no hit event');
  assert.equal(seen.find(([n]) => n === 'kill')[1].source, 'hazard');
});

test('events from the real game: purchase, round start, player hit, death, Play again', () => {
  const t = headlessGame();
  const seen = [];
  for (const name of ['purchase', 'roundStart', 'playerHit', 'playerDeath', 'runReset']) t.g.events.on(name, (p) => seen.push([name, p]));
  t.tick(1);
  assert.deepEqual(seen.find(([n]) => n === 'roundStart')[1], { round: 1 });
  t.standAt(0, 8.5, 0);
  t.press('KeyF', 30);
  assert.deepEqual(seen.find(([n]) => n === 'purchase')[1], { label: 'Main Hallway', cost: economy.doors.hallway, kind: 'door', id: 'startShutter', areaId: 'hallway', openedDoorIds: ['startShutter'] });
  const before = t.g.health.fraction;
  t.g.events.emit('playerHit', { damage: 40, zombie: null });
  assert.ok(t.g.health.fraction < before, 'a player hit hurts');
  t.g.health.takeDamage(10_000); t.tick(1);
  assert.equal(seen.filter(([n]) => n === 'playerDeath').length, 1);
  t.g.resetRun();
  assert.equal(seen.filter(([n]) => n === 'runReset').length, 1);
});

test('death emits one immutable final run summary; later events and the results delay cannot change it', () => {
  const t = headlessGame();
  const ended = [];
  t.g.events.on('runEnd', ({ summary }) => ended.push(summary));
  t.tick(60);
  t.g.wallet.earn(400);
  t.g.wallet.spend(125);
  t.g.runStats.kills = 3;
  t.g.runStats.shotsFired = 10;
  t.g.runStats.shotsHit = 4;
  t.g.health.takeDamage(10_000);
  assert.equal(ended.length, 1);
  assert.equal(Object.isFrozen(ended[0]), true);
  assert.deepEqual({
    kills: ended[0].kills,
    shotsHit: ended[0].shotsHit,
    accuracy: ended[0].accuracy,
    pointsEarned: ended[0].pointsEarned,
    pointsSpent: ended[0].pointsSpent,
  }, { kills: 3, shotsHit: 4, accuracy: 0.4, pointsEarned: 400, pointsSpent: 125 });
  t.g.events.emit('kill', { zombie: { type: { id: 'shopper' } }, headshot: false, melee: false });
  t.tick(60 * 5);
  assert.equal(ended.length, 1);
  assert.equal(t.hud.calls.find(([name]) => name === 'showResults')[1], ended[0], 'receipt uses the exact frozen summary');
});

test('gameplay debug commands mark a run assisted; panel and spawn selection do not; Play again clears it', () => {
  const t = headlessGame();
  t.g.debug.run('panel');
  t.g.debug.run('cycleZombie');
  assert.equal(t.g.state.assisted, false);
  t.g.debug.run('addPoints');
  assert.equal(t.g.state.assisted, true);
  const ended = [];
  t.g.events.on('runEnd', ({ summary }) => ended.push(summary));
  t.g.health.takeDamage(10_000);
  assert.equal(ended[0].assisted, true);
  t.g.resetRun();
  assert.equal(t.g.state.assisted, false);
});

// --- Edge cases from the refactor review (Codex) ---

test('purchase events say what was bought BEFORE the purchase: a first Price Gun is a weapon, then its ammo', () => {
  const t = headlessGame();
  const { g } = t;
  const bought = [];
  g.events.on('purchase', (p) => bought.push(p));
  t.tick(1);
  g.wallet.earn(5000);
  t.standAt(3.5, 10, -90);
  t.press('KeyF', 30);
  t.tick(40);
  assert.deepEqual(bought[0], { label: 'Price Gun', cost: economy.wallBuys.priceGun.weapon, kind: 'weapon', id: 'priceGun' });
  g.gun.weapon.magazine = 1;
  t.standAt(3.5, 10, -90);
  t.press('KeyF', 30);
  assert.deepEqual(bought[1], { label: 'Price Gun ammo', cost: economy.wallBuys.priceGun.ammo, kind: 'ammo', id: 'priceGun' });
});

test('a kill listener that kills another zombie mid-shot: each kill pays once, no +10 for hitting the corpse', () => {
  const { t, g, points } = setup();
  g.gun.give(weapons.nailGun); t.tick(40);
  t.standAt(0, 12, 0, aim(3, 1.0));
  const front = zombieAhead(t, 3, 50);
  const rear = zombieAhead(t, 4, 50);
  // A future "on kill" proc: the front zombie's death also kills the one behind it.
  g.events.on('kill', ({ zombie }) => { if (zombie === front && rear.isAlive) rear.takeHit({ damage: 9999, part: 'body', source: 'effect' }); });
  t.press('Mouse0'); t.tick(2);
  assert.equal(front.isAlive, false); assert.equal(rear.isAlive, false);
  assert.equal(points(), 2 * KILL, 'two kills, nothing for the nail reaching an already-dead zombie');
  assert.equal(g.runStats.kills, 2);
});

test('one nail through three weak zombies: three kill payouts; one blast through two: two', () => {
  const { t, g, points } = setup();
  g.gun.give(weapons.nailGun); t.tick(40);
  t.standAt(0, 12, 0, aim(3, 1.0));
  const line = [3, 4, 5].map((m) => zombieAhead(t, m, 40));
  t.press('Mouse0'); t.tick(2);
  assert.ok(line.every((z) => !z.isAlive));
  assert.equal(points(), 3 * KILL);
  g.zombies.clear(); g.wallet.points = 0;
  g.gun.give(weapons.confettiCannon); t.tick(40);
  t.standAt(0, 12, 0, aim(2, 1.0));
  const pair = [2, 3].map((m) => zombieAhead(t, m, 60));
  t.press('Mouse0'); t.tick(2);
  assert.ok(pair.every((z) => !z.isAlive));
  assert.equal(points(), 2 * KILL);
});

test('shooting a practice dummy (test range) pays nothing, but still counts as a hit', async () => {
  const { buildTestRange } = await import('../src/maps/testRange/testRange.js');
  const t = headlessGame({ buildTestRange });
  const { g } = t;
  t.tick(1); g.zombies.clear(); g.rounds.update = () => {};
  const hits = [];
  g.events.on('hit', (h) => hits.push(h));
  const dummy = g.arena.shootables[0];
  const c = dummy.hitboxes.find((h) => h.part === 'body').box.getCenter(new THREE.Vector3());
  t.standAt(c.x, c.z + 3, 0, aim(3, c.y));
  const before = g.wallet.points;
  t.press('Mouse0'); t.tick(2);
  assert.equal(hits.length, 1, 'the dummy was hit');
  assert.equal(g.wallet.points, before);
});

test('once you are dead nothing more is paid or counted, and the results screen stays as it was', () => {
  const { t, g } = setup();
  const late = zombieAhead(t, 6, 150);
  g.health.takeDamage(10_000); t.tick(1);
  assert.equal(g.state.over, true);
  const points = g.wallet.points, earned = g.wallet.totalEarned, kills = g.runStats.kills;
  late.takeHit({ damage: 9999, part: 'body', source: 'effect' }); // a burning zombie dies after you
  t.tick(60 * 5);
  assert.equal(g.wallet.points, points); assert.equal(g.wallet.totalEarned, earned); assert.equal(g.runStats.kills, kills);
  const results = t.hud.calls.find(([n]) => n === 'showResults')[1];
  assert.equal(results.kills, kills); assert.equal(results.pointsEarned, earned);
});
