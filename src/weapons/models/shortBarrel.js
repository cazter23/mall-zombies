import * as THREE from 'three';

// Reversible front-geometry variants, in mount-parent coordinates. The existing hinge and
// contact-trip animation transforms stay intact; no per-frame vertex work or allocation.
export function prepareShortBarrel(model, span, factor) {
  const mount = model.mounts.barrel, parent = mount.parent ?? model.root;
  parent.updateWorldMatrix(true, true);
  const cut = mount.position[2] + span, variants = [];
  const into = new THREE.Matrix4(), back = new THREE.Matrix4(), point = new THREE.Vector3();
  parent.traverse(mesh => {
    if (!mesh.isMesh) return;
    into.copy(parent.matrixWorld).invert().multiply(mesh.matrixWorld); back.copy(into).invert();
    const original = mesh.geometry, shortened = original.clone(), positions = shortened.attributes.position;
    let changed = false;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(into);
      if (point.z >= cut) continue;
      point.z = cut + (point.z - cut) * factor; point.applyMatrix4(back);
      positions.setXYZ(i, point.x, point.y, point.z); changed = true;
    }
    if (changed) { shortened.computeVertexNormals(); shortened.computeBoundingBox(); shortened.computeBoundingSphere(); variants.push({ mesh, original, shortened }); }
    else shortened.dispose();
  });
  for (const { original, shortened } of variants) {
    let disposing = false;
    original.addEventListener('dispose', () => { if (!disposing) { disposing = true; shortened.dispose(); } });
    shortened.addEventListener('dispose', () => { if (!disposing) { disposing = true; original.dispose(); } });
  }
  return { shift: span * (1 - factor), show(on) { for (const v of variants) v.mesh.geometry = on ? v.shortened : v.original; } };
}
