import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';

menuDom(); // window mock for module imports
const { evaluatePerformance, receiptLinesFor, getDeathReport, createScreens } = await import('../src/ui/screens.js');
const { deathReports } = await import('../src/config/deathReports.js');
const { hasStatNumber } = await import('../src/config/effectWords.js');
const { createPlayerHealth } = await import('../src/player/health.js');

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

test('createPlayerHealth records lethal source and clears it on reset', () => {
  const stats = { health: 100, maxHealth: 100, regenDelay: 5, regenRate: 10 };
  let deathSource = null;
  const health = createPlayerHealth({ stats, onDeath: (source) => { deathSource = source; } });

  // Non-lethal damage does not set killedBy
  health.takeDamage(40, { type: 'zombie', id: 'shopper' });
  assert.equal(health.killedBy, null);
  assert.equal(deathSource, null);

  // Lethal damage records source
  const lethalSource = { type: 'zombie', id: 'cartPusher' };
  health.takeDamage(70, lethalSource);
  assert.equal(health.isDead, true);
  assert.equal(health.killedBy, lethalSource);
  assert.equal(deathSource, lethalSource);

  // Reset clears killedBy
  health.reset();
  assert.equal(health.isDead, false);
  assert.equal(health.killedBy, null);
});

test('getDeathReport resolves causes and survival tips for various lethal sources', () => {
  // Standard zombie
  const shopper = getDeathReport({ type: 'zombie', id: 'shopper' });
  assert.equal(shopper.cause, deathReports.zombies.shopper.cause);
  assert.match(shopper.tip, /Associate Tip/);

  // Cart Pusher
  const cart = getDeathReport({ type: 'zombie', id: 'cartPusher' });
  assert.equal(cart.cause, deathReports.zombies.cartPusher.cause);
  assert.doesNotMatch(cart.tip, /Space|\[/, 'no keyboard key: a controller player reads it too');

  // Mall Walker
  const walker = getDeathReport({ type: 'zombie', id: 'mallWalker' });
  assert.equal(walker.cause, deathReports.zombies.mallWalker.cause);

  // Mannequin
  const mannequin = getDeathReport({ type: 'zombie', id: 'mannequin' });
  assert.equal(mannequin.cause, deathReports.zombies.mannequin.cause);

  // Mascot variants
  for (const variant of ['sirWaffles', 'captainCoupon', 'poppyCorn', 'scoops']) {
    const mascot = getDeathReport({ type: 'zombie', id: 'mascot', variant });
    assert.equal(mascot.cause, deathReports.mascots[variant].cause);
    assert.equal(mascot.tip, deathReports.mascots[variant].tip);
  }

  // Bosses (via boss or id)
  for (const boss of ['janitor', 'guard', 'manager', 'influencer']) {
    const report1 = getDeathReport({ type: 'zombie', id: boss, boss });
    assert.equal(report1.cause, deathReports.bosses[boss].cause);
    assert.equal(report1.tip, deathReports.bosses[boss].tip);

    const report2 = getDeathReport({ type: 'zombie', id: boss });
    assert.equal(report2.cause, deathReports.bosses[boss].cause);
  }

  // Fall
  assert.equal(getDeathReport({ fall: true }).cause, deathReports.fall.cause);
  assert.equal(getDeathReport({ type: 'fall', fall: true }).cause, deathReports.fall.cause);

  // Fallback / unknown
  assert.equal(getDeathReport(null).cause, deathReports.default.cause);
  assert.equal(getDeathReport(undefined).cause, deathReports.default.cause);
  assert.equal(getDeathReport({}).cause, deathReports.default.cause);
  assert.equal(getDeathReport({ type: 'unknown' }).cause, deathReports.default.cause);
});

test('every death report cause and tip complies with the words-only rule', () => {
  const allReports = [
    deathReports.fall,
    ...Object.values(deathReports.zombies),
    ...Object.values(deathReports.mascots),
    ...Object.values(deathReports.bosses),
    deathReports.default,
  ];

  for (const report of allReports) {
    assert.ok(report.cause && typeof report.cause === 'string', 'has cause string');
    assert.ok(report.tip && typeof report.tip === 'string', 'has tip string');
    assert.equal(hasStatNumber(report.cause), false, `cause must not have stat numbers: ${report.cause}`);
    assert.equal(hasStatNumber(report.tip), false, `tip must not have stat numbers: ${report.tip}`);
  }
});

test('Incident Report (Form 109-C) renders into the receipt DOM with cause and survival tip', () => {
  const screens = createScreens();
  const baseSummary = {
    timeAlive: 120,
    round: 4,
    kills: 15,
    headshotKills: 5,
    meleeKills: 2,
    accuracy: 0.45,
    pointsEarned: 2400,
    pointsRemaining: 300,
    shotsFired: 50,
  };

  // Cart Pusher death
  screens.show('results', { ...baseSummary, killedBy: { type: 'zombie', id: 'cartPusher' } });
  const causeEl = document.querySelector('.receipt-incident-cause');
  const tipEl = document.querySelector('.receipt-incident-tip');
  const headerEl = document.querySelector('.receipt-incident-header');

  assert.ok(headerEl, 'has incident header');
  assert.match(headerEl.textContent, /INCIDENT REPORT \/ FORM 109-C/);
  assert.equal(causeEl.textContent, deathReports.zombies.cartPusher.cause);
  assert.equal(tipEl.textContent, deathReports.zombies.cartPusher.tip);

  // Boss death (Janitor)
  screens.show('results', { ...baseSummary, killedBy: { type: 'zombie', id: 'janitor', boss: 'janitor' } });
  assert.equal(causeEl.textContent, deathReports.bosses.janitor.cause);
  assert.equal(tipEl.textContent, deathReports.bosses.janitor.tip);

  // Fall death
  screens.show('results', { ...baseSummary, killedBy: { type: 'fall', fall: true } });
  assert.equal(causeEl.textContent, deathReports.fall.cause);
  assert.equal(tipEl.textContent, deathReports.fall.tip);

  // Standard zombie death
  screens.show('results', { ...baseSummary, killedBy: { type: 'zombie', id: 'shopper' } });
  assert.equal(causeEl.textContent, deathReports.zombies.shopper.cause);
  assert.equal(tipEl.textContent, deathReports.zombies.shopper.tip);
});

test('headless game records lethal blow source in summary and renders in receipt DOM', async () => {
  const { headlessGame } = await import('./helpers/headlessGame.js');

  // 1. Zombie kill
  {
    const t = headlessGame();
    let endedSummary = null;
    t.g.events.on('runEnd', ({ summary }) => { endedSummary = summary; });

    const mockZombie = { type: { id: 'cartPusher' } };
    t.g.events.emit('playerHit', { damage: 200, zombie: mockZombie, knockback: null });

    assert.ok(endedSummary, 'runEnd emitted');
    assert.deepEqual(endedSummary.killedBy, { type: 'zombie', id: 'cartPusher' });

    document.body.replaceChildren();
    const screens = createScreens();
    screens.show('results', endedSummary);
    assert.equal(document.querySelector('.receipt-incident-cause').textContent, deathReports.zombies.cartPusher.cause);
    assert.equal(document.querySelector('.receipt-incident-tip').textContent, deathReports.zombies.cartPusher.tip);
  }

  // 2. Boss kill
  {
    const t = headlessGame();
    let endedSummary = null;
    t.g.events.on('runEnd', ({ summary }) => { endedSummary = summary; });

    const mockBoss = { type: { id: 'janitor', boss: true } };
    t.g.events.emit('playerHit', { damage: 200, zombie: mockBoss, knockback: null });

    assert.ok(endedSummary, 'runEnd emitted');
    assert.deepEqual(endedSummary.killedBy, { type: 'zombie', id: 'janitor', boss: 'janitor' });

    document.body.replaceChildren();
    const screens = createScreens();
    screens.show('results', endedSummary);
    assert.equal(document.querySelector('.receipt-incident-cause').textContent, deathReports.bosses.janitor.cause);
    assert.equal(document.querySelector('.receipt-incident-tip').textContent, deathReports.bosses.janitor.tip);
  }

  // 3. Fall kill
  {
    const t = headlessGame();
    let endedSummary = null;
    t.g.events.on('runEnd', ({ summary }) => { endedSummary = summary; });

    t.g.player.onFall({ drop: 10, damage: 200 });

    assert.ok(endedSummary, 'runEnd emitted');
    assert.deepEqual(endedSummary.killedBy, { type: 'fall', fall: true });

    document.body.replaceChildren();
    const screens = createScreens();
    screens.show('results', endedSummary);
    assert.equal(document.querySelector('.receipt-incident-cause').textContent, deathReports.fall.cause);
    assert.equal(document.querySelector('.receipt-incident-tip').textContent, deathReports.fall.tip);
  }
});

test('getDeathReport: a hazard switch that can hurt you has its own incident report', async () => {
  const { hazards } = await import('../src/config/hazards.js');
  const { deathReports } = await import('../src/config/deathReports.js');
  const hurting = Object.values(hazards).filter((h) => h && h.id && h.playerDamage > 0);
  assert.ok(hurting.length > 0, 'the Electrified Fountain hurts');
  for (const h of hurting) {
    const report = getDeathReport({ type: 'hazard', id: h.id });
    assert.equal(report, deathReports.hazards[h.id], `add deathReports.hazards.${h.id}`);
  }
  assert.equal(getDeathReport({ type: 'hazard', id: 'somethingNew' }), deathReports.hazardDefault, 'an unknown hazard is still a hazard');
  assert.notEqual(deathReports.hazardDefault, deathReports.default);
});
