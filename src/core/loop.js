// =============================================================================
// FIXED-TIMESTEP GAME LOOP
// Game logic runs at a fixed rate (e.g. 60 ticks/sec) no matter the monitor's
// refresh rate. Rendering happens every animation frame and receives `alpha`
// (0..1), how far we are between the last tick and the next, so visuals can
// be interpolated smoothly.
// `beforeUpdate(frameTime)` runs at the start of every frame, before any ticks: input that
// should count for this frame's ticks (mouse/stick look) is applied there, so a shot fired this
// frame goes where the player is looking now, not where they looked last frame.
//
// startLoop() returns a handle for the idle saver (core/idleSaver.js):
//   loop.setMaxFps(10)   draw at most 10 frames a second (null = every animation frame); skipped frames cost one empty callback
//   loop.pause()         stop completely: no frames are requested at all
//   loop.resume()        carry on; the clock restarts, so the time spent paused is not played back
//   loop.paused, loop.maxFps
// =============================================================================

export function startLoop({ tickRate, maxFrameTime, beforeUpdate = null, update, render }) {
  const dt = 1 / tickRate;
  let accumulator = 0;
  let last = performance.now() / 1000;
  let minFrameSeconds = 0; // 0 = no cap
  let paused = false;
  let pending = null; // the requested animation frame, if any

  function schedule() {
    if (!paused && pending === null) pending = requestAnimationFrame(frame);
  }

  function frame(nowMs) {
    pending = null;
    if (paused) return;
    const now = nowMs / 1000;
    // Capped: let the frames in between go by untouched (the small slack keeps a cap from skipping every other refresh).
    if (minFrameSeconds > 0 && now - last < minFrameSeconds - 0.002) {
      schedule();
      return;
    }
    let frameTime = now - last;
    last = now;

    // Avoid a "spiral of death" after a long pause (tab switch, breakpoint, etc.)
    if (frameTime > maxFrameTime) frameTime = maxFrameTime;
    if (frameTime < 0) frameTime = 0;

    if (beforeUpdate) beforeUpdate(frameTime);
    accumulator += frameTime;
    while (accumulator >= dt) {
      update(dt);
      accumulator -= dt;
    }

    render(accumulator / dt, frameTime);
    schedule();
  }

  schedule();

  return {
    get paused() { return paused; },
    get maxFps() { return minFrameSeconds > 0 ? 1 / minFrameSeconds : null; },
    setMaxFps(fps) {
      minFrameSeconds = fps > 0 ? 1 / fps : 0;
    },
    pause() {
      paused = true;
      if (pending !== null) cancelAnimationFrame(pending);
      pending = null;
    },
    resume() {
      if (!paused) return;
      paused = false;
      last = performance.now() / 1000; // (the time asleep is not owed to the game)
      accumulator = 0;
      schedule();
    },
  };
}
