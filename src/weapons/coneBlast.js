// =============================================================================
// CONE BLAST (a wide push instead of a bullet: the Leaf Blower)
//
// Everything a cone attack needs, as three small pieces, tested alone (tests/coneBlast.test.js):
//   findInCone  who is inside the cone: in range, inside the angle, with no wall in between
//   blowAway    what the blast does to one zombie: shove it back, and lay it down if it is close (the zombies' own stagger / slip, so no new state)
//   createBlastPay  how often a zombie that keeps being blown pays the +10 for a hit (a stream must not pay +10 every pulse)
//
// The numbers are the gun's `cone` block in config/weapons.js; playerGun.js calls these once per pulse.
// A target is anything shootable: { isAlive, hitboxes: [{ box, part }] } (and, for blowAway, a zombie's staggerAway / applySlip).
// =============================================================================

import * as THREE from 'three';
import { castShot } from './hitscan.js';

const RAD = Math.PI / 180;
const centre = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const dir = new THREE.Vector3();

/**
 * The point a cone aims at on a target: the middle of its body box, at the height where the aim line passes it (kept inside the box). Aiming
 * straight ahead therefore reaches a zombie standing right at your feet, whose middle is far below the muzzle: the blast is a wide gust, not a
 * laser, so height is forgiving and only the sideways angle counts.
 */
function aimPoint(target, origin, direction, out) {
  const box = (target.hitboxes.find((h) => h.part === 'body') ?? target.hitboxes[0])?.box;
  if (!box) return null;
  box.getCenter(out);
  const flat = Math.hypot(direction.x, direction.z);
  if (flat > 1e-6) {
    const along = Math.hypot(out.x - origin.x, out.z - origin.z) / flat; // how far along the aim line, at this sideways distance
    out.y = Math.min(box.max.y, Math.max(box.min.y, origin.y + direction.y * along));
  }
  return out;
}

/**
 * Everything alive inside the cone, nearest first.
 *   cone: { range, halfAngleDegrees, targetRadius }   targetRadius = how wide a body counts as (m), so a zombie half in the cone's edge is caught
 * Returns [{ target, distance, angle (radians), point }]. A wall between the muzzle and the target's middle blocks it (boxes flagged ignoreShots don't).
 */
export function findInCone(origin, direction, cone, colliders, shootables) {
  const found = [];
  const half = cone.halfAngleDegrees * RAD;
  for (const target of shootables) {
    if (!target.isAlive || !target.hitboxes?.length) continue;
    if (!aimPoint(target, origin, direction, centre)) continue;
    toTarget.copy(centre).sub(origin);
    const distance = toTarget.length();
    if (distance > cone.range || distance < 1e-6) continue;
    const angle = Math.acos(Math.min(1, Math.max(-1, toTarget.dot(direction) / distance)));
    if (angle > half + Math.atan2(cone.targetRadius, distance)) continue; // outside the angle (a wide body at the edge still counts)
    dir.copy(toTarget).divideScalar(distance);
    const ray = castShot(origin, dir, distance, colliders, []);
    if (ray.worldHit) continue; // a wall (or a prop) is in the way
    found.push({ target, distance, angle, point: centre.clone() });
  }
  return found.sort((a, b) => a.distance - b.distance);
}

/**
 * Blow one zombie away from `origin`. Stronger up close (`strength` runs from 1 at the muzzle to cone.farFraction at the cone's far end), gentler on a
 * Mascot (cone.mascotScale), and a zombie within cone.knockdownRange also goes down for cone.knockdownSeconds. Bosses are untouched (their
 * staggerAway / applySlip refuse). A zombie that is already down is left sliding (a fresh stagger would cut its fall short).
 * Returns { pushed, knockedDown }.
 */
export function blowAway(target, origin, cone, distance) {
  const none = { pushed: false, knockedDown: false };
  if (typeof target.staggerAway !== 'function' || target.slipTimer > 0) return none;
  const strength = 1 + (cone.farFraction - 1) * Math.min(1, distance / cone.range);
  const weight = target.type?.mascot ? cone.mascotScale : 1;
  const pushed = target.staggerAway(origin, { seconds: cone.staggerSeconds, knockback: cone.knockback * strength * weight, drag: cone.drag });
  const knockedDown = pushed && distance <= cone.knockdownRange && target.applySlip(cone.knockdownSeconds, cone.knockdownDrag) === true;
  return { pushed, knockedDown };
}

/**
 * Who gets paid the hit points: the first pulse that touches a zombie, then again only after `everyPulses` pulses of the same stream, so holding the
 * trigger on a crowd earns about what a stream of bullets would, not +10 each per pulse. `pulse()` once per pulse; `take(target)` = pay it now?
 */
export function createBlastPay(everyPulses) {
  let pulse = 0;
  let last = new WeakMap();
  return {
    pulse() { pulse += 1; },
    take(target) {
      const before = last.get(target);
      if (before !== undefined && pulse - before < everyPulses) return false;
      last.set(target, pulse);
      return true;
    },
    reset() { pulse = 0; last = new WeakMap(); },
  };
}
