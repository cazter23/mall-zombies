// Bugs found in a review of the boss / voucher / Build-A-Blaster work, each pinned down:
//   - a free attachment refit must not use up a part-price voucher (Discount Code)
//   - a boss voucher left on the floor (another one still held) pays its points when it runs out
//   - Signed Approval must survive the gun it would upgrade being away at Build-A-Blaster
//   - a boss killing the player mid-update must not make the next zombie skip its tick
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { featuresOf } from '../src/game/features/index.js';
import { bossVouchers } from '../src/config/bosses.js';
import { powerUps as incentiveConfig } from '../src/config/powerUps.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { withTier } from '../src/weapons/upgrades.js';
import { createPricing } from '../src/game/pricing.js';

function openMall() {
  const t = headlessGame();
  const { g } = t;
  g.health.invulnerable = true;
  g.rounds.update = () => {};
  g.map.areaUnlocks.openAll();
  t.tick(120);
  g.zombies.clear();
  return t;
}

test('a free attachment refit keeps the Discount Code; a paid fitting spends it', () => {
  const t = openMall();
  const { g } = t;
  g.wallet.earn(50_000);
  const spot = (id) => featuresOf(g.map, 'attachmentCounter').find((f) => f.attachment === id);
  const buy = (id) => {
    const s = spot(id);
    t.standAt(s.position.x + s.normal.x * 1.3, s.position.z + s.normal.z * 1.3, (Math.atan2(s.normal.x, s.normal.z) * 180) / Math.PI);
    t.press('KeyF', 30);
    t.tick(30);
  };
  const bought = [];
  g.events.on('purchase', (p) => bought.push(p));
  g.gun.give(weapons.priceGun);
  t.tick(40);
  const slot = upgrades.attachments.laserPointer.slot;
  const other = Object.keys(upgrades.attachments).find((id) => id !== 'laserPointer' && upgrades.attachments[id].slot === slot);
  buy('laserPointer');
  buy(other); // both owned now, `other` fitted

  g.pricing.setVoucher(bossVouchers.discountCode);
  buy('laserPointer'); // owned: a free refit
  assert.equal(bought.at(-1).cost, 0);
  assert.equal(g.pricing.voucher?.name, 'Discount Code', 'a refit that cost nothing did not use the voucher');

  buy('gripTape'); // a new, paid fitting (another slot): half price, and the voucher goes
  assert.ok(bought.at(-1).cost > 0);
  assert.equal(g.pricing.voucher, null);
  g.map.dispose();
});

test('spendVoucher: a payment of 0 spares a part-price voucher but still uses up a full-discount one', () => {
  const pricing = createPricing();
  pricing.setVoucher(bossVouchers.discountCode);
  pricing.spendVoucher('attachment', 'laserPointer', 0);
  assert.ok(pricing.voucher, 'half-price voucher kept');
  pricing.spendVoucher('attachment', 'laserPointer', 380);
  assert.equal(pricing.voucher, null);
  pricing.setVoucher(bossVouchers.masterKey);
  pricing.spendVoucher('door', 'hallway', 0); // the key made it free
  assert.equal(pricing.voucher, null);
});

test('a boss voucher left on the floor while you hold another pays its points when it runs out', () => {
  const t = openMall();
  const { g } = t;
  g.rounds.jumpTo(9);
  t.tick(60);
  g.zombies.clear();
  g.pricing.setVoucher(bossVouchers.discountCode);
  const guard = g.bosses.summon('guard');
  guard.position.set(0, 0, 9);
  guard.speed = 0;
  guard.chargeCooldown = Infinity;
  t.tick(5);
  guard.takeHit({ damage: guard.health + 1, part: 'body' });
  t.tick(2);
  const pickup = g.powerUps.pickup;
  assert.equal(pickup?.id, 'masterKey');
  t.standAt(pickup.position.x, pickup.position.z, 0, 0);
  const before = g.wallet.points;
  const expired = [];
  g.events.on('powerUpExpire', (e) => expired.push(e));
  t.tick(Math.ceil((incentiveConfig.lifetime + 1) / dt));
  assert.equal(g.pricing.voucher?.name, 'Discount Code', 'still holding the first one');
  assert.equal(g.powerUps.pickup, null);
  assert.equal(g.wallet.points, before + bossVouchers.masterKey.pointsInstead);
  assert.deepEqual(expired.map((e) => [e.id, e.pointsInstead]), [['masterKey', bossVouchers.masterKey.pointsInstead]]);
  g.map.dispose();
});

test('Signed Approval is not turned into points while the gun it would upgrade is at Build-A-Blaster', () => {
  const t = openMall();
  const { g } = t;
  g.gun.give(weapons.priceGun);
  t.tick(60);
  // The Price Gun is maxed; only the Staple Gun can use the approval.
  g.gun.setMods('priceGun', withTier(weapons.priceGun, g.gun.modsFor('priceGun'), 'platinum'));
  g.pricing.setVoucher(bossVouchers.signedApproval);
  const before = g.wallet.points;
  t.tick(2);
  assert.equal(g.pricing.voucher?.name, 'Signed Approval');
  // Hand the Staple Gun over (the bench does this); the approval still has somewhere to go.
  g.gun.setMods('stapleGun', g.gun.modsFor('stapleGun'));
  g.gun.handOver({ ...weapons.stapleGun, name: 'Courtesy Loaner', loaner: true });
  t.tick(2);
  assert.equal(g.pricing.voucher?.name, 'Signed Approval', 'kept while its gun is away');
  assert.equal(g.wallet.points, before);
  g.map.dispose();
});

test('a boss landing the killing blow does not make the zombie after it skip its tick, and is gone once the tick ends', () => {
  const t = openMall();
  const { g } = t;
  g.health.invulnerable = false;
  g.rounds.jumpTo(12);
  t.tick(60);
  g.zombies.clear();
  const boss = g.bosses.summon('manager');
  boss.position.set(0, 0, 11);
  boss.prevPosition.copy(boss.position);
  boss.setState('chasing');
  const shoppers = [-4, 4].map((x) => {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(x, 0, 14));
    z.setState('chasing');
    z.speed = 0;
    return z;
  });
  assert.equal(g.zombies.zombies[0], boss, 'the boss is first in the list: the case that used to skip');
  t.standAt(0, 12, 0, 0);
  g.stats.health = 1;
  let deathTickTimes = null;
  g.events.on('playerDeath', () => { deathTickTimes = shoppers.map((z) => z.stateTime); });
  let guard = 0;
  while (!g.state.over && guard++ < 600) t.tick(1);
  assert.ok(g.state.over, 'the boss killed the player');
  const [a, b] = shoppers.map((z) => z.stateTime);
  assert.ok(Math.abs(a - b) < 1e-9, `both shoppers ticked on the death tick (${a} vs ${b})`);
  assert.ok(deathTickTimes);
  assert.ok(!g.zombies.zombies.includes(boss), 'the boss is swept by the end of that tick');
  assert.ok(!g.shootables.includes(boss));
  g.map.dispose();
});
