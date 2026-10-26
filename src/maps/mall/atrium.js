// =============================================================================
// THE GRAND ATRIUM
// The mall's big open heart, north of the hallway: one 24 x 24 m room, two storeys tall (roof at 10 m). The ground floor is
// an open court round a square fountain (cover, nothing you can stand on), with two kiosks, tree planters and benches; a
// 3.5 m arcade runs round the edge under an UPPER RING (level 2, y 6.3) that looks down into the court over glass railings.
// A second escalator rises inside the court to the ring's east side, and the ring joins the Sunset Promenade (level 2 over
// the hallway) through a shutter in the shared wall. A big sunset skylight sits over the court.
//
// buildAtrium({ kit, props, layout, upperY }) -> { spawns, lamps, link, ramp, emitters, update, reset }
//   layout  LAYOUT.atrium (mall.js): rect, ring depth, gate / link openings, fountain, kiosks, planters, vents
//   upperY  the level 2 floor height (the ring's floor)
//   link    the escalator, for zombie navigation (zombies/navigation.js links)
// Doors (the hallway gate, the Promenade link shutter) are built by mall.js, which owns the zones. Decoration adds no collision
// except what is named: the walls, sealed shop glazing, roof, ring slab, railings, fountain, kiosk counters, planters, benches and the escalator.
// =============================================================================

import * as THREE from 'three';
import { slabPiecesWithHoles } from '../../world/mapKit.js';
import { COLORS } from './palette.js';
import { buildAtriumDetails } from './atriumDetails.js';
import { atriumShopOpenings } from './atriumStorefronts.js';
import { atriumDetails } from '../../config/atrium.js';
import { shutters } from '../../config/shutters.js';

const WALL = 0xf6e7d2; // warm cream
const STRIPE = 0xff8a5c; // sunset coral (as on the Promenade)
const TRIM = 0x6b3f5e; // dusk purple
const STONE = 0xd8cbb6;
const WATER = 0x58b7d9;

export function buildAtrium({ kit, props, layout, upperY }) {
  const { box, mat, sign } = kit;
  const A = layout.rect;
  const T = 0.3;
  const roofY = upperY + layout.upperHeight; // underside of the roof
  const d = layout.ringDepth;
  const V = { minX: A.minX + d, maxX: A.maxX - d, minZ: A.minZ + d, maxZ: A.maxZ - d }; // the open court under the skylight
  const cx = (V.minX + V.maxX) / 2;
  const cz = (V.minZ + V.maxZ) / 2;
  const { gate, link, martLink } = layout;
  const groundOpenings = [gate, ...(martLink ? [martLink] : [])]; // the hallway gate, the Mega Mart shortcut

  // --- Floors -----------------------------------------------------------------------------------------------------------------------
  const tile = { base: '#efe3cf', grout: '#c8b89c', variation: 10, seed: 61 };
  kit.tiledFloor(A.minX, A.minZ - T, A.maxX, A.maxZ, tile);
  kit.tiledFloor(gate.from, A.minZ - 2 * T, gate.to, A.minZ - T, tile); // under the gate (through the hallway's wall too)

  // --- The escalator: up from the court to the ring's east side (works from the start: no barrier) ------------------------------
  const E = layout.escalator;
  const escalator = props.escalator({
    bottomX: E.bottomX, dir: 1, minZ: E.minZ, maxZ: E.maxZ, upperY, ceilingY: upperY - 0.3, sealed: false, hangingSign: false,
  });

  // --- The upper ring: a slab with the court and the escalator's notch cut out, a tiled skin, glass railings --------------------
  const ringRect = { minX: A.minX, maxX: A.maxX, minZ: A.minZ - T, maxZ: A.maxZ };
  const holes = [V, escalator.hole];
  kit.slab(ringRect, upperY - 0.3, upperY, mat(COLORS.ceiling), { holes, name: 'atrium_ring' });
  for (const piece of slabPiecesWithHoles({ ...ringRect, minZ: A.minZ }, holes)) { // (the skin stops at the wall: no shared face)
    kit.tiledFloor(piece.minX, piece.minZ, piece.maxX, piece.maxZ,
      { base: '#f0d2b0', grout: '#c9a47c', variation: 10, seed: 63 }, { top: upperY + 0.012, thickness: 0.012, collide: false });
  }
  const e = 0.12; // the rails stand on the ring, just outside the court
  const H = escalator.hole;
  const rail = (x0, z0, x1, z1) => props.railing(x0, z0, x1, z1, upperY);
  rail(V.minX - e, V.minZ - e, V.maxX + e, V.minZ); // south
  rail(V.minX - e, V.maxZ, V.maxX + e, V.maxZ + e); // north
  rail(V.minX - e, V.minZ, V.minX, V.maxZ); // west
  rail(V.maxX, V.minZ, V.maxX + e, H.minZ); // east, south of where the escalator arrives...
  rail(V.maxX, H.maxZ, V.maxX + e, V.maxZ); // ...and north of it
  rail(V.maxX, H.minZ - e, H.maxX + e, H.minZ); // round the escalator's notch in the ring
  rail(V.maxX, H.maxZ, H.maxX + e, H.maxZ + e);

  // --- Walls and roof -------------------------------------------------------------------------------------------------------------
  const wallMat = mat(WALL);
  const along = { along: 'x', from: A.minX - T, to: A.maxX + T, at0: A.minZ - T, at1: A.minZ };
  kit.wall({ ...along, height: upperY, openings: groundOpenings.map((o) => ({ from: o.from, to: o.to, top: o.height })) }, wallMat, { name: 'atrium_wall_south' });
  kit.wall({ ...along, bottom: upperY, height: roofY - upperY, openings: [{ from: link.from, to: link.to, top: link.height }] }, wallMat, { name: 'atrium_wall_south_upper' });
  // Cut actual shop openings on both floors. A continuous glass barrier seals every opening:
  // scenery can have depth behind the wall without adding accessible floor or navigation space.
  for (const side of ['north', 'west', 'east']) {
    const alongX = side === 'north', wallAt = { north: A.maxZ, west: A.minX, east: A.maxX }[side];
    const at0 = side === 'west' ? wallAt - T : wallAt;
    const at1 = side === 'west' ? wallAt : wallAt + T;
    for (const upper of [false, true]) {
      const bottom = upper ? upperY : 0, height = upper ? roofY - upperY : upperY;
      const openings = atriumShopOpenings(layout, side, upper);
      kit.wall({ along: alongX ? 'x' : 'z', from: alongX ? A.minX - T : A.minZ,
        to: alongX ? A.maxX + T : A.maxZ, at0, at1, bottom, height, openings }, wallMat, { name: `atrium_wall_${side}` });
      for (const o of openings) {
        const [a, b] = [wallAt, wallAt + (side === 'west' ? .18 : -.18)].sort((a, b) => a - b);
        const barrier = alongX
          ? kit.addCollider(o.from, bottom, a, o.to, bottom + o.top, b)
          : kit.addCollider(a, bottom, o.from, b, bottom + o.top, o.to);
        barrier.name = 'atrium_sealed_shop';
      }
    }
  }
  box(A.minX - T, roofY, A.minZ - T, A.maxX + T, roofY + 0.3, A.maxZ + T, mat(COLORS.ceiling), { name: 'atrium_roof' });
  // Coral stripe + purple skirting on both floors (2 cm proud of the walls), split round the openings
  const stripe = mat(STRIPE);
  const skirting = mat(TRIM);
  const trims = (floorY, gaps) => {
    const pieces = (start, end, openings) => {
      const runs = []; let from = start;
      for (const g of [...openings].sort((a, b) => a.from - b.from)) {
        if (g.from > from) runs.push([from, g.from]); from = g.to;
      }
      if (from < end) runs.push([from, end]); return runs;
    };
    const upper = floorY > 0;
    const runs = [
      ...pieces(A.minX, A.maxX, atriumShopOpenings(layout, 'north', upper)).map(([a, b]) => [a, A.maxZ - .02, b, A.maxZ]),
      ...pieces(A.minZ, A.maxZ, atriumShopOpenings(layout, 'west', upper)).map(([a, b]) => [A.minX, a, A.minX + .02, b]),
      ...pieces(A.minZ, A.maxZ, atriumShopOpenings(layout, 'east', upper)).map(([a, b]) => [A.maxX - .02, a, A.maxX, b]),
      ...pieces(A.minX, A.maxX, gaps).map(([a, b]) => [a, A.minZ, b, A.minZ + .02]),
    ];
    for (const [x0, z0, x1, z1] of runs) {
      box(x0, floorY + 1.05, z0, x1, floorY + 1.2, z1, stripe, { collide: false });
      box(x0, floorY + (floorY > 0 ? 0.012 : 0), z0, x1, floorY + 0.12, z1, skirting, { collide: false });
    }
  };
  trims(0, groundOpenings);
  trims(upperY, [link]);
  // The skylight: one big warm glowing panel over the court, crossed by beams
  const glow = mat(0xffc58a, { emissive: 0xffa24d, emissiveIntensity: 1.25, roughness: 0.3 });
  box(V.minX + 0.4, roofY - 0.05, V.minZ + 0.4, V.maxX - 0.4, roofY, V.maxZ - 0.4, glow, { collide: false, name: 'atrium_skylight' });
  const beam = mat(COLORS.pillar);
  for (let i = 0; i <= 3; i++) {
    const x = V.minX + ((V.maxX - V.minX) * i) / 3;
    box(x - 0.15, roofY - 0.25, A.minZ, x + 0.15, roofY, A.maxZ, beam, { collide: false });
  }
  box(A.minX, roofY - 0.25, cz - 0.15, A.maxX, roofY, cz + 0.15, beam, { collide: false });
  // Light panels under the ring, lighting the arcade
  for (const [x, z] of [[cx - 6, A.minZ + d / 2], [cx + 6, A.minZ + d / 2], [cx - 6, A.maxZ - d / 2], [cx + 6, A.maxZ - d / 2],
    [A.minX + d / 2, cz], [A.maxX - d / 2, cz - 6]]) {
    const alongX = Math.abs(z - cz) > 1;
    const [hx, hz] = alongX ? [1.2, 0.5] : [0.5, 1.2];
    props.lightPanel(x - hx, z - hz, x + hx, z + hz, upperY - 0.3);
  }

  // --- The fountain: a square stone basin with a glass guard on its rim (one solid block nobody can get onto, even from a bench),
  //     water, a tiered spout -------------------------------------------------------------------------------------------------------
  const F = layout.fountain;
  const fx = F.x ?? cx;
  const fz = F.z ?? cz;
  const r = F.half;
  kit.addCollider(fx - r, 0, fz - r, fx + r, 2.2, fz + r); // (the glass guard's top: out of reach even jumping off a bench)
  const stone = mat(STONE);
  box(fx - r, 0, fz - r, fx + r, 0.95, fz + r, stone, { collide: false, name: 'atrium_fountain' });
  box(fx - r - 0.06, 0.95, fz - r - 0.06, fx + r + 0.06, 1.05, fz + r + 0.06, mat(0xe9dfcc), { collide: false });
  const water = mat(WATER, { emissive: 0x1d5f7a, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.2,
    transparent: true, opacity: atriumDetails.fountain.waterOpacity, depthWrite: false });
  box(fx - r + 0.3, 1.05, fz - r + 0.3, fx + r - 0.3, 1.07, fz + r - 0.3, water, { collide: false, name: 'atrium_water' });
  const tier = (radius, y0, y1, material) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.85, y1 - y0, 12), material);
    m.position.set(fx, (y0 + y1) / 2, fz);
    kit.group.add(m);
  };
  tier(0.55, 1.05, 2.2, stone); // pedestal
  tier(1.4, 2.2, 2.45, stone); // lower bowl
  tier(1.25, 2.45, 2.47, water);
  tier(0.3, 2.45, 3.1, stone); // upper spout
  const spray = mat(0xbfe9ff, { transparent: true, opacity: 0.45, depthWrite: false, emissive: 0x4aa8d0, emissiveIntensity: 0.3 });
  tier(0.12, 3.1, 3.7, spray); // the jet
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // overflow sheets from the bowl
    box(fx + dx * 1.3 - (dz ? 0.35 : 0.02), 1.07, fz + dz * 1.3 - (dx ? 0.35 : 0.02), fx + dx * 1.3 + (dz ? 0.35 : 0.02), 2.2, fz + dz * 1.3 + (dx ? 0.35 : 0.02), spray, { collide: false });
  }
  const guard = mat(COLORS.balustradeGlass, { transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false });
  for (const [x0, z0, x1, z1] of [[fx - r, fz - r, fx + r, fz - r + 0.04], [fx - r, fz + r - 0.04, fx + r, fz + r],
    [fx - r, fz - r, fx - r + 0.04, fz + r], [fx + r - 0.04, fz - r, fx + r, fz + r]]) {
    box(x0, 1.05, z0, x1, 2.15, z1, guard, { collide: false });
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // brass posts at the corners, a rail along the top
    box(fx + sx * r - 0.05, 1.05, fz + sz * r - 0.05, fx + sx * r + 0.05, 2.2, fz + sz * r + 0.05, mat(0xc9a04a), { collide: false });
  }
  for (const [x0, z0, x1, z1] of [[fx - r, fz - r - 0.03, fx + r, fz - r + 0.03], [fx - r, fz + r - 0.03, fx + r, fz + r + 0.03],
    [fx - r - 0.03, fz - r, fx - r + 0.03, fz + r], [fx + r - 0.03, fz - r, fx + r + 0.03, fz + r]]) {
    box(x0, 2.15, z0, x1, 2.2, z1, mat(0xc9a04a), { collide: false });
  }
  sign('Please do not feed the fountain', {
    x: fx, y: 0.55, z: fz - r - 0.06, width: 2.6, height: 0.3, facing: -1, background: '#3b2f44', color: '#ffd9a8', font: 'Arial, "Helvetica Neue", sans-serif',
  });

  // --- Kiosks (solid up to their canopy: nobody stands on the counter), planters, benches round the fountain -----------------------
  for (const k of layout.kiosks) {
    const hw = 0.9;
    const hd = 0.6;
    kit.addCollider(k.x - hw, 0, k.z - hd, k.x + hw, 2.55, k.z + hd);
    box(k.x - hw, 0, k.z - hd, k.x + hw, 1.05, k.z + hd, mat(k.color), { collide: false, name: 'atrium_kiosk' });
    box(k.x - hw - 0.05, 1.05, k.z - hd - 0.05, k.x + hw + 0.05, 1.12, k.z + hd + 0.05, mat(COLORS.deskTop), { collide: false });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      box(k.x + sx * hw - 0.04, 1.12, k.z + sz * hd - 0.04, k.x + sx * hw + 0.04, 2.4, k.z + sz * hd + 0.04, mat(COLORS.metal), { collide: false });
    }
    box(k.x - hw - 0.25, 2.4, k.z - hd - 0.25, k.x + hw + 0.25, 2.55, k.z + hd + 0.25, mat(k.color), { collide: false });
    for (const facing of [1, -1]) {
      sign(k.name, {
        x: k.x, y: 2.75, z: k.z + facing * 0.01, width: 1.9, height: 0.38, facing, background: '#1f1a24', color: k.signColor,
      });
    }
    box(k.x - 0.85, 2.56, k.z - 0.005, k.x + 0.85, 2.94, k.z + 0.005, mat(0x1f1a24), { collide: false }); // (the sign's backing)
  }
  for (const [x, z] of layout.planters) props.planter(x - 0.7, z - 0.7, x + 0.7, z + 0.7, { tree: true });
  for (const [x0, z0, x1, z1] of layout.benches) props.bench(x0, z0, x1, z1);

  // --- Signs ---------------------------------------------------------------------------------------------------------------------
  sign('SUNSET GALLERIA', {
    x: cx, y: upperY + 2.3, z: A.maxZ - 0.02, width: 8, height: 1.1, facing: -1, background: '#6b3f5e', color: '#ffd9a8',
  });
  sign('THE GRAND ATRIUM', {
    x: cx, y: 4.3, z: A.maxZ - 0.02, width: 6, height: 0.8, facing: -1, background: '#3b2f44', color: '#ffd23f', font: 'Georgia, "Times New Roman", serif',
  });
  sign('Promenade · Level 2', {
    x: (link.from + link.to) / 2, y: upperY + link.height + 0.35, z: A.minZ + shutters.track.signOffset, width: 2.8, height: 0.4, facing: 1,
    background: '#1d1626', color: '#ffd23f', font: 'Arial, "Helvetica Neue", sans-serif',
  }).name = 'sign_atrium_promenade';
  box((link.from + link.to) / 2 - 1.4, upperY + link.height + .15, A.minZ + .03,
    (link.from + link.to) / 2 + 1.4, upperY + link.height + .55, A.minZ + shutters.track.signOffset - .01,
    mat(0x1d1626), { collide: false, name: 'promenade_sign_mount' });

  // --- Boarded vents (zombie spawns): on the ground floor, and one on the ring --------------------------------------------------
  const spawns = [];
  const plank = mat(COLORS.plank);
  for (const v of layout.vents) {
    const alongX = v.wall === 'north' || v.wall === 'south';
    const wallAt = { north: A.maxZ, south: A.minZ, west: A.minX, east: A.maxX }[v.wall];
    const facing = v.wall === 'north' || v.wall === 'east' ? -1 : 1;
    const y = v.upper ? upperY : 0;
    if (!v.upper) props.boardedVent({ along: alongX ? 'x' : 'z', center: v.at, wallAt, facing });
    else {
      for (const h of [0.45, 0.8, 1.15]) {
        const [a, b] = [wallAt, wallAt + facing * 0.06].sort((p, q) => p - q);
        if (alongX) box(v.at - 0.7, y + h, a, v.at + 0.7, y + h + 0.2, b, plank, { collide: false });
        else box(a, y + h, v.at - 0.7, b, y + h + 0.2, v.at + 0.7, plank, { collide: false });
      }
    }
    const inset = 0.8;
    spawns.push({
      name: `spawn_atrium_${v.id}`, zone: 'atrium',
      position: alongX ? new THREE.Vector3(v.at, y, wallAt + facing * inset) : new THREE.Vector3(wallAt + facing * inset, y, v.at),
    });
  }

  const details = buildAtriumDetails(kit, layout, upperY);
  return {
    update: details.update,
    reset: details.reset,
    spawns,
    lamps: [
      { x: cx, y: upperY * 0.6, z: A.minZ + d + 1 }, // over the court's south half
      { x: cx, y: upperY + 2.2, z: cz + 2 }, // up in the void, lighting both floors
    ],
    link: escalator.link,
    ramp: escalator.ramp,
    emitters: [
      { id: 'atrium_music', kind: 'music', zone: 'atrium', position: [cx, 4, cz], range: 26 },
      { id: 'atrium_hvac', kind: 'ventilation', zone: 'atrium', position: [cx, roofY - 0.5, cz], range: 14 },
      { id: 'atrium_fountain', kind: 'fountain', zone: 'atrium', position: [fx, 1.1, fz - r - .2], range: atriumDetails.fountain.soundRange },
    ],
  };
}
