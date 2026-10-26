import * as THREE from 'three';

// Small procedural props share the map kit's materials and resource lifecycle.
export function createParkingDetailKit(kit, prefix = 'parking_detail') {
  function box(name, x, y, z, w, h, d, material, rotation = null) {
    const mesh = kit.box(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2,
      material, { name: `${prefix}_${name}`, collide: false });
    if (rotation) mesh.rotation.set(...rotation);
    return mesh;
  }
  function rod(name, from, to, radius, material, sides = 6) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), sides), material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.name = `${prefix}_${name}`; kit.group.add(mesh); return mesh;
  }
  function sign(name, text, options) {
    const mesh = kit.sign(text, options); mesh.name = `${prefix}_${name}`; return mesh;
  }
  function plane(name, x, y, z, w, h, material, facing = 'floor') {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    if (facing === 'floor') mesh.rotation.x = -Math.PI / 2;
    if (facing === 'x+') mesh.rotation.y = Math.PI / 2;
    if (facing === 'x-') mesh.rotation.y = -Math.PI / 2;
    mesh.name = `${prefix}_${name}`; kit.group.add(mesh); return mesh;
  }
  function labelMaterial(canvas, options = {}) {
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: .95, ...options });
  }
  return { box, rod, sign, plane, labelMaterial, mat: kit.mat, group: kit.group };
}
