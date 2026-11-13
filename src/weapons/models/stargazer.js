// =============================================================================
// STARGAZER 3000 MODEL (first person & the claw machine's chute display)
// A hobby-shop telescope turned bolt-action rifle: a navy telescope tube riding on brass scope rings over a dark rail, with a fat objective
// bell and a blue lens at the front, focus turrets on top and side, a knurled focus ring, a little finder scope beside it, gold stars printed
// down the receiver, a slim fluted steel barrel with a brass crown and a tiny ringed-planet front sight, a folded three-leg tripod under it,
// a shaped wooden stock with a navy cheek rest, and a bolt handle with a brass ball on the right. Behind the bolt, a loading port: pull the
// bolt back and the next bearings show in it. The port is on the LEFT side, the side the camera sees.
// After every shot the bolt is worked by itself (config: weapons.stargazer.viewmodel.fire). The reload is a real bolt-action strip load
// (viewmodel.reload): the TRIGGER hand leaves the grip to lift and pull the bolt (boltHandKeys, boltKeys), the support hand fetches a strip
// of bearings, presses them sideways into the port and flicks the empty clip away, then the trigger hand closes the bolt.
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
  const post = (name, radius, height, at, key, parent = gun, segments = 12) => { // an upright cylinder (along Y)
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat(key));
    mesh.name = name;
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

  // Receiver, the scope rail on top, and the loading port on the left (a dark slot: you see it from where you hold the gun).
  box('stargazerReceiver', [0.06, 0.07, 0.24], [0, 0, -0.07], 'bodyColor');
  box('stargazerFrame', [0.064, 0.016, 0.26], [0, -0.042, -0.08], 'darkColor');
  box('stargazerRail', [0.032, 0.008, 0.21], [0, 0.039, -0.08], 'darkColor');
  box('stargazerPort', [0.003, 0.02, 0.05], [-0.0305, 0.01, -0.06], 'darkColor');
  box('portLip', [0.004, 0.004, 0.056], [-0.031, -0.002, -0.06], 'accentColor'); // a brass lip under it
  for (const [y, z, s] of [[0.012, -0.012, 0.022], [-0.018, -0.1, 0.014], [0.016, -0.125, 0.016]]) star(-0.032, y, z, s); // printed stars
  star(0.032, -0.012, -0.12, 0.02);

  // The fore-end: wood with a dark finger groove each side and a brass cap at its tip.
  box('stargazerForeEnd', [0.054, 0.05, 0.16], [0, -0.03, -0.27], 'gripColor');
  for (const x of [-0.0275, 0.0275]) box('foreEndGroove', [0.002, 0.006, 0.12], [x, -0.026, -0.27], 'darkColor');
  box('foreEndCap', [0.058, 0.054, 0.012], [0, -0.03, -0.356], 'accentColor');

  // The barrel: slim steel, two dark flutes, a brass band, a brass crown, and the front sight: a little ringed planet on a post.
  tube('stargazerBarrel', 0.015, 0.34, [0, 0.004, -0.4], 'metalColor', gun, 10);
  for (const z of [-0.44, -0.47, -0.5]) tube('barrelFlute', 0.0162, 0.006, [0, 0.004, z], 'darkColor', gun, 10);
  tube('barrelBand', 0.019, 0.012, [0, 0.004, -0.375], 'accentColor', gun, 10);
  tube('stargazerCrown', 0.023, 0.035, [0, 0.004, -0.575], 'accentColor', gun, 12);
  tube('stargazerBore', 0.009, 0.004, [0, 0.004, -0.594], 'darkColor', gun, 8);
  box('planetPost', [0.004, 0.02, 0.004], [0, 0.027, -0.55], 'metalColor');
  ball('planetSight', 0.008, [0, 0.043, -0.55], 'sightColor');
  const planetRing = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0016, 4, 18), mat('accentColor'));
  planetRing.name = 'planetRing';
  planetRing.position.set(0, 0.043, -0.55);
  planetRing.rotation.set(Math.PI / 2 - 0.4, 0, 0.3);
  gun.add(planetRing);

  // The telescope: a navy tube on two brass rings, its bell and lens at the front, turrets, a focus ring and the eyepiece at the back.
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
  post('scopeTurret', 0.012, 0.016, [0, 0.036, 0], 'metalColor', scope); // elevation turret on top...
  post('scopeTurretCap', 0.014, 0.008, [0, 0.047, 0], 'accentColor', scope);
  post('scopeTurret', 0.012, 0.016, [0.036, 0, 0], 'metalColor', scope).rotation.z = Math.PI / 2; // ...and windage on the right
  post('scopeTurretCap', 0.014, 0.008, [0.047, 0, 0], 'accentColor', scope).rotation.z = Math.PI / 2;
  tube('scopeFocusRing', 0.033, 0.022, [0, 0, 0.125], 'darkColor', scope, 10); // knurled (10 flat sides)
  tube('scopeEyepiece', 0.021, 0.06, [0, 0, 0.18], 'darkColor', scope, 12);
  tube('scopeEyecup', 0.025, 0.014, [0, 0, 0.215], 'gripColor', scope, 12);
  // The finder scope beside it (every telescope has one), and a gold star on each side of the tube.
  tube('finderScope', 0.009, 0.1, [-0.04, 0.03, -0.03], 'metalColor', scope, 8);
  tube('finderLens', 0.0095, 0.003, [-0.04, 0.03, -0.0815], 'lensColor', scope, 8);
  box('finderMount', [0.02, 0.008, 0.012], [-0.025, 0.02, -0.03], 'metalColor', scope);
  star(-0.031, 0, -0.06, 0.022, scope);
  star(0.031, 0, -0.06, 0.018, scope);
  box('stargazerSight', [0.008, 0.008, 0.008], [0, 0.034, -0.12], 'sightColor', scope); // a tiny bead on the tube

  // The folded tripod under the barrel (decoration: it never unfolds): three legs from a clamp, with rubber feet.
  box('tripodClamp', [0.026, 0.014, 0.024], [0, -0.062, -0.34], 'darkColor');
  for (const [x, y, yaw] of [[-0.012, -0.044, -0.04], [0.012, -0.044, 0.04], [0, -0.056, 0]]) {
    const leg = box('tripodLeg', [0.008, 0.008, 0.2], [x, y, -0.44], 'metalColor');
    leg.rotation.y = yaw;
    box('tripodFoot', [0.012, 0.012, 0.014], [x * 1.4, y, -0.545], 'darkColor');
  }

  // The stock: a sloping wooden wrist, the butt with a navy cheek rest on top and an angled toe, a dark butt pad, a sling swivel.
  const wrist = box('stargazerWrist', [0.038, 0.048, 0.1], [0, -0.016, 0.09], 'gripColor');
  wrist.rotation.x = -0.12;
  box('stargazerStock', [0.048, 0.078, 0.14], [0, -0.036, 0.2], 'gripColor');
  box('stargazerCheekRest', [0.042, 0.02, 0.11], [0, 0.012, 0.205], 'bodyColor');
  const toe = box('stargazerToe', [0.046, 0.03, 0.07], [0, -0.078, 0.236], 'gripColor');
  toe.rotation.x = 0.32;
  box('stargazerButt', [0.052, 0.115, 0.016], [0, -0.034, 0.278], 'darkColor');
  box('buttPlateTrim', [0.054, 0.006, 0.018], [0, 0.023, 0.278], 'accentColor');
  const swivel = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 4, 10), mat('metalColor'));
  swivel.name = 'slingSwivel';
  swivel.rotation.y = Math.PI / 2;
  swivel.position.set(0, -0.083, 0.17);
  gun.add(swivel);
  star(-0.025, -0.03, 0.2, 0.03);

  // Grip, trigger and guard.
  const grip = box('stargazerGrip', [0.04, 0.115, 0.05], [0, -0.09, 0.03], 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box('stargazerTrigger', [0.01, 0.026, 0.01], [0, -0.062, -0.01], 'metalColor');
  box('triggerGuard', [0.012, 0.006, 0.06], [0, -0.08, -0.012], 'darkColor');

  // The bolt: a shaft on the right of the receiver (over the port); its handle (a group, so it can lift) ends in a brass ball.
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

  // The next bearings, in the port: seen only while the bolt is back (the action is open).
  const portBearings = new THREE.Group();
  portBearings.name = 'stargazerPortBearings';
  gun.add(portBearings);
  for (const z of [-0.075, -0.06, -0.045]) ball('portBearing', 0.0058, [-0.029, 0.01, z], 'metalColor', portBearings);

  // A strip of bearings, held by the support hand during the reload (built here, hidden; the model attaches it to the hand).
  // The bearings are their own group so they can be pressed off the clip into the port.
  const strip = new THREE.Group();
  strip.name = 'stargazerStrip';
  box('stripClip', [0.012, 0.004, 0.06], [0, -0.008, 0], 'metalColor', strip);
  const stripBearings = new THREE.Group();
  stripBearings.name = 'stripBearings';
  strip.add(stripBearings);
  for (let i = 0; i < 5; i++) ball('stripBearing', 0.006, [0, 0, -0.024 + i * 0.012], 'metalColor', stripBearings);

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
  return { gun, muzzle, trigger, bolt, handle, portBearings, strip, stripBearings, mounts };
}

export function buildStargazerDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildStargazerModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, bolt, handle, portBearings, strip, stripBearings, mounts } = buildGun(resolveGunColors(def, skinId));
  const before = new Set(gun.children);
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.006, -0.058, -0.25),
    thumbOffset: new THREE.Vector3(0, -0.015, 0),
  });
  leftArm.name = 'stargazerSupportArm';
  // The trigger hand works the bolt in the reload: gather its parts (everything the arms added besides the support arm) under one pivot
  // at the palm, so reload.boltHandKeys can move and turn the hand about itself.
  const boltArm = new THREE.Group();
  boltArm.name = 'stargazerBoltArm';
  const palmPivot = new THREE.Vector3(...vm.reload.boltHandPivot);
  boltArm.position.copy(palmPivot);
  for (const part of gun.children.filter((c) => !before.has(c) && c !== leftArm)) {
    gun.remove(part);
    part.position.sub(palmPivot);
    boltArm.add(part);
  }
  gun.add(boltArm);
  // The strip lies against the support palm's inner face, turned so its bearings point at the gun (+X) with the clip behind them.
  // (leftArm's parts are placed at leftOffset; the group itself is at the gun's origin.)
  strip.position.set(...vm.reload.stripInPalm);
  strip.rotation.z = -Math.PI / 2;
  strip.visible = false;
  leftArm.add(strip);
  const boltRestZ = bolt.position.z;
  const pose = { pos: new THREE.Vector3(), rot: new THREE.Euler() };

  // How far the bolt is worked after a shot (0 closed .. 1 lifted and fully back), from the time since the shot.
  function boltCycle(sinceFire, f) {
    const t = (sinceFire - f.boltDelay) / f.boltSeconds;
    if (t <= 0 || t >= 1) return { lift: 0, back: 0 };
    // Lift (0-0.2), back (0.2-0.5), forward (0.5-0.8), drop (0.8-1).
    const lift = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
    const back = t < 0.2 ? 0 : t < 0.5 ? (t - 0.2) / 0.3 : t < 0.8 ? 1 - (t - 0.5) / 0.3 : 0;
    return { lift, back };
  }
  const during = (windows, p) => windows.some(([a, b]) => p > a && p < b);

  return {
    mounts, // where upgrade parts go (models/upgradeParts.js)
    root: gun, muzzle,
    animate({ sinceFire, reloadProgress, reloadWeight, loaded = true }) {
      const f = vm.fire;
      const pull = sinceFire < f.pressSeconds ? sinceFire / f.pressSeconds
        : Math.max(0, 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds);
      trigger.rotation.x = pull * f.triggerDegrees * DEG_TO_RAD;
      const r = vm.reload;
      const reloading = reloadWeight > 0.5;
      // The bolt: the shot's own cycle, or the reload's keys (pos[0] = lift, pos[1] = back), blended by reloadWeight.
      let { lift, back } = boltCycle(sinceFire, f);
      samplePose(r.boltKeys, reloadProgress, pose.pos, pose.rot);
      lift += (pose.pos.x - lift) * reloadWeight;
      back += (pose.pos.y - back) * reloadWeight;
      handle.rotation.z = lift * f.boltLiftDegrees * DEG_TO_RAD;
      bolt.position.z = boltRestZ + back * f.boltTravel;
      // The next bearings show in the port when the bolt is back: after a shot if any are left; in a reload once they are pressed in.
      portBearings.visible = back > 0.5 && (reloading ? reloadProgress > r.portFilledFrom : loaded);
      // The hands (offsets from where they rest on the gun), scaled out as a cancelled reload eases away.
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      samplePose(r.boltHandKeys, reloadProgress, pose.pos, pose.rot);
      boltArm.position.copy(palmPivot).addScaledVector(pose.pos, reloadWeight);
      boltArm.rotation.set(pose.rot.x * reloadWeight, pose.rot.y * reloadWeight, pose.rot.z * reloadWeight);
      // The strip: in the hand, its bearings pressed off the clip into the gun over stripPress, then gone into the port.
      strip.visible = reloading && during(r.stripVisible, reloadProgress);
      const [pressFrom, pressTo] = r.stripPress;
      const press = Math.max(0, Math.min(1, (reloadProgress - pressFrom) / (pressTo - pressFrom)));
      stripBearings.position.y = press * r.stripPressDepth; // (the strip is turned: its +Y is the gun's +X)
      stripBearings.visible = press < 1;
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
