// =============================================================================
// BOTTLE ROCKET BAZOOKA MODEL (first person & the claw machine's chute display)
// A fireworks-stand launch tube: red cardboard with white bands, a crimped mouth, a yellow label wrap with stars on the left, a dark flared back end
// closed by a HINGED BREECH CAP (hinge on the left, a pull tab on the right: it swings open away from you), a ring front sight and a peep rear sight, a fat coiled fuse on the
// left with a wick running back and a flickering glowing tip, a shoulder pad under the back end, a pistol grip and a fore grip. When loaded the
// blue rocket's yellow nose pokes out of the mouth (state.loaded).
// Reload (config: weapons.bottleRocket.viewmodel.reload): the tube swings its back end round into view, the support hand flips the breech cap
// open, pulls out the burnt-out casing and tosses it, brings a fresh rocket from below and slides it in nose first (its nose appears in the
// mouth), swings the cap shut and pats the tube.
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
  const mesh = (name, geometry, at, key, parent = gun) => {
    const m = new THREE.Mesh(geometry, mat(key));
    m.name = name;
    m.position.set(...at);
    parent.add(m);
    return m;
  };
  const box = (name, size, at, key, parent = gun) => mesh(name, new THREE.BoxGeometry(...size), at, key, parent);
  const tube = (name, radius, length, at, key, parent = gun, segments = 16, radiusBack = radius, open = false) => {
    const m = mesh(name, new THREE.CylinderGeometry(radius, radiusBack, length, segments, 1, open), at, key, parent);
    m.rotation.x = Math.PI / 2; // along Z (the cylinder's top end points to -Z)
    return m;
  };
  // A four-point star printed on the tube's left side (on the label wrap, 2 mm proud of it).
  const star = (y, z, size) => {
    box('tubeStar', [0.002, size, size * 0.28], [-0.054, y, z], 'sightColor');
    box('tubeStar', [0.002, size * 0.28, size], [-0.054, y, z], 'sightColor');
  };

  // The launch tube: red, with white bands, a crimped red ring and a dark mouth at the front, a flared back end.
  tube('rocketTube', 0.05, 0.62, [0, 0, -0.11], 'bodyColor');
  for (const z of [-0.36, -0.2, -0.02, 0.12]) tube('tubeBand', 0.0515, 0.03, [0, 0, z], 'accentColor');
  tube('tubeCrimp', 0.054, 0.012, [0, 0, -0.388], 'bodyColor', gun, 12);
  tube('tubeMouth', 0.056, 0.03, [0, 0, -0.41], 'darkColor');
  tube('tubeBore', 0.042, 0.004, [0, 0, -0.426], 'darkColor', gun, 14);
  tube('tubeFlare', 0.058, 0.07, [0, 0, 0.235], 'darkColor', gun, 16, 0.07);
  // The label: a yellow wrap round the left half between two bands, with stars on it (and one more star further back).
  const label = mesh('tubeLabel', new THREE.CylinderGeometry(0.052, 0.052, 0.15, 16, 1, true, Math.PI, Math.PI), [0, 0, -0.11], 'noseColor');
  label.rotation.x = Math.PI / 2;
  for (const [y, z, s] of [[0.016, -0.15, 0.03], [-0.014, -0.08, 0.024], [0.02, -0.06, 0.014]]) star(y, z, s);
  star(0.016, 0.05, 0.026);

  // The breech cap on the back end: a disc hinged on the left (the group is the hinge), with a pull tab on the right and a yellow ring.
  const cap = new THREE.Group();
  cap.name = 'breechCap';
  cap.position.set(-0.07, 0, 0.27);
  gun.add(cap);
  tube('breechCapDisc', 0.07, 0.012, [0.07, 0, 0.006], 'darkColor', cap, 16);
  tube('breechCapRing', 0.05, 0.004, [0.07, 0, 0.0135], 'noseColor', cap, 16);
  box('breechCapTab', [0.024, 0.03, 0.012], [0.146, 0, 0.012], 'gripColor', cap);
  box('breechHinge', [0.014, 0.05, 0.014], [0, 0, 0.006], 'metalColor', cap);
  // The burnt-out casing's charred end, in the breech after a shot (seen when the cap opens; the model shows it while the tube is spent).
  const spentTail = tube('spentTail', 0.034, 0.02, [0, 0, 0.262], 'darkColor', gun, 10);
  spentTail.name = 'spentTail';

  // The rocket's nose in the mouth (hidden while the tube is empty), a blue body just inside.
  const loadedRocket = new THREE.Group();
  loadedRocket.name = 'loadedRocket';
  gun.add(loadedRocket);
  tube('loadedRocketBody', 0.036, 0.05, [0, 0, -0.405], 'rocketColor', loadedRocket, 12);
  mesh('loadedRocketNose', new THREE.ConeGeometry(0.036, 0.07, 12).rotateX(-Math.PI / 2), [0, 0, -0.465], 'noseColor', loadedRocket);

  // Sights: a ring on a post at the front (a glowing bead in it), a peep at the back.
  box('sightPost', [0.006, 0.04, 0.006], [0, 0.068, -0.25], 'metalColor');
  mesh('sightRing', new THREE.TorusGeometry(0.016, 0.003, 5, 14), [0, 0.104, -0.25], 'metalColor');
  box('sightBead', [0.008, 0.008, 0.008], [0, 0.104, -0.25], 'sightColor');
  box('rearSight', [0.024, 0.02, 0.01], [0, 0.06, 0.02], 'darkColor');
  mesh('rearPeep', new THREE.TorusGeometry(0.008, 0.003, 4, 10), [0, 0.078, 0.02], 'darkColor');

  // The fuse: a fat coil of wick on the left, a wick running back along the tube, and a glowing tip (flickered by the model).
  const fuse = mesh('fuseCoil', new THREE.TorusGeometry(0.022, 0.0055, 5, 14), [-0.06, 0.018, 0.075], 'wickColor');
  fuse.rotation.y = Math.PI / 2;
  mesh('fuseCoilInner', new THREE.TorusGeometry(0.012, 0.0045, 5, 12), [-0.061, 0.018, 0.075], 'wickColor').rotation.y = Math.PI / 2;
  const wick = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.058, 0.04, 0.075), new THREE.Vector3(-0.054, 0.05, 0.12), new THREE.Vector3(-0.05, 0.045, 0.165),
  ]);
  mesh('fuseWick', new THREE.TubeGeometry(wick, 8, 0.0028, 4, false), [0, 0, 0], 'wickColor');
  const fuseTip = box('fuseTip', [0.01, 0.01, 0.01], [-0.05, 0.045, 0.168], 'sightColor');

  // Grips and trigger (the pistol grip every gun uses, so the same hands fit), a fore grip, and a padded shoulder rest under the back end.
  box('gripMount', [0.03, 0.03, 0.06], [0, -0.06, 0.02], 'gripColor');
  const grip = box('rocketGrip', [0.042, 0.12, 0.05], [0, -0.115, 0.03], 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box('rocketTrigger', [0.01, 0.026, 0.01], [0, -0.082, -0.01], 'metalColor');
  box('triggerGuard', [0.012, 0.006, 0.05], [0, -0.1, -0.012], 'darkColor');
  box('foreGrip', [0.036, 0.09, 0.04], [0, -0.09, -0.24], 'gripColor');
  box('foreGripCap', [0.04, 0.01, 0.044], [0, -0.138, -0.24], 'darkColor');
  box('shoulderPad', [0.05, 0.03, 0.09], [0, -0.063, 0.17], 'gripColor');
  box('shoulderPadRubber', [0.054, 0.034, 0.014], [0, -0.063, 0.218], 'darkColor');

  // A fresh rocket for the support hand during the reload (built here, hidden; the model attaches it to the hand): a blue body with a white
  // stripe, a yellow nose, red fins at the tail. Lies along Z, nose to -Z.
  const heldRocket = new THREE.Group();
  heldRocket.name = 'heldRocket';
  tube('heldRocketBody', 0.034, 0.14, [0, 0, 0], 'rocketColor', heldRocket, 10);
  tube('heldRocketStripe', 0.035, 0.016, [0, 0, -0.03], 'accentColor', heldRocket, 10);
  mesh('heldRocketNose', new THREE.ConeGeometry(0.034, 0.06, 10).rotateX(-Math.PI / 2), [0, 0, -0.1], 'noseColor', heldRocket);
  for (let i = 0; i < 3; i++) {
    const fin = box('heldRocketFin', [0.004, 0.026, 0.034], [0, 0, 0.056], 'bodyColor', heldRocket);
    const a = (i / 3) * Math.PI * 2;
    fin.position.set(Math.sin(a) * 0.044, Math.cos(a) * 0.044, 0.056);
    fin.rotation.z = -a;
  }
  // The burnt-out casing pulled from the breech: the same rocket, charred, with no nose.
  const spentCasing = new THREE.Group();
  spentCasing.name = 'spentCasing';
  tube('spentCasingBody', 0.034, 0.14, [0, 0, 0], 'darkColor', spentCasing, 10);
  tube('spentCasingScorch', 0.0345, 0.03, [0, 0, -0.055], 'wickColor', spentCasing, 10);

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
  return { gun, muzzle, trigger, loadedRocket, heldRocket, spentCasing, spentTail, cap, fuseTip, mounts };
}

export function buildBottleRocketDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildBottleRocketModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, loadedRocket, heldRocket, spentCasing, spentTail, cap, fuseTip, mounts } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.006, -0.06, -0.24),
    thumbOffset: new THREE.Vector3(0, -0.015, 0),
  });
  leftArm.name = 'bottleRocketSupportArm';
  // The rocket and the spent casing sit in the support hand's grip, lying along the tube (leftArm's parts are placed at leftOffset).
  for (const held of [heldRocket, spentCasing]) {
    held.position.set(...vm.reload.rocketInHand);
    held.visible = false;
    leftArm.add(held);
  }
  const capPose = { pos: new THREE.Vector3(), rot: new THREE.Euler() };
  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun, muzzle,
    animate({ sinceFire, reloadProgress, reloadWeight, loaded = true, time = 0 }) {
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
      spentCasing.visible = r.spentVisible.some(during);
      // The breech cap swings open on its hinge, round to the left (capKeys pos[0]: 0 shut .. 1 open).
      samplePose(r.capKeys, reloadProgress, capPose.pos, capPose.rot);
      cap.rotation.y = -capPose.pos.x * reloadWeight * r.capOpenDegrees * DEG_TO_RAD;
      // The nose in the mouth: shown when a rocket is in the tube, and from the moment the new one slides in during a reload. The burnt-out
      // casing's end sits in the breech while the tube is spent, until the hand pulls it out.
      loadedRocket.visible = reloading ? reloadProgress >= r.rocketInAt : loaded;
      spentTail.visible = reloading ? reloadProgress <= r.spentPulledAt : !loaded;
      // The fuse tip flickers like a lit wick.
      fuseTip.scale.setScalar(1 + f.fuseFlicker * Math.sin(time * 23) * Math.sin(time * 37));
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
