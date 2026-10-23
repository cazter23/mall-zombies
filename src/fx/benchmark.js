// =============================================================================
// BENCHMARK: a fixed camera route through the map, timed, so every visual change can say what it costs.
// Plays map.benchmarkShots (same shape as titleShots: from -> to, lookFrom -> lookTo) one after another while main.js
// hands it each frame; it poses the camera, draws through `draw()`, and records two numbers per frame:
//   frameMs   real time between frames (what the player feels; capped by the monitor's refresh rate)
//   drawMs    CPU time spent issuing the draw (not capped by vsync: the better number for comparing settings)
// plus the renderer's draw calls and triangles. The report has average / 95th percentile / worst for the whole route
// and an average per shot, so a slow room stands out.
//
//   const bench = createBenchmark({ camera, renderer, draw, now })
//   bench.start(shots, { shotSeconds, warmupSeconds }) -> Promise<report>   (resolves when the route is done)
//   bench.active                                           (main.js: while true, call bench.frame(dt) instead of render)
//   bench.frame(frameTime)                                 (one frame)
//   bench.cancel()
// No game state is touched here; the caller opens doors etc. around it.
// =============================================================================

import { createTitleCamera } from '../ui/titleCamera.js';

const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const percentile = (list, p) => {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};
const round = (v) => Math.round(v * 10) / 10;

/** Summarise recorded frames ({ shot, frameMs, drawMs, calls, triangles }) into the report. Pure (tested). */
export function summarizeBenchmark(frames, shotNames = []) {
  const frameMs = frames.map((f) => f.frameMs);
  const drawMs = frames.map((f) => f.drawMs);
  const perShot = [];
  for (const shot of [...new Set(frames.map((f) => f.shot))]) {
    const mine = frames.filter((f) => f.shot === shot);
    perShot.push({
      shot: shotNames[shot] ?? `shot ${shot + 1}`,
      frameMs: round(average(mine.map((f) => f.frameMs))),
      drawMs: round(average(mine.map((f) => f.drawMs))),
      calls: Math.round(average(mine.map((f) => f.calls))),
    });
  }
  const avgFrame = average(frameMs);
  return {
    frames: frames.length,
    fps: avgFrame > 0 ? Math.round(1000 / avgFrame) : 0,
    frameMs: { avg: round(avgFrame), p95: round(percentile(frameMs, 0.95)), worst: round(Math.max(0, ...frameMs)) },
    drawMs: { avg: round(average(drawMs)), p95: round(percentile(drawMs, 0.95)), worst: round(Math.max(0, ...drawMs)) },
    calls: Math.round(average(frames.map((f) => f.calls))),
    triangles: Math.round(average(frames.map((f) => f.triangles))),
    perShot,
    slowestShot: perShot.reduce((a, b) => (b.drawMs > (a?.drawMs ?? -1) ? b : a), null)?.shot ?? null,
  };
}

export function createBenchmark({ camera, renderer, draw, now = () => performance.now() }) {
  let run = null; // { flyover, shots, frames, time, warmup, total, resolve }

  function finish(cancelled = false) {
    const done = run;
    run = null;
    if (renderer?.info) renderer.info.autoReset = done.autoReset;
    const report = summarizeBenchmark(done.frames, done.shots.map((s) => s.name));
    report.cancelled = cancelled;
    done.resolve(report);
  }

  return {
    get active() {
      return run !== null;
    },

    start(shots, { shotSeconds = 4, warmupSeconds = 0.5 } = {}) {
      if (run) return Promise.reject(new Error('benchmark already running'));
      return new Promise((resolve) => {
        run = {
          flyover: createTitleCamera(shots, { shotSeconds, fadeSeconds: 0 }),
          shots, frames: [], time: 0, warmup: warmupSeconds, total: shots.length * shotSeconds, resolve,
          autoReset: renderer?.info?.autoReset ?? true,
        };
        // Count every pass of a frame (post-processing draws several), not just the last one.
        if (renderer?.info) renderer.info.autoReset = false;
      });
    },

    frame(frameTime) {
      if (!run) return;
      run.time += frameTime;
      if (run.time > run.warmup) run.flyover.update(frameTime); // (held on the first pose while warming up)
      run.flyover.apply(camera);
      renderer?.info?.reset();
      const shot = run.flyover.shotIndex;
      const t0 = now();
      draw();
      const drawMs = now() - t0;
      const info = renderer?.info?.render ?? { calls: 0, triangles: 0 };
      // The first moments (and the first frame of each shot) include shader compiles: skip the warm-up.
      if (run.time > run.warmup) {
        run.frames.push({ shot, frameMs: frameTime * 1000, drawMs, calls: info.calls, triangles: info.triangles });
      }
      if (run.time >= run.total + run.warmup) finish();
    },

    cancel() {
      if (run) finish(true);
    },
  };
}
