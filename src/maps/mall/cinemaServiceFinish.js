import * as THREE from 'three';
import { cinemaDetails } from '../../config/cinemaDetails.js';
import { cinemaFinish } from '../../config/cinemaFinish.js';
import { cinemaPrint } from './cinemaPrint.js';

// Continuous surfaces and purposeful landmarks for all three service spaces.
// Shallow wall fittings stay outside the existing tested standing envelopes.
export function buildCinemaServiceFinish({ kit, cinema: c, stairs: s, floorY: Y }) {
  const C = cinemaDetails.palette, D = cinemaFinish.service;
  const u = cinemaPrint(kit, C, Y), g = cinemaPrint(kit, C);
  const metal = { metalness: .4, roughness: .65 };
  const lit = { emissive: C.paper, emissiveIntensity: .5 };
  // Utility tile: broad tonal variation, grout and a few repaired tiles.
  function tileCanvas() {
    const cv = u.canvas(256, 256), ctx = cv.getContext('2d');
    ctx.fillStyle = '#586864'; ctx.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      ctx.fillStyle = ['#92a29b', '#9ba9a0', '#879b94', '#a3ada2'][(row * 3 + col) % 4];
      ctx.fillRect(col * 64 + 2, row * 64 + 2, 60, 60);
      ctx.fillStyle = 'rgba(235,234,209,.13)'; ctx.fillRect(col * 64 + 4, row * 64 + 4, 55, 2);
    }
    return cv;
  }
  const tileArt = tileCanvas();
  function tileWall(helper, name, x, z, w, facing) {
    const p = helper.panel(name, tileArt, x, .83, z, w, 1.5, facing);
    const t = p.material.map; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 1.5, 1);
    // Tile must receive room light; the canvas helpers' signs use basic material.
    p.material.dispose(); p.material = new THREE.MeshStandardMaterial({ map: t, roughness: .86 });
  }
  const P = c.passage;
  for (const side of [-1, 1]) {
    const wall = side < 0 ? P.minX : P.maxX, facing = side < 0 ? 'x+' : 'x-';
    const runs = side < 0 ? D.passageRuns : [[5.95, 27.65]];
    for (const [a, b] of runs) {
      tileWall(u, 'passage_tile', wall - side * .012, (a + b) / 2, b - a, facing);
      u.box('rubber_skirt', wall - side * .035, .015, (a + b) / 2, .065, .085, b - a, C.ink);
      u.box('dado_cap', wall - side * .035, 1.60, (a + b) / 2, .065, .045, b - a, C.metal, metal);
    }
    u.box('continuous_conduit', wall - side * .08, 3.16, 16.8, .045, .045, 21.4, C.metal, metal);
    for (const z of D.junctionZ) {
      u.box('junction_box', wall - side * .09, 3.08, z, .10, .22, .24, C.ink);
      u.box('junction_cover', wall - side * .15, 3.10, z, .025, .18, .20, C.metal, metal);
    }
  }
  for (const z of D.bulkheadZ) {
    u.box('passage_light_back', P.maxX - .065, 2.65, z, .12, .32, .8, C.ink);
    u.box('passage_light_diffuser', P.maxX - .14, 2.70, z, .035, .20, .66, C.paper, lit);
    for (const dz of [-.25, .25]) u.box('light_guard', P.maxX - .17, 2.68, z + dz, .025, .24, .025, C.metal);
  }
  // Rewind bench and film transport cases are only 42 cm deep.
  const f = D.handling;
  u.box('rewind_bench_top', f.x, 1.01, f.z, .42, .065, f.width, C.metal, metal);
  for (const z of [f.z - .9, f.z + .9]) u.box('rewind_bench_leg', f.x + .08, .08, z, .07, .90, .07, C.ink);
  for (const z of [f.z - .55, f.z + .55]) {
    u.box('rewind_base', f.x, 1.09, z, .30, .06, .25, C.mint);
    u.cyl('rewind_spool', f.x, 1.35, z, .20, .045, C.gold, [0, 0, Math.PI / 2], metal, 12);
    u.cyl('rewind_hub', f.x - .045, 1.35, z, .052, .06, C.ink, [0, 0, Math.PI / 2]);
    for (const dz of [-.11, .11]) u.cyl('reel_hole', f.x - .027, 1.35, z + dz, .041, .008, C.ink, [0, 0, Math.PI / 2], {}, 8);
  }
  u.box('film_leader', f.x, 1.17, f.z, .018, .025, .75, C.ink);
  for (const z of [f.z - .57, f.z + .48]) {
    u.box('print_case', f.x + .03, .095, z, .35, .49, .65, C.blue);
    u.box('case_handle', f.x - .16, .32, z, .035, .07, .18, C.metal);
  }
  u.label('rewind_station', 'PRINT 01', 'REWIND / INSPECT / REPEAT', P.maxX - .10, 2.23, f.z, 2.1, .65, 'x-');
  u.form('print_log', D.forms[0], D.access.x + .015, 2.28, D.access.z - 1.45, .64, .8, 'x+');
  u.box('access_frame', D.access.x, .20, D.access.z, .10, 2.1, 1.3, C.ink);
  u.box('access_door', D.access.x + .06, .24, D.access.z, .025, 2.02, 1.22, C.metal);
  for (let i = 0; i < 6; i++) u.box('access_louvre', D.access.x + .08, .51 + i * .08, D.access.z, .015, .024, .86, C.ink);
  u.label('access_number', 'AHU 01', 'AIR HANDLING / KEEP CLEAR', D.access.x + .09, 1.85, D.access.z, .92, .30, 'x+');
  // Lower return: blockwork, enamel kick rail, overhead services and framed bays.
  const H = s.returnHall;
  for (const [z, facing] of [[H.minZ + .014, 1], [H.maxZ - .014, -1]]) {
    const cv = g.canvas(256, 128), ctx = cv.getContext('2d');
    ctx.fillStyle = '#9ca49b'; ctx.fillRect(0, 0, 256, 128); ctx.strokeStyle = '#747f77'; ctx.lineWidth = 2;
    for (const y of [1, 64, 127]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    for (const [x, y] of [[1, 0], [128, 0], [64, 64], [192, 64]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke(); }
    const p = g.panel('return_blockwork', cv, -32.8, 1.56, z, 18.7, 3.04, facing);
    const tex = p.material.map; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(18.7 / 1.2, 3.04 / .6);
    p.material.dispose(); p.material = new THREE.MeshStandardMaterial({ map: tex, roughness: .95 });
    g.box('return_kickrail', -32.8, .10, z + facing * .04, 18.7, .14, .055, C.ink);
    g.box('return_chairrail', -32.8, 1.02, z + facing * .04, 18.7, .07, .055, C.mint);
  }
  for (const x of D.returnJoists) {
    g.box('return_ceiling_channel', x, 3.27, 8.6, .12, .12, 2.9, C.metal);
    for (const z of [7.33, 9.87]) g.box('channel_bracket', x, 2.92, z, .16, .35, .08, C.ink);
  }
  for (const x of D.returnBays) {
    g.box('return_wall_batten', x, .29, H.maxZ - .04, .07, 2.45, .06, C.metal);
    for (const z of [7.37, 9.83]) {
      g.box('return_floor_border', x, .019, z, 2.8, .009, .07, C.ink);
      for (const dx of [-1.2, 1.2]) g.box('floor_border_dash', x + dx, .029, z, .10, .008, .07, C.gold);
    }
  }
  const meter = D.meter;
  g.box('meter_backplate', meter.x, 1.22, meter.z, 1.15, 1.30, .11, C.ink);
  for (const dx of [-.30, .30]) {
    g.box('meter_case', meter.x + dx, 1.36, meter.z + .10, .43, .67, .13, C.metal);
    g.cyl('meter_dial', meter.x + dx, 1.78, meter.z + .18, .14, .025, C.paper, [Math.PI / 2, 0, 0]);
    g.box('meter_needle', meter.x + dx, 1.76, meter.z + .20, .018, .11, .012, C.ink);
    g.box('meter_feed', meter.x + dx, 2.06, meter.z, .045, .90, .045, C.metal);
  }
  g.label('meter_warning', 'CINEMA SUPPLY', 'ISOLATE ONLY AFTER FINAL SHOW', meter.x, 2.75, meter.z + .08, 1.6, .40, 1, '#42544e');
  // Shallow docket tray below the existing delivery hatch, no crate in the route.
  g.box('delivery_shelf', D.shipping.x, .62, D.shipping.z - .05, 1.5, .07, .25, C.ink);
  g.form('delivery_docket', D.forms[0], D.shipping.x + 1.15, 1.70, H.maxZ - .11, .62, .80, -1);
  g.form('cleaning_checklist', D.forms[1], -26.25, 1.85, H.maxZ - .10, .68, .88, -1);
  for (const x of [-36, -35.6, -35.2]) {
    g.box('delivery_envelope', x, .70, D.shipping.z - .05, .29, .18, .04, C.paper);
    g.box('envelope_band', x, .76, D.shipping.z - .08, .18, .025, .012, C.red);
  }
  // Stairwell: concrete joints and utility runs follow the tall wall, outside rails.
  g.box('stair_east_paint', s.shaft.maxX - .015, .06, .7, .018, Y - .40, 12.4, 0x8c9891);
  for (const y of [2.8, 5.6]) g.box('stair_east_joint', s.shaft.maxX - .035, y, .7, .012, .016, 12.3, C.metal);
  for (const z of D.stairJointZ) g.box('stair_concrete_joint', s.shaft.minX + .012, .15, z, .018, Y + 4.35, .018, C.metal);
  for (const y of [2.8, 5.6, 8.4]) g.box('stair_pour_joint', s.shaft.minX + .014, y, .6, .018, .016, 18.4, C.metal);
  g.box('stair_vertical_conduit', s.shaft.minX + .09, .2, 9.7, .06, 9.7, .06, C.ink);
  for (const y of [1.3, 4.1, 7, 9.7]) g.box('stair_conduit_clamp', s.shaft.minX + .075, y, 9.7, .10, .05, .14, C.metal);
  g.label('stair_safety', 'WATCH YOUR STEP', '36 STEPS TO YOUR NEXT SHIFT', s.shaft.minX + .08, 8.5, -4.5, 2.3, .65, 'x+', '#42544e');
}
