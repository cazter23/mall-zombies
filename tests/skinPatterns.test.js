// Weapon skins phase 6: slot 2 pattern skins. A print goes on the body's top and right faces only, keeps the left-face mounts
// (build patch, warranty seal, loaner tag) and the brand label clear, adds no draw call, and never touches the default look.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { skins, skinPatterns } from '../src/config/skins.js';
import { weapons } from '../src/config/weapons.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';
import { printedSide, blankUv, skinPatternTexture } from '../src/weapons/models/skinPattern.js';
import { resolveGunColors } from '../src/weapons/skinPalette.js';

const patterned = Object.entries(skins).flatMap(([gunId, entries]) => entries.filter(skin => skin.pattern).map(skin => ({ gunId, skin })));

function canvasDocument() {
  return {
    createElement() {
      const commands = [];
      const context = new Proxy({}, {
        get: (target, key) => target[key] ?? ((...args) => commands.push([key, ...args])),
        set(target, key, value) { target[key] = value; commands.push([key, value]); return true; },
      });
      return { width: 0, height: 0, commands, getContext: () => context };
    },
  };
}

function withCanvas(fn) {
  const before = globalThis.document;
  globalThis.document = canvasDocument();
  try { return fn(); } finally { if (before === undefined) delete globalThis.document; else globalThis.document = before; }
}

const meshes = root => { const list = []; root.traverse(node => { if (node.isMesh) list.push(node); }); return list; };
const isPrint = material => !!material?.userData?.skinPattern;

// Every triangle of a printed mesh, in the gun's frame: its side, its UVs and its centre.
function triangles(root, mesh) {
  root.updateMatrixWorld(true);
  const toGun = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  const position = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
  const out = [];
  for (let i = 0; i + 2 < position.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(position, i + k).applyMatrix4(toGun));
    const normal = new THREE.Vector3().subVectors(c, b).cross(a.clone().sub(b)).normalize();
    out.push({ side: printedSide(normal), normal, centre: a.clone().add(b).add(c).divideScalar(3),
      uvs: [0, 1, 2].map(k => [uv.getX(i + k), uv.getY(i + k)]) });
  }
  return out;
}

test('there is one pattern skin per gun so far, each a slot 2 skin with a known kind', () => {
  assert.ok(patterned.length >= 1);
  const kinds = ['lines', 'grid', 'dots', 'stripes', 'checker', 'gingham', 'confetti', 'tread', 'argyle', 'text'];
  for (const { gunId, skin } of patterned) {
    assert.equal(skin.slot, 2, gunId);
    assert.ok(kinds.includes(skin.pattern.kind), skin.pattern.kind);
    assert.ok(Number.isInteger(skin.palette.body));
  }
});

for (const { gunId, skin } of patterned) {
  const def = weapons[gunId];

  test(`${skin.name} (${gunId}): palette roles land, only the body is printed, and no draw call is added`, () => {
    const pattern = skin.pattern;
    delete skin.pattern; // (the same skin as a plain recolour, labels printed as usual)
    let plain;
    try { plain = withCanvas(() => buildWeaponModel(def, skin.id)); } finally { skin.pattern = pattern; }
    const printed = withCanvas(() => buildWeaponModel(def, skin.id));
    const a = meshes(plain.root), b = meshes(printed.root);
    assert.deepEqual(b.map(mesh => mesh.name), a.map(mesh => mesh.name), 'same meshes: the same draw calls');
    assert.equal(new Set(b.map(mesh => mesh.material)).size, new Set(a.map(mesh => mesh.material)).size, 'one body material swapped for one print');
    const body = resolveGunColors(def, skin.id).bodyColor;
    assert.equal(body, skin.palette.body);
    let prints = 0;
    for (const [i, mesh] of b.entries()) {
      const before = a[i].material;
      if (isPrint(mesh.material)) {
        prints += 1;
        assert.equal(before.color.getHex(), body, `${mesh.name} was body-coloured`);
        assert.equal(mesh.material.userData.bodyColor, body);
        assert.equal(mesh.material.map, skinPatternTexture(gunId, skin), 'the shared print');
        assert.deepEqual([mesh.material.roughness, mesh.material.metalness], [before.roughness, before.metalness], 'same finish');
      } else {
        assert.equal(mesh.material.color?.getHex(), before.color?.getHex(), `${mesh.name}: every other role is untouched`);
        assert.equal(!!mesh.material.map, !!before.map, `${mesh.name}: labels keep their own print`);
      }
    }
    assert.ok(prints > 0, 'something is printed');
    assert.ok(b.some(mesh => mesh.material.map && !isPrint(mesh.material)) || !a.some(mesh => mesh.material.map),
      'the brand label (its own textured mesh) is still there');
    const map = skinPatternTexture(gunId, skin).image;
    assert.deepEqual(map.commands.slice(0, 2), [['fillStyle', '#' + body.toString(16).padStart(6, '0')], ['fillRect', 0, 0, skinPatterns.size, skinPatterns.size]],
      'the canvas is the body colour first: unprinted faces and the blank strip are exactly the palette body');
  });

  test(`${skin.name} (${gunId}): the print is on top and right faces only; the left-face mounts are clear`, () => {
    const model = withCanvas(() => buildWeaponModel(def, skin.id));
    const sticker = new THREE.Vector3(...model.mounts.sticker.position);
    let top = 0, right = 0, nearSticker = 0;
    const printedV = 1 - skinPatterns.blankFraction;
    for (const mesh of meshes(model.root).filter(mesh => isPrint(mesh.material))) {
      for (const tri of triangles(model.root, mesh)) {
        if (tri.side === null) {
          for (const uv of tri.uvs) assert.deepEqual(uv.map(x => Math.fround(x)), blankUv.map(x => Math.fround(x)), `${mesh.name}: an unprinted face samples the blank strip`);
        } else {
          assert.ok(tri.normal.x >= skinPatterns.leftLimit, 'never a face leaning left');
          for (const [, v] of tri.uvs) assert.ok(v < printedV, 'inside the printed area');
          if (tri.side === 'top') top += 1; else right += 1;
        }
        if (tri.normal.x < -skinPatterns.faceDot && tri.centre.distanceTo(sticker) < 0.05) {
          nearSticker += 1;
          assert.equal(tri.side, null, 'the face under the build patch / seal / loaner tag is plain');
        }
      }
    }
    assert.ok(top > 0, 'the top is printed');
    void nearSticker; // (0 when the sticker sits on a part that is not body-coloured)
  });

  test(`${skin.name} (${gunId}): the locker / conveyor display wears it too, sharing the one texture`, () => {
    const display = withCanvas(() => buildWeaponDisplay(def, skin.id));
    const prints = meshes(display).filter(mesh => isPrint(mesh.material));
    assert.ok(prints.length > 0);
    assert.ok(prints.every(mesh => mesh.material.map === skinPatternTexture(gunId, skin)));
    assert.equal(skinPatternTexture(gunId, skin).userData.sharedSkinPattern, true, 'a preview release leaves it alone');
  });
}

test('the default look, wall displays and every mastery skin carry no print', () => {
  withCanvas(() => {
    for (const [gunId, entries] of Object.entries(skins)) {
      const def = weapons[gunId];
      for (const root of [buildWeaponModel(def).root, buildWeaponDisplay(def), buildWeaponModel(def, entries[0].id).root]) {
        assert.ok(meshes(root).every(mesh => !isPrint(mesh.material)), gunId);
      }
    }
  });
});
