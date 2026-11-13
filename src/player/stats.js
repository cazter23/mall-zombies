// =============================================================================
// PLAYER STATS
// One object holds every player stat. Later systems (wardrobe perks, skill
// tree, food court buffs) should modify THIS object instead of touching config
// or controller code. The controller reads from it every tick.
// A new run puts every stat back to its base value (resetPlayerStats), so nothing
// bought or earned in one run carries into the next.
// =============================================================================

import { feel } from '../config/feel.js';
import { weaponStatDefaults } from '../config/weapons.js';
import { kiosk } from '../config/kiosk.js';

// Bubble Wrap (Kiosk Kevin): its numbers are in config/kiosk.js bubbleWrap.
export const armourDefaults = { maxArmourLayers: kiosk.bubbleWrap.maxLayers, armourLayerStrength: kiosk.bubbleWrap.layerStrength };

export function createPlayerStats() {
  return {
    damageTakenMultiplier: 1,
    knockbackMultiplier: 1,
    maxHealth: feel.player.maxHealth,
    health: feel.player.maxHealth,
    ...armourDefaults,
    regenDelay: feel.health.regenDelay, // seconds after a hit before health regenerates
    regenRate: feel.health.regenRate, // health per second while regenerating

    walkSpeed: feel.movement.walkSpeed,
    sprintSpeed: feel.movement.sprintSpeed,
    surfaceSpeed: 1,
    jumpVelocity: feel.movement.jumpVelocity,

    crouchSpeed: feel.crouch.speed,
    proneSpeed: feel.prone.speed,
    slideSpeed: feel.slide.startSpeed,
    slideDuration: feel.slide.duration,
    slideCooldown: feel.slide.cooldown,

    fallDamageScale: 1, // landing damage multiplier (a future perk can lower it)
    ownBlastDamage: 1, // what your OWN rocket's burst does to you, x this (weapons/blast.js selfBlastDamage); the Hi-Vis Vest takes it to 0.01, which blast.self.ignoreBelow makes no damage
    vaultMaxHeight: feel.vault.maxHeight,
    vaultMomentumRetention: feel.vault.momentumRetention,
    meleeLungeMomentumRetention: feel.melee.entryMomentumKeep,

    sprintDuration: feel.sprint.duration,
    sprintRefillDelay: feel.sprint.refillDelay,
    sprintRefillRate: feel.sprint.refillRate,

    adsMoveSpeed: feel.ads.moveSpeedMultiplier, // walk speed multiplier while aiming
    backpedalSpeed: feel.movement.backpedalMultiplier, // walk speed multiplier going backwards
    strafeSpeed: feel.movement.strafeMultiplier, // walk speed multiplier going sideways

    damageMultiplier: weaponStatDefaults.damageMultiplier,
    meleeDamageMultiplier: weaponStatDefaults.meleeDamageMultiplier,
    meleeTier: weaponStatDefaults.meleeTier, // box cutter tier bought at Customer Service (game/meleeUpgrades.js)
    meleeUpgradeDamage: weaponStatDefaults.meleeUpgradeDamage,
    meleeHalfAngleDegrees: weaponStatDefaults.meleeHalfAngleDegrees,
    meleeMaxTargets: weaponStatDefaults.meleeMaxTargets,
    reloadSpeed: weaponStatDefaults.reloadSpeed,
    switchSpeed: 1,
    adsTimeMultiplier: 1,
    aimAssistMultiplier: 1, // controller aim-assist strength (weapons/aimAssist.js)
    headshotDamageMultiplier: 1,
    reserveMultiplier: 1,
    killPayMultiplier: 1,
  };
}

/**
 * New run: every stat back to its base value, and anything added during the run that isn't a declared
 * stat (a perk's own counter, say) removed. Same object (the player, guns and health all hold it).
 * A new stat must be declared in createPlayerStats() with its default.
 */
export function resetPlayerStats(stats) {
  const fresh = createPlayerStats();
  for (const key of Object.keys(stats)) if (!(key in fresh)) delete stats[key];
  Object.assign(stats, fresh);
}
