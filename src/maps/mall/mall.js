// =============================================================================
// MALL MAP: start room, main hallway (the hub), Mega Mart, Food Court
// The layout only: rooms, doors, props, lights and markers, placed with the map
// kit (world/mapKit.js: boxes, walls with doorways, shutter doors, signs, markers)
// and the mall props (./props.js: shop fronts, pillars, benches, planters, light
// panels, store shelves...). Each solid box also becomes an axis-aligned collider
// (THREE.Box3) in the shared `colliders` list. Returns the map interface described
// in maps/index.js.
//
// Zones and doors (prices in economy.doors):
//   startRoom   open at the start
//   hallway     start shutter (500): the hub every other area opens off
//   megaMart    Mega Mart shutter (750), east end of the hallway
//   foodCourt   Food Court shutter (1000), south wall of the hallway
//   (planned)   Service Corridor (1250) off the west end; escalator + elevator in the hallway
//
// Layout, in meters (+Y is up):
//   - Start room:      x -5..5,   z 6..16, 4m ceiling (doorway in its south wall at z = 6)
//   - Main hallway:    x -20..20, z -2..6, 6m ceiling (8m wide, runs along X)
//   - Food Court:      x -20..20, z -14.3..-2.3, 6m ceiling (the old concourse, moved south;
//                      its door is straight across the hallway from the start room's)
//   - Mega Mart:       x 20..34,  z -24..6, 5m ceiling. Its west wall (x 20..20.3, 6m tall)
//                      is also the east wall of the hallway (with the Mega Mart door) and of
//                      the Food Court (room for a shortcut door later).
// =============================================================================

import * as THREE from 'three';
import { createMapKit } from '../../world/mapKit.js';
import { createMallProps } from './props.js';
import { COLORS } from './palette.js';
import { debug } from '../../config/debug.js';
import { economy } from '../../config/economy.js';

export const LAYOUT = {
  startRoom: { minX: -5, maxX: 5, minZ: 6, maxZ: 16, height: 4 },
  hallway: { minX: -20, maxX: 20, minZ: -2, maxZ: 6, height: 6 },
  foodCourt: { minX: -20, maxX: 20, minZ: -14.3, maxZ: -2.3, height: 6 }, // north wall = hallway's south wall
  megaMart: { minX: 20, maxX: 34, minZ: -24, maxZ: 6, height: 5 },
  doorway: { minX: -2, maxX: 2, height: 3 }, // start room -> hallway (in the hallway's north wall)
  foodCourtDoorway: { minX: -2, maxX: 2, height: 3 }, // hallway -> Food Court (hallway's south wall)
  megaMartDoorway: { minZ: 0, maxZ: 4, height: 3 }, // hallway -> Mega Mart (Mega Mart's west wall)
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
    hallway: { label: 'Main Hallway', open: false },
    megaMart: { label: 'Mega Mart', open: false },
    foodCourt: { label: 'Food Court', open: false },
  };

  const R = LAYOUT.startRoom;
  const H = LAYOUT.hallway;
  const F = LAYOUT.foodCourt;
  const M = LAYOUT.megaMart;
  const D = LAYOUT.doorway;
  const FD = LAYOUT.foodCourtDoorway;
  const MD = LAYOUT.megaMartDoorway;
  const T = LAYOUT.wallThickness;
  const FZ = (F.minZ + F.maxZ) / 2; // Food Court center line (its props are placed relative to it)
  const HZ = (H.minZ + H.maxZ) / 2; // hallway center line

  // --- Floors and ceilings -------------------------------------------------

  tiledFloor(H.minX, H.minZ, H.maxX, H.maxZ, { base: '#ebe2d1', grout: '#c2b6a2', variation: 12, seed: 5 });
  tiledFloor(F.minX, F.minZ, F.maxX, H.minZ, { base: '#f1e8d6', grout: '#cdbfa8', seed: 3 }); // under the shared wall too
  tiledFloor(R.minX, R.minZ, R.maxX, R.maxZ, { base: '#d9cdb7', grout: '#a99a82', variation: 18, seed: 11 });

  box(H.minX - T, H.height, H.minZ - T, H.maxX + T, H.height + 0.3, H.maxZ + T, mat(COLORS.ceiling), { name: 'ceiling' });
  box(F.minX - T, F.height, F.minZ - T, F.maxX + T, F.height + 0.3, F.maxZ, mat(COLORS.ceiling), { name: 'ceiling' });
  box(R.minX - T, R.height, R.minZ + T, R.maxX + T, R.height + 0.3, R.maxZ + T, mat(COLORS.ceiling), { name: 'ceiling' });

  // --- Main hallway walls ------------------------------------------------------

  const hallWall = mat(COLORS.concourseWall);
  // North wall: open where the start room's storefront is (built next, in its own color).
  wall({
    along: 'x', from: H.minX - T, to: H.maxX + T, at0: H.maxZ, at1: H.maxZ + T, height: H.height,
    openings: [{ from: R.minX, to: R.maxX }],
  }, hallWall, { name: 'hallway_wall_north' });
  // South wall (shared with the Food Court), with the Food Court door in the middle.
  wall({
    along: 'x', from: H.minX - T, to: H.maxX, at0: H.minZ - T, at1: H.minZ, height: H.height,
    openings: [{ from: FD.minX, to: FD.maxX, top: FD.height }],
  }, hallWall, { name: 'hallway_wall_south' });
  // West wall: the Service Corridor door goes here later (a painted staff door for now).
  wall({ along: 'z', from: H.minZ, to: H.maxZ, at0: H.minX - T, at1: H.minX, height: H.height }, hallWall, { name: 'hallway_wall_west' });
  // (East: the Mega Mart's west wall, built with the Mega Mart.)

  // Start-room storefront: the wall with the start doorway (shared by the start room and hallway)
  wall({
    along: 'x', from: R.minX, to: R.maxX, at0: H.maxZ, at1: H.maxZ + T, height: H.height,
    openings: [{ from: D.minX, to: D.maxX, top: D.height }],
  }, mat(COLORS.storefront), { name: 'storefront' });

  sign('GOING OUT OF BUSINESS', {
    x: 0, y: 3.95, z: H.maxZ - 0.01, width: 7, height: 0.9, facing: -1,
    background: '#3b2f44', color: '#ffd23f',
  });

  // --- Start room walls ------------------------------------------------------

  const roomWall = mat(COLORS.startRoomWall);
  wall({ along: 'z', from: H.maxZ + T, to: R.maxZ + T, at0: R.minX - T, at1: R.minX, height: R.height }, roomWall, { name: 'startroom_wall_west' });
  wall({ along: 'z', from: H.maxZ + T, to: R.maxZ + T, at0: R.maxX, at1: R.maxX + T, height: R.height }, roomWall, { name: 'startroom_wall_east' });
  wall({ along: 'x', from: R.minX - T, to: R.maxX + T, at0: R.maxZ, at1: R.maxZ + T, height: R.height }, roomWall, { name: 'startroom_wall_back' });

  // --- Doors off the start room and the hallway -------------------------------

  const startDoor = kit.shutterDoor({
    id: 'startShutter',
    label: 'Security Shutter',
    price: economy.doors.startShutter,
    opensZone: 'hallway',
    zones,
    doorway: { minX: D.minX, maxX: D.maxX, minZ: H.maxZ, maxZ: H.maxZ + T, height: D.height },
  });
  const foodCourtDoor = kit.shutterDoor({
    id: 'foodCourt',
    label: 'Food Court',
    price: economy.doors.foodCourt,
    opensZone: 'foodCourt',
    zones,
    doorway: { minX: FD.minX, maxX: FD.maxX, minZ: H.minZ - T, maxZ: H.minZ, height: FD.height },
  });
  // (The Mega Mart door is built with the Mega Mart below.)

  // --- Main hallway dressing ---------------------------------------------------
  // Kept mostly clear: the escalator (west half) and elevator (north wall, east half) go here next.

  sign('FOOD COURT', {
    x: 0, y: 4.3, z: H.minZ + 0.02, width: 6, height: 1.2, facing: 1,
    background: '#2d6a4f', color: '#ffffff',
  });
  sign('MEGA MART', {
    x: H.maxX - 0.02, y: 4.3, z: (MD.minZ + MD.maxZ) / 2, width: 6, height: 1.2, facing: 'x-',
    background: '#1d4e89', color: '#ffd23f',
  });
  // The Service Corridor's door (west end) arrives later: a painted staff door marks the spot.
  props.wallDoor({
    along: 'z', center: HZ, wallAt: H.minX, facing: 1, width: 1.2, leaves: 1, color: COLORS.serviceDoor,
    label: 'SERVICE CORRIDOR · STAFF ONLY',
  });

  // Planters framing the Food Court door
  props.planter(FD.minX - 2.4, H.minZ + 0.3, FD.minX - 1.0, H.minZ + 1.5);
  props.planter(FD.maxX + 1.0, H.minZ + 0.3, FD.maxX + 2.4, H.minZ + 1.5);

  // Boarded vents where zombies get into the hallway
  props.boardedVent({ along: 'x', center: -15, wallAt: H.maxZ, facing: -1 });
  props.boardedVent({ along: 'x', center: 15, wallAt: H.maxZ, facing: -1 });
  props.boardedVent({ along: 'x', center: -14, wallAt: H.minZ, facing: 1 });

  for (const x of [-16, -8, 0, 8, 16]) props.lightPanel(x - 1.2, HZ - 0.6, x + 1.2, HZ + 0.6, H.height);

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
  const plank = mat(COLORS.plank);
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

  // --- Food Court (the old concourse, south of the hallway, behind the 1000 shutter) ---
  // Food stalls and tables come in a later step; for now it keeps the concourse's shops and props.

  const courtWall = mat(COLORS.concourseWall);
  wall({ along: 'x', from: F.minX - T, to: F.maxX, at0: F.minZ - T, at1: F.minZ, height: F.height }, courtWall, { name: 'foodcourt_wall_south' });
  wall({ along: 'z', from: F.minZ, to: F.maxZ, at0: F.minX - T, at1: F.minX, height: F.height }, courtWall, { name: 'foodcourt_wall_west' });
  // (North: the hallway's south wall. East: the Mega Mart's west wall.)

  const south = { along: 'x', wallAt: F.minZ, facing: 1 };
  const north = { along: 'x', wallAt: F.maxZ, facing: -1 };
  props.shopFront({ ...south, from: -17, to: -9, color: 0xff8a3d, text: 'GOOD SPORTS', textColor: '#ff8a3d' });
  props.shopFront({ ...south, from: 9, to: 17, color: 0xd9483b, text: 'NUTS & BOLTS', textColor: '#ff6b5b' });
  props.shopFront({ ...north, from: -17, to: -9, color: 0xffc83d, text: 'PLAY TIME TOYS', textColor: '#ffd23f' });
  props.shopFront({ ...north, from: 9, to: 17, color: 0x3d7fd9, text: 'BYTE ME ELECTRONICS', textColor: '#63b3ff' });

  sign('FOOD COURT  ·  NOW OPEN (KIND OF)', {
    x: F.minX + 0.02, y: 3.2, z: FZ, width: 8, height: 0.9, facing: 'x+',
    background: '#2d6a4f', color: '#ffffff',
  });

  for (const [px, pz] of [[-13, -3], [-13, 3], [13, -3], [13, 3]]) props.pillar(px, FZ + pz, F.height);

  props.bench(4.5, FZ - 4.6, 6.9, FZ - 4.0);
  props.bench(-8, FZ + 3.9, -5.6, FZ + 4.5);
  props.bench(5.6, FZ + 3.9, 8, FZ + 4.5);

  props.planter(-1.8, FZ - 2.8, 1.8, FZ - 1.2, { tree: true });
  props.planter(-19.4, FZ - 0.7, -18, FZ + 0.7);
  props.planter(18, FZ - 0.7, 19.4, FZ + 0.7);

  for (const x of [-16, -8, 0, 8, 16]) props.lightPanel(x - 1.2, FZ - 0.6, x + 1.2, FZ + 0.6, F.height);

  // --- Mega Mart (east of the hallway, behind the 750 shutter) -----------------

  tiledFloor(M.minX, M.minZ, M.maxX, M.maxZ, { base: '#e6e8e6', grout: '#c4c9c6', variation: 8, seed: 21 });
  box(M.minX + T, M.height, M.minZ - T, M.maxX + T, M.height + 0.3, M.maxZ + T, mat(COLORS.ceiling), { name: 'ceiling' });

  const martWall = mat(COLORS.megaMartWall);
  wall({ along: 'x', from: M.minX + T, to: M.maxX, at0: M.maxZ, at1: M.maxZ + T, height: M.height }, martWall, { name: 'megamart_wall_north' });
  wall({ along: 'z', from: M.minZ - T, to: M.maxZ + T, at0: M.maxX, at1: M.maxX + T, height: M.height }, martWall, { name: 'megamart_wall_east' });
  wall({ along: 'x', from: M.minX, to: M.maxX, at0: M.minZ - T, at1: M.minZ, height: M.height }, martWall, { name: 'megamart_wall_south' });
  // West wall: also the east wall of the hallway and the Food Court, so it's as tall as they are (6m);
  // the Mega Mart door is in the hallway stretch.
  wall({
    along: 'z', from: M.minZ, to: M.maxZ, at0: M.minX, at1: M.minX + T, height: H.height,
    openings: [{ from: MD.minZ, to: MD.maxZ, top: MD.height }],
  }, martWall, { name: 'megamart_wall_west' });

  const megaMartDoor = kit.shutterDoor({
    id: 'megaMart',
    label: 'Mega Mart',
    price: economy.doors.megaMart,
    opensZone: 'megaMart',
    zones,
    doorway: { minX: M.minX, maxX: M.minX + T, minZ: MD.minZ, maxZ: MD.maxZ, height: MD.height },
  });

  // Blue + yellow brand stripe around the inside, above door height.
  const martInnerWalls = [
    { along: 'x', from: M.minX + T, to: M.maxX, wallAt: M.maxZ, facing: -1 }, // north
    { along: 'z', from: M.minZ, to: M.maxZ, wallAt: M.maxX, facing: -1 }, // east
    { along: 'x', from: M.minX + T, to: M.maxX, wallAt: M.minZ, facing: 1 }, // south
    { along: 'z', from: M.minZ, to: M.maxZ, wallAt: M.minX + T, facing: 1 }, // west
  ];
  for (const w of martInnerWalls) {
    props.wallStripe({ ...w, y0: 3.3, y1: 3.6, color: COLORS.megaMartBlue });
    props.wallStripe({ ...w, y0: 3.6, y1: 3.66, color: COLORS.megaMartYellow });
  }
  sign('THANK YOU FOR SHOPPING AT MEGA MART', {
    x: 27.5, y: 2.6, z: M.maxZ - 0.02, width: 7, height: 0.6, facing: -1,
    background: '#1d4e89', color: '#ffffff',
  });

  // Front of the store: four checkout lanes (vaultable counters) facing the entrance. You walk in
  // at z 0..4 and the lanes are 2m wide; the ends stay open, so you can run round the row.
  [4.1, 1.3, -1.5, -4.3].forEach((z, i) => props.checkout(24.5, z - 0.4, 27.5, z + 0.4, i + 1));

  // Back of the store: three long shelf aisles (gondolas) running north-south. Aisles are 2.5m
  // (the west one 3.2m: a Food Court shortcut door can go on that wall later), with a 4.5m
  // walkway at the back and a crossing at the front.
  const gondolaXs = [24.0, 27.5, 31.0];
  gondolaXs.forEach((x, i) => {
    props.gondola(x - 0.5, -19.5, x + 0.5, -8, { seed: 3 + i * 2 });
    sign('SALE!', {
      x, y: 1.0, z: -7.99, width: 0.8, height: 0.4, facing: 1,
      background: '#e63946', color: '#ffffff',
    });
  });
  const aisles = [
    [21.9, 'AISLE 1 · OUTDOOR'],
    [25.75, 'AISLE 2 · SNACKS'],
    [29.25, 'AISLE 3 · ALL HOLIDAYS'],
    [32.75, 'AISLE 4 · HOUSEWARES'],
  ];
  for (const [x, text] of aisles) {
    for (const facing of [1, -1]) {
      sign(text, {
        x, y: 3.4, z: -7.6 + facing * 0.01, width: 2.2, height: 0.5, facing,
        background: '#1d4e89', color: '#ffd23f',
      });
    }
  }

  // Back wall: stockroom + receiving doors and a boarded vent (where zombies come in).
  props.wallDoor({
    along: 'x', center: 26.5, wallAt: M.minZ, facing: 1, width: 1.8, color: COLORS.serviceDoor,
    label: 'STOCKROOM · EMPLOYEES ONLY',
  });
  props.wallDoor({
    along: 'x', center: 31.8, wallAt: M.minZ, facing: 1, width: 1.8, color: COLORS.serviceDoor,
    label: 'RECEIVING',
  });
  props.boardedVent({ along: 'x', center: 21.8, wallAt: M.minZ, facing: 1 });

  // East wall: an emergency exit (with the mall's parking-lot joke).
  props.wallDoor({
    along: 'z', center: 2.5, wallAt: M.maxX, facing: -1, width: 1.2, leaves: 1, color: COLORS.exitDoor,
    label: 'EMERGENCY EXIT', labelBackground: '#9b2c2c',
  });
  sign('PARKING  >  ABANDON ALL HOPE', {
    x: M.maxX - 0.02, y: 4.3, z: 2.5, width: 6, height: 0.8, facing: 'x-',
    background: '#264653', color: '#ffffff',
  });

  // Fluorescent strips: over each aisle (one dead), across the front, along the back walkway.
  for (const [x] of aisles) {
    props.lightPanel(x - 0.25, -19, x + 0.25, -14, M.height, { dead: x === 29.25 });
    props.lightPanel(x - 0.25, -13, x + 0.25, -8, M.height);
  }
  props.lightPanel(21.5, 2.75, 33, 3.25, M.height);
  props.lightPanel(21.5, -3.25, 33, -2.75, M.height);
  props.lightPanel(21.5, -22, 33, -21.5, M.height, { dead: true });

  // --- Lighting --------------------------------------------------------------

  // All lights live in the map's group, so unloading the map removes them too.
  group.add(new THREE.HemisphereLight(0xfff6e6, 0xd8cdb8, 1.5));

  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(6, 20, 8);
  group.add(sun);

  const lamp = (color, intensity, x, y, z) => {
    const light = new THREE.PointLight(color, intensity, 0, 2);
    light.position.set(x, y, z);
    group.add(light);
  };
  for (const x of [-10, 10]) lamp(0xfff0d0, 22, x, H.height - 0.8, HZ); // hallway
  for (const x of [-12, 0, 12]) lamp(0xfff0d0, 22, x, F.height - 0.8, FZ); // Food Court
  lamp(0xffe2b0, 8, 0, R.height - 0.5, 10); // start room
  for (const z of [0, -15]) lamp(0xf2f6ff, 16, 27.5, M.height - 0.8, z); // Mega Mart: cool fluorescent

  // --- Spawn points and wall-buy spots (invisible markers) -------------------

  // Where zombies appear, tagged with the zone that has to be open.
  const spawnPoints = [
    { name: 'spawn_startRoom_ventLeft', zone: 'startRoom', position: new THREE.Vector3(-3.5, 0, 15.4) },
    { name: 'spawn_startRoom_ventRight', zone: 'startRoom', position: new THREE.Vector3(3.5, 0, 15.4) },
    { name: 'spawn_hallway_ventNorthWest', zone: 'hallway', position: new THREE.Vector3(-15, 0, H.maxZ - 0.8) },
    { name: 'spawn_hallway_ventNorthEast', zone: 'hallway', position: new THREE.Vector3(15, 0, H.maxZ - 0.8) },
    { name: 'spawn_hallway_ventSouth', zone: 'hallway', position: new THREE.Vector3(-14, 0, H.minZ + 0.8) },
    { name: 'spawn_foodCourt_goodSports', zone: 'foodCourt', position: new THREE.Vector3(-15, 0, F.minZ + 0.8) },
    { name: 'spawn_foodCourt_nutsAndBolts', zone: 'foodCourt', position: new THREE.Vector3(15, 0, F.minZ + 0.8) },
    { name: 'spawn_foodCourt_playTimeToys', zone: 'foodCourt', position: new THREE.Vector3(-15, 0, F.maxZ - 0.8) },
    { name: 'spawn_foodCourt_byteMe', zone: 'foodCourt', position: new THREE.Vector3(15, 0, F.maxZ - 0.8) },
    { name: 'spawn_megaMart_stockroom', zone: 'megaMart', position: new THREE.Vector3(26.5, 0, -23.2) },
    { name: 'spawn_megaMart_receiving', zone: 'megaMart', position: new THREE.Vector3(31.8, 0, -23.2) },
    { name: 'spawn_megaMart_vent', zone: 'megaMart', position: new THREE.Vector3(21.8, 0, -23.2) },
    { name: 'spawn_megaMart_emergencyExit', zone: 'megaMart', position: new THREE.Vector3(33.2, 0, 2.5) },
  ];
  // Where weapons are bought off the wall. `normal` points out of the wall; `weapon` is a
  // config/weapons.js id. Prices live in economy.js.
  const wallBuys = [
    // Cheap full-auto pistol in the going-out-of-business store
    { name: 'wallbuy_startRoom', zone: 'startRoom', weapon: 'priceGun', position: new THREE.Vector3(R.maxX - 0.02, 1.5, 10), normal: new THREE.Vector3(-1, 0, 0) },
    // The first real upgrade, on the hallway's south wall (east of the Food Court door): available as
    // soon as the start shutter is open, like it was in the old concourse.
    { name: 'wallbuy_hallway', zone: 'hallway', weapon: 'nailGun', position: new THREE.Vector3(11, 1.5, H.minZ + 0.02), normal: new THREE.Vector3(0, 0, 1) },
    // Reserved for a future gun (Mega Mart toy section). Inert until that weapon exists in
    // config/weapons.js + economy.wallBuys: main.js skips wall buys for unknown weapons.
    { name: 'wallbuy_megaMart', zone: 'megaMart', weapon: 'foamDartBlaster', position: new THREE.Vector3(31.5, 1.5, M.maxZ - 0.02), normal: new THREE.Vector3(0, 0, -1) },
  ];
  kit.markers({ spawnPoints, wallBuys, visible: debug.showMarkers });

  // Player start: middle of the start room, facing the shutter (-Z)
  const playerSpawn = { position: new THREE.Vector3(0, 0, 12), yaw: 0 };

  const doors = [startDoor, megaMartDoor, foodCourtDoor];

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
