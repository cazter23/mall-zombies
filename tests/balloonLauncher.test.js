// The Balloon Launcher (config/weapons.js balloonLauncher: claw-only, homing balloons that pop), in the real headless game through real input. Homing
// itself has its own tests (ballistics.test.js) and so does the pop (blast.test.js); this checks the gun: no wall sells it, one pull is one balloon and
// one shot, THE ROLE (fired well wide of a zombie it still finds it, where the same shot from the Bottle Rocket Bazooka misses), the pop never hurts
// you, and Play again leaves no balloon in the air.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { clawMachine } from '../src/config/clawMachine.js';
import { buildWallBuy } from '../src/game/features/wallBuy.js';

const bl = weapons.balloonLauncher;
const FLIGHT_TICKS = Math.ceil(bl.flight.lifeSeconds / dt) + 5;
const DEG = Math.PI / 180;

// In the Main Hallway at (-17, 4), facing +x (the lane along z 4 is clear for 39 m), with `def` in hand.
function setup(def = bl, x = -17, yaw = -Math.PI / 2) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(x, 0, 4), yaw });
  g.gun.give(def);
  t.tick(60);
  const blasts = [];
  g.events.on('gunBlast', (b) => blasts.push(b));
  const spawn = (px, pz) => g.zombies.spawn('shopper', new THREE.Vector3(px, 0, pz));
  const freeze = (zs) => { t.tick(2); for (const z of zs) { z.speed = 0; z.attackCooldown = 99; z.velocity.set(0, 0, 0); z.health = 1e6; } t.tick(30); };
  const fire = () => { g.gun.weapon.magazine = Math.max(1, g.gun.weapon.magazine); g.gun.weapon.cooldown = 0; t.press('Mouse0'); };
  return { t, g, blasts, spawn, freeze, fire };
}

test('claw-only: flagged, no wall price, the wall-buy feature refuses it, and it is in the GRAB-A-GUN pool', () => {
  assert.equal(bl.clawOnly, true);
  assert.equal(economy.wallBuys.balloonLauncher, undefined);
  const added = [];
  const ctx = { scene: { add: () => added.push('scene') }, map: { zones: {} }, gun: { owns: () => false }, pricing: {}, interactions: { add: () => added.push('interaction') } };
  assert.equal(buildWallBuy({ weapon: 'balloonLauncher', zone: 'hallway', position: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) }, ctx), null);
  assert.deepEqual(added, []);
  assert.ok(clawMachine.prizes.balloonLauncher?.weight > 0, 'the claw machine is the only way to it');
});

test('one pull = one balloon and one shot; it drifts slowly, and with nothing to find it pops in the air at the end of its life without hurting you', () => {
  const { t, g, blasts, fire } = setup();
  fire();
  assert.equal(g.gun.weapon.magazine, bl.magazineSize - 1);
  assert.equal(g.rockets.list.length, 1, 'a balloon in the air');
  assert.equal(g.runStats.shotsFired, 1);
  assert.ok(t.sounds.includes('balloonLaunch'));
  t.tick(Math.round(1 / dt));
  const flown = g.rockets.list[0].position.distanceTo(new THREE.Vector3(-17, 1.6, 4));
  assert.ok(flown > 0.6 * bl.flight.speed && flown < 1.1 * bl.flight.speed, `about ${bl.flight.speed} m in a second (${flown.toFixed(1)})`);
  t.tick(FLIGHT_TICKS);
  assert.equal(g.rockets.list.length, 0);
  assert.equal(blasts.length, 1);
  assert.equal(blasts[0].hits.length, 0);
  assert.equal(g.stats.health, g.stats.maxHealth);
});

test('THE ROLE: fired 35 degrees wide of a zombie, a balloon turns, finds it and pops on it (+10); the Bottle Rocket Bazooka fired the same way misses', () => {
  const result = (def) => {
    const { t, g, blasts, spawn, freeze, fire } = setup(def);
    const z = spawn(-17 + 7 * Math.cos(35 * DEG), 4 - 7 * Math.sin(35 * DEG)); // 7 m away, 35 degrees to the right of where you face
    freeze([z]);
    const hits = [];
    g.events.on('hit', (h) => hits.push(h));
    fire();
    t.tick(FLIGHT_TICKS);
    return { damage: 1e6 - z.health, hits: hits.length, blasts: blasts.length };
  };
  const balloon = result(bl);
  assert.ok(balloon.damage > 0.8 * bl.damage, `it found the zombie (${Math.round(balloon.damage)})`);
  assert.equal(balloon.hits, 1, 'one +10');
  const rocket = result(weapons.bottleRocket);
  assert.equal(rocket.damage, 0, 'a rocket goes where you point it');
  assert.equal(rocket.blasts, 1);
});

test('the pop never hurts you: a balloon into the wall right in front of you', () => {
  const { t, g, blasts, fire } = setup(bl, -18.5, Math.PI / 2); // facing the Hallway's west wall, 1.5 m off
  fire();
  t.tick(60);
  assert.equal(blasts.length, 1);
  assert.equal(blasts[0].selfDamage, 0);
  assert.equal(g.stats.health, g.stats.maxHealth);
});

test('Play again: no balloon left in the air', () => {
  const { g, fire } = setup();
  fire();
  assert.equal(g.rockets.list.length, 1);
  g.resetRun();
  assert.equal(g.rockets.list.length, 0);
});
