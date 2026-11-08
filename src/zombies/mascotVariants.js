// =============================================================================
// MASCOT COSTUMES: which costume a Mascot spawn wears (config/zombies.js mascotVariants, resolved types in mascotTypes).
// Rounds still decide "this spawn is a Mascot" exactly as before (economy.zombieMix.mascot); the zombie manager
// then calls pickMascotVariant once it has chosen the spawn point, and game/rounds.js asks mascotDebutIn(round) to
// force a new costume's first appearance in its unlock round.
//   pickMascotVariant(round, zone, random)   weight 1 per unlocked costume, x mascotPicking.homeWeight in a home zone.
//                                            With only one costume unlocked nothing random is drawn (rounds 10-12
//                                            play exactly as they did before costumes existed).
//   mascotDebutIn(round)                     the costume whose unlock round this is, or null
// Both take an optional costume table (tests); the game always uses config's.
// =============================================================================

import { mascotPicking, mascotVariants } from '../config/zombies.js';

export const MASCOT_VARIANT_IDS = Object.keys(mascotVariants);

function weightOf(costume, zone) {
  return zone !== null && costume.homeZones.includes(zone) ? mascotPicking.homeWeight : 1;
}

/** The costume for a Mascot spawning in `round` at a point in `zone` (null = no zone bias: a chute or an explicit spot). */
export function pickMascotVariant(round, zone = null, random = Math.random, table = mascotVariants) {
  let total = 0, count = 0, only = null, first = null;
  for (const id in table) {
    if (first === null || table[id].unlockRound < table[first].unlockRound) first = id;
    if (table[id].unlockRound > round) continue;
    total += weightOf(table[id], zone);
    count += 1;
    only = id;
  }
  if (count === 0) return first; // before any costume is unlocked (a debug spawn in round 1): the earliest one
  if (count === 1) return only;
  let roll = random() * total;
  for (const id in table) {
    if (table[id].unlockRound > round) continue;
    roll -= weightOf(table[id], zone);
    if (roll < 0) return id;
  }
  return only; // (rounding at the very top of the range)
}

/** The costume that debuts in `round` (its unlockRound), or null. */
export function mascotDebutIn(round, table = mascotVariants) {
  for (const id in table) if (table[id].unlockRound === round) return id;
  return null;
}
