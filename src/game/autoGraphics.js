// =============================================================================
// AUTO GRAPHICS: on the very first launch, pick a Graphics preset that suits this computer.
// While the title flyover plays (High settings, the defaults), it collects real frame times for a few seconds, ignoring
// frames from a hidden / background window and long hitches (a tab switch, a shader compile), then picks the best preset
// whose frame-rate floor the computer reaches (config/settings.js autoGraphics). Only when nothing has been saved yet,
// so it never overrides a choice the player made; the chosen preset is then saved like any other setting.
//
//   const auto = createAutoGraphics({ firstLaunch, choose(label), visible: () => bool })
//   auto.frame(frameTime)   each rendered frame (main.js); does nothing once decided
//   auto.done, auto.chosen
//   pickGraphicsPreset(fps, tiers) -> label  (pure: tested)
// =============================================================================

import { autoGraphics as cfg } from '../config/settings.js';

/** The best preset whose minimum fps the measured fps reaches (tiers: [{ label, minFps }], best first). */
export function pickGraphicsPreset(fps, tiers = cfg.tiers) {
  for (const tier of tiers) if (fps >= tier.minFps) return tier.label;
  return tiers.at(-1).label;
}

export function createAutoGraphics({ firstLaunch, choose, visible = () => true, settings = cfg }) {
  let done = !firstLaunch;
  let chosen = null;
  let skipped = 0;
  const samples = [];

  return {
    get done() { return done; },
    get chosen() { return chosen; },
    frame(frameTime) {
      if (done) return;
      if (!visible() || frameTime > settings.maxFrameSeconds) { skipped++; return; } // background / hitch: not a measurement
      if (skipped + samples.length < settings.warmupFrames) { skipped++; return; } // (first frames compile shaders)
      samples.push(frameTime);
      const measured = samples.reduce((a, b) => a + b, 0);
      if (measured < settings.measureSeconds) return;
      const sorted = [...samples].sort((a, b) => a - b);
      const typical = sorted[Math.floor(sorted.length * 0.75)]; // a slow-ish frame, not the best case
      chosen = pickGraphicsPreset(1 / typical, settings.tiers);
      done = true;
      choose(chosen);
    },
  };
}
