// =============================================================================
// GRAB-A-GUN's CABINET (the machine itself is the map feature kind 'clawMachine', game/features/clawMachine.js; numbers in
// config/clawMachine.js). A hot-pink arcade claw machine against a wall, built from blocks like the RESTOCK-O-MATIC
// (mall/restockMachine.js):
//   base      the screen (live: the feature writes the lanes, the timer, the prize), the big red DROP button, a coin door, the
//             prize chute (a hinged flap and a tray) and a kick plate with the small print; Sunny on both sides
//   glass     three lanes in a dark pit, a gantry rail, a lit strip under the header, a printed backdrop
//   header    a marquee board ("GRAB-A-GUN", bulbs painted on, so they never blink), "EVERYONE'S A WINNER*" under it, and Sunny,
//             the Galleria's sun mascot (one button eye, a stare nobody asked for), standing on top
// ONE solid collider, 2.2 m tall, that never moves (moving a collider would rebuild navigation). Everything lights itself
// (unlit or plain materials, no real lights, nothing flickers); the canvas art is drawn once.
//
// Built in world coordinates (every box axis-aligned, no rotated group), so the coplanar test reads its faces as they are.
// The parts that change at runtime (the claw, the capsules, the chute flap, the dust sheet) are in `rig.group`, flagged
// userData.dynamic for the static batcher. Capsules are plain spheres in their rarity colour.
//
//   buildClawCabinet({ kit, back: { x, z }, faces: '+z' | '-z' | '+x' | '-x', floorY = 0 }) -> { position, normal, screen, rig }
//     back                the middle of the cabinet's back, on the wall's face
//     position / normal   where the player interacts (the glass front) and the way the front faces
//     screen.show({ title, lines: [3 strings], dots: [3 colours | null], highlight, note, tone })   redraws only on a change
//     rig.setCapsule(lane, color | null)   a capsule in that lane (null: none)
//     rig.setClaw(u, drop, open = 0.3, sway = 0)  the claw over local u (rig.laneU[lane] = over that lane), drop 0 (up) .. 1 (down),
//                                          its prongs 0 (shut) .. 1 (open), and the carried capsule swinging `sway` m (show only)
//     rig.carry(lane | null)               that lane's capsule rides with the claw
//     rig.setFlap(open)                    the chute flap, 0 (shut) .. 1 (swung out)
//     rig.chute                            { position, normal }: where the won gun sits, and the way it faces
//     rig.setLive(live)                    false: a dust sheet over it with a "BACK SOON" note (the machine is at another site)
//     rig.reset()                          no capsules, claw parked over the first lane, flap shut
// =============================================================================

import * as THREE from 'three';
import { clawMachine } from '../../config/clawMachine.js';
import { drawType } from '../../world/typeKit.js';

export const CLAW_CABINET = {
  colors: {
    body: 0xff4fa3, // hot pink (the RESTOCK-O-MATIC is orange, the stores are teal and pastel)
    bodyDark: 0xb8236f,
    trim: 0x1d1626,
    chrome: 0xc9ccd4,
    pit: 0x2b1f3a,
    rail: 0x8a8f99,
    claw: 0xd9dde3,
    button: 0xff2a2a,
    tray: 0x14101a,
    glass: 0xbfe8ff,
    strip: 0xfff1c9, // the lit strip under the header
    coin: 0x2b2233,
  },
  laneU: [-0.38, 0, 0.38], // capsule lanes across the pit (local metres from the middle)
  capsuleRadius: 0.12,
  pitTop: 0.92, // the pit floor, above the base (0..0.9)
  clawUp: 1.76, // the claw head's height when parked
  railY: 1.86, // the gantry rail (and the carriage on it)
  chuteU: -0.25, // the claw lets go over the chute, here (the chute is the left part of the base)
  chute: { u0: -0.55, u1: 0.05, y0: 0.18, y1: 0.46 }, // the chute's mouth
  topper: { size: 0.5, lift: 0.04 }, // Sunny on the header
};

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const texture = (c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Sunny, the Galleria's sun mascot: rays, a smile that's trying, one button eye and one staring eye. Transparent around him. */
export function drawSunny(ctx, cx, cy, r) {
  ctx.fillStyle = '#ffb21a';
  for (let i = 0; i < 12; i++) { // rays
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - 0.14) * r * 0.82, cy + Math.sin(a - 0.14) * r * 0.82);
    ctx.lineTo(cx + Math.cos(a) * r * 1.32, cy + Math.sin(a) * r * 1.32);
    ctx.lineTo(cx + Math.cos(a + 0.14) * r * 0.82, cy + Math.sin(a + 0.14) * r * 0.82);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = '#d98a00';
  ctx.stroke();
  // The staring eye (left), wide open, the pupil a little too small.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - r * 0.36, cy - r * 0.18, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d1626';
  ctx.beginPath(); ctx.arc(cx - r * 0.36, cy - r * 0.18, r * 0.07, 0, Math.PI * 2); ctx.fill();
  // The button eye (right): four holes and a loose thread.
  ctx.fillStyle = '#3a86ff';
  ctx.beginPath(); ctx.arc(cx + r * 0.36, cy - r * 0.18, r * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d1626';
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath(); ctx.arc(cx + r * 0.36 + dx * r * 0.06, cy - r * 0.18 + dy * r * 0.06, r * 0.03, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#1d1626';
  ctx.lineWidth = r * 0.025;
  ctx.beginPath(); ctx.moveTo(cx + r * 0.5, cy - r * 0.05); ctx.quadraticCurveTo(cx + r * 0.62, cy + r * 0.08, cx + r * 0.55, cy + r * 0.2); ctx.stroke();
  // The smile: wide, and not quite level.
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy + r * 0.3); ctx.quadraticCurveTo(cx, cy + r * 0.62, cx + r * 0.5, cy + r * 0.24); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 110, 140, 0.55)'; // cheeks
  ctx.beginPath(); ctx.arc(cx - r * 0.62, cy + r * 0.2, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.66, cy + r * 0.16, r * 0.12, 0, Math.PI * 2); ctx.fill();
}

// The canvas art, drawn once and shared by every cabinet (one material each, so the static batcher can merge them).
let art = null;
function cabinetArt() {
  if (art) return art;
  // The marquee: a dark board, a ring of painted bulbs, the name in pink with a gold outline.
  const marquee = canvas(512, 96);
  {
    const ctx = marquee.getContext('2d');
    ctx.fillStyle = '#1d1626';
    ctx.fillRect(0, 0, 512, 96);
    for (let i = 0; i < 26; i++) {
      for (const y of [9, 87]) {
        ctx.fillStyle = i % 2 ? '#ffe9a8' : '#ff9fd2';
        ctx.beginPath(); ctx.arc(10 + i * 19.6, y, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawType(ctx, clawMachine.name, 256, 50, { role: 'arcade', size: 58, fill: '#ff4fa3', maxWidth: 470, outline: { color: '#ffc83d', width: 0.14 }, shadow: false });
  }
  // The backdrop inside the glass: pink rays, stars, and the promise.
  const backdrop = canvas(256, 224);
  {
    const ctx = backdrop.getContext('2d');
    ctx.fillStyle = '#ffd6ec';
    ctx.fillRect(0, 0, 256, 224);
    ctx.fillStyle = '#ffb8dc';
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2, a1 = a0 + Math.PI / 16;
      ctx.beginPath(); ctx.moveTo(128, 150);
      ctx.lineTo(128 + Math.cos(a0) * 400, 150 + Math.sin(a0) * 400);
      ctx.lineTo(128 + Math.cos(a1) * 400, 150 + Math.sin(a1) * 400);
      ctx.closePath(); ctx.fill();
    }
    drawType(ctx, 'WIN! WIN! WIN!', 128, 40, { role: 'arcade', size: 30, fill: '#b8236f', maxWidth: 236 });
    drawType(ctx, '(results may vary)', 128, 62, { role: 'officialBody', size: 15, fill: '#b8236f', maxWidth: 236 });
  }
  // Sunny on his own (the sides and the topper), with a see-through background.
  const sunny = canvas(256, 256);
  drawSunny(sunny.getContext('2d'), 128, 128, 86);
  // The dust sheet: off-white cloth with a few soft, uneven folds (not stripes) and a little grime toward the hem.
  const cloth = canvas(128, 128);
  {
    const ctx = cloth.getContext('2d');
    ctx.fillStyle = '#ddd6c6';
    ctx.fillRect(0, 0, 128, 128);
    for (const [x, w, shade] of [[0, 30, 0.1], [30, 18, 0.14], [48, 36, 0.08], [84, 22, 0.12], [106, 22, 0.09]]) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, `rgba(120, 105, 85, ${shade})`);
      g.addColorStop(0.45, 'rgba(255, 255, 255, 0.06)');
      g.addColorStop(1, `rgba(120, 105, 85, ${shade * 0.6})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, 128);
    }
    const hem = ctx.createLinearGradient(0, 96, 0, 128);
    hem.addColorStop(0, 'rgba(110, 95, 75, 0)');
    hem.addColorStop(1, 'rgba(110, 95, 75, 0.18)');
    ctx.fillStyle = hem;
    ctx.fillRect(0, 96, 128, 32);
  }
  // The note taped to the sheet.
  const note = canvas(256, 160);
  {
    const ctx = note.getContext('2d');
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = 'rgba(200, 200, 160, 0.7)'; // tape
    ctx.fillRect(98, 0, 60, 16);
    drawType(ctx, 'BACK SOON', 128, 78, { role: 'marker', size: 44, fill: '#b8236f', maxWidth: 236 });
    drawType(ctx, '- Mgmt. (Do not lift sheet)', 128, 120, { role: 'note', size: 22, fill: '#5a4a40', maxWidth: 236 });
    drawSunny(ctx, 222, 138, 12);
  }
  art = {
    marquee: new THREE.MeshBasicMaterial({ map: texture(marquee) }),
    backdrop: new THREE.MeshBasicMaterial({ map: texture(backdrop) }),
    sunny: new THREE.MeshBasicMaterial({ map: texture(sunny), alphaTest: 0.5 }),
    cloth: new THREE.MeshStandardMaterial({ map: texture(cloth), roughness: 1 }),
    note: new THREE.MeshBasicMaterial({ map: texture(note) }),
  };
  return art;
}

/** The screen: a canvas redrawn only when the words change. Title, three lane lines (a capsule dot each, one highlighted) and a note. */
function createScreen() {
  const c = canvas(256, 192);
  const ctx = c.getContext('2d');
  const map = texture(c);
  let key = '';
  function show({ title = '', lines = [], dots = [], highlight = -1, note = '', tone = '#ffd6ec' }) {
    const next = JSON.stringify([title, lines, dots, highlight, note, tone]);
    if (next === key) return;
    key = next;
    ctx.fillStyle = '#1a0614';
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = '#ff4fa3';
    ctx.fillRect(0, 0, 256, 36); // the title bar
    ctx.fillStyle = 'rgba(255, 120, 200, 0.07)';
    for (let y = 36; y < 192; y += 4) ctx.fillRect(0, y, 256, 1); // scan lines
    drawType(ctx, title, 128, 19, { role: 'led', size: 28, fill: '#1a0614', maxWidth: 240 });
    lines.forEach((line, i) => {
      const y = 62 + i * 34;
      if (i === highlight) {
        ctx.fillStyle = tone;
        ctx.fillRect(8, y - 15, 240, 30);
      }
      if (dots[i] !== undefined && dots[i] !== null) {
        ctx.fillStyle = `#${dots[i].toString(16).padStart(6, '0')}`;
        ctx.beginPath(); ctx.arc(24, y, 9, 0, Math.PI * 2); ctx.fill();
      }
      drawType(ctx, line, dots[i] !== undefined && dots[i] !== null ? 138 : 128, y, { role: 'led', size: 28, fill: i === highlight ? '#1a0614' : tone, maxWidth: dots[i] !== undefined && dots[i] !== null ? 204 : 232 });
    });
    drawType(ctx, note, 128, 174, { role: 'led', size: 24, fill: '#ff9fd2', maxWidth: 240 });
    map.needsUpdate = true;
  }
  show({ title: clawMachine.name, lines: ['', 'EVERYONE\'S', 'A WINNER*'], note: '*Not everyone' });
  return { texture: map, show };
}

// Local (u along the wall, as seen from the front: + is the viewer's right; a out from the wall) to world x / z.
const FRAMES = {
  '+z': { x: (b, u) => b.x + u, z: (b, a) => b.z + a, normal: [0, 1], sign: 1, right: 'x+', left: 'x-' },
  '-z': { x: (b, u) => b.x - u, z: (b, a) => b.z - a, normal: [0, -1], sign: -1, right: 'x-', left: 'x+' },
  '+x': { x: (b, a) => b.x + a, z: (b, u) => b.z - u, normal: [1, 0], sign: 'x+', alongZ: true, right: -1, left: 1 },
  '-x': { x: (b, a) => b.x - a, z: (b, u) => b.z + u, normal: [-1, 0], sign: 'x-', alongZ: true, right: 1, left: -1 },
};
// A plane facing one of the four ways (kit.sign's rule: 1 = +z, -1 = -z, 'x+' / 'x-').
const ROTATION_Y = { 1: 0, '-1': Math.PI, 'x+': Math.PI / 2, 'x-': -Math.PI / 2 };

/**
 * Building against a wall in local coordinates (u along the wall, + = the viewer's right as they face it; a out from the wall; y up
 * from floorY), for any of the four facings, in world-space axis-aligned boxes (the coplanar test reads them as they are).
 * Shared by the claw cabinet and the Prize Counter booth (mall/prizeCounter.js).
 *   -> { frame, normal, wx, wz, world(u, y, a, out?), place(u0, y0, u1, y1, a0, a1, material, options), sign(text, u, y, a, options),
 *        picture(material, u, y, a, w, h, facing?, name?), collider(u0, y0, u1, y1, a0, a1) }
 */
export function wallFrame({ kit, back, faces = '+z', floorY = 0 }) {
  const frame = FRAMES[faces];
  if (!frame) throw new Error(`wall frame: unknown facing "${faces}"`);
  const wx = (u, a) => (frame.alongZ ? frame.x(back, a) : frame.x(back, u));
  const wz = (u, a) => (frame.alongZ ? frame.z(back, u) : frame.z(back, a));
  const world = (u, y, a, out = new THREE.Vector3()) => out.set(wx(u, a), floorY + y, wz(u, a));
  const bounds = (u0, a0, u1, a1) => {
    const xs = [wx(u0, a0), wx(u1, a1)];
    const zs = [wz(u0, a0), wz(u1, a1)];
    return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  };
  return {
    frame,
    normal: new THREE.Vector3(frame.normal[0], 0, frame.normal[1]),
    wx, wz, world,
    place(u0, y0, u1, y1, a0, a1, material, options = { collide: false }) {
      const [x0, z0, x1, z1] = bounds(u0, a0, u1, a1);
      return kit.box(x0, floorY + y0, z0, x1, floorY + y1, z1, material, options);
    },
    collider(u0, y0, u1, y1, a0, a1) {
      const [x0, z0, x1, z1] = bounds(u0, a0, u1, a1);
      return kit.addCollider(x0, floorY + y0, z0, x1, floorY + y1, z1);
    },
    sign: (text, u, y, a, options) => kit.sign(text, { x: wx(u, a), y: floorY + y, z: wz(u, a), facing: frame.sign, ...options }),
    // A flat picture (any material), facing `facing` (frame.sign = out of the front).
    picture(material, u, y, a, w, h, facing = frame.sign, name = 'wall_art') {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      world(u, y, a, mesh.position);
      mesh.rotation.y = ROTATION_Y[facing];
      mesh.name = name;
      kit.group.add(mesh);
      return mesh;
    },
  };
}

export function buildClawCabinet({ kit, back, faces = '+z', floorY = 0, spec = CLAW_CABINET }) {
  const { frame, normal, wx, wz, world, place, sign, picture: placePicture } = wallFrame({ kit, back, faces, floorY });
  const { width, depth, height } = clawMachine.cabinet;
  const { colors } = spec;
  const half = width / 2;
  const looks = cabinetArt();
  const picture = (material, u, y, a, w, h, facing = frame.sign, name = 'claw_art') => placePicture(material, u, y, a, w, h, facing, name);
  const solid = (hex, options = {}) => kit.mat(hex, { roughness: 0.55, flatShading: false, ...options });
  const glow = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const glass = new THREE.MeshStandardMaterial({ color: colors.glass, transparent: true, opacity: 0.15, roughness: 0.1 });

  // --- The one collider: the whole cabinet, 2.2 m tall (can't be stood on), its back just inside the wall ---
  {
    const xs = [wx(-half, -0.01), wx(half, depth)];
    const zs = [wz(-half, -0.01), wz(half, depth)];
    kit.addCollider(Math.min(...xs), floorY, Math.min(...zs), Math.max(...xs), floorY + height, Math.max(...zs));
  }

  // --- The base ---
  // (Every back face sits exactly on the wall's face, where the wall hides it; the kick plate's top clears skirting boards.)
  place(-half, 0.135, half, 0.86, 0, depth, solid(colors.body), { collide: false, name: 'claw_base' }); // (up to the chrome lip)
  place(-half - 0.02, 0, half + 0.02, 0.135, 0, depth + 0.02, solid(colors.chrome, { metalness: 0.6, roughness: 0.3 }));
  sign('*NOT EVERYONE. PRIZES NOT TO SCALE. THE CLAW IS DOING ITS BEST.', 0, 0.068, depth + 0.03,
    { width: 1.24, height: 0.07, background: '#1d1626', color: '#ff9fd2', font: 'officialBody' });
  place(-half - 0.005, 0.86, half + 0.005, 0.9, 0, depth + 0.005, solid(colors.chrome, { metalness: 0.6, roughness: 0.3 })); // chrome lip
  const screen = createScreen();
  place(-0.58, 0.5, 0.16, 0.84, depth, depth + 0.01, solid(colors.trim)); // bezel
  place(-0.55, 0.53, 0.13, 0.81, depth + 0.01, depth + 0.012, new THREE.MeshBasicMaterial({ map: screen.texture }));
  place(0.24, 0.54, 0.6, 0.84, depth, depth + 0.015, solid(colors.bodyDark)); // button panel
  sign('DROP!', 0.42, 0.805, depth + 0.025, { width: 0.2, height: 0.045, background: '#b8236f', color: '#fff3d6', font: 'arcade' });
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.05, 20), glow(colors.button));
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20), solid(colors.chrome, { metalness: 0.6, roughness: 0.3 }));
  for (const [mesh, out] of [[button, 0.04], [bezel, 0.022]]) {
    mesh.rotation.x = Math.PI / 2;
    if (frame.alongZ) mesh.rotation.z = Math.PI / 2;
    world(0.42, 0.68, depth + out, mesh.position);
    mesh.name = 'claw_button';
    kit.group.add(mesh);
  }
  // The coin door, right of the chute.
  place(0.15, 0.18, 0.58, 0.48, depth, depth + 0.012, solid(colors.coin));
  place(0.33, 0.36, 0.4, 0.42, depth + 0.012, depth + 0.02, solid(colors.chrome, { metalness: 0.6, roughness: 0.3 })); // coin slot plate
  sign('INSERT POINTS', 0.365, 0.25, depth + 0.02, { width: 0.36, height: 0.07, background: '#2b2233', color: '#ffe9a8', font: 'arcade' });
  // The prize chute: a dark mouth behind a hinged flap, and a tray sticking out where the won gun lands.
  const { u0: cu0, u1: cu1, y0: cy0, y1: cy1 } = spec.chute;
  place(cu0, cy0, cu1, cy1, depth, depth + 0.006, solid(colors.tray));
  place(cu0 - 0.02, cy0 - 0.02, cu1 + 0.02, cy0 + 0.02, depth, depth + 0.24, solid(colors.trim)); // tray floor
  place(cu0 - 0.02, cy0 + 0.02, cu1 + 0.02, cy0 + 0.09, depth + 0.21, depth + 0.24, solid(colors.bodyDark)); // the tray's front lip
  // Sunny on both sides of the base.
  for (const side of [-1, 1]) picture(looks.sunny, side * (half + 0.012), 0.5, depth * 0.55, 0.6, 0.6, side < 0 ? frame.left : frame.right, 'claw_sunny');

  // --- The glass case: back panel, a front post at each corner, glass on three sides, the pit, the rail and a lit strip ---
  place(-half, 0.9, half, 1.95, 0, 0.04, solid(colors.bodyDark)); // back
  place(-0.6, 0.95, 0.6, 1.9, 0.04, 0.05, looks.backdrop); // the printed backdrop
  for (const side of [-1, 1]) {
    place(side < 0 ? -half : half - 0.05, 0.9, side < 0 ? -half + 0.05 : half, 1.95, depth - 0.05, depth, solid(colors.chrome, { metalness: 0.6, roughness: 0.3 })); // front post
    place(side < 0 ? -half + 0.015 : half - 0.025, 0.9, side < 0 ? -half + 0.025 : half - 0.015, 1.95, 0.04, depth - 0.05, glass); // side glass
  }
  place(-half + 0.05, 0.9, half - 0.05, 1.95, depth - 0.035, depth - 0.025, glass); // front glass
  place(-0.6, 0.9, 0.6, spec.pitTop, 0.04, depth - 0.05, solid(colors.pit)); // pit floor
  for (const u of [-0.19, 0.19]) place(u - 0.01, spec.pitTop, u + 0.01, spec.pitTop + 0.08, 0.1, depth - 0.1, solid(colors.bodyDark)); // lane dividers
  place(-0.6, spec.railY, 0.6, spec.railY + 0.03, depth / 2 - 0.04, depth / 2 + 0.04, solid(colors.rail)); // the gantry rail
  place(-0.6, 1.925, 0.6, 1.94, 0.06, depth - 0.06, glow(colors.strip)); // a lit strip under the header (unlit glow, no real light)

  // --- The header: the marquee, the promise, and Sunny on top ---
  place(-half - 0.02, 1.95, half + 0.02, height, 0, depth + 0.03, solid(colors.trim));
  picture(looks.marquee, 0, 2.075, depth + 0.04, 1.26, 0.235, frame.sign, 'claw_marquee');
  sign('EVERYONE\'S A WINNER*', 0, 1.905, depth - 0.015, { width: 1.1, height: 0.08, background: '#ffc83d', color: '#b8236f', font: 'arcade' });
  const topper = spec.topper;
  picture(looks.sunny, 0, height + topper.lift + topper.size / 2, depth * 0.6, topper.size, topper.size, frame.sign, 'claw_topper');

  // --- The rig: what moves (the claw: carriage, cable, head, three prongs), the capsules, the chute flap and the dust sheet ---
  const rig = new THREE.Group();
  rig.name = 'claw_rig';
  rig.userData.dynamic = true; // (on the group: the static batcher leaves everything under it alone)
  kit.group.add(rig);
  const clawMaterial = solid(colors.claw, { metalness: 0.5, roughness: 0.35 });
  const mid = depth / 2;
  const add = (mesh, name) => { mesh.name = name; rig.add(mesh); return mesh; };
  const carriage = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12), clawMaterial), 'claw_part');
  const cable = add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), clawMaterial), 'claw_part'); // (scaled to the drop)
  const head = add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.06, 12), clawMaterial), 'claw_part');
  // Prongs hang from the head's rim; their geometry hangs from its top, so tilting one swings its tip outward.
  const prongGeometry = new THREE.CylinderGeometry(0.009, 0.013, 0.13, 6).translate(0, -0.065, 0);
  const prongs = [0, 1, 2].map((i) => ({ mesh: add(new THREE.Mesh(prongGeometry, clawMaterial), 'claw_part'), angle: (i / 3) * Math.PI * 2 + Math.PI / 6 }));
  const capsules = spec.laneU.map((u) => {
    const mesh = add(new THREE.Mesh(new THREE.SphereGeometry(spec.capsuleRadius, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })), 'claw_capsule');
    world(u, spec.pitTop + spec.capsuleRadius, mid, mesh.position);
    mesh.visible = false;
    return { mesh, u };
  });
  const clawParts = [carriage, cable, head, ...prongs.map((p) => p.mesh)];

  // The chute flap: hinged along its top edge, swinging out over the tray. (A plain centred box: setFlap moves its centre round
  // the hinge, so at rest it is exactly where it looks, for the coplanar test too.)
  const flapHeight = cy1 - cy0 - 0.02;
  const flap = add(new THREE.Mesh(new THREE.BoxGeometry(frame.alongZ ? 0.012 : cu1 - cu0 - 0.04, flapHeight, frame.alongZ ? cu1 - cu0 - 0.04 : 0.012),
    solid(colors.bodyDark)), 'claw_flap');
  const hinge = world((cu0 + cu1) / 2, cy1 - 0.01, depth + 0.014);
  // (Which way "out" is: the hinge axis runs along the wall; the sign makes the bottom edge swing away from it.)
  const flapAxis = frame.alongZ ? 'z' : 'x';
  const flapSign = { '+z': -1, '-z': 1, '+x': 1, '-x': -1 }[faces];
  const flapOffset = new THREE.Vector3();

  // The dust sheet (shown while the machine is at another site): cloth over the base and tray, and over the case and header,
  // so it keeps the machine's stepped shape; a note taped on. Sunny's topper sticks out above it, watching. Visual only.
  const sheet = [
    place(-half - 0.04, 0.035, half + 0.04, 0.97, 0, depth + 0.28, looks.cloth, { collide: false, name: 'claw_sheet' }),
    place(-half - 0.04, 0.97, half + 0.04, height + 0.05, 0, depth + 0.07, looks.cloth, { collide: false, name: 'claw_sheet' }),
    picture(looks.note, 0.1, 1.5, depth + 0.08, 0.56, 0.35, frame.sign, 'claw_note'),
  ];
  for (const mesh of sheet) rig.add(mesh); // (into the dynamic group: shown and hidden at runtime)

  let clawU = spec.laneU[0];
  let clawDrop = 0;
  let clawOpen = 0.3;
  let clawSway = 0;
  let carried = null;
  let live = true;
  const headY = (drop) => spec.clawUp - drop * (spec.clawUp - (spec.pitTop + 2 * spec.capsuleRadius + 0.05));

  function setClaw(u, drop, open = 0.3, sway = 0) {
    clawU = u;
    clawDrop = Math.max(0, Math.min(1, drop));
    clawOpen = Math.max(0, Math.min(1, open));
    clawSway = sway;
    const y = headY(clawDrop);
    world(u, spec.railY + 0.015, mid, carriage.position);
    const top = spec.railY - 0.02, bottom = y + 0.03;
    cable.scale.y = Math.max(0.01, top - bottom);
    world(u, (top + bottom) / 2, mid, cable.position);
    world(u, y, mid, head.position);
    const tilt = 0.18 + clawOpen * 0.6; // radians outward
    for (const { mesh, angle } of prongs) {
      // Spread evenly round the head in world space (the claw looks the same from every side).
      mesh.position.copy(head.position);
      mesh.position.x += Math.cos(angle) * 0.045;
      mesh.position.z += Math.sin(angle) * 0.045;
      mesh.position.y -= 0.025;
      mesh.rotation.set(-Math.sin(angle) * tilt, 0, Math.cos(angle) * tilt);
    }
    if (carried !== null) {
      world(u + sway, y - 0.09 - spec.capsuleRadius, mid + sway * 0.4, capsules[carried].mesh.position);
      capsules[carried].mesh.rotation.z = sway * 4;
    }
  }

  rig.userData.capsules = capsules.map((c) => c.mesh); // (tests)
  const api = {
    group: rig,
    laneU: spec.laneU,
    chuteU: spec.chuteU,
    flap,
    get clawU() { return clawU; },
    get clawDrop() { return clawDrop; },
    get clawOpen() { return clawOpen; },
    setCapsule(lane, color) {
      const { mesh, u } = capsules[lane];
      mesh.visible = live && color !== null && color !== undefined;
      if (color !== null && color !== undefined) mesh.material.color.setHex(color);
      if (carried !== lane) {
        world(u, spec.pitTop + spec.capsuleRadius, mid, mesh.position);
        mesh.rotation.set(0, 0, 0);
      }
    },
    carry(lane) {
      const was = carried;
      carried = lane;
      if (was !== null && was !== lane) {
        world(capsules[was].u, spec.pitTop + spec.capsuleRadius, mid, capsules[was].mesh.position);
        capsules[was].mesh.rotation.set(0, 0, 0);
      }
      setClaw(clawU, clawDrop, clawOpen, clawSway);
    },
    setClaw,
    setFlap(open) {
      const angle = Math.max(0, Math.min(1, open)) * 1.1;
      flap.rotation.set(0, 0, 0);
      flap.rotation[flapAxis] = flapSign * angle;
      flap.position.copy(hinge).add(flapOffset.set(0, -flapHeight / 2, 0).applyEuler(flap.rotation));
    },
    setLive(isLive) {
      live = isLive;
      for (const mesh of sheet) mesh.visible = !isLive;
      // Under the sheet, nothing moves and nothing needs drawing: the claw and its capsules hide with it.
      for (const mesh of clawParts) mesh.visible = isLive;
      for (const { mesh } of capsules) if (!isLive) mesh.visible = false;
    },
    get live() { return live; },
    chute: { position: world((cu0 + cu1) / 2, cy0 + 0.16, depth + 0.12, new THREE.Vector3()) /* resting on the tray, above its lip */, normal: normal.clone() },
    reset() {
      carried = null;
      capsules.forEach((_, lane) => api.setCapsule(lane, null));
      setClaw(spec.laneU[0], 0);
      api.setFlap(0);
    },
  };
  api.reset();

  // --- Where the player interacts: the middle of the glass front ---
  const position = world(0, 1.25, depth + 0.04);
  return { position, normal, screen, rig: api };
}
