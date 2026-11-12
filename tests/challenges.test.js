import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { skins, skinStorage, skinNotices, gunSkin } from '../src/config/skins.js';
import { weapons } from '../src/config/weapons.js';
import { createEvents } from '../src/game/events.js';
import { createSkinSave } from '../src/game/skinSave.js';
import { createChallenges } from '../src/game/challenges.js';
import { headlessGame, snapshot } from './helpers/headlessGame.js';
import { menuDom } from './helpers/menuDom.js';

const staple = skins.stapleGun[0];
const nail = skins.nailGun[0];
const MASTERY = staple.challenge.count; // (a mastery skin's target; phase 8 set it)
const blank = () => ({ version: skinStorage.version, progress: {}, unlocked: {}, equipped: {} });

function memoryStorage(record = null) {
  const values = new Map(record === null ? [] : [[skinStorage.key, record]]);
  let writes = 0;
  return {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes += 1; values.set(key, value); },
    get writes() { return writes; },
    get record() { return JSON.parse(values.get(skinStorage.key) ?? 'null'); },
    replace: value => values.set(skinStorage.key, value),
  };
}

function counters(storage = memoryStorage()) {
  const events = createEvents();
  const state = { assisted: false, over: false };
  const save = createSkinSave({ storage });
  const challenges = createChallenges({ events, state, save });
  const kill = (weaponId = 'stapleGun', extra = {}) => events.emit('kill', { weaponId, zombie: {}, ...extra });
  return { events, state, save, challenges, kill, storage };
}

function realGame(context, storage = memoryStorage()) {
  const save = createSkinSave({ storage });
  const t = headlessGame({ skinSave: save });
  context.after(() => t.g.map.dispose());
  t.g.rounds.update = () => {};
  t.tick();
  return { ...t, save, storage };
}

function shopper(t, health = 1000) {
  const z = t.g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 9));
  z.setState('chasing');
  z.speed = 0;
  z.attackCooldown = 99;
  z.health = health;
  z.updateHitboxes();
  return z;
}

test('all eleven guns have a named mastery challenge; Phase 1 IDs survive the contrast pass', () => {
  assert.deepEqual(Object.keys(skins).sort(), Object.keys(weapons).sort());
  assert.equal(skins.stapleGun[0].id, 'night-shift');
  assert.equal(skins.rivetRifle[0].id, 'carbon-copy');
  assert.equal(skins.stapleGun[0].palette.body, 0x303e74);
  assert.equal(skins.rivetRifle[0].palette.body, 0x353f42);
  for (const [gunId, [skin]] of Object.entries(skins)) {
    assert.equal(skin.slot, 1);
    assert.equal(skin.challenge.kind, 'kills');
    assert.equal(skin.challenge.count, gunId === 'returnToSender' ? 300 : 1000);
    assert.equal(gunSkin(gunId, skin.id), skin);
  }
});

test('kills advance only their gun; melee, hazards, equipment and unknown guns advance none', () => {
  const t = counters();
  t.kill('stapleGun');
  t.kill('nailGun');
  t.kill('nailGun');
  for (const source of ['melee', 'hazard', 'equipment']) t.kill(null, { source });
  t.kill('not-a-gun');
  assert.deepEqual(t.save.snapshot().progress, {
    stapleGun: { 'night-shift': 1 },
    nailGun: { aftermarket: 2, 'rush-order': 2 }, // (and the Nail Gun's feat: its best round so far, 2 kills)
  });
  assert.equal(t.storage.writes, 0);
});

test('the target\'s last kill saves first and emits progress then exactly one unlock with its PA line', () => {
  const t = counters();
  const progress = [], unlocks = [], order = [];
  t.events.on('challengeProgress', event => { progress.push(event); order.push('progress'); });
  t.events.on('skinUnlocked', event => {
    unlocks.push(event);
    order.push('unlock');
    assert.equal(t.storage.record.unlocked.stapleGun['night-shift'], true, 'durable before feedback');
  });
  for (let i = 0; i < MASTERY - 1; i++) t.kill();
  assert.equal(t.storage.writes, 0);
  assert.equal(unlocks.length, 0);
  t.kill();
  assert.deepEqual(order.slice(-2), ['progress', 'unlock']);
  assert.deepEqual(progress.at(-1), { gunId: 'stapleGun', skinId: staple.id, count: MASTERY, needed: MASTERY });
  assert.deepEqual(unlocks, [{
    gunId: 'stapleGun', skinId: staple.id, shared: false, pa: skinNotices.pa(weapons.stapleGun.name, staple.name),
  }]);
  t.kill();
  assert.equal(t.save.progress('stapleGun', staple.id), MASTERY);
  assert.equal(unlocks.length, 1);
  assert.equal(t.storage.writes, 1);
});

test('Return to Sender unlocks on its last eligible kill (its own, smaller target)', () => {
  const t = counters();
  const target = skins.returnToSender[0].challenge.count;
  assert.ok(target < MASTERY);
  for (let i = 0; i < target - 1; i++) t.kill('returnToSender');
  assert.equal(t.save.unlocked('returnToSender', 'final-notice'), false);
  t.kill('returnToSender');
  assert.equal(t.save.unlocked('returnToSender', 'final-notice'), true);
  assert.equal(t.save.progress('stapleGun', staple.id), 0);
});

test('assistance keeps prior earnings, stops later earnings, and still flushes prior progress at runEnd', () => {
  const t = counters();
  t.kill();
  t.state.assisted = true;
  t.kill();
  t.kill('nailGun');
  t.challenges.update(10);
  assert.equal(t.save.progress('stapleGun', staple.id), 1);
  assert.equal(t.save.progress('nailGun', nail.id), 0);
  t.events.emit('runEnd');
  assert.equal(t.storage.record.progress.stapleGun['night-shift'], 1);
  const assisted = counters();
  assisted.state.assisted = true;
  assisted.kill();
  assert.deepEqual(assisted.save.snapshot(), blank());
});

test('post-death and noRewards fan kills earn nothing', () => {
  const t = counters();
  t.kill('stapleGun', { zombie: { noRewards: true } });
  t.state.over = true;
  t.kill();
  assert.deepEqual(t.save.snapshot(), blank());
});

test('a 50-kill run without an unlock writes exactly once, at runEnd', () => {
  const t = counters();
  for (let i = 0; i < 50; i++) t.kill();
  assert.equal(t.storage.writes, 0);
  t.state.over = true;
  t.events.emit('runEnd');
  assert.equal(t.storage.writes, 1);
  assert.equal(t.storage.record.progress.stapleGun['night-shift'], 50);
});

test('a real build burn still advances gun A after switching to B', context => {
  const t = realGame(context), { g } = t;
  g.gun.give(weapons.nailGun);
  t.tick(40);
  g.gun.setMods('nailGun', [{ id: 'build', build: { stuffing: 'fryerOil', heart: 'headshot', quality: 'understuffed' } }]);
  const z = shopper(t);
  t.standAt(0, 12);
  const head = z.hitboxes.find(h => h.part === 'head').box.getCenter(new THREE.Vector3());
  g.player.pitch = Math.atan2(head.y - g.player.eyeHeight, 3);
  t.input.held.add('Mouse2');
  t.tick(30);
  t.press('Mouse0');
  t.input.held.delete('Mouse2');
  assert.ok(z.burn);
  z.health = 1;
  t.press('Digit1');
  assert.equal(g.gun.def.id, 'stapleGun');
  t.tick(35);
  assert.equal(z.isAlive, false);
  assert.equal(t.save.progress('nailGun', nail.id), 1);
  assert.equal(t.save.progress('stapleGun', staple.id), 0);
});

test('progress survives resetRun and a fresh game using the same storage', context => {
  const storage = memoryStorage();
  const t = realGame(context, storage);
  shopper(t).takeHit({ damage: 10000, part: 'body', weaponId: 'stapleGun' });
  t.g.resetRun(); // (Quit to title / Restart run: the run ends without a death, so its progress is written here)
  assert.equal(t.save.progress('stapleGun', staple.id), 1);
  assert.equal(storage.writes, 1);
  t.g.health.takeDamage(10000);
  assert.equal(storage.writes, 1, 'a death with nothing new to save writes nothing');
  const fresh = realGame(context, storage);
  assert.equal(fresh.save.progress('stapleGun', staple.id), 1);
});

test('Play again clears counter state and matches a fresh game with the same permanent record', context => {
  const storage = memoryStorage();
  const t = realGame(context, storage);
  t.g.debug.run('challenge', 'stapleGun', staple.id, 'add', 12);
  t.g.gun.give(weapons.nailGun);
  t.tick(40);
  t.g.health.takeDamage(10000);
  t.g.resetRun();
  const freshSave = createSkinSave({ storage });
  const fresh = headlessGame({ skinSave: freshSave });
  context.after(() => fresh.g.map.dispose());
  assert.deepEqual(t.g.challenges.snapshot(), fresh.g.challenges.snapshot());
  assert.deepEqual(t.g.challenges.snapshot().run, {
    'nailGun/measure-twice': { left: null, shots: 0, clean: true }, 'stapleGun/company-man': { spoiled: false }, 'rivetRifle/gold-standard': { streak: 0 },
    'foamDartBlaster/bullseye': { round: 0 }, 'coilNailer/double-shift': { bosses: 0 }, 'leafBlower/still-air': { round: 0 }, 'priceGun/final-markdown': { round: 0 },
    'balloonLauncher/helium-high': { round: 0 },
  }, 'no magazine in progress, and every feat in progress starts again');
  assert.ok(t.g.resetSteps.includes('challenges'));
  assert.deepEqual(snapshot(t.g), snapshot(fresh.g));
});

test('unlock feedback uses the existing PA listener and one chime in the real game', context => {
  const t = realGame(context);
  t.g.debug.run('challenge', 'stapleGun', staple.id, 'add', MASTERY - 1);
  t.g.resetRun();
  const before = t.sounds.length;
  shopper(t, 1).takeHit({ damage: 10, part: 'body', weaponId: 'stapleGun' });
  assert.deepEqual(t.hud.calls.filter(([name]) => name === 'showAnnouncement').at(-1), [
    'showAnnouncement', { ...skinNotices.pa(weapons.stapleGun.name, staple.name), priority: 1 },
  ]);
  assert.equal(t.sounds.slice(before).filter(name => name === 'paChime').length, 1);
  assert.equal(t.save.unlocked('stapleGun', staple.id), true);
});

test('debug add, complete and clear persist and affect only their challenge', context => {
  const t = realGame(context), { g, save, storage } = t;
  assert.ok(g.debug.keylessIds.includes('challenge'));
  assert.ok(!g.debug.commands.some(command => command.id === 'challenge'));
  g.debug.run('challenge', 'stapleGun', staple.id, 'add', MASTERY - 1);
  assert.equal(g.state.assisted, true);
  assert.equal(save.progress('stapleGun', staple.id), MASTERY - 1);
  assert.equal(storage.record.progress.stapleGun[staple.id], MASTERY - 1);
  g.debug.run('challenge', 'stapleGun', staple.id, 'complete');
  assert.equal(storage.record.unlocked.stapleGun[staple.id], true);
  g.debug.run('challenge', 'nailGun', nail.id, 'add', 7);
  storage.replace(JSON.stringify({ ...storage.record, equipped: { stapleGun: staple.id } }));
  g.debug.run('challenge', 'stapleGun', staple.id, 'clear');
  assert.equal(save.progress('stapleGun', staple.id), 0);
  assert.equal(save.unlocked('stapleGun', staple.id), false);
  assert.equal(storage.record.equipped.stapleGun, undefined);
  assert.equal(storage.record.progress.nailGun[nail.id], 7);
  const before = save.snapshot(), writes = storage.writes;
  for (const amount of [-1, 1.5, NaN, Infinity, '5']) g.debug.run('challenge', 'nailGun', nail.id, 'add', amount);
  g.debug.run('challenge', 'unknown', 'unknown', 'complete');
  assert.deepEqual(save.snapshot(), before);
  assert.equal(storage.writes, writes);
});

test('save recovers from absent, malformed, incomplete and invalid data', () => {
  for (const raw of [null, '{broken', 'null', '[]', '{}', '{"version":1}', '{"version":0}']) {
    const save = createSkinSave({ storage: memoryStorage(raw) });
    assert.deepEqual(save.snapshot(), blank(), String(raw));
    assert.doesNotThrow(() => save.flush());
  }
  const save = createSkinSave({ storage: memoryStorage(JSON.stringify({
    version: skinStorage.version,
    progress: { stapleGun: { good: 12, negative: -4, string: '8', fractional: 2.5 }, invalid: [] },
    unlocked: { stapleGun: { good: true, invalid: 'yes' } },
    equipped: { stapleGun: 'good', invalid: 5 },
  })) });
  assert.equal(save.progress('stapleGun', 'good'), 12);
  for (const id of ['negative', 'string', 'fractional']) assert.equal(save.progress('stapleGun', id), 0);
  assert.deepEqual(save.snapshot().unlocked, { stapleGun: { good: true } });
  assert.deepEqual(save.snapshot().equipped, { stapleGun: 'good' });
});

test('save progress never decreases and unlocks survive subsequent lower records and stale saves', () => {
  const storage = memoryStorage();
  const first = createSkinSave({ storage }), stale = createSkinSave({ storage });
  first.record('stapleGun', staple.id, 400, true);
  first.flush();
  stale.record('stapleGun', staple.id, 7);
  stale.record('nailGun', nail.id, 5);
  stale.flush();
  first.record('stapleGun', staple.id, 3, false);
  first.flush();
  assert.equal(storage.record.progress.stapleGun[staple.id], 400);
  assert.equal(storage.record.unlocked.stapleGun[staple.id], true);
  assert.equal(storage.record.progress.nailGun[nail.id], 5);
  const snapshot = first.snapshot();
  snapshot.progress.stapleGun[staple.id] = 0;
  assert.equal(first.progress('stapleGun', staple.id), 400);
});

test('save preserves equipped choices and entries introduced by other challenge data', () => {
  const record = {
    ...blank(), progress: { futureGun: { futureSkin: 9 } },
    unlocked: { futureGun: { futureSkin: true } }, equipped: { futureGun: 'futureSkin' },
  };
  const storage = memoryStorage(JSON.stringify(record));
  const save = createSkinSave({ storage });
  save.record('stapleGun', staple.id, 5);
  save.flush();
  assert.deepEqual(storage.record.equipped, record.equipped);
  assert.deepEqual(storage.record.progress.futureGun, record.progress.futureGun);
  assert.deepEqual(storage.record.unlocked.futureGun, record.unlocked.futureGun);
});

test('a newer version starts blank and is protected from normal and debug writes', () => {
  const raw = JSON.stringify({ ...blank(), version: skinStorage.version + 1, future: 'keep this exact text' });
  const storage = memoryStorage(raw);
  const t = counters(storage);
  assert.deepEqual(t.save.snapshot(), blank());
  t.kill();
  t.challenges.debug('stapleGun', staple.id, 'complete');
  t.challenges.debug('stapleGun', staple.id, 'clear');
  t.events.emit('runEnd');
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(skinStorage.key), raw);
});

test('a newer save appearing while the game is open is also protected', () => {
  const t = counters();
  t.kill();
  const raw = JSON.stringify({ version: skinStorage.version + 1, future: true });
  t.storage.replace(raw);
  t.events.emit('runEnd');
  t.challenges.debug('stapleGun', staple.id, 'complete');
  assert.equal(t.storage.writes, 0);
  assert.equal(t.storage.getItem(skinStorage.key), raw);
});

test('blocked reads, blocked writes and unavailable storage never stop counting', () => {
  for (const storage of [
    { getItem() { throw new Error('blocked read'); }, setItem() { throw new Error('blocked write'); } },
    { getItem: () => null, setItem() { throw new Error('full'); } },
    null,
  ]) {
    const t = counters(storage);
    for (let i = 0; i < MASTERY; i++) t.kill();
    assert.equal(t.save.unlocked('stapleGun', staple.id), true);
    assert.doesNotThrow(() => t.events.emit('runEnd'));
  }
});

test('debug clear retries safely after a failed write', () => {
  const storage = memoryStorage(JSON.stringify({
    ...blank(), progress: { stapleGun: { [staple.id]: 400 } },
    unlocked: { stapleGun: { [staple.id]: true } },
  }));
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('full'); };
  const t = counters(storage);
  t.challenges.debug('stapleGun', staple.id, 'clear');
  assert.equal(t.save.unlocked('stapleGun', staple.id), false);
  t.kill();
  storage.setItem = write;
  t.events.emit('runEnd');
  assert.equal(storage.record.progress.stapleGun[staple.id], 1);
  assert.equal(storage.record.unlocked.stapleGun?.[staple.id], undefined);
});

test('unlock toast shows the skin and gun, expires, and clears on pause, death and reset', async context => {
  menuDom();
  const { createHud } = await import('../src/ui/hud.js');
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const hud = createHud();
  const events = createEvents();
  hud.connectEvents(events);
  const toast = hud.element.querySelector('.skin-unlock-toast');
  const unlock = () => events.emit('skinUnlocked', { gunId: 'stapleGun', skinId: staple.id, pa: {} });
  assert.equal(toast.hidden, true);
  unlock();
  assert.equal(toast.hidden, false);
  assert.equal(toast.textContent, skinNotices.toastTitle + skinNotices.toastText(weapons.stapleGun.name, staple.name));
  context.mock.timers.tick(skinNotices.toastSeconds * 1000);
  assert.equal(toast.hidden, true);
  for (const clear of [
    () => hud.setDimmed(true),
    () => hud.setDead(true),
    () => events.emit('runReset'),
  ]) {
    unlock();
    assert.equal(toast.hidden, false);
    clear();
    assert.equal(toast.hidden, true);
  }
});

test('a persisted unlock stays unlocked and emits no second unlock in a fresh session', () => {
  const first = counters();
  first.challenges.debug('stapleGun', staple.id, 'complete');
  const fresh = counters(first.storage);
  const unlocks = [];
  fresh.events.on('skinUnlocked', event => unlocks.push(event));
  fresh.kill();
  assert.equal(fresh.save.unlocked('stapleGun', staple.id), true);
  assert.equal(fresh.save.progress('stapleGun', staple.id), MASTERY);
  assert.deepEqual(unlocks, []);
});

test('a throwing global localStorage accessor falls back safely; headless injection stays in memory', context => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, get() { throw new Error('storage disabled'); },
  });
  context.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });
  const save = createSkinSave();
  save.record('stapleGun', staple.id, 1);
  assert.equal(save.progress('stapleGun', staple.id), 1);
  assert.equal(save.flush(), false);
  const t = realGame(context);
  assert.equal(t.g.challenges.snapshot().progress.stapleGun, undefined);
});

// --- Review fixes: Save & Quit must not pay a round twice; a quit run keeps what it earned ---------------------------

test('Save & Quit keeps the kills, and replaying that round pays only what goes beyond them', () => {
  const t = counters();
  for (let i = 0; i < 30; i++) t.kill();
  t.events.emit('runSaved', { round: 3 });
  assert.equal(t.storage.record.progress.stapleGun['night-shift'], 30);
  assert.deepEqual(t.storage.record.replay, { 'stapleGun/night-shift': 30 });

  // Continue, in a new session: the round starts over.
  const again = counters(t.storage);
  again.challenges.reset();
  again.events.emit('runLoaded', { round: 3 });
  for (let i = 0; i < 30; i++) again.kill();
  assert.equal(again.save.progress('stapleGun', staple.id), 30, 'the same 30 kills are not paid twice');
  again.kill('nailGun');
  assert.equal(again.save.progress('nailGun', nail.id), 1, 'a gun that earned nothing before the save is paid at once');
  for (let i = 0; i < 10; i++) again.kill();
  assert.equal(again.save.progress('stapleGun', staple.id), 40);

  // Saving again part-way through the replay still remembers everything this round was paid.
  again.events.emit('runSaved', { round: 3 });
  assert.deepEqual(again.storage.record.replay, { 'stapleGun/night-shift': 40, 'nailGun/aftermarket': 1 });
  const third = counters(again.storage);
  third.events.emit('runLoaded', { round: 3 });
  for (let i = 0; i < 12; i++) third.kill();
  third.events.emit('runSaved', { round: 3 });
  assert.equal(third.storage.record.replay['stapleGun/night-shift'], 40, 'a short attempt does not shrink the record');
  const fourth = counters(third.storage);
  fourth.events.emit('runLoaded', { round: 3 });
  for (let i = 0; i < 45; i++) fourth.kill();
  assert.equal(fourth.save.progress('stapleGun', staple.id), 45);
});

test('the next round, Play again and a run that loaded nothing all start with nothing to replay', () => {
  const t = counters();
  for (let i = 0; i < 20; i++) t.kill();
  t.events.emit('runSaved', { round: 2 });

  const resumed = counters(t.storage);
  resumed.events.emit('runLoaded', { round: 2 });
  for (let i = 0; i < 20; i++) resumed.kill();
  resumed.events.emit('roundStart', { round: 3 });
  for (let i = 0; i < 5; i++) resumed.kill();
  assert.equal(resumed.save.progress('stapleGun', staple.id), 25, 'round 3 is new ground');

  const fresh = counters(t.storage); // the save was discarded: Play from the title, no 'runLoaded'
  for (let i = 0; i < 5; i++) fresh.kill();
  assert.equal(fresh.save.progress('stapleGun', staple.id), 25);

  const replaying = counters(t.storage);
  replaying.events.emit('runLoaded', { round: 2 });
  replaying.challenges.reset(); // Play again in the middle of the replay
  for (let i = 0; i < 3; i++) replaying.kill();
  assert.equal(replaying.save.progress('stapleGun', staple.id), 23);
});

test('an unlock earned before a Save & Quit stays, and its replay neither fires again nor counts', () => {
  const t = counters(memoryStorage(JSON.stringify({ ...blank(), progress: { stapleGun: { [staple.id]: staple.challenge.count - 2 } } })));
  const unlocks = [];
  t.events.on('skinUnlocked', event => unlocks.push(event.skinId));
  t.kill(); t.kill(); t.kill();
  t.events.emit('runSaved', { round: 9 });
  assert.deepEqual(unlocks, [staple.id]);
  const again = counters(t.storage);
  again.events.on('skinUnlocked', event => unlocks.push(event.skinId));
  again.events.emit('runLoaded', { round: 9 });
  for (let i = 0; i < 5; i++) again.kill();
  assert.deepEqual(unlocks, [staple.id]);
  assert.equal(again.save.unlocked('stapleGun', staple.id), true);
});

test('the real game: 30 kills, Save & Quit, Continue and the same 30 again is 30, in a run that also says 30', context => {
  const storage = memoryStorage();
  const slot = new Map();
  const saveStorage = { getItem: key => slot.get(key) ?? null, setItem: (key, value) => slot.set(key, value), removeItem: key => slot.delete(key) };
  const save = createSkinSave({ storage });
  const t = headlessGame({ skinSave: save, saveStorage });
  context.after(() => t.g.map.dispose());
  const { g } = t;
  t.tick();
  for (let i = 0; i < 4000 && g.rounds.state !== 'active'; i++) t.tick();
  const kill = () => {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(3, 0, 12));
    z.takeHit({ damage: z.health + 1, part: 'body', weaponId: 'stapleGun' });
  };
  for (let i = 0; i < 30; i++) kill();
  assert.equal(save.progress('stapleGun', staple.id), 30);
  assert.equal(g.saveGame.saveAndQuit(), true);
  g.resetRun(); // (main.js goes to the title)
  assert.equal(g.saveGame.load(), true);
  assert.equal(g.runStats.kills, 0, 'the round starts over');
  for (let i = 0; i < 30; i++) kill();
  assert.equal(save.progress('stapleGun', staple.id), 30);
  for (let i = 0; i < 5; i++) kill();
  assert.equal(save.progress('stapleGun', staple.id), 35);
  assert.equal(g.runStats.kills, 35);
  assert.equal(storage.record.progress.stapleGun[staple.id], 30, 'nothing is written per kill');
});

test('Quit to title and Restart run write what the run earned, once, and nothing when there is nothing new', () => {
  const t = counters();
  t.events.emit('runReset');
  assert.equal(t.storage.writes, 0, 'an untouched run writes nothing');
  for (let i = 0; i < 40; i++) t.kill();
  assert.equal(t.save.dirty, true);
  t.events.emit('runReset');
  assert.equal(t.storage.writes, 1);
  assert.equal(t.storage.record.progress.stapleGun[staple.id], 40);
  assert.equal(createSkinSave({ storage: t.storage }).progress('stapleGun', staple.id), 40, 'a new session sees it');
  t.events.emit('runReset');
  assert.equal(t.challenges.flush(), false);
  assert.equal(t.storage.writes, 1);

  // A death already wrote it: the Play again that follows adds no second write.
  const died = counters();
  for (let i = 0; i < 5; i++) died.kill();
  died.events.emit('runEnd');
  died.events.emit('runReset');
  assert.equal(died.storage.writes, 1);

  // The page closing mid-run (main.js calls flush on 'pagehide').
  const closing = counters();
  for (let i = 0; i < 7; i++) closing.kill();
  assert.equal(closing.challenges.flush(), true);
  assert.equal(closing.storage.record.progress.stapleGun[staple.id], 7);
  assert.equal(closing.storage.record.replay, undefined, 'only Save & Quit records a round to replay');
});

test('the real game: 40 kills then Quit to title reach storage without a death', context => {
  const t = realGame(context);
  for (let i = 0; i < 40; i++) shopper(t, 1).takeHit({ damage: 5, part: 'body', weaponId: 'stapleGun' });
  assert.equal(t.storage.writes, 0);
  t.g.resetRun();
  assert.equal(t.storage.record.progress.stapleGun[staple.id], 40);
});
