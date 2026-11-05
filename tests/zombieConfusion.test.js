// Glitter's confused zombies (zombies/confusion.js): they forget the player and fight each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { weapons } from '../src/config/weapons.js';
import { workshopStuffings, workshopHearts, workshopRitual } from '../src/config/workshop.js';
import { economy, zombieHealthForRound } from '../src/config/economy.js';
import { zombieConfusion } from '../src/config/zombies.js';
import { gunPower } from '../src/weapons/gunStats.js';

const Y = LAYOUT.hallway.height + .3;
const HALLWAY_Z = 2;

function fixture() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.map.areaUnlocks.openAll();
  t.tick(120);
  g.gun.give(weapons.nailGun); t.tick(50);
  const put = (x, z = HALLWAY_Z, { health = 100000, type = 'shopper', floor = 0 } = {}) => {
    const zombie = g.zombies.spawn(type, new THREE.Vector3(x, 0, z));
    zombie.position.y = floor; zombie.prevPosition.copy(zombie.position);
    zombie.setState('chasing'); zombie.health = health; zombie.speed = 2.5; zombie.updateHitboxes();
    return zombie;
  };
  const far = () => g.player.teleport({ position: new THREE.Vector3(-18, 0, 4), yaw: 0 }); // well out of everything's reach
  return { ...t, put, far };
}

test('a confused zombie walks at the nearest zombie and hits it', () => {
  const t = fixture(), { g } = t;
  t.far();
  const confused = t.put(4), near = t.put(7), further = t.put(10);
  near.speed = further.speed = 0;
  confused.applyConfusion(6, 50);
  t.tick(90);
  assert.ok(confused.position.x > 4.8, `it walked over: ${confused.position.x}`);
  t.tick(120);
  assert.ok(near.health < 100000, 'it hit the nearest one');
  assert.equal(further.health, 100000, 'not the one behind it');
  g.map.dispose();
});

test('it ignores a player standing right next to it', () => {
  const t = fixture(), { g } = t;
  const damage = [];
  g.events.on('playerHit', e => damage.push(e));
  g.player.teleport({ position: new THREE.Vector3(4, 0, HALLWAY_Z + .9), yaw: 0 }); t.tick();
  const confused = t.put(4);
  confused.attackCooldown = 0;
  confused.applyConfusion(4, 50);
  // Its target stands where it can be reached from the confused zombie but can't reach the player itself.
  const target = t.put(4, HALLWAY_Z - 1.3);
  target.speed = 0;
  t.tick(180);
  assert.equal(damage.filter(e => e.zombie === confused).length, 0, 'the confused one never touched you');
  assert.equal(damage.length, 0, 'not once');
  assert.ok(target.health < 100000, 'it was busy');
  g.map.dispose();
});

test('a confused kill pays once and is credited to the build, and it moves on to the next zombie', () => {
  const t = fixture(), { g } = t;
  t.far();
  const confused = t.put(4), first = t.put(5.2, HALLWAY_Z, { health: 30 }), second = t.put(7.4);
  first.speed = second.speed = 0;
  const kills = [], before = g.wallet.points, count = g.runStats.kills;
  g.events.on('kill', e => kills.push(e));
  confused.applyConfusion(6, 50);
  t.tick(120);
  assert.equal(first.isAlive, false);
  assert.equal(first.killedBy, 'build');
  assert.deepEqual(kills.map(k => k.source), ['build']);
  assert.equal(g.wallet.points - before, economy.killValues.shopper);
  assert.equal(g.runStats.kills - count, 1);
  t.tick(150);
  assert.ok(second.health < 100000, 'on to the next');
  g.map.dispose();
});

test('walls and floors: it never hits through a wall or at a zombie on another floor', () => {
  const t = fixture(), { g } = t;
  t.far();
  g.colliders.push(new THREE.Box3(new THREE.Vector3(4.55, 0, 0), new THREE.Vector3(4.65, 3, 4)));
  const confused = t.put(4), behind = t.put(5.2);
  behind.speed = 0;
  confused.applyConfusion(3, 50);
  t.tick(150);
  assert.equal(behind.health, 100000, 'the wall is in the way');
  g.map.dispose();

  const u = fixture();
  u.far();
  // (x 0 is the Promenade's bridge: solid floor over the hallway, between the balcony holes.)
  const below = u.put(0, HALLWAY_Z);
  const above = u.put(0, HALLWAY_Z, { floor: Y });
  above.speed = 0;
  below.applyConfusion(3, 50);
  u.tick(120);
  assert.ok(Math.abs(above.position.y - Y) < .05, 'still upstairs');
  assert.equal(above.health, 100000, 'another floor');
  u.g.map.dispose();
});

test('with nobody to fight it stands there, and it comes back to the player afterwards, with a short immunity', () => {
  const t = fixture(), { g } = t;
  g.player.teleport({ position: new THREE.Vector3(8, 0, HALLWAY_Z), yaw: 0 }); t.tick();
  const zombie = t.put(4);
  zombie.applyConfusion(1, 50);
  const start = zombie.position.clone();
  t.tick(50);
  assert.ok(zombie.position.distanceTo(start) < .05, 'dazzled');
  t.tick(20);
  assert.equal(zombie.confusion, null);
  assert.equal(zombie.applyConfusion(5, 50), false, 'immune for a while');
  assert.equal(zombie.confusion, null);
  t.tick(120);
  assert.ok(zombie.position.x > 5, 'after you again');
  t.tick(Math.ceil(zombieConfusion.immuneSeconds * 60));
  assert.equal(zombie.applyConfusion(1, 50), true, 'it can be confused again');
  g.map.dispose();
});

test('a rising zombie can\'t be confused, a frozen mannequin stays frozen, and a charging cart stops', () => {
  const t = fixture(), { g } = t;
  t.far();
  const rising = g.zombies.spawn('shopper', new THREE.Vector3(4, 0, HALLWAY_Z));
  assert.equal(rising.state, 'spawning');
  assert.equal(rising.applyConfusion(3, 50), false);
  g.zombies.clear();
  const cart = t.put(4, HALLWAY_Z, { type: 'cartPusher' });
  cart.setState('charging');
  cart.chargeLeft = 6;
  assert.equal(cart.applyConfusion(3, 50), true);
  assert.notEqual(cart.state, 'charging');
  assert.equal(cart.chargeLeft, 0);
  g.zombies.clear();
  const mannequin = t.put(4, HALLWAY_Z, { type: 'mannequin' });
  mannequin.frozen = true;
  assert.equal(mannequin.applyConfusion(3, 50), false);
  g.map.dispose();
});

test('a zombie dying mid-confusion goes down normally, and a respawn clears it', () => {
  const t = fixture(), { g } = t;
  t.far();
  const zombie = t.put(4);
  zombie.applyConfusion(5, 50);
  zombie.takeHit({ damage: zombie.health + 1, part: 'body', source: 'hazard' });
  t.tick(60 * 6);
  assert.ok(!g.zombies.zombies.includes(zombie), 'sank and was removed');
  const other = t.put(5);
  other.applyConfusion(5, 50);
  other.respawnAt(new THREE.Vector3(6, 0, HALLWAY_Z), 0);
  assert.equal(other.confusion, null);
  g.map.dispose();
});

test('Glitter on a real headshot confuses the zombies round it, capped, and only for so long', () => {
  const t = fixture(), { g } = t;
  const { confuse } = workshopStuffings.glitter;
  const id = g.gun.def.id;
  g.gun.setMods(id, [{ id: 'build', build: { stuffing: 'glitter', heart: 'headshot', quality: 'understuffed', kills: 0 } }]);
  const crowd = [0, -.8, .8, -1.5, 1.5, 0].map((x, i) => {
    const z = t.put(x, i === 5 ? 5 : 6);
    z.speed = 0;
    return z;
  });
  t.standAt(0, 12);
  const point = crowd[0].hitboxes.find(h => h.part === 'head').box.getCenter(new THREE.Vector3());
  g.player.pitch = Math.atan2(point.y - g.player.eyeHeight, 12 - point.z);
  t.input.held.add('Mouse2'); t.tick(30);
  t.press('Mouse0'); t.input.held.delete('Mouse2'); t.tick(2);
  const confused = crowd.filter(z => z.confusion);
  assert.ok(confused.includes(crowd[0]), 'the one you hit');
  assert.ok(confused.length > 1, 'and some round it');
  assert.ok(confused.length <= confuse.maxTargets, `${confused.length} of at most ${confuse.maxTargets}`);
  const expected = gunPower(g.gun.def, g.stats) * confuse.gunSeconds;
  assert.ok(Math.abs(confused[0].confusion.damage - expected) < 1e-6, 'its blows scale with your gun');
  const sparkles = g.effects.counts.particles;
  t.tick(40);
  assert.ok(g.effects.counts.particles >= sparkles, 'sparkling');
  g.map.dispose();
});

test('a round with Glitter still ends: nobody is left waiting about', () => {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.map.areaUnlocks.openAll();
  g.health.invulnerable = true;
  g.rounds.jumpTo(3);
  const round = g.rounds.round;
  g.player.teleport({ position: new THREE.Vector3(0, 0, 3), yaw: 0 });
  for (let i = 0; i < 60 * 200 && g.rounds.round === round; i++) {
    t.tick();
    if (i % 90) continue;
    for (const z of g.zombies.zombies) if (z.isAlive && z.state !== 'spawning') z.applyConfusion(1.5, 200);
    const live = g.zombies.zombies.filter(z => z.isAlive && z.state !== 'spawning');
    if (live.length) live[0].takeHit({ damage: live[0].health + 1, part: 'body', source: 'hazard' });
  }
  assert.equal(g.rounds.round, round + 1, 'the round ended');
  g.map.dispose();
});

test('balance: a confused blow is a nudge, and confusion can\'t be kept up on a crowd', () => {
  const extra = workshopRitual.qualities.find(q => q.id === 'extraStuffed').power;
  const { confuse } = workshopStuffings.glitter;
  for (const gun of Object.values(weapons)) {
    const blow = gunPower(gun, { damageMultiplier: 1 }) * confuse.gunSeconds * extra * workshopHearts.lastRound.strength;
    assert.ok(blow < zombieHealthForRound(5), `${gun.name}: ${Math.round(blow)} a blow`);
  }
  assert.ok(confuse.seconds * extra <= confuse.maxSeconds);
  assert.ok(zombieConfusion.immuneSeconds >= confuse.seconds, 'a zombie gets its turn between doses');
  assert.ok(confuse.maxTargets <= 4);
});
