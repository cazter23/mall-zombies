import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { Zombie } from '../src/zombies/zombie.js';
import { zombieTypes } from '../src/config/zombies.js';
import { economy, zombieHealthFor, zombieHealthForRound, zombieTypeForRound, zombieCountForRound } from '../src/config/economy.js';
import { isObserved } from '../src/zombies/observation.js';
import { createRounds } from '../src/game/rounds.js';

function fixture() {
  const t = headlessGame(); t.tick();
  const { g } = t; g.rounds.update = () => {}; g.zombies.clear(); g.health.invulnerable = true;
  g.player.teleport({ position: new THREE.Vector3(0, 0, 12), yaw: 0 });
  const z = g.zombies.spawn('mannequin', new THREE.Vector3(0, 0, 9));
  z.setState('chasing'); z.yaw = Math.PI; z.prevYaw = Math.PI;
  return { ...t, z };
}

test('observation uses view edges, pitch, aspect and either visible body sample; walls block it, ADS does not release it', () => {
  const { g, z } = fixture();
  g.player.camera.aspect = 16 / 9;
  assert.equal(isObserved(z, g.player, g.colliders), true);
  g.player.camera.fov = 20; g.player.isAiming = true;
  assert.equal(isObserved(z, g.player, g.colliders), true);
  g.player.yaw = Math.PI;
  assert.equal(isObserved(z, g.player, g.colliders), false);
  g.player.yaw = 0; g.player.pitch = -Math.PI / 2 + .01;
  assert.equal(isObserved(z, g.player, g.colliders), false);
  g.player.pitch = 0;
  const wall = new THREE.Box3(new THREE.Vector3(-2, 0, 10), new THREE.Vector3(2, 3, 10.3));
  assert.equal(isObserved(z, g.player, [wall]), false);
  wall.max.y = 1.3;
  assert.equal(isObserved(z, g.player, [wall]), true, 'head can see over a low obstruction');
  z.position.set(6, 0, 9);
  assert.equal(isObserved(z, g.player, []), false);
  z.position.set(3, 0, 9);
  assert.equal(isObserved(z, g.player, []), true, 'visible near the wide-screen edge');
  g.player.camera.aspect = .6;
  assert.equal(isObserved(z, g.player, []), false, 'portrait screen has a narrower horizontal view');
  g.map.dispose();
});

test('watching freezes movement and attacks; looking away waits, clicks, and starts a fresh attack', () => {
  const { g, z, tick, sounds } = fixture();
  z.position.z = 10.8; z.prevPosition.copy(z.position); z.speed = 0;
  g.health.invulnerable = false;
  const before = g.stats.health;
  tick(120); assert.equal(z.frozen, true); assert.equal(z.position.z, 10.8);
  assert.equal(g.stats.health, before);
  g.player.yaw = Math.PI;
  tick(10); assert.equal(z.frozen, true);
  tick(12); assert.equal(z.frozen, false); assert.equal(z.state, 'windup');
  assert.ok(sounds.includes('mannequinClick'));
  g.player.yaw = 0; tick(); assert.equal(z.state, 'chasing');
  g.player.yaw = Math.PI; tick(20);
  assert.equal(z.state, 'windup'); assert.ok(z.stateTime < .1, 'no stored attack progress');
  tick(32); assert.ok(g.stats.health < before, 'unwatched attack damages the player');
  g.map.dispose();
});

test('frozen mannequins resist crowd shoves and rescue, stay shootable, die normally and reset', () => {
  const { g, z, tick } = fixture();
  z.position.z = 6.8; z.prevPosition.copy(z.position); tick();
  const position = z.position.clone();
  const shopper = g.zombies.spawn('shopper', position.clone().add(new THREE.Vector3(.2, 0, 0)));
  shopper.setState('chasing');
  tick(660);
  assert.equal(z.state, 'chasing'); assert.ok(z.frozen);
  assert.ok(z.position.distanceTo(position) < .001, 'crowd does not push it and failsafe does not relocate it');
  assert.ok(shopper.position.distanceTo(z.position) > .5);
  const points = g.wallet.points;
  z.takeHit(100000, 'head');
  assert.equal(z.isAlive, false); assert.ok(g.wallet.points > points);
  tick(400); assert.ok(!g.zombies.zombies.includes(z));
  g.resetRun(); assert.equal(g.zombies.aliveCount, 0); g.map.dispose();
});

test('round 8 introduces mannequins, their health scales, and the live cap substitutes a Shopper', () => {
  assert.equal(zombieHealthFor('mannequin', 8), Math.round(zombieHealthForRound(8) * .8));
  for (let i = 0; i < 100; i++) assert.notEqual(zombieTypeForRound(7, i / 100), 'mannequin');
  assert.equal(zombieTypeForRound(8, .36), 'mannequin');
  assert.equal(zombieTypeForRound(12, .51), 'mannequin');
  const { g, z } = fixture();
  const second = g.zombies.spawn('mannequin', new THREE.Vector3(2, 0, 9));
  const third = g.zombies.spawn('mannequin', new THREE.Vector3(-2, 0, 9));
  assert.equal(second.type.id, 'mannequin'); assert.equal(third.type.id, 'shopper');
  z.takeHit(100000, 'body');
  assert.equal(g.zombies.spawn('mannequin', new THREE.Vector3(1, 0, 9)).type.id, 'mannequin');
  const spawns = [], intros = [];
  const rounds = createRounds({ zombies: { aliveCount: 0, clear() {}, spawn(id) { spawns.push(id); return { type: zombieTypes[id] }; } },
    onTypeIntro: id => intros.push(id) });
  rounds.jumpTo(8);
  for (let i = 0; i < 20000 && rounds.round === 8; i++) rounds.update(1 / 60);
  assert.equal(spawns.length, zombieCountForRound(8));
  assert.equal(intros.filter(id => id === 'mannequin').length, 1);
  g.map.dispose();
});

test('plastic model preserves frozen limb transforms, animates death and releases its resources', () => {
  const z = new Zombie({ type: zombieTypes.mannequin, health: 100, position: new THREE.Vector3(), yaw: 0 });
  z.setState('chasing'); z.velocity.z = 5;
  z.model.update(.1, z, 1);
  const rotations = []; z.model.root.traverse(o => rotations.push(o.rotation.toArray()));
  z.frozen = true; z.model.update(1, z, 1);
  const frozen = []; z.model.root.traverse(o => frozen.push(o.rotation.toArray()));
  assert.deepEqual(frozen, rotations);
  z.takeHit(1000, 'body'); z.stateTime = .3; z.model.update(.1, z, 1);
  assert.notEqual(z.model.root.children[0].rotation.z, 0);
  let disposed = 0; z.model.root.children[0].children.find(o => o.isMesh).geometry.addEventListener('dispose', () => disposed++);
  z.model.dispose(); assert.equal(disposed, 1);
});

test('an unwatched mannequin traverses the real cinema stairs and pause freezes its release delay', () => {
  const { g, tick } = fixture();
  g.zombies.clear(); g.map.areaUnlocks.openAll(); tick(120);
  const target = new THREE.Vector3(-39, 6.3, -7.2);
  g.player.teleport({ position: target, yaw: -Math.PI / 2 });
  const z = g.zombies.spawn('mannequin', new THREE.Vector3(-21.8, 0, 2));
  z.setState('chasing');
  let climbed = false, arrived = false;
  for (let i = 0; i < 3600 && !arrived; i++) {
    const before = z.position.clone();
    g.player.teleport({ position: target, yaw: -Math.PI / 2 }); tick();
    assert.ok(z.position.distanceTo(before) < .7, 'no rescue teleport');
    climbed ||= z.position.y > 1 && z.position.y < 5;
    arrived = Math.abs(z.position.y - target.y) < .1 && z.position.distanceTo(target) < 2;
  }
  assert.ok(climbed && arrived, `stairs route ended at ${z.position.toArray()}`);
  g.player.yaw = Math.PI / 2; tick(); assert.ok(z.frozen);
  g.player.yaw = -Math.PI / 2; tick(5);
  const hold = z.observationHold;
  g.state.forceRun = false;
  tick(90); assert.equal(z.observationHold, hold);
  g.map.dispose();
});
