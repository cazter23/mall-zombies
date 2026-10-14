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
  const cylinder = (radius, length, x, y, z, color, parent) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), mat(color));
    mesh.rotation.x = Math.PI / 2; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  box(0.108, 0.066, 0.1, 0, -0.008, 0.005, vm.darkColor);
  box(0.112, 0.023, 0.11, 0, -0.052, 0.005, vm.metalColor);
  const grip = box(0.043, 0.12, 0.052, 0, -0.095, 0.028, vm.darkColor); grip.rotation.x = 0.3;
  box(0.065, 0.06, 0.085, 0, -0.006, 0.09, vm.accentColor);
  box(0.069, 0.065, 0.018, 0, -0.006, 0.14, vm.metalColor);
  const trigger = box(0.012, 0.03, 0.014, 0, -0.065, -0.016, vm.metalColor);
  const barrels = new THREE.Group(); barrels.position.set(0, 0.012, -0.045); gun.add(barrels);
  for (const [i, x] of [-0.044, 0.044].entries()) {
    const base = i === 0 ? vm.bodyColor : vm.accentColor;
    cylinder(0.041, 0.24, x, 0, -0.12, base, barrels);
    for (const z of [-0.045, -0.11, -0.175]) cylinder(0.0415, 0.018, x, 0, z, i === 0 ? vm.accentColor : vm.bodyColor, barrels);
    cylinder(0.045, 0.024, x, 0, -0.243, vm.metalColor, barrels);
    cylinder(0.031, 0.002, x, 0, -0.256, vm.darkColor, barrels);
  }
  box(0.014, 0.017, 0.018, 0, 0.057, -0.22, vm.sightColor, barrels);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -0.258); barrels.add(muzzle);
  return { gun, muzzle, trigger, barrels, cylinder };
}

export function buildConfettiCannonDisplay(def) { return buildGun(def.viewmodel).gun; }

export function buildConfettiCannonModel(def) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, barrels, cylinder } = buildGun(vm);
  const { leftArm } = buildPistolArms(gun);
  const shell = new THREE.Group(); shell.position.set(-0.04, -0.015, -0.025); leftArm.add(shell);
  cylinder(0.022, 0.065, 0, 0, 0, vm.shellColor, shell);
  cylinder(0.024, 0.012, 0, 0, 0.033, vm.metalColor, shell);
  shell.visible = false;
  const barrelPosition = new THREE.Vector3(), barrelRotation = new THREE.Euler();
  return {
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
      shell.visible = reloadWeight > 0.5 && r.shellVisible.some(([a, b]) => reloadProgress > a && reloadProgress < b);
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
