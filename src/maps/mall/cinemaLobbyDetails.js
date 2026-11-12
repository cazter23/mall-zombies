import { cinemaDetails as d } from '../../config/cinemaDetails.js';
import { cinemaDecorKit } from './cinemaDecorKit.js';
import { seededRandom } from '../../world/textures.js';
import { drawType } from '../../world/typeKit.js';

export function buildCinemaLobbyDetails({ kit, layout: c, floorY: Y }) {
  const C = d.palette, { box, cyl, placard, panel, canvas } = cinemaDecorKit(kit, C, Y);
  const brass = { metalness: .45, roughness: .4 }, glass = { transparent: true, opacity: .20, roughness: .2 };
  const warm = { emissive: C.paper, emissiveIntensity: .35 };
  // The concession machines sit inside the original enclosed counter footprint.
  const px = -41.38, pz = -1.65;
  box('popper_base', px, 1.05, pz, .60, .13, 1.05, C.red);
  box('popper_window', px, 1.18, pz, .55, .9, .98, 0xc5d6cd, glass);
  for (const x of [px - .29, px + .29]) for (const z of [pz - .49, pz + .49]) box('popper_post', x, 1.17, z, .028, .94, .028, C.gold, brass);
  box('popper_canopy', px, 2.12, pz, .70, .17, 1.15, C.red);
  box('popper_canopy_tip', px, 2.30, pz, .48, .065, .96, C.gold, brass);
  cyl('popper_kettle', px, 1.80, pz, .16, .13, C.metal, [0, 0, 0], brass);
  box('kettle_hanger', px, 1.87, pz, .025, .24, .025, C.metal);
  const rand = seededRandom(451);
  for (let i = 0; i < 26; i++) {
    const z = pz + (rand() - .5) * .8, x = px + (rand() - .5) * .42;
    const kernel = box('warmer_popcorn', x, 1.18 + rand() * .12, z, .055, .05, .06, i % 3 ? C.paper : C.gold, warm);
    kernel.rotation.y = rand();
  }
  placard('popper_brand', 'SUNSET\nFRESH SINCE 1986', px + .365, 2.20, pz, .88, .13, 'x+');
  // A sloping candy display, with deliberately uneven rows and empty slots.
  box('candy_shelf', px, 1.08, -.12, .57, .05, 1.27, C.gold);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
    if ((row === 0 && i === 2) || (row === 1 && i > 3)) continue;
    const z = -.70 + i * .22, x = px + (row ? -.13 : .13);
    const m = box('candy_box', x, 1.14 + row * .08, z, .22, .13, .18,
      [C.rose, C.mint, C.gold, C.blue][(row * 2 + i) % 4]); m.rotation.y = (rand() - .5) * .13;
    box('candy_wrapper', x + .115, 1.17 + row * .08, z, .012, .035, .12, C.paper);
  }
  box('napkin_case', -41.1, 1.08, .68, .24, .22, .26, C.metal, brass);
  box('napkins', -41.1, 1.31, .68, .18, .03, .20, C.cream);
  box('waste_slot', c.concessions.maxX + .016, .58, .66, .018, .11, .36, C.ink);
  // Soda fountain, three distinct flavours and three small taps.
  box('soda_base', px, 1.06, 1.28, .62, .15, .80, C.ink);
  box('soda_body', px - .05, 1.21, 1.28, .47, .72, .80, C.mint);
  for (let i = 0; i < 3; i++) {
    const z = 1.03 + i * .25;
    box('soda_flavour', px + .195, 1.57, z, .025, .25, .19, [C.red, C.gold, C.blue][i]);
    box('soda_tap', px + .245, 1.37, z, .075, .075, .045, C.metal, brass);
    box('soda_lever', px + .28, 1.33, z, .025, .12, .035, C.ink);
  }
  cyl('forgotten_drink', px + .13, 1.28, 1.55, .07, .22, C.cream);
  box('drink_straw', px + .13, 1.39, 1.55, .014, .16, .014, C.red);
  // Twin slush tanks, opaque syrup inside a larger clear cylinder.
  for (const [z, color] of [[2.26, C.red], [2.78, C.blue]]) {
    box('slush_base', px, 1.06, z, .55, .22, .43, C.metal);
    cyl('slush_glass', px, 1.61, z, .19, .62, 0xd3e6df, [0, 0, 0], glass);
    cyl('slush_syrup', px, 1.55, z, .166, .45, color, [0, 0, 0], { roughness: .5 });
    cyl('slush_cap', px, 1.94, z, .21, .055, C.ink);
    box('slush_tap', px + .25, 1.18, z, .12, .09, .07, C.ink);
  }
  // Illustrated concession menu panels, printed once; food prices are scenery.
  for (let i = 0; i < 2; i++) {
    const cv = canvas(640, 256), ctx = cv.getContext('2d');
    ctx.fillStyle = i ? '#48665f' : '#623d55'; ctx.fillRect(0, 0, 640, 256);
    drawType(ctx, d.lobby.menu[i], 320, 45, { role: 'marquee', size: 36, fill: '#efdfbb', maxWidth: 580 });
    for (let j = 0; j < 3; j++) {
      const x = 115 + j * 205;
      ctx.fillStyle = ['#d3a857', '#bd8492', '#97b4a6'][j];
      ctx.beginPath(); ctx.moveTo(x - 30, 95); ctx.lineTo(x + 30, 95); ctx.lineTo(x + 22, 167); ctx.lineTo(x - 22, 167); ctx.closePath(); ctx.fill();
      drawType(ctx, (i ? ['CANDY', 'SLUSH', 'SODA'] : ['SMALL', 'LARGE', 'REFILL'])[j], x, 205, { role: 'cinemaBody', size: 24, fill: '#efdfbb', maxWidth: 180, tracking: 0.1 });
      drawType(ctx, ['$1.25', '$2.50', '$0.75'][j], x, 231, { role: 'priceTag', size: 28, fill: '#efdfbb', maxWidth: 180 });
    }
    panel('menu_illustration', cv, c.lobby.minX + .10, 3.77, i ? 1.85 : -.92, 2.45, .98, 'x+');
  }
  // Box office: a real speaker grille, ticket printer and a stopped wall clock.
  const tx = (c.ticketBooth.minX + c.ticketBooth.maxX) / 2, front = c.ticketBooth.maxZ;
  box('ticket_printer', tx - .85, 1.06, -9.85, .43, .29, .35, C.mint);
  box('printer_slot', tx - .85, 1.22, -9.665, .27, .035, .018, C.ink);
  cyl('ticket_spool', tx - .85, 1.42, -9.84, .105, .23, C.paper, [0, 0, Math.PI / 2]);
  box('ticket_tail', tx - .85, .89, front + .025, .18, .25, .018, C.paper);
  box('register', tx + .9, 1.07, -9.85, .53, .25, .35, C.ink);
  box('register_display', tx + .9, 1.34, -9.85, .38, .22, .10, C.mint);
  placard('register_readout', 'ADMIT ONE', tx + .9, 1.44, -9.79, .34, .09);
  cyl('ticket_speaker', tx, 1.98, front + .035, .15, .026, C.gold, [Math.PI / 2, 0, 0], brass);
  cyl('speaker_mesh', tx, 1.98, front + .055, .12, .015, C.ink, [Math.PI / 2, 0, 0]);
  for (let i = -2; i <= 2; i++) box('grille_slot', tx, 1.98 + i * .032, front + .067, .18, .009, .008, C.metal);
  const clockZ = c.lobby.minZ + .11;
  cyl('office_clock', tx, 3.78, clockZ, .30, .045, C.gold, [Math.PI / 2, 0, 0], brass, 16);
  cyl('clock_face', tx, 3.78, clockZ + .03, .26, .012, C.cream, [Math.PI / 2, 0, 0], {}, 16);
  const hand = box('clock_hand', tx - .035, 3.78, clockZ + .043, .018, .19, .008, C.ink); hand.rotation.z = .85;
  const hour = box('clock_hand', tx + .025, 3.78, clockZ + .045, .018, .12, .008, C.ink); hour.rotation.z = -.9;
  placard('showtimes', `TONIGHT / EVERY NIGHT\n${d.lobby.showtimes.join('\n')}`, -28.3, 2.60, c.lobby.minZ + .12, 1.85, 1.63);
  // The island gets a flush film-strip inlay; the complete vault stays clear.
  const island = c.island, iz = (island.minZ + island.maxZ) / 2;
  cyl('island_sun', -33.5, island.height + .012, iz, .26, .018, C.gold);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const ray = box('island_ray', -33.5 + Math.sin(angle) * .32, island.height + .006, iz + Math.cos(angle) * .24, .025, .014, .07, C.gold); ray.rotation.y = angle;
  }
  for (const z of [island.minZ + .06, island.maxZ - .06]) for (let i = 0; i < 16; i++)
    box('island_film_perforation', island.minX + .15 + i * .26, island.height + .005, z, .08, .012, .035, C.cream);
}
