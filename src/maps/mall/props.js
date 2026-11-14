// =============================================================================
// MALL PROPS
// Reusable mall furniture built with the map kit (world/mapKit.js):
//   shopFront   a decorative shop facade on a wall (colored front, dark window, sign)
//   pillar      a full-height pillar with a wider base (one solid collider)
//   bench       a low bench you can jump onto or vault over
//   planter     a planter box with a bush or a small tree
//   lightPanel  a glowing ceiling light panel (or a dead one)
//   gondola     a double-sided store shelf stocked with product boxes (Mega Mart)
//   checkout    a vaultable checkout counter with belt, register and lane light
//   wallDoor    a painted-on service / exit door with an optional sign
//   boardedVent planks over a vent (zombie spawn dressing)
//   wallStripe  a painted stripe along a wall
//   escalator   an escalator up through the ceiling (sealed: rope barrier, OUT OF ORDER, unclimbable)
//   elevatorDoors sealed elevator doors on a wall (taped off, floor indicator, call button)
//   foodStall   a food-court stall (facade, awning, counter, gear); one solid 1.2m block you can't get onto
//   tableSet    a round table with four stools (hop on; zombies walk round)
//   trashCan    a solid bin
//   lockerBank  staff lockers against a wall (solid, too tall to climb)
//   electricalPanel a panel + DANGER sign on a wall (decorative; a future "power" switch spot)
//   pipeRun     exposed pipes along a wall near the ceiling (decorative)
//   vendingMachine  the ammo cache: a solid, lit vending machine against a wall; returns where to buy from it
//   serviceDesk     the Customer Service booth (gun tiers): a walled office with a service window, clerk and signs
//                   against a wall, one solid collider; returns its buy spot
//   clerk           a zombie shop clerk in an apron behind a counter (decoration)
//   attachmentDisplay  a store's attachment counter: a glass case in front of a shop, or a pegboard on a wall, showing
//                   its attachments (big copies of the gun parts); returns a buy spot per attachment
// createMallProps(kit) returns these as functions; maps/mall/mall.js places them.
// =============================================================================

import * as THREE from 'three';
import { COLORS } from './palette.js';
import { atmosphere, perchCap } from '../../config/environment.js';
import { concourse } from '../../config/concourse.js';
import { seededRandom } from '../../world/textures.js';
import { stallThemes } from './stallThemes.js';
import { buildAttachmentPart } from '../../weapons/models/upgradeParts.js';
import { buildClerkFigure } from '../../zombies/zombieModel.js';

const METAL_COLORS = new Set([
  COLORS.metal, COLORS.tableLeg, COLORS.stainless, COLORS.elevatorSteel, COLORS.elevatorFrame,
  COLORS.escalatorBody, COLORS.escalatorStep, COLORS.escalatorPlate, COLORS.gondolaBase,
  COLORS.gondolaPanel, COLORS.gondolaShelf, COLORS.checkoutTop, COLORS.serviceDoor,
  COLORS.pipeGrey, COLORS.pipeRed, COLORS.locker, COLORS.lockerVent, COLORS.electricalPanel,
  COLORS.deskBell, COLORS.grill,
]);
const PLASTIC_COLORS = new Set([
  COLORS.stool, COLORS.stoolAlt, COLORS.tableTop, COLORS.trashCan, COLORS.safetyYellow,
  COLORS.vendBody, COLORS.vendTrim, COLORS.checkoutBody, COLORS.register,
]);
const WOOD_COLORS = new Set([
  COLORS.wood, COLORS.woodDark, COLORS.plank, COLORS.plywood, COLORS.pegboard, COLORS.deskTop,
]);
const GLASS_COLORS = new Set([
  COLORS.glass, COLORS.doorWindow, COLORS.balustradeGlass, COLORS.caseGlass, COLORS.vendGlass,
]);

export function createMallProps(kit) {
  const { box, sign, addCollider, group } = kit;
  const mat = (color, options = {}) => kit.mat(color, {
    ...(METAL_COLORS.has(color) ? atmosphere.surfaces.metal : {}),
    ...(PLASTIC_COLORS.has(color) ? atmosphere.surfaces.plastic : {}),
    ...(WOOD_COLORS.has(color) ? atmosphere.surfaces.wood : {}),
    ...(GLASS_COLORS.has(color) ? atmosphere.surfaces.glass : {}),
    ...(color === COLORS.cardboard ? atmosphere.surfaces.cardboard : {}),
    ...options,
  });

  /**
   * A shop facade on a wall (decorative, not enterable).
   *   along:   'x' (the wall runs along X, like the concourse's long walls) or 'z' (a side wall)
   *   from/to: the shop's extent along the wall
   *   wallAt:  the wall's inner face (z for along 'x', x for along 'z')
   *   facing:  +1 or -1, the direction the shop front faces (into the room)
   */
  function shopFront({ along = 'x', from, to, wallAt, facing, color, text, textColor }) {
    const d = (offset) => wallAt + facing * offset; // depth out from the wall
    const depth = (a, b) => [Math.min(d(a), d(b)), Math.max(d(a), d(b))];
    // A box from u0..u1 along the wall, y0..y1 high, a..b out from the wall.
    const place = (u0, y0, u1, y1, [a, b], material, options) => (along === 'x'
      ? box(u0, y0, a, u1, y1, b, material, options)
      : box(a, y0, u0, b, y1, u1, material, options));

    // Colored facade
    place(from, 0, to, 4.7, depth(0, 0.12), mat(color), { collide: false, name: `shop_${text}` });
    // Dark glass window
    place(from + 0.6, 0.35, to - 0.6, 3.15, depth(0.12, 0.15), mat(COLORS.glass), { collide: false });
    // Window frame mullions
    const frame = mat(COLORS.shopFrame);
    for (let i = 1; i < 3; i++) {
      const u = from + 0.6 + ((to - from - 1.2) * i) / 3;
      place(u - 0.05, 0.35, u + 0.05, 3.15, depth(0.15, 0.18), frame, { collide: false });
    }
    // Sign band
    const mid = (from + to) / 2;
    sign(text, {
      ...(along === 'x' ? { x: mid, z: d(0.14), facing } : { x: d(0.14), z: mid, facing: facing > 0 ? 'x+' : 'x-' }),
      y: 3.9, width: to - from - 1, height: 0.85,
      background: '#1f1a24', color: textColor,
    });
  }

  /** A full-height pillar centered at (x, z). The collider includes the wider base. */
  function pillar(x, z, height) {
    box(x - 0.4, 0.3, z - 0.4, x + 0.4, height, z + 0.4, mat(COLORS.pillar), { collide: false, name: 'pillar' });
    const wrap = concourse.fixtures.pillarWraps; // a mirrored wrap at eye level (2 cm proud), very 1986
    box(x - 0.42, wrap.from, z - 0.42, x + 0.42, wrap.to, z + 0.42, kit.mat(wrap.color, atmosphere.surfaces.metal), { collide: false, name: 'pillar_wrap' });
    box(x - 0.45, 0, z - 0.45, x + 0.45, 0.3, z + 0.45, mat(COLORS.pillarBase), { collide: false });
    addCollider(x - 0.45, 0, z - 0.45, x + 0.45, height, z + 0.45);
  }

  /** A bench: low enough (0.45m) to jump onto, and marked vaultable. */
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

  /**
   * A planter box (0.6m) with low-poly greenery: a bush; a tree with { tree: true }; a TALL tree ({ tree: 'tall' }: the
   * canopy above eye-level signage, for courts open to a high roof); or a hedge ({ hedge: true }: a row of bushes along
   * the long side, low enough to see the signs beyond). Each planter turns and sizes its foliage a little by where it
   * stands (no Math.random: the map must build the same every time), so repeated trees don't read as copies.
   */
  function planter(x0, z0, x1, z1, { tree = false, hedge = false } = {}) {
    const h = 0.6;
    box(x0, 0, z0, x1, h, z1, mat(COLORS.planter), { name: 'planter' });
    box(x0 + 0.12, h, z0 + 0.12, x1 - 0.12, h + 0.02, z1 - 0.12, mat(COLORS.soil), { collide: false });
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const vary = seededRandom(Math.abs(Math.round(cx * 73 + cz * 151)) + 1);
    const leafy = (radius, color, x, y, z) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), mat(color));
      m.position.set(x, y, z);
      m.rotation.set(vary() * Math.PI, vary() * Math.PI, 0);
      m.scale.setScalar(0.9 + vary() * 0.2);
      group.add(m);
      return m;
    };
    if (tree) {
      const tall = tree === 'tall';
      const trunkTop = tall ? 4.0 : 2.1;
      box(cx - 0.15, h, cz - 0.15, cx + 0.15, h + trunkTop, cz + 0.15, mat(COLORS.woodDark), { name: 'tree_trunk' });
      const [main, top] = vary() < 0.5 ? [COLORS.leaves, COLORS.leavesDark] : [COLORS.leavesDark, COLORS.leaves];
      leafy(1.25, main, cx, h + trunkTop + 0.8, cz);
      leafy(0.8, top, cx + 0.3, h + trunkTop + 1.6, cz - 0.2);
    } else if (hedge) {
      const alongX = x1 - x0 >= z1 - z0;
      const length = alongX ? x1 - x0 : z1 - z0;
      const count = Math.max(1, Math.round(length / 1.1));
      for (let i = 0; i < count; i++) {
        const u = -length / 2 + (i + 0.5) * (length / count);
        const bush = leafy(0.55, i % 2 ? COLORS.leavesDark : COLORS.leaves, alongX ? cx + u : cx, h + 0.35, alongX ? cz : cz + u);
        bush.scale.y *= 0.8;
      }
    } else {
      const bush = leafy(0.55, COLORS.leaves, cx, h + 0.35, cz);
      bush.scale.y *= 0.8;
    }
  }

  /** A ceiling light panel spanning x0..x1 / z0..z1, just under a ceiling at `ceilingY`. */
  const panels = []; // every light panel built (the concourse pass paints a soft pool on the floor under the lit ones)
  function lightPanel(x0, z0, x1, z1, ceilingY, { dead = false, tint = COLORS.lightPanel, glow = 1.35 } = {}) {
    const material = dead
      ? mat(COLORS.deadLightPanel, { roughness: 0.45, metalness: 0.15 })
      : mat(tint, { emissive: tint, emissiveIntensity: glow, roughness: 0.2 });
    const mesh = box(x0, ceilingY - 0.06, z0, x1, ceilingY, z1, material, { collide: false });
    panels.push({ x0, z0, x1, z1, ceilingY, dead, tint, mesh }); // (mesh: the horror layer dims lit panels with their lamps)
  }

  // --- Big-box store props (Mega Mart) ----------------------------------------

  // Maps a position along a wall + depth out of it to x/z, for props that can sit on either kind of
  // wall: along 'x' -> (u, depth) = (x, z); along 'z' -> (u, depth) = (z, x).
  function wallPlacer(along) {
    return (u0, y0, u1, y1, a, b, material, options) => (along === 'x'
      ? box(u0, y0, Math.min(a, b), u1, y1, Math.max(a, b), material, options)
      : box(Math.min(a, b), y0, u0, Math.max(a, b), y1, u1, material, options));
  }

  /**
   * A double-sided shelving unit ("gondola") stocked with product boxes. One solid collider
   * (blocks walking, sight and bullets). Runs along its longer side. Products are one
   * InstancedMesh per gondola (hundreds of boxes, one draw call); `seed` keeps the stock the
   * same every load; about `looted` of the slots are empty.
   */
  function gondola(x0, z0, x1, z1, { height = 2.0, seed = 1, looted = 0.12, stock = true } = {}) {
    addCollider(x0, 0, z0, x1, height, z1);
    addCollider(x0, height, z0, x1, height + perchCap, z1).ignoreShots = true; // the topper: nothing to stand on (2.0 m is one sprint-jump from a checkout counter)
    const alongX = x1 - x0 >= z1 - z0;
    // Work in (u = along the gondola, w = across it) and map back to (x, z).
    const [u0, u1, w0, w1] = alongX ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
    const wMid = (w0 + w1) / 2;
    const put = (a0, y0, a1, y1, b0, b1, material) => (alongX
      ? box(a0, y0, b0, a1, y1, b1, material, { collide: false })
      : box(b0, y0, a0, b1, y1, a1, material, { collide: false }));

    put(u0, 0, u1, 0.12, w0, w1, mat(COLORS.gondolaBase)); // base / kick plate
    put(u0, 0.12, u1, height, wMid - 0.03, wMid + 0.03, mat(COLORS.gondolaPanel)); // center spine
    put(u0, height - 0.04, u1, height, w0 + 0.05, w1 - 0.05, mat(COLORS.gondolaShelf)); // top cap
    const levels = [0.12, 0.62, 1.12, 1.62]; // shelf tops (the base is the bottom shelf)
    for (const y of levels.slice(1)) {
      put(u0 + 0.02, y - 0.03, u1 - 0.02, y, w0, wMid - 0.03, mat(COLORS.gondolaShelf));
      put(u0 + 0.02, y - 0.03, u1 - 0.02, y, wMid + 0.03, w1, mat(COLORS.gondolaShelf));
    }

    // A map can supply its own themed stock while keeping this exact shelving/collision.
    if (!stock) return;
    // Product boxes on every shelf, both faces.
    const rand = seededRandom(seed);
    const items = [];
    for (const side of [-1, 1]) {
      const face = side < 0 ? w0 : w1; // the shelf's open edge on this side
      for (const y of levels) {
        let u = u0 + 0.06;
        while (u < u1 - 0.3) {
          const width = 0.22 + rand() * 0.2;
          if (u + width > u1 - 0.06) break;
          if (rand() > looted) {
            const h = 0.18 + rand() * 0.24;
            const depth = 0.24 + rand() * 0.12;
            items.push({ u: u + width / 2, y: y + h / 2, w: face - side * (0.03 + depth / 2), width, h, depth, color: COLORS.products[Math.floor(rand() * COLORS.products.length)] });
          }
          u += width + 0.02 + rand() * 0.05;
        }
      }
    }
    const products = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: true }),
      items.length,
    );
    products.name = 'products';
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    items.forEach((it, i) => {
      if (alongX) m.makeScale(it.width, it.h, it.depth).setPosition(it.u, it.y, it.w);
      else m.makeScale(it.depth, it.h, it.width).setPosition(it.w, it.y, it.u);
      products.setMatrixAt(i, m);
      products.setColorAt(i, color.setHex(it.color));
    });
    group.add(products);
  }

  /**
   * A checkout counter running along X (vaultable across its short side, like the start room's
   * counter) with a belt, a register at the +X end and a numbered lane light.
   */
  function checkout(x0, z0, x1, z1, lane, { drawerOpen = false } = {}) {
    box(x0, 0, z0, x1, 0.95, z1, mat(COLORS.checkoutBody), { name: 'checkout', vaultable: true });
    box(x0 - 0.04, 0.95, z0 - 0.04, x1 + 0.04, 1.0, z1 + 0.04, mat(COLORS.checkoutTop), { collide: false });
    box(x0 + 0.1, 1.0, z0 + 0.15, x1 - 0.7, 1.015, z1 - 0.15, mat(COLORS.checkoutBelt), { collide: false });
    // Register + screen (decorative: the vault only checks colliders)
    box(x1 - 0.55, 1.0, z0 + 0.2, x1 - 0.13, 1.28, z1 - 0.2, mat(COLORS.register), { collide: false });
    box(x1 - 0.5, 1.28, z0 + 0.3, x1 - 0.42, 1.48, z1 - 0.3, mat(COLORS.registerScreen, { emissive: COLORS.registerScreen, emissiveIntensity: 0.6 }), { collide: false });
    if (drawerOpen) { // the cash drawer, left open mid-sale, a few notes still in it
      box(x1 - 0.52, 1.02, z0 - 0.1, x1 - 0.16, 1.1, z0 + 0.2, mat(COLORS.register), { collide: false, name: 'register_drawer' });
      for (let i = 0; i < 3; i++) box(x1 - 0.49 + i * 0.11, 1.1, z0 - 0.06, x1 - 0.4 + i * 0.11, 1.106, z0 + 0.14, mat(0x7fb07a), { collide: false, name: 'register_notes' });
    }
    // Lane light: a thin pole with the lane number on top, readable from both sides.
    const px = x1 - 0.08;
    const pz = (z0 + z1) / 2;
    // The pole enters a solid housing; two detached planes left a visible gap above the old post.
    box(px - 0.03, 1.0, pz - 0.03, px + 0.03, 2.48, pz + 0.03, mat(COLORS.metal), { collide: false, name: 'checkout_lane_post' });
    box(px - 0.16, 2.32, pz - 0.04, px + 0.16, 2.64, pz + 0.04, mat(0x1d4e89), { collide: false, name: 'checkout_lane_housing' });
    for (const facing of [1, -1]) {
      sign(String(lane), {
        x: px, y: 2.48, z: pz + facing * 0.045, width: 0.32, height: 0.32, facing,
        background: '#1d4e89', color: '#ffd23f',
      });
    }
  }

  /**
   * A (closed, decorative) door on a wall: a service door, double doors, or an exit, with a small
   * window per leaf and an optional sign above. Not solid: it's painted on the wall.
   *   along/wallAt/facing as for shopFront; `center` = middle of the door along the wall.
   */
  function wallDoor({ along, center, wallAt, facing, width = 1.6, height = 2.2, leaves = 2, color, label, labelColor = '#ffffff', labelBackground = '#2b2b2b' }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    const half = width / 2;
    const leafW = width / leaves;
    place(center - half - 0.08, 0, center + half + 0.08, height + 0.08, d(0), d(0.04), mat(COLORS.shopFrame), { collide: false }); // frame
    for (let i = 0; i < leaves; i++) {
      const a = center - half + i * leafW;
      place(a + 0.02, 0, a + leafW - 0.02, height, d(0.04), d(0.08), mat(color), { collide: false });
      const wc = a + leafW / 2;
      place(wc - 0.12, height * 0.62, wc + 0.12, height * 0.8, d(0.08), d(0.09), mat(COLORS.doorWindow, { roughness: 0.2 }), { collide: false });
    }
    if (label) {
      sign(label, {
        ...(along === 'x' ? { x: center, z: d(0.1), facing } : { x: d(0.1), z: center, facing: facing > 0 ? 'x+' : 'x-' }),
        y: height + 0.35, width: Math.max(width, 1.8), height: 0.36,
        background: labelBackground, color: labelColor,
      });
    }
  }

  /** A boarded-up vent low on a wall (where zombies crawl in). Decorative. */
  function boardedVent({ along, center, wallAt, facing, width = 1.4 }) {
    const place = wallPlacer(along);
    for (const y of [0.45, 0.8, 1.15]) {
      place(center - width / 2, y, center + width / 2, y + 0.2, wallAt, wallAt + facing * 0.06, mat(COLORS.plank), { collide: false });
    }
  }

  /** A painted stripe along a wall's inner face (decorative), from..to along the wall, y0..y1 high. */
  function wallStripe({ along, from, to, wallAt, facing, y0, y1, color }) {
    wallPlacer(along)(from, y0, to, y1, wallAt, wallAt + facing * 0.02, mat(color), { collide: false });
  }

  // --- Escalator + elevator (the way up to a second floor; sealed for now) -------

  /**
   * An escalator running along X up to the floor above, SEALED for now: a rope barrier, an
   * OUT OF ORDER sign and colliders nobody can climb (the jump peaks at ~1.05m).
   *   bottomX:  x of its bottom end; dir: -1 = rises toward -X, +1 = toward +X
   *   minZ/maxZ: its width (balustrades included)
   *   upperY:   the upper floor's level (top of the ceiling slab it passes through)
   *   ceilingY: underside of that ceiling (where the hole has to start for a rider's head)
   * Shape: a flat landing at each end and a 30deg slope between. Under its low end it's solid to
   * the floor; where its underside is higher than `walkUnder` it's open, so you (and zombies) can
   * walk under the high end, like a real mall escalator.
   * Colliders follow the slope in steps: on the floor where it's low (blocks walking, bullets and
   * zombie routes), overhead where it's high. Returns { hole, topLanding }: the rect the ceiling
   * must leave open above it, and the x range of the flat top landing (over the upper floor).
   */
  function escalator({ bottomX, dir = -1, minZ, maxZ, upperY, ceilingY, landing = 1.4, angleDegrees = 30, walkUnder = 2.0, headroom = 2.1, sealed = true, hangingSign = true, cladding = null, skirtSign = null }) {
    const tan = Math.tan((angleDegrees * Math.PI) / 180);
    const plate = 0.12; // bottom landing plate height (the steps start here)
    const truss = 1.0; // depth of the structure under the steps
    const rail = 1.0; // balustrade + handrail height above the steps
    const run = (upperY - plate) / tan; // horizontal length of the slope
    const slopeEnd = landing + run;
    const length = slopeEnd + landing;
    const xAt = (u) => bottomX + dir * u; // u = meters along the escalator from its bottom end
    const surface = (u) => (u <= landing ? plate : u >= slopeEnd ? upperY : plate + (u - landing) * tan);
    const uOpen = Math.min(slopeEnd, landing + (walkUnder + truss - plate) / tan); // underside reaches walkUnder
    const width = maxZ - minZ;
    const zMid = (minZ + maxZ) / 2;
    const span = (u0, u1) => [Math.min(xAt(u0), xAt(u1)), Math.max(xAt(u0), xAt(u1))];

    // Body: one extruded side profile (bottom landing, solid skirt, open truss, top landing).
    const profile = new THREE.Shape();
    const points = [
      [0, 0], [uOpen, 0], [uOpen, walkUnder], [slopeEnd, upperY - truss], [length, upperY - truss],
      [length, upperY], [slopeEnd, upperY], [landing, plate], [0, plate],
    ];
    points.forEach(([u, y], i) => (i === 0 ? profile.moveTo(xAt(u), y) : profile.lineTo(xAt(u), y)));
    // `cladding`: a painted (matte) colour for the body instead of bare steel, so a big side reads as part of the room.
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(profile, { depth: width, bevelEnabled: false }), mat(cladding ?? COLORS.escalatorBody));
    body.position.z = minZ;
    body.name = 'escalator';
    group.add(body);

    // `skirtSign` { text, subtext, width, height, background, color }: one sign on each side of the solid skirt, just short
    // of where you can walk under, sized to stay below the slope. Both sides share one texture (one material to batch).
    if (skirtSign) {
      const u1 = uOpen - 0.25, u0 = u1 - skirtSign.width;
      const top = surface(u0) - 0.12, y = top - skirtSign.height / 2;
      if (u0 > 0 && y - skirtSign.height / 2 > 0.15) {
        const [sx0, sx1] = span(u0, u1);
        const { text, ...style } = skirtSign;
        const south = sign(text, { ...style, x: (sx0 + sx1) / 2, y, z: minZ - 0.025, facing: -1 });
        const north = south.clone();
        north.rotation.y = 0;
        north.position.z = maxZ + 0.025;
        group.add(north);
      }
    }

    // A band following the escalator's top surface, from `low` to `high` above it (glass, handrails).
    function band(u0, u1, low, high, z0, thickness, material) {
      const lower = [[u0, surface(u0)]];
      for (const corner of [landing, slopeEnd]) if (corner > u0 && corner < u1) lower.push([corner, surface(corner)]);
      lower.push([u1, surface(u1)]);
      const shape = new THREE.Shape();
      lower.forEach(([u, y], i) => (i === 0 ? shape.moveTo(xAt(u), y + low) : shape.lineTo(xAt(u), y + low)));
      for (const [u, y] of [...lower].reverse()) shape.lineTo(xAt(u), y + high);
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }), material);
      mesh.position.z = z0;
      group.add(mesh);
    }
    const glass = mat(COLORS.balustradeGlass, { transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false });
    const handrail = mat(COLORS.handrail);
    for (const z of [minZ + 0.2, maxZ - 0.24]) band(0.3, length - 0.3, 0, rail - 0.1, z, 0.04, glass);
    for (const z of [minZ + 0.17, maxZ - 0.27]) band(0.15, length - 0.15, rail - 0.1, rail, z, 0.1, handrail);

    // Steps: a sawtooth of treads up the slope, each with a yellow edge (two InstancedMeshes).
    const stepRun = 0.4;
    const treadWidth = width - 0.9;
    const count = Math.floor(run / stepRun);
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const steps = new THREE.InstancedMesh(unit, mat(COLORS.escalatorStep), count);
    const edges = new THREE.InstancedMesh(unit, mat(COLORS.safetyYellow), count);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const u0 = landing + i * stepRun;
      const top = plate + (i + 1) * stepRun * tan;
      steps.setMatrixAt(i, m4.makeScale(stepRun, 0.25, treadWidth).setPosition(xAt(u0 + stepRun / 2), top - 0.125, zMid));
      edges.setMatrixAt(i, m4.makeScale(0.05, 0.012, treadWidth).setPosition(xAt(u0 + stepRun - 0.025), top + 0.006, zMid));
    }
    group.add(steps, edges);
    // Landing plates (with a yellow comb line where the steps begin)
    let [x0, x1] = span(0, landing);
    box(x0, 0, minZ + 0.45, x1, plate + 0.005, maxZ - 0.45, mat(COLORS.escalatorPlate), { collide: false });
    [x0, x1] = span(landing - 0.066, landing - 0.006); // (just short of the plate's end face: they'd share it and flicker)
    box(x0, plate, minZ + 0.45, x1, plate + 0.01, maxZ - 0.45, mat(COLORS.safetyYellow), { collide: false });
    [x0, x1] = span(slopeEnd, length);
    box(x0, upperY, minZ + 0.45, x1, upperY + 0.03, maxZ - 0.45, mat(COLORS.escalatorPlate), { collide: false });

    // The barrier: two posts and a rope across the bottom, an OUT OF ORDER sandwich board in front,
    // and a hanging sign. `out` = the direction the bottom end faces (where people walk up from).
    const out = -dir;
    const facing = out > 0 ? 'x+' : 'x-';
    const postX = xAt(-0.3);
    const barrierParts = []; // everything that goes away when the escalator is repaired
    for (const z of sealed ? [minZ + 0.1, maxZ - 0.1] : []) {
      barrierParts.push(box(postX - 0.035, 0, z - 0.035, postX + 0.035, 1.0, z + 0.035, mat(COLORS.metal), { collide: false }));
      barrierParts.push(box(postX - 0.12, 0, z - 0.12, postX + 0.12, 0.04, z + 0.12, mat(COLORS.metal), { collide: false }));
    }
    const boardX = xAt(-0.6);
    if (sealed) {
      barrierParts.push(box(postX - 0.015, 0.84, minZ + 0.1, postX + 0.015, 0.87, maxZ - 0.1, mat(COLORS.rope), { collide: false }));
      barrierParts.push(box(boardX - 0.03, 0, zMid - 0.5, boardX + 0.03, 1.0, zMid + 0.5, mat(COLORS.safetyYellow), { collide: false }));
      barrierParts.push(sign('OUT OF ORDER', {
        x: boardX + out * 0.035, y: 0.62, z: zMid, width: 0.92, height: 0.5, facing,
        background: '#ffd23f', color: '#1d1626',
      }));
    }
    // The Promenade can be reached via the Atrium before this repair is bought.
    // Seal the upper landing too, with matching visible maintenance barriers.
    const topPostX = xAt(length - .3);
    if (sealed) {
      for (const z of [minZ + .1, maxZ - .1]) {
        barrierParts.push(box(topPostX - .035, upperY, z - .035, topPostX + .035, upperY + 1, z + .035, mat(COLORS.metal), { collide: false }));
        barrierParts.push(box(topPostX - .12, upperY, z - .12, topPostX + .12, upperY + .04, z + .12, mat(COLORS.metal), { collide: false }));
      }
      barrierParts.push(box(topPostX - .015, upperY + .84, minZ + .1, topPostX + .015, upperY + .87, maxZ - .1, mat(COLORS.rope), { collide: false }));
      barrierParts.push(box(topPostX - .03, upperY, zMid - .5, topPostX + .03, upperY + 1, zMid + .5, mat(COLORS.safetyYellow), { collide: false }));
      barrierParts.push(sign('OUT OF ORDER', {
        x: topPostX + dir * .035, y: upperY + .62, z: zMid, width: .92, height: .5,
        facing: dir > 0 ? 'x+' : 'x-', background: '#ffd23f', color: '#1d1626',
      }));
    }
    for (const part of barrierParts) part.userData.dynamic = true; // (hidden when repaired: never merged into a static batch)
    const hangX = xAt(-0.1);
    if (hangingSign) {
      sign('ESCALATOR · LEVEL 2', {
        x: hangX, y: 3.3, z: zMid, width: 2.4, height: 0.45, facing,
        background: '#1d1626', color: '#ffd23f',
      });
      for (const z of [zMid - 1.0, zMid + 1.0]) {
        box(hangX - 0.01, 3.52, z - 0.01, hangX + 0.01, ceilingY, z + 0.01, mat(COLORS.metal), { collide: false });
      }
    }

    // Colliders. The slope is WALKABLE (once the barrier is gone): a ramp surface the feet follow (world/collision.js) with
    // boxes round it: two side walls (1.5 m above the surface: no climbing out), and blocks under the lane so nobody walks
    // under the low part (the high part is overhead: walk under it). Blocks under the lane stay below the surface, so they
    // never get in the way of a rider.
    const sideWidth = 0.3;
    const laneMin = minZ + sideWidth;
    const laneMax = maxZ - sideWidth;
    const wallAbove = 1.5;
    const underLane = 0.4; // blocks under the lane stay this far below the ramp surface at their start
    // The barrier across the foot (too tall to jump). Returned: whoever repairs the escalator removes it.
    [x0, x1] = span(-0.7, 0);
    const barrier = sealed ? addCollider(x0, 0, minZ, x1, 1.25, maxZ) : null; // (an unsealed escalator works from the start)
    [x0, x1] = span(length - .45, length);
    const upperBarrier = sealed ? addCollider(x0, upperY, minZ, x1, upperY + 1.5, maxZ) : null;
    // The foot barrier's topper (unseen, shot-through): a planter beside the escalator is a step up onto a 1.25 m barrier. It goes with the barrier.
    const barrierCap = barrier ? addCollider(barrier.min.x, 1.25, minZ, barrier.max.x, 1.25 + perchCap, maxZ) : null;
    if (barrierCap) barrierCap.ignoreShots = true;
    const barriers = [barrier, barrierCap, upperBarrier].filter(Boolean);
    // Side walls: the bottom landing, the slope in segments, the top landing.
    const sides = (ua, ub, bottom, top) => {
      [x0, x1] = span(ua, ub);
      addCollider(x0, bottom, minZ, x1, top, minZ + sideWidth);
      addCollider(x0, bottom, maxZ - sideWidth, x1, top, maxZ);
      // Their toppers (unseen, shot-through): from outside the walls step up like stairs (1.62 m, then 0.58 m each), a way up a
      // sealed escalator and a perch no zombie reaches.
      addCollider(x0, top, minZ, x1, top + perchCap, minZ + sideWidth).ignoreShots = true;
      addCollider(x0, top, maxZ - sideWidth, x1, top + perchCap, maxZ).ignoreShots = true;
    };
    sides(0, landing, 0, plate + wallAbove);
    const segments = (u0, u1, n, raised) => {
      for (let i = 0; i < n; i++) {
        const ua = u0 + ((u1 - u0) * i) / n;
        const ub = u0 + ((u1 - u0) * (i + 1)) / n;
        sides(ua, ub, raised ? surface(ua) - truss : 0, surface(ub) + wallAbove);
        [x0, x1] = span(ua, ub);
        const top = surface(ua) - underLane; // (a rider's body reaches this far ahead: the block must stay under their feet)
        if (top > 0.02) addCollider(x0, raised ? surface(ua) - truss : 0, laneMin, x1, top, laneMax);
      }
    };
    segments(landing, uOpen, 5, false); // low part: solid to the floor under the lane
    segments(uOpen, slopeEnd, 5, true); // high part: overhead, walk under it
    sides(slopeEnd, length, upperY - truss, upperY + wallAbove);
    [x0, x1] = span(slopeEnd, length);
    addCollider(x0, upperY - truss, laneMin, x1, upperY - underLane, laneMax);

    // The walkable surface: the bottom plate, the slope, the top plate.
    [x0, x1] = span(0, length);
    const ramp = kit.ramp({
      id: 'escalator', axis: 'x', origin: bottomX, dir,
      minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: laneMin, maxZ: laneMax,
      points: [[0, plate], [landing, plate], [slopeEnd, upperY], [length, upperY]],
    });

    // For zombie navigation (zombies/navigation.js): the ground floor and this one, joined by this ramp.
    const link = {
      id: 'escalator',
      lower: { x: xAt(0), z: zMid, floor: 0 }, upper: { x: xAt(length), z: zMid, floor: 1 },
      halfWidth: (laneMax - laneMin) / 2,
      profile: [[0, plate], [landing, plate], [slopeEnd, upperY], [length, upperY]], // the surface height along it
    };

    // Where the ceiling must be open: from where a rider's head would hit it to the top of the slope.
    const uHole = Math.max(landing, landing + (ceilingY - headroom - plate) / tan);
    // (It runs 0.4 m past the top of the slope: a rider's body reaches ahead of their feet, and must not meet the slab's edge
    // while still a little below the upper floor.)
    [x0, x1] = span(uHole, Math.min(length, slopeEnd + 0.4));
    const hole = { minX: x0, maxX: x1, minZ: minZ - 0.3, maxZ: maxZ + 0.3 };
    [x0, x1] = span(slopeEnd, length);
    return { hole, topLanding: { minX: x0, maxX: x1 }, barrier, barriers, barrierParts, ramp, link, upperY, foot: { x: xAt(-0.8), z: zMid } };
  }

  /**
   * A glass balustrade standing on a floor at `floorY`, filling x0..x1 / z0..z1 (thin along one axis): solid to walking
   * (1.5m: taller than a jump peaks), see-through, and bullets pass (ignoreShots). Used round escalator wells and balconies.
   * `ledge`: a jump at it climbs over and drops to the floor below (player/vault.js), if there is open floor to land on.
   */
  function railing(x0, z0, x1, z1, floorY) {
    const collider = addCollider(x0, floorY, z0, x1, floorY + 1.5, z1);
    collider.ignoreShots = true;
    collider.ledge = true;
    const thinX = x1 - x0 < z1 - z0; // the glass is inset on the thin side
    const glass = mat(COLORS.balustradeGlass, { transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false });
    box(x0 + (thinX ? 0.04 : 0), floorY + 0.05, z0 + (thinX ? 0 : 0.04), x1 - (thinX ? 0.04 : 0), floorY + 1.0, z1 - (thinX ? 0 : 0.04), glass, { collide: false });
    box(x0 - 0.02, floorY + 1.0, z0 - 0.02, x1 + 0.02, floorY + 1.08, z1 + 0.02, mat(COLORS.balustradeRail), { collide: false, name: 'handrail' });
  }

  /**
   * Elevator doors on a wall (decorative and sealed for now: taped off, OUT OF ORDER). A steel
   * frame, two door leaves, a floor indicator, a call button and an ELEVATOR sign.
   *   along/wallAt/facing as for shopFront; `center` = middle of the doors along the wall.
   */
  function elevatorDoors({ along, center, wallAt, facing, width = 2.2, height = 2.5, floor = '1' }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    const half = width / 2;
    const signAt = (u, y, offset) => (along === 'x'
      ? { x: u, y, z: d(offset), facing }
      : { x: d(offset), y, z: u, facing: facing > 0 ? 'x+' : 'x-' });
    place(center - half - 0.15, 0, center + half + 0.15, height + 0.15, d(0), d(0.05), mat(COLORS.elevatorFrame), { collide: false });
    place(center - half, 0, center - 0.02, height, d(0.05), d(0.09), mat(COLORS.elevatorSteel, { metalness: 0.4, roughness: 0.35 }), { collide: false });
    place(center + 0.02, 0, center + half, height, d(0.05), d(0.09), mat(COLORS.elevatorSteel, { metalness: 0.4, roughness: 0.35 }), { collide: false });
    // Caution tape across the doors
    for (const y of [1.05, 1.95]) place(center - half - 0.1, y, center + half + 0.1, y + 0.08, d(0.09), d(0.11), mat(COLORS.safetyYellow), { collide: false });
    sign('OUT OF ORDER', { ...signAt(center, 1.5, 0.12), width: 1.3, height: 0.42, background: '#f1faee', color: '#1d1626' });
    // Floor indicator above the doors, and the call button beside them
    place(center - 0.4, height + 0.25, center + 0.4, height + 0.65, d(0), d(0.06), mat(COLORS.indicator), { collide: false });
    sign(floor, { ...signAt(center, height + 0.45, 0.07), width: 0.3, height: 0.3, background: '#111114', color: '#ffb000' });
    place(center + half + 0.3, 1.0, center + half + 0.55, 1.45, d(0), d(0.04), mat(COLORS.elevatorSteel), { collide: false });
    place(center + half + 0.38, 1.15, center + half + 0.47, 1.25, d(0.04), d(0.06), mat(COLORS.rope, { emissive: COLORS.rope, emissiveIntensity: 0.5 }), { collide: false });
    sign('ELEVATOR', { ...signAt(center, height + 0.95, 0.02), width: 1.6, height: 0.35, background: '#1d1626', color: '#ffffff' });
  }

  // --- Food Court: stalls, tables, bins ------------------------------------------

  /**
   * A food stall against a wall: colored facade with the stall's name and a menu board, a striped
   * awning, side partitions, a front counter (sneeze guard, register, food) and cooking gear
   * behind it. The whole stall, wall to counter front, is ONE solid block 1.2m tall: taller than a
   * jump plus the step-up tolerance, so nobody can stand on the counter or hide behind it (no
   * pockets zombies can't reach).
   *   along/from/to/wallAt/facing as for shopFront; depth = how far the counter sticks out.
   *   colors: { main, accent, awning: [a, b], signBackground, signText }; name; menu (text)
   *   gear: what's behind the counter, left to right: 'grill' | 'fryer' | 'wok' | 'soda' | 'shake'
   *   theme: a key of mall/stallThemes.js, extra decoration that makes the stall look like what it is named
   */
  function foodStall({ along = 'x', from, to, wallAt, facing, depth = 1.3, name, menu, colors, gear = [], theme }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    const flat = { collide: false };
    const counterHeight = 1.2;
    const [c0, c1] = [d(0), d(depth)].sort((a, b) => a - b);
    if (along === 'x') addCollider(from, 0, c0, to, counterHeight, c1);
    else addCollider(c0, 0, from, c1, counterHeight, to);

    place(from, 0, to, 4.7, d(0), d(0.1), mat(colors.main), { ...flat, name: `stall_${name}` }); // facade
    for (const [u0, u1] of [[from, from + 0.12], [to - 0.12, to]]) {
      place(u0, 0, u1, 2.9, d(0.1), d(depth), mat(colors.accent), flat); // side partitions
    }
    place(from + 0.12, 0, to - 0.12, counterHeight - 0.06, d(depth - 0.6), d(depth), mat(colors.accent), flat); // counter
    place(from + 0.08, counterHeight - 0.06, to - 0.08, counterHeight, d(depth - 0.65), d(depth + 0.05), mat(COLORS.stainless), flat);
    place(from + 0.3, counterHeight, to - 0.3, counterHeight + 0.35, d(depth - 0.32), d(depth - 0.29),
      mat(COLORS.balustradeGlass, { transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false }), flat); // sneeze guard
    place(to - 0.75, counterHeight, to - 0.35, counterHeight + 0.26, d(depth - 0.55), d(depth - 0.35), mat(COLORS.register), flat);
    place(to - 1.02, counterHeight, to - 0.84, counterHeight + 0.22, d(depth - 0.48), d(depth - 0.32), mat(COLORS.stainless), flat); // napkin dispenser
    place(from + 0.2, counterHeight, from + 0.34, counterHeight + 0.32, d(depth - 0.5), d(depth - 0.36), mat(colors.main), flat); // stacked soda cups
    place(from + 0.22, 2.15, to - 0.22, 2.48, d(0.1), d(0.72), mat(COLORS.stainless), flat); // stainless kitchen exhaust hood
    // Food on the counter (a few trays)
    const rand = seededRandom(Math.floor(Math.abs(from * 31 + to * 7)) + 1);
    for (let u = from + 0.5; u < to - 1.0; u += 0.55) {
      place(u, counterHeight, u + 0.38, counterHeight + 0.03, d(depth - 0.25), d(depth - 0.02), mat(COLORS.shopFrame), flat);
      const food = COLORS.foodItems[Math.floor(rand() * COLORS.foodItems.length)];
      place(u + 0.08, counterHeight + 0.03, u + 0.3, counterHeight + 0.03 + 0.06 + rand() * 0.08, d(depth - 0.2), d(depth - 0.07), mat(food), flat);
    }
    // Cooking gear against the back wall, spread across the stall
    const slot = (to - from - 0.4) / Math.max(1, gear.length);
    gear.forEach((kind, i) => {
      const u0 = from + 0.2 + i * slot + 0.1;
      const u1 = u0 + slot - 0.2;
      const back = [d(0.1), d(0.65)];
      if (kind === 'shake') {
        // milkshake machine: a stainless body, a glowing pink flavour panel, three spindles over a tray of cups
        place(u0, 0, u1, 1.45, ...back, mat(COLORS.stainless), flat);
        place(u0 + 0.08, 0.95, u1 - 0.08, 1.35, d(0.65), d(0.67), mat(0xff7eb6, { emissive: 0xff7eb6, emissiveIntensity: 0.45 }), flat);
        for (let k = 0; k < 3; k++) {
          const sx = u0 + (u1 - u0) * (0.2 + 0.3 * k);
          place(sx, 1.45, sx + 0.05, 1.7, d(0.3), d(0.35), mat(COLORS.elevatorSteel), flat);
          place(sx - 0.04, 1.62, sx + 0.09, 1.7, d(0.27), d(0.38), mat(0xfff3e0), flat);
        }
      } else if (kind === 'soda') {
        place(u0, 0, u1, 1.7, ...back, mat(COLORS.elevatorSteel), flat);
        place(u0 + 0.08, 0.8, u1 - 0.08, 1.6, d(0.65), d(0.67), mat(colors.main, { emissive: colors.main, emissiveIntensity: 0.35 }), flat);
      } else {
        place(u0, 0, u1, 0.9, ...back, mat(kind === 'fryer' ? COLORS.stainless : COLORS.grill), flat);
        const top = kind === 'fryer' ? COLORS.fryerOil : COLORS.hotPlate;
        place(u0 + 0.08, 0.9, u1 - 0.08, 0.92, d(0.18), d(0.57), mat(top, { emissive: top, emissiveIntensity: kind === 'fryer' ? 0.15 : 0.6 }), flat);
        if (kind === 'wok') place(u0 + 0.15, 0.92, u1 - 0.15, 1.05, d(0.25), d(0.5), mat(COLORS.handrail), flat);
      }
    });
    // Striped awning over the counter
    const stripe = 0.5;
    for (let u = from, i = 0; u < to - 1e-6; u += stripe, i++) {
      place(u, 2.95, Math.min(to, u + stripe), 3.05, d(0.1), d(depth + 0.35), mat(colors.awning[i % 2]), flat);
    }
    // The stall's own theme (barn, ...) decorates it further, round the name sign
    stallThemes[theme]?.({ place, d, mat, from, to, mid: (from + to) / 2, depth, counterHeight,
      sign: { width: to - from - 0.5, y: 3.9, height: 0.8 }, colors });
    // Name sign up top, menu board under the awning line
    const mid = (from + to) / 2;
    const at = (offset) => (along === 'x' ? { x: mid, z: d(offset), facing } : { x: d(offset), z: mid, facing: facing > 0 ? 'x+' : 'x-' });
    sign(name, { ...at(0.12), y: 3.9, width: to - from - 0.5, height: 0.8, background: colors.signBackground, color: colors.signText });
    sign(menu, { ...at(0.12), y: 2.25, width: to - from - 1.0, height: 0.5, background: '#1d1626', color: '#f1faee' });
  }

  /**
   * A round food-court table (0.75m) with four stools (0.45m) around it. Three colliders: the
   * table and a "plus" of two low strips under the stools (the corners stay open), so you can hop
   * onto a stool then the table; zombies walk round it (and still reach you up there).
   */
  function tableSet(cx, cz, { stoolColor = COLORS.stool } = {}) {
    addCollider(cx - 0.4, 0, cz - 0.4, cx + 0.4, 0.75, cz + 0.4);
    addCollider(cx - 0.25, 0, cz - 0.85, cx + 0.25, 0.45, cz + 0.85);
    addCollider(cx - 0.85, 0, cz - 0.25, cx + 0.85, 0.45, cz + 0.25);
    const disc = (radius, height, y, x, z, material) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 10), material);
      mesh.position.set(x, y, z);
      group.add(mesh);
    };
    disc(0.5, 0.05, 0.725, cx, cz, mat(COLORS.tableTop));
    box(cx - 0.05, 0.04, cz - 0.05, cx + 0.05, 0.7, cz + 0.05, mat(COLORS.tableLeg), { collide: false });
    disc(0.25, 0.04, 0.02, cx, cz, mat(COLORS.tableLeg));
    for (const [dx, dz] of [[0.62, 0], [-0.62, 0], [0, 0.62], [0, -0.62]]) {
      disc(0.2, 0.06, 0.42, cx + dx, cz + dz, mat(stoolColor));
      box(cx + dx - 0.03, 0.03, cz + dz - 0.03, cx + dx + 0.03, 0.39, cz + dz + 0.03, mat(COLORS.tableLeg), { collide: false });
      disc(0.14, 0.03, 0.015, cx + dx, cz + dz, mat(COLORS.tableLeg));
    }
  }

  /** A trash can (solid, 0.9m). */
  function trashCan(x, z) {
    addCollider(x - 0.25, 0, z - 0.25, x + 0.25, 0.9, z + 0.25);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.85, 10), mat(COLORS.trashCan));
    can.position.set(x, 0.425, z);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 10), mat(COLORS.shopFrame));
    lid.position.set(x, 0.87, z);
    group.add(can, lid);
  }

  // --- Service Corridor (back of house) ------------------------------------------

  /** A bank of staff lockers against a wall, from..to along it (solid, 1.9m: not climbable). */
  function lockerBank({ along, from, to, wallAt, facing, depth = 0.45, height = 1.9 }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    const [a, b] = [d(0), d(depth)].sort((x, y) => x - y);
    if (along === 'x') addCollider(from, 0, a, to, height, b);
    else addCollider(a, 0, from, b, height, to);
    const count = Math.max(1, Math.round((to - from) / 0.5));
    const each = (to - from) / count;
    for (let i = 0; i < count; i++) {
      const u0 = from + i * each;
      place(u0 + 0.01, 0, u0 + each - 0.01, height, d(0), d(depth), mat(COLORS.locker), { collide: false });
      for (const y of [height - 0.35, height - 0.25, height - 0.15]) {
        place(u0 + 0.12, y, u0 + each - 0.12, y + 0.04, d(depth), d(depth + 0.01), mat(COLORS.lockerVent), { collide: false });
      }
      place(u0 + each - 0.12, height * 0.5, u0 + each - 0.08, height * 0.5 + 0.12, d(depth), d(depth + 0.02), mat(COLORS.metal), { collide: false });
    }
  }

  /** An electrical panel on a wall with a warning sign (decorative; the future "power" switch spot). */
  function electricalPanel({ along, center, wallAt, facing, y = 1.5 }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    place(center - 0.4, y - 0.6, center + 0.4, y + 0.6, d(0), d(0.14), mat(COLORS.electricalPanel), { collide: false });
    place(center - 0.32, y - 0.5, center + 0.32, y + 0.4, d(0.14), d(0.15), mat(COLORS.metal), { collide: false });
    place(center + 0.18, y - 0.1, center + 0.24, y + 0.15, d(0.15), d(0.22), mat(COLORS.rope), { collide: false }); // the lever
    const at = along === 'x' ? { x: center, z: d(0.16), facing } : { x: d(0.16), z: center, facing: facing > 0 ? 'x+' : 'x-' };
    sign('DANGER · HIGH VOLTAGE', { ...at, y: y + 0.82, width: 0.9, height: 0.22, background: '#ffd23f', color: '#1d1626' });
  }

  /** Exposed pipes running along a wall near the ceiling, from..to along it (decorative). */
  function pipeRun({ along, from, to, wallAt, facing, y }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    place(from, y, to, y + 0.1, d(0.05), d(0.15), mat(COLORS.pipeGrey), { collide: false });
    place(from, y + 0.16, to, y + 0.24, d(0.08), d(0.16), mat(COLORS.pipeRed), { collide: false });
  }

  /**
   * The ammo cache: a vending machine against a wall (solid, 1.95m: not climbable). `along` is the wall's direction
   * (like the other wall props), `center` is where it sits along the wall, `facing` (+1 / -1) is the way its front faces.
   * Returns { position, normal }: the buy spot on its front (the interaction point) and the outward direction.
   */
  function vendingMachine({ along, center, wallAt, facing, width = 1.1, depth = 0.6, height = 1.95, name = 'STAPLE-O-MAT' }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    const u0 = center - width / 2;
    const u1 = center + width / 2;
    // The solid body.
    place(u0, 0, u1, height, d(0), d(depth), mat(COLORS.vendBody), { name: 'vending_body' });
    // Yellow trim top and bottom.
    place(u0, 0, u1, 0.12, d(depth), d(depth + 0.01), mat(COLORS.vendTrim), { collide: false });
    place(u0, height - 0.28, u1, height, d(depth), d(depth + 0.01), mat(COLORS.vendTrim), { collide: false });
    // The lit product window (unlit material: it glows) with shelves of little boxes.
    const winU0 = u0 + 0.08;
    const winU1 = u0 + width * 0.64;
    place(winU0, 0.5, winU1, 1.62, d(depth), d(depth + 0.015), new THREE.MeshBasicMaterial({ color: COLORS.vendGlow }), { collide: false });
    const rand = seededRandom(31);
    for (let row = 0; row < 4; row++) {
      const y = 0.6 + row * 0.26;
      place(winU0, y + 0.2, winU1, y + 0.215, d(depth + 0.015), d(depth + 0.04), mat(COLORS.vendGlass), { collide: false }); // shelf lip
      const count = 4;
      const each = (winU1 - winU0 - 0.08) / count;
      for (let i = 0; i < count; i++) {
        const color = COLORS.products[Math.floor(rand() * COLORS.products.length)];
        place(winU0 + 0.05 + i * each, y, winU0 + 0.05 + (i + 0.8) * each, y + 0.17, d(depth + 0.015), d(depth + 0.06), mat(color), { collide: false });
      }
    }
    // Control column: a keypad, a coin slot and the delivery flap.
    const colU0 = u0 + width * 0.7;
    const colU1 = u1 - 0.07;
    place(colU0, 1.0, colU1, 1.55, d(depth), d(depth + 0.02), mat(COLORS.vendGlass), { collide: false }); // panel
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const ku = colU0 + 0.04 + c * ((colU1 - colU0 - 0.08) / 2);
        place(ku, 1.1 + r * 0.13, ku + 0.07, 1.18 + r * 0.13, d(depth + 0.02), d(depth + 0.035), mat(COLORS.metal), { collide: false });
      }
    }
    place(colU0 + 0.03, 0.82, colU1 - 0.03, 0.9, d(depth), d(depth + 0.02), mat(COLORS.vendSlot), { collide: false }); // coin slot
    place(u0 + 0.12, 0.14, u1 - 0.12, 0.42, d(depth), d(depth + 0.03), mat(COLORS.vendSlot), { collide: false }); // delivery flap
    // Header sign.
    const at = along === 'x' ? { x: center, z: d(depth + 0.02), facing } : { x: d(depth + 0.02), z: center, facing: facing > 0 ? 'x+' : 'x-' };
    sign(name, { ...at, y: height - 0.14, width: width - 0.1, height: 0.2, background: '#1d1626', color: '#ffd23f' });
    // Where the player buys: on the keypad column, just in front of the machine.
    const front = d(depth + 0.04);
    const mid = colU0 + (colU1 - colU0) / 2;
    const position = along === 'x' ? new THREE.Vector3(mid, 1.3, front) : new THREE.Vector3(front, 1.3, mid);
    const normal = along === 'x' ? new THREE.Vector3(0, 0, facing) : new THREE.Vector3(facing, 0, 0);
    return { position, normal };
  }

  /**
   * A shop clerk: a zombie in an apron standing behind a counter, facing into the room (a harmless prop).
   * Taller than the counter, so you see torso and head over it. `depth` = how far out from the wall it stands.
   * Decoration only (no collider; nobody can reach the space behind a counter).
   */
  function clerk({ along, center, wallAt, facing, depth = 0.5, apron = 0xd62839, hair = 0x6b6b6b }) {
    const d = (offset) => wallAt + facing * offset;
    const x = along === 'x' ? center : d(depth);
    const z = along === 'x' ? d(depth) : center;
    // buildClerkFigure faces -Z at rotationY = 0
    const rotationY = along === 'x'
      ? (facing > 0 ? Math.PI : 0)
      : (facing > 0 ? -Math.PI / 2 : Math.PI / 2);
    return buildClerkFigure({ group, mat, x, z, rotationY, apron, hair });
  }

  /**
   * The Customer Service booth (Extended Warranty tiers): a small walled office against a wall with a service
   * window and counter, a zombie clerk, a computer and filing cabinets visible through the glass, a big
   * CUSTOMER SERVICE sign on top, "NOW SERVING" above the window and a sticker per tier on the counter.
   * You buy at the window; nobody goes inside: ONE solid full-height collider wall-to-counter (so it can't be
   * climbed, and moving it along its wall never needs room behind it). Returns { position, normal }: the buy spot.
   */
  function serviceDesk({ along, center, wallAt, facing, width = 3.6, depth = 1.6, meleeOffset = 1.25, tierColors = [] }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    const u0 = center - width / 2;
    const u1 = center + width / 2;
    const H = 3.0;
    const ledge = 0.3;
    const signAt = (u, y, offset) => (along === 'x'
      ? { x: u, y, z: d(offset), facing }
      : { x: d(offset), y, z: u, facing: facing > 0 ? 'x+' : 'x-' });
    const shell = mat(COLORS.deskBody);
    const o = { collide: false };
    // The one collider: the whole footprint, floor to the roof.
    addCollider(...(along === 'x'
      ? [u0, 0, Math.min(d(0), d(depth + ledge)), u1, H, Math.max(d(0), d(depth + ledge))]
      : [Math.min(d(0), d(depth + ledge)), 0, u0, Math.max(d(0), d(depth + ledge)), H, u1]));
    // Shell: end walls, the front panel under the window, piers either side of it, the strip above, the roof.
    place(u0, 0, u0 + 0.1, H, d(0), d(depth), shell, { ...o, name: 'service_booth' });
    place(u1 - 0.1, 0, u1, H, d(0), d(depth), shell, o);
    place(u0, 0, u1, 1.05, d(depth - 0.1), d(depth), shell, o);
    place(u0, 1.05, u0 + 0.3, 2.3, d(depth - 0.1), d(depth), shell, o);
    place(u1 - 0.3, 1.05, u1, 2.3, d(depth - 0.1), d(depth), shell, o);
    place(u0, 2.3, u1, H, d(depth - 0.1), d(depth), shell, o);
    place(u0, H, u1, H + 0.08, d(0), d(depth), mat(COLORS.deskKick), o);
    place(u0 - 0.05, 0, u1 + 0.05, 0.1, d(depth), d(depth + 0.02), mat(COLORS.deskKick), o); // kick plate
    // Counter top with a ledge to lean on, and glass above a 35cm service slot.
    place(u0 - 0.05, 1.05, u1 + 0.05, 1.11, d(depth - 0.5), d(depth + ledge), mat(COLORS.deskTop), o);
    place(u0 + 0.3, 1.4, u1 - 0.3, 2.3, d(depth - 0.06), d(depth - 0.04), mat(COLORS.caseGlass, { transparent: true, opacity: 0.25, roughness: 0.1 }), o);
    // Counter accessories: classic service call bell and warranty pamphlet holder on the customer ledge.
    place(center + 0.82, 1.11, center + 0.94, 1.13, d(depth + 0.06), d(depth + 0.18), mat(COLORS.register), o); // bell base
    place(center + 0.835, 1.13, center + 0.925, 1.185, d(depth + 0.075), d(depth + 0.165), mat(COLORS.deskBell), o); // bell dome
    place(center + 0.868, 1.185, center + 0.892, 1.202, d(depth + 0.108), d(depth + 0.132), mat(COLORS.metal), o); // bell button
    place(center - 1.14, 1.11, center - 0.94, 1.19, d(depth + 0.04), d(depth + 0.16), mat(COLORS.register), o); // pamphlet holder
    place(center - 1.12, 1.19, center - 0.96, 1.27, d(depth + 0.055), d(depth + 0.12), mat(0xf1faee), o); // pamphlets
    // Inside: a cream back wall, a desk with a computer, filing cabinets, a wall clock, schedule board, the clerk.
    place(u0 + 0.1, 0, u1 - 0.1, 2.9, d(0), d(0.03), mat(0xd9d2b8), o);
    place(u0 + 0.1, 0, u1 - 1.3, 0.8, d(0.1), d(0.6), mat(COLORS.woodDark), o); // back desk (ends where the cabinets start)
    place(center - 1.35, 0.8, center - 0.75, 0.84, d(0.15), d(0.5), mat(COLORS.register), o); // keyboard-ish
    place(center - 1.25, 0.84, center - 0.85, 1.12, d(0.3), d(0.34), mat(COLORS.register), o); // monitor
    place(center - 1.22, 0.87, center - 0.88, 1.09, d(0.34), d(0.35), new THREE.MeshBasicMaterial({ color: COLORS.registerScreen }), o);
    place(center - 0.58, 0.8, center - 0.3, 0.84, d(0.2), d(0.46), mat(COLORS.metal), o); // paper inbox tray
    place(center - 0.55, 0.84, center - 0.33, 0.87, d(0.23), d(0.43), mat(0xf1faee), o); // stacked forms
    place(center - 0.2, 0.8, center - 0.11, 0.91, d(0.32), d(0.41), mat(0xd62839), o); // coffee mug
    place(center - 0.68, 1.58, center + 0.18, 2.22, d(0.03), d(0.055), mat(COLORS.plank), o); // employee schedule corkboard
    place(center - 0.58, 1.72, center - 0.22, 2.1, d(0.055), d(0.068), mat(0xf1faee), o); // pinned schedule sheet
    place(center - 0.1, 1.84, center + 0.08, 2.02, d(0.055), d(0.068), mat(COLORS.safetyYellow), o); // sticky note
    for (const k of [0, 1]) {
      place(u1 - 0.7 - k * 0.55, 0, u1 - 0.2 - k * 0.55, 1.35, d(0.1), d(0.6), mat(0x8a8f96), o); // filing cabinets
      for (const y of [0.35, 0.8, 1.2]) place(u1 - 0.65 - k * 0.55, y, u1 - 0.25 - k * 0.55, y + 0.03, d(0.6), d(0.62), mat(0x4d5259), o); // drawer handles
    }
    place(center + 0.9, 1.9, center + 1.2, 2.2, d(0.03), d(0.06), mat(0xf1faee), o); // wall clock face
    place(center + 1.04, 2.0, center + 1.06, 2.14, d(0.06), d(0.07), mat(0x23262d), o);
    clerk({ along, center, wallAt, facing, depth: 0.85, apron: 0x2d6a4f });
    // Signs.
    place(u0 - 0.1, H + 0.08, u1 + 0.1, H + 0.9, d(depth - 0.3), d(depth), mat(0x1f1a24), o); // sign board standing on the roof
    sign('CUSTOMER SERVICE', { ...signAt(center, H + 0.5, depth + 0.01), width: width + 0.1, height: 0.62, background: '#1f1a24', color: '#7fe3e8', font: 'marquee' });
    sign('NOW SERVING  000', { ...signAt(center, 2.66, depth + 0.01), width: 1.5, height: 0.28, background: '#1d1626', color: '#ff6b5b' });
    sign('SHARPENING', { ...signAt(center + meleeOffset, 2.66, depth + 0.011), width: 0.88, height: 0.28, background: '#1d1626', color: '#ffd23f', font: 'industrial' }); // the box cutter window (its buy spot is below)
    sign('SECOND CHANCE', { ...signAt(center - meleeOffset, 2.66, depth + 0.011), width: 0.94, height: 0.28, background: '#1d1626', color: '#a4f3c4', font: 'dinerScript' });
    sign('EXTENDED WARRANTY · ASK HERE', { ...signAt(center, 0.4, depth + 0.011), width: width - 1.0, height: 0.26, background: '#f1faee', color: '#1d1626', font: 'typewriter' }); // (below the tier stickers: nothing shares a plane)
    const n = tierColors.length;
    const rightward = along === 'x' ? facing : -facing; // +1 if "along the wall" runs left to right for a customer
    tierColors.forEach((color, i) => {
      const u = center + rightward * (i - (n - 1) / 2) * 0.32; // Standard on the left ... Platinum on the right
      place(u - 0.12, 0.62, u + 0.12, 0.86, d(depth + 0.01), d(depth + 0.025), new THREE.MeshBasicMaterial({ color }), o);
    });
    // Where the player buys: the middle of the counter front, at counter height.
    const front = d(depth + ledge + 0.1);
    const buySpot = (u) => along === 'x' ? new THREE.Vector3(u, 1.1, front) : new THREE.Vector3(front, 1.1, u);
    const normal = along === 'x' ? new THREE.Vector3(0, 0, facing) : new THREE.Vector3(facing, 0, 0);
    return {
      position: buySpot(center), normal,
      meleePosition: buySpot(center + meleeOffset),
      secondChancePosition: buySpot(center - meleeOffset),
    };
  }

  /**
   * A store's attachment counter (gun upgrades). Shows each attachment as a big copy of the part that goes
   * on the gun (weapons/models/upgradeParts.js), with a name card.
   *   style 'case':     a glass display case standing in front of a shopfront (gap = how far out from the
   *                     wall, past the facade). ONE solid 1.25m collider (too tall to climb, like the desk).
   *   style 'pegboard': a pegboard on a wall with the parts hung on it (no depth to speak of: an aisle stays clear).
   * items: [{ id, name }] (config/upgrades.js attachments). Returns [{ id, position, normal }], one buy spot each,
   * spread along the wall in item order, left to right as a customer sees them.
   */
  function attachmentDisplay({ along, center, wallAt, facing, style = 'case', items, title, titleColor = '#ffd23f', gap = 0.25, width = 2.4, height = 1.25, capTo = null }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    const rightward = along === 'x' ? facing : -facing;
    const spacing = width / items.length;
    const uOf = (i) => center + rightward * (i - (items.length - 1) / 2) * spacing;
    const signAt = (u, y, offset) => (along === 'x'
      ? { x: u, y, z: d(offset), facing }
      : { x: d(offset), y, z: u, facing: facing > 0 ? 'x+' : 'x-' });
    const u0 = center - width / 2;
    const u1 = center + width / 2;
    let front; // how far the buy spots stand out from the wall
    let partY; // height of the displayed parts
    if (style === 'case') {
      const depth = 0.6;
      // Match the visible counter to its solid height, rather than blocking bullets above the glass.
      place(u0, 0, u1, height - 0.03, d(gap), d(gap + depth), mat(COLORS.caseBody), { collide: false, name: 'attachment_case' });
      place(u0, height - 0.03, u1, height, d(gap), d(gap + depth), mat(COLORS.caseGlass, { transparent: true, opacity: 0.45, roughness: 0.1 }), { collide: false, name: 'attachment_case_glass' });
      addCollider(...(along === 'x'
        ? [u0, 0, Math.min(d(gap), d(gap + depth)), u1, height, Math.max(d(gap), d(gap + depth))]
        : [Math.min(d(gap), d(gap + depth)), 0, u0, Math.max(d(gap), d(gap + depth)), height, u1]));
      // capTo (a height): an unseen, shot-through block from the glass up to there, where nobody may get over the case.
      if (capTo !== null) {
        addCollider(...(along === 'x'
          ? [u0, height, Math.min(d(gap), d(gap + depth)), u1, capTo, Math.max(d(gap), d(gap + depth))]
          : [Math.min(d(gap), d(gap + depth)), height, u0, Math.max(d(gap), d(gap + depth)), capTo, u1])).ignoreShots = true;
      }
      if (title) sign(title, { ...signAt(center, 0.35, gap + depth + 0.01), width: width - 0.3, height: 0.28, background: '#1d1626', color: titleColor });
      front = gap + depth + 0.1;
      partY = height - 0.03;
    } else {
      place(u0, 0.9, u1, 2.3, d(0), d(0.04), mat(COLORS.pegboard), { collide: false, name: 'attachment_pegboard' });
      const holes = mat(COLORS.pegboardHoles);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < Math.round(width / 0.2); col++) {
          const u = u0 + 0.1 + col * 0.2;
          place(u - 0.012, 0.98 + row * 0.24, u + 0.012, 1.004 + row * 0.24, d(0.04), d(0.042), holes, { collide: false });
        }
      }
      if (title) sign(title, { ...signAt(center, 2.15, 0.05), width: width - 0.2, height: 0.25, background: '#1d1626', color: titleColor });
      front = 0.5;
      partY = 1.55;
    }
    return items.map((item, i) => {
      const u = uOf(i);
      // The part, big, turned side-on so it reads as "this goes on a gun".
      const part = buildAttachmentPart(item.id, {}, { display: true });
      part.scale.setScalar(7);
      part.rotation.y = along === 'x' ? Math.PI / 2 : 0;
      part.position.copy(along === 'x' ? new THREE.Vector3(u, 0, d(front - 0.35)) : new THREE.Vector3(d(front - 0.35), 0, u));
      // Seat it: resting on the glass (case) or hung at eye level (pegboard), whatever its shape.
      part.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(part);
      part.position.y += style === 'case' ? height + 0.02 - bounds.min.y : 1.75 - (bounds.min.y + bounds.max.y) / 2;
      group.add(part);
      sign(item.name.toUpperCase(), { ...signAt(u, partY - 0.12 + (style === 'case' ? 0 : -0.18), style === 'case' ? front - 0.1 + 0.005 : 0.05), width: Math.min(spacing - 0.2, 1.7), height: 0.16, background: '#f1faee', color: '#1d1626' });
      const position = along === 'x' ? new THREE.Vector3(u, 1.1, d(front)) : new THREE.Vector3(d(front), 1.1, u);
      const normal = along === 'x' ? new THREE.Vector3(0, 0, facing) : new THREE.Vector3(facing, 0, 0);
      return { id: item.id, position, normal };
    });
  }

  return {
    shopFront, pillar, bench, planter, lightPanel, gondola, checkout, wallDoor, boardedVent, wallStripe,
    panels, escalator, railing, elevatorDoors, foodStall, tableSet, trashCan, lockerBank, electricalPanel, pipeRun, vendingMachine,
    serviceDesk, clerk, attachmentDisplay,
  };
}
