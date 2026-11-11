import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dt, headlessGame } from './helpers/headlessGame.js';
import { bossTypes } from '../src/config/bosses.js';
import { zombieTypes } from '../src/config/zombies.js';
import { powerUps } from '../src/config/powerUps.js';
import { workshopHearts, workshopStuffings } from '../src/config/workshop.js';
import { feel } from '../src/config/feel.js';
import { seededRandom } from '../src/world/textures.js';

const cfg = bossTypes.janitor;
const vector = (x, y, z) => new THREE.Vector3(x, y, z);
const teleport = (g, position) => g.player.teleport({ position, yaw: 0 });

function fixture(t) {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  const { g } = game;
  g.rounds.jumpTo(6);
  g.rounds.update = () => {};
  g.health.invulnerable = true;
  game.tick();
  t.after(() => { g.resetRun(); g.map.dispose(); });
  return { ...game, scene };
}

function summon(g, position = vector(0, 0, 9)) {
  assert.match(g.debug.run('summonBoss'), /^Summoned/);
  const boss = g.bosses.active;
  boss.position.copy(position);
  boss.prevPosition.copy(position);
  boss.setState('chasing');
  boss.updateHitboxes();
  return boss;
}

test('the mop swing has a longer wind-up and deals 60 only when it lands in reach', (t) => {
  const { g, tick } = fixture(t);
  assert.ok(cfg.radius <= zombieTypes.cartPusher.radius);
  assert.ok(cfg.attack.minWindupSeconds > zombieTypes.shopper.attack.windupSeconds);
  const boss = summon(g, vector(0, 0, 10.6));
  boss.speed = 0;
  boss.yaw = Math.PI;
  g.health.invulnerable = false;
  const hits = [];
  g.events.on('playerHit', ({ damage, zombie }) => { if (zombie === boss) hits.push(damage); });
  tick();
  assert.equal(boss.state, 'windup');
  tick(Math.ceil(boss.windupSeconds / dt) - 1);
  assert.deepEqual(hits, []);
  tick(2);
  assert.deepEqual(hits, [60]);
  assert.equal(boss.slot, null);
});

test('wet floor caps and expires, slows a grounded player, ignores other zombies, and mops Spill Cleanup', (t) => {
  const { g, scene, tick, input } = fixture(t);
  g.map.areaUnlocks.openAll();
  tick(100);
  const boss = summon(g, vector(0, 0, 9));
  boss.speed = 0;
  const phases = [];
  g.events.on('bossPhase', ({ phase }) => phases.push(phase));
  tick(2);
  assert.deepEqual(phases, ['wetFloor']);
  const first = g.bosses.patches[0];
  assert.ok(first.mesh.parent);
  assert.ok(!g.colliders.includes(first.mesh));

  assert.ok(g.powerUps.debugDrop('spillCleanup'));
  g.powerUps.update(dt);
  const spill = g.powerUps.effects.find(effect => effect.id === 'spillCleanup');
  assert.ok(spill);
  boss.position.copy(spill.position);
  g.bosses.update(dt);
  assert.ok(!g.powerUps.effects.some(effect => effect.id === 'spillCleanup'));

  teleport(g, first.position);
  boss.position.set(0, 0, 14);
  tick(2);
  assert.equal(g.stats.surfaceSpeed, cfg.wetFloor.speedFraction);
  input.held.add('KeyA');
  tick(12);
  input.held.delete('KeyA');
  assert.ok(Math.hypot(g.player.velocity.x, g.player.velocity.z) > 0);
  assert.ok(Math.hypot(g.player.velocity.x, g.player.velocity.z) < g.stats.walkSpeed);
  const shopper = g.zombies.spawn('shopper', first.position.clone().add(vector(0.4, 0, 0)));
  shopper.setState('chasing');
  tick(2);
  assert.equal(shopper.slowFraction, 1);
  shopper.takeHit({ damage: shopper.health, part: 'body', source: 'hazard' });
  g.player.position.y += 0.5;
  g.bosses.update(dt);
  assert.equal(g.stats.surfaceSpeed, 1, 'the slowdown does not reach above the floor');

  // Move the boss along clear parts of the main hallway so placement, cap and
  // disposal are exercised without relying on the player's route choices.
  for (const x of [-16, -13, -10, -7, -4, -1, 3, 6, 9, 12, 15, 18]) {
    boss.position.set(x, 0, 2);
    g.bosses.update(dt);
  }
  assert.equal(g.bosses.patches.length, cfg.wetFloor.maxPatches);
  assert.equal(first.mesh.parent, null, 'the oldest puddle was replaced');
  const owned = scene.getObjectByName('janitorWetFloor');
  assert.equal(owned.children.length, cfg.wetFloor.maxPatches);
  g.bosses.update(cfg.wetFloor.seconds + dt);
  assert.equal(owned.children.length, 0);
  assert.deepEqual(phases, ['wetFloor']);
});

test('Antifreeze cannot shatter the Janitor based on his resisted slow', (t) => {
  const { g, input, tick, press } = fixture(t);
  const boss = summon(g, vector(0, 0, 8.5));
  boss.speed = 0;
  boss.applySlow(10, powerUps.types.spillCleanup.slowFraction);
  const id = g.gun.def.id;
  g.gun.setMods(id, [{ id: 'build', build: { stuffing: 'antifreeze', heart: 'headshot', quality: 'understuffed', kills: 0 } }]);
  const chill = workshopStuffings.antifreeze.chill;
  const hits = [];
  g.events.on('buildFired', ({ hit }) => hits.push(hit));
  const aim = () => {
    g.player.yaw = 0;
    g.player.pitch = Math.atan2((cfg.hitbox.headTop + cfg.hitbox.headBottom) / 2 - g.player.eyeHeight, 12 - boss.position.z);
  };
  input.held.add('Mouse2');
  tick(35);
  aim();
  const before = boss.health;
  press('Mouse0');
  tick(Math.ceil(workshopHearts.headshot.cooldownSeconds / dt) + 10);
  const first = before - boss.health;
  aim();
  const next = boss.health;
  press('Mouse0');
  tick(3);
  assert.equal(hits.length, 2);
  assert.ok(hits.every(hit => hit.includes(boss)));
  assert.equal(next - boss.health, first, 'both shots deal normal gun damage without a shatter');
  assert.ok(boss.slowFraction >= 1 - (1 - Math.min(chill.fraction, powerUps.types.spillCleanup.slowFraction)) * cfg.slowStrength);
});

test('death, Play again and debug skips clean up the actor, HUD and floor effects', (t) => {
  const { g, hud, scene, tick } = fixture(t);
  for (const [state, end] of [['spawning', 'death'], ['chasing', 'death'], ['windup', 'reset'], ['swing', 'skip']]) {
    g.rounds.jumpTo(6);
    tick();
    const boss = summon(g);
    tick(2);
    assert.ok(g.bosses.patches.length);
    boss.setState(state);
    if (end === 'death') {
      g.health.invulnerable = false;
      g.health.takeDamage(g.stats.maxHealth);
      assert.equal(g.death.summary.bossesDefeated, 0);
    }
    if (end === 'reset') g.resetRun();
    if (end === 'skip') g.debug.run('nextRound');
    assert.equal(g.bosses.active, null);
    assert.equal(scene.getObjectByName('janitorWetFloor'), undefined);
    assert.equal(boss.model.root.parent, null);
    assert.ok(!g.shootables.includes(boss));
    assert.equal(g.stats.surfaceSpeed, 1);
    assert.equal(hud.calls.findLast(([method]) => method === 'setBoss')[1], null);
    assert.equal(g.runStats.bossesDefeated, 0);
    g.resetRun();
    g.health.invulnerable = true;
  }
});

test('the Janitor walks from every open mall zone, including upstairs and the parking lot', (t) => {
  const { g, tick } = fixture(t);
  t.mock.method(Math, 'random', seededRandom(733));
  g.map.areaUnlocks.openAll();
  tick(120);
  const target = vector(0, 0, 12);
  const zones = [...new Set(g.map.spawnPoints.map(({ zone }) => zone))];
  const arrive = (boss, destination, label) => {
    teleport(g, destination);
    tick();
    let arrived = false;
    for (let i = 0; i < 60 * 85 && !arrived; i++) {
      const last = boss.position.clone();
      tick();
      assert.ok(last.distanceTo(boss.position) < 0.8, `${label}: no rescue teleport`);
      arrived = boss.position.distanceTo(destination) < 1.6 && Math.abs(boss.position.y - destination.y) < 0.15;
    }
    assert.ok(arrived, `${label} ended at ${boss.position.toArray()}`);
  };
  for (const zone of zones) {
    const source = g.map.spawnPoints.find(point => point.zone === zone).position;
    const boss = g.zombies.spawn('janitor', source);
    boss.position.copy(source);
    boss.prevPosition.copy(source);
    boss.setState('chasing');
    arrive(boss, target, zone);
    g.zombies.clearBosses();
  }
  const workshop = g.map.levelTwo.workshop.position;
  const boss = g.zombies.spawn('janitor', vector(workshop.x, 0, workshop.z));
  boss.setState('chasing');
  arrive(boss, workshop, 'workshop');
  assert.ok(g.player.position.y > feel.movement.stepTolerance);
});
