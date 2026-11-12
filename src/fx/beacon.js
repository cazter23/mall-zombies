// =============================================================================
// BEACONS (config/look.js beacons): a soft column of light rising from something you should go and get (a power-up, a
// Closing Time key, Kiosk Kevin's open cart), and a ring pulsing out across the floor under it, so it reads over a crowd
// and across a bright room. Additive and unlit, so it glows in the dark late rounds too. Two draw calls (one without the
// ring); geometry is shared by every beacon and materials by colour (flagged userData.shared: a beacon's dispose() frees
// only its own ring material), so a beacon costs nothing to make.
//
//   const b = createBeacon({ color, ring = true, base = 0 })  b.root: a Group to place (its origin on the floor, or `base`
//                                                             metres below the column's foot)
//   b.update(time)                                            the ring's pulse (seconds; any running clock)
// =============================================================================

import * as THREE from 'three';
import { look } from '../config/look.js';

let shared = null;
function sharedParts() {
  if (shared) return shared;
  const { height, radius, ringRadius } = look.beacons;
  // Bright at the foot, gone at the top: a 1 x 32 alpha ramp (a DataTexture, so no canvas is needed).
  const steps = 32;
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    data.set([255, 255, 255, Math.round(255 * (1 - t) ** 1.6)], i * 4);
  }
  const ramp = new THREE.DataTexture(data, 1, steps);
  ramp.needsUpdate = true;
  const column = new THREE.CylinderGeometry(radius, radius * 1.25, height, 10, 1, true);
  column.translate(0, height / 2, 0);
  const ring = new THREE.RingGeometry(ringRadius * 0.8, ringRadius, 32);
  ring.rotateX(-Math.PI / 2);
  column.userData.shared = true; // (shared by every beacon: never disposed with one; tests skip these)
  ring.userData.shared = true;
  shared = { ramp, column, ring, materials: new Map() };
  return shared;
}

function materialsFor(color) {
  const parts = sharedParts();
  if (!parts.materials.has(color)) {
    const common = { color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
    parts.materials.set(color, {
      column: new THREE.MeshBasicMaterial({ ...common, map: parts.ramp, side: THREE.DoubleSide, opacity: look.beacons.opacity }),
      ring: new THREE.MeshBasicMaterial({ ...common, opacity: look.beacons.ringOpacity }),
    });
    for (const m of Object.values(parts.materials.get(color))) m.userData.shared = true;
  }
  return parts.materials.get(color);
}

export function createBeacon({ color, ring = true, base = 0 } = {}) {
  const parts = sharedParts();
  const mats = materialsFor(color);
  const root = new THREE.Group();
  root.name = 'beacon';
  const column = new THREE.Mesh(parts.column, mats.column);
  column.position.y = base;
  column.renderOrder = 2; // (after the opaque world, so the additive glow layers on top)
  root.add(column);
  let pulse = null;
  if (ring) {
    pulse = new THREE.Mesh(parts.ring, mats.ring.clone()); // (its own copy: each ring fades on its own beat)
    pulse.material.userData.shared = false;
    pulse.position.y = look.beacons.ringLift;
    pulse.renderOrder = 2;
    root.add(pulse);
  }
  return {
    root,
    update(time) {
      if (!pulse) return;
      const t = (time / look.beacons.pulseSeconds) % 1;
      const s = 0.7 + t * 0.9;
      pulse.scale.set(s, 1, s);
      pulse.material.opacity = look.beacons.ringOpacity * (1 - t);
    },
    dispose() {
      pulse?.material.dispose();
      root.removeFromParent();
    },
  };
}
