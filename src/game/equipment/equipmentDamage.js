// =============================================================================
// EQUIPMENT DAMAGE: the maths behind every damage Kiosk Kevin's equipment deals (numbers: config/kiosk.js).
// Equipment isn't a gun (no tiers, no attachments), so it doesn't go through weapons/gunStats.js; it has its own rules here.
//
//   equipmentPower(round)            (zombieHealthForRound(round) / baseHealth) ^ exponent: multiplies EVERY equipment damage.
//                                    Grows with the round, far slower than zombie health (decision 4 of the plan).
//   blastFalloff(distance, blast)    1 at the centre, blast.edgeFraction at the edge, 0 beyond the radius (linear)
//   blastDamage(target, distance, blast, round)   what one blast deals to one target: centreDamage x power x falloff,
//                                    or for a boss its fixed share of its max health x falloff (boss health already scales)
//   burnDamage(target, spray, round) the Sparkler Cake's burn on one target (its total over the burn): burn.damage x power,
//                                    x spray.bossFactor for a boss (bosses burn at half strength)
//   confusionDamage(confuse, round)  one swing of a zombie the Glitter Bomb confused, on another zombie: hitDamage x power
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

export function burnDamage(target, spray, round) {
  return spray.burn.damage * equipmentPower(round) * (target.type?.boss ? spray.bossFactor : 1);
}

export function confusionDamage(confuse, round) {
  return confuse.hitDamage * equipmentPower(round);
}
