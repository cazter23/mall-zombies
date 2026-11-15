// =============================================================================
// SPATIAL MATHS (pure: no Web Audio, no DOM; game/soundStage.js, audio/sound.js and the audition page share it).
//   toListener(listener, point, out)   a world point in the listener's space: +x right, +y up (x elevationScale), -z ahead
//   distanceGain(d, profile)           how loud a profile is at d metres (config/spatialAudio.js profiles)
//   occlusionOf(level)                 { gain, cutoffHz } of 'clear' | 'neighbour' | 'far' | 'closed'
//   voiceScore(priority, gain)         who keeps a voice when they run out (higher wins)
//   lowestVoice(voices)                the voice with the lowest score (the one a better play steals)
// The listener is { x, y, z, yaw, pitch } (the camera: yaw 0 faces -Z, as everywhere in the game).
// =============================================================================

import { spatialAudio } from '../config/spatialAudio.js';

export const OCCLUSION_LEVELS = ['clear', 'neighbour', 'far', 'closed'];

/** The worse of two occlusion levels. */
export const worseLevel = (a, b) => (OCCLUSION_LEVELS.indexOf(a) >= OCCLUSION_LEVELS.indexOf(b) ? a : b);

export function toListener(listener, point, out = { x: 0, y: 0, z: 0 }, cfg = spatialAudio) {
  const dx = point.x - listener.x, dy = point.y - listener.y, dz = point.z - listener.z;
  const s = Math.sin(listener.yaw), c = Math.cos(listener.yaw);
  // right = (cos yaw, 0, -sin yaw), forward = (-sin yaw, 0, -cos yaw)
  const right = dx * c - dz * s;
  const ahead = -dx * s - dz * c;
  let up = dy;
  let forward = ahead;
  if (cfg.followPitch && listener.pitch) {
    const ps = Math.sin(listener.pitch), pc = Math.cos(listener.pitch);
    forward = ahead * pc + dy * ps;
    up = dy * pc - ahead * ps;
  }
  out.x = right;
  out.y = up * cfg.elevationScale;
  out.z = -forward;
  return out;
}

export function distanceGain(d, profile) {
  if (!(d < profile.max)) return 0;
  let g = (profile.ref / Math.max(profile.ref, d)) ** profile.rolloff;
  const fadeFrom = profile.max * (1 - (profile.fade ?? 0));
  if (d > fadeFrom) g *= (profile.max - d) / (profile.max - fadeFrom);
  return Math.max(g, profile.minGain ?? 0);
}

export function occlusionOf(level, cfg = spatialAudio) {
  return cfg.occlusion[level] ?? cfg.occlusion.clear;
}

/** Priority tiers dominate (they are whole numbers); within a tier the louder one wins. */
export const voiceScore = (priority, gain) => priority + Math.min(1, Math.max(0, gain)) * 0.99;

export function lowestVoice(voices) {
  let low = null;
  for (const v of voices) if (!low || v.score < low.score) low = v;
  return low;
}

/** Does the segment a -> b pass through the box (padded by `pad`)? (the slab test) */
export function segmentHitsBox(a, b, box, pad = 0) {
  let t0 = 0, t1 = 1;
  for (const [axis, min, max] of [['x', box.minX, box.maxX], ['y', box.minY, box.maxY], ['z', box.minZ, box.maxZ]]) {
    const d = b[axis] - a[axis], lo = min - pad, hi = max + pad;
    if (Math.abs(d) < 1e-9) { if (a[axis] < lo || a[axis] > hi) return false; continue; }
    let u0 = (lo - a[axis]) / d, u1 = (hi - a[axis]) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}
