// =============================================================================
// THE CONCOURSE PASS (config/concourse.js): what makes the mall read as a real 1986 mall, built once from data.
//   shopfronts   a run of sealed shops on Level 2: pilasters, header with the name, glass, a painted interior, a roller
//                gate, a blade sign hanging out over the door, and the shop's own light spilling onto the floor
//   vitrines     lit display windows from the hallway into the two Food Court pod stores
//   section      soffits along Level 2's long walls (the middle reads raised), the pink trim moved to their edge, a cove
//                of light past them, and a cornice topping the hallway
//   floors       border bands of contrasting terrazzo, sunburst medallions at the junctions, worn walking lanes
//   painted light  a soft pool under every lit ceiling panel, a reflection under every neon sign on a shiny floor
//   fixtures     PA speakers, smoke detectors and sprinklers down the ceilings, a drinking fountain with the restroom
//                sign, an ATM, fire alarm pulls, ashtray urns, a kiddie ride and a gumball machine
//   stories      half-eaten trays, a stroller, a mop bucket, balloons stuck to the skylight
//   campaign     FALL INTO SAVINGS '86 pennants and poster (one texture), garland draped on the balcony rails
//   wayfinding   a directory totem in the Atrium
// Decoration only, except the floor pieces noted (colliders like the trash cans: <= 1.1 m, or >= 2.1 m). Everything
// static uses plain materials so world/staticBatch.js merges it into the existing batches; the painted panels share
// one atlas per area and every glow set is one mesh, so the whole pass adds a handful of draw calls.
//
//   buildConcourse({ kit, looks, props, layout, upperY }) -> { level2Trim } (where the Promenade's trim tubes now run)
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { concourse as C, wayfinding } from '../../config/concourse.js';
import { createCanvasAtlas, atlasQuad } from '../../world/canvasAtlas.js';
import { paintInterior, paintShopSign, paintCampaign, paintMedallion } from '../../world/paintedInteriors.js';
import { atmosphere } from '../../config/environment.js';

const hexCss = (c) => `#${c.toString(16).padStart(6, '0')}`;

export function buildConcourse({ kit, looks, props, layout, upperY }) {
  const { box, mat, addCollider, group } = kit;
  const metal = (color) => mat(color, atmosphere.surfaces.metal);
  const L2 = layout.level2.rect;
  const roofY = upperY + layout.atrium.upperHeight;

  // --- Finding the floor (and how shiny it is) under a point: the topmost floor surface below it --------------------
  group.updateMatrixWorld(true);
  const floors = [];
  group.traverse((o) => { if (o.isMesh && /floor/i.test(o.name)) floors.push(o); });
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  function floorBelow(x, y, z, far = 7) {
    ray.set(from.set(x, y, z), down);
    ray.far = far;
    const hit = ray.intersectObjects(floors, false)[0];
    return hit ? { y: hit.point.y, roughness: hit.object.material?.roughness ?? 1 } : null;
  }

  const soft = looks.glowSet('panels', 'soft');
  const streaks = looks.glowSet('streaks', 'streak');

  // --- Shopfronts + vitrines: their painted panels (interiors and signs) all go on one atlas ---------------------------
  const S = C.shopfronts;
  const cells = [];
  const cell = (aspect, draw) => cells.push({ aspect, draw }) - 1;
  const shops = S.level2.map((shop) => {
    const w = shop.to - shop.from - 2 * S.pilaster, glassH = S.top - S.header - S.sill;
    return {
      ...shop, n: shop.wall === 'south' ? 1 : -1, wallZ: shop.wall === 'south' ? L2.minZ : L2.maxZ,
      interior: cell(w / glassH, (ctx, cw, ch) => paintInterior(ctx, cw, ch, { kind: shop.kind, light: shop.light, lit: shop.lit, seed: shop.from * 31 + 7 })),
      header: cell((w - 0.2) / (S.header - 0.1), (ctx, cw, ch) => paintShopSign(ctx, cw, ch, { name: shop.name, sub: shop.sub, ground: hexCss(shop.color), ink: shop.ink })),
      blade: cell(S.blade.width / S.blade.height, (ctx, cw, ch) => paintShopSign(ctx, cw, ch, { name: shop.name, ground: hexCss(shop.color), ink: shop.ink })),
      note: shop.note ? cell(3, (ctx, cw, ch) => paintShopSign(ctx, cw, ch, { name: shop.note, ground: '#f4f0e0', ink: '#3b2f44' })) : null,
    };
  });
  const windows = C.vitrines.map((v) => ({
    ...v, n: v.wall === 'south' ? 1 : -1, wallZ: v.wall === 'south' ? layout.hallway.minZ : layout.hallway.maxZ,
    interior: cell((v.to - v.from) / (v.top - v.sill), (ctx, cw, ch) => paintInterior(ctx, cw, ch, { kind: v.kind, light: v.light, lit: true, seed: v.from * 17 + 3 })),
    plate: cell(6, (ctx, cw, ch) => paintShopSign(ctx, cw, ch, { name: v.name, ground: hexCss(v.frame), ink: '#fff0d8' })),
  }));
  const atlas = createCanvasAtlas(cells);
  const painted = { level2: [], hallway: [] }; // atlas quads per area (one mesh each)
  const glass = []; // every pane, one see-through mesh
  const quad = (area, i, w, h, x, y, z, rotY = 0) => {
    const g = atlasQuad(w, h, atlas.uv(i));
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    painted[area].push(g);
  };
  const pane = (w, h, x, y, z, rotY) => {
    const g = new THREE.PlaneGeometry(w, h);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    glass.push(g);
  };
  // Boxes in wall coordinates: u along the wall (x), d out from it, y above `floorY`.
  const wallBox = (wallZ, n, floorY) => (u0, u1, y0, y1, d0, d1, material, name) => {
    const za = wallZ + n * d0, zb = wallZ + n * d1;
    return box(u0, floorY + y0, Math.min(za, zb), u1, floorY + y1, Math.max(za, zb), material, { collide: false, name });
  };

  const darkFrame = mat(0x2a2530);
  const chrome = metal(0xc9d2da);
  for (const shop of shops) {
    const n = shop.n, wb = wallBox(shop.wallZ, n, upperY), face = n > 0 ? 0 : Math.PI, P = S.pilaster, D = S.depth;
    const x0 = shop.from + P, x1 = shop.to - P, glassTop = S.top - S.header, mid = (x0 + x1) / 2, w = x1 - x0;
    wb(shop.from, x0, 0, S.top, 0, D, chrome, 'shopfront_pilaster');
    wb(x1, shop.to, 0, S.top, 0, D, chrome, 'shopfront_pilaster');
    wb(x0, x1, glassTop, S.top, 0.02, D, mat(shop.color), 'shopfront_header');
    wb(x0, x1, 0, S.sill, 0.02, D - 0.03, darkFrame, 'shopfront_kick');
    const panes = Math.max(1, Math.round(w / 1.6));
    for (let i = 1; i < panes; i++) { // mullions
      const u = x0 + (w * i) / panes;
      wb(u - 0.025, u + 0.025, S.sill, glassTop, D - 0.07, D - 0.03, darkFrame, 'shopfront_mullion');
    }
    if (shop.gate > 0) { // the roller gate, part (or all) of the way down, behind the glass
      const gateBottom = glassTop - shop.gate * (glassTop - S.sill);
      wb(x0 + 0.04, x1 - 0.04, gateBottom, glassTop, 0.06, 0.08, metal(0x9aa3ab), 'shopfront_gate');
      for (let y = gateBottom + 0.12; y < glassTop - 0.05; y += 0.16) wb(x0 + 0.04, x1 - 0.04, y, y + 0.02, 0.08, 0.09, darkFrame, 'shopfront_gate_slat');
    }
    const z = (d) => shop.wallZ + n * d;
    quad('level2', shop.interior, w, glassTop - S.sill, mid, upperY + (S.sill + glassTop) / 2, z(0.03), face);
    pane(w, glassTop - S.sill, mid, upperY + (S.sill + glassTop) / 2, z(D - 0.05), face);
    quad('level2', shop.header, w - 0.2, S.header - 0.1, mid, upperY + S.top - S.header / 2, z(D + 0.012), face);
    if (shop.note) quad('level2', shop.note, 0.9, 0.3, mid, upperY + 1.35, z(D - 0.04), face);
    // The blade sign: out over the door end (east end), double-sided, on a bracket from the wall.
    const B = S.blade, bx = x1 - 0.35, by = upperY + B.y, bz = z(B.out + B.width / 2);
    box(bx - 0.012, by - B.height / 2, Math.min(z(B.out), z(B.out + B.width)), bx + 0.012, by + B.height / 2,
      Math.max(z(B.out), z(B.out + B.width)), mat(shop.color), { collide: false, name: 'shopfront_blade' });
    box(bx - 0.02, by + B.height / 2, Math.min(z(0), z(B.out + B.width)), bx + 0.02, by + B.height / 2 + 0.04,
      Math.max(z(0), z(B.out + B.width)), chrome, { collide: false, name: 'shopfront_blade_bracket' });
    // (the quad faces +Z before turning: +PI/2 shows it to +X, -PI/2 to -X; both read left to right)
    quad('level2', shop.blade, B.width - 0.06, B.height - 0.06, bx + 0.014, by, bz, Math.PI / 2);
    quad('level2', shop.blade, B.width - 0.06, B.height - 0.06, bx - 0.014, by, bz, -Math.PI / 2);
    if (shop.lit) {
      const f = floorBelow(mid, upperY + 1, z(D + 0.3));
      if (f) streaks.add({ x: mid, y: f.y + C.glow.panels.lift, z: z(D + S.spill.depth / 2), width: w, depth: S.spill.depth,
        dir: [0, n], color: shop.light, strength: S.spill.strength });
    }
  }
  for (const v of windows) {
    const n = v.n, wb = wallBox(v.wallZ, n, 0), face = n > 0 ? 0 : Math.PI, mid = (v.from + v.to) / 2, w = v.to - v.from;
    const frame = mat(v.frame), t = 0.1;
    wb(v.from - t, v.from, v.sill - t, v.top + t, 0, 0.2, frame, 'vitrine_frame');
    wb(v.to, v.to + t, v.sill - t, v.top + t, 0, 0.2, frame, 'vitrine_frame');
    wb(v.from, v.to, v.top, v.top + t, 0, 0.2, frame, 'vitrine_frame');
    wb(v.from, v.to, v.sill - t, v.sill, 0, 0.2, frame, 'vitrine_frame');
    const z = (d) => v.wallZ + n * d;
    quad('hallway', v.interior, w, v.top - v.sill, mid, (v.sill + v.top) / 2, z(0.04), face);
    pane(w, v.top - v.sill, mid, (v.sill + v.top) / 2, z(0.16), face);
    quad('hallway', v.plate, Math.min(2.4, w * 0.7), 0.4, mid, v.sill - t - 0.25, z(0.025), face);
    const f = floorBelow(mid, 1, z(0.6));
    if (f) streaks.add({ x: mid, y: f.y + C.glow.panels.lift, z: z(0.2 + 1.1), width: w, depth: 2.2, dir: [0, n], color: v.light, strength: S.spill.strength * 0.8 });
  }
  const paintedMaterial = new THREE.MeshBasicMaterial({ map: atlas.texture, toneMapped: false });
  for (const [area, list] of Object.entries(painted)) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(list, false), paintedMaterial);
    mesh.name = `concourse_painted_${area}`;
    group.add(mesh);
  }
  if (glass.length) {
    const mesh = new THREE.Mesh(mergeGeometries(glass, false), new THREE.MeshStandardMaterial({
      color: 0xbfe6ef, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false,
    }));
    mesh.name = 'concourse_glass';
    group.add(mesh);
  }

  // --- The mall section: Level 2 soffits, the trim along their edge, the cove past them; the hallway cornice ----------
  const SO = C.soffits.level2, roomTop = layout.level2.height;
  const level2Trim = [];
  for (const wall of ['north', 'south']) {
    const n = wall === 'south' ? 1 : -1, wallZ = wall === 'south' ? L2.minZ : L2.maxZ, wb = wallBox(wallZ, n, upperY);
    for (const [a, b] of SO[wall]) {
      wb(a, b, SO.bottom, roomTop - 0.005, 0, SO.depth, mat(SO.color), 'level2_soffit');
      level2Trim.push({ from: a, to: b, z: wallZ + n * (SO.depth + 0.02), y: upperY + SO.bottom - SO.trimInset, wall });
      streaks.add({ x: (a + b) / 2, y: upperY + roomTop - 0.004, z: wallZ + n * (SO.depth + SO.cove.width / 2), width: b - a,
        depth: SO.cove.width, dir: [0, n], color: SO.cove.color, strength: SO.cove.strength, ceiling: true });
    }
  }
  const HC = C.soffits.hallway, H = layout.hallway;
  for (const wall of ['north', 'south']) {
    const n = wall === 'south' ? 1 : -1, wb = wallBox(wall === 'south' ? H.minZ : H.maxZ, n, 0);
    for (const [a, b] of HC[wall]) wb(a, b, HC.bottom, H.height - 0.01, 0, HC.depth, mat(HC.color), 'hallway_cornice');
  }

  // --- Floors: border bands, medallions, worn lanes ---------------------------------------------------------------------
  const F = C.floor;
  for (const band of F.bands) {
    const n = band.wall === 'south' ? 1 : -1;
    const f = floorBelow((band.from + band.to) / 2, band.y + 1, band.z + n * band.width / 2);
    const top = (f?.y ?? band.y) + F.bandLift;
    const z0 = Math.min(band.z, band.z + n * band.width), z1 = Math.max(band.z, band.z + n * band.width);
    kit.tiledFloor(band.from, z0, band.to, z1, band.tile, { top, thickness: F.bandLift, collide: false });
  }
  const medallionTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    paintMedallion(canvas.getContext('2d'), 256);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const medallionMaterial = new THREE.MeshStandardMaterial({ map: medallionTexture, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const m of F.medallions) {
    const f = floorBelow(m.x, m.y + 1, m.z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(m.radius, 32).rotateX(-Math.PI / 2), medallionMaterial);
    disc.position.set(m.x, (f?.y ?? m.y) + F.medallionLift, m.z);
    disc.name = `floor_medallion_${m.area}`;
    group.add(disc);
  }
  const smudge = (() => { // soft dark blotches: forty years of feet
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d');
    let seed = 41;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 60; i++) {
      const x = rand() * 128, y = rand() * 128, r = 6 + rand() * 18;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const lanes = F.lanes.map((l) => {
    const f = floorBelow((l.x0 + l.x1) / 2, l.y + 1, (l.z0 + l.z1) / 2);
    const g = new THREE.PlaneGeometry(l.x1 - l.x0, l.z1 - l.z0).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (l.x1 - l.x0) / 4, uv.getY(i) * (l.z1 - l.z0) / 4);
    return g.translate((l.x0 + l.x1) / 2, (f?.y ?? l.y) + F.laneLift, (l.z0 + l.z1) / 2);
  });
  const laneMesh = new THREE.Mesh(mergeGeometries(lanes, false), new THREE.MeshBasicMaterial({
    color: 0x000000, alphaMap: smudge, transparent: true, opacity: F.laneOpacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  laneMesh.name = 'floor_worn_lanes';
  group.add(laneMesh);

  // --- Painted light: pools under the lit panels, reflections under neon on shiny floors -------------------------------
  const G = C.glow;
  for (const p of props.panels) {
    if (p.dead) continue;
    const f = floorBelow((p.x0 + p.x1) / 2, p.ceilingY - 0.1, (p.z0 + p.z1) / 2, 6.2);
    if (!f) continue;
    soft.add({ x: (p.x0 + p.x1) / 2, y: f.y + G.panels.lift, z: (p.z0 + p.z1) / 2, width: (p.x1 - p.x0) * G.panels.scale,
      depth: (p.z1 - p.z0) * G.panels.scale, color: G.panels.color, strength: G.panels.strength });
  }
  const outOf = { 1: [0, 1], '-1': [0, -1], 'x+': [1, 0], 'x-': [-1, 0] };
  for (const s of looks.parts.neonPlacements) {
    const dir = outOf[s.facing];
    if (!dir) continue;
    const f = floorBelow(s.x + dir[0] * 0.4, s.y, s.z + dir[1] * 0.4, 6.5);
    if (!f || f.roughness > G.reflections.glossy) continue;
    const R = G.reflections;
    streaks.add({ x: s.x + dir[0] * (R.depth / 2 + 0.05), y: f.y + R.lift, z: s.z + dir[1] * (R.depth / 2 + 0.05),
      width: s.width * R.widthScale, depth: R.depth, dir, color: s.color ?? 0xff6fae, strength: R.strength });
  }

  // --- Fixtures --------------------------------------------------------------------------------------------------------
  const X = C.fixtures, white = mat(0xf2f0ea), grille = mat(0x55595c);
  const disc = (r, h, x, y, z, material, name, segments = 10) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), material);
    m.position.set(x, y, z);
    m.name = name;
    group.add(m);
    return m;
  };
  const nearPanel = (x, y, z) => props.panels.some((p) => Math.abs(p.ceilingY - y) < 0.25
    && x > p.x0 - 0.5 && x < p.x1 + 0.5 && z > p.z0 - 0.5 && z < p.z1 + 0.5);
  for (const row of X.ceilingRows) {
    let i = 0;
    for (let x = row.from; x <= row.to + 1e-6; x += row.every, i++) {
      if (nearPanel(x, row.y, row.z)) continue;
      const kind = i % 3;
      if (kind === 0) { // a PA speaker: the voice of management
        disc(0.17, 0.035, x, row.y - 0.0175, row.z, white, 'ceiling_speaker', 12);
        disc(0.12, 0.006, x, row.y - 0.038, row.z, grille, 'ceiling_speaker_grille', 12);
      } else if (kind === 1) {
        disc(0.07, 0.04, x, row.y - 0.02, row.z, white, 'smoke_detector');
      } else {
        disc(0.022, 0.05, x, row.y - 0.025, row.z, chrome, 'sprinkler', 6);
        disc(0.045, 0.006, x, row.y - 0.056, row.z, chrome, 'sprinkler_deflector', 8);
      }
    }
  }
  // The drinking fountain on the hallway's west wall, and the restroom sign pointing to the Service Corridor.
  const FO = X.fountain, ox = FO.x + 0.02;
  box(ox, 0, FO.z - 0.22, ox + 0.18, 0.72, FO.z + 0.22, mat(0xb8bec6), { collide: false, name: 'fountain_pedestal' });
  box(ox, 0.72, FO.z - 0.3, ox + 0.28, 0.9, FO.z + 0.3, chrome, { collide: false, name: 'fountain_basin' });
  box(ox + 0.14, 0.9, FO.z - 0.03, ox + 0.2, 0.96, FO.z + 0.03, chrome, { collide: false, name: 'fountain_spout' });
  kit.sign(FO.name, { x: FO.x + 0.025, y: 2.05, z: FO.signZ, width: 1.3, height: 0.32, facing: 'x+', ...wayfinding });
  // The ATM: a slab of a machine against the hallway's south wall.
  const A = X.atm, az = A.z;
  box(A.x - A.width / 2, 0, az, A.x + A.width / 2, 1.62, az + 0.25, mat(0x3a4250), { collide: false, name: 'atm_body' });
  box(A.x - 0.2, 1.12, az + 0.25, A.x + 0.2, 1.36, az + 0.262, mat(0x7fe0c4, { emissive: 0x7fe0c4, emissiveIntensity: 0.7 }), { collide: false, name: 'atm_screen' });
  box(A.x - 0.22, 0.86, az + 0.25, A.x + 0.22, 0.98, az + 0.29, grille, { collide: false, name: 'atm_keypad' });
  kit.sign('CASH · 24 HRS · SOMETIMES', { x: A.x, y: 1.5, z: az + 0.257, width: A.width - 0.06, height: 0.12, facing: 1, ...wayfinding });
  for (const p of X.pullStations) { // red fire alarm pulls by the exits
    const t = 0.04, red = mat(0xc8102e);
    if (p.wall === 'west') box(p.x, 1.1, p.z - 0.06, p.x + t, 1.28, p.z + 0.06, red, { collide: false, name: 'fire_pull' });
    else if (p.wall === 'east') box(p.x - t, 1.1, p.z - 0.06, p.x, 1.28, p.z + 0.06, red, { collide: false, name: 'fire_pull' });
    else box(p.x - 0.06, 1.1, p.z, p.x + 0.06, 1.28, p.z + t, red, { collide: false, name: 'fire_pull' });
  }
  for (const [x, y, z] of X.ashtrays) { // sand-topped urns (solid, like the trash cans)
    const f = floorBelow(x, y + 1, z);
    const base = f?.y ?? y;
    disc(0.15, 0.62, x, base + 0.31, z, mat(0x4a4246), 'ashtray_urn', 10);
    disc(0.13, 0.01, x, base + 0.625, z, mat(0xe8dcc0), 'ashtray_sand', 10);
    addCollider(x - 0.16, base, z - 0.16, x + 0.16, base + 0.63, z + 0.16);
  }
  { // the kiddie ride: a coin-op rocket on a base (solid and vaultable at 1.1 m)
    const K = X.kiddieRide, ride = new THREE.Group();
    ride.position.set(K.x, 0, K.z);
    ride.rotation.y = K.yaw;
    const part = (geo, color, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(geo, mat(color));
      m.position.set(x, y, z);
      m.rotation.x = rx;
      m.name = 'kiddie_ride';
      ride.add(m);
    };
    part(new THREE.BoxGeometry(0.62, 0.26, 1.0), 0x3a4a8a, 0, 0.13, 0);
    part(new THREE.CylinderGeometry(0.24, 0.24, 0.8, 10), 0xff6f91, 0, 0.62, 0, Math.PI / 2);
    part(new THREE.ConeGeometry(0.24, 0.36, 10), 0xffd23f, 0, 0.62, -0.58, -Math.PI / 2);
    part(new THREE.BoxGeometry(0.06, 0.34, 0.26), 0x9fe3ff, 0, 0.92, 0.3);
    part(new THREE.BoxGeometry(0.62, 0.06, 0.2), 0x9fe3ff, 0, 0.5, 0.34);
    part(new THREE.BoxGeometry(0.18, 0.16, 0.08), 0xd8dce4, 0.28, 0.4, 0.42);
    group.add(ride);
    addCollider(K.x - 0.5, 0, K.z - 0.5, K.x + 0.5, 1.1, K.z + 0.5).vaultable = true;
    const GB = X.gumball; // and a gumball machine beside it
    disc(0.12, 0.8, GB.x, 0.4, GB.z, mat(0xc8102e), 'gumball_stand', 10);
    disc(0.17, 0.2, GB.x, 0.9, GB.z, mat(0xc8102e), 'gumball_body', 10);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false }));
    globe.position.set(GB.x, 1.18, GB.z);
    globe.name = 'gumball_globe';
    group.add(globe);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = 0.11 * ((i % 3) / 3 + 0.3);
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), mat([0xffd23f, 0xff6fae, 0x7fe0c4, 0x9fe3ff][i % 4]));
      ball.position.set(GB.x + Math.cos(a) * r, 1.06 + (i % 5) * 0.04, GB.z + Math.sin(a) * r);
      ball.name = 'gumball';
      group.add(ball);
    }
    addCollider(GB.x - 0.2, 0, GB.z - 0.2, GB.x + 0.2, 1.1, GB.z + 0.2);
  }

  // --- Stories -----------------------------------------------------------------------------------------------------------
  const T = C.stories;
  for (const [x, z] of T.trays) { // a red tray, half a burger, fries, a cup (the table top is at 0.75)
    box(x - 0.22, 0.75, z - 0.16, x + 0.22, 0.77, z + 0.16, mat(0xc8102e), { collide: false, name: 'tray' });
    disc(0.07, 0.035, x - 0.1, 0.79, z, mat(0xd9a441), 'tray_burger', 8);
    box(x + 0.02, 0.77, z - 0.1, x + 0.1, 0.86, z - 0.04, mat(0xffd23f), { collide: false, name: 'tray_fries' });
    disc(0.045, 0.14, x + 0.13, 0.84, z + 0.07, mat(0xf2f2f2), 'tray_cup', 8);
  }
  { // a stroller nobody came back for
    const P = T.stroller, s = new THREE.Group();
    s.position.set(P.x, 0, P.z);
    s.rotation.y = P.yaw;
    const part = (w, h, d, color, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
      m.position.set(x, y, z);
      m.name = 'stroller';
      s.add(m);
    };
    part(0.42, 0.26, 0.6, 0x7a9cc6, 0, 0.55, 0);
    part(0.44, 0.04, 0.3, 0x5a7aa6, 0, 0.84, 0.18);
    part(0.04, 0.5, 0.04, 0x55595c, -0.2, 0.3, 0.3); part(0.04, 0.5, 0.04, 0x55595c, 0.2, 0.3, 0.3);
    part(0.04, 0.5, 0.04, 0x55595c, -0.2, 0.3, -0.25); part(0.04, 0.5, 0.04, 0x55595c, 0.2, 0.3, -0.25);
    part(0.46, 0.04, 0.04, 0x55595c, 0, 1.0, 0.42);
    part(0.04, 0.4, 0.04, 0x55595c, -0.2, 0.82, 0.38); part(0.04, 0.4, 0.04, 0x55595c, 0.2, 0.82, 0.38);
    group.add(s);
    addCollider(P.x - 0.4, 0, P.z - 0.45, P.x + 0.4, 0.95, P.z + 0.45).vaultable = true;
  }
  { // a mop bucket mid-job on Level 2
    const M = T.mopBucket, f = floorBelow(M.x, M.y + 1, M.z), y = f?.y ?? M.y;
    box(M.x - 0.22, y, M.z - 0.18, M.x + 0.22, y + 0.4, M.z + 0.18, mat(0xffc93d), { collide: false, name: 'mop_bucket' });
    box(M.x - 0.2, y + 0.4, M.z - 0.16, M.x + 0.2, y + 0.41, M.z + 0.16, mat(0x8a9a9c), { collide: false, name: 'mop_water' });
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.4, 0.035), mat(0xb08a5a));
    stick.position.set(M.x + 0.1, y + 0.9, M.z);
    stick.rotation.z = -0.35;
    stick.name = 'mop_stick';
    group.add(stick);
    addCollider(M.x - 0.24, y, M.z - 0.2, M.x + 0.24, y + 0.45, M.z + 0.2).vaultable = true;
  }
  for (const [x, z, color] of T.balloons) { // stuck to the Atrium skylight, strings hanging
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mat(color));
    b.position.set(x, roofY - 0.33, z);
    b.scale.y = 1.15;
    b.name = 'stuck_balloon';
    group.add(b);
    box(x - 0.005, roofY - 1.6, z - 0.005, x + 0.005, roofY - 0.62, z + 0.005, mat(0xf2f2f2), { collide: false, name: 'balloon_string' });
  }

  // --- The campaign: pennants and a poster (one texture, one merged mesh), garland on the balcony rails ----------------
  const K = C.campaign;
  const campaignCanvas = document.createElement('canvas');
  campaignCanvas.width = 256; campaignCanvas.height = 512;
  paintCampaign(campaignCanvas.getContext('2d'), 256, 512, K);
  const campaignTexture = new THREE.CanvasTexture(campaignCanvas);
  campaignTexture.colorSpace = THREE.SRGBColorSpace;
  const flags = [];
  const flag = (w, h, x, y, z, rotY) => {
    const g = new THREE.PlaneGeometry(w, h);
    if (rotY) g.rotateY(rotY);
    flags.push(g.translate(x, y, z));
  };
  for (const row of K.pennants) {
    for (const x of row.xs) {
      const h = row.height, w = K.pennant.width, cy = row.y - h / 2;
      flag(w, h, x, cy, row.z + 0.006, 0); // both faces (+Z and -Z), back to back
      flag(w, h, x, cy, row.z - 0.006, Math.PI);
      box(x - w / 2 - 0.03, row.y, row.z - 0.012, x + w / 2 + 0.03, row.y + 0.03, row.z + 0.012, chrome, { collide: false, name: 'pennant_rod' });
    }
  }
  for (const p of K.posters) {
    const rot = { 1: 0, '-1': Math.PI, 'x+': Math.PI / 2, 'x-': -Math.PI / 2 }[p.facing];
    flag(p.width, p.height, p.x, p.y, p.z, rot);
  }
  const campaign = new THREE.Mesh(mergeGeometries(flags, false), new THREE.MeshBasicMaterial({ map: campaignTexture, toneMapped: false }));
  campaign.name = 'campaign_pennants';
  group.add(campaign);
  const green = mat(0x2f6b3c), baubles = [mat(0xc8102e), mat(0xffd23f), mat(0x9fe3ff)];
  for (const gl of K.garlands) {
    const swags = Math.max(1, Math.round((gl.x1 - gl.x0) / gl.swag)), step = (gl.x1 - gl.x0) / swags;
    for (let i = 0; i < swags; i++) {
      const a = gl.x0 + i * step, b = a + step;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a, gl.y, gl.z), new THREE.Vector3((a + b) / 2, gl.y - gl.sag * 2, gl.z), new THREE.Vector3(b, gl.y, gl.z));
      const swag = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.055, 5), green);
      swag.name = 'garland';
      group.add(swag);
      const bauble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), baubles[i % 3]);
      bauble.position.set((a + b) / 2, gl.y - gl.sag - 0.09, gl.z);
      bauble.name = 'garland_bauble';
      group.add(bauble);
    }
  }

  // --- Wayfinding: a directory totem with YOU ARE HERE on both faces (2.2 m: too tall to stand on) ----------------------
  for (const t of C.totems) {
    box(t.x - 0.36, 0, t.z - 0.12, t.x + 0.36, 2.2, t.z + 0.12, mat(0x2b2233), { name: 'directory_totem' });
    for (const n of [1, -1]) {
      looks.poster('mallMap', { caption: 'YOU ARE HERE. THE EXITS ARE DECORATIVE.' }, t.x, 1.45, t.z + n * 0.13, 0.6, 0.9, n);
      kit.sign('DIRECTORY', { x: t.x, y: 2.02, z: t.z + n * 0.125, width: 0.62, height: 0.2, facing: n, ...wayfinding });
    }
  }

  soft.finish();
  streaks.finish();
  return { level2Trim };
}
