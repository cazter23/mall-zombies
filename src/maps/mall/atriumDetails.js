// Authored decoration only: no colliders, navigation links, lights or interactions.
// Shop interiors extend behind the arcade walls; other shapes stay inside existing fixture silhouettes.
import * as THREE from 'three';
import { atriumDetails as cfg } from '../../config/atrium.js';
import { atmosphere } from '../../config/environment.js';
import { seededRandom } from '../../world/textures.js';
import { drawType } from '../../world/typeKit.js';
import { buildAtriumStorefronts } from './atriumStorefronts.js';

export function buildAtriumDetails(kit, layout, upperY) {
  const root = new THREE.Group(); root.name = 'atrium_details'; kit.group.add(root);
  const A = layout.rect, P = cfg.palette;
  const cx = (A.minX + A.maxX) / 2, cz = (A.minZ + A.maxZ) / 2;
  const fx = layout.fountain.x ?? cx, fz = layout.fountain.z ?? cz, fr = layout.fountain.half;
  const material = (color, options) => kit.mat(color, options);
  const cream = material(P.cream), plum = material(P.plum), mint = material(P.mint), coral = material(P.coral);
  const gold = material(P.gold, { metalness: .45, roughness: .4 }), dark = material(P.ink);
  const chrome = material(P.chrome, { metalness: .65, roughness: .3 }), paper = material(P.paper);
  function mesh(name, geometry, mat, at, parent = root, rotation = [0, 0, 0]) {
    const m = new THREE.Mesh(geometry, mat); m.name = name; m.position.set(...at); m.rotation.set(...rotation); parent.add(m); return m;
  }
  const box = (name, size, at, mat, parent, rotation) => mesh(name, new THREE.BoxGeometry(...size), mat, at, parent, rotation);
  const cyl = (name, radius, height, at, mat, parent, rotation, top = radius) =>
    mesh(name, new THREE.CylinderGeometry(top, radius, height, 10), mat, at, parent, rotation);
  function label(name, text, at, w, h, bg, color = '#f9ebd1', parent = root) {
    // The ordinary sign renderer fits one line. Boards and hanging fabric need real multiline layouts.
    let m;
    if (text.includes('\n')) {
      const canvas = document.createElement('canvas');
      canvas.width = h / w > 2 ? 256 : 512; canvas.height = Math.round(canvas.width * h / w);
      const c = canvas.getContext('2d'), tall = h / w > 2;
      c.fillStyle = bg; c.fillRect(0, 0, canvas.width, canvas.height);
      c.strokeStyle = color; c.lineWidth = tall ? 5 : 2; c.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
      // typewritten memos, the engraved directory title, the mall's own voice on banners, wayfinding for the rest
      const role = name === 'employee_schedule' ? 'typewriter' : name === 'directory_title' ? 'hoffmanBrand' : tall ? 'mallBrand' : 'wayfinding';
      const parts = text.split('\n');
      const lines = tall ? [...parts[0].split(' '), '', ...parts.slice(1).flatMap(s => s.split(' '))] : parts;
      lines.forEach((line, i) => {
        let size = tall ? (i < parts[0].split(' ').length ? 38 : 25) : Math.min(32, canvas.height / (lines.length + 1) * .65);
        drawType(c, line, canvas.width / 2, (i + 1) * canvas.height / (lines.length + 1), { role, size, maxWidth: canvas.width - 36, min: 10, fill: color });
      });
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
      m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
    } else m = kit.sign(text, { x: 0, y: 0, z: 0, width: w, height: h, facing: 1, background: bg, color });
    m.name = name; m.position.set(...at); parent.add(m); return m;
  }
  function wallGroup(spec) {
    const g = new THREE.Group(); g.name = spec.name ? `display_${spec.name}` : 'wall_detail';
    const alongZ = spec.wall === 'west' || spec.wall === 'east';
    g.position.set(alongZ ? (spec.wall === 'west' ? A.minX : A.maxX) : A.minX + spec.at,
      spec.upper ? upperY : 0, alongZ ? A.minZ + spec.at : A.maxZ);
    g.rotation.y = { west: Math.PI / 2, east: -Math.PI / 2, north: Math.PI }[spec.wall]; root.add(g); return g;
  }
  buildAtriumStorefronts(kit, layout, upperY, root);

  // Kiosk stock is on the original counter, inside its existing solid footprint.
  function register(g, x) {
    box('kiosk_register', [.29, .18, .24], [x, 1.22, .25], cream, g);
    box('kiosk_screen', [.19, .09, .02], [x, 1.25, .383], dark, g);
    for (let i = 0; i < 4; i++) box('kiosk_key', [.028, .014, .03], [x - .07 + i * .045, 1.32, .25], chrome, g);
  }
  for (const [index, k] of layout.kiosks.entries()) {
    const g = new THREE.Group(); g.name = index === 0 ? 'cell_out_stock' : 'shade_shack_stock'; g.position.set(k.x, 0, k.z); root.add(g);
    register(g, .59);
    if (index === 0) {
      for (let i = 0; i < 5; i++) {
        const x = -.64 + i * .25;
        box('phone_cradle', [.14, .045, .12], [x, 1.1425, -.27], chrome, g);
        box('chunky_display_phone', [.12, .31, .09], [x, 1.32, -.27], [dark, cream, coral][i % 3], g);
        box('phone_display', [.07, .07, .014], [x, 1.37, -.328], mint, g);
        for (let row = 0; row < 3; row++) for (const dx of [-.025, .025]) box('phone_keypad', [.025, .018, .012], [x + dx, 1.215 + row * .032, -.328], chrome, g);
        box('phone_antenna', [.015, .15, .015], [x - .035, 1.54, -.27], dark, g);
        box('phone_packaging', [.18, .11, .17], [x, 1.18, .16], i % 2 ? cream : mint, g);
      }
      for (let i = 0; i < 4; i++) {
        mesh('hanging_cable', new THREE.TorusGeometry(.07, .009, 4, 12), dark, [-.65 + i * .24, 1.82, -.47], g);
        box('cable_hook', [.012, .1, .1], [-.65 + i * .24, 1.91, -.47], chrome, g);
      }
      box('cable_rack', [.95, .04, .045], [-.29, 1.97, -.49], chrome, g);
      label('phone_offer', cfg.signage.phoneDeal, [0, .64, -.613], 1.55, .23, '#2a6663', '#f3e3bf', g).rotation.y = Math.PI;
    } else {
      box('sunglass_rack', [.035, .77, .035], [-.37, 1.51, -.18], chrome, g);
      cyl('sunglass_rack_base', .19, .035, [-.37, 1.14, -.18], dark, g);
      for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
        const x = -.37 + side * .14, y = 1.34 + row * .2;
        for (const dx of [-.035, .035]) box('sunglass_lens', [.058, .05, .025], [x + dx, y, -.115], [dark, gold, mint][row], g, [0, 0, side * .1]);
        box('sunglass_bridge', [.035, .012, .028], [x, y, -.11], chrome, g);
      }
      box('counter_mirror_frame', [.32, .42, .07], [.22, 1.4, -.28], gold, g);
      box('counter_mirror', [.26, .35, .012], [.22, 1.4, -.328], chrome, g);
      mesh('display_head', new THREE.IcosahedronGeometry(.14, 0), cream, [.55, 1.63, -.28], g);
      cyl('display_head_neck', .06, .2, [.55, 1.43, -.28], cream, g);
      for (const dx of [-.05, .05]) box('display_head_sunglasses', [.075, .045, .025], [.55 + dx, 1.65, -.411], dark, g);
      box('display_head_bridge', [.04, .012, .025], [.55, 1.65, -.425], gold, g);
      box('open_kiosk_drawer', [.35, .09, .26], [-.52, .87, -.42], dark, g);
      for (let i = 0; i < 3; i++) box('pushed_aside_stock', [.18, .05, .14], [-.2 + i * .16, 1.17 + i * .025, .27], coral, g, [0, i * .25, 0]);
      label('shade_offer', cfg.signage.shadesDeal, [0, .64, -.613], 1.55, .23, '#9a5e41', '#f3e3bf', g).rotation.y = Math.PI;
    }
  }

  // Fountain: panelled basin, submerged coins, maintenance hatch and restrained animated ripples.
  for (const side of [-1, 1]) {
    for (const x of [-1.83, -.94, 0, .94, 1.83]) {
      box('fountain_stone_panel', [.79, .48, .025], [fx + x, .49, fz + side * (fr + .018)], material(0xc3b8a5));
    }
    for (const z of [-1.83, -.94, 0, .94, 1.83]) box('fountain_stone_panel', [.025, .48, .79], [fx + side * (fr + .018), .49, fz + z], material(0xc3b8a5));
  }
  // Work around the original front warning sign rather than putting two plaques on top of one another.
  label('fountain_dedication', cfg.fountain.dedication, [fx, .56, fz + fr + .041], 3.4, .24, '#a58449', '#302b35');
  box('fountain_hatch', [.026, .29, .47], [fx - fr - .042, .43, fz + 1.5], chrome);
  for (let i = 0; i < 4; i++) box('hatch_vent', [.01, .016, .34], [fx - fr - .06, .34 + i * .06, fz + 1.5], dark);
  const rand = seededRandom(cfg.fountain.seed);
  for (let i = 0; i < cfg.fountain.coinCount; i++) {
    let x, z; do { x = (rand() - .5) * (fr * 2 - .75); z = (rand() - .5) * (fr * 2 - .75); } while (Math.hypot(x, z) < .7);
    cyl('submerged_coin', .035 + rand() * .025, .008, [fx + x, 1.058, fz + z], i % 4 ? gold : chrome);
  }
  for (const [x, z, width] of [[-.92, -1, .11], [.96, 1, .07], [-.78, 1, .09], [.4, -1, .06]]) {
    box('worn_fountain_edge', [width, .035, .012], [fx + x * fr, 1.003, fz + z * (fr + .067)], material(0xb2a188));
  }
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const m = box('mineral_stain', [.17, .52, .009], [fx + dx * 1.3, 1.32, fz + dz * 1.3], material(0xa7b9ac));
    m.rotation.y = dx ? Math.PI / 2 : 0;
  }
  const motion = new THREE.Group(); motion.name = 'atrium_gentle_motion'; motion.userData.dynamic = true; root.add(motion);
  const ripples = [];
  for (let i = 0; i < cfg.fountain.rippleCount; i++) {
    const m = mesh('water_highlight', new THREE.RingGeometry(.24, .255, 32), material(0xc7ebdf, { transparent: true, opacity: cfg.fountain.rippleOpacity, depthWrite: false }).clone(),
      [fx + [-1.1, 1.15, .2][i % 3], 1.083 + i * .006, fz + [.6, -.8, 1.45][i % 3]], motion, [-Math.PI / 2, 0, 0]);
    ripples.push(m);
  }

  // One floor overlay: coloured tile bands, a tessellated sunset medallion and traffic wear.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = cfg.floor.textureSize;
  const c = canvas.getContext('2d'), size = canvas.width, sx = size / (A.maxX - A.minX), sz = size / (A.maxZ - A.minZ);
  const px = x => (x - A.minX) * sx, pz = z => (z - A.minZ) * sz;
  c.clearRect(0, 0, size, size);
  c.lineWidth = .16 * sx; c.strokeStyle = '#a49478';
  c.strokeRect(.4 * sx, .4 * sz, size - .8 * sx, size - .8 * sz);
  for (const [index, path] of [
    [[(layout.gate.from + layout.gate.to) / 2, A.minZ], [A.minX + 7.5, A.minZ + 5.6], [A.minX + 7.5, A.minZ + 8.6]],
    [[(layout.martLink.from + layout.martLink.to) / 2, A.minZ], [A.minX + 15, A.minZ + 5], [A.minX + 17.4, A.minZ + 8.6]],
  ].entries()) {
    c.strokeStyle = cfg.floor.colors[index]; c.lineWidth = .24 * sx; c.beginPath();
    path.forEach(([x, z], i) => i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z))); c.stroke();
  }
  const R = cfg.floor.mosaicRadius * sx;
  c.save(); c.translate(px(fx), pz(fz));
  for (let ring = 0; ring < 3; ring++) for (let segment = 0; segment < 32; segment++) {
    const a = segment * Math.PI / 16 + .009, b = (segment + 1) * Math.PI / 16 - .009;
    const outer = R - ring * .32 * sx, inner = outer - .27 * sx;
    c.beginPath(); c.arc(0, 0, outer, a, b); c.arc(0, 0, inner, b, a, true); c.closePath();
    c.fillStyle = cfg.floor.colors[(segment + ring) % cfg.floor.colors.length]; c.fill();
  }
  // Striped sunset rays outside the fountain's footprint, readable from the balcony.
  c.fillStyle = '#d9b16e';
  for (let i = 0; i < 12; i++) {
    c.save(); c.rotate(i * Math.PI / 6); c.fillRect(4.35 * sx, -.055 * sz, .33 * sx, .11 * sz); c.restore();
  }
  c.restore();
  const wear = seededRandom(cfg.floor.seed);
  for (let i = 0; i < cfg.floor.wearCount; i++) {
    const a = wear() * Math.PI * 2, radius = 3.7 + wear() * 2.5;
    c.save(); c.translate(px(fx + Math.cos(a) * radius), pz(fz + Math.sin(a) * radius)); c.rotate(a);
    c.fillStyle = i % 3 ? '#6a5d5019' : '#fff4df22'; c.fillRect(-8, -1, 8 + wear() * 18, 1 + wear() * 2); c.restore();
  }
  const floorTexture = new THREE.CanvasTexture(canvas); floorTexture.colorSpace = THREE.SRGBColorSpace;
  mesh('atrium_floor_mosaic', new THREE.PlaneGeometry(A.maxX - A.minX, A.maxZ - A.minZ),
    new THREE.MeshStandardMaterial({ map: floorTexture, transparent: true, depthWrite: false, roughness: .46 }),
    [cx, cfg.floor.lift, cz], root, [-Math.PI / 2, 0, 0]);

  // Banners hang entirely in the open court, above ground players and below no upper walkway.
  for (const b of cfg.overhead.banners) {
    const x = A.minX + b.x * (A.maxX - A.minX), z = A.minZ + b.z * (A.maxZ - A.minZ);
    const y = cfg.overhead.bannerBottom + cfg.overhead.bannerHeight / 2;
    const banner = label('hanging_opening_banner', `${b.text}\n${b.sub}`, [x, y, z], 1.05, cfg.overhead.bannerHeight, b.color, '#352839');
    const back = banner.clone(); back.rotation.y = Math.PI; back.position.z -= .012; root.add(back);
    box('banner_weight', [1.1, .055, .055], [x, cfg.overhead.bannerBottom, z], gold);
    const top = upperY + layout.upperHeight - .3;
    cyl('banner_wire', .009, top - (y + cfg.overhead.bannerHeight / 2), [x, (top + y + cfg.overhead.bannerHeight / 2) / 2, z], chrome);
  }
  // A geometric sunset mobile, suspended above the existing fountain rather than a new floor obstacle.
  const mobile = new THREE.Group(); mobile.name = 'sunset_mobile'; mobile.position.set(fx, cfg.overhead.mobileY, fz); motion.add(mobile);
  mesh('mobile_sun', new THREE.CircleGeometry(.82, 24), material(0xe9b96d, { side: THREE.DoubleSide }), [0, .12, 0], mobile);
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) box('mobile_sunset_stripe', [1.55, .06, .035], [0, -.05 - i * .18, side * .025], i % 2 ? coral : plum, mobile);
  for (const side of [-1, 1]) {
    const diamond = box('mobile_diamond', [.45, .45, .05], [side * 1.65, -.4 + side * .25, 0], side < 0 ? mint : coral, mobile, [0, 0, Math.PI / 4]);
    cyl('mobile_string', .006, 1.55, [diamond.position.x, .55, 0], chrome, mobile);
  }
  const roof = upperY + layout.upperHeight;
  cyl('mobile_hanger', .009, roof - cfg.overhead.mobileY, [fx, (roof + cfg.overhead.mobileY) / 2, fz], chrome);
  // Garland runs along the outside of the north railing. It never fills a doorway, escalator gap or firing lane.
  for (let i = 0; i < 18; i++) {
    const x = A.minX + layout.ringDepth + .5 + i * (A.maxX - A.minX - 2 * layout.ringDepth - 1) / 17;
    const y = upperY + .85 - Math.sin(i / 17 * Math.PI * 3) ** 2 * .3;
    mesh('celebration_pennant', new THREE.ConeGeometry(.12, .27, 3), [coral, mint, cream, gold][i % 4], [x, y, A.maxZ - layout.ringDepth - .08], root, [0, 0, Math.PI]);
  }

  // Small scenes sit on benches, in the basin/planter silhouettes, or flat on existing walls.
  function bag(x, y, z, color = coral) {
    box('abandoned_shopping_bag', [.22, .28, .14], [x, y + .14, z], color);
    for (const dx of [-.07, .07]) box('bag_handle', [.015, .1, .015], [x + dx, y + .32, z], gold);
    box('bag_handle', [.155, .015, .015], [x, y + .37, z], gold);
  }
  const bench = layout.benches[0];
  bag((bench[0] + bench[2]) / 2, .45, bench[1] + .35); bag((bench[0] + bench[2]) / 2, .45, bench[1] + .68, cream);
  cyl('bench_drink', .06, .18, [(bench[0] + bench[2]) / 2, .54, bench[3] - .3], cream);
  // An overflowing bin rests INSIDE a tree planter's existing collider, against its trunk.
  const [bx, bz] = layout.planters[3];
  cyl('kiosk_bin', .18, .48, [bx + .35, .49, bz], dark);
  for (let i = 0; i < 5; i++) mesh('bin_packaging', new THREE.IcosahedronGeometry(.07), i % 2 ? cream : coral, [bx + .3 + (i % 3) * .05, .77 + (i % 2) * .045, bz + (i - 2) * .035]);
  // Cleaning equipment behind the fountain's existing glass, not standing loose in the training lane.
  cyl('cleaning_bucket', .13, .22, [fx + fr - .45, 1.19, fz + fr - .45], mint);
  cyl('mop_handle', .013, .95, [fx + fr - .55, 1.67, fz + fr - .4], gold, root, [0, 0, -.14]);
  bag(fx - fr + .42, 1.08, fz + .9, cream);
  const notice = wallGroup({ wall: 'west', at: 11.5 });
  box('staff_noticeboard', [1.65, 1.05, .08], [0, 1.7, .08], gold, notice);
  label('employee_schedule', `EMPLOYEE NOTICEBOARD\n${cfg.signage.notice.replace(' · ', '\n')}\nMON TUE WED THU FRI SAT SUN\nDALE DALE DALE DALE DALE DALE DALE`, [0, 1.7, .135], 1.5, .9, '#e5d4b2', '#51364e', notice);
  const directory = wallGroup({ wall: 'east', at: 2.6 });
  box('directory_case', [1.05, 1.65, .12], [0, 1.5, .1], plum, directory);
  label('directory_title', 'Sunset Galleria', [0, 2.15, .175], .94, .2, '#4b304e', '#f3e3bf', directory);
  label('directory_floorplan', '01  Shopping\n02  More Shopping\n← Food Court\n↓ Mega Mart\n↑ Promenade\nYou are here', [0, 1.5, .175], .88, .95, '#d5dfcb', '#4b304e', directory);
  label('directory_terms', cfg.signage.directory, [0, .85, .175], .94, .15, '#4b304e', '#f3e3bf', directory);
  // A single tired promotional balloon caught high by the north-west roof beam.
  mesh('stranded_balloon', new THREE.SphereGeometry(.26, 8, 6), material(P.coral, { roughness: .25, metalness: .15 }), [A.minX + 4, roof - .62, A.maxZ - 4]);
  cyl('balloon_ribbon', .007, .75, [A.minX + 4, roof - 1.22, A.maxZ - 4], gold);

  let time = 0;
  function pose() {
    const enabled = atmosphere.ambient.enabled;
    mobile.rotation.y = enabled ? Math.sin(time * Math.PI * 2 / cfg.overhead.period) * cfg.overhead.swayRadians : 0;
    ripples.forEach((r, i) => {
      const phase = (time / cfg.fountain.ripplePeriod + i / ripples.length) % 1;
      r.scale.setScalar(enabled ? .7 + phase * 2.4 : 1);
      r.material.opacity = cfg.fountain.rippleOpacity * (enabled ? Math.sin(phase * Math.PI) : .5);
    });
  }
  pose();
  return { root, update(dt) { if (atmosphere.ambient.enabled) time += dt; pose(); }, reset() { time = 0; pose(); } };
}
