import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { skins } from '../src/config/skins.js';
import { upgrades } from '../src/config/upgrades.js';
import { weapons, melee } from '../src/config/weapons.js';
import { workshopStuffings } from '../src/config/workshop.js';
import { buildWeaponDisplay, buildWeaponModel } from '../src/weapons/models/index.js';
import { createUpgradeVisuals } from '../src/weapons/models/upgradeParts.js';
import { resolveGunColors } from '../src/weapons/skinPalette.js';
import { createViewmodel } from '../src/weapons/viewmodel.js';

// Captured from ec36907. Each index selects a colour (optionally /emissive)
// for one mesh in traversal order, including the arms and hidden reload props.
const defaults = {
  stapleGun: {
    colors: ['d62839', 'a31b28', '9aa0a8', '2b2b2b', 'd8dde4', 'ffd23f/ffd23f',
      'e0ac7e', 'c99366', 'c8102e', '990b22', 'f4e8d1', 'e9ae50', '2b2b30', '9fd8a8'],
    held: [
      0, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4, 2, 4, 3, 2, 2, 0, 3, 1, 1,
      1, 5, 3, 1, 1, 1, 2, 3, 4, 6, 7, 6, 6, 6, 8, 9, 10, 11, 9, 11,
      10, 11, 10, 6, 7, 7, 6, 8, 9, 10, 11, 9, 11, 10, 11, 12, 13, 10, 4, 2,
      2,
    ],
    display: [
      0, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4, 2, 4, 3, 2, 2, 0, 3, 1, 1,
      1, 5, 3, 1, 1, 1, 2, 3, 4,
    ],
  },
  rivetRifle: {
    colors: ['217f84', '252e35', 'f49d36', 'a9b9bd', 'ffcf52',
      'e0ac7e', 'c99366', 'c8102e', '990b22', 'f4e8d1', 'e9ae50', '2b2b30', '9fd8a8'],
    held: [
      0, 1, 1, 2, 2, 2, 3, 1, 1, 1, 1, 4, 1, 0, 1, 2, 1, 3, 1, 1,
      1, 1, 3, 1, 3, 2, 5, 6, 5, 5, 5, 7, 8, 9, 10, 8, 10, 9, 10, 9,
      5, 6, 6, 5, 7, 8, 9, 10, 8, 10, 9, 10, 11, 12, 9, 1, 3, 2,
    ],
    display: [
      0, 1, 1, 2, 2, 2, 3, 1, 1, 1, 1, 4, 1, 0, 1, 2, 1, 3, 1, 1,
      1, 1, 3, 1, 3, 2,
    ],
  },
};

function meshes(root, visibleOnly = false) {
  const parts = [];
  const collect = (node) => { if (node.isMesh) parts.push(node); };
  if (visibleOnly) root.traverseVisible(collect);
  else root.traverse(collect);
  return parts;
}

function materialColor({ material }) {
  return material.color.getHexString() + (material.emissive?.getHex() ? '/' + material.emissive.getHexString() : '');
}

function surface({ name, geometry, position, quaternion, scale, visible, material }) {
  return {
    name, geometry: geometry.type, shape: geometry.attributes.position.array,
    position: position.toArray(), quaternion: quaternion.toArray(), scale: scale.toArray(), visible,
    material: material.type, roughness: material.roughness, metalness: material.metalness,
    emissiveIntensity: material.emissiveIntensity, flatShading: material.flatShading, map: material.map,
  };
}

const stapleRoles = ['body', 'dark', 'metal', 'grip', 'accent', 'sight'];
const rivetRoles = ['body', 'dark', 'accent', 'metal', 'sight'];
const rivetGrips = ['foregrip', 'pistolGrip', 'buttPad'];
const hex = (color) => color.toString(16).padStart(6, '0');

for (const gunId of Object.keys(defaults)) {
  const def = weapons[gunId];
  const [skin] = skins[gunId];
  const baseline = defaults[gunId];

  test(`${def.name}: all default colours match main, including the wall display`, () => {
    for (const [kind, root] of [
      ['held', buildWeaponModel(def).root],
      ['display', buildWeaponDisplay(def)],
    ]) {
      const expected = baseline[kind].map((index) => baseline.colors[index]);
      assert.deepEqual(meshes(root).map(materialColor), expected, kind);
    }
  });

  test(`${def.name}: only the palette parts change, with safe fallback for other IDs`, () => {
    const plain = meshes(buildWeaponModel(def).root);
    const before = structuredClone(def.viewmodel);
    const coated = meshes(buildWeaponModel(def, skin.id).root);
    assert.deepEqual(coated.map(surface), plain.map(surface));

    for (const [i, part] of plain.entries()) {
      const index = baseline.held[i];
      // The last mesh on the Staple Gun display is the printed label, independent of the bright metal role.
      const role = gunId === 'stapleGun'
        ? (i === baseline.display.length - 1 ? undefined : stapleRoles[index])
        : (rivetGrips.includes(part.name) ? 'grip' : rivetRoles[index]);
      const base = materialColor(part);
      const color = role ? hex(skin.palette[role]) : base;
      assert.equal(materialColor(coated[i]), role && base.includes('/') ? `${color}/${color}` : color,
        part.name || `mesh ${i} (${role ?? 'unchanged'})`);
    }
    const other = gunId === 'stapleGun' ? 'rivetRifle' : 'stapleGun';
    for (const id of ['missing-skin', skins[other][0].id]) {
      assert.deepEqual(resolveGunColors(def, id), resolveGunColors(def));
      assert.deepEqual(meshes(buildWeaponModel(def, id).root).map(materialColor), plain.map(materialColor));
    }
    assert.deepEqual(def.viewmodel, before);
  });

  test(`${def.name}: the build, warranties, loaner tag and nozzle layer on a skin`, () => {
    const plain = buildWeaponModel(def);
    const coated = buildWeaponModel(def, skin.id);
    const plainVisuals = createUpgradeVisuals(plain);
    const coatedVisuals = createUpgradeVisuals(coated);
    const parts = (model, visuals) => [
      ...['buildVisual', 'warrantyTag', 'loanerTag'].map((name) => model.root.getObjectByName(name)),
      ...model.root.getObjectsByProperty('name', 'warrantyCollar'),
      visuals.parts.extendedNozzle,
    ];
    const visibleParts = (model, visuals) => parts(model, visuals).flatMap((node) => meshes(node, true));
    for (const { id: tier } of upgrades.tiers) {
      for (const [stuffing, config] of Object.entries(workshopStuffings)) {
        const show = {
          tier, attachments: { barrel: 'extendedNozzle' }, loaner: true, time: 0.5,
          build: { stuffing, heart: config.defaultHeart, quality: 'overstuffed' },
        };
        plainVisuals.show(show);
        coatedVisuals.show(show);
        const layered = visibleParts(coated, coatedVisuals);
        for (const name of ['buildPatch', 'buildThread', 'buildPuff', 'buildLump', 'buildBadgePlate', 'loanerCard']) {
          assert.ok(layered.some((part) => part.name === name), `${tier}/${stuffing}: ${name}`);
        }
        assert.ok(coatedVisuals.parts.extendedNozzle.visible);
        assert.equal(coated.root.getObjectByName('warrantyTag').visible, tier !== 'standard');
        assert.equal(meshes(coated.root.getObjectByName('warrantyCollar'), true).length > 0, tier !== 'standard');
        assert.deepEqual(layered.map((part) => [surface(part), materialColor(part)]),
          visibleParts(plain, plainVisuals).map((part) => [surface(part), materialColor(part)]));
      }
    }
  });
}

test('the keyless debug override selects the held model, marks assistance and resets with the run', async () => {
  const { headlessGame, dt } = await import('./helpers/headlessGame.js');
  const viewmodel = createViewmodel(Object.values(weapons), melee.boxCutter, { skinFor: (id) => g.debug.skinFor(id) });
  const { g, tick } = headlessGame({ viewmodel });
  const camera = new PerspectiveCamera();
  const heldColor = (name) => {
    viewmodel.update(dt, camera, { weapon: g.gun.weapon, shownDef: g.gun.shownDef, aimAmount: 0, player: g.player });
    return meshes(viewmodel.scene, true).find((mesh) => mesh.name === name)?.material.color.getHex();
  };
  const debug = g.debug;
  assert.ok(debug.keylessIds.includes('skin'));
  assert.ok(!debug.commands.some(({ id }) => id === 'skin'));
  assert.equal(g.state.assisted, false);
  debug.run('skin', 'stapleGun', 'night-shift');
  assert.equal(g.state.assisted, true);
  assert.equal(heldColor('stapleHousing'), skins.stapleGun[0].palette.body);
  debug.run('skin', 'stapleGun', 'carbon-copy');
  assert.equal(heldColor('stapleHousing'), skins.stapleGun[0].palette.body);
  debug.run('skin', 'stapleGun', 'default');
  assert.equal(heldColor('stapleHousing'), weapons.stapleGun.viewmodel.bodyColor);
  debug.run('skin', 'rivetRifle', 'carbon-copy');
  g.gun.give(weapons.rivetRifle);
  tick(40);
  assert.equal(heldColor('receiver'), skins.rivetRifle[0].palette.body);
  g.resetRun();
  assert.equal(g.state.assisted, false);
  assert.equal(debug.skinFor('rivetRifle'), undefined);
  assert.equal(heldColor('stapleHousing'), weapons.stapleGun.viewmodel.bodyColor);
});
