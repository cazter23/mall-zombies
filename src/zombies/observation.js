// Fixed-tick sight test. Uses gameplay aim and the unzoomed view, never render
// interpolation or room culling. Other actors intentionally do not occlude it.
import * as THREE from 'three';
import { feel } from '../config/feel.js';
const eye = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3();
const up = new THREE.Vector3(), delta = new THREE.Vector3(), point = new THREE.Vector3(), hit = new THREE.Vector3();
const ray = new THREE.Ray();
export function isObserved(z, player, colliders) {
  player.getAim(eye, forward);
  right.crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
  up.crossVectors(right, forward).normalize();
  const cfg = z.type.observation;
  const padding = z.observed ? cfg.edgeReleasePadding : cfg.edgePadding;
  const vertical = Math.tan(THREE.MathUtils.degToRad(feel.camera.fov / 2 + padding));
  const horizontal = vertical * (player.camera?.aspect ?? 1);
  for (const height of cfg.sampleHeights) {
    point.copy(z.position); point.y += height;
    delta.subVectors(point, eye);
    const depth = delta.dot(forward), distance = delta.length();
    if (depth <= 0 || depth > feel.camera.far) continue;
    if (Math.abs(delta.dot(right)) > depth * horizontal + z.type.radius ||
        Math.abs(delta.dot(up)) > depth * vertical) continue;
    ray.set(eye, delta.normalize());
    if (!colliders.some(b => !b.ignoreShots && ray.intersectBox(b, hit) && hit.distanceTo(eye) < distance)) return true;
  }
  return false;
}
