// =============================================================================
// HITSCAN
// One instant ray from the eye along the aim direction. Returns the closest
// thing it hits: a world box (wall, floor, prop) or a shootable's hitbox.
// A piercing shot (maxTargets > 1, e.g. the Nail Gun) goes on through up to that
// many shootables in a line, still stopped by the first wall.
//
// A "shootable" is anything that can take hits (practice dummies now, zombies
// later). It must provide:
//   hitboxes: [{ box: THREE.Box3, part: 'head' | 'body' }]  (world space)
//     Optional localBox and toLocal/toWorld matrices give a rotated part an exact box for shots.
//   isAlive: boolean                                         (dead ones are skipped)
//   takeHit({ damage, part, point }) -> { killed: boolean }
//   splatColors: [hex, ...]                                  (particle colors when hit)
// =============================================================================

import * as THREE from 'three';

const ray = new THREE.Ray();
const localRay = new THREE.Ray();
const scratch = new THREE.Vector3();
const worldPoint = new THREE.Vector3();

/**
 * @returns {{ point: THREE.Vector3, normal: THREE.Vector3, distance: number,
 *             target: object|null, part: string|null,
 *             hits: [{ target, part, point, normal, distance }], end: THREE.Vector3 }}
 *   `target`/`part`/`point` are the first thing hit (target null for walls/misses). On a
 *   complete miss, `point` is at max range and `distance` is `range`.
 *   `hits`: every shootable hit, nearest first (at most `maxTargets`, all in front of the first wall).
 *   `end`: where the shot stops (for the tracer): the last target if it ran out of pierce, else
 *   the wall / max range. `endNormal`: the wall's outward normal there.
 *   `worldHit`: { box, point } only when the ray reaches a real world collider (after any pierce),
 *   otherwise null. Cosmetic impacts use it without changing damage or target-hit accounting.
 */
export function castShot(origin, direction, range, colliders, shootables, maxTargets = 1) {
  ray.set(origin, direction);

  const best = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: range, target: null, part: null };
  let wallBox = null;
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
      wallBox = box;
      best.distance = d;
      best.point.copy(hit);
      boxNormalAt(box, hit, best.normal);
      best.target = null;
      best.part = null;
    }
  }

  // Shootables: each one's nearest hitbox along the ray, if it's in front of the wall.
  // (Checked after walls so a wall in front of a target blocks the shot.)
  const wallDistance = best.distance;
  const hits = [];
  for (const target of shootables) {
    if (!target.isAlive) continue;
    let nearest = null;
    for (const hitbox of target.hitboxes) {
      const { box, localBox, toLocal, toWorld, part } = hitbox;
      const hit = localBox
        ? localRay.copy(ray).applyMatrix4(toLocal).intersectBox(localBox, scratch)
        : ray.intersectBox(box, scratch);
      if (!hit) continue;
      const point = localBox ? worldPoint.copy(hit).applyMatrix4(toWorld) : hit;
      const d = point.distanceTo(origin);
      if (d < wallDistance && (!nearest || d < nearest.distance)) {
        nearest = { target, part, point: point.clone(), normal: new THREE.Vector3(), distance: d };
        boxNormalAt(localBox ?? box, hit, nearest.normal);
        if (localBox) nearest.normal.transformDirection(toWorld);
      }
    }
    if (nearest) hits.push(nearest);
  }
  hits.sort((a, b) => a.distance - b.distance);
  if (hits.length > maxTargets) hits.length = maxTargets;

  const end = best.point.clone(); // wall or max range
  const endNormal = best.normal.clone();
  if (hits.length > 0) {
    const first = hits[0];
    best.distance = first.distance;
    best.point.copy(first.point);
    best.normal.copy(first.normal);
    best.target = first.target;
    best.part = first.part;
    if (hits.length === maxTargets) end.copy(hits[hits.length - 1].point); // pierce used up: stops in the last one
  }
  best.hits = hits;
  best.end = end;
  best.endNormal = endNormal; // the wall's facing at `end` (for dust puffs)
  // Cosmetic surface metadata: null on a miss or when the shot stopped inside a target.
  best.worldHit = wallBox && hits.length < maxTargets ? { box: wallBox, point: end.clone() } : null;
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
