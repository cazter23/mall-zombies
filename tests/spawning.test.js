import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createZombieManager } from '../src/zombies/zombieManager.js';
import { createRounds } from '../src/game/rounds.js';
import { zombieCrowd, zombieFailsafe, zombieSpawn, zombieTypes } from '../src/config/zombies.js';
import { economy, zombieCountForRound } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { buildMall } from '../src/maps/mall/mall.js';
import { buildTestRange } from '../src/maps/testRange/testRange.js';

const dt = 1 / feel.simulation.tickRate;
const marker = (x, cost = x, zone = 'open') => ({
  name: `marker-${x}`, zone, cost, position: new THREE.Vector3(x, 0, 0),
});

function setup(t, points) {
  const scene = new THREE.Scene();
  const player = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), height: feel.player.height };
  const manager = createZombieManager({
    scene, player, spawnPoints: points,
    colliders: [new THREE.Box3(new THREE.Vector3(-5, -0.2, -5), new THREE.Vector3(95, 0, 8))],
    shootables: [], effects: { splat() {} },
    isZoneOpen: (zone) => zone !== 'closed', getRound: () => 1, canAttack: () => false,
    onPlayerHit() {},
  });
  // Controlled route costs isolate selection from the separately tested pathfinder.
  manager.nav.distanceToTarget = (x) => points.find((p) => p.position.x === x)?.cost ?? Infinity;
  t.after(() => manager.clear());
  return { manager, player };
}

// Control just the two selection draws; model, gait and crowd randomness stays valid.
function select(manager, nearby = true, indexRoll = 0, typeId = 'shopper') {
  const original = Math.random;
  const rolls = [nearby ? zombieSpawn.nearbyChance / 2 : (1 + zombieSpawn.nearbyChance) / 2, indexRoll];
  Math.random = () => rolls.length ? rolls.shift() : 0.5;
  try { return manager.spawn(typeId); } finally { Math.random = original; }
}

test('both selection branches use route cost and exclude distant markers', (t) => {
  // Input order and straight-line distances disagree with the intended route order.
  const points = [marker(8, 90), marker(36), marker(30), marker(24), marker(18), marker(12), marker(6)];
  const { manager } = setup(t, points);
  assert.equal(select(manager, true, 0.999).position.x, 24, 'nearby branch stays within the nearest four');
  manager.clear();
  assert.equal(select(manager, false, 0.999).position.x, 36, 'random branch can reach beyond the nearest four');
  manager.clear();
  assert.equal(select(manager).position.x, 6, 'shortest route wins despite the distant marker being close in a straight line');
});

test('closed, unreachable and too-close markers never anchor the neighbourhood', (t) => {
  const points = [marker(2, 2), marker(6, 1, 'closed'), marker(12, Infinity), marker(18, 40), marker(24, 70)];
  const { manager } = setup(t, points);
  assert.equal(select(manager, false, 0.999).position.x, 24, 'allowance is relative to the cheapest safe eligible marker');
});

test('all markers too close postpones spawning, even while the player is airborne', (t) => {
  const { manager, player } = setup(t, [marker(2)]);
  player.position.y = 4;
  assert.equal(select(manager), null);
  assert.equal(manager.aliveCount, 0);
});

test('emerging zombies reserve space; corpses do not', (t) => {
  const { manager } = setup(t, [marker(6), marker(12)]);
  const blocker = manager.spawn('shopper', new THREE.Vector3(6.7, 0, 0));
  assert.equal(blocker.state, 'spawning');
  const next = select(manager);
  assert.equal(next.position.x, 12, 'a nearby emerging body blocks the first marker');
  blocker.setState('dead');
  next.setState('dead');
  assert.equal(select(manager).position.x, 6, 'a corpse does not reserve spawn space');
});

test('occupancy clearance uses both zombie types, and never falls back to an occupied marker', (t) => {
  const { manager } = setup(t, [marker(6)]);
  // Fits beside an incoming Mall Walker, but not beside an incoming Shopper.
  const shopperClearance = zombieTypes.shopper.radius * 2 + zombieSpawn.clearanceGap;
  const walkerClearance = zombieTypes.shopper.radius + zombieTypes.mallWalker.radius + zombieSpawn.clearanceGap;
  const blocker = manager.spawn('shopper', new THREE.Vector3(6 + (shopperClearance + walkerClearance) / 2, 0, 0));
  assert.equal(select(manager), null);
  assert.ok(select(manager, true, 0, 'mallWalker'));
  blocker.setState('dead');
  assert.equal(select(manager), null, 'the second, still-emerging zombie now occupies the marker');
});

test('cooldowns prefer another local marker and fall back locally when every safe one is cooling', (t) => {
  const { manager } = setup(t, [marker(6), marker(12), marker(80)]);
  const first = select(manager);
  first.setState('dead');
  const second = select(manager);
  assert.equal(second.position.x, 12, 'avoid immediate reuse when another local marker is ready');
  second.setState('dead');
  assert.equal(select(manager).position.x, 6, 'relax cooldown instead of widening the neighbourhood to 80');
});

test('cooldowns expire on simulation time and clear resets their history', (t) => {
  const { manager } = setup(t, [marker(6), marker(12)]);
  select(manager).setState('dead');
  for (let tick = 0; tick < Math.ceil(zombieSpawn.reuseCooldownSeconds / dt) + 1; tick++) manager.update(dt);
  assert.equal(select(manager).position.x, 6, 'nearest marker becomes available after its cooldown');
  manager.clear();
  assert.equal(select(manager).position.x, 6, 'a new run has no old marker cooldown');
});

test('a failed spawn does not consume quota; the round resumes after a marker becomes safe', (t) => {
  const { manager, player } = setup(t, [marker(6)]);
  const rounds = createRounds({ zombies: manager });
  player.position.x = 3;
  rounds.start();
  for (let tick = 0; tick < Math.ceil((economy.rounds.firstRoundDelay + 1) / dt); tick++) rounds.update(dt);
  assert.equal(rounds.remainingToSpawn, zombieCountForRound(1));
  assert.equal(manager.aliveCount, 0);
  player.position.x = 0;
  for (let tick = 0; tick < Math.ceil(economy.rounds.spawnRetrySeconds / dt) + 1; tick++) rounds.update(dt);
  assert.equal(manager.aliveCount, 1);
  assert.equal(rounds.remainingToSpawn, zombieCountForRound(1) - 1);
});

test('a stuck rescue excludes its own body and preserves health without kill rewards', (t) => {
  const { manager } = setup(t, [marker(6)]);
  const z = select(manager);
  z.takeHit({ damage: 25, part: 'body' });
  z.setState('chasing');
  z.update = () => {}; // a wedged body cannot make progress
  z.stuckTimer = zombieFailsafe.checkSeconds - dt;
  let kills = 0;
  z.onDeath = () => { kills++; };
  const health = z.health;
  manager.update(dt);
  assert.equal(z.state, 'spawning', 'its own body does not block the only rescue marker');
  assert.equal(z.health, health);
  assert.equal(kills, 0);
  assert.equal(manager.aliveCount, 1);
});

test('a rescue waits for a genuinely free marker and records its successful reuse', (t) => {
  const { manager } = setup(t, [marker(6), marker(12)]);
  const blockers = [6, 12].map((x) => manager.spawn('shopper', new THREE.Vector3(x, 0, 0)));
  const z = manager.spawn('shopper', new THREE.Vector3(50, 0, 0));
  z.setState('chasing');
  z.update = () => {};
  z.stuckTimer = zombieFailsafe.checkSeconds - dt;
  manager.update(dt);
  assert.equal(z.position.x, 50, 'occupied markers cannot be forced for a rescue');
  blockers.forEach((b) => b.setState('dead'));
  z.stuckTimer = zombieFailsafe.checkSeconds - dt;
  manager.update(dt);
  assert.equal(z.state, 'spawning');
  const usedX = z.position.x;
  z.setState('dead');
  assert.notEqual(select(manager).position.x, usedX, 'rescues also put their marker on cooldown');
});

// The real mall draws sign textures on canvas; geometry/nav need only a no-op context.
const canvasContext = new Proxy({}, {
  get: (target, key) => key in target ? target[key] : (target[key] = () => canvasContext),
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => canvasContext }) };

test('real mall: isolated selection improves mean route cost without losing multiple spawn origins', (t) => {
  const scene = new THREE.Scene();
  const colliders = [];
  const map = buildMall(scene, colliders);
  buildTestRange(scene, colliders); // Same grid bounds as the browser's default debug setup.
  const player = { position: map.playerSpawn.position.clone(), velocity: new THREE.Vector3(), height: feel.player.height };
  const manager = createZombieManager({
    scene, colliders, player, spawnPoints: map.spawnPoints, shootables: [], effects: { splat() {} },
    isZoneOpen: (zone) => map.zones[zone].open, getRound: () => 1, canAttack: () => false, onPlayerHit() {},
  });
  t.after(() => { manager.clear(); map.dispose(); });
  manager.update(dt);
  const startZombie = select(manager);
  assert.ok(startZombie);
  assert.ok(map.spawnPoints.some((p) => p.zone === 'startRoom' && p.position.equals(startZombie.position)));
  manager.clear();
  const configurations = [
    ['hallway entrances', ['startShutter', 'foodCourt', 'megaMart', 'serviceCorridor']],
    ['shortcut entrances', ['startShutter', 'foodCourt', 'foodCourtMegaMart', 'serviceCorridorFoodCourt']],
    ['both loops', map.doors.map((d) => d.id)],
  ];
  for (const [configuration, doorIds] of configurations) {
    map.reset();
    for (const door of map.doors) if (doorIds.includes(door.id)) door.open();
    for (let tick = 0; tick < Math.ceil((feel.world.shutterOpenSeconds + 0.5) / dt); tick++) map.update(dt);

    for (const [name, x, z] of [
      ['hallway', 0, 2], ['food entrance', 0, -5], ['mega aisle', 29.25, -14],
      ['service end', -21.8, -12.2], ['ammo cache', -18.4, -5.1], ['start room', 0, 12],
    ]) {
      player.position.set(x, 0, z);
      manager.nav.markDirty();
      manager.update(dt);
      const eligible = map.spawnPoints.filter((p) =>
        map.zones[p.zone].open &&
        p.position.distanceTo(player.position) >= zombieCrowd.minSpawnDistance &&
        Number.isFinite(manager.nav.distanceToTarget(p.position.x, p.position.z)),
      );
      const costs = eligible.map((p) => manager.nav.distanceToTarget(p.position.x, p.position.z));
      const oldMean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
      const maxCost = Math.min(...costs) + zombieSpawn.neighbourhoodCostAllowance;
      const origins = new Set();
      let totalCost = 0;
      let count = 0;
      for (const nearby of [true, false]) {
        for (let sample = 0; sample < 40; sample++) {
          const zombie = select(manager, nearby, (sample + 0.5) / 40);
          assert.ok(zombie, `${name}: a safe marker exists`);
          const cost = manager.nav.distanceToTarget(zombie.position.x, zombie.position.z);
          assert.ok(cost <= maxCost, `${name}: selected marker belongs to the neighbourhood`);
          origins.add(`${zombie.position.x},${zombie.position.z}`);
          totalCost += cost;
          count++;
          manager.clear(); // isolated first-spawn distribution, without occupancy/cooldown effects
        }
      }
      // Use every local marker up to four. (A far corner like the ammo cache can have only two close ones.)
      const local = costs.filter((cost) => cost <= maxCost).length;
      assert.ok(origins.size >= Math.min(4, local), `${configuration}, ${name}: preserve multiple spawn origins (${origins.size} of ${local} local)`);
      assert.ok(totalCost / count < oldMean, `${configuration}, ${name}: mean route cost should improve`);
    }
  }
});
