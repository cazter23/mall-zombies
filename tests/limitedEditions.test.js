// Limited Editions (game/features/limitedEditions.js): no longer on sale. A zombie with a shopping bag sometimes drops one for a gun you carry.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { weapons } from '../src/config/weapons.js';
import { limitedEditionDrops as cfg, workshopBuilds, workshopModOf, buildOf } from '../src/config/workshop.js';
import { withTier, withAttachment } from '../src/weapons/upgrades.js';

const Y = LAYOUT.hallway.height + .3;

function fixture({ guns = [weapons.priceGun], round = cfg.fromRound } = {}) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.map.areaUnlocks.openAll();
  g.health.invulnerable = true;
  for (const def of guns) g.gun.give(def);
  t.tick(50);
  g.rounds.jumpTo(round);
  g.rounds.update = () => {};
  const { drops } = g.features.list.find(f => f.feature.kind === 'workshop').instance;
  const kill = ({ bag = true, at = [8, 0, 3] } = {}) => {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(at[0], 0, at[2]));
    zombie.position.y = at[1];
    zombie.model.hasBag = bag;
    zombie.setState('chasing');
    zombie.takeHit({ damage: zombie.health + 1, part: 'body', source: 'gun' });
    return zombie;
  };
  return { ...t, drops, kill };
}
const alwaysDrop = (ctx) => ctx.mock.method(Math, 'random', () => 0);
const neverDrop = (ctx) => ctx.mock.method(Math, 'random', () => .999);

test('Limited Editions are off the shelf: no prompt sells one anywhere in the shop', () => {
  const t = fixture({ guns: [weapons.priceGun] }), { g } = t;
  const bench = g.map.features.find(f => f.kind === 'workshop');
  assert.equal(bench.limitedEdition, undefined);
  for (const z of [6.6, 7.2, 8, 9]) {
    for (const x of [-1, 0, 1]) {
      for (const yaw of [0, Math.PI]) {
        g.player.teleport({ position: new THREE.Vector3(x, Y, z), yaw }); t.tick();
        assert.notEqual(g.interactions.prompt?.id, 'clearanceRack');
      }
    }
  }
  g.map.dispose();
});

test('walking over a bag fits it free to the gun it belongs to, keeping everything else on that gun', (ctx) => {
  const t = fixture({ guns: [weapons.priceGun] }), { g, drops } = t;
  alwaysDrop(ctx);
  const tier = withTier(weapons.priceGun, [], 'deluxe');
  const mods = [...withAttachment(weapons.priceGun, tier, 'jumboPack'), { id: 'build', build: { name: 'Doris', stuffing: 'smoothie', heart: 'headshot', quality: 'regular', kills: 5 } }];
  g.gun.setMods('priceGun', mods);
  const dropped = [], fitted = [];
  g.events.on('limitedEditionDrop', e => dropped.push(e));
  g.events.on('limitedEditionFitted', e => fitted.push(e));
  const zombie = t.kill();
  assert.equal(drops.bag?.id, 'clearanceRack');
  assert.equal(dropped.length, 1);
  assert.ok(drops.bag.position.distanceTo(zombie.position) < .01, 'where it fell');
  assert.ok(t.hud.calls.some(c => c[0] === 'showAnnouncement' && c[1].text === dropped[0].pa.text), 'the PA says so');
  const points = g.wallet.points;
  g.player.teleport({ position: drops.bag.position.clone(), yaw: 0 }); t.tick(2);
  assert.equal(drops.bag, null, 'picked up');
  assert.equal(g.wallet.points, points, 'free');
  assert.equal(fitted[0].id, 'clearanceRack');
  assert.equal(workshopModOf(g.gun.modsFor('priceGun')), 'clearanceRack');
  assert.deepEqual(g.gun.modsFor('priceGun').slice(0, -1), mods, 'tier, attachment and build all kept');
  assert.equal(buildOf(g.gun.modsFor('priceGun')).name, 'Doris');
  g.map.dispose();
});

test('it fits a gun you carry but are not holding', (ctx) => {
  const t = fixture({ guns: [weapons.priceGun, weapons.confettiCannon] }), { g, drops } = t;
  alwaysDrop(ctx);
  assert.equal(g.gun.slots.includes('confettiCannon'), true);
  g.gun.setMods('priceGun', [{ id: 'workshop', workshop: 'clearanceRack' }]);
  const inHand = g.gun.def.id;
  t.kill();
  assert.equal(drops.bag.id, 'partyTrap', 'the only one still of use');
  g.player.teleport({ position: drops.bag.position.clone(), yaw: 0 }); t.tick(2);
  assert.equal(workshopModOf(g.gun.modsFor('confettiCannon')), 'partyTrap');
  assert.equal(g.gun.def.id, inHand);
  g.map.dispose();
});

test('no bag, no drop: only a zombie with a shopping bag, from the right round, while nothing else is on the floor', (ctx) => {
  let t = fixture(), { g, drops } = t;
  alwaysDrop(ctx);
  t.kill({ bag: false });
  assert.equal(drops.bag, null, 'no bag on that zombie');
  t.kill();
  const first = drops.bag;
  assert.ok(first);
  t.kill();
  assert.equal(drops.bag, first, 'one bag at a time');
  g.map.dispose();
  t = fixture({ round: cfg.fromRound - 1 }); ({ g, drops } = t);
  t.kill();
  assert.equal(drops.bag, null, 'too early in the run');
  g.map.dispose();
});

test('the chance is respected, and a bag you have no use for never drops', (ctx) => {
  let t = fixture(), { g, drops } = t;
  const random = neverDrop(ctx);
  t.kill();
  assert.equal(drops.bag, null, 'a failed roll');
  random.mock.restore();
  g.map.dispose();
  alwaysDrop(ctx);
  t = fixture({ guns: [weapons.nailGun] }); ({ g, drops } = t);
  t.kill();
  assert.equal(drops.bag, null, 'neither gun carried');
  g.map.dispose();
  t = fixture({ guns: [weapons.priceGun] }); ({ g, drops } = t);
  g.gun.setMods('priceGun', [{ id: 'workshop', workshop: 'clearanceRack' }]);
  t.kill();
  assert.equal(drops.bag, null, 'already fitted');
  g.map.dispose();
});

test('a gun on the conveyor gets no bag, and a bag waits rather than fit a gun you just swapped away', (ctx) => {
  const t = fixture({ guns: [weapons.priceGun] }), { g, drops } = t;
  alwaysDrop(ctx);
  t.kill();
  const position = drops.bag.position.clone();
  g.gun.give(weapons.nailGun); t.tick(50); // replaces the Price Gun in hand
  assert.equal(g.gun.owns('priceGun'), false);
  g.player.teleport({ position, yaw: 0 }); t.tick(2);
  assert.ok(drops.bag, 'it stays on the floor');
  g.gun.give(weapons.priceGun); t.tick(50);
  t.tick(2);
  assert.equal(drops.bag, null, 'and fits when the gun is back');
  assert.equal(workshopModOf(g.gun.modsFor('priceGun')), 'clearanceRack');
  g.map.dispose();
});

test('a bag on another floor is not reachable through it', (ctx) => {
  const t = fixture(), { g, drops } = t;
  alwaysDrop(ctx);
  t.kill({ at: [3, Y, 2] }); // on the Promenade bridge
  g.player.teleport({ position: new THREE.Vector3(3, 0, 2), yaw: 0 }); t.tick(2);
  assert.ok(drops.bag, 'standing right under it');
  g.map.dispose();
});

test('a bag runs out, and Play again clears it', (ctx) => {
  let t = fixture(), { g, drops } = t;
  alwaysDrop(ctx);
  const scene = g.features.context.scene;
  t.kill();
  assert.equal(scene.getObjectByName('limitedEditionBag').visible, true);
  t.tick(Math.ceil(cfg.lifetimeSeconds * 60) + 2);
  assert.equal(drops.bag, null);
  assert.equal(scene.getObjectByName('limitedEditionBag').visible, false);
  t.kill();
  g.resetRun(); t.tick();
  assert.equal(drops.bag, null);
  assert.equal(scene.getObjectByName('limitedEditionBag').visible, false);
  g.map.dispose();
});

test('a dead player picks up nothing and nothing drops', (ctx) => {
  const t = fixture(), { g, drops } = t;
  alwaysDrop(ctx);
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  t.kill();
  assert.equal(drops.bag, null);
  g.map.dispose();
});

test('the zombies that show a shopping bag are the ones that can drop one', () => {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  let bags = 0, plain = 0;
  for (let i = 0; i < 80; i++) {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 12));
    const shown = zombie.model.root.userData.appearance?.held === 'shoppingBag';
    assert.equal(zombie.model.hasBag, shown);
    if (zombie.model.hasBag) bags++; else plain++;
    g.zombies.clear();
  }
  assert.ok(bags > 0 && plain > 0, `${bags} bags, ${plain} without`);
  g.map.dispose();
});

test('both Limited Editions name a gun that exists, and the drop numbers are sane', () => {
  for (const build of Object.values(workshopBuilds)) assert.ok(weapons[build.weapon], build.name);
  assert.ok(cfg.dropChance > 0 && cfg.dropChance < 1);
  assert.ok(cfg.fromRound >= 1);
});

test('the HUD marker points at the bag, says how far, on which floor and how long', (ctx) => {
  const t = fixture(), { g, drops } = t;
  assert.equal(drops.status, null);
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
  g.player.teleport({ position: new THREE.Vector3(0, 0, 12), yaw: 0 }); // facing -Z
  drops.debugDrop('clearanceRack', new THREE.Vector3(0, 0, 4));
  near(drops.status.bearing, 0);
  assert.equal(drops.status.meters, 8);
  assert.equal(drops.status.floor, null);
  assert.equal(drops.status.name, 'Clearance Rack');
  assert.equal(drops.status.seconds, cfg.lifetimeSeconds);

  drops.debugDrop('clearanceRack', new THREE.Vector3(5, 0, 12));
  near(drops.status.bearing, Math.PI / 2); // on your right
  g.player.yaw = Math.PI / 2; // now facing -X, with it directly behind you
  near(Math.abs(drops.status.bearing), Math.PI);

  drops.debugDrop('clearanceRack', new THREE.Vector3(0, 6.3, 12));
  assert.equal(drops.status.floor, cfg.marker.up);
  g.map.dispose();
});
