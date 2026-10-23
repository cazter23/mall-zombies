// =============================================================================
// THE HALLWAY LOOK (visual overhaul, the REFERENCE ROOM): neon signs and trim, painted light pools, a two-tone wall
// with a chrome rail, and clutter, on top of the hallway mall.js builds. Colours and amounts live in config/look.js.
// Decoration only: no colliders, nothing the game reads. The base surfaces (wall / floor / ceiling colours, the lamps)
// are set by mall.js from the same config.
//
// buildHallwayLook({ kit, layout, colliders, keepClear }) -> { update(dt), reset(), parts }
//   keepClear  rects clutter must stay out of (doorways, spawn points, buy spots, the escalator's foot)
// update(dt) animates the neon and follows the Graphics settings (look.runtime: neon glow, clutter density;
// atmosphere.ambient.enabled: flicker). Neon, pools and clutter are in groups flagged userData.dynamic, so static
// batching (world/staticBatch.js) leaves them alone and the settings can switch them.
// =============================================================================

import * as THREE from 'three';
import { createNeon } from '../../world/neon.js';
import { createDecorKit } from '../../world/decor.js';
import { scatter } from '../../world/scatter.js';
import { makeSoftFootprint } from '../../world/atmosphereTextures.js';
import { look } from '../../config/look.js';
import { atmosphere } from '../../config/environment.js';

export function buildHallwayLook({ kit, layout, colliders, keepClear = [] }) {
  const L = look.hallway;
  const H = layout.hallway;
  const T = layout.wallThickness;
  const { box, mat } = kit;

  const dynamicGroup = (name) => {
    const g = new THREE.Group();
    g.name = name;
    g.userData.dynamic = true;
    kit.group.add(g);
    return g;
  };

  // --- Two-tone wall: a near-black plum wainscot with a chrome rail, 2 cm proud, round every opening -------------------
  const wainscot = mat(L.wainscot, { roughness: 0.6 });
  const rail = mat(L.rail, { roughness: 0.25, metalness: 0.8 });
  const run = (along, from, to, wallAt, facing, gaps) => {
    let cursor = from;
    const pieces = [];
    for (const g of [...gaps].sort((a, b) => a[0] - b[0])) {
      if (g[0] > cursor) pieces.push([cursor, g[0]]);
      cursor = Math.max(cursor, g[1]);
    }
    if (cursor < to) pieces.push([cursor, to]);
    const a = wallAt;
    const b = wallAt + facing * 0.02;
    const c = wallAt + facing * 0.035;
    for (const [u0, u1] of pieces) {
      if (u1 - u0 < 0.05) continue;
      const place = (y0, y1, d0, d1, m) => (along === 'x'
        ? box(u0, y0, Math.min(d0, d1), u1, y1, Math.max(d0, d1), m, { collide: false, name: 'hallway_wainscot' })
        : box(Math.min(d0, d1), y0, u0, Math.max(d0, d1), y1, u1, m, { collide: false, name: 'hallway_wainscot' }));
      place(0, L.wainscotHeight, a, b, wainscot);
      place(L.wainscotHeight, L.wainscotHeight + 0.05, a, c, rail);
    }
  };
  const FD = layout.foodCourtDoorway;
  const MD = layout.megaMartDoorway;
  const SCD = layout.serviceCorridor.doorway;
  const gate = layout.atrium.gate;
  const desk = layout.serviceDesk;
  const elevatorX = layout.elevator.centerX;
  // North wall (z = H.maxZ, facing -Z): the start room's storefront, the Customer Service booth, the elevator, the atrium gate.
  run('x', H.minX, H.maxX, H.maxZ, -1, [
    [layout.startRoom.minX, layout.startRoom.maxX], [desk.center - 1.9, desk.center + 1.9], [elevatorX - 1.45, elevatorX + 1.45], [gate.from, gate.to],
  ]);
  // South wall (z = H.minZ, facing +Z): the Food Court gate, the Nail Gun wall buy (x 11).
  run('x', H.minX, H.maxX, H.minZ, 1, [[FD.minX, FD.maxX], [10, 12]]);
  // West wall (x = H.minX): the Service Corridor door. East wall (x = H.maxX): the Mega Mart gate.
  run('z', H.minZ, H.maxZ, H.minX, 1, [[SCD.minZ, SCD.maxZ]]);
  run('z', H.minZ, H.maxZ, H.maxX, -1, [[MD.minZ, MD.maxZ]]);

  // --- Neon: signs, the SUNSET GALLERIA centrepiece, trim tubes along the long walls ------------------------------------
  const neonGroup = dynamicGroup('hallway_neon');
  const neon = createNeon({ group: neonGroup });
  const S = L.signs;
  const north = H.maxZ - 0.04;
  const south = H.minZ + 0.04;
  neon.sign({ text: 'FOOD COURT', x: (FD.minX + FD.maxX) / 2, y: 4.3, z: south, facing: 1, height: 0.55, color: S.foodCourt, border: S.foodCourt, deadLetters: [7] });
  neon.sign({ text: 'MEGA MART', x: H.maxX - 0.04, y: 4.3, z: (MD.minZ + MD.maxZ) / 2, facing: 'x-', height: 0.55, color: S.megaMart, flickerLetters: [5] });
  neon.sign({ text: 'GRAND ATRIUM', x: (gate.from + gate.to) / 2, y: 4.3, z: north, facing: -1, height: 0.42, color: S.atrium, border: S.atrium });
  neon.sign({
    text: 'STAFF ONLY', x: H.minX + 0.04, y: 3.6, z: (SCD.minZ + SCD.maxZ) / 2, facing: 'x+', height: 0.22, color: S.staffOnly,
    flickerLetters: [0, 1, 2, 3, 4, 6, 7, 8, 9], flickerStyle: 'dying',
  });
  // The start room's storefront: "GO NG OUT OF BUS NESS" (two letters dead, one stuttering)
  neon.sign({ text: 'GOING OUT OF BUSINESS', x: 0, y: 3.95, z: north, facing: -1, height: 0.32, color: S.storefront, deadLetters: [2, 16], flickerLetters: [13] });
  // The centrepiece over the west half of the north wall: a setting neon sun between two palms, the mall's name below.
  const logoX = -11;
  neon.shape('sun', { x: logoX, y: 4.75, z: north, facing: -1, size: 1.5, color: S.sun });
  // (stars, not palms: at this size the neon palms read as glowing stick figures)
  neon.shape('star', { x: logoX - 3.6, y: 4.5, z: north, facing: -1, size: 1.0, color: S.palm });
  neon.shape('star', { x: logoX + 3.6, y: 4.5, z: north, facing: -1, size: 1.0, color: S.palm, flicker: true });
  neon.text('SUNSET GALLERIA', { x: logoX, y: 3.75, z: north, facing: -1, height: 0.42, color: S.logo, deadLetters: [9], flickerLetters: [3] });
  // Trim: one tube a little under the ceiling line on each long wall, in pieces (some dead, one stuttering).
  const trimY = L.trimY;
  const trim = (x0, x1, z, color, opts = {}) => neon.tube([[x0, trimY, z], [x1, trimY, z]], { color, ...opts });
  trim(H.minX + 0.4, -15.2, north, L.trim.north);
  trim(-6.8, layout.startRoom.minX - 0.3, north, L.trim.north, { dead: true }); // (behind the centrepiece's right palm: dead)
  trim(layout.startRoom.maxX + 0.3, desk.center - 2.1, north, L.trim.north);
  trim(gate.to + 0.3, H.maxX - 0.4, north, L.trim.north, { flicker: true });
  trim(H.minX + 0.4, FD.minX - 0.4, south, L.trim.south);
  trim(FD.maxX + 0.4, 9.6, south, L.trim.south, { flicker: true });
  trim(12.4, H.maxX - 0.4, south, L.trim.south);

  // --- Painted light: soft additive glows on the walls and floor under the neon (no real lights) ----------------------
  const poolGroup = dynamicGroup('hallway_light_pools');
  const soft = makeSoftFootprint();
  // A wash for long strips (under the trim tubes): bright along its top edge, fading downwards, the same all along.
  const washCanvas = document.createElement('canvas');
  washCanvas.width = 4;
  washCanvas.height = 64;
  const wc = washCanvas.getContext('2d');
  const fade = wc.createLinearGradient(0, 0, 0, 64);
  fade.addColorStop(0, 'rgba(255,255,255,0.85)');
  fade.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  wc.fillStyle = fade;
  wc.fillRect(0, 0, 4, 64);
  const wash = new THREE.CanvasTexture(washCanvas);
  wash.colorSpace = THREE.SRGBColorSpace;
  const poolMaterials = new Map();
  const poolMat = (color, opacity, texture = soft) => {
    const key = `${color}|${opacity}|${texture.uuid}`;
    if (!poolMaterials.has(key)) {
      poolMaterials.set(key, new THREE.MeshBasicMaterial({
        map: texture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
    }
    return poolMaterials.get(key);
  };
  // A glow on a wall (`facing` as for signs) or on the floor (facing 'floor'), centred at (x, y, z), w x h metres.
  const pool = (x, y, z, w, h, facing, color, opacity, texture) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), poolMat(color, opacity, texture));
    m.position.set(x, y, z);
    if (facing === 'floor') m.rotation.x = -Math.PI / 2;
    else if (facing === -1) m.rotation.y = Math.PI;
    else if (facing === 'x+') m.rotation.y = Math.PI / 2;
    else if (facing === 'x-') m.rotation.y = -Math.PI / 2;
    m.name = 'light_pool';
    poolGroup.add(m);
  };
  const P = L.pools;
  const wallIn = 0.015; // a hair in front of the wall (and behind the signs)
  // Signs: a halo on the wall behind, a pool on the floor in front.
  pool(0, 4.3, H.minZ + wallIn + 0.006, 7.5, 2.6, 1, S.foodCourt, P.wallOpacity);
  pool(0, 0.012, H.minZ + 2.2, 7, 4, 'floor', S.foodCourt, P.floorOpacity);
  pool(H.maxX - wallIn, 4.3, (MD.minZ + MD.maxZ) / 2, 6.5, 2.6, 'x-', S.megaMart, P.wallOpacity);
  pool(H.maxX - 2.2, 0.012, (MD.minZ + MD.maxZ) / 2, 4, 6.5, 'floor', S.megaMart, P.floorOpacity);
  pool((gate.from + gate.to) / 2, 4.3, H.maxZ - wallIn - 0.006, 6, 2.2, -1, S.atrium, P.wallOpacity); // (in front of the trim wash)
  pool(H.minX + wallIn, 3.6, (SCD.minZ + SCD.maxZ) / 2, 3, 1.2, 'x+', S.staffOnly, P.wallOpacity);
  pool(0, 3.95, H.maxZ - wallIn - 0.006, 9, 1.6, -1, S.storefront, P.wallOpacity);
  pool(logoX, 4.4, H.maxZ - wallIn - 0.006, 11, 3.4, -1, S.sun, P.wallOpacity);
  pool(logoX, 0.012, H.maxZ - 2.4, 11, 4.4, 'floor', S.palm, P.floorOpacity * 0.8);
  // Trim: a long thin wash on the wall just under each tube.
  pool(0, trimY - 0.45, H.maxZ - wallIn, (H.maxX - H.minX) - 1, 0.9, -1, L.trim.north, P.trimOpacity, wash);
  pool(0, trimY - 0.45, H.minZ + wallIn, (H.maxX - H.minX) - 1, 0.9, 1, L.trim.south, P.trimOpacity, wash);

  // --- Clutter along the walls: receipts, cups, goo puddles, glass... (never in doorways, spawns or buy spots) ----------
  const decorKit = createDecorKit();
  const clutter = scatter({
    kit: decorKit, area: { minX: H.minX + 0.3, maxX: H.maxX - 0.3, minZ: H.minZ + 0.3, maxZ: H.maxZ - 0.3, y: 0 },
    kinds: L.clutter.kinds, density: look.runtime.clutter, seed: L.clutter.seed, perSquareMeter: L.clutter.perSquareMeter,
    keepClear, colliders, parent: dynamicGroup('hallway_clutter'), name: 'hallway_clutter',
  });

  // --- Following the Graphics settings -------------------------------------------------------------------------------------
  let shown = null; // the settings as last applied
  function follow() {
    const glow = look.runtime.neonGlow;
    const flicker = atmosphere.ambient.enabled;
    const density = look.runtime.clutter;
    const key = `${glow}|${flicker}|${density}`;
    if (key === shown) return;
    shown = key;
    neon.setQuality({ halo: glow, flicker });
    poolGroup.visible = glow;
    clutter.setDensity(density);
  }
  follow();

  return {
    parts: { neon, clutter, pools: poolGroup },
    update(dt) {
      follow();
      neon.update(dt);
    },
    reset() {
      follow();
    },
  };
}
