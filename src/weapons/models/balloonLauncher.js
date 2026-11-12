// =============================================================================
// BALLOON LAUNCHER MODEL (first person & the claw machine's chute display)
// A party-store helium blaster: a teal body with pink trim, a silver helium tank lying along the top with a pressure gauge, a nozzle at the front with
// curly ribbons hanging off it, and the usual pistol grip. While loaded a balloon sits on the nozzle and INFLATES after each shot (and after a reload)
// over viewmodel.fire.inflateSeconds (state.sinceFire, state.loaded). Reload: the support hand twists a fresh helium cartridge into the tank's base
// (config: weapons.balloonLauncher.viewmodel.reload). Points down -Z (the way the camera looks).
// =============================================================================

import * as THREE from 'three';
import { resolveGunColors } from '../skinPalette.js';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

function buildGun(colors) {
  const gun = new THREE.Group();
  const materials = new Map();
  const mat = (key) => {
    if (!materials.has(key)) {
      const metal = key === 'metalColor' || key === 'tankColor';
      const glow = key === 'sightColor';
      const rubber = key === 'balloonColor';
      materials.set(key, new THREE.MeshStandardMaterial({
        color: colors[key],
        roughness: rubber ? 0.3 : metal ? 0.28 : 0.5,
        metalness: metal ? 0.7 : 0.05,
        ...(glow ? { emissive: colors[key], emissiveIntensity: 0.5 } : {}),
        flatShading: true,
      }));
    }
    return materials.get(key);
  };
  const box = (name, size, at, key, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(key));
    mesh.name = name;
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  };
  const tube = (name, radius, length, at, key, parent = gun, segments = 14, radiusBack = radius) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radiusBack, length, segments), mat(key));
    mesh.name = name;
    mesh.rotation.x = Math.PI / 2; // along Z
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  };

  // The body: teal, a pink stripe along each side, a rounded front.
  box('balloonBody', [0.07, 0.08, 0.24], [0, -0.005, -0.06], 'bodyColor');
  for (const x of [-0.036, 0.036]) box('bodyStripe', [0.002, 0.014, 0.22], [x, 0.008, -0.06], 'accentColor');
  tube('bodyNose', 0.04, 0.05, [0, -0.005, -0.2], 'bodyColor', gun, 14);

  // The helium tank along the top, its valve and the pressure gauge (a dial with a needle).
  tube('heliumTank', 0.026, 0.2, [0, 0.062, -0.04], 'tankColor', gun, 14);
  const tankCap = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8), mat('tankColor'));
  tankCap.name = 'tankCap';
  tankCap.position.set(0, 0.062, -0.14);
  gun.add(tankCap);
  box('tankBand', [0.056, 0.008, 0.012], [0, 0.062, 0.02], 'accentColor');
  box('tankBand', [0.056, 0.008, 0.012], [0, 0.062, -0.1], 'accentColor');
  tube('gaugeFace', 0.016, 0.006, [0.03, 0.07, 0.03], 'accentColor', gun, 12).rotation.set(0, 0, Math.PI / 2);
  const needle = box('gaugeNeedle', [0.002, 0.012, 0.002], [0.0335, 0.074, 0.03], 'darkColor');

  // The nozzle and its ribbons.
  tube('nozzle', 0.012, 0.06, [0, -0.005, -0.25], 'metalColor', gun, 10);
  tube('nozzleLip', 0.016, 0.008, [0, -0.005, -0.28], 'accentColor', gun, 10);
  for (const [x, len, tilt] of [[-0.012, 0.09, 0.15], [0.01, 0.12, -0.1], [0.002, 0.07, 0.05]]) {
    const ribbon = box('ribbon', [0.004, len, 0.002], [x, -0.005 - len / 2, -0.262], 'ribbonColor');
    ribbon.rotation.z = tilt;
  }
  box('sightBead', [0.008, 0.008, 0.008], [0, 0.092, -0.12], 'sightColor');

  // The balloon on the nozzle (scaled by the model as it inflates), with its knot.
  const balloon = new THREE.Group();
  balloon.name = 'nozzleBalloon';
  balloon.position.set(0, -0.005, -0.29);
  gun.add(balloon);
  const skin = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 9).scale(1, 1, 1.25), mat('balloonColor'));
  skin.position.z = -0.055;
  balloon.add(skin);

  // Grip and trigger.
  const grip = box('balloonGrip', [0.042, 0.115, 0.05], [0, -0.095, 0.03], 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box('balloonTrigger', [0.01, 0.026, 0.01], [0, -0.062, -0.01], 'metalColor');
  box('triggerGuard', [0.012, 0.006, 0.05], [0, -0.08, -0.012], 'darkColor');
  box('tankBase', [0.04, 0.03, 0.05], [0, -0.06, 0.08], 'darkColor'); // where a cartridge twists in

  // A helium cartridge for the support hand during the reload (built here, hidden; the model attaches it to the hand).
  const cartridge = new THREE.Group();
  cartridge.name = 'heliumCartridge';
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 10), mat('tankColor'));
  cartridge.add(can);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.014, 8), mat('metalColor'));
  neck.position.y = 0.036;
  cartridge.add(neck);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.005, -0.29);
  gun.add(muzzle);

  const mounts = {
    barrel: { position: [0, -0.005, -0.285], radius: 0.02, size: { w: 0.05, h: 0.05 } },
    top: { position: [0.03, 0.04, -0.14] }, // beside the tank's nose
    side: { position: [0.037, -0.01, -0.1] },
    grip: { position: [0, -0.095, 0.03], rotation: [0.3, 0, 0], size: { w: 0.042, h: 0.115, d: 0.05 } },
    magazine: { position: [0, -0.075, 0.08], gunId: 'balloonLauncher' }, // a bigger helium cartridge under the tank's base
    sticker: { position: [-0.0365, -0.02, -0.02] },
  };
  return { gun, muzzle, trigger, balloon, needle, cartridge, mounts };
}

export function buildBalloonLauncherDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildBalloonLauncherModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, balloon, needle, cartridge, mounts } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.006, -0.06, -0.15),
    thumbOffset: new THREE.Vector3(0, -0.015, 0),
  });
  leftArm.name = 'balloonSupportArm';
  cartridge.position.set(0, 0.02, -0.02);
  cartridge.visible = false;
  leftArm.add(cartridge);
  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun, muzzle,
    animate({ sinceFire, reloadProgress, reloadWeight, loaded = true }) {
      const f = vm.fire;
      const pull = sinceFire < f.pressSeconds ? sinceFire / f.pressSeconds
        : Math.max(0, 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds);
      trigger.rotation.x = pull * f.triggerDegrees * DEG_TO_RAD;
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      const reloading = reloadWeight > 0.5;
      cartridge.visible = reloading && r.cartridgeVisible.some(([a, b]) => reloadProgress > a && reloadProgress < b);
      // The balloon: gone while reloading or empty, growing back over inflateSeconds after a shot.
      const inflate = Math.min(1, Math.max(0, sinceFire / f.inflateSeconds));
      const size = reloading || !loaded ? 0 : 0.15 + 0.85 * inflate;
      balloon.visible = size > 0;
      balloon.scale.setScalar(Math.max(size, 1e-3));
      needle.rotation.z = (reloading ? 1 - reloadProgress : 0.3) * 1.6; // (the gauge drops during the reload and swings back)
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
