// Captain Coupon (config/zombies.js mascotVariants.captainCoupon, zombies/zombie.js updateReclaim, the manager's helmets):
// after the pop and the shake he walks back to HIS helmet and puts it on again. Checked: the reclaim (health, speed,
// hitboxes, the PA line), only once, the helmet bonus only once, giving up (guarded, too slow, helmet gone at round
// end), a dead Coupon stops (also mid-lift), and the leftover-helmet cap never sweeps up the helmet he is going back for.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { economy } from '../src/config/economy.js';
import { mascotTypes, mascotVariants } from '../src/config/zombies.js';

const type = mascotTypes.captainCoupon;
const cfg = type.mascot.reclaim;
const secondsToTicks = (seconds) => Math.ceil(seconds * 60);

function fixture(t) {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  const { g } = game;
  g.health.invulnerable = true;
  g.rounds.jumpTo(mascotVariants.captainCoupon.unlockRound);
  g.rounds.update = () => {};
  game.standAt(0, 12);
  t.after(() => {
    g.zombies.clear();
    g.map.dispose();
  });
  const reclaims = [];
  g.events.on('mascotReclaim', ({ zombie }) => reclaims.push(zombie));
  return { ...game, scene, reclaims };
}

const coupon = (g, x = 0, z = 8) => {
  const zombie = g.zombies.spawn('mascot', new THREE.Vector3(x, 0, z), { variant: 'captainCoupon' });
  zombie.setState('chasing');
  return zombie;
};
const waffles = (g, x, z) => {
  const zombie = g.zombies.spawn('mascot', new THREE.Vector3(x, 0, z), { variant: 'sirWaffles' });
  zombie.setState('chasing');
  return zombie;
};
// Down to half health: the helmet comes off (a body hit pays no bonus).
const pop = (zombie, part = 'body', source = 'gun') =>
  zombie.takeHit({ damage: zombie.health - zombie.maxHealth * type.mascot.healthFraction + 1, part, source });
const debrisCount = (scene) => scene.children.filter((node) => node.name === 'mascotDebris').length;

function tickUntil(tick, done, seconds = 10) {
  for (let i = 0; i < secondsToTicks(seconds) && !done(); i++) tick();
  return done();
}

test('after the pop and the shake he walks back, puts his helmet on, and is suited again at 3/4 health', (t) => {
  const { g, tick, scene, hud, reclaims } = fixture(t);
  const zombie = coupon(g);
  const helmet = zombie.model.root.getObjectByName('mascotHelmet');
  const suited = zombie.speed;
  pop(zombie);
  assert.ok(zombie.mascotHeadOff && zombie.mascotHelmet, 'the helmet is off and he knows where it is');
  const rest = zombie.mascotHelmet.rest.clone();

  tick(secondsToTicks(type.mascot.rage.seconds) + 1);
  assert.ok(zombie.mascotSeek >= 0, 'the shake is over: he goes for it instead of rushing');
  assert.ok(zombie.speed < type.mascot.exposedSpeed);
  assert.ok(tickUntil(tick, () => zombie.mascotLift > 0, cfg.giveUpSeconds), 'he reaches it');
  assert.ok(Math.hypot(zombie.position.x - rest.x, zombie.position.z - rest.z) <= cfg.reachRadius + 0.05);
  assert.equal(helmet.parent, zombie.model.root, 'it is in his hands');
  assert.equal(debrisCount(scene), 0, 'and off the floor');
  assert.ok(zombie.mascotHeadOff, 'the head is still bare while he lifts it');
  const at = zombie.position.clone();

  tick(secondsToTicks(cfg.reclaimSeconds) - 2);
  assert.ok(zombie.mascotHeadOff, 'it takes the whole reclaimSeconds');
  assert.ok(zombie.position.distanceTo(at) < 1e-6, 'standing still meanwhile');
  tick(3);
  assert.equal(zombie.mascotHeadOff, false);
  assert.equal(zombie.health, zombie.maxHealth * cfg.reclaimHealthFraction);
  assert.equal(zombie.speed, suited);
  assert.equal(zombie.mascotReclaims, 1);
  assert.equal(helmet.parent.parent.parent, zombie.model.root, 'back in its place on the body');
  assert.deepEqual(helmet.position.toArray(), type.mascot.helmet.at);
  assert.equal(zombie.hitboxes[0].group, helmet, 'and the head hitbox is the helmet again');
  assert.deepEqual(reclaims, [zombie]);
  assert.equal(hud.calls.filter(([name, line]) => name === 'showAnnouncement' && line.text === cfg.line.text).length, 1);
});

test('only once: the second pop sends him rushing, and only the first headshot pop pays the bonus', (t) => {
  const { g, tick, reclaims } = fixture(t);
  const zombie = coupon(g);
  const before = g.wallet.points;
  pop(zombie, 'head', 'gun');
  assert.equal(g.wallet.points - before, economy.payouts.helmetPopBonus);
  tick(secondsToTicks(type.mascot.rage.seconds) + 1);
  assert.ok(tickUntil(tick, () => zombie.mascotReclaims === 1, cfg.giveUpSeconds + cfg.reclaimSeconds));

  const again = g.wallet.points;
  const pops = [];
  g.events.on('mascotHeadPop', (event) => pops.push(event));
  pop(zombie, 'head', 'gun');
  assert.equal(pops.length, 1);
  assert.equal(pops[0].again, true);
  assert.equal(g.wallet.points, again, 'no second bonus');
  tick(secondsToTicks(type.mascot.rage.seconds) + 1);
  assert.equal(zombie.mascotSeek, -1, 'no second trip back');
  assert.equal(zombie.speed, type.mascot.exposedSpeed, 'he rushes like any Mascot');
  tick(secondsToTicks(cfg.giveUpSeconds));
  assert.equal(zombie.mascotHeadOff, true);
  assert.equal(reclaims.length, 1);
});

test('he gives up and rushes when you stand guard by his helmet', (t) => {
  const { g, tick, standAt } = fixture(t);
  const zombie = coupon(g);
  pop(zombie);
  const { rest } = zombie.mascotHelmet;
  standAt(rest.x + cfg.guardRadius * 0.5, rest.z);
  tick(secondsToTicks(type.mascot.rage.seconds) + 2);
  assert.ok(zombie.mascotGaveUp);
  assert.equal(zombie.mascotSeek, -1);
  assert.equal(zombie.speed, type.mascot.exposedSpeed);
  assert.equal(zombie.mascotWantsHelmet, false);
});

test('he gives up when he has not got it back in giveUpSeconds', (t) => {
  const { g, tick, reclaims } = fixture(t);
  const zombie = coupon(g);
  pop(zombie);
  // Hold him where he stands: he can walk at it all he likes.
  const hold = zombie.position.clone();
  tick(secondsToTicks(type.mascot.rage.seconds) + 1);
  assert.ok(zombie.mascotSeek >= 0);
  for (let i = 0; i < secondsToTicks(cfg.giveUpSeconds) - 5; i++) {
    tick();
    zombie.position.copy(hold);
  }
  assert.ok(!zombie.mascotGaveUp, 'not yet');
  tick(8);
  assert.ok(zombie.mascotGaveUp);
  assert.equal(zombie.speed, type.mascot.exposedSpeed);
  assert.equal(zombie.mascotLift, 0);
  assert.equal(reclaims.length, 0);
});

test('when the round ends and the helmet is swept up, he rushes instead', (t) => {
  const { g, tick } = fixture(t);
  const zombie = coupon(g);
  pop(zombie);
  const helmet = zombie.mascotHelmet;
  Object.defineProperty(g.rounds, 'round', { get: () => 14, configurable: true }); // (the round number moves on under him)
  tick(1);
  assert.ok(helmet.gone, 'the old round\'s helmet is cleared');
  tick(secondsToTicks(type.mascot.rage.seconds) + 1);
  assert.ok(zombie.mascotGaveUp);
  assert.equal(zombie.speed, type.mascot.exposedSpeed);
});

test('a dead Coupon stops trying: on the way his helmet stays on the floor, mid-lift it goes down with him', (t) => {
  const { g, tick, scene, reclaims } = fixture(t);
  const walking = coupon(g);
  pop(walking);
  tick(secondsToTicks(type.mascot.rage.seconds) + 3);
  assert.ok(walking.mascotSeek >= 0);
  walking.takeHit({ damage: 1e9, part: 'body', source: 'hazard' });
  assert.equal(walking.mascotSeek, -1);
  tick(secondsToTicks(cfg.giveUpSeconds));
  assert.equal(walking.mascotLift, 0);
  assert.equal(debrisCount(scene), 1, 'his helmet lies where it fell, like anyone\'s');

  const lifting = coupon(g, 2, 8);
  const helmet = lifting.model.root.getObjectByName('mascotHelmet');
  pop(lifting);
  tick(secondsToTicks(type.mascot.rage.seconds) + 1);
  assert.ok(tickUntil(tick, () => lifting.mascotLift > 0, cfg.giveUpSeconds));
  lifting.takeHit({ damage: 1e9, part: 'body', source: 'hazard' });
  assert.equal(lifting.mascotLift, 0);
  assert.equal(helmet.parent.parent.parent, lifting.model.root, 'no longer floating: it falls with his body');
  tick(secondsToTicks(type.fallSeconds + type.corpseSeconds + type.sinkSeconds) + 2);
  assert.ok(!g.zombies.zombies.includes(lifting));
  assert.equal(lifting.model.root.parent, null, 'and went when the body did');
  assert.equal(debrisCount(scene), 1, '(only the first one\'s helmet is still lying there)');
  assert.equal(reclaims.length, 0);
});

test('the leftover-helmet cap never sweeps up the helmet he is going back for', (t) => {
  const { g, scene } = fixture(t);
  const { max } = type.mascot.leftHelmets;
  const zombie = coupon(g, -2, 8);
  pop(zombie);
  const mine = zombie.mascotHelmet;
  for (let i = 0; i < max; i++) {
    const other = waffles(g, i * 1.4 - 0.5, 10.5);
    pop(other);
    other.takeHit({ damage: 1e9, part: 'body', source: 'hazard' });
  }
  assert.equal(debrisCount(scene), max);
  assert.ok(!mine.gone, 'an older Sir Waffles helmet went instead');

  zombie.giveUpHelmet(); // (once he has given up on it, it is like anyone else's)
  const last = waffles(g, 3, 10.5);
  pop(last);
  assert.ok(mine.gone);
  assert.equal(debrisCount(scene), max);
});
