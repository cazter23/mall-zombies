// =============================================================================
// RESTOCK-O-MATIC: the ammo machine (the map feature kind 'ammoCache', game/features/ammoCache.js). A big hot-orange
// vending machine against a wall, built to be spotted from across the room: a glowing header sign, a blade sign
// sticking out of the wall ("AMMO") that reads down the wall from both ways, a yellow-and-black hazard pad on the
// floor where you stand and a soft glow on the tiles around it. Its screen is live: the ammo feature writes the gun
// in your hand, its ammo and the price to it (screen.show). Decoration plus ONE solid collider (like the old vending
// machine, so it can't be climbed and nobody gets behind it); the pad and glow add no collision. Everything lights
// itself (unlit materials, no real lights, no flicker).
//
//   buildRestockMachine({ kit, center, wallAt, facing, floorY = 0 }) -> { position, normal, screen }
//     a machine on a wall that runs along X (north / south walls): center = its x, wallAt = the wall's z, facing = +1 / -1
//     (the way its front faces, along Z)
//     position / normal   the buy spot on its front and the outward direction (the interaction point)
//     screen.show({ title, line, note, tone })   redraws only when the words change
// =============================================================================

import * as THREE from 'three';

export const RESTOCK = {
  name: 'RESTOCK-O-MATIC',
  width: 1.7,
  depth: 0.85,
  height: 2.35,
  colors: {
    body: 0xff6a13, // hot orange (the stores are teal and pastel)
    bodyDark: 0xb83f06,
    trim: 0x1d1626,
    hazardYellow: '#ffd23f',
    hazardBlack: '#1d1626',
    glow: 0xffe6b0,
    glass: 0x2a1b12,
    metal: 0x5d636b,
    slot: 0x1b1b20,
    led: 0x39ff88,
    boxes: [0xd62839, 0x3a86ff, 0xffd23f, 0x58c46b, 0xf2f2f2, 0x9b6bff], // boxes of rounds in the window
  },
};

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const srgb = (texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** Diagonal yellow / black warning stripes, tileable. */
function hazardTexture() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = RESTOCK.colors.hazardYellow;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = RESTOCK.colors.hazardBlack;
  for (let i = -2; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 64, 128);
    ctx.lineTo(i * 64 + 32, 128);
    ctx.lineTo(i * 64 + 32 + 128, 0);
    ctx.lineTo(i * 64 + 128, 0);
    ctx.closePath();
    ctx.fill();
  }
  const texture = srgb(new THREE.CanvasTexture(c));
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** A soft warm radial glow (transparent edges), for the light pool on the floor. */
function glowTexture() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 150, 60, 0.85)');
  gradient.addColorStop(0.5, 'rgba(255, 120, 40, 0.32)');
  gradient.addColorStop(1, 'rgba(255, 100, 30, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return srgb(new THREE.CanvasTexture(c));
}

/** The live LCD: a canvas redrawn only when the words change. */
function createScreen() {
  const c = canvas(256, 160);
  const ctx = c.getContext('2d');
  const texture = srgb(new THREE.CanvasTexture(c));
  let key = '';
  function show({ title = '', line = '', note = '', tone = '#7dffb0' }) {
    const next = `${title}|${line}|${note}|${tone}`;
    if (next === key) return;
    key = next;
    ctx.fillStyle = '#06140d';
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = 'rgba(125, 255, 176, 0.07)';
    for (let y = 0; y < 160; y += 4) ctx.fillRect(0, y, 256, 1); // scan lines
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9ef0b5';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(title, 128, 24, 240);
    ctx.fillStyle = tone;
    ctx.font = 'bold 44px monospace';
    ctx.fillText(line, 128, 78, 240);
    ctx.fillStyle = '#9ef0b5';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(note, 128, 130, 240);
    texture.needsUpdate = true;
  }
  show({ title: 'RESTOCK-O-MATIC', line: 'AMMO', note: 'PLEASE HOLD F' });
  return { texture, show };
}

export function buildRestockMachine({ kit, center, wallAt, facing, floorY = 0, spec = RESTOCK }) {
  const { width, depth, height, colors } = spec;
  const solid = (hex, options = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, ...options });
  const glow = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const d = (offset) => wallAt + facing * offset;
  // u = x along the wall, a..b = z away from it
  const place = (u0, y0, u1, y1, a, b, material, options = { collide: false }) =>
    kit.box(u0, floorY + y0, Math.min(a, b), u1, floorY + y1, Math.max(a, b), material, options);
  const sign = (text, options) => kit.sign(text, { ...options, y: floorY + options.y });
  const signAt = (u, y, offset) => ({ x: u, y, z: d(offset), facing }); // a sign on the front, facing out
  const u0 = center - width / 2;
  const u1 = center + width / 2;
  const hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7 });
  hazard.map.repeat.set(width / 0.5, 1);

  // --- The solid body (the only collider), a darker base plinth, a cap that overhangs ---
  place(u0, 0, u1, height - 0.02, d(-.01), d(depth), solid(colors.body), { collide: true, name: 'restock_body' }); // Recess the back behind the trim to avoid shared faces.
  place(u0 - 0.03, 0, u1 + 0.03, 0.22, d(0), d(depth + 0.03), hazard); // hazard kick-plate across the bottom
  place(u0 - 0.05, height - 0.34, u1 + 0.05, height, d(0), d(depth + 0.06), solid(colors.trim)); // the cap
  place(u0 - 0.06, height - 0.36, u1 + 0.06, height - 0.34, d(0), d(depth + 0.07), glow(colors.glow)); // glowing edge under the cap
  for (const side of [u0 - 0.012, u1]) place(side, 0.22, side + 0.012, height - 0.34, d(0.04), d(depth - 0.04), solid(colors.bodyDark)); // side panels

  // --- Header: the big glowing name, then a tagline strip ---
  const header = { y: height - 0.17, width: width - 0.14, height: 0.26 };
  sign(spec.name, { ...signAt(center, header.y, depth + 0.075), width: header.width, height: header.height, background: '#1d1626', color: '#ffe14d' });
  sign('AMMO  ·  REFILLS  ·  NO QUESTIONS', { ...signAt(center, height - 0.41, depth + 0.03), width: width - 0.14, height: 0.13, background: '#b83f06', color: '#fff3d6' });

  // --- Window: lit, with shelves of boxes of rounds ---
  const winU0 = u0 + 0.1;
  const winU1 = u0 + width * 0.6;
  place(winU0 - 0.04, 0.48, winU1 + 0.04, 1.86, d(depth), d(depth + 0.012), solid(colors.trim)); // frame
  place(winU0, 0.52, winU1, 1.82, d(depth + 0.012), d(depth + 0.025), glow(colors.glow)); // the lit back wall
  const shelf = solid(colors.metal);
  let boxIndex = 0;
  for (let row = 0; row < 4; row++) {
    const y = 0.6 + row * 0.3;
    place(winU0, y + 0.19, winU1, y + 0.215, d(depth + 0.025), d(depth + 0.2), shelf);
    const count = 4;
    const each = (winU1 - winU0 - 0.1) / count;
    for (let i = 0; i < count; i++) {
      const color = colors.boxes[boxIndex++ % colors.boxes.length];
      const h = 0.15 + ((i + row) % 3) * 0.015;
      place(winU0 + 0.06 + i * each, y + 0.215 - 0.025 + 0.025, winU0 + 0.06 + (i + 0.82) * each, y + 0.215 + h, d(depth + 0.04), d(depth + 0.14), solid(color, { roughness: 0.6 }));
    }
  }

  // --- Control column: live screen, keypad, card reader, coin slot, delivery chute ---
  const colU0 = u0 + width * 0.66;
  const colU1 = u1 - 0.08;
  const colMid = (colU0 + colU1) / 2;
  const screen = createScreen();
  place(colU0 - 0.03, 1.5, colU1 + 0.03, 1.87, d(depth), d(depth + 0.02), solid(colors.trim)); // screen bezel
  place(colU0, 1.53, colU1, 1.84, d(depth + 0.02), d(depth + 0.022), new THREE.MeshBasicMaterial({ map: screen.texture }));
  place(colU0, 0.98, colU1, 1.44, d(depth), d(depth + 0.02), solid(colors.trim)); // keypad panel
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const w = (colU1 - colU0 - 0.08) / 3;
      const ku = colU0 + 0.04 + c * w + 0.01;
      place(ku, 1.02 + r * 0.1, ku + w - 0.03, 1.02 + r * 0.1 + 0.07, d(depth + 0.02), d(depth + 0.04), solid(colors.metal));
    }
  }
  place(colU0, 0.84, colU1, 0.94, d(depth), d(depth + 0.025), solid(colors.trim)); // card reader
  place(colU0 + 0.05, 0.88, colU0 + 0.11, 0.9, d(depth + 0.025), d(depth + 0.03), glow(colors.led)); // its green LED
  place(colU0 + 0.16, 0.885, colU1 - 0.04, 0.895, d(depth + 0.025), d(depth + 0.03), solid(colors.slot)); // card slot
  place(colU0, 0.62, colU1, 0.78, d(depth), d(depth + 0.02), hazard); // striped coin-return plate
  place(u0 + 0.14, 0.14, u1 - 0.12, 0.4, d(depth), d(depth + 0.05), solid(colors.slot)); // delivery chute...
  place(u0 + 0.14, 0.4, u1 - 0.12, 0.43, d(depth + 0.05), d(depth + 0.06), glow(colors.glow)); // ...with a lit lip

  // --- Side signs, so it reads when you walk past along the wall ---
  sign('AMMO', { x: u0 - 0.025, y: 1.5, z: d(depth / 2), facing: 'x-', width: depth - 0.1, height: 0.5, background: '#b83f06', color: '#fff3d6' });
  sign('AMMO', { x: u1 + 0.025, y: 1.5, z: d(depth / 2), facing: 'x+', width: depth - 0.1, height: 0.5, background: '#b83f06', color: '#fff3d6' });

  // --- The blade sign: a double-sided glowing "AMMO" arm sticking out of the wall above the machine ---
  const bladeY = height + 0.95;
  const bladeLen = 1.15;
  const bladeCenter = d(0.1 + bladeLen / 2);
  place(center - 0.03, bladeY - 0.05, center + 0.03, bladeY + 0.02, d(0), d(0.1 + bladeLen), solid(colors.trim)); // the arm
  place(center - 0.02, bladeY - 0.6, center + 0.02, bladeY - 0.05, d(0.1), d(0.14), solid(colors.trim)); // wall bracket
  place(center - 0.02, bladeY - 0.6, center + 0.02, bladeY - 0.56, d(0.1), d(0.1 + bladeLen), solid(colors.trim)); // bottom rail
  for (const faceSide of [-1, 1]) {
    sign('AMMO ▸ ▸', {
      x: center + faceSide * 0.035, y: bladeY - 0.3, z: bladeCenter, facing: faceSide < 0 ? 'x-' : 'x+',
      width: bladeLen - 0.1, height: 0.46, background: '#ff6a13', color: '#1d1626',
    });
  }

  // --- The floor: a hazard-striped stand pad (no collision, 2.5 cm high) and a warm light pool around it ---
  const pad = { u0: center - width / 2 - 0.1, u1: center + width / 2 + 0.1, a: d(depth + 0.12), b: d(depth + 1.12) };
  const padMaterial = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.8 });
  padMaterial.map.repeat.set((pad.u1 - pad.u0) / 0.5, 1);
  place(pad.u0, 0, pad.u1, 0.025, pad.a, pad.b, padMaterial, { collide: false, name: 'restock_pad' });
  place(pad.u0 + 0.12, 0.04, pad.u1 - 0.12, 0.045, pad.a + 0.12 * facing, pad.b - 0.12 * facing, solid(0x2a2a30)); // dark inner mat, above decorative floor inlays
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 2.6, depth + 3.2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(center, floorY + 0.004, d(depth / 2 + 0.7));
  pool.name = 'restock_glow';
  pool.renderOrder = 1;
  kit.group.add(pool);

  // --- Where the player buys: on the keypad column, just in front of the machine ---
  const front = d(depth + 0.04);
  const position = new THREE.Vector3(colMid, floorY + 1.3, front);
  const normal = new THREE.Vector3(0, 0, facing);
  return { position, normal, screen };
}
