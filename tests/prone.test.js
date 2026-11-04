import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerController } from '../src/player/controller.js';
import { createPlayerStats } from '../src/player/stats.js';
import { feel } from '../src/config/feel.js';
import { overlapsSolid } from '../src/world/collision.js';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { zombieTypes } from '../src/config/zombies.js';
import { Zombie } from '../src/zombies/zombie.js';
import { createPlayerBody } from '../src/player/body.js';
import { createGamepad } from '../src/core/gamepad.js';
import { Input } from '../src/core/input.js';

const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(
  new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1),
);
function fixture() {
  const held = new Set();
  const pressed = new Set();
  const input = {
    held, pressed, axis: { x: 0, y: 0 },
    moveAxis() { return this.axis; },
    consumeAction(action) { return pressed.delete(action); },
    actionDown(action) { return held.has(action); },
    actionPressed(action) { return pressed.has(action); },
  };
  const colliders = [box(-30, -0.2, -30, 30, 0, 30)];
  const player = new PlayerController({ camera: new THREE.PerspectiveCamera(), input,
    stats: createPlayerStats(), colliders, spawn: { position: new THREE.Vector3(), yaw: 0 } });
  player.grounded = true;
  const tick = (n = 1) => { for (let i = 0; i < n; i++) player.update(dt); };
  const press = (action, n = 1) => { pressed.add(action); tick(n); };
  return { input, colliders, player, tick, press };
}

test('prone toggles, lowers smoothly with safe eye/body clearance, crawls at the stat speed, and cannot sprint', () => {
  const t = fixture();
  t.press('prone');
  assert.equal(t.player.stance, 'prone');
  assert.ok(t.player.eyeHeight < feel.player.eyeHeight && t.player.eyeHeight > feel.prone.eyeHeight);
  assert.ok(t.player.eyeHeight < t.player.height, 'eye stays inside collision during the transition');
  t.tick(60);
  assert.equal(t.player.height, feel.prone.height);
  assert.equal(t.player.eyeHeight, feel.prone.eyeHeight);
  t.player.stats.proneSpeed *= 0.8; // runtime stats, not a hardcoded crawl speed
  t.input.axis.y = 1;
  t.input.held.add('sprint');
  t.tick(60);
  assert.ok(Math.abs(Math.hypot(t.player.velocity.x, t.player.velocity.z) - t.player.stats.proneSpeed) < 1e-6);
  assert.equal(t.player.isSprinting, false);
  assert.equal(t.player.sprintMeter, t.player.stats.sprintDuration);
  const eye = new THREE.Vector3();
  t.player.getAim(eye, new THREE.Vector3());
  t.player.syncCamera(1);
  assert.ok(eye.distanceTo(t.player.camera.position) < 1e-6, 'shots come from the prone crosshair');
  t.press('prone');
  assert.equal(t.player.stance, 'stand');
});

test('a prone player crawls under a low roof, cannot stand or jump through it, then gets up after clearing it', () => {
  const t = fixture();
  t.colliders.push(box(-2, 0.7, -4, 2, 2.2, -1));
  t.press('prone', 60);
  t.input.axis.y = 1;
  t.tick(100);
  assert.ok(t.player.position.z < -1 && t.player.position.z > -4);
  t.press('jump');
  assert.equal(t.player.stance, 'prone');
  assert.equal(t.player.velocity.y, 0);
  assert.equal(t.player.jumpBuffer, 0);
  t.press('prone');
  assert.equal(t.player.stance, 'prone');
  assert.equal(overlapsSolid(t.player.position, feel.player.radius, t.player.height, t.colliders, 0), false);
  t.tick(180);
  assert.ok(t.player.position.z < -4 - feel.player.radius);
  t.input.axis.y = 0;
  t.press('jump');
  assert.equal(t.player.stance, 'stand');
  assert.equal(t.player.velocity.y, 0, 'first Space stands up without jumping');
  t.press('jump');
  assert.ok(t.player.velocity.y > 0, 'a fresh second Space jumps normally');
});

test('getting up falls back to crouch under a mid-height roof; crouch button rises only to crouch', () => {
  const t = fixture();
  t.press('prone', 60);
  t.colliders.push(box(-2, 1.3, -2, 2, 2.2, 2));
  t.press('prone');
  assert.equal(t.player.stance, 'crouch');
  assert.equal(t.player.height, feel.crouch.height);
  t.tick(30);
  assert.equal(t.player.stance, 'crouch');
  t.colliders.pop();
  t.tick(1);
  assert.equal(t.player.stance, 'stand');
  t.press('prone', 60);
  t.input.held.add('crouch');
  t.press('crouch');
  assert.equal(t.player.stance, 'crouch');
  t.tick(5);
  assert.equal(t.player.stance, 'crouch');
  t.input.held.delete('crouch');
  t.tick(1);
  assert.equal(t.player.stance, 'stand');
});

test('prone cancels slides/landing chains, cannot start airborne or during melee commitment, and never vaults', () => {
  const t = fixture();
  t.player.velocity.z = -t.player.stats.sprintSpeed;
  t.player.startSlide(0, -1);
  t.player.slideChainQueued = true;
  t.player.airborneWithMomentum = true;
  t.press('prone');
  assert.equal(t.player.stance, 'prone');
  assert.equal(t.player.slideTimer, 0);
  assert.equal(t.player.slideChainQueued, false);
  assert.equal(t.player.airborneWithMomentum, false);
  assert.ok(Math.hypot(t.player.velocity.x, t.player.velocity.z) <= t.player.stats.proneSpeed);
  assert.equal(t.player.vault.tryStart(), false);
  t.player.teleport(t.player.spawn);
  t.player.grounded = true;
  t.press('jump');
  t.press('prone');
  assert.equal(t.player.stance, 'stand', 'airborne press is ignored rather than queuing a dive');
  t.player.teleport(t.player.spawn);
  t.player.grounded = true;
  t.player.meleeBusy = true;
  t.player.meleeCommitted = true;
  t.press('prone');
  assert.equal(t.player.stance, 'stand');
});

test('real keyboard/controller prone actions work; firing/reloading still work; Play again restores standing and prone stats', () => {
  for (const code of ['ControlLeft', 'PadLB']) {
    const t = headlessGame();
    t.tick(1);
    t.g.rounds.update = () => {};
    t.g.zombies.clear();
    t.press(code, 60);
    assert.equal(t.g.player.stance, 'prone', code);
    const weapon = t.g.gun.weapon;
    const before = weapon.magazine;
    t.press('Mouse0');
    assert.equal(weapon.magazine, before - 1, 'prone can fire normally');
    t.press('KeyR', 180);
    assert.equal(weapon.magazine, before, 'prone can finish reloading');
    t.g.stats.proneSpeed = 0.5;
    t.g.resetRun();
    assert.equal(t.g.player.stance, 'stand');
    assert.equal(t.g.player.height, feel.player.height);
    assert.equal(t.g.player.eyeHeight, feel.player.eyeHeight);
    assert.equal(t.g.stats.proneSpeed, feel.prone.speed);
  }
});

test('both zombie types can still hit a prone player in reach on open floor', () => {
  const t = fixture();
  t.press('prone', 60);
  for (const type of Object.values(zombieTypes)) {
    const zombie = new Zombie({ type, position: new THREE.Vector3(0, 0, -0.7), yaw: Math.PI,
      health: 150, speed: type.speed, round: 1 });
    assert.equal(zombie.canHit(t.player), true);
    assert.equal(zombie.wallBetween(t.player, t.colliders), false);
  }
});

test('a real chasing zombie still damages a prone player; prone melee does not launch a lunge', () => {
  const t = headlessGame();
  t.tick(1);
  t.g.rounds.update = () => {};
  t.g.zombies.clear();
  t.press('ControlLeft', 60);
  const z = t.g.zombies.spawn('shopper', t.g.player.position.clone().add(new THREE.Vector3(0, 0, -1.8)));
  z.health = 10_000; // survive the melee strike so the later damage check tests a live attacker
  const chaseSpeed = z.speed;
  z.setState('chasing');
  z.speed = 0;
  z.yaw = Math.PI;
  z.updateHitboxes();
  t.press('KeyV');
  assert.equal(t.g.player.lungeTimer, 0);
  assert.equal(t.g.melee.phase, 'windup');
  z.position.copy(t.g.player.position).add(new THREE.Vector3(0, 0, -0.8));
  z.speed = chaseSpeed;
  z.updateHitboxes();
  t.tick(180);
  assert.ok(t.g.stats.health < t.g.stats.maxHealth, 'height change must not grant immunity');
});

test('controller prone cancels latched sprint so getting up does not silently resume it', () => {
  const saved = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
  const pad = { connected: true, id: 'Xbox', axes: [0, -1, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  try {
    const input = new Input({});
    const gamepad = createGamepad(input);
    pad.buttons[10] = { pressed: true, value: 1 }; // L3: click sprint
    gamepad.poll();
    assert.equal(input.actionDown('sprint'), true);
    input.endTick();
    pad.buttons[10] = { pressed: false, value: 0 };
    pad.buttons[4] = { pressed: true, value: 1 }; // LB: prone
    gamepad.poll();
    assert.equal(input.actionPressed('prone'), true);
    assert.equal(input.actionDown('sprint'), false);
    input.endTick();
    pad.buttons[4] = { pressed: false, value: 0 };
    gamepad.poll();
    assert.equal(input.actionDown('sprint'), false, 'still holding forward does not relatch sprint');
  } finally {
    if (saved) Object.defineProperty(navigator, 'getGamepads', saved);
    else delete navigator.getGamepads;
  }
});

test('the prone body stays above the floor and below its clearance, trailing behind the view; standing restores the pose', () => {
  const t = fixture();
  const scene = new THREE.Scene();
  const body = createPlayerBody(scene);
  t.press('prone', 60);
  for (let i = 0; i < 60; i++) body.update(dt, t.player, 1);
  const bounds = new THREE.Box3().setFromObject(body.root);
  assert.ok(bounds.min.y >= -1e-6, `body must not sink through floor: ${bounds.min.y}`);
  assert.ok(bounds.max.y < feel.prone.height, `body must not poke through cover: ${bounds.max.y}`);
  assert.ok(bounds.min.z > t.player.position.z, 'legs lie behind the eye instead of filling the crosshair');
  for (const node of body.root.children) assert.ok(node.matrixWorld.elements.every(Number.isFinite));
  t.press('prone', 60);
  for (let i = 0; i < 60; i++) body.update(dt, t.player, 1);
  const standing = new THREE.Box3().setFromObject(body.root);
  assert.ok(standing.max.y > feel.prone.height);
  assert.equal(body.root.children[0].rotation.x, 0, 'standing torso is upright again');
});

test('the complete employee model stays camera-safe and the sprint pose blends back to idle', () => {
  const { player } = fixture();
  const body = createPlayerBody(new THREE.Scene());
  const head = body.root.getObjectByName('playerHead');
  const chest = body.root.getObjectByName('playerChest');
  const torso = body.root.getObjectByName('playerUpperBody');
  player.grounded = true;
  player.isSprinting = true;
  player.velocity.z = -player.stats.sprintSpeed;
  for (let i = 0; i < 30; i++) body.update(dt, player, 1);
  assert.ok(torso.rotation.x < -.1, 'torso leans into a steady sprint');
  assert.equal(chest.visible, true);
  assert.equal(head.visible, false, 'the face stays outside the first-person render');
  body.update(dt, player, 1, { firstPerson: false });
  assert.equal(head.visible, true);

  player.isSprinting = false;
  player.velocity.set(0, 0, 0);
  for (let i = 0; i < 60; i++) body.update(dt, player, 1);
  assert.ok(Math.abs(torso.rotation.x) < .001);
  assert.equal(head.visible, false);
});
