// =============================================================================
// TENNIS BALL LAUNCHER MODEL (first person & the claw machine's chute display)
// A sporting-goods blue pump launcher: a fat barrel tube with a white trim ring and a dark bore, a receiver with a loading port on top, a clear hopper
// tube above it stacked with a few tennis balls, and the usual pistol grip. Reload: the support hand fetches a ball from below and drops it in the port
// (config: weapons.tennisBallLauncher.viewmodel.reload). Points down -Z (the way the camera looks).
// =============================================================================

import * as THREE from 'three';
import { resolveGunColors } from '../skinPalette.js';
import { samplePose } from '../../core/keyframes.js';
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
      const isBall = color === 'ballColor';
      materials.set(color, new THREE.MeshStandardMaterial({
        color: vm[color],
        roughness: isBall ? 0.95 : isSight ? 0.25 : isMetal ? 0.3 : isDark ? 0.75 : 0.4,
        metalness: isMetal ? 0.6 : 0.08,
        ...(isSight ? { emissive: vm[color], emissiveIntensity: 0.55 } : {}),
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
  const tube = (radius, length, x, y, z, color, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 14, 1, false), mat(color));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const ball = (radius, x, y, z, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 7), mat('ballColor'));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // Receiver, with a dark loading port cut into the top.
  const receiver = box(0.1, 0.07, 0.13, 0, -0.008, 0.03, 'bodyColor');
  receiver.name = 'launcherReceiver';
  box(0.104, 0.014, 0.13, 0, -0.048, 0.03, 'accentColor');
  box(0.05, 0.004, 0.05, 0, 0.03, 0.03, 'darkColor'); // the loading port

  // The barrel: a fat blue tube with white trim rings and a dark bore.
  const barrel = tube(0.04, 0.3, 0, -0.004, -0.17, 'bodyColor');
  barrel.name = 'launcherBarrel';
  for (const z of [-0.07, -0.17, -0.27]) tube(0.0425, 0.012, 0, -0.004, z, 'accentColor');
  tube(0.046, 0.026, 0, -0.004, -0.322, 'metalColor'); // the muzzle ring
  tube(0.034, 0.004, 0, -0.004, -0.336, 'darkColor'); // the bore

  // The hopper: a clear tube standing on the receiver's port, with balls stacked inside, and a top cap.
  const hopper = new THREE.Group();
  hopper.name = 'launcherHopper';
  hopper.position.set(0, 0.034, 0.03);
  gun.add(hopper);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.1, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: vm.glassColor, transparent: true, opacity: 0.35, roughness: 0.15, side: THREE.DoubleSide }));
  glass.position.y = 0.05;
  hopper.add(glass);
  for (const [y, x] of [[0.026, 0], [0.065, 0.006], [0.098, -0.004]]) ball(0.029, x, y, 0, hopper);
  tube(0.036, 0.012, 0, 0.108, 0, 'metalColor', hopper).rotation.x = 0; // the cap (a flat disc)

  // Grip and trigger: the pistol grip every gun uses, so the same hands fit.
  const grip = box(0.043, 0.12, 0.052, 0, -0.095, 0.028, 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box(0.012, 0.03, 0.014, 0, -0.06, -0.016, 'metalColor');
  box(0.012, 0.014, 0.02, 0, 0.032, -0.2, 'sightColor'); // a bead on top of the barrel

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.004, -0.338);
  gun.add(muzzle);

  const mounts = {
    barrel: { position: [0, -0.004, -0.336], radius: 0.045, size: { w: 0.1, h: 0.1 } },
    top: { position: [-0.03, 0.036, -0.08] }, // on the barrel's top, left of the bead: clear of the sights
    side: { position: [0.052, -0.004, -0.06] },
    grip: { position: [0, -0.095, 0.028], rotation: [0.3, 0, 0], size: { w: 0.043, h: 0.12, d: 0.052 } },
    magazine: { position: [0.054, -0.01, 0.04], rotation: [0, 0, Math.PI / 2], gunId: 'tennisBallLauncher' }, // a spare ball tube on the right of the receiver
    sticker: { position: [-0.053, -0.008, 0.03] }, // the left side of the receiver
  };
  return { gun, muzzle, trigger, mounts, ball };
}

export function buildTennisBallLauncherDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildTennisBallLauncherModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, mounts, ball } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.028, -0.027, 0),
    thumbOffset: new THREE.Vector3(0, -0.022, 0),
    fingerSize: new THREE.Vector3(0.036, 0.016, 0.06),
    fingerOffset: new THREE.Vector3(-0.018, 0.004, 0),
  });
  leftArm.name = 'launcherSupportArm';
  const held = ball(0.029, 0, -0.01, -0.02, leftArm); // the ball in the support hand during the reload
  held.name = 'launcherHeldBall';
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
      held.visible = reloadWeight > 0.5 && r.ballVisible.some(([a, b]) => reloadProgress > a && reloadProgress < b);
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
