// =============================================================================
// VIEWMODEL
// The first-person gun you see in the lower-right of the screen. It lives in
// its own little scene that is drawn AFTER the world with the depth buffer
// cleared, so the gun never pokes through walls. A "rig" copies the camera's
// position and rotation every frame; the gun hangs off the rig.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';

const DEG_TO_RAD = Math.PI / 180;

/** Builds the low-poly staple gun. Points down -Z (the way the camera looks). */
function buildStapleGun(colors) {
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

  // Where tracers start: the bottom front of the nose plate.
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.03, -0.155);
  gun.add(muzzle);

  return { gun, muzzle };
}

export function createViewmodel(weaponDef) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x4a3f55, 1.6));

  const rig = new THREE.Group(); // follows the camera
  scene.add(rig);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4); // fixed relative to the view
  keyLight.position.set(1, 2, 1);
  rig.add(keyLight);
  rig.add(keyLight.target);

  const holder = new THREE.Group(); // positioned at the resting offset; animated for kick/reload
  rig.add(holder);
  const { gun, muzzle } = buildStapleGun(weaponDef.viewmodel);
  holder.add(gun);

  const vm = feel.viewmodel;
  let kickTimer = 0; // counts down from kickReturnSeconds after each shot

  return {
    scene,

    // Call when a shot fires.
    kick() {
      kickTimer = vm.kickReturnSeconds;
    },

    // Call every rendered frame, after the camera has been placed.
    update(frameTime, camera, weapon) {
      rig.position.copy(camera.position);
      rig.quaternion.copy(camera.quaternion);

      kickTimer = Math.max(0, kickTimer - frameTime);
      const k = kickTimer / vm.kickReturnSeconds; // 1 right after firing -> 0 when settled
      const kick = k * k;

      // Reload: dip and roll down, then come back up (a smooth hump over the reload).
      const progress = weapon.reloadProgress;
      const dip = progress === null ? 0 : Math.sin(progress * Math.PI);

      holder.position.set(
        vm.offset.x,
        vm.offset.y - dip * vm.reloadDrop,
        vm.offset.z + kick * vm.kickBack,
      );
      holder.rotation.set(
        kick * vm.kickRotateDegrees * DEG_TO_RAD - dip * vm.reloadDipDegrees * DEG_TO_RAD,
        vm.aimYawDegrees * DEG_TO_RAD,
        dip * vm.reloadRollDegrees * DEG_TO_RAD,
      );
    },

    // World-space position of the gun's muzzle (where tracers start).
    getMuzzleWorldPosition(out) {
      rig.updateMatrixWorld(true);
      return muzzle.getWorldPosition(out);
    },
  };
}
