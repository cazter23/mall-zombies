// Double-barrel party popper. Barrels hinge open and two shells are inserted separately.
import * as THREE from 'three';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

function buildGun(vm) {
  const gun = new THREE.Group();
  const materials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15, flatShading: true }));
    return materials.get(color);
  };
  const box = (w, h, d, x, y, z, color, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const cylinder = (radius, length, x, y, z, color, parent, openEnded = false) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12, 1, openEnded), mat(color));
    mesh.rotation.x = Math.PI / 2; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const receiver = box(0.108, 0.066, 0.1, 0, -0.008, 0.005, vm.darkColor);
  receiver.name = 'confettiReceiver';
  const trim = box(0.112, 0.023, 0.11, 0, -0.052, 0.005, vm.metalColor);
  trim.name = 'confettiReceiverTrim';
  const grip = box(0.043, 0.12, 0.052, 0, -0.095, 0.028, vm.darkColor); grip.rotation.x = 0.3;
  box(0.065, 0.06, 0.085, 0, -0.006, 0.09, vm.accentColor);
  box(0.069, 0.065, 0.018, 0, -0.006, 0.14, vm.metalColor);
  const trigger = box(0.012, 0.03, 0.014, 0, -0.065, -0.016, vm.metalColor);
  // Hinge below and forward of the breech: opening lifts its rear clear of the receiver.
  // The inner offset preserves the closed barrel and muzzle positions.
  const barrels = new THREE.Group(); barrels.name = 'confettiHinge';
  barrels.position.set(0, -0.029, -0.105); gun.add(barrels);
  const assembly = new THREE.Group(); assembly.name = 'confettiBarrels';
  assembly.position.set(0, 0.041, 0.06); barrels.add(assembly);
  for (const [i, x] of [-0.044, 0.044].entries()) {
    const base = i === 0 ? vm.bodyColor : vm.accentColor;
    cylinder(0.041, 0.24, x, 0, -0.12, base, assembly, true);
    // An open breech ring and recessed dark bore, rather than a solid cap through which shells clip.
    const breech = new THREE.Mesh(new THREE.RingGeometry(0.031, 0.041, 12), mat(base));
    breech.position.set(x, 0, 0); assembly.add(breech);
    cylinder(0.031, 0.002, x, 0, -0.002, vm.darkColor, assembly);
    for (const z of [-0.045, -0.11, -0.175]) cylinder(0.0415, 0.018, x, 0, z, i === 0 ? vm.accentColor : vm.bodyColor, assembly);
    cylinder(0.045, 0.024, x, 0, -0.243, vm.metalColor, assembly);
    cylinder(0.031, 0.002, x, 0, -0.256, vm.darkColor, assembly);
  }
  box(0.007, 0.03, 0.012, 0, 0.04, -0.22, vm.metalColor, assembly); // post down between the barrels (the bead used to float)
  box(0.014, 0.017, 0.018, 0, 0.057, -0.22, vm.sightColor, assembly);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -0.258); assembly.add(muzzle);
  // Where upgrade parts go (models/upgradeParts.js). Barrel parts and the laser ride on the barrels (they hinge).
  const mounts = {
    barrel: { parent: assembly, position: [0, 0, -0.255], radius: 0.04, twin: 0.044, size: { w: 0.18, h: 0.09 } },
    top: { position: [-0.03, 0.025, 0.03] },
    side: { parent: assembly, position: [0.094, -0.012, -0.15] },
    grip: { position: [0, -0.095, 0.028], rotation: [0.3, 0, 0], size: { w: 0.043, h: 0.12, d: 0.052 } },
    magazine: { position: [0.054, -0.008, 0], rotation: [0, 0, Math.PI / 2] }, // a side shell holder
    sticker: { position: [-0.0335, -0.006, 0.09] }, // on the stock
  };
  return { gun, muzzle, trigger, barrels, cylinder, mounts };
}

export function buildConfettiCannonDisplay(def) { return buildGun(def.viewmodel).gun; }

export function buildConfettiCannonModel(def) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, barrels, cylinder, mounts } = buildGun(vm);
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.028, -0.027, 0),
    thumbOffset: new THREE.Vector3(0, -0.022, 0),
    fingerSize: new THREE.Vector3(0.036, 0.016, 0.06),
    fingerOffset: new THREE.Vector3(-0.018, 0.004, 0),
  });
  leftArm.name = 'confettiSupportArm';
  const shell = new THREE.Group(); shell.name = 'confettiHeldShell'; leftArm.add(shell);
  cylinder(0.022, 0.065, 0, 0, 0, vm.shellColor, shell);
  cylinder(0.024, 0.012, 0, 0, 0.033, vm.metalColor, shell);
  shell.visible = false;
  const barrelPosition = new THREE.Vector3(), barrelRotation = new THREE.Euler();
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
      samplePose(r.barrelKeys, reloadProgress, barrelPosition, barrelRotation);
      barrels.rotation.x = barrelRotation.x * reloadWeight;
      // The hand stays above/behind the receiver while the shell slides into the open barrel.
      samplePose(r.shellKeys, reloadProgress, shell.position, shell.rotation);
      shell.visible = reloadWeight > 0.5 && r.shellVisible.some(([a, b]) => reloadProgress > a && reloadProgress < b);
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
