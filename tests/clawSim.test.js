// GRAB-A-GUN's odds (tools/clawOdds.js, printed by npm run sim:claw): the plan's rules hold for the current config/clawMachine.js
// and price. The wall stays the cheaper way to any one specific gun, even with perfect timing; a site lasts about the plan's grabs;
// better timing wins better guns. Smaller runs than the report (seeded, so the numbers are the same every time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL, MODES, simulate, clawCostPerGun, wallRouteCost, CLAW_ENTRY, seeded } from '../tools/clawOdds.js';
import { clawMachine as cfg } from '../src/config/clawMachine.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';

const GRABS = 60_000;

test('the wall stays the cheaper way to every specific gun, even with perfect timing (and the Hallway the claw needs)', () => {
  for (const { id } of POOL) {
    if (weapons[id].clawOnly) { assert.equal(wallRouteCost(id), Infinity, `${id}: no wall route, the claw is the only way`); continue; }
    const claw = clawCostPerGun(id, { mode: 'perfect', grabs: GRABS, random: seeded(4) }) + CLAW_ENTRY;
    assert.ok(claw > wallRouteCost(id), `${id}: claw ${Math.round(claw)} vs wall ${wallRouteCost(id)}`);
  }
});

test('a site: perfect timing always sells out, a random lane often meets Sunny, and better timing wins dearer guns', () => {
  const runs = Object.fromEntries(MODES.map((mode) => [mode, simulate({ mode, grabs: GRABS, random: seeded(9) })]));
  assert.equal(runs.perfect.plushCloses, 0, 'perfect timing always dodges the plush');
  assert.equal(runs.perfect.grabs / runs.perfect.sites, cfg.stock);
  for (const mode of MODES) {
    const perSite = runs[mode].grabs / runs[mode].sites;
    assert.ok(perSite > 5 && perSite <= cfg.stock, `${mode}: ${perSite.toFixed(2)} grabs a site`);
  }
  const share = (mode) => runs[mode].plushCloses / (runs[mode].plushCloses + runs[mode].soldOutCloses);
  assert.ok(share('random') > 0.4 && share('3-in-4') < 0.3, 'Sunny mostly catches careless players');
  const value = (mode) => runs[mode].valueSum / runs[mode].netSpent;
  assert.ok(value('perfect') > value('3-in-4') && value('3-in-4') > value('random'), 'timing is worth something');
  for (const mode of MODES) assert.equal(runs[mode].netSpent, (runs[mode].grabs - runs[mode].plush) * economy.claw.grab, `${mode}: a plush grab is refunded`);
});
