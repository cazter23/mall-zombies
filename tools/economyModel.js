// =============================================================================
// ECONOMY MODEL: the maths side of npm run sim:economy (no game loop; tools/economyBot.js is the played side).
// Pure functions over config, read at call time, so they see a proposal applied in memory (tools/economyPlans.js).
//
//   zombieMixFor(round)                 { shopper: share, mallWalker: share, ... } from economy.zombieMix
//   loadoutGun(entry)                   a resolved gun from a bot loadout entry { id, tier, renewals, build }
//   pointsPerZombie(def, typeId, round) what one zombie of that type pays when killed with that gun (+10 a non-lethal hit, its kill value)
//   roundIncome(def, round, options)    the whole wave, killed with that gun: { zombies, points, perZombie }
//   upgradeLadder(gunId)                every power purchase for a gun, in order: cost, damage multiplier, what a point buys
//   roundsOfHealth(multiplier)          how many rounds of zombie health growth a damage multiplier buys back
// Damage is tools/balance.js's: a still Shopper's chest at 5 m, aimed. Compare with it; don't stopwatch with it.
// =============================================================================

import { economy, zombieHealthFor, zombieCountForRound } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { workshopRitual, workshopStuffings, qualityById } from '../src/config/workshop.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { withTier, withRenewals, buildModifiers, TIER_IDS } from '../src/weapons/upgrades.js';
import { expectedShotDamage, sustainedDps } from './balance.js';

const AT_METRES = 5;
const AIMED = { ads: true };

/** The share of a round's spawns that is each type (the per-type alive caps are ignored: they only bite on Mannequins and Mascots). */
export function zombieMixFor(round) {
  const mix = {};
  let left = 1;
  for (const [typeId, entry] of Object.entries(economy.zombieMix)) {
    if (!entry.shareByRound || round < entry.fromRound) continue; // (a summon-only type, the Mall Walker, is never in a wave)
    let share = 0;
    for (const row of entry.shareByRound) if (round >= row.fromRound) share = row.share;
    mix[typeId] = share;
    left -= share;
  }
  return { shopper: left, ...mix };
}

/** The gun a bot loadout entry describes, upgrades applied: { id, tier, renewals, build: quality id or null }. */
export function loadoutGun({ id, tier = 'standard', renewals = 0, build = null }) {
  const base = weapons[id];
  let mods = withRenewals(base, withTier(base, [], tier), renewals);
  if (build) {
    const stuffing = Object.values(workshopStuffings)[0]; // (the colour only: a build's power is its quality)
    mods = [...mods, { id: 'build', build: { quality: build }, modifiers: buildModifiers(base, stuffing.color, qualityById(build).gun) }];
  }
  return resolveGun(base, mods);
}

// (measured once per resolved gun: each is a few thousand sampled rays)
const dpsCache = new WeakMap(), shotCache = new WeakMap();
const once = (cache, def, fn) => { if (!cache.has(def)) cache.set(def, fn()); return cache.get(def); };
export const gunDps = (def) => once(dpsCache, def, () => sustainedDps(def, AT_METRES, AIMED));
const shotDamage = (def) => once(shotCache, def, () => expectedShotDamage(def, AT_METRES, AIMED));

/** Hits to kill `hp` with `def`: body shots, with `headShare` of them headshots. */
export function hitsToKill(def, hp, headShare = 0) {
  const perShot = shotDamage(def) * (1 + headShare * ((def.headshotMultiplier ?? 1) - 1));
  return Math.max(1, Math.ceil(hp / perShot));
}

/** What one zombie pays: +10 for every hit but the last, its kill value, and the headshot bonus `headShare` of the time. */
export function pointsPerZombie(def, typeId, round, { headShare = 0 } = {}) {
  const p = economy.payouts;
  const hits = hitsToKill(def, zombieHealthFor(typeId, round), headShare);
  return (hits - 1) * p.nonLethalHit + (economy.killValues[typeId] ?? 0) + headShare * p.headshotKillBonus;
}

/** A whole wave killed with one gun (no bosses, no power-ups, no misses that hit someone else). */
export function roundIncome(def, round, options) {
  const zombies = zombieCountForRound(round);
  let perZombie = 0;
  for (const [typeId, share] of Object.entries(zombieMixFor(round))) perZombie += share * pointsPerZombie(def, typeId, round, options);
  return { zombies, perZombie, points: zombies * perZombie };
}

/** Zombie health grows by this factor a round once the linear part is over (economy.waves.health). */
export const healthGrowth = () => economy.waves.health.multiplierAfter;
/** How many rounds of late zombie health growth a damage multiplier buys back (x1.075 a round: x1.156 = 2 rounds). */
export const roundsOfHealth = (multiplier) => Math.log(multiplier) / Math.log(healthGrowth());

/**
 * Every power purchase for one gun, cheapest route first: the warranty tiers, the Renewals, and a Build-A-Blaster build at each quality.
 * Each row: what it costs, the damage multiplier it adds ON TOP of the row before it in its own line, and what that costs per 1% of damage.
 */
export function upgradeLadder() {
  const rows = [];
  const damageOf = (effects) => effects.damage ?? 1;
  let before = 1, spent = 0;
  for (const id of TIER_IDS.slice(1)) {
    const tier = upgrades.tiers.find((t) => t.id === id);
    const cost = economy.upgrades.tiers[id];
    spent += cost;
    const total = damageOf(tier.effects);
    rows.push({ line: 'warranty', name: tier.name, cost, spent, total, step: total / before });
    before = total;
  }
  for (let i = 0; i < upgrades.renewals.max; i++) {
    const cost = economy.upgrades.renewals[i];
    spent += cost;
    const step = damageOf(upgrades.renewals.effects);
    before *= step;
    rows.push({ line: 'warranty', name: `Renewal ${i + 1}`, cost, spent, total: before, step });
  }
  for (const quality of workshopRitual.qualities) {
    const cost = economy.upgrades.workshop.ritual;
    rows.push({ line: 'build', name: `Build, ${quality.name}`, cost, spent: cost, total: damageOf(quality.gun), step: damageOf(quality.gun), minKills: quality.minKills });
  }
  for (const row of rows) {
    row.pointsPerPercent = row.cost / ((row.step - 1) * 100);
    row.rounds = roundsOfHealth(row.step);
  }
  return rows;
}
