// =============================================================================
// TRIANGLE GRID: the nearest ray hit on a big mesh without testing every triangle.
// three's Mesh.raycast tests ALL of a mesh's triangles once the ray crosses its box. After static batching the mall's
// walls and stock are a few hundred merged meshes of up to 60,000 triangles, so one bullet mark (a ray along the shot and
// four short probes at its corners: fx/impactMarks.js) tested about 70,000 triangles, inside the fixed tick.
//
// A grid sorts a geometry's triangles ONCE into the cells of a box grid (in the mesh's own space, so the mesh may sit
// anywhere; the geometry itself must not change afterwards). A ray then walks only the cells it passes through, nearest
// first, and stops at the first cell that holds a hit. The triangle test is three's own (Ray.intersectTriangle, the same
// side rule as Mesh.raycast), so the answer is the hit Raycaster.intersectObject(mesh)[0] would give.
//
//   canGrid(mesh, minTriangles)              is this a plain mesh worth a grid? (not instanced/skinned/morphed/multi-material)
//   buildTriangleGrid(geometry, options)     -> grid   (options: impacts.grid: cellSize metres, maxCells per axis)
//   gridRaycast(grid, mesh, raycaster)       -> { distance, point, object, face: { normal } } | null   (the nearest hit)
// =============================================================================

import * as THREE from 'three';

const EPS = 1e-4; // (metres: triangles are filed a hair wide, so one lying exactly on a cell boundary is in both cells)
const inverse = new THREE.Matrix4(), localRay = new THREE.Ray(), end = new THREE.Vector3();
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), at = new THREE.Vector3(), world = new THREE.Vector3(), bestAt = new THREE.Vector3();
const AXES = ['x', 'y', 'z'];

export function triangleCount(geometry) {
  return (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
}

/** A plain, single-material mesh with enough triangles for a grid to pay off (anything else: three's own raycast). */
export function canGrid(mesh, minTriangles) {
  const g = mesh.geometry;
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.raycast !== THREE.Mesh.prototype.raycast) return false;
  if (!mesh.material || Array.isArray(mesh.material) || !g?.isBufferGeometry || !g.attributes.position) return false;
  if (g.morphAttributes?.position || g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return false;
  return triangleCount(g) >= minTriangles;
}

export function buildTriangleGrid(geometry, { cellSize = 1, maxCells = 48 } = {}) {
  const position = geometry.attributes.position, index = geometry.index;
  const count = triangleCount(geometry);
  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  const min = geometry.boundingBox.min.clone().addScalar(-2 * EPS), max = geometry.boundingBox.max.clone().addScalar(2 * EPS);
  const n = [0, 0, 0], perMetre = [0, 0, 0], lo = [min.x, min.y, min.z];
  AXES.forEach((axis, i) => {
    n[i] = Math.max(1, Math.min(maxCells, 255, Math.ceil((max[axis] - min[axis]) / cellSize)));
    perMetre[i] = n[i] / (max[axis] - min[axis]);
  });
  const cellOf = (value, i) => Math.max(0, Math.min(n[i] - 1, Math.floor((value - lo[i]) * perMetre[i])));
  // Pass 1: each triangle's cell range (its box, a hair wide) and how many triangles each cell holds.
  const ranges = new Uint8Array(count * 6);
  const offsets = new Uint32Array(n[0] * n[1] * n[2] + 1);
  const vertex = (t, k, out) => out.fromBufferAttribute(position, index ? index.getX(t * 3 + k) : t * 3 + k);
  for (let t = 0; t < count; t++) {
    vertex(t, 0, a); vertex(t, 1, b); vertex(t, 2, c);
    for (let i = 0; i < 3; i++) {
      const axis = AXES[i];
      ranges[t * 6 + i] = cellOf(Math.min(a[axis], b[axis], c[axis]) - EPS, i);
      ranges[t * 6 + 3 + i] = cellOf(Math.max(a[axis], b[axis], c[axis]) + EPS, i);
    }
    for (let z = ranges[t * 6 + 2]; z <= ranges[t * 6 + 5]; z++) for (let y = ranges[t * 6 + 1]; y <= ranges[t * 6 + 4]; y++) {
      for (let x = ranges[t * 6]; x <= ranges[t * 6 + 3]; x++) offsets[x + n[0] * (y + n[1] * z) + 1]++;
    }
  }
  for (let i = 1; i < offsets.length; i++) offsets[i] += offsets[i - 1];
  // Pass 2: the triangles of each cell, one after another (offsets[cell] .. offsets[cell + 1]).
  const items = new Uint32Array(offsets[offsets.length - 1]);
  const cursor = offsets.slice(0, -1);
  for (let t = 0; t < count; t++) {
    for (let z = ranges[t * 6 + 2]; z <= ranges[t * 6 + 5]; z++) for (let y = ranges[t * 6 + 1]; y <= ranges[t * 6 + 4]; y++) {
      for (let x = ranges[t * 6]; x <= ranges[t * 6 + 3]; x++) items[cursor[x + n[0] * (y + n[1] * z)]++] = t;
    }
  }
  return { geometry, lo, hi: [max.x, max.y, max.z], n, perMetre, offsets, items, count };
}

/** The nearest hit of the raycaster's ray (its near..far) on this mesh, as Raycaster.intersectObject(mesh)[0], or null. */
export function gridRaycast(grid, mesh, raycaster) {
  const { geometry, lo, hi, n, perMetre, offsets, items } = grid;
  const position = geometry.attributes.position, index = geometry.index;
  const side = mesh.material.side;
  inverse.copy(mesh.matrixWorld).invert();
  localRay.copy(raycaster.ray).applyMatrix4(inverse);
  // The ray's reach, in the mesh's own space (a scaled mesh stretches it).
  end.copy(raycaster.ray.direction).multiplyScalar(raycaster.far).add(raycaster.ray.origin).applyMatrix4(inverse);
  const o = [localRay.origin.x, localRay.origin.y, localRay.origin.z], d = [localRay.direction.x, localRay.direction.y, localRay.direction.z];
  let t0 = 0, t1 = localRay.origin.distanceTo(end) * (1 + 1e-6) + 1e-6;
  for (let i = 0; i < 3; i++) { // (clip the ray to the grid's box)
    if (Math.abs(d[i]) < 1e-12) { if (o[i] < lo[i] || o[i] > hi[i]) return null; continue; }
    let near = (lo[i] - o[i]) / d[i], far = (hi[i] - o[i]) / d[i];
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near); t1 = Math.min(t1, far);
    if (t0 > t1) return null;
  }
  // Walk the cells along the ray (one step at a time across whichever cell wall comes first).
  const cell = [0, 0, 0], step = [0, 0, 0], next = [Infinity, Infinity, Infinity], delta = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    cell[i] = Math.max(0, Math.min(n[i] - 1, Math.floor((o[i] + d[i] * t0 - lo[i]) * perMetre[i])));
    if (Math.abs(d[i]) < 1e-12) continue;
    step[i] = d[i] > 0 ? 1 : -1;
    delta[i] = 1 / (perMetre[i] * Math.abs(d[i]));
    next[i] = (lo[i] + (cell[i] + (d[i] > 0 ? 1 : 0)) / perMetre[i] - o[i]) / d[i];
  }
  let best = Infinity, bestTriangle = -1, bestDistance = 0;
  for (;;) {
    const id = cell[0] + n[0] * (cell[1] + n[1] * cell[2]);
    for (let k = offsets[id]; k < offsets[id + 1]; k++) {
      const t = items[k];
      if (t === bestTriangle) continue;
      a.fromBufferAttribute(position, index ? index.getX(t * 3) : t * 3);
      b.fromBufferAttribute(position, index ? index.getX(t * 3 + 1) : t * 3 + 1);
      c.fromBufferAttribute(position, index ? index.getX(t * 3 + 2) : t * 3 + 2);
      // (the same call, in the same order, as three's Mesh.raycast: a back face is only hit on a BackSide / DoubleSide material)
      const hit = side === THREE.BackSide ? localRay.intersectTriangle(c, b, a, true, at) : localRay.intersectTriangle(a, b, c, side === THREE.FrontSide, at);
      if (!hit) continue;
      const along = at.distanceTo(localRay.origin);
      if (along >= best) continue;
      const distance = world.copy(at).applyMatrix4(mesh.matrixWorld).distanceTo(raycaster.ray.origin);
      if (distance < raycaster.near || distance > raycaster.far) continue;
      best = along; bestTriangle = t; bestDistance = distance; bestAt.copy(at);
    }
    const axis = next[0] <= next[1] ? (next[0] <= next[2] ? 0 : 2) : (next[1] <= next[2] ? 1 : 2);
    if (best <= next[axis] + EPS || next[axis] > t1) break; // (a hit inside this cell is the nearest; or the ray has left the grid)
    cell[axis] += step[axis];
    if (cell[axis] < 0 || cell[axis] >= n[axis]) break;
    next[axis] += delta[axis];
  }
  if (bestTriangle < 0) return null;
  a.fromBufferAttribute(position, index ? index.getX(bestTriangle * 3) : bestTriangle * 3);
  b.fromBufferAttribute(position, index ? index.getX(bestTriangle * 3 + 1) : bestTriangle * 3 + 1);
  c.fromBufferAttribute(position, index ? index.getX(bestTriangle * 3 + 2) : bestTriangle * 3 + 2);
  const point = bestAt.clone().applyMatrix4(mesh.matrixWorld);
  return { distance: bestDistance, point, object: mesh, face: { normal: THREE.Triangle.getNormal(a, b, c, new THREE.Vector3()) } };
}
