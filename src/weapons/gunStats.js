// =============================================================================
// GUN STATS: the one place gun numbers are combined
//
// Layers, in order (upgrades plug into layer 2, perks / wardrobe / skill tree into layer 3):
//   1. BASE      the gun's entry in config/weapons.js (never modified at runtime)
//   2. MODS      per-gun upgrades (Build-A-Blaster, future attachments): resolveGun(base, mods)
//                returns the gun's EFFECTIVE stats as a copy of the base with the mods applied.
//                Gameplay (weapon.js, aim.js, playerGun.js) reads only that resolved copy.
//   3. PLAYER    the player's stats object (stats.damageMultiplier, stats.reloadSpeed...), applied
//                live where the number is used, because perks can change mid-run.
//   4. PER HIT   headshot x distance falloff x pierce falloff: hitDamage(), below. A BLAST (a gun with `blast`, the Bottle Rocket Bazooka):
//                damage x the blast's falloff over the distance from its centre (weapons/blast.js blastFalloff), no headshots, no range falloff.
//
// A mod is plain data:
//   { id: 'longBarrel', modifiers: [
//       { stat: 'falloff.start', op: 'mul', value: 1.5 },   // dotted path into the gun's config
//       { stat: 'damage', op: 'add', value: 10 },
//       { stat: 'pierce', op: 'set', value: { maxTargets: 2, damageFalloff: [1, 0.5] } } ] }
// Ops: 'set' (any value; the parent must exist), 'add' and 'mul' (numbers only). Across all of a gun's
// mods, every 'set' applies first, then every 'add', then every 'mul': adds stack additively, and
// multipliers multiply on top, so the order mods were bought in never matters. A stat path that
// doesn't exist on that gun throws (a typo in a mod is an error, not a silent no-op).
// Counts stay whole after mods (magazine x1.15 = 13.8 -> 14): see WHOLE_STATS; a burst gun's magazine
// rounds to whole bursts.
// =============================================================================

import { blastFalloff } from './blast.js';

/**
 * Damage multiplier for a hit at `distance` meters. `falloff` = { start, end, minMultiplier }:
 * full damage up to `start`, then a straight line down to `minMultiplier` at `end` and beyond.
 * No falloff (undefined) = full damage at any range.
 */
export function damageFalloff(distance, falloff) {
  if (!falloff) return 1;
  if (distance <= falloff.start) return 1;
  if (distance >= falloff.end) return falloff.minMultiplier;
  return 1 + (falloff.minMultiplier - 1) * (distance - falloff.start) / (falloff.end - falloff.start);
}

/** What an instant kill deals: more than any zombie has (takeHit multiplies it by the zombie's own damage-taken factors, so it stays lethal). */
export const INSTANT_KILL_DAMAGE = 1e9;

/** Can a gun with an `instantKill` return this target? Bosses and Mascots take a big fixed hit; the Last Customer is returnable only while Speechless (see hitDamage). */
export function isReturnable(target) {
  if (target?.type?.returnRequired) return target.state === 'speechless';
  return !(target?.type?.boss || target?.type?.mascot);
}

/** Applies Black Friday one-hit eliminations (non-boss zombies) and boss damage multiplier when active. */
export function applyInstantKillDamage(damage, target, stats) {
  if (!stats?.instantKill || !target?.type) return damage;
  if (target.type.boss) return damage * (stats.bossDamageMultiplier ?? 1);
  return Math.max(damage, INSTANT_KILL_DAMAGE);
}

/**
 * Damage of ONE hit (one bullet, dart, nail or pellet on one zombie).
 *   hit:         { part: 'head' | 'body', distance }   (distance from the eye, meters); a blast's hit: { part: 'body', blastDistance } (from its centre)
 *   index:       0 for the first zombie this ray hit, 1 for the one behind it (pierce), ...
 *   stats:       the player's stats object (stats.damageMultiplier)
 *   chargeScale: optional charge damage multiplier (1 by default)
 *   target:      optional, the zombie hit. A gun with `instantKill` (Return to Sender) kills a returnable target outright, whatever its health; a boss or a
 *                Mascot takes def.instantKill.bigFraction of its max health instead, times the gun's tier damage and the player's damage stat.
 */
export function hitDamage(def, hit, index, stats, chargeScale = 1, target = null) {
  const effectiveTarget = target ?? hit?.target ?? null;
  if (def.instantKill && effectiveTarget) {
    if (isReturnable(effectiveTarget)) return INSTANT_KILL_DAMAGE;
    const tier = def.base ? def.damage / def.base.damage : 1; // (an Extended Warranty's damage helps against bosses too)
    const base = effectiveTarget.maxHealth * (effectiveTarget.type?.returnToSenderFraction ?? def.instantKill.bigFraction) * tier * stats.damageMultiplier;
    return applyInstantKillDamage(base, effectiveTarget, stats);
  }
  // (A blast goes through the same Black Friday step as a bullet: an incentive jackpot one-shots a shopper caught in the burst.)
  if (def.blast && hit.blastDistance !== undefined) {
    return applyInstantKillDamage(def.damage * chargeScale * blastFalloff(hit.blastDistance, def.blast) * stats.damageMultiplier, effectiveTarget, stats);
  }
  const head = hit.part === 'head' ? def.headshotMultiplier * (stats.headshotDamageMultiplier ?? 1) : 1;
  const pierce = def.pierce ? def.pierce.damageFalloff[Math.min(index, def.pierce.damageFalloff.length - 1)] : 1;
  const base = def.damage * chargeScale * head * damageFalloff(hit.distance, def.falloff) * pierce * stats.damageMultiplier;
  return applyInstantKillDamage(base, effectiveTarget, stats);
}

/** One trigger cycle (a burst counts as one cycle). */
export function cycleSeconds(def) {
  if (def.fireMode === 'burst') return def.burst.interval * (def.burst.count - 1) + def.fireInterval;
  if (def.fireMode === 'charge') return def.charge.seconds + def.fireInterval;
  return def.fireInterval;
}

/**
 * One second of this gun's fire at full damage (body, no falloff, no reloads). Build-A-Blaster's stuffings scale from this rather
 * than from one shot, so a slow heavy gun and a fast light one get comparable effects. Tiers and player stats count.
 */
export function gunPower(def, stats) {
  const perCycle = def.damage * (def.pellets?.count ?? 1) * (def.burst?.count ?? 1);
  // (A one-round magazine, the Bottle Rocket Bazooka, reloads between every two shots: that reload is part of its cycle, or a
  // stuffing would get three times a second of its real fire.)
  const seconds = def.magazineSize === 1 && def.reloadTime ? Math.max(cycleSeconds(def), def.reloadTime) : cycleSeconds(def);
  return (perCycle / seconds) * stats.damageMultiplier;
}

const OP_ORDER = { set: 0, add: 1, mul: 2 };

// Stats that are counts: rounded to the nearest whole number (at least 1) after mods.
const WHOLE_STATS = [['magazineSize'], ['startingReserve'], ['pellets', 'count'], ['burst', 'count'], ['pierce', 'maxTargets']];

function roundCounts(gun) {
  for (const path of WHOLE_STATS) {
    const parent = path.length > 1 ? gun[path[0]] : gun;
    const key = path[path.length - 1];
    if (parent && typeof parent[key] === 'number') parent[key] = Math.max(1, Math.round(parent[key]));
  }
  if (gun.fireMode === 'burst') {
    const n = gun.burst.count;
    gun.magazineSize = Math.max(n, Math.round(gun.magazineSize / n) * n);
  }
}

/**
 * The gun's effective stats: a deep copy of `base` with `mods` applied (see the header). `base` is
 * never changed. The copy keeps the same id/name/model, so it shows and sounds like the base gun.
 * resolved.base = the original config entry; resolved.mods = the applied mod ids; resolved.modList = the mods.
 */
export function resolveGun(base, mods = []) {
  const gun = structuredClone(base);
  const changes = [];
  for (const mod of mods) {
    for (const m of mod.modifiers ?? []) {
      if (!(m.op in OP_ORDER)) throw new Error(`mod "${mod.id}": unknown op "${m.op}" (use set, add or mul)`);
      changes.push({ ...m, mod: mod.id });
    }
  }
  changes.sort((a, b) => OP_ORDER[a.op] - OP_ORDER[b.op]); // stable: same-op changes keep their order
  for (const c of changes) {
    const keys = c.stat.split('.');
    const last = keys.pop();
    let parent = gun;
    for (const k of keys) {
      parent = parent?.[k];
      if (parent === null || typeof parent !== 'object') throw new Error(`mod "${c.mod}": ${base.id} has no stat "${c.stat}"`);
    }
    if (c.op === 'set') {
      parent[last] = structuredClone(c.value);
      continue;
    }
    if (typeof parent[last] !== 'number') throw new Error(`mod "${c.mod}": ${base.id}.${c.stat} is not a number`);
    parent[last] = c.op === 'add' ? parent[last] + c.value : parent[last] * c.value;
  }
  roundCounts(gun);
  gun.base = base;
  gun.mods = mods.map((m) => m.id);
  gun.modList = mods; // the mods themselves (the gun model reads which tier/attachments to show)
  return gun;
}
