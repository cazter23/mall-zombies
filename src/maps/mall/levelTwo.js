// =============================================================================
// LEVEL 2 (the Sunset Promenade)
// The quiet upper floor, reached by the repaired escalator. It sits on the hallway's ceiling slab (top at y 6.3), the same
// independently authored footprint (config/promenade.js): walls and a roof all round, the escalator well fenced off with glass railings,
// a two-entrance shoe-store loop plus two closed shop fronts along the north wall, a seating area and boarded vents where
// zombies get in. Everything is placed from the LAYOUT.level2 entry in mall.js. Decoration adds NO collision except what
// is named below: the perimeter, the railings round the well, the benches and the planter.
//
// buildLevelTwo({ kit, props, floorY, supportRects, hole, layout }) -> { spawns, lamps }
//   layout.atriumLink  { from, to, top }: an opening in the north wall into the Grand Atrium's upper ring (its shutter is built by mall.js)
//   layout.voids  open BALCONY holes in the floor, over the hallway (railed on all four sides): you look down into the hallway
//   layout.rect / sections   independent promenade bounds and supported floor sections
//   supportRects   existing downstairs ceilings at floorY; do not build duplicate support there
//   hole   the escalator's ceiling hole (left open in the floor)
//   spawns [{ name, zone: 'upstairs', position }] for the zombie manager (y = the floor)
//   lamps  [{ x, y, z }] where mall.js hangs the level's point lights
// =============================================================================

import * as THREE from 'three';
import { slabPiecesWithHoles } from '../../world/mapKit.js';
import { COLORS } from './palette.js';
import { buildPromenadeShop } from './promenadeShop.js';

const WALL = 0xf4dcc8; // warm peach
const STRIPE = 0xff8a5c; // sunset coral
const TRIM = 0x6b3f5e; // dusk purple

export function buildLevelTwo({ kit, props, floorY, supportRect, supportRects = supportRect ? [supportRect] : [], hole, layout }) {
  const { box, mat, sign, addCollider } = kit;
  const rect = layout.rect;
  const T = layout.wallThickness;
  const top = floorY + layout.height; // underside of the roof
  const zMid = (rect.minZ + rect.maxZ) / 2;
  const y = (h) => floorY + h; // a height above the floor

  // --- Floor: a thin tiled skin over the slab (the slab itself is the collider), with the well left open -------------------
  const voids = layout.voids ?? [];
  // Only build structural floor where the downstairs ceiling does not already
  // support it. This avoids doubled floor faces/colliders along shared seams.
  for (const section of layout.sections) {
    for (const piece of slabPiecesWithHoles(section, supportRects)) {
      kit.slab(piece, floorY - layout.slabThickness, floorY, mat(COLORS.ceiling), { name: `level2_floor_${section.id}` });
    }
  }
  for (const section of layout.sections) for (const piece of slabPiecesWithHoles(section, [hole, ...voids])) {
    kit.tiledFloor(piece.minX, piece.minZ, piece.maxX, piece.maxZ,
      section.id === 'shoePer' ? layout.shoeStore.floor : { base: '#f0d2b0', grout: '#c9a47c', variation: 10, seed: 51 },
      { top: floorY + 0.012, thickness: 0.012, collide: false });
  }

  // --- Walls and roof ----------------------------------------------------------------------------------------------------
  const wallMat = mat(WALL);
  const link = layout.atriumLink;
  const reserved = layout.expansionConnections;
  const openings = side => reserved.filter(c => c.wall === side).map(c => ({ from: c.from, to: c.to, top: c.top }));
  const northOpenings = [...(link ? [{ from: link.from, to: link.to, top: link.top }] : []),
    ...openings('north'), ...layout.shoeStore.entrances];
  kit.wall({
    along: 'x', from: rect.minX - T, to: rect.maxX + T, at0: rect.maxZ, at1: rect.maxZ + T, bottom: floorY, height: layout.height,
    openings: northOpenings,
  }, wallMat, { name: 'level2_wall_north' });
  box(rect.minX - T, floorY, rect.minZ - T, rect.maxX + T, top, rect.minZ, wallMat, { name: 'level2_wall_south' });
  for (const side of ['west', 'east']) kit.wall({
    along: 'z', from: rect.minZ, to: rect.maxZ, at0: side === 'west' ? rect.minX - T : rect.maxX,
    at1: side === 'west' ? rect.minX : rect.maxX + T, bottom: floorY, height: layout.height, openings: openings(side),
  }, wallMat, { name: `level2_wall_${side}` });
  // Explicit removable closures, not live purchases: replacing one with a door later
  // does not require cutting a monolithic wall or moving furniture out of its approach.
  for (const c of reserved) {
    const north = c.wall === 'north';
    const at = north ? rect.maxZ : c.wall === 'west' ? rect.minX : rect.maxX;
    const a = c.wall === 'west' ? at - T : at;
    box(...(north ? [c.from, floorY, at, c.to, y(c.top), at + T]
      : [a, floorY, c.from, a + T, y(c.top), c.to]), mat(TRIM), { name: `level2_reserved_${c.id}` });
    if (!north) sign(c.label, { x: at + (c.wall === 'west' ? .025 : -.025), y: y(1.7), z: (c.from + c.to) / 2,
      width: c.to - c.from - .2, height: .45, facing: c.wall === 'west' ? 'x+' : 'x-', background: '#3b2f44', color: '#f4dcc8' });
  }
  box(rect.minX - T, top, rect.minZ - T, rect.maxX + T, top + 0.3, rect.maxZ + T, mat(COLORS.ceiling), { name: 'level2_roof' });
  // Coral stripe + purple skirting round the inside (decoration, 2 cm proud of the wall)
  const stripe = mat(STRIPE);
  const skirting = mat(TRIM);
  const northBands = [];
  let cursor = rect.minX;
  for (const opening of [...northOpenings].sort((a, b) => a.from - b.from)) {
    if (opening.from > cursor) northBands.push([cursor, rect.maxZ - .02, opening.from, rect.maxZ]);
    cursor = opening.to;
  }
  if (cursor < rect.maxX) northBands.push([cursor, rect.maxZ - .02, rect.maxX, rect.maxZ]);
  for (const [x0, z0, x1, z1] of [
    ...northBands,
    [rect.minX, rect.minZ, rect.maxX, rect.minZ + 0.02], // south
    [rect.minX, rect.minZ, rect.minX + 0.02, rect.maxZ], // west
    [rect.maxX - 0.02, rect.minZ, rect.maxX, rect.maxZ], // east
  ]) {
    box(x0, y(1.05), z0, x1, y(1.2), z1, stripe, { collide: false });
    box(x0, floorY, z0, x1, y(0.12), z1, skirting, { collide: false });
  }
  // Roof beams across the walkway, warm skylight strips between them (lit, no real lights)
  const beam = mat(COLORS.pillar);
  for (let x = rect.minX + 4; x < rect.maxX; x += 8) box(x - 0.15, top - 0.2, rect.minZ, x + 0.15, top, rect.maxZ, beam, { collide: false });
  const glow = mat(0xffc58a, { emissive: 0xffa24d, emissiveIntensity: 1.2, roughness: 0.3 });
  for (let x = rect.minX + 8; x < rect.maxX; x += 8) box(x - 2.2, top - 0.05, zMid - 1.6, x + 2.2, top, zMid + 1.6, glow, { collide: false });

  // --- Railings round the escalator well (solid to walking, not to bullets) ----------------------------------------------------
  // The well's west end is the way on and off the escalator, so it stays open; the other three sides are fenced.
  const rail = (x0, z0, x1, z1) => props.railing(x0, z0, x1, z1, floorY); // (1.5m glass: taller than a jump peaks)
  const edge = 0.12; // the rails stand on the slab, just outside the hole
  rail(hole.minX, hole.minZ - edge, hole.maxX + edge, hole.minZ); // south side
  rail(hole.minX, hole.maxZ, hole.maxX + edge, hole.maxZ + edge); // north side
  rail(hole.maxX, hole.minZ, hole.maxX + edge, hole.maxZ); // east end
  // The balcony voids over the hallway: railed all round
  for (const v of voids) {
    rail(v.minX - edge, v.minZ - edge, v.maxX + edge, v.minZ); // south
    rail(v.minX - edge, v.maxZ, v.maxX + edge, v.maxZ + edge); // north
    rail(v.minX - edge, v.minZ, v.minX, v.maxZ); // west
    rail(v.maxX, v.minZ, v.maxX + edge, v.maxZ); // east
  }

  // --- Empty shop fronts along the north wall -------------------------------------------------------------------------------------
  const wallAt = rect.maxZ;
  for (const shop of layout.shops) {
    if (shop.id === 'shoePer') continue; // its two open entrances and real interior replace the flat facade
    const w = shop.to - shop.from;
    const mid = (shop.from + shop.to) / 2;
    // Facade + dark window (0.12 / 0.15 m out from the wall), a sign band above, and its leftovers
    box(shop.from, floorY, wallAt - 0.12, shop.to, y(3.0), wallAt, mat(shop.color), { collide: false, name: `level2_shop_${shop.id}` });
    box(shop.from + 0.5, y(0.4), wallAt - 0.15, shop.to - 0.5, y(2.4), wallAt - 0.12, mat(COLORS.glass), { collide: false });
    const frame = mat(COLORS.shopFrame);
    for (let i = 1; i < 3; i++) {
      const u = shop.from + 0.5 + ((w - 1) * i) / 3;
      box(u - 0.04, y(0.4), wallAt - 0.18, u + 0.04, y(2.4), wallAt - 0.15, frame, { collide: false });
    }
    sign(shop.text, {
      x: mid, y: y(2.72), z: wallAt - 0.13, width: w - 0.8, height: 0.5, facing: -1,
      background: shop.signBackground, color: shop.signColor,
    });
    if (shop.gate) { // a steel roller gate, pulled down part of the way
      box(shop.from + 0.4, y(2.4 - shop.gate), wallAt - 0.2, shop.to - 0.4, y(2.4), wallAt - 0.18, mat(0x8d949c, { roughness: 0.4, metalness: 0.5 }), { collide: false });
    }
    if (shop.note) { // a paper notice taped to the window
      sign(shop.note, {
        x: mid, y: y(1.35), z: wallAt - 0.185, width: Math.min(1.8, w - 1.2), height: 0.7, facing: -1,
        background: '#f4f0e0', color: '#3b2f44',
      });
    }
  }
  buildPromenadeShop({ kit, floorY, rect, layout });

  // --- Seating: a bench ring round a planter (east), benches along the south wall (west) --------------------------------
  const wood = mat(COLORS.wood);
  const legs = mat(COLORS.metal);
  const bench = (x0, z0, x1, z1) => {
    const alongX = x1 - x0 > z1 - z0;
    if (alongX) {
      box(x0 + 0.1, floorY, z0 + 0.05, x0 + 0.25, y(0.38), z1 - 0.05, legs, { collide: false });
      box(x1 - 0.25, floorY, z0 + 0.05, x1 - 0.1, y(0.38), z1 - 0.05, legs, { collide: false });
    } else {
      box(x0 + 0.05, floorY, z0 + 0.1, x1 - 0.05, y(0.38), z0 + 0.25, legs, { collide: false });
      box(x0 + 0.05, floorY, z1 - 0.25, x1 - 0.05, y(0.38), z1 - 0.1, legs, { collide: false });
    }
    box(x0, y(0.38), z0, x1, y(0.45), z1, wood, { collide: false, name: 'level2_bench' });
    addCollider(x0, floorY, z0, x1, y(0.45), z1).vaultable = true;
  };
  const { seating } = layout;
  const px = seating.planterX;
  const pz = seating.planterZ;
  // The planter: a bush and a small tree (kept under the roof)
  box(px - 0.8, floorY, pz - 0.8, px + 0.8, y(0.6), pz + 0.8, mat(COLORS.planter), { name: 'level2_planter' });
  box(px - 0.68, y(0.6), pz - 0.68, px + 0.68, y(0.62), pz + 0.68, mat(COLORS.soil), { collide: false });
  box(px - 0.12, y(0.6), pz - 0.12, px + 0.12, y(1.9), pz + 0.12, mat(COLORS.woodDark), { collide: false, name: 'level2_tree_trunk' });
  const foliage = mat(COLORS.leaves);
  const leaves = [[0, 2.3, 0, 0.95], [0.35, 2.85, -0.15, 0.6], [-0.4, 2.1, 0.3, 0.5]];
  for (const [dx, h, dz, r] of leaves) { // (low-poly blobs, like the ground floor's trees)
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), foliage);
    blob.position.set(px + dx, y(h), pz + dz);
    blob.name = 'level2_leaves';
    kit.group.add(blob);
  }
  // Four benches round it, with gaps at the corners
  bench(px - 0.9, pz + 1.0, px + 0.9, pz + 1.5); // north
  bench(px - 0.9, pz - 1.5, px + 0.9, pz - 1.0); // south
  bench(px - 1.7, pz - 0.8, px - 1.2, pz + 0.8); // west
  bench(px + 1.2, pz - 0.8, px + 1.7, pz + 0.8); // east
  for (const [x0, x1] of seating.wallBenches) bench(x0, rect.minZ + 0.1, x1, rect.minZ + 0.6);

  // --- Signs and leftovers (decoration) ----------------------------------------------------------------------------------------------
  sign('LEVEL 2 · SUNSET PROMENADE', {
    x: rect.minX + 0.02, y: y(2.5), z: zMid + 3.5, width: 3.2, height: 0.6, facing: 'x+',
    background: '#3b2f44', color: '#ffd23f',
  });
  sign('ESCALATOR · LEVEL 1 ↓', {
    x: rect.minX + 0.02, y: y(2.5), z: zMid - 3.2, width: 3.0, height: 0.5, facing: 'x+',
    background: '#1d1626', color: '#ffffff',
  });
  sign('MIND THE GAP', {
    x: hole.maxX + edge - 0.03, y: y(0.55), z: (hole.minZ + hole.maxZ) / 2, width: 1.2, height: 0.35, facing: 'x+',
    background: '#ffd23f', color: '#1d1626',
  });
  sign('SUNSET GALLERIA · LEVEL 2', {
    x: 2, y: y(2.55), z: rect.minZ + 0.02, width: 7, height: 0.8, facing: 1,
    background: '#6b3f5e', color: '#ffd9a8',
  });
  sign('RESTROOMS → NOT ANYMORE', {
    x: 15.5, y: y(2.2), z: rect.minZ + 0.02, width: 2.6, height: 0.45, facing: 1,
    background: '#3a3f47', color: '#ffd23f',
  });
  // A "wet floor" cone and a tipped shopping bag by the well
  box(hole.maxX + 1.0, floorY, hole.maxZ + 0.7, hole.maxX + 1.3, y(0.55), hole.maxZ + 1.0, mat(0xffa21f), { collide: false });
  box(hole.maxX + 1.05, y(0.2), hole.maxZ + 0.75, hole.maxX + 1.25, y(0.28), hole.maxZ + 0.95, mat(0xffffff), { collide: false });

  // --- Boarded vents (zombie spawns) ---------------------------------------------------------------------------------------------------
  const plank = mat(COLORS.plank);
  const dark = mat(0x1b1b20);
  const spawns = [];
  for (const v of layout.vents) {
    const alongX = v.wall === 'south' || v.wall === 'north';
    const out = v.wall === 'south' ? rect.minZ : v.wall === 'north' ? rect.maxZ : rect.maxX;
    const facing = v.wall === 'north' || v.wall === 'east' ? -1 : 1; // direction into the room
    const place = (u0, h0, u1, h1, d0, d1, m) => (alongX
      ? box(u0, y(h0), Math.min(out + facing * d0, out + facing * d1), u1, y(h1), Math.max(out + facing * d0, out + facing * d1), m, { collide: false })
      : box(Math.min(out + facing * d0, out + facing * d1), y(h0), u0, Math.max(out + facing * d0, out + facing * d1), y(h1), u1, m, { collide: false }));
    place(v.at - 0.8, 0.3, v.at + 0.8, 1.5, 0, 0.03, dark); // the dark opening
    for (const h of [0.45, 0.8, 1.15]) place(v.at - 0.7, h, v.at + 0.7, h + 0.2, 0.03, 0.08, plank);
    const inset = 0.8;
    spawns.push({
      name: `spawn_upstairs_${v.id}`, zone: 'upstairs',
      position: alongX
        ? new THREE.Vector3(v.at, floorY, out + facing * inset)
        : new THREE.Vector3(out + facing * inset, floorY, v.at),
    });
  }

  return { spawns, lamps: layout.lamps.map((l) => ({ x: l.x, y: floorY + layout.height * 0.58, z: l.z })) };
}
