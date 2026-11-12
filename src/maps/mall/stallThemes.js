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

/**
 * WOK THIS WAY: a night-market noodle shop. A low two-tier pagoda eave with upturned tips (kept under FRESH MEAT DAILY's neon,
 * y 4.9+), gold trim round the sign, a lattice band under it, three paper lanterns hanging from the awning, flames under
 * the woks, a stack of bamboo steamers and a jar of fortune cookies on the counter.
 */
function wok(c) {
  const { place, d, mat, from, to, mid, depth, counterHeight: ch, sign } = c;
  const lacquer = mat(0xa3141f), dark = mat(c.colors.accent), gold = mat(0xffd23f), bamboo = mat(0xc89b5a);

  // Two-tier eave: a wide lower tier with raised tips, a narrower upper one, a gold drip edge on the lower.
  place(from - 0.2, 4.62, to + 0.2, 4.74, d(0), d(0.5), lacquer, FLAT);
  place(from - 0.2, 4.74, from + 0.15, 4.86, d(0), d(0.5), lacquer, FLAT);
  place(to - 0.15, 4.74, to + 0.2, 4.86, d(0), d(0.5), lacquer, FLAT);
  place(from + 0.5, 4.74, to - 0.5, 4.86, d(0), d(0.36), dark, FLAT);
  place(from - 0.2, 4.6, to + 0.2, 4.62, d(0.02), d(0.52), gold, FLAT);

  // Gold frame round the name sign, and a gold-on-red lattice band between it and the awning.
  const sx0 = mid - sign.width / 2 - 0.2, sx1 = mid + sign.width / 2 + 0.2;
  const sy0 = sign.y - sign.height / 2 - 0.2, sy1 = sign.y + sign.height / 2 + 0.2;
  const t = 0.05, z0 = d(0.1), z1 = d(0.16);
  place(sx0, sy0, sx1, sy0 + t, z0, z1, gold, FLAT);
  place(sx0, sy1 - t, sx1, sy1, z0, z1, gold, FLAT);
  place(sx0, sy0, sx0 + t, sy1, z0, z1, gold, FLAT);
  place(sx1 - t, sy0, sx1, sy1, z0, z1, gold, FLAT);
  place(from, 3.07, to, 3.27, d(0.1), d(0.12), lacquer, FLAT);
  for (let u = from + 0.1; u < to - 0.1; u += 0.2) place(u, 3.07, u + 0.03, 3.27, d(0.12), d(0.14), gold, FLAT);
  place(from, 3.15, to, 3.18, d(0.12), d(0.14), gold, FLAT);

  // Paper lanterns under the awning's front edge (above head height).
  const lantern = mat(0xe0192d, { emissive: 0xff2a3b, emissiveIntensity: 0.55 });
  for (const u of [from + 0.55, mid, to - 0.55]) {
    place(u - 0.2, 2.5, u + 0.2, 2.82, d(depth + 0.1), d(depth + 0.34), lantern, FLAT);
    place(u - 0.12, 2.82, u + 0.12, 2.86, d(depth + 0.14), d(depth + 0.3), gold, FLAT);
    place(u - 0.12, 2.46, u + 0.12, 2.5, d(depth + 0.14), d(depth + 0.3), gold, FLAT);
    place(u - 0.01, 2.86, u + 0.01, 2.95, d(depth + 0.21), d(depth + 0.23), gold, FLAT);
  }

  // Flames under the two woks (the wok gear is laid out in foodStall: slot = (width - 0.4) / 3).
  const slot = (to - from - 0.4) / 3;
  const flame = mat(0xff8a1a, { emissive: 0xff8a1a, emissiveIntensity: 1.1 });
  for (let i = 0; i < 2; i++) {
    const u0 = from + 0.3 + i * slot, u1 = u0 + slot - 0.2;
    place((u0 + u1) / 2 - 0.1, 0.92, (u0 + u1) / 2 + 0.1, 1.12, d(0.33), d(0.45), flame, FLAT);
  }

  // Counter: a stack of bamboo steamers (three layers and a lid) and a fortune-cookie jar, both behind the sneeze guard.
  const sxu = to - 1.9;
  for (let k = 0; k < 3; k++) place(sxu, ch + k * 0.1, sxu + 0.4, ch + k * 0.1 + 0.09, d(depth - 0.62), d(depth - 0.38), k % 2 ? mat(0xb98a4c) : bamboo, FLAT);
  place(sxu + 0.05, ch + 0.3, sxu + 0.35, ch + 0.36, d(depth - 0.58), d(depth - 0.42), bamboo, FLAT);
  const jar = from + 0.6;
  place(jar, ch, jar + 0.2, ch + 0.24, d(depth - 0.6), d(depth - 0.4), mat(0xeadfc8), FLAT);
  for (const [dx, dy] of [[0.03, 0.03], [0.11, 0.06], [0.06, 0.14], [0.13, 0.17]]) {
    place(jar + dx, ch + dy, jar + dx + 0.05, ch + dy + 0.04, d(depth - 0.62), d(depth - 0.6), mat(0xffc24d), FLAT);
  }
  place(jar - 0.01, ch + 0.24, jar + 0.21, ch + 0.28, d(depth - 0.61), d(depth - 0.39), gold, FLAT);
}

/**
 * CORN DOG CORRAL: a rodeo fairground stand. A giant corn dog on a stick lying on the roof, a wooden frame round the sign with
 * mustard drips below it, bunting along the awning, cow-print counter panels (the Fryer Valve stands on the counter's centre,
 * x 5.75: that stays clear), a lemonade dispenser and mustard / ketchup pumps.
 */
function cornDog(c) {
  const { place, d, mat, from, to, mid, depth, counterHeight: ch, sign } = c;
  const wood = mat(0x7a4a24), batter = mat(0xe0a030), mustard = mat(0xffd23f), white = mat(0xf6f1e6), ink = mat(0x18151a);

  // Giant corn dog: a platform, the batter body, the stick, and a zigzag of mustard (clear of FRESH MEAT DAILY's neon, x < ~4.5).
  place(mid - 0.95, 4.7, mid + 0.95, 4.78, d(0.08), d(0.5), mat(0xb83239), FLAT);
  place(mid - 0.75, 4.78, mid + 0.55, 5.14, d(0.12), d(0.46), batter, FLAT);
  place(mid - 0.65, 5.14, mid + 0.45, 5.2, d(0.16), d(0.42), mat(0xc98a2e), FLAT);
  place(mid + 0.55, 4.88, mid + 0.95, 4.98, d(0.24), d(0.34), wood, FLAT);
  for (let k = 0; k < 5; k++) place(mid - 0.6 + k * 0.24, 5.2 + (k % 2) * 0.03, mid - 0.45 + k * 0.24, 5.24 + (k % 2) * 0.03, d(0.18), d(0.4), mustard, FLAT);

  // Wooden frame round the name sign, with a rope row (tan studs) under it and mustard drips below that.
  const sx0 = mid - sign.width / 2 - 0.2, sx1 = mid + sign.width / 2 + 0.2;
  const sy0 = sign.y - sign.height / 2 - 0.2, sy1 = sign.y + sign.height / 2 + 0.2;
  const t = 0.08, z0 = d(0.1), z1 = d(0.17);
  place(sx0, sy0, sx1, sy0 + t, z0, z1, wood, FLAT);
  place(sx0, sy1 - t, sx1, sy1, z0, z1, wood, FLAT);
  place(sx0, sy0, sx0 + t, sy1, z0, z1, wood, FLAT);
  place(sx1 - t, sy0, sx1, sy1, z0, z1, wood, FLAT);
  for (let u = sx0 + 0.1; u < sx1 - 0.1; u += 0.14) place(u, sy1 - 0.17, u + 0.07, sy1 - t, d(0.17), d(0.19), mat(0xd8b98a), FLAT);
  for (let u = from + 0.15, k = 0; u < to - 0.2; u += 0.28, k++) place(u, sy0 - (k % 3 ? 0.08 : 0.2), u + 0.12, sy0, d(0.1), d(0.13), mustard, FLAT);

  // Bunting: small flags along the awning's front edge.
  const flags = [mat(0xd62839), mat(0xffd23f), mat(0xf6f1e6)];
  for (let u = from + 0.1, k = 0; u < to - 0.2; u += 0.26, k++) place(u, 2.8, u + 0.18, 2.94, d(depth + 0.3), d(depth + 0.32), flags[k % 3], FLAT);

  // Cow-print panels on the counter front, each side of the valve (x 5.3..6.2), blotches seeded by position.
  let seed = Math.floor(Math.abs(from * 13 + to));
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const [a, b] of [[from + 0.15, mid - 0.5], [mid + 0.5, to - 0.15]]) {
    place(a, 0.15, b, 1.02, d(depth), d(depth + 0.02), white, FLAT);
    for (let k = 0; k < 7; k++) {
      const bx = a + 0.05 + rand() * (b - a - 0.4), by = 0.2 + rand() * 0.65;
      place(bx, by, bx + 0.14 + rand() * 0.14, by + 0.1 + rand() * 0.1, d(depth + 0.02), d(depth + 0.03), ink, FLAT);
    }
  }

  // Counter: mustard and ketchup pumps, and a lemonade dispenser (yellow, with a tap and a lemon on top).
  for (const [u, color] of [[from + 0.62, 0xffd23f], [from + 0.78, 0xd62839]]) {
    place(u, ch, u + 0.1, ch + 0.16, d(depth - 0.55), d(depth - 0.45), mat(color), FLAT);
    place(u + 0.04, ch + 0.16, u + 0.06, ch + 0.28, d(depth - 0.52), d(depth - 0.48), white, FLAT);
    place(u + 0.02, ch + 0.28, u + 0.14, ch + 0.31, d(depth - 0.53), d(depth - 0.43), white, FLAT);
  }
  const lem = to - 1.9;
  place(lem, ch, lem + 0.3, ch + 0.42, d(depth - 0.64), d(depth - 0.4), mat(0xfff08a, { transparent: true, opacity: 0.8, depthWrite: false }), FLAT);
  place(lem - 0.02, ch + 0.42, lem + 0.32, ch + 0.46, d(depth - 0.66), d(depth - 0.38), white, FLAT);
  place(lem + 0.12, ch + 0.06, lem + 0.18, ch + 0.12, d(depth - 0.4), d(depth - 0.34), mat(0x8a8f99), FLAT);
  place(lem + 0.1, ch + 0.46, lem + 0.2, ch + 0.56, d(depth - 0.58), d(depth - 0.48), mustard, FLAT);
}

export const stallThemes = { barn, wok, cornDog };
