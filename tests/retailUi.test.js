import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnnouncements, announcementSeconds } from '../src/ui/announcements.js';
import { ui } from '../src/config/ui.js';
import { headlessGame } from './helpers/headlessGame.js';
import { featuresOf } from '../src/game/features/index.js';
import { economy } from '../src/config/economy.js';
import { withAttachment } from '../src/weapons/upgrades.js';

function notices() {
  const shown = [], jobs = new Map();
  let next = 0, hidden = 0;
  const board = createAnnouncements({
    show: (m) => shown.push(m), hide: () => hidden++,
    schedule: (fn, ms) => { assert.ok(ms >= ui.announcementSeconds * 1000 && ms <= ui.announcementMaxSeconds * 1000); jobs.set(++next, fn); return next; },
    cancel: (id) => jobs.delete(id),
  });
  return { board, shown, jobs, get hidden() { return hidden; },
    advance() { const [id, fn] = jobs.entries().next().value; jobs.delete(id); fn(); },
  };
}

test('PA queues same-tick messages, suppresses duplicates, and introduces threats ahead of routine copy', () => {
  const n = notices();
  n.board.push({ text: 'Routine' });
  n.board.push({ text: 'Routine' });
  n.board.push({ text: 'Pickup', priority: 1 });
  assert.deepEqual(n.shown.map((m) => m.text), ['Routine', 'Pickup']);
  n.board.push({ text: 'Sale' });
  n.board.push({ text: 'Another sale' });
  n.board.push({ text: 'New threat', priority: 2 });
  assert.equal(n.jobs.size, 1, 'preempted timeout is cancelled');
  n.advance();
  assert.equal(n.shown.at(-1).text, 'Sale');
  n.advance();
  assert.equal(n.shown.at(-1).text, 'Another sale');
  n.advance();
  assert.equal(n.hidden, 1);
});

test('a kept PA message survives a full queue and a preemption; other messages still trim and preempt as before', () => {
  const n = notices();
  n.board.push({ text: 'Showing', priority: 1 });
  for (const text of ['One', 'Two', 'Three']) n.board.push({ text, priority: 1 }); // the queue is full
  n.board.push({ text: 'Line complete', priority: 1, keep: true });
  n.board.push({ text: 'Dropped', priority: 1 }); // an ordinary fourth message is still trimmed
  for (let i = 0; i < 4; i++) n.advance();
  assert.deepEqual(n.shown.map((m) => m.text), ['Showing', 'One', 'Two', 'Three', 'Line complete']);

  // Cut off while it is showing: it comes back once the more important message is done. Its duplicate is still ignored.
  n.board.push({ text: 'Boss intro', priority: 2 });
  n.board.push({ text: 'Line complete', priority: 1, keep: true });
  n.advance();
  assert.deepEqual(n.shown.slice(-2).map((m) => m.text), ['Boss intro', 'Line complete']);
  n.advance();
  assert.equal(n.hidden, 1);

  // An ordinary message that is cut off is not shown again (unchanged).
  n.board.push({ text: 'Routine', priority: 1 });
  n.board.push({ text: 'Threat', priority: 2 });
  n.advance();
  assert.equal(n.shown.at(-1).text, 'Threat');
  assert.equal(n.hidden, 2);

  // Kept messages do not take the ordinary messages' three places either.
  n.board.push({ text: 'Showing again', priority: 1 });
  n.board.push({ text: 'Line opened', priority: 1, keep: true });
  for (const text of ['A', 'B', 'C', 'D']) n.board.push({ text, priority: 1 });
  for (let i = 0; i < 4; i++) n.advance();
  assert.deepEqual(n.shown.slice(-4).map((m) => m.text), ['Line opened', 'A', 'B', 'C']);
  n.advance();
  assert.equal(n.hidden, 3);
});

test('long PA instructions get reading time and the display and queue use the same duration', () => {
  const short = { text: 'Your shift has begun.' };
  const long = { text: 'Important instructions '.repeat(25) };
  assert.equal(announcementSeconds(short), ui.announcementSeconds);
  assert.equal(announcementSeconds(long), ui.announcementMaxSeconds);
  let visibleSeconds, scheduledMs;
  const board = createAnnouncements({ show: (_, seconds) => { visibleSeconds = seconds; }, hide() {},
    schedule: (_, ms) => { scheduledMs = ms; }, cancel() {} });
  board.push(long);
  assert.equal(scheduledMs, visibleSeconds * 1000);
});

test('PA backlog is bounded and reset/death/pause cleanup cancels pending messages', () => {
  const n = notices();
  n.board.push({ text: 'Threat', priority: 2 });
  for (let i = 0; i < 20; i++) n.board.push({ text: `Sale ${i}` });
  for (let i = 0; i < ui.announcementQueueSize + 1; i++) n.advance();
  assert.equal(n.shown.length, ui.announcementQueueSize + 1);
  assert.equal(n.jobs.size, 0);
  n.board.push({ text: 'Old run' }); n.board.push({ text: 'Pending' });
  n.board.clear();
  assert.equal(n.jobs.size, 0);
  n.board.push({ text: 'New run' });
  n.advance();
  assert.equal(n.shown.at(-1).text, 'New run');
});

function shopping() {
  const t = headlessGame();
  t.tick(); t.g.rounds.update = () => {}; t.g.zombies.clear();
  t.g.map.doors.forEach((d) => d.open()); t.tick(120);
  return t;
}

test('real shelf tickets show live shortages, role/refill details and an independent original sale price', () => {
  const t = shopping(), { g } = t;
  const wall = featuresOf(g.map, 'wallBuy').find((f) => f.weapon === 'priceGun');
  const stand = () => t.standAt(wall.position.x + wall.normal.x * 1.3, wall.position.z + wall.normal.z * 1.3,
    Math.atan2(wall.normal.x, wall.normal.z) * 180 / Math.PI);
  g.wallet.points = 250;
  stand();
  let p = g.interactions.prompt;
  assert.equal(p.id, 'priceGun'); assert.equal(p.kind, 'weapon');
  assert.equal(p.shortfall, 250); assert.equal(p.canAfford, false);
  assert.equal(p.detail, ui.weaponRoles.priceGun);
  g.pricing.setDiscount('weapon', .5);
  t.tick(); p = g.interactions.prompt;
  assert.equal(p.cost, 250); assert.equal(p.shortfall, 0); assert.equal(p.canAfford, true);
  assert.equal(g.pricing.basePriceOf(p.kind, p.id), economy.wallBuys.priceGun.weapon);
  t.press('KeyF', 30); t.tick(40);
  g.gun.weapon.magazine--;
  stand(); p = g.interactions.prompt;
  assert.equal(p.kind, 'ammo'); assert.match(p.detail, /magazine and reserve/);
  assert.equal(g.pricing.basePriceOf('ammo', p.id), economy.wallBuys.priceGun.ammo);
});

test('attachment tickets name replacements and tradeoffs; warranty tickets follow each purchased tier', () => {
  const t = shopping(), { g } = t;
  g.wallet.earn(50_000);
  g.gun.setMods('stapleGun', withAttachment(g.gun.def.base, [], 'wristband'));
  const spot = featuresOf(g.map, 'attachmentCounter').find((f) => f.attachment === 'gripTape');
  t.standAt(spot.position.x + spot.normal.x * 1.3, spot.position.z + spot.normal.z * 1.3,
    Math.atan2(spot.normal.x, spot.normal.z) * 180 / Math.PI);
  assert.equal(g.interactions.prompt.title, 'Grip Tape');
  assert.match(g.interactions.prompt.detail, /less recoil/i);
  assert.ok(!/\d/.test(g.interactions.prompt.detail), 'words only: ' + g.interactions.prompt.detail);
  assert.match(g.interactions.prompt.detail, /Replaces Wristband/);
  assert.ok(!g.interactions.prompt.detail.includes(g.gun.def.name), 'compact terms omit redundant weapon name');
  const desk = featuresOf(g.map, 'upgradeDesk')[0];
  t.standAt(desk.position.x, desk.position.z - 1.4, 180);
  assert.match(g.interactions.prompt.detail, /Standard → Deluxe warranty · .*bigger magazine.*Reloads .* faster/);
  assert.ok(!/\d/.test(g.interactions.prompt.detail), 'words only: ' + g.interactions.prompt.detail);
  assert.equal(g.interactions.prompt.title, 'Standard → Deluxe');
  t.press('KeyF', 30);
  assert.match(g.interactions.prompt.detail, /Deluxe → Premium/);
  assert.equal(g.interactions.prompt.title, 'Deluxe → Premium');
  assert.match(g.interactions.prompt.detail, /Ammo not included/);
});

test('original shelf prices validate unknown names and remain unchanged through sale/reset', () => {
  const { g } = headlessGame();
  const base = g.pricing.basePriceOf('tier', 'deluxe');
  g.pricing.setDiscount('tier', .25);
  assert.equal(g.pricing.basePriceOf('tier', 'deluxe'), base);
  assert.ok(g.pricing.priceOf('tier', 'deluxe') < base);
  g.pricing.reset();
  assert.equal(g.pricing.basePriceOf('tier', 'deluxe'), g.pricing.priceOf('tier', 'deluxe'));
  for (const name of ['constructor', '__proto__', 'toString']) assert.throws(() => g.pricing.basePriceOf(name));
});
