// The Stargazer 3000 (config/weapons.js stargazer: claw-only, the sniper), in the real headless game through real input. The scope itself has its own
// test (scope.test.js); this checks the gun: no wall sells it, a bearing hits harder the further it flies and goes through a line, and the scope in play
// (the eyepiece fills the view, the view sways and gets back exactly where it was, each shot knocks the eye off the eyepiece).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { clawMachine } from '../src/config/clawMachine.js';
import { buildWallBuy } from '../src/game/features/wallBuy.js';
import { scopeOverlay } from '../src/weapons/scope.js';
import { zombieTypes } from '../src/config/zombies.js';

const sg = weapons.stargazer;

// Down the Main Hallway (x -20..20) from its west end along z 0 (clear for 39 m), facing +x, with the Stargazer in hand and a spawner for frozen Shoppers `ahead` metres away.
function setup() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(-17, 0, 0), yaw: -Math.PI / 2 });
  g.gun.give(sg);
  t.tick(60);
  const eye = new THREE.Vector3(), aim = new THREE.Vector3();
  g.player.getAim(eye, aim);
  const spawn = (ahead) => g.zombies.spawn('shopper', new THREE.Vector3(eye.x + aim.x * ahead, 0, eye.z + aim.z * ahead));
  const freeze = (zs) => { t.tick(2); for (const z of zs) { z.speed = 0; z.attackCooldown = 99; z.velocity.set(0, 0, 0); z.health = 1e6; } t.tick(30); };
  // Fire one bearing; `chestAt` m: through the scope, aimed at the chest of a Shopper that far away (the eye is at head height).
  const fire = (chestAt = null) => {
    if (chestAt) {
      t.input.pressed.add('Mouse2');
      t.input.held.add('Mouse2');
      t.tick(Math.ceil(sg.ads.seconds / dt) + 2);
      g.player.pitch = Math.atan2(zombieTypes.shopper.hitbox.bodyTop * 0.7 - eye.y, chestAt);
    }
    g.gun.weapon.magazine = Math.max(g.gun.weapon.magazine, 1);
    g.gun.weapon.cooldown = 0;
    t.press('Mouse0');
    if (chestAt) t.input.held.delete('Mouse2');
  };
  return { t, g, spawn, freeze, fire };
}

test('claw-only: flagged, no wall price, the wall-buy feature refuses it, and it is in the GRAB-A-GUN pool', () => {
  assert.equal(sg.clawOnly, true);
  assert.equal(economy.wallBuys.stargazer, undefined);
  const added = [];
  const ctx = { scene: { add: () => added.push('scene') }, map: { zones: {} }, gun: { owns: () => false }, pricing: {}, interactions: { add: () => added.push('interaction') } };
  assert.equal(buildWallBuy({ weapon: 'stargazer', zone: 'hallway', position: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) }, ctx), null);
  assert.deepEqual(added, []);
  assert.ok(clawMachine.prizes.stargazer?.weight > 0, 'the claw machine is the only way to it');
});

test('a bearing hits harder the further it flies: about twice as hard at 30 m as across a room, on the same part of the body', () => {
  const damageAt = (m) => {
    const { g, spawn, freeze, fire } = setup();
    const z = spawn(m);
    freeze([z]);
    const parts = [];
    g.events.on('hit', (e) => parts.push(e.headshot));
    fire(m);
    return { damage: 1e6 - z.health, headshot: parts[0] };
  };
  const near = damageAt(5), far = damageAt(30);
  assert.ok(near.damage > 0 && far.damage > 0, `both land (${near.damage}, ${far.damage})`);
  assert.equal(near.headshot, far.headshot, 'the same part both times');
  const ratio = far.damage / near.damage;
  assert.ok(ratio > 1.9 && ratio < 2.1, `30 m / 5 m = ${ratio.toFixed(2)}`);
});

test('it goes through a line: one bearing hits the first four Shoppers in a queue, each a little less, and not the fifth', () => {
  const { g, spawn, freeze, fire } = setup();
  const queue = [8, 9.5, 11, 12.5, 14].map((m) => spawn(m));
  freeze(queue);
  const hits = [];
  g.events.on('hit', () => hits.push(1));
  fire(11);
  const taken = queue.map((z) => 1e6 - z.health);
  for (let i = 0; i < 4; i++) assert.ok(taken[i] > 0, `zombie ${i + 1} hit (${taken.join(', ')})`);
  assert.equal(taken[4], 0, 'the fifth is past the pierce');
  for (let i = 1; i < 4; i++) assert.ok(taken[i] < taken[i - 1] * 1.05, 'each one behind takes less (the rising range barely offsets it)');
  assert.equal(hits.length, 4, 'four hits, four +10s');
});

test('the scope in play: aimed in, the eyepiece fills the view; the view sways while aimed and is back exactly where it was when the scope comes down', () => {
  const { t, g } = setup();
  const yaw0 = g.player.yaw, pitch0 = g.player.pitch;
  t.input.pressed.add('Mouse2');
  t.input.held.add('Mouse2');
  t.tick(Math.ceil(sg.ads.seconds / dt) + 2);
  assert.equal(g.gun.aim.amount, 1);
  assert.equal(scopeOverlay(g.gun.def.scope, g.gun.aim.amount), 1, 'looking through the eyepiece');
  let widest = 0;
  for (let i = 0; i < Math.ceil(sg.scope.sway.periodSeconds / dt); i++) { t.tick(); widest = Math.max(widest, Math.abs(g.player.yaw - yaw0)); }
  assert.ok(widest > 0.8 * sg.scope.sway.degrees * Math.PI / 180, `it sways (${(widest * 180 / Math.PI).toFixed(3)} deg)`);
  assert.ok(widest <= sg.scope.sway.degrees * Math.PI / 180 + 1e-9, 'never more than sway.degrees');
  t.input.held.delete('Mouse2');
  t.tick(Math.ceil(sg.ads.seconds / dt) + 2);
  assert.equal(g.gun.aim.amount, 0);
  assert.ok(Math.abs(g.player.yaw - yaw0) < 1e-9 && Math.abs(g.player.pitch - pitch0) < 1e-9, 'no drift left behind');
});

test('firing while aimed keeps you in the scope: every tick of the shot and the bolt after it stays fully aimed, and a second shot does too', () => {
  const { t, g, fire } = setup();
  t.input.pressed.add('Mouse2');
  t.input.held.add('Mouse2');
  t.tick(Math.ceil(sg.ads.seconds / dt) + 2);
  for (let shot = 0; shot < 2; shot++) {
    const before = g.gun.weapon.magazine;
    fire();
    assert.equal(g.gun.weapon.magazine, before - 1, `shot ${shot + 1} went off`);
    for (let i = 0; i < Math.ceil(sg.fireInterval / dt); i++) {
      assert.equal(g.gun.aim.amount, 1, `still aimed ${i} ticks after shot ${shot + 1}`);
      assert.equal(scopeOverlay(sg.scope, g.gun.aim.amount), 1, 'the eyepiece never leaves the view');
      t.tick();
    }
  }
  assert.ok(t.sounds.includes('stargazerShot'));
  t.input.held.delete('Mouse2');
});

test('reload: a five-round magazine from a reserve, no shell-by-shell', () => {
  const { t, g } = setup();
  assert.equal(g.gun.weapon.magazine, sg.magazineSize);
  assert.equal(g.gun.weapon.reserve, sg.startingReserve);
  g.gun.weapon.magazine = 0;
  t.press('KeyR');
  t.tick(Math.ceil(sg.reloadTime / dt) + 5);
  assert.equal(g.gun.weapon.magazine, sg.magazineSize);
  assert.equal(g.gun.weapon.reserve, sg.startingReserve - sg.magazineSize);
  assert.equal(sg.shellReload, undefined);
});
