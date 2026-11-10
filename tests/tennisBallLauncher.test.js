// The Tennis Ball Launcher (config/weapons.js tennisBallLauncher: claw-only, throws a bouncing ball), in the real headless game through real input.
// The ball itself has its own test (ballistics.test.js); this checks the gun: no wall sells it, one throw is one shot, each zombie the ball touches is a
// hit that pays, and the ROLE: a lone zombie in the open is one hit a ball, a clump or a wall makes it many.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { buildWallBuy } from '../src/game/features/wallBuy.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { withAttachment, attachmentFits } from '../src/weapons/upgrades.js';
import { upgrades } from '../src/config/upgrades.js';

const launcher = weapons.tennisBallLauncher;

// The player somewhere facing a way, with the launcher in hand, and a spawner for frozen Shoppers `ahead` and `side` metres from the eye.
function setup(position = [-2, 0, 0.5], yaw = -Math.PI / 2) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(...position), yaw });
  g.gun.give(launcher);
  t.tick(60);
  const eye = new THREE.Vector3(), aim = new THREE.Vector3();
  g.player.getAim(eye, aim);
  const right = new THREE.Vector3(aim.z, 0, -aim.x);
  const spawn = (ahead, side = 0) => {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(eye.x + aim.x * ahead + right.x * side, 0, eye.z + aim.z * ahead + right.z * side));
    return z;
  };
  const freeze = (zs) => { t.tick(2); for (const z of zs) { z.speed = 0; z.attackCooldown = 99; z.velocity.set(0, 0, 0); z.health = 1e6; } t.tick(60); };
  return { t, g, spawn, freeze };
}

// Throw one ball and let it fly to its end; returns the 'hit' events it caused.
function throwBall(t, g) {
  const hits = [];
  const on = () => hits.push(1);
  g.events.on('hit', on);
  g.gun.weapon.magazine = Math.max(g.gun.weapon.magazine, 1);
  t.press('Mouse0');
  t.tick(Math.ceil(launcher.projectile.lifeSeconds / dt) + 10);
  g.events.off?.('hit', on);
  return hits.length;
}

test('claw-only: the gun is flagged, has no wall price, and the wall-buy feature refuses it', () => {
  assert.equal(launcher.clawOnly, true);
  assert.equal(economy.wallBuys.tennisBallLauncher, undefined);
  const added = [];
  const ctx = { scene: { add: () => added.push('scene') }, map: { zones: {} }, gun: { owns: () => false }, pricing: {}, interactions: { add: () => added.push('interaction') } };
  assert.equal(buildWallBuy({ weapon: 'tennisBallLauncher', zone: 'hallway', position: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) }, ctx), null);
  assert.deepEqual(added, []);
  const { g } = headlessGame();
  for (const f of g.map.features.filter((x) => x.kind === 'wallBuy')) assert.notEqual(f.weapon, 'tennisBallLauncher');
});

test('one pull = one ball and one shot (counted at the throw); the ball flies, then it is spent and gone', () => {
  const { t, g } = setup();
  const mag = g.gun.weapon.magazine;
  assert.equal(mag, launcher.magazineSize);
  t.press('Mouse0');
  assert.equal(g.gun.weapon.magazine, mag - 1);
  assert.equal(g.balls.list.length, 1, 'a ball in the air');
  assert.equal(g.runStats.shotsFired, 1, 'the throw is the shot');
  assert.equal(g.runStats.shotsHit, 0, 'and it has not hit anything yet');
  assert.ok(t.sounds.includes('tennisLaunch'));
  t.tick(Math.ceil(launcher.projectile.lifeSeconds / dt) + 10);
  assert.equal(g.balls.list.length, 0, 'spent');
});

test('a ball that reaches a zombie is a hit: its damage, the +10, a hit marker, and the throw counts as a hit once however many it touches', () => {
  const { t, g, spawn, freeze } = setup();
  const a = spawn(4), b = spawn(5.2, 0.2);
  freeze([a, b]);
  const points = g.wallet.points;
  const healths = [a.health, b.health];
  const hits = throwBall(t, g);
  assert.ok(hits >= 2, `it chained (${hits} hits)`);
  assert.equal(g.runStats.shotsHit, 1, 'one throw, one accuracy hit');
  assert.ok(a.health < healths[0] && b.health < healths[1], 'both were hit');
  assert.ok(Math.abs((healths[0] - a.health) % launcher.damage) < 1e-6 || (healths[0] - a.health) >= launcher.damage * 0.9, 'a hit is the gun\'s damage');
  assert.equal(g.wallet.points - points, hits * 10, 'each hit pays +10');
  assert.ok(t.sounds.includes('tennisBounce') && t.sounds.includes('hitBody'));
});

test('a ball that kills pays the kill, and a ball in the air when you die is gone and pays nothing', () => {
  const { t, g, spawn, freeze } = setup();
  const z = spawn(4);
  freeze([z]);
  z.health = 5;
  const kills = g.runStats.kills;
  throwBall(t, g);
  assert.equal(z.isAlive, false);
  assert.equal(g.runStats.kills, kills + 1);
  // Dead with a ball up:
  const again = spawn(4);
  freeze([again]);
  t.press('Mouse0');
  assert.equal(g.balls.list.length, 1);
  g.health.takeDamage(1e6);
  t.tick(3);
  assert.equal(g.balls.list.length, 0, 'gone with you');
  const points = g.wallet.points;
  t.tick(200);
  assert.equal(g.wallet.points, points, 'nothing more is paid');
});

test('THE ROLE: a lone zombie in the open is one hit a ball; a clump in a line is many; a lone zombie in the Service Corridor is hit again off the walls', () => {
  const measure = (position, yaw, spots) => {
    const { t, g, spawn, freeze } = setup(position, yaw);
    const zs = spots.map(([ahead, side]) => spawn(ahead, side));
    freeze(zs);
    let a = 5; // (seeded after the map was built)
    const real = Math.random;
    Math.random = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 2 ** 32; };
    try {
      let total = 0;
      const throws = 8;
      for (let i = 0; i < throws; i++) { for (const z of zs) z.health = 1e6; total += throwBall(t, g); }
      return total / throws;
    } finally { Math.random = real; }
  };
  const open = [-2, 0, 0.5], hallway = -Math.PI / 2;
  const lone = measure(open, hallway, [[4, 0]]);
  const spread = measure(open, hallway, [[3, 0], [8, 1.5], [13, -1.5]]);
  const clump = measure(open, hallway, [[3, 0], [4.5, 0.2], [6, -0.2]]);
  const corridor = measure([-21.8, 0, 1.2], 0, [[4, 0]]);
  assert.equal(lone, 1, 'a lone zombie in the open: one hit');
  assert.ok(spread < 1.5, `zombies far apart are not chained (${spread})`);
  assert.ok(clump >= 3 * lone, `a clump is hit again and again (${clump} hits a ball)`);
  assert.ok(clump <= launcher.projectile.maxBounces, 'never more than the ball has bounces');
  assert.ok(corridor >= 2 * lone, `the corridor's walls send it back at a lone zombie (${corridor} hits a ball)`);
});

test('reload: the magazine, a reserve of balls, no shell-by-shell; Jumbo Pack = bigger magazine, Extended Nozzle = the damage carries further', () => {
  const { t, g } = setup();
  const weapon = g.gun.weapon;
  weapon.magazine = 1;
  t.press('KeyR');
  assert.equal(weapon.isReloading, true);
  t.tick(Math.ceil((launcher.reloadTime + 0.5) / dt));
  assert.equal(weapon.magazine, launcher.magazineSize);
  assert.equal(weapon.reserve, launcher.startingReserve - (launcher.magazineSize - 1));
  const mods = (...ids) => ids.reduce((m, id) => withAttachment(launcher, m, id), []);
  assert.ok(resolveGun(launcher, mods('jumboPack')).magazineSize > launcher.magazineSize);
  assert.ok(resolveGun(launcher, mods('extendedNozzle')).falloff.end > launcher.falloff.end);
  for (const id of Object.keys(upgrades.attachments)) assert.equal(attachmentFits(launcher, id), true, `${id} fits`);
});

test('Play again: no ball left in the air, the gun gone', () => {
  const { t, g } = setup();
  t.press('Mouse0');
  assert.equal(g.balls.list.length, 1);
  g.resetRun();
  t.tick(2);
  assert.equal(g.balls.list.length, 0);
  assert.equal(g.gun.owns('tennisBallLauncher'), false);
  assert.ok(g.resetSteps.includes('balls'));
});
