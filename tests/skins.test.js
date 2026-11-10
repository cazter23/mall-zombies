import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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

const phaseTwoGuns = ['priceGun', 'nailGun'];
const testPalette = {
  body: 0x293e70, dark: 0x182131, metal: 0x90a9bb, grip: 0x45312b, accent: 0xd5a24c,
  sight: 0xb7e753, ammo: 0xe77fa8, emitter: 0x5ce4dc, screen: 0xc7a2ed, glass: 0x8cbbd4,
};
export const testRecolours = Object.fromEntries(phaseTwoGuns.map((id) => [
  id, [{ id: 'test-' + id, name: 'Palette test', palette: { ...testPalette } }],
]));

// These are expected assignments from the original models, independent of the resolver.
// Grip indices distinguish contact surfaces from structural parts sharing their old paint.
const expectedRoles = {
  priceGun: {
    colors: { ff7a1a: 'body', d95f0e: 'dark', '8d939c': 'metal', '2b2b2b': 'dark',
      f6f2e6: 'ammo', d62839: 'accent', ffe14a: 'sight' },
    grips: [22],
  },
  nailGun: {
    colors: { f2c12e: 'body', c89918: 'dark', '232323': 'dark', a7adb5: 'metal', d4a437: 'accent', ff5a2e: 'sight' },
    grips: [42],
  },
  foamDartBlaster: {
    colors: { '1d4e89': 'body', ffb800: 'accent', '28303b': 'dark', ff7a1a: 'accent', '63baff': 'ammo' },
    grips: [12, 24], sights: [20],
  },
  confettiCannon: {
    colors: { ff62bb: 'body', '8544c8': 'accent', ffd23f: 'metal', '312438': 'dark', ffee8a: 'sight', fff1d9: 'ammo' },
    grips: [2],
  },
  coilNailer: {
    colors: { d96b27: 'body', '22262b': 'dark', '9ea6b0': 'metal', d8a24a: 'accent', ffd23f: 'sight', '3a3f47': 'dark' },
    grips: [17, 18],
  },
  barcodeScanner: {
    colors: { d8dadf: 'body', '262930': 'dark', '8f98a3': 'metal', e07a2e: 'accent', ff1e2e: 'emitter', '5fd068': 'sight' },
    grips: [21],
  },
  leafBlower: {
    colors: { f0a31c: 'body', '2f6f3a': 'accent', '2b2f33': 'dark', e8531f: 'body', bfc5cc: 'metal', fff0b0: 'sight' },
    grips: [17],
  },
  tennisBallLauncher: {
    colors: { '2d6fd6': 'body', f6f6e6: 'accent', '24282d': 'dark', bfc5cc: 'metal', cfe9f5: 'glass', cfe23a: 'ammo', ffd23f: 'sight' },
    grips: [14],
  },
  returnToSender: {
    colors: { '4a5bd8': 'body', f6f6e6: 'accent', '20242b': 'dark', '7bffb0': 'screen', bfc5cc: 'metal',
      ff59a9: 'sight', ffd23f: 'accent', ff4d4d: 'accent', ffa733: 'accent', ffe14a: 'accent',
      '59d36c': 'accent', '4aa8ff': 'accent', a06bff: 'accent' },
    grips: [15], emitters: [12],
  },
};

const materialFixture = JSON.parse(readFileSync(new URL('./fixtures/weapon-materials-phase-1.json', import.meta.url), 'utf8'));
const captures = new Map();
function capture(request) {
  const key = JSON.stringify(request);
  if (!captures.has(key)) {
    const result = spawnSync(process.execPath, ['tests/helpers/gunMaterials.js'], {
      input: key, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stderr);
    captures.set(key, JSON.parse(result.stdout));
  }
  return captures.get(key);
}

function expectedRecolour(id, original, palette) {
  const expected = structuredClone(original);
  const assignment = expectedRoles[id];
  let index = 0;
  for (const node of expected.model) {
    if (!node.materials) continue;
    for (const material of node.materials) {
      let role = material.texture ? undefined : assignment.colors[material.color];
      if (assignment.grips.includes(index)) role = 'grip';
      if (assignment.sights?.includes(index)) role = 'sight';
      if (assignment.emitters?.includes(index)) role = 'emitter';
      if (!role) continue;
      material.color = hex(palette[role]);
      if (material.emissive && material.emissive !== '000000') material.emissive = hex(palette[role]);
    }
    index += 1;
  }
  return expected;
}

for (const canvas of [false, true]) {
  const mode = canvas ? 'canvas' : 'headless';
  test('all eleven default models and displays match the Phase 1 fixture (' + mode + ')', () => {
    const actual = capture({ canvas });
    for (const id of Object.keys(weapons)) {
      assert.deepEqual(actual[id], materialFixture[mode][id], id);
    }
  });

  for (const id of phaseTwoGuns) {
    test(id + ': roles change colour and emission without changing other surfaces (' + mode + ')', () => {
      const before = JSON.stringify(weapons);
      const actual = capture({ canvas, recolours: testRecolours });
      assert.deepEqual(actual[id], expectedRecolour(id, materialFixture[mode][id], testPalette));
      assert.equal(JSON.stringify(weapons), before);
    });
    test(id + ': identical role colours preserve material finishes (' + mode + ')', () => {
      const palette = Object.fromEntries(Object.keys(testPalette).map((role) => [role, 0x385e91]));
      const recolours = Object.fromEntries(phaseTwoGuns.map((gunId) => [
        gunId, [{ ...testRecolours[gunId][0], palette }],
      ]));
      const actual = capture({ canvas, recolours });
      assert.deepEqual(actual[id], expectedRecolour(id, materialFixture[mode][id], palette));
    });
  }
}

const canvasFunctions = {
  priceGun: 'getBrandTexture',
  nailGun: 'getWarningTexture',
  foamDartBlaster: 'getToyBrandTexture',
  confettiCannon: 'getPartyBrandTexture',
};
test('converted models contain colour literals only in their canvas drawing functions', () => {
  for (const id of phaseTwoGuns) {
    let source = readFileSync(new URL('../src/weapons/models/' + id + '.js', import.meta.url), 'utf8');
    if (canvasFunctions[id]) {
      const drawing = new RegExp('function ' + canvasFunctions[id] + '\\([^]*?^\\}', 'm');
      assert.ok(drawing.test(source), id + ' canvas function');
      source = source.replace(drawing, '');
    }
    assert.doesNotMatch(source, /0x[\da-f]+\b|#[\da-f]{3,8}\b|\b(?:color|emissive)\s*:\s*(?:\d|['"])|\b(?:rgb|rgba|hsl|hsla)\s*\(/i, id);
  }
});
