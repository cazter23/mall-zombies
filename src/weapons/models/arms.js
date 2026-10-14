// =============================================================================
// FIRST-PERSON HANDS (shared by the pistol-style weapon models)
// The player's hands and forearms holding a pistol-grip gun, in the gun's own
// coordinates (gun points down -Z, grip below its back end). Right hand wraps
// the grip; left hand braces the left side of the body and can let go during a
// reload (the model animates `leftArm`). Red polo sleeves.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../../config/feel.js';
import { placeLimb, makeBoxMesh } from '../../player/body.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function limb(color, a, b, width, depth, parent) {
  const mesh = makeBoxMesh(color);
  placeLimb(mesh, a, b, width, depth);
  parent.add(mesh);
  return mesh;
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

  // Right arm: hand around the grip, forearm running back and down out of view, red polo sleeve.
  const rightHand = block(c.skin, 0.062, 0.085, 0.075, 0.004, -0.1, 0.026, gun);
  rightHand.rotation.x = 0.3; // matches the grip's angle
  const thumb = block(c.skin, 0.02, 0.025, 0.05, -0.03, -0.055, -0.005, gun);
  thumb.name = 'gripThumb';
  if (thumbOffset) thumb.position.add(thumbOffset); // wider receivers need a lower thumb
  limb(c.skin, V(0.01, -0.13, 0.05), V(0.07, -0.38, 0.17), 0.058, 0.054, gun);
  limb(c.shirt, V(0.07, -0.38, 0.17), V(0.09, -0.5, 0.23), 0.09, 0.09, gun);

  // Left arm: palm flat on the left side (mid-body, so the nose and muzzle flash stay in view),
  // fingers curled under, forearm back-left. Grouped so it can let go of the gun during a reload.
  const leftArm = new THREE.Group();
  gun.add(leftArm);
  const palm = block(c.skin, 0.028, 0.07, 0.1, -0.042, -0.012, -0.025, leftArm);
  palm.name = 'supportPalm';
  const fingers = block(c.skin, 0.07, 0.024, 0.085, -0.012, -0.05, -0.025, leftArm);
  fingers.name = 'supportFingers';
  if (fingerSize) fingers.scale.copy(fingerSize);
  if (fingerOffset) fingers.position.add(fingerOffset);
  limb(c.skin, V(-0.05, -0.045, 0.005), V(-0.17, -0.33, 0.12), 0.056, 0.052, leftArm);
  limb(c.shirt, V(-0.17, -0.33, 0.12), V(-0.21, -0.45, 0.17), 0.09, 0.09, leftArm);
  if (leftOffset) for (const part of leftArm.children) part.position.add(leftOffset);

  return { leftArm };
}
