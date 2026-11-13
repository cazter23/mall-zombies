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
import { menuDom } from './helpers/menuDom.js';

function fixture(overrides = {}) {
  const events = createEvents();
  const player = { position: new THREE.Vector3(8, 0, 0), prevPosition: new THREE.Vector3(8, 0, 0) };
  const colliders = [new THREE.Box3(new THREE.Vector3(-20, -1, -20), new THREE.Vector3(20, 0, 20))];
  const state = { over: false, assisted: false };
  const stats = createPlayerStats();
  const ammo = new Weapon(weapons.stapleGun, stats);
  const restocks = [], log = [];
  const gun = { slots: ['stapleGun'], weapon: ammo, weaponFor: () => ammo, restock: (fraction) => { restocks.push(fraction); ammo.restock(fraction); } };
  const zombies = { zombies: [] };
  const random = overrides.random ?? (() => 0);
  const { random: _omitRandom, ...configOverrides } = overrides;
  const config = { ...powerUps, threshold: { min: 2, max: 2 }, ...configOverrides };
  const manager = createPowerUps({ events, player, gun, zombies, colliders, state, stats, config, random });
  for (const name of ['powerUpDrop', 'powerUpCollect', 'powerUpExpire', 'powerUpStart', 'powerUpEnd', 'clearanceDetonated']) {
    events.on(name, (event) => log.push([name, event]));
  }
  const kill = (extra = {}, at = new THREE.Vector3()) => events.emit('kill', { zombie: { type: { id: 'shopper' }, position: at }, source: 'gun', ...extra });
  const stand = (x, y = 0, z = 0) => { player.position.set(x, y, z); player.prevPosition.copy(player.position); };
  return { manager, events, player, colliders, state, stats, ammo, restocks, log, kill, stand };
}

test('trimmed type catalog has 10 distinct types (7 common, 3 jackpot) and zero removed IDs', () => {
  const removed = ['blueLightSpecial', 'securitySweep', 'expressCheckout', 'overtimeApproved', 'staffEntrance', 'productRecall', 'paidBreak'];
  for (const id of removed) assert.equal(Object.hasOwn(powerUps.types, id), false, `${id} should be removed`);
  const entries = Object.entries(powerUps.types);
  assert.equal(entries.length, 10);
  assert.equal(entries.filter(([, def]) => def.tier === 'common').length, 7);
  assert.equal(entries.filter(([, def]) => def.tier === 'jackpot').length, 3);
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

  // Raw wallet.earn (tests / debug points / expired voucher fallback) is never doubled by Commission Day.
  before = g.wallet.points;
  g.wallet.earn(100);
  assert.equal(g.wallet.points - before, 100);

  // Expiry restores exact 1x payouts on time.
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

test('real game: Store-Wide Clearance clears nearby same-floor non-bosses with zero per-kill pay, pays flat bonus once, spares bosses, and flashes comfortably', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  const at = g.player.position.clone();
  const def = powerUps.types.storeWideClearance;

  g.rounds.jumpTo(6);
  g.debug.run('summonBoss');
  const boss = g.bosses.active;
  boss.setState('chasing');
  boss.position.copy(at).add(new THREE.Vector3(0, 0, -3));
  boss.health = 5; // near death: clearance must never kill a boss

  // Same-floor targets inside radius (normal shopper, Mascot, and noRewards zombie), plus far, upstairs, and low-HP boss.
  const s1 = g.zombies.spawn('shopper', at.clone().add(new THREE.Vector3(2, 0, 0))); s1.setState('chasing');
  const mascot = g.zombies.spawn('mascot', at.clone().add(new THREE.Vector3(-2, 0, 0)), { variant: 'sirWaffles', gold: false }); mascot.setState('chasing');
  const noPay = g.zombies.spawn('mallWalker', at.clone().add(new THREE.Vector3(0, 0, 3))); noPay.setState('chasing'); noPay.noRewards = true;
  const far = g.zombies.spawn('shopper', at.clone().add(new THREE.Vector3(def.radius + 3, 0, 0))); far.setState('chasing');
  const upstairs = g.zombies.spawn('shopper', at.clone().add(new THREE.Vector3(1, 6, 0))); upstairs.setState('chasing');

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
  assert.equal(far.isAlive, true, 'out-of-radius zombie survives');
  assert.equal(upstairs.isAlive, true, 'other-floor zombie survives');
  assert.equal(boss.isAlive, true, 'low-HP boss is never killed by clearance');
  assert.ok(boss.health >= 1, 'boss remains alive above 0 health');
  assert.equal(g.wallet.points - pointsBefore, def.flatBonus, 'pays flat bonus once with zero per-kill points');
  assert.equal(g.runStats.kills, killsBefore + 2, 'pays zero points for kills while still recording non-noRewards kills');
  assert.ok(killSources.every(s => s === 'clearance'));
  assert.equal(detonated.length, 1);
  assert.equal(detonated[0].flatBonus, def.flatBonus);
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
    g.events.emit('clearanceDetonated', { position: at, radius: def.radius, kills: 0, bossesHit: 0, positions: [], flatBonus: def.flatBonus });
    assert.equal(flashView.element.style.background, powerUps.visual.clearanceFlash.color);
    bossComfort.dimPhoneFlash = true;
    g.events.emit('clearanceDetonated', { position: at, radius: def.radius, kills: 0, bossesHit: 0, positions: [], flatBonus: def.flatBonus });
    assert.equal(flashView.element.style.background, '#000');
  } finally {
    bossComfort.dimPhoneFlash = prevDim;
  }
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

  // Boss NEVER dies in one hit and takes bossDamageMultiplier x weapon damage instead.
  g.gun.give(weapons.stapleGun);
  t.tick(45);
  g.rounds.jumpTo(6);
  g.debug.run('summonBoss');
  const boss = g.bosses.active;
  boss.setState('chasing');
  boss.health = boss.maxHealth = 10000;
  boss.position.copy(at).add(new THREE.Vector3(0, 0, -2));
  boss.updateHitboxes();
  t.standAt(at.x, at.z, 0, 0);
  t.press('Mouse0');
  t.tick(fireCooldown);
  assert.equal(boss.isAlive, true, 'boss is never one-shot by Black Friday');
  assert.ok(boss.health < 10000 && boss.health >= 10000 - weapons.stapleGun.damage * weapons.stapleGun.headshotMultiplier * powerUps.types.blackFriday.bossDamageMultiplier - 1);
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

test('reusable visuals show distinct shapes per type, halo rings on jackpots, add no lights, and dispose owned resources', () => {
  const scene = new THREE.Scene();
  const view = createPowerUpView(scene, []);
  let disposed = 0;
  const geometries = new Set(), materials = new Set();
  view.root.traverse((o) => {
    assert.equal(!!o.isLight, false);
    if (o.geometry && !o.geometry.userData.shared) geometries.add(o.geometry); // (beacon parts are shared, not owned)
    if (o.material && !o.material.userData.shared) materials.add(o.material);
  });
  for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => { disposed++; });
  for (const [id, def] of Object.entries(powerUps.types)) {
    view.update({ id, position: new THREE.Vector3(1, 6, 1), age: 0.5, remaining: 10 }, 1 / 60, []);
    const prop = view.root.getObjectByName(id);
    assert.equal(prop.visible, true);
    assert.ok(prop.position.y > 6.5);
    if (def.tier === 'jackpot') assert.ok(prop.scale.x > 1, `${id} jackpot stands out in scale`);
  }
  view.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(disposed, geometries.size + materials.size);
});

test('incentive HUD shows earning progress, pickup countdown, jackpot marker and clears on death', () => {
  menuDom();
  const hud = createIncentiveHud();
  // Round 2 with 0 progress remains hidden until first progress
  hud.update({ available: true, progress: 0, pickup: null, round: 2 });
  assert.equal(hud.element.hidden, true, 'hidden when progress is 0');

  // Once progress > 0, it shows
  hud.update({ available: true, progress: 0.5, pickup: { id: 'shiftBonus', remaining: 8.5 }, round: 2 });
  assert.equal(hud.element.hidden, false);
  assert.match(hud.element.textContent, /50%/);
  assert.match(hud.element.textContent, /SHIFT BONUS · COLLECT · 9s/);

  // Jackpot pickup highlights with .jackpot class while keeping clean countdown text.
  hud.update({ available: true, progress: 0.5, pickup: { id: 'storeWideClearance', remaining: 11.2 }, round: 4 });
  assert.equal(hud.element.querySelector('.incentive-drop').classList.contains('jackpot'), true);
  assert.equal(hud.element.querySelector('.incentive-drop').textContent, 'STORE-WIDE CLEARANCE · COLLECT · 12s');

  // A boss's voucher on the floor is a pickup too, though it is not an incentive type: it must be named, never throw
  // (a throw in the HUD stops the browser's frame loop).
  for (const [id, voucher] of Object.entries(bossVouchers)) {
    hud.update({ available: true, progress: 0.5, pickup: { id, remaining: 14.2, bossReward: true } });
    assert.equal(hud.element.querySelector('.incentive-drop').textContent, voucher.name + ' · COLLECT · 15s');
  }
  hud.update({ available: true, progress: 0.5, pickup: { id: 'notAThing', remaining: 3 } });
  assert.equal(hud.element.querySelector('.incentive-drop').textContent, 'notAThing · COLLECT · 3s');
  hud.update({ available: false, progress: 0, pickup: null, effects: [{ id: 'commissionDay', remaining: 12 }], round: 4 });
  assert.match(hud.element.textContent, /ALLOWANCE USED/);
  assert.match(hud.element.textContent, /COMMISSION DAY · 12s/);
  assert.equal(hud.element.querySelector('.incentive-drop').textContent, '');
  hud.update(null);
  assert.equal(hud.element.hidden, true);
});
