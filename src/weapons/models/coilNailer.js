// =============================================================================
// HEAVY COIL NAILER MODEL (first person)
// A heavy-duty pneumatic roofing/pallet coil nailer: wide industrial housing,
// oversized top exhaust dome, ribbed pneumatic cylinder, steel punching driver
// nose, and a round wire-collated nail canister drum mounted beneath the frame.
// Animation: trigger squeeze + driver nose punch + top exhaust cap thump on each
// shot; during reload the left hand unlatches the spent coil drum, drops down,
// and slams a fresh wire-collated nail drum into the feed cradle.
// =============================================================================

import * as THREE from 'three';
import { resolveGunColors } from '../skinPalette.js';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

function buildDrum(vm) {
  const drum = new THREE.Group();
  drum.name = 'coilDrum';
  const mat = (color, roughness = 0.55, metalness = 0.2) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  const canister = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.058, 12),
    mat(vm.drumColor, 0.45, 0.18),
  );
  canister.name = 'drumCanister';
  drum.add(canister);

  const spool = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.044, 0.062, 10),
    mat(vm.coilColor, 0.3, 0.75),
  );
  spool.name = 'nailCoilSpool';
  drum.add(spool);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.066, 8),
    mat(vm.darkColor, 0.7, 0.15),
  );
  drum.add(cap);

  const latch = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, 0.048, 0.028),
    mat(vm.metalColor, 0.3, 0.7),
  );
  latch.position.set(0, 0.022, -0.042);
  drum.add(latch);
  return drum;
}

function buildGun(vm) {
  const gun = new THREE.Group();
  const materials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) {
      const isMetal = color === 'metalColor' || color === 'coilColor';
      const isSight = color === 'sightColor';
      materials.set(color, new THREE.MeshStandardMaterial({
        color: vm[color],
        roughness: isSight ? 0.2 : isMetal ? 0.3 : 0.58,
        metalness: isMetal ? 0.68 : 0.12,
        ...(isSight ? { emissive: vm[color] } : {}),
        emissiveIntensity: isSight ? 0.7 : 0,
        flatShading: true,
      }));
    }
    return materials.get(color);
  };

  function box(name, size, at, color, parent = gun) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
    mesh.name = name;
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  }

  function tube(name, radius, length, at, color, parent = gun, axis = 'z') {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), mat(color));
    mesh.name = name;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  }

  // Heavy pneumatic body & upper cylinder housing
  box('receiver', [0.078, 0.088, 0.23], [0, 0.008, -0.075], 'bodyColor');
  box('lowerChasis', [0.082, 0.022, 0.24], [0, -0.046, -0.075], 'darkColor');
  for (const z of [-0.02, -0.06, -0.1, -0.14]) {
    box('coolingRib', [0.084, 0.062, 0.01], [0, 0.012, z], 'darkColor');
  }

  // Top pneumatic piston dome (thumps slightly on each shot)
  const pistonCap = tube('pistonDome', 0.046, 0.034, [0, 0.066, -0.035], 'darkColor', gun, 'y');
  tube('exhaustRing', 0.036, 0.012, [0, 0.086, -0.035], 'metalColor', gun, 'y');

  // Side air reservoir tube & pressure bracket
  tube('airReservoir', 0.022, 0.16, [0.05, -0.006, -0.085], 'metalColor');
  box('reservoirBand', [0.036, 0.028, 0.022], [0.042, -0.006, -0.13], 'darkColor');

  // Heavy front guide & reciprocating driver nose
  box('frontBlock', [0.064, 0.072, 0.06], [0, 0.002, -0.215], 'darkColor');
  const nose = new THREE.Group();
  nose.name = 'driverNose';
  nose.position.set(0, -0.002, -0.245);
  gun.add(nose);
  box('noseGuide', [0.042, 0.048, 0.055], [0, 0, -0.02], 'metalColor', nose);
  tube('noseTip', 0.018, 0.038, [0, 0, -0.062], 'metalColor', nose);
  box('contactTrip', [0.012, 0.032, 0.045], [0, -0.022, -0.052], 'coilColor', nose);

  // Iron sights (offset clear of the piston dome)
  box('rearSightBase', [0.038, 0.022, 0.018], [0, 0.062, -0.105], 'darkColor');
  box('frontSightPost', [0.012, 0.044, 0.014], [0, 0.056, -0.225], 'darkColor');
  box('frontSightTip', [0.016, 0.01, 0.014], [0, 0.081, -0.225], 'sightColor');

  // Foregrip & rear handle
  box('foregripBrace', [0.068, 0.042, 0.08], [0, -0.068, -0.19], 'gripColor');
  const grip = box('pistolGrip', [0.044, 0.12, 0.052], [0, -0.092, 0.022], 'gripColor');
  grip.rotation.x = 0.28;
  tube('airFitting', 0.012, 0.032, [0, -0.15, 0.042], 'metalColor');
  const trigger = box('trigger', [0.014, 0.03, 0.016], [0, -0.062, -0.02], 'coilColor');

  // Round wire-collated nail drum beneath the frame
  const drum = buildDrum(vm);
  drum.position.set(0, -0.088, -0.105);
  gun.add(drum);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.002, -0.33);
  gun.add(muzzle);

  const mounts = {
    barrel: { parent: nose, position: [0, 0, -0.081], radius: 0.022, size: { w: 0.044, h: 0.048 } },
    top: { position: [-0.026, 0.052, -0.12] },
    side: { position: [0.072, -0.006, -0.11] },
    grip: { position: [0, -0.092, 0.022], rotation: [0.28, 0, 0], size: { w: 0.044, h: 0.12, d: 0.052 } },
    magazine: { parent: drum, position: [0, -0.03, 0], gunId: 'coilNailer' },
    sticker: { position: [-0.04, 0.008, -0.11] },
  };

  return { gun, muzzle, trigger, nose, pistonCap, drum, mounts };
}

export function buildCoilNailerDisplay(def) {
  return buildGun(resolveGunColors(def)).gun;
}

export function buildCoilNailerModel(def, skinId) {
  const vm = def.viewmodel;
  const colors = resolveGunColors(def, skinId);
  const { gun, muzzle, trigger, nose, pistonCap, drum, mounts } = buildGun(colors);
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.004, -0.058, -0.165),
    fingerSize: new THREE.Vector3(0.078, 0.024, 0.09),
    thumbOffset: new THREE.Vector3(0, -0.014, 0),
  });
  const heldDrum = buildDrum(colors);
  heldDrum.name = 'heldCoilDrum';
  heldDrum.position.set(-0.025, -0.12, -0.06);
  heldDrum.visible = false;
  leftArm.add(heldDrum);

  const noseRestZ = nose.position.z;
  const capRestY = pistonCap.position.y;

  return {
    root: gun,
    muzzle,
    mounts,
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      const f = vm.fire;
      const pull = sinceFire < f.pressSeconds
        ? sinceFire / f.pressSeconds
        : Math.max(0, 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds);
      trigger.rotation.x = pull * f.triggerDegrees * DEG_TO_RAD;
      nose.position.z = noseRestZ - pull * f.nosePunch;
      pistonCap.position.y = capRestY + pull * (f.capHop ?? 0.006);

      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(
        leftArm.rotation.x * reloadWeight,
        leftArm.rotation.y * reloadWeight,
        leftArm.rotation.z * reloadWeight,
      );
      const during = ([a, b]) => reloadWeight > 0.5 && reloadProgress > a && reloadProgress < b;
      drum.visible = !during(r.drumGone);
      heldDrum.visible = during(r.oldDrumVisible) || during(r.newDrumVisible);
    },
    set leftHandVisible(visible) {
      leftArm.visible = visible;
    },
  };
}
