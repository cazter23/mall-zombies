// =============================================================================
// STATIC BATCHING: merge the map's still, opaque meshes into a few big ones (fewer draw calls).
// The map kit builds every wall, trim and counter as its own mesh, so the mall is hundreds of separate draws. After the
// map is built (and before the first frame), batchStatic() merges meshes that SHARE A MATERIAL and sit in the same
// chunk of space (`cellSize` metres square, ground floor and upper floor apart), so the camera still skips chunks that
// are off screen. Material animation (an emissive flicker, a colour fade) keeps working: the merged mesh uses the
// same material object.
//
// Plain untextured MeshStandardMaterials that differ only in COLOUR also merge: they share one material with the colour
// stored per vertex (vertexColors), as long as everything else (roughness, metalness, emissive, shading, side) matches and
// the material isn't flagged userData.animated (changed at runtime, e.g. a flickering tube's glow).
//
// Left alone: anything flagged userData.dynamic (moved / shown / hidden at runtime, e.g. the escalator's barrier parts),
// shutters (userData.kind 'shutter'), hidden meshes (debug markers), transparent materials (glass: they need their
// own sort), instanced / skinned meshes, and materials used by only one mesh (nothing to merge).
//
//   batchStatic(root, { cellSize, upperY }) -> { merged: n meshes removed, batches: n meshes added }
// Browser-side only (main.js); headless tests and the map's own tests see the meshes exactly as built.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const center = new THREE.Vector3();
const bounds = new THREE.Box3();

function visibleInWorld(object, root) {
  for (let o = object; o && o !== root.parent; o = o.parent) if (!o.visible) return false;
  return true;
}

function eligible(mesh, root) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh) return false;
  if (Array.isArray(mesh.material) || !mesh.material || mesh.material.transparent) return false;
  for (let o = mesh; o && o !== root.parent; o = o.parent) {
    if (o.userData.dynamic || o.userData.kind === 'shutter') return false;
  }
  if (!visibleInWorld(mesh, root)) return false;
  const g = mesh.geometry;
  return !!(g?.isBufferGeometry && g.attributes.position && g.attributes.normal && !g.morphAttributes?.position);
}

// A world-space, non-indexed copy with exactly position / normal / uv (so any mix of shapes merges).
function bakedCopy(mesh, colour = null) {
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  g.applyMatrix4(mesh.matrixWorld);
  if (colour) { // (the material's colour, per vertex, for a shared vertex-coloured material)
    const rgb = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < rgb.length; i += 3) { rgb[i] = colour.r; rgb[i + 1] = colour.g; rgb[i + 2] = colour.b; }
    g.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
  }
  return g;
}

const MAP_SLOTS = ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'normalMap', 'alphaMap', 'aoMap', 'lightMap', 'envMap', 'displacementMap'];

// A plain colour-only standard material: the key of everything but its colour (or null: merge by the material itself).
function colourKey(m) {
  if (!m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.userData.animated || m.vertexColors) return null;
  if (MAP_SLOTS.some((slot) => m[slot])) return null;
  return ['std', m.roughness, m.metalness, m.emissive.getHexString(), m.emissiveIntensity, m.flatShading, m.side, m.opacity].join('|');
}

export function batchStatic(root, { cellSize = 12, upperY = 6 } = {}) {
  root.updateWorldMatrix(true, true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const groups = new Map(); // key -> { material, meshes: [] }
  root.traverse((o) => {
    if (!eligible(o, root)) return;
    bounds.setFromObject(o).getCenter(center);
    const look = colourKey(o.material);
    // (layers: room culling's rooms, fx/roomCulling.js: meshes of different rooms never share a batch)
    const key = `${look ?? o.material.uuid}|${Math.floor(center.x / cellSize)}|${Math.floor(center.z / cellSize)}|${center.y > upperY ? 1 : 0}|${o.layers.mask}`;
    if (!groups.has(key)) groups.set(key, { material: o.material, look, meshes: [] });
    groups.get(key).meshes.push(o);
  });

  // Materials used by one mesh only (across all chunks) have nothing to merge with.
  const uses = new Map();
  for (const { material, look, meshes } of groups.values()) uses.set(look ?? material, (uses.get(look ?? material) ?? 0) + meshes.length);
  const shared = new Map(); // look -> the one vertex-coloured material standing in for every colour of it

  let merged = 0;
  let batches = 0;
  for (const { material, look, meshes } of groups.values()) {
    if (meshes.length < 2 || uses.get(look ?? material) < 2) continue;
    let batchMaterial = material;
    if (look) {
      if (!shared.has(look)) {
        const m = material.clone();
        m.color.set(0xffffff);
        m.vertexColors = true;
        m.name = 'static_vertexColour';
        shared.set(look, m);
      }
      batchMaterial = shared.get(look);
    }
    const geometry = mergeGeometries(meshes.map((m) => bakedCopy(m, look ? m.material.color : null)), false);
    if (!geometry) continue;
    geometry.applyMatrix4(inverseRoot); // (back into the root's own space)
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const batch = new THREE.Mesh(geometry, batchMaterial);
    batch.name = `static_${meshes[0].name || 'batch'}`;
    batch.userData.staticBatch = meshes.length;
    batch.layers.mask = meshes[0].layers.mask;
    root.add(batch);
    batches++;
    for (const mesh of meshes) {
      mesh.removeFromParent();
      merged++;
    }
  }
  return { merged, batches };
}
