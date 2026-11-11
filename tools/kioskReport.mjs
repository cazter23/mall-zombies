// =============================================================================
// KIOSK KEVIN REPORT:  npm run kiosk
// What Kevin's equipment does and what it costs, by round (the maths: tools/kioskBalance.js; nothing is played):
// equipment power, Soda Bomb kills by round and zombie type, the Sparkler Cake's burn, Bubble Wrap hits to death, the
// SPIN-O-MATIC Sentry's damage a second against the Price Gun, damage per point against wall ammo, and every price as a share of
// what a round pays (docs/economy-report.md). Run it before and after changing a price in economy.kiosk or a number in
// config/kiosk.js; `npm run sim:economy -- --quick` then plays the bot with Kevin in its buy order (the 'kiosk' run set).
// =============================================================================

import { kiosk } from '../src/config/kiosk.js';
import { economy, zombieHealthFor, zombieHealthForRound } from '../src/config/economy.js';
import { zombieTypes } from '../src/config/zombies.js';
import { weapons } from '../src/config/weapons.js';
import { feel } from '../src/config/feel.js';
import {
  ROUND_INCOME, TYPES, CROWD, products, price, charges, crowdFalloff, sodaBomb, sparklerCake, sentry, hitsToDeath, wrapShare,
  priceShare, ammoDamagePerPoint, zombiesPerPocket, damagePerPoint, equipmentPower, sustainedDps, layerStrength, maxLayers,
} from './kioskBalance.js';

const ROUNDS = [1, 2, 3, 5, 8, 10, 15, 20, 25, 30];
const r0 = (n) => (Number.isFinite(n) ? Math.round(n) : '-');
const r1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '-');
const r2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '-');
const pct = (n) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : '-');
const NAMES = { ...Object.fromEntries(Object.entries(products).map(([id, p]) => [id, p.name])), bubbleWrap: kiosk.bubbleWrap.name };
const SELLING = Object.keys(economy.kiosk);
const TYPE_NAMES = { shopper: 'Shopper', mallWalker: 'Mall Walker', cartPusher: 'Cart Pusher', mannequin: 'Mannequin', mascot: 'Mascot' };

console.log(`\nKIOSK KEVIN: equipment power = (zombie health / ${kiosk.power.baseHealth}) ^ ${kiosk.power.exponent}; prices ${SELLING.map((id) => `${NAMES[id]} ${price(id)}`).join(', ')}`);
console.table(ROUNDS.map((round) => ({ round, 'zombie hp': zombieHealthForRound(round), power: r2(equipmentPower(round)),
  'zombie hp grows': `x${r1(zombieHealthForRound(round) / zombieHealthForRound(1))}`, 'power grows': `x${r1(equipmentPower(round) / equipmentPower(1))}` })));

const { blast } = products.sodaBomb;
console.log(`\nSODA BOMB: ${blast.centreDamage} x power at the centre, ${blast.edgeFraction} of it at the ${blast.radius} m edge; a crowd of ${CROWD} spread over the blast takes ${pct(crowdFalloff(blast))} of the centre each. Bosses: ${pct(blast.bossShare)} of max health at the centre.`);
console.log('Share of one zombie\'s health at the centre / the radius it still dies within (m, 0 = never)');
console.table(ROUNDS.map((round) => Object.fromEntries([['round', round], ['centre', r0(sodaBomb(round).centre)],
  ...TYPES.map((t) => { const b = sodaBomb(round, t); return [TYPE_NAMES[t], `${pct(b.share)} / ${r1(b.killRadius)}`]; }),
  [`Shoppers' worth from a crowd of ${CROWD}`, r1(sodaBomb(round).crowdZombies)]])));

console.log(`\nSPARKLER CAKE: each pulse sets zombies within ${products.sparklerCake.spray.radius} m burning for ${products.sparklerCake.spray.burn.damage} x power over ${products.sparklerCake.spray.burn.seconds} s (refreshed, never stacked); bosses x${products.sparklerCake.spray.bossFactor}`);
console.table(ROUNDS.map((round) => { const c = sparklerCake(round); return { round, 'walks through (one burn)': r0(c.onePulse), 'share of a Shopper': pct(c.onePulse / c.hp), 'stays the whole spray': r0(c.most), 'share ': pct(c.most / c.hp) }; }));

const priceGun = weapons.priceGun;
const priceGunDps = sustainedDps(priceGun, 10, { ads: true });
const { turret } = products.sentry;
console.log(`\nSPIN-O-MATIC SENTRY: ${turret.damage} x power a shot every ${turret.fireSeconds} s for ${turret.lifeSeconds} s (every shot a body hit; no headshots, no misses). Price Gun: ${priceGun.damage} a shot, ${r0(priceGunDps)} sustained dps at 10 m aimed (tools/balance.js: misses, magazine and reload included)`);
console.table(ROUNDS.map((round) => { const s = sentry(round); return { round, 'damage a second': r0(s.dps), 'Price Gun dps': r0(priceGunDps), 'against the Price Gun': `x${r2(s.dps / priceGunDps)}`, 'over its life': r0(s.life), "Shoppers' worth": r1(s.life / s.hp) }; }));

console.log(`\nBUBBLE WRAP: ${layerStrength()} a layer, up to ${maxLayers()}; a full wrap absorbs ${pct(wrapShare())} of the player's ${feel.player.maxHealth} health. Zombie hits in a row from full health (no regen between them)`);
const HITS = [['Shopper, Mall Walker, Mannequin, Cart Pusher swing', zombieTypes.shopper.attack.damage], ['Mascot', zombieTypes.mascot.attack.damage], ['Cart Pusher charge', zombieTypes.cartPusher.charge.damage]];
console.table(HITS.map(([who, damage]) => Object.fromEntries([['hit', `${who} (${damage})`],
  ...Array.from({ length: maxLayers() + 1 }, (_, layers) => [`${layers} layer${layers === 1 ? '' : 's'}`, hitsToDeath(damage, layers)]),
  ['full wrap against none', `x${r2(hitsToDeath(damage, maxLayers()) / hitsToDeath(damage, 0))}`]])));

console.log(`\nDAMAGE PER POINT: one full pocket thrown into crowds of ${CROWD} (the Sentry: its whole life), against wall ammo (a full reserve, every shot landing)`);
console.table([5, 10, 15, 25].map((round) => Object.fromEntries([['round', round],
  ...['sodaBomb', 'sparklerCake', 'sentry'].map((id) => [NAMES[id], `${r1(damagePerPoint(id, round))} (${r1(zombiesPerPocket(id, round))} zombies)`]),
  ['Price Gun ammo', r1(ammoDamagePerPoint('priceGun'))], ['Rivet Rifle ammo', r1(ammoDamagePerPoint('rivetRifle'))]])));

console.log('\nPRICES IN ROUNDS OF INCOME: a price (one purchase) as a share of what the round pays (good skill, docs/economy-report.md)');
console.table(SELLING.map((id) => Object.fromEntries([['product', `${NAMES[id]} (${id === 'bubbleWrap' ? '1 layer' : `${charges(id)}`})`], ['price', price(id)],
  ...[2, 3, 5, 10, 15, 20, 25, 30].map((round) => [`round ${round}`, pct(priceShare(id, round))])])));
console.log(`(Round income: ${[2, 5, 10, 15, 20, 25, 30].map((r) => `round ${r} ${ROUND_INCOME[r]}`).join(', ')}.)`);

console.log(`\nBOSSES: a Soda Bomb takes ${pct(blast.bossShare)} of a boss's max health at the centre (fixed: boss health already scales); the Sentry hits them normally; the Sparkler Cake burns them at x${products.sparklerCake.spray.bossFactor}; the Air Horn and the Glitter Bomb do nothing.`);
console.log(`(Boss check: a Security Guard at round 9 has ${zombieHealthFor('guard', 9)} health.)`);
