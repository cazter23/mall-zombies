// Fixed, map-owned upper-floor dressing. No collision, lights, purchases or timers.
// Low props sit on existing furniture; wall details stay within its capsule margin.
import * as THREE from 'three';
import { drawType } from '../../world/typeKit.js';

export function buildPromenadeDetails({ kit, looks, layout, floorY }) {
  const d = layout.details, c = d.colors, r = layout.rect;
  const y = h => floorY + h;
  const made = [];
  function tag(mesh) { mesh.userData.promenadeDetail = true; made.push(mesh); return mesh; }
  function box(name, x, h, z, w, height, depth, color, options = {}) {
    return tag(kit.box(x - w / 2, y(h), z - depth / 2, x + w / 2, y(h + height), z + depth / 2,
      kit.mat(color, options), { name: `promenade_detail_${name}`, collide: false }));
  }
  function sign(name, text, x, h, z, width, height, facing = -1, background = '#56415d', color = '#f2e6ce', font = 'wayfinding') {
    const mesh = kit.sign(text, { x, y: y(h), z, width, height, facing, background, color, font });
    mesh.name = `promenade_detail_${name}`; return tag(mesh);
  }
  function disc(name, radius, thickness, x, h, z, color, upright = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 12),
      kit.mat(color, { roughness: .4, metalness: .45 }));
    mesh.position.set(x, y(h), z); if (upright) mesh.rotation.x = Math.PI / 2;
    mesh.name = `promenade_detail_${name}`; kit.group.add(mesh); return tag(mesh);
  }

  // Low sunset medallion: a landmark without the old tree blocking the junction.
  const seating = layout.seating, px = seating.planterX, pz = seating.planterZ;
  disc('sun_medallion', .32, .025, px, seating.landmark.height + .015, pz, c.brass);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const ray = box('sun_ray', px + Math.sin(angle) * .4, seating.landmark.height + .005,
      pz + Math.cos(angle) * .29, .035, .018, .09, c.brass);
    ray.rotation.y = angle;
  }
  sign('landmark_plaque', 'SUNSET · FOREVER', px, .35, pz - seating.landmark.halfDepth - .018, .8, .16, -1, '#56415d', '#f2e6ce', 'hoffmanBrand');
  // Upholstered perimeter seats, brass trim and a single forgotten shopping bag.
  for (const [x0, z0, x1, z1] of seating.loungeBenches) {
    box('seat_cushion', (x0 + x1) / 2, .455, (z0 + z1) / 2, x1 - x0 - .08, .035, z1 - z0 - .08, c.plum);
    box('seat_inlay', (x0 + x1) / 2, .30, z0 + .018, x1 - x0 - .12, .025, .025, c.brass);
  }
  box('bag', 14.15, .49, -4.17, .25, .27, .19, c.teal);
  box('bag_handle_l', 14.07, .76, -4.17, .025, .10, .025, c.cream);
  box('bag_handle_r', 14.23, .76, -4.17, .025, .10, .025, c.cream);
  box('bag_handle_top', 14.15, .85, -4.17, .18, .025, .025, c.cream);

  // Directory artwork uses the actual footprint and connection positions.
  const directory = document.createElement('canvas'); directory.width = 512; directory.height = 640;
  const ctx = directory.getContext('2d');
  ctx.fillStyle = '#e6d7bd'; ctx.fillRect(0, 0, 512, 640);
  ctx.fillStyle = '#56415d'; ctx.fillRect(0, 0, 512, 95);
  drawType(ctx, 'Sunset Promenade', 256, 42, { role: 'hoffmanSerif', size: 36, maxWidth: 470, fill: '#f2e6ce', baseline: 'alphabetic' });
  drawType(ctx, 'Level Two · Directory', 256, 74, { role: 'hoffmanSub', size: 21, maxWidth: 470, fill: '#f2e6ce', baseline: 'alphabetic' });
  const mx = x => 32 + (x - r.minX) / (r.maxX - r.minX) * 448;
  const mz = z => 340 - (z - r.minZ) / (r.maxZ - r.minZ) * 170;
  ctx.fillStyle = '#c4adbe'; ctx.fillRect(32, 170, 448, 170);
  for (const v of layout.voids) { ctx.fillStyle = '#f2e6ce'; ctx.fillRect(mx(v.minX), mz(v.maxZ), mx(v.maxX) - mx(v.minX), mz(v.minZ) - mz(v.maxZ)); }
  ctx.fillStyle = '#638e90'; ctx.fillRect(mx(layout.shoeStore.from), 140, mx(layout.shoeStore.to) - mx(layout.shoeStore.from), 30);
  ctx.fillStyle = '#a87973'; ctx.fillRect(mx(-3), 140, mx(3) - mx(-3), 30);
  ctx.fillStyle = '#bba16f'; ctx.fillRect(mx(4), 140, mx(10) - mx(4), 30);
  drawType(ctx, 'Shops ↑                       Atrium ↑', 256, 123, { role: 'wayfinding', size: 22, maxWidth: 440, fill: '#56415d', baseline: 'alphabetic' });
  ctx.fillStyle = '#b3545c'; ctx.beginPath(); ctx.arc(mx(d.directory.x), mz(r.minZ + .2), 8, 0, Math.PI * 2); ctx.fill();
  drawType(ctx, 'You are here', mx(d.directory.x), 380, { role: 'wayfinding', size: 22, fill: '#b3545c', baseline: 'alphabetic' });
  for (const [i, text] of ['01  Shoe-per Sale', '02  Build-a-Blaster · Workshop', '03  Pretzel Palace', '04  Grand Atrium  →', '05  ← Sunset Cinema'].entries()) {
    drawType(ctx, text, 30, 435 + i * 36, { role: 'officialBody', size: 24, maxWidth: 450, fill: '#56415d', align: 'left', baseline: 'alphabetic' });
  }
  drawType(ctx, 'East Wing · Future Expansion', 30, 622, { role: 'officialBody', size: 18, maxWidth: 450, fill: '#56415d', align: 'left', baseline: 'alphabetic' });
  const texture = new THREE.CanvasTexture(directory); texture.colorSpace = THREE.SRGBColorSpace;
  const dx = d.directory.x, dz = r.minZ + .11, dh = d.directory.height;
  box('directory_frame', dx, dh - .9, dz - .05, d.directory.width + .12, 1.92, .10, c.brass);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(d.directory.width, 1.8), new THREE.MeshBasicMaterial({ map: texture }));
  panel.position.set(dx, y(dh), dz + .015); panel.name = 'promenade_detail_directory'; kit.group.add(panel); tag(panel);

  // Two wall phones, shallow enough to keep the east-side walking/spawn lane clear.
  for (const [i, z] of d.phones.z.entries()) {
    const x = r.maxX - .08, h = d.phones.y;
    box('phone_case', x, h - .38, z, .14, .82, .36, c.plum);
    box('phone_face', x - .08, h - .25, z, .018, .48, .27, c.brass);
    box('receiver', x - .10, h - .18, z - .08, .035, .33, .065, c.dark);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) box('phone_key', x - .105, h - .12 + row * .05,
      z + col * .045 - .02, .018, .028, .028, c.cream);
    for (let j = 0; j < 7; j++) box('phone_cord', x - .105, h - .30 - j * .023, z - .075 + (j % 2) * .014, .02, .025, .02, c.dark);
    sign('phone_label', i ? 'No answer' : 'Local calls', x - .12, h + .33, z, .31, .13, 'x-');
  }
  // Magazine rack is a shallow wall display, not a new obstacle on the floor.
  const rackX = d.magazineRack.x, rackZ = r.minZ + .12;
  box('magazine_back', rackX, .65, rackZ - .04, d.magazineRack.width, .95, .06, c.plum);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 3; i++) {
      const x = rackX + (i - 1) * .29;
      box('magazine', x, .76 + row * .38, rackZ + .015, .24, .32, .025, [c.teal, c.peach, c.cream][(row + i) % 3]);
      sign('magazine_title', ['SOLE', 'MALL LIFE', 'AFTER HOURS'][i], x, .98 + row * .38, rackZ + .037, .22, .07, 1, '#56415d', '#f2e6ce', ['chrome', 'hoffmanSerif', 'marquee'][i]);
    }
    box('magazine_lip', rackX, .74 + row * .38, rackZ + .045, d.magazineRack.width + .03, .035, .04, c.brass);
  }

  // Backlit eastern ceiling feature. It is inset below the existing roof and
  // clear of its cross-beams, rather than adding another roof/floor opening.
  const sky = d.skylight, sx = (sky.minX + sky.maxX) / 2, sz = (sky.minZ + sky.maxZ) / 2;
  box('skylight_frame', sx, layout.height - .13, sz, sky.maxX - sky.minX + .12, .035, sky.maxZ - sky.minZ + .12, c.brass);
  for (let i = 0; i < 3; i++) box('skylight_diffuser', sx, layout.height - .17, sky.minZ + .5 + i,
    sky.maxX - sky.minX - .08, .025, .94, [0xe9b183, 0xe4c29c, 0xd4adc8][i],
    { emissive: [0xe9b183, 0xe4c29c, 0xd4adc8][i], emissiveIntensity: .45, roughness: .8 });

  // Hanging signs are readable from both sides and above jumping/vault headroom.
  for (const s of d.hangingSigns) {
    box('hanging_back', s.x, 3.05, s.z, s.width + .08, .36, .04, c.brass);
    for (const facing of [-1, 1]) sign('hanging_sign', facing === 1 ? s.text.replace('→', '←') : s.text,
      s.x, 3.23, s.z + facing * .032, s.width, .30, facing, '#56415d', s.color);
    for (const side of [-1, 1]) box('sign_drop', s.x + side * (s.width / 2 - .16), 3.41, s.z, .018, layout.height - 3.41, .018, c.brass);
  }

  const front = r.maxZ;
  const workshop = layout.workshop;
  const center = (workshop.from + workshop.to) / 2;
  box('workshop_header', center, 2.79, front - .09, workshop.to - workshop.from, .58, .16, workshop.colors.plum);
  looks.neon('promenade_workshop').text('BUILD-A-BLASTER', { style: 'italic', x: center, y: y(3.08), z: front - .19,
    facing: -1, height: .34, color: workshop.colors.lamp });
  looks.pool(center, y(.018), front - .62, 5.8, 2.2, 'floor', '#ffc588', .26);

  // Pretzel counter: shallow scenic cabinet against the still-solid shop wall.
  const pretzel = layout.shops.find(s => s.id === 'pretzel'), pc = (pretzel.from + pretzel.to) / 2;
  box('pretzel_facade', pc, 0, front - .07, pretzel.to - pretzel.from, 3, .14, 0x946c57);
  box('pretzel_counter', pc, .1, front - .16, 5.3, .9, .12, c.plum);
  box('pretzel_counter_trim', pc, .98, front - .18, 5.45, .045, .14, c.brass);
  box('warmer_back', pc, 1.12, front - .145, 1.92, .65, .02, c.dark);
  for (const offset of [-1, 1]) box('warmer_post', pc + offset, 1.1, front - .17, .04, .72, .13, c.brass);
  for (const h of [1.13, 1.49, 1.79]) box('warmer_shelf', pc, h, front - .17, 2, .025, .13, c.brass);
  for (let i = 0; i < 4; i++) for (const [dx, dh] of [[-.045, 0], [.045, 0], [0, .065]]) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(.055, .016, 4, 10), kit.mat(d.pretzel.colors[i % 3]));
    mesh.position.set(pc - .7 + i * .46 + dx, y(1.23 + dh), front - .195);
    mesh.name = 'promenade_detail_pretzel'; kit.group.add(mesh); tag(mesh);
  }
  box('warmer_glass', pc, 1.16, front - .225, 1.94, .59, .012, c.glass, { transparent: true, opacity: .15, roughness: .3, depthWrite: false });
  sign('pretzel_header', 'PRETZEL PALACE', pc, 2.72, front - .16, 5.2, .5, -1, '#5c2e12', '#ffd9a8', 'marquee');
  sign('pretzel_menu', d.pretzel.menu, pc, 2.25, front - .17, 4.9, .25);
  sign('pretzel_notice', d.pretzel.notice, pc + 1.9, 1.55, front - .23, 1.2, .38);
  // Slatted grille closes the upper serving hatch but leaves the warmer readable.
  for (let i = 0; i < 6; i++) box('pretzel_grille', pc, 1.86 + i * .055, front - .19, 5.2, .018, .025, c.brass);

  // Shoe-store sale tickets and an abandoned fitting pair, within existing fixtures.
  const s = layout.shoeStore, back = r.maxZ + s.depth;
  for (const [i, text] of d.shoe.tickets.entries()) sign('shoe_ticket', text, s.from + 1 + i * 2, 1.0, back - .59, 1.2, .15);
  for (let i = 0; i < 2; i++) {
    box('fitting_shoe_sole', s.to - .28, .452, front + 2.55 + i * .32, .16, .025, .25, c.cream);
    box('fitting_shoe', s.to - .28, .48, front + 2.55 + i * .32, .14, .09, .21, d.shoe.boxColors[i]);
  }
  return made;
}
