// What a Build-A-Blaster effect on a zombie LOOKS like: a glow over its whole model (emissive), read each frame by zombieModel.js.
// Burning flickers orange, Antifreeze's chill is icy blue, Smoothie is pink, Popcorn Butter a buttery yellow, and Glitter cycles through the rainbow.
// Pure looks (numbers: config/workshop.js stuffingLook); nothing here touches gameplay.
import { stuffingLook } from '../config/workshop.js';

/**
 * Sets `out` (a THREE.Color) to the glow colour and returns how strong it is (0 = none; the caller leaves the model alone).
 * `time` is a running clock in seconds, so flames flicker and glitter cycles.
 */
export function statusGlow(zombie, time, out) {
  if (!zombie.isAlive) return 0;
  if (zombie.burn) {
    const { color, strength, flicker } = stuffingLook.burn;
    out.setHex(color);
    return strength * (0.7 + 0.3 * Math.sin(time * flicker) * Math.sin(time * flicker * 0.37 + 1.3));
  }
  if (zombie.confusion) {
    const { strength, hueSpeed } = stuffingLook.glitter;
    out.setHSL((time * hueSpeed) % 1, 1, 0.6);
    return strength;
  }
  const kind = zombie.slowKind && stuffingLook[zombie.slowKind];
  if (zombie.slowTimer > 0 && kind) {
    out.setHex(kind.color);
    return kind.strength;
  }
  return 0;
}
