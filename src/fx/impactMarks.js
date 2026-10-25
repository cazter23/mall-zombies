// Bounded cosmetic world impacts. Collision decides whether a bullet reached world geometry;
// a visual ray then finds the real surface (simplified collision boxes aren't always visible).
import * as THREE from 'three';
import { impacts } from '../config/impacts.js';
import { seededRandom } from '../world/textures.js';
import { buildImpactModel } from './impactModels.js';

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
  let next = 0;
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
    get count() { return slots.reduce((n, slot) => n + (slot ? 1 : 0), 0); },
    // Browser startup: compile only the shared impact materials against the world's lights.
    // Headless games stay lazy; the first real shot needn't build/compile a new graphic mid-fight.
    prepare(renderer, camera) {
      for (const signature of Object.values(impacts.signatures)) {
        for (let v = 0; v < signature.variants; v++) batch(signature.kind, v);
      }
      renderer.compile(group, camera, scene);
      for (const mesh of batches.values()) if (mesh.material.map) renderer.initTexture(mesh.material.map);
    },
    add(gunId, origin, worldHit) {
      const signature = impacts.signatures[gunId];
      if (!signature || !worldHit || worldHit.box.noImpactMarks) return false;
      surfaces.forEach((root) => root.updateWorldMatrix(true, true));
      direction.subVectors(worldHit.point, origin);
      const distance = direction.length();
      if (distance < 1e-6) return false;
      ray.set(origin, direction.divideScalar(distance)); ray.near = 0; ray.far = distance + impacts.projectionSlack;
      // Debug labels are camera-facing Sprites, not physical surfaces (Sprite.raycast requires
      // a render camera). Gather visible meshes only; also excludes hidden spawn markers early.
      const meshes = [];
      surfaces.forEach((root) => root.traverse((o) => { if (o.isMesh && visible(o)) meshes.push(o); }));
      const hit = ray.intersectObjects(meshes, false).find((h) => h.face);
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
        const edge = ray.intersectObject(hit.object, false).find((h) => h.face && h.instanceId === hit.instanceId);
        if (!edge || edge.point.distanceTo(corner) > impacts.offset || faceNormal(edge, direction).dot(normal) < impacts.normalMatch) return false;
      }
      const mesh = batch(signature.kind, Math.floor(random() * signature.variants));
      remove(next);
      matrix.compose(point.addScaledVector(normal, impacts.offset + next * impacts.layerStep), rotation, new THREE.Vector3(1, 1, 1));
      const local = hit.object.matrixWorld.clone().invert().multiply(matrix);
      slots[next] = { mesh, surface: hit.object, local, world: hit.object.matrixWorld.clone() };
      group.visible = true;
      mesh.setMatrixAt(next, matrix); mesh.count = Math.max(mesh.count, next + 1); mesh.instanceMatrix.needsUpdate = true;
      next = (next + 1) % slots.length;
      return true;
    },
    update() {
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]; if (!slot) continue;
        if (!inScene(slot.surface) || !visible(slot.surface)) { remove(i); continue; }
        slot.surface.updateWorldMatrix(true, false);
        if (!slot.world.equals(slot.surface.matrixWorld)) {
          slot.world.copy(slot.surface.matrixWorld);
          matrix.multiplyMatrices(slot.world, slot.local);
          slot.mesh.setMatrixAt(i, matrix); slot.mesh.instanceMatrix.needsUpdate = true;
        }
      }
      if (!this.count) group.visible = false;
    },
    clear() {
      for (let i = 0; i < slots.length; i++) remove(i);
      for (const mesh of batches.values()) mesh.count = 0;
      next = 0;
      group.visible = false;
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
