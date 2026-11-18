// =============================================================================
// SHADER WARM-UP (performance): nothing compiles or uploads in the middle of a fight.
// Measured (15 November 2026, docs/history.md): the first time anything is DRAWN the browser builds its shader and uploads
// its textures there and then. On High that froze the game for about 1.1 s at the first shot and 1.5 s when the first zombie
// came into view; 494 of the mall's 819 textures were only uploaded as you first looked at them; and because a zombie's
// materials are thrown away with it, its shader was thrown away too whenever the last one of a kind was removed and
// built again for the next (0.85 s at the start of every round).
//
// Three things, none of which changes a pixel of a normal frame:
//   KEEP     every shader the renderer makes is kept for the session (one extra use counted on it), so a kind of zombie
//            coming back never rebuilds it. Dropped and started again when the graphics settings change the shaders.
//   COMPILE  every material in the scenes, shown or hidden, plus one of each thing that only exists once it spawns
//            (`extras`: one zombie of every type), is compiled in the background (three's compileAsync), behind the title.
//   DRAW     then every object is drawn once into one pixel, a few per frame within a time budget, which uploads its
//            textures and makes the browser finish the shader for real. Hidden things are shown only for that draw.
//
//   const warmup = createShaderWarmup({ renderer, views: [{ scene, camera }], target, signature, extras, holdOff, budgetMs })
//     target()      the render target the world is drawn into now (null = straight to the screen)
//     signature()   a string that changes when the shaders change (the Visual effects path, the number of lamps)
//     extras()      { roots: Object3D[], dispose() }: built when a warm-up starts, drawn in the first view's scene, then disposed
//     holdOff()     true = not now (the first launch is measuring the frame rate)
//   warmup.update()   each frame, BEFORE the real draw (it draws into one pixel of the same target)
//   warmup.state      'waiting' | 'compiling' | 'drawing' | 'done';  warmup.left = objects still to draw
// No game state is touched. Browser only (main.js); the logic is tested with a stand-in renderer (tests/shaderWarmup.test.js).
// =============================================================================

import { perf } from '../config/performance.js';

export const WARM_LAYER = 31; // the camera layer used for a warm-up draw: only the batch's objects (and every light) are on it

const drawable = (o) => o.isMesh || o.isPoints || o.isLine || o.isSprite;

/** Is this object shown, counting its parents? */
function shown(object) {
  for (let o = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/**
 * Keep the renderer's shaders: count one extra use on each program not seen before, so it is not destroyed when the last
 * material using it is disposed. Returns how many were newly kept. (renderer.info.programs is three's own live list.)
 */
export function keepPrograms(renderer, kept) {
  let added = 0;
  for (const program of renderer.info?.programs ?? []) {
    if (kept.has(program)) continue;
    kept.add(program);
    program.usedTimes++;
    added++;
  }
  return added;
}

/** Give the kept shaders back: a program nothing else uses is destroyed, as three does when its last material goes. */
export function releasePrograms(renderer, kept) {
  const programs = renderer.info?.programs ?? [];
  for (const program of kept) {
    if (--program.usedTimes > 0) continue;
    const i = programs.indexOf(program);
    if (i !== -1) {
      programs[i] = programs[programs.length - 1];
      programs.pop();
    }
    program.destroy?.();
  }
  kept.clear();
}

/**
 * Draw `objects` (all under view.scene) once, into one pixel of `target`, and leave everything as it was: what is hidden is
 * shown only for this draw, lights that are off stay off (the number of lights is part of every shader).
 */
export function drawOnce(renderer, view, objects, target) {
  const { scene, camera } = view;
  const undo = [];
  const set = (object, key, value) => {
    if (object[key] === value) return;
    undo.push([object, key, object[key]]);
    object[key] = value;
  };
  // Lights that are not lit now: they must not be lit by a parent shown for this draw.
  const dark = [];
  scene.traverse((o) => { if (o.isLight && !shown(o)) dark.push(o); });
  for (const o of objects) {
    undo.push([o.layers, 'mask', o.layers.mask]);
    o.layers.set(WARM_LAYER);
    set(o, 'frustumCulled', false);
    for (let p = o; p && p !== scene; p = p.parent) set(p, 'visible', true);
  }
  for (const light of dark) set(light, 'visible', false);
  undo.push([camera.layers, 'mask', camera.layers.mask]);
  camera.layers.set(WARM_LAYER);

  const before = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  if (target) {
    undo.push([target, 'scissorTest', target.scissorTest]);
    const { x, y, z, w } = target.scissor;
    target.scissorTest = true;
    target.scissor.set(0, 0, 1, 1);
    renderer.setRenderTarget(target); // (again: the target's scissor is read when it is set)
    renderer.render(scene, camera);
    target.scissor.set(x, y, z, w);
  } else {
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
  }
  for (let i = undo.length - 1; i >= 0; i--) undo[i][0][undo[i][1]] = undo[i][2];
  renderer.setRenderTarget(before);
}

/**
 * THE TITLE'S FIRST FRAME WAITS FOR ITS SHADERS. Measured (17 November 2026, docs/history.md): the first title frame stalled the
 * page for ~2 s, nearly all of it the browser finishing the ~50 shaders it needed there and then (uploading every texture
 * took 0.4 s; a frame after that, ~50 ms). This starts compiling everything the view can show at once (three's compileAsync:
 * where the browser has KHR_parallel_shader_compile that happens off the page's thread), and `ready` turns true when it is
 * done. Until then main.js draws no 3D (the title's black fade covers it; the menu is up and usable). A compile that fails or
 * outlasts `timeoutMs` opens the gate anyway: the first draw then compiles what it needs, as it always did.
 *   const gate = createFirstFrameGate({ renderer, scene, camera, target, timeoutMs, now })
 *   gate.ready   (checked each frame; `now` is read then, so a timeout needs no timer)
 */
export function createFirstFrameGate({ renderer, scene, camera, target = () => null, timeoutMs = perf.firstFrame.timeoutMs, now = () => performance.now() }) {
  let done = false;
  const started = now();
  const before = renderer.getRenderTarget();
  renderer.setRenderTarget(target()); // (which target the world is drawn into is part of each shader)
  let compiling;
  try {
    compiling = renderer.compileAsync(scene, camera);
  } catch {
    compiling = null;
  }
  renderer.setRenderTarget(before);
  if (!compiling) done = true;
  else Promise.resolve(compiling).catch(() => {}).then(() => { done = true; });
  return {
    get ready() {
      if (!done && now() - started > timeoutMs) done = true;
      return done;
    },
  };
}

export function createShaderWarmup({
  renderer, views, target = () => null, signature = () => '', extras = null, holdOff = () => false,
  budgetMs = perf.warmup.budgetMs, firstBatch = perf.warmup.firstBatch, now = () => performance.now(),
}) {
  const kept = new Set();
  let state = 'waiting';
  let builtFor = null; // the signature the current warm-up is for
  let run = 0; // (a compile that finishes after the settings changed again is ignored)
  let queue = []; // [{ view, objects }] still to draw
  let batch = firstBatch;
  let made = null; // the extras of this warm-up

  function start(sig) {
    run += 1;
    builtFor = sig;
    made?.dispose();
    releasePrograms(renderer, kept); // (the old settings' shaders: the ones still in use stay, the rest go)
    made = extras?.() ?? null;
    for (const root of made?.roots ?? []) views[0].scene.add(root);
    // Every light answers the warm-up layer too, so a warm-up draw is lit by the same lights as a real one.
    for (const { scene } of views) scene.traverse((o) => { if (o.isLight) o.layers.enable(WARM_LAYER); });
    state = 'compiling';
    const mine = run;
    const before = renderer.getRenderTarget();
    renderer.setRenderTarget(target()); // (which target the world is drawn into is part of each shader)
    const compiles = views.map(({ scene, camera }) => renderer.compileAsync(scene, camera));
    renderer.setRenderTarget(before);
    Promise.all(compiles).catch(() => {}).then(() => {
      if (mine !== run) return;
      queue = views.map((view) => {
        const objects = [];
        view.scene.traverse((o) => { if (drawable(o)) objects.push(o); });
        return { view, objects };
      });
      batch = firstBatch;
      state = 'drawing';
    });
  }

  function finish() {
    made?.dispose(); // (their shaders stay: kept above)
    made = null;
    queue = [];
    state = 'done';
  }

  return {
    get state() { return state; },
    get left() { return queue.reduce((n, q) => n + q.objects.length, 0); },
    get kept() { return kept.size; },

    update() {
      keepPrograms(renderer, kept);
      if (holdOff()) return;
      const sig = signature();
      if (sig !== builtFor) start(sig);
      if (state !== 'drawing') return;
      // A few objects per frame: as many as fit the budget (a batch that ran long is followed by a smaller one).
      const t0 = now();
      while (queue.length && now() - t0 < budgetMs) {
        const { view, objects } = queue[0];
        const some = objects.splice(0, batch).filter((o) => o.parent); // (gone since it was listed: skip)
        if (!objects.length) queue.shift();
        if (!some.length) continue;
        const started = now();
        drawOnce(renderer, view, some, target());
        const took = now() - started;
        batch = took > budgetMs ? Math.max(4, batch >> 1) : took < budgetMs / 3 ? Math.min(512, batch * 2) : batch;
      }
      keepPrograms(renderer, kept);
      if (!queue.length) finish();
    },

    dispose() {
      run += 1;
      made?.dispose();
      made = null;
      releasePrograms(renderer, kept);
      state = 'waiting';
      builtFor = null;
    },
  };
}
