import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { createSkinSave } from '../src/game/skinSave.js';
import { skins, skinStorage, skinContrast, locker } from '../src/config/skins.js';
import { weapons, melee } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { workshopStuffings, workshopRitual } from '../src/config/workshop.js';
import { createViewmodel } from '../src/weapons/viewmodel.js';
import { buildWeaponDisplay } from '../src/weapons/models/index.js';
import { receiptLinesFor } from '../src/ui/screens.js';

function memory() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function unlock(save, gunId) {
  const skin = skins[gunId][0];
  save.record(gunId, skin.id, skin.challenge.count, true);
  assert.equal(save.equip(gunId, skin.id), true);
}
function game(context, storage) {
  const scene = new THREE.Scene();
  const save = createSkinSave({ storage });
  let g;
  const viewmodel = createViewmodel(Object.values(weapons), melee.boxCutter, { skinFor: id => g?.skins.skinFor(id) });
  const run = headlessGame({ scene, skinSave: save, saveStorage: storage, viewmodel });
  g = run.g;
  context.after(() => g.map.dispose());
  const camera = new THREE.PerspectiveCamera();
  return { ...run, save, scene, viewmodel,
    held(name) {
      viewmodel.update(dt, camera, { weapon: g.gun.weapon, shownDef: g.gun.shownDef, aimAmount: 0, player: g.player });
      const meshes = [];
      viewmodel.scene.traverseVisible(node => { if (node.isMesh && node.name === name) meshes.push(node); });
      return meshes[0]?.material.color.getHex();
    },
  };
}

test('equipped base coats appear in hand, on a real wall purchase and on YOUR conveyor gun; walls stay factory issue', context => {
  const storage = memory();
  const save = createSkinSave({ storage });
  unlock(save, 'stapleGun'); unlock(save, 'priceGun');
  const t = game(context, storage), { g } = t;
  t.tick(); g.rounds.update = () => {}; g.zombies.clear();
  assert.equal(t.held('stapleHousing'), skins.stapleGun[0].palette.body);
  const wb = g.map.features.find(f => f.kind === 'wallBuy' && f.weapon === 'priceGun');
  const position = wb.position.clone().addScaledVector(wb.normal, 1); position.y = 0;
  g.player.teleport({ position, yaw: Math.atan2(wb.normal.x, wb.normal.z) });
  g.wallet.earn(10000); t.tick();
  assert.equal(g.interactions.prompt.id, 'priceGun');
  t.press('KeyF', 30); t.tick(40);
  assert.equal(g.gun.def.id, 'priceGun');
  // The first coloured display mesh is the body on every gun; compare actual held surfaces by colour.
  t.held('unused');
  const held = [];
  t.viewmodel.scene.traverseVisible(node => { if (node.isMesh) held.push(node.material.color?.getHex()); });
  assert.ok(held.includes(skins.priceGun[0].palette.body));
  const wall = buildWeaponDisplay(weapons.priceGun);
  const wallColors = [];
  wall.traverse(node => { if (node.isMesh) wallColors.push(node.material.color.getHex()); });
  assert.ok(wallColors.includes(weapons.priceGun.viewmodel.bodyColor));
  assert.ok(!wallColors.includes(skins.priceGun[0].palette.body));
  g.map.areaUnlocks.openAll();
  const { feature: bench, instance: { ritual } } = g.features.list.find(f => f.feature.kind === 'workshop');
  g.player.teleport({ position: new THREE.Vector3(bench.position.x, g.map.zones.upstairs.floorY ?? 6.3, bench.position.z - 1), yaw: Math.PI });
  ritual.choose('smoothie', 'headshot'); t.tick(); t.press('KeyF', 20); t.press('KeyF'); t.tick();
  assert.equal(ritual.phase, 'running');
  const display = t.scene.getObjectByName('ritualGun');
  const conveyorColors = [];
  display.traverse(node => { if (node.isMesh) conveyorColors.push(node.material.color.getHex()); });
  assert.ok(conveyorColors.includes(skins.priceGun[0].palette.body));
  ritual.finishNow(); t.tick(Math.ceil(workshopRitual.catchUpSeconds / dt) + 3); t.tick(40);
  assert.equal(g.gun.def.id, 'priceGun');
  t.held('unused');
  const builtColors = [];
  t.viewmodel.scene.traverseVisible(node => { if (node.isMesh) builtColors.push(node.material.color?.getHex()); });
  assert.ok(builtColors.includes(skins.priceGun[0].palette.body));
  assert.ok(t.viewmodel.scene.getObjectByName('buildPatch'));
});

test('locked, unknown, wrong-gun and malformed equipped saves safely fall back to Default', context => {
  for (const equipped of [{ stapleGun: 'night-shift' }, { stapleGun: 'unknown' }, { stapleGun: 'carbon-copy' }, { stapleGun: 123 }, null]) {
    const storage = memory();
    storage.setItem(skinStorage.key, JSON.stringify({ version: skinStorage.version, equipped, progress: {}, unlocked: {} }));
    const t = game(context, storage);
    assert.equal(t.g.skins.skinFor('stapleGun'), 'default');
    assert.equal(t.held('stapleHousing'), weapons.stapleGun.viewmodel.bodyColor);
    assert.equal(t.save.equip('stapleGun', 'night-shift'), false);
    assert.equal(t.save.equip('stapleGun', 'unknown'), false);
    assert.equal(t.save.equip('unknown', 'default'), false);
  }
});

test('equipped choices survive Play again and a new game on the same storage; defaults can replace them', context => {
  const storage = memory(), save = createSkinSave({ storage });
  unlock(save, 'stapleGun'); unlock(save, 'rivetRifle');
  const t = game(context, storage);
  t.g.gun.give(weapons.rivetRifle); t.tick(40);
  assert.equal(t.held('receiver'), skins.rivetRifle[0].palette.body);
  t.g.resetRun();
  const fresh = game(context, storage);
  assert.deepEqual(snapshot(t.g), snapshot(fresh.g));
  assert.deepEqual(t.g.skins.serialize(), fresh.g.skins.serialize());
  assert.deepEqual(t.g.challenges.snapshot(), fresh.g.challenges.snapshot());
  assert.equal(t.held('stapleHousing'), skins.stapleGun[0].palette.body);
  assert.equal(t.save.equip('stapleGun', 'default'), true);
  t.g.resetRun();
  assert.equal(t.held('stapleHousing'), weapons.stapleGun.viewmodel.bodyColor);
  assert.equal(game(context, storage).g.skins.skinFor('stapleGun'), 'default');
});

test('Continue restores the run coat and unlock receipt, flushes mastery, and matches the round-start state exactly', context => {
  const storage = memory(), save = createSkinSave({ storage });
  unlock(save, 'stapleGun');
  save.record('priceGun', 'red-tag', 399); save.flush();
  const t = game(context, storage), { g } = t;
  t.tick();
  g.events.emit('kill', { weaponId: 'priceGun', zombie: {} });
  g.events.emit('kill', { weaponId: 'nailGun', zombie: {} });
  g.rounds.jumpTo(2); t.tick();
  const atStart = g.saveGame.serializeNow();
  assert.equal(g.saveSteps.includes('skins'), true);
  assert.equal(g.saveSteps.includes('challenges'), true);
  assert.equal(g.saveGame.saveAndQuit(), true);
  assert.equal(createSkinSave({ storage }).progress('nailGun', 'aftermarket'), 1, 'runSaved flushes progress');
  // A later locker choice affects the next Play, not the saved run.
  const lockerSave = createSkinSave({ storage }); lockerSave.equip('stapleGun', 'default');
  const resumed = game(context, storage);
  assert.equal(resumed.g.skins.skinFor('stapleGun'), 'default');
  assert.equal(resumed.g.saveGame.load(), true);
  assert.deepEqual(resumed.g.saveGame.serializeNow(), atStart);
  assert.equal(resumed.held('stapleHousing'), skins.stapleGun[0].palette.body);
  assert.deepEqual(resumed.g.challenges.earned, [{ gunId: 'priceGun', skinId: 'red-tag' }]);
  assert.equal(resumed.save.progress('nailGun', 'aftermarket'), 1);
  resumed.g.resetRun();
  const fresh = game(context, storage);
  assert.deepEqual(snapshot(resumed.g), snapshot(fresh.g));
  assert.deepEqual(resumed.g.skins.serialize(), fresh.g.skins.serialize());
  assert.deepEqual(resumed.g.challenges.snapshot(), fresh.g.challenges.snapshot());
});

test('receipt names only skins unlocked during this run, and combines multiple unlocks on one line', context => {
  const storage = memory(), t = game(context, storage), { g } = t;
  const receipt = () => receiptLinesFor(g.death.summary).filter(([label]) => label === locker.receiptLabel);
  t.save.record('stapleGun', 'night-shift', 399);
  t.save.record('priceGun', 'red-tag', 399);
  g.events.emit('kill', { weaponId: 'stapleGun', zombie: {} });
  g.events.emit('kill', { weaponId: 'priceGun', zombie: {} });
  g.health.takeDamage(10000);
  assert.deepEqual(receipt(), [[locker.receiptLabel, 'Night Shift · Red Tag']]);
  g.resetRun(); g.health.takeDamage(10000);
  assert.deepEqual(receipt(), []);
});

test('every configured mastery body contrasts with all six stuffings and every warranty tier', () => {
  const luminance = hex => {
    const rgb = [hex >> 16 & 255, hex >> 8 & 255, hex & 255].map(channel => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  assert.equal(Object.keys(skins).length, 11);
  assert.equal(Object.keys(workshopStuffings).length, 6);
  for (const [gunId, entries] of Object.entries(skins)) for (const skin of entries) {
    assert.equal(entries.length, 1); assert.equal(skin.slot, 1);
    assert.ok(Number.isInteger(skin.palette.body));
    for (const other of [...Object.values(workshopStuffings), ...upgrades.tiers]) {
      const a = luminance(skin.palette.body), b = luminance(other.color);
      const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      assert.ok(contrast >= skinContrast.minimum, `${gunId}/${skin.name} vs ${other.name}: ${contrast}`);
    }
  }
});

test('equip writes win over stale storage for that gun while preserving another writer\'s progress and choices', () => {
  const storage = memory(), first = createSkinSave({ storage });
  unlock(first, 'stapleGun'); unlock(first, 'rivetRifle');
  const second = createSkinSave({ storage });
  second.record('nailGun', 'aftermarket', 212); second.flush();
  first.equip('stapleGun', 'default');
  const loaded = createSkinSave({ storage });
  assert.equal(loaded.equippedFor('stapleGun'), 'default');
  assert.equal(loaded.equippedFor('rivetRifle'), 'carbon-copy');
  assert.equal(loaded.progress('nailGun', 'aftermarket'), 212);
});
