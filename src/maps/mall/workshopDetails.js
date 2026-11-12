// =============================================================================
// BUILD-A-BLASTER DETAIL PASS: what makes the workshop read as a real (if cursed) shop. Built after the room
// (maps/mall/workshopRoom.js) by mall.js, from config/promenade.js workshop.details.
//   Storefront  a "choose your blaster" wall of limp unstuffed gun skins, the heart-ceremony shelf, a till on the bench,
//               footprints to the bench, window decals and tired balloons, plush mascots on the cubbies, ceiling grid,
//               sprinklers, exit signs.
//   Hall        six stuffing hoppers piped into the tank, a QC desk inside the island, a typewriter and certificates at
//               the Naming Booth with a board of name tags, family portraits, a safety board, lockers and a time clock,
//               a fire extinguisher, floor safety lines and hazard stripes, beams, a wainscot, stuffing bales, a laundry
//               cart of fluff, a returns bin, a slumped plush pile, stray tufts, and a neon thank-you over the mouth; and the
//               factory floor's kit: pegboard tool walls (shadow-board outlines), cable trays under the roof, chain hoists.
// Decoration has no collision, sits >= 2 cm proud of walls, and stays out of the lanes round the island. The few big,
// solid pieces (lockers, bales, cart, bin) get one collider each and live in corners or flat against a wall:
// tests/workshopDetails.test.js checks the lanes, the collision rules and the draw budget.
// =============================================================================

import * as THREE from 'three';
import { workshopStuffings, workshopNames } from '../../config/workshop.js';
import { seededRandom } from '../../world/textures.js';

export function buildWorkshopDetails({ kit, looks, layout, floorY }) {
  const shop = layout.workshop, d = shop.details, c = d.colors, H = shop.hall, I = H.island, T = layout.wallThickness;
  const { from, to } = shop;
  const front = layout.rect.maxZ + T; // the storefront's inside face of its front wall
  const ceiling = layout.height, hallTop = H.height;
  const benchFront = layout.rect.maxZ + shop.bench.offsetZ, benchTop = shop.bench.height;
  const y = (h) => floorY + h;
  const made = [];
  const tag = (mesh) => { mesh.userData.workshopDetail = true; made.push(mesh); return mesh; };
  const box = (name, x0, h0, z0, x1, h1, z1, color, options = {}) => tag(kit.box(x0, y(h0), z0, x1, y(h1), z1, kit.mat(color, options),
    { collide: false, name: `workshop_detail_${name}` }));
  const solid = (x0, h0, z0, x1, h1, z1, { vaultable = false } = {}) => {
    const collider = kit.addCollider(x0, y(h0), z0, x1, y(h1), z1);
    collider.workshopDetail = true;
    if (vaultable) collider.vaultable = true;
    return collider;
  };
  const sign = (name, text, x, h, z, width, height, facing, background, color, font) => {
    const mesh = kit.sign(text, { x, y: y(h), z, width, height, facing, background, color, ...(font ? { font } : {}) });
    mesh.name = `workshop_detail_${name}`;
    return tag(mesh);
  };
  const form = new THREE.Object3D();
  /** One draw for many copies: placements [{ x, h, z, rx, ry, rz, s: [sx, sy, sz] }]. */
  const instanced = (name, geometry, color, placements, options = {}) => {
    const mesh = new THREE.InstancedMesh(geometry, kit.mat(color, options), placements.length);
    placements.forEach((p, i) => {
      form.position.set(p.x, y(p.h), p.z);
      form.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
      form.scale.set(...(p.s ?? [1, 1, 1]));
      form.updateMatrix();
      mesh.setMatrixAt(i, form.matrix);
    });
    mesh.name = `workshop_detail_${name}`;
    mesh.computeBoundingBox?.();
    mesh.computeBoundingSphere?.();
    kit.group.add(mesh);
    return tag(mesh);
  };
  const rand = seededRandom(d.seed);

  // ---------------------------------------------------------------------------------------------------------------------
  // STOREFRONT
  // The skins wall (west, between the entrance and the cubbies): limp, unstuffed guns on a slatwall, waiting for a heart.
  const skins = d.skins, wx = from; // (x of the storefront's west wall face)
  box('slatwall', wx, skins.bottom, skins.z0, wx + .02, skins.top, skins.z1, c.slat);
  for (let h = skins.bottom + .2; h < skins.top - .05; h += .3) box('slat_rail', wx + .02, h, skins.z0 + .03, wx + .03, h + .025, skins.z1 - .03, c.metal); // (stops 5 mm behind the wall sign)
  skins.rows.forEach((h, row) => {
    for (let i = 0; i < skins.perRow; i++) {
      const z = skins.z0 + .3 + i * ((skins.z1 - skins.z0 - .6) / (skins.perRow - 1));
      const color = c.fabric[(row * skins.perRow + i) % c.fabric.length];
      const droop = (i % 2 ? -1 : 1) * .18;
      box('skin_hook', wx + .035, h + .17, z - .015, wx + .09, h + .2, z + .015, c.metal);
      const body = box('skin_body', wx + .05, h - .02, z - .17, wx + .075, h + .14, z + .13, color);
      body.rotation.x = droop;
      const grip = box('skin_grip', wx + .052, h - .2, z + .02, wx + .073, h - .02, z + .1, color);
      grip.rotation.x = droop * 1.6;
      const barrel = box('skin_barrel', wx + .053, h + .05, z - .3, wx + .072, h + .1, z - .17, color);
      barrel.rotation.x = droop * .6 - .25; // (nothing in it yet: it flops)
    }
  });

  // The heart ceremony (east, opposite): a shelf with the bowl of hearts, and accessories for well-dressed blasters below.
  const hc = d.heartShelf, ex = to;
  box('heart_shelf', ex - hc.depth, hc.height - .04, hc.z0, ex - .02, hc.height, hc.z1, c.wood);
  box('heart_shelf_bracket', ex - .14, hc.height - .2, (hc.z0 + hc.z1) / 2 - .02, ex - .02, hc.height - .04, (hc.z0 + hc.z1) / 2 + .02, c.metal);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.15, .1, .1, 14), kit.mat(c.cream));
  bowl.position.set(ex - hc.depth / 2 - .01, y(hc.height + .05), (hc.z0 + hc.z1) / 2);
  bowl.name = 'workshop_detail_heart_bowl';
  kit.group.add(tag(bowl));
  instanced('heart', new THREE.IcosahedronGeometry(.045, 0), c.heart, [-.06, 0, .06].map((dz, i) => ({
    x: ex - hc.depth / 2 - .01 + (i - 1) * .03, h: hc.height + .1 + (i % 2) * .02, z: (hc.z0 + hc.z1) / 2 + dz, s: [1.1, 1, .8], rz: .4 * i,
  })));
  for (let i = 0; i < 6; i++) {
    const z = hc.z0 + .1 + i * ((hc.z1 - hc.z0 - .2) / 5), h = hc.accessories;
    box('accessory_peg', ex - .1, h, z - .012, ex - .02, h + .025, z + .012, c.metal);
    box(i % 2 ? 'tiny_scarf' : 'tiny_shades', ex - .08, h - (i % 2 ? .2 : .06), z - .06, ex - .05, h - .01, z + .06, i % 2 ? c.fabric[i % c.fabric.length] : c.ink);
  }

  // The till, on the bench's back-left corner (clear of the vise, order sheet and parts tray).
  const till = d.till;
  box('till', till.x0, benchTop + .005, benchFront + till.z0, till.x1, benchTop + .13, benchFront + till.z1, c.ink);
  const screen = box('till_screen', till.x0 + .06, benchTop + .13, benchFront + till.z0 + .02, till.x1 - .06, benchTop + .3, benchFront + till.z0 + .05, c.screen,
    { emissive: c.screen, emissiveIntensity: .7 });
  screen.rotation.x = -.25;
  box('till_drawer', till.x0 + .03, benchTop + .02, benchFront + till.z0 - .025, till.x1 - .03, benchTop + .07, benchFront + till.z0, c.metal);
  sign('birthday_club', 'ASK ABOUT OUR BIRTHDAY CLUB', (till.x0 + till.x1) / 2, benchTop - .2, benchFront - .03, .74, .1, -1, '#ffe39b', '#253c87');

  // Footprints from each entrance to the bench, and where the line starts.
  const steps = d.footprints;
  for (const side of [-1, 1]) {
    const entry = shop.entrances[side < 0 ? 0 : 1], x0 = (entry.from + entry.to) / 2, z0 = front + steps.start;
    const x1 = side * steps.endX, z1 = benchFront - steps.stopShort;
    sign(`line_starts_${side < 0 ? 'west' : 'east'}`, 'LINE STARTS HERE', x0, .9, front + .02, 1.1, .16, 1, '#294679', '#fff0cb');
    for (let i = 0; i < steps.count; i++) {
      const t = i / (steps.count - 1), x = x0 + (x1 - x0) * t + (i % 2 ? .07 : -.07), z = z0 + (z1 - z0) * t;
      box('footprint', x - .045, .014, z - .1, x + .045, .018, z + .1, c.footprint);
    }
  }

  // The window: GRAND OPENING on the glass (outside), and three balloons that gave up some time ago.
  sign('grand_opening', 'GRAND OPENING · ALL BLASTERS WELCOME', (shop.window.from + shop.window.to) / 2, 2.2, layout.rect.maxZ + .1, 1.7, .2, -1, 'transparent', '#ff6fae');
  d.balloons.forEach(([x, h, color], i) => {
    const z = front + .35 + i * .12;
    box('balloon_string', x - .004, h + .14, z - .004, x + .004, ceiling - .01, z + .004, c.paper);
    const balloon = new THREE.Mesh(new THREE.IcosahedronGeometry(.13, 1), kit.mat(color, { roughness: .45 }));
    balloon.position.set(x, y(h), z);
    balloon.scale.set(1, .7 + .1 * i, .9); // half deflated, sagging
    balloon.name = 'workshop_detail_balloon';
    kit.group.add(tag(balloon));
  });

  // Plush mascots sitting on the cubby tops (out of reach of everything), each clutching a toy blaster.
  const plush = (name, x, h, z, turn, color) => {
    const parts = [
      [0, .17, 0, .17, [1, 1.05, .9]], [0, .42, -.02, .13, [1, 1, 1]], [-.1, .53, -.02, .05, [1, 1, .8]], [.1, .53, -.02, .05, [1, 1, .8]],
      [-.14, .2, -.08, .06, [1, 1.4, 1]], [.14, .2, -.08, .06, [1, 1.4, 1]], [-.08, 0, -.12, .07, [1, .8, 1.3]], [.08, 0, -.12, .07, [1, .8, 1.3]],
    ];
    const cos = Math.cos(turn), sin = Math.sin(turn);
    instanced(name, new THREE.IcosahedronGeometry(1, 1), color, parts.map(([px, ph, pz, r, s]) => ({
      x: x + px * cos - pz * sin, h: h + ph, z: z + px * sin + pz * cos, ry: turn, s: s.map((v) => v * r),
    })), { roughness: .9 });
    box(`${name}_blaster`, x - .05, h + .14, z - .2, x + .05, h + .22, z - .08, c.toy);
  };
  plush('mascot_west', from + .26, 2.47, front + d.mascotZ[0], Math.PI / 2, c.plush);
  plush('mascot_east', to - .26, 2.47, front + d.mascotZ[1], -Math.PI / 2, c.plushAlt);

  // Ceiling grid, sprinklers and exit signs: the boring things that make a shop a shop.
  const grid = d.ceilingGrid;
  for (let x = from + grid; x < to - .05; x += grid) box('ceiling_tee', x - .012, ceiling - .012, front, x + .012, ceiling, front + shop.depth - T, c.grid);
  for (let z = front + grid; z < front + shop.depth - T - .05; z += grid) box('ceiling_tee', from, ceiling - .012, z - .012, to, ceiling, z + .012, c.grid);
  const sprinkler = new THREE.CylinderGeometry(.025, .04, .06, 8);
  instanced('sprinkler', sprinkler, c.metal, [
    ...d.sprinklers.storefront.map(([x, z]) => ({ x, h: ceiling - .04, z: front + z })),
    ...d.sprinklers.hall.map(([x, z]) => ({ x, h: hallTop - .04, z })),
  ], { metalness: .5, roughness: .4 });
  for (const entry of shop.entrances) {
    sign('exit_sign', 'EXIT', (entry.from + entry.to) / 2, 2.98, front + .022, .42, .16, 1, '#1e6b3c', '#e9fff0');
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // HALL
  const north = H.maxZ, west = H.minX, east = H.maxX, south = H.minZ;
  // Wainscot and rail round the hall, broken where something stands against the wall.
  const wainscot = { colors: { wainscot: c.wainscot, rail: c.rail }, heights: { wainscot: .95, rail: .04 }, name: 'workshop_detail_wainscot', floorY };
  looks.bands({ along: 'z', from: south, to: north, wallAt: west, facing: 1, ...wainscot });
  looks.bands({ along: 'z', from: south, to: north, wallAt: east, facing: -1, gaps: [[south, d.lockers.z1 + .02], [H.booth.minZ - .02, H.booth.maxZ + .02]], ...wainscot });
  looks.bands({ along: 'x', from: west, to: east, wallAt: north, facing: -1, gaps: [[H.chute.x - H.chute.width / 2 - .15, H.chute.x + H.chute.width / 2 + .15], [d.returnsBin.x0 - .02, d.returnsBin.x1 + .02]], ...wainscot });
  looks.bands({ along: 'x', from: west, to: east, wallAt: south, facing: 1, gaps: [[from - .02, to + .02]], ...wainscot });

  // The stuffing hoppers: one per stuffing on the north wall, high up, piped into a header and across to the tank's lid.
  const hp = d.hoppers, ids = Object.keys(workshopStuffings);
  ids.forEach((id, i) => {
    const x = hp.firstX + i * hp.spacing, half = hp.width / 2, color = workshopStuffings[id].color;
    box('hopper', x - half, hp.bottom, north - hp.depth, x + half, hp.top, north - .02, color, { roughness: .5 });
    box('hopper_window', x - half + .08, hp.bottom + .18, north - hp.depth - .006, x + half - .08, hp.top - .3, north - hp.depth, c.glass, { roughness: .1 });
    box('hopper_funnel', x - .12, hp.bottom - .32, north - hp.depth + .08, x + .12, hp.bottom, north - .1, c.metal);
    sign('hopper_label', workshopStuffings[id].name.toUpperCase(), x, hp.top - .14, north - hp.depth - .012, hp.width - .06, .1, -1, '#fff0cb', '#253c87');
    box('hopper_riser', x - .04, hp.top, north - .3, x + .04, hp.pipeY, north - .22, c.pipe);
  });
  const lastX = hp.firstX + (ids.length - 1) * hp.spacing, tankX = H.tank.x;
  box('pipe_header', hp.firstX - .06, hp.pipeY - .02, north - .32, lastX + .06, hp.pipeY + .1, north - .2, c.pipe);
  box('pipe_main', tankX - .07, hp.pipeY - .02, H.tank.z + hp.dropOffset, tankX + .07, hp.pipeY + .1, north - .32, c.pipe);
  box('pipe_drop', tankX - .07, H.tank.height - .05, H.tank.z + hp.dropOffset - .14, tankX + .07, hp.pipeY + .1, H.tank.z + hp.dropOffset, c.pipe);
  for (let z = north - 1.2; z > H.tank.z + hp.dropOffset + .3; z -= 1.6) box('pipe_hanger', tankX - .015, hp.pipeY + .1, z - .015, tankX + .015, hallTop, z + .015, c.metal);
  sign('pipe_flow', 'STUFFING →  TANK', tankX + .09, hp.pipeY + .04, (north + H.tank.z) / 2, 1, .09, 'x+', 'transparent', '#ffe39b');

  // Beams across the ceiling (clear of the light panels), and the neon thank-you over the mouth.
  for (const z of d.beams) box('beam', west, hallTop - .2, z - .1, east, hallTop, z + .1, c.beam);
  looks.neon('promenade_workshop').text(d.neonText, { x: (from + to) / 2, y: y(d.neonY), z: south + .04, facing: 1, height: .26, color: c.neon });

  // Quality Control, inside the island in the gap the U leaves east of the tank (seen through the glass, never reached).
  const qc = d.qc;
  box('qc_desk', qc.x0, .7, qc.z0, qc.x1, .76, qc.z1, c.wood);
  box('qc_desk_legs', qc.x0 + .04, 0, qc.z0 + .04, qc.x1 - .04, .7, qc.z0 + .08, c.metal);
  box('qc_desk_legs', qc.x0 + .04, 0, qc.z1 - .08, qc.x1 - .04, .7, qc.z1 - .04, c.metal);
  const panel = box('qc_panel', qc.x0 + .08, .76, qc.z0 + .15, qc.x1 - .2, .96, qc.z1 - .15, c.ink);
  panel.rotation.z = .35;
  instanced('qc_button', new THREE.BoxGeometry(.05, .03, .05), c.lamp, [0, 1, 2, 3].map((i) => ({ x: qc.x0 + .2, h: .93, z: qc.z0 + .3 + i * .16 })),
    { emissive: c.lamp, emissiveIntensity: 1.6 });
  box('clipboard', qc.x1 - .2, .765, (qc.z0 + qc.z1) / 2 - .12, qc.x1 - .04, .775, (qc.z0 + qc.z1) / 2 + .12, c.wood);
  box('clipboard_sheet', qc.x1 - .19, .775, (qc.z0 + qc.z1) / 2 - .1, qc.x1 - .05, .78, (qc.z0 + qc.z1) / 2 + .1, c.paper);
  box('qc_stool_seat', qc.x1 + .02, .55, (qc.z0 + qc.z1) / 2 - .17, qc.x1 + .34, .6, (qc.z0 + qc.z1) / 2 + .17, c.red);
  box('qc_stool_leg', qc.x1 + .16, 0, (qc.z0 + qc.z1) / 2 - .03, qc.x1 + .2, .55, (qc.z0 + qc.z1) / 2 + .03, c.metal);
  sign('qc_sign', 'QUALITY CONTROL', I.maxX - .14, .5, (qc.z0 + qc.z1) / 2, .9, .16, 'x+', '#ffe39b', '#253c87');
  // Rollers on the belt's outer faces.
  const belt = H.conveyor, bx0 = I.minX + belt.inset, bx1 = I.maxX - belt.inset, bz0 = I.minZ + belt.inset, bz1 = I.maxZ - belt.inset;
  const roller = new THREE.CylinderGeometry(.06, .06, .02, 10);
  const rollers = [];
  for (let x = bx0 + .3; x < bx1 - .2; x += .55) {
    rollers.push({ x, h: belt.height - .14, z: bz0 - .011, rx: Math.PI / 2 }, { x, h: belt.height - .14, z: bz1 + .011, rx: Math.PI / 2 });
  }
  for (let z = bz0 + .9; z < bz1 - .8; z += .55) rollers.push({ x: bx0 - .011, h: belt.height - .14, z, rz: Math.PI / 2 });
  instanced('roller', roller, c.metal, rollers, { metalness: .5, roughness: .35 });

  // The Naming Booth: a typewriter and a stack of blank certificates on the counter, and a board of name tags on its south side.
  const B = H.booth, ct = B.counterHeight, cx = B.minX - .14;
  box('typewriter', cx - .1, ct, B.minZ + .42, cx + .1, ct + .1, B.minZ + .82, c.ink);
  box('typewriter_paper', cx - .07, ct + .1, B.minZ + .5, cx + .07, ct + .26, B.minZ + .52, c.paper);
  const platen = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .34, 10), kit.mat(c.metal));
  platen.rotation.x = Math.PI / 2; platen.position.set(cx, y(ct + .11), B.minZ + .62); platen.name = 'workshop_detail_platen';
  kit.group.add(tag(platen));
  box('certificate_stack', cx - .1, ct, B.maxZ - 1.2, cx + .1, ct + .06, B.maxZ - .92, c.paper);
  box('name_tag_board', B.minX + .1, 1.15, B.minZ - .03, B.maxX - .1, 2.15, B.minZ - .01, c.cork);
  sign('name_tag_title', 'HELLO, MY NAME IS', (B.minX + B.maxX) / 2, 2.02, B.minZ - .036, .9, .12, -1, '#c64140', '#fff0cb');
  workshopNames.slice(0, 8).forEach((name, i) => {
    const x = B.minX + .28 + (i % 4) * .22, h = 1.72 - Math.floor(i / 4) * .32;
    sign('name_tag', name.toUpperCase(), x, h, B.minZ - .036, .19, .1, -1, '#fff6e6', '#c64140');
  });

  // Family portraits by the booth: the guns that went home (frames with a name under each).
  const fp = d.portraits;
  box('portrait_board', east - .04, fp.bottom, fp.z0, east - .02, fp.bottom + 1.1, fp.z1, c.plum);
  sign('portrait_title', 'FAMILY PORTRAITS', east - .045, fp.bottom + .98, (fp.z0 + fp.z1) / 2, 1.4, .14, 'x-', '#ffe39b', '#253c87');
  for (let i = 0; i < 6; i++) {
    const z = fp.z0 + .3 + (i % 3) * ((fp.z1 - fp.z0 - .6) / 2), h = fp.bottom + .52 - Math.floor(i / 3) * .42;
    box('portrait_frame', east - .07, h, z - .16, east - .045, h + .3, z + .16, c.wood);
    box('portrait_photo', east - .078, h + .04, z - .12, east - .07, h + .26, z + .12, c.fabric[i % c.fabric.length]);
    sign('portrait_name', workshopNames[(i + 8) % workshopNames.length].toUpperCase(), east - .072, h - .05, z, .3, .07, 'x-', 'transparent', '#fff0cb');
  }

  // Safety board and fire extinguisher (south and west walls), and the returns policy by the chute.
  sign('days_board', 'DAYS WITHOUT INCIDENT', d.safetyBoardX, 2.32, south + .03, 1.4, .18, 1, '#294679', '#fff0cb');
  box('days_board_back', d.safetyBoardX - .75, 1.55, south + .005, d.safetyBoardX + .75, 2.45, south + .02, c.cream);
  sign('days_count', '0', d.safetyBoardX, 1.85, south + .03, .5, .5, 1, '#fff6e6', '#c64140', 'Georgia, serif');
  const fx = d.extinguisherZ;
  box('extinguisher_cabinet', west + .02, 1.0, fx - .2, west + .16, 1.65, fx + .2, c.red);
  box('extinguisher_glass', west + .16, 1.06, fx - .16, west + .166, 1.59, fx + .16, c.glass, { roughness: .1 });
  sign('extinguisher_sign', 'FIRE', west + .025, 1.82, fx, .36, .14, 'x+', '#c64140', '#ffffff');
  sign('returns_policy', 'RETURN POLICY: NO QUESTIONS ASKED. NONE.', west + .025, 1.75, d.returnsPolicyZ, 1.5, .18, 'x+', '#fff6e6', '#c64140');
  // Posters on the bare stretches of the side walls, 3 cm proud.
  for (const p of d.wallPosters) {
    const onWest = p.wall === 'west';
    looks.poster(p.kind, p.options, onWest ? west + .03 : east - .03, floorY + p.y, p.z, p.width, p.height, onWest ? 'x+' : 'x-');
  }

  // Lockers and the time clock (east wall, south end): one collider, solid to the top (nothing to perch on).
  const lk = d.lockers;
  solid(east - lk.depth, 0, south, east, lk.height, lk.z1);
  for (let i = 0; i < 3; i++) {
    const z0 = south + .02 + i * ((lk.z1 - south - .04) / 3), z1 = z0 + (lk.z1 - south - .04) / 3 - .02;
    box('locker', east - lk.depth, 0, z0, east - .01, lk.height, z1, c.locker);
    for (let v = 0; v < 3; v++) box('locker_vent', east - lk.depth - .006, lk.height - .25 - v * .06, z0 + .08, east - lk.depth, lk.height - .23 - v * .06, z1 - .08, c.ink);
    box('locker_handle', east - lk.depth - .03, 1.0, z1 - .1, east - lk.depth, 1.15, z1 - .07, c.metal);
  }
  box('time_clock', east - .14, 1.3, d.timeClockZ - .14, east - .02, 1.62, d.timeClockZ + .14, c.cream);
  sign('time_clock_face', 'IN · OUT', east - .145, 1.52, d.timeClockZ, .2, .08, 'x-', '#253c87', '#fff0cb');
  box('card_rack', east - .06, 1.0, d.timeClockZ + .2, east - .02, 1.5, d.timeClockZ + .48, c.metal);

  // Corners: bales of stuffing (south-west), a laundry cart of fluff (north-west), a returns bin under the hoppers, a plush pile (north-east).
  const bales = d.bales;
  solid(west, 0, south, bales.x1, bales.height, bales.z1);
  [[west + .03, 0, south + .03, bales.x1 - .03, .55, bales.z1 - .03], [west + .06, .55, south + .08, bales.x1 - .08, 1.1, bales.z1 - .3]].forEach((b, i) => {
    box('stuffing_bale', ...b, i ? c.cream : c.paper);
    box('bale_strap', b[0] - .005, b[1], (b[2] + b[5]) / 2 - .03, b[3] + .005, b[4] + .005, (b[2] + b[5]) / 2 + .03, c.strap);
  });
  const cart = d.cart;
  solid(west, 0, cart.z0, cart.x1, cart.height, north);
  box('cart_body', west + .05, .25, cart.z0 + .05, cart.x1 - .05, .85, north - .05, c.cart);
  box('cart_base', west + .08, .08, cart.z0 + .08, cart.x1 - .08, .25, north - .08, c.metal);
  const fluff = [];
  for (let i = 0; i < 14; i++) fluff.push({ x: west + .15 + rand() * (cart.x1 - west - .3), h: .8 + rand() * .2, z: cart.z0 + .15 + rand() * (north - cart.z0 - .3),
    rx: rand() * 3, rz: rand() * 3, s: [.13, .1, .12].map((v) => v * (.8 + rand() * .5)) });
  // Stray tufts across the floor, close to the walls.
  for (let i = 0; i < d.tufts; i++) {
    const side = i % 4, along = rand();
    const [x, z] = side === 0 ? [west + .2 + rand() * .6, south + .5 + along * (north - south - 1)]
      : side === 1 ? [east - .2 - rand() * .6, south + 1.6 + along * (B.minZ - south - 2)]
      : side === 2 ? [west + 1 + along * (east - west - 2), north - .2 - rand() * .5]
      : [west + .6 + along * 4.5, south + .2 + rand() * .5];
    fluff.push({ x, h: .03, z, rx: rand() * 3, rz: rand() * 3, s: [.06, .035, .05].map((v) => v * (.7 + rand() * .8)) });
  }
  instanced('fluff', new THREE.IcosahedronGeometry(1, 1), c.fluff, fluff, { roughness: .95 });
  const bin = d.returnsBin;
  solid(bin.x0, 0, north - bin.depth, bin.x1, bin.height, north, { vaultable: true });
  box('returns_bin', bin.x0, 0, north - bin.depth, bin.x1, bin.height, north - .02, c.bin);
  box('returns_bin_rim', bin.x0 - .02, bin.height - .05, north - bin.depth - .02, bin.x1 + .02, bin.height + .02, north - .03, c.metal);
  sign('returns_bin_sign', 'RETURNS', (bin.x0 + bin.x1) / 2, bin.height - .25, north - bin.depth - .006, bin.x1 - bin.x0 - .1, .12, -1, '#c64140', '#fff0cb');
  for (const [dx, dz, h] of [[.12, .15, .62], [.36, .2, .66]]) box('returned_box', bin.x0 + dx - .1, h, north - bin.depth + dz - .08, bin.x0 + dx + .1, h + .16, north - bin.depth + dz + .08, c.cardboard);
  d.plushPile.forEach(([px, pz, turn, color], i) => plush(`plush_pile_${i}`, px, 0, pz, turn, color));

  // Floor: a safety line round the island, hazard stripes under the chute, a loading box in front of the booth.
  const g = .35, line = .07, h0 = .014, h1 = .019;
  box('safety_line', I.minX - g - line, h0, I.minZ - g - line, I.maxX + g + line, h1, I.minZ - g, c.safety);
  box('safety_line', I.minX - g - line, h0, I.maxZ + g, I.maxX + g + line, h1, I.maxZ + g + line, c.safety);
  box('safety_line', I.minX - g - line, h0, I.minZ - g, I.minX - g, h1, I.maxZ + g, c.safety);
  box('safety_line', I.maxX + g, h0, I.minZ - g, I.maxX + g + line, h1, I.maxZ + g, c.safety);
  const stripes = H.chute;
  for (let i = 0; i < 8; i++) {
    const x0 = stripes.x - stripes.width / 2 + i * (stripes.width / 8);
    box('hazard_stripe', x0, h0, north - 1.1, x0 + stripes.width / 8, h1, north - .05, i % 2 ? c.ink : c.safety);
  }
  box('loading_box', B.minX - .9, h0, B.minZ, B.minX - .83, h1, B.maxZ, c.safety);
  box('loading_box', B.minX - .9, h0, B.minZ - .07, B.minX - .3, h1, B.minZ, c.safety);
  box('loading_box', B.minX - .9, h0, B.maxZ, B.minX - .3, h1, B.maxZ + .07, c.safety);

  // The factory floor: pegboard tool walls with painted shadow outlines, cable trays under the roof, chain hoists in two corners.
  // Plain colours only, flat on the walls or above head height: the batcher merges them (no new draws worth counting).
  const wallFrame = {
    north: (u0, u1, depth0, depth1) => [u0, north - depth1, u1, north - depth0],
    west: (u0, u1, depth0, depth1) => [west + depth0, u0, west + depth1, u1],
  };
  const flat = (name, wall, u0, h0, u1, h1, depth0, depth1, color) => {
    const [a, b, cc, dd] = wallFrame[wall](u0, u1, depth0, depth1);
    return box(name, a, h0, b, cc, h1, dd, color);
  };
  const toolColors = { wood: c.wood, metal: c.pipe, grip: c.red, dark: c.ink };
  for (const board of d.pegboards) {
    flat('pegboard', board.wall, board.from, board.bottom, board.to, board.top, .006, .03, COLOR_PEGBOARD);
    flat('pegboard_trim', board.wall, board.from - .04, board.top, board.to + .04, board.top + .05, .006, .04, c.safety);
    // Tools in a row, each over its painted outline (the shadow board: you'd see at once which one is missing).
    const tools = [
      [[.0, .1, .035, .42, 'wood'], [-.05, .38, .085, .47, 'metal']], // hammer
      [[.0, .12, .03, .4, 'metal'], [-.025, .38, .055, .44, 'metal'], [-.02, .08, .05, .13, 'metal']], // wrench
      [[.0, .24, .04, .34, 'grip'], [.012, .08, .028, .24, 'metal']], // screwdriver
      [[-.12, .14, .2, .3, 'metal'], [.2, .12, .29, .32, 'grip']], // saw
      [[.0, .1, .035, .36, 'grip'], [-.04, .34, .075, .42, 'dark']], // mallet
      [[-.04, .12, .07, .38, 'metal'], [-.06, .36, .09, .42, 'dark']], // clamp
    ];
    const count = Math.max(1, Math.floor((board.to - board.from) / .5));
    for (let i = 0; i < count; i++) {
      const u = board.from + .3 + i * ((board.to - board.from - .5) / Math.max(1, count - 1));
      const tool = tools[i % tools.length];
      const missing = i === 2; // (one outline with nothing on it: someone borrowed it)
      const [o0, p0, o1, p1] = tool.reduce(([a, b, cc, dd], [u0, v0, u1, v1]) => [Math.min(a, u0), Math.min(b, v0), Math.max(cc, u1), Math.max(dd, v1)],
        [Infinity, Infinity, -Infinity, -Infinity]);
      flat('tool_outline', board.wall, u + o0 - .015, board.bottom + p0 + .3 - .015, u + o1 + .015, board.bottom + p1 + .3 + .015, .03, .036, c.ink);
      // Each part a few millimetres prouder than the last, so overlapping parts never share a plane.
      if (!missing) tool.forEach(([du0, v0, du1, v1, kind], j) => flat('tool', board.wall, u + du0, board.bottom + v0 + .3, u + du1,
        board.bottom + v1 + .3, .036, .056 + j * .008, toolColors[kind]));
    }
  }
  const tr = d.trays;
  for (const z of tr.z) {
    box('cable_tray', west + .1, hallTop - tr.drop - .06, z - tr.width / 2, east - .1, hallTop - tr.drop, z + tr.width / 2, c.metal);
    box('cable_bundle', west + .1, hallTop - tr.drop, z - tr.width / 2 + .05, east - .1, hallTop - tr.drop + .07, z + tr.width / 2 - .05, c.ink);
    for (let x = west + .8; x < east - .3; x += 2.4) box('tray_hanger', x - .015, hallTop - tr.drop, z - .015, x + .015, hallTop, z + .015, c.metal);
  }
  for (const [x, z] of d.hoists.at) {
    const hook = d.hoists.hookHeight;
    box('hoist_block', x - .14, hallTop - .55, z - .1, x + .14, hallTop - .2, z + .1, c.safety);
    box('hoist_mount', x - .04, hallTop - .2, z - .04, x + .04, hallTop, z + .04, c.metal);
    box('hoist_chain', x - .015, hook + .1, z - .015, x + .015, hallTop - .55, z + .015, c.metal);
    box('hoist_hook', x - .06, hook, z - .02, x + .06, hook + .1, z + .02, c.ink);
  }

  return { meshes: made };
}
const COLOR_PEGBOARD = 0xc79a62; // (maps/mall/palette.js COLORS.pegboard: tan hardboard)
