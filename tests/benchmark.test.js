// The benchmark (fx/benchmark.js): the report maths, and a whole route driven frame by frame with a stand-in renderer:
// the warm-up is skipped, every shot is visited, all passes of a frame are counted, and the renderer is put back.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (stubs the browser globals the mall reads)
import { createBenchmark, summarizeBenchmark } from '../src/fx/benchmark.js';
import { debug } from '../src/config/debug.js';

test('summary: averages, 95th percentile, worst, per shot and the slowest shot', () => {
  const frames = [];
  for (let i = 0; i < 100; i++) frames.push({ shot: 0, frameMs: 16, drawMs: 4, calls: 100, triangles: 1000 });
  for (let i = 0; i < 100; i++) frames.push({ shot: 1, frameMs: 33, drawMs: i === 99 ? 50 : 10, calls: 300, triangles: 3000 });
  const r = summarizeBenchmark(frames, ['hallway', 'atrium']);
  assert.equal(r.frames, 200);
  assert.equal(r.drawMs.worst, 50);
  assert.equal(r.calls, 200);
  assert.deepEqual(r.perShot.map((s) => s.shot), ['hallway', 'atrium']);
  assert.equal(r.slowestShot, 'atrium');
  assert.ok(r.drawMs.p95 >= 10 && r.drawMs.p95 <= 50);
  assert.equal(r.fps, Math.round(1000 / 24.5));
  assert.equal(summarizeBenchmark([]).frames, 0, 'an empty run does not throw');
});

test('a whole route: warm-up skipped, every shot visited, passes summed, renderer restored', async () => {
  const camera = new THREE.PerspectiveCamera();
  let calls = 0;
  const renderer = { info: { autoReset: true, render: { calls: 0, triangles: 0 }, reset() { this.render.calls = 0; this.render.triangles = 0; } } };
  let clock = 0;
  const draw = () => { // two passes per frame, like post-processing
    for (let i = 0; i < 2; i++) { renderer.info.render.calls += 5; renderer.info.render.triangles += 100; }
    clock += 3;
    calls++;
  };
  const shots = [
    { name: 'a', from: [0, 1, 0], to: [1, 1, 0], lookFrom: [0, 1, -5], lookTo: [0, 1, -5] },
    { name: 'b', from: [5, 1, 0], to: [6, 1, 0], lookFrom: [5, 1, -5], lookTo: [5, 1, -5] },
  ];
  const bench = createBenchmark({ camera, renderer, draw, now: () => clock });
  const done = bench.start(shots, { shotSeconds: 1, warmupSeconds: 0.5 });
  assert.equal(bench.active, true);
  assert.equal(renderer.info.autoReset, false, 'counts every pass while running');
  for (let i = 0; i < 400 && bench.active; i++) bench.frame(1 / 60);
  const report = await done;
  assert.equal(bench.active, false);
  assert.equal(renderer.info.autoReset, true, 'restored');
  assert.ok(Math.abs(report.frames - 120) <= 2, `about two seconds of frames after the warm-up (${report.frames})`);
  assert.deepEqual(report.perShot.map((s) => s.shot), ['a', 'b']);
  assert.equal(report.calls, 10, 'both passes counted');
  assert.equal(report.drawMs.avg, 3);
  assert.ok(calls > report.frames, 'warm-up frames were drawn but not counted');
});

test('cancel ends the run with what it has; the mall has a named route through every area; Shift+B is the key', async () => {
  const bench = createBenchmark({ camera: new THREE.PerspectiveCamera(), renderer: null, draw: () => {} });
  const done = bench.start([{ from: [0, 1, 0], to: [1, 1, 0], lookFrom: [0, 1, -1], lookTo: [0, 1, -1] }], { shotSeconds: 10, warmupSeconds: 0 });
  for (let i = 0; i < 10; i++) bench.frame(1 / 60);
  bench.cancel();
  const report = await done;
  assert.equal(report.cancelled, true);
  assert.equal(report.frames, 10);

  const { buildMall } = await import('../src/maps/mall/mall.js');
  const colliders = [];
  const map = buildMall(new THREE.Scene(), colliders);
  const names = map.benchmarkShots.map((s) => s.name);
  for (const area of ['hallway', 'food court', 'mega mart', 'service corridor', 'start room', 'atrium court', 'atrium ring', 'level 2', 'cinema lobby', 'cinema screen', 'cinema stairs']) {
    assert.ok(names.includes(area), `route covers ${area}`);
  }
  // Every camera path stays out of solid things (the Food Court dolly once ran through two shops' walls, timing a wall).
  const p = new THREE.Vector3();
  for (const shot of map.benchmarkShots) {
    const from = new THREE.Vector3(...shot.from), to = new THREE.Vector3(...shot.to);
    const steps = Math.ceil(from.distanceTo(to) / 0.2);
    for (let i = 0; i <= steps; i++) {
      p.lerpVectors(from, to, i / steps);
      assert.ok(!colliders.some((b) => b.containsPoint(p)), `the ${shot.name} shot's camera passes through something solid at ${p.toArray().map((v) => v.toFixed(1))}`);
    }
  }
  map.dispose();
  const command = debug.commands.find((c) => c.id === 'benchmark');
  assert.equal(command.key, 'KeyB');
  assert.equal(command.shift, true);
});
