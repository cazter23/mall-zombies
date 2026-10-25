// =============================================================================
// FIRST-PERSON HANDS (shared by the pistol-style weapon models)
// The player's faceted hands and forearms holding a pistol-grip gun, in the gun's
// own coordinates (gun points down -Z, grip below its back end). Right hand wraps
// the grip with a shaped palm, distinct thumb, readable trigger index finger and
// grouped lower fingers; left hand braces the left side with a contoured palm,
// thumb, and 4 articulated curled support fingers, and can let go during a reload
// (the model animates `leftArm`). Tapered forearms with cuffed red polo sleeves.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../../config/feel.js';
import {
  placeLimb,
  makeBoxMesh,
  makeFacetedLimbMesh,
  buildDeformedBoxGeometry,
} from '../../player/body.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Merges an array of non-indexed BufferGeometries into a single BufferGeometry.
 */
function mergeNonIndexedGeometries(geometries) {
  let totalVertices = 0;
  for (const g of geometries) totalVertices += g.attributes.position.count;
  const positions = new Float32Array(totalVertices * 3);
  let offset = 0;
  for (const g of geometries) {
    const arr = g.attributes.position.array;
    positions.set(arr, offset);
    offset += arr.length;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  return merged;
}

// Shaped palm geometry bounded strictly within [-0.5, 0.5]^3:
// dorsal knuckle arch toward -Z, bevelled corners, and tapered wrist heel toward +Z.
const unitPalmGeo = buildDeformedBoxGeometry(2, 3, 3, (x, y, z) => {
  let nx = x;
  let ny = y;
  const nz = z;
  // Taper wrist heel (+Z) slightly and arch the knuckle line (-Z)
  if (z > 0.15) {
    const t = (z - 0.15) / 0.35;
    ny *= 1 - 0.16 * t;
    nx *= 1 - 0.12 * t;
  } else if (z < -0.15) {
    const k = (-0.15 - z) / 0.35;
    // Slight dorsal arch across the middle knuckles
    if (Math.abs(y) > 0.35) nx *= 1 - 0.12 * k;
  }
  // Bevel top/bottom dorsal outer edges so the palm reads as faceted rather than a slab
  if (Math.abs(y) > 0.32 && Math.abs(x) > 0.25) {
    nx *= 0.86;
    ny *= 0.94;
  }
  return [
    Math.max(-0.5, Math.min(0.5, nx)),
    Math.max(-0.5, Math.min(0.5, ny)),
    Math.max(-0.5, Math.min(0.5, nz)),
  ];
});

// Two-segment faceted thumb geometry bounded strictly within [-0.5, 0.5]^3:
// fuller metacarpal base at +Z, angled knuckle ridge near z = 0, tapered distal tip at -Z.
const unitThumbGeo = buildDeformedBoxGeometry(2, 2, 3, (x, y, z) => {
  let nx = x;
  let ny = y;
  if (z < 0) {
    const t = -z / 0.5; // 0 at knuckle -> 1 at thumb tip
    nx *= 1 - 0.22 * t;
    ny *= 1 - 0.24 * t;
    // Slight upward/inward pad angle toward tip
    ny += 0.06 * t * (1 - t * 0.5);
  } else {
    // Metacarpal base bevel
    const b = z / 0.5;
    if (Math.abs(y) > 0.3) nx *= 1 - 0.1 * b;
  }
  if (Math.abs(x) > 0.3 && Math.abs(y) > 0.3) {
    nx *= 0.88;
    ny *= 0.88;
  }
  return [
    Math.max(-0.5, Math.min(0.5, nx)),
    Math.max(-0.5, Math.min(0.5, ny)),
    z,
  ];
});

// 4 articulated, curled support fingers side-by-side along Z, bounded strictly within [-0.5, 0.5]^3
// so `supportFingers` keeps its exact collision/clearance box while showing 4 distinct faceted fingers.
const unitSupportFingersGeo = (() => {
  const parts = [];
  // 4 fingers (index at front -Z to pinky at back +Z) with natural reach variation
  const reaches = [0.94, 1.0, 0.95, 0.84];
  const zCenters = [-0.365, -0.12, 0.125, 0.365];
  const zWidth = 0.205;
  for (let i = 0; i < 4; i++) {
    const reach = reaches[i];
    const z0 = zCenters[i];
    const fingerGeo = buildDeformedBoxGeometry(3, 2, 1, (x, y, z) => {
      // Map x from [-0.5, 0.5] into [-0.5, -0.5 + reach]
      const u = x + 0.5; // 0 at palm base (-X) -> 1 at fingertip (+X)
      const nx = -0.5 + u * reach;
      // Two-segment curl: proximal slopes slightly down, distal curls up at the tip
      const curl = u < 0.55 ? -0.1 * (u / 0.55) : -0.1 + 0.22 * ((u - 0.55) / 0.45);
      const taperY = 1 - 0.24 * u;
      const taperZ = 1 - 0.18 * u * u;
      const ny = Math.max(-0.5, Math.min(0.5, y * taperY * 0.84 + curl));
      const nz = Math.max(-0.5, Math.min(0.5, z0 + z * zWidth * taperZ));
      return [nx, ny, nz];
    });
    parts.push(fingerGeo);
  }
  return mergeNonIndexedGeometries(parts);
})();

// 3 grouped faceted lower grip fingers (middle, ring, pinky) wrapping the front of the pistol grip,
// bounded within [-0.5, 0.5]^3.
const unitGripFingersGeo = (() => {
  const parts = [];
  const yCenters = [0.31, 0.0, -0.31];
  const xReaches = [1.0, 0.96, 0.88];
  for (let i = 0; i < 3; i++) {
    const y0 = yCenters[i];
    const reach = xReaches[i];
    const g = buildDeformedBoxGeometry(2, 1, 2, (x, y, z) => {
      const taper = 1 - 0.15 * Math.abs(x);
      const nx = x * reach;
      const ny = Math.max(-0.5, Math.min(0.5, y0 + y * 0.28 * taper));
      const nz = z * (0.85 + 0.15 * Math.cos(x * Math.PI * 0.8));
      return [nx, ny, Math.max(-0.5, Math.min(0.5, nz))];
    });
    parts.push(g);
  }
  return mergeNonIndexedGeometries(parts);
})();

function makeSkinMesh(geo, color, roughness = 0.76) {
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness, flatShading: true }));
}

/**
 * Adds a tapered forearm + cuffed employee polo sleeve (with ribbed cuff collar
 * and cream tipping stripe) from `wristPos` -> `elbowPos` -> `shoulderPos`.
 */
export function buildCuffedArmSegment(parent, wristPos, elbowPos, shoulderPos, forearmW = 0.058, forearmD = 0.054) {
  const c = feel.body.colors;

  // Tapered forearm: slimmer at wrist, fuller at elbow
  const forearm = makeFacetedLimbMesh(c.skin, 0.82, 1.05, 0.76);
  placeLimb(forearm, wristPos, elbowPos, forearmW, forearmD);
  parent.add(forearm);

  // Tapered red polo sleeve from elbow into shoulder
  const sleeve = makeFacetedLimbMesh(c.shirt, 0.96, 1.06, 0.8);
  placeLimb(sleeve, elbowPos, shoulderPos, 0.09, 0.09);
  parent.add(sleeve);

  // Ribbed polo sleeve cuff band & cream uniform tipping stripe at the elbow transition
  const cuffStart = wristPos.clone().lerp(elbowPos, 0.92);
  const cuffEnd = elbowPos.clone().lerp(shoulderPos, 0.18);
  const cuff = makeFacetedLimbMesh(c.shirtTrim ?? c.shirt, 0.96, 1.0, 0.82);
  placeLimb(cuff, cuffStart, cuffEnd, 0.094, 0.094);
  parent.add(cuff);

  const stripeStart = cuffStart.clone().lerp(cuffEnd, 0.32);
  const stripeEnd = cuffStart.clone().lerp(cuffEnd, 0.62);
  const stripe = makeFacetedLimbMesh(c.shirtStripe ?? 0xf4e8d1, 1.0, 1.0, 0.75);
  placeLimb(stripe, stripeStart, stripeEnd, 0.097, 0.097);
  parent.add(stripe);

  return { forearm, sleeve, cuff, stripe };
}

/** A skin/sleeve-colored box at (x, y, z) inside `parent`. */
export function block(color, w, h, d, x, y, z, parent) {
  const mesh = makeBoxMesh(color);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/**
 * Adds both arms to `gun`. Returns { leftArm } (a group: move/hide it to animate the left hand).
 * Anything the left hand should carry during a reload can be added to `leftArm` by the caller.
 */
export function buildPistolArms(gun, {
  leftOffset = null, thumbOffset = null, fingerSize = null, fingerOffset = null,
} = {}) {
  const c = feel.body.colors;

  // --- Right arm: faceted palm, grouped grip fingers, trigger index finger, thumb, tapered forearm + polo cuff ---
  const rightHand = makeSkinMesh(unitPalmGeo, c.skin);
  rightHand.name = 'rightPalm';
  rightHand.scale.set(0.062, 0.085, 0.075);
  rightHand.position.set(0.004, -0.1, 0.026);
  rightHand.rotation.x = 0.3; // matches the grip's angle
  gun.add(rightHand);

  // Grouped middle/ring/pinky fingers wrapping the front of the grip
  const gripFingers = makeSkinMesh(unitGripFingersGeo, c.skinShade ?? c.skin);
  gripFingers.name = 'rightGripFingers';
  gripFingers.scale.set(0.056, 0.058, 0.028);
  gripFingers.position.set(0.002, -0.105, -0.006);
  gripFingers.rotation.x = 0.3;
  gun.add(gripFingers);

  // Distinct readable index finger reaching forward onto the trigger
  const indexDrop = (thumbOffset?.y ?? 0) * 0.55;
  const indexFinger = makeSkinMesh(unitThumbGeo, c.skin);
  indexFinger.name = 'rightIndexFinger';
  indexFinger.scale.set(0.015, 0.016, 0.046);
  indexFinger.position.set(0.016, -0.064 + indexDrop, -0.008);
  indexFinger.rotation.set(0.08, -0.22, 0);
  gun.add(indexFinger);

  const thumb = makeSkinMesh(unitThumbGeo, c.skin);
  thumb.name = 'gripThumb';
  thumb.scale.set(0.02, 0.025, 0.05);
  thumb.position.set(-0.03, -0.055, -0.005);
  if (thumbOffset) thumb.position.add(thumbOffset); // wider receivers need a lower thumb
  gun.add(thumb);

  const rightSeg = buildCuffedArmSegment(
    gun,
    V(0.01, -0.13, 0.05),
    V(0.07, -0.38, 0.17),
    V(0.09, -0.5, 0.23),
    0.058,
    0.054,
  );
  rightSeg.cuff.name = 'rightCuff';

  // --- Left arm: faceted support palm, 4 curled support fingers, support thumb, tapered forearm + polo cuff ---
  const leftArm = new THREE.Group();
  gun.add(leftArm);

  const palm = makeSkinMesh(unitPalmGeo, c.skin);
  palm.name = 'supportPalm';
  palm.scale.set(0.028, 0.07, 0.1);
  palm.position.set(-0.042, -0.012, -0.025);
  leftArm.add(palm);

  // Distinct support thumb resting along the upper-back ridge of the support palm
  // (strictly within the palm's X/Y clearance so it never clips wide receivers or drums)
  const supportThumb = makeSkinMesh(unitThumbGeo, c.skinShade ?? c.skin);
  supportThumb.name = 'supportThumb';
  supportThumb.scale.set(0.015, 0.017, 0.042);
  supportThumb.position.set(-0.046, 0.012, 0.004);
  leftArm.add(supportThumb);

  const fingers = makeSkinMesh(unitSupportFingersGeo, c.skinShade ?? c.skin);
  fingers.name = 'supportFingers';
  fingers.scale.set(0.07, 0.024, 0.085);
  fingers.position.set(-0.012, -0.05, -0.025);
  if (fingerSize) fingers.scale.copy(fingerSize);
  if (fingerOffset) fingers.position.add(fingerOffset);
  leftArm.add(fingers);

  const leftSeg = buildCuffedArmSegment(
    leftArm,
    V(-0.05, -0.045, 0.005),
    V(-0.17, -0.33, 0.12),
    V(-0.21, -0.45, 0.17),
    0.056,
    0.052,
  );
  leftSeg.cuff.name = 'leftCuff';

  if (leftOffset) for (const part of leftArm.children) part.position.add(leftOffset);

  return { leftArm };
}
