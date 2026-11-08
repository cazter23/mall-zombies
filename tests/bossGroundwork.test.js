import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { createPricing } from '../src/game/pricing.js';

test('independent zombie buffs expire and multiply attack damage; bosses refuse them', t => {
  const { g, tick } = headlessGame();
  t.after(() => { g.resetRun(); g.map.dispose(); });
  g.rounds.jumpTo(6); g.rounds.update = () => {};
  const z = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 10.6));
  z.setState('chasing');
  z.applyBuff('fast', { speed: 1.3, seconds: 0.2 });
  z.applyBuff('strong', { damage: 1.25, seconds: 2 });
  assert.equal(z.speedMultiplier, 1.3);
  tick(13);
  assert.equal(z.speedMultiplier, 1);
  assert.equal(z.damageMultiplier, 1.25);
  z.speed = 0; z.yaw = Math.PI; z.setState('windup'); z.stateTime = z.windupSeconds;
  let damage;
  g.events.on('playerHit', e => { damage = e.damage; });
  tick();
  assert.equal(damage, z.type.attack.damage * 1.25);
  const boss = g.bosses.summon('janitor');
  assert.equal(boss.applyBuff(z, { seconds: 2, speed: 2 }), false);
  z.takeHit({ damage: z.health, part: 'body' });
  assert.equal(z.damageMultiplier, 1);
});

test('holds stop movement and end on timeout, source death, player death, clear and reset', t => {
  const { g, tick } = headlessGame();
  t.after(() => { g.resetRun(); g.map.dispose(); });
  g.rounds.jumpTo(6); g.rounds.update = () => {};
  const source = g.zombies.spawn('shopper', new THREE.Vector3(2, 0, 8));
  const z = g.zombies.spawn('shopper', new THREE.Vector3(-2, 0, 8));
  source.setState('chasing'); z.setState('chasing');
  z.applyHold(source, dt * 3);
  const at = z.position.clone(); tick();
  assert.equal(z.position.x, at.x); assert.equal(z.position.z, at.z);
  tick(3); assert.equal(z.hold, null);
  z.applyHold(source, 10); source.die(); tick(); assert.equal(z.hold, null);
  const other = g.zombies.spawn('shopper', new THREE.Vector3(2, 0, 8));
  z.applyHold(other, 10); g.health.takeDamage(g.stats.maxHealth); assert.equal(z.hold, null);
  g.resetRun(); assert.equal(other.hold, null);
  assert.equal(g.zombies.zombies.length, 0);
});

test('voucher is separate from sales and Employee Discount and converts as soon as exhausted', () => {
  const pricing = createPricing();
  let useful = true, paid = 0;
  pricing.configureVouchers({ eligible: () => useful, onPoints: n => { paid += n; } });
  const voucher = { name: 'Test', category: 'door', fraction: 1, pointsInstead: 250 };
  pricing.setVoucher(voucher);
  pricing.setDiscount('door', 0.5);
  pricing.setCoupon({ fraction: 0.5, maxSaving: 2000 });
  assert.equal(pricing.priceOf('door', 'hallway'), 0);
  pricing.clearCoupon(); pricing.setDiscount('door', 0);
  assert.equal(pricing.voucher, voucher);
  pricing.spendVoucher('ammoCache'); assert.equal(pricing.voucher, voucher);
  useful = false; pricing.update(); assert.equal(paid, 250); assert.equal(pricing.voucher, null);
  pricing.setVoucher(voucher); assert.equal(paid, 500);
  useful = true; pricing.setVoucher(voucher); pricing.spendVoucher('door', 'hallway');
  assert.equal(pricing.voucher, null); assert.equal(paid, 500);
});
