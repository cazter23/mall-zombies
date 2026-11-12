// =============================================================================
// STALL THEMES: the extra, per-stall look that makes a Food Court stall read as what it is named, on top of the generic stall
// props.foodStall builds (facade, awning, counter, hood, gear). A theme is a function that gets the stall's frame and adds
// decoration only: every box is `collide: false`, hung at least 2 cm proud of a surface (the z-fight rule in CLAUDE.md), and
// kept below the ceiling duct (y 5.5). The stall's collision block is never touched.
//   c = { place(u0, y0, u1, y1, depthA, depthB, material, opts), d(offset), mat(color, opts), from, to, mid, depth,
//         counterHeight, sign: { width, y, height } (the name sign's rectangle on the facade), colors }
// =============================================================================

const FLAT = { collide: false };

/**
 * BURGER BARN: a red barn. Board-and-batten siding, white trim round the name sign, the hay-loft shoulders of a gambrel roof
 * either side of the Paper Hat burger (maps/mall/wardrobeShowpieces/foodCourt.js stands on a platform x -6.85..-4.65, so the
 * roof steps stop short of it), a checkerboard diner band on the counter, squeeze bottles, a heat lamp and a weathervane.
 */
function barn(c) {
  const { place, d, mat, from, to, mid, depth, counterHeight: ch, sign } = c;
  const red = mat(c.colors.main), dark = mat(c.colors.accent), white = mat(0xfff3e0), wood = mat(0x5b3421);

  // Siding: vertical battens up the facade, skipping the name sign's rectangle (the sign is 2 cm proud of the facade).
  const sx0 = mid - sign.width / 2 - 0.2, sx1 = mid + sign.width / 2 + 0.2;
  const sy0 = sign.y - sign.height / 2 - 0.2, sy1 = sign.y + sign.height / 2 + 0.2;
  for (let u = from + 0.1; u < to - 0.2; u += 0.42) {
    const inSign = u + 0.07 > sx0 && u < sx1;
    if (!inSign) place(u, 3.05, u + 0.07, 4.7, d(0.1), d(0.13), dark, FLAT);
    else {
      place(u, 3.05, u + 0.07, sy0, d(0.1), d(0.13), dark, FLAT);
      place(u, sy1, u + 0.07, 4.7, d(0.1), d(0.13), dark, FLAT);
    }
  }
  // White trim: a frame round the sign, and a fascia board along the top of the facade.
  const t = 0.07, z0 = d(0.1), z1 = d(0.16);
  place(sx0, sy0, sx1, sy0 + t, z0, z1, white, FLAT);
  place(sx0, sy1 - t, sx1, sy1, z0, z1, white, FLAT);
  place(sx0, sy0, sx0 + t, sy1, z0, z1, white, FLAT);
  place(sx1 - t, sy0, sx1, sy1, z0, z1, white, FLAT);
  place(from, 4.62, to, 4.7, d(0.1), d(0.2), white, FLAT);

  // Gambrel shoulders: two stepped hay-loft blocks, one each side of the burger platform.
  const wings = [[from, Math.max(from + 0.3, -6.95)], [Math.min(to - 0.3, -4.55), to]];
  for (const [w0, w1] of wings) {
    place(w0, 4.7, w1, 5.0, d(0), d(0.55), red, FLAT);
    place(w0 + 0.18, 5.0, w1 - 0.18, 5.25, d(0), d(0.35), red, FLAT);
    place(w0 + 0.12, 4.98, w1 - 0.12, 5.02, d(0.01), d(0.57), white, FLAT); // white eave line
    // a hay-loft door with a white X
    const lx = (w0 + w1) / 2;
    place(lx - 0.28, 4.74, lx + 0.28, 4.98, d(0.55), d(0.57), wood, FLAT);
    place(lx - 0.28, 4.74, lx + 0.28, 4.78, d(0.57), d(0.59), white, FLAT);
    place(lx - 0.28, 4.94, lx + 0.28, 4.98, d(0.57), d(0.59), white, FLAT);
  }
  // Weathervane on the right shoulder: a pole, a crossbar, and an arrow.
  const vx = wings[1][1] - 0.5;
  place(vx - 0.015, 5.25, vx + 0.015, 5.5, d(0.17), d(0.2), dark, FLAT);
  place(vx - 0.2, 5.38, vx + 0.2, 5.4, d(0.17), d(0.2), dark, FLAT);
  place(vx + 0.2, 5.36, vx + 0.3, 5.42, d(0.17), d(0.2), mat(0xffd23f), FLAT);

  // Checkerboard band on the counter front (two rows of 0.2 m tiles on a white strip).
  const bandZ = [d(depth), d(depth + 0.02)];
  place(from + 0.12, 0.84, to - 0.12, 1.08, ...bandZ, white, FLAT);
  const black = mat(0x16141a);
  for (let row = 0; row < 2; row++) {
    for (let u = from + 0.12 + (row ? 0.2 : 0), i = 0; u + 0.2 <= to - 0.12 + 1e-6; u += 0.4, i++) {
      place(u, 0.84 + row * 0.12, u + 0.2, 0.96 + row * 0.12, d(depth), d(depth + 0.03), black, FLAT);
    }
  }

  // Squeeze bottles (ketchup and mustard) and a heat lamp over the pass.
  for (const [u, color] of [[from + 0.62, 0xd62839], [from + 0.76, 0xffc62e]]) {
    place(u, ch, u + 0.09, ch + 0.2, d(depth - 0.5), d(depth - 0.41), mat(color), FLAT);
    place(u + 0.025, ch + 0.2, u + 0.065, ch + 0.26, d(depth - 0.47), d(depth - 0.44), white, FLAT);
  }
  const lamp = mat(0xff7a1a, { emissive: 0xff7a1a, emissiveIntensity: 0.9 });
  place(from + 0.5, 2.06, to - 0.5, 2.12, d(0.25), d(0.6), lamp, FLAT);
  for (const u of [from + 0.5, to - 0.56]) place(u, 2.12, u + 0.06, 2.15, d(0.25), d(0.6), mat(0x8a8f99), FLAT);
}

export const stallThemes = { barn };
