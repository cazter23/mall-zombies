// =============================================================================
// FOAM DART BLASTER MODEL (first person & wall display)
// A chunky blue-and-yellow 90s toy aisle burst rifle: faceted injection-molded
// clamshell receiver with visible center parting seam and screw bosses, ribbed
// tactical foregrip, shaped skeletonized shoulder stock with orange bumper pad,
// exposed 8-chamber side dart drum loaded with blue/orange foam darts, and
// "FOAM STORM · AGES 8-80" toy branding.
// =============================================================================

import * as THREE from 'three';
import { resolveGunColors } from '../skinPalette.js';
import { samplePose } from '../../core/keyframes.js';
import { buildDeformedBoxGeometry } from '../../player/body.js';
import { buildPistolArms } from './arms.js';
import { drawType } from '../../world/typeKit.js';

const DEG_TO_RAD = Math.PI / 180;

// Faceted clamshell toy receiver: angled upper cheek planes and sloped front shroud.
const blasterShellGeo = buildDeformedBoxGeometry(2, 3, 4, (x, y, z) => {
  let nx = x;
  let ny = y;
  if (z < -0.15) {
    const t = (-0.15 - z) / 0.35;
    nx *= 1 - 0.14 * t;
    if (y > 0) ny -= 0.1 * t;
  }
  if (Math.abs(x) > 0.35 && Math.abs(y) > 0.35) {
    nx *= 0.85;
    ny *= 0.9;
  }
  return [nx, ny, z];
});

let cachedToyBrandTex = null;
function getToyBrandTexture() {
  if (cachedToyBrandTex) return cachedToyBrandTex;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 56;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#153a66';
  ctx.fillRect(0, 0, 160, 56);
  ctx.fillStyle = '#ffb800';
  ctx.fillRect(4, 4, 152, 24);
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(4, 24, 152, 5);
  drawType(ctx, 'FOAM STORM', 10, 23, { role: 'toyBrand', size: 20, fill: '#1d1626', align: 'left', baseline: 'alphabetic', maxWidth: 140, outline: false });
  drawType(ctx, 'AGES 8-80 · PLAY TIME', 10, 46, { role: 'toyBody', size: 12, fill: '#f1faee', align: 'left', baseline: 'alphabetic', maxWidth: 140 });
  cachedToyBrandTex = new THREE.CanvasTexture(canvas);
  cachedToyBrandTex.colorSpace = THREE.SRGBColorSpace;
  return cachedToyBrandTex;
}

function buildGun(vm) {
  const gun = new THREE.Group();
  const materials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) {
      const isDark = color === 'darkColor' || color === 'gripColor';
      const isSight = color === 'sightColor' || color === 'accentColor';
      materials.set(color, new THREE.MeshStandardMaterial({
        color: vm[color],
        roughness: isSight ? 0.2 : isDark ? 0.74 : 0.3,
        metalness: isDark ? 0.05 : 0.08,
        ...(isSight ? { emissive: vm[color], emissiveIntensity: 0.7 } : {}),
        flatShading: true,
      }));
    }
    return materials.get(color);
  };
  const box = (w, h, d, x, y, z, color, parent = gun, geo = null) => {
    const mesh = new THREE.Mesh(geo ?? new THREE.BoxGeometry(w, h, d), mat(color));
    if (geo) mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (radius, length, x, y, z, color, parent, axis = 'z') => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), mat(color));
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    else mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // Faceted blue clamshell receiver & yellow lower accent rail
  const housing = box(0.082, 0.085, 0.23, 0, 0.005, -0.07, 'bodyColor', gun, blasterShellGeo);
  housing.name = 'foamHousing';
  box(0.085, 0.024, 0.24, 0, -0.05, -0.07, 'accentColor');

  // Molded plastic clamshell parting seam along the top/rear spine & screw bosses on the right shell
  box(0.004, 0.088, 0.234, 0, 0.006, -0.07, 'darkColor');
  for (const z of [-0.01, -0.07, -0.13, -0.17]) {
    box(0.085, 0.01, 0.014, 0, 0.024, z, 'darkColor'); // upper vent slots
    cylinder(0.004, 0.084, 0, -0.018, z, 'darkColor', gun, 'x'); // molded screw bosses
  }

  // Toy branding & "AGES 8-80" warning plaque on the right receiver side
  const brandTex = getToyBrandTexture();
  if (brandTex) {
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(0.002, 0.028, 0.082),
      new THREE.MeshStandardMaterial({ map: brandTex, roughness: 0.38, metalness: 0.06 }),
    );
    plaque.position.set(0.0415, 0.004, -0.065);
    gun.add(plaque);
  } else {
    box(0.003, 0.024, 0.078, 0.0415, 0.004, -0.065, 'accentColor');
  }

  // Ribbed pump-style foregrip under the front half of the receiver
  const foregrip = box(0.058, 0.032, 0.105, 0, -0.068, -0.145, 'gripColor', gun, blasterShellGeo);
  foregrip.name = 'foamForegrip';
  for (const z of [-0.108, -0.128, -0.148, -0.168, -0.188]) {
    box(0.062, 0.012, 0.009, 0, -0.076, z, 'accentColor');
  }

  // Sights & barrel with bright safety-orange toy muzzle ring
  box(0.032, 0.03, 0.065, 0, 0.063, 0.005, 'darkColor'); // rear rail
  box(0.008, 0.05, 0.012, 0, 0.065, -0.185, 'darkColor'); // front sight post
  box(0.014, 0.014, 0.016, 0, 0.091, -0.19, 'sightColor'); // clear sight above drum
  cylinder(0.027, 0.1, 0, 0.006, -0.22, 'accentColor', gun);
  cylinder(0.031, 0.025, 0, 0.006, -0.275, 'muzzleColor', gun);
  cylinder(0.02, 0.002, 0, 0.006, -0.289, 'darkColor', gun); // dark muzzle opening

  // Contoured pistol grip, orange trigger & shaped skeletonized toy stock
  const grip = box(0.042, 0.12, 0.05, 0, -0.095, 0.025, 'gripColor', gun, blasterShellGeo);
  grip.rotation.x = 0.3;
  for (const y of [-0.072, -0.094, -0.116]) {
    const gripRib = box(0.045, 0.007, 0.036, 0, y, 0.026, 'bodyColor');
    gripRib.rotation.x = 0.3;
  }

  // Shaped stock: upper cheek rest, angled lower strut, and yellow/orange ribbed buttpad
  const stockTop = box(0.064, 0.034, 0.088, 0, 0.012, 0.088, 'bodyColor', gun, blasterShellGeo);
  stockTop.name = 'foamStock';
  stockTop.rotation.x = -0.06;
  const stockStrut = box(0.044, 0.02, 0.082, 0, -0.024, 0.088, 'darkColor');
  stockStrut.rotation.x = 0.18;
  box(0.066, 0.074, 0.018, 0, -0.004, 0.132, 'accentColor', gun, blasterShellGeo);
  box(0.068, 0.078, 0.012, 0, -0.004, 0.145, 'muzzleColor', gun, blasterShellGeo); // orange rubberized buttplate

  const trigger = box(0.012, 0.03, 0.014, 0, -0.065, -0.017, 'muzzleColor');

  // Exposed rotary dart drum on the left side
  const drum = new THREE.Group();
  drum.name = 'dartDrum';
  drum.position.set(-0.065, 0.025, -0.075);
  gun.add(drum);
  cylinder(0.061, 0.075, 0, 0, 0, 'accentColor', drum, 'x');
  cylinder(0.049, 0.078, 0, 0, 0, 'bodyColor', drum, 'x');
  cylinder(0.018, 0.082, 0, 0, 0, 'muzzleColor', drum, 'x'); // orange center spindle cap
  // Foam darts and safety-orange tips visible around the outside of the drum
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const y = Math.cos(angle) * 0.037;
    const z = Math.sin(angle) * 0.037;
    cylinder(0.008, 0.022, -0.046, y, z, 'dartColor', drum, 'x');
    cylinder(0.009, 0.006, -0.06, y, z, 'muzzleColor', drum, 'x');
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.006, -0.292);
  gun.add(muzzle);

  // Where upgrade parts go (models/upgradeParts.js).
  const mounts = {
    barrel: { position: [0, 0.006, -0.289], radius: 0.028, size: { w: 0.064, h: 0.064 } },
    top: { position: [-0.028, 0.0475, 0.03] },
    side: { position: [0.05, -0.02, -0.15] },
    grip: { position: [0, -0.095, 0.025], rotation: [0.3, 0, 0], size: { w: 0.042, h: 0.12, d: 0.05 } },
    magazine: { position: [0, -0.0625, -0.11], gunId: 'foamDartBlaster' },
    sticker: { position: [-0.0425, 0, -0.16] }, // between the drum and the barrel
    build: { position: [-0.041, 0, 0.01] }, // the Build-A-Blaster patch: the housing's left side behind the drum (in front of it, the drum hides it in your hands)
  };
  return { gun, muzzle, trigger, drum, mounts };
}

export function buildFoamDartBlasterDisplay(def) {
  return buildGun(resolveGunColors(def)).gun;
}

export function buildFoamDartBlasterModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, drum, mounts } = buildGun(resolveGunColors(def, skinId));
  // Left hand braces the ribbed foregrip below and ahead of the side-mounted dart drum
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.004, -0.036, -0.065),
  });
  const heldDrum = drum.clone();
  heldDrum.name = 'heldDartDrum';
  heldDrum.position.set(-0.045, -0.04, -0.025);
  heldDrum.visible = false;
  leftArm.add(heldDrum);
  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun,
    muzzle,
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      const f = vm.fire;
      const pull = sinceFire < f.pressSeconds
        ? sinceFire / f.pressSeconds
        : Math.max(0, 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds);
      trigger.rotation.x = pull * f.triggerDegrees * DEG_TO_RAD;
      drum.rotation.x = pull * 0.28;
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      const inWindow = ([a, b]) => reloadWeight > 0.5 && reloadProgress > a && reloadProgress < b;
      drum.visible = !inWindow(r.drumGone);
      heldDrum.visible = inWindow(r.oldDrumVisible) || inWindow(r.newDrumVisible);
    },
    set leftHandVisible(visible) {
      leftArm.visible = visible;
    },
  };
}
