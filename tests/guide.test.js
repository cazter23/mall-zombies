// The Staff Survival Guide: its pages (config/guide.js), its permanent record (game/guideSave.js) and its counters
// (game/guide.js). The screen is in tests/guideScreen.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { guideEntries, guideSections, guideEntry, guideEntryId, guideStage, guideStorage, guideNotices, guideDebug, incentiveEntries, incentiveEntry } from '../src/config/guide.js';
import { zombieTypes, mascotTypes, mascotGoldTypes } from '../src/config/zombies.js';
import { bossTypes } from '../src/config/bosses.js';
import { economy } from '../src/config/economy.js';
import { createEvents } from '../src/game/events.js';
import { createGuideSave } from '../src/game/guideSave.js';
import { createGuide } from '../src/game/guide.js';
import { headlessGame } from './helpers/headlessGame.js';

const walker = guideEntry('mallWalker');

function memoryStorage(record = null) {
  const values = new Map(record === null ? [] : [[guideStorage.key, typeof record === 'string' ? record : JSON.stringify(record)]]);
  let writes = 0;
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { writes += 1; values.set(key, value); },
    get writes() { return writes; },
    get record() { return JSON.parse(values.get(guideStorage.key) ?? 'null'); },
  };
}
const stored = (data) => ({ version: guideStorage.version, seen: {}, kills: {}, found: {}, discovered: {}, ...data });

function counters(storage = memoryStorage()) {
  const events = createEvents();
  const state = { assisted: false, over: false };
  const save = createGuideSave({ storage });
  const guide = createGuide({ events, state, save });
  const announced = [];
  events.on('guideEntry', (event) => announced.push(event));
  const kill = (type = zombieTypes.mallWalker, extra = {}) => events.emit('kill', { zombie: { type, ...extra } });
  const page = (id) => guide.pages().find(({ entry }) => entry.id === id);
  return { events, state, save, guide, kill, page, storage, announced };
}

// --- The book ---------------------------------------------------------------------------------------------------------

test('every zombie type, Mascot costume and boss has exactly one page, and a zombie finds its own', () => {
  const ids = guideEntries.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const [id, type] of Object.entries(zombieTypes)) if (id !== 'mascot') assert.equal(guideEntryId(type), id);
  for (const [variant, type] of Object.entries(mascotTypes)) assert.equal(guideEntryId(type), variant, 'a Mascot is filed by its costume');
  for (const type of Object.values(mascotGoldTypes)) assert.equal(guideEntryId(type), 'employeeOfTheMonth', 'gold has one page, whatever the costume');
  for (const [id, type] of Object.entries(bossTypes)) assert.equal(guideEntryId(type), id);
  assert.equal(ids.length, 4 + Object.keys(mascotTypes).length + 1 + Object.keys(bossTypes).length, 'and nothing else is in the book');
  assert.equal(guideEntryId({ id: 'santa' }), null);
  assert.equal(guideEntryId(null), null);
  for (const entry of guideEntries) {
    assert.equal(guideEntryId(entry.type), entry.id, entry.id + ': the model shown is the subject itself');
    assert.ok(guideSections.some((section) => section.id === entry.section));
    assert.equal(entry.section === 'management', !!entry.type.boss);
  }
});

test('every page has a memo, notes and a tip with no hole in the text, and thresholds in order', () => {
  for (const entry of guideEntries) {
    const text = [entry.name, entry.title, entry.firstSeen, entry.memo, ...entry.notes, entry.tip].join(' | ');
    assert.doesNotMatch(text, /undefined|NaN|null|\[object/, entry.id);
    assert.ok(entry.memo.length > 20 && entry.tip.length > 20 && entry.notes.length >= 2, entry.id);
    assert.ok(Number.isInteger(entry.notesAt) && entry.notesAt >= 1 && entry.tipAt > entry.notesAt, entry.id);
    assert.ok(entry.health > 0, entry.id);
  }
});

test('the facts a page quotes are the config\'s own', () => {
  const mix = economy.zombieMix;
  assert.equal(guideEntry('shopper').health, 1);
  for (const id of ['mallWalker', 'cartPusher', 'mannequin']) {
    assert.equal(guideEntry(id).health, mix[id].healthMultiplier);
    assert.equal(guideEntry(id).firstSeen, 'Round ' + mix[id].fromRound);
  }
  assert.equal(guideEntry('scoops').health, mix.mascot.healthMultiplier);
  assert.ok(guideEntry('employeeOfTheMonth').health > mix.mascot.healthMultiplier);
  for (const [id, type] of Object.entries(bossTypes)) {
    assert.equal(guideEntry(id).health, type.healthMultiplier);
    assert.equal(guideEntry(id).name, type.name);
    for (const round of type.firstRounds ?? []) assert.ok(guideEntry(id).firstSeen.includes(String(round)));
    if (!type.firstRounds) assert.equal(guideEntry(id).firstSeen, 'Closing Time', 'a boss off the rota is booked by the checklist');
  }
  assert.ok(guideEntry('mallWalker').notes.join(' ').includes(String(zombieTypes.mallWalker.winded.standSeconds)));
  assert.ok(guideEntry('guard').tip.startsWith(String(bossTypes.guard.lockdown.headshots)));
  assert.doesNotMatch(guideEntry('shopper').tip, /every gun/i);
  assert.ok(guideEntry('sirWaffles').notes[0].includes(`RUNS at ${zombieTypes.mascot.mascot.exposedSpeed} m/s`));
  assert.ok(!guideEntry('captainCoupon').notes[0].includes('then it RUNS'));
  assert.ok(guideEntry('captainCoupon').notes[0].includes('goes back for it'));
  assert.ok(guideEntry('influencer').notes[0].includes(`${bossTypes.influencer.filming.relocateSeconds} seconds`));
  assert.doesNotMatch(guideEntry('influencer').notes[0], /moves when I close in/i);
  assert.doesNotMatch(guideEntry('lastCustomer').notes[0], /once the closing checklist is done/i);
  assert.match(guideEntry('lastCustomer').notes[0], /validate parking/i);
  assert.doesNotMatch(incentiveEntry('stockroomDelivery').summary, /half of every/i);
  assert.match(incentiveEntry('stockroomDelivery').summary, /reserve.*magazine in your hand/i);
  assert.match(incentiveEntry('storeWideClearance').summary, /bosses there/i);
});

test('a page goes from unseen to memo to notes to tip; only the Shopper starts open', () => {
  assert.equal(guideStage(walker, { seen: false, kills: 0 }), 0);
  assert.equal(guideStage(walker, { seen: true, kills: 0 }), 1);
  assert.equal(guideStage(walker, { seen: false, kills: 1 }), 1, 'a kill is a sighting');
  assert.equal(guideStage(walker, { seen: true, kills: walker.notesAt - 1 }), 1);
  assert.equal(guideStage(walker, { seen: true, kills: walker.notesAt }), 2);
  assert.equal(guideStage(walker, { seen: true, kills: walker.tipAt }), 3);
  assert.deepEqual(guideEntries.filter((entry) => entry.alwaysSeen).map((entry) => entry.id), ['shopper']);
  assert.equal(guideStage(guideEntry('shopper'), { seen: false, kills: 0 }), 1);
});

// --- The record -------------------------------------------------------------------------------------------------------

test('the record starts blank from missing, corrupt, old or junk storage and keeps only real pages', () => {
  for (const raw of [null, '{not json', JSON.stringify({ version: 0, kills: { shopper: 9 } }), JSON.stringify([1, 2])]) {
    const save = createGuideSave({ storage: memoryStorage(raw) });
    assert.equal(save.kills('shopper'), 0);
    assert.equal(save.dirty, false);
  }
  const save = createGuideSave({ storage: memoryStorage(stored({
    kills: { shopper: 12, santa: 4, mallWalker: -3, cartPusher: 2.5, __proto__: 7 },
    seen: { janitor: true, guard: 'yes', santa: true },
    replay: { shopper: 3, santa: 1 },
  })) });
  assert.deepEqual(save.snapshot(), stored({ kills: { shopper: 12 }, seen: { janitor: true }, replay: { shopper: 3 } }));
  assert.equal(createGuideSave({ storage: null }).flush(), false, 'no storage: memory only');
});

test('counting changes memory only; a flush writes once, merges another tab and never touches a newer record', () => {
  const storage = memoryStorage();
  const save = createGuideSave({ storage });
  assert.equal(save.add('shopper', 3), 3);
  assert.equal(save.see('janitor'), true);
  assert.equal(save.see('janitor'), false);
  assert.equal(save.add('santa', 5), 0);
  assert.equal(storage.writes, 0);
  assert.equal(save.dirty, true);
  // Another tab wrote in the meantime.
  storage.setItem(guideStorage.key, JSON.stringify(stored({ kills: { shopper: 2, mannequin: 6 }, seen: { guard: true } })));
  assert.equal(save.flush(), true);
  assert.equal(save.dirty, false);
  assert.deepEqual(storage.record, stored({ kills: { shopper: 3, mannequin: 6 }, seen: { janitor: true, guard: true } }));

  const newer = memoryStorage({ version: guideStorage.version + 1, kills: { shopper: 999 } });
  const old = createGuideSave({ storage: newer });
  old.add('shopper', 1);
  assert.equal(old.flush(), false);
  assert.equal(newer.record.kills.shopper, 999);
  assert.equal(newer.writes, 0);
});

// --- The counters -----------------------------------------------------------------------------------------------------

test('a first sighting opens the page without a PA line; the kills that fill it in announce themselves', () => {
  const t = counters();
  assert.equal(t.page('mallWalker').stage, 0);
  assert.equal(t.page('shopper').stage, 1);
  t.events.emit('typeIntro', { typeId: 'mallWalker', zombie: { type: zombieTypes.mallWalker } });
  assert.deepEqual(t.announced, [{ entryId: 'mallWalker', stage: 1 }]);
  assert.equal(t.storage.writes, 1, 'a new page is written at once');
  t.events.emit('typeIntro', { typeId: 'mallWalker', zombie: { type: zombieTypes.mallWalker } });
  assert.equal(t.announced.length, 1);

  for (let i = 0; i < walker.notesAt - 1; i++) t.kill();
  assert.equal(t.announced.length, 1);
  assert.equal(t.storage.writes, 1, 'never a write per kill');
  t.kill();
  assert.deepEqual(t.announced[1], { entryId: 'mallWalker', stage: 2, pa: guideNotices.pa('Mall Walker', 2) });
  assert.equal(t.storage.writes, 2);
  assert.equal(t.storage.record.kills.mallWalker, walker.notesAt);
  for (let i = walker.notesAt; i < walker.tipAt; i++) t.kill();
  assert.deepEqual(t.announced[2], { entryId: 'mallWalker', stage: 3, pa: guideNotices.pa('Mall Walker', 3) });
  t.kill();
  assert.equal(t.announced.length, 3, 'a complete page says nothing more');
  assert.equal(t.page('mallWalker').kills, walker.tipAt + 1, 'but it keeps counting');
});

test('each costume, the gold Mascot and each boss fill their own page from their own events', () => {
  const t = counters();
  t.events.emit('mascotVariantIntro', { variant: 'scoops', zombie: { type: mascotTypes.scoops } });
  t.events.emit('mascotGold', { zombie: { type: mascotGoldTypes.poppyCorn } });
  t.events.emit('bossSpawn', { zombie: { type: bossTypes.guard }, round: 9 });
  assert.deepEqual(t.announced.map((event) => event.entryId), ['scoops', 'employeeOfTheMonth', 'guard']);
  assert.equal(t.page('poppyCorn').stage, 0, 'a gold Poppy is not a sighting of Poppy');
  t.kill(mascotTypes.captainCoupon);
  assert.equal(t.page('captainCoupon').kills, 1);
  assert.equal(t.page('sirWaffles').kills, 0);
  t.kill(bossTypes.guard);
  assert.equal(t.page('guard').stage, 2, 'one boss kill is its field notes');
  t.kill({ id: 'santa' });
  t.events.emit('kill', {});
});

test('fans, assisted runs and anything after death count for nothing', () => {
  const t = counters();
  t.kill(zombieTypes.mallWalker, { noRewards: true });
  t.state.assisted = true;
  t.kill();
  t.events.emit('bossSpawn', { zombie: { type: bossTypes.janitor } });
  t.state.assisted = false; t.state.over = true;
  t.kill();
  assert.equal(t.page('mallWalker').stage, 0);
  assert.equal(t.page('janitor').stage, 0);
  assert.equal(t.save.dirty, false);
  t.events.emit('runEnd');
  assert.equal(t.storage.writes, 0);
});

test('a round replayed after Save & Quit is counted once, and a quit run keeps what it counted', () => {
  const t = counters();
  for (let i = 0; i < 20; i++) t.kill(zombieTypes.shopper);
  t.events.emit('runSaved', { round: 3 });
  assert.equal(t.storage.record.kills.shopper, 20);
  assert.deepEqual(t.storage.record.replay, { shopper: 20 });

  const again = counters(t.storage); // Continue, in a new session: the round starts over
  again.guide.reset();
  again.events.emit('runLoaded', { round: 3 });
  for (let i = 0; i < 20; i++) again.kill(zombieTypes.shopper);
  assert.equal(again.page('shopper').kills, 20, 'the same 20 are not counted twice');
  again.kill(zombieTypes.mallWalker);
  assert.equal(again.page('mallWalker').kills, 1);
  for (let i = 0; i < 5; i++) again.kill(zombieTypes.shopper);
  assert.equal(again.page('shopper').kills, 25);
  again.events.emit('roundStart', { round: 4 });
  again.kill(zombieTypes.shopper);
  assert.equal(again.page('shopper').kills, 26, 'the next round is new ground');

  const fresh = counters(t.storage); // the save was discarded: Play from the title, no 'runLoaded'
  fresh.kill(zombieTypes.shopper);
  assert.equal(fresh.page('shopper').kills, 21);

  // Quit to title / Restart run: no death, so 'runReset' writes; nothing new writes nothing.
  const quit = counters();
  quit.events.emit('runReset');
  assert.equal(quit.storage.writes, 0);
  for (let i = 0; i < 7; i++) quit.kill(zombieTypes.shopper);
  quit.events.emit('runReset');
  assert.equal(quit.storage.record.kills.shopper, 7);
  assert.equal(quit.storage.writes, 1);
  quit.events.emit('runEnd');
  assert.equal(quit.guide.flush(), false);
  assert.equal(quit.storage.writes, 1);
  assert.equal(quit.storage.record.replay, undefined, 'only Save & Quit records a round to replay');
});

test('the developer shortcut sees, adds to, completes and clears a page', () => {
  const t = counters();
  assert.equal(t.guide.debug('santa', 'see'), guideDebug.unknown);
  assert.equal(t.guide.debug('janitor', 'dance'), guideDebug.usage);
  assert.equal(t.guide.debug('janitor', 'add', 0), guideDebug.invalidAmount);
  t.guide.debug('janitor', 'see');
  assert.equal(t.page('janitor').stage, 1);
  t.guide.debug('janitor', 'add', 1);
  assert.equal(t.page('janitor').stage, 2);
  t.guide.debug('manager', 'complete');
  assert.equal(t.page('manager').stage, 3);
  assert.equal(t.storage.record.kills.manager, guideEntry('manager').tipAt);
  t.guide.debug('manager', 'clear');
  assert.equal(t.page('manager').stage, 0);
  assert.equal(t.storage.record.kills.manager, undefined);
  assert.equal(createGuideSave({ storage: t.storage }).seen('manager'), false);
});

// --- In the real game -------------------------------------------------------------------------------------------------

test('the real game: kills of each kind land on their pages, a boss walking in is a sighting, and a quit writes', (context) => {
  const storage = memoryStorage();
  const save = createGuideSave({ storage });
  const t = headlessGame({ guideSave: save });
  context.after(() => t.g.map.dispose());
  const { g } = t;
  g.rounds.update = () => {};
  t.tick();
  const page = (id) => g.guide.pages().find(({ entry }) => entry.id === id);
  const at = new THREE.Vector3(0, 0, 9);
  const kill = (z) => z.takeHit({ damage: z.health + 1, part: 'body', weaponId: 'stapleGun' });

  kill(g.zombies.spawn('shopper', at));
  kill(g.zombies.spawn('mallWalker', at));
  kill(g.zombies.spawn('mascot', at, { variant: 'scoops', gold: false }));
  kill(g.zombies.spawn('mascot', at, { variant: 'sirWaffles', gold: true }));
  assert.equal(page('shopper').kills, 1);
  assert.equal(page('mallWalker').kills, 1);
  assert.equal(page('scoops').kills, 1);
  assert.equal(page('employeeOfTheMonth').kills, 1);
  assert.equal(page('sirWaffles').stage, 0, 'the gold one was not Sir Waffles\'s kill');

  const murray = g.bosses.summon('janitor');
  assert.ok(murray);
  assert.equal(page('janitor').stage, 1, 'seen on arrival');
  const paBefore = t.hud.calls.filter(([name, arg]) => name === 'showAnnouncement' && arg?.kicker === guideNotices.pa('', 2).kicker).length;
  kill(murray);
  assert.equal(page('janitor').stage, 2);
  const paAfter = t.hud.calls.filter(([name, arg]) => name === 'showAnnouncement' && arg?.kicker === guideNotices.pa('', 2).kicker).length;
  assert.equal(paAfter, paBefore + 1, 'the PA says the book has a new paragraph');

  g.resetRun(); // Quit to title
  assert.equal(storage.record.kills.shopper, 1);
  assert.equal(storage.record.seen.janitor, true);

  // An assisted run adds nothing.
  g.state.assisted = true;
  kill(g.zombies.spawn('shopper', at));
  assert.equal(page('shopper').kills, 1);
});

test('incentive discoveries unlock once on actual pickup, ignore drops/expiry/assisted/dead/vouchers, and persist across resetRun and save/load', (context) => {
  const storage = memoryStorage();
  const discoveredEvents = [];
  const t = counters(storage);
  t.events.on('incentiveDiscovered', (e) => discoveredEvents.push(e));

  assert.equal(t.guide.incentives().found, 0);
  assert.equal(t.guide.incentives().total, incentiveEntries.length);

  // Drop, expire, assisted, dead, and boss vouchers must NOT unlock any incentive entry.
  t.events.emit('powerUpDrop', { id: 'shiftBonus', position: new THREE.Vector3(), seconds: 15 });
  t.events.emit('powerUpExpire', { id: 'shiftBonus', pointsInstead: 0 });
  t.events.emit('powerUpCollect', { id: 'masterKey', name: 'MASTER KEY' });
  t.state.assisted = true;
  t.events.emit('powerUpCollect', { id: 'shiftBonus', name: 'SHIFT BONUS' });
  t.state.assisted = false;
  t.state.over = true;
  t.events.emit('powerUpCollect', { id: 'shiftBonus', name: 'SHIFT BONUS' });
  t.state.over = false;
  assert.equal(t.guide.incentives().found, 0);
  assert.equal(discoveredEvents.length, 0);
  assert.equal(storage.writes, 0);

  // Actual first pickup unlocks, flushes at once, emits 'incentiveDiscovered' once, and ignores repeat pickups.
  t.events.emit('powerUpCollect', { id: 'shiftBonus', name: 'SHIFT BONUS' });
  assert.equal(t.guide.incentives().found, 1);
  assert.equal(t.save.discovered('shiftBonus'), true);
  assert.equal(storage.writes, 1);
  assert.deepEqual(discoveredEvents, [{
    id: 'shiftBonus',
    name: incentiveEntry('shiftBonus').name,
    icon: incentiveEntry('shiftBonus').icon,
    tier: incentiveEntry('shiftBonus').tier,
    found: 1,
    total: incentiveEntries.length,
  }]);
  t.events.emit('powerUpCollect', { id: 'shiftBonus', name: 'SHIFT BONUS' });
  assert.equal(discoveredEvents.length, 1);
  assert.equal(storage.writes, 1);

  // Unknown ids from storage are dropped, and another tab flush merges discoveries.
  storage.setItem(guideStorage.key, JSON.stringify(stored({ discovered: { shiftBonus: true, commissionDay: true, bogon: true } })));
  t.save.discover('paidBreak');
  t.save.flush();
  assert.deepEqual(storage.record.discovered, { shiftBonus: true, paidBreak: true, commissionDay: true });

  // Headless full game: actual pickup persists across resetRun and a fresh game using the same guideSave.
  const gameStorage = memoryStorage();
  const sharedSave = createGuideSave({ storage: gameStorage });
  const gameA = headlessGame({ guideSave: sharedSave });
  context.after(() => gameA.g.map.dispose());
  gameA.g.events.emit('powerUpCollect', { id: 'blackFriday', name: 'BLACK FRIDAY' });
  assert.equal(sharedSave.discovered('blackFriday'), true);
  gameA.g.resetRun();
  assert.equal(sharedSave.discovered('blackFriday'), true);
  assert.equal(createGuideSave({ storage: gameStorage }).discovered('blackFriday'), true);

  // Debug helper can clear/discover all or one cleanly.
  t.guide.debugIncentive('paidBreak', 'clear');
  assert.equal(t.save.discovered('paidBreak'), false);
  t.guide.debugIncentive('all', 'discover');
  assert.equal(t.guide.incentives().complete, true);
});
