import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPowerUps } from '../src/game/powerUps.js';
import { createEvents } from '../src/game/events.js';
import { powerUps } from '../src/config/powerUps.js';
import { Weapon } from '../src/weapons/weapon.js';
import { weapons } from '../src/config/weapons.js';
import { createPlayerStats } from '../src/player/stats.js';
import { headlessGame } from './helpers/headlessGame.js';
import { Zombie } from '../src/zombies/zombie.js';
import { zombieTypes } from '../src/config/zombies.js';
import { economy } from '../src/config/economy.js';
import { createPowerUpView } from '../src/fx/powerUpView.js';
import { bossComfort, bossVouchers } from '../src/config/bosses.js';
import { createBossFlashView } from '../src/ui/bossFlash.js';
import { createIncentiveHud } from '../src/ui/incentiveHud.js';
import { createHud } from '../src/ui/hud.js';
import { settingDefs } from '../src/config/settings.js';
import { menuDom } from './helpers/menuDom.js';
import { hitDamage, INSTANT_KILL_DAMAGE } from '../src/weapons/gunStats.js';
import { clearanceBonus, createIncentiveEffects } from '../src/game/incentiveEffects.js';

function fixture(overrides = {}) {
  const events = createEvents();
  const player = { position: new THREE.Vector3(8, 0, 0), prevPosition: new THREE.Vector3(8, 0, 0) };
  const colliders = [new THREE.Box3(new THREE.Vector3(-20, -1, -20), new THREE.Vector3(20, 0, 20))];
  const state = { over: false, assisted: false };
  const stats = createPlayerStats();
  const ammo = new Weapon(weapons.stapleGun, stats);
  const restocks = [], log = [];
  const gun = overrides.gun ?? { slots: ['stapleGun'], weapon: ammo, weaponFor: () => ammo, restock: (fraction) => { restocks.push(fraction); ammo.restock(fraction); } };
  const zombies = overrides.zombies ?? { zombies: [] };
  const wallet = overrides.wallet ?? null;
  const interactions = overrides.interactions ?? null;
  const random = overrides.random ?? (() => 0);
  const { random: _omitRandom, gun: _omitGun, wallet: _omitWallet, interactions: _omitInteractions, zombies: _omitZombies, ...configOverrides } = overrides;
  const config = { ...powerUps, threshold: { min: 2, max: 2 }, ...configOverrides };
  const manager = createPowerUps({ events, player, gun, zombies, colliders, state, stats, wallet, interactions, config, random });
  for (const name of ['powerUpDrop', 'powerUpCollect', 'powerUpExpire', 'powerUpStart', 'powerUpEnd', 'clearanceDetonated']) {
    events.on(name, (event) => log.push([name, event]));
  }
  const kill = (extra = {}, at = new THREE.Vector3()) => events.emit('kill', { zombie: { type: { id: 'shopper' }, position: at }, source: 'gun', ...extra });
  const stand = (x, y = 0, z = 0) => { player.position.set(x, y, z); player.prevPosition.copy(player.position); };
  return { manager, events, player, colliders, state, stats, ammo, zombies, restocks, log, kill, stand };
}

test('type catalog has 11 distinct types (8 common including Paid Break, 3 jackpot) and zero removed IDs', () => {
  const removed = ['blueLightSpecial', 'securitySweep', 'expressCheckout', 'overtimeApproved', 'staffEntrance', 'productRecall'];
  for (const id of removed) assert.equal(Object.hasOwn(powerUps.types, id), false, `${id} should be removed`);
  const entries = Object.entries(powerUps.types);
  assert.equal(entries.length, 11);
  assert.equal(entries.filter(([, def]) => def.tier === 'common').length, 8);
  assert.equal(entries.filter(([, def]) => def.tier === 'jackpot').length, 3);
  assert.ok(powerUps.types.paidBreak);
  assert.ok(powerUps.jackpot.firstRound >= 4);
});

test('earned incentives start in round 2, reward precision, ignore hazards/dummies and defer the drop out of kill listeners', () => {
  const t = fixture({ threshold: { min: 2.5, max: 2.5 } });
  t.events.emit('roundStart', { round: 1 });
  t.kill(); t.kill(); t.manager.update(1 / 60);
  assert.equal(t.manager.pickup, null);
  t.events.emit('roundStart', { round: 2 });
  t.kill({ source: 'hazard' });
  t.kill({ zombie: {} });
  assert.equal(t.manager.progress, 0);
  t.kill({ headshot: true });
  assert.equal(t.manager.progress, 0.5);
  t.kill(); // plus rapid-multikill bonus
  assert.equal(t.manager.pickup, null);
  t.manager.update(1 / 60);
  assert.equal(t.manager.pickup.id, 'shiftBonus', 'full inventory makes restock ineligible');
  assert.equal(t.manager.dropsThisRound, 1);
});

test('only one pickup, no immediate repeats, expiration, per-round cap and reset', () => {
  const t = fixture({ threshold: { min: 1, max: 1 }, maxPerRound: 2 });
  t.events.emit('roundStart', { round: 2 });
  t.kill(); t.manager.update(0.01);
  t.kill(); t.kill();
  assert.equal(t.manager.dropsThisRound, 1);
  t.manager.update(powerUps.lifetime);
  assert.equal(t.manager.pickup, null);
  assert.equal(t.log.filter(([name]) => name === 'powerUpExpire').length, 1);
  t.kill(); t.manager.update(0.01);
  assert.equal(t.manager.pickup.id, 'lossPrevention');
  t.manager.update(powerUps.lifetime);
  t.kill(); t.manager.update(0.01);
  assert.equal(t.manager.pickup, null, 'round cap holds');
  t.events.emit('roundStart', { round: 3 });
  t.kill(); t.manager.update(0.01);
  assert.ok(t.manager.pickup);
  t.manager.reset();
  assert.equal(t.manager.pickup, null);
  assert.equal(t.manager.progress, 0);
  assert.equal(t.manager.dropsThisRound, 0);
});

test('Delivery is not chosen for an empty Cannon tube with already-full reserves (it could add nothing)', () => {
  const t = fixture({ threshold: { min: 1, max: 1 } });
  t.ammo.def = weapons.confettiCannon;
  t.ammo.magazine = 0;
  t.ammo.reserve = weapons.confettiCannon.startingReserve;
  t.events.emit('roundStart', { round: 2 });
  t.kill(); t.manager.update(0.01);
  assert.equal(t.manager.pickup.id, 'shiftBonus');
  t.manager.update(powerUps.lifetime);
  t.ammo.reserve = 0;
  t.kill(); t.manager.update(0.01);
  assert.equal(t.manager.pickup.id, 'stockroomDelivery', 'now it can restore shells');
});

test('pickup uses swept player movement, cannot be collected through a wall or from another floor', () => {
  const t = fixture();
  t.manager.debugDrop('stockroomDelivery'); // at x=8
  t.stand(8, 6);
  t.manager.update(0.01);
  assert.ok(t.manager.pickup, 'downstairs drop cannot be picked up from above');
  t.stand(8.6);
  t.colliders.push(new THREE.Box3(new THREE.Vector3(8.2, 0, -1), new THREE.Vector3(8.3, 3, 1)));
  t.manager.update(0.01);
  assert.ok(t.manager.pickup, 'wall blocks collection');
  t.colliders.pop();
  t.player.prevPosition.set(6, 0, 0);
  t.player.position.set(10, 0, 0);
  t.manager.update(0.01);
  assert.equal(t.manager.pickup, null, 'fast slide crosses and collects');
  assert.deepEqual(t.restocks, [0.5]);
});

test('jackpot tier respects firstRound, rarity, and never drops two jackpots in a row (including Employee of the Month)', () => {
  let nextRand = 0;
  const t = fixture({ threshold: { min: 1, max: 1 }, maxPerRound: 20, random: () => nextRand });

  // Rounds 2 & 3 never produce a jackpot even when random() === 0 (< chance).
  for (const round of [2, 3]) {
    t.events.emit('roundStart', { round });
    for (let i = 0; i < 4; i++) {
      t.kill(); t.manager.update(0.01);
      assert.equal(powerUps.types[t.manager.pickup.id].tier, 'common', `round ${round} drop ${i}`);
      t.manager.update(powerUps.lifetime);
    }
  }

  // Round 4+: random() === 0 triggers a jackpot, immediately followed by a forced common (never two jackpots in a row),
  // and subsequent cycles rotate through all 3 jackpots.
  t.events.emit('roundStart', { round: powerUps.jackpot.firstRound });
  const sequence = [];
  for (let i = 0; i < 6; i++) {
    nextRand = 0;
    t.kill(); t.manager.update(0.01);
    sequence.push(t.manager.pickup.id);
    t.manager.update(powerUps.lifetime);
  }
  const tiers = sequence.map((id) => powerUps.types[id].tier);
  assert.deepEqual(tiers, ['jackpot', 'common', 'jackpot', 'common', 'jackpot', 'common']);
  const droppedJackpots = sequence.filter((_, idx) => idx % 2 === 0);
  assert.equal(new Set(droppedJackpots).size, 3, 'all 3 jackpots rotate before repeating');

  // Employee of the Month guaranteed drops also obey firstRound & never follow a jackpot with a jackpot.
  t.manager.reset();
  t.events.emit('roundStart', { round: powerUps.jackpot.firstRound });
  nextRand = 0;
  t.kill(); t.manager.update(0.01);
  assert.equal(powerUps.types[t.manager.pickup.id].tier, 'jackpot');
  t.manager.update(powerUps.lifetime); // jackpot expires; lastWasJackpot stays true
  t.events.emit('kill', { zombie: { type: { id: 'sirWaffles', guaranteedDrop: true }, position: new THREE.Vector3(2, 0, 0) }, source: 'gun' });
  t.manager.update(0.01);
  assert.equal(powerUps.types[t.manager.pickup.id].tier, 'common', 'EotM after meter jackpot cannot be a jackpot');
  t.manager.update(powerUps.lifetime);
  // Now lastWasJackpot is false -> EotM can roll a jackpot, then a second EotM right after cannot.
  t.events.emit('kill', { zombie: { type: { id: 'sirWaffles', guaranteedDrop: true }, position: new THREE.Vector3(2, 0, 0) }, source: 'gun' });
  t.manager.update(0.01);
  assert.equal(powerUps.types[t.manager.pickup.id].tier, 'jackpot', 'EotM can drop a jackpot after a common');
  t.manager.update(powerUps.lifetime);
  t.events.emit('kill', { zombie: { type: { id: 'sirWaffles', guaranteedDrop: true }, position: new THREE.Vector3(2, 0, 0) }, source: 'gun' });
  t.manager.update(0.01);
  assert.equal(powerUps.types[t.manager.pickup.id].tier, 'common', 'second EotM in a row cannot be a jackpot');

  // Empirical rarity check over 2,400 seeded drops (no Math.random monkeypatch).
  let state = 1337;
  const seeded = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
  const sim = fixture({ threshold: { min: 1, max: 1 }, maxPerRound: 5000, random: seeded });
  sim.events.emit('roundStart', { round: powerUps.jackpot.firstRound });
  let jackpots = 0, prevJackpot = false;
  for (let i = 0; i < 2400; i++) {
    sim.kill(); sim.manager.update(0.01);
    const isJp = powerUps.types[sim.manager.pickup.id].tier === 'jackpot';
    assert.ok(!(prevJackpot && isJp), 'never two jackpots in a row in random stream');
    if (isJp) jackpots++;
    prevJackpot = isJp;
    sim.manager.update(powerUps.lifetime);
  }
  const rate = jackpots / 2400;
  assert.ok(rate >= 0.08 && rate <= 0.14, `expected ~1/9 (~11.1%) jackpot rate, got ${(rate * 100).toFixed(1)}%`);
});

test('an Employee of the Month drop with no useful common still never falls back to a jackpot before firstRound or after one', () => {
  // random() === 0 always: any jackpot left in the pool would be picked first.
  const t = fixture({ random: () => 0 });
  t.events.emit('roundStart', { round: powerUps.firstRound });
  // Full ammo (no Stockroom Delivery), full health (no Paid Break), nobody to mark (no Mystery Shopper): run every other common.
  for (const id of ['shiftBonus', 'lossPrevention', 'inventoryLiquidation', 'employeeDiscount', 'spillCleanup']) {
    assert.ok(t.manager.debugDrop(id, t.player.position));
    t.manager.update(1 / 60);
    assert.ok(t.manager.effects.some((e) => e.id === id), `${id} running`);
  }
  const eotm = () => {
    t.events.emit('kill', { zombie: { type: { id: 'sirWaffles', guaranteedDrop: true }, position: new THREE.Vector3(2, 0, 0) }, source: 'gun' });
    t.manager.update(1 / 60);
    const id = t.manager.pickup?.id;
    t.manager.update(powerUps.lifetime);
    return id;
  };
  assert.equal(powerUps.types[eotm()].tier, 'common', 'round 2: no jackpot even with every common busy');
  t.events.emit('roundStart', { round: powerUps.jackpot.firstRound });
  assert.equal(powerUps.types[eotm()].tier, 'jackpot', 'round 4: a jackpot can come (random 0 < chance)');
  assert.equal(powerUps.types[eotm()].tier, 'common', 'and the next one cannot be a jackpot');
});

test('Black Friday damage maths (gunStats): one-hit on non-bosses, exactly bossDamageMultiplier on bosses, nothing without the flag', () => {
  const def = weapons.stapleGun;
  const hit = { part: 'body', distance: 1 };
  const stats = createPlayerStats();
  const shopper = { type: zombieTypes.shopper, maxHealth: 150 };
  const boss = { type: { id: 'boss', boss: true }, maxHealth: 5000 };
  const plain = hitDamage(def, hit, 0, stats, 1, boss);
  assert.equal(hitDamage(def, hit, 0, stats, 1, shopper), plain, 'no flag: same damage on anyone');
  stats.bossDamageMultiplier = powerUps.types.blackFriday.bossDamageMultiplier;
  assert.equal(hitDamage(def, hit, 0, stats, 1, boss), plain, 'the boss multiplier only counts while instantKill is on');
  stats.instantKill = true;
  assert.equal(hitDamage(def, hit, 0, stats, 1, shopper), INSTANT_KILL_DAMAGE);
  assert.equal(hitDamage(def, hit, 0, stats, 1, boss), plain * powerUps.types.blackFriday.bossDamageMultiplier);
  assert.equal(hitDamage(def, hit, 0, stats, 1, null), plain, 'no target (balance reports): unchanged');
});

test('drop placement stays on the correct floor and refuses unsupported or blocked locations', () => {
  const t = fixture({ placementRadii: [0] });
  assert.equal(t.manager.debugDrop('shiftBonus', new THREE.Vector3(0, 6, 0)), false);
  t.colliders.push(new THREE.Box3(new THREE.Vector3(-2, 5.5, -2), new THREE.Vector3(2, 6, 2)));
  assert.equal(t.manager.debugDrop('shiftBonus', new THREE.Vector3(0, 6, 0)), true);
  assert.equal(t.manager.pickup.position.y, 6);
  t.colliders.push(new THREE.Box3(new THREE.Vector3(-1, 6, -1), new THREE.Vector3(1, 9, 1)));
  assert.equal(t.manager.debugDrop('lossPrevention', new THREE.Vector3(0, 6, 0)), false);
  assert.throws(() => t.manager.debugDrop('toString'), /Unknown incentive/);
});

test('Stockroom Delivery preserves shell reload and ordinary reload progress, topping up a ready magazine only', () => {
  const stats = createPlayerStats();
  for (const def of [weapons.stapleGun, weapons.confettiCannon]) {
    const w = new Weapon(def, stats);
    w.magazine = 0; w.reserve = 2;
    w.startReload();
    const timer = w.reloadTimer, phase = w.reloadPhase;
    w.restock(0.5);
    assert.equal(w.reserve, def.startingReserve);
    assert.equal(w.magazine, 0);
    assert.equal(w.reloadTimer, timer);
    assert.equal(w.reloadPhase, phase);
    w.cancelReload();
    w.restock(0.5);
    assert.equal(w.magazine, def.shellReload ? 0 : Math.ceil(def.magazineSize / 2));
  }
});

test('Loss Prevention shove interrupts every attack and charge phase without damage, collides with walls and leaves risers/corpses alone', () => {
  const floor = new THREE.Box3(new THREE.Vector3(-20, -1, -20), new THREE.Vector3(20, 0, 20));
  const wall = new THREE.Box3(new THREE.Vector3(-2, 0, 0.8), new THREE.Vector3(2, 4, 1.2));
  const player = { position: new THREE.Vector3(0, 0, -1), height: 1.8 };
  for (const id of ['shopper', 'mallWalker', 'cartPusher']) {
    const phases = ['chasing', 'windup', 'swing', ...(id === 'cartPusher' ? ['chargeTelegraph', 'charging', 'crashed', 'chargeRecover'] : [])];
    for (const phase of phases) {
      const z = new Zombie({ type: zombieTypes[id], health: 500, position: new THREE.Vector3(), yaw: 0 });
      z.setState(phase);
      let hits = 0;
      const ctx = {
        colliders: [floor, wall], player, zombies: [z], canAttack: true,
        nav: { directionTo: (a, b, direction) => { direction.x = 0; direction.z = -1; return true; } },
        onPlayerHit: () => { hits++; },
      };
      const shove = powerUps.types.lossPrevention.shoveStagger;
      assert.equal(z.staggerAway(player.position, shove), true);
      const staggerTicks = Math.floor(shove.seconds * 60) - 1;
      for (let i = 0; i < staggerTicks; i++) z.update(1 / 60, ctx);
      assert.equal(hits, 0, `${id}/${phase}: cannot attack during stagger`);
      assert.ok(z.position.z <= 0.8 - z.type.radius + 0.001, 'knockback stops at the wall');
      assert.ok(z.position.z > 0, 'zombie is physically pushed away');
      for (let i = staggerTicks; i < 120; i++) z.update(1 / 60, ctx);
      assert.equal(z.health, 500);
      assert.ok(z.position.z <= 0.8 - z.type.radius + 0.001, 'stays on the clear side of the wall');
      assert.ok(z.staggerTimer < 0.001);
      z.update(1 / 60, ctx);
      assert.ok(Number.isFinite(z.position.y));
      z.respawnAt(new THREE.Vector3(), 0);
      assert.equal(z.staggerTimer, 0, 'rescue clears stagger state');
      assert.equal(z.staggerAway(player.position, powerUps.types.lossPrevention.shoveStagger), false, 'still rising');
      z.die();
      assert.equal(z.staggerAway(player.position, powerUps.types.lossPrevention.shoveStagger), false, 'corpse');
      z.model.dispose();
    }
  }
});

test('real game: Commission Day doubles payouts via wallet multiplier, stops on expiry, and cleans up on death/reset', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {}; // isolate rewards from wave spawns
  g.zombies.clear();
  const at = g.player.position.clone();
  g.powerUps.debugDrop('commissionDay');
  t.tick();
  const effect = g.powerUps.effects.find(e => e.id === 'commissionDay');
  assert.ok(effect);
  assert.equal(g.stats.pointsMultiplier, powerUps.types.commissionDay.pointsMultiplier);
  assert.ok(t.sounds.includes(powerUps.types.commissionDay.sound));
  assert.ok(t.hud.calls.some(([name, data]) => name === 'showAnnouncement'
    && data.text === powerUps.types.commissionDay.pa.text && data.priority === 1));
  const remaining = effect.remaining;
  g.state.forceRun = false;
  t.tick(120);
  assert.equal(effect.remaining, remaining);
  g.state.forceRun = true;

  // Non-lethal hit, kill + headshot, Gold Card, helmet pop: all doubled once while Commission Day is active.
  let before = g.wallet.points;
  g.events.emit('hit', { target: { type: zombieTypes.shopper }, killed: false });
  assert.equal(g.wallet.points - before, economy.payouts.nonLethalHit * 2);

  before = g.wallet.points;
  const z = g.zombies.spawn('shopper', at.clone().add(new THREE.Vector3(1, 0, 0)));
  z.state = 'chasing';
  z.takeHit({ damage: 10000, part: 'head' });
  assert.equal(g.wallet.points - before, (economy.killValues.shopper + economy.payouts.headshotKillBonus) * 2);

  // The Mascot's helmet pop bonus goes through the same multiplier.
  before = g.wallet.points;
  const popper = g.zombies.spawn('mascot', at.clone().add(new THREE.Vector3(-1, 0, 0)), { variant: 'sirWaffles', gold: false });
  g.events.emit('mascotHeadPop', { zombie: popper, headshot: true, source: 'gun', again: false });
  assert.equal(g.wallet.points - before, economy.payouts.helmetPopBonus * 2);

  // Raw wallet.earn (tests / debug points / expired voucher fallback) is never doubled by Commission Day.
  before = g.wallet.points;
  g.wallet.earn(100);
  assert.equal(g.wallet.points - before, 100);

  // Nobody up to fight: the clock holds (holdWhileQuiet). Once a shopper is up, expiry restores exact 1x payouts on time.
  const held = effect.remaining;
  g.powerUps.update(5);
  assert.equal(effect.remaining, held, 'no zombie alive: the clock waits');
  const target = g.zombies.spawn('shopper', at.clone().add(new THREE.Vector3(3, 0, 0)));
  target.setState('chasing');
  g.powerUps.update(powerUps.types.commissionDay.seconds);
  assert.equal(g.stats.pointsMultiplier, 1);
  assert.equal(g.powerUps.effects.length, 0);
  before = g.wallet.points;
  const z2 = g.zombies.spawn('shopper', at.clone().add(new THREE.Vector3(1, 0, 0)));
  z2.state = 'chasing';
  z2.takeHit({ damage: 10000, part: 'body' });
  assert.equal(g.wallet.points - before, economy.killValues.shopper);

  // Death and reset clean everything up.
  g.powerUps.debugDrop('commissionDay');
  t.tick();
  assert.equal(g.stats.pointsMultiplier, 2);
  g.health.takeDamage(10000);
  assert.equal(g.stats.pointsMultiplier, 1);
  assert.equal(g.powerUps.pickup, null);
  assert.equal(g.powerUps.debugDrop('shiftBonus'), false);
  g.resetRun();
  assert.equal(g.powerUps.progress, 0);
  assert.equal(g.powerUps.dropsThisRound, 0);
  assert.equal(g.stats.pointsMultiplier, 1);
});

test('real game: Store-Wide Clearance clears its whole area on its floor with zero per-kill pay, pays the round\'s flat bonus once, spares bosses, and flashes comfortably', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.debug.run('doors'); // every area open
  // In the Main Hallway (x -20..20, z -2..6), near its west end.
  const at = new THREE.Vector3(-12, 0, 2);
  g.player.teleport({ position: at.clone(), yaw: 0 });
  t.tick();
  const def = powerUps.types.storeWideClearance;
  const spawn = (type, x, y, z, opts) => { const z0 = g.zombies.spawn(type, new THREE.Vector3(x, y, z), opts); z0.setState('chasing'); return z0; };

  g.rounds.jumpTo(6);
  assert.equal(g.powerUps.round, 6);
  g.debug.run('summonBoss');
  const boss = g.bosses.active;
  boss.setState('chasing');
  boss.position.set(-12, 0, -0.5);
  boss.health = 5; // near death: clearance must never kill a boss

  // In the Hallway: a shopper, a Mascot, a noRewards zombie, and one at the far end beyond the old 28 m radius.
  const s1 = spawn('shopper', -10, 0, 2);
  const mascot = spawn('mascot', -14, 0, 3, { variant: 'sirWaffles', gold: false });
  const noPay = spawn('mallWalker', -12, 0, 4); noPay.noRewards = true;
  const farEnd = spawn('shopper', 17, 0, 2);
  assert.ok(farEnd.position.distanceTo(at) > def.radius);
  // Not the Hallway: the Food Court 8 m away, the start room, and the Promenade right overhead.
  const foodCourt = spawn('shopper', -12, 0, -6);
  const startRoom = spawn('shopper', 0, 0, 10);
  const upstairs = spawn('shopper', -12, 6.3, 2);
  assert.deepEqual([at, foodCourt.position, startRoom.position, upstairs.position].map((p) => g.map.areaAt(p)),
    ['hallway', 'foodCourt', 'startRoom', 'upstairs'], 'the scenario stands where it means to');

  g.wardrobe.buy('goldCard'); // even with Gold Card, clearance kills pay 0 per-kill points
  const detonated = [];
  const killSources = [];
  g.events.on('clearanceDetonated', (e) => detonated.push(e));
  g.events.on('kill', (e) => killSources.push(e.source));

  const pointsBefore = g.wallet.points;
  const killsBefore = g.runStats.kills;
  g.powerUps.debugDrop('storeWideClearance');
  t.tick();

  assert.equal(s1.isAlive, false);
  assert.equal(mascot.isAlive, false);
  assert.equal(noPay.isAlive, false);
  assert.equal(farEnd.isAlive, false, 'the whole Hallway is cleared, past the old radius');
  assert.equal(foodCourt.isAlive, true, 'another area survives, however close');
  assert.equal(startRoom.isAlive, true, 'the start room survives');
  assert.equal(upstairs.isAlive, true, 'the floor above survives');
  assert.equal(boss.isAlive, true, 'low-HP boss is never killed by clearance');
  assert.ok(boss.health >= 1, 'boss remains alive above 0 health');
  const bonus = clearanceBonus(6, def);
  assert.equal(bonus, 570, 'round 6: 30 x 19 shoppers');
  assert.equal(g.wallet.points - pointsBefore, bonus, 'pays the flat bonus once with zero per-kill points');
  assert.equal(g.runStats.kills, killsBefore + 3, 'pays zero points for kills while still recording non-noRewards kills');
  assert.ok(killSources.every(s => s === 'clearance'));
  assert.equal(detonated.length, 1);
  assert.equal(detonated[0].flatBonus, bonus);
  assert.equal(detonated[0].area, 'hallway');
  assert.ok(t.sounds.includes(def.sound));
  assert.ok(t.hud.calls.some(([name, data]) => name === 'showAnnouncement' && data.text === def.pa.text && data.priority === 1));

  // Verify healthy boss takes bossDamageFraction damage (scaled safely below maxHealth) and respects Comfort flash.
  const fullBossHealth = boss.maxHealth;
  boss.health = fullBossHealth;
  g.powerUps.debugDrop('storeWideClearance');
  t.tick();
  assert.equal(boss.isAlive, true);
  assert.ok(Math.abs(boss.health - fullBossHealth * (1 - def.bossDamageFraction)) < 1);

  menuDom();
  const flashView = createBossFlashView();
  flashView.connect(g.events);
  const prevDim = bossComfort.dimPhoneFlash;
  try {
    bossComfort.dimPhoneFlash = false;
    g.events.emit('clearanceDetonated', { position: at, radius: def.radius, kills: 0, bossesHit: 0, positions: [], flatBonus: 0 });
    assert.equal(flashView.element.style.background, powerUps.visual.clearanceFlash.color);
    bossComfort.dimPhoneFlash = true;
    g.events.emit('clearanceDetonated', { position: at, radius: def.radius, kills: 0, bossesHit: 0, positions: [], flatBonus: 0 });
    assert.equal(flashView.element.style.background, '#000');
  } finally {
    bossComfort.dimPhoneFlash = prevDim;
  }
});

test('Clearance bonus grows with the wave size, and without map areas Clearance falls back to its radius on its floor', () => {
  const def = powerUps.types.storeWideClearance;
  assert.deepEqual([4, 10, 20].map((r) => clearanceBonus(r, def)), [420, 870, 1620]);
  assert.equal(clearanceBonus(0, def), clearanceBonus(1, def), 'never below a round-1 wave');
  const shopper = (x, y = 0) => ({
    isAlive: true, state: 'chasing', removed: false, type: { id: 'shopper' }, position: new THREE.Vector3(x, y, 0),
    takeHit() { this.isAlive = false; return { killed: true }; },
  });
  const run = (areaAt) => {
    const zs = [shopper(-20), shopper(20), shopper(-30), shopper(-5, 6.3)];
    const paid = [];
    const effects = createIncentiveEffects({
      events: createEvents(), player: { position: new THREE.Vector3() }, gun: { slots: [] }, zombies: { zombies: zs },
      stats: createPlayerStats(), wallet: { award: (n) => paid.push(n) }, state: { over: false }, config: powerUps,
      clearLine: () => true, findPosition: (p) => p, areaAt, getRound: () => 10,
    });
    effects.detonateClearance(new THREE.Vector3(0, 0, 0));
    return { alive: zs.map((z) => z.isAlive), paid };
  };
  // No areas: the 28 m radius on the floor.
  assert.deepEqual(run(null), { alive: [false, false, true, true], paid: [870] });
  // Areas (west / east of x = 0, the origin counting as east): the whole east area on its floor, whatever the distance.
  assert.deepEqual(run((p) => (p.x < 0 ? 'west' : 'east')).alive, [true, false, true, true]);
});

test('real game: jackpot clocks hold while no zombie is up to fight, show ON HOLD, and run again once one is', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.powerUps.debugDrop('blackFriday');
  t.tick();
  const effect = g.powerUps.effects.find((e) => e.id === 'blackFriday');
  const start = effect.remaining;
  g.powerUps.update(30);
  assert.equal(effect.remaining, start, 'nobody alive: the clock waits');
  assert.equal(effect.held, true);
  menuDom();
  const hud = createIncentiveHud();
  hud.update({ effects: g.powerUps.effects });
  assert.ok(hud.element.textContent.includes('BLACK FRIDAY · ' + Math.ceil(start) + 's · ' + powerUps.meter.heldLabel));
  const rising = g.zombies.spawn('shopper', g.player.position.clone().add(new THREE.Vector3(3, 0, 0)));
  assert.equal(rising.state, 'spawning');
  g.powerUps.update(1);
  assert.equal(effect.remaining, start, 'a zombie still rising out of its spawn does not count');
  rising.setState('chasing');
  g.powerUps.update(1);
  assert.ok(Math.abs(effect.remaining - (start - 1)) < 1e-9, 'one up: the clock runs');
  assert.equal(effect.held, false);
  hud.update({ effects: g.powerUps.effects });
  assert.ok(!hud.element.textContent.includes(powerUps.meter.heldLabel));
  // Common benefits never hold: Shift Bonus runs down with nobody about.
  g.zombies.clear();
  g.powerUps.debugDrop('shiftBonus');
  t.tick();
  const shift = g.powerUps.effects.find((e) => e.id === 'shiftBonus');
  const shiftStart = shift.remaining;
  g.powerUps.update(1);
  assert.ok(shift.remaining < shiftStart);
  g.powerUps.update(30);
  assert.ok(Math.abs(effect.remaining - (start - 1)) < 1e-9, 'and Black Friday held again meanwhile');
});

test('real game: Black Friday one-shots non-bosses across gun/cone/projectile/melee without editing config, multiplies boss damage cleanly, and resets', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  const at = g.player.position.clone();
  const baseWeaponDamage = weapons.stapleGun.damage;
  const fireCooldown = Math.ceil(weapons.stapleGun.fireInterval * 60) + 3;

  g.powerUps.debugDrop('blackFriday');
  t.tick();
  assert.equal(g.stats.instantKill, true);
  assert.equal(g.stats.bossDamageMultiplier, powerUps.types.blackFriday.bossDamageMultiplier);

  // Regular shopper, armored mascot, and melee all one-shot while Black Friday is active; gun config untouched.
  for (const [typeId, opts] of [['shopper', {}], ['cartPusher', {}], ['mascot', { variant: 'sirWaffles', gold: false }]]) {
    const z = g.zombies.spawn(typeId, at.clone().add(new THREE.Vector3(0, 0, -2)), opts);
    z.setState('chasing');
    z.updateHitboxes();
    t.standAt(at.x, at.z, 0, 0);
    t.press('Mouse0');
    t.tick(fireCooldown);
    assert.equal(z.isAlive, false, `${typeId} dies in one hitscan shot`);
  }
  const meleeVictim = g.zombies.spawn('cartPusher', at.clone().add(new THREE.Vector3(0, 0, -1)));
  meleeVictim.setState('chasing');
  meleeVictim.updateHitboxes();
  t.standAt(at.x, at.z, 0, 0);
  t.press('KeyV', 12);
  t.tick(30);
  assert.equal(meleeVictim.isAlive, false, 'melee one-shots tough non-boss under Black Friday');

  // Projectile gun (tennisBallLauncher) also one-shots cleanly via ballistics.
  g.gun.give(weapons.tennisBallLauncher);
  t.tick(45);
  const ballVictim = g.zombies.spawn('mascot', at.clone().add(new THREE.Vector3(0, 0, -2)), { variant: 'sirWaffles', gold: false });
  ballVictim.setState('chasing');
  ballVictim.updateHitboxes();
  t.standAt(at.x, at.z, 0, 0);
  t.press('Mouse0');
  t.tick(30);
  assert.equal(ballVictim.isAlive, false, 'projectile one-shots non-boss under Black Friday');
  for (let i = 0; i < 600 && g.balls.list.length; i++) t.tick(); // (let the ball finish bouncing: it must not hit the boss below)

  // Boss NEVER dies in one hit and takes bossDamageMultiplier x weapon damage instead.
  // (give() doesn't switch to a gun already carried: it used to fire the tennis ball here, which a weak flat ball hid. Switch to slot 1.)
  t.press('Digit1');
  t.tick(45);
  g.rounds.jumpTo(6);
  g.debug.run('summonBoss');
  const boss = g.bosses.active;
  boss.setState('chasing');
  boss.health = boss.maxHealth = 10000;
  boss.position.copy(at).add(new THREE.Vector3(0, 0, -2));
  boss.updateHitboxes();
  t.standAt(at.x, at.z, 0, 0);
  assert.equal(g.gun.def.id, 'stapleGun', `the staple gun is in hand for the boss check (not ${g.gun.def.id})`);
  t.press('Mouse0');
  t.tick(fireCooldown);
  assert.equal(boss.isAlive, true, 'boss is never one-shot by Black Friday');
  assert.ok(boss.health < 10000 && boss.health >= 10000 - weapons.stapleGun.damage * weapons.stapleGun.headshotMultiplier * powerUps.types.blackFriday.bossDamageMultiplier - 1,
    `boss health ${boss.health} after one staple under Black Friday`);
  assert.equal(weapons.stapleGun.damage, baseWeaponDamage, 'weapon config is never mutated');

  // Expiry restores normal damage & non-instant behavior.
  g.powerUps.update(powerUps.types.blackFriday.seconds);
  assert.equal(g.stats.instantKill, false);
  assert.equal(g.stats.bossDamageMultiplier, 1);
  const tank = g.zombies.spawn('cartPusher', at.clone().add(new THREE.Vector3(0, 0, -2)));
  tank.health = tank.maxHealth = 500;
  tank.setState('chasing');
  tank.updateHitboxes();
  t.standAt(at.x, at.z, 0, 0);
  t.press('Mouse0');
  t.tick(fireCooldown);
  assert.equal(tank.isAlive, true, 'after expiry, shots do normal damage');

  // Reset clears everything even mid-effect.
  g.powerUps.debugDrop('blackFriday');
  t.tick();
  assert.equal(g.stats.instantKill, true);
  g.resetRun();
  assert.equal(g.stats.instantKill, false);
  assert.equal(g.stats.bossDamageMultiplier, 1);
  assert.equal(g.stats.pointsMultiplier, 1);
});

test('real loadout: Delivery fills both upgraded reserves, retains mods and does not finish a Cannon reload', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.gun.give(weapons.confettiCannon);
  t.tick(45);
  const cannon = g.gun.weapon;
  const pistol = g.gun.weaponFor('stapleGun');
  g.gun.setMods('confettiCannon', [{ id: 'test', modifiers: [{ stat: 'startingReserve', op: 'mul', value: 2 }] }]);
  cannon.magazine = 0; cannon.reserve = 2;
  pistol.magazine = 1; pistol.reserve = 0;
  cannon.startReload();
  g.powerUps.debugDrop('stockroomDelivery');
  t.tick();
  assert.equal(cannon.reserve, cannon.def.startingReserve);
  assert.equal(pistol.reserve, pistol.def.startingReserve);
  assert.equal(cannon.magazine, 0);
  assert.equal(cannon.isReloading, true);
  assert.equal(pistol.magazine, 1, 'stowed gun gets reserve ammo only');
  assert.equal(g.gun.modsFor('confettiCannon')[0].id, 'test');
  assert.equal(g.state.assisted, true);
});

test('reusable visuals give every type a distinct low-poly shape, standout jackpots, few meshes, and clean disposal', () => {
  const scene = new THREE.Scene();
  const view = createPowerUpView(scene, []);
  let disposed = 0;
  const geometries = new Set(), materials = new Set();
  view.root.traverse((o) => {
    assert.equal(!!o.isLight, false);
    if (o.geometry && !o.geometry.userData.shared) geometries.add(o.geometry); // (beacon and shared pickup parts are shared, not owned)
    if (o.material && !o.material.userData.shared) materials.add(o.material);
  });
  for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => { disposed++; });

  const fingerprints = new Map();
  const commonY = [], jackpotY = [];
  for (const [id, def] of Object.entries({ ...powerUps.types, ...bossVouchers })) {
    view.update({ id, position: new THREE.Vector3(1, 6, 1), age: 0.5, remaining: 10 }, 1 / 60, []);
    const prop = view.root.getObjectByName(id);
    assert.equal(prop.visible, true);
    assert.ok(prop.position.y > 6.5);
    assert.ok(prop.children.length >= 2 && prop.children.length <= 4, `${id} keeps few merged meshes (got ${prop.children.length})`);

    // Distinct shape fingerprint (vertex counts + bounding box dimensions across merged parts, ignoring scale/color).
    const box = new THREE.Box3();
    const sig = prop.children.map((m) => {
      m.geometry.computeBoundingBox();
      box.copy(m.geometry.boundingBox);
      const size = box.getSize(new THREE.Vector3()).toArray().map((n) => Math.round(n * 100)).join('x');
      return `${m.geometry.attributes.position.count}@${size}`;
    }).sort().join('|');
    assert.equal(fingerprints.has(sig), false, `${id} silhouette collides with ${fingerprints.get(sig)}`);
    fingerprints.set(sig, id);

    if (def.tier === 'jackpot') {
      assert.ok(prop.scale.x > 1.2, `${id} jackpot stands out in scale`);
      assert.ok(prop.userData.halo, `${id} jackpot has orbiting halo`);
      jackpotY.push(prop.position.y);
    } else if (def.tier === 'common') {
      assert.equal(prop.scale.x, 1);
      commonY.push(prop.position.y);
    }
  }
  assert.ok(Math.min(...jackpotY) > Math.max(...commonY), 'jackpots hover visibly higher than commons');
  view.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(disposed, geometries.size + materials.size);
});

test('shared pickup models and materials are built once, reused across views, and never leaked or disposed per pickup', () => {
  const sceneA = new THREE.Scene();
  const viewA = createPowerUpView(sceneA, []);
  const sharedResources = new Set();
  const propGeosA = new Map();
  const propMatsA = new Map();

  for (const id of Object.keys({ ...powerUps.types, ...bossVouchers })) {
    const prop = viewA.root.getObjectByName(id);
    propGeosA.set(id, prop.children.map((m) => m.geometry));
    propMatsA.set(id, prop.children.map((m) => m.material));
    for (const m of prop.children) {
      assert.equal(m.geometry.userData.shared, true, `${id} geometry flagged userData.shared`);
      assert.equal(m.material.userData.shared, true, `${id} material flagged userData.shared`);
      sharedResources.add(m.geometry);
      sharedResources.add(m.material);
    }
  }

  let sharedDisposed = 0;
  for (const r of sharedResources) r.addEventListener('dispose', () => { sharedDisposed++; });

  // Second view shares exact same Geometry & Material instances with zero extra shared allocations.
  const sceneB = new THREE.Scene();
  const viewB = createPowerUpView(sceneB, []);
  for (const id of Object.keys({ ...powerUps.types, ...bossVouchers })) {
    const propB = viewB.root.getObjectByName(id);
    assert.deepEqual(propB.children.map((m) => m.geometry), propGeosA.get(id));
    assert.deepEqual(propB.children.map((m) => m.material), propMatsA.get(id));
  }

  // Disposing viewA frees only owned per-view resources and leaves all shared assets intact for viewB.
  viewA.dispose();
  assert.equal(sceneA.children.length, 0);
  assert.equal(sharedDisposed, 0, 'disposing one view must never dispose shared pickup models/materials');

  // Jackpot beacon stands taller and wider than common beacon while sharing column geometry.
  viewB.update({ id: 'shiftBonus', position: new THREE.Vector3(), age: 0.2, remaining: 10 }, 1 / 60, []);
  const commonBeacon = viewB.root.children.find((c) => c.name === 'beacon' && c.visible);
  viewB.update({ id: 'commissionDay', position: new THREE.Vector3(), age: 0.2, remaining: 10 }, 1 / 60, []);
  const jackpotBeacon = viewB.root.children.find((c) => c.name === 'beacon' && c.visible);
  assert.ok(jackpotBeacon.scale.x > commonBeacon.scale.x && jackpotBeacon.scale.y > commonBeacon.scale.y);
  assert.equal(commonBeacon.children[0].geometry, jackpotBeacon.children[0].geometry);
  viewB.dispose();
  assert.equal(sharedDisposed, 0);

  // Many view create/dispose cycles leave zero scene children and allocate zero additional shared assets.
  for (let i = 0; i < 25; i++) {
    const s = new THREE.Scene();
    const v = createPowerUpView(s, []);
    v.update({ id: 'blackFriday', position: new THREE.Vector3(), age: 1, remaining: 10 }, 1 / 60, []);
    v.dispose();
    assert.equal(s.children.length, 0);
  }
  const sceneC = new THREE.Scene();
  const viewC = createPowerUpView(sceneC, []);
  for (const id of Object.keys(powerUps.types)) {
    const propC = viewC.root.getObjectByName(id);
    for (const m of propC.children) {
      assert.ok(sharedResources.has(m.geometry), `${id} reused shared geometry after 25 cycles`);
      assert.ok(sharedResources.has(m.material), `${id} reused shared material after 25 cycles`);
    }
  }
  viewC.dispose();
});

test('incentive HUD shows Employee of the Hour progress, near-full chime/glow, capped dim state, pickup countdown and clears on death', () => {
  menuDom();
  let chimes = 0;
  const hud = createIncentiveHud({ onNearFull: () => { chimes += 1; } });
  // Before firstRound (round 1): meter is hidden cleanly.
  hud.update({ available: false, progress: 0, pickup: null, round: 1 });
  assert.equal(hud.element.hidden, true, 'hidden before firstRound');
  assert.equal(hud.element.querySelector('.incentive-progress').hidden, true);

  // Round 2 unlocked at 0%: shows Employee of the Hour meter at 0%.
  hud.update({ available: true, progress: 0, pickup: null, round: 2 });
  assert.equal(hud.element.hidden, false, 'visible once unlocked even at 0%');
  assert.match(hud.element.querySelector('.incentive-heading').textContent, /Employee of the hour/i);
  assert.match(hud.element.querySelector('.incentive-label').textContent, /PROGRESS · 0%/);
  assert.equal(chimes, 0);

  // Mid-progress + active drop
  hud.update({ available: true, progress: 0.5, pickup: { id: 'shiftBonus', remaining: 8.5 }, round: 2 });
  assert.equal(hud.element.hidden, false);
  assert.match(hud.element.textContent, /50%/);
  assert.match(hud.element.textContent, /SHIFT BONUS · COLLECT · 9s/);
  assert.equal(hud.element.classList.contains('is-near-full'), false);
  assert.equal(chimes, 0);

  // Crossing nearFullFraction glows and dings ONCE per fill cycle
  hud.update({ available: true, progress: 0.85, pickup: null, round: 2 });
  assert.equal(hud.element.classList.contains('is-near-full'), true);
  assert.match(hud.element.querySelector('.incentive-label').textContent, /85%/);
  assert.equal(chimes, 1);
  hud.update({ available: true, progress: 0.92, pickup: null, round: 2 });
  assert.equal(chimes, 1, 'no repeat chime during the same fill cycle');

  // Jackpot pickup highlights with .jackpot class while keeping clean countdown text.
  hud.update({ available: true, progress: 0.2, pickup: { id: 'storeWideClearance', remaining: 11.2 }, round: 4 });
  assert.equal(hud.element.classList.contains('is-near-full'), false);
  assert.equal(hud.element.querySelector('.incentive-drop').classList.contains('jackpot'), true);
  assert.equal(hud.element.querySelector('.incentive-drop').textContent, 'STORE-WIDE CLEARANCE · COLLECT · 12s');

  // Re-arm near-full chime on next cycle
  hud.update({ available: true, progress: 0.85, pickup: null, round: 4 });
  assert.equal(chimes, 2);

  // A boss's voucher on the floor is a pickup too, though it is not an incentive type: it must be named, never throw
  // (a throw in the HUD stops the browser's frame loop).
  for (const [id, voucher] of Object.entries(bossVouchers)) {
    hud.update({ available: true, progress: 0.5, pickup: { id, remaining: 14.2, bossReward: true } });
    assert.equal(hud.element.querySelector('.incentive-drop').textContent, voucher.name + ' · COLLECT · 15s');
  }
  hud.update({ available: true, progress: 0.5, pickup: { id: 'notAThing', remaining: 3 } });
  assert.equal(hud.element.querySelector('.incentive-drop').textContent, 'notAThing · COLLECT · 3s');

  // Capped round dims the meter with CAPPED state while keeping active benefits visible.
  hud.update({ available: false, progress: 0, pickup: null, effects: [{ id: 'commissionDay', remaining: 12 }], round: 4 });
  assert.equal(hud.element.classList.contains('is-capped'), true);
  assert.match(hud.element.querySelector('.incentive-label').textContent, /CAPPED/);
  assert.match(hud.element.textContent, /COMMISSION DAY · 12s/);
  assert.equal(hud.element.querySelector('.incentive-drop').textContent, '');

  // Disabling the meter setting hides the meter (and mutes chime), while pickups/benefits stay visible.
  hud.setEnabled(false);
  assert.equal(hud.element.querySelector('.incentive-meter').hidden, true);
  assert.equal(hud.element.hidden, false, 'active benefits still keep the card visible');
  hud.setEnabled(true);

  hud.update(null);
  assert.equal(hud.element.hidden, true);
});

function makePrng(seed = 4242) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}

function twoSlotGun(stats) {
  const primary = new Weapon(weapons.stapleGun, stats);
  const secondary = new Weapon(weapons.priceGun, stats);
  const byId = { stapleGun: primary, priceGun: secondary };
  return {
    primary,
    secondary,
    gun: {
      slots: ['stapleGun', 'priceGun'],
      weapon: primary,
      weaponFor: (id) => byId[id],
      restock: (fraction) => { primary.restock(fraction); secondary.restock(fraction); },
    },
  };
}

function drawMeterSequence(t, count, round = 2) {
  t.manager.reset();
  t.events.emit('roundStart', { round });
  const ids = [];
  for (let i = 0; i < count; i++) {
    t.kill(); t.manager.update(0.01);
    assert.ok(t.manager.pickup, `drop ${i}`);
    ids.push(t.manager.pickup.id);
    t.manager.update(powerUps.lifetime);
  }
  return ids;
}

function drawBossRewards(t, count, round = 2) {
  const ids = [];
  t.events.emit('roundStart', { round });
  for (let i = 0; i < count; i++) {
    t.events.emit('kill', { zombie: { type: { id: 'sirWaffles', guaranteedDrop: true }, position: new THREE.Vector3(2, 0, 0) }, source: 'gun' });
    t.manager.update(0.01);
    assert.ok(t.manager.pickup, `reward ${i}`);
    ids.push(t.manager.pickup.id);
    t.manager.update(powerUps.lifetime);
  }
  return ids;
}

test('need weights shift draws toward healing at low health and restock when total ammo across both slots drops', () => {
  const countOf = (list, target) => list.filter((id) => id === target).length;

  // 1. Health need over continuous meter draws (low health vs full health) & reward draws (20% vs 90% health).
  const fullHpMeter = fixture({ threshold: { min: 1, max: 1 }, maxPerRound: 1000, random: makePrng(101) });
  const lowHpMeter = fixture({ threshold: { min: 1, max: 1 }, maxPerRound: 1000, random: makePrng(101) });
  lowHpMeter.stats.health = 20;
  const fullHpDraws = drawMeterSequence(fullHpMeter, 300);
  const lowHpDraws = drawMeterSequence(lowHpMeter, 300);
  assert.equal(countOf(fullHpDraws, 'paidBreak'), 0, 'full health never rolls Paid Break');
  assert.ok(countOf(lowHpDraws, 'paidBreak') >= 30, `expected frequent Paid Break at low HP, got ${countOf(lowHpDraws, 'paidBreak')}`);

  const mildHp = fixture({ random: makePrng(202) });
  mildHp.stats.health = 90; // eligible (< 100), above startBelowFraction (0.9) => weight 1
  const hurtHp = fixture({ random: makePrng(202) });
  hurtHp.stats.health = 20; // below maxAtFraction (0.25) => weight 4
  const mildHealHits = countOf(drawBossRewards(mildHp, 600), 'paidBreak');
  const lowHealHits = countOf(drawBossRewards(hurtHp, 600), 'paidBreak');
  assert.ok(lowHealHits > mildHealHits * 2, `expected low health (${lowHealHits}) > 2x mild health (${mildHealHits})`);

  // 2. Ammo need across both slots (stapleGun + smg): drained total ammo vs full & vs lightly spent eligible ammo.
  const fullStats = createPlayerStats();
  const fullLoadout = twoSlotGun(fullStats);
  const fullAmmoMeter = fixture({ threshold: { min: 1, max: 1 }, maxPerRound: 1000, gun: fullLoadout.gun, random: makePrng(303) });
  const lowStats = createPlayerStats();
  const lowLoadout = twoSlotGun(lowStats);
  lowLoadout.primary.magazine = 1; lowLoadout.primary.reserve = 5;
  lowLoadout.secondary.magazine = 2; lowLoadout.secondary.reserve = 10;
  const lowAmmoMeter = fixture({ threshold: { min: 1, max: 1 }, maxPerRound: 1000, gun: lowLoadout.gun, random: makePrng(303) });
  assert.equal(countOf(drawMeterSequence(fullAmmoMeter, 300), 'stockroomDelivery'), 0, 'full two-slot ammo skips restock');
  const lowAmmoCount = countOf(drawMeterSequence(lowAmmoMeter, 300), 'stockroomDelivery');
  assert.ok(lowAmmoCount >= 30, `expected frequent restock at low two-slot ammo, got ${lowAmmoCount}`);

  // When both slots average ~85% ammo vs ~10% ammo (both eligible): drained two-slot loadout wins > 2x as often.
  const mildAmmo = twoSlotGun(createPlayerStats());
  mildAmmo.primary.reserve = Math.floor(mildAmmo.primary.reserveCap * 0.85);
  mildAmmo.secondary.reserve = Math.floor(mildAmmo.secondary.reserveCap * 0.85);
  const mildAmmoMgr = fixture({ gun: mildAmmo.gun, random: makePrng(404) });
  const emptySecondaryOnly = twoSlotGun(createPlayerStats());
  emptySecondaryOnly.primary.magazine = 0; emptySecondaryOnly.primary.reserve = 6;
  emptySecondaryOnly.secondary.magazine = 0; emptySecondaryOnly.secondary.reserve = 12;
  const lowAmmoMgr = fixture({ gun: emptySecondaryOnly.gun, random: makePrng(404) });
  const mildAmmoHits = countOf(drawBossRewards(mildAmmoMgr, 600), 'stockroomDelivery');
  const lowAmmoHits = countOf(drawBossRewards(lowAmmoMgr, 600), 'stockroomDelivery');
  assert.ok(lowAmmoHits > mildAmmoHits * 2, `expected low total ammo (${lowAmmoHits}) > 2x mild ammo (${mildAmmoHits})`);
});

test('Employee Discount need rises near an unbought price and drops when unaffordable, overshot, or only ammo is nearby', () => {
  const countOf = (list, target) => list.filter((id) => id === target).length;
  const setup = (points, items, seed) => {
    const wallet = { points };
    const interactions = { buyables: () => items };
    return fixture({ wallet, interactions, random: makePrng(seed) });
  };
  const doorOnly = [{ kind: 'door', cost: 1000 }];
  const zeroHits = countOf(drawBossRewards(setup(0, doorOnly, 505), 600), 'employeeDiscount');
  const nearHits = countOf(drawBossRewards(setup(900, doorOnly, 505), 600), 'employeeDiscount');
  const richHits = countOf(drawBossRewards(setup(2500, doorOnly, 505), 600), 'employeeDiscount');
  const ammoOnlyHits = countOf(drawBossRewards(setup(225, [{ kind: 'ammo', cost: 250 }], 505), 600), 'employeeDiscount');
  const boughtOutHits = countOf(drawBossRewards(setup(900, [], 505), 600), 'employeeDiscount');

  assert.ok(nearHits > zeroHits * 1.8, `near unbought door (${nearHits}) > 1.8x broke (${zeroHits})`);
  assert.ok(nearHits > richHits * 1.8, `near unbought door (${nearHits}) > 1.8x overshot (${richHits})`);
  assert.equal(ammoOnlyHits, zeroHits, 'excluded repeatable ammo prices do not boost discount need');
  assert.equal(boughtOutHits, zeroHits, 'once everything unbought is gone, discount returns to base weight');
});

test('need cap limits dominance, preserves bag & no-repeat rules, and leaves jackpot frequency unchanged', () => {
  // 1. Global needWeight.maxFactor hard cap bounds extreme per-type maxMultiplier.
  const capped = fixture({
    needWeight: { minFactor: 1, maxFactor: 2 },
    types: {
      ...powerUps.types,
      paidBreak: { ...powerUps.types.paidBreak, need: { ...powerUps.types.paidBreak.need, maxMultiplier: 50 } },
    },
    random: makePrng(606),
  });
  capped.stats.health = 1;
  const cappedHeals = drawBossRewards(capped, 800).filter((id) => id === 'paidBreak').length;
  // Expected share at maxFactor 2 among 7 eligible commons (full ammo skips delivery) is 2 / (2 + 6) = 25% (~200).
  assert.ok(cappedHeals >= 140 && cappedHeals <= 260, `expected capped share ~25% (got ${cappedHeals}/800)`);

  // 2. Under simultaneous heavy health, ammo, and discount need, jackpot rarity & bag/no-repeat stay intact.
  const gun = twoSlotGun(createPlayerStats());
  gun.primary.magazine = 0; gun.primary.reserve = 0;
  gun.secondary.magazine = 0; gun.secondary.reserve = 5;
  const sim = fixture({
    threshold: { min: 1, max: 1 },
    maxPerRound: 5000,
    gun: gun.gun,
    zombies: { zombies: [{ isAlive: true, state: 'chasing', removed: false, type: { id: 'shopper' }, position: new THREE.Vector3(0, 0, 10) }] },
    wallet: { points: 900 },
    interactions: { buyables: () => [{ kind: 'door', cost: 1000 }] },
    random: makePrng(707),
  });
  sim.stats.health = 10;

  // Round 2: zero jackpots, no immediate repeats, full 8-common bag cycle before repeating any common.
  const bagSeq = drawMeterSequence(sim, 16, 2);
  for (let i = 1; i < bagSeq.length; i++) {
    assert.notEqual(bagSeq[i], bagSeq[i - 1], `no consecutive repeat at ${i}: ${bagSeq[i]}`);
    assert.notEqual(powerUps.types[bagSeq[i]].tier, 'jackpot');
  }
  assert.equal(new Set(bagSeq.slice(0, 8)).size, 8, `first 8-item bag visits all 8 commons: ${bagSeq.slice(0, 8)}`);
  assert.equal(new Set(bagSeq.slice(8, 16)).size, 8, `second 8-item bag visits all 8 commons: ${bagSeq.slice(8, 16)}`);

  // Round 4+: 2,400 draws retain exact expected jackpot frequency (~1/9 ≈ 11.1%) despite maximum common need.
  const jpSeq = drawMeterSequence(sim, 2400, powerUps.jackpot.firstRound);
  let jackpots = 0;
  for (let i = 0; i < jpSeq.length; i++) {
    const isJp = powerUps.types[jpSeq[i]].tier === 'jackpot';
    if (i > 0) assert.notEqual(jpSeq[i], jpSeq[i - 1]);
    if (i > 0) assert.ok(!(isJp && powerUps.types[jpSeq[i - 1]].tier === 'jackpot'), 'never two jackpots in a row');
    if (isJp) jackpots++;
  }
  const jpRate = jackpots / jpSeq.length;
  assert.ok(jpRate >= 0.08 && jpRate <= 0.14, `jackpot rate unchanged (~11.1%), got ${(jpRate * 100).toFixed(1)}%`);
});

test('powerUpMeter event bus tracks real meter across round unlock, near-full, cap, save/restore and reset', () => {
  menuDom();
  const meterLog = [];
  const t = fixture({ threshold: { min: 5, max: 5 }, maxPerRound: 1 });
  let chimes = 0;
  const view = createIncentiveHud({ onNearFull: () => { chimes += 1; } });
  t.events.on('powerUpMeter', (m) => { meterLog.push(m); view.setMeter(m); });

  t.events.emit('roundStart', { round: 1 });
  assert.equal(meterLog.at(-1).unlocked, false);
  assert.equal(meterLog.at(-1).progress, 0);
  assert.equal(view.element.hidden, true);

  t.events.emit('roundStart', { round: 2 });
  assert.equal(meterLog.at(-1).unlocked, true);
  assert.equal(meterLog.at(-1).progress, 0);
  assert.equal(view.element.hidden, false);

  for (let i = 0; i < 4; i++) {
    t.kill();
    t.manager.update(powerUps.credit.multiKillSeconds + 0.1);
  } // 4 / 5 = 0.8 >= nearFullFraction (0.8)
  assert.equal(meterLog.at(-1).progress, 0.8);
  assert.equal(meterLog.at(-1).nearFull, true);
  assert.equal(view.element.classList.contains('is-near-full'), true);
  assert.equal(chimes, 1);

  t.kill(); // 5 / 5 triggers drop on update
  t.manager.update(0.01);
  assert.equal(meterLog.at(-1).capped, true);
  assert.equal(view.element.classList.contains('is-capped'), true);

  // Restore preserves meter quietly (silent: true prevents spurious chime)
  const snap = t.manager.serialize();
  t.manager.reset();
  assert.equal(meterLog.at(-1).unlocked, false);
  assert.equal(meterLog.at(-1).progress, 0);
  view.reset();
  t.manager.restore(snap);
  assert.equal(meterLog.at(-1).capped, true);
  assert.equal(meterLog.at(-1).silent, true);
  assert.equal(chimes, 1);
});

test('hud.connectEvents drives meter & NEW INCENTIVE discovery toast, and setting incentiveMeter toggles meter', () => {
  menuDom();
  let readies = 0;
  const events = createEvents();
  const hud = createHud({ onIncentiveReady: () => { readies += 1; } });
  hud.connectEvents(events);
  const meterSetting = settingDefs.find((d) => d.id === 'incentiveMeter');
  assert.equal(meterSetting.tab, 'Comfort');
  assert.equal(meterSetting.default, true);

  events.emit('powerUpMeter', { round: 2, unlocked: true, available: true, capped: false, nearFull: true, progress: 0.85 });
  assert.equal(hud.element.querySelector('.incentive-hud').classList.contains('is-near-full'), true);
  assert.equal(readies, 1);

  meterSetting.apply(false, { hud });
  assert.equal(hud.element.querySelector('.incentive-progress').hidden, true);
  meterSetting.apply(true, { hud });
  assert.equal(hud.element.querySelector('.incentive-progress').hidden, false);

  events.emit('incentiveDiscovered', { id: 'commissionDay', name: 'COMMISSION DAY', icon: 'commission', tier: 'jackpot', found: 1, total: 11 });
  const toast = hud.element.querySelector('.incentive-discovery-toast');
  assert.equal(toast.hidden, false);
  assert.match(toast.textContent, /NEW INCENTIVE/);
  assert.match(toast.textContent, /COMMISSION DAY · 1\/11/);

  events.emit('runReset');
  assert.equal(toast.hidden, true);
});
