import * as THREE from 'three';

// Costume parts share the skeleton's materials/geometry ownership and animated bones.
export function dressEmployee(type, { upper, neck, arms, mat, block, ownedGeometry }) {
  for (const [key, bone] of [['torso', upper], ['head', neck], ['hand', arms[1].elbow]]) {
    for (const p of type.costume?.[key] ?? []) {
      const mesh = block(mat(p.color), ...p.size, ...p.at, bone);
      mesh.rotation.z = p.tilt ?? 0;
    }
  }
  const ring = type.costume?.ring;
  if (ring) {
    const geometry = new THREE.TorusGeometry(ring.radius, ring.tube, ring.radialSegments, ring.segments);
    ownedGeometry.push(geometry);
    block(mat(ring.color),1,1,1,...ring.at,arms[1].elbow,geometry);
  }
}

export function createWhiteboard(scene, cfg) {
  const root = new THREE.Group();
  root.name = 'managerWhiteboard';
  root.userData.dynamic = true;
  root.visible = false;
  for (const p of cfg.pieces) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...p.size), new THREE.MeshStandardMaterial({ color: p.color }));
    mesh.position.set(...p.at);
    mesh.rotation.z = p.tilt ?? 0;
    root.add(mesh);
  }
  scene.add(root);
  return {
    show(position, yaw) {
      root.position.copy(position).add(new THREE.Vector3(...cfg.offset).applyAxisAngle(new THREE.Vector3(0,1,0),yaw));
      root.rotation.y = yaw;
      root.visible = true;
    },
    hide() { root.visible = false; },
    dispose() { root.removeFromParent(); root.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); },
  };
}
