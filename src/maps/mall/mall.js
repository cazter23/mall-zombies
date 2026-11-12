// =============================================================================
// MALL MAP: start room, main hallway (the hub), Mega Mart, Food Court, Service Corridor
// The layout only: rooms, doors, props, lights and markers, placed with the map
// kit (world/mapKit.js: boxes, walls with doorways, shutter doors, signs, markers)
// and the mall props (./props.js: shop fronts, pillars, benches, planters, light
// panels, store shelves...). Each solid box also becomes an axis-aligned collider
// (THREE.Box3) in the shared `colliders` list. Returns the map interface described
// in maps/index.js.
//
// Area ownership and prices (economy.doors): Start Room is owned initially.
// Buy Hallway 500, Mega Mart 750, Food Court / Service Corridor 1000, or
// HOFFMAN'S / Grand Atrium / Promenade / Cinema 1250 through any accessible entrance.
// areaUnlocks connects all 15 barriers: each opens free when both endpoints are owned.
// Promenade ownership also repairs the hallway escalator when Hallway is owned.
//
// Layout, in meters (+Y is up):
//   - Start room:      x -5..5,   z 6..16, 4m ceiling (doorway in its south wall at z = 6)
//   - Main hallway:    x -20..20, z -2..6, 6m ceiling (8m wide, runs along X)
//   - Food Court:      x -20..20, z -14.3..-2.3, 6m ceiling (the old concourse, moved south;
//                      its door is straight across the hallway from the start room's)
//   - Mega Mart:       x 20..34,  z -24..6, 5m ceiling. Its west wall (x 20..20.3, 6m tall)
//                      is also the east wall of the hallway (with the Mega Mart door) and of
//                      the Food Court (shortcut at z -10.8..-5.8).
//   - Service Corridor: a 3m-wide back-of-house corridor built with the corridor builder
//                      (world/corridor.js): through the hallway's west wall (z 0.5..3.5), then
//                      south 16m along the Food Court's west side (shortcut at z -13.4..-11),
//                      to an end vent at z -14. 3.5m ceiling.
// =============================================================================

import * as THREE from 'three';
import { createMapKit } from '../../world/mapKit.js';
import { createDoor } from '../../world/door.js';
import { createAreaUnlocks } from '../../world/areaUnlocks.js';
import { markCollidersChanged } from '../../world/collision.js';
import { createMallProps } from './props.js';
import { COLORS } from './palette.js';
import { debug } from '../../config/debug.js';
import { feel } from '../../config/feel.js';
import { economy } from '../../config/economy.js';
import { lostFound } from '../../config/lostFound.js';
import { returnQuest } from '../../config/returnQuest.js';
import { fittingRooms, wardrobeItems, wardrobeAnchor } from '../../config/wardrobe.js';
import { buildWardrobeDisplay } from './wardrobeDisplays.js';
import { foodCourtShowpieces } from './wardrobeShowpieces/foodCourt.js';
import { groundFloorShowpieces } from './wardrobeShowpieces/groundFloor.js';
import { upperFloorShowpieces } from './wardrobeShowpieces/upperFloor.js';
import { upgrades } from '../../config/upgrades.js';
import { shutters } from '../../config/shutters.js';
import { hazards } from '../../config/hazards.js';
import { buildStores, storeOpenings } from './stores.js';
import { buildStartRoomDetails } from './startRoomDetails.js';
import { buildMegaMartDetails, MART_FIXTURES } from './megaMartDetails.js';
import { buildMallAtmosphere } from './atmosphere.js';
import { buildRestockMachine } from './restockMachine.js';
import { buildClawCabinet } from './clawCabinet.js';
import { buildPrizeCounter } from './prizeCounter.js';
import { buildKioskCart } from './kioskCart.js';
import { kiosk } from '../../config/kiosk.js';
import { clawMachine } from '../../config/clawMachine.js';
import { buildLevelTwo } from './levelTwo.js';
import { buildAtrium } from './atrium.js';
import { buildHallwayLook } from './hallwayLook.js';
import { createLookKit } from './lookKit.js';
import { buildConcourse } from './concourse.js';
import { concourse } from '../../config/concourse.js';
import { buildSetPieces } from './setPieces.js';
import { buildFoodCourtLook, buildMegaMartLook, buildServiceCorridorLook, buildStartRoomLook, buildLevelTwoLook, buildAtriumLook, buildDepartmentStoreLook } from './zoneLooks.js';
import { look } from '../../config/look.js';
import { atmosphere } from '../../config/environment.js';
import { atriumDetails } from '../../config/atrium.js';
import { promenade } from '../../config/promenade.js';
import { buildPromenadeDetails } from './promenadeDetails.js';
import { buildWorkshopDetails } from './workshopDetails.js';
import { buildDepartmentStore } from './departmentStore.js';
import { buildSeamDetails } from './seamDetails.js';
import { departmentStore } from '../../config/departmentStore.js';
import { cinema } from '../../config/cinema.js';
import { buildCinema } from './cinema.js';
import { buildCinemaDetails } from './cinemaDetails.js';
import { cinemaStairs } from '../../config/cinemaStairs.js';
import { buildCinemaStairs, dressCinemaStairs } from './cinemaStairs.js';
import { buildCinemaServiceDetails } from './cinemaServiceDetails.js';
import { closingTime } from '../../config/closingTime.js';
import { parkingLot } from '../../config/parkingLot.js';
import { buildParkingLot } from './parkingLot.js';
import { buildMallExterior } from './mallExterior.js';
import { buildParkingDetails } from './parkingDetails.js';
import { parkingDetails } from '../../config/parkingDetails.js';

const wardrobeShowpieces = { ...foodCourtShowpieces, ...groundFloorShowpieces, ...upperFloorShowpieces };

export const LAYOUT = {
  parkingLot,
  cinema,
  cinemaStairs,
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
  // Level 2 (maps/mall/levelTwo.js): the Sunset Promenade, reached by the repaired escalator. config/promenade.js independently
  // owns its bounds/floor sections, shoe-store loop and reserved connections. shops = remaining north-wall frontages, seating = the planter ring + wall benches, vents =
  // boarded vents that are zombie spawns (wall + position along it), lamps = where its point lights hang (x, z).
  level2: {
    ...promenade,
    height: 3.6,
    shops: [
      { id: 'shoePer', from: -10, to: -4, color: 0x7a5c8a, text: 'SHOE-PER SALE', signBackground: '#2b2233', signColor: '#c9b6e4', gate: 0.7, note: 'SPACE AVAILABLE · INQUIRE WITHIN' },
      { id: 'workshop', from: promenade.workshop.from, to: promenade.workshop.to },
      { id: 'pretzel', from: 4, to: 10, color: 0xd9822b, text: 'PRETZEL PALACE', signBackground: '#5c2e12', signColor: '#ffd9a8', gate: 2.0 },
    ],
    // Balcony voids: open holes in level 2's floor (= the hallway ceiling), railed, looking down into the hallway. The 4m strip
    // between them is a bridge in front of the start room / Food Court doors.
    voids: [
      { minX: -9.5, maxX: -1.5, minZ: 0.5, maxZ: 3.5 },
      { minX: 2.5, maxX: 10, minZ: 0.5, maxZ: 3.5 },
    ],
    vents: [
      { id: 'southWest', wall: 'south', at: -13 },
      { id: 'southMiddle', wall: 'south', at: 8 },
      { id: 'east', wall: 'east', at: 4.2 },
      { id: 'northEast', wall: 'north', at: 16 },
    ],
    lamps: [{ x: -8, z: 2 }, { x: 10, z: 2 }],
    atriumLink: { from: 11.5, to: 14.5, top: 2.7 }, // the opening in its north wall into the Grand Atrium's ring (= atrium.link)
  },
  // Customer Service desk (Extended Warranty tiers): on the hallway's north wall between the start doorway
  // and the elevator. Move it by changing this one entry (the prop, its collider and its buy spot follow).
  serviceDesk: { along: 'x', center: 7, wallAt: 6, facing: -1, meleeOffset: 1.25, zone: 'hallway' }, // meleeOffset: the box cutter window's spot along the counter
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
      // Its east side wall faces the seating: an ad board and giant alphabet blocks instead of bare yellow (stores.js).
      exterior: { side: 'east', sign: 'PLAY TIME! · TOYS · GAMES · PLUSH', blocks: [['A', 0xe63946, -3.25, 0], ['B', 0x3a86ff, -3.25, 1], ['C', 0xffd23f, -3.8, 0]] },
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
  // THE GRAND ATRIUM (maps/mall/atrium.js): north of the hallway's east half, 24 x 24 m, two storeys. gate = its doorway in the
  // hallway's north wall; link = the shutter from its upper ring into the level 2 Promenade (level2.atriumLink is the same gap).
  atrium: {
    rect: { minX: 8, maxX: 32, minZ: 6.6, maxZ: 30.6 },
    ringDepth: 3.5, // the upper ring (and the arcade under it) round the open court
    upperHeight: 3.6, // the ring's floor to the roof
    gate: { from: 13, to: 18, height: 3 },
    link: { from: 11.5, to: 14.5, height: 2.7 },
    martLink: { from: 21.5, to: 24.5, height: 3 }, // the Mega Mart shortcut: through the Mart's north wall, west of the checkouts
    escalator: { bottomX: 16.5, minZ: 23.6, maxZ: 25.6 }, // rises east from the court to the ring's east side
    fountain: { half: 2.6 }, // a square basin in the middle of the court
    kiosks: [
      { x: 12.6, z: 14.8, name: 'CELL-OUT', color: 0x2ec4b6, signColor: '#7dffe0' },
      { x: 27.4, z: 14.5, name: 'SHADE SHACK', color: 0xff8a3d, signColor: '#ffd23f' },
    ],
    planters: [[13.4, 11.8], [26.6, 11.8], [13.2, 21], [26.8, 21]],
    benches: [[15.6, 17.6, 16.1, 19.6], [23.9, 17.6, 24.4, 19.6], [19, 13.6, 21, 14.1]],
    vents: [
      { id: 'northWest', wall: 'north', at: 13 },
      { id: 'northEast', wall: 'north', at: 27 },
      { id: 'west', wall: 'west', at: 16 },
      { id: 'east', wall: 'east', at: 12 },
      { id: 'ringNorth', wall: 'north', at: 20, upper: true },
    ],
  },
  restockMachine: { x: 4.95 }, // the RESTOCK-O-MATIC on the Food Court's north wall (its x; the front faces south)
  // HOFFMAN'S department store (maps/mall/departmentStore.js): north of the hallway's west half, gate in the hallway's north wall.
  departmentStore,
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
    upstairs: { label: 'Sunset Promenade', open: false }, // unlocked through any Promenade entrance
    cinema: { label: 'Sunset Cinema', open: false },
    atrium: { label: 'Grand Atrium', open: false },
    departmentStore: { label: "Hoffman's", open: false },
    parkingLot: { label: 'Customer Parking', open: false },
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

  tiledFloor(H.minX, H.minZ, H.maxX, H.maxZ, look.hallway.floor); // (the reference room's black terrazzo: config/look.js)
  // Continue beneath both shared walls: a floor gap under the west shortcut can split the nav
  // grid when other loaded geometry (the debug range, future areas) shifts its cell centres.
  tiledFloor(F.minX - T, F.minZ, F.maxX, H.minZ, look.foodCourt.floor); // (config/look.js)
  tiledFloor(R.minX, R.minZ, R.maxX, R.maxZ, { base: '#d9cdb7', grout: '#a99a82', variation: 18, seed: 11 });

  // (The hallway's ceiling is built with the escalator below: it has a hole for it.)
  box(F.minX - T, F.height, F.minZ - T, F.maxX + T, F.height + 0.3, F.maxZ, mat(COLORS.ceiling), { name: 'ceiling' });
  box(R.minX - T, R.height, R.minZ + T, R.maxX + T, R.height + 0.3, R.maxZ + T, mat(COLORS.ceiling), { name: 'ceiling' });

  // --- Main hallway walls ------------------------------------------------------

  const hallWall = mat(look.hallway.wall);
  // North wall: open where the start room's storefront is (built next, in its own color).
  wall({
    along: 'x', from: H.minX - T, to: H.maxX + T, at0: H.maxZ, at1: H.maxZ + T, height: H.height,
    openings: [
      { from: LAYOUT.departmentStore.gate.from, to: LAYOUT.departmentStore.gate.to, top: LAYOUT.departmentStore.gate.height },
      { from: R.minX, to: R.maxX }, { from: LAYOUT.atrium.gate.from, to: LAYOUT.atrium.gate.to, top: LAYOUT.atrium.gate.height },
    ],
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

  // (Its GOING OUT OF BUSINESS sign is neon now: maps/mall/hallwayLook.js.)

  // --- Start room walls ------------------------------------------------------

  const roomWall = mat(look.startRoom.wall);
  wall({
    along: 'z', from: H.maxZ + T, to: R.maxZ + T, at0: R.minX - T, at1: R.minX, height: R.height,
    openings: [{ from: LAYOUT.departmentStore.startRoomLink.from, to: LAYOUT.departmentStore.startRoomLink.to, top: LAYOUT.departmentStore.startRoomLink.height }], // (HOFFMAN'S side door)
  }, roomWall, { name: 'startroom_wall_west' });
  wall({ along: 'z', from: H.maxZ + T, to: R.maxZ + T, at0: R.maxX, at1: R.maxX + T, height: R.height }, roomWall, { name: 'startroom_wall_east' });
  wall({ along: 'x', from: R.minX - T, to: R.maxX + T, at0: R.maxZ, at1: R.maxZ + T, height: R.height }, roomWall, { name: 'startroom_wall_back' });

  // --- Doors off the start room and the hallway -------------------------------

  const startDoor = kit.shutterDoor({
    id: 'startShutter',
    label: 'Security Shutter',
    price: economy.doors.hallway,
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
  // HOFFMAN'S: the department store north of the hallway's west end (maps/mall/departmentStore.js builds the room).
  const DS = LAYOUT.departmentStore;
  const departmentStoreRoom = buildDepartmentStore({ kit, props, layout: DS, thickness: T });
  const departmentStoreDoor = kit.shutterDoor({
    id: 'departmentStore', label: "Hoffman's", price: economy.doors.departmentStore, opensZone: 'departmentStore', zones,
    doorway: { minX: DS.gate.from, maxX: DS.gate.to, minZ: H.maxZ, maxZ: H.maxZ + T, height: DS.gate.height },
  });
  // Its side door: a shortcut through the start room's west wall (the start room is always open, so it opens just the store;
  // it is the only second way out of the start room, so it costs as much as the gate).
  const DSL = DS.startRoomLink;
  const departmentStoreStartRoomDoor = kit.shutterDoor({
    id: 'departmentStoreStartRoom', label: "Hoffman's Side Door", price: economy.doors.departmentStore,
    opensZone: 'departmentStore', zones,
    doorway: { minX: R.minX - T, maxX: R.minX, minZ: DSL.from, maxZ: DSL.to, height: DSL.height },
  });
  tiledFloor(R.minX - T, DSL.from, R.minX, DSL.to, look.hallway.floor); // (under the start room's wall)

  // --- Main hallway: escalator, elevator, ceiling ------------------------------

  // The escalator up to level 2 (sealed), the ceiling with a hole where it passes through, and the
  // boarded-up landing you can see up there.
  const E = LAYOUT.escalator;
  const upperY = H.height + 0.3; // level 2 floor = top of the hallway ceiling
  const escalator = props.escalator({
    ...E, upperY, ceilingY: H.height, cladding: COLORS.escalatorCladding,
    skirtSign: { text: look.hallway.satire.escalator[0], subtext: look.hallway.satire.escalator[1], width: 2.4, height: 0.8,
      background: look.hallway.backing, color: '#ffd6ec' },
  });
  const ceilingHoles = [escalator.hole, ...LAYOUT.level2.voids]; // the escalator well + the balcony voids
  kit.slab({ minX: H.minX - T, maxX: H.maxX + T, minZ: H.minZ - T, maxZ: H.maxZ + T }, H.height, upperY, mat(look.hallway.ceiling), {
    holes: ceilingHoles, name: 'ceiling',
  });

  // Owning Hallway and Promenade removes both landing barriers, through any purchase route.
  const escalatorGate = {
    collider: escalator.barrier,
    open() {
      for (const barrier of escalator.barriers) {
        const i = colliders.indexOf(barrier);
        if (i !== -1) {
          colliders.splice(i, 1);
          markCollidersChanged(colliders);
        }
      }
      for (const part of escalator.barrierParts) part.visible = false;
    },
    close() {
      for (const barrier of escalator.barriers) {
        if (!colliders.includes(barrier)) {
          colliders.push(barrier);
          markCollidersChanged(colliders);
        }
      }
      for (const part of escalator.barrierParts) part.visible = true;
    },
    update() {},
  };
  const escalatorDoor = createDoor({
    id: 'escalatorRepair', label: 'Escalator', verb: 'repair', price: economy.doors.upstairs,
    opensZone: 'upstairs', zones, barrier: escalatorGate,
    position: new THREE.Vector3(escalator.foot.x, 1.1, escalator.foot.z),
  });
  // Level 2 itself, on top of the slab: walkway, shop fronts, seating, railings round the escalator well, boarded vents.
  const levelTwo = buildLevelTwo({
    kit, props, floorY: upperY, supportRects: [
      { minX: H.minX - T, maxX: H.maxX + T, minZ: H.minZ - T, maxZ: H.maxZ + T },
      { minX: F.minX - T, maxX: F.maxX + T, minZ: F.minZ - T, maxZ: F.maxZ },
    ],
    hole: escalator.hole, layout: LAYOUT.level2,
  });
  const cinemaWing = buildCinema({ kit, layout: LAYOUT.cinema, floorY: upperY, promenade: LAYOUT.level2,
    zones, price: economy.doors.cinema });

  // The Grand Atrium north of the hallway (maps/mall/atrium.js), its gate off the hallway, and the shutter between its upper
  // ring and the level 2 Promenade (a shortcut: it opens both zones, like the ground-floor shortcuts).
  const AT = LAYOUT.atrium;
  const atrium = buildAtrium({ kit, props, layout: AT, upperY });
  const atriumDoor = kit.shutterDoor({
    id: 'atrium', label: 'Grand Atrium', price: economy.doors.atrium, opensZone: 'atrium', zones,
    doorway: { minX: AT.gate.from, maxX: AT.gate.to, minZ: H.maxZ, maxZ: AT.rect.minZ, height: AT.gate.height },
  });
  const atriumPromenadeDoor = kit.shutterDoor({
    id: 'atriumPromenade', label: 'Promenade', price: economy.doors.upstairs, opensZones: ['atrium', 'upstairs'], zones,
    doorway: { minX: AT.link.from, maxX: AT.link.to, minZ: H.maxZ, maxZ: AT.rect.minZ, minY: upperY, height: AT.link.height },
  });
  // The Mega Mart shortcut: through the Mart's north wall into the atrium's arcade (opens both zones, like the other shortcuts).
  const atriumMegaMartDoor = kit.shutterDoor({
    id: 'atriumMegaMart', label: 'Grand Atrium', price: economy.doors.atrium, opensZones: ['atrium', 'megaMart'], zones,
    doorway: { minX: AT.martLink.from, maxX: AT.martLink.to, minZ: LAYOUT.megaMart.maxZ, maxZ: AT.rect.minZ, height: AT.martLink.height },
  });
  tiledFloor(AT.martLink.from, LAYOUT.megaMart.maxZ, AT.martLink.to, AT.rect.minZ - T, { base: '#e6e8e6', grout: '#c4c9c6', variation: 8, seed: 22 }); // (under the Mart's wall)
  sign('GRAND ATRIUM', { // (Mart side, proud of the brand stripe)
    x: (AT.martLink.from + AT.martLink.to) / 2, y: 3.95, z: LAYOUT.megaMart.maxZ - 0.04, width: 3.2, height: 0.6, facing: -1,
    background: '#6b3f5e', color: '#ffd9a8',
  });
  sign('MEGA MART', {
    x: (AT.martLink.from + AT.martLink.to) / 2, y: 3.6, z: AT.rect.minZ + 0.02, width: 3.2, height: 0.6, facing: 1,
    style: 'martBrand',
  });
  // (The hallway side's GRAND ATRIUM sign is neon: maps/mall/hallwayLook.js.)

  // Elevator doors in the north wall (sealed).
  props.elevatorDoors({ along: 'x', center: LAYOUT.elevator.centerX, wallAt: H.maxZ, facing: -1 });

  // Customer Service desk (gun tiers; a map feature of kind 'upgradeDesk', below).
  const { zone: deskZone, ...deskSpot } = LAYOUT.serviceDesk;
  const serviceDesk = props.serviceDesk({ ...deskSpot, tierColors: upgrades.tiers.map((t) => t.color) });
  const safe = closingTime.nightSafe;
  const safeWallX = deskSpot.center + safe.mountOffset;
  const safeZ = deskSpot.wallAt - safe.insetFromHallWall;
  for (const { name, min, max, color } of safe.parts) {
    kit.box(safeWallX + min[0], min[1], safeZ + min[2], safeWallX + max[0], max[1], safeZ + max[2],
      kit.mat(color), { name, collide: false });
  }
  const { text, offset, ...safeSign } = safe.sign;
  kit.sign(text, { ...safeSign, x: safeWallX + offset, z: safeZ, facing: 'x+' }).name = 'night_safe_sign';

  // Returns Desk on the hallway wall east of Customer Service, clear of the safe, wardrobe and service windows.
  const returns = closingTime.returnsDesk;
  const returnsX = deskSpot.center + returns.offsetFromBooth;
  const returnsWallZ = deskSpot.wallAt;
  for (const { name, min, max, color } of returns.parts) {
    kit.box(returnsX + min[2], min[1], returnsWallZ + min[0], returnsX + max[2], max[1], returnsWallZ + max[0],
      kit.mat(color), { name, collide: false });
  }
  const { text: returnsText, offset: returnsOffset, ...returnsSign } = returns.sign;
  kit.sign(returnsText, { ...returnsSign, x: returnsX, z: returnsWallZ - returnsOffset, facing: -1 }).name = 'returns_desk_sign';

  // --- Main hallway dressing ---------------------------------------------------

  // (The hallway's FOOD COURT / MEGA MART / STAFF ONLY signs are neon: maps/mall/hallwayLook.js.)

  // Planters framing the Food Court door
  props.planter(FD.minX - 2.4, H.minZ + 0.3, FD.minX - 1.0, H.minZ + 1.5);
  props.planter(FD.maxX + 1.0, H.minZ + 0.3, FD.maxX + 2.4, H.minZ + 1.5);

  // Boarded vents where zombies get into the hallway
  props.boardedVent({ along: 'x', center: DS.hallwayVentX, wallAt: H.maxZ, facing: -1 }); // (moved from x -15 for HOFFMAN'S gate)
  props.boardedVent({ along: 'x', center: 16, wallAt: H.minZ, facing: 1 }); // (south wall: the north one gave way to the atrium gate)
  props.boardedVent({ along: 'x', center: -14, wallAt: H.minZ, facing: 1 });

  // Ceiling lights (the west one is short: the escalator's ceiling hole is just east of it). Over the balcony voids they move
  // to the solid strips either side; the bridge and the east end keep a centre panel.
  const hallPanel = { tint: look.hallway.panel, glow: look.hallway.panelGlow }; // (dim violet: the reference room's mood)
  for (const x of [0, 16]) props.lightPanel(x - 1.2, HZ - 0.6, x + 1.2, HZ + 0.6, H.height, { ...hallPanel, dead: x === 16 });
  for (const x of [-5.5, 6.25]) {
    props.lightPanel(x - 1.2, H.minZ + 0.6, x + 1.2, H.minZ + 1.2, H.height, hallPanel);
    props.lightPanel(x - 1.2, H.maxZ - 1.9, x + 1.2, H.maxZ - 1.3, H.height, hallPanel);
  }
  props.lightPanel(-19.6, HZ - 0.6, -18.0, HZ + 0.6, H.height, hallPanel);

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

  const courtWall = mat(look.foodCourt.wall);
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
    price: economy.doors.serviceCorridor,
    opensZones: ['serviceCorridor', 'foodCourt'], zones,
    doorway: { minX: F.minX - T, maxX: F.minX, ...SF },
  });
  const shortcutZ = (SF.minZ + SF.maxZ) / 2;
  // These signs share the shallow headroom with the roller cassette: mount them on rigid plaques in front of it.
  const shutterSignOffset = shutters.track.signOffset;
  box(F.minX + .03, 3.05, shortcutZ - 1.3, F.minX + shutterSignOffset - .01, 3.45, shortcutZ + 1.3,
    mat(0x3a3f47), { collide: false, name: 'staff_shortcut_sign_mount' });
  sign('STAFF ONLY', {
    x: F.minX + shutterSignOffset, y: 3.25, z: shortcutZ, width: 2.6, height: 0.4, facing: 'x+',
    background: '#3a3f47', color: '#ffd23f',
  }).name = 'sign_staff_shortcut';
  box(F.minX - T - shutterSignOffset + .01, 3.075, shortcutZ - 1.3, F.minX - T - .03, 3.425, shortcutZ + 1.3,
    mat(0x2d6a4f), { collide: false, name: 'foodcourt_exit_sign_mount' });
  sign('EXIT · FOOD COURT', {
    x: F.minX - T - shutterSignOffset, y: 3.25, z: shortcutZ, width: 2.6, height: 0.35, facing: 'x-',
    background: '#2d6a4f', color: '#ffffff',
  }).name = 'sign_foodcourt_exit';
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

  props.planter(-1.8, FZ - 2.8, 1.8, FZ - 1.2, { hedge: true }); // (low: a tree here hid FRESH MEAT DAILY and WOK THIS WAY)
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
    gear: ['grill', 'fryer', 'shake'], theme: 'barn',
  });
  props.foodStall({
    ...stallWall, from: -2.6, to: 2.6, name: 'WOK THIS WAY', menu: 'NOODLES · RICE · FORTUNES (BAD)',
    colors: { main: 0xe0a526, accent: 0x7a1f1f, awning: [0xd62839, 0xffd23f], signBackground: '#7a1f1f', signText: '#ffd23f' },
    gear: ['wok', 'wok', 'soda'], theme: 'wok',
  });
  props.foodStall({
    ...stallWall, from: 3.1, to: 8.4, name: 'CORN DOG CORRAL', menu: 'CORN DOGS · LEMONADE · REGRET',
    colors: { main: 0x3a86ff, accent: 0x1d4e89, awning: [0xffd23f, 0x3a86ff], signBackground: '#1d4e89', signText: '#ffd23f' },
    gear: ['fryer', 'fryer', 'soda'], theme: 'cornDog',
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
  const atriumAmmo = buildRestockMachine({ kit, center: atriumDetails.restockMachine.x,
    wallAt: AT.rect.maxZ - atriumDetails.restockMachine.wallInset, facing: -1 });
  const cinemaAmmo = buildRestockMachine({ kit, center: LAYOUT.cinema.restockMachine.x,
    wallAt: LAYOUT.cinema.lobby.maxZ - LAYOUT.cinema.restockMachine.wallInset, facing: -1, floorY: upperY });

  // GRAB-A-GUN (game/features/clawMachine.js): its cabinets (mall/clawCabinet.js), one per site in config/clawMachine.js.
  const clawSites = clawMachine.sites.map((s) => ({ id: s.id, zone: s.zone, cabinet: buildClawCabinet({ kit, back: s.back, faces: s.faces, floorY: s.floorY }) }));
  // Its Prize Counter (game/features/prizeCounter.js): one fixed booth (mall/prizeCounter.js) where prize tickets buy small things.
  const counterSite = clawMachine.prizeCounter.site;
  const prizeBooth = buildPrizeCounter({ kit, back: counterSite.back, faces: counterSite.faces, floorY: counterSite.floorY });
  // Kiosk Kevin (game/features/kiosk.js): a cart at every site in config/kiosk.js (mall/kioskCart.js), one live at a time.
  const kioskSites = kiosk.sites.map((s) => ({ id: s.id, zone: s.zone, where: s.where, floorY: s.floorY, cart: buildKioskCart(kit, s) }));

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
      { dir: 'west', length: SC.width / 2, openings: [{ side: 'left', at: LAYOUT.cinemaStairs.serviceDoor.runAt,
        width: LAYOUT.cinemaStairs.serviceDoor.to - LAYOUT.cinemaStairs.serviceDoor.from, top: LAYOUT.cinemaStairs.serviceDoor.top }] },
      { dir: 'south', length: SC.length, noWall: ['right'] },
    ],
  }, {
    floor: { base: '#a19d95', grout: '#857f76', variation: 6, seed: 13 },
    wall: mat(look.serviceCorridor.wall), ceiling: mat(COLORS.serviceCeiling), name: 'service',
  });
  const cinemaConnection = buildCinemaStairs({ kit, layout: LAYOUT.cinemaStairs, cinema: LAYOUT.cinema,
    floorY: upperY, zones, price: economy.doors.cinema });
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

  tiledFloor(M.minX, M.minZ, M.maxX, M.maxZ, look.megaMart.floor); // (config/look.js)
  box(M.minX + T, M.height, M.minZ - T, M.maxX + T, M.height + 0.3, M.maxZ + T, mat(COLORS.ceiling), { name: 'ceiling' });

  const martWall = mat(look.megaMart.wall);
  const ML = LAYOUT.atrium.martLink;
  wall({
    along: 'x', from: M.minX + T, to: M.maxX, at0: M.maxZ, at1: M.maxZ + T, height: M.height,
    openings: [{ from: ML.from, to: ML.to, top: ML.height }],
  }, martWall, { name: 'megamart_wall_north' });
  wall({ along: 'z', from: M.minZ - T, to: M.maxZ + T, at0: M.maxX, at1: M.maxX + T, height: M.height,
    openings: [{ from: parkingLot.gate.from, to: parkingLot.gate.to, top: parkingLot.gate.height }],
  }, martWall, { name: 'megamart_wall_east' });
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
    price: economy.doors.megaMart,
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

  // Mega Mart's navy and orange stripe, above door height.
  const martInnerWalls = [
    { along: 'x', from: M.minX + T, to: M.maxX, wallAt: M.maxZ, facing: -1 }, // north
    { along: 'z', from: M.minZ, to: M.maxZ, wallAt: M.maxX, facing: -1 }, // east
    { along: 'x', from: M.minX + T, to: M.maxX, wallAt: M.minZ, facing: 1 }, // south
    { along: 'z', from: M.minZ, to: M.maxZ, wallAt: M.minX + T, facing: 1 }, // west
  ];
  for (const w of martInnerWalls) {
    props.wallStripe({ ...w, y0: 3.3, y1: 3.6, color: look.megaMart.wainscot });
    props.wallStripe({ ...w, y0: 3.6, y1: 3.66, color: look.megaMart.band });
  }
  sign('THANK YOU FOR SHOPPING AT MEGA MART', {
    x: 28.25, y: 2.8, z: M.maxZ - 0.04, width: 6.5, height: 0.5, facing: -1,
    style: 'martBrand',
  }).name = 'mart_checkout_thanks';

  // Front of the store: four checkout lanes (vaultable counters) facing the entrance. You walk in
  // at z -1..5 and the lanes are 2m wide; the ends stay open, so you can run round the row.
  MART_FIXTURES.checkoutZs.forEach((z, i) => props.checkout(24.5, z - 0.4, 27.5, z + 0.4, i + 1, { drawerOpen: concourse.stories.registerDrawer && i === 1 }));

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
    [21.9, 'OUTDOOR'],
    [25.75, 'SNACKS'],
    [29.25, 'ALL HOLIDAYS'],
    [32.75, 'HOUSEWARES'],
  ];
  for (const [i, [x, department]] of aisles.entries()) {
    for (const facing of [1, -1]) {
      sign(`AISLE 0${i + 1}`, {
        x, y: 3.4, z: -7.6 + facing * 0.01, width: 2.2, height: .62, facing,
        style: 'martBrand', subtext: department,
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

  // The former painted emergency exit now opens into customer parking.
  const parking = buildParkingLot(kit, { zones, mallWallX: M.maxX, wallThickness: T });
  buildMallExterior(kit, LAYOUT);
  props.boardedVent({ along: 'z', center: -2, wallAt: M.maxX, facing: -1 });
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
  const skyLight = new THREE.HemisphereLight(atmosphere.hemisphere.sky, atmosphere.hemisphere.ground, atmosphere.hemisphere.intensity);
  group.add(skyLight);

  // The sun goes down over a run (config/look.js dusk; the horror director calls this with 0..1 each round): the sky light,
  // the Atrium skylight and sun shafts, and the parking sky go from golden hour to a purple night. Colours only.
  const DUSK = look.dusk;
  const day = {
    sky: new THREE.Color(atmosphere.hemisphere.sky), skylight: atrium.skylight.color.clone(), skylightGlow: atrium.skylight.emissive.clone(),
    skylightIntensity: atrium.skylight.emissiveIntensity,
  };
  const night = { sky: new THREE.Color(DUSK.hemisphere.sky), skylight: new THREE.Color(DUSK.skylight.color), skylightGlow: new THREE.Color(DUSK.skylight.emissive),
    parkingSky: new THREE.Color(DUSK.parkingSky) };
  const white = new THREE.Color(0xffffff);
  function setDusk(t) {
    const k = Math.min(1, Math.max(0, t));
    skyLight.color.copy(day.sky).lerp(night.sky, k);
    skyLight.intensity = atmosphere.hemisphere.intensity + (DUSK.hemisphere.intensity - atmosphere.hemisphere.intensity) * k;
    atrium.skylight.color.copy(day.skylight).lerp(night.skylight, k);
    atrium.skylight.emissive.copy(day.skylightGlow).lerp(night.skylightGlow, k);
    atrium.skylight.emissiveIntensity = day.skylightIntensity + (DUSK.skylight.emissiveIntensity - day.skylightIntensity) * k;
    atrium.shafts.material.opacity = atrium.shafts.opacity + (DUSK.shafts - atrium.shafts.opacity) * k;
    parking.sky.material.color.copy(white).lerp(night.parkingSky, k);
  }

  const sun = new THREE.DirectionalLight(atmosphere.sun.color, atmosphere.sun.intensity);
  sun.position.set(6, 20, 8);
  group.add(sun);

  const lamps = []; // (the horror layer lets some of these die: game/features/horror.js)
  const lamp = ({ color, intensity, distance }, x, y, z) => {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    group.add(light);
    lamps.push(light);
    return light;
  };
  // Lamps hang well below the ceiling (about 60% of its height) and are dimmer to match: a lamp just
  // under the ceiling lights a small, hard-edged bright disc on it; hung lower it's a soft wide glow.
  for (const x of [-12, 0, 12]) lamp(look.hallway.lamp, x, H.height * 0.58, HZ); // (the reference room's violet: config/look.js)
  for (const x of [-12, 0, 12]) lamp(atmosphere.roomLights.foodCourt, x, F.height * 0.58, FZ);
  // Start-room warm/cool lamps are built with its details (config/environment.js).
  // Mega Mart's two fixed lamps are built with its details (config/environment.js).
  for (const l of levelTwo.lamps) lamp(atmosphere.roomLights.level2, l.x, l.y, l.z);
  const workLight = levelTwo.workshop.light;
  lamp(workLight, workLight.x, workLight.y, workLight.z);
  levelTwo.workshop.stations.lamps = levelTwo.workshop.lamps.map(l => lamp(l, l.x, l.y, l.z)); // (ritual mode recolours these two)
  for (const l of cinemaWing.lamps) lamp(l, l.x, l.y, l.z);
  for (const l of atrium.lamps) lamp(atmosphere.roomLights.atrium, l.x, l.y, l.z);
  for (const at of [3, 12]) lamp(atmosphere.roomLights.serviceCorridor, service.points[1].x, SC.height * 0.65, service.pointAt(1, at).z);
  for (const l of departmentStoreRoom.lamps) lamp(DS.lamp, l.x, l.y, l.z);
  lamps.push(...parking.lamps);

  // --- Spawn points and wall-buy spots (invisible markers) -------------------

  // Where zombies appear, tagged with the zone that has to be open.
  const spawnPoints = [
    { name: 'spawn_startRoom_ventLeft', zone: 'startRoom', position: new THREE.Vector3(-3.5, 0, 15.4) },
    { name: 'spawn_startRoom_ventRight', zone: 'startRoom', position: new THREE.Vector3(3.5, 0, 15.4) },
    { name: 'spawn_hallway_ventNorthWest', zone: 'hallway', position: new THREE.Vector3(DS.hallwayVentX, 0, H.maxZ - 0.8) },
    { name: 'spawn_hallway_ventSouthEast', zone: 'hallway', position: new THREE.Vector3(16, 0, H.minZ + 0.8) },
    ...atrium.spawns, // the Grand Atrium's vents (one on its upper ring)
    { name: 'spawn_hallway_ventSouth', zone: 'hallway', position: new THREE.Vector3(-14, 0, H.minZ + 0.8) },
    ...stores.spawns, // a zombie spawn inside each of the four stores
    ...levelTwo.spawns, // boarded vents on level 2 (their y is the upper floor)
    ...departmentStoreRoom.spawns, // HOFFMAN'S: its stockroom door and west vent
    ...cinemaWing.spawns,
    { name: 'spawn_megaMart_stockroom', zone: 'megaMart', position: new THREE.Vector3(26.5, 0, -23.2) },
    { name: 'spawn_megaMart_receiving', zone: 'megaMart', position: new THREE.Vector3(31.8, 0, -23.2) },
    { name: 'spawn_megaMart_vent', zone: 'megaMart', position: new THREE.Vector3(21.8, 0, -23.2) },
    { name: 'spawn_megaMart_eastWall', zone: 'megaMart', position: new THREE.Vector3(33.2, 0, -2) },
    ...parking.spawns,
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
    // Mid/late guns in the Atrium, Cinema and department-store branches.
    // Grand Atrium: the west arcade wall, between the "SECOND SKIN" and "COMING SOON" shopfronts, 5.5m from the west vent.
    { name: 'wallbuy_atrium', zone: 'atrium', weapon: 'rivetRifle', position: new THREE.Vector3(LAYOUT.atrium.rect.minX + 0.02, 1.5, 21.5), normal: new THREE.Vector3(1, 0, 0) },
    // Cinema projection loop: above the tile dado, between the reel rack and rear crossover.
    { name: 'wallbuy_cinema', zone: 'cinema', weapon: 'coilNailer',
      position: new THREE.Vector3(LAYOUT.cinema.passage.maxX - LAYOUT.cinema.wallBuy.wallOffset,
        upperY + LAYOUT.cinema.wallBuy.height, LAYOUT.cinema.wallBuy.z), normal: new THREE.Vector3(-1, 0, 0) },
    // HOFFMAN'S: the east wall between its side door and the shoe wall (3 cm out: the store's paint panel is on that wall).
    // (It hung on Byte Me's pod in the Food Court before the department store opened.)
    { name: 'wallbuy_departmentStore', zone: 'departmentStore', weapon: 'barcodeScanner', position: new THREE.Vector3(DS.rect.maxX - 0.03, 1.5, DS.scannerZ), normal: new THREE.Vector3(-1, 0, 0) },
  ];
  kit.markers({ spawnPoints, wallBuys, visible: debug.showMarkers });

  // Player start: middle of the start room, facing into the room (+Z) toward the vents
  const playerSpawn = { position: new THREE.Vector3(0, 0, 12), yaw: feel.player.spawnYaw ?? Math.PI };

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

  // The benchmark route (fx/benchmark.js, debug Shift+B): long views through every area at eye height, the worst cases
  // for drawing. Same shape as titleShots, plus a name for the report. Keep them clear of walls and shutters.
  const benchmarkShots = [
    parkingLot.benchmark,
    { name: 'hallway', from: [18, 1.7, 2], to: [8, 1.7, 2], lookFrom: [-18, 2, 2], lookTo: [-18, 2.5, 2] },
    // (z -8.5: clear end to end. At z -4 the dolly ran through the Play Time Toys and Byte Me stores, inside their walls.)
    { name: 'food court', from: [-17, 1.7, -8.5], to: [17, 1.7, -8.5], lookFrom: [0, 1.5, -13], lookTo: [0, 1.5, -13] },
    { name: 'mega mart', from: [22, 1.7, 4.8], to: [32, 1.7, 4.8], lookFrom: [27, 1.5, -20], lookTo: [27, 1.5, -20] },
    { name: 'service corridor', from: [-21.8, 1.7, 1], to: [-21.8, 1.7, -12], lookFrom: [-21.8, 1.5, -14], lookTo: [-21.8, 1.5, -14] },
    { name: 'start room', from: [0, 1.7, 7], to: [0, 1.7, 13], lookFrom: [0, 1.5, 16], lookTo: [-3, 1.5, 16] },
    { name: 'atrium court', from: [10, 1.7, 8], to: [30, 1.7, 8], lookFrom: [20, 4, 25], lookTo: [20, 4, 25] },
    { name: 'atrium ring', from: [10, 8, 29.3], to: [30, 8, 29.3], lookFrom: [20, 2, 15], lookTo: [20, 2, 15] },
    { name: 'level 2', from: [-18.5, 8, 4.6], to: [18, 8, 4.6], lookFrom: [20, 7.5, 2], lookTo: [20, 7.5, 2] },
    { name: 'department store', from: [-18.5, 1.7, 7.4], to: [-7, 1.7, 7.4], lookFrom: [-12.6, 1.5, 25], lookTo: [-12.6, 1.5, 25] },
    { name: 'cinema lobby', from: [-23, 8, -6.5], to: [-37, 8, -6.5], lookFrom: [-34, 8.5, 5], lookTo: [-34, 8.5, 5] },
    { name: 'cinema screen', from: [-33, 8, 7.5], to: [-33, 8, 16], lookFrom: [-33, 8.8, 27.6], lookTo: [-33, 8.8, 27.6] },
    { name: 'cinema stairs', from: [-44.15, 7.9, -5.6], to: [-44.15, 1.8, 7.1], lookFrom: [-44.15, 1.7, 9], lookTo: [-41, 1.7, 8.6] },
    { name: 'workshop hall', from: [-8.4, 8, 13.2], to: [3.4, 8, 13.2], lookFrom: [-2.8, 8.4, 19], lookTo: [-2.8, 8.4, 19] },
  ];

  // Everything (besides doors) the player interacts with, by kind: game/features/ builds each one.
  function wardrobeSpot(kind, id, { at: [x, z], zone, facing }, title) {
    const floorY = zone === 'upstairs' || zone === 'cinema' ? upperY : 0;
    const { heightAboveFloor, standOff } = wardrobeAnchor;
    const normal = new THREE.Vector3(facing === 'x+' ? 1 : facing === 'x-' ? -1 : 0, 0, typeof facing === 'number' ? facing : 0);
    const position = new THREE.Vector3(x, floorY + heightAboveFloor, z).addScaledVector(normal, standOff);
    const spot = { kind, name: `${kind}_${id}`, zone, item: id, position, normal };
    // A showpiece (maps/mall/wardrobeShowpieces/) replaces the plain rack; its handle rides on the feature for the rack builder.
    if (kind === 'wardrobeRack' && wardrobeShowpieces[id]) spot.showpiece = wardrobeShowpieces[id](kit, spot, floorY);
    else buildWardrobeDisplay(kit, spot, facing, floorY, title);
    return spot;
  }
  const van = parkingLot.vehicles.find(({ id }) => id === 'abandoned');
  const escapeVanPosition = new THREE.Vector3(
    van.x + van.width / 2 + closingTime.van.clearance, closingTime.van.promptHeight, van.z,
  );
  const features = [
    ...Object.entries(wardrobeItems).map(([id, item]) => wardrobeSpot('wardrobeRack', id, item, item.shortName)),
    ...Object.entries(fittingRooms).map(([id, room]) => wardrobeSpot('fittingRoom', id, room, 'Fitting room')),
    { kind: 'workshop', name: 'buildABlaster', zone: 'upstairs',
      position: levelTwo.workshop.purchasePosition,
      normal: new THREE.Vector3(0, 0, -1),
      stations: levelTwo.workshop.stations },
    ...wallBuys.map((w) => ({ kind: 'wallBuy', ...w })),
    // The RESTOCK-O-MATIC: buy a refill for the gun in your hand (g.pricing 'ammoCache'); its screen shows what it sells.
    { kind: 'ammoCache', name: 'ammocache_foodCourt', zone: 'foodCourt', position: foodCourtAmmo.position, normal: foodCourtAmmo.normal, screen: foodCourtAmmo.screen },
    { kind: 'ammoCache', name: 'ammocache_atrium', zone: 'atrium', position: atriumAmmo.position, normal: atriumAmmo.normal, screen: atriumAmmo.screen },
    { kind: 'ammoCache', name: 'ammocache_cinema', zone: 'cinema', position: cinemaAmmo.position, normal: cinemaAmmo.normal, screen: cinemaAmmo.screen },
    // Customer Service: upgrade the gun in your hand one Extended Warranty tier (g.pricing 'tier'); the second window sells box cutter tiers (g.pricing 'melee').
    { kind: 'upgradeDesk', name: 'upgradedesk_hallway', zone: deskZone, ...serviceDesk },
    { kind: 'nightSafe', name: 'nightSafe', zone: deskZone, position: new THREE.Vector3(safeWallX + safe.promptOffset, safe.promptHeight, safeZ), normal: new THREE.Vector3(1, 0, 0) },
    // Store attachment counters: fit that attachment to the gun in your hand (g.pricing 'attachment').
    ...stores.spots.map((s) => ({ kind: 'attachmentCounter', name: `attachment_${s.id}`, zone: s.zone, attachment: s.id, position: s.position, normal: s.normal })),
    // GRAB-A-GUN: one machine, live at one of its sites (it starts at the first every run).
    { kind: 'clawMachine', name: 'clawMachine', zone: clawSites[0].zone, position: clawSites[0].cabinet.position, normal: clawSites[0].cabinet.normal, sites: clawSites },
    { kind: 'prizeCounter', name: 'prizeCounter', zone: counterSite.zone, position: prizeBooth.position, normal: prizeBooth.normal, slots: prizeBooth.slots },
    // Kiosk Kevin: one cart live at one of his sites (every run starts at the first).
    { kind: 'kiosk', name: 'kioskKevin', zone: kioskSites[0].zone, position: kioskSites[0].cart.position, normal: kioskSites[0].cart.normal, sites: kioskSites },
    // Environmental hazards (docs/archive/hazards-plan.md): Grand Atrium Electrified Fountain, Food Court Fryer Blast, Main Hallway Fire Sprinklers & Service Corridor PA System Lure switches.
    { kind: 'escapeVan', name: 'escape_van', zone: 'parkingLot', position: escapeVanPosition, normal: new THREE.Vector3(1, 0, 0), validation: parking.validation },
    { kind: 'fountainHazard', name: 'hazard_fountain', zone: hazards.fountain.zone, position: new THREE.Vector3(hazards.fountain.position.x, hazards.fountain.position.y, hazards.fountain.position.z), normal: new THREE.Vector3(hazards.fountain.normal.x, hazards.fountain.normal.y, hazards.fountain.normal.z) },
    { kind: 'fryerHazard', name: 'hazard_fryer', zone: hazards.fryer.zone, position: new THREE.Vector3(hazards.fryer.position.x, hazards.fryer.position.y, hazards.fryer.position.z), normal: new THREE.Vector3(hazards.fryer.normal.x, hazards.fryer.normal.y, hazards.fryer.normal.z) },
    { kind: 'sprinklerHazard', name: 'hazard_sprinklers', zone: hazards.sprinklers.zone, position: new THREE.Vector3(hazards.sprinklers.position.x, hazards.sprinklers.position.y, hazards.sprinklers.position.z), normal: new THREE.Vector3(hazards.sprinklers.normal.x, hazards.sprinklers.normal.y, hazards.sprinklers.normal.z) },
    { kind: 'paLureHazard', name: 'hazard_paLure', zone: hazards.paLure.zone, position: new THREE.Vector3(hazards.paLure.position.x, hazards.paLure.position.y, hazards.paLure.position.z), normal: new THREE.Vector3(hazards.paLure.normal.x, hazards.paLure.normal.y, hazards.paLure.normal.z) },
    { kind: 'returnsDesk', name: 'returnsDesk', zone: deskZone, position: new THREE.Vector3(returnsX, returns.promptHeight, returnsWallZ - returns.promptOffset), normal: new THREE.Vector3(0, 0, -1) },
  ];

  const doors = [startDoor, megaMartDoor, foodCourtDoor, serviceCorridorDoor, foodCourtMegaMartDoor, serviceCorridorFoodCourtDoor, escalatorDoor, atriumDoor, atriumPromenadeDoor, atriumMegaMartDoor, cinemaWing.door, cinemaConnection.door, departmentStoreDoor, departmentStoreStartRoomDoor, parking.door];
  const areaUnlocks = createAreaUnlocks({ zones, doors, connections: {
    startShutter: ['startRoom', 'hallway'],
    megaMart: ['hallway', 'megaMart'],
    foodCourt: ['hallway', 'foodCourt'],
    serviceCorridor: ['hallway', 'serviceCorridor'],
    foodCourtMegaMart: ['foodCourt', 'megaMart'],
    serviceCorridorFoodCourt: ['serviceCorridor', 'foodCourt'],
    escalatorRepair: ['hallway', 'upstairs'],
    atrium: ['hallway', 'atrium'],
    atriumPromenade: ['atrium', 'upstairs'],
    atriumMegaMart: ['atrium', 'megaMart'],
    cinema: ['upstairs', 'cinema'],
    cinemaStairs: ['serviceCorridor', 'cinema'],
    departmentStore: ['hallway', 'departmentStore'],
    departmentStoreStartRoom: ['startRoom', 'departmentStore'],
    parkingLot: ['megaMart', 'parkingLot'],
  } });
  const dressing = buildMallAtmosphere(kit, LAYOUT, { service, ceilingHoles });

  // The hallway's new look (the visual overhaul's reference room): neon, painted light, two-tone walls, clutter.
  // Clutter keeps clear of every doorway, spawn point, buy spot and the escalator's foot.
  const around = (p, r) => ({ minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r });
  const hallwayClear = [
    ...spawnPoints.map((s) => around(s.position, 1.2)),
    ...features.map((f) => around(f.position, 2.0)),
    ...clawSites.map((s) => around(s.cabinet.position, 2.0)), // (every GRAB-A-GUN site, not only the feature's first)
    ...kioskSites.map((s) => around(s.cart.position, 2.0)), // (every Kiosk Kevin site, likewise)
    ...doors.map((d) => around(d.position, 2.6)),
    around({ x: escalator.foot.x + 1, z: escalator.foot.z }, 2.5),
    { minX: D.minX - 1, maxX: D.maxX + 1, minZ: H.maxZ - 3, maxZ: H.maxZ }, // the start door's approach
    { minX: H.minX, maxX: H.maxX, minZ: HZ - 1.2, maxZ: HZ + 1.2 }, // the hallway's centre lane (fighting room)
  ];
  // Set pieces first: their colliders keep the clutter scattered below out of them.
  const setPieces = buildSetPieces({ kit, layout: LAYOUT, floorY: upperY }); // (one signature scene per area: maps/mall/setPieces.js)
  const looks = createLookKit({ kit, colliders }); // (one for the whole map: it follows the Graphics settings for all of it)
  const parkingDressing = buildParkingDetails({ kit, looks });
  buildHallwayLook({ looks, kit, layout: LAYOUT, keepClear: hallwayClear });
  buildFoodCourtLook({ looks, kit, layout: LAYOUT, keepClear: hallwayClear.slice(0, -2) }); // (spawns, buy spots, doors; not the hallway's lanes)
  buildStartRoomLook({ looks, kit, layout: LAYOUT });
  buildMegaMartLook({ looks, kit, layout: LAYOUT, keepClear: hallwayClear.slice(0, -2) });
  buildServiceCorridorLook({ looks, kit, layout: LAYOUT, corridor: service, keepClear: hallwayClear.slice(0, -2) });
  buildLevelTwoLook({ looks, layout: LAYOUT, floorY: upperY, hole: escalator.hole, keepClear: hallwayClear.slice(0, -2) });
  buildPromenadeDetails({ kit, looks, layout: LAYOUT.level2, floorY: upperY });
  buildWorkshopDetails({ kit, looks, layout: LAYOUT.level2, floorY: upperY }); // (Build-A-Blaster's shop and hall dressing)
  buildSeamDetails({ kit, looks, props, floorY: upperY }); // where HOFFMAN'S meets the cinema (the connector's receiving door, the cinema's Promenade front)
  const cinemaDetails = buildCinemaDetails({ kit, looks, layout: LAYOUT.cinema, floorY: upperY });
  dressCinemaStairs({ kit, looks, layout: LAYOUT.cinemaStairs, floorY: upperY });
  buildCinemaServiceDetails({ kit, looks, cinema: LAYOUT.cinema, stairs: LAYOUT.cinemaStairs, floorY: upperY });
  buildAtriumLook({ looks, layout: LAYOUT, upperY, keepClear: hallwayClear.slice(0, -2) });
  buildDepartmentStoreLook({ looks, kit, layout: LAYOUT, keepClear: hallwayClear.slice(0, -2) });

  // The concourse pass (maps/mall/concourse.js, config/concourse.js): shopfronts, the mall section, floor patterns, painted
  // light under panels and neon, fixtures, stories, the campaign and wayfinding. Last, so every neon sign is already placed.
  buildConcourse({ kit, looks, props, layout: LAYOUT, upperY });

  // The horror layer (game/features/horror.js, config/look.js horror): which lamps and neon it may kill, area by area
  // (areas are zone lighting's grades, so a power cut darkens the same space its grade covers).
  const horror = {
    state: { exposure: 1, decay: 0, dusk: 0, cut: null }, // read by zone lighting (main.js)
    setDusk, // the sun going down over a run (look.dusk)
    lamps,
    panels: props.panels.filter((p) => !p.dead).map((p) => p.mesh), // lit ceiling panels: they dim with their area's lamps
    neons: looks.parts.neonsByName,
    areas: [
      { id: 'hallway', grades: ['front'], neons: ['hallway'] },
      { id: 'startRoom', grades: ['startRoom'], neons: ['startRoom'] },
      { id: 'foodCourt', grades: ['foodCourt'], neons: ['foodCourt'] },
      { id: 'megaMart', grades: ['megaMart', 'martBack'], neons: ['megaMart'] },
      { id: 'serviceCorridor', grades: ['serviceCorridor'], neons: ['serviceCorridor'] },
      { id: 'level2', grades: ['level2'], neons: ['level2', 'promenade_workshop'] },
      { id: 'atrium', grades: ['atrium'], neons: ['atrium'] },
      { id: 'departmentStore', grades: ['departmentStore'], neons: ['departmentStore'] },
      { id: 'cinema', grades: ['cinemaLobby', 'cinemaScreen', 'cinemaService'], neons: ['cinema'] },
      { id: 'parkingLot', grades: ['parkingLot'], neons: ['parkingLot'] },
    ],
  };
  // The Return to Sender quest's NO REFUNDS floor signs (config/returnQuest.js).
  for (const sign of returnQuest.signs) {
    features.push({ kind: 'refundSign', name: `refundSign_${sign.id}`, zone: sign.zone, sign: sign.id, position: new THREE.Vector3(...sign.at), normal: new THREE.Vector3(0, 1, 0) });
  }
  // Lost and Found: one piece of lost property per area, at fixed spots (config/lostFound.js).
  for (const item of lostFound.items) {
    features.push({ kind: 'lostProperty', name: `lost_${item.id}`, zone: item.zone, item: item.id, position: new THREE.Vector3(...item.at), normal: new THREE.Vector3(0, 1, 0) });
  }
  features.push({ kind: 'horror', name: 'horror_director', zone: 'startRoom', position: playerSpawn.position.clone(), normal: new THREE.Vector3(0, 0, -1), seed: 1986 });

  return {
    id: 'mall',
    group,
    zones,
    doors,
    areaUnlocks,
    spawnPoints,
    features,
    playerSpawn,
    horror,
    // Room culling (fx/roomCulling.js): the rooms, and the openings you can see one room from another through (a door id =
    // its shutter blocks the view while closed). A mesh wholly inside a room is skipped when the camera can't see that room.
    cullAreas: [
      { id: 'startRoom', minX: R.minX, maxX: R.maxX, minY: 0, maxY: R.height + 0.3, minZ: H.maxZ + T, maxZ: R.maxZ },
      { id: 'hallway', minX: H.minX, maxX: H.maxX, minY: 0, maxY: H.height, minZ: H.minZ, maxZ: H.maxZ },
      { id: 'level2', ...LAYOUT.level2.rect, minY: upperY, maxY: upperY + LAYOUT.level2.height + 0.3 },
      { id: 'shoePer', ...LAYOUT.level2.sections.find(s => s.id === 'shoePer'), minZ: LAYOUT.level2.rect.maxZ + T,
        minY: upperY, maxY: upperY + LAYOUT.level2.height + 0.3 },
      { id: 'workshop', ...LAYOUT.level2.sections.find(s => s.id === 'workshop'), minZ: LAYOUT.level2.rect.maxZ + T,
        minY: upperY, maxY: upperY + LAYOUT.level2.height + T },
      { id: 'workshopHall', ...LAYOUT.level2.sections.find(s => s.id === 'workshopHall'),
        minY: upperY, maxY: upperY + LAYOUT.level2.workshop.hall.height + T },
      { id: 'foodCourt', minX: F.minX, maxX: F.maxX, minY: 0, maxY: F.height + 0.3, minZ: F.minZ - 6, maxZ: F.maxZ }, // (+ the recessed stores)
      { id: 'megaMart', minX: M.minX + T, maxX: M.maxX, minY: 0, maxY: M.height + 0.3, minZ: M.minZ, maxZ: M.maxZ },
      { id: 'serviceCorridor', minX: H.minX - T - SC.width, maxX: H.minX - T, minY: 0, maxY: SC.height + 0.3, minZ: -14, maxZ: SCD.maxZ },
      // Include the sealed shop interiors in atrium visibility, while navigation keeps the original room bounds.
      { id: 'atrium', minX: AT.rect.minX - atriumDetails.shopInterior.depth - .1,
        maxX: AT.rect.maxX + atriumDetails.shopInterior.depth + .1, minY: -.1, maxY: upperY + AT.upperHeight + 0.3,
        minZ: AT.rect.minZ, maxZ: AT.rect.maxZ + atriumDetails.shopInterior.depth + .1 },
      { id: 'departmentStore', ...DS.rect, minY: 0, maxY: DS.height + 0.3 },
      parking.room,
      ...cinemaWing.rooms,
      ...cinemaConnection.rooms,
    ],
    cullPortals: [
      parking.portal,
      ...cinemaWing.portals,
      ...cinemaConnection.portals,
      ...LAYOUT.level2.shoeStore.entrances.map(e => ({ a: 'level2', b: 'shoePer', minX: e.from, maxX: e.to,
        minY: upperY, maxY: upperY + e.top, minZ: LAYOUT.level2.rect.maxZ, maxZ: LAYOUT.level2.rect.maxZ + T })),
      ...[...LAYOUT.level2.workshop.entrances, LAYOUT.level2.workshop.window].map(e => ({ a: 'level2', b: 'workshop',
        minX: e.from, maxX: e.to, minY: upperY + (e.sill ?? 0), maxY: upperY + e.top,
        minZ: LAYOUT.level2.rect.maxZ, maxZ: LAYOUT.level2.rect.maxZ + T })),
      { a: 'workshop', b: 'workshopHall', minX: LAYOUT.level2.workshop.from, maxX: LAYOUT.level2.workshop.to, minY: upperY,
        maxY: upperY + LAYOUT.level2.workshop.hall.mouthTop, minZ: LAYOUT.level2.workshop.hall.minZ - T, maxZ: LAYOUT.level2.workshop.hall.minZ },
      { a: 'startRoom', b: 'hallway', door: 'startShutter', minX: D.minX, maxX: D.maxX, minY: 0, maxY: D.height, minZ: H.maxZ, maxZ: H.maxZ + T },
      { a: 'hallway', b: 'foodCourt', door: 'foodCourt', minX: FD.minX, maxX: FD.maxX, minY: 0, maxY: FD.height, minZ: H.minZ - T, maxZ: H.minZ },
      { a: 'hallway', b: 'megaMart', door: 'megaMart', minX: M.minX, maxX: M.minX + T, minY: 0, maxY: MD.height, minZ: MD.minZ, maxZ: MD.maxZ },
      { a: 'hallway', b: 'serviceCorridor', door: 'serviceCorridor', minX: H.minX - T, maxX: H.minX, minY: 0, maxY: SCD.height, minZ: SCD.minZ, maxZ: SCD.maxZ },
      { a: 'foodCourt', b: 'megaMart', door: 'foodCourtMegaMart', minX: M.minX, maxX: M.minX + T, minY: 0, maxY: FM.height, minZ: FM.minZ, maxZ: FM.maxZ },
      { a: 'serviceCorridor', b: 'foodCourt', door: 'serviceCorridorFoodCourt', minX: F.minX - T, maxX: F.minX, minY: 0, maxY: SF.height, minZ: SF.minZ, maxZ: SF.maxZ },
      { a: 'hallway', b: 'atrium', door: 'atrium', minX: AT.gate.from, maxX: AT.gate.to, minY: 0, maxY: AT.gate.height, minZ: H.maxZ, maxZ: AT.rect.minZ },
      { a: 'megaMart', b: 'atrium', door: 'atriumMegaMart', minX: AT.martLink.from, maxX: AT.martLink.to, minY: 0, maxY: AT.martLink.height, minZ: M.maxZ, maxZ: AT.rect.minZ },
      { a: 'hallway', b: 'departmentStore', door: 'departmentStore', minX: DS.gate.from, maxX: DS.gate.to, minY: 0, maxY: DS.gate.height, minZ: H.maxZ, maxZ: H.maxZ + T },
      { a: 'startRoom', b: 'departmentStore', door: 'departmentStoreStartRoom', minX: R.minX - T, maxX: R.minX, minY: 0, maxY: DSL.height, minZ: DSL.from, maxZ: DSL.to },
      { a: 'level2', b: 'atrium', door: 'atriumPromenade', minX: AT.link.from, maxX: AT.link.to, minY: upperY, maxY: upperY + AT.link.height, minZ: H.maxZ, maxZ: AT.rect.minZ },
      // Down through the floor: the escalator's hole and the two balcony voids (no doors; the rope across the escalator hides nothing)
      ...[escalator.hole, ...LAYOUT.level2.voids].map((r) => ({ a: 'hallway', b: 'level2', minX: r.minX, maxX: r.maxX, minY: H.height - 0.1, maxY: upperY + 0.1, minZ: r.minZ, maxZ: r.maxZ })),
    ],
    // The mall directory (ui/minimap.js, drawn by game/minimapPlan.js): which culling rooms make up each floor, a room drawn from
    // the layout instead of its (looser) culling box, and the holes in the upper floor (the balcony voids, the atrium's open court).
    minimap: {
      floors: [
        { id: 'ground', label: 'Level 1', below: upperY - 1.8,
          rooms: ['parkingLot', 'megaMart', 'foodCourt', 'hallway', 'startRoom', 'departmentStore', 'atrium', 'serviceCorridor', 'cinemaReturn', 'cinemaStairwell'] },
        { id: 'upper', label: 'Level 2',
          rooms: ['level2', 'shoePer', 'workshop', 'workshopHall', 'atrium', 'cinemaLobby', 'cinemaScreen', 'cinemaPassage', 'cinemaStairwell'] },
      ],
      shapes: { atrium: AT.rect },
      voids: [
        ...[escalator.hole, ...LAYOUT.level2.voids].map((r) => ({ floor: 'upper', ...r })),
        { floor: 'upper', minX: AT.rect.minX + AT.ringDepth, maxX: AT.rect.maxX - AT.ringDepth, minZ: AT.rect.minZ + AT.ringDepth, maxZ: AT.rect.maxZ - AT.ringDepth },
      ],
    },
    titleShots,
    benchmarkShots,
    // Zone lighting (fx/zoneGrading.js, grades in config/look.js): which grade where. First match wins, so small areas
    // come before the big ones they sit in; anywhere else (the hallway) uses the fallback grade.
    gradeZones: [
      { grade: 'parkingLot', ...parkingLot.rect, minY: 0, maxY: 15 },
      ...cinemaWing.grades,
      ...cinemaConnection.grades,
      { grade: 'serviceCorridor', minX: H.minX - T - SC.width, maxX: H.minX - T, minZ: -14, maxZ: SCD.maxZ, maxY: SC.height },
      { grade: 'martBack', minX: M.minX + T, maxX: M.maxX, minZ: M.minZ, maxZ: -19.5, maxY: M.height },
      { grade: 'megaMart', minX: M.minX + T, maxX: M.maxX, minZ: M.minZ, maxZ: M.maxZ, maxY: M.height },
      { grade: 'startRoom', minX: R.minX, maxX: R.maxX, minZ: H.maxZ + T, maxZ: R.maxZ, maxY: R.height },
      { grade: 'departmentStore', ...DS.rect, maxY: DS.height },
      { grade: 'foodCourt', minX: F.minX, maxX: F.maxX, minZ: F.minZ - 6, maxZ: F.maxZ, maxY: F.height }, // (+ the recessed stores)
      { grade: 'atrium', minX: AT.rect.minX, maxX: AT.rect.maxX, minZ: AT.rect.minZ, maxZ: AT.rect.maxZ },
      ...LAYOUT.level2.sections.map(section => ({ grade: 'level2', ...section, minY: H.height })),
    ],
    ambience: [...dressing.emitters, ...atrium.emitters, ...cinemaWing.emitters, ...LAYOUT.cinemaStairs.ambience, ...departmentStoreRoom.emitters, ...parkingLot.ambience, ...parkingDetails.ambience],
    ambientEvents: [...parkingDetails.ambientEvents, ...atrium.ambientEvents],
    cinema: { layout: LAYOUT.cinema, floorY: upperY, presentation: cinemaDetails, stairs: cinemaConnection },
    // Zombie navigation across floors (zombies/navigation.js): the ground floor and level 2, joined by the escalator.
    navigation: { floors: [0, upperY], links: [escalator.link, atrium.link, cinemaConnection.link] },
    // The escalator's barrier (a collider across its foot, removed by the escalatorRepair door) and its walkable surface.
    escalator: { barrier: escalator.barrier, ramp: escalator.ramp },
    // For the debug "upstairs" command (Shift+T): where you arrive on level 2, where you go back down to, and the repair door.
    levelTwo: {
      sections: LAYOUT.level2.sections,
      expansionConnections: LAYOUT.level2.expansionConnections,
      minY: upperY / 2, // above this you count as upstairs
      arrival: { position: new THREE.Vector3(H.minX + 1.2, upperY, 4.6), yaw: -Math.PI / 2 }, // west lobby, facing east down the walkway
      below: { position: new THREE.Vector3(escalator.foot.x + 1.5, 0, escalator.foot.z), yaw: Math.PI / 2 }, // at the escalator's foot
      repair: escalatorDoor,
      workshop: levelTwo.workshop.arrival, // for the debug "workshop" command
    },
    update(dt) {
      for (const door of doors) door.update(dt);
      dressing.update(dt);
      atrium.update(dt);
      looks.update(dt);
      setPieces.update(dt);
      cinemaDetails.update(dt);
      parkingDressing.update(dt);
    },
    reset() {
      areaUnlocks.reset();
      dressing.reset();
      atrium.reset();
      looks.reset();
      setPieces.reset();
      cinemaDetails.reset();
      parkingDressing.reset();
    },
    // Unload: colliders out of the shared list, GPU memory freed, group out of the scene.
    dispose() {
      kit.dispose();
      group.removeFromParent();
    },
  };
}
