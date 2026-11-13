// =============================================================================
// SHOPPER BAKE: how a crowd of Shoppers stays cheap to draw. A Shopper is dressed with PAINTS (plain colour markers, not
// materials: shopperModel.js); here every bone's painted boxes are merged into ONE mesh whose colours are baked into
// the vertices, drawn with the zombie's ONE vertex-coloured material. So a Shopper costs one draw call per moving bone
// (legs, body, arms, forearms, head: 8) whatever it wears, and one material (its own: hit flashes, the edge glow and the
// straggler highlight are per zombie and live on the material).
//
// The merged geometry is SHARED: two bones dressed the same (same pieces, same places, same colours) get the same
// geometry from a cache, counted by reference and disposed when the last Shopper using it goes. Forearms, legs and
// heads repeat a lot across a crowd.
//
//   paint(hex)                          the marker a part is built with (one per colour, shared)
//   createShopperMaterial()             a Shopper's own material (vertex colours, flat shaded)
//   bakeShopper(root) -> release()      replaces every painted mesh under root (bone by bone) with shared baked meshes
//                                       drawn with the material bakeShopper was given; release() once, on dispose
//   bakedGeometryStats()                { entries, refs }: how many shared geometries are alive (tests: no leaks)
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const paints = new Map(); // hex -> marker
/** A colour marker for a part's mesh. Never drawn: bakeShopper replaces every painted mesh before the first frame. */
export function paint(hex) {
  if (!paints.has(hex)) paints.set(hex, Object.freeze({ isPaint: true, hex }));
  return paints.get(hex);
}

export function createShopperMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
}

const cache = new Map(); // signature -> { geometry, refs }
const geometryIds = new WeakMap();
let nextGeometryId = 1;
const idOf = (geometry) => {
  if (!geometryIds.has(geometry)) geometryIds.set(geometry, nextGeometryId++);
  return geometryIds.get(geometry);
};
const color = new THREE.Color();

// What makes two bones look the same: each piece's shape, placement and colour, in order.
function signatureOf(meshes) {
  return meshes.map((mesh) => {
    mesh.updateMatrix();
    const m = mesh.matrix.elements;
    let s = `${idOf(mesh.geometry)}:${mesh.material.hex}`;
    for (let i = 0; i < 16; i++) s += `,${Math.round(m[i] * 1e5)}`;
    return s;
  }).join(';');
}

// One geometry for the bone: positions and normals moved into place, colours baked (linear, like material colours).
function buildGeometry(meshes) {
  const pieces = meshes.map((mesh) => {
    const source = mesh.geometry;
    const piece = new THREE.BufferGeometry();
    piece.setAttribute('position', source.attributes.position.clone());
    piece.setAttribute('normal', source.attributes.normal.clone());
    if (source.index) piece.setIndex(source.index.clone());
    piece.applyMatrix4(mesh.matrix);
    color.setHex(mesh.material.hex);
    const count = piece.attributes.position.count;
    const rgb = new Uint8Array(count * 3);
    const r = Math.round(color.r * 255), g = Math.round(color.g * 255), b = Math.round(color.b * 255);
    for (let i = 0; i < count; i++) { rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b; }
    piece.setAttribute('color', new THREE.BufferAttribute(rgb, 3, true));
    return piece;
  });
  const geometry = mergeGeometries(pieces, false);
  pieces.forEach((piece) => piece.dispose());
  // Normals in bytes (3 instead of 12 per vertex): flat shading works from the faces, only the edge shading reads them.
  const normals = geometry.attributes.normal.array;
  const packed = new Int8Array(normals.length);
  for (let i = 0; i < normals.length; i++) packed[i] = Math.round(Math.max(-1, Math.min(1, normals[i])) * 127);
  geometry.setAttribute('normal', new THREE.BufferAttribute(packed, 3, true));
  geometry.computeBoundingSphere();
  geometry.userData.shopperShared = true;
  return geometry;
}

/**
 * Bakes every bone under `root` that holds painted meshes into one shared mesh drawn with `material`.
 * `skip`: a subtree to leave alone (the Cart Pusher's cart has real materials of its own).
 */
export function bakeShopper(root, material, skip = null) {
  const bones = [];
  root.traverse((node) => {
    if (node === skip || isUnder(node, skip)) return;
    if (node.children.some((child) => child.isMesh && child.material?.isPaint)) bones.push(node);
  });
  const used = [];
  for (const bone of bones) {
    const meshes = bone.children.filter((child) => child.isMesh && child.material?.isPaint);
    const key = signatureOf(meshes);
    let entry = cache.get(key);
    if (!entry) {
      entry = { geometry: buildGeometry(meshes), refs: 0 };
      cache.set(key, entry);
    }
    entry.refs++;
    used.push(key);
    meshes.forEach((mesh) => mesh.removeFromParent());
    const baked = new THREE.Mesh(entry.geometry, material);
    baked.name = `${bone.name || 'part'}Baked`;
    bone.add(baked);
  }
  let released = false;
  return function release() {
    if (released) return;
    released = true;
    for (const key of used) {
      const entry = cache.get(key);
      if (--entry.refs > 0) continue;
      entry.geometry.dispose();
      cache.delete(key);
    }
  };
}

function isUnder(node, ancestor) {
  if (!ancestor) return false;
  for (let n = node.parent; n; n = n.parent) if (n === ancestor) return true;
  return false;
}

export function bakedGeometryStats() {
  let refs = 0;
  for (const entry of cache.values()) refs += entry.refs;
  return { entries: cache.size, refs };
}
