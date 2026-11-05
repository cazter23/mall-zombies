// The Build-A-Blaster ritual in the real game (game/features/workshopRitual.js): handing a gun over, the Courtesy Loaner, the gauge,
// the lever, the maximum time, collection, and the Returns Chute taking its zombies from the round's budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { weapons } from '../src/config/weapons.js';
import { workshopRitual as cfg, buildOf, qualityFor } from '../src/config/workshop.js';
import { economy, zombieCountForRound } from '../src/config/economy.js';
import { withTier } from '../src/weapons/upgrades.js';

const Y = LAYOUT.hallway.height + .3;

function fixture({ guns = [weapons.nailGun], points = 10000, liveRounds = false } = {}) {
  const t = headlessGame(), { g } = t;
  t.tick();
  if (!liveRounds) g.rounds.update = () => {};
  g.zombies.clear();
  g.map.areaUnlocks.openAll();
  g.health.invulnerable = true;
  for (const def of guns) g.gun.give(def);
  t.tick(50);
  g.wallet.earn(points);
  const bench = g.map.features.find(f => f.kind === 'workshop');
  const ritual = g.features.list.find(f => f.feature.kind === 'workshop').instance.ritual;
  const face = (spot, x, z, yaw) => {
    g.player.teleport({ position: new THREE.Vector3(x, spot.y - (spot.y - Y), z), yaw });
    g.player.pitch = 0;
    t.tick();
  };
  const hold = () => { t.press('KeyF', 20); t.tick(); };
  return {
    ...t, bench, ritual,
    /** Stand at the bench and hold interact. */
    atBench() { face(bench.position, bench.position.x, bench.position.z - 1, Math.PI); },
    startRitual() { ritual.choose('smoothie', 'headshot'); this.atBench(); hold(); },
    atLever() { const s = bench.stations.lever; face(s, s.x - 1, s.z, -Math.PI / 2); },
    pullLever() { this.atLever(); hold(); },
    atBooth() { const s = bench.stations.booth; face(s, s.x - 1, s.z, -Math.PI / 2); },
    collect() { this.atBooth(); hold(); },
    away() { g.player.teleport({ position: new THREE.Vector3(0, 0, 12), yaw: 0 }); t.tick(); },
    /** A zombie dying at a spot (killed by a hazard, like any non-gun kill). */
    killAt(x, y, z) {
      const zombie = g.zombies.spawn('shopper', new THREE.Vector3(x, 0, z));
      zombie.position.y = y; zombie.setState('chasing');
      zombie.takeHit({ damage: zombie.health + 1, part: 'body', source: 'hazard' });
      return zombie;
    },
  };
}

test('the bench charges the live price, takes the gun in hand and brings up your other gun', () => {
  const t = fixture({ guns: [weapons.nailGun] }), { g, ritual } = t;
  assert.deepEqual(g.gun.slots, ['stapleGun', 'nailGun']);
  ritual.choose('smoothie', 'headshot');
  t.atBench();
  assert.equal(g.interactions.prompt?.id, 'ritual');
  assert.equal(g.interactions.prompt.cost, economy.upgrades.workshop.ritual);
  const before = g.wallet.points;
  let started = null;
  g.events.on('ritualStart', e => { started = e; });
  t.press('KeyF', 20);
  assert.equal(g.wallet.points, before - economy.upgrades.workshop.ritual);
  assert.equal(ritual.phase, 'running');
  assert.deepEqual(g.gun.slots, ['stapleGun']);
  assert.equal(g.gun.def.id, 'stapleGun');
  assert.equal(g.gun.isLoaner, false, 'no loaner for a player with a second gun');
  assert.equal(g.gun.away.def.id, 'nailGun');
  assert.equal(started.gunId, 'nailGun');
  assert.equal(started.loaner, false);
  g.map.dispose();
});

test('a player with one gun gets the Courtesy Loaner, cannot upgrade it, and it goes back at collection', () => {
  const t = fixture({ guns: [] }), { g, ritual } = t;
  const startingGun = g.gun.weapon;
  t.startRitual();
  assert.equal(ritual.phase, 'running');
  assert.deepEqual(g.gun.slots, ['stapleGun'], 'lent a Staple Gun');
  assert.equal(g.gun.isLoaner, true);
  assert.equal(g.gun.def.name, cfg.loaner.name);
  assert.notEqual(g.gun.weapon, startingGun, 'the loaner is its own gun');
  t.tick(30);
  assert.equal(g.gun.isSwitching, false);
  // Nothing can be bought for it.
  const desk = g.map.features.find(f => f.kind === 'upgradeDesk');
  g.player.teleport({ position: new THREE.Vector3(desk.position.x, 0, desk.position.z - 1), yaw: Math.PI }); t.tick();
  assert.notEqual(g.interactions.prompt?.kind, 'tier', 'no warranty on a loaner');
  t.pullLever();
  assert.equal(ritual.phase, 'ready');
  t.collect();
  assert.equal(ritual.phase, 'idle');
  assert.deepEqual(g.gun.slots, ['stapleGun']);
  assert.equal(g.gun.isLoaner, false);
  assert.equal(g.gun.weapon, startingGun, 'your own gun came back');
  assert.ok(buildOf(g.gun.modsFor('stapleGun')));
  assert.equal(g.gun.def.name, weapons.stapleGun.name);
  g.map.dispose();
});

test('kills fill the gauge only in the room, and the kill count sets the quality', () => {
  const t = fixture(), { g, ritual, bench } = t;
  t.startRitual();
  const hall = bench.stations.rooms[1], shop = bench.stations.rooms[0];
  const [x, z] = [(hall.minX + hall.maxX) / 2 + 5, hall.maxZ - 1];
  t.killAt(0, 0, 4); // downstairs in the hallway, under the slab
  t.killAt(0, Y, 2); // on the Promenade
  assert.equal(ritual.status.kills, 0, 'kills outside the room do not count');
  t.killAt(x, Y, z);
  t.killAt((shop.minX + shop.maxX) / 2, Y, 8); // the storefront is part of the room
  assert.equal(ritual.status.kills, 2);
  for (let i = 0; i < 8; i++) t.killAt(x, Y, z);
  assert.equal(ritual.status.kills, 10);
  assert.equal(ritual.status.quality.id, 'extraStuffed');
  assert.equal(ritual.status.next.id, 'overstuffed');
  t.pullLever();
  t.killAt(x, Y, z);
  assert.equal(ritual.status.kills, 10, 'the tank is sealed once the ritual ends');
  t.collect();
  const build = buildOf(g.gun.modsFor('nailGun'));
  assert.equal(typeof build.name, 'string');
  assert.deepEqual({ ...build, name: undefined }, { name: undefined, stuffing: 'smoothie', heart: 'headshot', quality: 'extraStuffed', kills: 10 });
  g.map.dispose();
});

test('quality thresholds run Understuffed, Regular, Extra Stuffed, Overstuffed', () => {
  assert.deepEqual([0, 3, 4, 8, 9, 14, 15, 40].map(k => qualityFor(k).id), ['understuffed', 'understuffed', 'regular', 'regular',
    'extraStuffed', 'extraStuffed', 'overstuffed', 'overstuffed']);
  assert.deepEqual(cfg.qualities.map(q => q.minKills), [0, 4, 9, 15]);
  assert.equal(cfg.maxSeconds, 45);
});

test('the maximum time ends it, walking away and coming back works, and the gun waits as long as it takes', () => {
  const t = fixture(), { g, ritual, tick } = t;
  t.startRitual();
  let ready = null;
  g.events.on('ritualReady', e => { ready = e; });
  t.away();
  assert.equal(ritual.phase, 'running', 'doors stay open: leaving does not stop it');
  tick(Math.ceil(cfg.maxSeconds * 60));
  assert.equal(ritual.phase, 'ready');
  assert.equal(ready.reason, 'time');
  assert.equal(ready.quality.id, 'understuffed');
  tick(60 * 120);
  assert.equal(ritual.phase, 'ready', 'no deadline on collecting');
  assert.deepEqual(g.gun.slots, ['stapleGun']);
  t.collect();
  assert.equal(ritual.phase, 'idle');
  assert.equal(g.gun.def.id, 'nailGun');
  g.map.dispose();
});

test('the conveyor carries the gun through every stage and it reaches the end of the belt', () => {
  const t = fixture(), { g, ritual, bench, tick } = t;
  const scene = g.features.context.scene;
  t.startRitual();
  const gunOnBelt = scene.getObjectByName('ritualGun');
  assert.ok(gunOnBelt, 'the gun is on the conveyor');
  assert.ok(gunOnBelt.position.distanceTo(bench.stations.path[0]) < .1);
  const stages = [];
  g.events.on('ritualStage', ({ stage }) => stages.push(stage.id));
  tick(Math.ceil(cfg.maxSeconds * 30));
  const middle = gunOnBelt.position.clone();
  assert.ok(middle.distanceTo(bench.stations.path[0]) > 2, 'it moved along the belt');
  tick(Math.ceil(cfg.maxSeconds * 30) + 2);
  assert.deepEqual(stages, cfg.stages.slice(1).map(s => s.id));
  tick(Math.ceil(cfg.catchUpSeconds * 60) + 2);
  assert.ok(gunOnBelt.position.distanceTo(bench.stations.path.at(-1)) < .01, 'and waits at the end');
  t.collect();
  assert.equal(scene.getObjectByName('ritualGun'), undefined, 'gone once collected');
  assert.ok(ritual.status === null);
  g.map.dispose();
});

test('the lever hurries the gun to the end of the belt', () => {
  const t = fixture(), { g, bench, tick } = t;
  t.startRitual();
  t.pullLever();
  tick(Math.ceil(cfg.catchUpSeconds * 60) + 2);
  const gunOnBelt = g.features.context.scene.getObjectByName('ritualGun');
  assert.ok(gunOnBelt.position.distanceTo(bench.stations.path.at(-1)) < .01);
  g.map.dispose();
});

test('the lever and booth only answer at the right time, and the bench takes one gun at a time', () => {
  const t = fixture(), { g } = t;
  t.atLever();
  assert.equal(g.interactions.prompt, null, 'nothing to pull before a ritual');
  t.atBooth();
  assert.equal(g.interactions.prompt, null, 'nothing to collect before a ritual');
  t.startRitual();
  t.atBench();
  assert.equal(g.interactions.prompt, null, 'the bench is busy');
  t.atLever();
  assert.equal(g.interactions.prompt?.id, 'lever');
  t.atBooth();
  assert.equal(g.interactions.prompt, null, 'not ready yet');
  t.pullLever();
  t.atBench();
  assert.equal(g.interactions.prompt, null, 'still busy until it is collected');
  t.atBooth();
  assert.equal(g.interactions.prompt?.id, 'collect');
  t.collect();
  t.tick(30);
  t.atBench();
  assert.equal(g.interactions.prompt?.id, 'restuff', 'free again, and this gun now has a build');
  g.map.dispose();
});

test('free actions cost nothing, and a player who cannot afford the bench gets a refusal', () => {
  const t = fixture({ points: 0 }), { g, ritual } = t;
  g.wallet.spend(g.wallet.points);
  t.startRitual();
  assert.equal(ritual.phase, 'idle', 'no points, no ritual');
  g.wallet.earn(economy.upgrades.workshop.ritual);
  t.startRitual();
  assert.equal(ritual.phase, 'running');
  assert.equal(g.wallet.points, 0);
  t.pullLever();
  t.collect();
  assert.equal(g.wallet.points, 0);
  g.map.dispose();
});

test('a bench discount reaches the ritual price', () => {
  const t = fixture(), { g } = t;
  g.pricing.setDiscount('workshop', .5);
  t.ritual.choose('smoothie', 'headshot');
  t.atBench();
  assert.equal(g.interactions.prompt.cost, g.pricing.priceOf('workshop', 'ritual'));
  assert.ok(g.interactions.prompt.cost < economy.upgrades.workshop.ritual);
  g.map.dispose();
});

test('gun purchases mid-ritual: the finished gun takes the loaner, a free slot, a bought copy, or the gun in hand', () => {
  // Loaner + a bought gun: the build replaces the loaner.
  let t = fixture({ guns: [] }), { g } = t;
  t.startRitual(); t.tick(30);
  g.gun.give(weapons.nailGun); t.tick(30);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'nailGun']);
  t.pullLever(); t.collect(); t.tick(30);
  assert.deepEqual([...g.gun.slots].sort(), ['nailGun', 'stapleGun']);
  assert.equal(g.gun.def.id, 'stapleGun', 'the finished gun comes up in your hand');
  assert.ok(buildOf(g.gun.modsFor('stapleGun')));
  assert.equal(g.gun.isLoaner, false);
  g.map.dispose();

  // Two guns, one handed over, one bought: a full loadout, so the gun in hand goes (the same rule as a wall buy).
  t = fixture({ guns: [weapons.nailGun] }); ({ g } = t);
  t.startRitual(); t.tick(30);
  g.gun.give(weapons.foamDartBlaster); t.tick(30);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'foamDartBlaster']);
  t.pullLever();
  t.atBooth();
  assert.match(g.interactions.prompt.detail, /Replaces your Foam Dart Blaster/, 'the ticket warns you first');
  t.press('KeyF', 20); t.tick(30);
  assert.deepEqual([...g.gun.slots].sort(), ['nailGun', 'stapleGun'], 'the Foam Dart Blaster was in hand, so it went');
  assert.equal(g.gun.def.id, 'nailGun');
  g.map.dispose();

  // Bought the same gun again: the finished gun replaces the copy, never two of one gun.
  t = fixture({ guns: [weapons.nailGun] }); ({ g } = t);
  t.startRitual(); t.tick(30);
  g.gun.give(weapons.nailGun); t.tick(30);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'nailGun']);
  t.pullLever(); t.collect(); t.tick(30);
  assert.deepEqual([...g.gun.slots].sort(), ['nailGun', 'stapleGun']);
  assert.ok(buildOf(g.gun.modsFor('nailGun')), 'the finished one, not the copy');
  g.map.dispose();
});

test('a loaner replaced by a bought gun does not cost you anything at collection', () => {
  const t = fixture({ guns: [] }), { g } = t;
  t.startRitual(); t.tick(30);
  g.gun.give(weapons.nailGun); t.tick(30);
  g.gun.give(weapons.foamDartBlaster); t.tick(30); // hand is the nail gun; the loaner stays in the other slot
  assert.deepEqual(g.gun.slots, ['stapleGun', 'foamDartBlaster']);
  assert.equal(g.gun.def.id, 'foamDartBlaster');
  t.pullLever(); t.collect(); t.tick(30);
  assert.deepEqual([...g.gun.slots].sort(), ['foamDartBlaster', 'stapleGun']);
  assert.equal(g.gun.isLoaner, false);
  assert.equal(g.gun.def.id, 'stapleGun');
  assert.equal(g.gun.def.name, weapons.stapleGun.name, 'your own Staple Gun, not the loaner');
  g.map.dispose();
});

test('upgrades stay on the gun while it is away, and it comes back loaded with its reserve untouched', () => {
  const t = fixture({ guns: [weapons.nailGun] }), { g } = t;
  const mods = withTier(weapons.nailGun, [], 'deluxe');
  g.gun.setMods('nailGun', mods);
  g.gun.weapon.magazine = 3;
  const reserve = g.gun.weapon.reserve;
  t.startRitual();
  t.pullLever();
  t.collect(); t.tick(30);
  assert.equal(g.gun.def.id, 'nailGun');
  assert.deepEqual(g.gun.modsFor('nailGun').map(m => m.id), ['tier', 'build']);
  assert.equal(g.gun.weapon.magazine, g.gun.def.magazineSize);
  assert.equal(g.gun.weapon.reserve, reserve);
  g.map.dispose();
});

test('a Limited Edition and a ritual sit on one gun without getting in each other\'s way', () => {
  const t = fixture({ guns: [weapons.priceGun] }), { g } = t;
  g.gun.setMods('priceGun', [{ id: 'workshop', workshop: 'clearanceRack' }]);
  t.atBench();
  t.ritual.choose('smoothie', 'lastRound');
  t.atBench();
  assert.equal(g.interactions.prompt?.id, 'ritual', 'same gun, at the bench');
  t.press('KeyF', 20);
  t.pullLever(); t.collect(); t.tick(30);
  assert.deepEqual(g.gun.modsFor('priceGun').map(m => m.id), ['workshop', 'build']);
  g.map.dispose();
});

test('Play again mid-ritual: nothing survives, and the game equals a fresh one', () => {
  for (const finish of [false, true]) {
    const t = fixture({ guns: [] }), { g, ritual } = t;
    const scene = g.features.context.scene;
    t.startRitual();
    if (finish) t.pullLever();
    g.resetRun();
    t.tick();
    assert.equal(ritual.phase, 'idle');
    assert.equal(ritual.status, null);
    assert.equal(g.gun.away, null);
    assert.equal(g.gun.isLoaner, false);
    assert.deepEqual(g.gun.slots, ['stapleGun']);
    assert.equal(scene.getObjectByName('ritualGun'), undefined);
    assert.equal(buildOf(g.gun.modsFor('stapleGun')), null);
    g.map.dispose();
  }
});

test('dying mid-ritual: the ritual stops with the run, and Play again starts clean', () => {
  const t = fixture({ guns: [] }), { g, ritual } = t;
  t.startRitual();
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  assert.equal(g.state.over, true);
  const elapsed = ritual.status.secondsLeft;
  t.tick(120);
  assert.equal(ritual.status.secondsLeft, elapsed, 'the clock stops at death');
  g.resetRun();
  t.tick();
  assert.equal(ritual.phase, 'idle');
  assert.deepEqual(g.gun.slots, ['stapleGun']);
  const fresh = headlessGame();
  assert.deepEqual(snapshot(g).guns, snapshot(fresh.g).guns);
  g.map.dispose(); fresh.g.map.dispose();
});

test('the Returns Chute: spawns steer to it only while a ritual runs and you are in the room', () => {
  const t = fixture(), { g, ritual, bench } = t;
  const chutes = bench.stations.chute.map(c => c.position);
  const atChute = z => chutes.some(p => Math.hypot(p.x - z.position.x, p.z - z.position.z) < .01) && z.position.y === Y;
  // No ritual: never.
  g.player.teleport({ position: new THREE.Vector3(1, Y, 14), yaw: 0 }); t.tick();
  for (let i = 0; i < 12; i++) { const z = g.zombies.spawn(); assert.ok(z); assert.equal(atChute(z), false); g.zombies.clear(); t.tick(); }
  t.startRitual();
  g.player.teleport({ position: new THREE.Vector3(1, Y, 14), yaw: 0 }); t.tick();
  for (let i = 0; i < 6; i++) { const z = g.zombies.spawn(); assert.ok(atChute(z), `spawned at ${z.position.toArray()}`); g.zombies.clear(); t.tick(); }
  // Left the room: back to normal, and it comes back with you.
  g.player.teleport({ position: new THREE.Vector3(14, Y, 2), yaw: 0 }); t.tick();
  for (let i = 0; i < 12; i++) { const z = g.zombies.spawn(); assert.equal(atChute(z), false); g.zombies.clear(); t.tick(); }
  g.player.teleport({ position: new THREE.Vector3(1, Y, 14), yaw: 0 }); t.tick();
  assert.ok(atChute(g.zombies.spawn()));
  g.zombies.clear();
  // Finished: back to normal for good.
  t.pullLever();
  g.player.teleport({ position: new THREE.Vector3(1, Y, 14), yaw: 0 }); t.tick();
  for (let i = 0; i < 12; i++) { const z = g.zombies.spawn(); assert.equal(atChute(z), false); g.zombies.clear(); t.tick(); }
  assert.equal(ritual.phase, 'ready');
  g.map.dispose();
});

test('standing on the chute falls back to normal spawns instead of dropping one on your head', () => {
  const t = fixture(), { g, bench } = t;
  t.startRitual();
  const p = bench.stations.chute[1].position;
  g.player.teleport({ position: new THREE.Vector3(p.x, Y, p.z - .6), yaw: 0 }); t.tick();
  const z = g.zombies.spawn();
  assert.ok(z, 'still spawns');
  assert.ok(Math.hypot(z.position.x - g.player.position.x, z.position.z - g.player.position.z) >= 4, 'never on top of the player');
  g.map.dispose();
});

test('a full round played through a ritual: the chute adds no zombies and the round still ends', () => {
  const t = fixture({ liveRounds: true }), { g, ritual, bench, tick } = t;
  g.rounds.jumpTo(3);
  const round = g.rounds.round;
  const budget = zombieCountForRound(round);
  t.startRitual();
  g.player.teleport({ position: new THREE.Vector3(2, Y, 24), yaw: 0 }); t.tick();
  const chutes = bench.stations.chute.map(c => c.position);
  const seen = new Set();
  let viaChute = 0;
  for (let i = 0; i < 60 * 240 && g.rounds.round === round; i++) {
    tick();
    if (i % 3) continue;
    for (const z of g.zombies.zombies) {
      if (seen.has(z)) continue;
      seen.add(z);
      if (chutes.some(p => Math.hypot(p.x - z.position.x, p.z - z.position.z) < .01)) viaChute++;
    }
    // A perfect marksman: everything that has finished rising dies where it stands.
    for (const z of [...g.zombies.zombies]) if (z.isAlive && z.state !== 'spawning') z.takeHit({ damage: z.health + 1, part: 'body', source: 'hazard' });
  }
  assert.equal(g.rounds.round, round + 1, 'the round ended');
  assert.equal(seen.size, budget, 'exactly the round\'s budget spawned');
  assert.ok(viaChute > 0, `${viaChute} came through the chute`);
  assert.ok(['running', 'ready'].includes(ritual.phase));
  g.map.dispose();
});

test('the debug command puts you at the bench', () => {
  const t = headlessGame(), { g } = t;
  t.tick();
  assert.equal(g.map.zones.upstairs.open, false);
  g.debug.run('workshop');
  t.tick();
  assert.equal(g.map.zones.upstairs.open, true);
  assert.equal(g.interactions.prompt?.id, 'ritual');
  g.map.dispose();
});
