import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { createMapKit } from '../src/world/mapKit.js';
import { createMallProps } from '../src/maps/mall/props.js';
import { buildLevelTwo } from '../src/maps/mall/levelTwo.js';
import { markCollidersChanged, overlapsSolid } from '../src/world/collision.js';
import { feel } from '../src/config/feel.js';
import { seededRandom } from '../src/world/textures.js';

const Y = LAYOUT.hallway.height + .3;
const contains = (b, x, y, z) => b.containsPoint(new THREE.Vector3(x, y, z));

function fixture() {
  const t = headlessGame();
  t.tick(); t.g.rounds.update = () => {}; t.g.zombies.clear(); t.g.debug.run('doors'); t.g.health.invulnerable = true; t.tick(120);
  return t;
}
function walk(t, yaw, ticks) {
  t.g.player.yaw = yaw; t.press('KeyW', ticks);
}

test('upstairs can extend its supported floor independently of the downstairs hallway', () => {
  const layout = structuredClone(LAYOUT.level2);
  layout.rect.minZ -= 2;
  layout.sections[0].minZ = layout.rect.minZ;
  const kit = createMapKit(new THREE.Group(), []);
  const supportRect = { ...LAYOUT.hallway };
  buildLevelTwo({ kit, props: createMallProps(kit), floorY: Y, supportRect,
    hole: { minX: -16.5, maxX: -11.95, minZ: 1, maxZ: 3 }, layout });
  assert.ok(kit.colliders.some(b => contains(b, 0, Y - .1, layout.rect.minZ + .5)), 'extension has structural floor');
  assert.ok(kit.colliders.some(b => contains(b, 0, Y + 1, layout.rect.minZ - .1)), 'wall follows upstairs bounds');
  assert.ok(!kit.colliders.some(b => contains(b, 0, Y + 1, LAYOUT.hallway.minZ)), 'old hallway boundary does not leave an invisible wall');
  assert.ok(!kit.colliders.some(b => contains(b, 0, Y - .1, 0)), 'existing support is not duplicated');
  assert.equal(LAYOUT.hallway.minZ, -2, 'downstairs was not reshaped');
  kit.dispose();
});

test('widened southern lane supports a real sprint end to end and each reserved expansion stays sealed', () => {
  const t = fixture(), { g } = t;
  g.player.teleport({ position: new THREE.Vector3(-18.5, Y, -3.1), yaw: -Math.PI / 2 });
  t.input.held.add('ShiftLeft'); t.press('KeyW', 300); t.input.clear();
  assert.ok(g.player.position.x > 16, `walked the southern lane: ${g.player.position.toArray()}`);
  assert.equal(g.player.position.y, Y, 'floor supports the new lane all the way');
  assert.ok(!g.colliders.some(b => contains(b, 0, Y + 1, LAYOUT.hallway.minZ)), 'no wall on the old boundary');
  for (const c of LAYOUT.level2.expansionConnections.filter(c => !c.door)) {
    const mid = (c.from + c.to) / 2;
    const x = c.wall === 'north' ? mid : c.wall === 'west' ? -20.15 : 20.15;
    const z = c.wall === 'north' ? 6.15 : mid;
    assert.ok(g.colliders.some(b => contains(b, x, Y + 1, z)), `${c.id} stays sealed even with debug doors open`);
  }
  g.map.dispose();
});

test('the shoe store is a supported two-entrance loop, traversable in both directions with clear thresholds', () => {
  const t = fixture(), { g } = t;
  for (const reversed of [false, true]) {
    const left = reversed ? -5.25 : -8.75;
    g.player.teleport({ position: new THREE.Vector3(left, Y, 4.8), yaw: Math.PI });
    walk(t, Math.PI, 60); assert.ok(g.player.position.z > 9.4, 'walked through entrance into store');
    walk(t, reversed ? Math.PI / 2 : -Math.PI / 2, 42);
    assert.ok(Math.abs(g.player.position.x - (reversed ? -8.75 : -5.25)) < .3, 'crossed behind display');
    walk(t, 0, 60); assert.ok(g.player.position.z < 5.5, 'returned through the other entrance');
    assert.equal(g.player.position.y, Y);
  }
  for (const e of LAYOUT.level2.shoeStore.entrances) {
    const x = (e.from + e.to) / 2;
    for (const z of [5.6, 6, 6.3, 6.7]) assert.equal(overlapsSolid(new THREE.Vector3(x, Y, z),
      feel.player.radius, feel.player.height, g.colliders, feel.movement.stepTolerance), false, 'full standing clearance at threshold');
  }
  g.map.dispose();
});

test('the workshop glass is solid and the room supports both loop directions and zombie pursuit', () => {
  const t = fixture(), { g } = t;
  const front = LAYOUT.level2.rect.maxZ;
  const entrances = LAYOUT.level2.workshop.entrances.map(e => (e.from + e.to) / 2);
  assert.ok(g.colliders.some(b => contains(b, 0, Y + 1.3, front + .13)), 'central display window blocks movement');
  for (const [enter, exit] of [entrances, [...entrances].reverse()]) {
    const start = new THREE.Vector3(enter, Y, front - .9);
    g.player.teleport({ position: start, yaw: Math.PI });
    const destinations = [[enter, front + 2.5], [exit, front + 2.5], [exit, front - .65]];
    for (const [x, z] of destinations) {
      t.input.held.add('KeyW');
      let ticks = 0;
      while (Math.hypot(g.player.position.x - x, g.player.position.z - z) > .15 && ticks++ < 120) {
        g.player.yaw = Math.atan2(g.player.position.x - x, g.player.position.z - z);
        t.tick();
      }
      assert.ok(ticks < 120, 'walkable route through the workshop');
      assert.equal(g.player.position.y, Y);
    }
    t.input.clear();
    const zombie = g.zombies.spawn('shopper', start);
    zombie.position.copy(start);
    zombie.setState('chasing');
    g.player.teleport({ position: new THREE.Vector3(enter, Y, front + 2.7), yaw: 0 });
    for (let i = 0; i < 350 && zombie.position.z < front + 1; i++) t.tick();
    assert.ok(zombie.position.z >= front + 1, 'zombie can pursue the player inside');
    assert.ok(Math.abs(zombie.position.y - Y) < .05);
    g.zombies.clear();
  }
  g.map.dispose();
});

test('the shoe island supports a real momentum vault in either direction with a supported landing', () => {
  const t = fixture(), { g } = t;
  for (const reverse of [false, true]) {
    g.player.teleport({ position: new THREE.Vector3(-7, Y, reverse ? 9.8 : 7.25), yaw: reverse ? 0 : Math.PI });
    t.tick(2); g.player.velocity.set(0, 0, reverse ? -8 : 8);
    t.input.held.add('KeyW'); t.input.held.add('ShiftLeft'); t.input.pressed.add('Space');
    let vaulted = false;
    for (let i = 0; i < 24; i++) { t.tick(); vaulted ||= g.player.vault.active; }
    t.input.clear();
    assert.ok(vaulted, 'jump starts the authored vault');
    assert.ok(reverse ? g.player.position.z < 8.0 : g.player.position.z > 9.1, 'crossed the display');
    assert.ok(g.player.position.y >= Y - .01, 'no unsupported fall');
  }
  g.map.dispose();
});

test('a live zombie follows through either shoe-store entrance, including when the other entrance is blocked', ctx => {
  const t = fixture(), { g } = t;
  const entrances = LAYOUT.level2.shoeStore.entrances;
  for (let index = 0; index < entrances.length; index++) {
    g.zombies.clear();
    const other = entrances[1 - index];
    const blocker = new THREE.Box3(new THREE.Vector3(other.from, Y, 5.9), new THREE.Vector3(other.to, Y + 3, 6.4));
    g.colliders.push(blocker); markCollidersChanged(g.colliders);
    const entry = entrances[index], x = (entry.from + entry.to) / 2;
    const target = new THREE.Vector3(x, Y, 4.8);
    g.player.teleport({ position: target, yaw: Math.PI }); t.tick(20);
    const z = g.zombies.spawn('shopper', new THREE.Vector3(x, Y, 9.6));
    z.position.y = Y; z.prevPosition.copy(z.position); z.setState('chasing'); z.updateHitboxes();
    let crossed = null;
    for (let i = 0; i < 60 * 15 && crossed === null; i++) {
      g.player.teleport({ position: target, yaw: Math.PI }); t.tick();
      if (z.position.z < 5.9) crossed = i / 60;
    }
    assert.notEqual(crossed, null, `zombie uses entrance ${index + 1}: ${z.position.toArray()}`);
    ctx.diagnostic(`Shopper crosses entrance ${index + 1} from 3.6 m inside in ${crossed.toFixed(2)} s`);
    assert.ok(Math.abs(z.position.y - Y) < .05);
    g.colliders.splice(g.colliders.indexOf(blocker), 1); markCollidersChanged(g.colliders);
  }
  g.map.dispose();
});

test('the eastern junction has a clear Atrium approach and broad paths around its low landmark', () => {
  const t = fixture(), { g } = t;
  const paths = [
    { start: [11.1, -2.8], yaw: Math.PI, ticks: 90, axis: 'z', min: 4.2 },
    { start: [17.1, -2.8], yaw: Math.PI, ticks: 90, axis: 'z', min: 4.2 },
    { start: [11.1, 3.6], yaw: -Math.PI / 2, ticks: 80, axis: 'x', min: 17 },
    { start: [13, 3.6], yaw: Math.PI, ticks: 55, axis: 'z', min: 7 },
  ];
  for (const path of paths) {
    g.player.teleport({ position: new THREE.Vector3(path.start[0], Y, path.start[1]), yaw: path.yaw });
    walk(t, path.yaw, path.ticks);
    assert.ok(g.player.position[path.axis] > path.min, `clear junction route from ${path.start}: ${g.player.position.toArray()}`);
    assert.equal(g.player.position.y, Y);
  }
  g.map.dispose();
});

test('Shoppers reach the eastern junction from both escalators and a horde uses both promenade lanes', ctx => {
  // This is a repeatable geometry/routing regression. Random gaits and lane
  // offsets can legitimately make the entire group prefer one of two open
  // routes; hold those draws stable rather than making CI depend on that roll.
  const t = fixture(), { g } = t;
  // Seed gameplay after construction: Three.js UUIDs also consume Math.random,
  // so adding a decorative mesh must not change this routing scenario's gaits.
  ctx.mock.method(Math, 'random', seededRandom(1986));
  const target = new THREE.Vector3(16.7, Y, 2.6);
  const spawn = (x, height, z) => {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(x, height, z));
    zombie.position.y = height; zombie.prevPosition.copy(zombie.position); zombie.setState('chasing'); zombie.updateHitboxes();
    return zombie;
  };
  for (const [name, position] of [
    ['hallway escalator', [0, 0, 2]], ['Atrium escalator', [22, 0, 22]],
  ]) {
    g.zombies.clear(); g.player.teleport({ position: target, yaw: 0 }); t.tick(20);
    const z = spawn(...position); let seconds = null;
    for (let i = 0; i < 60 * 90 && seconds === null; i++) {
      g.player.teleport({ position: target, yaw: 0 }); t.tick();
      if (Math.abs(z.position.y - Y) < .1 && Math.hypot(z.position.x - target.x, z.position.z - target.z) < 2.4) seconds = i / 60;
    }
    assert.notEqual(seconds, null, `${name}: ${z.position.toArray()}`);
    ctx.diagnostic(`Shopper via ${name} reaches east junction in ${seconds.toFixed(1)} s`);
  }
  g.zombies.clear(); g.player.teleport({ position: target, yaw: 0 }); t.tick(20);
  const horde = [];
  for (const z of [-2.8, 4.8]) for (let i = 0; i < 6; i++) horde.push(spawn(-7 - i * .8, Y, z));
  const crossed = new Map(), arrived = new Map();
  for (let i = 0; i < 60 * 55 && arrived.size < horde.length; i++) {
    g.player.teleport({ position: target, yaw: 0 }); t.tick();
    for (const z of horde) {
      if (!crossed.has(z) && z.position.x > 10.5) crossed.set(z, z.position.z);
      if (!arrived.has(z) && Math.hypot(z.position.x - target.x, z.position.z - target.z) < 2.8) arrived.set(z, i / 60);
    }
  }
  assert.equal(arrived.size, 12, `no horde members stuck: ${horde.filter(z => !arrived.has(z)).map(z => z.position.toArray())}`);
  assert.ok([...crossed.values()].some(z => z < 0) && [...crossed.values()].some(z => z > 3.5), 'north and south routes both used');
  ctx.diagnostic(`12-zombie horde: all arrive in ${Math.min(...arrived.values()).toFixed(1)}–${Math.max(...arrived.values()).toFixed(1)} s; both lanes used`);
  g.map.dispose();
});
