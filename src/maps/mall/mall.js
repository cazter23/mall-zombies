// =============================================================================
// MALL MAP: start room + main concourse
// The layout only: rooms, doors, props, lights and markers, placed with the map
// kit (world/mapKit.js: boxes, walls with doorways, shutter doors, signs, markers)
// and the mall props (./props.js: shop fronts, pillars, benches, planters, light
// panels). Each solid box also becomes an axis-aligned collider (THREE.Box3) in
// the shared `colliders` list. Returns the map interface described in maps/index.js.
//
// Zones: startRoom (open at the start) and concourse (opened by the shutter door).
//
// Layout, in meters (+Y is up):
//   - Main concourse runs along X:  x -20..20, z -6..6, 6m ceiling
//   - Start room sits north (+Z):   x -5..5,   z 6..16, 4m ceiling
//   - A 4m-wide doorway at z = 6 joins them, blocked by a security shutter
// =============================================================================

import * as THREE from 'three';
import { createMapKit } from '../../world/mapKit.js';
import { createMallProps } from './props.js';
import { COLORS } from './palette.js';
import { debug } from '../../config/debug.js';
import { economy } from '../../config/economy.js';

export const LAYOUT = {
  concourse: { minX: -20, maxX: 20, minZ: -6, maxZ: 6, height: 6 },
  startRoom: { minX: -5, maxX: 5, minZ: 6, maxZ: 16, height: 4 },
  doorway: { minX: -2, maxX: 2, height: 3 },
  wallThickness: 0.3,
};

export function buildMall(scene, colliders) {
  const group = new THREE.Group();
  group.name = 'mall';
  scene.add(group);

  const kit = createMapKit(group, colliders);
  const { box, mat, sign, tiledFloor, wall } = kit;
  const props = createMallProps(kit);

  // Zones: areas the player unlocks by buying doors. Zombies only spawn in open zones.
  const zones = {
    startRoom: { label: 'Start Room', open: true },
    concourse: { label: 'Concourse', open: false },
  };

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

  const concourseWall = mat(COLORS.concourseWall);
  wall({ along: 'x', from: C.minX - T, to: C.maxX + T, at0: C.minZ - T, at1: C.minZ, height: C.height }, concourseWall, { name: 'wall_south' });
  wall({ along: 'z', from: C.minZ, to: C.maxZ, at0: C.minX - T, at1: C.minX, height: C.height }, concourseWall, { name: 'wall_west' });
  wall({ along: 'z', from: C.minZ, to: C.maxZ, at0: C.maxX, at1: C.maxX + T, height: C.height }, concourseWall, { name: 'wall_east' });
  // North wall: open where the start room's storefront is (that part is built next, in its own color).
  wall({
    along: 'x', from: C.minX - T, to: C.maxX + T, at0: C.maxZ, at1: C.maxZ + T, height: C.height,
    openings: [{ from: R.minX, to: R.maxX }],
  }, concourseWall, { name: 'wall_north' });

  // Start-room storefront: the wall with the doorway (shared by both areas)
  wall({
    along: 'x', from: R.minX, to: R.maxX, at0: C.maxZ, at1: C.maxZ + T, height: C.height,
    openings: [{ from: D.minX, to: D.maxX, top: D.height }],
  }, mat(COLORS.storefront), { name: 'storefront' });

  sign('GOING OUT OF BUSINESS', {
    x: 0, y: 3.95, z: C.maxZ - 0.01, width: 7, height: 0.9, facing: -1,
    background: '#3b2f44', color: '#ffd23f',
  });

  // --- Start room walls ------------------------------------------------------

  const roomWall = mat(COLORS.startRoomWall);
  wall({ along: 'z', from: C.maxZ + T, to: R.maxZ + T, at0: R.minX - T, at1: R.minX, height: R.height }, roomWall, { name: 'startroom_wall_west' });
  wall({ along: 'z', from: C.maxZ + T, to: R.maxZ + T, at0: R.maxX, at1: R.maxX + T, height: R.height }, roomWall, { name: 'startroom_wall_east' });
  wall({ along: 'x', from: R.minX - T, to: R.maxX + T, at0: R.maxZ, at1: R.maxZ + T, height: R.height }, roomWall, { name: 'startroom_wall_back' });

  // --- The security shutter (start room -> concourse) ------------------------

  const shutterDoor = kit.shutterDoor({
    id: 'startShutter',
    label: 'Security Shutter',
    price: economy.doors.startShutter,
    opensZone: 'concourse',
    zones,
    doorway: { minX: D.minX, maxX: D.maxX, minZ: C.maxZ, maxZ: C.maxZ + T, height: D.height },
  });

  // --- Shop fronts along the concourse (decorative, not enterable) ----------

  const south = { along: 'x', wallAt: C.minZ, facing: 1 };
  const north = { along: 'x', wallAt: C.maxZ, facing: -1 };
  props.shopFront({ ...south, from: -17, to: -9, color: 0xff8a3d, text: 'GOOD SPORTS', textColor: '#ff8a3d' });
  props.shopFront({ ...south, from: 9, to: 17, color: 0xd9483b, text: 'NUTS & BOLTS', textColor: '#ff6b5b' });
  props.shopFront({ ...north, from: -17, to: -9, color: 0xffc83d, text: 'PLAY TIME TOYS', textColor: '#ffd23f' });
  props.shopFront({ ...north, from: 9, to: 17, color: 0x3d7fd9, text: 'BYTE ME ELECTRONICS', textColor: '#63b3ff' });

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

  for (const [px, pz] of [[-13, -3], [-13, 3], [13, -3], [13, 3]]) props.pillar(px, pz, C.height);

  props.bench(4.5, -4.6, 6.9, -4.0);
  props.bench(-8, 3.9, -5.6, 4.5);
  props.bench(5.6, 3.9, 8, 4.5);

  props.planter(-1.8, -2.8, 1.8, -1.2, { tree: true });
  props.planter(-19.4, -0.7, -18, 0.7);
  props.planter(18, -0.7, 19.4, 0.7);

  for (const x of [-16, -8, 0, 8, 16]) props.lightPanel(x - 1.2, -0.6, x + 1.2, 0.6, C.height);

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

  // Boarded-up vents where zombies crawl in
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
  props.lightPanel(-1, 9.4, 1, 10.4, R.height);
  props.lightPanel(-1, 13, 1, 14, R.height, { dead: true });

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

  // Where zombies appear, tagged with the zone that has to be open.
  const spawnPoints = [
    { name: 'spawn_startRoom_ventLeft', zone: 'startRoom', position: new THREE.Vector3(-3.5, 0, 15.4) },
    { name: 'spawn_startRoom_ventRight', zone: 'startRoom', position: new THREE.Vector3(3.5, 0, 15.4) },
    { name: 'spawn_concourse_goodSports', zone: 'concourse', position: new THREE.Vector3(-15, 0, -5.2) },
    { name: 'spawn_concourse_nutsAndBolts', zone: 'concourse', position: new THREE.Vector3(15, 0, -5.2) },
    { name: 'spawn_concourse_playTimeToys', zone: 'concourse', position: new THREE.Vector3(-15, 0, 5.2) },
    { name: 'spawn_concourse_byteMe', zone: 'concourse', position: new THREE.Vector3(15, 0, 5.2) },
  ];
  // Where weapons are bought off the wall. `normal` points out of the wall; `weapon` is a
  // config/weapons.js id. Prices live in economy.js.
  const wallBuys = [
    // Cheap full-auto pistol in the going-out-of-business store
    { name: 'wallbuy_startRoom', zone: 'startRoom', weapon: 'priceGun', position: new THREE.Vector3(R.maxX - 0.02, 1.5, 10), normal: new THREE.Vector3(-1, 0, 0) },
    // The first real upgrade, on the wall just outside Nuts & Bolts hardware
    { name: 'wallbuy_concourse', zone: 'concourse', weapon: 'nailGun', position: new THREE.Vector3(7.7, 1.5, C.minZ + 0.02), normal: new THREE.Vector3(0, 0, 1) },
  ];
  kit.markers({ spawnPoints, wallBuys, visible: debug.showMarkers });

  // Player start: middle of the start room, facing the shutter (-Z)
  const playerSpawn = { position: new THREE.Vector3(0, 0, 12), yaw: 0 };

  const doors = [shutterDoor];

  return {
    id: 'mall',
    group,
    zones,
    doors,
    spawnPoints,
    wallBuys,
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
