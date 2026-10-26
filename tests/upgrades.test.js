// Gun upgrades (weapons/upgrades.js + config/upgrades.js): Extended Warranty tiers and store attachments,
// as mods on a carried gun. What each does to every gun, how they stack, that guns keep their ROLES
// (tests/balance.test.js) at every tier and with any one attachment, and that upgrades live and die
// with the carried gun in the real game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { economy, zombieHealthForRound } from '../src/config/economy.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import {
  TIER_IDS, tierOf, nextTier, attachmentsOf, attachmentFits, withTier, withAttachment,
} from '../src/weapons/upgrades.js';
import { createPricing } from '../src/game/pricing.js';
import { sustainedDps } from '../tools/balance.js';
import { headlessGame } from './helpers/headlessGame.js';

const guns = Object.values(weapons).filter((d) => d.fireMode); // (the box cutter isn't a gun)
const { stapleGun, priceGun, nailGun, foamDartBlaster, confettiCannon } = weapons;
const ATTACHMENTS = Object.keys(upgrades.attachments);
const at = (base, tierId, ...attachments) => {
  let mods = withTier(base, [], tierId);
  for (const a of attachments) mods = withAttachment(base, mods, a);
  return resolveGun(base, mods);
};

test('tiers: Standard is no mod; each tier multiplies damage and is read back from the mods', () => {
  assert.deepEqual(TIER_IDS, ['standard', 'deluxe', 'premium', 'platinum']);
  assert.deepEqual(withTier(priceGun, [], 'standard'), []);
  for (const tier of upgrades.tiers) {
    const mods = withTier(priceGun, [], tier.id);
    assert.equal(tierOf(mods), tier.id);
    assert.equal(resolveGun(priceGun, mods).damage, priceGun.damage * (tier.effects.damage ?? 1), tier.id);
  }
  assert.equal(nextTier([]), 'deluxe');
  assert.equal(nextTier(withTier(priceGun, [], 'premium')), 'platinum');
  assert.equal(nextTier(withTier(priceGun, [], 'platinum')), null);
  assert.equal(tierOf(withTier(priceGun, withTier(priceGun, [], 'deluxe'), 'premium')), 'premium', 'one tier mod at a time');
  assert.throws(() => withTier(priceGun, [], 'diamond'), /unknown tier/);
});

test('every tier works on every gun: whole magazines (whole bursts), the cannon reloads every phase faster', () => {
  for (const base of guns) {
    for (const tierId of TIER_IDS) {
      const g = at(base, tierId);
      assert.ok(Number.isInteger(g.magazineSize) && g.magazineSize >= 1, `${base.id} ${tierId}`);
      if (base.burst) assert.equal(g.magazineSize % base.burst.count, 0, `${base.id} ${tierId}: whole bursts`);
    }
  }
  assert.equal(at(stapleGun, 'deluxe').magazineSize, 14); // 12 x 1.15 = 13.8
  assert.equal(at(foamDartBlaster, 'platinum').magazineSize, 39); // 30 x 1.3 -> 13 whole bursts
  const cannon = at(confettiCannon, 'platinum');
  assert.ok(Math.abs(cannon.shellReload.shellSeconds - confettiCannon.shellReload.shellSeconds * 0.8) < 1e-9);
  assert.ok(Math.abs(at(nailGun, 'premium').reloadTime - nailGun.reloadTime * 0.9) < 1e-9);
});

test('each tier keeps a gun killing in round-8 shot counts until its holdsUntilRound (and is priced)', () => {
  const round8 = zombieHealthForRound(8);
  for (const tier of upgrades.tiers) {
    const mult = tier.effects.damage ?? 1;
    const needed = zombieHealthForRound(tier.holdsUntilRound) / round8;
    assert.ok(mult >= needed - 0.02, `${tier.id}: x${mult} vs needed x${needed.toFixed(2)} at round ${tier.holdsUntilRound}`);
    if (tier.id !== 'standard') assert.equal(createPricing().priceOf('tier', tier.id), economy.upgrades.tiers[tier.id]);
  }
  assert.throws(() => createPricing().priceOf('tier', 'standard'), /no tier price/, 'Standard is not for sale');
});

test('attachments: one per slot (a new one replaces the old), read back from the mods, Build-A-Blaster mods untouched', () => {
  const bab = { id: 'buildABlaster', modifiers: [{ stat: 'damage', op: 'add', value: 1 }] };
  let mods = withTier(priceGun, [bab], 'deluxe');
  mods = withAttachment(priceGun, mods, 'sawnOff');
  mods = withAttachment(priceGun, mods, 'laserPointer');
  mods = withAttachment(priceGun, mods, 'extendedNozzle'); // replaces Sawn-Off
  assert.deepEqual(attachmentsOf(mods), { barrel: 'extendedNozzle', sight: 'laserPointer' });
  assert.equal(tierOf(mods), 'deluxe');
  assert.ok(mods.includes(bab));
  assert.throws(() => withAttachment(priceGun, mods, 'rocketBooster'), /unknown attachment/);
  for (const id of ATTACHMENTS) assert.equal(createPricing().priceOf('attachment', id), economy.upgrades.attachments[id], id);
});

test('what each attachment does (on the Price Gun), and that the Laser Pointer leaves aimed accuracy alone', () => {
  const g = (id) => at(priceGun, 'standard', id);
  const aimed = (d) => d.spread.base * d.spread.adsMultiplier;
  assert.equal(g('extendedNozzle').falloff.start, priceGun.falloff.start * 1.4);
  assert.ok(g('extendedNozzle').ads.seconds > priceGun.ads.seconds);
  assert.ok(g('sawnOff').damage > priceGun.damage && g('sawnOff').falloff.end < priceGun.falloff.end);
  assert.ok(g('laserPointer').spread.base < priceGun.spread.base);
  assert.ok(Math.abs(aimed(g('laserPointer')) - aimed(priceGun) * 1.25) < 1e-9, 'aimed: only the 1.25 penalty');
  assert.ok(g('zoomLens').ads.fovMultiplier < priceGun.ads.fovMultiplier && aimed(g('zoomLens')) < aimed(priceGun));
  assert.ok(g('gripTape').recoil.pitchDegrees < priceGun.recoil.pitchDegrees);
  assert.ok(g('wristband').ads.seconds < priceGun.ads.seconds && g('wristband').recoil.pitchDegrees > priceGun.recoil.pitchDegrees);
  assert.ok(g('jumboPack').magazineSize > priceGun.magazineSize && g('jumboPack').reloadTime > priceGun.reloadTime);
  assert.ok(g('speedLoader').magazineSize < priceGun.magazineSize && g('speedLoader').reloadTime < priceGun.reloadTime);
});

test('fits: everything fits every gun except the Extended Nozzle on the Nail Gun (no falloff to extend); Sawn-Off GIVES it falloff', () => {
  for (const base of guns) {
    for (const id of ATTACHMENTS) {
      const fits = attachmentFits(base, id);
      assert.equal(fits, !(base.id === 'nailGun' && id === 'extendedNozzle'), `${id} on ${base.id}`);
      if (fits) at(base, 'platinum', id); // resolves without throwing
    }
  }
  assert.throws(() => withAttachment(nailGun, [], 'extendedNozzle'), /doesn't fit/);
  assert.deepEqual(at(nailGun, 'standard', 'sawnOff').falloff, upgrades.attachments.sawnOff.falloffIfNone);
  assert.equal(nailGun.falloff, undefined, 'the config entry is never touched');
});

// --- Roles survive upgrades (the same relationships as tests/balance.test.js) ---
const style = (d) => ({ ads: !d.pellets, samples: 600 });
const dps = (d, m) => sustainedDps(d, m, style(d));

// Tiers aren't a pure damage scale (bigger magazines and faster reloads help reload-heavy guns like the
// Nail Gun a bit more), so at the same tier a role may become a near-tie (within 3%), but no gun may
// clearly take over another gun's job.
const TIE = 1.03;

test('roles hold at EVERY tier when guns are compared at the same tier (near-ties allowed)', () => {
  for (const tierId of TIER_IDS) {
    const t = Object.fromEntries(guns.map((b) => [b.id, at(b, tierId)]));
    const others = (id) => guns.filter((b) => b.id !== id).map((b) => t[b.id]);
    const msg = (what) => `${tierId}: ${what}`;
    for (const d of others('confettiCannon')) assert.ok(dps(t.confettiCannon, 2) >= 1.4 * dps(d, 2), msg(`cannon vs ${d.name} at 2 m`));
    assert.ok(dps(t.priceGun, 5) > dps(t.stapleGun, 5), msg('price beats the starter at 5 m'));
    assert.ok(dps(t.priceGun, 5) >= 0.95 * dps(t.nailGun, 5), msg('price stays within 5% of Nail Gun sustained damage at 5 m'));
    for (const id of ['foamDartBlaster', 'rivetRifle', 'coilNailer'])
      assert.ok(dps(t[id], 5) > 1.1 * dps(t.priceGun, 5), msg(`${id} beats the early-game gun`));
    for (const d of [t.stapleGun, t.priceGun, t.nailGun]) assert.ok(TIE * dps(t.foamDartBlaster, 15) > dps(d, 15), msg(`foam vs ${d.name} at 15 m`));
    for (const d of others('nailGun')) assert.ok(dps(t.nailGun, 30) > 1.1 * dps(d, 30), msg(`nail vs ${d.name} at 30 m`));
    for (const d of others('stapleGun')) assert.ok(dps(t.stapleGun, 5) < dps(d, 5), msg(`staple vs ${d.name} at 5 m`));
  }
});

test('one attachment shifts a gun, it never takes over another gun\'s job (vs plain guns)', () => {
  for (const base of guns) {
    for (const id of ATTACHMENTS.filter((a) => attachmentFits(base, a))) {
      const g = at(base, 'standard', id);
      const name = `${base.name} + ${id}`;
      if (base !== confettiCannon) assert.ok(dps(confettiCannon, 2) >= 1.25 * dps(g, 2), `${name}: cannon still rules 2 m against an attached gun`);
      // A range attachment can compete at 30 m; Nail retains the longest sightlines.
      if (base !== nailGun) assert.ok(dps(nailGun, 40) > dps(g, 40), `${name}: Nail Gun still rules 40 m`);
      if (base === stapleGun) for (const d of [priceGun, nailGun, foamDartBlaster]) assert.ok(dps(g, 5) < dps(d, 5), `${name} vs ${d.name}`);
    }
  }
});

// --- In the real game: upgrades belong to the carried gun ---

test('the real game: upgrades stay through an ammo buy, go with a replaced gun, and a new run starts plain', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.gun.give(priceGun); t.tick(40);
  const up = (fn) => g.gun.setMods('priceGun', fn(g.gun.def.base, g.gun.modsFor('priceGun')));
  up((b, m) => withTier(b, m, 'premium'));
  up((b, m) => withAttachment(b, m, 'jumboPack'));
  assert.equal(g.gun.def.damage, priceGun.damage * 2.1);
  assert.equal(g.gun.def.magazineSize, Math.round(priceGun.magazineSize * 1.15 * 1.3));
  g.gun.weapon.magazine = 1;
  g.gun.give(priceGun); // ammo buy
  assert.equal(g.gun.weapon.magazine, g.gun.def.magazineSize, 'refilled to the UPGRADED magazine');
  assert.equal(tierOf(g.gun.modsFor('priceGun')), 'premium');
  g.resetRun();
  t.tick(1);
  assert.equal(g.gun.owns('priceGun'), false);
  assert.deepEqual(g.gun.modsFor('stapleGun'), []);
});
