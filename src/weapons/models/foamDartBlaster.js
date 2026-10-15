// Chunky toy rifle with a removable drum. Gun/display share geometry, hands are model-only.
import * as THREE from 'three';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

function buildGun(vm) {
  const gun = new THREE.Group();
  const materials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true }));
    return materials.get(color);
  };
  const box = (w, h, d, x, y, z, color, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const cylinder = (radius, length, x, y, z, color, parent, axis = 'z') => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), mat(color));
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    else mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  box(0.082, 0.085, 0.23, 0, 0.005, -0.07, vm.bodyColor);
  box(0.085, 0.025, 0.24, 0, -0.05, -0.07, vm.accentColor);
  box(0.032, 0.03, 0.065, 0, 0.063, 0.005, vm.darkColor); // rear rail
  box(0.008, 0.05, 0.012, 0, 0.065, -0.185, vm.darkColor); // post that holds the front sight up (it used to float)
  box(0.014, 0.014, 0.016, 0, 0.091, -0.19, vm.sightColor); // clear sight above drum
  cylinder(0.027, 0.1, 0, 0.006, -0.22, vm.accentColor, gun);
  cylinder(0.031, 0.025, 0, 0.006, -0.275, vm.muzzleColor, gun);
  cylinder(0.02, 0.002, 0, 0.006, -0.289, vm.darkColor, gun); // dark muzzle opening
  const grip = box(0.042, 0.12, 0.05, 0, -0.095, 0.025, vm.darkColor);
  grip.rotation.x = 0.3;
  box(0.065, 0.055, 0.07, 0, 0, 0.085, vm.bodyColor); // stub stock
  box(0.067, 0.065, 0.02, 0, 0, 0.13, vm.accentColor);
  const trigger = box(0.012, 0.03, 0.014, 0, -0.065, -0.017, vm.muzzleColor);
  const drum = new THREE.Group(); drum.position.set(-0.065, 0.025, -0.075); gun.add(drum);
  cylinder(0.061, 0.075, 0, 0, 0, vm.accentColor, drum, 'x');
  cylinder(0.049, 0.078, 0, 0, 0, vm.bodyColor, drum, 'x');
  // Foam darts and orange tips visible on the outside of the drum.
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const y = Math.cos(angle) * 0.037, z = Math.sin(angle) * 0.037;
    cylinder(0.008, 0.022, -0.046, y, z, vm.dartColor, drum, 'x');
    cylinder(0.009, 0.006, -0.06, y, z, vm.muzzleColor, drum, 'x');
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.006, -0.292); gun.add(muzzle);
  // Where upgrade parts go (models/upgradeParts.js).
  const mounts = {
    barrel: { position: [0, 0.006, -0.289], radius: 0.028, size: { w: 0.064, h: 0.064 } },
    top: { position: [-0.028, 0.0475, 0.03] },
    side: { position: [0.05, -0.02, -0.15] },
    grip: { position: [0, -0.095, 0.025], rotation: [0.3, 0, 0], size: { w: 0.042, h: 0.12, d: 0.05 } },
    magazine: { position: [0, -0.0625, -0.11] },
    sticker: { position: [-0.0425, 0, -0.16] }, // between the drum and the barrel
  };
  return { gun, muzzle, trigger, drum, mounts };
}

export function buildFoamDartBlasterDisplay(def) { return buildGun(def.viewmodel).gun; }

export function buildFoamDartBlasterModel(def) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, drum, mounts } = buildGun(vm);
  const { leftArm } = buildPistolArms(gun);
  const heldDrum = drum.clone(); heldDrum.position.set(-0.045, -0.04, -0.025);
  heldDrum.visible = false; leftArm.add(heldDrum);
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
      const inWindow = ([a, b]) => reloadWeight > 0.5 && reloadProgress > a && reloadProgress < b;
      drum.visible = !inWindow(r.drumGone);
      heldDrum.visible = inWindow(r.oldDrumVisible) || inWindow(r.newDrumVisible);
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
