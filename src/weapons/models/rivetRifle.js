// An industrial automatic riveting tool: long receiver, pressure cylinder,
// detachable box of rivets, braced foregrip and a reciprocating side bolt.
import * as THREE from 'three';
import { samplePose } from '../../core/keyframes.js';
import { resolveGunColors } from '../skinPalette.js';
import { buildPistolArms } from './arms.js';

function buildGun(colors) {
  const gun = new THREE.Group();
  const materials = new Map();
  const mat = (key) => {
    const metal = key === 'metalColor';
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({
      color: colors[key], roughness: metal ? 0.35 : 0.65,
      metalness: metal ? 0.6 : 0.12, flatShading: true,
    }));
    return materials.get(key);
  };
  function box(name, size, at, key, parent = gun) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(key));
    mesh.name = name; mesh.position.set(...at); parent.add(mesh); return mesh;
  }
  function tube(name, radius, length, at, key, parent = gun) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), mat(key));
    mesh.name = name; mesh.rotation.x = Math.PI / 2; mesh.position.set(...at); parent.add(mesh); return mesh;
  }
  box('receiver', [0.074, 0.09, 0.27], [0, 0, -0.08], 'bodyColor');
  box('lowerFrame', [0.078, 0.018, 0.28], [0, -0.052, -0.08], 'darkColor');
  box('foregrip', [0.072, 0.055, 0.11], [0, -0.071, -0.19], 'gripColor');
  for (const z of [-0.17, -0.195, -0.22]) box('gripRib', [0.077, 0.008, 0.012], [0, -0.07, z], 'accentColor');
  tube('barrel', 0.024, 0.18, [0, 0.003, -0.295], 'metalColor');
  tube('muzzleCollar', 0.033, 0.04, [0, 0.003, -0.385], 'darkColor');
  tube('muzzleOpening', 0.019, 0.004, [0, 0.003, -0.408], 'darkColor');
  box('rearSight', [0.035, 0.025, 0.018], [0, 0.058, 0.005], 'darkColor');
  box('frontSightPost', [0.01, 0.068, 0.014], [0, 0.056, -0.3], 'darkColor');
  box('frontSight', [0.015, 0.008, 0.015], [0, 0.094, -0.3], 'sightColor');
  box('stockBridge', [0.035, 0.045, 0.12], [0, 0, 0.105], 'darkColor');
  box('stock', [0.068, 0.09, 0.045], [0, -0.01, 0.177], 'bodyColor');
  box('buttPad', [0.073, 0.095, 0.018], [0, -0.01, 0.207], 'gripColor');
  tube('pressureCylinder', 0.025, 0.16, [0.052, -0.01, -0.07], 'accentColor');
  box('cylinderBracket', [0.04, 0.025, 0.02], [0.04, -0.01, -0.12], 'darkColor');
  const bolt = box('bolt', [0.014, 0.023, 0.065], [-0.04, 0.005, -0.04], 'metalColor');
  for (const z of [-0.105, -0.135, -0.165]) box('vent', [0.002, 0.018, 0.014], [-0.0385, 0.015, z], 'darkColor');
  const grip = box('pistolGrip', [0.042, 0.12, 0.05], [0, -0.095, 0.025], 'gripColor');
  grip.rotation.x = 0.3;
  const trigger = box('trigger', [0.012, 0.027, 0.012], [0, -0.072, -0.015], 'metalColor');
  const magazine = new THREE.Group(); magazine.name = 'rivetMagazine'; magazine.position.set(0, -0.125, -0.075); gun.add(magazine);
  box('magazineBox', [0.042, 0.15, 0.07], [0, 0, 0], 'darkColor', magazine);
  box('magazineNeck', [0.035, 0.03, 0.06], [0, 0.078, 0], 'metalColor', magazine);
  box('magazineBand', [0.046, 0.025, 0.074], [0, -0.045, 0], 'accentColor', magazine);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.003, -0.411); gun.add(muzzle);
  const mounts = {
    barrel: { position: [0, 0.003, -0.407], radius: 0.03, size: { w: 0.068, h: 0.068 } },
    top: { position: [-0.025, 0.046, -0.035] },
    side: { position: [0.078, -0.01, -0.12] },
    grip: { position: [0, -0.095, 0.025], rotation: [0.3, 0, 0], size: { w: 0.042, h: 0.12, d: 0.05 } },
    magazine: { parent: magazine, position: [0, -0.075, 0], gunId: 'rivetRifle' },
    sticker: { position: [-0.0385, -0.012, -0.145] },
  };
  return { gun, muzzle, trigger, bolt, magazine, mounts };
}

export function buildRivetRifleDisplay(def) { return buildGun(resolveGunColors(def)).gun; }

export function buildRivetRifleModel(def, skinId) {
  const vm = def.viewmodel;
  const { gun, muzzle, trigger, bolt, magazine, mounts } = buildGun(resolveGunColors(def, skinId));
  const { leftArm } = buildPistolArms(gun, {
    leftOffset: new THREE.Vector3(-0.008, -0.06, -0.16), thumbOffset: new THREE.Vector3(0, -0.015, 0),
  });
  const heldMagazine = magazine.clone();
  heldMagazine.name = 'heldRivetMagazine'; heldMagazine.position.set(-0.03, -0.145, -0.08);
  heldMagazine.visible = false; leftArm.add(heldMagazine);
  return {
    root: gun, muzzle, mounts,
    animate({ sinceFire, reloadProgress, reloadWeight }) {
      const f = vm.fire;
      const pull = sinceFire < f.pressSeconds ? sinceFire / f.pressSeconds
        : Math.max(0, 1 - (sinceFire - f.pressSeconds) / f.releaseSeconds);
      trigger.rotation.x = pull * f.triggerDegrees * Math.PI / 180;
      bolt.position.z = -0.04 + pull * f.boltTravel;
      const r = vm.reload;
      samplePose(r.handKeys, reloadProgress, leftArm.position, leftArm.rotation);
      leftArm.position.multiplyScalar(reloadWeight);
      leftArm.rotation.set(leftArm.rotation.x * reloadWeight, leftArm.rotation.y * reloadWeight, leftArm.rotation.z * reloadWeight);
      const during = ([a, b]) => reloadWeight > 0.5 && reloadProgress > a && reloadProgress < b;
      magazine.visible = !during(r.magazineGone);
      heldMagazine.visible = during(r.oldMagazineVisible) || during(r.newMagazineVisible);
    },
    set leftHandVisible(visible) { leftArm.visible = visible; },
  };
}
