// =============================================================================
// NAIL GUN MODEL (first person & wall display)
// A precision pneumatic stick framing nailer: tall rear cylindrical piston tower
// with bolted exhaust cap, tapered yellow air-chamber body with exhaust vents,
// hex fasteners and a "DANGER · 120 PSI" warning decal, a reciprocating steel
// driver nose with a serrated safety contact foot, a brass quick-connect air
// fitting with a short crimped hose stub at the grip base, and a steeply angled
// stick-nail magazine showing a row of collated nail shanks and heads.
// Visually distinct from the wide drum-fed Heavy Coil Nailer.
// =============================================================================

import * as THREE from 'three';
import { samplePose } from '../../core/keyframes.js';
import { resolveGunColors } from '../skinPalette.js';
import { buildDeformedBoxGeometry } from '../../player/body.js';
import { buildPistolArms } from './arms.js';
import { drawType } from '../../world/typeKit.js';

const DEG_TO_RAD = Math.PI / 180;

// Tapered pneumatic chamber housing: wider and taller at the rear piston tower (+Z),
// tapering cleanly toward the front driver casting (-Z) with bevelled upper/lower edges.
const chamberGeo = buildDeformedBoxGeometry(2, 3, 4, (x, y, z) => {
  let nx = x;
  let ny = y;
  if (z < -0.05) {
    const t = (-0.05 - z) / 0.45; // 0 at mid-body -> 1 at front nose
    nx *= 1 - 0.16 * t;
    if (y > 0) ny -= 0.14 * t;
  }
  if (Math.abs(x) > 0.35 && Math.abs(y) > 0.35) {
    nx *= 0.86;
    ny *= 0.9;
  }
  return [nx, ny, z];
});

let cachedWarningTex = null;
function getWarningTexture() {
  if (cachedWarningTex) return cachedWarningTex;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#1d1d22';
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = '#f2c12e';
  ctx.fillRect(3, 3, 122, 15);
  const left = { role: 'wayfinding', size: 12, align: 'left', baseline: 'alphabetic', maxWidth: 112 };
  drawType(ctx, '! CAUTION 120 PSI', 8, 15, { ...left, role: 'hazard', size: 13, fill: '#1d1d22' });
  drawType(ctx, 'CONTACT TRIP FIRE', 8, 32, { ...left, fill: '#f1faee' });
  drawType(ctx, 'WEAR EYE SHIELD', 8, 43, { ...left, fill: '#ff5a2e' });
  cachedWarningTex = new THREE.CanvasTexture(canvas);
  cachedWarningTex.colorSpace = THREE.SRGBColorSpace;
  return cachedWarningTex;
}

/** Builds a recognizable collated stick of framing nails (nail heads, shanks, and collation tape). */
function buildCollatedNails(metalMat, brassMat, length = 0.115, count = 8) {
  const group = new THREE.Group();
  group.name = 'collatedNailStrip';
  // Top rail of overlapping nail heads
  const heads = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.004, length), metalMat);
  heads.position.set(0, 0.016, 0);
  group.add(heads);
  // Plastic/paper collation ribbon across the shanks
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.006, length * 0.98), brassMat);
  tape.position.set(0, 0.004, 0);
  group.add(tape);
  // Individual angled nail shanks visible along the strip
  const step = (length - 0.016) / Math.max(1, count - 1);
  for (let i = 0; i < count; i++) {
    const z = -length / 2 + 0.008 + i * step;
    const shank = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.028, 0.005), metalMat);
    shank.position.set(0, 0.002, z);
    shank.rotation.x = 0.18;
    group.add(shank);
  }
  return group;
}

/** The gun itself. Points down -Z (the way the camera looks). */
function buildGun(colors) {
  const gun = new THREE.Group();
  const mat = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.1, flatShading: true, ...opts });
  const body = mat(colors.bodyColor, { roughness: 0.32, metalness: 0.14 });
  const bodyShade = mat(colors.bodyShadeColor, { roughness: 0.42, metalness: 0.16 });
  const dark = mat(colors.darkColor, { roughness: 0.72, metalness: 0.1 });
  const metal = mat(colors.metalColor, { roughness: 0.24, metalness: 0.78 });
  const brass = mat(colors.brassColor, { roughness: 0.3, metalness: 0.72 });
  const sight = mat(colors.sightColor, { emissive: colors.sightColor, emissiveIntensity: 0.7, roughness: 0.2 });

  function part(w, h, d, x, y, z, material, parent = gun, geo = null) {
    const mesh = new THREE.Mesh(geo ?? new THREE.BoxGeometry(w, h, d), material);
    if (geo) mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function cyl(rTop, rBot, h, segs, x, y, z, material, parent = gun, axis = 'y') {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    else if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Tapered yellow pneumatic chamber housing & stepped dark lower chassis band (no coplanar faces)
  const housing = part(0.06, 0.075, 0.2, 0, 0.0075, -0.06, body, gun, chamberGeo);
  housing.name = 'nailHousing';
  part(0.064, 0.02, 0.204, 0, -0.04, -0.06, dark);

  // Clear rear cylindrical piston head tower & bolted exhaust cap
  cyl(0.036, 0.038, 0.088, 10, 0, 0.012, 0.004, bodyShade, gun, 'y'); // vertical piston cylinder
  cyl(0.041, 0.041, 0.012, 10, 0, 0.048, 0.004, metal, gun, 'y'); // metal head gasket collar
  const cap = cyl(0.039, 0.042, 0.024, 10, 0, 0.062, 0.004, dark, gun, 'y'); // top exhaust cap
  cap.name = 'nailPistonCap';
  // Exhaust diffuser vents on the rear of the piston cap & 4 hex bolts around the flange
  part(0.032, 0.01, 0.014, 0, 0.062, 0.038, metal);
  for (const [bx, bz] of [[-0.026, -0.018], [0.026, -0.018], [-0.026, 0.026], [0.026, 0.026]]) {
    cyl(0.0045, 0.0045, 0.008, 6, bx, 0.056, bz, metal, gun, 'y');
  }

  // Side exhaust louvres, casting ribs & hex fasteners along the housing
  for (const z of [-0.035, -0.06, -0.085]) {
    part(0.063, 0.008, 0.014, 0, 0.022, z, dark); // exhaust vents
  }
  for (const z of [-0.045, -0.11]) {
    part(0.062, 0.052, 0.01, 0, 0.004, z, bodyShade); // vertical casting ribs
  }
  for (const [y, z] of [[0.024, -0.145], [-0.015, -0.145], [-0.015, 0.022]]) {
    cyl(0.0045, 0.0045, 0.065, 6, 0, y, z, metal, gun, 'x'); // through-bolt fasteners
  }

  // Warning label decal plate on the right side of the housing
  const warnTex = getWarningTexture();
  const warnMat = warnTex
    ? new THREE.MeshStandardMaterial({ map: warnTex, roughness: 0.5, metalness: 0.1 })
    : bodyShade;
  part(0.002, 0.024, 0.064, 0.0305, 0.004, -0.075, warnMat);

  // Top sight rail & high-visibility orange-red front sight
  part(0.012, 0.012, 0.135, 0, 0.051, -0.095, dark);
  part(0.024, 0.01, 0.014, 0, 0.056, -0.032, dark); // rear notch ear
  part(0.016, 0.016, 0.014, 0, 0.064, -0.155, sight);

  // Front nose casting + reciprocating driver guide & serrated safety contact foot
  part(0.046, 0.058, 0.026, 0, -0.014, -0.166, metal); // stationary front nose block
  const nose = new THREE.Group();
  nose.name = 'nailDriverNose';
  nose.position.set(0, -0.02, -0.165);
  gun.add(nose);
  part(0.03, 0.048, 0.046, 0, -0.01, -0.02, metal, nose);
  cyl(0.011, 0.011, 0.038, 10, 0, -0.034, -0.048, metal, nose, 'z'); // cylindrical driver barrel
  // Safety contact foot (work-contact trip) + return spring around the driver tip
  part(0.024, 0.008, 0.044, 0, -0.047, -0.045, brass, nose); // lower contact trip arm
  part(0.026, 0.024, 0.008, 0, -0.036, -0.069, brass, nose); // serrated front contact foot ring
  cyl(0.006, 0.006, 0.022, 8, 0, -0.046, -0.028, dark, nose, 'z'); // contact return spring

  // Angled stick-nail magazine with twin aluminum guide rails, spring follower & visible collated nails
  const magazine = new THREE.Group();
  magazine.name = 'nailMagazine';
  magazine.position.set(0, -0.068, -0.125);
  magazine.rotation.x = -0.16;
  gun.add(magazine);
  part(0.026, 0.024, 0.132, 0, -0.006, 0, dark, magazine); // lower magazine spine
  part(0.029, 0.008, 0.136, 0, 0.01, 0, metal, magazine); // upper aluminum guide rail
  part(0.03, 0.034, 0.018, 0, -0.002, 0.062, metal, magazine); // rear magazine latch cap
  const follower = part(0.034, 0.016, 0.018, 0, 0.002, 0.03, body, magazine); // yellow spring follower tab
  const nails = buildCollatedNails(metal, brass, 0.115, 8);
  nails.position.set(0, 0.008, -0.004);
  magazine.add(nails);

  // Angled rubberized grip, trigger guard, trigger & bottom pneumatic air connector + hose stub
  const handle = part(0.042, 0.12, 0.05, 0, -0.09, 0.02, mat(colors.gripColor, { roughness: dark.roughness, metalness: dark.metalness }), gun, chamberGeo);
  handle.rotation.x = 0.3;
  for (const y of [-0.07, -0.092, -0.114]) {
    const gripRib = part(0.045, 0.008, 0.038, 0, y, 0.022, bodyShade);
    gripRib.rotation.x = 0.3;
  }
  part(0.02, 0.008, 0.052, 0, -0.082, -0.018, dark); // trigger guard bar
  const trigger = part(0.012, 0.03, 0.014, 0, -0.06, -0.025, metal);
  trigger.rotation.x = -0.2;

  // Pneumatic quick-connect air fitting & short secured air-hose stub at the bottom of the handle
  const airFitting = new THREE.Group();
  airFitting.name = 'airConnector';
  airFitting.position.set(0, -0.148, 0.038);
  airFitting.rotation.x = 0.35;
  gun.add(airFitting);
  cyl(0.013, 0.013, 0.014, 8, 0, 0, 0, metal, airFitting, 'y'); // base cap
  cyl(0.009, 0.009, 0.02, 6, 0, -0.014, 0, brass, airFitting, 'y'); // brass hex quick-coupler
  cyl(0.007, 0.008, 0.026, 8, 0, -0.032, 0.006, dark, airFitting, 'y'); // short rubber air hose stub

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
    magazine: { position: [0, -0.086, -0.125], rotation: [-0.16, 0, 0], gunId: 'nailGun' },
    sticker: { position: [-0.031, 0.008, -0.11] },
  };
  return { gun, muzzle, trigger, nose, cap, nails, follower, metal, brass, mounts };
}

/** Just the gun, no hands (for the wall-buy display). */
export function buildNailGunDisplay(def) {
  return buildGun(resolveGunColors(def)).gun;
}

export function buildNailGunModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, nose, cap, nails, follower, metal, brass, mounts } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun);
  // The fresh collated nail strip the left hand brings during a reload.
  const strip = buildCollatedNails(metal, brass, 0.15, 10);
  strip.name = 'heldNailStrip';
  strip.position.set(-0.025, -0.06, 0.02);
  strip.visible = false;
  leftArm.add(strip);

  const triggerRest = trigger.rotation.x;
  const noseRest = nose.position.z;
  const capRestY = cap.position.y;

  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun,
    muzzle,

    // state: { sinceFire, reloadProgress (0..1), reloadWeight (0..1) }; see models/index.js.
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      // Trigger pull, driver nose punch, and subtle piston cap thump on each shot.
      const f = vm.fire;
      let pull = 0;
      if (sinceFire < f.pressSeconds) pull = sinceFire / f.pressSeconds;
      else if (sinceFire < f.pressSeconds + f.releaseSeconds) {
        pull = 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds;
      }
      trigger.rotation.x = triggerRest + pull * f.triggerDegrees * DEG_TO_RAD;
      nose.position.z = noseRest - pull * f.nosePunch;
      cap.position.y = capRestY + pull * 0.004;

      // Left hand: drops away, brings a fresh strip, slides it into the back of the magazine.
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      const mid = reloadWeight > 0.5;
      strip.visible = mid && reloadProgress > r.stripVisible[0] && reloadProgress < r.stripVisible[1];
      nails.visible = !(mid && reloadProgress > r.magEmpty[0] && reloadProgress < r.magEmpty[1]);
      follower.position.z = nails.visible ? 0.03 : -0.04;
    },

    set leftHandVisible(visible) {
      leftArm.visible = visible;
    },
  };
}
