// =============================================================================
// STAPLE GUN MODEL (first person)
// The low-poly staple gun plus the hands holding it, and the animation that only
// this gun has: the squeeze lever on each shot, and the left hand fetching a new
// staple strip during a reload. Everything every gun shares (recoil, sway, bob,
// ADS, the gun's reload pose) lives in weapons/viewmodel.js.
//
// A weapon model returns { root, muzzle, animate(state) }; see models/index.js.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../../config/feel.js';
import { placeLimb, makeBoxMesh } from '../../player/body.js';
import { samplePose } from '../../core/keyframes.js';

const DEG_TO_RAD = Math.PI / 180;

/** The gun itself. Points down -Z (the way the camera looks). */
function buildGun(colors) {
  const gun = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, flatShading: true });
  const body = mat(colors.bodyColor);
  const metal = mat(colors.metalColor);
  const grip = mat(colors.gripColor);

  function part(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    gun.add(mesh);
    return mesh;
  }

  // A chunky, boxy body (staple guns are short and tall, not long like a barrel).
  part(0.055, 0.075, 0.17, 0, 0, -0.04, body); // main housing
  part(0.04, 0.012, 0.15, 0, 0.043, -0.04, metal); // staple channel along the top
  part(0.06, 0.05, 0.035, 0, -0.012, -0.135, metal); // nose plate where staples come out
  part(0.018, 0.018, 0.018, 0, 0.055, -0.11, mat(colors.sightColor)); // little sight on top
  const handle = part(0.042, 0.12, 0.05, 0, -0.09, 0.02, grip); // grip at the back
  handle.rotation.x = 0.3;
  const lever = part(0.014, 0.075, 0.016, 0, -0.07, -0.06, metal); // squeeze lever / trigger
  lever.rotation.x = -0.45;

  // Where tracers and the muzzle flash start: the bottom front of the nose plate.
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.03, -0.155);
  gun.add(muzzle);

  return { gun, muzzle, lever };
}

/**
 * Hands and forearms holding the gun, in the gun's own coordinates.
 * Right hand wraps the grip; left hand braces the left side of the body.
 * Returns the left arm group (animated during reloads) and the strip it carries.
 */
function buildArms(gun, gunColors) {
  const c = feel.body.colors;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function limb(color, a, b, width, depth, parent) {
    const mesh = makeBoxMesh(color);
    placeLimb(mesh, a, b, width, depth);
    parent.add(mesh);
    return mesh;
  }
  function block(color, w, h, d, x, y, z, parent) {
    const mesh = makeBoxMesh(color);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Right arm: hand around the grip, forearm running back and down out of view, red polo sleeve.
  const rightHand = block(c.skin, 0.062, 0.085, 0.075, 0.004, -0.1, 0.026, gun);
  rightHand.rotation.x = 0.3; // matches the grip's angle
  block(c.skin, 0.02, 0.025, 0.05, -0.03, -0.055, -0.005, gun); // thumb over the top of the grip
  limb(c.skin, V(0.01, -0.13, 0.05), V(0.07, -0.38, 0.17), 0.058, 0.054, gun);
  limb(c.shirt, V(0.07, -0.38, 0.17), V(0.09, -0.5, 0.23), 0.09, 0.09, gun);

  // Left arm: palm flat on the left side (mid-body, so the nose and muzzle flash stay in view),
  // fingers curled under, forearm back-left. Grouped so it can let go of the gun during a reload.
  const leftArm = new THREE.Group();
  gun.add(leftArm);
  block(c.skin, 0.028, 0.07, 0.1, -0.042, -0.012, -0.025, leftArm); // palm
  block(c.skin, 0.07, 0.024, 0.085, -0.012, -0.05, -0.025, leftArm); // fingers under the body
  limb(c.skin, V(-0.05, -0.045, 0.005), V(-0.17, -0.33, 0.12), 0.056, 0.052, leftArm);
  limb(c.shirt, V(-0.17, -0.33, 0.12), V(-0.21, -0.45, 0.17), 0.09, 0.09, leftArm);

  // A fresh strip of staples, only visible in the left hand mid-reload.
  const strip = block(gunColors.metalColor, 0.03, 0.014, 0.12, -0.03, -0.07, -0.025, leftArm);
  strip.visible = false;

  return { leftArm, strip };
}

export function buildStapleGunModel(def) {
  const vm = def.viewmodel;
  const { gun, muzzle, lever } = buildGun(vm);
  const { leftArm, strip } = buildArms(gun, vm);
  const leverRest = lever.rotation.x;

  return {
    root: gun,
    muzzle,

    /**
     * Gun-specific animation, every rendered frame.
     * state: { sinceFire (seconds since the last trigger squeeze), reloadProgress (0..1),
     *          reloadWeight (0..1: 1 mid-reload, eases to 0 if a reload is cancelled) }
     */
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      // Squeeze lever: snaps in fast, springs back out a little slower.
      const f = vm.fire;
      let squeeze = 0;
      if (sinceFire < f.pressSeconds) squeeze = sinceFire / f.pressSeconds;
      else if (sinceFire < f.pressSeconds + f.releaseSeconds) squeeze = 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds;
      lever.rotation.x = leverRest + squeeze * f.leverDegrees * DEG_TO_RAD;

      // Left hand: lets go, fetches a strip from below, slaps it in, grabs the gun again.
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      strip.visible = reloadWeight > 0.5 && reloadProgress > r.stripVisible[0] && reloadProgress < r.stripVisible[1];
    },

    // Hide the bracing hand (e.g. while it's busy with the box cutter).
    set leftHandVisible(visible) {
      leftArm.visible = visible;
    },
  };
}
