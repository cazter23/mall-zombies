// Last-zombie ("straggler") helper (game/stragglers.js) & zombieRim straggler shader toggle:
// forces a real round down to the threshold, checks the delay after the last kill, clears on
// round end / count rising / boss-only / disabled setting, skips bosses while counting them,
// verifies PA announcement once per run, and resets cleanly on Play again (resetRun).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { feel } from '../src/config/feel.js';
import { createStragglers } from '../src/game/stragglers.js';
import { createEvents } from '../src/game/events.js';
import { applyZombieRim, syncStragglerHighlights } from '../src/zombies/zombieRim.js';
import { headlessGame, dt } from './helpers/headlessGame.js';

function killZombie(zombie) {
  zombie.takeHit({ damage: zombie.health + 1000, part: 'body' });
}

test('fires after delay at <= threshold when remainingToSpawn === 0, never while spawns remain, clears on round end and resets on resetRun', () => {
  const prevEnabled = feel.stragglers.enabled;
  feel.stragglers.enabled = true;
  try {
    const t = headlessGame();
    const { g } = t;
    const emitted = [];
    g.events.on('stragglers', (e) => emitted.push({ type: 'stragglers', ...e }));
    g.events.on('stragglersCleared', (e) => emitted.push({ type: 'cleared', ...e }));

    // Jump to round 1 and let zombies spawn. Use god mode so player never dies.
    g.debug.run('god');
    g.rounds.start();
    while (g.rounds.state !== 'active') t.tick(1);

    // Wait for first zombie to spawn while remainingToSpawn is still > 0.
    while (g.zombies.aliveCount < 1 && g.rounds.remainingToSpawn > 0) {
      t.tick(Math.ceil(0.25 / dt));
    }
    assert.ok(g.rounds.remainingToSpawn > 0, 'still has zombies left to spawn');
    assert.ok(g.zombies.aliveCount <= feel.stragglers.threshold);
    // Wait long enough that delaySeconds WOULD have elapsed if spawns weren't pending, culling to 1 if any spawn.
    const delayTicks = Math.ceil(feel.stragglers.delaySeconds / dt) + 5;
    for (let i = 0; i < delayTicks && g.rounds.remainingToSpawn > 0; i++) {
      while (g.zombies.aliveCount > 1) {
        const z = g.zombies.zombies.find((a) => a.isAlive);
        if (!z) break;
        killZombie(z);
      }
      t.tick(1);
      assert.equal(g.stragglers.active, false, 'never fires while remainingToSpawn > 0');
    }

    // Drain any remaining pending spawns cleanly so remainingToSpawn === 0, then cull down to threshold (2).
    while (g.rounds.remainingToSpawn > 0) {
      while (g.zombies.aliveCount > 3) {
        const z = g.zombies.zombies.find((a) => a.isAlive);
        if (!z) break;
        killZombie(z);
      }
      t.tick(Math.ceil(0.5 / dt));
    }
    assert.equal(g.rounds.remainingToSpawn, 0);

    while (g.zombies.aliveCount > feel.stragglers.threshold) {
      const z = g.zombies.zombies.find((a) => a.isAlive);
      killZombie(z);
    }
    emitted.length = 0;

    // Just before delaySeconds elapses: NOT active yet.
    const almostTicks = Math.floor((feel.stragglers.delaySeconds - 0.25) / dt);
    t.tick(almostTicks);
    assert.equal(g.stragglers.active, false);
    assert.equal(emitted.length, 0);

    // Cross delaySeconds threshold: activates with firstTime: true.
    t.tick(Math.ceil(0.5 / dt));
    assert.equal(g.stragglers.active, true);
    assert.equal(emitted.filter((e) => e.type === 'stragglers').length, 1);
    assert.equal(emitted[0].firstTime, true);
    assert.equal(emitted[0].zombies.length, g.zombies.aliveCount);

    // Killing all remaining zombies ends the round and clears stragglers immediately.
    for (const z of g.zombies.zombies.filter((a) => a.isAlive)) {
      killZombie(z);
    }
    t.tick(2);
    assert.equal(g.stragglers.active, false);
    assert.ok(emitted.some((e) => e.type === 'cleared'));

    // Round 2: reaches stragglers again -> firstTime should now be false (only once per run).
    g.rounds.endBreak(0.1);
    while (g.rounds.state !== 'active') t.tick(1);
    while (g.rounds.remainingToSpawn > 0) {
      while (g.zombies.aliveCount > 3) {
        const z = g.zombies.zombies.find((a) => a.isAlive);
        if (!z) break;
        killZombie(z);
      }
      t.tick(Math.ceil(0.5 / dt));
    }
    while (g.zombies.aliveCount > feel.stragglers.threshold) {
      const z = g.zombies.zombies.find((a) => a.isAlive);
      killZombie(z);
    }
    emitted.length = 0;
    t.tick(Math.ceil((feel.stragglers.delaySeconds + 0.3) / dt));
    assert.equal(g.stragglers.active, true);
    const r2Start = emitted.find((e) => e.type === 'stragglers');
    assert.ok(r2Start);
    assert.equal(r2Start.firstTime, false, 'PA flag only fires on first trigger of a run');

    // Play again (resetRun) clears stragglers and restores fresh run state.
    g.resetRun();
    assert.equal(g.stragglers.active, false);
    assert.equal(g.stragglers.delayTimer, 0);
    assert.deepEqual(g.stragglers.targets, []);
  } finally {
    feel.stragglers.enabled = prevEnabled;
  }
});

test('counts bosses toward threshold, skips bosses, clears if count rises or setting disabled, never fires while remainingToSpawn > 0', () => {
  const prevEnabled = feel.stragglers.enabled;
  feel.stragglers.enabled = true;
  try {
    const events = createEvents();
    const rounds = { state: 'active', round: 5, remainingToSpawn: 1 };
    const normal1 = { isAlive: true, type: { id: 'shopper' } };
    const normal2 = { isAlive: true, type: { id: 'mallWalker' } };
    const boss = { isAlive: true, type: { id: 'janitor', boss: true } };
    const zombies = {
      zombies: [normal1],
      get aliveCount() { return this.zombies.filter((z) => z.isAlive).length; },
    };
    const state = { over: false };
    const stragglers = createStragglers({ rounds, zombies, events, state });
    const log = [];
    events.on('stragglers', (e) => log.push(['on', e.zombies, e.firstTime]));
    events.on('stragglersCleared', (e) => log.push(['off', e.reason]));

    // Spawns remaining -> never triggers even after delay.
    for (let i = 0; i < 600; i++) stragglers.update(1 / 60);
    assert.equal(stragglers.active, false);
    assert.equal(log.length, 0);

    // Spawns finish, 1 normal + 1 boss alive (total 2 <= threshold): activates for ONLY normal1.
    rounds.remainingToSpawn = 0;
    zombies.zombies = [normal1, boss];
    for (let i = 0; i < Math.ceil(feel.stragglers.delaySeconds * 60) + 2; i++) stragglers.update(1 / 60);
    assert.equal(stragglers.active, true);
    assert.deepEqual(stragglers.targets, [normal1]);
    assert.deepEqual(log.at(-1), ['on', [normal1], true]);

    // If count rises above threshold (3 alive), clears immediately.
    zombies.zombies = [normal1, normal2, boss];
    stragglers.update(1 / 60);
    assert.equal(stragglers.active, false);
    assert.deepEqual(log.at(-1), ['off', 'aboveThreshold']);

    // Drop back to [normal1, boss], let it re-activate (firstTime false).
    normal2.isAlive = false;
    zombies.zombies = [normal1, boss];
    for (let i = 0; i < Math.ceil(feel.stragglers.delaySeconds * 60) + 2; i++) stragglers.update(1 / 60);
    assert.equal(stragglers.active, true);
    assert.deepEqual(log.at(-1), ['on', [normal1], false]);

    // Kill the normal zombie leaving only the boss -> clears with bossOnly (boss has a health bar).
    normal1.isAlive = false;
    events.emit('kill', { zombie: normal1 });
    stragglers.update(1 / 60);
    assert.equal(stragglers.active, false);
    assert.deepEqual(log.at(-1), ['off', 'bossOnly']);

    // Turning off the Comfort setting disables & clears while active.
    normal1.isAlive = true;
    zombies.zombies = [normal1];
    for (let i = 0; i < Math.ceil(feel.stragglers.delaySeconds * 60) + 2; i++) stragglers.update(1 / 60);
    assert.equal(stragglers.active, true);
    feel.stragglers.enabled = false;
    stragglers.update(1 / 60);
    assert.equal(stragglers.active, false);
    assert.deepEqual(log.at(-1), ['off', 'disabled']);
  } finally {
    feel.stragglers.enabled = prevEnabled;
  }
});

test('zombieRim straggler highlight shares one shader program, one overlay material, and removes overlays cleanly', () => {
  const makeZombieRoot = () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat);
    root.add(mesh);
    applyZombieRim(root, { id: 'shopper' });
    return { root, mat, mesh };
  };
  const a = makeZombieRoot();
  const b = makeZombieRoot();

  syncStragglerHighlights([a.root, b.root]);
  assert.equal(a.mat.userData.rim.straggler.value, 1);
  assert.equal(b.mat.userData.rim.straggler.value, 1);
  assert.equal(a.mat.customProgramCacheKey(), 'zombieRim');

  const aOverlays = a.mesh.children.filter((c) => c.userData?.stragglerOverlay);
  const bOverlays = b.mesh.children.filter((c) => c.userData?.stragglerOverlay);
  assert.equal(aOverlays.length, 1);
  assert.equal(bOverlays.length, 1);
  assert.equal(aOverlays[0].material, bOverlays[0].material, 'shares one through-wall material');
  assert.equal(aOverlays[0].material.depthFunc, THREE.GreaterDepth);

  syncStragglerHighlights([]);
  assert.equal(a.mat.userData.rim.straggler.value, 0);
  assert.equal(b.mat.userData.rim.straggler.value, 0);
  assert.equal(a.mesh.children.filter((c) => c.userData?.stragglerOverlay).length, 0);
  assert.equal(b.mesh.children.filter((c) => c.userData?.stragglerOverlay).length, 0);
});
