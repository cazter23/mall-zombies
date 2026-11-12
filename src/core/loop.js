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
// One bug never stops the game: an error thrown by beforeUpdate, a tick or render is caught on its
// own, reported, and the loop carries on with the next stage and the next frame. Before, one throw
// skipped the request for the next frame and the picture froze for good (the radio kept playing).
// A tick that throws still counts as played (no pile-up of owed ticks). It may have stopped partway,
// so the state can be a little off, which is still better than a frozen screen.
// `onError(error, stage)` (stage 'beforeUpdate' | 'update' | 'render') replaces the default report:
// the first time each distinct error is seen it goes to console.error in full, repeats are counted and
// summarised at most every 5 seconds, so a tick that throws every time does not print 60 times a second.
//
// startLoop() returns a handle for the idle saver (core/idleSaver.js):
//   loop.setMaxFps(10)   draw at most 10 frames a second (null = every animation frame); skipped frames cost one empty callback
//   loop.pause()         stop completely: no frames are requested at all
//   loop.resume()        carry on; the clock restarts, so the time spent paused is not played back
//   loop.paused, loop.maxFps
//   loop.errors          how many errors were caught so far (any stage)
// =============================================================================

const REPEAT_REPORT_SECONDS = 5;

/** The default report: each distinct error once in full, then a count of repeats every few seconds. */
function createErrorReporter() {
  const seen = new Map(); // key -> { repeats, lastReport }
  return (error, stage) => {
    const key = `${stage}: ${error?.message ?? error}`;
    const now = performance.now() / 1000;
    const entry = seen.get(key);
    if (!entry) {
      seen.set(key, { repeats: 0, lastReport: now });
      console.error(`[loop] ${stage} threw; the game carries on.`, error);
      return;
    }
    entry.repeats++;
    if (now - entry.lastReport >= REPEAT_REPORT_SECONDS) {
      console.error(`[loop] ${key} (${entry.repeats} more times since the last report)`);
      entry.repeats = 0;
      entry.lastReport = now;
    }
  };
}

export function startLoop({ tickRate, maxFrameTime, beforeUpdate = null, update, render, onError = createErrorReporter() }) {
  const dt = 1 / tickRate;
  let accumulator = 0;
  let last = performance.now() / 1000;
  let minFrameSeconds = 0; // 0 = no cap
  let paused = false;
  let pending = null; // the requested animation frame, if any
  let errors = 0;

  function schedule() {
    if (!paused && pending === null) pending = requestAnimationFrame(frame);
  }

  function report(error, stage) {
    errors++;
    try {
      onError(error, stage);
    } catch {
      // (a broken reporter must not stop the loop either)
    }
  }

  function frame(nowMs) {
    pending = null;
    if (paused) return;
    try {
      runFrame(nowMs / 1000);
    } finally {
      schedule(); // whatever happened above, the next frame is asked for
    }
  }

  function runFrame(now) {
    // Capped: let the frames in between go by untouched (the small slack keeps a cap from skipping every other refresh).
    if (minFrameSeconds > 0 && now - last < minFrameSeconds - 0.002) return;
    let frameTime = now - last;
    last = now;

    // Avoid a "spiral of death" after a long pause (tab switch, breakpoint, etc.)
    if (frameTime > maxFrameTime) frameTime = maxFrameTime;
    if (frameTime < 0) frameTime = 0;

    if (beforeUpdate) {
      try { beforeUpdate(frameTime); } catch (error) { report(error, 'beforeUpdate'); }
    }
    accumulator += frameTime;
    while (accumulator >= dt) {
      accumulator -= dt; // (first: a tick that throws is still used up)
      try { update(dt); } catch (error) { report(error, 'update'); }
    }

    try { render(accumulator / dt, frameTime); } catch (error) { report(error, 'render'); }
  }

  schedule();

  return {
    get paused() { return paused; },
    get maxFps() { return minFrameSeconds > 0 ? 1 / minFrameSeconds : null; },
    get errors() { return errors; },
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
