// =============================================================================
// MAP KIT
// Shared building blocks for maps, so a new zone is a few short calls:
//   createMapKit(group, colliders) -> {
//     mat(color, options)        cached flat-shaded material
//     addCollider(...)           an invisible solid box (Box3 in the shared list)
//     box(...)                   a visible box; solid unless { collide: false }
//     sign(text, {...})          a flat sign with canvas-drawn text
//     tiledFloor(...)            a floor slab with a tile texture
//     wall({...}, material)      a straight wall, with doorway openings (+ lintels)
//     shutterDoor({...})         a roll-up shutter in a doorway + the buyable door
//     markers({...})             debug markers for spawn points and wall buys
//   }
// Everything is added to the map's `group` (so unloading the map removes it) and
// every solid box goes into the shared `colliders` list. wallSegments() is the
// pure geometry behind wall() (tested in tests/maps.test.js).
// =============================================================================

import * as THREE from 'three';
import { makeTileTexture, makeSignTexture, makeShutterTexture } from './textures.js';
import { createShutter } from './shutter.js';
import { createDoor } from './door.js';

/**
 * The boxes making up one straight wall with openings (pure math, no three.js).
 *   along:   'x' (the wall runs along X) or 'z' (runs along Z)
 *   from/to: where it starts and ends along that axis
 *   at0/at1: its thickness, on the other axis (at0 < at1)
 *   height:  wall height
 *   openings: [{ from, to, top }]  gaps along the wall; `top` = height of the gap (a doorway: a
 *            lintel fills top..height above it); no `top` = the gap goes all the way up
 * Returns [{ min: [x, y, z], max: [x, y, z], part: 'segment' | 'lintel' }]: the solid pieces
 * left to right, then the lintels in the order of `openings`.
 */
export function wallSegments({ along, from, to, at0, at1, height, openings = [] }) {
  const sorted = [...openings].sort((a, b) => a.from - b.from);
  const toBox = (u0, u1, y0, y1, part) => (along === 'x'
    ? { min: [u0, y0, at0], max: [u1, y1, at1], part }
    : { min: [at0, y0, u0], max: [at1, y1, u1], part });
  const boxes = [];
  let cursor = from;
  for (const o of sorted) {
    if (o.from > cursor) boxes.push(toBox(cursor, o.from, 0, height, 'segment'));
    cursor = Math.max(cursor, o.to);
  }
  if (cursor < to) boxes.push(toBox(cursor, to, 0, height, 'segment'));
  for (const o of openings) {
    if (o.top !== undefined && o.top < height) boxes.push(toBox(o.from, o.to, o.top, height, 'lintel'));
  }
  return boxes;
}

export function createMapKit(group, colliders) {
  const materials = new Map();

  function mat(color, options = {}) {
    const key = `${color}-${JSON.stringify(options)}`;
    if (!materials.has(key)) {
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...options }),
      );
    }
    return materials.get(key);
  }

  function addCollider(minX, minY, minZ, maxX, maxY, maxZ) {
    const b = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
    colliders.push(b);
    return b;
  }

  /** Adds a box spanning min..max. Solid (collides) unless { collide: false }. */
  function box(minX, minY, minZ, maxX, maxY, maxZ, material, { collide = true, name, vaultable = false } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ), material);
    mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    if (name) mesh.name = name;
    group.add(mesh);
    if (collide) addCollider(minX, minY, minZ, maxX, maxY, maxZ).vaultable = vaultable;
    return mesh;
  }

  /** A flat sign. `facing` is +1 (faces +Z) or -1 (faces -Z); or 'x+'/'x-' for side walls. */
  function sign(text, { x, y, z, width, height, facing, background, color }) {
    const texture = makeSignTexture(text, { background, color, aspect: width / height });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
    mesh.position.set(x, y, z);
    if (facing === -1) mesh.rotation.y = Math.PI;
    if (facing === 'x+') mesh.rotation.y = Math.PI / 2;
    if (facing === 'x-') mesh.rotation.y = -Math.PI / 2;
    group.add(mesh);
    return mesh;
  }

  /** A 0.2m floor slab (top at y = 0) with a procedural tile texture (1 texture repeat = 2m). */
  function tiledFloor(minX, minZ, maxX, maxZ, textureOptions) {
    const texture = makeTileTexture(textureOptions);
    texture.repeat.set((maxX - minX) / 2, (maxZ - minZ) / 2);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35, metalness: 0.05 });
    return box(minX, -0.2, minZ, maxX, 0, maxZ, material, { name: 'floor' });
  }

  /** A straight wall with openings (see wallSegments for the options); every piece is solid. */
  function wall(options, material, { name = 'wall' } = {}) {
    return wallSegments(options).map((piece, i) => box(
      ...piece.min, ...piece.max, material,
      { name: piece.part === 'lintel' ? `${name}_lintel` : `${name}_${i}` },
    ));
  }

  /**
   * A roll-up shutter filling a doorway, wrapped in a buyable door.
   *   doorway: { minX, maxX, minZ, maxZ, height }  the opening it fills (full wall thickness)
   *   id, label, price, opensZone, zones: see world/door.js
   *   text: painted on the shutter ('CLOSED')
   * The player buys it standing near the middle of the doorway (1.5m up).
   */
  function shutterDoor({ id, label, price, opensZone, zones, doorway, text = 'CLOSED' }) {
    const material = new THREE.MeshStandardMaterial({ map: makeShutterTexture(text), roughness: 0.55, metalness: 0.25 });
    const shutter = createShutter({ name: `shutter_${id}`, ...doorway, material, colliders });
    group.add(shutter.mesh);
    return createDoor({
      id, label, price, opensZone, zones,
      barrier: shutter,
      position: new THREE.Vector3((doorway.minX + doorway.maxX) / 2, 1.5, (doorway.minZ + doorway.maxZ) / 2),
    });
  }

  /** Debug markers: red pillars at spawn points, green boxes at wall-buy spots (hidden unless `visible`). */
  function markers({ spawnPoints, wallBuys, visible }) {
    const markerGroup = new THREE.Group();
    markerGroup.name = 'markers';
    markerGroup.visible = visible;
    group.add(markerGroup);
    const spawnMaterial = new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.5 });
    for (const s of spawnPoints) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 8), spawnMaterial);
      m.name = s.name;
      m.position.copy(s.position).setY(0.9);
      markerGroup.add(m);
    }
    const wallBuyMaterial = new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.6 });
    for (const w of wallBuys) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), wallBuyMaterial);
      m.name = w.name;
      m.position.copy(w.position);
      m.scale.set(w.normal.x !== 0 ? 0.05 : 1, 1, w.normal.z !== 0 ? 0.05 : 1);
      markerGroup.add(m);
    }
    return markerGroup;
  }

  return { group, colliders, mat, addCollider, box, sign, tiledFloor, wall, shutterDoor, markers };
}
