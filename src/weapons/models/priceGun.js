// =============================================================================
// PRICE GUN MODEL (first person & wall display)
// A supermarket price-label tagger (Monarch/Meto style): sloped faceted orange
// housing, semi-exposed top label roll with visible paper feed ribbon, price-band
// selector dial wheel, front print head with ink roller and peel bar, a small
// printed "$9.99" price sticker emerging near the muzzle, an enclosed lower
// trigger-guard bow with a wide squeeze lever, and modest store inventory branding.
// Animation: the lever squeezes, the label roll and feed roller index forward, and
// the emerging sticker pulses out on each shot; during reload the left hand swaps
// a fresh label roll onto the top cradle.
// =============================================================================

import * as THREE from 'three';
import { samplePose } from '../../core/keyframes.js';
import { resolveGunColors } from '../skinPalette.js';
import { buildDeformedBoxGeometry } from '../../player/body.js';
import { buildPistolArms } from './arms.js';
import { drawType } from '../../world/typeKit.js';

const DEG_TO_RAD = Math.PI / 180;

// Sloped supermarket price-gun housing: rounded/arched rear roll cradle sloping down to a
// narrower front print-head snout, with bevelled upper cheeks. Bounded in [-0.5, 0.5]^3.
const housingGeo = buildDeformedBoxGeometry(2, 3, 4, (x, y, z) => {
  let nx = x;
  let ny = y;
  // Front snout (-Z) slopes down on top and tapers slightly in width
  if (z < -0.05) {
    const t = (-0.05 - z) / 0.45; // 0 at mid-body -> 1 at front nose
    if (y > 0) ny = y * (1 - 0.34 * t) - 0.08 * t;
    nx *= 1 - 0.1 * t;
  } else if (z > 0.2) {
    // Rear tail bevel
    const r = (z - 0.2) / 0.3;
    if (y < 0) ny += 0.1 * r;
    nx *= 1 - 0.08 * r;
  }
  if (Math.abs(x) > 0.35 && Math.abs(y) > 0.35) {
    nx *= 0.88;
    ny *= 0.92;
  }
  return [nx, ny, z];
});

let cachedBrandTex = null;
function getBrandTexture() {
  if (cachedBrandTex) return cachedBrandTex;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#1f232a';
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(3, 3, 122, 12);
  drawType(ctx, 'PRICEMASTER', 8, 31, { role: 'stencil', size: 14, fill: '#f6f2e6', align: 'left', baseline: 'alphabetic', maxWidth: 112 });
  drawType(ctx, 'MM-04', 88, 42, { role: 'wayfinding', size: 12, fill: '#ffd23f', align: 'left', baseline: 'alphabetic', maxWidth: 34 });
  cachedBrandTex = new THREE.CanvasTexture(canvas);
  cachedBrandTex.colorSpace = THREE.SRGBColorSpace;
  return cachedBrandTex;
}

/** A label roll: white stickers with red retail edge bands around a notched orange core, axis along X. */
function buildRoll(colors, radius, width) {
  const roll = new THREE.Group();
  roll.name = 'priceLabelRoll';
  const mat = (color, roughness = 0.68, metalness = 0.08) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });

  const labels = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 12), mat(colors.labelColor, 0.72));
  labels.rotation.z = Math.PI / 2;
  roll.add(labels);

  // Red "SALE / PRICE" retail stripe bands along both edges of the sticker roll
  const bandMat = mat(colors.saleColor, 0.65);
  for (const x of [-width * 0.36, width * 0.36]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.0008, radius + 0.0008, width * 0.14, 12), bandMat);
    band.rotation.z = Math.PI / 2;
    band.position.x = x;
    roll.add(band);
  }

  // Orange plastic inner spool & dark spindle hub
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.44, radius * 0.44, width * 1.08, 8),
    mat(colors.bodyColor, 0.4),
  );
  core.rotation.z = Math.PI / 2;
  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width * 1.16, 8),
    mat(colors.darkColor, 0.75),
  );
  spindle.rotation.z = Math.PI / 2;
  // Cross-bar on the spool so rotation is visually readable when firing
  const spoke = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.1, radius * 0.78, 0.006),
    mat(colors.bodyColor, 0.4),
  );
  roll.add(core, spindle, spoke);
  return roll;
}

/** The gun itself. Points down -Z (the way the camera looks). */
function buildGun(colors) {
  const gun = new THREE.Group();
  const mat = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.08, flatShading: true, ...opts });
  const body = mat(colors.bodyColor, { roughness: 0.34, metalness: 0.08 });
  const bodyShade = mat(colors.bodyShadeColor, { roughness: 0.42, metalness: 0.08 });
  const metal = mat(colors.metalColor, { roughness: 0.26, metalness: 0.72 });
  const grip = mat(colors.darkColor, { roughness: 0.78, metalness: 0.06 });
  const labelMat = mat(colors.labelColor, { roughness: 0.7, metalness: 0.04 });
  const saleRed = mat(colors.saleColor, { roughness: 0.55, metalness: 0.06 });
  const sight = mat(colors.sightColor, { emissive: colors.sightColor, emissiveIntensity: 0.7, roughness: 0.2 });

  function part(w, h, d, x, y, z, material, geo = null, parent = gun) {
    const mesh = new THREE.Mesh(geo ?? new THREE.BoxGeometry(w, h, d), material);
    if (geo) mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Sloped/faceted main housing
  const housing = part(0.052, 0.072, 0.172, 0, 0, -0.045, body, housingGeo);
  housing.name = 'priceHousing';

  // Lower scuff/chassis rail & recessed side grip ribs (wear & layered contrast)
  part(0.054, 0.014, 0.156, 0, -0.032, -0.042, grip);
  for (const z of [-0.015, -0.04, -0.065]) {
    part(0.055, 0.022, 0.012, 0, -0.004, z, bodyShade);
  }

  // Partially exposed top label-roll cradle cheeks & metal feed deck
  part(0.044, 0.012, 0.132, 0, 0.038, -0.05, metal); // feed deck
  for (const x of [-0.022, 0.022]) {
    const cheek = part(0.005, 0.034, 0.056, x, 0.054, -0.005, bodyShade);
    cheek.rotation.x = 0.18;
  }

  // Visible paper label ribbon feeding forward from the roll down into the print head
  const feedRibbon = part(0.032, 0.004, 0.092, 0, 0.052, -0.062, labelMat);
  feedRibbon.rotation.x = 0.36;
  const feedStripe = part(0.033, 0.0045, 0.014, 0, 0.043, -0.088, saleRed);
  feedStripe.rotation.x = 0.36;

  // Front print-head snout, price-band selector dial wheel & ink feed roller
  part(0.05, 0.046, 0.042, 0, -0.008, -0.145, metal); // print head
  part(0.046, 0.012, 0.018, 0, -0.024, -0.162, metal); // peel bar lip

  // Price-band selector dial on the right side of the print head
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.012, 10), grip);
  dial.rotation.z = Math.PI / 2;
  dial.position.set(0.028, 0.004, -0.112);
  gun.add(dial);
  const dialCap = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.015, 8), body);
  dialCap.rotation.z = Math.PI / 2;
  dialCap.position.set(0.029, 0.004, -0.112);
  gun.add(dialCap);

  // Front ink / feed roller
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.05, 10), grip);
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, -0.032, -0.168);
  gun.add(roller);
  const rollerAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.056, 8), metal);
  rollerAxle.rotation.z = Math.PI / 2;
  rollerAxle.position.set(0, -0.032, -0.168);
  gun.add(rollerAxle);

  // Small printed price label emerging near the front peel bar
  const emergingLabel = new THREE.Group();
  emergingLabel.name = 'emergingPriceLabel';
  emergingLabel.position.set(0, -0.02, -0.168);
  emergingLabel.rotation.x = 0.28;
  gun.add(emergingLabel);
  part(0.028, 0.0025, 0.022, 0, 0, -0.008, labelMat, null, emergingLabel);
  part(0.0285, 0.003, 0.005, 0, 0.0004, -0.015, saleRed, null, emergingLabel); // red "SALE" header bar
  part(0.018, 0.003, 0.004, 0, 0.0004, -0.006, grip, null, emergingLabel); // printed "$9.99" digits bar

  // Restrained retail branding badge on the right housing cheek
  const brandTex = getBrandTexture();
  const brandMat = brandTex
    ? new THREE.MeshStandardMaterial({ map: brandTex, roughness: 0.5, metalness: 0.1 })
    : grip;
  part(0.002, 0.022, 0.058, 0.0265, 0.005, -0.038, brandMat);

  // Sight post seated inside the housing + glowing sight bead
  const sightPost = part(0.008, 0.09, 0.014, 0, 0.065, -0.125, metal);
  sightPost.name = 'priceSightPost';
  part(0.016, 0.014, 0.012, 0, 0.112, -0.128, sight);

  // Contoured grip handle, enclosed trigger-guard bow & squeeze lever
  const handle = part(0.042, 0.12, 0.05, 0, -0.09, 0.02, mat(colors.gripColor, { roughness: grip.roughness, metalness: grip.metalness }), housingGeo);
  handle.rotation.x = 0.3;
  // Trigger guard bow looping from the bottom of the handle forward to the underside of the snout
  const guardBottom = part(0.026, 0.01, 0.095, 0, -0.132, -0.032, grip);
  guardBottom.rotation.x = -0.18;
  const guardFront = part(0.026, 0.088, 0.01, 0, -0.08, -0.082, grip);
  guardFront.rotation.x = -0.36;

  // Squeeze lever inside the guard
  const lever = part(0.018, 0.085, 0.02, 0, -0.075, -0.052, body);
  lever.rotation.x = -0.42;

  // Roll of price stickers on top, toward the back.
  const roll = buildRoll(colors, 0.03, 0.036);
  roll.name = 'priceRoll';
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
    magazine: { position: [0, -0.035, -0.11], gunId: 'priceGun' },
    sticker: { position: [-0.027, 0.008, -0.1] },
  };
  return { gun, muzzle, lever, roll, roller, emergingLabel, mounts };
}

/** Just the gun, no hands (for the wall-buy display). */
export function buildPriceGunDisplay(def) {
  return buildGun(resolveGunColors(def)).gun;
}

export function buildPriceGunModel(def, skinId) {
  const vm = def.viewmodel;
  const colors = resolveGunColors(def, skinId);
  const { gun, muzzle, lever, roll, roller, emergingLabel, mounts } = buildGun(colors);
  const { leftArm } = buildPistolArms(gun);
  // The fresh roll the left hand brings during a reload. Placed so that when the hand presses it on
  // (its handKeys pose at the "pressed on" moment) it sits exactly where the roll on the gun goes.
  const newRoll = buildRoll(colors, 0.03, 0.036);
  newRoll.name = 'heldPriceRoll';
  const pressAt = vm.reload.rollGone[1];
  const pressed = vm.reload.handKeys.reduce((a, b) => (Math.abs(b.t - pressAt) < Math.abs(a.t - pressAt) ? b : a));
  newRoll.position.set(roll.position.x - pressed.pos[0], roll.position.y - pressed.pos[1], roll.position.z - pressed.pos[2]);
  newRoll.visible = false;
  leftArm.add(newRoll);

  const leverRest = lever.rotation.x;
  const labelRestZ = emergingLabel.position.z;
  const labelRestRotX = emergingLabel.rotation.x;

  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun,
    muzzle,

    // state: { sinceFire, reloadProgress (0..1), reloadWeight (0..1) }; see models/index.js.
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      // Squeeze lever + label roll/roller/sticker feed motion on each shot.
      const f = vm.fire;
      let squeeze = 0;
      if (sinceFire < f.pressSeconds) squeeze = sinceFire / f.pressSeconds;
      else if (sinceFire < f.pressSeconds + f.releaseSeconds) {
        squeeze = 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds;
      }
      lever.rotation.x = leverRest + squeeze * f.leverDegrees * DEG_TO_RAD;
      roll.rotation.x = -squeeze * 0.42;
      roller.rotation.x = squeeze * 0.65;
      emergingLabel.position.z = labelRestZ - squeeze * 0.008;
      emergingLabel.rotation.x = labelRestRotX + squeeze * 0.2;

      // Left hand: lets go, fetches a fresh roll from below, swaps it onto the deck, grabs the gun.
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.position.y -= .32 * (1 - reloadWeight);
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
