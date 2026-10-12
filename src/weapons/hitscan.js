// =============================================================================
// HITSCAN
// One instant ray from the eye along the aim direction. Returns the closest
// thing it hits: a world box (wall, floor, prop) or a shootable's hitbox.
//
// A "shootable" is anything that can take hits (practice dummies now, zombies
// later). It must provide:
//   hitboxes: [{ box: THREE.Box3, part: 'head' | 'body' }]  (world space)
//   isAlive: boolean                                         (dead ones are skipped)
//   takeHit({ damage, part, point }) -> { killed: boolean }
//   splatColors: [hex, ...]                                  (particle colors when hit)
// =============================================================================

import * as THREE from 'three';

const ray = new THREE.Ray();
const scratch = new THREE.Vector3();

/**
 * @returns {{ point: THREE.Vector3, normal: THREE.Vector3, distance: number,
 *             target: object|null, part: string|null }}
 *   `target` is the shootable hit (null for walls/misses). On a complete miss,
 *   `point` is at max range and `distance` is `range`.
 */
export function castShot(origin, direction, range, colliders, shootables) {
  ray.set(origin, direction);

  const best = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: range, target: null, part: null };
  best.point.copy(origin).addScaledVector(direction, range);
  best.normal.copy(direction).negate();

  // World geometry. Boxes flagged `ignoreShots` (e.g. a dummy's walk-blocker) don't stop bullets.
  for (const box of colliders) {
    if (box.ignoreShots) continue;
    if (box.containsPoint(origin)) continue; // never hit the box we're standing inside of
    const hit = ray.intersectBox(box, scratch);
    if (!hit) continue;
    const d = hit.distanceTo(origin);
    if (d < best.distance) {
      best.distance = d;
      best.point.copy(hit);
      boxNormalAt(box, hit, best.normal);
      best.target = null;
      best.part = null;
    }
  }

  // Shootables: checked after walls so a wall in front of a target blocks the shot.
  for (const target of shootables) {
    if (!target.isAlive) continue;
    for (const hitbox of target.hitboxes) {
      const hit = ray.intersectBox(hitbox.box, scratch);
      if (!hit) continue;
      const d = hit.distanceTo(origin);
      if (d < best.distance) {
        best.distance = d;
        best.point.copy(hit);
        boxNormalAt(hitbox.box, hit, best.normal);
        best.target = target;
        best.part = hitbox.part;
      }
    }
  }

  return best;
}

// Which face of the box is `point` on? Writes that face's outward normal.
function boxNormalAt(box, point, out) {
  const faces = [
    [Math.abs(point.x - box.min.x), -1, 0, 0],
    [Math.abs(point.x - box.max.x), 1, 0, 0],
    [Math.abs(point.y - box.min.y), 0, -1, 0],
    [Math.abs(point.y - box.max.y), 0, 1, 0],
    [Math.abs(point.z - box.min.z), 0, 0, -1],
    [Math.abs(point.z - box.max.z), 0, 0, 1],
  ];
  let nearest = faces[0];
  for (const f of faces) if (f[0] < nearest[0]) nearest = f;
  return out.set(nearest[1], nearest[2], nearest[3]);
}
