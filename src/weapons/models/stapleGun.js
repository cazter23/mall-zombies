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
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms, block } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

/** The gun itself. Points down -Z (the way the camera looks). */
function buildGun(colors) {
  const gun = new THREE.Group();
  const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.08, flatShading: true, ...opts });
  const body = mat(colors.bodyColor, { roughness: 0.32, metalness: 0.1 });
  const metal = mat(colors.metalColor, { roughness: 0.24, metalness: 0.72 });
  const grip = mat(colors.gripColor, { roughness: 0.78, metalness: 0.04 });
  const sight = mat(colors.sightColor, { emissive: colors.sightColor, emissiveIntensity: 0.7, roughness: 0.2 });

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
  part(0.018, 0.018, 0.018, 0, 0.055, -0.11, sight); // little sight on top
  const handle = part(0.042, 0.12, 0.05, 0, -0.09, 0.02, grip); // grip at the back
  handle.rotation.x = 0.3;
  const lever = part(0.014, 0.075, 0.016, 0, -0.07, -0.06, metal); // squeeze lever / trigger
  lever.rotation.x = -0.45;

  // Where tracers and the muzzle flash start: the bottom front of the nose plate.
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.03, -0.155);
  gun.add(muzzle);

  // Where upgrade parts go (models/upgradeParts.js).
  const mounts = {
    barrel: { position: [0, -0.012, -0.153], size: { w: 0.06, h: 0.05 } },
    top: { position: [-0.03, 0.049, -0.03] }, // off to the left: clear of the sight when aiming
    side: { position: [0.036, -0.012, -0.09] },
    grip: { position: [0, -0.09, 0.02], rotation: [0.3, 0, 0], size: { w: 0.042, h: 0.12, d: 0.05 } },
    magazine: { position: [0, -0.0375, -0.112] },
    sticker: { position: [-0.0285, 0.008, -0.1] }, // left side, in front of the support palm
  };
  return { gun, muzzle, lever, mounts };
}

/** Just the gun, no hands (for the wall-buy display). */
export function buildStapleGunDisplay(def) {
  return buildGun(def.viewmodel).gun;
}

export function buildStapleGunModel(def) {
  const vm = def.viewmodel;
  const { gun, muzzle, lever, mounts } = buildGun(vm);
  const { leftArm } = buildPistolArms(gun);
  // A fresh strip of staples, only visible in the left hand mid-reload.
  const strip = block(vm.metalColor, 0.03, 0.014, 0.12, -0.03, -0.07, -0.025, leftArm);
  strip.visible = false;
  const leverRest = lever.rotation.x;

  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
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
