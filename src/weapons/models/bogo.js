// =============================================================================
// BOGO MODEL (first person & the claw machine's chute display): AKIMBO.
// Buy One Get One: two compact clearance-red label-tagger SMGs, one in each hand. Each gun: a short boxy receiver, a white label roll on top
// at the back, a stubby shrouded barrel, a stick magazine ahead of the trigger, the usual pistol grip, and a yellow price tag on a string on
// its outer side that swings as you move. The LEFT gun is the right one mirrored (a group scaled -1 in x: Three.js flips the faces for it).
//
// The model is the PAIR (root), so viewmodel.js moves both together (sway, bob, sprint, switching). On top of that, per gun:
//   onFire(flash)  the shots alternate: the next gun becomes the muzzle (model.muzzle) and the muzzle flash moves onto it; that gun kicks
//   animate        each gun's own kick and trigger; the pair spreads wider at the hip and closes in with right mouse (state.aimAmount);
//                  the reload rolls both guns outward, drops both magazines and slides fresh ones up (config: weapons.bogo.viewmodel)
//   createUpgradeVisuals()  attachments, tier trim and stickers on BOTH guns (models/upgradeParts.js once per gun)
//   skinTargets    the skin pattern and badge print on each gun (models/index.js)
//   leftHandVisible  the box cutter swing hides the left gun (that hand is busy)
// =============================================================================

import * as THREE from 'three';
import { resolveGunColors } from '../skinPalette.js';
import { buildPistolArms } from './arms.js';
import { createUpgradeVisuals } from './upgradeParts.js';

const DEG_TO_RAD = Math.PI / 180;
const smooth = t => t * t * (3 - 2 * t);

/** One gun, pointing down -Z, the grip below its back end (where buildPistolArms puts the right hand). */
function buildGun(colors) {
  const gun = new THREE.Group();
  gun.name = 'bogoGun';
  const materials = new Map();
  const mat = (key) => {
    if (!materials.has(key)) {
      const metal = key === 'metalColor';
      const dark = key === 'darkColor' || key === 'gripColor';
      const sight = key === 'sightColor';
      materials.set(key, new THREE.MeshStandardMaterial({
        color: colors[key], roughness: metal ? 0.3 : dark ? 0.75 : key === 'labelColor' ? 0.8 : 0.4,
        metalness: metal ? 0.6 : 0.08, flatShading: true,
        ...(sight ? { emissive: colors[key], emissiveIntensity: 0.6 } : {}),
      }));
    }
    return materials.get(key);
  };
  const box = (name, w, h, d, x, y, z, key, parent = gun) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(key));
    mesh.name = name;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (name, radius, length, x, y, z, key, axis = 'z', parent = gun, sides = 12) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, sides), mat(key));
    mesh.name = name;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    else mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // Receiver: a short clearance-red box with a dark deck and a dark frame under it.
  box('bogoReceiver', 0.05, 0.064, 0.2, 0, 0, -0.06, 'bodyColor');
  box('bogoDeck', 0.044, 0.01, 0.12, 0, 0.037, -0.1, 'darkColor');
  box('bogoFrame', 0.053, 0.014, 0.2, 0, -0.035, -0.06, 'darkColor');
  for (const z of [-0.11, -0.125, -0.14]) box('bogoVent', 0.0525, 0.016, 0.006, 0, 0.008, z, 'darkColor');

  // The label roll on top at the back (its ammunition, like the Price Gun's), in two cheeks.
  for (const x of [-0.02, 0.02]) box('bogoRollCheek', 0.005, 0.03, 0.04, x, 0.05, 0.005, 'darkColor');
  const roll = cylinder('bogoRoll', 0.022, 0.032, 0, 0.062, 0.005, 'labelColor', 'x');
  cylinder('bogoRollBand', 0.0225, 0.008, 0, 0.062, 0.005, 'bodyColor', 'x');
  cylinder('bogoRollHub', 0.009, 0.036, 0, 0.062, 0.005, 'darkColor', 'x', gun, 8);

  // Barrel: a stubby shroud with a collar, a sight bead on top.
  cylinder('bogoShroud', 0.018, 0.06, 0, 0.004, -0.185, 'darkColor');
  cylinder('bogoBarrel', 0.011, 0.05, 0, 0.004, -0.235, 'metalColor');
  cylinder('bogoCollar', 0.016, 0.014, 0, 0.004, -0.258, 'metalColor');
  box('bogoBead', 0.01, 0.012, 0.012, 0, 0.05, -0.15, 'sightColor');

  // Grip, trigger and guard: the pistol grip every gun uses, so the same hand fits.
  const grip = box('bogoGrip', 0.04, 0.115, 0.048, 0, -0.092, 0.022, 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box('bogoTrigger', 0.01, 0.026, 0.012, 0, -0.06, -0.012, 'metalColor');
  box('bogoGuard', 0.02, 0.008, 0.06, 0, -0.084, -0.03, 'darkColor');

  // Stick magazine ahead of the trigger (a group: the reload drops it and slides a fresh one up).
  const magazine = new THREE.Group();
  magazine.name = 'bogoMagazine';
  magazine.position.set(0, -0.08, -0.095);
  gun.add(magazine);
  box('bogoMagBody', 0.03, 0.11, 0.04, 0, 0, 0, 'darkColor', magazine);
  box('bogoMagBand', 0.033, 0.02, 0.043, 0, -0.035, 0, 'accentColor', magazine);
  box('bogoMagFloor', 0.034, 0.01, 0.046, 0, -0.058, 0, 'gripColor', magazine);

  // The yellow price tag on its string, on the gun's outer side (+x: the left gun's is mirrored out to its left). It swings (animate).
  const tag = new THREE.Group();
  tag.name = 'bogoTag';
  tag.position.set(0.027, -0.012, 0.03);
  gun.add(tag);
  box('bogoTagString', 0.002, 0.03, 0.002, 0.002, -0.015, 0, 'labelColor', tag);
  box('bogoTagCard', 0.003, 0.036, 0.026, 0.003, -0.044, 0, 'accentColor', tag);
  box('bogoTagHole', 0.0035, 0.006, 0.006, 0.003, -0.03, 0, 'darkColor', tag);
  box('bogoTagStripe', 0.0035, 0.006, 0.02, 0.003, -0.05, 0, 'bodyColor', tag);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.004, -0.266);
  gun.add(muzzle);

  const mounts = {
    barrel: { position: [0, 0.004, -0.264], radius: 0.02, size: { w: 0.04, h: 0.04 } },
    top: { position: [0, 0.048, -0.09] },
    side: { position: [0.03, -0.004, -0.12] },
    grip: { position: [0, -0.092, 0.022], rotation: [0.3, 0, 0], size: { w: 0.04, h: 0.115, d: 0.048 } },
    magazine: { parent: magazine, position: [0, -0.06, 0], gunId: 'bogo' },
    sticker: { position: [-0.0255, -0.005, -0.04] }, // the inner side of the receiver
  };
  return { gun, muzzle, trigger, magazine, roll, tag, mounts };
}

/** The pair for the claw machine's chute: side by side, no hands. */
export function buildBogoDisplay(def) {
  const colors = resolveGunColors(def);
  const pair = new THREE.Group();
  const right = buildGun(colors);
  right.gun.position.x = 0.04;
  const mirror = new THREE.Group();
  mirror.scale.x = -1;
  const left = buildGun(colors);
  left.gun.position.x = 0.04;
  mirror.add(left.gun);
  pair.add(right.gun, mirror);
  pair.userData.skinTargets = [right, left].map(s => ({ root: s.gun, mounts: s.mounts })); // (models/index.js prints a skin on each)
  return pair;
}

export function buildBogoModel(def, skinId) {
  const vm = def.viewmodel;
  const colors = resolveGunColors(def, skinId);
  const root = new THREE.Group();
  root.name = 'bogoPair';

  // One side: pivot (placed and turned in) > kick (its own recoil and the reload roll) > the gun with its hand.
  const makeSide = (parent) => {
    const built = buildGun(colors);
    const { leftArm } = buildPistolArms(built.gun);
    built.gun.remove(leftArm); // one hand per gun: no support hand
    const pivot = new THREE.Group();
    pivot.rotation.set(0, vm.gunYawDegrees * DEG_TO_RAD, vm.gunRollDegrees * DEG_TO_RAD);
    const kick = new THREE.Group();
    pivot.add(kick);
    kick.add(built.gun);
    parent.add(pivot);
    return { ...built, pivot, kick, since: Infinity };
  };
  const mirror = new THREE.Group();
  mirror.name = 'bogoLeftHand';
  mirror.scale.x = -1;
  const sides = [makeSide(root), makeSide(mirror)]; // [right, left]
  root.add(mirror); // (after the right gun: a search by name finds the right gun's parts first)
  let current = 1; // the gun that fired last (the first shot comes from the right)

  const magazineRest = sides[0].magazine.position.y;
  let lastTime = null;

  return {
    root,
    get muzzle() { return sides[current].muzzle; },
    mounts: sides[0].mounts,
    skinTargets: sides.map(s => ({ root: s.gun, mounts: s.mounts })),

    /** The next gun fires: it becomes the muzzle and takes the flash (Object3D.add moves it off the other gun). */
    onFire(flashObject) {
      current = 1 - current;
      sides[current].since = 0;
      if (flashObject) sides[current].muzzle.add(flashObject);
    },

    /** Attachments, tier trim and stickers on both guns; show() fits the same on each. */
    createUpgradeVisuals() {
      const each = sides.map(s => createUpgradeVisuals({ root: s.gun, muzzle: s.muzzle, mounts: s.mounts }, s.gun));
      return {
        parts: each[0].parts,
        perGun: each, // [right, left]
        show(state) { for (const u of each) u.show(state); },
      };
    },

    animate({ reloadProgress, reloadWeight, time = 0, aimAmount = 0 }) {
      const dt = lastTime === null ? 0 : Math.max(0, time - lastTime);
      lastTime = time;
      const f = vm.fire;
      const r = vm.reload;
      const spacing = vm.gunSpacing + (vm.adsGunSpacing - vm.gunSpacing) * aimAmount;
      const reloading = reloadWeight > 0.5;
      const rollOut = Math.sin(Math.PI * Math.min(1, reloadProgress)) * reloadWeight * r.rollDegrees * DEG_TO_RAD;

      // The magazines: fall away, gone, slide up, home.
      let magOffset = 0;
      let magVisible = true;
      if (reloading) {
        const [d0, d1] = r.magazineDrop;
        const [i0, i1] = r.magazineIn;
        const p = reloadProgress;
        if (p > d0 && p < d1) { const t = (p - d0) / (d1 - d0); magOffset = -t * t * r.dropMeters; }
        else if (p >= d1 && p <= i0) magVisible = false;
        else if (p > i0 && p < i1) magOffset = -(1 - smooth((p - i0) / (i1 - i0))) * r.dropMeters * 0.35;
      }

      sides.forEach((s, i) => {
        s.since += dt;
        // Its own kick: snaps back and up over pressSeconds, settles over kickSeconds.
        const k = s.since < f.pressSeconds ? s.since / f.pressSeconds : Math.max(0, 1 - (s.since - f.pressSeconds) / f.kickSeconds);
        const e = k * k;
        s.pivot.position.set(spacing, 0, 0);
        s.kick.position.set(0, e * f.kickBack * 0.25, e * f.kickBack);
        s.kick.rotation.set(e * f.kickPitchDegrees * DEG_TO_RAD, 0, -rollOut);
        const pull = s.since < f.pressSeconds ? s.since / f.pressSeconds
          : Math.max(0, 1 - (s.since - f.pressSeconds) / f.releaseSeconds);
        s.trigger.rotation.x = pull * f.triggerDegrees * DEG_TO_RAD;
        s.roll.rotation.x = -e * 0.5; // the label roll indexes with each shot
        s.tag.rotation.x = Math.sin(time * 2.3 + i) * 0.12 + e * 0.5; // swings, and jumps when its gun fires
        s.magazine.position.y = magazineRest + magOffset;
        s.magazine.visible = magVisible;
      });
    },

    set leftHandVisible(visible) { mirror.visible = visible; },
  };
}
