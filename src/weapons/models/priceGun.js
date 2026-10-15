// =============================================================================
// PRICE GUN MODEL (first person)
// A supermarket price-label gun: chunky orange body, a white roll of price
// stickers on top, a print head at the front where the stickers shoot out,
// and a squeeze lever along the grip. Its own animation: the lever squeezes on
// each shot, and during a reload the left hand drops away, brings a fresh label
// roll, and swaps it for the empty one on top.
// Everything every gun shares lives in weapons/viewmodel.js.
// =============================================================================

import * as THREE from 'three';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

/** A label roll: white stickers around an orange core, axis along X. */
function buildRoll(colors, radius, width) {
  const roll = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true });
  const labels = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 10), mat(colors.labelColor));
  labels.rotation.z = Math.PI / 2;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.4, radius * 0.4, width * 1.06, 8), mat(colors.bodyColor));
  core.rotation.z = Math.PI / 2;
  roll.add(labels, core);
  return roll;
}

/** The gun itself. Points down -Z (the way the camera looks). */
function buildGun(colors) {
  const gun = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, flatShading: true });
  const body = mat(colors.bodyColor);
  const metal = mat(colors.metalColor);
  const grip = mat(colors.gripColor);

  function part(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    gun.add(mesh);
    return mesh;
  }

  const housing = part(0.052, 0.07, 0.17, 0, 0, -0.045, body); // main housing
  housing.name = 'priceHousing';
  part(0.044, 0.014, 0.13, 0, 0.042, -0.05, metal); // deck the roll sits on
  part(0.05, 0.045, 0.04, 0, -0.008, -0.145, metal); // print head
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.05, 8), grip); // ink roller
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, -0.032, -0.168);
  gun.add(roller);
  // Seat the post inside the housing; its old bottom floated above the gun.
  const sightPost = part(0.008, 0.09, 0.014, 0, 0.065, -0.127, metal);
  sightPost.name = 'priceSightPost';
  part(0.016, 0.014, 0.012, 0, 0.112, -0.13, mat(colors.sightColor)); // ...with a bright tip
  const handle = part(0.042, 0.12, 0.05, 0, -0.09, 0.02, grip); // grip at the back
  handle.rotation.x = 0.3;
  const lever = part(0.016, 0.085, 0.018, 0, -0.075, -0.052, body); // squeeze lever along the grip
  lever.rotation.x = -0.42;

  // Roll of price stickers on top, toward the back.
  const roll = buildRoll(colors, 0.03, 0.036);
  roll.position.set(0, 0.079, -0.005);
  gun.add(roll);

  // Stickers come out of the bottom front of the print head.
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.025, -0.172);
  gun.add(muzzle);

  // Where upgrade parts go (models/upgradeParts.js).
  const mounts = {
    barrel: { position: [0, -0.012, -0.168], size: { w: 0.05, h: 0.048 } },
    top: { position: [-0.03, 0.049, -0.07] }, // off to the left: clear of the sight when aiming
    side: { position: [0.034, -0.012, -0.1] },
    grip: { position: [0, -0.09, 0.02], rotation: [0.3, 0, 0], size: { w: 0.042, h: 0.12, d: 0.05 } },
    magazine: { position: [0, -0.035, -0.11] },
    sticker: { position: [-0.027, 0.008, -0.1] },
  };
  return { gun, muzzle, lever, roll, mounts };
}

/** Just the gun, no hands (for the wall-buy display). */
export function buildPriceGunDisplay(def) {
  return buildGun(def.viewmodel).gun;
}

export function buildPriceGunModel(def) {
  const vm = def.viewmodel;
  const { gun, muzzle, lever, roll, mounts } = buildGun(vm);
  const { leftArm } = buildPistolArms(gun);
  // The fresh roll the left hand brings during a reload. Placed so that when the hand presses it on
  // (its handKeys pose at the "pressed on" moment) it sits exactly where the roll on the gun goes.
  const newRoll = buildRoll(vm, 0.03, 0.036);
  const pressAt = vm.reload.rollGone[1];
  const pressed = vm.reload.handKeys.reduce((a, b) => (Math.abs(b.t - pressAt) < Math.abs(a.t - pressAt) ? b : a));
  newRoll.position.set(roll.position.x - pressed.pos[0], roll.position.y - pressed.pos[1], roll.position.z - pressed.pos[2]);
  newRoll.visible = false;
  leftArm.add(newRoll);
  const leverRest = lever.rotation.x;

  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun,
    muzzle,

    // state: { sinceFire, reloadProgress (0..1), reloadWeight (0..1) }; see models/index.js.
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      // Squeeze lever: snaps in, springs back out (quick, so full auto reads as a rapid squeeze).
      const f = vm.fire;
      let squeeze = 0;
      if (sinceFire < f.pressSeconds) squeeze = sinceFire / f.pressSeconds;
      else if (sinceFire < f.pressSeconds + f.releaseSeconds) squeeze = 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds;
      lever.rotation.x = leverRest + squeeze * f.leverDegrees * DEG_TO_RAD;

      // Left hand: lets go, fetches a fresh roll from below, swaps it onto the deck, grabs the gun.
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      const mid = reloadWeight > 0.5;
      newRoll.visible = mid && reloadProgress > r.newRollVisible[0] && reloadProgress < r.newRollVisible[1];
      roll.visible = !(mid && reloadProgress > r.rollGone[0] && reloadProgress < r.rollGone[1]);
    },

    set leftHandVisible(visible) {
      leftArm.visible = visible;
    },
  };
}
