// The Bottle Rocket Bazooka (config/weapons.js bottleRocket: claw-only, the rocket launcher), in the real headless game through real input. The blast itself
// has its own test (blast.test.js); this checks the gun: no wall sells it, one pull is one rocket and one shot, the rocket bursts on what it touches and
// hurts every zombie around it (+10 each), your own burst hurts you (capped, never a one-shot from full; nothing in the blast-proof item; the death
// receipt names it), and a rocket in the air when you die, or at Play again, is gone without a burst.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { clawMachine } from '../src/config/clawMachine.js';
import { buildWallBuy } from '../src/game/features/wallBuy.js';
import { getDeathReport, deathReports } from '../src/config/deathReports.js';

const rk = weapons.bottleRocket;
const FLIGHT_TICKS = Math.ceil(rk.flight.lifeSeconds / dt) + 5;

// In the Main Hallway along z 0 (clear for 39 m), the bazooka in hand. `x`, `yaw`: where and which way (default: the west end, facing +x).
function setup(x = -17, yaw = -Math.PI / 2) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(x, 0, 0), yaw });
  g.gun.give(rk);
  t.tick(60);
  const blasts = [];
  g.events.on('gunBlast', (b) => blasts.push(b));
  const spawn = (px, pz = 0) => g.zombies.spawn('shopper', new THREE.Vector3(px, 0, pz));
  const freeze = (zs) => { t.tick(2); for (const z of zs) { z.speed = 0; z.attackCooldown = 99; z.velocity.set(0, 0, 0); z.health = 1e6; } t.tick(30); };
  const fire = () => { g.gun.weapon.magazine = 1; g.gun.weapon.cooldown = 0; t.press('Mouse0'); };
  return { t, g, blasts, spawn, freeze, fire };
}

test('claw-only: flagged, no wall price, the wall-buy feature refuses it, and it is in the GRAB-A-GUN pool', () => {
  assert.equal(rk.clawOnly, true);
  assert.equal(economy.wallBuys.bottleRocket, undefined);
  const added = [];
  const ctx = { scene: { add: () => added.push('scene') }, map: { zones: {} }, gun: { owns: () => false }, pricing: {}, interactions: { add: () => added.push('interaction') } };
  assert.equal(buildWallBuy({ weapon: 'bottleRocket', zone: 'hallway', position: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) }, ctx), null);
  assert.deepEqual(added, []);
  assert.ok(clawMachine.prizes.bottleRocket?.weight > 0, 'the claw machine is the only way to it');
});

test('one pull = one rocket and one shot (counted at the launch); it flies, and with nothing in the way it bursts in the air at the end of its life', () => {
  const { t, g, blasts, fire } = setup();
  fire();
  assert.equal(g.gun.weapon.magazine, 0);
  assert.equal(g.rockets.list.length, 1, 'a rocket in the air');
  assert.equal(g.runStats.shotsFired, 1);
  assert.ok(t.sounds.includes('bottleRocketLaunch'));
  t.tick(FLIGHT_TICKS);
  assert.equal(g.rockets.list.length, 0);
  assert.equal(blasts.length, 1, 'it burst');
  assert.equal(blasts[0].hits.length, 0);
  assert.equal(blasts[0].selfDamage, 0, 'far from you');
  assert.ok(t.sounds.includes('bottleRocketBurst'));
  assert.equal(g.runStats.shotsHit, 0, 'a burst that caught nobody is a miss');
});

test('THE ROLE: a rocket into a clump hurts every zombie round the burst (+10 each, the nearest most), one hit for accuracy, and you are far enough away to be fine', () => {
  const { t, g, blasts, spawn, freeze, fire } = setup();
  const clump = [spawn(-5), spawn(-4.4, 0.9), spawn(-4.4, -0.9), spawn(-3.2, 0)];
  const far = spawn(2);
  freeze([...clump, far]);
  g.player.pitch = Math.atan2(1 - 1.6, 12); // (the first one's chest)
  const hits = [];
  g.events.on('hit', (h) => hits.push(h));
  const health = g.stats.health;
  fire();
  t.tick(FLIGHT_TICKS);
  assert.equal(blasts.length, 1);
  const taken = clump.map((z) => 1e6 - z.health);
  for (const [i, d] of taken.entries()) assert.ok(d > 0, `zombie ${i + 1} caught (${taken.map(Math.round).join(', ')})`);
  assert.equal(1e6 - far.health, 0, 'the one 7 m away is outside the radius');
  assert.ok(taken[0] > taken[3], 'the nearest takes the most');
  assert.ok(taken[0] <= rk.damage + 1e-6 && taken[0] > 0.8 * rk.damage, 'near the centre: about the full damage');
  assert.equal(hits.length, 4, 'four +10s');
  assert.ok(hits.every((h) => h.weaponId === 'bottleRocket' && !h.headshot));
  assert.equal(g.runStats.shotsHit, 1, 'one shot, one hit');
  assert.equal(g.stats.health, health, '12 m away: no harm to you');
});

test('your own burst hurts you: a rocket into the wall in front of you takes a share of your health, never a one-shot from full; the blast-proof stat cancels it', () => {
  const near = setup(-18.5, Math.PI / 2); // facing the Hallway's west wall, 1.5 m off
  near.fire();
  near.t.tick(30);
  assert.equal(near.blasts.length, 1);
  const lost = near.g.stats.maxHealth - near.g.stats.health;
  assert.ok(lost > 0.2 * near.g.stats.maxHealth, `it bites (${lost.toFixed(1)})`);
  assert.ok(lost <= rk.blast.self.maxShare * near.g.stats.maxHealth + 1e-9 && near.g.stats.health > 0, 'never more than maxShare: you live');
  assert.ok(Math.abs(near.blasts[0].selfDamage - lost) < 1e-9);

  const proof = setup(-18.5, Math.PI / 2);
  proof.g.stats.ownBlastDamage = 0; // (what the wardrobe's blast-proof item sets)
  proof.fire();
  proof.t.tick(30);
  assert.equal(proof.blasts[0].selfDamage, 0);
  assert.equal(proof.g.stats.health, proof.g.stats.maxHealth);
});

test('it can finish you when you are already hurt, and the death receipt says it was your own rocket', () => {
  const { t, g, fire } = setup(-18.5, Math.PI / 2);
  g.stats.health = 5;
  fire();
  t.tick(30);
  assert.ok(g.death.summary, 'dead');
  assert.equal(g.death.summary.killedBy.type, 'ownBlast');
  assert.equal(getDeathReport(g.death.summary.killedBy), deathReports.ownBlast);
});

test('a rocket in the air when you die is gone without a burst; Play again leaves none', () => {
  const { t, g, blasts, fire } = setup();
  fire();
  assert.equal(g.rockets.list.length, 1);
  g.stats.health = 1;
  g.events.emit('playerHit', { damage: 50, zombie: null });
  assert.ok(g.death.summary);
  t.tick(FLIGHT_TICKS);
  assert.equal(g.rockets.list.length, 0);
  assert.equal(blasts.length, 0, 'no burst after the death');
  g.resetRun();
  assert.equal(g.rockets.list.length, 0);
});

test('reload: one rocket in the tube from a reserve of twelve', () => {
  const { t, g } = setup();
  assert.equal(g.gun.weapon.magazine, 1);
  assert.equal(g.gun.weapon.reserve, rk.startingReserve);
  g.gun.weapon.magazine = 0;
  t.press('KeyR');
  t.tick(Math.ceil(rk.reloadTime / dt) + 5);
  assert.equal(g.gun.weapon.magazine, 1);
  assert.equal(g.gun.weapon.reserve, rk.startingReserve - 1);
});
