import { cinemaDetails as d } from '../../config/cinemaDetails.js';
import { cinemaPrint } from './cinemaPrint.js';

export function buildCinemaAuditoriumDetails({ kit, looks, layout: c, floorY: Y }) {
  const C = d.palette, A = c.auditorium, { box, cyl, placard, y, canvas, printPanel } = cinemaPrint(kit, C, Y);
  const metal = { metalness: .45, roughness: .45 };
  box('proscenium_crown', -33, 4.61, A.maxZ - .23, 15.8, .14, .28, C.plum);
  box('proscenium_crown_line', -33, 4.77, A.maxZ - .25, 16.05, .025, .22, C.gold, metal);
  for (const x of [-40.95, -25.05]) {
    box('proscenium_column', x, .18, A.maxZ - .23, .15, 4.4, .17, C.plum);
    box('proscenium_column_inlay', x, .25, A.maxZ - .33, .035, 4.25, .025, C.gold, metal);
  }
  for (const side of [-1, 1]) {
    const wall = side < 0 ? A.minX : A.maxX, front = wall - side * .13;
    for (const z of d.auditorium.ribZ) for (const offset of [-.42, -.30, .30, .42])
      box('acoustic_flute', front, 1.52, z + offset, .025, 1.75, .035, C.rose);
    for (const z of d.auditorium.speakerZ) {
      box('speaker_cabinet', wall - side * .095, 3.57, z, .17, .55, .44, C.ink);
      cyl('speaker_woofer', wall - side * .19, 3.80, z, .15, .025, C.metal, [0, 0, Math.PI / 2]);
      cyl('speaker_cone', wall - side * .21, 3.80, z, .105, .025, C.ink, [0, 0, Math.PI / 2]);
      cyl('speaker_tweeter', wall - side * .21, 4.02, z, .035, .025, C.gold, [0, 0, Math.PI / 2]);
    }
  }
  for (const z of d.auditorium.ceilingZ) for (const x of [-38, -33, -28]) {
    box('ceiling_acoustic_fin', x, 4.34, z, 2.7, .14, .55, C.plum);
    box('ceiling_fin_trim', x, 4.31, z - .26, 2.7, .02, .025, C.gold);
  }
  // A sealed service window behind the projector, without a new sightline.
  box('projection_hatch_frame', -33, 3.28, A.minZ + .075, 3.1, 1.06, .12, C.gold);
  box('projection_hatch', -33, 3.34, A.minZ + .15, 2.95, .94, .025, C.ink);
  for (const x of [-34.35, -33, -31.65]) box('projection_mullion', x, 3.34, A.minZ + .18, .035, .94, .025, C.metal);
  placard('projection_notice', 'PROJECTOR 01 / RUNNING', -33, 4.48, A.minZ + .08, 2.6, .18);

  // Small geometric seat numbers batch into one material instead of 84 textures.
  const digits = { 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgecd', 7: 'abc' };
  const strokes = { a: [0, .068, .034, .006], g: [0, .035, .034, .006], d: [0, .002, .034, .006],
    b: [.017, .038, .006, .03], c: [.017, .006, .006, .03], f: [-.017, .038, .006, .03], e: [-.017, .006, .006, .03] };
  let rowId = 0;
  for (let block = 0; block < c.seats.rows.length; block++) {
    const [z0, z1] = c.seats.rows[block];
    for (let row = 0; row < c.seats.rowsPerBlock; row++, rowId++) {
      const z = z0 + .38 + row * (z1 - z0 - .7) / (c.seats.rowsPerBlock - 1);
      for (let col = 0; col < c.seats.columns.length; col++) {
        const [x0, x1] = c.seats.columns[col], spacing = (x1 - x0) / c.seats.perRow;
        const rowArt = canvas(128, 128), rowCtx = rowArt.getContext('2d');
        rowCtx.fillStyle = '#49354d'; rowCtx.fillRect(0, 0, 128, 128);
        rowCtx.strokeStyle = '#efdfbf'; rowCtx.lineWidth = 4; rowCtx.strokeRect(7, 7, 114, 114);
        rowCtx.fillStyle = '#efdfbf'; rowCtx.textAlign = 'center'; rowCtx.font = 'bold 86px Georgia, serif';
        rowCtx.fillText(String.fromCharCode(65 + rowId), 64, 95);
        printPanel('row_letter', rowArt, x0 + .13, .84, z - .325, .16, .14, -1);
        for (let i = 0; i < c.seats.perRow; i++) {
          const x = x0 + spacing * (i + .5), hx = x + spacing * .45;
          cyl('cupholder_lip', hx, .642, z + .16, .043, .018, C.gold, [0, 0, 0], metal, 8);
          cyl('cupholder_well', hx, .654, z + .16, .031, .008, C.ink, [0, 0, 0], {}, 8);
          for (const digit of digits[i + 1]) {
            // Viewed from the lobby (-Z), screen-right points toward world -X.
            const [dx, dy, w, height] = strokes[digit]; box('seat_number', x - dx, .77 + dy, z - .302, w, height, .008, C.paper);
          }
          // Coordinated upholstery wear, with the geometry and hit clearance unchanged.
          if ((i + row * 3 + col * 5 + block * 7) % 11 === 3) {
            for (const m of kit.group.children) if ((m.name === 'cinema_seat' || m.name === 'cinema_seat_back')
              && Math.abs(m.position.x - x) < .01 && Math.abs(m.position.z - z) < .4) m.material = kit.mat(C.faded);
          }
        }
      }
    }
  }
  for (const [col, block, row, seat, kind] of d.auditorium.seatStories) {
    const [x0, x1] = c.seats.columns[col], [z0, z1] = c.seats.rows[block], spacing = (x1 - x0) / c.seats.perRow;
    const x = x0 + spacing * (seat + .5), z = z0 + .38 + row * (z1 - z0 - .7) / (c.seats.rowsPerBlock - 1);
    if (kind === 'drink') {
      cyl('seat_drink', x + spacing * .45, .76, z + .16, .055, .20, C.paper);
      box('seat_drink_straw', x + spacing * .45, .86, z + .16, .012, .11, .012, C.red);
    } else if (kind === 'coat') {
      box('forgotten_coat', x, .52, z + .02, .39, .035, .40, col ? C.blue : C.mint);
      const sleeve = box('coat_sleeve', x + .18, .54, z + .12, .16, .025, .17, col ? C.blue : C.mint); sleeve.rotation.y = .3;
    } else if (kind === 'repair') {
      box('seat_repair_patch', x, .66, z - .304, .20, .13, .012, C.plum);
      for (const dx of [-.09, .09]) box('repair_stitch', x + dx, .69, z - .314, .013, .07, .008, C.paper);
    } else {
      box('seat_carton', x + .10, .52, z + .08, .15, .16, .14, C.red);
      box('carton_stripe', x + .10, .56, z + .155, .11, .035, .008, C.paper);
    }
  }
  // A local screen wash; there is no flashing light or full-screen modulation.
  const screenWash = looks.pool(-33, Y + 2.5, A.maxZ - .035, 15.5, 4.3, -1, '#cbb5df', d.motion.screenWashOpacity);
  looks.pool(-33, Y + .016, 25.6, 12, 3.5, 'floor', '#bdabcf', .035);
  return { screenWash };
}
