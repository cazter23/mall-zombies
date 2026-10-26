import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { cinema } from '../src/config/cinema.js';
import { cinemaStairs } from '../src/config/cinemaStairs.js';
import { atmosphere } from '../src/config/environment.js';
import { look } from '../src/config/look.js';
import { createMapKit } from '../src/world/mapKit.js';
import { createLookKit } from '../src/maps/mall/lookKit.js';
import { buildCinemaServiceDetails } from '../src/maps/mall/cinemaServiceDetails.js';
import { batchStatic } from '../src/world/staticBatch.js';
import { createAmbience } from '../src/game/ambience.js';

const Y = 6.3;
function make() {
  const kit = createMapKit(new THREE.Group(), []), looks = createLookKit({ kit, colliders: kit.colliders });
  buildCinemaServiceDetails({ kit, looks, cinema, stairs: cinemaStairs, floorY: Y }); return kit;
}
const region = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

test('service dressing leaves the full standing route, crossover, lower turn and stair flight visually clear', () => {
  const kit = make(), spaces = [
    region(-23.1, Y + .08, 6.3, -20.9, Y + 2.85, 27.3),
    region(-24.6, Y + .08, 22.4, -22.9, Y + 2.7, 25.0),
    region(-41.9, .08, 7.55, -23.6, 2.8, 9.65),
    region(-22.75, .08, 3.6, -20.85, 2.75, 9.5),
    region(-45.4, .08, -8.3, -42.9, Y + 2.8, 9.7),
  ];
  let triangles = 0; const tri = new THREE.Triangle(); kit.group.updateMatrixWorld(true);
  kit.group.traverse(m => {
    assert.ok(!m.isLight, 'no additional real lights'); if (!m.isMesh) return;
    const p = m.geometry.attributes.position, index = m.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      [tri.a, tri.b, tri.c].forEach((v, j) => v.fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(m.matrixWorld));
      assert.ok([tri.a, tri.b, tri.c].every(v => v.toArray().every(Number.isFinite)));
      for (const b of spaces) assert.ok(!b.intersectsTriangle(tri), `${m.name}: ${tri.a.toArray()}`); triangles++;
    }
  });
  assert.ok(triangles > 1500); assert.equal(kit.colliders.length, 0); kit.dispose();
});

test('service details batch cheaply and their buffers, materials and textures are all map-owned', context => {
  const kit = make(), resources = new Set(); let triangles = 0;
  kit.group.traverse(m => {
    if (!m.isMesh) return; resources.add(m.geometry); resources.add(m.material); if (m.material.map) resources.add(m.material.map);
    triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
  });
  const disposed = new Set(); for (const r of resources) r.addEventListener('dispose', () => disposed.add(r));
  kit.dispose(); assert.equal(disposed.size, resources.size);
  const b = make(); batchStatic(b.group); let meshes = 0; b.group.traverse(m => { if (m.isMesh) meshes++; });
  assert.ok(triangles < 9000); assert.ok(meshes < 55); context.diagnostic(`${triangles} service triangles / ${meshes} isolated batched meshes`); b.dispose();
});

test('screen animation uploads only on a visible render at its capped cadence; comfort, clutter, pause, death and reset work', () => {
  const t = headlessGame(), { g } = t, p = g.map.cinema.presentation;
  const saved = { ambient: atmosphere.ambient.enabled, clutter: look.runtime.clutter };
  try {
    atmosphere.ambient.enabled = true; look.runtime.clutter = 'full'; p.reset();
    const texture = p.screen.material.map, initial = texture.version;
    p.update(.31); assert.equal(texture.version, initial, 'off-screen animation does not upload');
    p.screen.onBeforeRender(); assert.equal(texture.version, initial + 1);
    p.screen.onBeforeRender(); p.update(.01); p.screen.onBeforeRender(); assert.equal(texture.version, initial + 1, 'same animation frame is reused');
    assert.notEqual(p.story.programme.rotation.z, 0); const angle = p.story.programme.rotation.z;
    atmosphere.ambient.enabled = false; p.update(5); p.screen.onBeforeRender();
    assert.equal(texture.version, initial + 1); assert.equal(p.story.programme.rotation.z, angle); assert.equal(p.dust.visible, false); assert.equal(p.beam.visible, false);
    look.runtime.clutter = 'none'; p.update(0); assert.equal(p.story.root.visible, false);
    look.runtime.clutter = 'some'; p.update(0); assert.ok(p.story.root.children.some(c => c.userData.fullOnly && !c.visible));
    look.runtime.clutter = 'full'; atmosphere.ambient.enabled = true; p.update(.2); assert.equal(p.dust.visible, true);
    g.state.forceRun = false; const paused = p.story.programme.rotation.z; t.tick(60); assert.equal(p.story.programme.rotation.z, paused);
    g.state.forceRun = true; g.health.takeDamage(1e6); t.tick(60); assert.equal(p.story.programme.rotation.z, paused);
    g.resetRun(); assert.equal(p.story.programme.rotation.z, 0); assert.equal(p.screen.userData.slideIndex, 0);
    const resources = [p.dust.geometry, p.dust.material, p.dust.material.map]; let disposed = 0;
    for (const r of resources) r.addEventListener('dispose', () => disposed++); g.map.dispose(); assert.equal(disposed, 3);
  } finally { atmosphere.ambient.enabled = saved.ambient; look.runtime.clutter = saved.clutter; }
});

test('equipment ambience is spatial, unlock-gated and capped; the stairs have their own readable cinema grade', () => {
  const t = headlessGame(), { g } = t; let mix = [];
  const a = createAmbience({ map: g.map, colliders: g.colliders, player: g.player, sound: { setAmbience(v) { mix = v; } } });
  g.player.teleport({ position: new THREE.Vector3(-22, Y, 18), yaw: 0 }); a.update(.1, true);
  assert.ok(!mix.some(v => v.id.startsWith('cinema_')));
  g.map.doors.find(d => d.id === 'cinema').open(); a.update(.1, true);
  assert.ok(mix.some(v => v.id === 'cinema_projection_air')); assert.ok(mix.length <= atmosphere.ambience.maxVoices);
  a.update(.1, false); assert.deepEqual(mix, []);
  for (const id of ['cinemaPassage', 'cinemaStairwell', 'cinemaReturn']) assert.equal(g.map.gradeZones.find(z => z.id === id).grade, 'cinemaService');
  assert.ok(look.grading.grades.cinemaService.exposure > look.grading.grades.serviceCorridor.exposure);
  g.map.dispose();
});
