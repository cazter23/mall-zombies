// =============================================================================
// PLAYER STATS
// One object holds every player stat. Later systems (wardrobe perks, skill
// tree, food court buffs) should modify THIS object instead of touching config
// or controller code. The controller reads from it every tick.
// =============================================================================

import { feel } from '../config/feel.js';
import { weaponStatDefaults } from '../config/weapons.js';

export function createPlayerStats() {
  return {
    maxHealth: feel.player.maxHealth,
    health: feel.player.maxHealth,
    regenDelay: feel.health.regenDelay, // seconds after a hit before health regenerates
    regenRate: feel.health.regenRate, // health per second while regenerating

    walkSpeed: feel.movement.walkSpeed,
    sprintSpeed: feel.movement.sprintSpeed,
    jumpVelocity: feel.movement.jumpVelocity,

    crouchSpeed: feel.crouch.speed,
    slideSpeed: feel.slide.startSpeed,
    slideDuration: feel.slide.duration,
    slideCooldown: feel.slide.cooldown,

    sprintDuration: feel.sprint.duration,
    sprintRefillDelay: feel.sprint.refillDelay,
    sprintRefillRate: feel.sprint.refillRate,

    adsMoveSpeed: feel.ads.moveSpeedMultiplier, // walk speed multiplier while aiming
    backpedalSpeed: feel.movement.backpedalMultiplier, // walk speed multiplier going backwards
    strafeSpeed: feel.movement.strafeMultiplier, // walk speed multiplier going sideways

    damageMultiplier: weaponStatDefaults.damageMultiplier,
    meleeDamageMultiplier: weaponStatDefaults.meleeDamageMultiplier,
    reloadSpeed: weaponStatDefaults.reloadSpeed,
  };
}
