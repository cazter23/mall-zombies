// =============================================================================
// SERVICE CORRIDOR, EAST WALL: back-of-house fittings on the long wall shared with the Food Court (the west wall already had
// pipes, vents, the electrical panel and the lockers; the east face only had posters and a dying tube).
// What goes up: two conduit runs with junction boxes, a fire extinguisher cabinet, a time clock, a staff corkboard, a first-aid
// box, hazard striping round the Food Court shortcut, a painted walkway line on the floor and a mop bucket.
// Everything is decoration (collide:false), hung 4 cm or more off the wall (the z-fight rule), clear of the posters in
// zoneLooks.js (z centres 0.4-1.2, 5.5, 9.5 and 12 m down the corridor) and of the doorway at the south end.
//
// buildServiceDetails({ kit, eastX, zAt, endZ, shortcut })
//   eastX  the wall's face (x); things hang out to the west of it.   zAt(m)  world z, m metres down from the turn
//   shortcut  { minZ, maxZ }  the doorway to the Food Court
// =============================================================================

/** Dress the Service Corridor's east wall. */
export function buildServiceDetails({ kit, eastX, zAt, endZ, shortcut }) {
  const mat = (color) => kit.mat(color);
  // A box on the wall: z0..z1 along it, y0..y1 up it, d0..d1 out from the wall (d 0.04 and up).
  const B = (z0, y0, z1, y1, d0, d1, material) => kit.box(
    eastX - d1, y0, Math.min(z0, z1), eastX - d0, y1, Math.max(z0, z1), material, { collide: false });
  const label = (text, z, y, width, height, background, color) => kit.sign(text, {
    x: eastX - 0.06, y, z, width, height, facing: 'x-', background, color,
  });
  const steel = mat(0x7b8086), darkSteel = mat(0x4a4e53), red = mat(0xb3262f), white = mat(0xf3efe4), black = mat(0x1c1b1e);
  const yellow = mat(0xf2c230), paper = mat(0xf5eed8), cork = mat(0xb98a52), green = mat(0x2f7d4f);
  const top = zAt(0.1);

  // Two conduit runs above the dying tube (y 2.95), with a junction box every few metres. They break round the
  // EXIT · FOOD COURT plaque over the shortcut (mall.js: 2.6 m wide, y 3.075..3.425), which would otherwise sit behind them;
  // a junction box closes each end of the gap. (tests/shutters.test.js checks nothing hides that sign.)
  const mid = (shortcut.minZ + shortcut.maxZ) / 2;
  const gapLo = mid - 1.4, gapHi = mid + 1.4;
  for (const [from, to] of [[top, gapHi], [gapLo, endZ]]) {
    B(from, 3.1, to, 3.16, 0.05, 0.11, steel);
    B(from, 3.22, to, 3.28, 0.05, 0.11, darkSteel);
  }
  for (const z of [gapLo - 0.14, gapHi + 0.14]) B(z - 0.14, 3.04, z + 0.14, 3.34, 0.04, 0.17, darkSteel);
  for (let m = 1.2; m < 15.5; m += 3.4) {
    const z = zAt(m);
    if (z > gapLo - 0.3 && z < gapHi + 0.3) continue; // (none in the gap)
    B(z - 0.14, 3.04, z + 0.14, 3.34, 0.04, 0.17, darkSteel);
    B(z - 0.1, 3.08, z + 0.1, 3.12, 0.17, 0.19, black); // (the cover screws' line)
  }

  // Fire extinguisher cabinet with the extinguisher showing through its window.
  const fz = zAt(4.2);
  B(fz - 0.22, 0.95, fz + 0.22, 1.75, 0.04, 0.16, red);
  B(fz - 0.16, 1.02, fz + 0.16, 1.68, 0.16, 0.17, white);
  B(fz - 0.06, 1.08, fz + 0.06, 1.5, 0.17, 0.27, red);
  B(fz - 0.03, 1.5, fz + 0.03, 1.58, 0.17, 0.23, black);
  //label('FIRE', fz, 1.88, 0.44, 0.14, '#b3262f', '#ffffff');

  // Time clock: a grey box with a clock face, a card slot and two lights, a card rack beside it.
  const tz = zAt(6.9);
  B(tz - 0.26, 1.15, tz + 0.26, 1.75, 0.04, 0.18, steel);
  B(tz - 0.2, 1.45, tz + 0.2, 1.7, 0.18, 0.2, white);
  B(tz - 0.01, 1.5, tz + 0.01, 1.62, 0.2, 0.21, black);
  B(tz - 0.01, 1.58, tz + 0.07, 1.6, 0.2, 0.21, black);
  B(tz - 0.17, 1.28, tz + 0.05, 1.33, 0.18, 0.2, black);
  B(tz + 0.1, 1.27, tz + 0.15, 1.33, 0.18, 0.2, red);
  B(tz + 0.17, 1.27, tz + 0.22, 1.33, 0.18, 0.2, green);
  B(tz + 0.3, 1.2, tz + 0.55, 1.55, 0.04, 0.1, darkSteel);
  for (let k = 0; k < 4; k++) B(tz + 0.33 + k * 0.05, 1.3, tz + 0.36 + k * 0.05, 1.5, 0.1, 0.12, paper);

  // Staff corkboard: a wooden frame, cork, and pinned notices.
  const cz = zAt(8.2);
  B(cz - 0.5, 1.2, cz + 0.5, 2.0, 0.04, 0.08, mat(0x5e3b1f));
  B(cz - 0.45, 1.25, cz + 0.45, 1.95, 0.08, 0.09, cork);
  [[-0.38, 1.55, 0.3, 0.3], [-0.02, 1.45, 0.28, 0.4], [0.28, 1.6, 0.14, 0.3], [-0.3, 1.25, 0.2, 0.16], [0.05, 1.3, 0.3, 0.13]].forEach(([dz, y, w, h], i) => {
    B(cz + dz, y + 0.0, cz + dz + w, y + h, 0.09, 0.1, i % 2 ? yellow : paper);
    B(cz + dz + w / 2 - 0.015, y + h - 0.04, cz + dz + w / 2 + 0.015, y + h - 0.01, 0.1, 0.11, red); // the pin
  });

  // First-aid box: white with a green cross.
  const az = zAt(10.9);
  B(az - 0.22, 1.1, az + 0.22, 1.6, 0.04, 0.14, white);
  B(az - 0.04, 1.2, az + 0.04, 1.5, 0.14, 0.15, green);
  B(az - 0.15, 1.31, az + 0.15, 1.39, 0.14, 0.15, green);
  //label('FIRST AID', az, 1.72, 0.5, 0.13, '#2f7d4f', '#ffffff');

  // Hazard stripes (yellow and black blocks) up both jambs of the Food Court doorway.
  for (const [a, b] of [[shortcut.maxZ, shortcut.maxZ + 0.14], [shortcut.minZ - 0.14, shortcut.minZ]]) {
    for (let y = 0, k = 0; y < 3; y += 0.25, k++) B(a, y, b, Math.min(y + 0.25, 3), 0.04, 0.06, k % 2 ? black : yellow);
  }

  // A painted walkway line on the floor, dashed, 0.55 m off the east wall.
  for (let m = 0.4; m < 15; m += 1.1) {
    kit.box(eastX - 0.62, 0, zAt(m + 0.6), eastX - 0.55, 0.025, zAt(m), yellow, { collide: false });
  }

  // A mop bucket with a mop leaning on the wall, beside the first-aid box's far side.
  const mz = zAt(9.6);
  kit.box(eastX - 0.5, 0, mz - 0.18, eastX - 0.15, 0.36, mz + 0.17, mat(0xe8b923), { collide: false });
  kit.box(eastX - 0.46, 0.34, mz - 0.14, eastX - 0.19, 0.37, mz + 0.13, mat(0x3a6f8a), { collide: false });
  B(mz - 0.02, 0.3, mz + 0.02, 1.35, 0.05, 0.09, mat(0xa97c50));
  B(mz - 0.09, 0.3, mz + 0.09, 0.62, 0.05, 0.16, mat(0xd9d4c4));
}
