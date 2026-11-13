// The Cart Pusher (round 6+): walks like a Shopper, but with a clear, wide lane at mid range it telegraphs
// (stands rattling its cart), locks its direction, then charges in a straight line. Standing still = run over
// (60 damage + a shove); a sidestep after the lock dodges it, and a miss ends in a crash: stunned, taking extra
// damage. Checked on the real Zombie class on open floor, against walls/benches/doorways, the model, the round mix
// and in the real game and mall.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { Zombie } from '../src/zombies/zombie.js';
import { createZombieModel } from '../src/zombies/zombieModel.js';
import { zombieTypes } from '../src/config/zombies.js';
import { economy, zombieHealthFor, zombieHealthForRound, zombieTypeForRound } from '../src/config/economy.js';
import { createRounds } from '../src/game/rounds.js';
import { pointsForHit } from '../src/game/wallet.js';
import { feel } from '../src/config/feel.js';
import { audio } from '../src/config/audio.js';

const dt = 1 / feel.simulation.tickRate;
const TYPE = zombieTypes.cartPusher;
const C = TYPE.charge;

// A Cart Pusher at the origin facing -Z, the player `distance` m away along -Z, on a big flat floor (+ extra boxes).
function fixture(distance = 9, extra = []) {
  const hits = [];
  const sounds = [];
  const player = { position: new THREE.Vector3(0, 0, -distance), height: feel.player.height };
  const nav = {
    directionTo(from, to, out) {
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      out.x = dx / d;
      out.z = dz / d;
      return true;
    },
  };
  const colliders = [new THREE.Box3(new THREE.Vector3(-40, -0.2, -40), new THREE.Vector3(40, 0, 40)), ...extra];
  const zombie = new Zombie({ type: TYPE, health: 1000, position: new THREE.Vector3(0, 0, 0), yaw: 0 });
  zombie.setState('chasing');
  zombie.chargeCheckTimer = 0;
  const ctx = {
    nav, player, colliders, zombies: [zombie], canAttack: true,
    onPlayerHit: (damage, z, knockback) => hits.push({ damage, knockback }),
    onSound: (name) => sounds.push(name),
  };
  const tick = (n = 1) => { for (let i = 0; i < n; i++) zombie.update(dt, ctx); };
  // Tick until the zombie is in `state` (or give up after `max` ticks).
  const until = (state, max = 600) => {
    for (let i = 0; i < max && zombie.state !== state; i++) tick();
    return zombie.state === state;
  };
  return { zombie, player, hits, sounds, tick, until, ctx };
}
const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

test('round mix: Cart Pushers from round 6 (10%, 15% from round 10), 1.8x health, worth 130', () => {
  for (const round of [1, 4, 5]) for (const roll of [0, 0.2, 0.3, 0.5, 0.99]) assert.notEqual(zombieTypeForRound(round, roll), 'cartPusher');
  assert.equal(zombieTypeForRound(6, 0.179), 'shoplifter');
  assert.equal(zombieTypeForRound(6, 0.19), 'cartPusher');
  assert.equal(zombieTypeForRound(6, 0.279), 'cartPusher');
  assert.equal(zombieTypeForRound(6, 0.281), 'shopper');
  assert.equal(zombieTypeForRound(10, 0.349), 'cartPusher'); // after the Shoplifters' 20%
  assert.equal(zombieTypeForRound(10, 0.471), 'shopper'); // beyond the Mannequin and Mascot shares
  for (const round of [6, 9, 14]) {
    assert.equal(zombieHealthFor('cartPusher', round), Math.round(zombieHealthForRound(round) * 1.8));
  }
  assert.equal(pointsForHit({ target: { type: TYPE }, killed: true }), economy.killValues.cartPusher);
  assert.equal(economy.killValues.cartPusher, 130);
});

test('round 6 always brings a Cart Pusher early and announces it once, with its own banner', () => {
  const spawns = [];
  const intros = [];
  const fakeZombies = { aliveCount: 0, spawn(typeId) { spawns.push({ round: rounds.round, typeId }); return {}; }, clear() {} };
  const rounds = createRounds({ zombies: fakeZombies, onTypeIntro: (typeId) => intros.push({ round: rounds.round, typeId }) });
  rounds.start();
  for (let i = 0; i < 60 * 600 && rounds.round < 7; i++) rounds.update(dt);
  assert.equal(spawns.filter((s) => s.round < 6 && s.typeId === 'cartPusher').length, 0);
  const round6 = spawns.filter((s) => s.round === 6);
  assert.ok(round6.slice(0, economy.zombieMix.cartPusher.introSpawnIndex + 1).some((s) => s.typeId === 'cartPusher'));
  const cart = intros.filter((i) => i.typeId === 'cartPusher');
  assert.equal(cart.length, 1);
  assert.equal(cart[0].round, 6);
  assert.ok(TYPE.introBanner.kicker && TYPE.introBanner.text);
  for (const s of Object.values(TYPE.sounds)) assert.ok(audio.sounds[s.name], `${s.name} is a real sound recipe`);
});

test('telegraph, then charge: standing still gets you run over (60 damage + a shove along the charge)', () => {
  const t = fixture(9);
  assert.ok(t.until('chargeTelegraph', 30), 'starts a charge with a clear lane at 9 m');
  assert.ok(t.sounds.includes(TYPE.sounds.telegraph.name), 'the rattle warns you');
  const at = t.zombie.position.clone();
  t.tick(Math.round(C.telegraphSeconds / dt) - 2);
  assert.ok(t.zombie.position.distanceTo(at) < 0.01, 'it stands still while telegraphing');
  assert.equal(t.zombie.state, 'chargeTelegraph');
  assert.ok(t.until('charging', 5));
  let top = 0;
  for (let i = 0; i < 120 && t.zombie.state === 'charging'; i++) { t.tick(); top = Math.max(top, t.zombie.horizontalSpeed); }
  assert.ok(top > 8, `faster than your sprint: ${top.toFixed(1)} m/s`);
  assert.equal(t.hits.length, 1, 'hit exactly once');
  assert.equal(t.hits[0].damage, C.damage);
  assert.equal(C.damage, 60);
  assert.ok(t.hits[0].knockback.z < -C.knockback * 0.99, 'shoved away along the charge (-Z)');
  assert.equal(t.zombie.state, 'chargeRecover');
  t.tick(Math.round(C.hitRecoverSeconds / dt) + 1);
  assert.equal(t.zombie.state, 'chasing');
  assert.ok(t.zombie.chargeCooldown > C.cooldownSeconds - 0.1, 'no charging again for a while');
});

test("the hit area is the cart's width (+ a little): 0.8 m off its line is hit, 1.1 m is clear", () => {
  for (const [offset, hit] of [[0, true], [0.8, true], [1.1, false], [-1.1, false]]) {
    const t = fixture(9);
    assert.ok(t.until('charging'));
    t.player.position.x = offset;
    t.until('chasing', 300);
    assert.equal(t.hits.length, hit ? 1 : 0, `${offset} m off the line`);
  }
});

test('a sidestep after the lock dodges it: it overshoots, crashes, is stunned and takes extra damage', () => {
  const t = fixture(9);
  assert.ok(t.until('charging'));
  t.player.position.x = 1.5; // step aside as it sets off
  assert.ok(t.until('crashed', 120), 'it ran past and crashed');
  assert.equal(t.hits.length, 0, 'the sidestep dodged it');
  assert.ok(t.zombie.position.z < -9, 'it overshot where you stood');
  assert.ok(t.sounds.includes(TYPE.sounds.crash.name));
  const at = t.zombie.position.clone();
  const before = t.zombie.health;
  t.zombie.takeHit({ damage: 100, part: 'body' });
  assert.equal(before - t.zombie.health, 100 * C.crashDamageTakenMultiplier, 'extra damage while stunned');
  t.player.position.set(0.5, 0, t.zombie.position.z - 0.9); // walk right up to it: no slam while stunned
  t.tick(Math.round(C.crashSeconds / dt) - 2);
  assert.equal(t.zombie.state, 'crashed', 'stunned for crashSeconds');
  assert.ok(t.zombie.position.distanceTo(at) < 0.01, 'and does not move');
  assert.ok(t.until('chasing', 10));
  t.zombie.takeHit({ damage: 100, part: 'body' });
  assert.equal(before - 150 - t.zombie.health, 100, 'normal damage once it is back up');
});

test('a dodged charge into a wall crashes with the cart nose AT the wall, not through it', () => {
  const wall = box(-10, 0, -11, 10, 4, -10.7);
  const t = fixture(8, [wall]);
  assert.ok(t.until('charging'));
  t.player.position.x = 1.5;
  assert.ok(t.until('crashed', 120));
  const nose = t.zombie.position.z - C.noseReach;
  assert.ok(nose >= -10.7 - 0.05 && nose < -10.7 + 0.5, `nose stops at the wall (nose z ${nose.toFixed(2)})`);
});

test('no charge without a clear, wide lane at mid range: too close, too far, bench, narrow doorway, or behind a wall', () => {
  const noCharge = (label, distance, extra = [], player) => {
    const t = fixture(distance, extra);
    if (player) t.player.position.set(...player);
    t.zombie.speed = 0; // stay put: only the lane check matters here
    t.tick(60);
    assert.notEqual(t.zombie.state, 'chargeTelegraph', label);
    assert.notEqual(t.zombie.state, 'charging', label);
  };
  noCharge('too close (4 m)', 4);
  noCharge('too far (16 m)', 16);
  noCharge('a bench across the lane', 9, [box(-1.5, 0, -5.3, 1.5, 0.45, -4.7)]);
  // A 1.2 m doorway in a wall across the lane: the cart would only half fit.
  noCharge('a narrow doorway', 9, [box(-10, 0, -5.2, -0.6, 4, -4.8), box(0.6, 0, -5.2, 10, 4, -4.8)]);
  noCharge('a wall in between', 9, [box(-10, 0, -5.2, 10, 4, -4.8)]);
  // But a 3 m doorway is wide enough.
  const t = fixture(9, [box(-10, 0, -5.2, -1.5, 4, -4.8), box(1.5, 0, -5.2, 10, 4, -4.8)]);
  assert.ok(t.until('chargeTelegraph', 30), 'charges through a wide doorway');
});

test('up close it still slams like a Shopper (and never charges once the player is dead)', () => {
  const t = fixture(1.2);
  assert.ok(t.until('windup', 5), 'normal wind-up at arm\'s length');
  assert.ok(t.until('swing', 60));
  assert.deepEqual(t.hits.map((h) => h.damage), [TYPE.attack.damage]);
  const dead = fixture(9);
  dead.ctx.canAttack = false;
  dead.tick(120);
  assert.ok(!['chargeTelegraph', 'charging'].includes(dead.zombie.state));
});

test('the model: a cart in front at handle height that stays upright when it dies; poses are finite; disposes', () => {
  const model = createZombieModel(TYPE);
  const cart = model.root.getObjectByName('cart');
  assert.ok(cart, 'it has a cart');
  assert.equal(cart.parent, model.root, 'on the root, so it stays put when the body tips over');
  const bounds = new THREE.Box3().setFromObject(cart);
  assert.ok(bounds.max.z < 0 && bounds.min.z > -C.noseReach - 0.05, 'in front of the feet, nose within noseReach');
  assert.ok(Math.abs(bounds.max.y - TYPE.cart.handleY) < 0.06, 'handle at the top');
  assert.ok(bounds.min.y >= -0.01, 'wheels on the floor');
  assert.ok(!createZombieModel(zombieTypes.shopper).root.getObjectByName('cart'));
  assert.ok(!createZombieModel(zombieTypes.mallWalker).root.getObjectByName('cart'));

  const z = new Zombie({ type: TYPE, health: 500, position: new THREE.Vector3(), yaw: 0 });
  for (const state of ['chasing', 'chargeTelegraph', 'charging', 'crashed', 'chargeRecover', 'windup', 'swing', 'dead']) {
    z.setState(state);
    z.stateTime = 0.4;
    model.update(1 / 60, z, 1);
    model.root.updateMatrixWorld(true);
    model.root.traverse((o) => {
      for (const v of [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z]) {
        assert.ok(Number.isFinite(v), `${state}: ${o.name}`);
      }
    });
    if (state === 'crashed') assert.ok(Math.abs(cart.rotation.z) > 0.1, 'the cart tips when it crashes');
    if (state === 'dead') assert.equal(cart.rotation.z, 0);
  }
  const geometries = cart.userData.geometries;
  let disposed = 0;
  for (const g of geometries) g.addEventListener('dispose', () => { disposed += 1; });
  model.dispose();
  assert.equal(disposed, geometries.length, 'the cart\'s merged geometry is freed');
});

test('the real game and mall: a Cart Pusher in the hallway runs over a player standing in its lane', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(4, 0, 2), yaw: -Math.PI / 2 });
  const seen = [];
  g.events.on('playerHit', (hit) => seen.push(hit));
  const z = g.zombies.spawn('cartPusher', new THREE.Vector3(14, 0, 2));
  assert.equal(z.health, zombieHealthFor('cartPusher', g.rounds.round || 1));
  const hp = () => g.stats.health;
  const healthBefore = hp();
  const states = new Set();
  for (let i = 0; i < 60 * 6 && !seen.length; i++) { t.tick(); states.add(z.state); }
  assert.ok(states.has('chargeTelegraph') && states.has('charging'), [...states].join(', '));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].damage, C.damage);
  assert.ok(seen[0].knockback.x < 0, 'shoved along the charge (west)');
  assert.ok(Math.abs(healthBefore - hp() - C.damage) < 1e-6, 'took 60');
  t.tick(1);
  assert.ok(g.player.velocity.x < -2, 'the shove moves you');
});

// --- BUG: after a miss the pusher slumps over its cart and the tipped cart fills the view; the hitboxes used to stay
// where a standing zombie is, so shots at what you SEE (the slumped head, the cart) passed through it. ---
test('after a crash the hitboxes follow what you see: the slumped head and the tipped cart can be shot', async () => {
  const { castShot } = await import('../src/weapons/hitscan.js');
  const t = fixture(9);
  assert.ok(t.until('charging'));
  t.player.position.x = 1.5; // dodge
  assert.ok(t.until('crashed', 120));
  t.tick(18); // let the slump finish
  const z = t.zombie;
  assert.equal(z.state, 'crashed');

  // Where the model's head and cart really are (the real pose, from the real model).
  const model = createZombieModel(TYPE);
  model.update(1 / 60, z, 1);
  model.root.updateMatrixWorld(true);
  const head = model.root.getObjectByName('head').localToWorld(new THREE.Vector3(0, 0.17, 0));
  const cartBox = new THREE.Box3().setFromObject(model.root.getObjectByName('cart'));
  const cartCentre = cartBox.getCenter(new THREE.Vector3());
  const standingHead = z.position.clone().add(new THREE.Vector3(0, 1.59, 0));
  assert.ok(head.distanceTo(standingHead) > 0.4, `the head really has moved (${head.distanceTo(standingHead).toFixed(2)} m)`);

  // Shoot at each from 4 m away, level with it, from the side (the dodging player's view).
  const shootAt = (point, from = new THREE.Vector3(point.x + 0.3, point.y, point.z + 4)) => {
    const dir = point.clone().sub(from).normalize();
    return castShot(from, dir, 50, t.ctx.colliders, [z], 1);
  };
  const atHead = shootAt(head);
  assert.equal(atHead.target, z, 'a shot at the slumped head hits the zombie');
  assert.equal(atHead.part, 'head', 'and it counts as a headshot');
  const atCart = shootAt(cartCentre);
  assert.equal(atCart.target, z, 'a shot at the tipped cart hits the zombie');
  assert.equal(atCart.part, 'body');

  // And it takes the extra stunned damage from those hits.
  const before = z.health;
  z.takeHit({ damage: 100, part: atCart.part });
  assert.equal(before - z.health, 100 * C.crashDamageTakenMultiplier);

  // Back on its feet: the box is the body box again (the cart is shoot-through, as designed) and the head box is home.
  assert.ok(t.until('chasing', 200));
  t.tick(30);
  const [headBox, bodyBox, cartBoxAgain] = z.hitboxes;
  assert.ok(cartBoxAgain.box.equals(bodyBox.box), 'the cart box is only a target while crashed');
  assert.ok(headBox.box.max.y > 1.6, 'the head box is back up high');
});

test('while it leans (telegraph, charge) the head box leans with it, and no box is ever empty or NaN', () => {
  const t = fixture(9);
  const z = t.zombie;
  const standingX = z.hitboxes[0].box.getCenter(new THREE.Vector3());
  for (const state of ['chasing', 'chargeTelegraph', 'charging', 'crashed', 'chargeRecover', 'windup', 'swing']) {
    z.setState(state);
    z.stateTime = 0.4;
    z.yaw = 0.7;
    z.updateHitboxes();
    for (const { box } of z.hitboxes) {
      assert.ok(!box.isEmpty(), `${state}: a real box`);
      for (const v of [...box.min.toArray(), ...box.max.toArray()]) assert.ok(Number.isFinite(v), state);
    }
  }
  z.yaw = 0;
  z.setState('charging');
  z.updateHitboxes();
  const forwardZ = standingX.z - z.hitboxes[0].box.getCenter(new THREE.Vector3()).z; // facing -Z: the head moves to -Z (positive here)
  assert.ok(forwardZ > 0.2, `the head box leans forward (${forwardZ.toFixed(2)} m)`);
  assert.ok(z.hitboxes[0].box.max.y < 1.78, 'and lower');
});
