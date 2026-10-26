import { cinemaDetails as d } from '../../config/cinemaDetails.js';
import { cinemaDecorKit } from './cinemaDecorKit.js';

export function buildCinemaArchitecture({ kit, looks, layout: c, floorY: Y }) {
  const { box, cyl, placard, y } = cinemaDecorKit(kit, d.palette, Y), C = d.palette, L = c.lobby;
  const glow = { emissive: C.cream, emissiveIntensity: .65, roughness: .8 };
  function pieces(from, to, gaps) {
    const out = []; let cursor = from;
    for (const [a, b] of [...gaps].sort((a, b) => a[0] - b[0])) { if (a > cursor) out.push([cursor, Math.min(a, to)]); cursor = Math.max(cursor, b); }
    if (cursor < to) out.push([cursor, to]); return out.filter(([a, b]) => b > a);
  }
  function band(along, from, to, at, facing, gaps) {
    for (const [a, b] of pieces(from, to, gaps)) {
      const x = along === 'x' ? (a + b) / 2 : at + facing * .035;
      const z = along === 'z' ? (a + b) / 2 : at + facing * .035;
      box('upholstered_band', x, .12, z, along === 'x' ? b - a : .07, .48, along === 'z' ? b - a : .07, C.plum);
      box('band_rail', x, .63, z, along === 'x' ? b - a : .085, .035, along === 'z' ? b - a : .085, C.gold);
    }
  }
  band('x', L.minX, L.maxX, L.maxZ, -1, [[c.auditoriumEntry.from, c.auditoriumEntry.to], [c.passageEntry.from, c.passageEntry.to]]);
  band('x', L.minX, L.maxX, L.minZ, 1, [...c.futureScreens.map(s => [s.from, s.to]), [-29.3, -27.7], [c.ticketBooth.minX, c.ticketBooth.maxX]]);
  band('z', L.minZ, L.maxZ, L.minX, 1, [[c.stairsEntry.from, c.stairsEntry.to], [-9.65, -8.15], [c.concessions.minZ, c.concessions.maxZ]]);
  band('z', L.minZ, L.maxZ, L.maxX, -1, [[-4.1, -1.7], [3.0, 4.6]]);
  for (const z of [L.minZ + .05, L.maxZ - .05]) {
    box('cornice_lower', -31.15, 3.42, z, 21.45, .07, .10, C.gold);
    box('cornice_step', -31.15, 3.52, z, 21.45, .12, .12, C.cream);
  }
  for (const x of d.lobby.pilasters) {
    box('pilaster', x, .08, L.maxZ - .065, .22, 3.31, .13, C.cream);
    box('pilaster_flute', x, .25, L.maxZ - .14, .065, 2.94, .018, C.gold);
    box('pilaster_capital', x, 3.24, L.maxZ - .095, .36, .11, .19, C.gold);
  }
  for (const x of d.lobby.cofferX) for (const z of d.lobby.cofferZ) {
    for (const dx of [-1.5, 1.5]) box('coffer_side', x + dx, c.height - .23, z, .10, .12, 2.15, C.cream);
    for (const dz of [-1.025, 1.025]) box('coffer_end', x, c.height - .23, z + dz, 2.9, .12, .10, C.cream);
    box('coffer_inset', x, c.height - .10, z, 2.86, .03, 1.94, C.plum);
    box('coffer_lamp', x, c.height - .16, z, 1.7, .025, .22, C.cream, glow);
    box('coffer_lamp_edge', x, c.height - .13, z, 1.85, .025, .36, C.gold);
  }
  for (const s of c.futureScreens) {
    const mid = (s.from + s.to) / 2;
    for (const x of [s.from - .10, s.to + .10]) {
      box('screen_door_jamb', x, .08, L.minZ + .065, .15, 2.75, .13, C.cream);
      box('screen_door_flute', x, .22, L.minZ + .14, .045, 2.48, .025, C.gold);
    }
    box('screen_door_header', mid, 2.85, L.minZ + .075, 3.5, .38, .15, C.plum);
    placard('future_screen', s.label, mid, 3.04, L.minZ + .17, 3.15, .28);
    box('screen_door_crown', mid, 3.27, L.minZ + .055, 3.8, .08, .11, C.gold);
  }
  // Marquee surrounds the existing sign. All bulbs are steady, local geometry.
  for (const side of [-1, 1]) {
    const x = side < 0 ? -19.85 : -20.48, facing = side < 0 ? 'x+' : 'x-';
    for (const z of [-4.56, -1.24]) box('marquee_end', x, 2.89, z, .09, .55, .07, C.gold);
    for (const h of [2.89, 3.44]) box('marquee_border', x, h, -2.9, .09, .055, 3.39, C.gold);
    for (let i = 0; i < 13; i++) for (const h of [2.94, 3.40]) cyl('marquee_bulb', x + (side < 0 ? .035 : -.035), h, -4.4 + i * .25,
      .024, .025, C.cream, [0, 0, Math.PI / 2], glow, 6);
    looks.pool(x + (side < 0 ? -.01 : .01), y(3.15), -2.9, 3.7, .9, facing, '#efc58e', .09);
  }
  looks.pool(L.minX + .02, y(2.9), .45, 5.5, 1.8, 'x+', '#ffd3a5', .12);
  looks.pool(-24.1, y(2.9), L.minZ + .02, 4.6, 1.6, 1, '#ffdba9', .10);
  looks.pool(-31, Y + .018, -.5, 13, 10, 'floor', '#c995ae', .045);
}
