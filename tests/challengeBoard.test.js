// The Challenges board (title screen), the pins (up to three, their own storage) and the challenge tracker (pinned challenges under the round
// counter, off by default, shown when one moves; a lost feat attempt struck through, then dropped until the next attempt).
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/headlessGame.js'; // (first: it stubs the browser globals settings.js reads)
import { menuDom } from './helpers/menuDom.js';
import { challengeBoard as cfg } from '../src/config/challengeBoard.js';
import { skins, challengeText, locker as lockerWords } from '../src/config/skins.js';
import { weapons } from '../src/config/weapons.js';
import { settingDefs } from '../src/config/settings.js';
import { createEvents } from '../src/game/events.js';
import { createSkinSave } from '../src/game/skinSave.js';
import { createChallenges } from '../src/game/challenges.js';
import { createChallengePins } from '../src/game/challengePins.js';
import { challengeCatalog, catalogEntry, skinPinId } from '../src/game/challengeCatalog.js';
import { createChallengeBoard } from '../src/ui/challengeBoard.js';
import { createChallengeTracker, connectChallengeTracker } from '../src/ui/challengeTracker.js';

menuDom();
const { createScreens } = await import('../src/ui/screens.js');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  return {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes += 1; values.set(key, value); },
    get writes() { return writes; },
    read: key => JSON.parse(values.get(key) ?? 'null'),
  };
}

test('pins: up to maxPins in pin order, toggled off again, written each time; a full board refuses; a newer version is left alone', () => {
  const storage = memoryStorage();
  const pins = createChallengePins({ storage });
  assert.deepEqual(pins.ids, []);
  const ids = ['skin:stapleGun/night-shift', 'skin:nailGun/rush-order', 'skin:rivetRifle/gold-standard', 'skin:priceGun/red-tag'];
  assert.equal(cfg.maxPins, 3);
  assert.equal(pins.toggle(ids[0]), true);
  assert.equal(pins.toggle(ids[1]), true);
  assert.equal(pins.toggle(ids[2]), true);
  assert.equal(pins.full, true);
  assert.equal(pins.toggle(ids[3]), null, 'full: nothing changes');
  assert.deepEqual(pins.ids, ids.slice(0, 3));
  assert.equal(pins.toggle(ids[1]), false);
  assert.deepEqual(storage.read(cfg.storage.key), { version: cfg.storage.version, pins: [ids[0], ids[2]] });
  assert.equal(storage.writes, 4);
  assert.deepEqual(createChallengePins({ storage }).ids, [ids[0], ids[2]], 'read back');

  const newer = memoryStorage({ [cfg.storage.key]: JSON.stringify({ version: cfg.storage.version + 1, pins: ['x'] }) });
  const kept = createChallengePins({ storage: newer });
  assert.deepEqual(kept.ids, []);
  kept.toggle(ids[0]);
  assert.equal(newer.writes, 0, 'a newer save is never overwritten');
  assert.deepEqual(createChallengePins({ storage: { getItem() { throw new Error('blocked'); } } }).ids, [], 'a blocked store: memory only');
});

test('the catalogue lists every weapon skin challenge under one category, by gun, with its sentence, tag and progress', () => {
  const [category] = challengeCatalog();
  assert.equal(category.label, cfg.categories.skins);
  assert.deepEqual(category.groups.map(group => group.id), Object.keys(skins));
  const save = createSkinSave({ storage: memoryStorage() });
  save.record('rivetRifle', 'gold-standard', 12);
  save.record('stapleGun', 'night-shift', 40);
  for (const group of category.groups) {
    assert.equal(group.label, weapons[group.id].name);
    assert.deepEqual(group.entries.map(entry => entry.skinId), skins[group.id].map(skin => skin.id));
    for (const entry of group.entries) {
      const skin = skins[group.id].find(s => s.id === entry.skinId);
      assert.equal(entry.id, skinPinId(group.id, skin.id));
      assert.equal(entry.text, challengeText(skin.challenge, weapons[group.id].name));
      assert.equal(entry.tag, cfg.slotTags[skin.slot]);
      assert.equal(catalogEntry(entry.id), entry);
    }
  }
  assert.equal(catalogEntry('skin:rivetRifle/gold-standard').progress({ save }), lockerWords.featProgress(12, 20));
  assert.equal(catalogEntry('skin:stapleGun/night-shift').progress({ save }), '40 / 400');
  assert.equal(catalogEntry('skin:nope/nothing'), null);
});

test('a tracker line: a running total from the save, a feat from the attempt in progress in its own words, Done once earned', () => {
  const events = createEvents();
  const save = createSkinSave({ storage: memoryStorage() });
  const challenges = createChallenges({ events, state: { assisted: false, over: false }, save });
  const streak = catalogEntry('skin:rivetRifle/gold-standard');
  assert.deepEqual(streak.track({ save, challenges }), { id: streak.id, title: cfg.tracker.title('Gold Standard', 'Rivet Rifle'), value: '0 / 20 in a row', done: false });
  for (let i = 0; i < 7; i++) events.emit('kill', { weaponId: 'rivetRifle', headshot: true, zombie: {} });
  assert.equal(streak.track({ save, challenges }).value, '7 / 20 in a row');
  assert.equal(catalogEntry('skin:barcodeScanner/clean-scan').track({ save, challenges }).value, '0 / 25 shots, no misses');
  save.record('stapleGun', 'night-shift', 40);
  assert.equal(catalogEntry('skin:stapleGun/night-shift').track({ save, challenges }).value, '40 / 400');
  save.record('stapleGun', 'night-shift', 400, true);
  assert.deepEqual(catalogEntry('skin:stapleGun/night-shift').track({ save, challenges }).value, cfg.done);
});

function board({ trackerOn = false } = {}) {
  const dom = menuDom();
  const save = createSkinSave({ storage: memoryStorage() });
  save.record('nailGun', 'rush-order', 31);
  const pins = createChallengePins({ storage: memoryStorage() });
  let tracker = trackerOn;
  const challengesBook = createChallengeBoard({ save, pins, onBack: () => screens.show('title'), trackerEnabled: () => tracker });
  const screens = createScreens({ challenges: challengesBook });
  screens.on('challenges', () => screens.show('challenges'));
  screens.show('title');
  document.querySelector('[data-action="challenges"]').click();
  return { ...dom, save, pins, screens, book: challengesBook, setTracker: on => { tracker = on; },
    group: id => challengesBook.element.querySelector(`[data-group="${id}"]`),
    row: id => challengesBook.element.querySelector(`[data-challenge="${id}"]`),
    pad: code => screens.padNav({ consumePress: key => key === code }) };
}

test('the board opens from the title, lists a gun\'s three challenges with progress, pins and unpins, and refuses a fourth pin', () => {
  const t = board();
  assert.equal(t.screens.current, 'challenges');
  assert.equal(t.screens.showsFlyover, true);
  t.group('nailGun').click();
  const rows = t.book.element.querySelectorAll('.challenge-row');
  assert.deepEqual(rows.map(row => row.dataset.challenge), skins.nailGun.map(skin => skinPinId('nailGun', skin.id)));
  const feat = t.row('skin:nailGun/rush-order');
  assert.ok(feat.textContent.includes('Clear 40 zombies with the Nail Gun in one round.'));
  assert.ok(feat.textContent.includes(lockerWords.featProgress(31, 40)));
  assert.ok(feat.textContent.includes(cfg.slotTags[3]));
  assert.ok(t.book.element.querySelector('.challenge-pins').textContent.includes(cfg.pinCount(0, 3)));

  feat.click();
  assert.deepEqual(t.pins.ids, ['skin:nailGun/rush-order']);
  assert.equal(t.row('skin:nailGun/rush-order').getAttribute('aria-pressed'), 'true');
  assert.ok(t.book.element.querySelector('.challenge-pins').textContent.includes(cfg.pinCount(1, 3)));
  t.row('skin:nailGun/aftermarket').click();
  t.row('skin:nailGun/measure-twice').click();
  t.group('stapleGun').click();
  t.row('skin:stapleGun/night-shift').click();
  assert.equal(t.pins.ids.length, 3, 'the fourth is refused');
  assert.equal(t.book.element.querySelector('.challenge-pins').textContent, cfg.full(3));
  t.group('nailGun').click();
  t.row('skin:nailGun/aftermarket').click();
  assert.deepEqual(t.pins.ids, ['skin:nailGun/rush-order', 'skin:nailGun/measure-twice'], 'unpinned');
  t.pad('PadB');
  assert.equal(t.screens.current, 'title');
});

test('the board says the tracker is off (the default) and stops saying so once it is on', () => {
  const def = settingDefs.find(entry => entry.id === 'challengeTracker');
  assert.equal(def.tab, 'Comfort');
  assert.equal(def.type, 'toggle');
  assert.equal(def.default, false, 'off unless the player turns it on');
  let enabled = null;
  def.apply(true, { hud: { setChallengeTrackerEnabled: v => { enabled = v; } } });
  assert.equal(enabled, true);

  const t = board();
  const note = t.book.element.querySelector('.challenge-note');
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, cfg.trackerOff);
  t.screens.show('title');
  t.setTracker(true);
  document.querySelector('[data-action="challenges"]').click();
  assert.equal(note.hidden, true);
});

function tracked({ enabled = true, pinned = ['skin:rivetRifle/gold-standard', 'skin:stapleGun/night-shift'] } = {}) {
  menuDom();
  const events = createEvents();
  const state = { assisted: false, over: false };
  const save = createSkinSave({ storage: memoryStorage() });
  const challenges = createChallenges({ events, state, save });
  const pins = createChallengePins({ storage: memoryStorage() });
  for (const id of pinned) pins.toggle(id);
  const timers = [];
  const tracker = createChallengeTracker({ setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {} });
  tracker.setEnabled(enabled);
  const sounds = [];
  connectChallengeTracker({ events, tracker, pins, save, challenges, sound: { play: (name, options) => sounds.push([name, options]) } });
  const lines = () => tracker.element.querySelectorAll('.challenge-track');
  const kill = (weaponId, extra = {}) => events.emit('kill', { weaponId, zombie: {}, headshot: false, ...extra });
  return { events, state, tracker, timers, sounds, lines, kill, pins };
}

test('the tracker shows every pinned challenge when one of them moves, then hides after showSeconds; unpinned ones never wake it', () => {
  const t = tracked();
  assert.equal(t.tracker.visible, false);
  t.kill('priceGun');
  assert.equal(t.tracker.visible, false, 'the Price Gun is not pinned');
  t.kill('stapleGun');
  assert.equal(t.tracker.visible, true);
  assert.deepEqual(t.lines().map(row => row.dataset.challenge), ['skin:rivetRifle/gold-standard', 'skin:stapleGun/night-shift'], 'in pin order');
  const staple = t.lines()[1];
  assert.ok(staple.classList.contains('changed'));
  assert.ok(staple.textContent.includes('1 / 400'));
  assert.equal(t.timers.at(-1).ms, cfg.tracker.showSeconds * 1000);
  t.timers.at(-1).fn();
  assert.equal(t.tracker.visible, false);
});

test('a lost attempt is struck through with "Failed" and a soft sound, drops off, and comes back with the next attempt', () => {
  const t = tracked();
  for (let i = 0; i < 4; i++) t.kill('rivetRifle', { headshot: true });
  t.events.emit('shot', { weaponId: 'rivetRifle', hits: [{ target: { type: { id: 'shopper' }, isAlive: true }, part: 'body' }] });
  const failed = t.lines().find(row => row.dataset.challenge === 'skin:rivetRifle/gold-standard');
  assert.ok(failed.classList.contains('failed'));
  assert.ok(failed.textContent.includes(`4 / 20 in a row · ${cfg.tracker.failed}`));
  assert.deepEqual(t.sounds, [[cfg.tracker.failSound.name, { volume: cfg.tracker.failSound.volume }]]);
  assert.equal(t.timers.at(-1).ms, Math.max(cfg.tracker.showSeconds, cfg.tracker.failedSeconds) * 1000);

  t.kill('stapleGun');
  assert.deepEqual(t.lines().map(row => row.dataset.challenge), ['skin:stapleGun/night-shift'], 'dropped off');
  t.kill('rivetRifle', { headshot: true });
  assert.deepEqual(t.lines().map(row => row.dataset.challenge), ['skin:rivetRifle/gold-standard', 'skin:stapleGun/night-shift'], 'back with the next attempt');
  assert.ok(t.lines()[0].textContent.includes('1 / 20 in a row'));
  t.events.emit('runReset', {});
  assert.equal(t.tracker.visible, false);
});

test('off (the default): nothing shows and nothing sounds, whatever moves', () => {
  const t = tracked({ enabled: false });
  t.kill('stapleGun');
  for (let i = 0; i < 2; i++) t.kill('rivetRifle', { headshot: true });
  t.events.emit('shot', { weaponId: 'rivetRifle', hits: [{ target: { type: { id: 'shopper' }, isAlive: true }, part: 'body' }] });
  assert.equal(t.tracker.visible, false);
  assert.deepEqual(t.sounds, []);
  t.tracker.setEnabled(true);
  t.kill('stapleGun');
  assert.equal(t.tracker.visible, true);
  t.tracker.setEnabled(false);
  assert.equal(t.tracker.visible, false, 'turning it off hides it at once');
});
