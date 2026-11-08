// Poppy Corn (config/zombies.js mascotVariants.poppyCorn.popBlast, game/mascotCostumes.js): the pop is a blast.
// Checked: zombies in range are flung and stunned, those further away (or behind a wall) are not; the player is
// shoved (and buttered) only in range, and never hurt; the blast happens once per Poppy, only for Poppy, pays nothing,
// and the bucket still lands as a fallen helmet.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { mascotTypes, mascotVariants } from '../src/config/zombies.js';

const type = mascotTypes.poppyCorn;
const blast = type.mascot.popBlast;

function fixture(t) {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  const { g } = game;
  g.rounds.jumpTo(mascotVariants.poppyCorn.unlockRound);
  g.rounds.update = () => {};
  game.standAt(0, 12);
  t.after(() => {
    g.zombies.clear();
    g.map.dispose();
  });
  const blasts = [];
  g.events.on('mascotPopBlast', (event) => blasts.push(event));
  return { ...game, scene, blasts };
}

const spawn = (g, variant, x, z) => {
  const zombie = g.zombies.spawn(variant ? 'mascot' : 'shopper', new THREE.Vector3(x, 0, z), variant ? { variant } : undefined);
  zombie.setState('chasing');
  return zombie;
};
const pop = (zombie, part = 'body', source = 'hazard') =>
  zombie.takeHit({ damage: zombie.health - zombie.maxHealth * type.mascot.healthFraction + 1, part, source });

test('the pop flings and stuns the zombies close by, and only those', (t) => {
  const { g, scene, blasts } = fixture(t);
  const poppy = spawn(g, 'poppyCorn', 0, 9);
  const near = spawn(g, null, 1.6, 8.6);
  const edge = spawn(g, null, -3.2, 7.6); // ~3.3 m away
  const far = spawn(g, null, 4.3, 14.5); // ~6 m away
  const healthBefore = [near, edge, far].map((z) => z.health);
  pop(poppy);

  assert.equal(blasts.length, 1);
  assert.equal(blasts[0].zombie, poppy);
  assert.equal(blasts[0].flung, 2);
  for (const zombie of [near, edge]) {
    assert.ok(Math.abs(zombie.staggerTimer - blast.stunSeconds) < 1e-9, 'stunned');
    const away = new THREE.Vector3().subVectors(zombie.position, poppy.position).setY(0).normalize();
    const pushed = new THREE.Vector3(zombie.velocity.x, 0, zombie.velocity.z);
    assert.ok(Math.abs(pushed.length() - blast.knockback) < 1e-6, 'knocked back as hard as configured');
    assert.ok(pushed.normalize().dot(away) > 0.99, 'straight away from the blast');
  }
  assert.equal(far.staggerTimer, 0, 'out of range: untouched');
  assert.deepEqual([near, edge, far].map((z) => z.health), healthBefore, 'no damage');
  assert.equal(poppy.staggerTimer, 0, 'not itself');
  assert.ok(scene.getObjectByName('mascotDebris'), 'the bucket still comes off and lands');
  assert.ok(g.effects.counts.particles >= blast.burst.count, 'with a puff of popcorn');
});

test('the player is shoved away and buttered only in range, and never hurt', (t) => {
  const { g, standAt, blasts } = fixture(t);
  g.health.invulnerable = false;
  standAt(0, 12);
  const close = spawn(g, 'poppyCorn', 0, 12 - blast.playerRadius * 0.6);
  g.player.velocity.set(0, 0, 0);
  const health = g.health.fraction;
  pop(close);
  assert.equal(blasts.at(-1).butter, true);
  assert.equal(blasts.at(-1).butterSeconds, blast.butterSeconds);
  assert.ok(Math.abs(g.player.velocity.z - blast.playerShove) < 1e-6, 'shoved straight away (+z, away from it)');
  assert.ok(Math.abs(g.player.velocity.x) < 1e-6 && g.player.velocity.y === 0, 'horizontally');
  assert.equal(g.health.fraction, health, 'no damage');
  close.takeHit({ damage: 1e9, part: 'body', source: 'hazard' });

  standAt(0, 12);
  const distant = spawn(g, 'poppyCorn', 0, 12 - blast.playerRadius - 1);
  g.player.velocity.set(0, 0, 0);
  pop(distant);
  assert.equal(blasts.at(-1).butter, false);
  assert.equal(g.player.velocity.length(), 0, 'out of range: not shoved');
});

test('once per Poppy, only for Poppy, and nothing is paid for it', (t) => {
  const { g, blasts } = fixture(t);
  const poppy = spawn(g, 'poppyCorn', 0, 8);
  const bystander = spawn(g, null, 1.2, 8);
  const points = g.wallet.points;
  pop(poppy);
  poppy.takeHit({ damage: 1, part: 'body', source: 'hazard' });
  poppy.takeHit({ damage: 1, part: 'body', source: 'hazard' });
  assert.equal(blasts.length, 1, 'the bucket only pops once');
  assert.equal(g.wallet.points, points, 'the blast pays nothing');
  assert.equal(g.runStats.kills, 0);
  assert.ok(bystander.isAlive);

  const waffles = spawn(g, 'sirWaffles', -2, 8);
  poppy.takeHit({ damage: 1e9, part: 'body', source: 'hazard' });
  pop(waffles);
  assert.equal(blasts.length, 1, 'Sir Waffles\' pop is just a pop');
});

test('a wall between them stops the blast', (t) => {
  const { g, blasts } = fixture(t);
  // The start room's east wall is at x 5: a zombie just the other side of it, in the hallway's dead space.
  const poppy = spawn(g, 'poppyCorn', 4.2, 10);
  const behind = g.zombies.spawn('shopper', new THREE.Vector3(6.2, 0, 10));
  behind.setState('chasing');
  pop(poppy);
  assert.equal(blasts.at(-1).flung, 0);
  assert.equal(behind.staggerTimer, 0);
});
