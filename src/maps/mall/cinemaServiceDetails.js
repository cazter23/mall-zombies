import * as THREE from 'three';
import { cinemaDetails as d } from '../../config/cinemaDetails.js';
import { cinemaDecorKit } from './cinemaDecorKit.js';
import { seededRandom } from '../../world/textures.js';

export function buildCinemaServiceDetails({ kit, looks, cinema: c, stairs: s, floorY: Y }) {
  const C = d.palette, P = c.passage, upper = cinemaDecorKit(kit, C, Y), ground = cinemaDecorKit(kit, C);
  const metal = { metalness: .45, roughness: .55 }, { box, cyl, placard, y } = upper;
  // The passage's cables and duct stay above every standing/jumping route.
  box('projection_duct', -22, 4.33, 16.6, .55, .22, 20.8, C.metal);
  for (const z of [8.2, 13.3, 19.2, 25.5]) {
    box('duct_band', -22, 4.30, z, .62, .28, .045, C.ink);
    box('cable_tray', P.maxX - .15, 3.96, z, .22, .09, 4.6, C.metal);
    box('cable_bundle', P.maxX - .15, 4.06, z, .09, .025, 4.4, C.ink);
  }
  // A service cabinet and film-reel rack form two different landmarks.
  const wall = P.maxX;
  box('projector_control_case', wall - .045, .72, d.service.passagePanels[0], .09, 1.50, 1.2, C.metal);
  box('control_door', wall - .10, .80, d.service.passagePanels[0], .025, 1.33, 1.05, C.mint);
  for (let i = 0; i < 3; i++) {
    box('meter_face', wall - .12, 1.67, 10.2 + i * .29, .02, .22, .20, C.paper);
    box('meter_needle', wall - .135, 1.71, 10.2 + i * .29, .015, .08, .012, C.ink);
    box('control_switch', wall - .13, 1.12, 10.2 + i * .29, .025, .09, .055, i ? C.ink : C.red);
  }
  placard('control_id', 'PROJECTOR / 01', wall - .13, 2.42, 10.5, 1.2, .20, 'x-');
  box('reel_rack', wall - .04, .70, 18.2, .07, 1.55, 1.4, C.ink);
  for (const z of [17.78, 18.25, 18.68]) for (const h of [1.05, 1.68]) {
    cyl('film_canister', wall - .12, h, z, .20, .07, C.metal, [0, 0, Math.PI / 2], metal, 12);
    cyl('canister_centre', wall - .165, h, z, .06, .02, C.gold, [0, 0, Math.PI / 2]);
    for (let i = -1; i <= 1; i++) box('canister_label', wall - .18, h - .018, z + i * .07, .008, .03, .04, C.paper);
  }
  // Shallow equipment on the west wall keeps clear of the auditorium crossover.
  const west = P.minX;
  cyl('extinguisher', west + .12, .95, d.service.passageFrames[0], .075, .47, C.red);
  box('extinguisher_bracket', west + .04, .70, 8.8, .05, .58, .20, C.metal);
  box('extinguisher_handle', west + .12, 1.20, 8.8, .09, .045, .16, C.ink);
  placard('maintenance_notice', d.story.maintenance, west + .10, 2.12, d.service.passageFrames[1], 1.05, .85, 'x+', '#e6d7bc', '#4d4b51');
  placard('last_inspection', 'LAST INSPECTION\nOCT 1986\nNEXT: OPENING NIGHT', west + .10, 2.15, d.service.passageFrames[2], .95, .85, 'x+', '#d5dfd4', '#3c5253');
  looks.pool(P.maxX - .02, y(2.4), 10.5, 3, 2.8, 'x-', '#a8d0c6', .10);
  looks.pool(P.minX + .02, y(2.9), 26.5, 2, 1.4, 'x+', '#e7ce9b', .07);

  const { box: gb, cyl: gc, placard: gp, canvas, panel } = ground;
  const north = s.returnHall.maxZ, south = s.returnHall.minZ;
  for (const h of [3.02, 3.19]) gb('return_pipe', -32.6, h, south + .065, 18.7, .045, .055, h < 3.1 ? C.metal : C.mint);
  for (const x of d.service.pipeX) gb('pipe_clamp', x, 2.98, south + .09, .035, .30, .08, C.ink);
  for (const z of [south + .22, north - .22]) gb('floor_guideline', -32.7, .012, z, 18.6, .008, .035, C.mint);
  // Film-delivery hatch: a wall-mounted prop, with no implied walk-in room.
  const delivery = d.service.returnPanels[0];
  gb('film_delivery_hatch', delivery, .72, north - .035, 1.45, 1.32, .07, C.metal);
  gb('delivery_hatch_inset', delivery, .82, north - .081, 1.28, 1.10, .018, C.ink);
  gb('delivery_hatch_handle', delivery + .48, 1.27, north - .104, .04, .23, .025, C.gold);
  gp('delivery_instructions', d.story.delivery, delivery, 2.52, north - .085, 1.55, .68, -1);
  // Cleaner station: flat hooks, a broom and a mop, held against the wall.
  const cleaner = d.service.returnPanels[1];
  gb('cleaner_hook_rail', cleaner, 1.70, north - .04, 1.20, .07, .07, C.metal);
  for (const x of [cleaner - .30, cleaner + .30]) {
    gb('cleaner_hook', x, 1.62, north - .085, .04, .12, .03, C.gold);
    gb('tool_handle', x, .24, north - .07, .025, 1.33, .025, C.mint);
  }
  gb('broom_head', cleaner - .30, .13, north - .07, .30, .10, .055, C.gold);
  for (let i = 0; i < 5; i++) gb('mop_strand', cleaner + .21 + i * .045, .12 + (i % 2) * .015, north - .095, .033, .17, .04, C.paper);
  gp('cleaning_notice', d.story.cleaner, cleaner, 2.95, north - .09, 1.3, .65, -1, '#d1dcd2', '#3f5452');
  // Stencilled landing numbers are transparent artwork rather than more signs.
  for (const st of d.service.stairStencils) {
    const cv = canvas(512, 320), ctx = cv.getContext('2d'), [number, label] = st.text.split(' / ');
    ctx.clearRect(0, 0, 512, 320); ctx.fillStyle = '#b9c9bd'; ctx.textAlign = 'center';
    ctx.font = 'bold 210px sans-serif'; ctx.fillText(number, 256, 220);
    ctx.font = 'bold 30px sans-serif'; ctx.fillText(label, 256, 283);
    const stencil = panel('landing_stencil', cv, s.shaft.minX + .035, st.h, st.z, 2.35, 1.45, 'x+');
    stencil.material.transparent = true; stencil.material.depthWrite = false;
  }
  // Worn paint and repair patches, with individual shapes instead of uniform dirt.
  for (const [x, z, w, h] of [[-39.3, north - .025, 1.8, .30], [-31.2, south + .025, 2.3, .45], [-25.2, north - .025, .8, .65]])
    gb('paint_repair', x, .25, z, w, h, .018, x < -35 ? 0x8b9c98 : 0xa1a9a2);
  for (const [z, h] of [[-3, 5.7], [3.3, 2.4]]) {
    gb('stair_repair', s.shaft.minX + .015, h, z, .025, .7, 1.2, 0x8a9892);
    for (let i = 0; i < 3; i++) gb('stair_water_streak', s.shaft.minX + .03, h - .25 - i * .1, z + i * .23, .009, .45, .035, 0x717f7a);
  }
  let nosing = 0;
  for (const m of kit.group.children) if (m.name === 'cinema_stairs_nosing' && nosing++ % 6 === 0)
    m.material = kit.mat(C.mint, { emissive: C.mint, emissiveIntensity: .45 });
  // Low-contrast concrete grain on existing slabs: no overlay/floor collision.
  const rand = seededRandom(903), cv = canvas(128, 128), ctx = cv.getContext('2d');
  ctx.fillStyle = '#969e99'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 220; i++) { ctx.fillStyle = i % 2 ? 'rgba(40,50,48,.09)' : 'rgba(245,239,216,.10)'; ctx.fillRect(rand() * 128, rand() * 128, 1 + rand() * 3, 1); }
  for (const name of ['return_floor', 'connector_floor', 'lower_landing', 'upper_landing']) {
    const mesh = kit.group.getObjectByName(`cinema_stairs_${name}`); if (!mesh) continue;
    const texture = new THREE.CanvasTexture(cv); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(mesh.geometry.parameters.width / 2, mesh.geometry.parameters.depth / 2);
    mesh.material = new THREE.MeshStandardMaterial({ map: texture, roughness: .94 });
  }
}
