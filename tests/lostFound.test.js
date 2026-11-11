// Lost and Found: the items (config/lostFound.js), the record of what is logged (game/lostFound.js, kept in the
// Survival Guide's save), and the pickup in the real game (game/features/lostProperty.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { lostFound, lostItem } from '../src/config/lostFound.js';
import { guideStorage } from '../src/config/guide.js';
import { feel } from '../src/config/feel.js';
import { audio } from '../src/config/audio.js';
import { zombieTypes } from '../src/config/zombies.js';
import { createEvents } from '../src/game/events.js';
import { createGuideSave } from '../src/game/guideSave.js';
import { createLostFound, lostFoundProgress } from '../src/game/lostFound.js';
import { buildLostPropertyModel } from '../src/game/features/lostProperty.js';
import { featuresOf } from '../src/game/features/index.js';
import { createNavigation } from '../src/zombies/navigation.js';
import { headlessGame, dt } from './helpers/headlessGame.js';

function memoryStorage(record = null) {
  const values = new Map(record === null ? [] : [[guideStorage.key, JSON.stringify(record)]]);
  let writes = 0;
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { writes += 1; values.set(key, value); },
    get writes() { return writes; },
    get record() { return JSON.parse(values.get(guideStorage.key) ?? 'null'); },
  };
}

function log(storage = memoryStorage()) {
  const events = createEvents();
  const state = { assisted: false, over: false };
  const save = createGuideSave({ storage });
  const lost = createLostFound({ events, state, save });
  const announced = [];
  events.on('lostFound', (event) => announced.push(event));
  return { events, state, save, lost, storage, announced };
}

function realGame(context, storage = memoryStorage()) {
  const save = createGuideSave({ storage });
  const t = headlessGame({ guideSave: save });
  context.after(() => t.g.map.dispose());
  t.g.rounds.update = () => {};
  t.tick();
  const built = (id) => t.g.features.list.find(({ feature }) => feature.kind === 'lostProperty' && feature.item === id);
  return { ...t, save, storage, built };
}

// --- The items --------------------------------------------------------------------------------------------------------

test('eleven items, one per area, each with a name, a tag line, a cue that exists and a model', () => {
  const { items } = lostFound;
  assert.equal(items.length, 11);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.equal(new Set(items.map((item) => item.area)).size, items.length, 'one per area');
  for (const item of items) {
    assert.equal(lostItem(item.id), item);
    assert.ok(item.name.length > 3 && item.tag.length > 15, item.id);
    assert.ok(audio.sounds[item.cue], `${item.id}: cue "${item.cue}" is in config/audio.js`);
    assert.ok(item.parts.length >= 2, item.id);
    const { group, materials, tagMaterial } = buildLostPropertyModel(item);
    assert.ok(group.getObjectByName('lostTag'), item.id + ' wears the property tag');
    assert.ok(materials.includes(tagMaterial));
    const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    assert.ok(Math.max(size.x, size.z) < 1 && size.y < 3.5, `${item.id} is a small thing (${size.toArray().map((n) => n.toFixed(2))})`);
  }
  assert.ok(audio.sounds[lostFound.pickup.sound]);
  assert.equal(lostItem('nothing'), null);
  assert.ok(lostFound.report.lines.length >= 5 && lostFound.report.conclusion.length > 20);
});

// --- The record -------------------------------------------------------------------------------------------------------

test('logging is permanent, written at once, announced with the count, and never twice', () => {
  const t = log();
  assert.deepEqual(t.lost.progress(), lostFoundProgress(t.save));
  assert.equal(t.lost.progress().found, 0);
  assert.equal(t.lost.progress().total, 11);
  assert.equal(t.lost.pickUp('badge'), true);
  assert.equal(t.storage.writes, 1);
  assert.equal(t.storage.record.found.badge, true);
  assert.deepEqual(t.announced, [{ itemId: 'badge', found: 1, total: 11, complete: false, pa: lostFound.pa(lostItem('badge').name, 1, 11) }]);
  assert.equal(t.lost.pickUp('badge'), false);
  assert.equal(t.lost.pickUp('nothing'), false);
  assert.equal(t.storage.writes, 1);
  assert.equal(t.announced.length, 1);

  const later = log(t.storage); // a new session
  assert.equal(later.lost.found('badge'), true);
  assert.deepEqual(later.lost.progress().items.find((item) => item.id === 'badge'), { id: 'badge', name: lostItem('badge').name, area: 'Start Room', found: true });
});

test('an assisted run and a dead player log nothing; the last item says so on the PA', () => {
  const t = log();
  t.state.assisted = true;
  assert.equal(t.lost.blocked, lostFound.pickup.assisted);
  assert.equal(t.lost.pickUp('badge'), false);
  t.state.assisted = false; t.state.over = true;
  assert.equal(t.lost.pickUp('badge'), false);
  assert.equal(t.storage.writes, 0);
  t.state.over = false;
  assert.equal(t.lost.blocked, null);
  for (const item of lostFound.items) assert.equal(t.lost.pickUp(item.id), true);
  assert.equal(t.lost.progress().complete, true);
  assert.equal(t.announced.at(-1).complete, true);
  assert.notEqual(t.announced.at(-1).pa.text, lostFound.pa('x', 10, 11).text.replace('x', lostItem('keys').name));
});

test('the record keeps kills and lost property together, drops unknown items, and reads an older record as nothing found', () => {
  const old = createGuideSave({ storage: memoryStorage({ version: guideStorage.version, seen: {}, kills: { shopper: 4 } }) });
  assert.equal(old.found('badge'), false);
  assert.equal(old.kills('shopper'), 4);
  const save = createGuideSave({ storage: memoryStorage({ version: guideStorage.version, seen: {}, kills: {}, found: { badge: true, nothing: true, coin: 'yes' } }) });
  assert.deepEqual(save.snapshot().found, { badge: true });
  // Another tab logged one in the meantime: a flush keeps both.
  const storage = memoryStorage();
  const mine = createGuideSave({ storage });
  mine.find('pager');
  storage.setItem(guideStorage.key, JSON.stringify({ version: guideStorage.version, seen: {}, kills: {}, found: { coin: true } }));
  mine.flush();
  assert.deepEqual(storage.record.found, { pager: true, coin: true });
});

test('the developer shortcut finds and clears one item or all of them', () => {
  const t = log();
  assert.match(t.lost.debug('nothing'), /Use g\.lostFound/);
  t.lost.debug('all', 'find');
  assert.equal(t.lost.progress().complete, true);
  t.lost.debug('coin', 'clear');
  assert.equal(t.lost.found('coin'), false);
  assert.equal(createGuideSave({ storage: t.storage }).found('coin'), false, 'a cleared item does not come back from storage');
  assert.equal(t.lost.progress().found, 10);
});

// --- In the real game -------------------------------------------------------------------------------------------------

test('the map has every item once, in its own zone, clear of solid things and within reach of somewhere to stand', (context) => {
  const t = realGame(context);
  const { g } = t;
  const features = featuresOf(g.map, 'lostProperty');
  assert.deepEqual(features.map((feature) => feature.item).sort(), lostFound.items.map((item) => item.id).sort());
  g.debug.run('doors');
  t.tick(400); // (the shutters finish opening)
  const nav = createNavigation(g.colliders, { radius: zombieTypes.shopper.radius, height: zombieTypes.shopper.height }, g.map.navigation);
  for (let i = 0; i < 5; i++) nav.update(1, g.player.position);
  for (const feature of features) {
    const item = lostItem(feature.item);
    assert.equal(feature.zone, item.zone);
    assert.ok(g.map.zones[feature.zone], `${item.id}: zone ${feature.zone} exists`);
    const { prompt, group } = t.built(item.id).instance;
    const bounds = new THREE.Box3().setFromObject(group);
    const inside = g.colliders.filter((box) => box.intersectsBox(bounds) && box.max.y - bounds.min.y > 0.05 && box.min.y < bounds.max.y - 0.05);
    assert.deepEqual(inside.map((box) => box.name ?? box.min.toArray().map((n) => n.toFixed(1)).join(',')), [], `${item.id} is not buried in anything`);
    // Somewhere to stand: a walkable, reachable point whose eye is within reach of the prompt.
    const floor = item.parts.some((part) => part.at[1] < -0.5) ? Math.round(feature.position.y - 1.9) : feature.position.y;
    let reach = Infinity, standing = null;
    for (let dx = -1.5; dx <= 1.5; dx += 0.25) for (let dz = -1.5; dz <= 1.5; dz += 0.25) {
      const x = feature.position.x + dx, z = feature.position.z + dz;
      if (!nav.isWalkableAt(x, z, floor) || nav.distanceToTarget(x, z, floor) === Infinity) continue;
      const distance = new THREE.Vector3(x, floor + feel.player.eyeHeight, z).distanceTo(prompt);
      if (distance < reach) { reach = distance; standing = new THREE.Vector3(x, floor, z); }
    }
    assert.ok(reach < feel.interact.range - 0.3, `${item.id}: nearest standing point is ${reach.toFixed(2)} m from its prompt (reach ${feel.interact.range})`);
    // Standing there and looking at it, the prompt offered is this item's, not a rack's or a counter's next to it.
    const eye = standing.clone().setY(floor + feel.player.eyeHeight);
    const to = new THREE.Vector3().subVectors(prompt, eye);
    g.player.teleport({ position: standing, yaw: Math.atan2(-to.x, -to.z) });
    g.player.pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
    t.tick(2);
    assert.equal(g.interactions.prompt?.id, feature.name, `${item.id}: its own prompt wins where you would stand`);
  }
});

test('the badge in the real game: a prompt in the start room, hold to log it, it stays as a faded item with no prompt', (context) => {
  const t = realGame(context);
  const { g } = t;
  const { prompt, group } = t.built('badge').instance;
  const stand = () => {
    g.player.teleport({ position: new THREE.Vector3(prompt.x - 1, 0, prompt.z + 0.9), yaw: 0 });
    const to = new THREE.Vector3().subVectors(prompt, g.player.position);
    g.player.yaw = Math.atan2(-to.x, -to.z);
    g.player.pitch = -0.6;
    t.tick(2);
  };
  stand();
  assert.equal(g.interactions.prompt?.id, 'lost_badge', 'the prompt is offered from beside it');
  assert.equal(g.interactions.prompt.label, lostItem('badge').name);
  const tag = group.getObjectByName('lostTag').material;
  assert.equal(tag.opacity, 1);

  const before = g.wallet.points;
  // (hold the use key)
  t.press('KeyF', Math.ceil((lostFound.pickup.holdSeconds + 0.2) / dt));
  assert.equal(t.save.found('badge'), true);
  assert.equal(t.storage.record.found.badge, true, 'written at once');
  assert.equal(g.wallet.points, before, 'it costs and pays nothing');
  assert.ok(t.sounds.includes(lostFound.pickup.sound));
  assert.ok(t.hud.calls.some(([name, arg]) => name === 'showAnnouncement' && arg?.kicker === 'Lost property'));
  t.tick(2);
  assert.equal(g.interactions.prompt?.id ?? null, null, 'nothing left to log here');
  assert.equal(tag.opacity, lostFound.look.logged.opacity);
  assert.equal(tag.transparent, true);

  // A new shift, same record: still faded, still no prompt, and no cue sound.
  g.resetRun();
  stand();
  assert.equal(g.interactions.prompt?.id ?? null, null);
  t.sounds.length = 0;
  t.tick(Math.ceil((lostFound.cue.everySeconds * 2) / dt));
  assert.ok(!t.sounds.includes(lostItem('badge').cue));
});

test('near an item you have not logged its cue plays, louder up close, and not from far away or in an assisted prompt', (context) => {
  const t = realGame(context);
  const { g } = t;
  const { prompt } = t.built('badge').instance;
  const cue = lostItem('badge').cue;
  const heard = (x, z) => {
    g.player.teleport({ position: new THREE.Vector3(x, 0, z), yaw: 0 });
    t.sounds.length = 0;
    t.tick(Math.ceil((lostFound.cue.everySeconds * 2 + 0.1) / dt));
    return t.sounds.filter((name) => name === cue).length;
  };
  assert.ok(heard(prompt.x - 1, prompt.z + 1) >= 1, 'beside it');
  assert.equal(heard(-4, 15), 0, 'across the room, beyond the cue radius');
  g.state.assisted = true;
  g.player.teleport({ position: new THREE.Vector3(prompt.x - 1, 0, prompt.z + 0.9), yaw: 0 });
  g.player.yaw = Math.atan2(1, -0.9); g.player.pitch = -0.6;
  t.tick(2);
  if (g.interactions.prompt?.id === 'lost_badge') assert.equal(g.interactions.prompt.blocked, lostFound.pickup.assisted);
  assert.equal(g.lostFound.pickUp('badge'), false);
});

// --- The Challenges tab and the tracker (ui/challengeBoard.js, ui/challengeTracker.js) --------------------------------

test('the Challenges tab lists Lost and Found as one collection: the count from the guide record, never an item\'s name', async () => {
  const { menuDom } = await import('./helpers/menuDom.js');
  const { challengeBoard: words } = await import('../src/config/challengeBoard.js');
  const { challengeCatalog, catalogEntry, LOST_FOUND_PIN } = await import('../src/game/challengeCatalog.js');
  const { createChallengePins } = await import('../src/game/challengePins.js');
  const { createSkinSave } = await import('../src/game/skinSave.js');
  const { createChallengeBoard } = await import('../src/ui/challengeBoard.js');
  const { createChallengeTracker, connectChallengeTracker } = await import('../src/ui/challengeTracker.js');

  const category = challengeCatalog().find(({ id }) => id === 'collections');
  assert.equal(category.label, words.categories.collections);
  const entry = catalogEntry(LOST_FOUND_PIN);
  assert.equal(category.groups[0].entries[0], entry);
  const t = log();
  const ctx = { save: null, challenges: null, guideSave: t.save };
  assert.equal(entry.progress(ctx), words.lostFound.progress(0, 11));
  assert.equal(entry.done(ctx), false);
  assert.equal(entry.done({}), false, 'a caller without the guide record still gets an answer');
  assert.equal(entry.progress({}), words.lostFound.progress(0, 11));
  t.lost.pickUp('badge'); t.lost.pickUp('coin');
  assert.equal(entry.progress(ctx), words.lostFound.progress(2, 11));
  assert.deepEqual(entry.track(ctx), { id: LOST_FOUND_PIN, title: words.lostFound.trackerTitle, value: words.lostFound.progress(2, 11), done: false });
  for (const item of lostFound.items) assert.ok(!entry.text.includes(item.name), 'no hints');

  // On the board: its own group, the count, and a pin like any other challenge.
  menuDom();
  const pins = createChallengePins({ storage: null });
  const board = createChallengeBoard({ save: createSkinSave({ storage: null }), pins, onBack() {}, guideSave: t.save });
  board.open();
  board.element.querySelector('[data-group="lostFound"]').click();
  const row = board.element.querySelector(`[data-challenge="${LOST_FOUND_PIN}"]`);
  assert.ok(row.textContent.includes(words.lostFound.name) && row.textContent.includes(words.lostFound.progress(2, 11)));
  row.click();
  assert.equal(pins.has(LOST_FOUND_PIN), true);
  board.close();

  // In a run: the pinned line shows when an item is logged.
  const tracker = createChallengeTracker({ setTimer: () => 1, clearTimer() {} });
  tracker.setEnabled(true);
  connectChallengeTracker({ events: t.events, tracker, pins, save: createSkinSave({ storage: null }), challenges: null, guideSave: t.save });
  assert.equal(tracker.visible, false);
  t.lost.pickUp('keys');
  assert.equal(tracker.visible, true);
  assert.ok(tracker.element.textContent.includes(words.lostFound.progress(3, 11)));
  for (const item of lostFound.items) t.lost.pickUp(item.id);
  assert.ok(tracker.element.textContent.includes(words.done));
});
