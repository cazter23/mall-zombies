// A PERFORMANCE BUDGET: how many things the mall asks the graphics card to draw from each benchmark shot, counted headless
// the way the browser decides it (room culling, the doorway test, static batches, the camera's frustum). Draw calls are
// what a weak computer chokes on, and they creep up one poster at a time, so this fails when a view goes over its budget
// (config/performance.js drawBudget). The real numbers are a little higher (the gun, zombies, post-processing passes):
// the benchmark in the browser (Shift+B on the pause screen) gives those. If this fails after adding decoration, merge it
// into a static batch, give it a room, or raise the budget on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createRoomCulling } from '../src/fx/roomCulling.js';
import { createDetailCulling } from '../src/fx/detailCulling.js';
import { batchStatic, freezeStatic } from '../src/world/staticBatch.js';
import { look } from '../src/config/look.js';
import { perf } from '../src/config/performance.js';
import { feel } from '../src/config/feel.js';

const frustum = new THREE.Frustum();
const projection = new THREE.Matrix4();

/** The scene as main.js prepares it: rooms tagged, props tagged, batched, frozen, listed; every door open (the worst case). */
function prepared({ windowCulling = true } = {}) {
  const { g } = headlessGame();
  const scene = g.map.group.parent;
  const camera = new THREE.PerspectiveCamera(feel.camera.fov, 16 / 9, feel.camera.near, feel.camera.far);
  const far = { ...look.propDistance, metres: Infinity };
  const doors = new Map(g.map.doors.map((d) => [d.id, d]));
  const culling = createRoomCulling({
    areas: g.map.cullAreas, portals: g.map.cullPortals, camera, isOpen: (id) => doors.get(id)?.isOpen ?? true, windowCulling, farProps: () => far,
  });
  culling.tag(g.map.group);
  culling.tagProps(scene);
  batchStatic(g.map.group, { shade: look.bakedShade, cellSize: look.batchCellSize });
  freezeStatic(g.map.group);
  culling.collect(scene);
  const detail = createDetailCulling(g.map.group);
  for (const door of g.map.doors) door.open({ instant: true });
  for (let i = 0; i < 5; i++) g.map.update(1 / 60);
  scene.updateMatrixWorld(true);

  /** Draw calls the scene would make from this camera pose. */
  function count(position, target) {
    camera.position.fromArray(position);
    camera.lookAt(...target);
    camera.updateMatrixWorld(true);
    culling.update();
    detail.update(camera);
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let calls = 0;
    scene.traverseVisible((o) => {
      if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine) || !o.layers.test(camera.layers)) return;
      if (o.isInstancedMesh && o.count === 0) return;
      if (o.frustumCulled && !frustum.intersectsObject(o)) return;
      calls += Array.isArray(o.material) ? Math.max(1, o.geometry.groups.length) : 1;
    });
    return calls;
  }
  /** The worst of a shot's start, middle and end. */
  function shotCalls(shot) {
    const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);
    return Math.max(count(shot.from, shot.lookFrom), count(mid(shot.from, shot.to), mid(shot.lookFrom, shot.lookTo)), count(shot.to, shot.lookTo));
  }
  return { g, far, shotCalls };
}

function measure(setup) {
  const rows = setup.g.map.benchmarkShots.map((shot) => [shot.name, setup.shotCalls(shot)]);
  const average = Math.round(rows.reduce((sum, [, n]) => sum + n, 0) / rows.length);
  return { rows, average, worst: rows.reduce((a, b) => (b[1] > a[1] ? b : a)) };
}
const table = (rows) => rows.map(([name, n]) => `${name} ${n}`).join(', ');

test('every benchmark shot draws within the budget (everything on: High)', () => {
  const now = measure(prepared());
  const budget = perf.drawBudget;
  for (const [name, calls] of now.rows) {
    assert.ok(calls <= budget.perShot, `the ${name} shot draws ${calls} things (budget ${budget.perShot}). All shots: ${table(now.rows)}`);
  }
  assert.ok(now.average <= budget.average, `the route averages ${now.average} (budget ${budget.average}): ${table(now.rows)}`);
});

test('the doorway test is what keeps the route in budget: drawing visible rooms whole goes over it', () => {
  const whole = measure(prepared({ windowCulling: false }));
  assert.ok(whole.average > perf.drawBudget.average, `drawing visible rooms whole, the route averages ${whole.average}: ${table(whole.rows)}`);
});

test('Potato (Far objects and Small detail at Close) draws within its own, lower budget', () => {
  const setup = prepared();
  const saved = look.runtime.detailDistance;
  try {
    look.runtime.detailDistance = 'close';
    setup.far.metres = look.propDistance.metres.close;
    const potato = measure(setup);
    for (const [name, calls] of potato.rows) {
      assert.ok(calls <= perf.drawBudget.potatoPerShot, `on Potato the ${name} shot draws ${calls} (budget ${perf.drawBudget.potatoPerShot}): ${table(potato.rows)}`);
    }
  } finally { look.runtime.detailDistance = saved; }
});
