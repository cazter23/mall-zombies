// game/warranty.js in the real game: tier jobs, Warranty Renewals past Platinum, a warranty left on file by a replaced gun and moved onto another for a fee,
// and the Platinum claim (a dry gun's ammo replaced once per round).
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { economy } from '../src/config/economy.js';
import { createPricing } from '../src/game/pricing.js';
import { renewalsOf, tierOf, withRenewals, withTier } from '../src/weapons/upgrades.js';

function fixture() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;
  const setTier = (id, tier) => g.gun.setMods(id, withTier(g.gun.defOf(id).base, g.gun.modsFor(id), tier));
  return { ...t, setTier };
}

test('each tier has its own job: Deluxe is handling, Premium is damage, Platinum is the most damage and a claim', () => {
  const [, deluxe, premium, platinum] = upgrades.tiers;
  assert.ok(deluxe.effects.magazine > 1 && deluxe.effects.reload < 1, 'Deluxe: magazine and reload');
  // A tier REPLACES the one before (withTier), so a later tier never takes handling away (docs/balance-review.md, P1: Premium used to shrink
  // Deluxe's magazine and give back its reload).
  for (const [lower, higher] of [[deluxe, premium], [premium, platinum]]) {
    assert.ok(higher.effects.magazine >= lower.effects.magazine, `${higher.id}: a magazine at least ${lower.id}'s`);
    assert.ok((higher.effects.reload ?? 1) <= (lower.effects.reload ?? 1), `${higher.id}: reloads at least as fast as ${lower.id}`);
  }
  assert.ok(deluxe.effects.damage < 1.2 && premium.effects.damage >= 1.4 && platinum.effects.damage > premium.effects.damage, 'damage rises Deluxe < Premium < Platinum');
  assert.equal(platinum.claim, true);
  assert.ok(!deluxe.claim && !premium.claim);
});

test('Warranty Renewals compound, are priced one by one, and stop at the cap', () => {
  const base = weapons.nailGun;
  let mods = withTier(base, [], 'platinum');
  const platinumDamage = upgrades.tiers.at(-1).effects.damage;
  for (let n = 1; n <= upgrades.renewals.max; n++) {
    mods = withRenewals(base, mods, n);
    assert.equal(renewalsOf(mods), n);
    assert.equal(mods.filter(m => m.id === 'renewal').length, 1, 'one renewal mod at a time');
  }
  assert.equal(tierOf(mods), 'platinum', 'a renewal does not change the tier');
  const prices = [1, 2, 3, 4, 5].map(n => createPricing().priceOf('tier', `renewal${n}`));
  assert.deepEqual(prices, economy.upgrades.renewals);
  assert.deepEqual([...prices].sort((a, b) => a - b), prices, 'each dearer than the last');
  assert.ok(platinumDamage > 1);
});

test('the offer: a warranty on file beats the next tier, and moving it costs a share of that tier\'s price', () => {
  const t = fixture(), { g } = t;
  const warranty = g.features.context.warranty;
  g.gun.give(weapons.nailGun); t.tick(50);
  t.setTier('nailGun', 'premium');
  t.tick(2);
  g.gun.give(weapons.priceGun); t.tick(50); // a full loadout: this replaces the gun in hand
  assert.ok(!g.gun.slots.includes('nailGun') || g.gun.slots.length === 2);
  if (g.gun.slots.includes('nailGun')) { g.gun.give(weapons.rivetRifle); t.tick(50); }
  assert.ok(!g.gun.slots.includes('nailGun'), 'the Nail Gun was replaced');
  assert.equal(warranty.onFile, 'premium', 'its warranty is on file');
  const id = g.gun.def.id;
  const offer = warranty.offer(id);
  assert.equal(offer.kind, 'transfer');
  assert.equal(offer.tier, 'premium');
  assert.equal(createPricing().priceOf('tier', offer.pricingId), Math.round(economy.upgrades.tiers.premium * upgrades.transfer.feeFraction));
  warranty.accept(id, offer);
  assert.equal(tierOf(g.gun.modsFor(id)), 'premium', 'now on the gun in hand');
  assert.equal(warranty.onFile, null, 'and no longer on file');
  assert.equal(warranty.offer(id).kind, 'tier', 'the desk goes back to selling the next tier');
  g.map.dispose();
});

test('a gun away at Build-A-Blaster is not a replaced gun: nothing goes on file', () => {
  const t = fixture(), { g } = t;
  const warranty = g.features.context.warranty;
  g.gun.give(weapons.nailGun); t.tick(50);
  t.setTier('nailGun', 'deluxe');
  t.tick(2);
  g.gun.handOver({ ...weapons.stapleGun, name: 'Courtesy Loaner' });
  t.tick(5);
  assert.equal(warranty.onFile, null);
  g.map.dispose();
});

test('Platinum claim: a completely dry gun gets its ammo back, once per round', () => {
  const t = fixture(), { g } = t;
  const claims = [];
  g.events.on('warrantyClaim', (c) => claims.push(c));
  const weapon = g.gun.weapon;
  weapon.magazine = 0; weapon.reserve = 0;
  t.tick(2);
  assert.equal(claims.length, 0, 'a Standard gun gets nothing');
  t.setTier('stapleGun', 'platinum');
  weapon.magazine = 0; weapon.reserve = 5;
  t.tick(2);
  assert.equal(claims.length, 0, 'not while there is still reserve');
  weapon.reserve = 0;
  t.tick(2);
  assert.equal(claims.length, 1, 'dry: it claims');
  assert.equal(weapon.magazine, g.gun.def.magazineSize, 'a full magazine');
  assert.ok(weapon.reserve >= g.gun.def.startingReserve, 'and a full reserve');
  assert.match(claims[0].pa.text, /Warranty claim approved/);
  weapon.magazine = 0; weapon.reserve = 0;
  t.tick(2);
  assert.equal(claims.length, 1, 'only once per round');
  g.rounds.jumpTo(g.rounds.round + 1);
  t.tick(2);
  assert.equal(claims.length, 2, 'and again next round');
  g.map.dispose();
});

test('Play again clears a warranty on file', () => {
  const t = fixture(), { g } = t;
  const warranty = g.features.context.warranty;
  g.gun.give(weapons.nailGun); t.tick(50);
  t.setTier('nailGun', 'premium');
  t.tick(2);
  g.gun.give(weapons.priceGun); t.tick(50);
  g.gun.give(weapons.rivetRifle); t.tick(50);
  assert.equal(warranty.onFile, 'premium');
  g.resetRun(); t.tick(2);
  assert.equal(warranty.onFile, null);
  g.map.dispose();
});

test('a held Premium gun is offered Platinum instead of a Premium transfer; Platinum is offered a Renewal', () => {
  const t = fixture(), { g } = t;
  const warranty = g.features.context.warranty;
  const pricing = createPricing();

  // Put Premium on file by replacing a Premium Nail Gun.
  g.gun.give(weapons.nailGun); t.tick(50);
  t.setTier('nailGun', 'premium');
  t.tick(2);
  g.gun.give(weapons.priceGun); t.tick(50);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'priceGun'], 'the Price Gun replaced the Nail Gun in hand');
  assert.equal(warranty.onFile, 'premium');

  // A Standard gun still sees the Premium transfer for 750 (25% of 3,000).
  const transferOffer = warranty.offer('stapleGun');
  assert.deepEqual(transferOffer, { kind: 'transfer', tier: 'premium', pricingId: 'transfer:premium' });
  assert.equal(pricing.priceOf('tier', transferOffer.pricingId), 750);

  // A held Premium gun is already at that rank, so Customer Service offers Platinum (6,000).
  const heldId = g.gun.def.id;
  t.setTier(heldId, 'premium');
  t.tick(2);
  const platOffer = warranty.offer(heldId);
  assert.deepEqual(platOffer, { kind: 'tier', tier: 'platinum', pricingId: 'platinum' });
  assert.equal(pricing.priceOf('tier', platOffer.pricingId), 6000);

  // A held Platinum gun is offered Renewal 1 (4,000), leaving Premium on file untouched.
  t.setTier(heldId, 'platinum');
  t.tick(2);
  const renewalOffer = warranty.offer(heldId);
  assert.deepEqual(renewalOffer, { kind: 'renewal', count: 1, pricingId: 'renewal1' });
  assert.equal(pricing.priceOf('tier', renewalOffer.pricingId), 4000);
  assert.equal(warranty.onFile, 'premium');
  g.map.dispose();
});

test('replacing a Deluxe gun never overwrites a Premium warranty already on file', () => {
  const t = fixture(), { g } = t;
  const warranty = g.features.context.warranty;

  // Replace a Premium Nail Gun so Premium sits on file, leaving Price Gun in hand.
  g.gun.give(weapons.nailGun); t.tick(50);
  t.setTier('nailGun', 'premium');
  t.tick(2);
  g.gun.give(weapons.priceGun); t.tick(50);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'priceGun'], 'the Price Gun replaced the Nail Gun in hand');
  assert.equal(warranty.onFile, 'premium');

  // Upgrade the held gun to Deluxe, then replace it with another weapon.
  const heldId = g.gun.def.id;
  const replacement = weapons.rivetRifle;
  t.setTier(heldId, 'deluxe');
  t.tick(2);
  g.gun.give(replacement); t.tick(50);

  assert.ok(!g.gun.slots.includes(heldId), 'the Deluxe gun was replaced');
  assert.equal(warranty.onFile, 'premium', 'lower Deluxe warranty on the replaced gun never overwrites Premium');
  g.map.dispose();
});
