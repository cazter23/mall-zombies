// =============================================================================
// LEAF BLOWER MODEL (first person & the claw machine's chute display)
// A one-handed garden-centre blower: an orange motor housing with a red fuel tank on its back, a long ribbed nozzle that flares at the mouth, and a
// pistol grip with a trigger. It has no magazine and no reload, so the animation is only the trigger and a small shiver while it runs (config:
// weapons.leafBlower.viewmodel). Points down -Z (the way the camera looks).
// =============================================================================

import * as THREE from 'three';
import { resolveGunColors } from '../skinPalette.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

function buildGun(vm) {
  const gun = new THREE.Group();
  const materials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) {
      const isMetal = color === 'metalColor';
      const isDark = color === 'darkColor' || color === 'gripColor';
      const isSight = color === 'sightColor';
      materials.set(color, new THREE.MeshStandardMaterial({
        color: vm[color],
        roughness: isSight ? 0.25 : isMetal ? 0.3 : isDark ? 0.75 : 0.45,
        metalness: isMetal ? 0.6 : 0.08,
        ...(isSight ? { emissive: vm[color], emissiveIntensity: 0.6 } : {}),
        flatShading: true,
      }));
    }
    return materials.get(color);
  };
  const box = (w, h, d, x, y, z, color, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  // A cylinder (or a cone, with two radii) lying along Z.
  const tube = (radiusFront, radiusBack, length, x, y, z, color, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusBack, radiusFront, length, 14, 1, false), mat(color));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // Motor housing, with a dark intake grille at the back and a vent stripe each side.
  const housing = box(0.1, 0.07, 0.15, 0, -0.004, 0.035, 'bodyColor');
  housing.name = 'blowerHousing';
  box(0.104, 0.012, 0.15, 0, -0.04, 0.035, 'accentColor'); // green skirt under it
  for (const z of [0.07, 0.092, 0.114]) box(0.104, 0.05, 0.007, 0, 0.0, z, 'darkColor'); // intake slats at the back
  box(0.106, 0.012, 0.06, 0, 0.012, -0.01, 'darkColor'); // vent stripe, both sides at once

  // The fuel tank, on the back and top.
  const tank = box(0.07, 0.07, 0.12, 0, 0.068, 0.055, 'tankColor');
  tank.name = 'blowerTank';
  box(0.074, 0.012, 0.124, 0, 0.1, 0.055, 'darkColor'); // cap plate
  box(0.02, 0.022, 0.02, 0, 0.114, 0.075, 'metalColor'); // filler cap
  box(0.004, 0.044, 0.05, 0.0365, 0.068, 0.055, 'sightColor'); // the level window on the right side

  // Nozzle: a long tube from the housing, ribbed with hose clamps, flaring at the mouth.
  const nozzle = tube(0.028, 0.032, 0.26, 0, -0.004, -0.14, 'metalColor');
  nozzle.name = 'blowerNozzle';
  for (const z of [-0.08, -0.17, -0.25]) tube(0.036, 0.036, 0.012, 0, -0.004, z, 'accentColor');
  const mouth = tube(0.05, 0.034, 0.045, 0, -0.004, -0.292, 'metalColor'); // flares out at the front
  mouth.name = 'blowerMouth';
  tube(0.043, 0.043, 0.004, 0, -0.004, -0.316, 'darkColor'); // the dark bore
  box(0.012, 0.014, 0.02, 0, 0.035, -0.28, 'sightColor'); // a bead on top of the mouth

  // Grip and trigger: the pistol grip every gun uses, so the same hands fit.
  const grip = box(0.043, 0.12, 0.052, 0, -0.095, 0.028, 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box(0.012, 0.03, 0.014, 0, -0.06, -0.016, 'metalColor');

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.004, -0.318);
  gun.add(muzzle);

  // Where upgrade parts go (models/upgradeParts.js).
  const mounts = {
    barrel: { position: [0, -0.004, -0.316], radius: 0.05, size: { w: 0.1, h: 0.1 } },
    top: { position: [-0.026, 0.103, 0.05] }, // on the tank's cap plate, left of the filler cap
    side: { position: [0.052, -0.004, -0.02] },
    grip: { position: [0, -0.095, 0.028], rotation: [0.3, 0, 0], size: { w: 0.043, h: 0.12, d: 0.052 } },
    magazine: { position: [0.054, -0.004, 0.05], rotation: [0, 0, Math.PI / 2], gunId: 'leafBlower' }, // a spare can on the right of the housing
    sticker: { position: [-0.053, -0.004, 0.035] }, // the left side of the housing
    build: { position: [-0.03, -0.004, -0.125] }, // the Build-A-Blaster patch: the blower tube's left side (at the housing it sat under your face)
  };
  return { gun, muzzle, trigger, mounts };
}

export function buildLeafBlowerDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildLeafBlowerModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, mounts } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.028, -0.027, 0),
    thumbOffset: new THREE.Vector3(0, -0.022, 0),
    fingerSize: new THREE.Vector3(0.036, 0.016, 0.06),
    fingerOffset: new THREE.Vector3(-0.018, 0.004, 0),
  });
  leftArm.name = 'blowerSupportArm';
  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun, muzzle,
    animate({ sinceFire }) {
      const f = vm.fire;
      const pull = sinceFire < f.pressSeconds ? sinceFire / f.pressSeconds
        : Math.max(0, 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds);
      trigger.rotation.x = pull * f.triggerDegrees * DEG_TO_RAD;
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
