// =============================================================================
// ECONOMY SIM DATA (tools/economySim.mjs: npm run sim:economy). Two things, both plain data:
//
// PLANS: buy orders for the bot (tools/economyBot.js). Strictly in order: the bot saves for the next step on the list.
//   { type: 'door', area }                     an area unlock (economy.doors)
//   { type: 'gun', id, replace }               a wall gun; `replace` = the carried gun to give up when both slots are full
//   { type: 'tier', gun }                      the NEXT Extended Warranty tier (then Renewal) for that gun
//   { type: 'bab', gun }                       a Build-A-Blaster ritual for that gun (needs the Promenade and two guns)
//   { type: 'melee' }                          the next box cutter tier
//   { type: 'wardrobe', id }                   an apparel item
//   { type: 'attachment', gun, id }            a store attachment for that gun
//   { type: 'claw', grabs }                    GRAB-A-GUN, one grab a break until `grabs` are used
//   { type: 'kiosk', share, products }         Kiosk Kevin, a STANDING ORDER: from this point on, every break, after the list, it spends up to
//                                              `share` of the points in hand at his cart on whatever of `products` he has (in that order),
//                                              and it throws what it carries in a fight (tools/economyBot.js useEquipment)
//   any step: fromRound (not before this round), afterBosses (not before this many bosses are beaten)
// A new buyable (a hazard switch) = a step type in the bot's tryStep and steps here.
//
// PROPOSALS: named sets of config changes that are NOT in src/config. The sim applies one in memory (applyOverrides) in the process
// that plays the run, so a proposal's "after" numbers are measured while the game's real numbers stay as they are. A path is a config
// root (ROOTS) and keys; in a list, a key that isn't a number picks the entry with that id ('upgrades.tiers.platinum.effects.damage').
// `plan` (optional) = the buy order a sensible buyer would follow UNDER that proposal.
// =============================================================================

import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { workshopRitual } from '../src/config/workshop.js';
import { clawMachine } from '../src/config/clawMachine.js';

const tiers = (gun, count) => Array.from({ length: count }, () => ({ type: 'tier', gun }));

// The sensible buyer (the review's order, kept so its numbers compare): a cheap gun, the hub, the Atrium's rifle, its warranty and a
// build, then the second gun, clothes, and every power upgrade there is.
export const SENSIBLE = [
  { type: 'gun', id: 'priceGun' },
  { type: 'door', area: 'hallway' },
  { type: 'door', area: 'atrium' },
  { type: 'gun', id: 'rivetRifle', replace: 'stapleGun' },
  { type: 'tier', gun: 'rivetRifle' }, // Deluxe
  { type: 'door', area: 'upstairs' },
  { type: 'bab', gun: 'rivetRifle' },
  { type: 'tier', gun: 'rivetRifle' }, // Premium
  { type: 'door', area: 'departmentStore' },
  { type: 'wardrobe', id: 'cardigan' },
  { type: 'door', area: 'foodCourt' },
  { type: 'tier', gun: 'rivetRifle' }, // Platinum
  { type: 'door', area: 'cinema' },
  { type: 'gun', id: 'coilNailer', replace: 'priceGun' },
  { type: 'bab', gun: 'coilNailer' },
  ...tiers('coilNailer', 2),
  { type: 'door', area: 'megaMart' },
  { type: 'wardrobe', id: 'fannyPack' },
  ...tiers('coilNailer', 1), // Platinum
  ...tiers('rivetRifle', 5), // its five Renewals
  ...tiers('coilNailer', 5),
  { type: 'melee' }, { type: 'melee' },
  { type: 'door', area: 'serviceCorridor' }, { type: 'door', area: 'parkingLot' },
];

const moveAfter = (plan, isMoved, isAnchor) => {
  const moved = plan.filter(isMoved), rest = plan.filter((s) => !isMoved(s));
  const out = [];
  for (const step of rest) {
    out.push(step);
    if (isAnchor(step, out)) out.push(...moved.splice(0, 1));
  }
  return [...out, ...moved];
};
const tierCount = (list, gun) => list.filter((s) => s.type === 'tier' && s.gun === gun).length;

// The cheapest thing that might work: the Price Gun and its warranty, nothing else.
export const PRICE_GUN_ONLY = [{ type: 'gun', id: 'priceGun' }, { type: 'door', area: 'hallway' }, ...tiers('priceGun', 8)];
// The sensible plan with no Build-A-Blaster: what is the build worth?
export const NO_BAB = SENSIBLE.filter((s) => s.type !== 'bab');
// Each build bought AFTER that gun's Premium warranty: the order a buyer follows once a build costs more than Premium.
export const BAB_AFTER_PREMIUM = moveAfter(SENSIBLE, (s) => s.type === 'bab', (step, out) => step.type === 'tier' && tierCount(out, step.gun) === 2);
// The start shutter, then GRAB-A-GUN before any wall gun but the Price Gun: what does a 1,000 grab do to the early game?
export const CLAW_FIRST = [
  { type: 'gun', id: 'priceGun' }, { type: 'door', area: 'hallway' }, { type: 'claw', grabs: 2 },
  ...SENSIBLE.slice(2),
];
// SENSIBLE, and Kiosk Kevin every break from the moment the shutter is open (half of what is in hand after the list): what does Kevin
// cost the route, what does he give back in survival, and how much does he soak up late (docs/archive/kiosk-kevin-plan.md, phase 7)?
export const KIOSK = [
  ...SENSIBLE.slice(0, 2),
  { type: 'kiosk', share: 0.5, products: ['bubbleWrap', 'sentry', 'sodaBomb', 'sparklerCake', 'glitterBomb', 'airHorn'] },
  ...SENSIBLE.slice(2),
];
// Buys nothing but the shutter: how far does the starting kit go?
export const NOTHING = [{ type: 'door', area: 'hallway' }];

export const PLANS = { SENSIBLE, PRICE_GUN_ONLY, NO_BAB, BAB_AFTER_PREMIUM, CLAW_FIRST, KIOSK, NOTHING };

// ---------------------------------------------------------------------------------------------------------------------------------
// PROPOSALS (docs/economy-report.md, "Proposals"). Change the numbers here to try others.
// A (58), C and D WERE APPLIED on 10 November 2026: their entries now equal the game's own numbers, so their "after" runs are the
// baseline again until someone puts new candidates in. The B options are still only proposals.
// ---------------------------------------------------------------------------------------------------------------------------------
export const PROPOSALS = {
  none: { label: 'Today', overrides: {} },
  // A. The Price Gun is the cheap sprayer again: the dearer rifles are upgrades.
  priceGun: { label: 'A. Price Gun 70 -> 58 damage', overrides: { 'weapons.priceGun.damage': 58 } },
  priceGun62: { label: 'A2. Price Gun 70 -> 62 damage', overrides: { 'weapons.priceGun.damage': 62 } }, // the milder cut (played mortal only)
  // B. Build-A-Blaster is the mid-game milestone. B1: dearer, and only for a gun under Premium warranty (that rule is not in the game: the
  // buy order stands in for it, each build after its gun's Premium). B2: the price alone, no new rule, the build still bought first.
  bab: {
    label: 'B1. Build 1,500 -> 4,000, Premium warranty first (re-stuff 750 -> 2,000)', plan: 'BAB_AFTER_PREMIUM',
    overrides: { 'economy.upgrades.workshop.ritual': 4000, 'economy.upgrades.workshop.restuff': 2000 },
  },
  bab3000: { // the mildest step (played mortal only)
    label: 'B3. Build 1,500 -> 3,000, no gate (re-stuff 750 -> 1,500)',
    overrides: { 'economy.upgrades.workshop.ritual': 3000, 'economy.upgrades.workshop.restuff': 1500 },
  },
  babPrice: {
    label: 'B2. Build 1,500 -> 5,000, no gate (re-stuff 750 -> 2,500)',
    overrides: { 'economy.upgrades.workshop.ritual': 5000, 'economy.upgrades.workshop.restuff': 2500 },
  },
  // C. Platinum and Renewals are worth their price.
  warranty: {
    label: 'C. Platinum x1.65 -> x1.9; Renewals x1.06 -> x1.09, 3,000-10,000 -> 4,000-10,000',
    overrides: {
      'upgrades.tiers.platinum.effects.damage': 1.9,
      'upgrades.renewals.effects.damage': 1.09,
      'economy.upgrades.renewals': [4000, 5000, 6500, 8000, 10000],
    },
  },
  // D. A grab costs what its first prize is worth.
  claw: { label: 'D. Claw grab 1,000 -> 1,500', plan: 'CLAW_FIRST', overrides: { 'economy.claw.grab': 1500 } },
};
// Everything at once (the buy order a build dearer than Premium calls for).
PROPOSALS.all = {
  label: 'A + B + C + D together', plan: 'BAB_AFTER_PREMIUM',
  overrides: Object.assign({}, ...['priceGun', 'bab', 'warranty', 'claw'].map((id) => PROPOSALS[id].overrides)),
};

const ROOTS = { economy, weapons, upgrades, workshopRitual, clawMachine };

function locate(path) {
  const keys = path.split('.');
  let node = ROOTS[keys[0]];
  if (!node) throw new Error(`economy sim: unknown config root in "${path}" (${Object.keys(ROOTS).join(', ')})`);
  for (const key of keys.slice(1, -1)) {
    node = Array.isArray(node) && !/^\d+$/.test(key) ? node.find((entry) => entry.id === key) : node[key];
    if (node === null || typeof node !== 'object') throw new Error(`economy sim: nothing at "${key}" in "${path}"`);
  }
  const last = keys.at(-1);
  if (!(last in node)) throw new Error(`economy sim: "${path}" is not an existing config value (a typo must not invent one)`);
  return { node, last };
}

/** Change config values IN MEMORY ({ 'economy.claw.grab': 1500 }). Returns a function that puts the old values back. */
export function applyOverrides(overrides = {}) {
  const undo = [];
  for (const [path, value] of Object.entries(overrides)) {
    const { node, last } = locate(path);
    undo.push([node, last, node[last]]);
    node[last] = structuredClone(value);
  }
  return () => { for (const [node, last, old] of undo.reverse()) node[last] = old; };
}

/** Run `fn` with a proposal's numbers in place, then put the game's own back. */
export function withProposal(id, fn) {
  const restore = applyOverrides(PROPOSALS[id].overrides);
  try { return fn(); } finally { restore(); }
}

/** A config value by path (for "before" columns). */
export const valueAt = (path) => { const { node, last } = locate(path); return node[last]; };
