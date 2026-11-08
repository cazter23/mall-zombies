import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';

menuDom(); // window mock for module imports
const { evaluatePerformance, receiptLinesFor } = await import('../src/ui/screens.js');

test('evaluatePerformance assigns UNAUTHORIZED OVERTIME on high round or long duration', () => {
  const byRound = evaluatePerformance({ round: 8, timeAlive: 100 });
  assert.equal(byRound.title, 'UNAUTHORIZED OVERTIME');
  assert.match(byRound.rating, /OT-99/);
  assert.match(byRound.comment, /Overtime wages denied/);

  const byTime = evaluatePerformance({ round: 4, timeAlive: 480 });
  assert.equal(byTime.title, 'UNAUTHORIZED OVERTIME');
});

test('evaluatePerformance assigns EMPLOYEE OF THE MONTH for high kills and good accuracy', () => {
  const review = evaluatePerformance({ round: 6, kills: 45, accuracy: 0.5, timeAlive: 300 });
  assert.equal(review.title, 'EMPLOYEE OF THE MONTH');
  assert.match(review.rating, /EXCEEDS EXPECTATIONS/);
  assert.match(review.comment, /posthumously/);
});

test('evaluatePerformance assigns BOX CUTTER ENTHUSIAST for melee kills', () => {
  const byRawMelee = evaluatePerformance({ round: 3, kills: 10, meleeKills: 8, timeAlive: 200 });
  assert.equal(byRawMelee.title, 'BOX CUTTER ENTHUSIAST');
  assert.match(byRawMelee.rating, /LOSS PREVENTION HERO/);

  const byRatio = evaluatePerformance({ round: 4, kills: 10, meleeKills: 4, timeAlive: 200 });
  assert.equal(byRatio.title, 'BOX CUTTER ENTHUSIAST');
});

test('evaluatePerformance assigns MARKDOWN SPECIALIST for surgical headshots', () => {
  const review = evaluatePerformance({ round: 4, kills: 10, headshotKills: 6, accuracy: 0.55, timeAlive: 200 });
  assert.equal(review.title, 'MARKDOWN SPECIALIST');
  assert.match(review.rating, /PRECISION TAGGER/);
  assert.match(review.comment, /head-level markdowns/);
});

test('evaluatePerformance assigns WINDOW SHOPPER for unspent point hoarding', () => {
  const review = evaluatePerformance({ round: 4, kills: 15, pointsRemaining: 2500, timeAlive: 200 });
  assert.equal(review.title, 'WINDOW SHOPPER');
  assert.match(review.rating, /UNCLAIMED STIPEND/);
  assert.match(review.comment, /Budget revoked/);
});

test('evaluatePerformance assigns CANVASSING SPECIALIST for low accuracy spray', () => {
  const review = evaluatePerformance({ round: 4, kills: 10, shotsFired: 40, accuracy: 0.24, timeAlive: 200 });
  assert.equal(review.title, 'CANVASSING SPECIALIST');
  assert.match(review.rating, /EXCESS SHRINKAGE/);
  assert.match(review.comment, /drywall collateral/);
});

test('evaluatePerformance assigns BULK CONSUMER for massive ammo usage', () => {
  const review = evaluatePerformance({ round: 5, kills: 25, shotsFired: 250, accuracy: 0.35, timeAlive: 250 });
  assert.equal(review.title, 'BULK CONSUMER');
  assert.match(review.rating, /SUPPLY DEPLETION/);
  assert.match(review.comment, /warehouse backlog/);
});

test('evaluatePerformance assigns FAILED PROBATION for early death', () => {
  const review = evaluatePerformance({ round: 2, timeAlive: 89, kills: 2 });
  assert.equal(review.title, 'FAILED PROBATION');
  assert.match(review.rating, /IMMEDIATE TERMINATION/);
  assert.match(review.comment, /orientation period/);
});

test('evaluatePerformance assigns GENERAL CASUALTY when no special conditions are met', () => {
  const review = evaluatePerformance({ round: 4, timeAlive: 150, kills: 12, accuracy: 0.4 });
  assert.equal(review.title, 'GENERAL CASUALTY');
  assert.match(review.rating, /SHIFT CONCLUDED/);
  assert.match(review.comment, /Replacement cashier/);
});

test('evaluatePerformance handles missing, null, or empty arguments safely', () => {
  const empty = evaluatePerformance({});
  assert.equal(empty.title, 'FAILED PROBATION'); // default round 1, timeAlive 0

  const undef = evaluatePerformance(undefined);
  assert.equal(undef.title, 'FAILED PROBATION');
});

test('the receipt reads out the guns you named at Build-A-Blaster, and says nothing if you named none', () => {
  const base = { timeAlive: 60, round: 3, kills: 4, headshotKills: 1, meleeKills: 0, accuracy: .5 };
  const label = (r) => receiptLinesFor(r).find(([name]) => name === 'Survived by');
  assert.equal(label({ ...base, survivedBy: [] }), undefined);
  assert.equal(label(base), undefined);
  const gerald = { name: 'Gerald', combo: 'Grand Finale', confirmed: 212 }, doris = { name: 'Doris', combo: 'Cold Snap', confirmed: 3 };
  assert.deepEqual(label({ ...base, survivedBy: [gerald] }), ['Survived by', 'Gerald (Grand Finale), 212 confirmed']);
  assert.deepEqual(label({ ...base, survivedBy: [gerald, doris] }), ['Survived by', 'Gerald (Grand Finale), 212 confirmed and Doris (Cold Snap), 3 confirmed']);
});

test('GRAB-A-GUN on the receipt: prize tickets and Sunny keychains get their own lines, only when there are some', () => {
  const base = { timeAlive: 60, round: 3, kills: 10, headshotKills: 2, meleeKills: 1, accuracy: 0.5 };
  const names = (r) => receiptLinesFor(r).map(([name]) => name);
  assert.ok(!names(base).includes('Prize tickets won') && !names(base).includes('Sunny keychains'));
  const lines = Object.fromEntries(receiptLinesFor({ ...base, ticketsWon: 340, keychains: 1 }));
  assert.equal(lines['Prize tickets won'], 340);
  assert.equal(lines['Sunny keychains'], '1 (non-refundable)');
});
