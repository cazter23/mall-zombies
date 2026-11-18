// The shader warm-up (fx/shaderWarmup.js) with a stand-in renderer: shaders are kept and given back, a warm-up draw leaves
// every object exactly as it was and never lights a lamp that is off, the work is spread over frames, and it starts again
// when the graphics settings change. Plus zombies/warmupModels.js: one model of every type builds and disposes cleanly.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (the canvas stand-in zombie models need)
import { createShaderWarmup, createFirstFrameGate, keepPrograms, releasePrograms, drawOnce, WARM_LAYER } from '../src/fx/shaderWarmup.js';
import { buildWarmupZombies, warmupTypes } from '../src/zombies/warmupModels.js';
import { zombieTypes, mascotTypes, mascotGoldTypes } from '../src/config/zombies.js';
import { bossTypes } from '../src/config/bosses.js';

/** A renderer that records what it was asked to draw, with three's program list (info.programs: { usedTimes, destroy }). */
function fakeRenderer() {
  const r = {
    info: { programs: [] },
    target: null,
    draws: [], // one entry per render(): the objects a real renderer would have drawn, and the lights that lit them
    compiles: [],
    scissorTest: false,
    getRenderTarget: () => r.target,
    setRenderTarget(t) { r.target = t; },
    setScissorTest(on) { r.scissorTest = on; },
    setScissor() {},
    compileAsync(scene) { r.compiles.push(scene); return Promise.resolve(scene); },
    render(scene, camera) {
      const drawn = [], lights = [];
      scene.traverseVisible((o) => {
        if (!o.layers.test(camera.layers)) return;
        if (o.isLight) lights.push(o);
        else if (o.isMesh || o.isSprite || o.isPoints || o.isLine) drawn.push(o);
      });
      r.draws.push({ drawn, lights, target: r.target, scissored: r.target ? r.target.scissorTest : r.scissorTest });
    },
  };
  return r;
}
const program = () => ({ usedTimes: 1, destroyed: false, destroy() { this.destroyed = true; } });
const mesh = (name) => Object.assign(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()), { name });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A small scene: things shown, things hidden (one inside a hidden group with a lamp), a lit lamp and a lamp that is off. */
function world() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  camera.layers.mask = 0b1011; // (as room culling leaves it: some rooms on, some off)
  const shownMesh = mesh('shown');
  const hiddenMesh = mesh('hidden');
  hiddenMesh.visible = false;
  const group = new THREE.Group();
  group.visible = false;
  const inGroup = mesh('inHiddenGroup');
  inGroup.layers.set(5);
  const groupLamp = new THREE.PointLight(); // (off because its group is hidden)
  group.add(inGroup, groupLamp);
  const lit = new THREE.PointLight();
  const off = new THREE.PointLight();
  off.visible = false;
  scene.add(shownMesh, hiddenMesh, group, lit, off);
  return { scene, camera, shownMesh, hiddenMesh, group, inGroup, groupLamp, lit, off };
}

test('keepPrograms counts one extra use on each new shader, once; releasePrograms gives them back', () => {
  const renderer = fakeRenderer();
  const kept = new Set();
  const a = program(), b = program();
  renderer.info.programs.push(a, b);
  assert.equal(keepPrograms(renderer, kept), 2);
  assert.equal(keepPrograms(renderer, kept), 0, 'a shader is only kept once');
  assert.deepEqual([a.usedTimes, b.usedTimes], [2, 2]);
  // The last zombie using `a` is disposed: three counts its use off. The shader is still there for the next one.
  a.usedTimes -= 1;
  assert.equal(a.usedTimes, 1, 'kept: not down to zero, so three does not destroy it');
  // `b` is still used by a material when the warm-up lets go: it stays; `a` is destroyed and leaves the list.
  releasePrograms(renderer, kept);
  assert.equal(a.destroyed, true);
  assert.equal(b.destroyed, false);
  assert.deepEqual(renderer.info.programs, [b]);
  assert.equal(kept.size, 0);
});

test('a warm-up draw shows what is hidden for that draw only, and leaves everything as it was', () => {
  const renderer = fakeRenderer();
  const w = world();
  const target = { scissorTest: false, scissor: new THREE.Vector4(0, 0, 800, 600) };
  const before = () => JSON.stringify([w.shownMesh, w.hiddenMesh, w.group, w.inGroup, w.groupLamp, w.lit, w.off]
    .map((o) => [o.visible, o.layers.mask, o.frustumCulled]).concat([[w.camera.layers.mask, target.scissorTest, target.scissor.toArray()]]));
  const was = before();
  drawOnce(renderer, w, [w.shownMesh, w.hiddenMesh, w.inGroup], target);
  assert.equal(before(), was, 'visibility, layers, culling flags, the camera and the target are all put back');
  assert.equal(renderer.target, null, 'the renderer is handed back on the target it had');
  const [draw] = renderer.draws;
  assert.deepEqual(draw.drawn.map((o) => o.name).sort(), ['hidden', 'inHiddenGroup', 'shown']);
  assert.equal(draw.target, target);
  assert.equal(draw.scissored, true, 'drawn into one pixel');
});

test('a warm-up draw is lit by exactly the lamps that are lit: never one that is off, or off with its hidden group', () => {
  const renderer = fakeRenderer();
  const w = world();
  for (const light of [w.lit, w.off, w.groupLamp]) light.layers.enable(WARM_LAYER); // (the warm-up does this when it starts)
  drawOnce(renderer, w, [w.inGroup], null);
  assert.deepEqual(renderer.draws[0].lights, [w.lit], 'showing the hidden group for the draw must not light its lamp');
  assert.equal(renderer.draws[0].scissored, true);
  assert.equal(renderer.scissorTest, false, 'the screen\'s scissor is switched off again');
  assert.equal(w.groupLamp.visible, true, 'and the lamp is as it was');
});

test('the warm-up compiles, then draws every object once over several frames, then is done', async () => {
  const renderer = fakeRenderer();
  const w = world();
  for (let i = 0; i < 40; i++) w.scene.add(mesh(`m${i}`));
  const gunScene = new THREE.Scene();
  gunScene.add(mesh('gun'));
  let clock = 0;
  let disposed = 0;
  const extraRoot = mesh('zombie');
  const warmup = createShaderWarmup({
    renderer,
    views: [{ scene: w.scene, camera: w.camera }, { scene: gunScene, camera: new THREE.PerspectiveCamera() }],
    extras: () => ({ roots: [extraRoot], dispose() { disposed++; extraRoot.removeFromParent(); } }),
    budgetMs: 6, firstBatch: 4,
    now: () => (clock += 5), // (every look at the clock is 5 ms later: one batch per frame)
  });
  assert.equal(warmup.state, 'waiting');
  warmup.update();
  assert.equal(warmup.state, 'compiling');
  assert.deepEqual(renderer.compiles, [w.scene, gunScene], 'both scenes are compiled');
  assert.equal(extraRoot.parent, w.scene, 'the extras are in the scene while it warms');
  assert.ok(w.lit.layers.isEnabled(WARM_LAYER) && w.groupLamp.layers.isEnabled(WARM_LAYER), 'lights answer the warm-up layer');
  await settle();
  let frames = 0;
  while (warmup.state !== 'done' && frames < 200) { warmup.update(); frames++; }
  assert.equal(warmup.state, 'done');
  assert.ok(frames > 3, `spread over frames (${frames})`);
  const drawn = renderer.draws.flatMap((d) => d.drawn.map((o) => o.name));
  const everything = ['shown', 'hidden', 'inHiddenGroup', 'zombie', 'gun', ...Array.from({ length: 40 }, (_, i) => `m${i}`)];
  assert.deepEqual([...drawn].sort(), [...everything].sort(), 'every object, hidden or not, was drawn exactly once');
  assert.equal(disposed, 1, 'the extras are disposed when it is done');
  assert.equal(extraRoot.parent, null);
  assert.equal(w.hiddenMesh.visible, false);
  assert.equal(w.group.visible, false);
  const draws = renderer.draws.length;
  warmup.update();
  warmup.update();
  assert.equal(renderer.draws.length, draws, 'nothing more is drawn once done');
});

test('a settings change that changes the shaders starts it again and lets the old shaders go; holdOff waits', async () => {
  const renderer = fakeRenderer();
  const w = world();
  let sig = 'composer|all', hold = true;
  const warmup = createShaderWarmup({ renderer, views: [{ scene: w.scene, camera: w.camera }], signature: () => sig, holdOff: () => hold });
  const old = program();
  renderer.info.programs.push(old);
  warmup.update();
  assert.equal(warmup.state, 'waiting', 'held off: nothing starts');
  assert.equal(old.usedTimes, 2, 'but shaders are kept from the first frame');
  hold = false;
  warmup.update();
  await settle();
  while (warmup.state !== 'done') warmup.update();
  const draws = renderer.draws.length;
  old.usedTimes -= 1; // (its last material was disposed)
  sig = 'screen|4'; // Potato: straight to the screen, 4 lamps
  warmup.update();
  assert.equal(warmup.state, 'compiling');
  assert.equal(old.destroyed, true, 'a shader only the warm-up was holding goes with the old settings');
  await settle();
  while (warmup.state !== 'done') warmup.update();
  assert.ok(renderer.draws.length > draws, 'everything is drawn again for the new shaders');
});

test('one model of every zombie type, Mascot costume and boss builds for the warm-up and disposes', () => {
  const types = warmupTypes();
  for (const type of [...Object.values(zombieTypes), ...Object.values(mascotTypes), ...Object.values(mascotGoldTypes), ...Object.values(bossTypes)]) {
    assert.ok(types.includes(type), `${type.id ?? type.name} is warmed`);
  }
  const scene = new THREE.Scene();
  const made = buildWarmupZombies();
  assert.equal(made.roots.length, types.length);
  for (const root of made.roots) {
    assert.equal(root.visible, false, 'hidden until its one warm-up draw');
    let meshes = 0;
    root.traverse((o) => { if (o.isMesh) meshes++; });
    assert.ok(meshes > 0, 'a model with something to draw');
    scene.add(root);
  }
  made.dispose();
  assert.equal(scene.children.length, 0, 'disposing takes every model out of the scene');
});

// The title's first frame waits for its shaders (createFirstFrameGate): no 3D until the background compile is done, then
// it draws; a compile that fails, throws or never ends still opens the gate, so the title can never stay black for good.
test('the first-frame gate opens when the background compile is done, into the same target the world is drawn into', async () => {
  const r = fakeRenderer();
  let finish;
  const target = { name: 'composer' };
  let compiledInto = 'not called';
  r.compileAsync = (scene) => { compiledInto = r.target; r.compiles.push(scene); return new Promise((resolve) => { finish = resolve; }); };
  r.target = 'before';
  const scene = new THREE.Scene();
  const gate = createFirstFrameGate({ renderer: r, scene, camera: new THREE.PerspectiveCamera(), target: () => target, now: () => 0 });
  assert.deepEqual(r.compiles, [scene], 'compiling starts at once, for the whole scene');
  assert.equal(compiledInto, target, 'into the target the world is drawn into (it is part of each shader)');
  assert.equal(r.target, 'before', 'and the renderer is left on its own target');
  await settle();
  assert.equal(gate.ready, false, 'no 3D while the shaders compile');
  finish();
  await settle();
  assert.equal(gate.ready, true, 'then it draws');
});

test('the first-frame gate never keeps the title black: a stuck, failing or throwing compile still opens it', async () => {
  let t = 0;
  const stuck = Object.assign(fakeRenderer(), { compileAsync: () => new Promise(() => {}) });
  const gate = createFirstFrameGate({ renderer: stuck, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), timeoutMs: 1000, now: () => t });
  t = 999;
  assert.equal(gate.ready, false);
  t = 1001;
  assert.equal(gate.ready, true, 'a compile that outlasts the timeout: draw anyway (it compiles what it needs, as before)');

  const failing = Object.assign(fakeRenderer(), { compileAsync: () => Promise.reject(new Error('lost context')) });
  const failed = createFirstFrameGate({ renderer: failing, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), now: () => 0 });
  await settle();
  assert.equal(failed.ready, true, 'a failed compile opens it');

  const throwing = Object.assign(fakeRenderer(), { compileAsync: () => { throw new Error('no compileAsync'); } });
  throwing.target = 'mine';
  const threw = createFirstFrameGate({ renderer: throwing, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), now: () => 0 });
  assert.equal(threw.ready, true, 'so does one that throws');
  assert.equal(throwing.target, 'mine', 'and the renderer is still left on its own target');
});
