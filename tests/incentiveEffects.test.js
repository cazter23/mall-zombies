import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { powerUps } from '../src/config/powerUps.js';
import { weapons, melee as meleeWeapons } from '../src/config/weapons.js';
import { createPlayerStats } from '../src/player/stats.js';
import { createIncentiveHud } from '../src/ui/incentiveHud.js';
import { createPowerUpView } from '../src/fx/powerUpView.js';
import { menuDom } from './helpers/menuDom.js';
import { Zombie } from '../src/zombies/zombie.js';
import { zombieTypes } from '../src/config/zombies.js';

function scenario() {
  const t = headlessGame();
  t.tick();
  const { g } = t;
  g.rounds.update = () => {};
  g.zombies.clear();
  g.events.emit('roundStart', { round: 2 });
  const collect = id => {
    assert.equal(g.powerUps.debugDrop(id), true, `${id}: safe pickup placement`);
    g.powerUps.update(1 / 60);
    assert.equal(g.powerUps.pickup, null);
  };
  const spawn = (x = 0, z = 10, health = 150) => {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(x, 0, z));
    zombie.health = zombie.maxHealth = health;
    zombie.setState('chasing');
    zombie.updateHitboxes();
    return zombie;
  };
  const kill = (zombie, source = 'gun') => zombie.takeHit({ damage: zombie.health + 1, part: 'body', source });
  const active = id => g.powerUps.effects.find(e => e.id === id);
  return { ...t, collect, spawn, kill, active };
}

const entryPriceId = g => g.map.areaUnlocks ? 'hallway' : 'startShutter';

test('Shift Bonus speeds reloads, swaps and movement, extends only on direct kills capped at maxSeconds, and restores stats on expiry', () => {
  const t = scenario(), { g } = t;
  const def = powerUps.types.shiftBonus;
  const base = { ...g.stats };
  t.collect('shiftBonus');
  assert.equal(g.stats.reloadSpeed, base.reloadSpeed * def.reloadMultiplier);
  assert.equal(g.stats.switchSpeed, base.switchSpeed * def.switchMultiplier);
  assert.equal(g.stats.walkSpeed, base.walkSpeed * def.speedMultiplier);
  assert.equal(g.stats.sprintSpeed, base.sprintSpeed * def.speedMultiplier);
  t.collect('shiftBonus');
  assert.equal(g.stats.reloadSpeed, base.reloadSpeed * def.reloadMultiplier);
  g.gun.weapon.magazine = 0;
  g.gun.weapon.startReload();
  assert.ok(g.gun.weapon.reloadTimer < g.gun.def.reloadTime);
  g.gun.give(weapons.priceGun);
  t.press('Digit1');
  assert.ok(g.gun.isSwitching);
  t.tick(18);
  assert.equal(g.gun.isSwitching, false);
  const effect = t.active('shiftBonus');
  const remaining = effect.remaining;
  t.kill(t.spawn(), 'hazard');
  assert.equal(effect.remaining, remaining);
  t.kill(t.spawn(), 'gun');
  assert.equal(effect.remaining, remaining + def.killExtension);
  for (let i = 0; i < 25; i++) t.kill(t.spawn());
  assert.ok(effect.remaining + effect.elapsed <= def.maxSeconds);
  g.powerUps.update(30);
  assert.equal(g.stats.reloadSpeed, base.reloadSpeed);
  assert.equal(g.stats.switchSpeed, base.switchSpeed);
  assert.equal(g.stats.walkSpeed, base.walkSpeed);
  assert.equal(g.stats.sprintSpeed, base.sprintSpeed);
});

test('Inventory Liquidation spends three direct kills, uses real kill payouts, and cannot chain itself', () => {
  const t = scenario(), { g } = t;
  const trigger = t.spawn(0, 10), neighbor = t.spawn(1, 10), far = t.spawn(4, 10);
  const upstairs = t.spawn(0, 10); upstairs.position.y = 6;
  const blocked = t.spawn(-1, 10);
  g.colliders.push(new THREE.Box3(new THREE.Vector3(-0.6, 0, 9), new THREE.Vector3(-0.5, 3, 11)));
  t.collect('inventoryLiquidation');
  const before = g.runStats.kills;
  t.kill(trigger);
  assert.equal(neighbor.isAlive, true, 'secondary damage waits until the shot has finished');
  g.powerUps.update(1 / 60);
  assert.equal(neighbor.isAlive, false);
  assert.equal(neighbor.killedBy, 'incentive');
  assert.equal(g.runStats.kills - before, 2);
  assert.equal(t.active('inventoryLiquidation').charges, 2, 'secondary kill consumes no charge');
  assert.equal(far.health, 150);
  assert.equal(upstairs.health, 150);
  assert.equal(blocked.health, 150);
  g.colliders.pop();
  t.kill(t.spawn(3, 13)); t.kill(t.spawn(-3, 13));
  assert.equal(t.active('inventoryLiquidation'), undefined);
  g.powerUps.update(1 / 60);
});

test('Employee Discount composes with Flash Sales, caps savings, ignores free/failed purchases, and consumes once', () => {
  const t = scenario(), { g } = t;
  const entry = entryPriceId(g);
  const base = g.pricing.priceOf('door', entry);
  t.collect('employeeDiscount');
  assert.equal(g.pricing.priceOf('door', entry), base * 0.7);
  g.pricing.setDiscount('door', 0.5);
  assert.equal(g.pricing.priceOf('door', entry), 180);
  const tierBase = g.pricing.basePriceOf('tier', 'platinum');
  assert.equal(tierBase - g.pricing.priceOf('tier', 'platinum'), Math.min(300, Math.floor(tierBase * 0.3 / 10) * 10));
  g.events.emit('purchase', { kind: 'door', cost: 0 });
  assert.ok(t.active('employeeDiscount'));
  g.wallet.points = 0;
  t.standAt(0, 7.2); t.press('KeyF', 40);
  assert.ok(t.active('employeeDiscount'), 'denied purchases preserve coupon');
  g.wallet.points = 500;
  t.press('KeyF', 40);
  assert.equal(t.active('employeeDiscount'), undefined);
  assert.equal(g.wallet.points, 320);
  assert.equal(g.pricing.discountOf('door'), 0.5);
  assert.equal(g.pricing.priceOf('door', entry), 250);
  t.collect('employeeDiscount'); g.powerUps.update(31);
  assert.equal(g.pricing.priceOf('door', entry), 250, 'coupon expiry leaves Flash Sale intact');
});

test('Mystery Shopper marks one real target, rewards only its direct kill, and expires without a payout', () => {
  const t = scenario(), { g } = t;
  const target = t.spawn(), other = t.spawn(3, 10);
  g.gun.weapon.reserve = 0;
  t.collect('mysteryShopper');
  assert.deepEqual(t.active('mysteryShopper').targets, [target]);
  t.kill(other);
  assert.ok(t.active('mysteryShopper'));
  const points = g.wallet.points;
  t.kill(target);
  assert.ok(g.wallet.points - points > powerUps.types.mysteryShopper.points);
  assert.equal(g.gun.weapon.reserve, Math.ceil(g.gun.def.startingReserve * powerUps.types.mysteryShopper.ammoFraction));
  assert.equal(t.active('mysteryShopper'), undefined);
  const lost = t.spawn();
  t.collect('mysteryShopper');
  const before = g.wallet.points;
  t.kill(lost, 'hazard');
  assert.ok(g.wallet.points - before < powerUps.types.mysteryShopper.points);
  t.spawn(); t.collect('mysteryShopper');
  const expirePoints = g.wallet.points;
  g.powerUps.update(21);
  assert.equal(t.active('mysteryShopper'), undefined);
  assert.equal(g.wallet.points, expirePoints);
});

test('Spill Cleanup is placed behind the player, slows only zombies in the patch, and wears off', () => {
  const t = scenario(), { g } = t;
  g.player.yaw = 0;
  const z = t.spawn(0, 13.4), far = t.spawn(4, 13.4);
  const speed = z.speed;
  t.collect('spillCleanup');
  const patch = t.active('spillCleanup');
  assert.ok(patch.position.z > g.player.position.z);
  g.powerUps.update(1 / 60);
  assert.equal(z.slowFraction, powerUps.types.spillCleanup.slowFraction);
  assert.equal(far.slowFraction, 1);
  assert.equal(z.speed, speed, 'base gait is never edited');
  z.position.x = 4;
  t.tick(20);
  assert.equal(z.slowFraction, 1);
  assert.equal(z.speed, speed);
  g.powerUps.update(20);
  assert.equal(t.active('spillCleanup'), undefined);
});

test('Loss Prevention boosts three real melee hits, staggers nearby group, and pushes visible same-floor zombies while sprinting', () => {
  const t = scenario(), { g } = t;
  const base = g.stats.meleeDamageMultiplier;
  t.collect('lossPrevention');
  t.press('KeyV', 50);
  assert.equal(t.active('lossPrevention').charges, 3, 'misses cost no charges');
  g.events.emit('hit', { target: {}, melee: true });
  assert.equal(t.active('lossPrevention').charges, 3, 'practice dummies cost no charges');
  const target = t.spawn(0, 11, 5000), neighbor = t.spawn(1, 10.5, 5000);
  const before = target.health;
  for (let i = 0; i < 3; i++) {
    target.position.set(0, 0, 11); target.updateHitboxes();
    neighbor.position.set(1, 0, 10.5); neighbor.updateHitboxes();
    g.player.teleport({ position: new THREE.Vector3(0, 0, 12), yaw: 0 });
    t.press('KeyV', 12);
    assert.ok(g.melee.lastStrike, 'real melee connects');
    assert.ok(neighbor.staggerTimer > 0);
    t.tick(45);
  }
  assert.equal(t.active('lossPrevention'), undefined);
  assert.equal(before - target.health, 3 * meleeWeapons.boxCutter.damage * powerUps.types.lossPrevention.damageMultiplier);
  assert.equal(g.stats.meleeDamageMultiplier, base);

  // Sprint shove: pushes nearby visible same-floor zombies without hurting them.
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(0, 0, 12), yaw: 0 });
  const z = t.spawn(0, 10.8), far = t.spawn(4, 12), upper = t.spawn(0, 12);
  upper.position.y = 6;
  t.collect('lossPrevention');
  assert.equal(z.staggerTimer, 0);
  g.player.isSprinting = true;
  g.powerUps.update(1 / 60);
  assert.ok(z.staggerTimer > 0);
  assert.equal(far.staggerTimer, 0);
  assert.equal(upper.staggerTimer, 0);
  assert.equal(z.health, 150);
  g.powerUps.update(30);
  assert.equal(t.active('lossPrevention'), undefined);
  assert.equal(g.stats.meleeDamageMultiplier, base);
});

test('Spill slow reduces real chase and charge travel, then returns to normal without changing base gait', () => {
  const floor = new THREE.Box3(new THREE.Vector3(-50, -1, -50), new THREE.Vector3(50, 0, 50));
  const player = { position: new THREE.Vector3(0, 0, -20), height: 1.8 };
  for (const type of ['shopper', 'cartPusher']) {
    const create = () => {
      const z = new Zombie({ type: zombieTypes[type], health: 500, position: new THREE.Vector3(), yaw: 0 });
      z.speed = zombieTypes[type].speed;
      z.setState(type === 'cartPusher' ? 'charging' : 'chasing');
      z.chargeDir = { x: 0, z: -1 }; z.chargeLeft = 40;
      z.chargeCooldown = 100;
      return z;
    };
    const normal = create(), slow = create();
    slow.applySlow(2, powerUps.types.spillCleanup.slowFraction);
    const context = z => ({ player, colliders: [floor], zombies: [z], canAttack: false,
      nav: { directionTo: (a, b, direction) => { direction.x = 0; direction.z = -1; return true; } } });
    for (let tick = 0; tick < 60; tick++) { normal.update(1 / 60, context(normal)); slow.update(1 / 60, context(slow)); }
    assert.ok(Math.abs(slow.position.z) < Math.abs(normal.position.z) * 0.6, type);
    slow.applySlow(0.1, 0.8);
    assert.equal(slow.slowFraction, powerUps.types.spillCleanup.slowFraction, 'weaker slow cannot override the stronger slow');
    slow.update(3, context(slow));
    assert.equal(slow.slowFraction, 1);
    assert.equal(slow.speed, zombieTypes[type].speed);
    normal.model.dispose(); slow.model.dispose();
  }
});

test('Rotation visits every eligible common benefit before repeating and skips full ammo / jackpots before round 4', () => {
  const t = scenario(), { g } = t;
  const def = powerUps;
  const previousMax = def.maxPerRound;
  const previousThreshold = { ...def.threshold };
  try {
    def.maxPerRound = 30; def.threshold.min = def.threshold.max = 1;
    t.spawn(); t.spawn(1, 10);
    const ids = [];
    g.player.position.set(0, 0, 15); g.player.prevPosition.copy(g.player.position);
    for (let i = 0; i < 6; i++) {
      g.events.emit('kill', { zombie: { type: { id: 'shopper' }, position: new THREE.Vector3(0, 0, 10) }, source: 'gun' });
      g.powerUps.update(0.01);
      // The first threshold was sampled before this test changes config.
      if (!g.powerUps.pickup) { for (let k = 0; k < 20; k++) g.events.emit('kill', { zombie: { type: { id: 'shopper' }, position: new THREE.Vector3(0, 0, 10) }, source: 'gun' }); g.powerUps.update(0.01); }
      assert.ok(g.powerUps.pickup);
      ids.push(g.powerUps.pickup.id);
      g.powerUps.update(16);
    }
    assert.equal(new Set(ids).size, 6, ids.join(', '));
    assert.ok(!ids.includes('stockroomDelivery'));
    assert.ok(!ids.includes('paidBreak'));
    assert.ok(ids.every((id) => powerUps.types[id].tier === 'common'), 'no jackpots in round 2');
  } finally { def.maxPerRound = previousMax; Object.assign(def.threshold, previousThreshold); }
});

test('All benefits clear on death/reset, restore stats, clear coupons and discard pending secondary damage', () => {
  const t = scenario(), { g } = t;
  t.spawn(); t.spawn(1, 10);
  const timedIds = Object.keys(powerUps.types).filter(id => powerUps.types[id].seconds);
  for (const id of timedIds) t.collect(id);
  assert.equal(g.powerUps.effects.length, timedIds.length);
  t.kill(t.spawn());
  const survivor = t.spawn(1, 10);
  g.health.takeDamage(10000);
  assert.equal(g.powerUps.effects.length, 0);
  assert.equal(g.stats.reloadSpeed, createPlayerStats().reloadSpeed);
  assert.equal(g.stats.meleeDamageMultiplier, createPlayerStats().meleeDamageMultiplier);
  assert.equal(g.stats.pointsMultiplier, 1);
  assert.equal(g.stats.instantKill, false);
  assert.equal(g.stats.bossDamageMultiplier, 1);
  const hp = survivor.health;
  g.powerUps.update(1);
  assert.equal(survivor.health, hp);
  g.resetRun();
  assert.deepEqual(g.stats, createPlayerStats());
  assert.equal(g.powerUps.effects.length, 0);
  assert.equal(g.pricing.priceOf('door', entryPriceId(g)), g.pricing.basePriceOf('door', entryPriceId(g)));
});

test('HUD shows concurrent benefit timers/charges, jackpot styling and updates when one effect replaces another', () => {
  menuDom();
  const hud = createIncentiveHud();
  const status = { available: true, progress: 0, effects: [{ id: 'lossPrevention', remaining: 8, charges: 3 }, { id: 'commissionDay', remaining: 12 }] };
  hud.update(status);
  assert.match(hud.element.textContent, /LOSS PREVENTION · 8s · 3 LEFT/);
  assert.match(hud.element.textContent, /COMMISSION DAY · 12s/);
  assert.equal(hud.element.querySelectorAll('.jackpot').length, 1);
  status.effects[0].charges = 2; hud.update(status);
  assert.match(hud.element.textContent, /2 LEFT/);
  status.effects = [{ id: 'shiftBonus', remaining: 8 }]; hud.update(status);
  assert.match(hud.element.textContent, /SHIFT BONUS/);
  assert.doesNotMatch(hud.element.textContent, /LOSS PREVENTION/);
});

test('Spill floor rings and target markers render, track, hide, and dispose cleanly', () => {
  const floor = new THREE.Box3(new THREE.Vector3(-20, -1, -20), new THREE.Vector3(20, 0, 20));
  const scene = new THREE.Scene();
  const view = createPowerUpView(scene, [floor]);
  const target = { isAlive: true, position: new THREE.Vector3(1, 0, 1), type: { height: 2 } };
  const effects = [{ id: 'spillCleanup', position: new THREE.Vector3(5, 0, 0), remaining: 10 }, { id: 'mysteryShopper', targets: [target], remaining: 10 }];
  view.update(null, 1 / 60, effects);
  assert.ok(view.root.getObjectByName('spillCleanupZone').visible);
  const marker = view.root.getObjectByName('mysteryShopperMarker0');
  assert.ok(marker.visible);
  assert.ok(marker.position.y > target.type.height);
  target.position.x = 2; view.update(null, 1 / 60, effects);
  assert.equal(marker.position.x, 2);
  view.update(null, 1 / 60, []);
  assert.equal(marker.visible, false);
  assert.equal(view.root.getObjectByName('spillCleanupZone').visible, false);
  view.dispose(); assert.equal(scene.children.length, 0);
});

// (Restored from main: the trim's rewrite below dropped the other-floor, wall and max-health checks.)
test('Paid Break heals only in its circle and floor, respects walls/max health, and exhausts a finite budget', () => {
  const t = scenario(), { g } = t;
  g.stats.health = 10;
  t.collect('paidBreak');
  const effect = t.active('paidBreak');
  const initial = g.stats.health;
  g.player.position.x = 4;
  g.powerUps.update(1);
  assert.equal(g.stats.health, initial);
  g.player.position.set(0, 6, 12);
  g.powerUps.update(1);
  assert.equal(g.stats.health, initial);
  g.player.position.set(0.6, 0, 12);
  const wall = new THREE.Box3(new THREE.Vector3(0.2, 0, 11), new THREE.Vector3(0.3, 3, 13));
  g.colliders.push(wall);
  g.powerUps.update(1);
  assert.equal(g.stats.health, initial);
  g.colliders.pop();
  g.player.position.set(0, 0, 12);
  g.powerUps.update(5);
  assert.equal(g.stats.health, 70);
  assert.equal(t.active('paidBreak'), undefined);
  assert.equal(effect.healing, 0);
  g.stats.health = g.stats.maxHealth - 1;
  t.collect('paidBreak'); g.powerUps.update(1);
  assert.equal(g.stats.health, g.stats.maxHealth);
});

test('Paid Break heals inside the green circle up to its budget, stops outside its radius, and updates HUD + ring view', () => {
  const t = scenario(), { g } = t;
  g.stats.health = 50;
  const at = g.player.position.clone();
  t.collect('paidBreak');
  assert.ok(t.active('paidBreak'));

  g.powerUps.update(1);
  assert.equal(g.stats.health, 50 + powerUps.types.paidBreak.healPerSecond);
  assert.equal(t.active('paidBreak').healing, powerUps.types.paidBreak.healing - powerUps.types.paidBreak.healPerSecond);

  // Stepping outside the radius stops healing until returning inside.
  g.player.position.x = at.x + powerUps.types.paidBreak.radius + 1;
  g.powerUps.update(1);
  assert.equal(g.stats.health, 65);

  g.player.position.x = at.x;
  g.stats.health = 20;
  g.powerUps.update(4); // spends remaining 45 HP healing budget
  assert.equal(g.stats.health, 65);
  assert.equal(t.active('paidBreak'), undefined, 'Paid Break ends once its healing pool is spent');

  // View + HUD display the green circle and HP LEFT readout.
  menuDom();
  const hud = createIncentiveHud();
  hud.update({ available: true, progress: 0, effects: [{ id: 'paidBreak', remaining: 14, healing: 45 }] });
  assert.match(hud.element.textContent, /PAID BREAK · 14s · 45 HP LEFT/);

  const floor = new THREE.Box3(new THREE.Vector3(-20, -1, -20), new THREE.Vector3(20, 0, 20));
  const scene = new THREE.Scene();
  const view = createPowerUpView(scene, [floor]);
  view.update(null, 1 / 60, [{ id: 'paidBreak', position: new THREE.Vector3(0, 0, 0), remaining: 14, healing: 45 }]);
  assert.equal(view.root.getObjectByName('paidBreakZone').visible, true);
  view.update(null, 1 / 60, []);
  assert.equal(view.root.getObjectByName('paidBreakZone').visible, false);
  view.dispose();

  // Real interactions wiring: unbought doors appear in g.interactions.buyables().
  const buyables = g.interactions.buyables();
  assert.ok(buyables.some((b) => b.kind === 'door' && b.cost > 0), 'real game exposes unbought doors to need weights');
});
