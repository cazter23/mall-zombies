// =============================================================================
// ROOM CULLING (performance): skip drawing rooms the camera can't see. Frustum culling alone draws everything in front of
// the camera, walls or not (from the atrium's ring half the meshes were the Mega Mart behind its wall). The map describes
// its rooms (areas) and the openings between them (portals); every static mesh that lies wholly inside one room is put on
// that room's camera LAYER, and each frame the camera only enables the layers of rooms it can see:
//   start in the camera's room, go through each portal that is open (a closed shutter blocks the view) and on screen,
//   narrowing the visible window to the portal's screen rectangle as it goes (so a room seen through two small openings in a
//   row is only drawn if the openings line up on screen).
// Layers, not .visible, so nothing that shows / hides things itself (settings, shutters, the horror layer) is disturbed.
// Anything that straddles rooms (shared walls, big floors), the camera inside a doorway, and everything not in the map
// (zombies, effects, the gun) are always drawn. ?noculling turns it off (main.js), to compare.
//
//   map.cullAreas    [{ id, minX, maxX, minY, maxY, minZ, maxZ }]
//   map.cullPortals  [{ a, b, door?, minX, maxX, minY, maxY, minZ, maxZ }]   door = a door id: closed = blocked
//   const culling = createRoomCulling({ areas, portals, camera, isOpen: (doorId) => bool })
//   culling.tag(root)    once, BEFORE static batching (world/staticBatch.js keeps rooms apart by layer)
//   culling.update()     before each draw; culling.visible = the room ids drawn last time (null = everything)
// =============================================================================

import * as THREE from 'three';

const FULL = Object.freeze({ x0: -1, x1: 1, y0: -1, y1: 1 });
const corner = new THREE.Vector3();
const local = new THREE.Vector3();
const box = new THREE.Box3();

/** The room containing a point, or null (in a doorway, outside the map...). */
export function areaAt(areas, p) {
  for (const a of areas) {
    if (p.x >= a.minX && p.x <= a.maxX && p.y >= a.minY && p.y <= a.maxY && p.z >= a.minZ && p.z <= a.maxZ) return a;
  }
  return null;
}

/** A portal's rectangle on screen (normalised device coordinates), FULL when the camera is at / behind it, null off screen. */
function portalRect(p, camera) {
  const near = 0.6; // closer than this to the opening: treat it as filling the screen
  if (camera.position.x > p.minX - near && camera.position.x < p.maxX + near && camera.position.y > p.minY - near
    && camera.position.y < p.maxY + near && camera.position.z > p.minZ - near && camera.position.z < p.maxZ + near) return FULL;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  let behind = 0;
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? p.maxX : p.minX, i & 2 ? p.maxY : p.minY, i & 4 ? p.maxZ : p.minZ);
    local.copy(corner).applyMatrix4(camera.matrixWorldInverse);
    if (local.z > -camera.near) { behind++; continue; }
    corner.project(camera);
    x0 = Math.min(x0, corner.x); x1 = Math.max(x1, corner.x);
    y0 = Math.min(y0, corner.y); y1 = Math.max(y1, corner.y);
  }
  if (behind === 8) return null; // wholly behind the camera
  if (behind > 0) return FULL; // straddles the camera plane: be generous
  if (x1 < -1 || x0 > 1 || y1 < -1 || y0 > 1) return null;
  return { x0, x1, y0, y1 };
}

const intersect = (a, b) => {
  const r = { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1) };
  return r.x0 < r.x1 && r.y0 < r.y1 ? r : null;
};

/** The ids of the rooms visible from the camera (a Set), or null = draw everything (the camera isn't in a room). */
export function visibleAreas({ areas, portals, camera, isOpen = () => true, maxDepth = 5 }) {
  const start = areaAt(areas, camera.position);
  if (!start) return null;
  const seen = new Set([start.id]);
  const best = new Map([[start.id, FULL]]); // the widest window each room has been reached through (prunes repeats)
  const walk = (id, window, depth, via) => {
    if (depth >= maxDepth) return;
    for (const p of portals) {
      if (p === via || (p.a !== id && p.b !== id)) continue;
      if (p.door && !isOpen(p.door)) continue;
      const rect = portalRect(p, camera);
      if (!rect) continue;
      const through = intersect(window, rect);
      if (!through) continue;
      const other = p.a === id ? p.b : p.a;
      seen.add(other);
      const had = best.get(other);
      if (had && had.x0 <= through.x0 && had.x1 >= through.x1 && had.y0 <= through.y0 && had.y1 >= through.y1) continue;
      best.set(other, through);
      walk(other, through, depth + 1, p);
    }
  };
  walk(start.id, FULL, 0, null);
  return seen;
}

export function createRoomCulling({ areas = [], portals = [], camera, isOpen = () => true }) {
  const layerOf = new Map(areas.map((a, i) => [a.id, i + 1])); // layer 0 = always drawn
  if (layerOf.size > 30) throw new Error('roomCulling: at most 30 rooms (camera layers)');
  let visible = null;

  return {
    /** Puts every mesh wholly inside one room on that room's layer. Returns how many meshes went to each room. */
    tag(root) {
      root.updateWorldMatrix(true, true);
      const counts = {};
      root.traverse((o) => {
        if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine)) return;
        // Exterior facades must still occlude a room when its interior layer is culled.
        if (o.userData.alwaysVisible) { o.layers.set(0); return; }
        box.setFromObject(o);
        if (box.isEmpty()) return;
        const eps = 0.02;
        const room = areas.find((a) => box.min.x >= a.minX - eps && box.max.x <= a.maxX + eps && box.min.y >= a.minY - eps
          && box.max.y <= a.maxY + eps && box.min.z >= a.minZ - eps && box.max.z <= a.maxZ + eps);
        if (!room) return;
        o.layers.set(layerOf.get(room.id));
        counts[room.id] = (counts[room.id] ?? 0) + 1;
      });
      return counts;
    },
    get visible() {
      return visible;
    },
    /** Enable the layers of the rooms the camera can see (layer 0 always). */
    update(enabled = true) {
      camera.updateMatrixWorld();
      visible = enabled ? visibleAreas({ areas, portals, camera, isOpen }) : null;
      if (!visible) {
        camera.layers.enableAll();
        return visible;
      }
      let mask = 1;
      for (const id of visible) mask |= 1 << layerOf.get(id);
      camera.layers.mask = mask;
      return visible;
    },
  };
}
