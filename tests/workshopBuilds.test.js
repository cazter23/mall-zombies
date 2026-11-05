// What a finished Build-A-Blaster gun does (game/features/workshopStuffings.js): every Stuffing + Heart pair on real shots, quality,
// the daily stock, area stocking, picking at the bins, re-stuffing, kills paying once, and builds stacking with upgrades.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { weapons } from '../src/config/weapons.js';
import { workshopRitual, workshopStuffings, workshopHearts, todayCount, buildOf } from '../src/config/workshop.js';
import { economy, zombieHealthForRound } from '../src/config/economy.js';
import { gunPower, cycleSeconds } from '../src/weapons/gunStats.js';
import { withTier, withAttachment } from '../src/weapons/upgrades.js';
import { sustainedDps } from '../tools/balance.js';

const Y = LAYOUT.hallway.height + .3;
const NO_STATS = { damageMultiplier: 1 };

function fixture({ gun = weapons.nailGun, open = true } = {}) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  if (open) g.map.areaUnlocks.openAll();
  g.health.invulnerable = true;
  if (gun) { g.gun.give(gun); t.tick(50); }
  g.wallet.earn(50000);
  const instance = g.features.list.find(f => f.feature.kind === 'workshop').instance;
  const bench = g.map.features.find(f => f.kind === 'workshop');
  /** Fit a build straight onto the gun in hand, as a finished ritual would. */
  const fit = (stuffing, heart, quality = 'understuffed') => {
    const id = g.gun.def.id;
    g.gun.setMods(id, [...g.gun.modsFor(id).filter(m => m.id !== 'build'), { id: 'build', build: { stuffing, heart, quality, kills: 0 } }]);
  };
  /** A row of still zombies along x at z, on the ground floor. */
  const row = (xs, z = 6, floor = 0, health = 100000) => xs.map(x => {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(x, 0, z));
    zombie.position.y = floor; zombie.setState('chasing'); zombie.speed = 0; zombie.health = health; zombie.updateHitboxes();
    return zombie;
  });
  /** Stand at (x, z) looking at a body part and fire one real shot. */
  const shoot = (zombie, part, from = 12) => {
    t.standAt(zombie.position.x, from);
    const point = zombie.hitboxes.find(h => h.part === part).box.getCenter(new THREE.Vector3());
    g.player.pitch = Math.atan2(point.y - g.player.eyeHeight, from - point.z);
    t.input.held.add('Mouse2'); t.tick(30);
    t.press('Mouse0'); t.input.held.delete('Mouse2');
    t.tick(2);
  };
  return { ...t, ritual: instance.ritual, bench, fit, row, shoot };
}

const PAIRS = Object.keys(workshopStuffings).flatMap(s => Object.keys(workshopHearts).map(h => [s, h]));
const implemented = (s, h) => PAIRS.some(([a, b]) => a === s && b === h);

test('the three first stuffings and two Hearts are all on sale, with the numbers in config', () => {
  for (const id of ['smoothie', 'fryerOil', 'neonTube']) assert.ok(workshopStuffings[id], id);
  for (const id of ['headshot', 'lastRound']) assert.ok(workshopHearts[id], id);
  assert.ok(implemented('smoothie', 'headshot'));
  assert.equal(workshopStuffings.smoothie.stockedBy, null, 'always stocked');
  assert.equal(workshopStuffings.fryerOil.stockedBy, 'foodCourt');
  assert.equal(workshopStuffings.neonTube.stockedBy, 'megaMart');
  assert.equal(todayCount, 3);
});

for (const [stuffing, heart] of PAIRS) {
  test(`${stuffing} + ${heart} fires on real shots`, () => {
    const t = fixture(), { g } = t;
    const fired = [];
    g.events.on('buildFired', e => fired.push(e));
    t.fit(stuffing, heart);
    const [target, neighbour] = t.row([-.9, .9]);
    if (heart === 'headshot') {
      t.shoot(target, 'body');
      assert.equal(fired.length, 0, 'a body shot does not fire the Headshot heart');
      t.shoot(target, 'head');
    } else {
      t.shoot(target, 'head');
      assert.equal(fired.length, 0, 'a full magazine does not fire the Last Round heart');
      g.gun.weapon.magazine = 1;
      t.shoot(target, 'body');
    }
    assert.equal(fired.length, 1, 'fired once');
    assert.equal(fired[0].stuffing, stuffing);
    assert.equal(fired[0].heart, heart);
    assert.equal(fired[0].weaponId, g.gun.def.id);
    if (stuffing === 'smoothie') {
      assert.ok(target.slowTimer > 0 && target.slowFraction < 1, 'target slowed');
      assert.ok(neighbour.slowTimer > 0, 'neighbour slowed');
    } else if (stuffing === 'fryerOil') {
      assert.ok(target.burn, 'target burning');
    } else {
      assert.ok(neighbour.health < 100000, 'the arc reached the neighbour');
    }
    g.map.dispose();
  });
}

test('the Last Round heart goes off where a miss lands', () => {
  const t = fixture(), { g } = t;
  const fired = [];
  g.events.on('buildFired', e => fired.push(e));
  t.fit('smoothie', 'lastRound');
  const [beside] = t.row([9.6], -1); // beside the spot on the hallway's south wall that the shot lands on
  g.gun.weapon.magazine = 1;
  t.standAt(8, 1, 0, 0);
  t.input.held.add('Mouse2'); t.tick(30);
  t.press('Mouse0'); t.tick(2);
  t.input.held.delete('Mouse2');
  assert.equal(g.gun.lastShot.hits.length, 0, 'it hit nothing');
  assert.equal(fired.length, 1, 'and went off anyway');
  assert.ok(beside.slowTimer > 0, 'where it landed');
  g.map.dispose();
});

test('burn: damage in ticks over its seconds, no stacking, and a kill is credited to the build and paid once', () => {
  const t = fixture(), { g } = t;
  const { burn } = workshopStuffings.fryerOil;
  t.fit('fryerOil', 'headshot');
  const [zombie] = t.row([0]);
  const expected = gunPower(g.gun.def, g.stats) * burn.gunSeconds;
  t.shoot(zombie, 'head');
  const afterShot = zombie.health;
  zombie.applyBurn(expected, burn.seconds, burn.tickSeconds); // re-lighting: restarts the clock, adds nothing
  t.tick(Math.ceil(burn.seconds * 60) + 5);
  assert.ok(Math.abs(afterShot - zombie.health - expected) < expected * .2, `took ${afterShot - zombie.health} of ${expected}`);
  assert.equal(zombie.burn, null, 'burnt out');

  const before = g.wallet.points, kills = g.runStats.kills;
  zombie.health = 1;
  zombie.applyBurn(expected, burn.seconds, burn.tickSeconds);
  t.tick(Math.ceil(burn.tickSeconds * 60) + 2);
  assert.equal(zombie.isAlive, false);
  assert.equal(zombie.killedBy, 'build');
  assert.equal(g.wallet.points - before, economy.killValues.shopper, 'the kill value, once, with no +10 on top');
  assert.equal(g.runStats.kills - kills, 1);
  t.tick(120);
  assert.equal(g.wallet.points - before, economy.killValues.shopper);
  g.map.dispose();
});

test('a neon kill pays once, and a stuffing\'s kills never fire a Heart', () => {
  const t = fixture(), { g } = t;
  t.fit('neonTube', 'headshot');
  const fired = [];
  g.events.on('buildFired', e => fired.push(e));
  const [target, a, b] = t.row([0, -1.2, 1.2]);
  a.health = b.health = 1;
  const kills = [];
  g.events.on('kill', e => kills.push(e));
  const before = g.wallet.points;
  t.shoot(target, 'head');
  t.tick(120); // (the cooldown runs out: nothing more may happen)
  assert.equal(fired.length, 1, 'one shot, one proc');
  assert.deepEqual(kills.map(k => k.source).sort(), ['build', 'build']);
  assert.equal(g.wallet.points - before, 2 * economy.killValues.shopper + economy.payouts.nonLethalHit, 'two kills plus the +10 for hitting the target');
  g.map.dispose();
});

test('the Heart has a cooldown, so a fast gun cannot fire it every shot', () => {
  const t = fixture(), { g } = t;
  t.fit('smoothie', 'headshot');
  const fired = [];
  g.events.on('buildFired', e => fired.push(e));
  const [zombie] = t.row([0]);
  t.shoot(zombie, 'head');
  t.press('Mouse0'); t.tick(1);
  assert.equal(fired.length, 1);
  t.tick(Math.ceil(workshopHearts.headshot.cooldownSeconds * 60));
  t.shoot(zombie, 'head');
  assert.equal(fired.length, 2);
  g.map.dispose();
});

test('walls stop stuffings: a smoothie splash or an arc never reaches through a wall', () => {
  const t = fixture(), { g } = t;
  g.colliders.push(new THREE.Box3(new THREE.Vector3(.35, 0, 5), new THREE.Vector3(.45, 3, 7)));
  t.fit('neonTube', 'headshot');
  const [target, shielded] = t.row([-.4, 1.2]);
  t.shoot(target, 'head');
  assert.equal(shielded.health, 100000);
  g.map.dispose();
});

test('stuffings stay on their floor', () => {
  const t = fixture(), { g } = t;
  t.fit('smoothie', 'headshot');
  const [target] = t.row([0]);
  const [above] = t.row([.8], 6, Y);
  t.shoot(target, 'head');
  assert.ok(target.slowTimer > 0);
  assert.equal(above.slowTimer, 0);
  g.map.dispose();
});

test('quality scales a stuffing: Extra Stuffed beats Understuffed, and Overstuffed matches Extra Stuffed', () => {
  const dealt = (quality) => {
    const t = fixture(), { g } = t;
    t.fit('neonTube', 'headshot', quality);
    const zombies = t.row([0, -1.2, 1.2, 2.4, 3.6]);
    t.shoot(zombies[0], 'head');
    const result = zombies.slice(1).reduce((sum, z) => sum + 100000 - z.health, 0);
    g.map.dispose();
    return result;
  };
  const low = dealt('understuffed'), regular = dealt('regular'), high = dealt('extraStuffed'), over = dealt('overstuffed');
  assert.ok(low < regular && regular < high, `${low} < ${regular} < ${high}`);
  assert.equal(over, high);
  assert.equal(workshopRitual.qualities.at(-1).bulge, true, 'Overstuffed differs by looking it');
});

test('picking: a build needs a Stuffing and a Heart, the bench says so, and a real order goes through', () => {
  const t = fixture({ gun: null }), { g, ritual, bench } = t;
  const front = (spot, facing) => {
    g.player.teleport({ position: new THREE.Vector3(spot.x + facing, Y, spot.z), yaw: facing > 0 ? Math.PI / 2 : -Math.PI / 2 });
    g.player.pitch = 0; t.tick();
  };
  const atBench = () => { g.player.teleport({ position: new THREE.Vector3(0, Y, bench.position.z - 1), yaw: Math.PI }); t.tick(); };
  atBench();
  assert.equal(g.interactions.prompt.blocked, 'Pick a Stuffing');
  const points = g.wallet.points;
  t.press('KeyF', 20); t.tick();
  assert.equal(ritual.phase, 'idle', 'refused');
  assert.equal(g.wallet.points, points, 'and nothing charged');

  const bin = bench.stations.bins.find(b => b.id === ritual.today[0]);
  front(bin.position, 1);
  assert.equal(g.interactions.prompt?.id, `stuffing:${bin.id}`);
  t.press('KeyF', 20); t.tick();
  assert.equal(ritual.pick.stuffing, bin.id);
  atBench();
  assert.equal(g.interactions.prompt.blocked, 'Pick a Heart');

  const heart = bench.stations.hearts.find(h => h.id === 'lastRound');
  front(heart.position, -1);
  assert.equal(g.interactions.prompt?.id, 'heart:lastRound');
  t.press('KeyF', 20); t.tick();
  assert.equal(ritual.status.phase, 'picking');
  assert.equal(ritual.status.heart, workshopHearts.lastRound.name);
  atBench();
  assert.equal(g.interactions.prompt.blocked, null);
  t.press('KeyF', 20); t.tick();
  assert.equal(ritual.phase, 'running');
  assert.equal(g.wallet.points, points - economy.upgrades.workshop.ritual);
  assert.equal(ritual.pick.stuffing, null, 'the picks went into the order');
  g.map.dispose();
});

test('today\'s stuffings: Smoothie alone with nothing else owned, up to three once areas are owned, new each round', () => {
  const t = fixture({ gun: null, open: false }), { g, ritual, bench } = t;
  g.debug.run('workshop'); t.tick();
  assert.deepEqual(ritual.today, ['smoothie'], 'the bench is never empty');
  const lamp = id => bench.stations.bins.find(b => b.id === id).lamp.visible;
  assert.equal(lamp('smoothie'), true);
  assert.equal(lamp('fryerOil'), false);
  g.map.zones.foodCourt.open = true;
  t.tick();
  assert.deepEqual([...ritual.today].sort(), ['fryerOil', 'smoothie'], 'owning an area stocks its stuffing at once while a bin is empty');
  assert.equal(lamp('fryerOil'), true);
  g.map.zones.megaMart.open = true;
  g.rounds.jumpTo(4);
  t.tick();
  assert.equal(ritual.today.length, 3);
  assert.equal(new Set(ritual.today).size, 3);
  assert.equal(lamp('neonTube'), true);
  g.map.dispose();
});

test('a bin that closes takes its pick with it', () => {
  const t = fixture({ gun: null }), { g, ritual } = t;
  ritual.choose('fryerOil', 'headshot');
  g.map.zones.foodCourt.open = false;
  g.rounds.jumpTo(5);
  t.tick();
  assert.equal(ritual.pick.stuffing, null);
  assert.equal(ritual.pick.heart, 'headshot');
  g.map.dispose();
});

test('re-stuffing: a built gun costs less, and the new build replaces the old', () => {
  const t = fixture(), { g, ritual, bench } = t;
  t.fit('smoothie', 'headshot', 'regular');
  ritual.choose('neonTube', 'lastRound');
  g.player.teleport({ position: new THREE.Vector3(0, Y, bench.position.z - 1), yaw: Math.PI }); t.tick();
  assert.equal(g.interactions.prompt.id, 'restuff');
  assert.equal(g.interactions.prompt.cost, economy.upgrades.workshop.restuff);
  assert.match(g.interactions.prompt.title, /Re-stuff your Nail Gun/);
  const points = g.wallet.points;
  t.press('KeyF', 20); t.tick();
  assert.equal(g.wallet.points, points - economy.upgrades.workshop.restuff);
  const lever = bench.stations.lever, booth = bench.stations.booth;
  g.player.teleport({ position: new THREE.Vector3(lever.x - 1, Y, lever.z), yaw: -Math.PI / 2 }); t.tick();
  t.press('KeyF', 20); t.tick();
  g.player.teleport({ position: new THREE.Vector3(booth.x - 1, Y, booth.z), yaw: -Math.PI / 2 }); t.tick();
  t.press('KeyF', 20); t.tick(30);
  const build = buildOf(g.gun.modsFor('nailGun'));
  assert.equal(build.stuffing, 'neonTube');
  assert.equal(build.heart, 'lastRound');
  assert.equal(g.gun.modsFor('nailGun').filter(m => m.id === 'build').length, 1);
  g.map.dispose();
});

test('a tier and an attachment stack with a build, in any order, and a build scales with the upgraded gun', () => {
  const t = fixture(), { g } = t;
  const before = gunPower(g.gun.def, g.stats);
  t.fit('neonTube', 'headshot');
  const base = weapons.nailGun;
  g.gun.setMods('nailGun', withTier(base, g.gun.modsFor('nailGun'), 'deluxe'));
  g.gun.setMods('nailGun', withAttachment(base, g.gun.modsFor('nailGun'), 'gripTape'));
  assert.deepEqual(g.gun.modsFor('nailGun').map(m => m.id).sort(), ['attachment:grip', 'build', 'tier']);
  assert.ok(buildOf(g.gun.modsFor('nailGun')));
  assert.ok(gunPower(g.gun.def, g.stats) > before, 'a better gun, a stronger stuffing');
  const fired = [];
  g.events.on('buildFired', e => fired.push(e));
  const [target] = t.row([0, 1]);
  t.shoot(target, 'head');
  assert.equal(fired.length, 1);
  g.map.dispose();
});

test('Play again clears the picks and a burning zombie cannot pay after death', () => {
  const t = fixture(), { g, ritual } = t;
  t.fit('fryerOil', 'headshot');
  ritual.choose('smoothie', 'headshot');
  const [zombie] = t.row([0]);
  zombie.health = 30;
  zombie.applyBurn(600, 3, .5);
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  const points = g.wallet.points;
  t.tick(120);
  assert.equal(zombie.isAlive, false);
  assert.equal(g.wallet.points, points, 'nothing is paid after death');
  g.resetRun(); t.tick();
  assert.equal(ritual.pick.stuffing, null);
  assert.equal(ritual.pick.heart, null);
  assert.equal(ritual.status, null);
  g.map.dispose();
});

// The round curve: a build must add to a gun, not replace it.
test('balance: at its best, a stuffing adds less than the gun itself at every round', () => {
  const extra = workshopRitual.qualities.find(q => q.id === 'extraStuffed').power;
  const { burn } = workshopStuffings.fryerOil, { chain } = workshopStuffings.neonTube;
  const headshotCooldown = workshopHearts.headshot.cooldownSeconds;
  for (const gun of Object.values(weapons)) {
    const power = gunPower(gun, NO_STATS);
    // Best case for neon: every Heart a headshot, always a full chain of zombies in reach.
    const jumps = Math.round(chain.jumps * extra);
    let neon = 0, hit = chain.gunSeconds * extra * power;
    for (let i = 0; i < jumps; i++) { neon += hit; hit *= chain.falloff; }
    const neonPerSecond = neon / Math.max(headshotCooldown, cycleSeconds(gun)); // (a proc needs a shot and the Heart's cooldown)
    assert.ok(neonPerSecond < .6 * power, `${gun.name}: neon adds ${Math.round(neonPerSecond)} per second on ${Math.round(power)}`);
    // One burning zombie: never more than the gun's own second of fire per burn.
    const burnTotal = burn.gunSeconds * extra * workshopHearts.lastRound.strength * power;
    assert.ok(burnTotal < power, `${gun.name}: one burn deals ${Math.round(burnTotal)} of ${Math.round(power)}`);
    // No gun's sustained damage is overtaken: a proc is a bonus on top of shooting.
    const sustained = sustainedDps(gun, 5, { ads: !gun.pellets, samples: 300 });
    assert.ok(burnTotal / burn.seconds < sustained, `${gun.name}: burn per second ${Math.round(burnTotal / burn.seconds)} vs ${Math.round(sustained)}`);
  }
});

test('balance: one proc never kills a full-health zombie outright from round 5 on', () => {
  const extra = workshopRitual.qualities.find(q => q.id === 'extraStuffed').power;
  const { chain } = workshopStuffings.neonTube;
  const hp = zombieHealthForRound(5);
  for (const gun of Object.values(weapons)) {
    const hit = chain.gunSeconds * extra * workshopHearts.lastRound.strength * gunPower(gun, NO_STATS);
    assert.ok(hit < hp, `${gun.name}: a neon arc does ${Math.round(hit)} against ${hp}`);
  }
});
