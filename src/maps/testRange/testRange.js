// =============================================================================
// MOVEMENT TEST RANGE (debug add-on, not a real map)
// A big open area far from the playable map for trying out movement and
// shooting. Only built when debug.testArena is on; press T in-game to teleport
// between it and the map. Adds its solid boxes to the shared collider list.
//
// Layout, in meters, relative to the arena center (player spawns at the south
// edge facing north, -Z):
//   - West:   runway with a line every 5m, for judging sprint/slide distance
//   - Mid-west: slide bars and a long low tunnel (crouch height fits, standing doesn't)
//   - Center: pillars to strafe around, and stairs up to a 2m platform
//   - East:   jump boxes of increasing height, and platforms with growing gaps
//   - Near spawn: shooting range with practice dummies (3 close, 2 far)
// =============================================================================

import * as THREE from 'three';
import { makeTileTexture, makeSignTexture } from '../../world/textures.js';
import { createDummy } from './dummy.js';
import { zombieHealthForRound } from '../../config/economy.js';

const ARENA = {
  center: { x: 0, z: -100 }, // far south of the mall, out of sight behind its walls
  halfSize: 30, // arena is 60m x 60m
  wallHeight: 2,
  wallThickness: 0.5,
  lowBarBottom: 1.2, // underside of slide bars/tunnel: above crouch (1.1), below standing (1.8)
  lowBarTop: 1.5,
};

const COLORS = {
  wall: 0x6c7a89,
  stripe: 0xffd23f,
  startLine: 0xff4f9a,
  bar: 0xff8a3d,
  post: 0x3d3d48,
  pillar: 0x9aa6b2,
  step: 0x2ec4b6,
  jumpBox: 0x8d7bd9,
  tooHigh: 0xd62839,
  platform: 0x4caf50,
};

export function buildTestRange(scene, colliders) {
  const group = new THREE.Group();
  group.name = 'testArena';
  scene.add(group);

  const cx = ARENA.center.x;
  const cz = ARENA.center.z;
  const S = ARENA.halfSize;
  const T = ARENA.wallThickness;
  const materials = new Map();

  function mat(color) {
    if (!materials.has(color)) {
      materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }));
    }
    return materials.get(color);
  }

  /** Box in arena-local coordinates. Solid unless { collide: false }. */
  function box(x0, y0, z0, x1, y1, z1, material, { collide = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material);
    mesh.position.set(cx + (x0 + x1) / 2, (y0 + y1) / 2, cz + (z0 + z1) / 2);
    group.add(mesh);
    if (collide) {
      colliders.push(
        new THREE.Box3(new THREE.Vector3(cx + x0, y0, cz + z0), new THREE.Vector3(cx + x1, y1, cz + z1)),
      );
    }
    return mesh;
  }

  /** A label facing the spawn (+Z), in arena-local coordinates. */
  function label(text, x, y, z, width, height, background = '#1f1a24', color = '#ffffff') {
    const texture = makeSignTexture(text, { background, color, aspect: width / height });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
    mesh.position.set(cx + x, y, cz + z);
    group.add(mesh);
  }

  // --- Floor and border walls ---------------------------------------------------

  const floorTexture = makeTileTexture({ base: '#d3dbe2', grout: '#93a1ad', variation: 8, seed: 5 });
  floorTexture.repeat.set(S, S); // 1m tiles, handy for judging distances
  box(-S, -0.2, -S, S, 0, S, new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.5 }));

  const H = ARENA.wallHeight;
  const wall = mat(COLORS.wall);
  box(-S - T, 0, -S - T, S + T, H, -S, wall); // north
  box(-S - T, 0, S, S + T, H, S + T, wall); // south
  box(-S - T, 0, -S, -S, H, S, wall); // west
  box(S, 0, -S, S + T, H, S, wall); // east

  // Banner hanging over the area just ahead of the spawn point.
  label('MOVEMENT TEST RANGE  (T = BACK TO MALL)', 0, 3.6, S - 9, 10, 0.9, '#3b2f44', '#ffd23f');

  // --- Runway: a line every 5m -----------------------------------------------------

  const runway = { x0: -28, x1: -21, start: 25 };
  box(runway.x0, 0, runway.start - 0.1, runway.x1, 0.01, runway.start + 0.1, mat(COLORS.startLine), { collide: false });
  for (let d = 5; runway.start - d > -S; d += 5) {
    const z = runway.start - d;
    box(runway.x0, 0, z - 0.06, runway.x1, 0.01, z + 0.06, mat(COLORS.stripe), { collide: false });
    label(`${d}m`, runway.x0 - 1, 0.6, z, 1, 0.4); // beside the lane, not in it
  }
  label('RUNWAY', (runway.x0 + runway.x1) / 2, 2.6, runway.start + 1, 4, 0.8);

  // --- Slide lane: two bars, then a long low tunnel --------------------------------

  const lane = { x0: -16, x1: -10 };
  const B0 = ARENA.lowBarBottom;
  const B1 = ARENA.lowBarTop;
  for (const z of [15, 10]) {
    box(lane.x0, B0, z - 0.15, lane.x1, B1, z + 0.15, mat(COLORS.bar));
    box(lane.x0 - 0.3, 0, z - 0.15, lane.x0, B1, z + 0.15, mat(COLORS.post));
    box(lane.x1, 0, z - 0.15, lane.x1 + 0.3, B1, z + 0.15, mat(COLORS.post));
  }
  // Tunnel from z = -2 to -10: you have to stay crouched the whole way.
  box(lane.x0, B0, -10, lane.x1, B1, -2, mat(COLORS.bar));
  box(lane.x0 - 0.3, 0, -10, lane.x0, B1, -2, mat(COLORS.post));
  box(lane.x1, 0, -10, lane.x1 + 0.3, B1, -2, mat(COLORS.post));
  label('SLIDE / CROUCH', (lane.x0 + lane.x1) / 2, 2.6, 18, 4, 0.8);

  // --- Center: pillars and stairs to a 2m platform --------------------------------

  for (const [px, pz] of [[-4, 12], [4, 12], [-4, 4], [4, 4], [0, 8]]) {
    box(px - 0.4, 0, pz - 0.4, px + 0.4, 4, pz + 0.4, mat(COLORS.pillar));
  }
  const steps = [
    { z0: -13.5, z1: -12, h: 0.5 },
    { z0: -15, z1: -13.5, h: 1.0 },
    { z0: -16.5, z1: -15, h: 1.5 },
    { z0: -24, z1: -16.5, h: 2.0 }, // the platform
  ];
  for (const s of steps) box(-3, 0, s.z0, 3, s.h, s.z1, mat(COLORS.step));
  label('STAIRS (JUMP UP)', 0, 2.6, -10, 4, 0.8);

  // --- East: jump boxes of increasing height ---------------------------------------
  // A standing jump peaks around 1.05m, so 1.2m should be just out of reach.

  const jumpHeights = [0.3, 0.45, 0.6, 0.8, 1.0, 1.2];
  jumpHeights.forEach((h, i) => {
    const x0 = 10 + i * 3;
    const color = h > 1.05 ? COLORS.tooHigh : COLORS.jumpBox;
    box(x0, 0, 8, x0 + 2, h, 10, mat(color));
    label(`${h}m`, x0 + 1, h + 0.4, 10, 1.2, 0.4);
  });
  label('JUMP HEIGHTS', 19, 2.6, 11, 4, 0.8);

  // --- East: platforms with growing gaps (sprint-jump test) -------------------------

  const P = 0.6; // platform height: low enough to hop onto from the floor
  const platformZ = [[-4, -6], [-8, -10], [-13, -15], [-19, -21], [-26, -28]]; // gaps 2, 3, 4, 5m
  for (const [z1, z0] of platformZ) box(14, 0, z0, 24, P, z1, mat(COLORS.platform));
  for (let i = 0; i < platformZ.length - 1; i++) {
    const gapStart = platformZ[i][1];
    const gapEnd = platformZ[i + 1][0];
    label(`${gapStart - gapEnd}m GAP`, 19, 2, gapStart - 0.01, 2, 0.5);
  }
  label('GAP JUMPS', 19, 2.6, -3, 4, 0.8);

  // --- Shooting range: practice dummies --------------------------------------------
  // Three close to the spawn, two further back off to the sides. They have
  // round-1 zombie health, so kills take the same number of shots as the real thing.

  const dummySpots = [[-5, 17], [0, 17], [5, 17], [-9, 0], [9, 0]];
  const dummies = dummySpots.map(([x, z]) =>
    createDummy({
      parent: group,
      colliders,
      position: new THREE.Vector3(cx + x, 0, cz + z),
      health: zombieHealthForRound(1),
    }),
  );
  label('SHOOTING RANGE', 0, 2.9, 17.6, 4, 0.8);

  // --- Lighting ------------------------------------------------------------------
  // Its own lights (it must not depend on the map's).
  group.add(new THREE.HemisphereLight(0xfff6e6, 0xb8c2cc, 0.9));
  const fill = new THREE.PointLight(0xffffff, 60, 0, 1.5);
  fill.position.set(cx, 12, cz);
  group.add(fill);

  return {
    group,
    // Spawn at the south edge, facing north (-Z) toward everything.
    playerSpawn: { position: new THREE.Vector3(cx, 0, cz + S - 3), yaw: 0 },
    contains(pos) {
      return Math.abs(pos.x - cx) <= S + T && Math.abs(pos.z - cz) <= S + T;
    },
    // Things the player can shoot (see weapons/hitscan.js)
    shootables: dummies,
    update(dt) {
      for (const dummy of dummies) dummy.update(dt);
    },
  };
}
