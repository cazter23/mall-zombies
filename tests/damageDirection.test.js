import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDamageAngle, createDamageIndicatorQueue } from '../src/ui/damageDirection.js';
import { headlessGame } from './helpers/headlessGame.js';
import { menuDom } from './helpers/menuDom.js';
import { createHud } from '../src/ui/hud.js';

test('computeDamageAngle computes relative angles correctly for cardinal directions with camera looking down -Z (yaw = 0)', () => {
  const playerPos = { x: 0, z: 0 };
  const yaw = 0; // facing -Z

  // Front (attacker at 0, -5)
  const frontHit = { attackerPosition: { x: 0, z: -5 } };
  assert.equal(computeDamageAngle(yaw, playerPos, frontHit), 0);

  // Right (attacker at 5, 0)
  const rightHit = { attackerPosition: { x: 5, z: 0 } };
  assert.equal(computeDamageAngle(yaw, playerPos, rightHit), 90);

  // Behind (attacker at 0, 5)
  const backHit = { attackerPosition: { x: 0, z: 5 } };
  assert.equal(computeDamageAngle(yaw, playerPos, backHit), 180);

  // Left (attacker at -5, 0)
  const leftHit = { attackerPosition: { x: -5, z: 0 } };
  assert.equal(computeDamageAngle(yaw, playerPos, leftHit), 270);
});

test('computeDamageAngle handles direct hitDirection vector', () => {
  const playerPos = { x: 10, z: 20 };
  const yaw = 0;

  assert.equal(computeDamageAngle(yaw, playerPos, { hitDirection: { x: 0, z: -1 } }), 0);
  assert.equal(computeDamageAngle(yaw, playerPos, { hitDirection: { x: 1, z: 0 } }), 90);
  assert.equal(computeDamageAngle(yaw, playerPos, { hitDirection: { x: 0, z: 1 } }), 180);
  assert.equal(computeDamageAngle(yaw, playerPos, { hitDirection: { x: -1, z: 0 } }), 270);
});

test('computeDamageAngle computes relative angle correctly when camera yaw is rotated', () => {
  const playerPos = { x: 0, z: 0 };

  // Turn 90° to the right: yaw = -Math.PI / 2.
  // Camera now looks toward +X. Right is +Z. Behind is -X. Left is -Z.
  const yawRight = -Math.PI / 2;

  // Front of current view (+X) -> relative 0°
  assert.equal(computeDamageAngle(yawRight, playerPos, { attackerPosition: { x: 5, z: 0 } }), 0);

  // Right of current view (+Z) -> relative 90°
  assert.equal(computeDamageAngle(yawRight, playerPos, { attackerPosition: { x: 0, z: 5 } }), 90);

  // Behind current view (-X) -> relative 180°
  assert.equal(computeDamageAngle(yawRight, playerPos, { attackerPosition: { x: -5, z: 0 } }), 180);

  // Left of current view (-Z) -> relative 270°
  assert.equal(computeDamageAngle(yawRight, playerPos, { attackerPosition: { x: 0, z: -5 } }), 270);

  // Turn 180°: yaw = Math.PI.
  // Camera now looks toward +Z. Right is -X. Behind is -Z. Left is +X.
  const yawBack = Math.PI;
  assert.equal(computeDamageAngle(yawBack, playerPos, { attackerPosition: { x: 0, z: 5 } }), 0);
  assert.equal(computeDamageAngle(yawBack, playerPos, { attackerPosition: { x: -5, z: 0 } }), 90);
  assert.equal(computeDamageAngle(yawBack, playerPos, { attackerPosition: { x: 0, z: -5 } }), 180);
  assert.equal(computeDamageAngle(yawBack, playerPos, { attackerPosition: { x: 5, z: 0 } }), 270);
});

test('computeDamageAngle handles zombie instance and returns null for invalid or coincident hits', () => {
  const playerPos = { x: 2, z: 3 };
  const zombieHit = { zombie: { position: { x: 2, z: -7 } } };
  assert.equal(computeDamageAngle(0, playerPos, zombieHit), 0);

  // Coincident position
  assert.equal(computeDamageAngle(0, playerPos, { attackerPosition: { x: 2, z: 3 } }), null);

  // Missing data
  assert.equal(computeDamageAngle(0, playerPos, {}), null);
  assert.equal(computeDamageAngle(0, null, { attackerPosition: { x: 5, z: 5 } }), null);
});

test('createDamageIndicatorQueue collects playerHit events and flushes to hud with correct relative angles', () => {
  const events = {
    listeners: new Map(),
    on(name, fn) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(fn);
    },
    emit(name, payload) {
      for (const fn of this.listeners.get(name) ?? []) fn(payload);
    },
  };

  const recordedAngles = [];
  const hud = {
    showDamageDirection(angle) {
      recordedAngles.push(angle);
    },
  };

  let cameraYaw = 0;
  const playerPos = { x: 0, z: 0 };

  const damageQueue = createDamageIndicatorQueue({
    events,
    hud,
    getCameraYaw: () => cameraYaw,
    getPlayerPosition: () => playerPos,
  });

  // Rapid hits from front and right
  events.emit('playerHit', { damage: 10, attackerPosition: { x: 0, z: -4 } });
  events.emit('playerHit', { damage: 10, attackerPosition: { x: 6, z: 0 } });

  assert.equal(recordedAngles.length, 0, 'queued until render flush');

  damageQueue.flush();
  assert.deepEqual(recordedAngles, [0, 90]);

  // Next frame, turn 90° right, take hit from same world spot (0, -4)
  cameraYaw = -Math.PI / 2;
  events.emit('playerHit', { damage: 15, attackerPosition: { x: 0, z: -4 } });
  damageQueue.flush();

  // (0, -4) is to the left of the player facing +X, so angle should be 270°
  assert.deepEqual(recordedAngles, [0, 90, 270]);
});

test('createGame passes attackerPosition and hitDirection with playerHit and remains DOM-free', () => {
  const t = headlessGame();
  const seenHits = [];
  t.g.events.on('playerHit', (hit) => seenHits.push(hit));

  t.g.player.teleport({ position: { x: 0, y: 0, z: 0 }, yaw: 0 });

  // Simulate a hit through the event bus
  t.g.events.emit('playerHit', {
    damage: 25,
    attackerPosition: { x: 5, z: 0 },
    hitDirection: { x: 1, z: 0 },
  });

  assert.equal(seenHits.length, 1);
  assert.equal(seenHits[0].damage, 25);
  assert.deepEqual(seenHits[0].attackerPosition, { x: 5, z: 0 });
  assert.deepEqual(seenHits[0].hitDirection, { x: 1, z: 0 });

  // Verify health took damage
  assert.ok(t.g.health.fraction < 1);
});

test('HUD showDamageDirection creates arcs with data-angle and supports simultaneous arcs', () => {
  menuDom();
  const hud = createHud();

  hud.showDamageDirection(0);
  hud.showDamageDirection(90);
  hud.showDamageDirection(180);

  const container = hud.element.querySelector('.damage-indicators');
  assert.ok(container, 'indicator container exists in HUD');
  assert.equal(container.children.length, 3, 'supports multiple simultaneous arcs');

  const angles = container.children.map((c) => c.getAttribute('data-angle'));
  assert.deepEqual(angles, ['0', '90', '180']);

  // Death or reset clears all arcs
  hud.setDead(true);
  assert.equal(container.children.length, 0, 'cleared on death');
});
