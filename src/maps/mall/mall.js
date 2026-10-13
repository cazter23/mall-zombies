// =============================================================================
// MALL MAP: start room + main concourse
// Everything is built from boxes with flat colors. Each solid box also becomes
// an axis-aligned collider (THREE.Box3) in the shared `colliders` list.
// Returns the map interface described in maps/index.js.
//
// Zones: startRoom (open at the start) and concourse (opened by the shutter door).
//
// Layout, in meters (+Y is up):
//   - Main concourse runs along X:  x -20..20, z -6..6, 6m ceiling
//   - Start room sits north (+Z):   x -5..5,   z 6..16, 4m ceiling
//   - A 4m-wide doorway at z = 6 joins them, blocked by a security shutter
// =============================================================================

import * as THREE from 'three';
import { makeTileTexture, makeSignTexture, makeShutterTexture } from '../../world/textures.js';
import { createShutter } from '../../world/shutter.js';
import { createDoor } from '../../world/door.js';
import { debug } from '../../config/debug.js';
import { economy } from '../../config/economy.js';

export const LAYOUT = {
  concourse: { minX: -20, maxX: 20, minZ: -6, maxZ: 6, height: 6 },
  startRoom: { minX: -5, maxX: 5, minZ: 6, maxZ: 16, height: 4 },
  doorway: { minX: -2, maxX: 2, height: 3 },
  wallThickness: 0.3,
};

const COLORS = {
  concourseWall: 0xf3ead9,
  startRoomWall: 0xc9b9a0,
  storefront: 0x8d7b93,
  ceiling: 0xfaf6ee,
  pillar: 0xe2dbcf,
  pillarBase: 0x9c8f80,
  wood: 0xa8763e,
  woodDark: 0x6e4a26,
  metal: 0x5d636b,
  planter: 0xd8cbb6,
  soil: 0x5a4030,
  leaves: 0x4caf50,
  leavesDark: 0x2f8f46,
  cardboard: 0xc79a5b,
  glass: 0x24405e,
  lightPanel: 0xfffbea,
};

export function buildMall(scene, colliders) {
  const group = new THREE.Group();
  group.name = 'mall';
  scene.add(group);

  const materials = new Map();

  // Zones: areas the player unlocks by buying doors. Zombies only spawn in open zones.
  const zones = {
    startRoom: { label: 'Start Room', open: true },
    concourse: { label: 'Concourse', open: false },
  };

  // --- Small helpers -------------------------------------------------------

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
    const box = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
    colliders.push(box);
    return box;
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
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    mesh.position.set(x, y, z);
    if (facing === -1) mesh.rotation.y = Math.PI;
    if (facing === 'x+') mesh.rotation.y = Math.PI / 2;
    if (facing === 'x-') mesh.rotation.y = -Math.PI / 2;
    group.add(mesh);
    return mesh;
  }

  function tiledFloor(minX, minZ, maxX, maxZ, textureOptions) {
    const texture = makeTileTexture(textureOptions);
    texture.repeat.set((maxX - minX) / 2, (maxZ - minZ) / 2);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35, metalness: 0.05 });
    return box(minX, -0.2, minZ, maxX, 0, maxZ, material, { name: 'floor' });
  }

  const C = LAYOUT.concourse;
  const R = LAYOUT.startRoom;
  const D = LAYOUT.doorway;
  const T = LAYOUT.wallThickness;

  // --- Floors and ceilings -------------------------------------------------

  tiledFloor(C.minX, C.minZ, C.maxX, C.maxZ, { base: '#f1e8d6', grout: '#cdbfa8', seed: 3 });
  tiledFloor(R.minX, R.minZ, R.maxX, R.maxZ, { base: '#d9cdb7', grout: '#a99a82', variation: 18, seed: 11 });

  box(C.minX - T, C.height, C.minZ - T, C.maxX + T, C.height + 0.3, C.maxZ + T, mat(COLORS.ceiling), { name: 'ceiling' });
  box(R.minX - T, R.height, R.minZ + T, R.maxX + T, R.height + 0.3, R.maxZ + T, mat(COLORS.ceiling), { name: 'ceiling' });

  // --- Concourse walls -----------------------------------------------------

  const wall = mat(COLORS.concourseWall);
  box(C.minX - T, 0, C.minZ - T, C.maxX + T, C.height, C.minZ, wall, { name: 'wall_south' });
  box(C.minX - T, 0, C.minZ, C.minX, C.height, C.maxZ, wall, { name: 'wall_west' });
  box(C.maxX, 0, C.minZ, C.maxX + T, C.height, C.maxZ, wall, { name: 'wall_east' });
  box(C.minX - T, 0, C.maxZ, R.minX, C.height, C.maxZ + T, wall, { name: 'wall_north_west' });
  box(R.maxX, 0, C.maxZ, C.maxX + T, C.height, C.maxZ + T, wall, { name: 'wall_north_east' });

  // Start-room storefront: the wall with the doorway (shared by both areas)
  const storefront = mat(COLORS.storefront);
  box(R.minX, 0, C.maxZ, D.minX, C.height, C.maxZ + T, storefront, { name: 'storefront_left' });
  box(D.maxX, 0, C.maxZ, R.maxX, C.height, C.maxZ + T, storefront, { name: 'storefront_right' });
  box(D.minX, D.height, C.maxZ, D.maxX, C.height, C.maxZ + T, storefront, { name: 'storefront_lintel' });

  sign('GOING OUT OF BUSINESS', {
    x: 0, y: 3.95, z: C.maxZ - 0.01, width: 7, height: 0.9, facing: -1,
    background: '#3b2f44', color: '#ffd23f',
  });

  // --- Start room walls ------------------------------------------------------

  const roomWall = mat(COLORS.startRoomWall);
  box(R.minX - T, 0, C.maxZ + T, R.minX, R.height, R.maxZ + T, roomWall, { name: 'startroom_wall_west' });
  box(R.maxX, 0, C.maxZ + T, R.maxX + T, R.height, R.maxZ + T, roomWall, { name: 'startroom_wall_east' });
  box(R.minX - T, 0, R.maxZ, R.maxX + T, R.height, R.maxZ + T, roomWall, { name: 'startroom_wall_back' });

  // --- The security shutter --------------------------------------------------

  const shutterMaterial = new THREE.MeshStandardMaterial({
    map: makeShutterTexture('CLOSED'),
    roughness: 0.55,
    metalness: 0.25,
  });
  const shutter = createShutter({
    name: 'shutter_startRoom',
    minX: D.minX,
    maxX: D.maxX,
    minZ: C.maxZ,
    maxZ: C.maxZ + T,
    height: D.height,
    material: shutterMaterial,
    colliders,
  });
  group.add(shutter.mesh);
  const shutterDoor = createDoor({
    id: 'startShutter',
    label: 'Security Shutter',
    price: economy.doors.startShutter,
    opensZone: 'concourse',
    zones,
    barrier: shutter,
    position: new THREE.Vector3(0, 1.5, C.maxZ + T / 2), // middle of the doorway
  });

  // --- Shop fronts along the concourse (decorative, not enterable) ----------

  function shopFront({ x0, x1, side, color, text, textColor }) {
    const dir = side === 'south' ? 1 : -1; // direction the shop faces
    const wallZ = side === 'south' ? C.minZ : C.maxZ;
    const z = (offset) => wallZ + dir * offset;
    const zr = (a, b) => [Math.min(z(a), z(b)), Math.max(z(a), z(b))];

    // Colored facade
    let [za, zb] = zr(0, 0.12);
    box(x0, 0, za, x1, 4.7, zb, mat(color), { collide: false, name: `shop_${text}` });
    // Dark glass window
    [za, zb] = zr(0.12, 0.15);
    box(x0 + 0.6, 0.35, za, x1 - 0.6, 3.15, zb, mat(COLORS.glass, { roughness: 0.15, metalness: 0.3 }), { collide: false });
    // Window frame mullions
    const frame = mat(0x2b2b2b);
    [za, zb] = zr(0.15, 0.18);
    for (let i = 1; i < 3; i++) {
      const x = x0 + 0.6 + ((x1 - x0 - 1.2) * i) / 3;
      box(x - 0.05, 0.35, za, x + 0.05, 3.15, zb, frame, { collide: false });
    }
    // Sign band
    sign(text, {
      x: (x0 + x1) / 2, y: 3.9, z: z(0.14), width: x1 - x0 - 1, height: 0.85, facing: dir,
      background: '#1f1a24', color: textColor,
    });
  }

  shopFront({ x0: -17, x1: -9, side: 'south', color: 0xff8a3d, text: 'GOOD SPORTS', textColor: '#ff8a3d' });
  shopFront({ x0: 9, x1: 17, side: 'south', color: 0xd9483b, text: 'NUTS & BOLTS', textColor: '#ff6b5b' });
  shopFront({ x0: -17, x1: -9, side: 'north', color: 0xffc83d, text: 'PLAY TIME TOYS', textColor: '#ffd23f' });
  shopFront({ x0: 9, x1: 17, side: 'north', color: 0x3d7fd9, text: 'BYTE ME ELECTRONICS', textColor: '#63b3ff' });

  // End-wall signs teasing future zones
  sign('FOOD COURT  >  CLOSED FOR "RENOVATIONS"', {
    x: C.minX + 0.02, y: 3.2, z: 0, width: 8, height: 0.9, facing: 'x+',
    background: '#2d6a4f', color: '#ffffff',
  });
  sign('PARKING  >  ABANDON ALL HOPE', {
    x: C.maxX - 0.02, y: 3.2, z: 0, width: 7, height: 0.9, facing: 'x-',
    background: '#264653', color: '#ffffff',
  });

  // --- Concourse obstacles -------------------------------------------------

  // Pillars (full height). Collider includes the wider base.
  for (const [px, pz] of [[-13, -3], [-13, 3], [13, -3], [13, 3]]) {
    box(px - 0.4, 0.3, pz - 0.4, px + 0.4, C.height, pz + 0.4, mat(COLORS.pillar), { collide: false, name: 'pillar' });
    box(px - 0.45, 0, pz - 0.45, px + 0.45, 0.3, pz + 0.45, mat(COLORS.pillarBase), { collide: false });
    addCollider(px - 0.45, 0, pz - 0.45, px + 0.45, C.height, pz + 0.45);
  }

  // Benches: low enough (0.45m) to jump onto
  function bench(x0, z0, x1, z1) {
    const legs = mat(COLORS.metal);
    const alongX = x1 - x0 > z1 - z0;
    if (alongX) {
      box(x0 + 0.1, 0, z0 + 0.05, x0 + 0.25, 0.38, z1 - 0.05, legs, { collide: false });
      box(x1 - 0.25, 0, z0 + 0.05, x1 - 0.1, 0.38, z1 - 0.05, legs, { collide: false });
    } else {
      box(x0 + 0.05, 0, z0 + 0.1, x1 - 0.05, 0.38, z0 + 0.25, legs, { collide: false });
      box(x0 + 0.05, 0, z1 - 0.25, x1 - 0.05, 0.38, z1 - 0.1, legs, { collide: false });
    }
    box(x0, 0.38, z0, x1, 0.45, z1, mat(COLORS.wood), { collide: false, name: 'bench' });
    addCollider(x0, 0, z0, x1, 0.45, z1).vaultable = true;
  }
  bench(4.5, -4.6, 6.9, -4.0);
  bench(-8, 3.9, -5.6, 4.5);
  bench(5.6, 3.9, 8, 4.5);

  // Planters with low-poly greenery
  function planter(x0, z0, x1, z1, { tree = false } = {}) {
    const h = 0.6;
    box(x0, 0, z0, x1, h, z1, mat(COLORS.planter), { name: 'planter' });
    box(x0 + 0.12, h, z0 + 0.12, x1 - 0.12, h + 0.02, z1 - 0.12, mat(COLORS.soil), { collide: false });
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (tree) {
      box(cx - 0.15, h, cz - 0.15, cx + 0.15, h + 2.1, cz + 0.15, mat(COLORS.woodDark), { name: 'tree_trunk' });
      const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), mat(COLORS.leaves));
      foliage.position.set(cx, h + 2.9, cz);
      group.add(foliage);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), mat(COLORS.leavesDark));
      top.position.set(cx + 0.3, h + 3.7, cz - 0.2);
      group.add(top);
    } else {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(COLORS.leaves));
      bush.position.set(cx, h + 0.35, cz);
      bush.scale.y = 0.8;
      group.add(bush);
    }
  }
  planter(-1.8, -2.8, 1.8, -1.2, { tree: true });
  planter(-19.4, -0.7, -18, 0.7);
  planter(18, -0.7, 19.4, 0.7);

  // Ceiling light panels
  const lightPanel = mat(COLORS.lightPanel, { emissive: COLORS.lightPanel, emissiveIntensity: 0.9 });
  for (const x of [-16, -8, 0, 8, 16]) {
    box(x - 1.2, C.height - 0.06, -0.6, x + 1.2, C.height, 0.6, lightPanel, { collide: false });
  }

  // --- Start room props (a closed-down store) -------------------------------

  // Checkout counter
  box(-4.2, 0, 13.6, -1.2, 0.95, 14.4, mat(COLORS.woodDark), { name: 'counter', vaultable: true });
  box(-4.25, 0.95, 13.55, -1.15, 1.02, 14.45, mat(COLORS.wood), { collide: false });

  // Empty shelving unit against the west wall
  box(-5, 0, 8, -4.4, 2.1, 11.5, mat(0x8a8f96), { name: 'shelf' });
  for (const y of [0.6, 1.2, 1.8]) {
    box(-4.42, y, 8.05, -4.38, y + 0.05, 11.45, mat(0x6c7178), { collide: false });
  }

  // Cardboard boxes (jumpable, stackable)
  box(2.9, 0, 14.2, 3.5, 0.6, 14.8, mat(COLORS.cardboard), { name: 'crate' });
  box(3.6, 0, 14.3, 4.1, 0.5, 14.8, mat(0xb88a4f), { name: 'crate' });
  box(3.0, 0.6, 14.3, 3.45, 1.05, 14.75, mat(0xd2a86a), { name: 'crate' });

  // Boarded-up vents where zombies will crawl in later
  const plank = mat(0x7a5230);
  for (const vx of [-3.5, 3.5]) {
    for (const y of [0.45, 0.8, 1.15]) {
      box(vx - 0.7, y, R.maxZ - 0.06, vx + 0.7, y + 0.2, R.maxZ, plank, { collide: false });
    }
  }

  sign('EVERYTHING MUST GO!', {
    x: 0, y: 2.7, z: R.maxZ - 0.02, width: 4.5, height: 0.8, facing: -1,
    background: '#d62839', color: '#ffffff',
  });

  // Start room lights: one working panel, one dead one (it's closed, after all)
  box(-1, R.height - 0.06, 9.4, 1, R.height, 10.4, lightPanel, { collide: false });
  box(-1, R.height - 0.06, 13, 1, R.height, 14, mat(0x9a978f), { collide: false });

  // --- Lighting --------------------------------------------------------------

  // All lights live in the map's group, so unloading the map removes them too.
  group.add(new THREE.HemisphereLight(0xfff6e6, 0xd8cdb8, 1.5));

  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(6, 20, 8);
  group.add(sun);

  for (const x of [-12, 0, 12]) {
    const lamp = new THREE.PointLight(0xfff0d0, 22, 0, 2);
    lamp.position.set(x, C.height - 0.8, 0);
    group.add(lamp);
  }
  const roomLamp = new THREE.PointLight(0xffe2b0, 8, 0, 2);
  roomLamp.position.set(0, R.height - 0.5, 10);
  group.add(roomLamp);

  // --- Spawn points and wall-buy spots (invisible markers) -------------------

  const markers = {
    // Where zombies will appear
    spawnPoints: [
      { name: 'spawn_startRoom_ventLeft', zone: 'startRoom', position: new THREE.Vector3(-3.5, 0, 15.4) },
      { name: 'spawn_startRoom_ventRight', zone: 'startRoom', position: new THREE.Vector3(3.5, 0, 15.4) },
      { name: 'spawn_concourse_goodSports', zone: 'concourse', position: new THREE.Vector3(-15, 0, -5.2) },
      { name: 'spawn_concourse_nutsAndBolts', zone: 'concourse', position: new THREE.Vector3(15, 0, -5.2) },
      { name: 'spawn_concourse_playTimeToys', zone: 'concourse', position: new THREE.Vector3(-15, 0, 5.2) },
      { name: 'spawn_concourse_byteMe', zone: 'concourse', position: new THREE.Vector3(15, 0, 5.2) },
    ],
    // Where weapons are bought off the wall. `normal` points out of the wall; `weapon` is a
    // config/weapons.js id. Prices live in economy.js.
    wallBuys: [
      // Cheap full-auto pistol in the going-out-of-business store
      { name: 'wallbuy_startRoom', zone: 'startRoom', weapon: 'priceGun', position: new THREE.Vector3(R.maxX - 0.02, 1.5, 10), normal: new THREE.Vector3(-1, 0, 0) },
      // The first real upgrade, on the wall just outside Nuts & Bolts hardware
      { name: 'wallbuy_concourse', zone: 'concourse', weapon: 'nailGun', position: new THREE.Vector3(7.7, 1.5, C.minZ + 0.02), normal: new THREE.Vector3(0, 0, 1) },
    ],
  };

  const markerGroup = new THREE.Group();
  markerGroup.name = 'markers';
  markerGroup.visible = debug.showMarkers;
  group.add(markerGroup);

  const spawnMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.5 });
  for (const s of markers.spawnPoints) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 8), spawnMarkerMaterial);
    m.name = s.name;
    m.position.copy(s.position).setY(0.9);
    markerGroup.add(m);
  }
  const wallBuyMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.6 });
  for (const w of markers.wallBuys) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), wallBuyMarkerMaterial);
    m.name = w.name;
    m.position.copy(w.position);
    m.scale.set(w.normal.x !== 0 ? 0.05 : 1, 1, w.normal.z !== 0 ? 0.05 : 1);
    markerGroup.add(m);
  }

  // Player start: middle of the start room, facing the shutter (-Z)
  const playerSpawn = { position: new THREE.Vector3(0, 0, 12), yaw: 0 };

  const doors = [shutterDoor];

  return {
    id: 'mall',
    group,
    zones,
    doors,
    spawnPoints: markers.spawnPoints,
    wallBuys: markers.wallBuys,
    playerSpawn,
    update(dt) {
      for (const door of doors) door.update(dt);
    },
    reset() {
      for (const door of doors) door.reset();
    },
    dispose() {
      group.removeFromParent();
    },
  };
}
