import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dt, headlessGame } from './helpers/headlessGame.js';
import { economy, zombieHealthFor, zombieHealthForRound, zombieTypeForRound } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { mascotFoamColors, zombieTypes } from '../src/config/zombies.js';
import { castShot } from '../src/weapons/hitscan.js';
import { Zombie } from '../src/zombies/zombie.js';

const type = zombieTypes.mascot;
const mix = economy.zombieMix.mascot;
const hit = (zombie, damage) => zombie.takeHit({ damage, part: 'body', source: 'hazard' });

function fixture(t) {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  const { g } = game;
  g.health.invulnerable = true;
  t.after(() => {
    g.zombies.clear();
    g.map.dispose();
  });
  return { ...game, scene };
}

test('the Mascot first appears in round 10 with its own PA banner and five Shopper health bars', (t) => {
  const { g, tick, hud } = fixture(t);
  assert.equal(mix.fromRound, 10);
  for (let round = 1; round < mix.fromRound; round++) {
    for (let i = 0; i < 100; i++) assert.notEqual(zombieTypeForRound(round, i / 100), 'mascot');
  }
  assert.equal(zombieTypeForRound(10, 0.51), 'mascot');
  for (const round of [10, 12, 20]) assert.equal(zombieHealthFor('mascot', round), zombieHealthForRound(round) * 5);

  const intros = [];
  g.events.on('typeIntro', ({ typeId }) => intros.push(typeId));
  for (const round of [9, 10, 11]) {
    g.rounds.jumpTo(round);
    const spawned = [];
    for (let i = 0; i < 1800 && g.rounds.round === round; i++) {
      tick();
      for (const zombie of g.zombies.zombies) {
        if (!zombie.isAlive) continue;
        spawned.push(zombie.type.id);
        hit(zombie, zombie.health);
      }
    }
    assert.ok(spawned.length > mix.introSpawnIndex);
    if (round === 9) assert.ok(!spawned.includes('mascot'));
    if (round === 10) assert.ok(spawned.slice(0, mix.introSpawnIndex + 1).includes('mascot'));
  }
  assert.equal(intros.filter((id) => id === 'mascot').length, 1);
  assert.equal(hud.calls.filter(([name, banner]) => name === 'showAnnouncement' && banner.text === type.introBanner.text).length, 1);
});

test('two living Mascots reserve the cap, a corpse frees a slot, and a kill pays once with foam', (t) => {
  const { g, scene } = fixture(t);
  const previousMode = feel.effects.blood.mode;
  feel.effects.blood.mode = 'red';
  t.after(() => { feel.effects.blood.mode = previousMode; });
  assert.ok(type.radius <= zombieTypes.cartPusher.radius);
  assert.equal(mix.maxAlive, 2);
  const spawn = (x) => g.zombies.spawn('mascot', new THREE.Vector3(x, 0, 8));
  const first = spawn(-2);
  assert.equal(first.type, type);
  assert.equal(spawn(0).type, type);
  assert.equal(spawn(2).type.id, 'shopper');

  const kills = [];
  g.events.on('kill', ({ zombie }) => kills.push(zombie));
  const points = g.wallet.points;
  g.effects.clear();
  hit(first, first.health);
  hit(first, 1);
  assert.deepEqual(kills, [first]);
  assert.equal(g.wallet.points - points, economy.killValues.mascot);
  assert.equal(g.runStats.kills, 1);
  assert.equal(scene.getObjectByName('mascotDebris'), undefined, 'a lethal hit skips the reveal');
  assert.equal(g.effects.counts.particles, type.deathSplatCount);
  assert.equal(g.effects.counts.pools, 0);
  assert.ok(g.zombies.zombies.includes(first), 'corpse is still on the floor');
  assert.equal(spawn(-3).type, type);

  // Gun and melee both send flesh:true along with the target's palette.
  g.effects.clear();
  g.effects.splat(first.position, new THREE.Vector3(0, 1, 0), first.splatColors, 1, { flesh: true });
  g.effects.update(0);
  const particles = scene.children.find((node) => node.isInstancedMesh && node.instanceColor && node.count === 1);
  assert.ok(particles);
  const color = new THREE.Color();
  particles.getColorAt(0, color);
  assert.equal(color.getHex(), mascotFoamColors[0]);
});

test('half health changes pace once, plays the pop and throws stuffing that resets with the run', (t) => {
  const { g, tick, scene, sounds } = fixture(t);
  g.rounds.jumpTo(mix.fromRound);
  g.rounds.update = () => {};
  const zombie = g.zombies.spawn('mascot', new THREE.Vector3(0, 0, 8));
  zombie.setState('chasing');
  const helmet = zombie.model.root.getObjectByName('mascotHelmet');
  const head = zombie.model.root.getObjectByName('mascotHead');
  const material = helmet.children[0].material;
  const geometry = helmet.children[0].geometry;
  let geometryDisposed = false, materialDisposed = false;
  geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  material.addEventListener('dispose', () => { materialDisposed = true; });

  tick(20);
  const slow = zombie.horizontalSpeed;
  const halfway = zombie.maxHealth * type.mascot.healthFraction;
  hit(zombie, zombie.maxHealth - halfway - 1);
  assert.equal(zombie.mascotHeadOff, false);
  assert.equal(head.visible, false);

  hit(zombie, 1);
  assert.equal(zombie.health, halfway);
  assert.ok(zombie.mascotHeadOff && head.visible);
  assert.equal(zombie.speed, type.mascot.exposedSpeed);
  const debris = scene.getObjectByName('mascotDebris');
  assert.equal(helmet.parent, debris);
  assert.equal(debris.children.length, type.mascot.drop.stuffingCount + 1);
  tick(16);
  g.zombies.render(0, 1);
  assert.ok(zombie.horizontalSpeed > slow * 2);
  assert.ok(helmet.position.length() > 0, 'helmet flies away from the point where it came off');
  const age = zombie.mascotDropAge;
  hit(zombie, 1);
  tick(12);
  assert.ok(zombie.mascotDropAge > age, 'the drop keeps playing instead of restarting');
  assert.equal(sounds.filter((sound) => sound === type.sounds.headPop.name).length, 1);
  assert.equal(scene.getObjectByName('mascotDebris'), debris);

  g.resetRun();
  assert.equal(scene.getObjectByName('mascotDebris'), undefined);
  assert.equal(zombie.model.root.parent, null);
  assert.ok(!g.shootables.includes(zombie));
  assert.equal(g.zombies.aliveCount, 0);
  assert.ok(geometryDisposed && materialDisposed);
});

test('hits follow the visible costume, miss the fallen helmet and find the exposed head', (t) => {
  const scene = new THREE.Scene();
  const zombie = new Zombie({ type, health: 100, position: new THREE.Vector3(2, 0, 3), yaw: Math.PI / 4 });
  const { model } = zombie;
  t.after(() => model.dispose());
  scene.add(model.root);
  zombie.setState('chasing');
  zombie.updateHitboxes();
  const helmet = model.root.getObjectByName('mascotHelmet');
  const head = model.root.getObjectByName('mascotHead');
  const torso = model.root.getObjectByName('mascotTorso');

  function aimAt(group, x, y) {
    const origin = group.localToWorld(new THREE.Vector3(x, y, -2));
    const direction = new THREE.Vector3(0, 0, 1).transformDirection(group.matrixWorld);
    assert.ok(new THREE.Raycaster(origin, direction).intersectObject(group, true).length, 'the ray crosses the model');
    return { origin, direction };
  }
  const shoot = ({ origin, direction }, range = 4) => castShot(origin, direction, range, [], [zombie]);
  const wing = aimAt(helmet, type.mascot.helmet.size[0] * 0.4, type.mascot.helmet.size[1] * 0.3);
  assert.equal(shoot(wing).part, 'head');
  assert.equal(shoot(aimAt(torso, 0, 0)).part, 'body');

  const oldBox = zombie.hitboxes[0].box.clone();
  const corner = new THREE.Vector3(oldBox.max.x - 0.02, oldBox.max.y + 0.1, oldBox.max.z - 0.02);
  assert.equal(shoot({ origin: corner, direction: new THREE.Vector3(0, -1, 0) }, 0.4).target, null,
    'a shot through an empty corner of the rotated broad-phase box misses');

  hit(zombie, zombie.maxHealth * type.mascot.healthFraction);
  assert.ok(zombie.hitboxes[0].box.getSize(new THREE.Vector3()).length() < oldBox.getSize(new THREE.Vector3()).length());
  assert.equal(shoot(wing).target, null, 'a ray through the falling foam no longer hits the zombie');
  assert.equal(shoot(aimAt(head, 0, 0)).part, 'head');
  assert.equal(shoot(aimAt(torso, 0, 0)).part, 'body');
});
