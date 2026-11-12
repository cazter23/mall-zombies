import * as THREE from 'three';
import { cinemaFinish } from '../../config/cinemaFinish.js';
import { cinemaDetails } from '../../config/cinemaDetails.js';
import { cinemaPrint } from './cinemaPrint.js';
import { drawType } from '../../world/typeKit.js';

export function buildCinemaPublicFinish({ kit, layout: c, floorY: Y }) {
  const C = cinemaDetails.palette, D = cinemaFinish;
  const { box, cyl, printPanel, canvas, label } = cinemaPrint(kit, C, Y);
  const brass = { metalness: .45, roughness: .45 }, glow = { emissive: C.cream, emissiveIntensity: .65, roughness: .8 };
  const r = D.lobby.carpet;
  for (const side of [-1, 1]) {
    for (const inset of [0, .13]) {
      box('carpet_border_long', r.x + side * (r.w / 2 - inset), .022, r.z, .035, .008, r.d - 2 * inset, C.gold);
      box('carpet_border_end', r.x, .022, r.z + side * (r.d / 2 - inset), r.w - 2 * inset, .008, .035, C.gold);
    }
    for (const z of [-8.8, -5.5, 1.8, 3.8]) {
      const diamond = box('carpet_corner_motif', r.x + side * (r.w / 2 - .36), .032, z, .14, .008, .14, C.rose);
      diamond.rotation.y = Math.PI / 4;
    }
  }
  // Thick entrance crowns and paired jambs give the north wall readable depth.
  for (const p of D.lobby.portals) {
    for (const side of [-1, 1]) {
      box('portal_jamb', p.x + side * (p.w / 2 + .10), .1, 5.38, .13, 2.67, .17, C.plum);
      box('portal_jamb_inlay', p.x + side * (p.w / 2 + .10), .23, 5.28, .028, 2.38, .025, C.gold, brass);
    }
    box('portal_crown', p.x, 2.83, 5.32, p.w + .45, .50, .24, C.plum);
    box('portal_crown_light', p.x, 3.36, 5.31, p.w + .54, .06, .27, C.paper, glow);
    label('portal_identity', p.text, p.sub, p.x, 3.08, 5.18, p.w + .08, .43, -1);
  }
  // Concession front becomes a fitted cabinet with fluting and brass toe trim.
  const con = c.concessions;
  for (let z = con.minZ + .22; z < con.maxZ - .1; z += .30) {
    if (z > .42 && z < .90) continue; // existing waste slot
    box('concession_fluting', con.maxX + .045, .16, z, .035, .68, .045, C.rose);
  }
  box('concession_toerail', con.maxX + .045, .09, .45, .065, .045, 5.5, C.gold, brass);
  box('concession_counter_edge', con.maxX + .035, 1.015, .45, .09, .035, 5.5, C.gold, brass);
  // Printed packaging makes the existing candy shapes recognisable from nearby.
  for (let i = 0; i < D.lobby.candy.length; i++) {
    const cv = canvas(384, 256), ctx = cv.getContext('2d');
    ctx.fillStyle = ['#bb657e', '#537e75', '#c7a46a', '#526e8b'][i]; ctx.fillRect(0, 0, 384, 256);
    D.lobby.candy[i].split(' ').forEach((s, j) => drawType(ctx, s, 192, 70 + j * 61,
      { role: 'toyBrand', size: 52, fill: '#f7e9c8', maxWidth: 340, outline: { color: '#2b1a2a', width: 0.07 } }));
    drawType(ctx, 'SUNSET SWEETS / 45g', 192, 228, { role: 'cinemaBody', size: 26, fill: '#f7e9c8', maxWidth: 340, caps: 'upper', tracking: 0.1 });
    printPanel('candy_brand', cv, -41.25, 1.205, -.70 + i * .22, .16, .11, 'x+');
  }
  for (const z of [-.95, -.60, -.25]) {
    cyl('cup_stack', -41.34, 1.41, z, .065, .44, C.paper);
    for (const h of [1.22, 1.29, 1.36, 1.43, 1.50, 1.57]) cyl('cup_stack_rim', -41.34, h, z, .070, .016, C.red, [0, 0, 0], {}, 8);
  }
  // Usher's wall station: shallow enough to leave the Screen 1 approach clear.
  const u = D.lobby.usher;
  box('usher_cabinet', u.x, .1, u.z, .32, 1.05, .86, C.plum);
  box('usher_top', u.x + .02, 1.15, u.z, .37, .06, .93, C.gold, brass);
  box('stub_collection_box', u.x + .02, 1.22, u.z - .17, .24, .27, .35, C.mint);
  box('stub_slot', u.x + .02, 1.495, u.z - .17, .15, .009, .025, C.ink);
  box('ticket_punch', u.x + .03, 1.23, u.z + .25, .18, .055, .10, C.metal, brass);
  label('usher_notice', 'ADMIT ONE', 'PLEASE HAVE YOUR TICKET READY', c.lobby.minX + .12, 2.28, u.z, 1.35, .6, 'x+');
  // Poster cases gain a lit inner reveal around existing artwork, not duplicate art.
  for (const p of c.posters) {
    for (const side of [-1, 1]) box('poster_case_side', p.x + side * .81, .71, 5.34, .06, 2.47, .14, C.plum);
    for (const h of [.69, 3.18]) box('poster_case_cap', p.x, h, 5.34, 1.68, .06, .14, C.plum);
    box('poster_case_light', p.x, 3.10, 5.27, 1.40, .035, .035, C.paper, glow);
  }
  // Wall-hugging waiting seats and suspended premiere pennants dress the lobby
  // perimeter/height while leaving the display's full vault envelope untouched.
  for (const z of [-7.0, 1.0]) {
    box('waiting_seat', c.lobby.maxX - .17, .43, z, .30, .10, 2.25, C.red);
    box('waiting_back', c.lobby.maxX - .075, .54, z, .10, .52, 2.25, C.plum);
    box('waiting_back_trim', c.lobby.maxX - .14, 1.07, z, .025, .025, 2.26, C.gold, brass);
    for (const dz of [-.92, 0, .92]) {
      box('waiting_leg', c.lobby.maxX - .12, .09, z + dz, .075, .33, .065, C.metal);
      box('waiting_seam', c.lobby.maxX - .19, .535, z + dz, .26, .006, .012, C.rose);
    }
  }
  for (const [x, title, sub] of [[-36.3, 'SUNSET', 'PICTURES PRESENTS'], [-28.4, 'OPENING NIGHT', 'OCTOBER 1986 / STILL SHOWING']]) {
    box('premiere_banner', x, 3.54, -.3, 2.5, .88, .035, C.plum);
    for (const dx of [-1.10, 1.10]) box('premiere_wire', x + dx, 4.42, -.3, .012, .33, .012, C.gold);
    for (const facing of [-1, 1]) label('premiere_print', title, sub, x, 3.98, -.3 + facing * .025, 2.32, .68, facing);
  }
  // Replace the earlier generic placard with a changeable-letter showtime board.
  const showtimes = kit.group.getObjectByName('cinema_decor_showtimes');
  if (showtimes) {
    const cv = canvas(768, 768), ctx = cv.getContext('2d');
    ctx.fillStyle = '#242a2a'; ctx.fillRect(0, 0, 768, 768);
    ctx.strokeStyle = '#bda16b'; ctx.lineWidth = 12; ctx.strokeRect(12, 12, 744, 744);
    drawType(ctx, 'SUNSET CINEMA', 384, 82, { role: 'marquee', size: 66, fill: ['#f3e4bd', '#c9a96a'], maxWidth: 680, outline: { color: '#0e1212', width: 0.05 } });
    drawType(ctx, 'TONIGHT / EVERY NIGHT', 384, 140, { role: 'cinemaBody', size: 28, fill: '#e9d9b4', maxWidth: 680, caps: 'upper', tracking: 0.14 });
    ctx.strokeStyle = '#535a53'; ctx.lineWidth = 2;
    for (let y = 190; y < 620; y += 42) { ctx.beginPath(); ctx.moveTo(35, y); ctx.lineTo(733, y); ctx.stroke(); }
    cinemaDetails.lobby.showtimes.slice(0, 3).forEach((text, i) => drawType(ctx, text, 45, 260 + i * 125,
      { role: 'led', size: 40, fill: '#e9d9b4', maxWidth: 680, align: 'left', baseline: 'alphabetic', glow: false }));
    drawType(ctx, 'MATINEE PRICES / ALL ETERNITY', 384, 688, { role: 'hoffmanSub', size: 26, fill: '#e9d9b4', maxWidth: 680 });
    const replacement = printPanel('showtime_print', cv, showtimes.position.x, showtimes.position.y - Y,
      showtimes.position.z, showtimes.geometry.parameters.width, showtimes.geometry.parameters.height);
    replacement.rotation.copy(showtimes.rotation);
    showtimes.material.map.dispose(); showtimes.material.dispose(); showtimes.geometry.dispose(); showtimes.removeFromParent();
  }
  // Acoustic fabric fills the broad spaces between the earlier thin ribs.
  for (const side of [-1, 1]) {
    const wall = side < 0 ? c.auditorium.minX : c.auditorium.maxX;
    for (const [z0, z1] of D.auditorium.fabricZ) {
      if (side < 0 && z0 > 25) continue; // front-west spawn grille
      box('fabric_panel_frame', wall - side * .057, 1.22, (z0 + z1) / 2, .05, 2.16, z1 - z0, C.ink);
      box('fabric_panel_fill', wall - side * .092, 1.28, (z0 + z1) / 2, .025, 2.04, z1 - z0 - .12, C.plum);
      for (let z = z0 + .18; z < z1 - .12; z += .32)
        box('fabric_weave', wall - side * .116, 1.32, z, .008, 1.95, .012, C.faded);
    }
    // The east wall's broad exit remains fully open.
    for (const [a, b] of side < 0 ? [[7.3, 27.4]] : [[7.3, 21.85], [25.55, 27.4]]) {
      box('auditorium_skirt', wall - side * .07, .10, (a + b) / 2, .09, .17, b - a, C.ink);
      box('continuous_aisle_glow', wall - side * .13, .14, (a + b) / 2, .025, .025, b - a, C.gold, glow);
    }
  }
  box('curtain_pelmet', -33, 4.18, 27.42, 17.4, .35, .39, C.red);
  box('pelmet_braid', -33, 4.16, 27.20, 17.35, .025, .035, C.gold, brass);
  for (let x = -41.2; x < -24.8; x += .45) box('pelmet_fold', x, 4.23, 27.19, .12, .27, .05, C.plum);
  // Chamfered silhouettes replace the original rectangular cushions and backs.
  // Geometry is shared per size and remains owned by this map instance.
  const geometries = new Map();
  for (const m of [...kit.group.children]) {
    if (m.name !== 'cinema_seat' && m.name !== 'cinema_seat_back') continue;
    const { width: w, height: h, depth: d } = m.geometry.parameters, key = `${w}/${h}/${d}`;
    if (!geometries.has(key)) {
      const cut = Math.min(.065, h * .24), shape = new THREE.Shape();
      const points = [[-w / 2 + cut, -h / 2], [w / 2 - cut, -h / 2], [w / 2, -h / 2 + cut],
        [w / 2, h / 2 - cut], [w / 2 - cut, h / 2], [-w / 2 + cut, h / 2], [-w / 2, h / 2 - cut], [-w / 2, -h / 2 + cut]];
      shape.moveTo(...points[0]); for (const p of points.slice(1)) shape.lineTo(...p); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, steps: 1 }); geo.translate(0, 0, -d / 2);
      geometries.set(key, geo);
    }
    m.geometry.dispose(); m.geometry = geometries.get(key);
  }
  // One unmistakable repair scene on the seat already marked by the first pass.
  const fix = D.auditorium.repair, [x0, x1] = c.seats.columns[fix.col], [z0, z1] = c.seats.rows[fix.block];
  const x = x0 + (x1 - x0) / c.seats.perRow * (fix.seat + .5);
  const z = z0 + .38 + fix.row * (z1 - z0 - .7) / (c.seats.rowsPerBlock - 1);
  for (const dx of [-.14, .14]) {
    const tape = box('seat_repair_tape', x + dx, .46, z - .315, .04, .48, .008, C.gold); tape.rotation.z = dx < 0 ? .22 : -.22;
  }
  label('seat_out_of_order', 'RESERVED', 'REPAIR AFTER FINAL SHOW', x, .69, z - .329, .32, .16, -1);
}
