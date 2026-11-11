// Weapon skins phase 6: slot 2 pattern skins. A print goes on the body's top and right faces only, keeps the left-face mounts
// (build patch, warranty seal, loaner tag) and the brand label clear, adds no draw call, and never touches the default look.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { skins, skinPatterns } from '../src/config/skins.js';
import { weapons } from '../src/config/weapons.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';
import { printedSide, blankUv, sideUv, keepOuts } from '../src/weapons/models/skinPattern.js';
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

const saturation = hex => { const c = [hex >> 16 & 255, hex >> 8 & 255, hex & 255]; const max = Math.max(...c); return max ? (max - Math.min(...c)) / max : 0; };
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

test('every gun has one pattern skin, its slot 2 skin, each with a known kind; their bodies are saturated, unlike the muted mastery bodies', () => {
  assert.deepEqual(patterned.map(({ gunId }) => gunId).sort(), Object.keys(skins).sort());
  const kinds = ['lines', 'grid', 'dots', 'stripes', 'checker', 'gingham', 'confetti', 'tread', 'argyle', 'text'];
  for (const { gunId, skin } of patterned) {
    assert.equal(skin.slot, 2, gunId);
    assert.ok(kinds.includes(skin.pattern.kind), skin.pattern.kind);
    assert.ok(Number.isInteger(skin.palette.body));
    assert.ok(saturation(skin.palette.body) > saturation(skins[gunId][0].palette.body) + 0.2, `${gunId}: recognisably another skin`);
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
        assert.equal(mesh.material.map, b.find(other => isPrint(other.material)).material.map, 'one shared print');
        assert.deepEqual([mesh.material.roughness, mesh.material.metalness], [before.roughness, before.metalness], 'same finish');
      } else {
        assert.equal(mesh.material.color?.getHex(), before.color?.getHex(), `${mesh.name}: every other role is untouched`);
        assert.equal(!!mesh.material.map, !!before.map, `${mesh.name}: labels keep their own print`);
      }
    }
    assert.ok(prints > 0, 'something is printed');
    assert.ok(b.some(mesh => mesh.material.map && !isPrint(mesh.material)) || !a.some(mesh => mesh.material.map),
      'the brand label (its own textured mesh) is still there');
    const map = b.find(mesh => isPrint(mesh.material)).material.map.image;
    assert.deepEqual(map.commands.slice(0, 2), [['fillStyle', '#' + body.toString(16).padStart(6, '0')], ['fillRect', 0, 0, skinPatterns.size, skinPatterns.size * 2]],
      'the canvas is the body colour first: unprinted faces and the blank strip are exactly the palette body');
  });

  test(`${skin.name} (${gunId}): top and right faces print above, left faces below, and the sticker mount sits on plain paint`, () => {
    const model = withCanvas(() => buildWeaponModel(def, skin.id));
    const counts = { top: 0, right: 0, left: 0 };
    for (const mesh of meshes(model.root).filter(mesh => isPrint(mesh.material))) {
      for (const tri of triangles(model.root, mesh)) {
        if (tri.side === null) {
          for (const uv of tri.uvs) assert.deepEqual(uv.map(x => Math.fround(x)), blankUv.map(x => Math.fround(x)), `${mesh.name}: an unprinted face samples the blank strip`);
          continue;
        }
        counts[tri.side] += 1;
        if (tri.side === 'top') assert.ok(tri.normal.x >= skinPatterns.leftLimit, 'a top face leaning left stays plain');
        for (const [, v] of tri.uvs) {
          if (tri.side === 'left') assert.ok(v < 0.5, 'left faces sample the lower region');
          else assert.ok(v > 0.5 && v < blankUv[1], 'top and right faces sample the upper region, below the blank strip');
        }
      }
    }
    assert.ok(counts.top > 0, 'the top is printed');
    assert.ok(counts.left > 0, 'the side you see in your hands is printed');

    // The sticker mount (the build patch and the warranty seal): after the print, its keep-out is painted back to the body colour, and the patch
    // and the seal lie inside it.
    const print = meshes(model.root).find(mesh => isPrint(mesh.material)).material;
    const centre = new THREE.Vector3().fromArray(print.userData.patternCentre);
    const commands = print.map.image.commands;
    const after = commands.slice(commands.map(([name]) => name).lastIndexOf('restore') + 1);
    const body = '#' + skin.palette.body.toString(16).padStart(6, '0');
    assert.deepEqual(after[0], ['fillStyle', body]);
    const [hole] = keepOuts(model.mounts);
    const width = skinPatterns.size, height = skinPatterns.size * 2;
    const pixel = point => { const [u, v] = sideUv('left', point, centre); return [u * width, (1 - v) * height]; };
    const covered = ([x, y]) => after.some(([name, x0, y0, w, h]) => name === 'fillRect' && x >= x0 && x <= x0 + w && y >= y0 && y <= y0 + h);
    const [, sy, sz] = model.mounts.sticker.position;
    for (const [dz, dy] of [[0, 0], [-0.025, -0.015], [0.025, 0.015], [-0.025, 0.015], [0.025, -0.015]]) { // the patch is 50 x 30 mm, the seal 40 x 32
      assert.ok(covered(pixel({ z: sz + dz, y: sy + dy })), `plain paint at the sticker ${dz}, ${dy}`);
    }
    assert.ok(hole.z[1] - hole.z[0] >= 0.05 && hole.y[1] - hole.y[0] >= 0.032, 'the keep-out is bigger than the patch and the seal');
  });

  test(`${skin.name} (${gunId}): the locker / conveyor display wears it too, sharing the one texture`, () => {
    const display = withCanvas(() => buildWeaponDisplay(def, skin.id));
    const model = withCanvas(() => buildWeaponModel(def, skin.id));
    const prints = meshes(display).filter(mesh => isPrint(mesh.material));
    const held = meshes(model.root).find(mesh => isPrint(mesh.material)).material.map;
    assert.ok(prints.length > 0);
    assert.ok(prints.every(mesh => mesh.material.map === held), 'the held gun and its display share one texture (same body, same keep-out)');
    assert.equal(held.userData.sharedSkinPattern, true, 'a preview release leaves it alone');
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
