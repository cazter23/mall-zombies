// =============================================================================
// BOX CUTTER REPORT:  npm run melee
// Swings to kill a Shopper at rounds 1, 5, 10, 15, 20 with the plain box cutter and with each Customer Service tier
// (config/upgrades.js melee), and what that is worth per second. Damage = def.damage x meleeDamageMultiplier x the tier's
// damage; melee ignores headshots, so every swing is a body hit. The "x1.5" columns add the Loss Prevention power-up / the wardrobe's
// melee bonus on top (stats.meleeDamageMultiplier). Run it before and after retuning a tier.
// =============================================================================

import { melee } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { economy, zombieHealthFor } from '../src/config/economy.js';

const def = melee.boxCutter;
const ROUNDS = [1, 5, 10, 15, 20];
const swingSeconds = def.hitAtSeconds + def.hitRecoverySeconds; // a connected swing, to the next one
const POWER = 1.5; // Loss Prevention / the wardrobe's melee bonus

const tiers = [{ name: 'Plain box cutter', damage: 1, maxTargets: 1, halfAngle: def.hitHalfAngleDegrees },
  ...upgrades.melee.map((t) => ({ name: t.name, damage: t.damage, maxTargets: t.maxTargets, halfAngle: t.halfAngle ?? def.hitHalfAngleDegrees }))];
const swingsToKill = (hp, damage) => Math.ceil(hp / damage);

console.log(`\nBOX CUTTER: ${def.damage} damage a swing, ${swingSeconds.toFixed(2)} s per connected swing, +${economy.payouts.meleeKillBonus} points a melee kill`);
console.log('Shopper health: ' + ROUNDS.map((r) => `round ${r} ${zombieHealthFor('shopper', r)}`).join(', '));

console.log('\nSWINGS TO KILL one zombie (a pair side by side takes the same number of swings with a two-target tier)');
console.table(ROUNDS.map((round) => {
  const hp = zombieHealthFor('shopper', round);
  return Object.fromEntries([['round', round], ['hp', hp],
    ...tiers.map((t) => [t.name, swingsToKill(hp, def.damage * t.damage)]),
    ...tiers.map((t) => [`${t.name} +50%`, swingsToKill(hp, def.damage * t.damage * POWER)])]);
}));

console.log('\nKILLS PER SECOND (one target / a group of two in the cone)');
console.table(ROUNDS.map((round) => {
  const hp = zombieHealthFor('shopper', round);
  return Object.fromEntries([['round', round],
    ...tiers.map((t) => {
      const seconds = swingsToKill(hp, def.damage * t.damage) * swingSeconds;
      return [t.name, `${(1 / seconds).toFixed(2)} / ${(Math.min(2, t.maxTargets) / seconds).toFixed(2)}`];
    })]);
}));

console.log('\nTIERS: ' + tiers.map((t) => `${t.name} x${t.damage}, cone ${t.halfAngle * 2} deg, ${t.maxTargets} target(s)`).join('; '));
console.log('PRICES: ' + Object.entries(economy.upgrades.melee).map(([id, price]) => `${id} ${price}`).join(', '));
