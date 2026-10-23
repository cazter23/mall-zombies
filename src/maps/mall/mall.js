// =============================================================================
// MALL MAP: start room, main hallway (the hub), Mega Mart, Food Court, Service Corridor
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
//   serviceCorridor  Service Corridor shutter (1250), west end of the hallway
//   foodCourtMegaMart (1000), serviceCorridorFoodCourt (1250): shortcuts open BOTH joined zones
// The hallway also has an escalator (west half, up through a hole in the ceiling to a boarded-up
// level-2 landing) and elevator doors (north wall): both SEALED for now, the way up to a second floor later.
//
// Layout, in meters (+Y is up):
//   - Start room:      x -5..5,   z 6..16, 4m ceiling (doorway in its south wall at z = 6)
//   - Main hallway:    x -20..20, z -2..6, 6m ceiling (8m wide, runs along X)
//   - Food Court:      x -20..20, z -14.3..-2.3, 6m ceiling (the old concourse, moved south;
//                      its door is straight across the hallway from the start room's)
//   - Mega Mart:       x 20..34,  z -24..6, 5m ceiling. Its west wall (x 20..20.3, 6m tall)
//                      is also the east wall of the hallway (with the Mega Mart door) and of
//                      the Food Court (shortcut at z -9.8..-6.8).
//   - Service Corridor: a 3m-wide back-of-house corridor built with the corridor builder
//                      (world/corridor.js): through the hallway's west wall (z 0.5..3.5), then
//                      south 16m along the Food Court's west side (shortcut at z -13.4..-11),
//                      to an end vent at z -14. 3.5m ceiling.
// =============================================================================

import * as THREE from 'three';
import { createMapKit } from '../../world/mapKit.js';
import { createDoor } from '../../world/door.js';
import { markCollidersChanged } from '../../world/collision.js';
import { createMallProps } from './props.js';
import { COLORS } from './palette.js';
import { debug } from '../../config/debug.js';
import { economy } from '../../config/economy.js';
import { upgrades } from '../../config/upgrades.js';
import { buildStores, storeOpenings } from './stores.js';
import { buildStartRoomDetails } from './startRoomDetails.js';
import { buildMegaMartDetails, MART_FIXTURES } from './megaMartDetails.js';
import { buildMallAtmosphere } from './atmosphere.js';
import { buildRestockMachine } from './restockMachine.js';
import { buildLevelTwo } from './levelTwo.js';
import { atmosphere } from '../../config/environment.js';

export const LAYOUT = {
  startRoom: { minX: -5, maxX: 5, minZ: 6, maxZ: 16, height: 4 },
  hallway: { minX: -20, maxX: 20, minZ: -2, maxZ: 6, height: 6 },
  foodCourt: { minX: -20, maxX: 20, minZ: -14.3, maxZ: -2.3, height: 6 }, // north wall = hallway's south wall
  megaMart: { minX: 20, maxX: 34, minZ: -24, maxZ: 6, height: 5 },
  doorway: { minX: -2, maxX: 2, height: 3 }, // start room -> hallway (in the hallway's north wall)
  foodCourtDoorway: { minX: -3.5, maxX: 3.5, height: 3 }, // hallway -> Food Court (hallway's south wall): a wide 7m mall gate
  megaMartDoorway: { minZ: -1, maxZ: 5, height: 3 }, // hallway -> Mega Mart (Mega Mart's west wall): 6m wide
  foodCourtMegaMartDoorway: { minZ: -10.8, maxZ: -5.8, height: 3 }, // shared east wall, Food Court centre line: 5m wide
  serviceCorridorFoodCourtDoorway: { minZ: -13.4, maxZ: -11, height: 3 }, // opposite the cannon, beyond the lockers
  // Escalator in the hallway's west half: bottom end at x -4 (facing the hub), rising west to level 2
  // (the top of the hallway ceiling, y 6.3). 2m wide. Sealed for now.
  escalator: { bottomX: -4, dir: -1, minZ: 1, maxZ: 3 },
  elevator: { centerX: 10.5 }, // doors in the hallway's north wall (sealed for now)
  // Level 2 (maps/mall/levelTwo.js): the quiet Sunset Promenade over the hallway, reached by the repaired escalator. Its footprint
  // is the hallway's. shops = empty fronts on the north wall (x from..to), seating = the planter ring + wall benches, vents =
  // boarded vents that are zombie spawns (wall + position along it), lamps = where its point lights hang (x, z).
  level2: {
    height: 3.6,
    shops: [
      { id: 'shoePer', from: -10, to: -4, color: 0x7a5c8a, text: 'SHOE-PER SALE', signBackground: '#2b2233', signColor: '#c9b6e4', gate: 0.7, note: 'SPACE AVAILABLE · INQUIRE WITHIN' },
      { id: 'comingSoon', from: -3, to: 3, color: 0xe6c37a, text: 'COMING SOON', signBackground: '#ffd23f', signColor: '#1d1626', note: 'A NEW LOOK IS COMING' },
      { id: 'pretzel', from: 4, to: 10, color: 0xd9822b, text: 'PRETZEL PALACE', signBackground: '#5c2e12', signColor: '#ffd9a8', gate: 2.0 },
    ],
    seating: { planterX: 13, planterZ: 1.6, wallBenches: [[-9, -7.2], [-6.2, -4.4]] },
    vents: [
      { id: 'southWest', wall: 'south', at: -13 },
      { id: 'southMiddle', wall: 'south', at: 8 },
      { id: 'east', wall: 'east', at: 4.2 },
      { id: 'northEast', wall: 'north', at: 16 },
    ],
    lamps: [{ x: -8, z: 2 }, { x: 10, z: 2 }],
  },
  // Customer Service desk (Extended Warranty tiers): on the hallway's north wall between the start doorway
  // and the elevator. Move it by changing this one entry (the prop, its collider and its buy spot follow).
  serviceDesk: { along: 'x', center: 7, wallAt: 6, facing: -1, zone: 'hallway' },
  // The four Food Court stores, each a real walk-in room selling one gun-attachment slot (see maps/mall/stores.js
  // for the fields). Two are RECESSED into the south wall (rooms behind it), two are PODS standing against the
  // hallway wall (3.5-4.5m into the Food Court). Move or resize a store by changing its entry.
  stores: [
    {
      id: 'goodSports', name: 'GOOD SPORTS', slot: 'grip', side: 'south', from: -17, to: -9, depth: 6, doorWidth: 3, theme: 'goodSports',
      color: 0xff8a3d, signColor: '#ff8a3d', wall: 0xf3e3c5, floor: { base: '#c79a62', grout: '#8a6438', variation: 14, seed: 41 },
      apron: 0xff8a3d, title: 'GOOD SPORTS · GRIPS', titleColor: '#ff8a3d', signStyle: 'varsity',
    },
    {
      id: 'nutsAndBolts', name: 'NUTS & BOLTS', slot: 'barrel', side: 'south', from: 9, to: 17, depth: 6, doorWidth: 3, theme: 'nutsAndBolts',
      color: 0xd9483b, signColor: '#ff6b5b', wall: 0x8a5a44, floor: { base: '#6b5b53', grout: '#4d423c', variation: 12, seed: 43 },
      apron: 0xd9483b, title: 'NUTS & BOLTS · BARRELS', titleColor: '#ffd23f', signStyle: 'industrial',
    },
    {
      id: 'playTimeToys', name: 'PLAY TIME TOYS', slot: 'magazine', side: 'north', from: -16.4, to: -10.6, depth: 4.5, doorWidth: 3, theme: 'playTimeToys',
      color: 0xffc83d, signColor: '#ffd23f', wall: 0xfff1a8, floor: { base: '#f4b6d2', grout: '#ffd6e7', variation: 8, seed: 45 },
      apron: 0xff7bd5, title: 'PLAY TIME TOYS · MAGAZINES', titleColor: '#ffd23f', signStyle: 'toy',
    },
    {
      id: 'byteMe', name: 'BYTE ME ELECTRONICS', slot: 'sight', side: 'north', from: 10.6, to: 16.4, depth: 4.5, doorWidth: 3, theme: 'byteMe',
      color: 0x3d7fd9, signColor: '#63b3ff', wall: 0x2c3a5c, floor: { base: '#243457', grout: '#16213d', variation: 10, seed: 47 },
      apron: 0x3d7fd9, title: 'BYTE ME · SIGHTS', titleColor: '#63b3ff', signStyle: 'tech',
    },
  ],
  // Service Corridor: its doorway in the hallway's west wall, then south along the Food Court's west wall.
  serviceCorridor: { width: 3, height: 3.5, length: 16, doorway: { minZ: 0.5, maxZ: 3.5, height: 3 } },
  wallThickness: 0.3,
  restockMachine: { x: 4.95 }, // the RESTOCK-O-MATIC on the Food Court's north wall (its x; the front faces south)
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
    serviceCorridor: { label: 'Service Corridor', open: false },
    upstairs: { label: 'Level 2', open: false }, // opened by repairing the escalator (the escalatorRepair door)
  };

  const R = LAYOUT.startRoom;
  const H = LAYOUT.hallway;
  const F = LAYOUT.foodCourt;
  const M = LAYOUT.megaMart;
  const D = LAYOUT.doorway;
  const FD = LAYOUT.foodCourtDoorway;
  const MD = LAYOUT.megaMartDoorway;
  const FM = LAYOUT.foodCourtMegaMartDoorway;
  const SF = LAYOUT.serviceCorridorFoodCourtDoorway;
  const SC = LAYOUT.serviceCorridor;
  const SCD = SC.doorway;
  const T = LAYOUT.wallThickness;
  const FZ = (F.minZ + F.maxZ) / 2; // Food Court center line (its props are placed relative to it)
  const HZ = (H.minZ + H.maxZ) / 2; // hallway center line

  // --- Floors and ceilings -------------------------------------------------

  tiledFloor(H.minX, H.minZ, H.maxX, H.maxZ, { base: '#ebe2d1', grout: '#c2b6a2', variation: 12, seed: 5 });
  // Continue beneath both shared walls: a floor gap under the west shortcut can split the nav
  // grid when other loaded geometry (the debug range, future areas) shifts its cell centres.
  tiledFloor(F.minX - T, F.minZ, F.maxX, H.minZ, { base: '#f1e8d6', grout: '#cdbfa8', seed: 3 });
  tiledFloor(R.minX, R.minZ, R.maxX, R.maxZ, { base: '#d9cdb7', grout: '#a99a82', variation: 18, seed: 11 });

  // (The hallway's ceiling is built with the escalator below: it has a hole for it.)
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
  // West wall: the Service Corridor door.
  wall({
    along: 'z', from: H.minZ, to: H.maxZ, at0: H.minX - T, at1: H.minX, height: H.height,
    openings: [{ from: SCD.minZ, to: SCD.maxZ, top: SCD.height }],
  }, hallWall, { name: 'hallway_wall_west' });
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
  const serviceCorridorDoor = kit.shutterDoor({
    id: 'serviceCorridor',
    label: 'Service Corridor',
    price: economy.doors.serviceCorridor,
    opensZone: 'serviceCorridor',
    zones,
    doorway: { minX: H.minX - T, maxX: H.minX, minZ: SCD.minZ, maxZ: SCD.maxZ, height: SCD.height },
  });
  // (The Mega Mart door is built with the Mega Mart below.)

  // --- Main hallway: escalator, elevator, ceiling ------------------------------

  // The escalator up to level 2 (sealed), the ceiling with a hole where it passes through, and the
  // boarded-up landing you can see up there.
  const E = LAYOUT.escalator;
  const upperY = H.height + 0.3; // level 2 floor = top of the hallway ceiling
  const escalator = props.escalator({ ...E, upperY, ceilingY: H.height });
  kit.slab({ minX: H.minX - T, maxX: H.maxX + T, minZ: H.minZ - T, maxZ: H.maxZ + T }, H.height, upperY, mat(COLORS.ceiling), {
    hole: escalator.hole, name: 'ceiling',
  });

  // REPAIRING the escalator = a buyable door: its "barrier" is the collider across the escalator's foot plus the rope and
  // OUT OF ORDER board. Opening it removes them (the ramp and its link are always there); it opens the 'upstairs' zone.
  const escalatorGate = {
    collider: escalator.barrier,
    open() {
      const i = colliders.indexOf(escalator.barrier);
      if (i !== -1) {
        colliders.splice(i, 1);
        markCollidersChanged(colliders);
      }
      for (const part of escalator.barrierParts) part.visible = false;
    },
    close() {
      if (!colliders.includes(escalator.barrier)) {
        colliders.push(escalator.barrier);
        markCollidersChanged(colliders);
      }
      for (const part of escalator.barrierParts) part.visible = true;
    },
    update() {},
  };
  const escalatorDoor = createDoor({
    id: 'escalatorRepair', label: 'Escalator', verb: 'repair', price: economy.doors.escalatorRepair,
    opensZone: 'upstairs', zones, barrier: escalatorGate,
    position: new THREE.Vector3(escalator.foot.x, 1.1, escalator.foot.z),
  });
  // Level 2 itself, on top of the slab: walkway, shop fronts, seating, railings round the escalator well, boarded vents.
  const levelTwo = buildLevelTwo({
    kit, floorY: upperY, rect: { minX: H.minX, maxX: H.maxX, minZ: H.minZ, maxZ: H.maxZ }, hole: escalator.hole, layout: LAYOUT.level2,
  });

  // Elevator doors in the north wall (sealed).
  props.elevatorDoors({ along: 'x', center: LAYOUT.elevator.centerX, wallAt: H.maxZ, facing: -1 });

  // Customer Service desk (gun tiers; a map feature of kind 'upgradeDesk', below).
  const { zone: deskZone, ...deskSpot } = LAYOUT.serviceDesk;
  const serviceDesk = props.serviceDesk({ ...deskSpot, tierColors: upgrades.tiers.map((t) => t.color) });

  // --- Main hallway dressing ---------------------------------------------------

  sign('FOOD COURT', {
    x: 0, y: 4.3, z: H.minZ + 0.02, width: 6, height: 1.2, facing: 1,
    background: '#2d6a4f', color: '#ffffff',
  });
  sign('MEGA MART', {
    x: H.maxX - 0.02, y: 4.3, z: (MD.minZ + MD.maxZ) / 2, width: 6, height: 1.2, facing: 'x-',
    background: '#1d4e89', color: '#ffd23f',
  });
  sign('SERVICE CORRIDOR · STAFF ONLY', {
    x: H.minX + 0.02, y: 3.6, z: (SCD.minZ + SCD.maxZ) / 2, width: 3.4, height: 0.45, facing: 'x+',
    background: '#3a3f47', color: '#ffd23f',
  });

  // Planters framing the Food Court door
  props.planter(FD.minX - 2.4, H.minZ + 0.3, FD.minX - 1.0, H.minZ + 1.5);
  props.planter(FD.maxX + 1.0, H.minZ + 0.3, FD.maxX + 2.4, H.minZ + 1.5);

  // Boarded vents where zombies get into the hallway
  props.boardedVent({ along: 'x', center: -15, wallAt: H.maxZ, facing: -1 });
  props.boardedVent({ along: 'x', center: 15, wallAt: H.maxZ, facing: -1 });
  props.boardedVent({ along: 'x', center: -14, wallAt: H.minZ, facing: 1 });

  // Ceiling lights (the west one is short: the escalator's ceiling hole is just east of it)
  for (const x of [-8, 0, 8, 16]) props.lightPanel(x - 1.2, HZ - 0.6, x + 1.2, HZ + 0.6, H.height);
  props.lightPanel(-19.6, HZ - 0.6, -18.0, HZ + 0.6, H.height);

  // --- Start room props (a closed-down store) -------------------------------

  // Checkout counter
  box(-4.2, 0, 13.6, -1.2, 0.95, 14.4, mat(COLORS.woodDark), { name: 'counter', vaultable: true });
  box(-4.25, 0.95, 13.55, -1.15, 1.02, 14.45, mat(COLORS.wood), { collide: false });

  // Open shelves inside the same original collision box: unchanged walking and navigation space.
  kit.addCollider(-5, 0, 8, -4.4, 2.1, 11.5);
  box(-5, 0, 8, -4.94, 2.1, 11.5, mat(0x8a8f96), { name: 'shelf', collide: false });
  for (const z of [8, 11.44]) box(-4.94, 0, z, -4.38, 2.1, z + 0.06, mat(0x8a8f96), { collide: false });
  for (const y of [0.6, 1.2, 1.8]) {
    box(-4.94, y, 8.05, -4.38, y + 0.05, 11.44, mat(0x6c7178), { collide: false });
  }

  // Cardboard boxes (jumpable, stackable)
  box(2.9, 0, 14.2, 3.5, 0.6, 14.8, mat(COLORS.cardboard), { name: 'crate' });
  box(3.6, 0, 14.3, 4.1, 0.5, 14.8, mat(0xb88a4f), { name: 'crate' });
  box(3.0, 0.6, 14.3, 3.45, 1.05, 14.75, mat(0xd2a86a), { name: 'crate' });

  // Clearance-store dressing and framed boarded vents; the existing collision layout stays intact.
  buildStartRoomDetails(kit, R);

  sign('EVERYTHING MUST GO!', {
    x: 0, y: 2.7, z: R.maxZ - 0.02, width: 4.5, height: 0.8, facing: -1,
    background: '#d62839', color: '#ffffff',
  });

  // Start room lights: one working panel, one dead one (it's closed, after all)
  props.lightPanel(-1, 9.4, 1, 10.4, R.height);
  props.lightPanel(-1, 13, 1, 14, R.height, { dead: true });

  // --- Food Court (the old concourse, south of the hallway, behind the 1000 shutter) ---
  // The concourse's shops, pillars and planters, plus three food stalls along the south wall and
  // tables in the middle (a clear lane runs from the door to the tree planter).

  const courtWall = mat(COLORS.concourseWall);
  wall({
    along: 'x', from: F.minX - T, to: F.maxX, at0: F.minZ - T, at1: F.minZ, height: F.height,
    openings: storeOpenings(LAYOUT.stores, 'south'), // the two recessed stores' fronts
  }, courtWall, { name: 'foodcourt_wall_south' });
  wall({
    along: 'z', from: F.minZ, to: F.maxZ, at0: F.minX - T, at1: F.minX, height: F.height,
    openings: [{ from: SF.minZ, to: SF.maxZ, top: SF.height }],
  }, courtWall, { name: 'foodcourt_wall_west' });
  const serviceCorridorFoodCourtDoor = kit.shutterDoor({
    id: 'serviceCorridorFoodCourt', label: 'Service Corridor / Food Court Shortcut',
    price: economy.doors.serviceCorridorFoodCourt,
    opensZones: ['serviceCorridor', 'foodCourt'], zones,
    doorway: { minX: F.minX - T, maxX: F.minX, ...SF },
  });
  const shortcutZ = (SF.minZ + SF.maxZ) / 2;
  sign('STAFF ONLY', {
    x: F.minX + 0.02, y: 3.25, z: shortcutZ, width: 2.6, height: 0.4, facing: 'x+',
    background: '#3a3f47', color: '#ffd23f',
  });
  sign('EXIT · FOOD COURT', {
    x: F.minX - T - 0.02, y: 3.25, z: shortcutZ, width: 2.6, height: 0.35, facing: 'x-',
    background: '#2d6a4f', color: '#ffffff',
  });
  // (North: the hallway's south wall. East: the Mega Mart's west wall.)

  // The four shops are real walk-in stores (maps/mall/stores.js): their fronts, interiors, attachment counters,
  // clerks and zombie spawns. Two are recessed into the south wall, two are pods against the hallway wall.
  const stores = buildStores({ kit, props, court: F, thickness: T, stores: LAYOUT.stores });

  sign('FOOD COURT  ·  NOW OPEN (KIND OF)', {
    x: F.minX + 0.02, y: 3.2, z: FZ + 1.3, width: 5, height: 0.9, facing: 'x+',
    background: '#2d6a4f', color: '#ffffff',
  });

  // (The two north pillars would stand inside the pod stores, which hold the ceiling up themselves.)
  for (const [px, pz] of [[-13, -3], [13, -3]]) props.pillar(px, FZ + pz, F.height);

  props.bench(-8, FZ + 3.9, -5.6, FZ + 4.5);
  props.bench(5.6, FZ + 3.9, 8, FZ + 4.5);

  props.planter(-1.8, FZ - 2.8, 1.8, FZ - 1.2, { tree: true });
  props.planter(-19.4, FZ - 0.7, -18, FZ + 0.7);
  // Two end planters frame the shortcut, leaving its full width and approaches clear.
  props.planter(18, FM.minZ - 2.0, 19.4, FM.minZ - 0.6);
  props.planter(18, FM.maxZ + 0.6, 19.4, FM.maxZ + 2.0);

  for (const x of [-16, -8, 0, 8, 16]) props.lightPanel(x - 1.2, FZ - 0.6, x + 1.2, FZ + 0.6, F.height);

  // Food stalls along the south wall, between Good Sports and Nuts & Bolts. Each is one solid
  // 1.2m block from the wall to its counter (too tall to climb onto or hide behind).
  const stallWall = { along: 'x', wallAt: F.minZ, facing: 1 };
  props.foodStall({
    ...stallWall, from: -8.4, to: -3.1, name: 'BURGER BARN', menu: 'BURGERS · FRIES · SHAKES',
    colors: { main: 0xd62839, accent: 0x8d1c26, awning: [0xd62839, 0xf1faee], signBackground: '#2b1a12', signText: '#ffd23f' },
    gear: ['grill', 'fryer', 'soda'],
  });
  props.foodStall({
    ...stallWall, from: -2.6, to: 2.6, name: 'WOK THIS WAY', menu: 'NOODLES · RICE · FORTUNES (BAD)',
    colors: { main: 0xe0a526, accent: 0x7a1f1f, awning: [0xd62839, 0xffd23f], signBackground: '#7a1f1f', signText: '#ffd23f' },
    gear: ['wok', 'wok', 'soda'],
  });
  props.foodStall({
    ...stallWall, from: 3.1, to: 8.4, name: 'CORN DOG CORRAL', menu: 'CORN DOGS · LEMONADE · REGRET',
    colors: { main: 0x3a86ff, accent: 0x1d4e89, awning: [0xffd23f, 0x3a86ff], signBackground: '#1d4e89', signText: '#ffd23f' },
    gear: ['fryer', 'fryer', 'soda'],
  });

  // Seating: eight table sets around the tree planter, leaving lanes between them, a clear path from
  // the door to the planter, and room to queue at the stalls.
  [[-9, 1.8], [-9, -1.2], [-5.5, 0.8], [-5.5, -2.3], [9, 1.8], [9, -1.2], [5.5, 0.8], [5.5, -2.3]].forEach(([x, dz], i) => {
    props.tableSet(x, FZ + dz, { stoolColor: i % 2 ? COLORS.stoolAlt : COLORS.stool });
  });
  props.trashCan(-11.2, FZ);
  props.trashCan(11.2, FZ);

  // The ammo cache: the RESTOCK-O-MATIC (mall/restockMachine.js), on the north wall just inside the door, east side:
  // the first thing you see walking in. Clear of the door lane (x -2..2), the east bench and the Byte Me pod.
  const foodCourtAmmo = buildRestockMachine({ kit, center: LAYOUT.restockMachine.x, wallAt: F.maxZ, facing: -1 });

  sign('EXIT  ·  MAIN HALL', {
    x: 0, y: 3.6, z: F.maxZ - 0.02, width: 3, height: 0.5, facing: -1,
    background: '#1d1626', color: '#63e6be',
  });

  // --- Service Corridor (west of the hallway, behind the 1250 shutter) ----------
  // Built from data with the corridor builder: in through the hallway's west wall, a short run west,
  // then south along the Food Court. Its east side IS the hallway's and Food Court's west walls (no
  // wall of its own there). Extend it by adding runs; branch off it with layout.branchStart().

  const service = kit.corridor({
    width: SC.width, height: SC.height, thickness: T,
    start: { x: H.minX - T, z: (SCD.minZ + SCD.maxZ) / 2 },
    startCap: false, // opens onto the shutter's doorway
    endCap: true,
    segments: [
      { dir: 'west', length: SC.width / 2 },
      { dir: 'south', length: SC.length, noWall: ['right'] },
    ],
  }, {
    floor: { base: '#a19d95', grout: '#857f76', variation: 6, seed: 13 },
    wall: mat(COLORS.serviceWall), ceiling: mat(COLORS.serviceCeiling), name: 'service',
  });
  // Dressing along the south run's west wall ('left', walking south). `at` = meters from the turn.
  const westWall = { along: 'z', wallAt: service.pointAt(1, 0, 'left').x, facing: 1 };
  const zAt = (at) => service.pointAt(1, at).z;
  sign('EMPLOYEES MUST WASH HANDS', { x: westWall.wallAt + 0.02, y: 1.7, z: zAt(2.5), width: 1.3, height: 0.3, facing: 'x+', background: '#f1faee', color: '#1d1626' });
  props.boardedVent({ ...westWall, center: zAt(4) });
  props.electricalPanel({ ...westWall, center: zAt(6.5) });
  props.boardedVent({ ...westWall, center: zAt(9) });
  props.lockerBank({ ...westWall, from: zAt(13), to: zAt(11) });
  props.pipeRun({ ...westWall, from: zAt(SC.length), to: service.points[1].z + SC.width / 2, y: SC.height - 0.45 });
  // The dead end: boxes in the corner, a vent in the end wall, a sign.
  const endZ = zAt(SC.length);
  const westX = westWall.wallAt;
  box(westX, 0, endZ, westX + 0.7, 0.7, endZ + 0.6, mat(COLORS.cardboard), { name: 'crate' });
  box(westX + 0.05, 0.7, endZ + 0.05, westX + 0.55, 1.15, endZ + 0.5, mat(0xd2a86a), { name: 'crate' });
  props.boardedVent({ along: 'x', center: service.points[2].x, wallAt: endZ, facing: 1 });
  sign('NO LOITERING (ESPECIALLY THE UNDEAD)', {
    x: service.points[2].x, y: 2.3, z: endZ + 0.02, width: 2.4, height: 0.32, facing: 1,
    background: '#d62839', color: '#ffffff',
  });
  // Fluorescent strips down the middle (the middle one's dead).
  const cx = service.points[1].x;
  props.lightPanel(cx - 0.25, zAt(4), cx + 0.25, zAt(1), SC.height);
  props.lightPanel(cx - 0.25, zAt(9), cx + 0.25, zAt(6), SC.height, { dead: true });
  props.lightPanel(cx - 0.25, zAt(14.5), cx + 0.25, zAt(11.5), SC.height);

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
    openings: [
      { from: MD.minZ, to: MD.maxZ, top: MD.height },
      { from: FM.minZ, to: FM.maxZ, top: FM.height },
    ],
  }, martWall, { name: 'megamart_wall_west' });

  const megaMartDoor = kit.shutterDoor({
    id: 'megaMart',
    label: 'Mega Mart',
    price: economy.doors.megaMart,
    opensZone: 'megaMart',
    zones,
    doorway: { minX: M.minX, maxX: M.minX + T, minZ: MD.minZ, maxZ: MD.maxZ, height: MD.height },
  });

  const foodCourtMegaMartDoor = kit.shutterDoor({
    id: 'foodCourtMegaMart', label: 'Food Court / Mega Mart Shortcut',
    price: economy.doors.foodCourtMegaMart,
    opensZones: ['foodCourt', 'megaMart'], zones,
    doorway: { minX: M.minX, maxX: M.minX + T, ...FM },
  });
  sign('MEGA MART', {
    x: M.minX - 0.02, y: 3.6, z: FZ, width: 3.6, height: 0.7, facing: 'x-',
    background: '#1d4e89', color: '#ffd23f',
  });
  sign('FOOD COURT', {
    x: M.minX + T + 0.04, y: 3.6, z: FZ, width: 3.6, height: 0.7, facing: 'x+', // proud of the 2cm brand stripe
    background: '#2d6a4f', color: '#ffffff',
  }).name = 'sign_foodCourtMegaMart_mart';

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
  MART_FIXTURES.checkoutZs.forEach((z, i) => props.checkout(24.5, z - 0.4, 27.5, z + 0.4, i + 1));

  // Back of the store: three long shelf aisles (gondolas) running north-south. Aisles are 2.5m
  // (the west one 3.2m, meeting the Food Court shortcut), with a 4.5m
  // walkway at the back and a crossing at the front.
  MART_FIXTURES.gondolas.forEach(({ x }) => {
    props.gondola(x - 0.5, -19.5, x + 0.5, -8, { stock: false });
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
  buildMegaMartDetails(kit, M);

  // --- Lighting --------------------------------------------------------------

  // All lights live in the map's group, so unloading the map removes them too.
  group.add(new THREE.HemisphereLight(atmosphere.hemisphere.sky, atmosphere.hemisphere.ground, atmosphere.hemisphere.intensity));

  const sun = new THREE.DirectionalLight(atmosphere.sun.color, atmosphere.sun.intensity);
  sun.position.set(6, 20, 8);
  group.add(sun);

  const lamp = ({ color, intensity, distance }, x, y, z) => {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    group.add(light);
  };
  // Lamps hang well below the ceiling (about 60% of its height) and are dimmer to match: a lamp just
  // under the ceiling lights a small, hard-edged bright disc on it; hung lower it's a soft wide glow.
  for (const x of [-12, 0, 12]) lamp(atmosphere.roomLights.hallway, x, H.height * 0.58, HZ);
  for (const x of [-12, 0, 12]) lamp(atmosphere.roomLights.foodCourt, x, F.height * 0.58, FZ);
  // Start-room warm/cool lamps are built with its details (config/environment.js).
  // Mega Mart's two fixed lamps are built with its details (config/environment.js).
  for (const l of levelTwo.lamps) lamp(atmosphere.roomLights.level2, l.x, l.y, l.z);
  for (const at of [3, 12]) lamp(atmosphere.roomLights.serviceCorridor, service.points[1].x, SC.height * 0.65, service.pointAt(1, at).z);

  // --- Spawn points and wall-buy spots (invisible markers) -------------------

  // Where zombies appear, tagged with the zone that has to be open.
  const spawnPoints = [
    { name: 'spawn_startRoom_ventLeft', zone: 'startRoom', position: new THREE.Vector3(-3.5, 0, 15.4) },
    { name: 'spawn_startRoom_ventRight', zone: 'startRoom', position: new THREE.Vector3(3.5, 0, 15.4) },
    { name: 'spawn_hallway_ventNorthWest', zone: 'hallway', position: new THREE.Vector3(-15, 0, H.maxZ - 0.8) },
    { name: 'spawn_hallway_ventNorthEast', zone: 'hallway', position: new THREE.Vector3(15, 0, H.maxZ - 0.8) },
    { name: 'spawn_hallway_ventSouth', zone: 'hallway', position: new THREE.Vector3(-14, 0, H.minZ + 0.8) },
    ...stores.spawns, // a zombie spawn inside each of the four stores
    ...levelTwo.spawns, // boarded vents on level 2 (their y is the upper floor)
    { name: 'spawn_megaMart_stockroom', zone: 'megaMart', position: new THREE.Vector3(26.5, 0, -23.2) },
    { name: 'spawn_megaMart_receiving', zone: 'megaMart', position: new THREE.Vector3(31.8, 0, -23.2) },
    { name: 'spawn_megaMart_vent', zone: 'megaMart', position: new THREE.Vector3(21.8, 0, -23.2) },
    { name: 'spawn_megaMart_emergencyExit', zone: 'megaMart', position: new THREE.Vector3(33.2, 0, 2.5) },
    // Service Corridor: in front of its two wall vents and the vent in its dead end
    ...[['ventNorth', 4], ['ventSouth', 9]].map(([name, at]) => {
      const p = service.pointAt(1, at, 'left', 0.8);
      return { name: `spawn_serviceCorridor_${name}`, zone: 'serviceCorridor', position: new THREE.Vector3(p.x, 0, p.z) };
    }),
    (() => {
      const p = service.pointAt(1, SC.length - 0.8);
      return { name: 'spawn_serviceCorridor_deadEnd', zone: 'serviceCorridor', position: new THREE.Vector3(p.x, 0, p.z) };
    })(),
  ];
  // Where weapons are bought off the wall (map features of kind 'wallBuy', game/features/wallBuy.js).
  // `normal` points out of the wall; `weapon` is a config/weapons.js id. Prices live in economy.js.
  const wallBuys = [
    // Cheap full-auto pistol in the going-out-of-business store
    { name: 'wallbuy_startRoom', zone: 'startRoom', weapon: 'priceGun', position: new THREE.Vector3(R.maxX - 0.02, 1.5, 10), normal: new THREE.Vector3(-1, 0, 0) },
    // The first real upgrade, on the hallway's south wall (east of the Food Court door): available as
    // soon as the start shutter is open, like it was in the old concourse.
    { name: 'wallbuy_hallway', zone: 'hallway', weapon: 'nailGun', position: new THREE.Vector3(11, 1.5, H.minZ + 0.02), normal: new THREE.Vector3(0, 0, 1) },
    // The Mega Mart toy section. (A wall buy for a gun that doesn't exist in config/weapons.js +
    // economy.wallBuys yet is inert: game/features/wallBuy.js skips it.)
    { name: 'wallbuy_megaMart', zone: 'megaMart', weapon: 'foamDartBlaster', position: new THREE.Vector3(31.5, 1.5, M.maxZ - 0.02), normal: new THREE.Vector3(0, 0, -1) },
    // Reserved the same way: the Service Corridor's west wall near its dead end (between the lockers and the crates).
    (() => {
      const p = service.pointAt(1, 14.2, 'left', 0.02);
      return { name: 'wallbuy_serviceCorridor', zone: 'serviceCorridor', weapon: 'confettiCannon', position: new THREE.Vector3(p.x, 1.5, p.z), normal: new THREE.Vector3(p.normal.x, 0, p.normal.z) };
    })(),
  ];
  kit.markers({ spawnPoints, wallBuys, visible: debug.showMarkers });

  // Player start: middle of the start room, facing the shutter (-Z)
  const playerSpawn = { position: new THREE.Vector3(0, 0, 12), yaw: 0 };

  // The main menu's flyover (ui/titleCamera.js): slow camera glides through the mall, one after another.
  // Each: from -> to (the camera), lookFrom -> lookTo (where it looks). Keep them clear of walls and shutters.
  const titleShots = [
    { from: [16, 2.4, 4.2], to: [6, 2.0, 3.0], lookFrom: [0, 2.0, 1.5], lookTo: [-12, 2.6, 2.0] }, // down the hallway to the escalator
    { from: [-15.5, 3.4, -8.1], to: [-6, 3.0, -8.3], lookFrom: [-4, 1.4, -13.5], lookTo: [8, 1.4, -13.8] }, // Food Court: tables, stalls and stores (south of the pods)
    { from: [3.5, 1.7, 0.4], to: [9.5, 1.8, 0.8], lookFrom: [6.5, 1.9, 6], lookTo: [8, 1.9, 6] }, // the Customer Service booth
    { from: [13.5, 1.9, -10.2], to: [13.5, 1.8, -8.4], lookFrom: [13.2, 1.7, -3.5], lookTo: [13.5, 1.7, -3] }, // a push in toward Byte Me Electronics
    { from: [21.9, 2.2, -21], to: [21.9, 1.9, -10.5], lookFrom: [21.9, 1.6, -5], lookTo: [22.6, 1.6, 2] }, // a Mega Mart aisle
    { from: [3.6, 1.9, 7.4], to: [-2.6, 1.8, 8.2], lookFrom: [-2, 1.2, 14.5], lookTo: [2.5, 1.2, 15] }, // the closed-down start room
  ];

  // Everything (besides doors) the player interacts with, by kind: game/features/ builds each one.
  // New kinds (claw machine, fitting room, hazard switch...) are more entries here.
  const features = [
    ...wallBuys.map((w) => ({ kind: 'wallBuy', ...w })),
    // The RESTOCK-O-MATIC: buy a refill for the gun in your hand (g.pricing 'ammoCache'); its screen shows what it sells.
    { kind: 'ammoCache', name: 'ammocache_foodCourt', zone: 'foodCourt', position: foodCourtAmmo.position, normal: foodCourtAmmo.normal, screen: foodCourtAmmo.screen },
    // Customer Service: upgrade the gun in your hand one Extended Warranty tier (g.pricing 'tier').
    { kind: 'upgradeDesk', name: 'upgradedesk_hallway', zone: deskZone, position: serviceDesk.position, normal: serviceDesk.normal },
    // Store attachment counters: fit that attachment to the gun in your hand (g.pricing 'attachment').
    ...stores.spots.map((s) => ({ kind: 'attachmentCounter', name: `attachment_${s.id}`, zone: s.zone, attachment: s.id, position: s.position, normal: s.normal })),
  ];

  const doors = [startDoor, megaMartDoor, foodCourtDoor, serviceCorridorDoor, foodCourtMegaMartDoor, serviceCorridorFoodCourtDoor, escalatorDoor];
  const dressing = buildMallAtmosphere(kit, LAYOUT, { service, ceilingHole: escalator.hole });

  return {
    id: 'mall',
    group,
    zones,
    doors,
    spawnPoints,
    features,
    playerSpawn,
    titleShots,
    ambience: dressing.emitters,
    // Zombie navigation across floors (zombies/navigation.js): the ground floor and level 2, joined by the escalator.
    navigation: { floors: [0, upperY], links: [escalator.link] },
    // The escalator's barrier (a collider across its foot, removed by the escalatorRepair door) and its walkable surface.
    escalator: { barrier: escalator.barrier, ramp: escalator.ramp },
    // For the debug "upstairs" command (Shift+T): where you arrive on level 2, where you go back down to, and the repair door.
    levelTwo: {
      minY: upperY / 2, // above this you count as upstairs
      arrival: { position: new THREE.Vector3(H.minX + 1.2, upperY, 4.6), yaw: -Math.PI / 2 }, // west lobby, facing east down the walkway
      below: { position: new THREE.Vector3(escalator.foot.x + 1.5, 0, escalator.foot.z), yaw: Math.PI / 2 }, // at the escalator's foot
      repair: escalatorDoor,
    },
    update(dt) {
      for (const door of doors) door.update(dt);
      dressing.update(dt);
    },
    reset() {
      for (const door of doors) door.reset();
      dressing.reset();
    },
    // Unload: colliders out of the shared list, GPU memory freed, group out of the scene.
    dispose() {
      kit.dispose();
      group.removeFromParent();
    },
  };
}
