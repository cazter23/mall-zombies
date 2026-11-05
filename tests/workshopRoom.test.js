// The Build-A-Blaster room (maps/mall/workshopRoom.js): the storefront + the back hall. Geometry the ritual relies on: the
// laps round the island, zombies reaching every part of the room, and the culling rooms that draw it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { atriumDetails } from '../src/config/atrium.js';
import { parkingLot } from '../src/config/parkingLot.js';
import { feel } from '../src/config/feel.js';
import { overlapsSolid } from '../src/world/collision.js';
import { areaAt, visibleAreas } from '../src/fx/roomCulling.js';
import { gradeZoneAt } from '../src/fx/zoneGrading.js';

const Y = LAYOUT.hallway.height + .3;
const W = LAYOUT.level2.workshop, H = W.hall, I = H.island, T = LAYOUT.wallThickness;

function fixture() {
  const t = headlessGame();
  t.tick(); t.g.rounds.update = () => {}; t.g.zombies.clear(); t.g.debug.run('doors'); t.g.health.invulnerable = true; t.tick(120);
  return t;
}

test('the hall fits its plot and keeps a lane of at least 3 m round the island, even past the booth', () => {
  assert.ok(H.minZ - T >= LAYOUT.level2.shoeStore.depth + LAYOUT.level2.rect.maxZ + T, 'clear of the shoe store');
  const atriumExteriorWest = LAYOUT.atrium.rect.minX - atriumDetails.shopInterior.depth - parkingLot.exterior.clearance - parkingLot.exterior.thickness;
  assert.ok(H.maxX + T < atriumExteriorWest, 'clear of the Atrium exterior wall');
  assert.ok(I.minX - H.minX >= 3, 'west lane');
  assert.ok(H.booth.minX - I.maxX >= 3, 'east lane, past the booth');
  assert.ok(I.minZ - H.minZ >= 3, 'south lane');
  assert.ok(H.maxZ - I.maxZ >= 3, 'north lane');
  assert.ok(H.maxX - H.minX >= 14 && H.maxZ - H.minZ >= 14, 'about 14 x 14 m');
  assert.ok(H.tank.height <= H.height, 'the tank fits under the roof');
});

test('a player walks a full lap round the island in both directions without touching a wall', () => {
  const t = fixture(), { g } = t;
  const lane = 1.4;
  const corners = [[I.minX - lane, I.minZ - lane], [I.maxX + lane, I.minZ - lane], [I.maxX + lane, I.maxZ + lane], [I.minX - lane, I.maxZ + lane]];
  for (const lap of [corners, [...corners].reverse()]) {
    g.player.teleport({ position: new THREE.Vector3(lap[0][0], Y, lap[0][1]), yaw: 0 });
    t.input.held.add('KeyW');
    for (const [x, z] of [...lap.slice(1), lap[0]]) {
      let ticks = 0;
      while (Math.hypot(g.player.position.x - x, g.player.position.z - z) > .2 && ticks++ < 400) {
        g.player.yaw = Math.atan2(g.player.position.x - x, g.player.position.z - z);
        t.tick();
      }
      assert.ok(ticks < 400, `reached (${x}, ${z}): at ${g.player.position.toArray()}`);
      assert.equal(g.player.position.y, Y);
    }
    t.input.clear();
  }
  g.map.dispose();
});

test('the whole floor of the room is reachable by zombies, and nothing inside the island is', () => {
  const t = fixture(), { g } = t;
  g.player.teleport({ position: new THREE.Vector3(0, Y, 4.8), yaw: 0 }); // out on the Promenade
  t.tick(30);
  const nav = g.zombies.nav;
  const clear = (x, z) => !overlapsSolid(new THREE.Vector3(x, Y, z), .4, 1.8, g.colliders, feel.movement.stepTolerance);
  let checked = 0;
  for (let x = H.minX + .7; x < H.maxX - .6; x += .8) for (let z = H.minZ + .7; z < H.maxZ - .6; z += .8) {
    if (!clear(x, z)) continue;
    checked++;
    assert.ok(Number.isFinite(nav.distanceToTarget(x, z, Y)), `no route from (${x.toFixed(1)}, ${z.toFixed(1)})`);
  }
  assert.ok(checked > 150, `sampled ${checked} floor points`);
  assert.ok(g.colliders.some(b => b.ignoreShots && b.containsPoint(new THREE.Vector3((I.minX + I.maxX) / 2, Y + 1.2, I.minZ + .1))),
    'the guard stops feet but not bullets');
  g.map.dispose();
});

test('a zombie chases the player right round the loop, on either side of the island', () => {
  const t = fixture(), { g } = t;
  const spawn = (x, z) => {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(x, Y, z));
    zombie.position.y = Y; zombie.prevPosition.copy(zombie.position); zombie.speed = 3; zombie.setState('chasing'); zombie.updateHitboxes();
    return zombie;
  };
  const middleZ = (I.minZ + I.maxZ) / 2, middleX = (I.minX + I.maxX) / 2;
  // Each leg: the player waits at the opposite side, the zombie must come round a corner of the island to reach them.
  for (const [[sx, sz], [px, pz]] of [
    [[I.minX - 1.5, middleZ], [I.maxX + 1.5, middleZ]], [[I.maxX + 1.5, middleZ], [I.minX - 1.5, middleZ]],
    [[middleX, I.minZ - 1.5], [middleX, I.maxZ + 1.5]], [[middleX, I.maxZ + 1.5], [middleX, I.minZ - 1.5]],
  ]) {
    g.zombies.clear();
    const target = new THREE.Vector3(px, Y, pz);
    g.player.teleport({ position: target, yaw: 0 }); t.tick(20);
    const zombie = spawn(sx, sz);
    let arrived = false;
    for (let i = 0; i < 60 * 15 && !arrived; i++) {
      g.player.teleport({ position: target, yaw: 0 }); t.tick();
      arrived = Math.hypot(zombie.position.x - px, zombie.position.z - pz) < 2;
    }
    assert.ok(arrived, `zombie from (${sx}, ${sz}) stuck at ${zombie.position.toArray().map(v => v.toFixed(1))}`);
    assert.ok(Math.abs(zombie.position.y - Y) < .05);
  }
  g.map.dispose();
});

test('the hall is its own culling room, seen through the storefront, and it grades as level 2', () => {
  const t = headlessGame(), { g } = t;
  const areas = g.map.cullAreas, portals = g.map.cullPortals;
  assert.equal(areaAt(areas, new THREE.Vector3(-2, Y + 1.6, 14))?.id, 'workshopHall');
  assert.equal(areaAt(areas, new THREE.Vector3(0, Y + 1.6, 8))?.id, 'workshop');
  const cam = new THREE.PerspectiveCamera(75, 16 / 9, .05, 200);
  const view = (from, to) => {
    cam.position.set(...from); cam.lookAt(...to); cam.updateMatrixWorld();
    return visibleAreas({ areas, portals, camera: cam, isOpen: () => false });
  };
  const fromBench = view([1.8, Y + 1.6, 9], [-2, Y + 1.6, 18]);
  assert.ok(fromBench.has('workshop') && fromBench.has('workshopHall'), 'the hall shows through the mouth');
  const throughWindow = view([.4, Y + 1.6, 4.8], [-1.5, Y + 1.6, 14]);
  assert.ok(throughWindow.has('workshopHall'), 'the hall shows from the Promenade through window and mouth');
  const fromHall = view([-2, Y + 1.6, 14], [0, Y + 1.6, 7]);
  assert.ok(fromHall.has('workshop') && fromHall.has('level2'), 'looking back out over the storefront');
  const away = view([12, Y + 1.6, 2], [18, Y + 1.6, 2]);
  assert.ok(!away.has('workshopHall'), 'looking away along the Promenade skips the hall');
  assert.equal(gradeZoneAt(g.map.gradeZones, new THREE.Vector3(-2, Y + 1.6, 18)), 'level2');
  g.map.dispose();
});

test('every hall mesh sits inside the culling room, so the room drops out when you are not looking at it', async () => {
  const { createRoomCulling } = await import('../src/fx/roomCulling.js');
  const t = headlessGame(), { g } = t;
  const counts = createRoomCulling({ areas: g.map.cullAreas, portals: g.map.cullPortals, camera: new THREE.PerspectiveCamera() }).tag(g.map.group);
  assert.ok(counts.workshopHall > 30, `${counts.workshopHall} meshes in the hall room`);
  g.map.dispose();
});
