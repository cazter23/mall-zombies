// =============================================================================
// RETURN TO SENDER MODEL (first person & the claw machine's chute display)
// The wonder weapon: a returns-desk scanner gun in returns-desk blue and white. A chunky body with a lit green screen on top (RETURN? Y/N), a wide lens
// snout with a pink emitter ring, a fat battery pack on the grip, and a rainbow label stripe down the side. Reload: the support hand slaps a fresh battery
// pack in (config: weapons.returnToSender.viewmodel.reload). Points down -Z (the way the camera looks).
// =============================================================================

import * as THREE from 'three';
import { resolveGunColors } from '../skinPalette.js';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;
const RAINBOW = ['stripeRedColor', 'stripeOrangeColor', 'stripeYellowColor', 'stripeGreenColor', 'stripeBlueColor', 'stripePurpleColor'];

function buildGun(vm) {
  const gun = new THREE.Group();
  const materials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) {
      const isMetal = color === 'metalColor';
      const isDark = color === 'darkColor' || color === 'gripColor';
      const glows = color === 'sightColor' || color === 'screenColor' || color === 'emitterColor';
      materials.set(color, new THREE.MeshStandardMaterial({
        color: vm[color],
        roughness: glows ? 0.25 : isMetal ? 0.28 : isDark ? 0.75 : 0.4,
        metalness: isMetal ? 0.65 : 0.1,
        ...(glows ? { emissive: vm[color], emissiveIntensity: 0.7 } : {}),
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
  const tube = (radiusFront, radiusBack, length, x, y, z, color, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusBack, radiusFront, length, 14, 1, false), mat(color));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // Body, with a lit screen on top and a white trim line.
  const body = box(0.1, 0.075, 0.17, 0, -0.004, 0.025, 'bodyColor');
  body.name = 'returnBody';
  box(0.104, 0.012, 0.17, 0, -0.045, 0.025, 'accentColor');
  box(0.06, 0.004, 0.07, 0, 0.036, 0.03, 'darkColor'); // the screen's bezel
  box(0.052, 0.003, 0.06, 0, 0.0385, 0.03, 'screenColor'); // the screen: RETURN? Y/N
  // The rainbow stripe down the right side (the left is the warranty sticker's).
  RAINBOW.forEach((color, i) => box(0.003, 0.007, 0.12, 0.0515, 0.026 - i * 0.0075, 0.02, color));

  // The snout: a wide lens barrel with a pink emitter ring and a dark lens.
  const snout = tube(0.034, 0.044, 0.15, 0, -0.004, -0.135, 'metalColor');
  snout.name = 'returnSnout';
  tube(0.05, 0.05, 0.014, 0, -0.004, -0.185, 'accentColor');
  const ring = tube(0.052, 0.052, 0.01, 0, -0.004, -0.2, 'emitterColor');
  ring.name = 'returnEmitter';
  tube(0.038, 0.038, 0.004, 0, -0.004, -0.207, 'darkColor'); // the lens
  box(0.012, 0.014, 0.02, 0, 0.044, -0.15, 'sightColor'); // a bead on top of the snout

  // Grip, trigger and the battery pack on the back of the grip.
  const grip = box(0.043, 0.12, 0.052, 0, -0.095, 0.028, 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box(0.012, 0.03, 0.014, 0, -0.06, -0.016, 'metalColor');
  box(0.05, 0.05, 0.03, 0, -0.045, 0.1, 'batteryColor');
  box(0.054, 0.012, 0.034, 0, -0.02, 0.1, 'darkColor');

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.004, -0.21);
  gun.add(muzzle);

  const mounts = {
    barrel: { position: [0, -0.004, -0.208], radius: 0.05, size: { w: 0.1, h: 0.1 } },
    top: { position: [-0.036, 0.04, -0.03] }, // beside the screen: clear of the sights
    side: { position: [0.052, -0.004, -0.04] },
    grip: { position: [0, -0.095, 0.028], rotation: [0.3, 0, 0], size: { w: 0.043, h: 0.12, d: 0.052 } },
    magazine: { position: [0.054, -0.012, 0.06], rotation: [0, 0, Math.PI / 2], gunId: 'returnToSender' }, // a spare pack on the right of the body
    sticker: { position: [-0.053, -0.004, 0.025] }, // the left side
  };
  return { gun, muzzle, trigger, mounts, box };
}

export function buildReturnToSenderDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildReturnToSenderModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, mounts, box } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.028, -0.027, 0),
    thumbOffset: new THREE.Vector3(0, -0.022, 0),
    fingerSize: new THREE.Vector3(0.036, 0.016, 0.06),
    fingerOffset: new THREE.Vector3(-0.018, 0.004, 0),
  });
  leftArm.name = 'returnSupportArm';
  const held = box(0.05, 0.05, 0.03, 0, -0.01, -0.025, 'batteryColor', leftArm); // the battery pack in the support hand during the reload
  held.name = 'returnHeldBattery';
  held.visible = false;
  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun, muzzle,
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      const f = vm.fire;
      const pull = sinceFire < f.pressSeconds ? sinceFire / f.pressSeconds
        : Math.max(0, 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds);
      trigger.rotation.x = pull * f.triggerDegrees * DEG_TO_RAD;
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      held.visible = reloadWeight > 0.5 && r.batteryVisible.some(([a, b]) => reloadProgress > a && reloadProgress < b);
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
