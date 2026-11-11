// =============================================================================
// KIOSK KEVIN BALANCE MATHS (tools/kioskReport.mjs prints it: npm run kiosk; tests/kioskBalance.test.js holds the phase 7 bar).
// Pure maths from the game's own config and functions (config/kiosk.js, config/economy.js, game/equipment/equipmentDamage.js,
// tools/balance.js for the guns): nothing is played. What equipment does, by round and zombie type, and what it costs measured
// in what a round pays.
//
//   ROUND_INCOME[round]            points the good-skill bot earned in that round (docs/economy-report.md, section 2: measured
//                                  with `npm run sim:economy`, 8 immortal runs). Copied here so the report needs no sim run; refresh
//                                  it when the economy report is re-measured.
//   crowdFalloff(blast)            the average share of the centre damage a zombie in the blast takes (zombies spread evenly over it)
//   sodaBomb(round, typeId)        one bomb on one zombie of that type: centre damage, share of its health at the centre, the radius
//                                  that still kills it (0: nowhere), and the damage a crowd of CROWD zombies takes in all
//   sparklerCake(round)            the burn: one pulse (a zombie that walks through) and the most (it stays the whole spray)
//   sentry(round)                  shots, damage a second and over its life, all shots landing
//   hitsToDeath(damage, layers)    zombie hits in a row from full health with that much Bubble Wrap (no regen in between)
//   wrapShare()                    a full wrap's absorb against the player's own health (1 = it doubles what you can take)
//   priceShare(id, round)          a product's price as a share of what that round pays
//   ammoDamagePerPoint(gunId)      what that gun's wall ammo deals per point, every shot landing (the yardstick for "cheap killing")
//   zombiesPerPocket(id, round)    zombies' worth of health one full pocket takes out of a crowd (damaging products only)
// =============================================================================

import { kiosk } from '../src/config/kiosk.js';
import { economy, zombieHealthFor, zombieHealthForRound } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { feel } from '../src/config/feel.js';
import { equipmentPower, blastFalloff } from '../src/game/equipment/equipmentDamage.js';
import { sustainedDps } from './balance.js';

// docs/economy-report.md, section 2, "Good: earned" (the mean of 8 runs), rounds 1 to 30.
export const ROUND_INCOME = [null,
  596, 904, 1203, 1905, 1976, 2555, 2930, 2689, 3530, 5214,
  4949, 7336, 6211, 6410, 6048, 6359, 7623, 7503, 8404, 9471,
  9095, 9139, 9670, 12120, 11258, 11695, 12461, 15838, 15113, 15404];

export const TYPES = ['shopper', 'mallWalker', 'cartPusher', 'mannequin', 'mascot'];
export const CROWD = 4; // zombies in a blast or a spray when it is thrown into a crowd (the report's "crowd")
export const products = kiosk.products;
export const price = (id) => economy.kiosk[id];
export const charges = (id) => products[id]?.charges ?? 1; // Bubble Wrap: one layer a purchase

/** The average falloff over the blast's disc: 1 at the centre to edgeFraction at the edge, linear in the distance. */
export function crowdFalloff(blast) {
  const steps = 400;
  let sum = 0, area = 0;
  for (let i = 0; i < steps; i++) {
    const r = ((i + 0.5) / steps) * blast.radius;
    sum += blastFalloff(r, blast) * r; area += r;
  }
  return sum / area;
}

/** The furthest distance at which `damage x falloff` still reaches `hp` (0: not even at the centre). */
function killRadius(damage, hp, blast) {
  if (damage < hp) return 0;
  const need = hp / damage; // falloff needed
  if (need <= blast.edgeFraction) return blast.radius;
  return ((1 - need) / (1 - blast.edgeFraction)) * blast.radius;
}

export function sodaBomb(round, typeId = 'shopper') {
  const { blast } = products.sodaBomb;
  const hp = zombieHealthFor(typeId, round);
  const centre = blast.centreDamage * equipmentPower(round);
  // A crowd of CROWD zombies of the round's mix spread over the blast: health taken (capped at each one's health), in zombies.
  const each = Math.min(hp, centre * crowdFalloff(blast));
  return { hp, centre, share: centre / hp, killRadius: killRadius(centre, hp, blast), crowdZombies: (CROWD * each) / hp };
}

export function sparklerCake(round) {
  const { spray } = products.sparklerCake;
  const burn = spray.burn.damage * equipmentPower(round);
  const lastPulse = Math.floor((spray.seconds - 1e-9) / spray.pulseSeconds) * spray.pulseSeconds; // pulses at 0, 0.5, ...
  const most = (burn / spray.burn.seconds) * (lastPulse + spray.burn.seconds); // refreshed every pulse, then it burns out
  return { onePulse: burn, most, hp: zombieHealthForRound(round) };
}

export function sentry(round) {
  const { turret } = products.sentry;
  const shots = Math.floor((turret.lifeSeconds - turret.warmupSeconds) / turret.fireSeconds) + 1;
  const shot = turret.damage * equipmentPower(round);
  return { shots, shot, dps: shot / turret.fireSeconds, life: shots * shot, hp: zombieHealthForRound(round) };
}

export const layerStrength = () => kiosk.bubbleWrap.layerStrength;
export const maxLayers = () => kiosk.bubbleWrap.maxLayers;
export function hitsToDeath(damage, layers = 0) {
  return Math.ceil((feel.player.maxHealth + layers * layerStrength()) / damage);
}
export const wrapShare = () => (maxLayers() * layerStrength()) / feel.player.maxHealth;

export const priceShare = (id, round) => price(id) / ROUND_INCOME[round];

export function ammoDamagePerPoint(gunId) {
  const def = weapons[gunId];
  return (def.startingReserve * def.damage) / economy.wallBuys[gunId].ammo; // a wall refill fills the reserve
}

/** Zombies' worth of health a full pocket takes out of crowds of CROWD (one throw a crowd). Sentry: every shot a hit. */
export function zombiesPerPocket(id, round) {
  if (id === 'sodaBomb') return charges(id) * sodaBomb(round).crowdZombies;
  if (id === 'sparklerCake') { const c = sparklerCake(round); return charges(id) * CROWD * Math.min(1, c.onePulse / c.hp); }
  if (id === 'sentry') { const s = sentry(round); return s.life / s.hp; }
  return null;
}

/** Zombie health per point a full pocket deals into crowds (to set beside ammoDamagePerPoint). */
export function damagePerPoint(id, round) {
  const zombies = zombiesPerPocket(id, round);
  return zombies === null ? null : (zombies * zombieHealthForRound(round)) / price(id);
}

export { equipmentPower, zombieHealthFor, zombieHealthForRound, sustainedDps };
