// =============================================================================
// BAKE PARTS: merge a small model's pieces into as few meshes as possible (fewer draw calls), for models that MOVE as a
// whole (so the static batcher, world/staticBatch.js, leaves them alone): Kiosk Kevin, his products (world/kioskProducts.js).
// Every plain, untextured MeshStandardMaterial mesh under `root` is merged into one mesh per material KIND (everything
// but the colour: roughness, metalness, shading, side, transparency), its colour moved into the vertices. Each piece keeps
// where it sat relative to `root`.
// Left alone (and everything under them): objects flagged userData.keep (a pivot that turns or a part that scales on its
// own), and textured or multi-material meshes. (Pieces are merged unindexed: a few more vertices, any geometry mixes.)
//
//   bakeParts(root) -> root   (call it before placing root; the merged meshes are added to root itself)
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const kindOf = (m) => [m.roughness, m.metalness, m.flatShading, m.side, m.transparent, m.opacity, m.depthWrite].join('|');

export function bakeParts(root) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const kinds = new Map();
  const visit = (object) => {
    for (const child of object.children) {
      if (child.userData.keep) continue;
      if (child.isMesh && !child.isInstancedMesh && !Array.isArray(child.material) && child.material?.isMeshStandardMaterial
        && !child.material.map) {
        const key = kindOf(child.material);
        if (!kinds.has(key)) kinds.set(key, []);
        kinds.get(key).push(child);
      }
      visit(child);
    }
  };
  visit(root);
  const matrix = new THREE.Matrix4();
  for (const meshes of kinds.values()) {
    if (meshes.length < 2) continue;
    const pieces = meshes.map((mesh) => {
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      g.applyMatrix4(matrix.multiplyMatrices(toRoot, mesh.matrixWorld));
      const { r, g: green, b } = mesh.material.color;
      const colors = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) colors.set([r, green, b], i);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return g;
    });
    const merged = mergeGeometries(pieces);
    pieces.forEach((g) => g.dispose());
    if (!merged) continue;
    const first = meshes[0].material;
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: first.roughness, metalness: first.metalness, flatShading: first.flatShading, side: first.side,
      transparent: first.transparent, opacity: first.opacity, depthWrite: first.depthWrite,
    });
    for (const mesh of meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose(); // (each piece made its own geometry; materials may be shared, so they stay)
    }
    const baked = new THREE.Mesh(merged, material);
    baked.name = `${root.name || 'parts'}_baked`;
    root.add(baked);
  }
  return root;
}
