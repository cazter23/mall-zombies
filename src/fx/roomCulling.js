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
//
// THROUGH A DOORWAY, ONLY WHAT THE DOORWAY SHOWS (15 November 2026). A room seen through an opening used to be drawn whole:
// from the hallway, all of the Food Court for the sliver its door shows (about 250-290 draw calls in the worst views). The
// walk above already knows the screen rectangle each room is seen through, so each object of such a room is tested against
// that rectangle (its bounding sphere against the four planes through the eye) and skipped when it lies outside it. Nothing
// that could be on screen is skipped: what you see of a room is seen through its openings, and the rectangle bounds them.
//   culling.collect(root)        once, AFTER static batching: lists each room's meshes (still ones with their sphere worked
//                                out once; ones under a userData.dynamic parent or a shutter measured every frame, with a margin)
//   culling.windowCulled         how many objects the last update skipped (this way, or as far objects: below)
// A skipped object is moved to CULLED_LAYER (never on the camera) rather than off every layer, so ray tests that enable
// all layers (bullet marks) still find it.
// FAR OBJECTS (Graphics > Far objects, Potato and Low only): `farProps()` gives { metres, maxRadius, hysteresis }; a listed
// object smaller than maxRadius and further than metres from the camera is skipped the same way, in every visible room,
// the camera's own included. Infinity metres (Medium, High) = never.
//   culling.tagProps(scene)      scene-level props flagged userData.roomProp (wall-buy guns, Lost and Found, hazard switches:
//                                game/features) go on their room's layer too
//   culling.tagOutside(root)     meshes drawn only when the camera is in NO room (the debug test range, 100 m south behind
//                                the lot's wall: it was drawn from inside the mall, 107 calls from the Atrium's ring)
// =============================================================================

import * as THREE from 'three';

export const CULLED_LAYER = 29; // a room's object that its doorway doesn't show: on no camera, still found by ray tests
export const OUTSIDE_LAYER = 30; // drawn only when the camera is in no room (culling.tagOutside)
const MAX_ROOMS = 28; // (layers 1..28; 29-31 are CULLED_LAYER, OUTSIDE_LAYER and the shader warm-up's, fx/shaderWarmup.js)
const DYNAMIC_MARGIN = 0.75; // metres added round a moving object's sphere (its matrix is last frame's)

const FULL = Object.freeze({ x0: -1, x1: 1, y0: -1, y1: 1 });
const isFull = (r) => r.x0 <= -1 && r.x1 >= 1 && r.y0 <= -1 && r.y1 >= 1;
const center = new THREE.Vector3();
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

/**
 * The ids of the rooms visible from the camera (a Set), or null = draw everything (the camera isn't in a room).
 * `windows` (optional Map): filled with room id -> the screen rectangle it is seen through (the bounds of every way in).
 */
export function visibleAreas({ areas, portals, camera, isOpen = () => true, maxDepth = 5, windows = null }) {
  const start = areaAt(areas, camera.position);
  if (!start) return null;
  const seen = new Set([start.id]);
  windows?.set(start.id, FULL);
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
      if (windows) {
        const w = windows.get(other);
        windows.set(other, !w ? through : isFull(w) ? w
          : { x0: Math.min(w.x0, through.x0), x1: Math.max(w.x1, through.x1), y0: Math.min(w.y0, through.y0), y1: Math.max(w.y1, through.y1) });
      }
      const had = best.get(other);
      if (had && had.x0 <= through.x0 && had.x1 >= through.x1 && had.y0 <= through.y0 && had.y1 >= through.y1) continue;
      best.set(other, through);
      walk(other, through, depth + 1, p);
    }
  };
  walk(start.id, FULL, 0, null);
  return seen;
}

/** Is this object under a parent that moves it (userData.dynamic, a shutter)? The rule world/staticBatch.js freezes by. */
function moves(object) {
  for (let o = object; o; o = o.parent) if (o.userData.dynamic || o.userData.kind === 'shutter') return true;
  return false;
}

/** An object's bounding sphere in the world, into `entry` (x, y, z, r). */
function measure(entry) {
  const o = entry.object;
  const geometry = o.geometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  center.copy(sphere.center).applyMatrix4(o.matrixWorld);
  entry.x = center.x; entry.y = center.y; entry.z = center.z;
  entry.r = sphere.radius * o.matrixWorld.getMaxScaleOnAxis();
  entry.geometry = geometry;
}

const NO_LIMIT = Object.freeze({ metres: Infinity, maxRadius: 0, hysteresis: 0 });

export function createRoomCulling({ areas = [], portals = [], camera, isOpen = () => true, windowCulling = true, farProps = () => NO_LIMIT }) {
  const layerOf = new Map(areas.map((a, i) => [a.id, i + 1])); // layer 0 = always drawn
  if (layerOf.size > MAX_ROOMS) throw new Error(`roomCulling: at most ${MAX_ROOMS} rooms (camera layers)`);
  let visible = null;
  // Each room's meshes for the doorway test (collect): [{ object, mask, moving, x, y, z, r, geometry, culled }].
  const rooms = new Map(areas.map((a) => [a.id, { entries: [], culled: 0 }]));
  const windows = new Map();
  let windowCulled = 0;

  function restore(room) {
    if (!room.culled) return;
    for (const e of room.entries) if (e.culled) { e.culled = false; e.object.layers.mask = e.mask; }
    room.culled = 0;
  }

  // Skip the objects of a room that lie outside the screen rectangle it is seen through (w; null = the whole screen), and,
  // on the weakest settings, the small ones further than `far.metres` from the camera.
  function cullRoom(room, w, far) {
    const m = camera.matrixWorldInverse.elements, p = camera.projectionMatrix.elements;
    const fx = p[0], fy = p[5]; // (a symmetric perspective camera: screen x = fx * X / -Z)
    // The rectangle's four planes through the eye, in view space (a point is inside when every n . v >= 0).
    const lx = w && Math.hypot(fx, w.x0), rx = w && Math.hypot(fx, w.x1), ly = w && Math.hypot(fy, w.y0), ry = w && Math.hypot(fy, w.y1);
    const limited = far.metres < Infinity;
    const goes = far.metres * far.metres, returns = Math.max(0, far.metres - far.hysteresis) ** 2;
    let culled = 0;
    for (const e of room.entries) {
      if (e.moving || e.object.geometry !== e.geometry) measure(e); // (a moving object, or one whose geometry was swapped)
      const r = e.moving ? e.r + DYNAMIC_MARGIN : e.r;
      const X = m[0] * e.x + m[4] * e.y + m[8] * e.z + m[12];
      const Y = m[1] * e.x + m[5] * e.y + m[9] * e.z + m[13];
      const Z = m[2] * e.x + m[6] * e.y + m[10] * e.z + m[14];
      let outside = !!w && ((fx * X + w.x0 * Z) / lx < -r || (-fx * X - w.x1 * Z) / rx < -r
        || (fy * Y + w.y0 * Z) / ly < -r || (-fy * Y - w.y1 * Z) / ry < -r);
      if (limited && e.r <= far.maxRadius) {
        // (X, Y, Z is the object seen from the eye, so its length is the distance. Out beyond the limit; back in only
        // `hysteresis` nearer, so an object at the edge does not blink as the view bobs.)
        const d2 = X * X + Y * Y + Z * Z;
        e.far = d2 > goes || (e.far && d2 > returns);
        outside ||= e.far;
      } else e.far = false;
      if (outside) culled++;
      if (outside === e.culled) continue;
      e.culled = outside;
      e.object.layers.mask = outside ? 1 << CULLED_LAYER : e.mask;
    }
    room.culled = culled;
    return culled;
  }

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
    /** Scene-level props a feature flagged userData.roomProp (they never leave their room): tagged like the map's meshes. */
    tagProps(scene) {
      let tagged = 0;
      for (const child of scene.children) {
        if (!child.userData.roomProp) continue;
        for (const n of Object.values(this.tag(child))) tagged += n;
      }
      return tagged;
    },
    /** These meshes are drawn only when the camera is in no room (the debug test range). Lights are left alone. */
    tagOutside(root) {
      let tagged = 0;
      root?.traverse((o) => {
        if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine)) return;
        o.layers.set(OUTSIDE_LAYER);
        tagged++;
      });
      return tagged;
    },
    /** After static batching: list each room's meshes for the doorway test. Returns how many were listed. */
    collect(...roots) {
      for (const room of rooms.values()) { restore(room); room.entries.length = 0; }
      const idOf = new Map([...layerOf].map(([id, layer]) => [1 << layer, id]));
      let listed = 0;
      for (const root of roots) {
        root?.updateWorldMatrix(true, true);
        root?.traverse((o) => {
          // (Not instanced meshes: their instances can be anywhere, and move, whatever the one geometry's sphere says.)
          if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
          // Not what can show where no doorway is: a material drawn without the depth test, or with a depth offset (a floor
          // decal pulled toward the eye bleeds a few pixels through the foot of the wall in front of it: measured, 45 pixels
          // from the start room). Those keep the old rule (drawn with their room), so the picture is the same to the pixel.
          if ([o.material].flat().some((mat) => !mat || mat.depthTest === false || mat.polygonOffset)) return;
          const room = rooms.get(idOf.get(o.layers.mask));
          if (!room) return;
          const entry = { object: o, mask: o.layers.mask, moving: moves(o), culled: false, far: false, x: 0, y: 0, z: 0, r: 0, geometry: null };
          measure(entry);
          room.entries.push(entry);
          listed++;
        });
      }
      return listed;
    },
    get windowCulled() {
      return windowCulled;
    },
    /** The doorway test, on or off (off = a visible room is drawn whole; for comparing the two in a browser check). */
    get windowCulling() {
      return windowCulling;
    },
    set windowCulling(on) {
      windowCulling = !!on;
    },
    get visible() {
      return visible;
    },
    /** Enable the layers of the rooms the camera can see (layer 0 always). */
    update(enabled = true) {
      camera.updateMatrixWorld();
      windows.clear();
      visible = enabled ? visibleAreas({ areas, portals, camera, isOpen, windows }) : null;
      windowCulled = 0;
      if (!visible) {
        for (const room of rooms.values()) restore(room); // (everything is drawn: nothing may sit on the culled layer)
        camera.layers.enableAll();
        return visible;
      }
      const far = farProps() ?? NO_LIMIT;
      let mask = 1;
      for (const id of visible) {
        mask |= 1 << layerOf.get(id);
        const room = rooms.get(id), seen = windows.get(id);
        const w = windowCulling && seen && !isFull(seen) ? seen : null;
        if (!w && far.metres === Infinity) restore(room);
        else windowCulled += cullRoom(room, w, far);
      }
      camera.layers.mask = mask;
      return visible;
    },
  };
}
