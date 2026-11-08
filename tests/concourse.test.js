// The concourse pass (maps/mall/concourse.js, config/concourse.js): what makes the mall read as a real one, built cheaply.
// Painted panels share one atlas per area, every glow set is one mesh, new floor pieces obey the standable rule, and the
// atlas maps each cell to its own corner of the texture.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (stubs <canvas>)
import { buildMall } from '../src/maps/mall/mall.js';
import { createCanvasAtlas, atlasQuad } from '../src/world/canvasAtlas.js';
import { concourse } from '../src/config/concourse.js';

const meshes = (root) => { const out = []; root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };

test('the painted panels, glows, campaign and worn lanes are a handful of merged meshes', () => {
  const colliders = [];
  const map = buildMall(new THREE.Scene(), colliders);
  const all = meshes(map.group);
  const named = (name) => all.filter((m) => m.name === name);
  assert.equal(named('concourse_painted_level2').length, 1, 'every Level 2 shop interior and sign: one mesh');
  assert.equal(named('concourse_painted_hallway').length, 1, 'both display windows: one mesh');
  assert.equal(named('concourse_glass').length, 1, 'every pane of glass: one mesh');
  assert.equal(named('glow_panels').length, 1);
  assert.equal(named('glow_streaks').length, 1);
  assert.equal(named('campaign_pennants').length, 1);
  assert.equal(named('floor_worn_lanes').length, 1);
  const painted = named('concourse_painted_level2')[0];
  assert.equal(painted.material, named('concourse_painted_hallway')[0].material, 'one atlas for both areas');
  // Pools under lit panels and reflections under neon: many quads (two triangles each) in the two glow meshes.
  const quads = (name) => named(name)[0].geometry.attributes.position.count / 6;
  assert.ok(quads('glow_panels') >= 20, `a pool under every lit panel (${quads('glow_panels')})`);
  assert.ok(quads('glow_streaks') >= 15, `reflections, spill and cove (${quads('glow_streaks')})`);
  assert.equal(named('level2_soffit').length, concourse.soffits.level2.north.length + concourse.soffits.level2.south.length);
  map.dispose();
  assert.equal(colliders.length, 0);
});

test('new floor pieces are a step, waist height (vaultable) or too tall to stand on, and never block a spawn', () => {
  const colliders = [];
  const map = buildMall(new THREE.Scene(), colliders);
  const X = concourse.fixtures, S = concourse.stories;
  const spots = [[X.kiddieRide.x, 0.5, X.kiddieRide.z], [X.gumball.x, 0.5, X.gumball.z], [S.stroller.x, 0.5, S.stroller.z],
    ...X.ashtrays.map(([x, y, z]) => [x, y + 0.3, z]), ...concourse.totems.map((t) => [t.x, 1, t.z])];
  for (const [x, y, z] of spots) {
    const box = colliders.find((b) => b.containsPoint(new THREE.Vector3(x, y, z)));
    assert.ok(box, `a collider at ${x}, ${z}`);
    const h = box.max.y - box.min.y;
    assert.ok(h <= 1.1 || h >= 2.1, `${x}, ${z}: ${h.toFixed(2)} m is a step, waist high or too tall to stand on`);
    for (const s of map.spawnPoints) {
      const p = s.position;
      assert.ok(Math.hypot(p.x - x, p.z - z) > 1.2 || Math.abs(p.y - box.min.y) > 2, `${s.name} keeps its room from the piece at ${x}, ${z}`);
    }
  }
  map.dispose();
});

test('the canvas atlas gives each cell its own part of the texture', () => {
  const atlas = createCanvasAtlas([{ aspect: 2, draw() {} }, { aspect: 4, draw() {} }, { aspect: 7.5, draw() {} }], { width: 1024, rowHeight: 128 });
  const rects = [0, 1, 2].map((i) => atlas.uv(i));
  for (const [u0, v0, u1, v1] of rects) assert.ok(u0 >= 0 && u1 <= 1 && v0 >= 0 && v1 <= 1 && u1 > u0 && v1 > v0);
  const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  assert.ok(!overlap(rects[0], rects[1]) && !overlap(rects[0], rects[2]) && !overlap(rects[1], rects[2]), 'no two cells share pixels');
  const quad = atlasQuad(2, 1, rects[1]);
  const us = Array.from({ length: 4 }, (_, i) => quad.attributes.uv.getX(i));
  assert.deepEqual([Math.min(...us), Math.max(...us)], [rects[1][0], rects[1][2]]);
});
