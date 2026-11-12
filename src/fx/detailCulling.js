// =============================================================================
// SMALL DETAIL DISTANCE (performance; Graphics > Small detail, look.runtime.detailDistance): on weak computers, small printed
// things (signs, posters, notices, labels and price tags under look.detailDistance.maxSize metres) are hidden beyond a
// distance. Each has its own texture, so each is its own draw call, and from across a room they are a few pixels anyway:
// in the Promenade's view about 650 of ~1,700 draw calls were these. 'all' (the default, Medium and High) hides nothing.
//
// Collected ONCE, after static batching (main.js), from the map's group: unbatched meshes with a texture map, small, not
// neon, not transparent glow, and not under a userData.dynamic parent (moving or self-hiding parts belong to their own
// systems). It only ever hides what it collected and only re-shows what it hid, so nothing else's visibility is touched.
//
//   const culling = createDetailCulling(root)   culling.update(camera)  (every frame; it re-checks every few frames)
//   culling.count                               how many meshes it manages (the benchmark / debug window can show it)
// =============================================================================

import * as THREE from 'three';
import { look } from '../config/look.js';

const box = new THREE.Box3();
const size = new THREE.Vector3();

function underDynamic(o) {
  for (let p = o; p; p = p.parent) if (p.userData?.dynamic) return true;
  return false;
}

/** Is this mesh a small printed detail the culling may hide? Pure enough to test. */
export function isSmallDetail(mesh, maxSize = look.detailDistance.maxSize) {
  if (!mesh.isMesh || mesh.isInstancedMesh || !mesh.visible) return false;
  const material = Array.isArray(mesh.material) ? null : mesh.material;
  if (!material?.map || material.blending === THREE.AdditiveBlending) return false;
  if (/^neon|static_batch|light_pool/.test(mesh.name)) return false;
  if (underDynamic(mesh)) return false;
  box.setFromObject(mesh);
  if (box.isEmpty()) return false;
  box.getSize(size);
  return Math.max(size.x, size.y, size.z) <= maxSize;
}

export function createDetailCulling(root) {
  root.updateMatrixWorld(true);
  const items = [];
  root.traverse((o) => {
    if (isSmallDetail(o)) items.push({ mesh: o, centre: new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()), hidden: false });
  });
  let frame = 0;
  let lastLimit = Infinity;
  return {
    get count() { return items.length; },
    /** Hides managed meshes beyond the setting's distance from the camera (re-checked every few frames). */
    update(camera) {
      const setting = look.runtime.detailDistance ?? 'all';
      const limit = look.detailDistance.metres[setting] ?? Infinity;
      if (limit === Infinity && lastLimit === Infinity) return; // (nothing hidden, nothing to do)
      if (limit === lastLimit && (frame++ % look.detailDistance.everyFrames) !== 0) return;
      lastLimit = limit;
      const limitSq = limit * limit;
      const at = camera.getWorldPosition(new THREE.Vector3());
      for (const item of items) {
        const far = at.distanceToSquared(item.centre) > limitSq;
        if (far && !item.hidden) {
          if (!item.mesh.visible) continue; // (hidden by something else: not ours to manage now)
          item.mesh.visible = false;
          item.hidden = true;
        } else if (!far && item.hidden) {
          item.mesh.visible = true;
          item.hidden = false;
        }
      }
    },
  };
}
