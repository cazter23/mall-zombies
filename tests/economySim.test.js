// The economy sim (npm run sim:economy): the bot still plays and keeps honest books, its buy orders and proposals still point at real
// config, and a proposal only ever changes numbers in memory. Short runs only: the report's long runs are the tool's job, not a test's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runBot, gunWorth } from '../tools/economyBot.js';
import { PLANS, PROPOSALS, applyOverrides, withProposal, valueAt } from '../tools/economyPlans.js';
import { zombieMixFor, loadoutGun, roundIncome, upgradeLadder, roundsOfHealth, gunDps } from '../tools/economyModel.js';
import { economy, zombieCountForRound, zombieHealthForRound } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';

const sum = (list, fn) => list.reduce((total, x) => total + fn(x), 0);

test('the bot plays two rounds, buys its list at the shelf price, and its books balance', () => {
  const plan = [{ type: 'gun', id: 'priceGun' }, { type: 'door', area: 'hallway' }];
  const run = runBot({ seed: 1, skill: 'good', plan, maxRound: 2, immortal: true });
  assert.equal(run.outcome, 'maxRound');
  // bought in order, each at its price (no Flash Sale this early), in the break it could first afford it
  assert.deepEqual(run.steps.map((s) => s.cost), [economy.wallBuys.priceGun.weapon, economy.doors.hallway]);
  assert.equal(run.steps[0].round, 1, 'the Price Gun with the starting points');
  assert.ok(run.steps[1].round >= 2, 'the shutter once a round has paid for it');
  assert.equal(run.spent, sum(run.purchases, (p) => p.cost), 'every point spent is a logged purchase');
  // every point earned is in a round, and every round's points have a source
  assert.equal(sum(run.rounds, (r) => r.earned), run.earned);
  for (const r of run.rounds) assert.equal(r.income.hits + r.income.kills + r.income.bosses + r.income.other, r.earned, `round ${r.round}'s sources add up`);
  // round 1: every zombie killed, paid between "kill values only" and "every kill a box cutter kill after a magazine of staples"
  const first = run.rounds[0], count = zombieCountForRound(1);
  assert.equal(first.kills, count);
  const staplesToKill = Math.ceil(zombieHealthForRound(1) / weapons.stapleGun.damage);
  const most = count * (economy.killValues.shopper + economy.payouts.meleeKillBonus + staplesToKill * economy.payouts.nonLethalHit);
  assert.ok(first.earned >= count * economy.killValues.shopper && first.earned <= most, `round 1 paid ${first.earned}`);
  assert.deepEqual(first.loadout.map((g) => g.id), ['stapleGun'], 'the loadout is recorded as the round begins');
});

test('a proposal changes numbers in memory only, and puts them back', () => {
  const before = { grab: economy.claw.grab, platinum: valueAt('upgrades.tiers.platinum.effects.damage'), priceGun: weapons.priceGun.damage };
  const restore = applyOverrides({ 'economy.claw.grab': before.grab + 500, 'upgrades.tiers.platinum.effects.damage': 9, 'weapons.priceGun.damage': 1 });
  assert.equal(economy.claw.grab, before.grab + 500);
  assert.equal(upgrades.tiers.find((t) => t.id === 'platinum').effects.damage, 9, 'a list entry is found by its id');
  assert.equal(weapons.priceGun.damage, 1);
  restore();
  assert.deepEqual({ grab: economy.claw.grab, platinum: valueAt('upgrades.tiers.platinum.effects.damage'), priceGun: weapons.priceGun.damage }, before);
  assert.throws(() => applyOverrides({ 'economy.claw.grabb': 1 }), /not an existing config value/, 'a typo must not invent a number');
  assert.throws(() => applyOverrides({ 'nowhere.claw.grab': 1 }), /unknown config root/);
  // the bot pays the proposed price, and the shelf price is back afterwards
  const shelf = economy.wallBuys.priceGun.weapon;
  const undo = applyOverrides({ 'economy.wallBuys.priceGun.weapon': shelf - 200 });
  try {
    const run = runBot({ seed: 2, skill: 'good', plan: [{ type: 'gun', id: 'priceGun' }], maxRound: 1, immortal: true });
    assert.equal(run.steps[0].cost, shelf - 200);
  } finally { undo(); }
  assert.equal(economy.wallBuys.priceGun.weapon, shelf);
});

test('every proposal points at real config, and every buy order at real things to buy', () => {
  for (const [id, proposal] of Object.entries(PROPOSALS)) {
    const seen = {};
    withProposal(id, () => { for (const path of Object.keys(proposal.overrides)) seen[path] = valueAt(path); });
    assert.deepEqual(seen, proposal.overrides, `${id}: its numbers are in place while it runs`);
    if (proposal.plan) assert.ok(PLANS[proposal.plan], `${id}: its buy order exists`);
  }
  const warrantySteps = upgrades.tiers.length - 1 + upgrades.renewals.max;
  for (const [name, plan] of Object.entries(PLANS)) {
    const tiers = {};
    for (const step of plan) {
      if (step.type === 'door') assert.ok(economy.doors[step.area] > 0, `${name}: door ${step.area}`);
      if (step.type === 'gun') assert.ok(economy.wallBuys[step.id]?.weapon > 0 && weapons[step.id], `${name}: gun ${step.id}`);
      if (step.type === 'wardrobe') assert.ok(economy.wardrobe[step.id] > 0, `${name}: apparel ${step.id}`);
      if (step.type === 'attachment') assert.ok(economy.upgrades.attachments[step.id] > 0, `${name}: attachment ${step.id}`);
      if (step.type === 'tier' || step.type === 'bab') assert.ok(weapons[step.gun], `${name}: ${step.type} for ${step.gun}`);
      if (step.type === 'tier') tiers[step.gun] = (tiers[step.gun] ?? 0) + 1;
    }
    for (const [gun, count] of Object.entries(tiers)) assert.ok(count <= warrantySteps, `${name}: ${count} warranty steps for ${gun}, there are ${warrantySteps}`);
  }
});

test('the maths side reads config: the wave mix, a round\'s income and the upgrade ladder', () => {
  for (let round = 1; round <= 30; round++) {
    const mix = zombieMixFor(round);
    assert.ok(Math.abs(sum(Object.values(mix), (x) => x) - 1) < 1e-9, `round ${round}'s shares add up to 1`);
    assert.ok(mix.shopper > 0.3, 'Shoppers stay the bulk of a wave');
  }
  assert.deepEqual(Object.keys(zombieMixFor(1)), ['shopper']);
  // one gun, one round: at least the kill values, and a weaker gun earns MORE from the same wave (+10 a hit)
  const staple = roundIncome(loadoutGun({ id: 'stapleGun' }), 5), price = roundIncome(loadoutGun({ id: 'priceGun' }), 5);
  assert.equal(staple.zombies, zombieCountForRound(5));
  assert.ok(price.points >= staple.zombies * economy.killValues.shopper);
  assert.ok(staple.points > price.points, 'the Staple Gun needs more hits, so the wave pays more');
  // the ladder: every price is the shop's, a warranty tier is worth what config says, and a round of zombie health is one "round"
  const ladder = upgradeLadder();
  assert.equal(ladder.find((r) => r.name === 'Platinum').cost, economy.upgrades.tiers.platinum);
  assert.equal(ladder.find((r) => r.name === 'Platinum').total, upgrades.tiers.find((t) => t.id === 'platinum').effects.damage);
  assert.equal(ladder.filter((r) => r.name.startsWith('Renewal')).length, upgrades.renewals.max);
  assert.ok(ladder.filter((r) => r.line === 'build').every((r) => r.cost === economy.upgrades.workshop.ritual));
  assert.ok(Math.abs(roundsOfHealth(economy.waves.health.multiplierAfter) - 1) < 1e-9);
  // an upgraded gun is the base gun times its warranty and its build
  const plain = gunDps(loadoutGun({ id: 'rivetRifle' })), built = gunDps(loadoutGun({ id: 'rivetRifle', tier: 'premium', build: 'regular' }));
  assert.ok(built > 2 * plain, `Premium and a Regular build: ${Math.round(built)} against ${Math.round(plain)}`);
});

test('the bot only wants guns it can use (the claw step leaves the rest in the chute)', () => {
  for (const id of ['priceGun', 'nailGun', 'foamDartBlaster', 'rivetRifle', 'coilNailer']) assert.ok(gunWorth(id) > 0, id);
  for (const id of ['confettiCannon', 'barcodeScanner', 'leafBlower', 'tennisBallLauncher']) assert.equal(gunWorth(id), 0, id);
  assert.ok(gunWorth('coilNailer') > gunWorth('rivetRifle') && gunWorth('rivetRifle') > gunWorth('nailGun'));
  assert.equal(gunWorth('returnToSender'), Infinity, 'the wonder weapon beats everything');
});

// Phase 11: the quest tool extends the existing bot, and keeps its books.
import { runClosingBot, QUEST_PLAN } from '../tools/closingTimeBot.js';
test('the Closing Time driver uses Classic and real purchases, with no invented progress', () => {
  const random = Math.random;
  const run = runClosingBot({ mode: 'classic', seed: 3, skill: 'good', immortal: true, maxRound: 2 });
  assert.equal(Math.random, random, 'the bot restores the caller random source');
  assert.equal(run.outcome, 'maxRound');
  assert.equal(run.quest.mode, 'classic');
  assert.equal(run.quest.win, null);
  assert.equal(run.quest.checklist.filter(l => l.done).length, 0);
  assert.ok(run.quest.log.some(e => e.name === 'purchase' && e.id === 'startShutter'));
  assert.equal(run.spent, sum(run.purchases, p => p.cost));
  assert.equal(run.points, economy.startingPoints + run.earned - run.spent);
  assert.ok(QUEST_PLAN.some(s => s.area === 'parkingLot'));
});

import { headlessGame } from './helpers/headlessGame.js';
import { questDriver } from '../tools/closingTimeBot.js';
test('the quest report includes first overtime round spending and payload-free death events', () => {
  const t = headlessGame();
  const g = Object.create(t.g);
  Object.defineProperty(g, 'overtimeFrom', { value: 20 });
  Object.defineProperty(g, 'rounds', { value: Object.create(t.g.rounds) });
  Object.defineProperty(g.rounds, 'round', { value: 20 });
  const policy = questDriver({ ...t, g, bought() {}, tryStep() {}, holdGun() {}, interactAt() {} },
    { mode: 'directed', buyReturns: true, overtime: 10, immortal: true });
  assert.equal(policy.reserve(), 0, 'no wonder-weapon ammo budget before owning it');
  g.gun.give(weapons.returnToSender);
  assert.equal(policy.reserve(), g.pricing.priceOf('closing', 'validation'), 'reserve parking money before optional ammo');
  g.events.emit('overtimeStart', { round: 20 });
  g.wallet.earn(6000);
  assert.ok(g.wallet.spend(2500));
  g.events.emit('purchase', { id: 'returnsAmmo', kind: 'closing', cost: 2500 });
  g.events.emit('roundStart', { round: 21 });
  const [row] = policy.result().overtime;
  assert.equal(row.index, 1);
  assert.equal(row.earned, 6000);
  assert.equal(row.spent, 2500);
  assert.equal(row.banked, 3500);
  assert.equal(row.ammo, 2500);
  g.health.takeDamage(g.stats.health, { type: 'zombie', id: 'shopper' });
  const [death] = policy.result().deaths;
  assert.equal(death.cause, 'shopper');
  assert.ok(Array.isArray(death.position));
  g.map.dispose?.();
});

test('the quest policy keeps its last beam for Speechless, then switches back to return her', () => {
  const t = headlessGame(), g = Object.create(t.g), switched = [];
  const boss = { type: { id: 'lastCustomer' }, state: 'chasing' };
  const beam = { magazine: 1, reserve: 0 }, rifle = { magazine: 30, reserve: 100 };
  Object.defineProperty(g, 'bosses', { value: { active: boss } });
  Object.defineProperty(g, 'gun', { value: {
    weaponFor: id => id === 'returnToSender' ? beam : rifle,
    owns: () => true,
  } });
  const policy = questDriver({ ...t, g, bought() {}, tryStep() {}, interactAt() {}, holdGun: id => switched.push(id) },
    { mode: 'directed', buyReturns: true, overtime: 10, immortal: true });
  policy.beforeTick(1);
  assert.deepEqual(switched, ['rivetRifle']);
  boss.state = 'speechless';
  policy.beforeTick(2);
  assert.deepEqual(switched, ['rivetRifle', 'returnToSender']);
  assert.equal(policy.target([boss]), boss);
  g.map.dispose?.();
});
