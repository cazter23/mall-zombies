// Features that were built on separate branches, checked TOGETHER (the integration of incentives, Flash Sales, Kiosk Kevin
// phase 8 and the claw-only guns): the incentive jackpots on the claw guns (Black Friday one-shots through a Bottle Rocket's
// burst, a Stargazer round and a balloon, and triples a blast on a boss; Commission Day doubles a blast kill's points and
// changes nothing else), and the three price layers stacking in one order (the bigger of a category Flash Sale and a
// Doorbuster's per-item discount, then the Employee Discount coupon).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { zombieTypes } from '../src/config/zombies.js';
import { powerUps as incentives } from '../src/config/powerUps.js';
import { createPlayerStats } from '../src/player/stats.js';
import { createPricing } from '../src/game/pricing.js';
import { hitDamage, INSTANT_KILL_DAMAGE } from '../src/weapons/gunStats.js';

const rk = weapons.bottleRocket;
const FLIGHT_TICKS = Math.ceil(rk.flight.lifeSeconds / dt) + 5;

// The Main Hallway along z 0, the bazooka in hand, a frozen shopper clump 18 m ahead (as in bottleRocket.test.js).
// `jackpot`: an incentive id dropped at your feet and picked up first. `health`: what each zombie in the clump has.
function rocketIntoClump({ jackpot = null, health = 1e6 } = {}) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(-17, 0, 0), yaw: -Math.PI / 2 });
  g.gun.give(rk);
  t.tick(60);
  if (jackpot) {
    assert.ok(g.powerUps.debugDrop(jackpot), `${jackpot} dropped`);
    t.tick(2);
    assert.ok(g.powerUps.effects.some((e) => e.id === jackpot), `${jackpot} picked up`);
  }
  const blasts = [];
  g.events.on('gunBlast', (b) => blasts.push(b));
  const clump = [[1, 0], [1.6, 0.9], [1.6, -0.9], [2.8, 0]].map(([x, z]) => g.zombies.spawn('shopper', new THREE.Vector3(x, 0, z)));
  t.tick(2);
  for (const z of clump) { z.speed = 0; z.attackCooldown = 99; z.velocity.set(0, 0, 0); z.health = health; }
  t.tick(30);
  g.player.pitch = Math.atan2(1.2 - 1.6, 18);
  g.gun.aim.applySpread = () => {};
  const before = g.wallet.points;
  g.gun.weapon.magazine = 1;
  g.gun.weapon.cooldown = 0;
  t.press('Mouse0');
  t.tick(FLIGHT_TICKS);
  assert.equal(blasts.length, 1, 'the rocket burst');
  return { t, g, clump, blasts, earned: g.wallet.points - before };
}

test('Black Friday: every shopper caught in a Bottle Rocket burst dies to it, whatever its health (the blast goes through the jackpot step)', () => {
  const plain = rocketIntoClump();
  assert.ok(plain.clump.every((z) => z.isAlive), 'no jackpot: a million health shrugs off one rocket');
  const bf = rocketIntoClump({ jackpot: 'blackFriday' });
  assert.equal(bf.g.stats.instantKill, true);
  assert.equal(bf.blasts[0].hits.length, 4);
  assert.ok(bf.clump.every((z) => !z.isAlive), 'Black Friday: the whole clump goes on first contact, the edge of the burst included');
});

test('Black Friday maths on the three claw guns: a blast, a Stargazer round and a balloon one-shot a shopper; a blast on a boss is exactly x bossDamageMultiplier', () => {
  const stats = createPlayerStats();
  const shopper = { type: zombieTypes.shopper, maxHealth: 150 };
  const boss = { type: { id: 'boss', boss: true }, maxHealth: 5000 };
  const blastHit = { part: 'body', blastDistance: 1.5 };
  const blastPlain = hitDamage(rk, blastHit, 0, stats, 1, boss);
  assert.ok(blastPlain > 0 && blastPlain < rk.damage, 'off-centre: the falloff applies');
  assert.equal(hitDamage(rk, blastHit, 0, stats, 1, shopper), blastPlain, 'no jackpot: a blast is a blast');
  stats.instantKill = true;
  stats.bossDamageMultiplier = incentives.types.blackFriday.bossDamageMultiplier;
  assert.equal(hitDamage(rk, blastHit, 0, stats, 1, shopper), INSTANT_KILL_DAMAGE);
  assert.equal(hitDamage(rk, blastHit, 0, stats, 1, boss), blastPlain * incentives.types.blackFriday.bossDamageMultiplier);
  assert.equal(hitDamage(rk, blastHit, 0, stats, 1, null), blastPlain, 'no target (the balance report): unchanged');
  for (const def of [weapons.stargazer, weapons.balloonLauncher]) {
    assert.equal(hitDamage(def, { part: 'body', distance: 30 }, 0, stats, 1, shopper), INSTANT_KILL_DAMAGE, def.id);
  }
});

test('Commission Day: a Bottle Rocket kill pays exactly double, the burst does the same damage, and a refund is not doubled', () => {
  // Damage: a clump that survives takes exactly the same from the burst with and without the jackpot.
  const plainHurt = rocketIntoClump();
  const cdHurt = rocketIntoClump({ jackpot: 'commissionDay' });
  assert.deepEqual(cdHurt.clump.map((z) => z.health), plainHurt.clump.map((z) => z.health), 'Commission Day changes no damage');
  assert.equal(cdHurt.earned, plainHurt.earned * incentives.types.commissionDay.pointsMultiplier, 'the +10s are doubled');

  // Kills: four shoppers on 1 health each, every one killed by the burst; the payout is the 'kill' payouts, doubled once.
  const plainKill = rocketIntoClump({ health: 1 });
  const cdKill = rocketIntoClump({ jackpot: 'commissionDay', health: 1 });
  assert.ok(plainKill.clump.every((z) => !z.isAlive) && cdKill.clump.every((z) => !z.isAlive));
  assert.ok(plainKill.earned > 0);
  assert.equal(cdKill.earned, plainKill.earned * incentives.types.commissionDay.pointsMultiplier);

  // A refund (GRAB-A-GUN's plush hands back what the grab cost) is not income: the jackpot leaves it alone.
  const { g } = cdKill;
  g.wallet.earn(1000);
  const before = g.wallet.points;
  g.wallet.spend(economy.claw.grab);
  g.wallet.refund(economy.claw.grab);
  assert.equal(g.wallet.points, before);
});

test('prices: the bigger of a category Flash Sale and a Doorbuster applies, then the Employee Discount coupon (the real incentive)', () => {
  const step = economy.discountRoundTo;
  const { fraction, maxSaving } = incentives.types.employeeDiscount;
  const coupon = { fraction, maxSaving };
  const expect = (base, off) => {
    const sale = Math.round((base * (1 - off)) / step) * step;
    return sale - Math.min(maxSaving, Math.floor((sale * fraction) / step) * step);
  };
  const p = createPricing();
  const base = economy.wallBuys.rivetRifle.weapon;
  p.setDiscount('weapon', 0.4);
  p.setItemDiscount('weapon', 'rivetRifle', 0.7);
  p.setCoupon(coupon);
  assert.equal(p.priceOf('weapon', 'rivetRifle'), expect(base, 0.7), 'the item discount is bigger: it wins');
  assert.equal(p.priceOf('weapon', 'nailGun'), expect(economy.wallBuys.nailGun.weapon, 0.4), 'another gun: the category sale');
  p.setItemDiscount('weapon', 'rivetRifle', 0.3);
  assert.equal(p.priceOf('weapon', 'rivetRifle'), expect(base, 0.4), 'the category sale is bigger: it wins');
  // Pinned: 1500 at 70% off = 450, minus 30% rounded down to 10 (130) = 320; at 40% off = 900, minus 270 = 630.
  assert.equal(expect(1500, 0.7), 320);
  assert.equal(expect(1500, 0.4), 630);
  p.clearCoupon();
  assert.equal(p.priceOf('weapon', 'rivetRifle'), Math.round((base * 0.6) / step) * step, 'no coupon: the sale price alone');

  // Real game: a real Doorbuster plus the real Employee Discount picked up at your feet, plus a category discount on the
  // same category. Every layer comes off the one price.
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.map.areaUnlocks.unlock('hallway');
  g.rounds.jumpTo(4);
  assert.equal(g.flashSales.startNow('doorbuster'), true);
  const { category, id } = g.flashSales.active.target;
  const itemOff = g.flashSales.active.discount;
  const itemBase = g.pricing.basePriceOf(category, id);
  g.pricing.setDiscount(category, 0.25);
  assert.ok(g.powerUps.debugDrop('employeeDiscount'));
  t.tick(2);
  const priced = g.pricing.priceOf(category, id);
  const sale = Math.round((itemBase * (1 - Math.max(itemOff, 0.25))) / step) * step;
  assert.equal(priced, sale - Math.min(maxSaving, Math.floor((sale * fraction) / step) * step), `${category} ${id}`);
  assert.ok(priced < sale, 'the coupon took something off the Doorbuster price');
  g.map.dispose();
});
