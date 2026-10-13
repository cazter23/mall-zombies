import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Zombie } from '../src/zombies/zombie.js';
import { zombieTypes } from '../src/config/zombies.js';
import {
  economy, zombieHealthForRound, zombieHealthFor, zombieTypeForRound,
} from '../src/config/economy.js';
import { createRounds } from '../src/game/rounds.js';
import { pointsForHit } from '../src/game/wallet.js';
import { feel } from '../src/config/feel.js';

const dt = 1 / feel.simulation.tickRate;

test('Mall Walkers only join the mix from round 4, at the configured shares', () => {
  for (const round of [1, 2, 3]) assert.equal(zombieTypeForRound(round, 0), 'shopper');
  assert.equal(zombieTypeForRound(4, 0.149), 'mallWalker');
  assert.equal(zombieTypeForRound(4, 0.151), 'shopper');
  assert.equal(zombieTypeForRound(6, 0.249), 'mallWalker');
  assert.equal(zombieTypeForRound(9, 0.299), 'mallWalker');
  assert.equal(zombieTypeForRound(20, 0.301), 'shopper');
});

test('Mall Walkers have 65% of the round health and pay the same kill value', () => {
  for (const round of [1, 4, 9, 12]) {
    assert.equal(zombieHealthFor('shopper', round), zombieHealthForRound(round));
    assert.equal(zombieHealthFor('mallWalker', round), Math.round(zombieHealthForRound(round) * 0.65));
  }
  assert.equal(pointsForHit({ target: { type: zombieTypes.mallWalker }, killed: true }), economy.killValues.mallWalker);
  assert.equal(pointsForHit({ target: { type: zombieTypes.mallWalker }, killed: false }), economy.payouts.nonLethalHit);
});

test('round 4 always brings a Mall Walker early and announces each new type once per run', () => {
  const spawns = [];
  const intros = [];
  const fakeZombies = { aliveCount: 0, spawn(typeId) { spawns.push({ round: rounds.round, typeId }); return {}; }, clear() {} };
  const rounds = createRounds({ zombies: fakeZombies, onTypeIntro: (typeId) => intros.push({ round: rounds.round, typeId }) });
  rounds.start();
  for (let i = 0; i < 60 * 400 && rounds.round < 5; i++) rounds.update(dt);
  assert.ok(rounds.round >= 5, 'rounds should have advanced past round 4');
  assert.equal(spawns.filter((s) => s.round < 4 && s.typeId !== 'shopper').length, 0);
  const round4 = spawns.filter((s) => s.round === 4);
  assert.ok(round4.slice(0, economy.zombieMix.mallWalker.introSpawnIndex + 1).some((s) => s.typeId === 'mallWalker'));
  assert.deepEqual(intros.map((i) => i.typeId), ['shopper', 'mallWalker']);
  assert.equal(intros[1].round, 4);
  rounds.reset();
  rounds.start();
  for (let i = 0; i < 60 * 30 && rounds.round < 2; i++) rounds.update(dt);
  assert.equal(intros.filter((i) => i.typeId === 'shopper').length, 2, 'a new run announces again');
});

function walkerFixture(typeId, playerZ) {
  const sounds = [];
  const hits = [];
  const player = { position: new THREE.Vector3(0, 0, playerZ), height: feel.player.height };
  const nav = {
    directionTo(from, to, out) {
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      out.x = dx / d;
      out.z = dz / d;
      return true;
    },
  };
  const colliders = [new THREE.Box3(new THREE.Vector3(-30, -0.2, -30), new THREE.Vector3(30, 0, 30))];
  const zombie = new Zombie({ type: zombieTypes[typeId], health: 300, position: new THREE.Vector3(0, 0, 0), yaw: 0 });
  zombie.setState('chasing');
  const zombies = [zombie];
  const ctx = {
    nav, player, colliders, zombies, canAttack: true,
    onPlayerHit: (damage) => hits.push(damage), onSound: (name, volume) => sounds.push({ name, volume }),
  };
  // Finish a swing right now (as if it just slammed).
  const finishSwing = () => {
    zombie.setState('swing');
    zombie.stateTime = zombie.type.attack.swingSeconds;
    zombie.swingHit = true;
    zombie.update(dt, ctx);
  };
  return { zombie, ctx, player, sounds, hits, finishSwing };
}

test('a Mall Walker is fast, winded after a swing (stands, then slow), and can not attack while panting', () => {
  const walker = zombieTypes.mallWalker;
  const f = walkerFixture('mallWalker', -1.0); // player in arm's reach, right in front
  assert.ok(Math.abs(f.zombie.speed - walker.speed) <= walker.speed * walker.speedVariation + 1e-9);
  f.finishSwing();
  assert.equal(f.zombie.state, 'chasing');
  assert.ok(Math.abs(f.zombie.windedTimer - (walker.winded.standSeconds + walker.winded.slowSeconds)) < 1e-6);
  assert.ok(f.sounds.some((s) => s.name === 'walkerPant'));
  // Standing winded: no new attack even with the player in reach.
  const standTicks = Math.floor(walker.winded.standSeconds / dt) - 2;
  for (let i = 0; i < standTicks; i++) {
    f.zombie.update(dt, f.ctx);
    assert.equal(f.zombie.state, 'chasing', `no wind-up while winded (tick ${i})`);
  }
  // Once it has caught its breath it attacks again.
  for (let i = 0; i < 10 && f.zombie.state === 'chasing'; i++) f.zombie.update(dt, f.ctx);
  assert.equal(f.zombie.state, 'windup');
});

test('a winded Mall Walker stops, then follows at half speed, then full speed', () => {
  const walker = zombieTypes.mallWalker;
  const f = walkerFixture('mallWalker', -30); // player far away: it wants to chase
  f.finishSwing();
  const start = f.zombie.position.clone();
  for (let i = 0; i < Math.floor(walker.winded.standSeconds / dt) - 1; i++) f.zombie.update(dt, f.ctx);
  assert.ok(f.zombie.position.distanceTo(start) < 0.05, 'stands still while panting');
  for (let i = 0; i < Math.floor(walker.winded.slowSeconds / dt) - 2; i++) f.zombie.update(dt, f.ctx);
  assert.ok(f.zombie.horizontalSpeed <= f.zombie.speed * walker.winded.slowSpeedFraction + 1e-6, 'slow while recovering');
  assert.ok(f.zombie.horizontalSpeed > 0.5, 'but moving');
  for (let i = 0; i < 60; i++) f.zombie.update(dt, f.ctx);
  assert.equal(f.zombie.windedTimer, 0);
  assert.ok(f.zombie.horizontalSpeed > f.zombie.speed * 0.95, 'back to full power-walk speed');
  assert.ok(f.zombie.speed > feel.movement.walkSpeed, 'outpaces a walking player');
  assert.ok(!f.sounds.some((s) => s.name === 'walkerHuff'), 'too far away to hear (past maxDistance)');
  f.player.position.z = f.zombie.position.z - 8; // within earshot
  for (let i = 0; i < 90; i++) f.zombie.update(dt, f.ctx);
  const huff = f.sounds.find((s) => s.name === 'walkerHuff');
  assert.ok(huff && huff.volume > 0 && huff.volume < 1, 'huffs while chasing, quieter with distance');
});

test('Shoppers are unchanged: no winded state, normal hit recovery', () => {
  const f = walkerFixture('shopper', -1.0);
  f.finishSwing();
  assert.equal(f.zombie.windedTimer, 0);
  assert.equal(f.zombie.attackCooldown, zombieTypes.shopper.attack.recoverSeconds);
  assert.equal(f.sounds.length, 0);
});
