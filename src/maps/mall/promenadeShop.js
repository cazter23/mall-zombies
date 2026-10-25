// Small two-entrance shoe-store loop. Walls/floor sections are authored by the
// Promenade shell; this builder owns its interior, roof and fixed merchandise.
export function buildPromenadeShop({ kit, floorY, rect, layout }) {
  const { box, mat, sign } = kit;
  const s = layout.shoeStore, T = layout.wallThickness, y = h => floorY + h;
  const front = rect.maxZ, back = front + s.depth;
  const c = s.colors, mid = (s.from + s.to) / 2;
  const decor = { collide: false };
  box(s.from - T, floorY, front + T, s.from, y(layout.height), back + T, mat(c.wall), { name: 'shoe_store_west' });
  box(s.to, floorY, front + T, s.to + T, y(layout.height), back + T, mat(c.wall), { name: 'shoe_store_east' });
  box(s.from, floorY, back, s.to, y(layout.height), back + T, mat(c.wall), { name: 'shoe_store_back' });
  box(s.from - T, y(layout.height), front + T, s.to + T, y(layout.height) + T, back + T,
    mat(c.ceiling), { name: 'shoe_store_roof' });
  for (const facing of [-1, 1]) sign('SHOE-PER SALE', { x: mid, y: y(2.95), z: front + (facing === -1 ? -.035 : T + .035),
    width: s.to - s.from - .3, height: .48, facing, background: '#35263e', color: '#e0c6f4' });

  function shoe(x, h, z, color, reversed = false) {
    const d = reversed ? -1 : 1;
    box(x - .07, y(h), z - .15, x + .07, y(h + .035), z + .15, mat(c.sole), decor);
    box(x - .065, y(h + .035), z - .13, x + .065, y(h + .12), z + .12, mat(color), decor);
    box(x - .05, y(h + .12), z - .035 + d * .045, x + .05, y(h + .17), z + .035 + d * .045, mat(color), decor);
    box(x - .04, y(h + .12), z - .025 - d * .04, x + .04, y(h + .125), z + .025 - d * .04, mat(c.sole), decor);
  }
  // Back-wall shelving has one matching floor-standing solid footprint. All stock
  // stays over the shelf, leaving both door approaches and the side aisles open.
  kit.addCollider(s.from + .15, floorY, back - .57, s.to - .15, y(2.25), back);
  box(s.from + .15, floorY, back - .06, s.to - .15, y(2.25), back, mat(c.cabinet), { ...decor, name: 'shoe_shelf_back' });
  for (const x of [s.from + .15, s.to - .23]) box(x, floorY, back - .57, x + .08, y(2.25), back - .06, mat(c.cabinet), decor);
  box(s.from + .15, floorY, back - .57, s.to - .15, y(.2), back - .06, mat(c.cabinet), decor);
  for (const h of s.shelfHeights) {
    box(s.from + .18, y(h - .045), back - .57, s.to - .18, y(h), back - .06, mat(c.trim), decor);
    for (let i = 0; i < s.pairs; i++) {
      const x = s.from + .55 + i * (s.to - s.from - 1.1) / (s.pairs - 1);
      const color = c.shoes[(i + Math.round(h * 10)) % c.shoes.length];
      shoe(x - .085, h, back - .32, color); shoe(x + .085, h, back - .32, color);
    }
  }
  // Central display is a single vaultable volume. Merchandise is deliberately
  // confined to its end caps, leaving a clean middle crossing above the collider.
  const island = { minX: mid - s.island.width / 2, maxX: mid + s.island.width / 2,
    minZ: front + s.island.offsetZ, maxZ: front + s.island.offsetZ + s.island.depth };
  box(island.minX, floorY, island.minZ, island.maxX, y(s.island.height), island.maxZ,
    mat(c.display), { name: 'shoe_display', vaultable: true });
  for (const [i, x] of [island.minX + .15, island.maxX - .15].entries()) {
    shoe(x, s.island.height + .01, (island.minZ + island.maxZ) / 2, c.shoes[i], !!i);
  }
  // Framed silvered fitting mirror: opaque, inexpensive, and never promises a
  // live reflected scene. A bench sits against the opposite side wall.
  const mirrorZ = front + 2.65;
  box(s.from, y(.4), mirrorZ - .5, s.from + .08, y(2.3), mirrorZ + .5, mat(c.trim), decor);
  box(s.from + .08, y(.46), mirrorZ - .44, s.from + .095, y(2.24), mirrorZ + .44,
    mat(c.mirror, { roughness: .23, metalness: .65 }), decor);
  box(s.to - .48, floorY, front + 2.2, s.to - .08, y(.45), front + 3.5,
    mat(c.bench), { name: 'shoe_fitting_bench', vaultable: true });
  for (let i = 0; i < 3; i++) {
    const x = mid - .55 + i * .45;
    box(x, y(.04), back - .82, x + .35, y(.22), back - .54, mat(c.boxes[i % c.boxes.length]), decor);
    box(x - .008, y(.22), back - .83, x + .358, y(.255), back - .53, mat(c.sole), decor);
  }
  sign('EVERY PAIR HAS A SOLE MATE', { x: mid, y: y(2.65), z: back - .03, width: 4.7, height: .3,
    facing: -1, background: '#725c82', color: '#fff0d8' });
  const glow = mat(c.lamp, { emissive: c.lamp, emissiveIntensity: .75 });
  box(s.from + .8, y(layout.height - .08), front + 1.2, s.to - .8, y(layout.height - .025), front + 1.55, glow, decor);
}
