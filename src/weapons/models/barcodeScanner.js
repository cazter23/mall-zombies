// =============================================================================
// BARCODE SCANNER MODEL (first person)
// A 90s supermarket handheld laser barcode reader modified with external copper
// capacitor coils, an anodized heatsink shroud, a glowing ruby emitter window,
// a 3-bar LED charge meter on the rear deck, and a removable lithium battery
// pack in the base of the handle.
// Animation: holding the trigger ramps up the LED charge bars, brightens the
// laser window, and vibrates the coil shroud; firing snaps the trigger and
// pulses the emitter; reloading swaps the spent battery pack from the grip base.
// =============================================================================

import * as THREE from 'three';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

function buildBatteryPack(vm) {
  const pack = new THREE.Group();
  pack.name = 'scannerBattery';
  const darkMat = new THREE.MeshStandardMaterial({
    color: vm.darkColor, roughness: 0.65, metalness: 0.15, flatShading: true,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: vm.coilColor, roughness: 0.35, metalness: 0.65, flatShading: true,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.042, 0.058), darkMat);
  pack.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.01, 0.06), accentMat);
  stripe.position.set(0, -0.008, 0);
  pack.add(stripe);
  const contacts = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.032), accentMat);
  contacts.position.set(0, 0.024, 0);
  pack.add(contacts);
  return pack;
}

function buildGun(vm) {
  const gun = new THREE.Group();
  const mat = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15, flatShading: true, ...opts });

  const bodyMat = mat(vm.bodyColor, { roughness: 0.42, metalness: 0.12 });
  const darkMat = mat(vm.darkColor, { roughness: 0.7, metalness: 0.15 });
  const metalMat = mat(vm.metalColor, { roughness: 0.28, metalness: 0.72 });
  const coilMat = mat(vm.coilColor, { roughness: 0.25, metalness: 0.8, emissive: vm.coilColor, emissiveIntensity: 0.15 });
  const sightMat = mat(vm.sightColor, { emissive: vm.sightColor, emissiveIntensity: 0.8, roughness: 0.2 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: vm.windowColor,
    emissive: vm.windowColor,
    emissiveIntensity: 0.65,
    roughness: 0.18,
    metalness: 0.1,
    flatShading: true,
  });

  function box(name, size, at, material, parent = gun) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  }

  function tube(name, radius, length, at, material, parent = gun) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
    mesh.name = name;
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  }

  // Sleek angled scanner head & upper receiver deck
  box('scannerHead', [0.068, 0.064, 0.21], [0, 0.008, -0.075], bodyMat);
  box('underCarriage', [0.058, 0.024, 0.19], [0, -0.034, -0.07], darkMat);
  box('frontBezel', [0.074, 0.058, 0.042], [0, 0.008, -0.195], darkMat);
  const emitterWindow = box('emitterWindow', [0.06, 0.032, 0.012], [0, 0.008, -0.214], windowMat);
  tube('emitterLens', 0.015, 0.018, [0, 0.008, -0.22], windowMat);

  // External over-volted capacitor coils along the sides
  const coilGroup = new THREE.Group();
  coilGroup.name = 'capacitorCoils';
  gun.add(coilGroup);
  for (const x of [-0.038, 0.038]) {
    tube('capacitorRail', 0.011, 0.15, [x, 0.006, -0.095], metalMat, coilGroup);
    for (const z of [-0.045, -0.08, -0.115, -0.15]) {
      tube('copperWinding', 0.015, 0.018, [x, 0.006, z], coilMat, coilGroup);
    }
  }

  // Top sight post & rear charge status LEDs (3 segments that light up with chargeProgress)
  box('rearHood', [0.046, 0.016, 0.035], [0, 0.046, 0.005], darkMat);
  box('frontSightPost', [0.01, 0.036, 0.014], [0, 0.052, -0.185], darkMat);
  box('frontSightTip', [0.014, 0.009, 0.012], [0, 0.072, -0.185], sightMat);

  const chargeLeds = [0, 1, 2].map((i) => {
    const ledMat = new THREE.MeshStandardMaterial({
      color: vm.sightColor,
      emissive: vm.sightColor,
      emissiveIntensity: 0.15,
      roughness: 0.25,
      flatShading: true,
    });
    return box(`chargeLed${i}`, [0.01, 0.008, 0.012], [-0.013 + i * 0.013, 0.056, 0.008], ledMat);
  });

  // Ergonomic checkout grip & wide yellow squeeze trigger
  const grip = box('pistolGrip', [0.042, 0.115, 0.048], [0, -0.088, 0.018], darkMat);
  grip.rotation.x = 0.28;
  const trigger = box('trigger', [0.018, 0.048, 0.018], [0, -0.064, -0.02], coilMat);
  trigger.rotation.x = -0.15;

  // Removable lithium battery pack seated at the bottom of the handle/frame
  const battery = buildBatteryPack(vm);
  battery.position.set(0, -0.062, -0.11);
  gun.add(battery);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.008, -0.232);
  gun.add(muzzle);

  const mounts = {
    barrel: { position: [0, 0.008, -0.222], radius: 0.022, size: { w: 0.068, h: 0.052 } },
    top: { position: [-0.022, 0.04, -0.075] },
    side: { position: [0.052, 0.006, -0.095] },
    grip: { position: [0, -0.088, 0.018], rotation: [0.28, 0, 0], size: { w: 0.042, h: 0.115, d: 0.048 } },
    magazine: { parent: battery, position: [0, -0.021, 0], gunId: 'barcodeScanner' },
    sticker: { position: [-0.035, 0.008, -0.085] },
  };

  return { gun, muzzle, trigger, emitterWindow, windowMat, coilGroup, chargeLeds, battery, mounts };
}

export function buildBarcodeScannerDisplay(def) {
  return buildGun(def.viewmodel).gun;
}

export function buildBarcodeScannerModel(def) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, windowMat, coilGroup, chargeLeds, battery, mounts } = buildGun(vm);
  const { leftArm } = buildPistolArms(gun);
  const heldBattery = buildBatteryPack(vm);
  heldBattery.name = 'heldScannerBattery';
  heldBattery.position.set(-0.02, -0.095, -0.05);
  heldBattery.visible = false;
  leftArm.add(heldBattery);

  const triggerRestX = trigger.rotation.x;

  return {
    root: gun,
    muzzle,
    mounts,
    animate({ sinceFire, reloadProgress, reloadWeight, chargeProgress = 0 }) {
      const f = vm.fire;
      const firePull = sinceFire < f.pressSeconds
        ? sinceFire / f.pressSeconds
        : Math.max(0, 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds);
      const squeeze = Math.max(firePull, chargeProgress * 0.85);
      trigger.rotation.x = triggerRestX + squeeze * f.triggerDegrees * DEG_TO_RAD;

      // Capacitor coils hum and emitter window brightens as charge builds
      windowMat.emissiveIntensity = 0.65 + chargeProgress * 1.6 + firePull * 1.2;
      coilGroup.position.z = -chargeProgress * 0.006 + firePull * (f.coilKick ?? 0.01);
      chargeLeds.forEach((led, index) => {
        const threshold = (index + 1) / (chargeLeds.length + 0.2);
        led.material.emissiveIntensity = chargeProgress >= threshold ? 1.8 : 0.15 + chargeProgress * 0.4;
      });

      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(
        leftArm.rotation.x * reloadWeight,
        leftArm.rotation.y * reloadWeight,
        leftArm.rotation.z * reloadWeight,
      );
      const during = ([a, b]) => reloadWeight > 0.5 && reloadProgress > a && reloadProgress < b;
      battery.visible = !during(r.batteryGone);
      heldBattery.visible = during(r.oldBatteryVisible) || during(r.newBatteryVisible);
    },
    set leftHandVisible(visible) {
      leftArm.visible = visible;
    },
  };
}
