// Closed shops with physical interiors beyond the arcade walls. Local +Z faces the atrium;
// negative Z is inside each shop. The shell owns the continuous, non-vaultable glass barriers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { atriumDetails as cfg } from '../../config/atrium.js';
import { makeSignTexture } from '../../world/textures.js';

export function atriumShopOpenings(layout, wall, upper = false) {
  const origin = wall === 'north' ? layout.rect.minX : layout.rect.minZ;
  return cfg.storefronts.filter(s => s.wall === wall && !!s.upper === upper).map(s => ({
    from: origin + s.at - s.width / 2, to: origin + s.at + s.width / 2, top: cfg.shopInterior.openingHeight,
  }));
}

export function buildAtriumStorefronts(kit, layout, upperY, root) {
  const A = layout.rect, P = cfg.palette, D = cfg.shopInterior.depth, H = cfg.shopInterior.openingHeight;
  const mat = (color, extra = {}) => kit.mat(color, extra);
  const cream = mat(P.cream), ink = mat(P.ink), paper = mat(P.paper);
  const chrome = mat(P.chrome, { metalness: .65, roughness: .3 });
  const gold = mat(P.gold, { metalness: .45, roughness: .4 });
  const colors = [mat(P.coral), mat(P.mint), cream, mat(P.plum), mat(P.blue)];
  const glass = mat(0xb6d8dd, { transparent: true, opacity: cfg.shopInterior.glassOpacity,
    roughness: .12, metalness: .12, depthWrite: false, side: THREE.DoubleSide });
  // One sheet for every shop's lettering lets static batching combine window labels and headers.
  const prints = new Map(), sheet = document.createElement('canvas'); sheet.width = sheet.height = 2048;
  const pen = sheet.getContext('2d'), atlas = new THREE.CanvasTexture(sheet); atlas.colorSpace = THREE.SRGBColorSpace;
  const printMaterial = new THREE.MeshBasicMaterial({ map: atlas });
  pen.fillStyle = '#ffedcc'; pen.fillRect(0, 0, 16, 16);
  let column = 0, cursor = 20;
  function mesh(g, name, geometry, material, at, rotation = [0, 0, 0]) {
    const m = new THREE.Mesh(geometry, material); m.name = name;
    m.position.set(...at); m.rotation.set(...rotation); g.add(m); return m;
  }
  const box = (g, name, size, at, material, rotation) => mesh(g, name, new THREE.BoxGeometry(...size), material, at, rotation);
  const face = (g, name, w, h, at, material, rotation) => mesh(g, name, new THREE.PlaneGeometry(w, h), material, at, rotation);
  const cyl = (g, name, r, h, at, material) => mesh(g, name, new THREE.CylinderGeometry(r, r, h, 8), material, at);
  const glow = m => {
    const uv = m.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 8 / 2048, 1 - 8 / 2048);
    return m;
  };
  function label(g, name, text, at, w, h, bg = '#eee2ca', color = '#363642', font = 'Arial, sans-serif') {
    const key = JSON.stringify([text, w / h, bg, color, font]);
    if (!prints.has(key)) {
      const source = makeSignTexture(text, { aspect: w / h, background: bg, color, font, style: 'standard' });
      const height = Math.ceil(504 * h / w);
      if (cursor + height + 8 > sheet.height) { column++; cursor = 0; }
      if ((column + 1) * 512 > sheet.width) throw new Error('Atrium shop lettering exceeds its atlas');
      const x = column * 512 + 4, y = cursor + 4;
      pen.drawImage(source.image, x, y, 504, height); source.dispose();
      prints.set(key, { u: x / 2048, v: 1 - (y + height) / 2048, w: 504 / 2048, h: height / 2048 });
      cursor += height + 8;
    }
    const region = prints.get(key), geometry = new THREE.PlaneGeometry(w, h), uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, region.u + uv.getX(i) * region.w, region.v + uv.getY(i) * region.h);
    return mesh(g, name, geometry, printMaterial, at);
  }
  function mannequin(g, x, z, cloth, pose, uneasy = false) {
    cyl(g, 'mannequin_base', .23, .04, [x, .22, z], chrome);
    box(g, 'mannequin_torso', [.32, .5, .19], [x, 1.14, z], cloth);
    box(g, 'mannequin_neck', [.07, .09, .07], [x, 1.41, z], cream);
    if (uneasy) {
      const head = new THREE.Group(); head.name = 'retail_unease_head'; head.userData.dynamic = true;
      head.position.set(x, 1.56, z); g.add(head);
      mesh(head, 'mannequin_head', new THREE.IcosahedronGeometry(.13, 0), cream, [0, 0, 0]);
      const eyes = [-.044, .044].map(dx => new THREE.BoxGeometry(.024, .016, .012).translate(dx, .015, .118));
      mesh(head, 'mannequin_eye_marks', mergeGeometries(eyes), ink, [0, 0, 0]); eyes.forEach(e => e.dispose());
    } else mesh(g, 'mannequin_head', new THREE.IcosahedronGeometry(.13, 0), cream, [x, 1.56, z]);
    for (const side of [-1, 1]) {
      box(g, 'mannequin_leg', [.09, .55, .1], [x + side * .085, .63, z], cream);
      box(g, 'mannequin_shoe', [.12, .07, .2], [x + side * .085, .32, z + .04], ink);
      box(g, 'mannequin_arm', [.075, .46, .09], [x + side * .23, 1.13, z], cream, [0, 0, side * (pose ? .32 : .12)]);
    }
  }
  function bottle(g, x, bottom, z, i) {
    const h = .15 + i % 3 * .055;
    box(g, 'perfume_bottle', [.11 + i % 2 * .035, h, .1], [x, bottom + h / 2, z], colors[i % colors.length]);
    box(g, 'perfume_cap', [.07, .045, .065], [x, bottom + h + .02, z], gold);
  }
  function suitcase(g, x, bottom, z, i) {
    const h = .48 + i % 2 * .17;
    box(g, 'suitcase', [.43, h, .28], [x, bottom + h / 2 + .04, z], colors[i % colors.length]);
    for (const dx of [-.11, .11]) {
      face(g, 'case_strap', .025, h, [x + dx, bottom + h / 2 + .04, z + .15], gold);
      box(g, 'case_wheel', [.055, .055, .06], [x + dx, bottom + .035, z], ink);
    }
    box(g, 'case_handle', [.15, .045, .05], [x, bottom + h + .1, z], ink);
  }
  function television(g, x, bottom, z, colorIndex) {
    box(g, 'television_case', [.68, .52, .36], [x, bottom + .26, z], colors[colorIndex % colors.length]);
    const screen = mat(0x6da8b6, { emissive: 0x265c6b, emissiveIntensity: .65, roughness: .3 });
    box(g, 'television_screen', [.51, .35, .018], [x - .035, bottom + .29, z + .19], screen);
    for (let i = 0; i < 3; i++) face(g, 'television_scanline', .49, .009, [x - .035, bottom + .19 + i * .1, z + .203], colors[1]);
    for (const y of [.16, .34]) mesh(g, 'television_control', new THREE.CircleGeometry(.023, 6), chrome, [x + .275, bottom + y, z + .19]);
    for (const dx of [-.22, .22]) box(g, 'television_foot', [.09, .045, .2], [x + dx, bottom - .02, z], ink);
  }
  function portrait(g, x, y, z, size = 1) {
    box(g, 'portrait_frame', [.57 * size, .76 * size, .06], [x, y, z], gold);
    box(g, 'portrait_paper', [.48 * size, .66 * size, .01], [x, y, z + .036], paper);
    mesh(g, 'same_employee_head', new THREE.CircleGeometry(.1 * size, 8), colors[1], [x, y + .12 * size, z + .044]);
    box(g, 'same_employee_uniform', [.25 * size, .22 * size, .012], [x, y - .13 * size, z + .045], colors[0]);
  }

  for (const [index, s] of cfg.storefronts.entries()) {
    const g = new THREE.Group(); g.name = `display_${s.name}`;
    const alongZ = s.wall !== 'north';
    g.position.set(alongZ ? (s.wall === 'west' ? A.minX : A.maxX) : A.minX + s.at,
      s.upper ? upperY : 0, alongZ ? A.minZ + s.at : A.maxZ);
    g.rotation.y = { west: Math.PI / 2, east: -Math.PI / 2, north: Math.PI }[s.wall]; root.add(g);
    const w = s.width, finish = cfg.shopInterior.finishes[s.theme], accent = mat(s.color);
    const wall = mat(finish.wall);
    const floor = mat(finish.floor), dx = -.48, displayW = w - 1.18, doorLeft = w / 2 - .91, doorX = w / 2 - .48;
    const variant = index % 2;

    // These are actual rooms beyond the cut wall, with visible corners and a back wall.
    box(g, 'shop_floor', [w, .08, D], [0, -.025, -D / 2], floor);
    box(g, 'shop_rear_wall', [w, H, .1], [0, H / 2, -D], wall);
    for (const side of [-1, 1]) box(g, 'shop_side_wall', [.1, H, D + .1], [side * w / 2, H / 2, -D / 2], wall);
    box(g, 'shop_ceiling', [w + .1, .1, D], [0, H, -D / 2], cream);
    box(g, 'shop_rear_skirting', [w - .1, .12, .035], [0, .07, -D + .065], accent);
    for (let i = 0; i < 7; i++) face(g, 'shop_floor_joint', .012, D - .1,
      [-w / 2 + (i + 1) * w / 8, .018, -D / 2], cream, [-Math.PI / 2, 0, 0]);
    box(g, 'shop_track', [w - .4, .045, .06], [0, H - .14, -.65], chrome);
    for (const x of [-w * .27, 0, w * .27]) {
      mesh(g, 'display_spotlight_housing', new THREE.CylinderGeometry(.065, .065, .13, 6, 1, true), ink, [x, H - .23, -.65]);
      glow(mesh(g, 'display_spotlight_lens', new THREE.CircleGeometry(.05, 6), printMaterial, [x, H - .302, -.65], [Math.PI / 2, 0, 0]));
    }
    // Luminous fixtures share the lettering sheet; existing room lights illuminate the interiors.
    glow(box(g, 'shop_ceiling_panel', [w * .5, .025, .36], [0, H - .065, -1.65], printMaterial));
    const pilasterHeight = s.upper || s.wall === 'north' ? 3.12 : 5.15;
    for (const side of [-1, 1]) {
      box(g, 'arcade_pilaster', [.14, pilasterHeight, .14], [side * (w / 2 + .14), pilasterHeight / 2, .08], accent);
      box(g, 'pilaster_capital', [.25, .13, .21], [side * (w / 2 + .14), pilasterHeight - .12, .12], cream);
      if (!s.upper && s.wall !== 'north') box(g, 'arcade_bracket', [.2, .18, .38], [side * (w / 2 + .14), upperY - .48, .18], cream);
    }
    box(g, 'shop_header', [w + .12, .56, .3], [0, 2.8, .04], accent);
    const bg = `#${s.color.toString(16).padStart(6, '0')}`;
    label(g, 'shop_name', s.name, [0, 2.88, .199], w - .22, .3, bg, '#302739', finish.font);
    label(g, 'shop_terms', s.sub, [0, 2.62, .199], w - .2, .12, bg);
    if (s.awning) for (let i = 0; i < 9; i++) box(g, 'striped_awning', [w / 9, .055, .36],
      [-w / 2 + w * (i + .5) / 9, 2.5, .1], i % 2 ? cream : accent, [-.15, 0, 0]);

    // One transparent pane per shop, divided into windows and a locked entrance by real metalwork.
    mesh(g, 'sealed_shop_glass', new THREE.PlaneGeometry(w - .08, 2.46), glass, [0, 1.27, .09]);
    for (const x of [-w / 2, doorLeft, w / 2]) box(g, 'shop_frame', [.065, 2.52, .075], [x, 1.26, .1], chrome);
    for (const y of [.055, 2.51]) box(g, 'shop_frame', [w + .06, .065, .075], [0, y, .1], chrome);
    box(g, 'display_sill', [displayW, .2, .17], [dx, .13, .08], accent);
    box(g, 'door_kickplate', [.77, .24, .025], [doorX, .2, .135], chrome);
    box(g, 'door_pull', [.025, .38, .045], [doorLeft + .13, 1.09, .16], chrome);
    mesh(g, 'door_lock', new THREE.CircleGeometry(.026, 6), gold, [doorLeft + .13, .82, .15]);
    label(g, 'shop_closed', 'CLOSED', [doorX, 1.65, .143], .49, .16, '#e9dfc8', '#514344');
    label(g, 'opening_hours', '10 AM - 9 PM', [doorX, 1.43, .143], .57, .085, '#e9dfc8', '#514344');
    for (const x of [-w / 2 + .12, doorLeft - .1]) face(g, 'worn_window_sill', .08, .012, [x, .236, .17], cream);

    if (s.theme !== 'paper') {
      box(g, 'window_display_plinth', [displayW - .14, .18, .77], [dx, .11, -.52], cream);
      // The sales counter sits behind the locked door; the middle aisle remains visible through it.
      box(g, 'shop_sales_counter', [.61, .86, .5], [doorX - .02, .45, -1.58], accent);
      box(g, 'shop_counter_top', [.69, .06, .57], [doorX - .02, .91, -1.58], cream);
      box(g, 'shop_register', [.26, .17, .23], [doorX - .02, 1.03, -1.58], ink);
      box(g, 'shop_register_screen', [.18, .09, .015], [doorX - .02, 1.06, -1.455], colors[1]);
      box(g, 'branded_shopping_bag', [.2, .28, .13], [doorX - .2, .51, -1.29], paper);
      box(g, 'shopping_bag_hook', [.025, .035, .06], [doorX - .2, .72, -1.32], gold);
      for (const x of [doorX - .25, doorX - .15]) box(g, 'shopping_bag_handle', [.012, .08, .012], [x, .68, -1.29], gold);
      box(g, 'shopping_bag_handle', [.11, .012, .012], [doorX - .2, .72, -1.29], gold);
      for (let i = 0; i < 2; i++) box(g, 'shop_stock_carton', [.3, .23, .28], [doorX + .1, .14 + i * .23, -2.02], paper);
    }
    if (s.theme === 'fashion') {
      mannequin(g, -w / 2 + .65, -.51, colors[variant], variant, index === 0);
      mannequin(g, doorLeft - .6, -.63, colors[3 - variant], 1 - variant);
      box(g, 'clothing_rail', [w - .55, .035, .035], [0, 1.91, -1.88], chrome);
      for (const x of [-w / 2 + .3, w / 2 - .3]) box(g, 'clothing_rail_support', [.03, 1.85, .03], [x, .98, -1.88], chrome);
      for (let i = 0; i < 7; i++) {
        const x = -w / 2 + .5 + i * (w - 1) / 6;
        box(g, 'hanging_garment', [.27, .57, .09], [x, 1.49, -1.88], colors[(i + variant) % 5]);
        for (const side of [-1, 1]) box(g, 'coat_hanger', [.17, .015, .02], [x + side * .06, 1.81, -1.88], chrome, [0, 0, side * -.5]);
      }
      for (let i = 0; i < 3; i++) box(g, 'folded_clothes', [.42, .055, .3], [dx, .23 + i * .055, -.4], colors[i]);
      label(g, 'price_card', 'NEW COLLECTION', [dx, .43, -.11], .64, .12);
    } else if (s.theme === 'beauty') {
      for (const y of [.61, 1.22, 1.83]) {
        box(g, 'beauty_shelf', [w - .3, .045, .29], [0, y, -D + .23], cream);
        for (let i = 0; i < 7; i++) bottle(g, -w / 2 + .35 + i * (w - .7) / 6, y + .024, -D + .28, i + variant);
      }
      box(g, 'beauty_tester_table', [displayW - .25, .64, .48], [dx, .52, -.64], accent);
      box(g, 'beauty_tester_top', [displayW - .15, .04, .55], [dx, .86, -.64], cream);
      for (let i = 0; i < 4; i++) bottle(g, dx - .43 + i * .28, .88, -.61, i + 2);
      box(g, 'tester_mirror_base', [.3, .035, .18], [dx, .9, -.78], gold);
      box(g, 'tester_mirror_stand', [.035, .25, .035], [dx, 1, -.78], gold);
      box(g, 'tester_mirror_frame', [.44, .66, .06], [dx, 1.44, -.78], gold);
      box(g, 'tester_mirror', [.37, .58, .014], [dx, 1.44, -.74], chrome);
      label(g, 'price_card', 'TESTERS - PLEASE ASK', [dx, .75, -.386], .82, .12);
    } else if (s.theme === 'luggage') {
      for (let i = 0; i < 3; i++) suitcase(g, -w / 2 + .5 + i * (displayW - .7) / 2, .21, -.55, i + variant);
      for (const y of [.42, 1.39]) {
        box(g, 'luggage_wall_shelf', [w - .35, .06, .42], [0, y, -D + .31], cream);
        for (let i = 0; i < 4; i++) suitcase(g, -w / 2 + .45 + i * (w - .9) / 3, y + .035, -D + .32, i + variant + 1);
      }
      label(g, 'price_card', 'MATCHING SETS AVAILABLE', [dx, .35, -.12], .94, .12);
    } else if (s.theme === 'television') {
      box(g, 'television_display_bench', [displayW - .12, .47, .57], [dx, .45, -.6], ink);
      television(g, dx, .72, -.59, variant);
      for (const y of [.55, 1.46]) {
        box(g, 'electronics_wall_shelf', [w - .4, .065, .48], [0, y, -D + .34], chrome);
        for (const x of [-.52, .52]) television(g, x, y + .065, -D + .36, variant + 2);
      }
      for (const x of [-w / 2 + .22, w / 2 - .22]) {
        box(g, 'speaker_cabinet', [.27, 1.2, .3], [x, .64, -1.32], ink);
        for (const y of [.31, .7, 1.04]) mesh(g, 'speaker_cone', new THREE.CircleGeometry(.095, 10), chrome, [x, y, -1.164]);
      }
      label(g, 'price_card', 'COLOUR TV - LIVE DEMO', [dx, .52, -.303], .9, .12);
    } else if (s.theme === 'portraits') {
      for (let i = 0; i < 3; i++) portrait(g, (i - 1) * (w - .6) / 3, 1.72, -D + .08);
      portrait(g, -w / 2 + .48, .91, -.49, .9);
      box(g, 'portrait_display_easel', [.04, .73, .04], [-w / 2 + .48, .56, -.54], gold);
      box(g, 'portrait_studio_backdrop', [1.05, 1.9, .035], [dx, 1.02, -1.92], colors[3]);
      cyl(g, 'portrait_stool', .2, .06, [dx, .69, -1.47], colors[0]);
      cyl(g, 'portrait_stool_stem', .035, .62, [dx, .35, -1.47], chrome);
      cyl(g, 'portrait_stool_base', .23, .025, [dx, .035, -1.47], chrome);
      box(g, 'studio_camera', [.2, .14, .14], [.3, 1.25, -.93], ink);
      cyl(g, 'studio_camera_lens', .055, .12, [.3, 1.25, -1.03], chrome).rotation.x = Math.PI / 2;
      for (const side of [-1, 0, 1]) box(g, 'studio_tripod', [.018, 1.15, .018], [.3 + side * .13, .63, -.91], chrome, [0, 0, side * -.2]);
      label(g, 'price_card', 'PORTRAITS WHILE YOU WAIT', [dx, .35, -.12], 1, .12);
    } else {
      // A vacant unit is still a room: partly papered glazing reveals unfinished work above it and through the door.
      box(g, 'covered_window', [displayW - .1, .86, .015], [dx, .68, .045], paper);
      for (let i = 0; i < 5; i++) box(g, 'paper_seam', [.01, .84, .01], [-w / 2 + .2 + i * displayW / 5, .68, .057], cream);
      label(g, 'opening_notice', s.upper ? 'RETAIL SPACE TO LET' : 'OPENING SPRING 1986', [dx, 1.46, .105], displayW - .22, .22);
      label(g, 'opening_footnote', 'PLEASE EXCUSE OUR PERMANENT PROGRESS', [dx, 1.18, .105], displayW - .12, .11);
      for (let i = 0; i < 5; i++) box(g, 'fitout_stock_carton', [.42, .32, .38], [-w / 2 + .5 + (i % 3) * .44, .18 + Math.floor(i / 3) * .32, -1.74], paper);
      for (const x of [-.24, .24]) box(g, 'fitout_ladder_rail', [.04, 1.97, .05], [x, 1.03, -1.7], chrome, [-.12, 0, 0]);
      for (let i = 0; i < 6; i++) box(g, 'fitout_ladder_rung', [.48, .035, .04], [0, .3 + i * .29, -1.7], chrome);
      for (const x of [.58, .94]) {
        cyl(g, 'fitout_paint_tin', .12, .24, [x, .14, -.8], cream);
        cyl(g, 'fitout_paint_lid', .125, .018, [x, .269, -.8], chrome);
      }
      for (let i = 0; i < 7; i++) box(g, 'closed_shutter_slat', [displayW, .055, .045], [dx, 2.44 - i * .055, .02], chrome);
      if (!s.upper) {
        // A lunch break interrupted in the locked unit: everything rests on its workbench.
        box(g, 'abandoned_workbench', [.7, .05, .42], [-w / 2 + .55, .8, -1.03], cream);
        for (const x of [-w / 2 + .27, -w / 2 + .83]) box(g, 'workbench_support', [.05, .76, .3], [x, .4, -1.03], chrome);
        cyl(g, 'employee_drink', .045, .14, [-w / 2 + .35, .895, -1.03], cream);
        box(g, 'unfinished_sandwich', [.15, .04, .11], [-w / 2 + .55, .845, -1], paper);
        box(g, 'backroom_phone', [.18, .06, .16], [-w / 2 + .76, .855, -1.03], ink);
        box(g, 'phone_receiver_off_hook', [.2, .025, .055], [-w / 2 + .73, .84, -.9], ink, [0, .3, 0]);
      } else {
        for (let i = 0; i < 4; i++) face(g, 'display_footprint', .07, .15, [-.65 + (i % 2) * .16, .02, -.4 - i * .24], ink, [-Math.PI / 2, 0, .15]);
        const outline = new THREE.Shape();
        outline.moveTo(-.2, 0); outline.lineTo(-.17, .7); outline.lineTo(-.25, .9);
        outline.lineTo(-.14, 1.27); outline.lineTo(-.08, 1.3); outline.lineTo(-.1, 1.51);
        outline.lineTo(.1, 1.51); outline.lineTo(.08, 1.3); outline.lineTo(.2, 1.22);
        outline.lineTo(.24, .8); outline.lineTo(.13, .7); outline.lineTo(.18, 0); outline.closePath();
        const figure = mesh(g, 'retail_unease_silhouette', new THREE.ShapeGeometry(outline), colors[3], [.65, .02, -1.25]);
        figure.userData.dynamic = true; figure.visible = false;
      }
    }
  }
  atlas.needsUpdate = true;
}
