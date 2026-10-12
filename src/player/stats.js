// =============================================================================
// PLAYER STATS
// One object holds every player stat. Later systems (wardrobe perks, skill
// tree, food court buffs) should modify THIS object instead of touching config
// or controller code. The controller reads from it every tick.
// =============================================================================

import { feel } from '../config/feel.js';

export function createPlayerStats() {
  return {
    maxHealth: feel.player.maxHealth,
    health: feel.player.maxHealth,

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
  };
}
