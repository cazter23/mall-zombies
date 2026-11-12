// =============================================================================
// HOFFMAN'S DETAIL PASS: stock, scenes and ceiling for the department store (data: config/departmentStoreDetails.js).
//   wall shelving   folded knits (west wall) and layaway bags (north wall): the only colliders here, solid to 2.2 m
//   counters        makeover easel, testers, tie carousel, the layaway ledger and bell
//   fitting rooms   the middle curtain pulled aside onto a mirror, hook and bench; one booth taped off; scratches; try-on pile
//   walls           full-length mirror, wall busts ("SPRING COLLECTION · 1987"), exit signs
//   ceiling         brass-edged beams, a hung sale banner, sprinklers and air diffusers
//   litter          a tipped mannequin, a dropped bag, a lone shoe, a flattened box and packing peanuts
//   ambience        muffled music and air handling emitters (the existing spatial voices)
// Everything else is decoration (no collision, lights or timers): small static boxes the static batcher merges, all owned by the
// map kit. Floor litter is under 0.12 m and kept off the walking lanes; tests check that against the actual triangles.
//
//   buildDepartmentStoreDetails({ kit, layout }) -> { emitters }
// =============================================================================

import * as THREE from 'three';
import { seededRandom } from '../../world/textures.js';
import { departmentStoreDetails as D } from '../../config/departmentStoreDetails.js';

export function buildDepartmentStoreDetails({ kit, layout: S }) {
  const { mat, addCollider, group } = kit;
  const P = D.palette;
  const r = S.rect;
  const rand = seededRandom(D.seed);
  const details = new THREE.Group();
  details.name = 'deptstore_details';
  group.add(details);

  // --- Small helpers -----------------------------------------------------------------------------------------------------
  const box = (name, x0, y0, z0, x1, y1, z1, color, options) => {
    const mesh = kit.box(x0, y0, z0, x1, y1, z1, mat(color, options), { collide: false, name: `deptdetail_${name}` });
    details.add(mesh);
    return mesh;
  };
  const sign = (text, opts) => {
    const mesh = kit.sign(text, { font: 'hoffmanBrand', ...opts }); // the house engraved caps unless a sign picks its own
    details.add(mesh);
    return mesh;
  };
  const part = (geometry, color, x, y, z, rotation = [0, 0, 0], name = 'part', options) => {
    const mesh = new THREE.Mesh(geometry, mat(color, options));
    mesh.position.set(x, y, z);
    mesh.rotation.set(...rotation);
    mesh.name = `deptdetail_${name}`;
    details.add(mesh);
    return mesh;
  };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);

  // --- Wall shelving: one builder for both runs. `a` runs along the wall, `d` is the depth out from it -------------------------
  // west wall (x = r.minX): a = z, out = +x;  north wall (z = r.maxZ): a = x, out = -z
  function shelving(kind, cfg, fillShelf) {
    const west = kind === 'west';
    const a0 = west ? cfg.z0 : cfg.x0, a1 = west ? cfg.z1 : cfg.x1;
    const wb = (name, aa0, aa1, d0, d1, y0, y1, color, options) => (west
      ? box(name, r.minX + d0, y0, aa0, r.minX + d1, y1, aa1, color, options)
      : box(name, aa0, y0, r.maxZ - d1, aa1, y1, r.maxZ - d0, color, options));
    // The solid body: one collider, 2.2 m tall (nothing to stand on), flush with the wall.
    if (west) addCollider(r.minX, 0, a0, r.minX + cfg.depth, cfg.height, a1);
    else addCollider(a0, 0, r.maxZ - cfg.depth, a1, cfg.height, r.maxZ);
    const wood = 0x6d2638;
    // (the back panel sits 1 cm inside the run's ends and behind everything else: no two faces share a plane)
    wb('shelf_back', a0 + 0.012, a1 - 0.012, 0.02, 0.04, 0.1, cfg.height - 0.012, P.plum);
    for (let a = a0; a <= a1 + 0.01; a += cfg.uprightEvery) wb('shelf_upright', Math.min(a, a1) - 0.02, Math.min(a, a1) + 0.02, 0.04, cfg.depth, 0, cfg.height, wood);
    for (const y of cfg.shelves) {
      wb('shelf_board', a0, a1, 0.04, cfg.depth, y - 0.03, y, wood);
      wb('shelf_lip', a0, a1, cfg.depth, cfg.depth + 0.012, y - 0.045, y, P.brass);
      fillShelf(wb, y);
    }
    wb('shelf_cornice', a0 - 0.03, a1 + 0.03, 0.03, cfg.depth + 0.04, cfg.height, cfg.height + 0.07, P.brass);
  }

  // West: stacks of folded knits, a few gaps
  shelving('west', D.westShelving, (wb, y) => {
    const a0 = D.westShelving.z0, a1 = D.westShelving.z1;
    for (let a = a0 + 0.1; a < a1 - 0.35; a += 0.4) {
      if (rand() < 0.22) continue;
      const stack = 1 + Math.floor(rand() * 4);
      wb('knit_stack', a, a + 0.34, 0.07, 0.35, y, y + stack * 0.055, pick(P.knits));
      if (rand() < 0.4) wb('knit_stripe', a - 0.006, a + 0.346, 0.064, 0.356, y + 0.02, y + 0.035, P.paper); // a folded stripe edge
    }
  });
  // North: layaway bags, each with its paper tag; one is stamped PAID IN FULL (1987)
  shelving('north', D.layawayShelving, (wb, y) => {
    const a0 = D.layawayShelving.x0, a1 = D.layawayShelving.x1;
    for (let a = a0 + 0.12; a < a1 - 0.3; a += 0.36) {
      if (a > a0 + 0.2 && rand() < 0.15) continue; // (the first bag always stands: it carries the PAID IN FULL slip)
      const h = 0.3 + rand() * 0.12;
      wb('layaway_bag', a, a + 0.26, 0.08, 0.34, y, y + h, P.kraft);
      wb('layaway_tag', a + 0.08, a + 0.18, 0.34, 0.352, y + h * 0.55, y + h * 0.55 + 0.1, P.paper);
    }
  });
  sign('LAYAWAY · PAY FOREVER', { x: (D.layawayShelving.x0 + D.layawayShelving.x1) / 2, y: 2.62, z: r.maxZ - 0.06, width: 2.8, height: 0.34, facing: -1, background: '#8c2f45', color: '#f6e7c8', font: 'hoffmanSerif' });
  sign('PAID IN FULL · 1987', { x: D.layawayShelving.x0 + 0.25, y: D.layawayShelving.shelves[1] + 0.2, z: r.maxZ - 0.36, width: 0.22, height: 0.12, facing: -1, background: '#f4ecda', color: '#8c2f45', font: 'note' });

  // --- Counter tops: small and low, off the vault line -------------------------------------------------------------------------
  const top = S.counterHeight + 0.006;
  const [cosmetics, fragrance] = S.counters;
  const bottle = cyl(0.03, 0.034, 0.13), cap = cyl(0.018, 0.018, 0.04, 6);
  // (testers at the cosmetics counter's east end and the fragrance counter's west end; the easel and tie carousel take the others)
  for (const x of [cosmetics.x1 - 0.3, fragrance.x0 + 0.3]) {
    for (let i = 0; i < 3; i++) {
      const bx = x + (i - 1) * 0.1, bz = cosmetics.z + (i % 2 ? 0.14 : -0.14);
      const color = pick([P.rose, P.glass, P.brass, 0xc9a7e8]);
      part(bottle, color, bx, top + 0.065, bz, [0, 0, 0], 'bottle');
      part(cap, P.chrome, bx, top + 0.15, bz, [0, 0, 0], 'bottle_cap');
    }
  }
  // Makeover easel on the cosmetics counter's west end
  box('easel_leg', D.counters.easel.x - 0.24, top, cosmetics.z - 0.04, D.counters.easel.x - 0.21, top + 0.4, cosmetics.z + 0.0, P.brass);
  box('easel_leg', D.counters.easel.x + 0.21, top, cosmetics.z - 0.04, D.counters.easel.x + 0.24, top + 0.4, cosmetics.z + 0.0, P.brass);
  sign(D.counters.easel.text, { x: D.counters.easel.x, y: top + 0.27, z: cosmetics.z - 0.05, width: 0.56, height: 0.34, facing: -1, background: '#e8b4bc', color: '#3a2236' });
  // Fragrance: a big display bottle with a pump atomiser, and the tie carousel
  part(cyl(0.07, 0.085, 0.3), P.glass, D.counters.tester.x, top + 0.15, fragrance.z, [0, 0, 0], 'display_bottle');
  part(cyl(0.025, 0.025, 0.06, 6), P.brass, D.counters.tester.x, top + 0.33, fragrance.z, [0, 0, 0], 'atomiser');
  box('atomiser_pump', D.counters.tester.x - 0.01, top + 0.355, fragrance.z - 0.07, D.counters.tester.x + 0.01, top + 0.37, fragrance.z, P.brass);
  const poleX = D.counters.ties.x, poleZ = fragrance.z + 0.1;
  part(cyl(0.012, 0.012, 0.5, 6), P.chrome, poleX, top + 0.25, poleZ, [0, 0, 0], 'tie_pole');
  for (const [i, h] of [0.2, 0.34, 0.46].entries()) {
    part(cyl(0.12, 0.12, 0.012, 10), P.brass, poleX, top + h, poleZ, [0, 0, 0], 'tie_disc');
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + i * 0.3;
      box('tie', poleX + Math.cos(a) * 0.115 - 0.008, top + h - 0.16, poleZ + Math.sin(a) * 0.115 - 0.008, poleX + Math.cos(a) * 0.115 + 0.008, top + h, poleZ + Math.sin(a) * 0.115 + 0.008, pick(P.knits));
    }
  }
  // Layaway counter: the ledger and the bell
  const layaway = S.layaway;
  box('ledger', D.counters.ledger.x - 0.15, top, layaway.z - 0.12, D.counters.ledger.x + 0.15, top + 0.025, layaway.z + 0.12, P.burgundy);
  box('ledger_pages', D.counters.ledger.x - 0.13, top + 0.025, layaway.z - 0.1, D.counters.ledger.x + 0.13, top + 0.04, layaway.z + 0.1, P.paper);
  part(cyl(0.005, 0.045, 0.045, 10), P.brass, D.counters.ledger.x + 0.34, top + 0.022, layaway.z, [0, 0, 0], 'bell');

  // --- Fitting rooms: the middle curtain open onto a mirror and hook, the east booth taped off, scratches on the west one ------
  const F = S.fittingRooms;
  const front = r.maxZ - F.depth;
  const bw = (F.x1 - F.x0) / F.booths;
  const booth = (b) => ({ x0: F.x0 + b * bw + 0.18, x1: F.x0 + (b + 1) * bw - 0.18 });
  {
    const o = booth(F.openBooth), gx0 = o.x0 + 0.5, gx1 = o.x1 - 0.5; // the gap between the bunched curtains
    box('booth_interior', gx0, 0.12, front - 0.012, gx1, 2.05, front - 0.004, P.plum); // dark panel 12 mm off the wall face
    box('booth_mirror_frame', gx0 + 0.07, 0.5, front - 0.026, gx1 - 0.07, 1.96, front - 0.018, P.brass);
    box('booth_mirror', gx0 + 0.1, 0.53, front - 0.034, gx1 - 0.1, 1.93, front - 0.026, 0xc9dce6, { metalness: 0.9, roughness: 0.08, emissive: 0x7aaabd, emissiveIntensity: 0.35 });
    box('booth_bench', gx0 + 0.04, 0.42, front - 0.1, gx1 - 0.04, 0.46, front - 0.034, P.burgundy); // a fold-down bench, tucked
    box('booth_hook', gx1 - 0.14, 1.96, front - 0.045, gx1 - 0.08, 1.99, front - 0.034, P.chrome);
    box('booth_dress', gx1 - 0.3, 1.1, front - 0.058, gx1 - 0.02, 1.95, front - 0.047, 0xe5989b); // a dress left on the hook
    // Try-on clothes dropped in front (flat on the floor)
    const pl = D.fitting.pile;
    for (let i = 0; i < 5; i++) {
      const cx = pl.x0 + rand() * (pl.x1 - pl.x0), cz = pl.z0 + rand() * (pl.z1 - pl.z0);
      const mesh = box('tryon', cx - 0.25, 0.022 + i * 0.012, cz - 0.17, cx + 0.25, 0.034 + i * 0.012, cz + 0.17, pick(P.knits));
      mesh.rotation.y = (rand() - 0.5) * 1.4;
    }
  }
  {
    // East booth: hazard tape across the curtain and a sign
    const c = booth(D.fitting.closedBooth), cx = (c.x0 + c.x1) / 2;
    for (const [k, angle] of [[0, 0.42], [1, -0.42]]) {
      const tape = new THREE.Group();
      tape.position.set(cx, 1.15 + k * 0.1, front - 0.05);
      tape.rotation.z = angle;
      tape.name = 'deptdetail_hazard_tape';
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.07, 0.008), mat(P.hazard));
      tape.add(base);
      for (let i = -8; i <= 8; i += 2) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.01), mat(P.ink));
        stripe.position.x = i * 0.11;
        tape.add(stripe);
      }
      details.add(tape);
    }
    sign(D.fitting.closedSign, { x: cx, y: 1.75, z: front - 0.07, width: 0.95, height: 0.24, facing: -1, background: '#2b2d42', color: '#ffd23f' });
    // West booth: claw marks on the curtain
    const w = booth(D.fitting.scratchedBooth);
    for (let i = 0; i < 4; i++) {
      const sx = w.x0 + 0.3 + i * 0.28;
      const mark = box('scratch', sx, 0.9, front - 0.052, sx + 0.025, 1.7, front - 0.046, 0x3a1020);
      mark.rotation.z = -0.28 + i * 0.03;
    }
  }

  // --- Walls: the mirror, the wall busts, exit signs -------------------------------------------------------------------------------
  {
    const m = D.mirror, x = r.minX;
    box('wall_mirror_frame', x + 0.02, m.y0 - 0.04, m.z0 - 0.04, x + 0.05, m.y1 + 0.04, m.z1 + 0.04, P.brass);
    box('wall_mirror', x + 0.05, m.y0, m.z0, x + 0.056, m.y1, m.z1, 0xc9dce6, { metalness: 0.9, roughness: 0.08, emissive: 0x7aaabd, emissiveIntensity: 0.35 });
    sign(m.text, { x: x + 0.07, y: m.y1 + 0.2, z: (m.z0 + m.z1) / 2, width: 1.5, height: 0.2, facing: 'x+', background: '#3a2236', color: '#f6e7c8' });
    const w = D.wallDisplay, wz = r.minZ;
    box('display_board', w.x0, 1.15, wz + 0.05, w.x1, 2.65, wz + 0.07, P.paper);
    box('display_trim', w.x0 - 0.04, 1.11, wz + 0.04, w.x1 + 0.04, 2.69, wz + 0.058, P.brass);
    const torso = cyl(0.14, 0.11, 0.55, 8), head = new THREE.IcosahedronGeometry(0.1, 0);
    for (let i = 0; i < 3; i++) {
      const bx = w.x0 + 0.7 + i * ((w.x1 - w.x0 - 1.4) / 2);
      part(torso, [P.burgundy, P.rose, P.ink][i], bx, 1.65, wz + 0.2, [0, 0, 0], 'bust_torso');
      part(head, 0xebe4d8, bx, 2.07, wz + 0.2, [0, 0, 0], 'bust_head');
      box('bust_bracket', bx - 0.02, 1.4, wz + 0.07, bx + 0.02, 1.5, wz + 0.2, P.chrome);
    }
    sign(w.text, { x: (w.x0 + w.x1) / 2, y: 2.9, z: wz + 0.08, width: 3.0, height: 0.28, facing: 1, background: '#8c2f45', color: '#f6e7c8' });
    // Exit signs (inside the gate; over the stockroom door)
    const exit = { height: 0.26, background: '#1f6b4a', color: '#d8ffe8' };
    sign(D.exitSigns.gate.text, { x: D.exitSigns.gate.x, y: 3.55, z: r.minZ + 0.04, width: 2.2, facing: 1, ...exit });
    sign(D.exitSigns.stockroom.text, { x: S.stockroomDoorX, y: 2.7, z: r.maxZ - 0.04, width: 0.9, facing: -1, ...exit });
  }

  // --- Ceiling: beams, the hung banner, sprinklers, diffusers ----------------------------------------------------------------
  {
    const c = D.ceiling, y = S.height;
    for (const z of c.beams.zs) {
      box('beam', r.minX, y - c.beams.drop, z - c.beams.depth / 2, r.maxX, y, z + c.beams.depth / 2, 0xf4e7d0);
      box('beam_edge', r.minX, y - c.beams.drop - 0.02, z - c.beams.depth / 2 - 0.02, r.maxX, y - c.beams.drop, z + c.beams.depth / 2 + 0.02, P.brass);
    }
    const b = c.banner, bx = (b.x0 + b.x1) / 2;
    for (const facing of [-1, 1]) sign(b.text, { x: bx, y: (b.y0 + b.y1) / 2, z: b.z + facing * 0.012, width: b.x1 - b.x0, height: b.y1 - b.y0, facing, background: '#e8b4bc', color: '#3a2236' });
    for (const x of [b.x0 + 0.3, b.x1 - 0.3]) box('banner_wire', x - 0.006, b.y1, b.z - 0.006, x + 0.006, y - c.beams.drop, b.z + 0.006, P.ink);
    const head = cyl(0.03, 0.03, 0.07, 8);
    for (const [x, z] of c.sprinklers) {
      part(head, P.chrome, x, y - 0.035, z, [0, 0, 0], 'sprinkler');
      part(cyl(0.012, 0.012, 0.03, 6), P.brass, x, y - 0.08, z, [0, 0, 0], 'sprinkler_deflector');
    }
    for (const [x, z] of c.diffusers) {
      box('diffuser', x - 0.3, y - 0.045, z - 0.3, x + 0.3, y, z + 0.3, 0xece4d2);
      for (let i = -1; i <= 1; i++) box('diffuser_slat', x - 0.26, y - 0.052, z + i * 0.17 - 0.012, x + 0.26, y - 0.045, z + i * 0.17 + 0.012, P.chrome);
    }
  }

  // --- Interrupted shopping -------------------------------------------------------------------------------------------------------
  {
    const L = D.litter;
    // A tipped mannequin lying along the north wall (decoration only; limbs under 0.25 m)
    const t = L.tippedMannequin, skin = 0xebe4d8;
    part(cyl(0.16, 0.12, 0.5, 8), P.burgundy, t.x - 0.25, 0.16, t.z, [0, 0, Math.PI / 2], 'tipped_torso');
    part(cyl(0.15, 0.16, 0.2, 8), skin, t.x + 0.12, 0.16, t.z, [0, 0, Math.PI / 2], 'tipped_hips');
    part(cyl(0.05, 0.045, 0.8, 6), skin, t.x + 0.55, 0.11, t.z - 0.07, [0, 0, Math.PI / 2 + 0.1], 'tipped_leg');
    part(cyl(0.05, 0.045, 0.8, 6), skin, t.x + 0.5, 0.14, t.z + 0.1, [0, 0, Math.PI / 2 - 0.15], 'tipped_leg');
    part(new THREE.IcosahedronGeometry(0.1, 0), skin, t.x - 0.62, 0.1, t.z, [0, 0, 0], 'tipped_head');
    part(cyl(0.045, 0.04, 0.6, 6), skin, t.x - 0.3, 0.05, t.z - 0.28, [0, 0, Math.PI / 2], 'tipped_arm');
    // A dropped paper bag with receipts
    const bag = L.droppedBag;
    const bagMesh = box('dropped_bag', bag.x - 0.17, 0.0, bag.z - 0.1, bag.x + 0.17, 0.2, bag.z + 0.1, P.kraft);
    bagMesh.rotation.z = 1.35; bagMesh.position.y = 0.2; // (lying on its side: rests on the floor)
    for (let i = 0; i < 4; i++) {
      const m = box('receipt', bag.x + 0.25 + i * 0.1, 0.012, bag.z - 0.2 + i * 0.08, bag.x + 0.33 + i * 0.1, 0.016, bag.z - 0.02 + i * 0.08, P.paper);
      m.rotation.y = rand() * 3;
    }
    // A lone shoe
    const s = L.shoe;
    box('shoe_sole', s.x - 0.13, 0.0, s.z - 0.05, s.x + 0.13, 0.03, s.z + 0.05, P.ink);
    box('shoe_upper', s.x - 0.12, 0.03, s.z - 0.045, s.x + 0.04, 0.1, s.z + 0.045, P.burgundy);
    // A flattened box and packing peanuts by the stockroom
    const fb = L.flatBox;
    const flat = box('flat_box', fb.x - 0.35, 0.006, fb.z - 0.25, fb.x + 0.35, 0.026, fb.z + 0.25, P.kraft);
    flat.rotation.y = 0.5;
    box('flat_box_tape', fb.x - 0.35, 0.026, fb.z - 0.03, fb.x + 0.35, 0.031, fb.z + 0.03, 0xe7d8a8).rotation.y = 0.5;
    for (let i = 0; i < 14; i++) {
      const px = fb.x - 0.7 + rand() * 1.4, pz = fb.z - 0.6 + rand() * 1.2;
      box('peanut', px, 0.004, pz, px + 0.035, 0.034, pz + 0.035, 0xf4f1e6).rotation.y = rand() * 3;
    }
  }

  const emitters = D.ambience.map((e) => ({ id: e.id, kind: e.kind, zone: 'departmentStore', position: [e.x, e.h, e.z], range: e.range }));
  return { emitters };
}
