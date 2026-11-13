// =============================================================================
// BLAST: the explosion of a gun with `blast` in config/weapons.js (the Bottle Rocket Bazooka). Every other gun hits what its ray or ball touches;
// a blast hurts everything around a POINT. DOM-free and pure (tests/blast.test.js), so it runs headless; playerGun.js applies what it finds.
//
//   blastFalloff(distance, blast)       1 at the centre, blast.edgeFraction at blast.radius, 0 beyond (a straight line in between)
//   findInBlast(centre, blast, colliders, shootables)   -> [{ target, distance }], nearest first: every live ZOMBIE (a target with a `type`, not
//                                       `noRewards`: never Sunny, fans or dummies) whose nearest hitbox point is within blast.radius of the centre,
//                                       with no wall between the centre and its body (a wall shields it)
//   selfBlastDamage({ eye, feetY }, centre, blast, colliders, maxHealth, multiplier)   -> what your OWN blast does to you: maxHealth x blast.self.share
//                                       x the falloff (from the nearest point of you, a line from your feet to your eye), x `multiplier` (stats.ownBlastDamage: 0 in the
//                                       Hi-Vis Vest: 0.01), never more than maxHealth x blast.self.maxShare, so it can never kill you from full health;
//                                       0 behind a wall, and 0 when it comes to less than blast.self.ignoreBelow (the vest's scratch).
// The damage each zombie takes is the gun's own maths (weapons/gunStats.js hitDamage, with hit.blastDistance), so tiers and stats apply.
// =============================================================================

import * as THREE from 'three';
import { castShot } from './hitscan.js';

const closest = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const centreOf = new THREE.Vector3();
const feet = new THREE.Vector3();

export function blastFalloff(distance, blast) {
  if (!(distance <= blast.radius)) return 0;
  const t = Math.max(0, distance) / blast.radius;
  return 1 + (blast.edgeFraction - 1) * t;
}

/** Distance from `point` to the nearest point of the target's hitboxes (0 inside one). */
function distanceTo(target, point) {
  let best = Infinity;
  for (const hitbox of target.hitboxes ?? []) {
    hitbox.box.clampPoint(point, closest);
    best = Math.min(best, closest.distanceTo(point));
  }
  return best;
}

/** Nothing solid on the straight line from `from` to `to`. */
function clearLine(from, to, colliders) {
  const distance = from.distanceTo(to);
  if (distance < 1e-3) return true;
  toTarget.copy(to).sub(from).divideScalar(distance);
  return !castShot(from, toTarget, distance, colliders, []).worldHit;
}

export function findInBlast(centre, blast, colliders, shootables) {
  const found = [];
  for (const target of shootables) {
    if (!target.isAlive || !target.type || target.noRewards) continue;
    const distance = distanceTo(target, centre);
    if (distance > blast.radius) continue;
    const body = (target.hitboxes.find((h) => h.part === 'body') ?? target.hitboxes[0]).box;
    if (!clearLine(centre, body.getCenter(centreOf), colliders)) continue;
    found.push({ target, distance });
  }
  return found.sort((a, b) => a.distance - b.distance);
}

export function selfBlastDamage({ eye, feetY }, centre, blast, colliders, maxHealth, multiplier = 1) {
  const self = blast.self;
  if (!self || multiplier <= 0) return 0;
  feet.set(eye.x, Math.max(feetY, Math.min(eye.y, centre.y)), eye.z); // the nearest point of you (a rocket at your feet is measured from your feet)
  const near = feet.distanceTo(centre);
  const falloff = blastFalloff(near, blast);
  if (falloff <= 0 || !clearLine(centre, eye, colliders)) return 0;
  const damage = Math.min(maxHealth * self.share * falloff * multiplier, maxHealth * self.maxShare);
  return damage < (self.ignoreBelow ?? 0) ? 0 : damage; // (a scratch under ignoreBelow is nothing: the Hi-Vis Vest)
}
