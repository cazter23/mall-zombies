// Zone lighting (fx/zoneGrading.js): the real mall's zones give each area its grade, the view eases between them, the
// setting turns it off, and every Graphics preset decides it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (stubs <canvas>)
import { createZoneGrading, gradeZoneAt, NEUTRAL_GRADE } from '../src/fx/zoneGrading.js';
import { look } from '../src/config/look.js';

test('the real mall gives every area its grade (small areas before the big ones they sit in)', async () => {
  const { buildMall } = await import('../src/maps/mall/mall.js');
  const map = buildMall(new THREE.Scene(), []);
  const at = (x, y, z) => gradeZoneAt(map.gradeZones, { x, y, z });
  assert.equal(at(0, 1.6, 12), 'startRoom');
  assert.equal(at(0, 1.6, 2), null); // the hallway: the fallback grade
  assert.equal(at(0, 7.9, 2), 'level2');
  assert.equal(at(0, 1.6, -8), 'foodCourt');
  assert.equal(at(-13, 1.6, -17), 'foodCourt'); // inside Good Sports, a recessed store
  assert.equal(at(-21.8, 1.6, -6), 'serviceCorridor');
  assert.equal(at(-21.8, 1.6, 2), 'serviceCorridor'); // its first run, by the shutter
  assert.equal(at(27, 1.6, 0), 'megaMart');
  assert.equal(at(27, 1.6, -22), 'martBack');
  assert.equal(at(20, 1.6, 18), 'atrium');
  assert.equal(at(20, 7.9, 28), 'atrium'); // the upper ring
  for (const z of map.gradeZones) assert.ok(look.grading.grades[z.grade], `${z.grade} has a grade`);
  map.dispose();
});

test('the grade eases to the area the camera is in, snaps on request and goes neutral when switched off', () => {
  const zones = [{ grade: 'back', minX: 0, maxX: 10, minZ: 0, maxZ: 10 }];
  const grades = { front: { exposure: 1, tint: [1, 1, 1], saturation: 1, contrast: 1 }, back: { exposure: 0.5, tint: [1, 0.8, 0.6], saturation: 0.5, contrast: 1.2 } };
  const g = createZoneGrading({ zones, grades, fallback: 'front', blendSeconds: 0.5 });
  const inside = { x: 5, y: 1, z: 5 };
  const outside = { x: 50, y: 1, z: 5 };
  g.update(0.1, inside);
  assert.ok(g.current.exposure < 1 && g.current.exposure > 0.5, 'part of the way after 0.1 s');
  for (let i = 0; i < 300; i++) g.update(1 / 60, inside);
  assert.ok(Math.abs(g.current.exposure - 0.5) < 1e-3 && Math.abs(g.current.tint[2] - 0.6) < 1e-3, 'settled on the back grade');
  g.snap(outside);
  assert.equal(g.current.exposure, 1);
  for (let i = 0; i < 300; i++) g.update(1 / 60, inside, false);
  assert.ok(Math.abs(g.current.saturation - NEUTRAL_GRADE.saturation) < 1e-3, 'neutral while switched off');
  g.update(0, inside); // a paused frame (no visual time) changes nothing
  assert.ok(Math.abs(g.current.exposure - 1) < 1e-3);
  assert.throws(() => createZoneGrading({ zones: [{ grade: 'nope', minX: 0, maxX: 1, minZ: 0, maxZ: 1 }], grades, fallback: 'front' }), /unknown grade/);
});

test('Zone lighting is a costed Graphics setting every preset sets, and it writes look.runtime', async () => {
  const { settingDefs, settingPresets } = await import('../src/config/settings.js');
  const entry = settingDefs.find((s) => s.id === 'zoneGrading');
  assert.equal(entry.tab, 'Graphics');
  assert.ok(entry.cost);
  for (const preset of settingPresets.Graphics) assert.ok('zoneGrading' in preset.values, `${preset.label} sets it`);
  entry.apply(false);
  assert.equal(look.runtime.zoneGrading, false);
  entry.apply(true);
});
