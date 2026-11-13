// =============================================================================
// BOTTLE ROCKET BAZOOKA MODEL (first person & the claw machine's chute display)
// A fireworks-stand launch tube: red cardboard with white bands and yellow stars, a dark flared back end, a flip-up sight, a coiled fuse on the left
// with a glowing tip, a pistol grip and a fore grip. When loaded, the blue rocket's yellow nose pokes out of the mouth (state.loaded). Reload: the
// tube tips up, the support hand brings a fresh rocket from below and slides it into the front (config: weapons.bottleRocket.viewmodel.reload).
// Points down -Z (the way the camera looks).
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
      const metal = key === 'metalColor';
      const glow = key === 'sightColor';
      materials.set(key, new THREE.MeshStandardMaterial({
        color: colors[key],
        roughness: metal ? 0.35 : key === 'bodyColor' || key === 'accentColor' ? 0.85 : 0.6, // (cardboard is matte)
        metalness: metal ? 0.6 : 0.05,
        ...(glow ? { emissive: colors[key], emissiveIntensity: 0.6 } : {}),
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
  const tube = (name, radius, length, at, key, parent = gun, segments = 16, radiusBack = radius, open = false) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radiusBack, length, segments, 1, open), mat(key));
    mesh.name = name;
    mesh.rotation.x = Math.PI / 2; // along Z (the cylinder's top end points to -Z)
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  };
  // A four-point star printed on the tube's left side (2 mm proud of it).
  const star = (y, z, size) => {
    box('tubeStar', [0.002, size, size * 0.28], [-0.052, y, z], 'sightColor');
    box('tubeStar', [0.002, size * 0.28, size], [-0.052, y, z], 'sightColor');
  };

  // The launch tube: red, with white bands, a dark mouth ring and a flared back end.
  tube('rocketTube', 0.05, 0.62, [0, 0, -0.11], 'bodyColor');
  for (const z of [-0.36, -0.2, -0.02, 0.12]) tube('tubeBand', 0.0515, 0.03, [0, 0, z], 'accentColor');
  tube('tubeMouth', 0.056, 0.03, [0, 0, -0.41], 'darkColor');
  tube('tubeBore', 0.042, 0.004, [0, 0, -0.426], 'darkColor', gun, 14);
  tube('tubeFlare', 0.058, 0.07, [0, 0, 0.235], 'darkColor', gun, 16, 0.07);
  for (const [y, z, s] of [[0.012, -0.29, 0.03], [-0.014, -0.11, 0.022], [0.016, 0.05, 0.026]]) star(y, z, s);

  // The rocket's nose in the mouth (hidden while the tube is empty), a blue body just inside.
  const loadedRocket = new THREE.Group();
  loadedRocket.name = 'loadedRocket';
  gun.add(loadedRocket);
  tube('loadedRocketBody', 0.036, 0.05, [0, 0, -0.405], 'rocketColor', loadedRocket, 12);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.07, 12), mat('noseColor'));
  nose.name = 'loadedRocketNose';
  nose.rotation.x = -Math.PI / 2; // the point to -Z
  nose.position.set(0, 0, -0.465);
  loadedRocket.add(nose);

  // The flip-up sight: a little frame on top with a glowing bead.
  box('sightPost', [0.006, 0.05, 0.006], [0, 0.07, -0.25], 'metalColor');
  box('sightFrame', [0.04, 0.006, 0.006], [0, 0.095, -0.25], 'metalColor');
  box('sightBead', [0.008, 0.008, 0.008], [0, 0.102, -0.25], 'sightColor');
  box('rearSight', [0.024, 0.02, 0.01], [0, 0.06, 0.02], 'darkColor');

  // The fuse: a coil of wick on the left, with a glowing tip.
  const fuse = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 5, 12), mat('wickColor'));
  fuse.name = 'fuseCoil';
  fuse.rotation.y = Math.PI / 2;
  fuse.position.set(-0.056, 0.02, 0.07);
  gun.add(fuse);
  box('fuseTip', [0.008, 0.008, 0.008], [-0.058, 0.04, 0.07], 'sightColor');

  // Grips and trigger (the pistol grip every gun uses, so the same hands fit).
  box('gripMount', [0.03, 0.03, 0.06], [0, -0.06, 0.02], 'gripColor');
  const grip = box('rocketGrip', [0.042, 0.12, 0.05], [0, -0.115, 0.03], 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box('rocketTrigger', [0.01, 0.026, 0.01], [0, -0.082, -0.01], 'metalColor');
  box('triggerGuard', [0.012, 0.006, 0.05], [0, -0.1, -0.012], 'darkColor');
  box('foreGrip', [0.036, 0.09, 0.04], [0, -0.09, -0.24], 'gripColor');

  // A rocket for the support hand during the reload (built here, hidden; the model attaches it to the hand).
  const heldRocket = new THREE.Group();
  heldRocket.name = 'heldRocket';
  tube('heldRocketBody', 0.034, 0.14, [0, 0, 0], 'rocketColor', heldRocket, 10);
  const heldNose = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.06, 10), mat('noseColor'));
  heldNose.rotation.x = -Math.PI / 2;
  heldNose.position.set(0, 0, -0.1);
  heldRocket.add(heldNose);
  box('heldRocketStick', [0.006, 0.006, 0.14], [0.03, 0, 0.12], 'wickColor', heldRocket);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -0.43);
  gun.add(muzzle);

  const mounts = {
    barrel: { position: [0, 0, -0.428], radius: 0.058, size: { w: 0.12, h: 0.12 } },
    top: { position: [0.03, 0.055, -0.12] }, // the tube's top, right of the sight line
    side: { position: [0.053, 0, -0.16] },
    grip: { position: [0, -0.115, 0.03], rotation: [0.3, 0, 0], size: { w: 0.042, h: 0.12, d: 0.05 } },
    magazine: { position: [0.06, -0.03, 0.08], gunId: 'bottleRocket' }, // a spare-rocket pouch on the right
    sticker: { position: [-0.053, -0.02, -0.2] },
  };
  return { gun, muzzle, trigger, loadedRocket, heldRocket, mounts };
}

export function buildBottleRocketDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildBottleRocketModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, loadedRocket, heldRocket, mounts } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.006, -0.06, -0.24),
    thumbOffset: new THREE.Vector3(0, -0.015, 0),
  });
  leftArm.name = 'bottleRocketSupportArm';
  heldRocket.position.set(0, 0.02, -0.04);
  heldRocket.visible = false;
  leftArm.add(heldRocket);
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
      const during = ([a, b]) => reloading && reloadProgress > a && reloadProgress < b;
      heldRocket.visible = r.rocketVisible.some(during);
      // The nose in the mouth: shown when a rocket is in the tube, and from the moment the new one slides in during a reload.
      loadedRocket.visible = reloading ? !during(r.tubeEmpty) : loaded;
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
