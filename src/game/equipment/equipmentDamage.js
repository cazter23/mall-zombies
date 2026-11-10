// =============================================================================
// EQUIPMENT DAMAGE: the maths behind every damage Kiosk Kevin's equipment deals (numbers: config/kiosk.js).
// Equipment isn't a gun (no tiers, no attachments), so it doesn't go through weapons/gunStats.js; it has its own rules here.
//
//   equipmentPower(round)            (zombieHealthForRound(round) / baseHealth) ^ exponent: multiplies EVERY equipment damage.
//                                    Grows with the round, far slower than zombie health (decision 4 of the plan).
//   blastFalloff(distance, blast)    1 at the centre, blast.edgeFraction at the edge, 0 beyond the radius (linear)
//   blastDamage(target, distance, blast, round)   what one blast deals to one target: centreDamage x power x falloff,
//                                    or for a boss its fixed share of its max health x falloff (boss health already scales)
// =============================================================================

import { kiosk } from '../../config/kiosk.js';
import { zombieHealthForRound } from '../../config/economy.js';

export function equipmentPower(round, power = kiosk.power) {
  return Math.pow(zombieHealthForRound(Math.max(1, round)) / power.baseHealth, power.exponent);
}

export function blastFalloff(distance, blast) {
  if (!(distance <= blast.radius)) return 0;
  const t = Math.max(0, distance) / blast.radius;
  return 1 + (blast.edgeFraction - 1) * t;
}

export function blastDamage(target, distance, blast, round) {
  const falloff = blastFalloff(distance, blast);
  if (falloff <= 0) return 0;
  if (target.type?.boss) return target.maxHealth * blast.bossShare * falloff;
  return blast.centreDamage * equipmentPower(round) * falloff;
}
