// =============================================================================
// SPRINGS
// Damped springs that pull a value back to 0. Used for anything that should be
// knocked away and settle back naturally: weapon recoil (camera and gun model),
// landing dips, reload jolts. Kick one with kick() and call update() every
// frame or tick; with damping below 1 the value overshoots slightly and settles,
// which reads as weight.
//
//   frequency: how fast it springs back (Hz, oscillations per second)
//   damping:   1 = no overshoot (critically damped); lower = more bounce
//
// update() uses the exact solution of the spring equation, so the motion is the
// same at 30, 60 or 144 frames per second.
// =============================================================================

/**
 * Velocity that makes a spring at rest peak at exactly `peak` after an impulse.
 * Lets config say "the gun kicks back 4cm" instead of a raw velocity.
 */
export function impulseForPeak(peak, frequency, damping) {
  const w = 2 * Math.PI * frequency;
  if (damping >= 0.999) return peak * w * Math.E; // critically damped: peaks at t = 1/w
  const wd = w * Math.sqrt(1 - damping * damping);
  const tPeak = Math.atan2(wd, damping * w) / wd;
  return (peak * wd) / (Math.exp(-damping * w * tPeak) * Math.sin(wd * tPeak));
}

/** Advance (x, v) of a spring by t seconds. Returns [x, v]. */
function stepExact(x0, v0, t, frequency, damping) {
  const w = 2 * Math.PI * frequency;
  if (Math.abs(damping - 1) < 1e-3) {
    const e = Math.exp(-w * t);
    const c = v0 + w * x0;
    return [(x0 + c * t) * e, (v0 - w * c * t) * e];
  }
  if (damping < 1) {
    const wd = w * Math.sqrt(1 - damping * damping);
    const e = Math.exp(-damping * w * t);
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    const b = (v0 + damping * w * x0) / wd;
    return [e * (x0 * cos + b * sin), e * (v0 * cos - (damping * w * b + wd * x0) * sin)];
  }
  // Overdamped (sluggish, no overshoot)
  const root = Math.sqrt(damping * damping - 1);
  const r1 = -w * (damping - root);
  const r2 = -w * (damping + root);
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  const c1 = x0 - c2;
  const e1 = Math.exp(r1 * t);
  const e2 = Math.exp(r2 * t);
  return [c1 * e1 + c2 * e2, r1 * c1 * e1 + r2 * c2 * e2];
}

/** One value (e.g. the camera's recoil pitch). */
export function createSpring({ frequency, damping }) {
  return {
    value: 0,
    velocity: 0,
    frequency,
    damping,

    // Knock it so it peaks at `peak` (same units as value) if it was at rest.
    kick(peak) {
      this.velocity += impulseForPeak(peak, this.frequency, this.damping);
    },

    // Shift it instantly (e.g. a jolt); it springs back from there.
    displace(amount) {
      this.value += amount;
    },

    update(dt) {
      if (dt <= 0) return;
      [this.value, this.velocity] = stepExact(this.value, this.velocity, dt, this.frequency, this.damping);
    },

    reset() {
      this.value = 0;
      this.velocity = 0;
    },
  };
}

/** Three values sharing one frequency/damping (e.g. a position or a rotation). */
export function createSpring3({ frequency, damping }) {
  const axes = [0, 1, 2].map(() => createSpring({ frequency, damping }));
  return {
    get x() {
      return axes[0].value;
    },
    get y() {
      return axes[1].value;
    },
    get z() {
      return axes[2].value;
    },
    // Change how it springs (keeps its current motion).
    setParams({ frequency: f, damping: d }) {
      for (const a of axes) {
        a.frequency = f;
        a.damping = d;
      }
    },
    kick(x, y, z) {
      axes[0].kick(x);
      axes[1].kick(y);
      axes[2].kick(z);
    },
    update(dt) {
      for (const a of axes) a.update(dt);
    },
    reset() {
      for (const a of axes) a.reset();
    },
  };
}
