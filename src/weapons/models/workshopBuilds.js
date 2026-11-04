import * as THREE from 'three';
import { weapons } from '../../config/weapons.js';

export function createWorkshopVisual(model, gun) {
  const mount = model.mounts?.workshop;
  if (!mount) return null;
  const id = mount.id;
  const skate = id === 'skateFeed';
  const vm = (skate ? weapons.priceGun : weapons.confettiCannon).viewmodel;
  const palette = skate
    ? new Map([[vm.bodyColor, 0x21b49e], [0xd95f0e, 0x12675f], [vm.metalColor, 0xd4e8e6]])
    : new Map([[vm.bodyColor, 0xffcf51], [vm.accentColor, 0x3747a6], [vm.metalColor, 0xfaf0d8]]);
  const replacementMaterials = new Map(), swaps = [];
  gun.traverse(mesh => {
    const original = mesh.material;
    if (!mesh.isMesh || !original?.color || original.map || !palette.has(original.color.getHex())) return;
    if (!replacementMaterials.has(original)) {
      const upgraded = original.clone();
      upgraded.color.setHex(palette.get(original.color.getHex()));
      replacementMaterials.set(original, upgraded);
      original.addEventListener('dispose', () => upgraded.dispose());
    }
    swaps.push({ mesh, original, upgraded: replacementMaterials.get(original) });
  });

  const chassis = new THREE.Group();
  chassis.name = id + '_chassis';
  gun.add(chassis);
  const mat = (color, metalness = .12) => new THREE.MeshStandardMaterial({ color, metalness, roughness: .38, flatShading: true });
  const teal = mat(0x28c6ae), midnight = mat(0x203047), white = mat(0xf2e9d7), chrome = mat(0xb5c9cb, .68);
  const pink = mat(0xf65e9a), blue = mat(0x3549a8), gold = mat(0xfad46f);
  function piece(geometry, material, x, y, z, parent = chassis) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function block(w, h, d, x, y, z, material, parent) {
    return piece(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  function roller(radius, width, x, y, z, material) {
    const mesh = piece(new THREE.CylinderGeometry(radius, radius, width, 12), material, x, y, z);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  let hingeTrim;
  if (skate) {
    // Low sidecar with two skate wheels, an axle cage, and a visible feed strip.
    for (const side of [-1, 1]) {
      block(.026, .035, .114, side * .035, .007, -.058, midnight);
      block(.012, .011, .12, side * .051, .026, -.059, teal);
      block(.013, .009, .106, side * .05, -.013, -.059, chrome);
      for (const z of [-.026, -.088]) {
        roller(.023, .019, side * .057, .007, z, teal);
        roller(.012, .006, side * .069, .007, z, white);
        roller(.0055, .005, side * .073, .007, z, midnight);
      }
      block(.006, .008, .047, side * .059, .008, -.057, white);
    }
  } else {
    // A party popper chassis: side-mounted charge drum and scalloped sleeves
    // that travel with the existing break-action barrels during reload.
    block(.034, .046, .092, -.055, -.01, .017, blue);
    roller(.032, .029, -.081, -.005, .014, pink);
    roller(.023, .009, -.100, -.005, .014, gold);
    roller(.011, .006, -.107, -.005, .014, midnight);
    for (const z of [-.013, .041]) block(.013, .017, .01, -.083, .016, z, white);
    hingeTrim = new THREE.Group();
    hingeTrim.name = 'partyTrap_hinge_trim';
    mount.parent.add(hingeTrim);
    for (const x of [-.044, .044]) {
      const sleeve = piece(new THREE.CylinderGeometry(.046, .051, .064, 8, 1, true), blue, x, 0, -.125, hingeTrim);
      sleeve.rotation.x = Math.PI / 2;
      for (const z of [-.154, -.095]) {
        const band = piece(new THREE.CylinderGeometry(.052, .052, .012, 8, 1, true), gold, x, 0, z, hingeTrim);
        band.rotation.x = Math.PI / 2;
      }
      for (const dx of [-.013, .013]) block(.012, .012, .033, x + dx, .048, -.123, pink, hingeTrim);
    }
  }
  function show(on) {
    chassis.visible = on;
    if (hingeTrim) hingeTrim.visible = on;
    for (const { mesh, original, upgraded } of swaps) mesh.material = on ? upgraded : original;
  }
  show(false);
  return { id, show };
}
