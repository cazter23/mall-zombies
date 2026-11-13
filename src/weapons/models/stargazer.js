// =============================================================================
// STARGAZER 3000 MODEL (first person & the claw machine's chute display)
// A hobby-shop telescope turned bolt-action rifle: a navy telescope tube riding on brass scope rings, with a fat objective bell and a blue lens at
// the front, a little finder scope beside it, gold stars printed down the receiver, a slim steel barrel with a brass crown and a folded tripod
// under it, a wooden stock, and a bolt handle with a brass ball on the right that is worked after every shot (config:
// weapons.stargazer.viewmodel.fire) and stays open through the reload while the support hand thumbs in a strip of bearings.
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
      const metal = key === 'metalColor' || key === 'accentColor';
      const lens = key === 'lensColor';
      const glow = key === 'sightColor' || key === 'starColor' || lens;
      materials.set(key, new THREE.MeshStandardMaterial({
        color: colors[key],
        roughness: lens ? 0.1 : metal ? 0.32 : key === 'gripColor' ? 0.8 : 0.55,
        metalness: metal ? 0.65 : 0.1,
        ...(glow ? { emissive: colors[key], emissiveIntensity: lens ? 0.35 : 0.5 } : {}),
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
    mesh.rotation.x = Math.PI / 2; // along Z (the cylinder's top end points to -Z)
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  };
  const ball = (name, radius, at, key, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 7), mat(key));
    mesh.name = name;
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  };
  // A four-point star: two thin crossed bars, flat against a side of the gun (x = the face it sits on, 2 mm proud).
  const star = (x, y, z, size, parent = gun) => {
    box('star', [0.002, size, size * 0.28], [x, y, z], 'starColor', parent);
    box('star', [0.002, size * 0.28, size], [x, y, z], 'starColor', parent);
  };

  // Receiver and fore-end.
  box('stargazerReceiver', [0.06, 0.07, 0.24], [0, 0, -0.07], 'bodyColor');
  box('stargazerFrame', [0.064, 0.016, 0.26], [0, -0.042, -0.08], 'darkColor');
  box('stargazerForeEnd', [0.054, 0.05, 0.16], [0, -0.03, -0.27], 'gripColor');
  for (const [y, z, s] of [[0.012, -0.02, 0.026], [-0.012, -0.08, 0.018], [0.016, -0.13, 0.014]]) star(-0.032, y, z, s); // printed stars
  star(0.032, 0.012, -0.15, 0.02);

  // The barrel: slim steel with a brass crown.
  tube('stargazerBarrel', 0.015, 0.34, [0, 0.004, -0.4], 'metalColor', gun, 10);
  tube('stargazerCrown', 0.023, 0.035, [0, 0.004, -0.575], 'accentColor', gun, 12);
  tube('stargazerBore', 0.009, 0.004, [0, 0.004, -0.594], 'darkColor', gun, 8);

  // The telescope: a navy tube on two brass rings, its bell and lens at the front, the eyepiece at the back.
  const scope = new THREE.Group();
  scope.name = 'stargazerScope';
  scope.position.set(0, 0.078, -0.1);
  gun.add(scope);
  tube('scopeTube', 0.03, 0.3, [0, 0, 0], 'bodyColor', scope);
  tube('scopeBell', 0.046, 0.08, [0, 0, -0.19], 'bodyColor', scope, 16, 0.03);
  tube('scopeLens', 0.041, 0.004, [0, 0, -0.232], 'lensColor', scope, 16);
  tube('scopeBellRing', 0.049, 0.014, [0, 0, -0.226], 'accentColor', scope, 16);
  for (const z of [-0.07, 0.07]) {
    tube('scopeRing', 0.034, 0.016, [0, 0, z], 'accentColor', scope, 14);
    box('scopeMount', [0.018, 0.04, 0.018], [0, -0.04, z], 'metalColor', scope);
  }
  tube('scopeEyepiece', 0.021, 0.06, [0, 0, 0.18], 'darkColor', scope, 12);
  tube('scopeEyecup', 0.025, 0.014, [0, 0, 0.215], 'gripColor', scope, 12);
  // The finder scope beside it (every telescope has one), and a gold star on the tube.
  tube('finderScope', 0.009, 0.1, [-0.04, 0.03, -0.03], 'metalColor', scope, 8);
  box('finderMount', [0.02, 0.008, 0.012], [-0.025, 0.02, -0.03], 'metalColor', scope);
  star(-0.031, 0, -0.06, 0.022, scope);
  box('stargazerSight', [0.008, 0.008, 0.008], [0, 0.034, -0.12], 'sightColor', scope); // a tiny bead on the tube

  // The folded tripod under the barrel (decoration: it never unfolds).
  for (const side of [-1, 1]) {
    const leg = box('tripodLeg', [0.008, 0.008, 0.2], [side * 0.012, -0.03, -0.43], 'metalColor');
    leg.rotation.y = side * 0.04;
  }
  box('tripodFoot', [0.034, 0.012, 0.014], [0, -0.03, -0.535], 'darkColor');

  // The stock (wood) and butt pad.
  box('stargazerWrist', [0.04, 0.05, 0.1], [0, -0.012, 0.09], 'gripColor');
  box('stargazerStock', [0.05, 0.085, 0.13], [0, -0.025, 0.19], 'gripColor');
  box('stargazerButt', [0.054, 0.09, 0.016], [0, -0.025, 0.262], 'darkColor');
  star(-0.026, -0.02, 0.19, 0.03);

  // Grip, trigger and guard.
  const grip = box('stargazerGrip', [0.04, 0.115, 0.05], [0, -0.09, 0.03], 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box('stargazerTrigger', [0.01, 0.026, 0.01], [0, -0.062, -0.01], 'metalColor');
  box('triggerGuard', [0.012, 0.006, 0.06], [0, -0.08, -0.012], 'darkColor');

  // The bolt: a shaft on the right of the receiver; its handle (a group, so it can lift) ends in a brass ball.
  const bolt = new THREE.Group();
  bolt.name = 'stargazerBolt';
  bolt.position.set(0.032, 0.018, 0.0);
  gun.add(bolt);
  box('boltShaft', [0.014, 0.014, 0.08], [0, 0, 0], 'metalColor', bolt);
  const handle = new THREE.Group();
  handle.name = 'stargazerBoltHandle';
  handle.position.set(0, 0, 0.03);
  bolt.add(handle);
  box('boltArm', [0.045, 0.01, 0.01], [0.022, -0.008, 0], 'metalColor', handle);
  ball('boltKnob', 0.013, [0.047, -0.014, 0], 'accentColor', handle);

  // A strip of bearings, held by the support hand during the reload (built here, hidden; the model attaches it to the hand).
  const strip = new THREE.Group();
  strip.name = 'stargazerStrip';
  box('stripClip', [0.012, 0.004, 0.06], [0, -0.008, 0], 'metalColor', strip);
  for (let i = 0; i < 5; i++) ball('stripBearing', 0.006, [0, 0, -0.024 + i * 0.012], 'metalColor', strip);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.004, -0.596);
  gun.add(muzzle);

  const mounts = {
    barrel: { position: [0, 0.004, -0.593], radius: 0.026, size: { w: 0.06, h: 0.06 } },
    top: { position: [0.02, 0.05, -0.32] }, // on the fore-end's top, clear of the telescope
    side: { position: [0.03, -0.03, -0.27] }, // the fore-end's right side
    grip: { position: [0, -0.09, 0.03], rotation: [0.3, 0, 0], size: { w: 0.04, h: 0.115, d: 0.05 } },
    magazine: { position: [0, -0.06, -0.09], gunId: 'stargazer' }, // a box magazine under the receiver
    sticker: { position: [-0.0315, -0.014, -0.17] }, // the receiver's left side, past the stars
  };
  return { gun, muzzle, trigger, bolt, handle, strip, mounts };
}

export function buildStargazerDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildStargazerModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, bolt, handle, strip, mounts } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.006, -0.058, -0.25),
    thumbOffset: new THREE.Vector3(0, -0.015, 0),
  });
  leftArm.name = 'stargazerSupportArm';
  strip.position.set(-0.01, 0.01, -0.03);
  strip.visible = false;
  leftArm.add(strip);
  const boltRestZ = bolt.position.z;

  // How far the bolt is worked (0 closed .. 1 lifted and fully back), from the time since the shot.
  function boltCycle(sinceFire, f) {
    const t = (sinceFire - f.boltDelay) / f.boltSeconds;
    if (t <= 0 || t >= 1) return { lift: 0, back: 0 };
    // Lift (0-0.2), back (0.2-0.5), forward (0.5-0.8), drop (0.8-1).
    const lift = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
    const back = t < 0.2 ? 0 : t < 0.5 ? (t - 0.2) / 0.3 : t < 0.8 ? 1 - (t - 0.5) / 0.3 : 0;
    return { lift, back };
  }

  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun, muzzle,
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      const f = vm.fire;
      const pull = sinceFire < f.pressSeconds ? sinceFire / f.pressSeconds
        : Math.max(0, 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds);
      trigger.rotation.x = pull * f.triggerDegrees * DEG_TO_RAD;
      const r = vm.reload;
      let { lift, back } = boltCycle(sinceFire, f);
      const open = reloadWeight > 0.5 && r.boltOpen.some(([a, b]) => reloadProgress > a && reloadProgress < b);
      if (open) { lift = 1; back = 1; }
      handle.rotation.z = lift * f.boltLiftDegrees * DEG_TO_RAD;
      bolt.position.z = boltRestZ + back * f.boltTravel;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      strip.visible = reloadWeight > 0.5 && r.stripVisible.some(([a, b]) => reloadProgress > a && reloadProgress < b);
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
