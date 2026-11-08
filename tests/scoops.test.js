// Scoops (config/zombies.js mascotVariants.scoops.melt, game/meltTrail.js) and the surface-slow collector
// (game/surfaceSlows.js). Checked: puddles every dropEvery while he walks (twice as often bare-headed, none piled up
// while he stands); a player standing in one is slowed, outside or as a zombie nothing; with the Janitor's wet floor
// the lowest factor wins; the pool never grows; and round end, death and Play again clear it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dt, headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { bossTypes } from '../src/config/bosses.js';
import { mascotTypes, mascotVariants } from '../src/config/zombies.js';
import { createSurfaceSlows } from '../src/game/surfaceSlows.js';

const type = mascotTypes.scoops;
const melt = type.mascot.melt;
const ticks = (seconds) => Math.round(seconds / dt);

function fixture(t) {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  const { g } = game;
  g.health.invulnerable = true;
  g.rounds.jumpTo(mascotVariants.scoops.unlockRound);
  g.rounds.update = () => {};
  game.standAt(0, 12); // (the spawn: far enough from the start room's vents for the Janitor to rise there)
  t.after(() => {
    g.resetRun();
    g.map.dispose();
  });
  return { ...game, scene, trail: g.mascotCostumes.melt };
}

const scoops = (g, x, z) => {
  const zombie = g.zombies.spawn('mascot', new THREE.Vector3(x, 0, z), { variant: 'scoops' });
  zombie.setState('chasing');
  return zombie;
};
const kill = (zombie) => zombie.takeHit({ damage: 1e9, part: 'body', source: 'hazard' });
// Walk him along x at `speed` m/s for `seconds` (placed by hand each tick, so the route doesn't matter).
function walk(tick, zombie, { from, speed = 1.5, seconds }) {
  for (let i = 1; i <= ticks(seconds); i++) {
    tick();
    zombie.position.set(from.x + speed * i * dt, 0, from.z);
  }
}

test('while he walks he drips every dropEvery, twice as often with his cone off, and never piles up standing still', (t) => {
  const { g, tick, trail } = fixture(t);
  const zombie = scoops(g, -4, 9);
  walk(tick, zombie, { from: { x: -4, z: 9 }, seconds: 3 });
  const suited = trail.active.length;
  assert.ok(Math.abs(suited - 3 / melt.dropEvery) <= 1, `${suited} puddles in 3 s`);

  zombie.takeHit({ damage: zombie.health - zombie.maxHealth * type.mascot.healthFraction + 1, part: 'body', source: 'hazard' });
  assert.ok(zombie.mascotHeadOff);
  walk(tick, zombie, { from: { x: zombie.position.x, z: 9 }, seconds: 2 });
  const bare = trail.active.length - suited;
  assert.ok(Math.abs(bare - 2 / melt.exposedDropEvery) <= 1, `${bare} puddles in 2 s bare-headed`);
  assert.ok(melt.exposedDropEvery < melt.dropEvery);

  const before = trail.active.length;
  const still = zombie.position.clone();
  for (let i = 0; i < ticks(1.5); i++) {
    tick();
    zombie.position.copy(still);
  }
  // (one more may land as he stops, if he had walked minSpacing since the last one; then no more)
  assert.ok(trail.active.length <= before + 1, 'standing still: no pile of puddles under him');
});

test('standing in a puddle slows the player (walking really is slower); outside nothing, and zombies never', (t) => {
  const { g, tick, standAt, input, trail } = fixture(t);
  const zombie = scoops(g, 2, 9);
  zombie.speed = 0;
  tick(ticks(melt.dropEvery) + 2);
  assert.equal(trail.active.length, 1);
  const spot = trail.active[0].mesh.position.clone();
  kill(zombie);

  standAt(spot.x, spot.z);
  tick(2);
  assert.equal(g.stats.surfaceSpeed, melt.slowFactor);
  input.held.add('KeyA');
  tick(12);
  input.held.delete('KeyA');
  const speed = Math.hypot(g.player.velocity.x, g.player.velocity.z);
  assert.ok(speed > 0 && speed <= g.stats.walkSpeed * melt.slowFactor + 1e-6, `walking at ${speed}`);

  standAt(spot.x + melt.radius + 1, spot.z);
  tick(2);
  assert.equal(g.stats.surfaceSpeed, 1);

  const shopper = g.zombies.spawn('shopper', spot.clone().setY(0));
  shopper.setState('chasing');
  tick(10);
  assert.equal(shopper.slowFraction, 1, 'zombies wade straight through');
});

test('the collector: every source reports its own factor, the lowest wins, nothing stacks', () => {
  const stats = { surfaceSpeed: 1 };
  const surfaces = createSurfaceSlows(stats);
  surfaces.set('janitor', 0.7);
  surfaces.set('melt', 0.6);
  assert.equal(stats.surfaceSpeed, 0.6);
  surfaces.set('melt', 1);
  assert.equal(stats.surfaceSpeed, 0.7);
  assert.equal(surfaces.factorOf('janitor'), 0.7);
  surfaces.clear('janitor');
  assert.equal(stats.surfaceSpeed, 1);
  surfaces.set('janitor', 0.5);
  surfaces.reset();
  assert.equal(stats.surfaceSpeed, 1);
  assert.equal(surfaces.factorOf('janitor'), 1);
});

test('on the Janitor\'s wet floor AND in a melt puddle the lowest factor wins, and each still works alone', (t) => {
  const { g, tick, trail } = fixture(t);
  const wet = bossTypes.janitor.wetFloor.speedFraction;
  assert.notEqual(wet, melt.slowFactor, '(so the test can tell them apart)');
  assert.match(g.debug.run('summonBoss'), /^Summoned/);
  const boss = g.bosses.active;
  boss.position.set(0, 0, 9);
  boss.prevPosition.copy(boss.position);
  boss.setState('chasing');
  boss.speed = 0;
  tick(2);
  const patch = g.bosses.patches[0];
  g.player.teleport({ position: patch.position.clone(), yaw: 0 });
  boss.position.set(0, 0, 15);
  tick(2);
  assert.equal(g.stats.surfaceSpeed, wet, 'the wet floor alone');

  const zombie = scoops(g, patch.position.x + 0.5, patch.position.z);
  zombie.speed = 0;
  tick(ticks(melt.dropEvery) + 2);
  assert.ok(trail.active.length >= 1);
  assert.equal(g.stats.surfaceSpeed, Math.min(wet, melt.slowFactor), 'both: the lowest');
  kill(zombie);
  tick(ticks(melt.lifeSeconds) + 2);
  assert.equal(trail.active.length, 0);
  assert.equal(g.stats.surfaceSpeed, wet, 'the melt has gone: the wet floor again');
});

test('the pool never grows: two Scoops on a long walk share maxPuddles discs, the oldest giving way', (t) => {
  const { g, tick, scene, trail } = fixture(t);
  const count = () => scene.children.filter((node) => node.name === 'meltPuddle').length;
  assert.equal(count(), melt.maxPuddles, 'the whole pool exists from the start');
  const pool = [...trail.puddles];
  const a = scoops(g, -4, 8);
  const b = scoops(g, -4, 10.5);
  for (let i = 1; i <= ticks(8); i++) {
    tick();
    a.position.set(-4 + ((i * dt * 1.5) % 8), 0, 8);
    b.position.set(4 - ((i * dt * 1.5) % 8), 0, 10.5);
  }
  assert.equal(trail.active.length, melt.maxPuddles, 'every disc in use...');
  assert.equal(count(), melt.maxPuddles, '...and not one more');
  assert.deepEqual(trail.puddles, pool, 'the same discs');
  const youngest = Math.max(...trail.active.map((p) => p.remaining));
  const oldest = Math.min(...trail.active.map((p) => p.remaining));
  assert.ok(youngest - oldest < melt.lifeSeconds * 0.75, 'old puddles were reused for new ones');
});

test('puddles clear when the round ends, when you die, and on Play again', (t) => {
  const { g, tick, trail, standAt } = fixture(t);
  const makePuddles = () => {
    const zombie = scoops(g, -3, 9);
    walk(tick, zombie, { from: { x: -3, z: 9 }, seconds: 1.6 });
    assert.ok(trail.active.length > 0);
    standAt(trail.active[0].mesh.position.x, trail.active[0].mesh.position.z);
    tick(1);
    assert.equal(g.stats.surfaceSpeed, melt.slowFactor);
  };
  makePuddles();
  g.rounds.jumpTo(mascotVariants.scoops.unlockRound + 1);
  tick(1);
  assert.equal(trail.active.length, 0, 'round end');
  assert.equal(g.stats.surfaceSpeed, 1);

  makePuddles();
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  assert.ok(g.state.over);
  assert.equal(trail.active.length, 0, 'death');
  assert.equal(g.stats.surfaceSpeed, 1);

  g.resetRun();
  g.health.invulnerable = true;
  g.rounds.jumpTo(mascotVariants.scoops.unlockRound);
  g.rounds.update = () => {};
  makePuddles();
  g.resetRun();
  assert.equal(trail.active.length, 0, 'Play again');
  assert.equal(g.stats.surfaceSpeed, 1);
  assert.ok(trail.puddles.every((p) => !p.mesh.visible));
});
