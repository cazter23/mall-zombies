import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerController } from '../src/player/controller.js';
import { createPlayerStats } from '../src/player/stats.js';
import { createMelee } from '../src/weapons/melee.js';
import { createPlayerGun } from '../src/weapons/playerGun.js';
import { weapons, melee as meleeDefs } from '../src/config/weapons.js';
import { feel } from '../src/config/feel.js';
import { overlapsSolid } from '../src/world/collision.js';

const dt = 1 / feel.simulation.tickRate;
const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(
  new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1),
);

function fixture() {
  const held = new Set();
  const pressed = new Set();
  const input = {
    held, pressed, axis: { x: 0, y: 1 }, device: 'keyboard',
    moveAxis() { return this.axis; },
    consumeAction(action) { const value = pressed.has(action); pressed.delete(action); return value; },
    actionDown(action) { return held.has(action); },
    actionPressed(action) { return pressed.has(action); },
  };
  const obstacle = box(-2, 0, -1.6, 2, 0.6, -1);
  obstacle.vaultable = true;
  const colliders = [box(-20, -0.2, -20, 20, 0, 20), obstacle];
  const bodies = [];
  const player = new PlayerController({
    camera: new THREE.PerspectiveCamera(), input, stats: createPlayerStats(), colliders,
    spawn: { position: new THREE.Vector3(0, 0, 0), yaw: 0 }, getBodies: () => bodies,
  });
  player.grounded = true;
  player.velocity.set(0, 0, -8);
  held.add('sprint');
  return { input, player, colliders, obstacle, bodies };
}

function finishVault(f) {
  let ticks = 0;
  while (f.player.vault.active && ticks++ < 120) {
    f.player.update(dt);
    assert.equal(overlapsSolid(f.player.position, feel.player.radius, f.player.height, f.colliders, 0, 0), false);
  }
  assert.ok(ticks < 120, 'vault must terminate');
}

test('vault preserves sprint speed, checks body clearance, and feeds a landing slide', () => {
  const f = fixture();
  f.input.pressed.add('jump');
  f.player.update(dt);
  assert.equal(f.player.vault.active, true);
  f.input.pressed.add('crouch');
  finishVault(f);
  assert.ok(f.player.position.z < f.obstacle.min.z - feel.player.radius);
  assert.equal(f.player.velocity.z, -8);
  assert.equal(f.player.grounded, true);
  f.player.update(dt);
  assert.equal(f.player.stance, 'slide');
});

test('normal jumps remain available away from a marked obstacle; slides never auto-vault', () => {
  const f = fixture();
  f.obstacle.vaultable = false;
  f.input.pressed.add('jump');
  f.player.update(dt);
  assert.equal(f.player.vault.active, false);
  assert.ok(f.player.velocity.y > 0);
  const sliding = fixture();
  sliding.player.startSlide(0, -1);
  sliding.input.pressed.add('jump');
  sliding.player.update(dt);
  assert.equal(sliding.player.vault.active, false);
  assert.equal(sliding.player.airborneWithMomentum, true);
});

test('vault rejects overheads, blocked landings, unsupported landings, and unmarked barriers', () => {
  const overhead = fixture();
  overhead.colliders.push(box(-2, 2, -3, 2, 2.3, 1));
  assert.equal(overhead.player.vault.tryStart(), false);
  const landing = fixture();
  landing.colliders.push(box(-2, 0, -3.5, 2, 3, -2));
  assert.equal(landing.player.vault.tryStart(), false);
  const pit = fixture();
  pit.colliders[0].min.z = -1.7;
  assert.equal(pit.player.vault.tryStart(), false);
  const barrier = fixture();
  barrier.obstacle.vaultable = false;
  barrier.obstacle.max.y = 3;
  assert.equal(barrier.player.vault.tryStart(), false);
});

test('vault rejects occupied landings and interrupts safely when a body moves into the path', () => {
  // A body right behind the obstacle: the vault angles a little to land beside it...
  const angled = fixture();
  angled.bodies.push({ isAlive: true, hitboxes: [{ box: box(-0.4, 0, -2.8, 0.4, 1.8, -2) }] });
  assert.equal(angled.player.vault.tryStart(), true);
  assert.notEqual(angled.player.vault.lastResult, '');
  // ...but a landing area that's blocked all the way across is refused.
  const f = fixture();
  const blocker = { isAlive: true, hitboxes: [{ box: box(-2, 0, -2.8, 2, 1.8, -2) }] };
  f.bodies.push(blocker);
  assert.equal(f.player.vault.tryStart(), false);
  f.bodies.length = 0;
  assert.equal(f.player.vault.tryStart(), true);
  f.player.update(dt);
  const lastSafe = f.player.position.clone();
  blocker.hitboxes[0].box.set(
    new THREE.Vector3(-2, 0, -3), new THREE.Vector3(2, 4, 1),
  );
  f.bodies.push(blocker);
  f.player.update(dt);
  assert.equal(f.player.vault.active, false);
  assert.deepEqual(f.player.position, lastSafe);
});

test('a crowd shove, pause, and teleport do not snap the player back onto a vault path', () => {
  const f = fixture();
  f.player.vault.tryStart();
  const beforePause = f.player.position.clone();
  const progress = f.player.vault.progress;
  f.player.freeze();
  assert.deepEqual(f.player.position, beforePause);
  assert.equal(f.player.vault.progress, progress);
  f.player.position.x += 0.1;
  f.player.update(dt);
  assert.equal(f.player.vault.active, false);
  assert.equal(f.player.position.x, 0.1);
  f.player.teleport({ position: new THREE.Vector3(5, 0, 5), yaw: 0 });
  assert.equal(f.player.vault.active, false);
  assert.equal(f.player.jumpBuffer, 0);
});

test('vaults require a sensible approach and never add horizontal speed', () => {
  for (const configure of [
    (f) => { f.obstacle.max.y = 1.3; },
    (f) => { f.obstacle.min.z = -4; },
    (f) => { f.player.yaw = Math.PI; },
    (f) => { f.player.velocity.z = -1; },
    (f) => { f.player.stance = 'crouch'; },
    (f) => { f.player.grounded = false; },
    (f) => { f.player.meleeBusy = true; },
  ]) {
    const f = fixture();
    configure(f);
    assert.equal(f.player.vault.tryStart(), false);
  }
  for (const speed of [2, 5, 8, 10.5]) {
    const f = fixture();
    f.player.velocity.z = -speed;
    if (!f.player.vault.tryStart()) continue; // a slow vault may exceed the maximum duration
    let ticks = 0;
    while (f.player.vault.active && ticks++ < 120) {
      const before = f.player.position.clone();
      f.player.update(dt);
      const distance = Math.hypot(f.player.position.x - before.x, f.player.position.z - before.z);
      assert.ok(distance <= speed * dt + 1e-9);
    }
    assert.ok(ticks < 120);
    assert.equal(Math.hypot(f.player.velocity.x, f.player.velocity.z), speed);
  }
});

test('a disappearing floor interrupts the vault instead of claiming a grounded landing', () => {
  const f = fixture();
  assert.equal(f.player.vault.tryStart(), true);
  f.player.update(dt);
  const before = f.player.position.clone();
  f.colliders.shift();
  f.player.update(dt);
  assert.equal(f.player.vault.active, false);
  assert.equal(f.player.grounded, false);
  assert.deepEqual(f.player.position, before);
});

function combat(withTarget = true) {
  const f = fixture();
  f.colliders.splice(1);
  f.player.velocity.set(0, 0, 0);
  f.input.axis.y = 0;
  f.input.held.clear();
  const target = {
    isAlive: true, hits: 0, splatColors: [0xff00ff],
    hitboxes: [{ box: box(-0.2, 0, -1, 0.2, 1.8, -0.6), part: 'body' }],
    takeHit(hit) { this.hits++; this.damage = hit.damage; return { killed: false }; },
  };
  const shootables = withTarget ? [target] : [];
  const effects = { splat() {}, tracer() {}, puff() {} };
  const hud = { showHitMarker() {} };
  const viewmodel = { fire() {}, jolt() {}, dryFire() {}, getMuzzleWorldPosition(out) { return out; } };
  const gun = createPlayerGun({
    def: weapons.stapleGun, player: f.player, stats: f.player.stats,
    input: f.input, colliders: f.colliders, shootables, effects, hud, viewmodel,
  });
  const melee = createMelee({
    def: meleeDefs.boxCutter, player: f.player, stats: f.player.stats,
    input: f.input, getWeapon: () => gun.weapon, colliders: f.colliders, shootables, effects, hud,
  });
  const tick = () => {
    f.player.update(dt);
    melee.update(dt, !gun.isSwitching);
    gun.update(dt, melee.isBusy || f.player.vault.active);
    f.input.pressed.clear();
  };
  return { ...f, target, shootables, gun, melee, tick };
}

test('melee commits through impact, cancels reload, blocks jump/slide, then frees movement', () => {
  const f = combat();
  f.gun.weapon.magazine--;
  f.gun.weapon.startReload();
  f.input.pressed.add('melee');
  f.tick();
  assert.equal(f.gun.weapon.isReloading, false);
  assert.equal(f.player.meleeCommitted, true);
  f.input.pressed.add('jump');
  f.input.pressed.add('crouch');
  f.input.held.add('crouch');
  f.tick();
  assert.equal(f.player.grounded, true);
  assert.equal(f.player.stance, 'stand');
  f.player.applyLook(1000, 0);
  assert.ok(Math.abs(f.player.yaw) <= meleeDefs.boxCutter.commitTurnDegrees * Math.PI / 180 + 1e-9);
  f.player.applyStickLook(-1000, 0);
  assert.ok(Math.abs(f.player.yaw) <= meleeDefs.boxCutter.commitTurnDegrees * Math.PI / 180 + 1e-9);
  while (f.melee.phase === 'windup') f.tick();
  assert.equal(f.target.hits, 1);
  assert.equal(f.target.damage, 150);
  assert.equal(f.player.meleeCommitted, false);
  f.input.held.clear();
  f.input.pressed.add('jump');
  f.tick();
  assert.ok(f.player.velocity.y > 0, 'movement comes back at impact, before weapon recovery');
});

test('melee rechecks live range and walls at impact; a miss recovers later than a hit', () => {
  function duration(f, beforeImpact = () => {}) {
    f.input.pressed.add('melee');
    f.tick();
    beforeImpact(f);
    let ticks = 0;
    while (f.melee.isBusy && ticks++ < 90) f.tick();
    assert.ok(ticks < 90);
    return ticks * dt;
  }
  const hit = combat();
  const hitSeconds = duration(hit);
  assert.equal(hit.target.hits, 1);
  assert.ok(Math.abs(hitSeconds - 0.37) < dt);
  const dodge = combat();
  const missSeconds = duration(dodge, (f) => f.target.hitboxes[0].box.translate(new THREE.Vector3(0, 0, -10)));
  assert.equal(dodge.target.hits, 0);
  assert.ok(Math.abs(missSeconds - 0.65) < dt);
  assert.ok(missSeconds > hitSeconds);
  const wall = combat();
  duration(wall, (f) => f.colliders.push(box(-1, 0, -0.55, 1, 3, -0.45)));
  assert.equal(wall.target.hits, 0);
});

test('gunfire and switching cannot cancel melee recovery or bank another slash', () => {
  const f = combat(false);
  f.gun.give(weapons.priceGun);
  for (let i = 0; i < 35; i++) f.tick();
  assert.equal(f.gun.isSwitching, false);
  f.input.pressed.add('melee');
  f.tick();
  const ammo = f.gun.weapon.magazine;
  f.input.held.add('fire');
  for (let i = 0; i < 30; i++) {
    f.input.pressed.add('melee');
    f.input.pressed.add('switchWeapon');
    f.tick();
    assert.equal(f.gun.weapon.magazine, ammo);
    assert.equal(f.gun.isSwitching, false);
  }
  f.input.held.clear();
  while (f.melee.isBusy) f.tick();
  f.tick();
  assert.equal(f.melee.isBusy, false);
  assert.equal(f.player.meleeBusy, false);
});

test('melee cannot start during weapon switching or vaulting; teleport cancels a pending hit', () => {
  const f = combat();
  f.gun.give(weapons.priceGun);
  f.input.pressed.add('melee');
  f.tick();
  assert.equal(f.melee.isBusy, false);
  while (f.gun.isSwitching) f.tick();
  f.input.pressed.add('melee');
  f.tick();
  f.player.teleport({ position: new THREE.Vector3(10, 0, 10), yaw: 0 });
  f.tick();
  assert.equal(f.melee.isBusy, false);
  assert.equal(f.target.hits, 0);
  const v = combat(false);
  const obstacle = fixture().obstacle;
  v.colliders.push(obstacle);
  v.player.velocity.set(0, 0, -8);
  v.player.vault.tryStart();
  v.input.pressed.add('melee');
  v.tick();
  assert.equal(v.melee.isBusy, false);
});

test('a melee strike cannot retarget behind the committed direction', () => {
  const f = combat();
  f.input.pressed.add('melee');
  f.tick();
  f.target.hitboxes[0].box.translate(new THREE.Vector3(0, 0, 1.8));
  f.player.yaw = Math.PI; // even an external camera change cannot redirect the slash
  while (f.melee.phase === 'windup') f.tick();
  assert.equal(f.target.hits, 0);
  assert.equal(f.melee.lastStrike, null);
});

test('a lunge preserves moving entry speed on exit and never restores collision-blocked velocity', () => {
  const f = combat();
  f.player.velocity.z = -8;
  f.player.lunge(0, -1, 9, 0.2);
  f.player.update(dt);
  f.player.stopLunge();
  assert.equal(f.player.velocity.z, -6.8);
  f.player.lunge(0, -1, 9, 0.2);
  f.player.velocity.set(0, 0, 0); // a collision has stopped the mover
  f.player.stopLunge();
  assert.equal(f.player.velocity.length(), 0);
});
