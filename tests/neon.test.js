import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMapKit } from '../src/world/mapKit.js';
import { createNeon, NEON_FONT, NEON_SHAPES, NEON_COLORS, measureText, layoutText } from '../src/world/neon.js';
import { neon as cfg } from '../src/config/neon.js';

const freshKit = () => createMapKit(new THREE.Group(), []);
const meshes = (group, role) => {
  const out = [];
  group.traverse((o) => { if (o.isMesh && (!role || o.userData.neon === role)) out.push(o); });
  return out;
};
const triangles = (mesh) => (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;

test('the stroke font has every letter, digit and symbol, each with sane strokes', () => {
  const required = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ' ', '-', '.', '!', '?', ':', '&', '+', '/', '→', '←', '↑', '↓', '♥', '★'];
  for (const ch of required) {
    const g = NEON_FONT[ch];
    assert.ok(g, `missing glyph "${ch}"`);
    assert.ok(g.w > 0);
    if (ch !== ' ') assert.ok(g.s.length > 0, `"${ch}" has no strokes`);
    for (const stroke of g.s) {
      assert.equal(stroke.length % 2, 0, `"${ch}" stroke has an odd number of coordinates`);
      assert.ok(stroke.length >= 4, `"${ch}" stroke needs two points`);
      assert.ok(stroke.every(Number.isFinite));
    }
  }
  // Lower case reads as upper case; an unknown character is a data mistake.
  assert.deepEqual(measureText('sale', 1), measureText('SALE', 1));
  assert.throws(() => measureText('SALE~', 1), /no glyph/);
  assert.throws(() => measureText('{', 1), /no glyph/); // (an inherited name like '{}' or 'constructor' chars aren't glyphs)
});

test('text width scales with height and multi-line text stacks', () => {
  const small = measureText('SUNSET GALLERIA', 0.5);
  const big = measureText('SUNSET GALLERIA', 1);
  assert.ok(Math.abs(big.width - small.width * 2) < 1e-9);
  assert.ok(Math.abs(big.height - small.height * 2) < 1e-9);
  assert.ok(small.width > measureText('SUN', 0.5).width);
  const two = measureText('OPEN\nLATE', 0.5);
  assert.ok(two.height > small.height * 1.9);
  assert.ok(Math.abs(two.width - measureText('OPEN', 0.5).width) < 1e-9);

  // The built geometry matches the measured size.
  const kit = freshKit();
  const neon = createNeon(kit);
  const t = neon.text('SALE', { height: 1, x: 3, y: 2, z: -1 });
  kit.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(meshes(t.group, 'lit')[0]); // the glass, not the halo
  const size = box.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - t.width) < 0.15, `${size.x} vs ${t.width}`);
  assert.ok(size.y > 0.95 && size.y < 1.15, `${size.y}`);
  const center = box.getCenter(new THREE.Vector3());
  assert.ok(center.distanceTo(new THREE.Vector3(3, 2, -1)) < 0.2);
});

test('facing rotates text like kit.sign', () => {
  const kit = freshKit();
  const neon = createNeon(kit);
  const east = neon.text('WIDE TEXT', { height: 0.5, facing: 'x+' });
  const size = new THREE.Box3().setFromObject(east.group).getSize(new THREE.Vector3());
  assert.ok(size.z > size.x * 3, 'facing +X lays the text out along Z');
  assert.throws(() => neon.text('NO', { facing: 'up' }), /facing/);
});

test('tubes of one colour merge into one mesh (+ one halo), so a sign is a handful of draw calls', () => {
  const kit = freshKit();
  const neon = createNeon(kit);
  const one = neon.text('MEGA SALE TODAY', { color: NEON_COLORS.cyan });
  assert.equal(meshes(one.group, 'lit').length, 1);
  assert.equal(meshes(one.group, 'halo').length, 1);
  assert.equal(meshes(one.group).length, 2);

  const palm = neon.shape('palm');
  assert.equal(meshes(palm, 'lit').length, 2, 'trunk and fronds: two colours');
  const lits = meshes(palm, 'lit').map((m) => m.material);
  assert.notEqual(lits[0], lits[1]);

  const s = neon.sign({ text: 'FOOD COURT', color: NEON_COLORS.hotPink, border: NEON_COLORS.cyan });
  assert.equal(meshes(s.group, 'lit').length, 2); // text + border
  assert.equal(meshes(s.group, 'halo').length, 2);
  assert.equal(meshes(s.group, 'backing').length, 1);
  assert.ok(meshes(s.group).length <= 5);

  // A polyline list in one tube call is still one mesh; world points at height y.
  const t = neon.tube([[[0, 0], [1, 0]], [[0, 1], [1, 1], [1, 2]]], { y: 3, color: NEON_COLORS.sickGreen });
  assert.equal(meshes(t, 'lit').length, 1);
  const box = new THREE.Box3().setFromObject(meshes(t, 'lit')[0]);
  assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).y - 3) < 1e-6);

  // Same colour shares a material across calls; no real lights anywhere.
  const again = neon.text('HI', { color: NEON_COLORS.cyan });
  assert.equal(meshes(again.group, 'lit')[0].material, meshes(one.group, 'lit')[0].material);
  let lights = 0;
  neon.group.traverse((o) => { if (o.isLight) lights++; });
  assert.equal(lights, 0);
});

test('every shape builds valid geometry; unknown shapes throw', () => {
  const kit = freshKit();
  const neon = createNeon(kit);
  for (const kind of NEON_SHAPES) {
    const g = neon.shape(kind, { size: 1.2, x: 1, y: 2, z: 3 });
    const lit = meshes(g, 'lit');
    assert.ok(lit.length >= 1, kind);
    for (const m of lit) {
      const pos = m.geometry.attributes.position.array;
      assert.ok(pos.every(Number.isFinite), `${kind} has NaN vertices`);
    }
    const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    assert.ok(size.y > 0.2 && size.y < 1.6, `${kind} height ${size.y}`);
  }
  for (const dir of ['left', 'up', 'down']) assert.ok(neon.shape('arrow', { dir }));
  assert.throws(() => neon.shape('arrow', { dir: 'sideways' }), /dir/);
  assert.throws(() => neon.shape('blimp'), /unknown shape/);
  assert.throws(() => neon.shape('toString'), /unknown shape/);
});

test('dead letters use the unlit dark-glass material and leave the lit glass', () => {
  const kit = freshKit();
  const neon = createNeon(kit);
  const full = neon.sign({ text: 'OPEN', color: NEON_COLORS.hotPink });
  const broken = neon.sign({ text: 'OPEN', color: NEON_COLORS.hotPink, deadLetters: [1, 2] });
  const dead = meshes(broken.group, 'dead');
  assert.equal(dead.length, 1);
  assert.equal(dead[0].material.userData.neon, 'dead');
  assert.ok(dead[0].material.isMeshStandardMaterial, 'dead glass is lit by the room, it does not glow');
  assert.ok(!dead[0].material.transparent);
  const lit = meshes(broken.group, 'lit')[0];
  assert.ok(lit.material.isMeshBasicMaterial);
  assert.ok(triangles(lit) < triangles(meshes(full.group, 'lit')[0]));
  // Dead colour is a dim version of the tube colour.
  const litColor = new THREE.Color(NEON_COLORS.hotPink);
  assert.ok(dead[0].material.color.r < litColor.r * 0.5);
  // Text supports dead letters too (index counts spaces).
  const t = neon.text('NO VACANCY', { deadLetters: [0, 1] });
  assert.equal(meshes(t.group, 'dead').length, 1);
  assert.ok(layoutText('NO VACANCY').letters.some((l) => l.index === 3 && l.char === 'V'));
});

test('flicker is deterministic for a seed, animates, and stops when disabled', () => {
  const build = (seed) => {
    const neon = createNeon(freshKit(), { seed });
    neon.sign({ text: 'EXIT', color: NEON_COLORS.emergencyRed, flickerLetters: [0, 2] });
    neon.tube([[0, 0], [2, 0]], { flicker: 'dying' });
    neon.shape('bolt', { flicker: 'blink' });
    return neon;
  };
  const record = (neon) => {
    const out = [];
    for (let i = 0; i < 600; i++) { neon.update(1 / 60); out.push(neon.flickers.map((f) => f.level).join(',')); }
    return out;
  };
  const a = build(7), b = build(7), c = build(8);
  assert.equal(a.flickers.length, 4);
  const ra = record(a), rb = record(b), rc = record(c);
  assert.deepEqual(ra, rb, 'same seed, same flicker');
  assert.notDeepEqual(ra, rc, 'another seed, another pattern');
  // Each part actually turns off and on within 10 seconds.
  for (let p = 0; p < 4; p++) {
    const levels = new Set(ra.map((row) => row.split(',')[p]));
    assert.ok(levels.size >= 2, `part ${p} never changed`);
  }
  // Flicker parts are separate meshes with their own materials.
  const flickerMeshes = meshes(a.group, 'flicker');
  assert.equal(flickerMeshes.length, 4);
  assert.equal(new Set(flickerMeshes.map((m) => m.material)).size, 4);

  // A whole-text flicker is one part (the letters go out together), not one per letter.
  const whole = createNeon(freshKit());
  whole.text('SALE', { flicker: 'blink' });
  assert.equal(whole.flickers.length, 1);

  a.setQuality({ flicker: false });
  assert.ok(a.flickers.every((f) => f.level === 1), 'frozen = steadily lit');
  const frozen = record(a);
  assert.ok(frozen.every((row) => row === frozen[0]));
  assert.ok(flickerMeshes.every((m) => m.material.color.r > 0 || m.material.color.g > 0));
  a.setQuality({ flicker: true });
  assert.ok(new Set(record(a)).size > 1, 'resumes when turned back on');
});

test('setQuality hides and restores every halo, including on parts built later', () => {
  const kit = freshKit();
  const neon = createNeon(kit);
  neon.sign({ text: 'ARCADE', flickerLetters: [0] });
  neon.shape('star');
  const halos = () => [...meshes(neon.group, 'halo'), ...meshes(neon.group, 'flickerHalo')];
  assert.ok(halos().length >= 3);
  for (const h of halos()) {
    assert.equal(h.material.blending, THREE.AdditiveBlending);
    assert.equal(h.material.depthWrite, false);
  }
  neon.setQuality({ halo: false });
  assert.ok(halos().every((h) => !h.visible));
  neon.text('LATER');
  assert.ok(halos().every((h) => !h.visible), 'new halos respect the setting');
  assert.ok(meshes(neon.group, 'lit').every((m) => m.visible), 'glass stays');
  neon.setQuality({ halo: true });
  assert.ok(halos().every((h) => h.visible));
  assert.deepEqual(neon.quality, { halo: true, flicker: true });
});

test('dispose frees every geometry and material it created and never touched collision', () => {
  const kit = freshKit();
  const before = kit.colliders.length;
  const neon = createNeon(kit);
  neon.sign({ text: 'SUNSET ♥ GALLERIA', deadLetters: [2], flickerLetters: [4], border: true });
  neon.shape('palm');
  neon.tube([[0, 0], [1, 1]], { flicker: true });
  assert.equal(kit.colliders.length, before, 'neon adds no colliders');
  assert.ok(neon.stats().meshes > 0 && neon.stats().triangles > 0);

  const geometries = new Set(), materials = new Set();
  neon.group.traverse((o) => { if (o.isMesh) { geometries.add(o.geometry); materials.add(o.material); } });
  assert.equal(geometries.size, neon.owned.geometries);
  assert.equal(materials.size, neon.owned.materials);
  let freedG = 0, freedM = 0;
  geometries.forEach((g) => g.addEventListener('dispose', () => freedG++));
  materials.forEach((m) => m.addEventListener('dispose', () => freedM++));

  neon.dispose();
  assert.equal(freedG, geometries.size);
  assert.equal(freedM, materials.size);
  assert.equal(neon.group.parent, null);
  assert.equal(kit.group.children.length, 0);
  assert.equal(kit.colliders.length, before);
  assert.deepEqual(neon.owned, { geometries: 0, materials: 0 });
  assert.doesNotThrow(() => { neon.dispose(); neon.update(1); });
  assert.throws(() => neon.text('AGAIN'), /dispose/);
});

test('tube radius and halo size follow config', () => {
  const neon = createNeon(freshKit());
  const t = neon.tube([[0, 0, 0], [0, 0, 4]]);
  const glass = new THREE.Box3().setFromObject(meshes(t, 'lit')[0]).getSize(new THREE.Vector3());
  const halo = new THREE.Box3().setFromObject(meshes(t, 'halo')[0]).getSize(new THREE.Vector3());
  assert.ok(Math.abs(glass.y - cfg.tube.radius * 2) < 1e-6);
  assert.ok(Math.abs(halo.y - cfg.tube.radius * cfg.halo.radiusScale * 2) < 1e-6);
  // A closed loop gets no end balls but still renders.
  const loop = neon.tube([[0, 0], [1, 0], [1, 1]], { closed: true });
  assert.equal(meshes(loop, 'lit').length, 1);
});
