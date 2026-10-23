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
import { createIncentiveHud } from '../src/ui/incentiveHud.js';
import { menuDom } from './helpers/menuDom.js';

function fixture(overrides = {}) {
  const events = createEvents();
  const player = { position: new THREE.Vector3(8, 0, 0), prevPosition: new THREE.Vector3(8, 0, 0) };
  const colliders = [new THREE.Box3(new THREE.Vector3(-20, -1, -20), new THREE.Vector3(20, 0, 20))];
  const state = { over: false, assisted: false };
  const ammo = new Weapon(weapons.stapleGun, createPlayerStats());
  const restocks = [], sweeps = [], log = [];
  const gun = { slots: ['stapleGun'], weapon: ammo, weaponFor: () => ammo, restock: (fraction) => { restocks.push(fraction); ammo.restock(fraction); } };
  const zombies = { securitySweep: (origin, tune) => sweeps.push({ origin: origin.clone(), tune }) };
  const config = { ...powerUps, threshold: { min: 2, max: 2 }, ...overrides };
  const manager = createPowerUps({ events, player, gun, zombies, colliders, state, config, random: () => 0 });
  for (const name of ['powerUpDrop', 'powerUpCollect', 'powerUpExpire', 'powerUpStart', 'powerUpEnd']) events.on(name, (event) => log.push([name, event]));
  const kill = (extra = {}, at = new THREE.Vector3()) => events.emit('kill', { zombie: { type: { id: 'shopper' }, position: at }, source: 'gun', ...extra });
  const stand = (x, y = 0, z = 0) => { player.position.set(x, y, z); player.prevPosition.copy(player.position); };
  return { manager, events, player, colliders, state, ammo, restocks, sweeps, log, kill, stand };
}

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
  assert.equal(t.manager.pickup.id, 'blueLightSpecial', 'full inventory makes restock ineligible');
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
  assert.equal(t.manager.pickup.id, 'securitySweep');
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
  assert.equal(t.manager.pickup.id, 'blueLightSpecial');
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

test('Blue Light doubles kill value only within its radius, on its floor and in line of sight; expires and clears on death', () => {
  const t = fixture();
  t.manager.debugDrop('blueLightSpecial');
  t.manager.update(0.01);
  assert.ok(t.manager.active);
  assert.equal(t.manager.killMultiplier(new THREE.Vector3(9, 0, 0)), 2);
  assert.equal(t.manager.killMultiplier(new THREE.Vector3(13, 0, 0)), 1);
  assert.equal(t.manager.killMultiplier(new THREE.Vector3(9, 6, 0)), 1);
  t.colliders.push(new THREE.Box3(new THREE.Vector3(8.4, 0, -2), new THREE.Vector3(8.5, 3, 2)));
  assert.equal(t.manager.killMultiplier(new THREE.Vector3(9, 0, 0)), 1);
  t.colliders.pop();
  t.manager.update(powerUps.types.blueLightSpecial.seconds);
  assert.equal(t.manager.active, null);
  t.manager.debugDrop('blueLightSpecial'); t.manager.update(0.01);
  t.state.over = true;
  t.events.emit('playerDeath');
  assert.equal(t.manager.active, null);
  assert.equal(t.manager.pickup, null);
});

test('drop placement stays on the correct floor and refuses unsupported or blocked locations', () => {
  const t = fixture({ placementRadii: [0] });
  assert.equal(t.manager.debugDrop('blueLightSpecial', new THREE.Vector3(0, 6, 0)), false);
  t.colliders.push(new THREE.Box3(new THREE.Vector3(-2, 5.5, -2), new THREE.Vector3(2, 6, 2)));
  assert.equal(t.manager.debugDrop('blueLightSpecial', new THREE.Vector3(0, 6, 0)), true);
  assert.equal(t.manager.pickup.position.y, 6);
  t.colliders.push(new THREE.Box3(new THREE.Vector3(-1, 6, -1), new THREE.Vector3(1, 9, 1)));
  assert.equal(t.manager.debugDrop('securitySweep', new THREE.Vector3(0, 6, 0)), false);
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

test('Security Sweep interrupts every attack and charge phase without damage, collides with walls and leaves risers/corpses alone', () => {
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
      assert.equal(z.staggerAway(player.position, powerUps.types.securitySweep), true);
      for (let i = 0; i < 120; i++) z.update(1 / 60, ctx);
      assert.equal(hits, 0, `${id}/${phase}: cannot attack during sweep`);
      assert.equal(z.health, 500);
      assert.ok(z.position.z <= 0.8 - z.type.radius + 0.001, 'knockback stops at the wall');
      assert.ok(z.position.z > 0, 'zombie is physically pushed away');
      assert.ok(z.staggerTimer < 0.001);
      z.update(1 / 60, ctx);
      assert.ok(Number.isFinite(z.position.y));
      z.respawnAt(new THREE.Vector3(), 0);
      assert.equal(z.staggerTimer, 0, 'rescue clears sweep state');
      assert.equal(z.staggerAway(player.position, powerUps.types.securitySweep), false, 'still rising');
      z.die();
      assert.equal(z.staggerAway(player.position, powerUps.types.securitySweep), false, 'corpse');
      z.model.dispose();
    }
  }
});

test('real game: Blue Light changes base kill payouts only, pickup sound/PA fire, paused timers freeze, death and Play again clean up', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {}; // isolate rewards from wave spawns
  g.zombies.clear();
  const at = g.player.position.clone();
  g.powerUps.debugDrop('blueLightSpecial');
  t.tick();
  assert.ok(g.powerUps.active);
  assert.ok(t.sounds.includes(powerUps.types.blueLightSpecial.sound));
  assert.ok(t.hud.calls.some(([name, data]) => name === 'showAnnouncement' && data === powerUps.types.blueLightSpecial.pa));
  const remaining = g.powerUps.active.remaining;
  g.state.forceRun = false;
  t.tick(120);
  assert.equal(g.powerUps.active.remaining, remaining);
  g.state.forceRun = true;
  const kills = g.runStats.kills;
  let before = g.wallet.points;
  const z = g.zombies.spawn('shopper', at.clone().add(new THREE.Vector3(1, 0, 0)));
  z.state = 'chasing';
  z.takeHit({ damage: 10000, part: 'head' });
  assert.equal(g.wallet.points - before, economy.killValues.shopper * 2 + economy.payouts.headshotKillBonus);
  assert.equal(g.runStats.kills, kills + 1);
  before = g.wallet.points;
  g.events.emit('hit', { target: { type: zombieTypes.shopper }, killed: false });
  assert.equal(g.wallet.points - before, economy.payouts.nonLethalHit);
  g.health.takeDamage(10000);
  assert.equal(g.powerUps.active, null);
  assert.equal(g.powerUps.pickup, null);
  assert.equal(g.powerUps.debugDrop('securitySweep'), false);
  g.resetRun();
  assert.equal(g.powerUps.progress, 0);
  assert.equal(g.powerUps.dropsThisRound, 0);
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

test('real manager sweep never pays, never kills, and cancels a charging Cart Pusher before it hits', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {};
  const z = g.zombies.spawn('cartPusher', g.player.position.clone().add(new THREE.Vector3(0, 0, -2)));
  z.setState('charging');
  z.chargeLeft = 10;
  const before = { points: g.wallet.points, kills: g.runStats.kills, health: g.health.fraction, zombieHealth: z.health };
  g.powerUps.debugDrop('securitySweep');
  t.tick(90);
  assert.equal(g.wallet.points, before.points);
  assert.equal(g.runStats.kills, before.kills);
  assert.equal(g.health.fraction, before.health);
  assert.equal(z.health, before.zombieHealth);
  assert.ok(z.staggerTimer > 0);
});

test('reusable visuals show three distinct props, zone and expiry blinking, add no lights, and dispose owned resources', () => {
  const scene = new THREE.Scene();
  const view = createPowerUpView(scene, []);
  let disposed = 0;
  const geometries = new Set(), materials = new Set();
  view.root.traverse((o) => {
    assert.equal(!!o.isLight, false);
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) materials.add(o.material);
  });
  for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => { disposed++; });
  for (const id of Object.keys(powerUps.types)) {
    view.update({ id, position: new THREE.Vector3(1, 6, 1), age: 0.5, remaining: 10 }, null);
    const prop = view.root.getObjectByName(id);
    assert.equal(prop.visible, true);
    assert.ok(prop.position.y > 6.5);
  }
  view.update(null, { position: new THREE.Vector3(1, 6, 1), remaining: 10 });
  assert.ok(view.root.children.some((o) => o.visible && o.isMesh));
  view.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(disposed, geometries.size + materials.size);
});

test('Blue Light ring never paints across a wall or floats over unsupported balcony space', () => {
  const scene = new THREE.Scene();
  const floor = new THREE.Box3(new THREE.Vector3(-8, 5.5, -8), new THREE.Vector3(8, 6, 0));
  const wall = new THREE.Box3(new THREE.Vector3(1, 6, -8), new THREE.Vector3(1.2, 9, 0));
  const view = createPowerUpView(scene, [floor, wall]);
  const center = new THREE.Vector3(0, 6, -1);
  view.update(null, { position: center, remaining: 20 });
  const ring = view.root.children.find((o) => o.isMesh);
  const points = ring.geometry.attributes.position;
  let visible = 0;
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), z = points.getZ(i);
    if (Math.hypot(x - center.x, z - center.z) < 0.01) continue; // clipped triangle
    visible++;
    assert.ok(x < 1, 'wall blocks ring projection');
    assert.ok(z <= 0, 'no floor means no floating ring');
    assert.ok(Math.abs(points.getY(i) - (6 + powerUps.visual.floorOffset)) < 0.001);
  }
  assert.ok(visible > 0);
  view.dispose();
});

test('incentive HUD shows earning progress, pickup countdown, active-zone timer and clears on death', () => {
  menuDom();
  const hud = createIncentiveHud();
  hud.update({ available: true, progress: 0.5, pickup: { id: 'securitySweep', remaining: 8.5 }, active: null });
  assert.match(hud.element.textContent, /50%/);
  assert.match(hud.element.textContent, /SECURITY SWEEP · COLLECT · 9s/);
  hud.update({ available: false, progress: 0, pickup: null, active: { remaining: 12 } });
  assert.match(hud.element.textContent, /ALLOWANCE USED/);
  assert.match(hud.element.textContent, /BLUE LIGHT SPECIAL · 12s/);
  assert.equal(hud.element.querySelector('.incentive-drop').textContent, '');
  hud.update(null);
  assert.equal(hud.element.hidden, true);
});
