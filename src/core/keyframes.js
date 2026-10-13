// =============================================================================
// KEYFRAMES
// Tiny pose-animation helper for code-driven animation (no animation files).
// An animation is a list of poses at times 0..1, e.g. a reload:
//   [{ t: 0, pos: [0, 0, 0], rot: [0, 0, 0] }, { t: 0.2, pos: [0, -0.1, 0], rot: [-30, 0, 15] }, ...]
// pos is in meters, rot in degrees (x = pitch, y = yaw, z = roll). Between two
// poses the motion eases in and out, so it starts and stops smoothly.
// =============================================================================

const DEG_TO_RAD = Math.PI / 180;
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Pose at time t (0..1). Writes position into outPos and rotation (radians) into
 * outRot ({ x, y, z } objects, e.g. THREE.Vector3 / THREE.Euler or plain objects).
 * A pose may leave out pos or rot (treated as zero).
 */
export function samplePose(keys, t, outPos, outRot) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const span = b.t - a.t;
  const e = span > 0 ? smooth(Math.max(0, Math.min(1, (t - a.t) / span))) : 1;
  const mix = (pa, pb, k) => {
    const va = pa ? pa[k] : 0;
    const vb = pb ? pb[k] : 0;
    return va + (vb - va) * e;
  };
  outPos.x = mix(a.pos, b.pos, 0);
  outPos.y = mix(a.pos, b.pos, 1);
  outPos.z = mix(a.pos, b.pos, 2);
  outRot.x = mix(a.rot, b.rot, 0) * DEG_TO_RAD;
  outRot.y = mix(a.rot, b.rot, 1) * DEG_TO_RAD;
  outRot.z = mix(a.rot, b.rot, 2) * DEG_TO_RAD;
}
