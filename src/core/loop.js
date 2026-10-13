// =============================================================================
// FIXED-TIMESTEP GAME LOOP
// Game logic runs at a fixed rate (e.g. 60 ticks/sec) no matter the monitor's
// refresh rate. Rendering happens every animation frame and receives `alpha`
// (0..1), how far we are between the last tick and the next, so visuals can
// be interpolated smoothly.
// `beforeUpdate(frameTime)` runs at the start of every frame, before any ticks: input that
// should count for this frame's ticks (mouse/stick look) is applied there, so a shot fired this
// frame goes where the player is looking now, not where they looked last frame.
// =============================================================================

export function startLoop({ tickRate, maxFrameTime, beforeUpdate = null, update, render }) {
  const dt = 1 / tickRate;
  let accumulator = 0;
  let last = performance.now() / 1000;

  function frame(nowMs) {
    const now = nowMs / 1000;
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
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
