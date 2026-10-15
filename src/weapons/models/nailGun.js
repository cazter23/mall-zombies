// =============================================================================
// NAIL GUN MODEL (first person)
// A chunky yellow-and-black framing nailer: long body, a round piston cap on
// top at the back, a steel nose (the driver) at the front, and a magazine of
// nails under the front half of the body. Its own animation: the trigger
// on each shot plus a quick nose "punch", and during a reload the left hand
// drops away, comes back with a fresh strip of nails and slides it into the
// back of the magazine.
// Everything every gun shares lives in weapons/viewmodel.js.
// =============================================================================

import * as THREE from 'three';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms, block } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

/** The gun itself. Points down -Z (the way the camera looks). */
function buildGun(colors) {
  const gun = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, flatShading: true });
  const body = mat(colors.bodyColor);
  const dark = mat(colors.darkColor);
  const metal = mat(colors.metalColor);

  function part(w, h, d, x, y, z, material, parent = gun) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Housing and the black band under it meet edge to edge (no overlap), and the band sticks out a hair
  // past the housing at the front and back, so no two faces sit in the same place and flicker.
  part(0.06, 0.075, 0.2, 0, 0.0075, -0.06, body); // main housing (y -0.03 .. 0.045)
  part(0.064, 0.02, 0.204, 0, -0.04, -0.06, dark); // black lower band (y -0.05 .. -0.03)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 10), dark); // piston cap
  cap.position.set(0, 0.055, 0.0);
  gun.add(cap);
  part(0.012, 0.012, 0.15, 0, 0.051, -0.09, dark); // top rail...
  part(0.016, 0.016, 0.014, 0, 0.064, -0.155, mat(colors.sightColor)); // ...with a bright front sight

  // The nose (driver guide): steel, sticks out the front and points a little down. It "punches" on each shot.
  const nose = new THREE.Group();
  nose.position.set(0, -0.02, -0.165);
  gun.add(nose);
  part(0.03, 0.05, 0.05, 0, -0.01, -0.02, metal, nose);
  part(0.018, 0.02, 0.03, 0, -0.035, -0.05, metal, nose); // the tip

  // Magazine: a box of nails under the front half of the body, angled slightly down toward the nose.
  // It stops in front of the trigger, so it never pokes through the hand on the grip.
  const magazine = new THREE.Group();
  magazine.position.set(0, -0.068, -0.125);
  magazine.rotation.x = -0.12;
  gun.add(magazine);
  part(0.026, 0.035, 0.12, 0, 0, 0, dark, magazine);
  const nails = part(0.014, 0.01, 0.11, 0, 0.022, 0, metal, magazine); // the nail heads showing along the top

  const handle = part(0.042, 0.12, 0.05, 0, -0.09, 0.02, dark); // grip at the back
  handle.rotation.x = 0.3;
  const trigger = part(0.012, 0.03, 0.014, 0, -0.06, -0.025, metal); // trigger in front of the grip
  trigger.rotation.x = -0.2;

  // Nails leave from the tip of the nose.
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.06, -0.24);
  gun.add(muzzle);

  // Where upgrade parts go (models/upgradeParts.js). The barrel parts ride on the punching nose.
  const mounts = {
    barrel: { parent: nose, position: [0, -0.035, -0.062], size: { w: 0.02, h: 0.022 } },
    top: { position: [-0.026, 0.045, -0.09] },
    side: { position: [0.039, -0.01, -0.11] },
    grip: { position: [0, -0.09, 0.02], rotation: [0.3, 0, 0], size: { w: 0.042, h: 0.12, d: 0.05 } },
    magazine: { position: [0, -0.086, -0.125], rotation: [-0.12, 0, 0] },
    sticker: { position: [-0.031, 0.008, -0.11] },
  };
  return { gun, muzzle, trigger, nose, nails, mounts };
}

/** Just the gun, no hands (for the wall-buy display). */
export function buildNailGunDisplay(def) {
  return buildGun(def.viewmodel).gun;
}

export function buildNailGunModel(def) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, nose, nails, mounts } = buildGun(vm);
  const { leftArm } = buildPistolArms(gun);
  // The fresh nail strip the left hand brings during a reload.
  const strip = block(vm.metalColor, 0.014, 0.014, 0.16, -0.025, -0.06, 0.02, leftArm);
  strip.visible = false;
  const triggerRest = trigger.rotation.x;
  const noseRest = nose.position.z;

  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun,
    muzzle,

    // state: { sinceFire, reloadProgress (0..1), reloadWeight (0..1) }; see models/index.js.
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      // Trigger pull and the nose punching forward (the driver firing), then easing back.
      const f = vm.fire;
      let pull = 0;
      if (sinceFire < f.pressSeconds) pull = sinceFire / f.pressSeconds;
      else if (sinceFire < f.pressSeconds + f.releaseSeconds) pull = 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds;
      trigger.rotation.x = triggerRest + pull * f.triggerDegrees * DEG_TO_RAD;
      nose.position.z = noseRest - pull * f.nosePunch;

      // Left hand: drops away, brings a fresh strip, slides it into the back of the magazine.
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      const mid = reloadWeight > 0.5;
      strip.visible = mid && reloadProgress > r.stripVisible[0] && reloadProgress < r.stripVisible[1];
      nails.visible = !(mid && reloadProgress > r.magEmpty[0] && reloadProgress < r.magEmpty[1]);
    },

    set leftHandVisible(visible) {
      leftArm.visible = visible;
    },
  };
}
