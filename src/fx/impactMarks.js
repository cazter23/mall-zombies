// Bounded cosmetic world impacts. Collision decides whether a bullet reached world geometry;
// a visual ray then finds the real surface (simplified collision boxes aren't always visible).
//
// THE SURFACE CACHE. A shot must not walk the map: the mall is ~2,200 meshes after batching. The meshes a mark can land
// on are listed once, in two sets:
//   still   everything not under a userData.dynamic parent, each with its world box. The map's rule is that these never
//           move; a shot only ray-tests the ones whose box its ray crosses. Whether one is hidden (Graphics > Small
//           detail hides far posters) is still asked at the shot, of those few.
//   moving  everything under a userData.dynamic parent (the claw cabinet, Kevin's cart, hazard rigs...): no box is kept;
//           their matrices are refreshed and they are ray-tested at every shot, as before.
// The lists are rebuilt on the next shot after refresh(): createGame calls it when a barrier starts or finishes opening,
// main.js after static batching, and clear() (a new run) does it too. Code that adds, removes or re-parents map meshes
// some other way must call refresh().
// A big still mesh (a static batch) is also not ray-tested triangle by triangle: it gets a triangle grid the first time
// a ray needs it (fx/triangleGrid.js, impacts.grid), or at start-up in the browser (prepare()).
import * as THREE from 'three';
import { impacts } from '../config/impacts.js';
import { seededRandom } from '../world/textures.js';
import { buildImpactModel } from './impactModels.js';
import { canGrid, buildTriangleGrid, gridRaycast } from './triangleGrid.js';

const Z = new THREE.Vector3(0, 0, 1);

export function createImpactMarks(scene, surfaces = []) {
  const group = new THREE.Group(); group.name = 'impact_marks'; group.visible = false; scene.add(group);
  const batches = new Map(), slots = new Array(impacts.maxMarks).fill(null);
  const random = seededRandom(1979); // cosmetics never consume gameplay's random stream
  const ray = new THREE.Raycaster(), point = new THREE.Vector3(), direction = new THREE.Vector3();
  ray.layers.enableAll(); // (room culling puts map meshes on per-room layers: fx/roomCulling.js)
  const normal = new THREE.Vector3(), probe = new THREE.Vector3(), corner = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3(), rotation = new THREE.Quaternion(), twist = new THREE.Quaternion();
  const surfaceMatrix = new THREE.Matrix4(), instanceMatrix = new THREE.Matrix4();
  const matrix = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let next = 0, used = 0, moving = 0; // (used: marks alive; moving: how many of them sit on a surface that can move or hide)
  let cache = null; // { still: [{ mesh, box }], moving: [mesh], roots: [the flagged parents] }; null = rebuild at the next shot
  const candidates = [], boxHit = new THREE.Vector3();
  const dynamicRoot = (object) => {
    let root = null;
    for (let o = object; o; o = o.parent) if (o.userData.dynamic) root = o;
    return root; // (the outermost flagged parent, or null: a still surface)
  };
  function buildCache() {
    const still = [], live = [], roots = new Set();
    surfaces.forEach((root) => root.updateWorldMatrix(true, true));
    // Debug labels are camera-facing Sprites, not physical surfaces (Sprite.raycast requires a render camera): meshes only.
    surfaces.forEach((root) => root.traverse((o) => {
      if (!o.isMesh) return;
      const flagged = dynamicRoot(o);
      if (flagged) { roots.add(flagged); live.push(o); return; }
      if (o.geometry.boundingBox === null) o.geometry.computeBoundingBox(); // (Mesh.raycast only skips a missed mesh's triangles when it has one)
      still.push({ mesh: o, box: new THREE.Box3().setFromObject(o) });
    }));
    cache = { still, moving: live, roots: [...roots] };
  }
  /** The meshes this ray could touch within `far` metres: still ones by their cached box, every moving one. Visible ones only. */
  function gather(far) {
    if (!cache) buildCache();
    candidates.length = 0;
    for (const { mesh, box } of cache.still) {
      if (!box.containsPoint(ray.ray.origin)) {
        if (!ray.ray.intersectBox(box, boxHit) || boxHit.distanceToSquared(ray.ray.origin) > far * far) continue;
      }
      if (visible(mesh)) candidates.push(mesh);
    }
    for (const root of cache.roots) root.updateWorldMatrix(true, true);
    for (const mesh of cache.moving) if (visible(mesh)) candidates.push(mesh);
    return candidates;
  }
  // The nearest face the ray meets on one mesh (what Raycaster.intersectObject(mesh)[0] gives): a big still mesh through
  // its triangle grid (built on first use, kept for as long as the mesh lives), any other by three's own test.
  const grids = new WeakMap(), found = [];
  function gridOf(mesh) {
    if (!grids.has(mesh)) {
      grids.set(mesh, !dynamicRoot(mesh) && canGrid(mesh, impacts.grid.minTriangles) ? buildTriangleGrid(mesh.geometry, impacts.grid) : null);
    }
    return grids.get(mesh);
  }
  function nearestOn(mesh) {
    const grid = gridOf(mesh);
    if (grid) return gridRaycast(grid, mesh, ray);
    found.length = 0;
    return ray.intersectObject(mesh, false, found).find((h) => h.face) ?? null;
  }
  const inScene = (object) => {
    for (let o = object; o; o = o.parent) if (o === scene) return true;
    return false;
  };
  function visible(object) {
    for (let o = object; o; o = o.parent) if (!o.visible || o.userData.kind === 'shutter' || o.name === 'markers') return false;
    return true;
  }
  function batch(kind, variant) {
    const key = `${kind}:${variant}`;
    if (!batches.has(key)) {
      const { geometry, material } = buildImpactModel(kind, variant);
      const mesh = new THREE.InstancedMesh(geometry, material, impacts.maxMarks);
      mesh.name = `impact_${key}`; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; mesh.count = 0;
      for (let i = 0; i < impacts.maxMarks; i++) mesh.setMatrixAt(i, zero);
      group.add(mesh); batches.set(key, mesh);
    }
    return batches.get(key);
  }
  function remove(i) {
    if (!slots[i]) return;
    slots[i].mesh.setMatrixAt(i, zero); slots[i].mesh.instanceMatrix.needsUpdate = true;
    used--; if (slots[i].live) moving--;
    slots[i] = null;
  }
  function faceNormal(hit, out) {
    surfaceMatrix.copy(hit.object.matrixWorld);
    if (hit.instanceId !== undefined) {
      hit.object.getMatrixAt(hit.instanceId, instanceMatrix); surfaceMatrix.multiply(instanceMatrix);
    }
    return out.copy(hit.face.normal).applyMatrix3(normalMatrix.getNormalMatrix(surfaceMatrix)).normalize();
  }
  return {
    get count() { return used; },
    /** How many meshes a shot can mark, by set (for tests and debugging): { still, moving }. */
    get surfaceCounts() { if (!cache) buildCache(); return { still: cache.still.length, moving: cache.moving.length }; },
    /**
     * The map's meshes changed (a barrier opened, static batching merged them, a map unloaded): list them again at the next
     * shot, and drop every mark whose surface is gone or hidden now (marks on still surfaces are not re-checked per frame).
     */
    refresh() {
      cache = null;
      for (let i = 0; i < slots.length; i++) if (slots[i] && (!inScene(slots[i].surface) || !visible(slots[i].surface))) remove(i);
      if (!used) group.visible = false;
    },
    // Browser startup: compile only the shared impact materials against the world's lights.
    // Headless games stay lazy; the first real shot needn't build/compile a new graphic mid-fight.
    prepare(renderer, camera) {
      for (const signature of Object.values(impacts.signatures)) {
        for (let v = 0; v < signature.variants; v++) batch(signature.kind, v);
      }
      renderer.compile(group, camera, scene);
      for (const mesh of batches.values()) if (mesh.material.map) renderer.initTexture(mesh.material.map);
      // The big meshes' triangle grids too (the map is batched by now): the first shot at a wall must not stop to sort it.
      buildCache();
      for (const { mesh } of cache.still) gridOf(mesh);
    },
    add(gunId, origin, worldHit) {
      const signature = impacts.signatures[gunId];
      if (!signature || !worldHit || worldHit.box.noImpactMarks) return false;
      direction.subVectors(worldHit.point, origin);
      const distance = direction.length();
      if (distance < 1e-6) return false;
      ray.set(origin, direction.divideScalar(distance)); ray.near = 0; ray.far = distance + impacts.projectionSlack;
      // The whole ray is tested, not just its end: a decoration it meets first (no collision box, so the bullet "passed"
      // it) still takes the mark or, when it is further than the slack from the collision point, rejects it.
      let hit = null;
      for (const mesh of gather(ray.far)) {
        const nearest = nearestOn(mesh);
        if (nearest && (!hit || nearest.distance < hit.distance)) hit = nearest;
      }
      if (!hit || hit.point.distanceTo(worldHit.point) > impacts.projectionSlack) return false;
      point.copy(hit.point); faceNormal(hit, normal);
      rotation.setFromUnitVectors(Z, normal);
      twist.setFromAxisAngle(Z, (random() * 2 - 1) * (signature.rotationDegrees ?? 180) * Math.PI / 180);
      rotation.multiply(twist);
      // Four corners must land on the same flat face. Skip tiny edges/curved objects rather
      // than leave a sticker or cluster hanging in midair or wrapping through another face.
      for (const x of [-signature.radius, signature.radius]) for (const y of [-signature.radius, signature.radius]) {
        corner.set(x, y, 0).applyQuaternion(rotation).add(point);
        probe.copy(corner).addScaledVector(normal, impacts.edgeProbe);
        ray.set(probe, direction.copy(normal).negate()); ray.near = 0; ray.far = impacts.edgeProbe * 2;
        const edge = hit.instanceId === undefined ? nearestOn(hit.object)
          : ray.intersectObject(hit.object, false).find((h) => h.face && h.instanceId === hit.instanceId);
        if (!edge || edge.point.distanceTo(corner) > impacts.offset || faceNormal(edge, direction).dot(normal) < impacts.normalMatch) return false;
      }
      const mesh = batch(signature.kind, Math.floor(random() * signature.variants));
      remove(next);
      matrix.compose(point.addScaledVector(normal, impacts.offset + next * impacts.layerStep), rotation, new THREE.Vector3(1, 1, 1));
      const local = hit.object.matrixWorld.clone().invert().multiply(matrix);
      const live = !!dynamicRoot(hit.object);
      slots[next] = { mesh, surface: hit.object, local, world: hit.object.matrixWorld.clone(), live };
      used++; if (live) moving++;
      group.visible = true;
      mesh.setMatrixAt(next, matrix); mesh.count = Math.max(mesh.count, next + 1); mesh.instanceMatrix.needsUpdate = true;
      next = (next + 1) % slots.length;
      return true;
    },
    // Every frame: marks on a surface that can move or hide follow it (or go with it). Marks on still surfaces need nothing.
    update() {
      for (let i = 0; moving > 0 && i < slots.length; i++) {
        const slot = slots[i]; if (!slot?.live) continue;
        if (!inScene(slot.surface) || !visible(slot.surface)) { remove(i); continue; }
        slot.surface.updateWorldMatrix(true, false);
        if (!slot.world.equals(slot.surface.matrixWorld)) {
          slot.world.copy(slot.surface.matrixWorld);
          matrix.multiplyMatrices(slot.world, slot.local);
          slot.mesh.setMatrixAt(i, matrix); slot.mesh.instanceMatrix.needsUpdate = true;
        }
      }
      if (!used) group.visible = false;
    },
    clear() {
      for (let i = 0; i < slots.length; i++) remove(i);
      for (const mesh of batches.values()) mesh.count = 0;
      next = 0;
      group.visible = false;
      cache = null; // (a new run: the map was put back, list its surfaces again at the first shot)
    },
    dispose() {
      this.clear();
      for (const mesh of batches.values()) {
        mesh.dispose(); mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose();
      }
      batches.clear(); group.removeFromParent();
    },
  };
}
