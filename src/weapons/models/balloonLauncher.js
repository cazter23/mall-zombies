// =============================================================================
// BALLOON LAUNCHER MODEL (first person & the claw machine's chute display)
// A party-store helium blaster: a teal body with pink stripes and polka dots, a round tail cap, a silver helium tank lying along the top
// with domed ends, a valve wheel at its front and a hose curling down to the nozzle, a white-faced pressure gauge with a pink rim, a
// ribbed rubber nozzle with three curly ribbons, and the usual pistol grip. A helium CARTRIDGE screws into the tank's back end (in view
// above the grip). While loaded a teardrop balloon with a knot sits on the nozzle and INFLATES after each shot (and at the end of a
// reload) over viewmodel.fire.inflateSeconds (state.sinceFire, state.loaded); the gauge's needle dips with each shot.
// Reload (config: weapons.balloonLauncher.viewmodel.reload): the balloon lets go, the support hand unscrews the spent cartridge and tosses
// it, fetches a new one, screws it in (the needle climbs as it hisses), taps the gauge, and the balloon blows back up.
// Points down -Z (the way the camera looks).
// =============================================================================

import * as THREE from 'three';
import { resolveGunColors } from '../skinPalette.js';
import { samplePose } from '../../core/keyframes.js';
import { buildPistolArms } from './arms.js';

const DEG_TO_RAD = Math.PI / 180;

// A teardrop balloon (round, narrowing to the knot at +Z, which faces the nozzle), lathed about Y then laid along Z.
function balloonGeometry() {
  const points = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI; // 0 at the far end, PI at the knot
    const r = Math.sin(a) * (1 - 0.32 * (i / 10) ** 2); // fuller at the far end
    points.push(new THREE.Vector2(Math.max(r * 0.05, 0.0005), -Math.cos(a) * 0.062));
  }
  return new THREE.LatheGeometry(points, 12).rotateX(-Math.PI / 2); // lathe's +Y (the knot end) -> +Z
}

// A curly ribbon: a thin tube down a small helix, hanging from the nozzle.
function ribbonGeometry(length, turns, radius, phase) {
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => {
    const k = i / 12, a = phase + k * turns * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * radius, -k * length, Math.sin(a) * radius);
  }));
  return new THREE.TubeGeometry(curve, 24, 0.0018, 4, false);
}

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
  const mesh = (name, geometry, at, key, parent = gun) => {
    const m = new THREE.Mesh(geometry, mat(key));
    m.name = name;
    m.position.set(...at);
    parent.add(m);
    return m;
  };
  const box = (name, size, at, key, parent = gun) => mesh(name, new THREE.BoxGeometry(...size), at, key, parent);
  const tube = (name, radius, length, at, key, parent = gun, segments = 14, radiusBack = radius) => {
    const m = mesh(name, new THREE.CylinderGeometry(radius, radiusBack, length, segments), at, key, parent);
    m.rotation.x = Math.PI / 2; // along Z
    return m;
  };
  const dot = (name, radius, at, key, parent = gun) => { // a flat disc on a side of the gun (facing X)
    const m = mesh(name, new THREE.CylinderGeometry(radius, radius, 0.002, 10), at, key, parent);
    m.rotation.z = Math.PI / 2;
    return m;
  };

  // The body: teal, a pink stripe along each side, polka dots, a rounded nose and a round tail cap.
  box('balloonBody', [0.07, 0.08, 0.24], [0, -0.005, -0.06], 'bodyColor');
  for (const x of [-0.036, 0.036]) box('bodyStripe', [0.002, 0.014, 0.22], [x, 0.008, -0.06], 'accentColor');
  for (const [x, y, z, r] of [[-0.036, -0.026, -0.15, 0.009], [0.036, -0.024, -0.13, 0.01], [0.036, -0.03, -0.06, 0.007], [0.036, -0.022, 0.0, 0.009]]) {
    dot('polkaDot', r, [x, y, z], x < 0 ? 'ribbonColor' : 'accentColor');
  }
  tube('bodyNose', 0.04, 0.05, [0, -0.005, -0.2], 'bodyColor', gun, 14);
  tube('noseRing', 0.042, 0.008, [0, -0.005, -0.222], 'accentColor', gun, 14);
  tube('tailCap', 0.036, 0.03, [0, -0.012, 0.072], 'bodyColor', gun, 12, 0.03);

  // The helium tank along the top: domed both ends, two pink bands, a valve wheel in front, a hose from it down to the nozzle.
  tube('heliumTank', 0.026, 0.2, [0, 0.062, -0.04], 'tankColor', gun, 14);
  const tankCap = mesh('tankCap', new THREE.SphereGeometry(0.026, 12, 8), [0, 0.062, -0.14], 'tankColor');
  tankCap.scale.z = 0.7;
  for (const z of [0.02, -0.1]) tube('tankBand', 0.0275, 0.012, [0, 0.062, z], 'accentColor', gun, 14);
  box('valveStem', [0.008, 0.008, 0.02], [0, 0.062, -0.165], 'metalColor');
  mesh('valveWheel', new THREE.TorusGeometry(0.013, 0.0032, 5, 12), [0, 0.062, -0.176], 'accentColor');
  box('valveSpoke', [0.026, 0.004, 0.004], [0, 0.062, -0.176], 'accentColor').rotation.z = Math.PI / 4;
  box('valveSpoke', [0.026, 0.004, 0.004], [0, 0.062, -0.176], 'accentColor').rotation.z = -Math.PI / 4;
  const hose = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.012, 0.055, -0.16), new THREE.Vector3(0.03, 0.04, -0.19),
    new THREE.Vector3(0.03, 0.012, -0.22), new THREE.Vector3(0.016, 0.0, -0.24),
  ]);
  mesh('heliumHose', new THREE.TubeGeometry(hose, 10, 0.004, 5, false), [0, 0, 0], 'darkColor');
  // The pressure gauge on the tank's right: a pink rim, a white face, a dark needle (turned by the model).
  const gauge = new THREE.Group();
  gauge.name = 'pressureGauge';
  gauge.position.set(0.03, 0.07, 0.02);
  gun.add(gauge);
  tube('gaugeRim', 0.017, 0.008, [0, 0, 0], 'accentColor', gauge, 14).rotation.set(0, 0, Math.PI / 2);
  tube('gaugeFace', 0.014, 0.002, [0.004, 0, 0], 'tankColor', gauge, 14).rotation.set(0, 0, Math.PI / 2);
  const needle = new THREE.Group(); // pivots on the dial's centre; the bar points up at 0
  needle.name = 'gaugeNeedle';
  needle.position.set(0.0056, 0, 0);
  gauge.add(needle);
  box('gaugeNeedleBar', [0.002, 0.012, 0.002], [0, 0.005, 0], 'darkColor', needle);

  // The helium cartridge screwed into the tank's back (hidden by the model while it is out in a reload), and its threaded collar.
  tube('cartridgeCollar', 0.019, 0.01, [0, 0.062, 0.065], 'darkColor', gun, 10);
  const seated = buildCartridge(mesh, tube, box);
  seated.name = 'seatedCartridge';
  seated.position.set(0, 0.062, 0.07);
  gun.add(seated);

  // The nozzle: steel, a ribbed rubber tip, and its ribbons.
  tube('nozzle', 0.012, 0.06, [0, -0.005, -0.25], 'metalColor', gun, 10);
  for (const z of [-0.272, -0.282]) tube('nozzleRib', 0.0155, 0.005, [0, -0.005, z], 'darkColor', gun, 10);
  tube('nozzleLip', 0.016, 0.006, [0, -0.005, -0.29], 'accentColor', gun, 10);
  for (const [x, len, turns, r, phase] of [[-0.01, 0.09, 2.5, 0.005, 0], [0.01, 0.12, 3, 0.006, 1.6], [0.0, 0.07, 2, 0.004, 3]]) {
    mesh('ribbon', ribbonGeometry(len, turns, r, phase), [x, -0.012, -0.262], 'ribbonColor');
  }
  box('sightBead', [0.008, 0.008, 0.008], [0, 0.092, -0.12], 'sightColor');

  // The balloon on the nozzle (scaled by the model as it inflates), with its knot.
  const balloon = new THREE.Group();
  balloon.name = 'nozzleBalloon';
  balloon.position.set(0, -0.005, -0.293);
  gun.add(balloon);
  const skin = mesh('balloonSkin', balloonGeometry(), [0, 0, -0.066], 'balloonColor', balloon);
  skin.scale.set(1, 1.05, 1);
  mesh('balloonKnot', new THREE.ConeGeometry(0.008, 0.012, 6).rotateX(-Math.PI / 2), [0, 0, -0.004], 'balloonColor', balloon);

  // Grip (with a pink cap), trigger and guard.
  const grip = box('balloonGrip', [0.042, 0.115, 0.05], [0, -0.095, 0.03], 'gripColor');
  grip.rotation.x = 0.3;
  const gripCap = box('gripCap', [0.046, 0.012, 0.056], [0, -0.152, 0.048], 'accentColor');
  gripCap.rotation.x = 0.3;
  const trigger = box('balloonTrigger', [0.01, 0.026, 0.01], [0, -0.062, -0.01], 'metalColor');
  box('triggerGuard', [0.012, 0.006, 0.05], [0, -0.08, -0.012], 'darkColor');
  box('tankBase', [0.04, 0.03, 0.05], [0, -0.06, 0.08], 'darkColor'); // a port under the tail (a Jumbo Pack's cartridge goes here)

  // A helium cartridge for the support hand during the reload (built here, hidden; the model attaches it to the hand).
  const cartridge = buildCartridge(mesh, tube, box);
  cartridge.name = 'heliumCartridge';

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
  return { gun, muzzle, trigger, balloon, needle, seated, cartridge, mounts };
}

// A helium cartridge lying along Z, its neck at -Z (the end that screws in): a silver can, a pink label band, a pink cap with a notch.
// Spun about Z by the model (group.rotation.z) as it is screwed in or out.
function buildCartridge(mesh, tube, box) {
  const group = new THREE.Group();
  tube('cartridgeNeck', 0.007, 0.012, [0, 0, -0.006], 'metalColor', group, 8, 0.012);
  tube('cartridgeCan', 0.016, 0.044, [0, 0, 0.022], 'tankColor', group, 10);
  tube('cartridgeLabel', 0.0165, 0.016, [0, 0, 0.022], 'accentColor', group, 10);
  tube('cartridgeCap', 0.014, 0.008, [0, 0, 0.048], 'accentColor', group, 10);
  box('cartridgeNotch', [0.02, 0.004, 0.003], [0, 0, 0.0525], 'darkColor', group); // shows the twist
  return group;
}

export function buildBalloonLauncherDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildBalloonLauncherModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, balloon, needle, seated, cartridge, mounts } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.006, -0.06, -0.15),
    thumbOffset: new THREE.Vector3(0, -0.015, 0),
  });
  leftArm.name = 'balloonSupportArm';
  // The cartridge sits in the support hand's fingers, lying along the gun like the seated one (leftArm's parts are placed at leftOffset).
  cartridge.position.set(...vm.reload.cartridgeInHand);
  cartridge.visible = false;
  leftArm.add(cartridge);
  const twist = { pos: new THREE.Vector3(), rot: new THREE.Euler() };
  const dial = { pos: new THREE.Vector3(), rot: new THREE.Euler() };
  const during = (windows, p) => windows.some(([a, b]) => p > a && p < b);
  const smooth = (t) => t * t * (3 - 2 * t);
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
      // The cartridges: the seated one turns as it is unscrewed and is gone while out; the one in the hand shows the old one being
      // tossed and the new one being brought; both spin by twistKeys (rot[2], degrees about the cartridge's own axis).
      samplePose(r.twistKeys, reloadProgress, twist.pos, twist.rot);
      const spin = reloading ? twist.rot.z : 0;
      seated.visible = !reloading || !during([r.cartridgeOut], reloadProgress);
      seated.rotation.z = spin;
      cartridge.visible = reloading && during(r.cartridgeVisible, reloadProgress);
      cartridge.rotation.z = spin;
      // The balloon: lets go as the reload starts (deflateBy), gone while reloading or empty, blown back up at the end (inflateFrom),
      // and after a shot it grows back over inflateSeconds.
      const inflate = Math.min(1, Math.max(0, sinceFire / f.inflateSeconds));
      let size = loaded ? 0.15 + 0.85 * inflate : 0;
      if (reloading) {
        if (reloadProgress < r.deflateBy) size *= 1 - smooth(reloadProgress / r.deflateBy);
        else if (reloadProgress > r.inflateFrom) size = 0.15 + 0.85 * smooth((reloadProgress - r.inflateFrom) / (1 - r.inflateFrom));
        else size = 0;
      }
      balloon.visible = size > 0.01;
      balloon.scale.setScalar(Math.max(size, 1e-3));
      // The gauge: needleKeys (rot[2], degrees) through the reload; otherwise at rest, dipping with each shot and climbing back as it refills.
      samplePose(r.needleKeys, reloadProgress, dial.pos, dial.rot);
      const rest = f.needleRestDegrees * DEG_TO_RAD;
      const idle = loaded ? rest - (1 - inflate) * f.needleDipDegrees * DEG_TO_RAD : -f.needleEmptyDegrees * DEG_TO_RAD;
      needle.rotation.x = -(idle + (dial.rot.z - idle) * reloadWeight); // (the dial faces +X: turning about X sweeps the needle across it)
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
