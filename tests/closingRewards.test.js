// Weapon skins phase 9: the Closing Time rewards. Two looks that fit every gun (slots 4 and 5), earned by winning the shift: Employee of the Month
// (any run mode; brass, a dark grip, a name badge) and After Hours (Classic only; near-black with sunset trims that glow, and it unlocks the first
// too). One win unlocks a reward on all eleven guns, announced once. Looks only: nothing here may touch a gun's numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it gives Node the window the UI modules expect)
import { skins, closingRewards, skinBadges, skinNotices, skinPatterns, skinTreatments, skinStorage, locker } from '../src/config/skins.js';
import { challengeBoard as boardCfg } from '../src/config/challengeBoard.js';
import { weapons } from '../src/config/weapons.js';
import { createEvents } from '../src/game/events.js';
import { createSkinSave } from '../src/game/skinSave.js';
import { createChallenges } from '../src/game/challenges.js';
import { challengeCatalog, catalogEntry, skinPinId } from '../src/game/challengeCatalog.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';
import { peakGlow } from '../src/weapons/models/skinTreatments.js';
import { receiptLinesFor } from '../src/ui/screens.js';

const [employee, afterHours] = closingRewards;
const guns = Object.keys(skins);

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
    get record() { return JSON.parse(values.get(skinStorage.key) ?? 'null'); },
  };
}
function shift() {
  const events = createEvents(), state = { assisted: false, over: false };
  const save = createSkinSave({ storage: memoryStorage() });
  const challenges = createChallenges({ events, state, save });
  const unlocks = [];
  events.on('skinUnlocked', event => unlocks.push(event));
  const win = (closingMode, extra = {}) => events.emit('runWon', { summary: { won: true, assisted: false, closingMode, ...extra } });
  const has = id => guns.filter(gunId => save.unlocked(gunId, id));
  return { events, state, save, challenges, unlocks, win, has };
}

test('every gun ends with the same two rewards, slots 4 and 5, each its own copy, with looks only and the right modes', () => {
  assert.deepEqual(closingRewards.map(reward => reward.slot), [4, 5]);
  assert.deepEqual(employee.challenge.modes, ['directed', 'classic']);
  assert.deepEqual(afterHours.challenge.modes, ['classic'], 'the better reward is the Classic one');
  const seen = new Set();
  for (const gunId of guns) {
    const [first, second] = skins[gunId].slice(-2);
    assert.deepEqual([first.id, second.id], [employee.id, afterHours.id], gunId);
    assert.ok(first.shared && second.shared && first !== employee && second !== afterHours, 'a copy per gun, marked shared');
    for (const skin of [first, second]) {
      assert.deepEqual(Object.keys(skin).filter(key => key === 'stats' || key === 'price' || key === 'sound'), [], 'a look, nothing else');
      assert.equal(skin.challenge.kind, 'closingWin');
      assert.equal(skin.pattern, undefined, 'a recolour, not a print: it fits every gun');
      seen.add(skin.palette);
    }
  }
  assert.equal(seen.size, guns.length * 2, 'no palette object is shared between guns');
  assert.ok(employee.badge && !afterHours.badge && !employee.treatment && afterHours.treatment);
  assert.ok(peakGlow(afterHours.treatment) <= skinTreatments.maxGlow, 'After Hours glows, but dimmer than a build\'s glowing seam');
});

test('a win on Directed unlocks Employee of the Month on all eleven guns, once, and After Hours on none', () => {
  const t = shift();
  t.win('directed');
  assert.deepEqual(t.has(employee.id), guns);
  assert.deepEqual(t.has(afterHours.id), []);
  assert.deepEqual(t.unlocks, [{ gunId: guns[0], skinId: employee.id, shared: true, pa: skinNotices.sharedPa(employee.name) }], 'one notice, not eleven');
  assert.deepEqual(t.challenges.earned, [{ gunId: guns[0], skinId: employee.id }], 'and one line on the receipt');
  assert.equal(t.save.snapshot().unlocked.stapleGun[employee.id], true);
});

test('a win on Classic unlocks both, each announced once; a later win of either kind announces nothing more', () => {
  const t = shift();
  t.win('classic');
  assert.deepEqual(t.has(employee.id), guns);
  assert.deepEqual(t.has(afterHours.id), guns);
  assert.deepEqual(t.unlocks.map(event => [event.skinId, event.shared]), [[employee.id, true], [afterHours.id, true]]);
  assert.deepEqual(t.challenges.earned.map(entry => entry.skinId), [employee.id, afterHours.id]);
  t.win('classic'); t.win('directed');
  assert.equal(t.unlocks.length, 2);
});

test('Directed first, Classic later: the Classic win adds only After Hours', () => {
  const t = shift();
  t.win('directed');
  t.events.emit('runReset'); t.challenges.reset();
  t.win('classic');
  assert.deepEqual(t.unlocks.map(event => event.skinId), [employee.id, afterHours.id]);
  assert.deepEqual(t.challenges.earned.map(entry => entry.skinId), [afterHours.id], 'the new shift\'s receipt lists only what it earned');
});

test('nothing is earned by a debug-assisted run, a summary that is not a win, or a mode the reward does not name', () => {
  const t = shift();
  t.win('classic', { assisted: true });
  t.events.emit('runWon', { summary: { won: false, assisted: false, closingMode: 'classic' } });
  t.events.emit('runWon', { summary: { won: true, assisted: false, closingMode: 'somethingElse' } });
  t.events.emit('runWon', {});
  assert.deepEqual([t.has(employee.id), t.has(afterHours.id), t.unlocks], [[], [], []]);
  const flagged = shift();
  flagged.state.assisted = true;
  flagged.win('classic');
  assert.deepEqual(flagged.has(employee.id), [], 'the run itself was flagged');
  const dead = shift();
  dead.events.emit('runEnd', { summary: { won: false, closingMode: 'classic' } }); // dying is not winning
  assert.deepEqual(dead.has(employee.id), []);
});

test('the rewards are unlocked in the permanent save and can be equipped, per gun', () => {
  const t = shift();
  assert.equal(t.save.equip('stapleGun', employee.id), false, 'locked until the shift is won');
  t.win('classic');
  for (const gunId of guns) {
    assert.equal(t.save.equip(gunId, afterHours.id), true, gunId);
    assert.equal(t.save.equippedFor(gunId), afterHours.id);
  }
  assert.equal(t.save.equip('priceGun', employee.id), true, 'and either look can be worn');
});

test('the real game: the run summary records its mode, a win unlocks the rewards through the event bus and the win receipt lists them once', context => {
  const { g } = headlessGame({ skinSave: createSkinSave({ storage: memoryStorage() }) });
  context.after(() => g.map.dispose());
  g.state.closingMode = 'classic';
  g.health.takeDamage(10000);
  assert.equal(g.death.summary.closingMode, 'classic');
  g.resetRun();
  g.state.closingMode = 'directed';
  g.health.takeDamage(10000);
  assert.equal(g.death.summary.closingMode, 'directed');
  g.resetRun();

  const winSummary = { won: true, assisted: false, closingMode: 'directed', skinsUnlocked: [] };
  g.events.emit('runWon', { summary: winSummary });
  assert.ok(g.challenges.earned.some(entry => entry.skinId === employee.id));
  const receipt = receiptLinesFor(g.receiptFor(winSummary)).filter(([label]) => label === locker.receiptLabel);
  assert.deepEqual(receipt, [[locker.receiptLabel, employee.name]]);
});

test('Employee of the Month\'s badge: one mesh on every gun, on the left face and clear of the sticker mount, on the model and the display', () => {
  const meshes = root => { let n = 0; root.traverse(node => { if (node.isMesh) n += 1; }); return n; };
  const { halfLength, halfHeight } = skinPatterns.keepOut;
  const [thick, height, length] = skinBadges.size;
  for (const [gunId, def] of Object.entries(weapons)) {
    if (!def.viewmodel?.model) continue;
    const plain = buildWeaponModel(def, 'default');
    const worn = buildWeaponModel(def, employee.id);
    const badge = worn.root.getObjectByName('skinBadge');
    assert.ok(badge, `${gunId}: finds a spot`);
    assert.equal(meshes(worn.root), meshes(plain.root) + 1, `${gunId}: one mesh, one draw call`);
    const [sx, sy, sz] = worn.mounts.sticker.position;
    assert.ok(badge.position.x < sx + skinBadges.tolerance && badge.position.x > sx - skinBadges.tolerance - thick, `${gunId}: on the left face`);
    const clearZ = Math.abs(badge.position.z - sz) >= halfLength + length / 2 - 1e-9;
    const clearY = Math.abs(badge.position.y - sy) >= halfHeight + height / 2 - 1e-9;
    assert.ok(clearZ || clearY, `${gunId}: not on the build patch or warranty seal`);
    assert.ok(buildWeaponDisplay(def, employee.id).getObjectByName('skinBadge'), `${gunId}: on the display too`);
    assert.equal(buildWeaponDisplay(def, 'default').getObjectByName('skinBadge'), undefined, 'the default look has none');
    assert.equal(buildWeaponModel(def, afterHours.id).root.getObjectByName('skinBadge'), undefined, 'After Hours has none');
  }
});

test('After Hours lights the dark trims of every gun in a sunset of colours, and Employee of the Month does not glow', () => {
  for (const [gunId, def] of Object.entries(weapons)) {
    if (!def.viewmodel?.model) continue;
    const display = buildWeaponDisplay(def, afterHours.id);
    const lit = display.userData.skinTreatment;
    assert.ok(lit && lit.materials.length > 0, `${gunId}: some trim to light`);
    assert.equal(lit.kind, 'drift');
    assert.equal(buildWeaponDisplay(def, employee.id).userData.skinTreatment, undefined);
  }
});

test('the Challenges tab lists the two rewards once, under Closing Time, with one pin each for all eleven guns', () => {
  const [category] = challengeCatalog();
  const group = category.groups.find(entry => entry.id === 'closing');
  assert.equal(group.label, boardCfg.closingGroup);
  assert.deepEqual(group.entries.map(entry => entry.id), closingRewards.map(reward => skinPinId('stapleGun', reward.id)));
  assert.deepEqual(group.entries.map(entry => entry.id), ['skin:closing/employee-of-the-month', 'skin:closing/after-hours']);
  for (const gunId of guns) assert.equal(skinPinId(gunId, employee.id), 'skin:closing/employee-of-the-month', 'any gun\'s progress moves the one pin');
  assert.equal(catalogEntry('skin:closing/after-hours'), group.entries[1]);
  assert.equal(group.entries[0].tag, boardCfg.slotTags[4]);
  for (const gunGroup of category.groups.filter(entry => entry.id !== 'closing')) {
    assert.ok(gunGroup.entries.every(entry => !closingRewards.some(reward => reward.id === entry.skinId)), `${gunGroup.id}: the rewards are not repeated per gun`);
  }
  const t = shift();
  const line = group.entries[1].track({ save: t.save, challenges: t.challenges });
  assert.deepEqual(line, { id: group.entries[1].id, title: boardCfg.tracker.sharedTitle(afterHours.name), value: afterHours.challenge.track, done: false });
  t.win('classic');
  assert.equal(group.entries[1].track({ save: t.save, challenges: t.challenges }).value, boardCfg.done);
  assert.equal(group.entries[0].progress({ save: t.save }), locker.featProgress(1, 1));
  assert.equal(group.entries[0].done({ save: t.save }), true);
});
