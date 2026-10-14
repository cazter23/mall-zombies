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
  for (const name of ['shot', 'hit', 'kill', 'playerHit', 'playerDeath', 'roundStart', 'typeIntro', 'purchase', 'runReset']) {
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
  assert.deepEqual(seen.find(([n]) => n === 'purchase')[1], { label: 'Security Shutter', cost: economy.doors.startShutter });
  const before = t.g.health.fraction;
  t.g.events.emit('playerHit', { damage: 40, zombie: null });
  assert.ok(t.g.health.fraction < before, 'a player hit hurts');
  t.g.health.takeDamage(10_000); t.tick(1);
  assert.equal(seen.filter(([n]) => n === 'playerDeath').length, 1);
  t.g.resetRun();
  assert.equal(seen.filter(([n]) => n === 'runReset').length, 1);
});
