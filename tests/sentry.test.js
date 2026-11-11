// Kiosk Kevin phase 6 (docs/kiosk-kevin-plan.md): the SPIN-O-MATIC Sentry (game/equipment/sentry.js, game/equipment.js,
// config/kiosk.js products.sentry), in the REAL game (tests/helpers/headlessGame.js). Checked: thrown with G it deploys where it
// lands and adds no collider; it shoots the nearest zombie it can see with the hitscan from its own muzzle, never through a wall,
// never Sunny, a dummy or the dead; its kills pay through 'kill' only (source 'equipment', weaponId 'sentry': no 'hit', no +10, no
// meter); bosses are hit normally; one out at a time; it falls apart after its lifetime; it stops when paused and is gone on death
// and Play again. (The save case is in tests/saveGame.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { kiosk, pickFor, stockFor } from '../src/config/kiosk.js';
import { equipmentPower } from '../src/game/equipment/equipmentDamage.js';
import { pointsForHit } from '../src/game/wallet.js';
import { hasStatNumber } from '../src/config/effectWords.js';

const sentry = kiosk.products.sentry;
const turret = sentry.turret;
const ticksFor = (seconds) => Math.ceil(seconds / dt);

// A real game in the start room (its shutter shut) at `round`, the round's own spawning and bosses switched off.
function fixture(round = 1) {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  t.standAt(0, 15, 0);
  g.rounds.jumpTo(round);
  g.rounds.update = () => {};
  g.bosses.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;
  return t;
}
// A zombie standing (all but) still at (x, z). (Not speed 0: a Mascot's pose divides by it.)
function place(t, type, x, z) {
  const zombie = t.g.zombies.spawn(type, new THREE.Vector3(x, 0, z));
  zombie.position.set(x, 0, z);
  zombie.state = 'chasing';
  zombie.speed = 1e-6;
  zombie.updateHitboxes();
  return zombie;
}
// Deploy one right there (as if it had landed there), and let it stand up.
function deployAt(t, x, z) {
  t.g.equipment.detonate('sentry', new THREE.Vector3(x, 0.16, z));
  const item = t.g.equipment.sentry;
  assert.ok(item?.deployed);
  return item;
}
// Every 'hit' and 'kill', and what the wallet and the meter said before.
function ledger(g) {
  const log = { hits: [], kills: [], points: g.wallet.points, progress: g.powerUps.progress };
  g.events.on('hit', (h) => log.hits.push(h));
  g.events.on('kill', (k) => log.kills.push(k));
  return log;
}
// What each zombie was dealt by equipment, shot by shot (before its own damage multipliers).
function spy(...zombies) {
  const shots = new Map(zombies.map((z) => [z, []]));
  for (const zombie of zombies) {
    const takeHit = zombie.takeHit.bind(zombie);
    zombie.takeHit = (hit) => {
      if (hit.source === 'equipment') shots.get(zombie).push(hit);
      return takeHit(hit);
    };
  }
  return shots;
}

test('the ticket is words only; it rotates through the Lethal slot and is never Kevin\'s Pick', () => {
  assert.ok(!hasStatNumber(sentry.detail));
  assert.equal(sentry.pocket, 'lethal');
  assert.ok(kiosk.slots[0].includes('sentry'));
  const lethal = new Set(), picks = new Set();
  for (let round = kiosk.openingRound; round < 40; round++) {
    lethal.add(stockFor(round)[0]);
    picks.add(pickFor(round));
    assert.notEqual(pickFor(round), 'sentry', `round ${round}`);
    assert.ok(stockFor(round).includes(pickFor(round)), 'the Pick is on sale');
  }
  assert.deepEqual([...lethal].sort(), ['sentry', 'sodaBomb', 'sparklerCake']);
  assert.deepEqual([...picks].sort(), ['airHorn', 'bubbleWrap', 'glitterBomb', 'sodaBomb', 'sparklerCake'], 'every other product gets its turn');
});

test('thrown with G it deploys where it lands, adds no collider, and shoots the nearest zombie it can see from its muzzle', () => {
  const t = fixture(5);
  const { g } = t;
  const colliders = g.colliders.length;
  const deployed = [];
  g.events.on('sentryDeployed', (e) => deployed.push(e));
  g.equipment.give('sentry', 1);
  t.press('KeyG', 1);
  assert.equal(g.equipment.pockets.lethal.count, 0);
  for (let i = 0; i < ticksFor(sentry.landSeconds + 1) && !g.equipment.sentry?.deployed; i++) t.tick();
  const item = g.equipment.sentry;
  assert.ok(item?.deployed, 'it stood up');
  assert.equal(deployed.length, 1);
  assert.ok(item.position.y < 0.2, 'on the floor');
  assert.ok(Math.abs(item.muzzle.y - (item.position.y + turret.muzzleHeight)) < 1e-9, 'its muzzle on its stand');
  assert.equal(g.colliders.length, colliders, 'no collider');
  // Two Shoppers in sight (back in the room: it lands by the shut start shutter): only the nearer is shot, every shot a Price Gun
  // sticker x the round's power.
  const { x, z } = item.position;
  const near = place(t, 'shopper', x + 1.5, z + 3);
  const far = place(t, 'shopper', x - 1.5, z + 7);
  near.health = near.maxHealth = 1e6; // (it never dies, so the far one never gets a turn)
  const shots = spy(near, far);
  t.tick(ticksFor(turret.warmupSeconds + turret.fireSeconds * 5));
  assert.ok(shots.get(near).length >= 5, `${shots.get(near).length} shots at the nearer`);
  assert.equal(shots.get(far).length, 0, 'none at the farther');
  for (const hit of shots.get(near)) {
    assert.ok(Math.abs(hit.damage - turret.damage * equipmentPower(5)) < 1e-9);
    assert.equal(hit.part, 'body', 'it can\'t aim: never a headshot');
    assert.equal(hit.weaponId, 'sentry');
  }
  // A zombie can walk right through it.
  near.position.copy(item.position);
  t.tick(1);
  assert.ok(Math.hypot(near.position.x - x, near.position.z - z) < 0.3, 'nothing pushed it off the stand');
});

test('it never targets Sunny, a dummy, the dead or a zombie behind a wall', () => {
  const t = fixture(5);
  const { g } = t;
  const item = deployAt(t, 0, 10);
  const fake = (extra, zc) => {
    const target = {
      ...extra, isAlive: true, position: new THREE.Vector3(0, 0, zc), struck: 0,
      hitboxes: [{ part: 'body', box: new THREE.Box3(new THREE.Vector3(-0.3, 0, zc - 0.3), new THREE.Vector3(0.3, 1.8, zc + 0.3)) }],
      takeHit() { this.struck += 1; return { killed: false }; },
    };
    g.shootables.push(target);
    return target;
  };
  const sunny = fake({ isSunny: true, noRewards: true, ignoreAimAssist: true, type: { id: 'plush', height: 1 } }, 11); // nearest of all
  const dummy = fake({}, 9); // (a test-range dummy: no type)
  const dead = place(t, 'shopper', 0.8, 11.2);
  dead.health = 0;
  dead.die();
  const behindWall = place(t, 'shopper', 0, 3); // in the Hallway, behind the shut start shutter: nearer than the one in the room
  const inRoom = place(t, 'shopper', 0, 14.2); // past Sunny: the shot goes through him to it
  inRoom.health = inRoom.maxHealth = 1e6;
  const shots = spy(behindWall, inRoom);
  t.tick(ticksFor(turret.warmupSeconds + turret.fireSeconds * 4));
  assert.equal(sunny.struck, 0, 'Sunny untouched');
  assert.equal(dummy.struck, 0, 'dummy untouched');
  assert.equal(shots.get(behindWall).length, 0, 'never through the shutter');
  assert.ok(shots.get(inRoom).length >= 4, 'the one it can see');
  assert.ok(item.lastShot?.target === inRoom);
  for (const target of [sunny, dummy]) g.shootables.splice(g.shootables.indexOf(target), 1);
});

test('its kills pay through \'kill\' only, carrying weaponId \'sentry\': no \'hit\', no +10, no meter; a boss is hit normally', () => {
  const t = fixture(1);
  const { g } = t;
  deployAt(t, 0, 10);
  const shopper = place(t, 'shopper', 0.5, 13);
  const log = ledger(g);
  for (let i = 0; i < ticksFor(5) && shopper.isAlive; i++) t.tick();
  assert.equal(shopper.isAlive, false, 'a round 1 Shopper goes down');
  assert.equal(log.kills.length, 1);
  assert.equal(log.kills[0].source, 'equipment');
  assert.equal(log.kills[0].weaponId, 'sentry');
  assert.equal(log.kills[0].headshot, false);
  assert.equal(log.hits.length, 0, 'never a \'hit\' event');
  assert.equal(g.wallet.points - log.points, pointsForHit({ target: shopper, killed: true }), 'the kill value, no +10 a shot');
  assert.equal(g.powerUps.progress, log.progress, 'no power-up credit');

  const boss = place(t, 'guard', -0.5, 13);
  assert.ok(boss.type.boss);
  const shots = spy(boss);
  t.tick(ticksFor(turret.fireSeconds * 3));
  assert.ok(shots.get(boss).length >= 2, 'it shoots the boss');
  for (const hit of shots.get(boss)) assert.ok(Math.abs(hit.damage - turret.damage * equipmentPower(1)) < 1e-9, 'full damage');
});

test('one out at a time, and after its lifetime it falls apart', () => {
  const t = fixture(5);
  const { g } = t;
  const expired = [];
  g.events.on('sentryExpired', (e) => expired.push(e));
  g.equipment.give('sentry', 2);
  t.press('KeyG', 1);
  for (let i = 0; i < ticksFor(sentry.landSeconds + 1) && !g.equipment.sentry?.deployed; i++) t.tick();
  const first = g.equipment.sentry;
  assert.ok(first?.deployed);
  t.tick(ticksFor(kiosk.throw.blockSeconds) + 1);
  t.press('KeyG', 1);
  assert.equal(g.equipment.pockets.lethal.count, 1, 'refused: the charge stays in the pocket');
  assert.equal(g.equipment.sentry, first);
  assert.equal(g.equipment.live.length, 1);
  t.tick(ticksFor(turret.lifeSeconds));
  assert.equal(g.equipment.sentry, null, 'it fell apart');
  assert.equal(expired.length, 1);
  assert.ok(first.removed);
  t.press('KeyG', 1);
  assert.equal(g.equipment.pockets.lethal.count, 0, 'now the next one can go');
  assert.ok(g.equipment.sentry);
});

test('it stops while paused, is gone on death, and Play again leaves nothing behind', () => {
  const t = fixture(5);
  const { g } = t;
  const fresh = snapshot(headlessGame().g).equipment;
  const item = deployAt(t, 0, 10);
  const shopper = place(t, 'shopper', 0.5, 13);
  shopper.health = shopper.maxHealth = 1e6;
  g.state.forceRun = false; // (paused: no pointer lock, no controller)
  const health = shopper.health, life = item.lifeLeft;
  t.tick(ticksFor(2));
  assert.equal(shopper.health, health, 'no shots while paused');
  assert.equal(item.lifeLeft, life, 'its clock stops too');
  g.state.forceRun = true;
  t.tick(ticksFor(turret.warmupSeconds + turret.fireSeconds * 2));
  assert.ok(shopper.health < health, 'and carries on');
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  t.tick(1);
  assert.equal(g.equipment.sentry, null, 'death clears it');
  const after = shopper.health;
  t.tick(ticksFor(1));
  assert.equal(shopper.health, after, 'no shots after death');
  g.resetRun();
  assert.deepEqual(snapshot(g).equipment, fresh);
});
