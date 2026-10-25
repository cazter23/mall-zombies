// =============================================================================
// STAPLE GUN MODEL (first person & wall display)
// A heavy-duty office/display tacker (Swingline/Arrow T50 style): faceted red
// stamped-steel housing, strong hinged upper compression lever with ribbed rubber
// palm pad, full-length chrome bottom staple channel with spring-pusher latch,
// stepped chrome driver nose plate, side staple-level inspection windows showing
// silver collated staples, and a "STAPLE-PRO T50" office inventory label.
// Animation: squeezing fires both the lower trigger lever and upper hinged handle;
// reloading pulls out the rear pusher rod while the left hand slaps a fresh
// U-channel strip of staples into the track.
// =============================================================================

import * as THREE from 'three';
import { samplePose } from '../../core/keyframes.js';
import { buildDeformedBoxGeometry } from '../../player/body.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

// Faceted staple-gun housing: sloped front brow, stamped side bevels, and angled rear cap.
const stapleBodyGeo = buildDeformedBoxGeometry(2, 3, 4, (x, y, z) => {
  let nx = x;
  let ny = y;
  if (z < -0.15 && y > 0) {
    const t = (-0.15 - z) / 0.35;
    ny -= 0.16 * t;
    nx *= 1 - 0.08 * t;
  }
  if (Math.abs(x) > 0.35 && Math.abs(y) > 0.35) {
    nx *= 0.88;
    ny *= 0.92;
  }
  return [nx, ny, z];
});

let cachedOfficeTex = null;
function getOfficeBrandTexture() {
  if (cachedOfficeTex) return cachedOfficeTex;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#f1faee';
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = '#d62839';
  ctx.fillRect(0, 0, 128, 15);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('STAPLE-PRO T50', 7, 11);
  ctx.fillStyle = '#1d1626';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('OFFICE SUPPLY #12', 7, 30);
  ctx.fillText('USE 1/2" CROWN', 7, 42);
  cachedOfficeTex = new THREE.CanvasTexture(canvas);
  cachedOfficeTex.colorSpace = THREE.SRGBColorSpace;
  return cachedOfficeTex;
}

/** Builds a recognizable U-channel strip of collated office staples. */
function buildStapleStrip(metalMat, crownMat) {
  const g = new THREE.Group();
  g.name = 'stapleStrip';
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.004, 0.12), crownMat);
  crown.position.set(0, 0.005, 0);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.12), metalMat);
  legL.position.set(-0.012, 0, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.12), metalMat);
  legR.position.set(0.012, 0, 0);
  g.add(crown, legL, legR);
  return g;
}

/** The gun itself. Points down -Z (the way the camera looks). */
function buildGun(colors) {
  const gun = new THREE.Group();
  const mat = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.08, flatShading: true, ...opts });
  const body = mat(colors.bodyColor, { roughness: 0.32, metalness: 0.14 });
  const bodyDark = mat(0xa31b28, { roughness: 0.4, metalness: 0.14 });
  const metal = mat(colors.metalColor, { roughness: 0.22, metalness: 0.78 });
  const chromeBright = mat(0xd8dde4, { roughness: 0.18, metalness: 0.85 });
  const grip = mat(colors.gripColor, { roughness: 0.82, metalness: 0.04 });
  const sight = mat(colors.sightColor, { emissive: colors.sightColor, emissiveIntensity: 0.7, roughness: 0.2 });

  function part(w, h, d, x, y, z, material, geo = null, parent = gun) {
    const mesh = new THREE.Mesh(geo ?? new THREE.BoxGeometry(w, h, d), material);
    if (geo) mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Faceted stamped-steel main housing
  const housing = part(0.055, 0.072, 0.17, 0, 0, -0.04, body, stapleBodyGeo);
  housing.name = 'stapleHousing';

  // Stamped side reinforcement ribs & chrome pivot pins
  for (const z of [-0.01, -0.07]) {
    part(0.058, 0.014, 0.042, 0, 0.008, z, bodyDark);
  }
  for (const [y, z] of [[0.018, -0.105], [-0.016, -0.095], [0.012, 0.025]]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 8), metal);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0, y, z);
    gun.add(pin);
  }

  // Full-length chrome staple channel along the bottom & rear spring-pusher latch
  const channel = part(0.046, 0.014, 0.176, 0, -0.036, -0.04, metal);
  channel.name = 'stapleChannel';
  const pusherRod = new THREE.Group();
  pusherRod.name = 'staplePusher';
  pusherRod.position.set(0, -0.036, 0.052);
  gun.add(pusherRod);
  part(0.036, 0.012, 0.024, 0, 0, 0, metal, null, pusherRod);
  part(0.042, 0.022, 0.01, 0, -0.004, 0.014, grip, null, pusherRod); // black finger-pull tab

  // Side staple inspection windows with visible silver staple strip inside
  part(0.057, 0.012, 0.078, 0, -0.02, -0.052, grip); // recessed dark window slot
  const windowStaples = part(0.058, 0.007, 0.064, 0, -0.02, -0.052, chromeBright);
  windowStaples.name = 'visibleStapleStrip';

  // Distinct stepped chrome driver nose plate at the front
  part(0.06, 0.052, 0.032, 0, -0.012, -0.134, metal, stapleBodyGeo);
  part(0.044, 0.056, 0.014, 0, -0.011, -0.148, chromeBright); // front driver blade guide plate
  part(0.022, 0.008, 0.006, 0, -0.035, -0.153, grip); // bottom staple exit slot

  // Strong hinged upper lever silhouette (pivoted near the front brow, split sight groove down the center)
  const upperLever = new THREE.Group();
  upperLever.name = 'stapleUpperLever';
  upperLever.position.set(0, 0.034, -0.095);
  gun.add(upperLever);
  // Twin side arms of the hinged top handle (leaves center sight line clear for ADS)
  for (const x of [-0.015, 0.015]) {
    const arm = part(0.014, 0.014, 0.145, x, 0.008, 0.068, metal, null, upperLever);
    arm.rotation.x = 0.055;
  }
  // Rear palm bridge & molded rubber palm cushion on top of the hinged lever
  const palmBridge = part(0.046, 0.014, 0.068, 0, 0.013, 0.112, body, stapleBodyGeo, upperLever);
  palmBridge.rotation.x = 0.05;
  const rubberPad = part(0.042, 0.009, 0.058, 0, 0.02, 0.114, grip, stapleBodyGeo, upperLever);
  rubberPad.rotation.x = 0.05;
  for (const z of [0.094, 0.112, 0.13]) {
    part(0.044, 0.004, 0.006, 0, 0.024, z, bodyDark, null, upperLever);
  }

  // Front sight bead on top of the nose
  part(0.018, 0.018, 0.018, 0, 0.055, -0.11, sight);

  // Rear grip with rubberized palm scales + lower squeeze trigger lever
  const handle = part(0.042, 0.12, 0.05, 0, -0.09, 0.02, grip, stapleBodyGeo);
  handle.rotation.x = 0.3;
  for (const y of [-0.068, -0.09, -0.112]) {
    const rib = part(0.045, 0.008, 0.036, 0, y, 0.022, bodyDark);
    rib.rotation.x = 0.3;
  }

  const lever = part(0.016, 0.078, 0.018, 0, -0.07, -0.06, metal);
  lever.rotation.x = -0.45;
  part(0.018, 0.058, 0.008, 0, -0.004, -0.006, grip, null, lever); // rubberized finger pad on trigger lever

  // Office-supply inventory sticker on the right side of the housing
  const brandTex = getOfficeBrandTexture();
  const brandMat = brandTex
    ? new THREE.MeshStandardMaterial({ map: brandTex, roughness: 0.55, metalness: 0.06 })
    : chromeBright;
  part(0.002, 0.022, 0.058, 0.0282, 0.01, -0.042, brandMat);

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
    magazine: { position: [0, -0.0375, -0.112], gunId: 'stapleGun' },
    sticker: { position: [-0.0285, 0.008, -0.1] }, // left side, in front of the support palm
  };
  return { gun, muzzle, lever, upperLever, pusherRod, windowStaples, metal, chromeBright, mounts };
}

/** Just the gun, no hands (for the wall-buy display). */
export function buildStapleGunDisplay(def) {
  return buildGun(def.viewmodel).gun;
}

export function buildStapleGunModel(def) {
  const vm = def.viewmodel;
  const { gun, muzzle, lever, upperLever, pusherRod, windowStaples, metal, chromeBright, mounts } = buildGun(vm);
  const { leftArm } = buildPistolArms(gun);
  // A fresh U-channel strip of staples, only visible in the left hand mid-reload.
  const strip = buildStapleStrip(metal, chromeBright);
  strip.name = 'heldStapleStrip';
  strip.position.set(-0.03, -0.07, -0.025);
  strip.visible = false;
  leftArm.add(strip);

  const leverRest = lever.rotation.x;
  const pusherRestZ = pusherRod.position.z;

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
      // Squeeze lever + hinged upper handle compress together on each shot.
      const f = vm.fire;
      let squeeze = 0;
      if (sinceFire < f.pressSeconds) squeeze = sinceFire / f.pressSeconds;
      else if (sinceFire < f.pressSeconds + f.releaseSeconds) {
        squeeze = 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds;
      }
      lever.rotation.x = leverRest + squeeze * f.leverDegrees * DEG_TO_RAD;
      upperLever.rotation.x = -squeeze * 0.12;

      // Left hand: lets go, fetches a strip from below, slaps it in, grabs the gun again.
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      const mid = reloadWeight > 0.5;
      strip.visible = mid && reloadProgress > r.stripVisible[0] && reloadProgress < r.stripVisible[1];
      windowStaples.visible = !(mid && reloadProgress > 0.16 && reloadProgress < r.stripVisible[1]);
      // Rear pusher rod slides out when opening the track and snaps shut at 0.86
      const pullOut = mid && reloadProgress > 0.12 && reloadProgress < 0.86
        ? Math.min(1, (reloadProgress - 0.12) / 0.08) * Math.min(1, (0.86 - reloadProgress) / 0.06)
        : 0;
      pusherRod.position.z = pusherRestZ + pullOut * 0.038;
    },

    // Hide the bracing hand (e.g. while it's busy with the box cutter).
    set leftHandVisible(visible) {
      leftArm.visible = visible;
    },
  };
}
