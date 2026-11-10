// RETURN TO SENDER (config/weapons.js returnToSender: the claw-only wonder weapon) and its two rules: the INSTANT KILL (weapons/gunStats.js hitDamage:
// any returnable zombie dies in one hit at any round; a boss or a Mascot, which can't be returned, takes a big fixed share of its health instead, never a
// one-shot) and the HALF-RATE REFILL (weapon.js refillFraction: a refill fills the magazine and half the reserve). First the maths alone, then the real game.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { economy, zombieHealthFor } from '../src/config/economy.js';
import { hitDamage, isReturnable, resolveGun, INSTANT_KILL_DAMAGE } from '../src/weapons/gunStats.js';
import { withTier } from '../src/weapons/upgrades.js';
import { buildWallBuy } from '../src/game/features/wallBuy.js';
import { Weapon } from '../src/weapons/weapon.js';

const rts = weapons.returnToSender;
const stats = { damageMultiplier: 1 };
const shopper = { type: {}, maxHealth: 3400, health: 3400 };
const mascot = { type: { mascot: {} }, maxHealth: 3000, health: 3000 };
const boss = { type: { boss: true }, maxHealth: 5000, health: 5000 };

test('hitDamage: a returnable zombie takes an instant kill at any health; a boss or a Mascot takes bigFraction of its max health; no target = the nominal damage', () => {
  assert.equal(rts.instantKill.bigFraction > 0 && rts.instantKill.bigFraction < 0.3, true, 'a big hit, never a one-shot');
  assert.equal(hitDamage(rts, { part: 'body', distance: 5 }, 0, stats, 1, shopper), INSTANT_KILL_DAMAGE);
  assert.ok(INSTANT_KILL_DAMAGE > 1e6, 'more than any zombie has');
  assert.equal(hitDamage(rts, { part: 'head', distance: 5 }, 0, stats, 1, mascot), mascot.maxHealth * rts.instantKill.bigFraction);
  assert.equal(hitDamage(rts, { part: 'body', distance: 5 }, 0, stats, 1, boss), boss.maxHealth * rts.instantKill.bigFraction);
  assert.equal(hitDamage(rts, { part: 'body', distance: 5 }, 0, stats), rts.damage, 'nothing hit: the nominal number (what a stuffing scales from)');
  assert.equal(isReturnable(shopper), true);
  assert.equal(isReturnable(mascot) || isReturnable(boss), false);
  // Other guns are untouched by the new argument.
  for (const gun of [weapons.priceGun, weapons.nailGun, weapons.confettiCannon]) {
    assert.equal(hitDamage(gun, { part: 'body', distance: 5 }, 0, stats, 1, shopper), hitDamage(gun, { part: 'body', distance: 5 }, 0, stats));
  }
});

test('hitDamage: the gun\'s tiers and the player\'s damage stat make the big hit bigger, but never a kill; bosses never fall to one shot', () => {
  const platinum = resolveGun(rts, withTier(rts, [], 'platinum'));
  const plain = hitDamage(rts, { part: 'body', distance: 5 }, 0, stats, 1, boss);
  const tiered = hitDamage(platinum, { part: 'body', distance: 5 }, 0, stats, 1, boss);
  assert.ok(tiered > plain * 1.4, 'an Extended Warranty helps against a boss');
  assert.ok(tiered < boss.maxHealth * 0.5, 'and it is still nowhere near a one-shot');
  assert.equal(hitDamage(platinum, { part: 'body', distance: 5 }, 0, { damageMultiplier: 2 }, 1, boss), tiered * 2);
});

// A tidy spot in the hallway facing east, the gun in hand, and frozen zombies in a line.
function setup() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.player.teleport({ position: new THREE.Vector3(-2, 0, 0.5), yaw: -Math.PI / 2 });
  g.gun.give(rts);
  t.tick(60);
  const eye = new THREE.Vector3(), aim = new THREE.Vector3();
  g.player.getAim(eye, aim);
  const spawn = (type, ahead, side = 0) => g.zombies.spawn(type, new THREE.Vector3(eye.x + ahead, 0, eye.z + side));
  const freeze = (zs) => { t.tick(2); for (const z of zs) { z.speed = 0; z.attackCooldown = 99; z.velocity.set(0, 0, 0); } t.tick(80); };
  return { t, g, spawn, freeze };
}

test('the real game: one beam kills a round-30 Shopper outright and pays the normal kill; the cardboard stamp sounds; only ONE zombie per beam', () => {
  const { t, g, spawn, freeze } = setup();
  const front = spawn('shopper', 5), behind = spawn('shopper', 6.5);
  freeze([front, behind]);
  for (const z of [front, behind]) z.health = z.maxHealth = zombieHealthFor('shopper', 30);
  assert.ok(front.maxHealth > 3000, 'round-30 health');
  const points = g.wallet.points, kills = g.runStats.kills;
  t.press('Mouse0');
  assert.equal(front.isAlive, false, 'returned');
  assert.equal(behind.isAlive, true, 'one zombie a beam: it does not pierce');
  assert.equal(g.runStats.kills, kills + 1);
  assert.ok(g.wallet.points - points >= 10 + economy.killValues.shopper * 0, 'the usual hit and kill points are paid');
  assert.ok(t.sounds.includes('returnBeam') && t.sounds.includes('returnStamp'));
});

test('the real game: a boss takes the big fixed hit and lives (a Mascot too: its rule is the same type.mascot check, covered above; the headless game cannot pose a Mascot to shoot it)', () => {
  const { t, g, spawn, freeze } = setup();
  const b = spawn('shopper', 5);
  freeze([b]);
  b.type = { ...b.type, boss: true }; // (a Shopper flagged as a boss: the rule keys on type.boss, and zombie.js refuses every push for one)
  b.health = b.maxHealth = 5000;
  t.press('Mouse0');
  assert.equal(b.isAlive, true, 'a boss cannot be returned');
  assert.ok(Math.abs(5000 - b.health - 5000 * rts.instantKill.bigFraction) < 100, `it took the big hit (${(5000 - b.health).toFixed(0)} of 5000)`);
  // ...and a second beam takes the same again: bosses die to a few beams, never one.
  t.tick(Math.ceil(rts.fireInterval / dt) + 5);
  t.press('Mouse0');
  assert.ok(Math.abs(5000 - b.health - 2 * 5000 * rts.instantKill.bigFraction) < 150);
});

test('the half-rate refill: a refill (RESTOCK-O-MATIC, an ammo buy, a Refurbished grab) fills the magazine and only half the reserve; "full" means that', () => {
  const weapon = new Weapon(rts, { reloadSpeed: 1, reserveMultiplier: 1 });
  assert.deepEqual([weapon.magazine, weapon.reserve], [rts.magazineSize, rts.startingReserve], 'it starts with all of it');
  assert.equal(weapon.isFull, true);
  weapon.magazine = 0;
  weapon.reserve = 0;
  assert.equal(weapon.isFull, false);
  weapon.refill();
  assert.deepEqual([weapon.magazine, weapon.reserve], [rts.magazineSize, Math.round(rts.startingReserve * rts.refillFraction)]);
  assert.equal(weapon.isFull, true, 'and an ammo machine has nothing more to give it');
  weapon.reserve = rts.startingReserve; // more than a refill would give: a refill never takes ammo away
  weapon.refill();
  assert.equal(weapon.reserve, rts.startingReserve);
  const plain = new Weapon(weapons.priceGun, { reloadSpeed: 1, reserveMultiplier: 1 });
  plain.magazine = 0; plain.reserve = 0; plain.refill();
  assert.equal(plain.reserve, weapons.priceGun.startingReserve, 'every other gun refills fully');
  weapon.magazine = 1; weapon.reserve = 0;
  weapon.restock(0.5);
  assert.equal(weapon.reserve, Math.round(rts.startingReserve * rts.refillFraction), 'a Stockroom Delivery too');
});

test('claw-only: no wall price, and the wall-buy feature refuses it', () => {
  assert.equal(rts.clawOnly, true);
  assert.equal(economy.wallBuys.returnToSender, undefined);
  const added = [];
  const ctx = { scene: { add: () => added.push('scene') }, map: { zones: {} }, gun: { owns: () => false }, pricing: {}, interactions: { add: () => added.push('interaction') } };
  assert.equal(buildWallBuy({ weapon: 'returnToSender', zone: 'hallway', position: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) }, ctx), null);
  assert.deepEqual(added, []);
});

test('Build-A-Blaster on the wonder weapon: a stuffed Return to Sender still returns in one beam, its stuffing scales from the nominal damage (weaker than any wall automatic), and the Last Round heart fires on the round that empties it', async () => {
  const { buildModifiers } = await import('../src/weapons/upgrades.js');
  const { workshopStuffings, workshopRitual } = await import('../src/config/workshop.js');
  const { gunPower } = await import('../src/weapons/gunStats.js');
  const priceGun = weapons.priceGun;
  assert.ok(gunPower(rts, stats) < 0.5 * gunPower(priceGun, stats), 'a stuffing scales from the nominal damage over the cycle: a mid gun\'s power, not a wonder weapon\'s');
  const { t, g, spawn, freeze } = setup();
  const quality = workshopRitual.qualities.find((q) => q.id === 'regular');
  const build = { stuffing: 'fryerOil', heart: 'lastRound', quality: 'regular', kills: 0 };
  g.gun.setMods('returnToSender', [{ id: 'build', build, modifiers: buildModifiers(rts, workshopStuffings.fryerOil.color, quality.gun) }]);
  g.gun.weapon.refill();
  const z = spawn('shopper', 5), other = spawn('shopper', 8, 1);
  freeze([z, other]);
  z.health = z.maxHealth = zombieHealthFor('shopper', 30);
  let fired = 0;
  g.events.on('buildFired', () => { fired += 1; });
  g.gun.weapon.magazine = 1; // the last round
  t.press('Mouse0');
  assert.equal(z.isAlive, false, 'still returned in one beam');
  assert.ok(fired >= 1, 'the Last Round heart fired its stuffing');
});
