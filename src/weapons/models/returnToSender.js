// =============================================================================
// RETURN TO SENDER MODEL (first person & the claw machine's chute display)
// The wonder weapon: the Returns Desk's PNEUMATIC TUBE CANNON, in returns-desk blue and white. A chunky body with a rainbow label stripe down the
// right and a strip of parcel tape over the top; on top, a glass chamber (the lid is the glass top half, hinged along its left edge) holding the
// PARCEL CANISTER it fires its blast from; a curl of pneumatic tube from the chamber down into the neck; a wide flared bell at the front with a pink
// emitter ring inside its mouth; a RETURNED rubber stamp on the top front (pressed when it is ready); a lit green screen on the back, facing you.
// Reload (config: weapons.returnToSender.viewmodel.reload): the gun rolls its chamber toward you, the support hand flips the glass lid open, lifts out
// the spent canister and tosses it, drops in a fresh parcel canister, shuts the lid and thumps the stamp.
// Points down -Z (the way the camera looks).
// =============================================================================

import * as THREE from 'three';
import { resolveGunColors } from '../skinPalette.js';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;
const RAINBOW = ['stripeRedColor', 'stripeOrangeColor', 'stripeYellowColor', 'stripeGreenColor', 'stripeBlueColor', 'stripePurpleColor'];
const CHAMBER = { y: 0.072, z: 0.02, radius: 0.033, length: 0.14 }; // the glass chamber on top (its axis along Z)

function buildGun(vm) {
  const gun = new THREE.Group();
  const materials = new Map();
  const mat = (color, { inside = false } = {}) => {
    const key = color + (inside ? ':inside' : '');
    if (!materials.has(key)) {
      const isMetal = color === 'metalColor';
      const isDark = color === 'darkColor' || color === 'gripColor';
      const glows = color === 'sightColor' || color === 'screenColor' || color === 'emitterColor';
      const glass = color === 'glassColor';
      materials.set(key, new THREE.MeshStandardMaterial({
        color: vm[color],
        roughness: glass ? 0.12 : glows ? 0.25 : isMetal ? 0.28 : isDark ? 0.75 : 0.4,
        metalness: isMetal ? 0.65 : 0.1,
        ...(glows ? { emissive: vm[color], emissiveIntensity: 0.7 } : {}),
        ...(glass ? { transparent: true, opacity: 0.32 } : {}),
        ...(glass || inside ? { side: THREE.DoubleSide } : {}), // (open shells: seen from inside too)
        flatShading: true,
      }));
    }
    return materials.get(key);
  };
  const mesh = (name, geometry, at, color, parent = gun, options) => {
    const m = new THREE.Mesh(geometry, mat(color, options));
    m.name = name;
    m.position.set(...at);
    parent.add(m);
    return m;
  };
  const box = (name, size, at, color, parent = gun) => mesh(name, new THREE.BoxGeometry(...size), at, color, parent);
  // A cylinder along Z: radiusFront at -Z (the muzzle end), radiusBack at +Z.
  const tube = (name, radiusFront, radiusBack, length, at, color, parent = gun, { segments = 14, open = false, inside = false } = {}) => {
    const m = mesh(name, new THREE.CylinderGeometry(radiusFront, radiusBack, length, segments, 1, open), at, color, parent, { inside });
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const ring = (name, radius, thickness, at, color, parent = gun) => mesh(name, new THREE.TorusGeometry(radius, thickness, 5, 18), at, color, parent);

  // The body, a white trim line along its foot, the rainbow label down the right (the left is the warranty sticker's), parcel tape over the top.
  box('returnBody', [0.1, 0.08, 0.18], [0, -0.004, 0.02], 'bodyColor');
  box('returnTrim', [0.104, 0.012, 0.18], [0, -0.04, 0.02], 'accentColor');
  RAINBOW.forEach((color, i) => box('returnStripe', [0.003, 0.007, 0.12], [0.0515, 0.026 - i * 0.0075, 0.02], color));
  box('returnTapeTop', [0.06, 0.003, 0.03], [0, 0.0375, 0.095], 'batteryColor');
  box('returnTapeLeft', [0.003, 0.05, 0.03], [-0.0515, 0.01, 0.095], 'batteryColor');

  // The glass chamber on top: a dark cradle (the bottom half) with metal end rings, and the glass lid (the top half) on a hinge
  // along its left edge. The parcel canister sits inside.
  const { y: cy, z: cz, radius: cr, length: cl } = CHAMBER;
  const cradle = mesh('chamberCradle', new THREE.CylinderGeometry(cr, cr, cl, 14, 1, true, -Math.PI / 2, Math.PI), [0, cy, cz], 'darkColor', gun, { inside: true });
  cradle.rotation.x = Math.PI / 2;
  for (const dz of [-cl / 2, cl / 2]) ring('chamberEndRing', cr + 0.002, 0.005, [0, cy, cz + dz], 'metalColor'); // (open rings: you see in from behind)
  box('chamberFoot', [0.03, 0.02, cl - 0.02], [0, cy - cr + 0.004, cz], 'metalColor');
  const lid = new THREE.Group(); // the hinge: rotation.z opens it up and over to the left
  lid.name = 'chamberLid';
  lid.position.set(-cr, cy, cz);
  gun.add(lid);
  const glass = mesh('chamberGlass', new THREE.CylinderGeometry(cr + 0.001, cr + 0.001, cl - 0.016, 14, 1, true, Math.PI / 2, Math.PI), [cr, 0, 0], 'glassColor', lid);
  glass.rotation.x = Math.PI / 2;
  for (const dz of [-0.035, 0.035]) {
    mesh('lidRib', new THREE.TorusGeometry(cr + 0.002, 0.0025, 4, 12, Math.PI), [cr, 0, dz], 'accentColor', lid); // (a half ring, arcing over the top)
  }
  box('lidLatch', [0.012, 0.012, 0.02], [2 * cr + 0.004, 0.004, 0], 'accentColor', lid); // the tab the hand lifts
  box('lidHinge', [0.008, 0.008, cl - 0.02], [0, 0, 0], 'metalColor', lid);
  const seated = buildCanister(mesh, tube, 'canisterColor');
  seated.name = 'seatedCanister';
  seated.position.set(0, cy, cz);
  gun.add(seated);

  // The pneumatic tube: from the chamber's front, curling down into the neck.
  const curl = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, cy, cz - cl / 2 - 0.004), new THREE.Vector3(0.0, cy + 0.006, -0.085),
    new THREE.Vector3(0.0, 0.05, -0.11), new THREE.Vector3(0.0, 0.03, -0.12),
  ]);
  mesh('pneumaticTube', new THREE.TubeGeometry(curl, 12, 0.013, 8, false), [0, 0, 0], 'metalColor');

  // The neck and the flared bell, open at the front (a dark throat inside), a white rim and a pink emitter ring in the mouth.
  tube('returnNeck', 0.04, 0.046, 0.07, [0, -0.004, -0.1], 'metalColor');
  const bell = tube('returnBell', 0.078, 0.042, 0.13, [0, -0.004, -0.2], 'bodyColor', gun, { segments: 18, open: true, inside: true });
  bell.name = 'returnBell';
  tube('returnThroat', 0.04, 0.04, 0.004, [0, -0.004, -0.14], 'darkColor');
  for (const [z, r] of [[-0.175, 0.054], [-0.215, 0.066]]) ring('returnBellBand', r, 0.004, [0, -0.004, z], 'accentColor');
  ring('returnBellRim', 0.078, 0.006, [0, -0.004, -0.265], 'accentColor');
  ring('returnEmitter', 0.058, 0.0045, [0, -0.004, -0.248], 'emitterColor');
  box('returnSight', [0.012, 0.014, 0.02], [0, 0.072, -0.2], 'sightColor'); // a bead on top of the bell

  // The RETURNED stamp on the top front, right of the sight line: a dark pad on a stem with a grip knob (pressed by the model).
  const stamp = new THREE.Group();
  stamp.name = 'returnStamp';
  stamp.position.set(0.026, 0.036, -0.05);
  gun.add(stamp);
  box('stampPad', [0.03, 0.006, 0.026], [0, 0.006, 0], 'sightColor', stamp);
  box('stampBlock', [0.024, 0.012, 0.02], [0, 0.015, 0], 'accentColor', stamp);
  tube('stampStem', 0.004, 0.004, 0.022, [0, 0.03, 0], 'metalColor', stamp).rotation.x = 0;
  mesh('stampKnob', new THREE.SphereGeometry(0.011, 10, 7), [0, 0.046, 0], 'gripColor', stamp);

  // The screen on the back, tipped up toward you: RETURN? Y/N.
  const bezel = box('returnScreenBezel', [0.06, 0.04, 0.006], [0, 0.0, 0.112], 'darkColor');
  bezel.rotation.x = -0.35;
  const screen = box('returnScreen', [0.052, 0.032, 0.002], [0, 0.0012, 0.1155], 'screenColor');
  screen.rotation.x = -0.35;

  // Grip and trigger.
  const grip = box('returnGrip', [0.043, 0.12, 0.052], [0, -0.095, 0.028], 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box('returnTrigger', [0.012, 0.03, 0.014], [0, -0.06, -0.016], 'metalColor');
  box('returnTriggerGuard', [0.014, 0.006, 0.05], [0, -0.08, -0.018], 'darkColor');

  // Canisters for the support hand during the reload (built here, hidden; the model attaches them to the hand): the spent one, scuffed dark,
  // and the fresh parcel.
  const spent = buildCanister(mesh, tube, 'darkColor');
  spent.name = 'spentCanister';
  const fresh = buildCanister(mesh, tube, 'canisterColor');
  fresh.name = 'freshCanister';

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.004, -0.262);
  gun.add(muzzle);

  const mounts = {
    barrel: { position: [0, -0.004, -0.262], radius: 0.08, size: { w: 0.16, h: 0.16 } },
    top: { position: [-0.026, 0.04, -0.055] }, // the top front, left of the sight line (the stamp is on the right)
    side: { position: [0.052, -0.004, -0.04] },
    grip: { position: [0, -0.095, 0.028], rotation: [0.3, 0, 0], size: { w: 0.043, h: 0.12, d: 0.052 } },
    magazine: { position: [0.054, -0.012, 0.06], rotation: [0, 0, Math.PI / 2], gunId: 'returnToSender' }, // a spare canister on the right of the body
    sticker: { position: [-0.053, -0.004, 0.025] }, // the left side
  };
  return { gun, muzzle, trigger, lid, stamp, seated, spent, fresh, mounts };
}

// A parcel canister lying along Z: a body of `color`, a parcel-tape band, white end caps.
function buildCanister(mesh, tube, color) {
  const group = new THREE.Group();
  tube('canisterBody', 0.024, 0.024, 0.1, [0, 0, 0], color, group, { segments: 10 });
  tube('canisterBand', 0.0245, 0.0245, 0.018, [0, 0, 0.01], 'batteryColor', group, { segments: 10 });
  for (const z of [-0.052, 0.052]) tube('canisterCap', 0.022, 0.022, 0.006, [0, 0, z], 'accentColor', group, { segments: 10 });
  return group;
}

export function buildReturnToSenderDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildReturnToSenderModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, lid, stamp, seated, spent, fresh, mounts } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.028, -0.027, 0),
    thumbOffset: new THREE.Vector3(0, -0.022, 0),
    fingerSize: new THREE.Vector3(0.036, 0.016, 0.06),
    fingerOffset: new THREE.Vector3(-0.018, 0.004, 0),
  });
  leftArm.name = 'returnSupportArm';
  for (const held of [spent, fresh]) {
    held.position.set(...vm.reload.canisterInHand);
    held.visible = false;
    leftArm.add(held);
  }
  const stampRestY = stamp.position.y;
  const pose = { pos: new THREE.Vector3(), rot: new THREE.Euler() };
  const during = (windows, p) => windows.some(([a, b]) => p > a && p < b);
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
      const reloading = reloadWeight > 0.5;
      // The lid (lidKeys pos[0]: 0 shut .. 1 open) and the stamp (stampKeys pos[0]: 0 up .. 1 pressed).
      samplePose(r.lidKeys, reloadProgress, pose.pos, pose.rot);
      lid.rotation.z = pose.pos.x * reloadWeight * r.lidOpenDegrees * DEG_TO_RAD;
      samplePose(r.stampKeys, reloadProgress, pose.pos, pose.rot);
      stamp.position.y = stampRestY - pose.pos.x * reloadWeight * r.stampTravel;
      // The canisters: the seated one is out over canisterOut; the spent one in the hand until it is tossed, then the fresh one until it is in.
      seated.visible = !(reloading && during([r.canisterOut], reloadProgress));
      spent.visible = reloading && during(r.spentVisible, reloadProgress);
      fresh.visible = reloading && during(r.freshVisible, reloadProgress);
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
