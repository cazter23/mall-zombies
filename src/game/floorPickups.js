import * as THREE from 'three';
import { powerUps as defaults } from '../config/powerUps.js';
import { overlapsSolid, rampHeightAt } from '../world/collision.js';

// Shared clear-floor placement and swept collection for incentives and closing keys.
export function createFloorPickups(colliders, config = defaults) {
  const ray = new THREE.Ray();
  const intersection = new THREE.Vector3();
  const probe = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();

  // A floor close to the corpse's feet; never silently drop to the storey underneath.
  function floorAt(x, z, nearY) {
    let best = null;
    for (const box of colliders) {
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
      if (Math.abs(box.max.y - nearY) <= config.floorTolerance && (best === null || box.max.y > best)) best = box.max.y;
    }
    for (const ramp of colliders.ramps ?? []) {
      const y = rampHeightAt(ramp, x, z);
      if (y !== null && Math.abs(y - nearY) <= config.floorTolerance && (best === null || y > best)) best = y;
    }
    return best;
  }

  function clearLine(a, b) {
    ray.origin.copy(a).y += config.sightHeight;
    to.copy(b).y += config.sightHeight;
    ray.direction.subVectors(to, ray.origin);
    const distance = ray.direction.length();
    if (distance < defaults.sightEpsilon) return true;
    ray.direction.divideScalar(distance);
    return !colliders.some((box) => ray.intersectBox(box, intersection) && intersection.distanceTo(ray.origin) < distance);
  }

  function findPosition(at) {
    for (const radius of config.placementRadii) {
      for (let i = 0; i < (radius === 0 ? 1 : config.placementDirections); i++) {
        const angle = i * Math.PI * 2 / config.placementDirections;
        probe.set(at.x + Math.cos(angle) * radius, at.y, at.z + Math.sin(angle) * radius);
        const y = floorAt(probe.x, probe.z, at.y);
        if (y === null) continue;
        probe.y = y;
        if (overlapsSolid(probe, config.clearRadius, config.clearHeight, colliders, 0)) continue;
        if (!clearLine(at, probe)) continue;
        return probe.clone();
      }
    }
    return null;
  }

  function reached(player, position) {
    // Swept collection: a fast slide must not jump over a small pickup between ticks.
    const a = player.prevPosition ?? player.position;
    const b = player.position;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((position.x - a.x) * dx + (position.z - a.z) * dz) / lengthSq)) : 1;
    from.lerpVectors(a, b, t);
    return Math.abs(from.y - position.y) <= config.floorTolerance
        && Math.hypot(from.x - position.x, from.z - position.z) <= config.pickupRadius
        && clearLine(from, position);
  }

  return { findPosition, clearLine, reached };
}

export function pickupDirection(player, position, { floorGap, up, down }) {
  const dx = position.x - player.position.x;
  const dz = position.z - player.position.z;
  const dy = position.y - player.position.y;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const ahead = -dx * sin - dz * cos, right = dx * cos - dz * sin;
  return {
    meters: Math.round(Math.hypot(dx, dz)),
    bearing: Math.atan2(right, ahead),
    floor: dy > floorGap ? up : dy < -floorGap ? down : null,
  };
}
