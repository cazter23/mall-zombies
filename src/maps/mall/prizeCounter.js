// =============================================================================
// THE PRIZE COUNTER's BOOTH ("REDEMPTION"; the feature: game/features/prizeCounter.js; numbers in config/clawMachine.js prizeCounter).
// A fixed booth against a wall where GRAB-A-GUN's prize tickets buy small things: a counter with five prize cards behind the glass
// and a ticket price tag under each, a wall of unclaimable plush behind, and a bored teenage animatronic in a staff polo and cap,
// chewing gum, who does not look up. ONE solid collider (2.3 m, so it can't be stood on), never moved. Unlit like the claw
// cabinet (no real lights, nothing blinks); the canvas art is drawn once.
//
//   buildPrizeCounter({ kit, back, faces, floorY }) -> { position, normal, slots: [{ id, position }] }
//     slots   one interaction point per prize, left to right as you face it (config order), on the counter's front edge
// =============================================================================

import * as THREE from 'three';
import { clawMachine } from '../../config/clawMachine.js';
import { wallFrame, drawSunny } from './clawCabinet.js';
import { drawType } from '../../world/typeKit.js';

const PRIZE_BOOTH = {
  colors: {
    body: 0x6b3fa0, // grape (the claw is hot pink, the RESTOCK-O-MATIC orange)
    bodyDark: 0x45246e,
    top: 0xfff1c9,
    chrome: 0xc9ccd4,
    trim: 0x1d1626,
    glass: 0xbfe8ff,
    polo: 0x2fb7a8, // the staff polo
    skin: 0xf0c8a0,
    cap: 0xff4fa3,
    gum: 0xff8fc7,
  },
  slotSpacing: 0.52, // between prize cards
  topY: 1.0, // the counter top
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

// The five prize cards' pictures, drawn once.
const ICONS = {
  ammo(ctx) { // a box of rounds
    ctx.fillStyle = '#ff6a13'; ctx.fillRect(40, 60, 96, 70);
    ctx.fillStyle = '#ffe14d'; ctx.fillRect(40, 84, 96, 20);
    drawType(ctx, 'AMMO', 88, 101, { role: 'toyBody', size: 20, fill: '#1d1626', maxWidth: 90 });
  },
  slowClaw(ctx) { // a claw riding a snail
    ctx.fillStyle = '#9b6bff'; ctx.beginPath(); ctx.arc(100, 100, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd6ec'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(100, 100, 16, 0, Math.PI * 1.6); ctx.stroke();
    ctx.fillStyle = '#58c46b'; ctx.fillRect(40, 118, 90, 14); ctx.beginPath(); ctx.arc(46, 112, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(100, 40); ctx.lineTo(100, 62); ctx.moveTo(88, 76); ctx.lineTo(100, 62); ctx.lineTo(112, 76); ctx.stroke();
  },
  attachment(ctx) { // a gift box with a bow
    ctx.fillStyle = '#3a86ff'; ctx.fillRect(48, 70, 80, 60);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(82, 70, 12, 60); ctx.fillRect(48, 94, 80, 12);
    ctx.beginPath(); ctx.ellipse(76, 62, 16, 9, -0.4, 0, Math.PI * 2); ctx.ellipse(100, 62, 16, 9, 0.4, 0, Math.PI * 2); ctx.fill();
  },
  freeGrab(ctx) { // a gold token
    ctx.fillStyle = '#ffc83d'; ctx.beginPath(); ctx.arc(88, 96, 40, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d98a00'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(88, 96, 32, 0, Math.PI * 2); ctx.stroke();
    drawType(ctx, 'FREE', 88, 104, { role: 'arcade', size: 22, fill: '#b8236f', maxWidth: 56 });
  },
  keychain(ctx) { // Sunny on a ring
    ctx.strokeStyle = '#c9ccd4'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(88, 44, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(88, 58); ctx.lineTo(88, 68); ctx.stroke();
    drawSunny(ctx, 88, 104, 28);
  },
};

let art = null;
function boothArt() {
  if (art) return art;
  const card = (id, name) => {
    const c = canvas(176, 176);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff6e0'; ctx.fillRect(0, 0, 176, 176);
    ctx.strokeStyle = '#6b3fa0'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 170, 170);
    ICONS[id](ctx);
    drawType(ctx, name.toUpperCase(), 88, 160, { role: 'toyBody', size: 17, fill: '#45246e', maxWidth: 160 });
    return new THREE.MeshBasicMaterial({ map: texture(c) });
  };
  // The header: "REDEMPTION" in tickets-orange on grape, a strip of ticket stubs under it.
  const header = canvas(512, 80);
  {
    const ctx = header.getContext('2d');
    ctx.fillStyle = '#45246e'; ctx.fillRect(0, 0, 512, 80);
    for (let x = 4; x < 512; x += 24) { ctx.fillStyle = x % 48 < 24 ? '#ffc83d' : '#ff9fd2'; ctx.fillRect(x, 66, 18, 10); }
    drawType(ctx, clawMachine.prizeCounter.name, 256, 34, { role: 'toyBrand', size: 50, fill: '#ffc83d', maxWidth: 480, outline: { color: '#1d1626', width: 0.12 } });
  }
  // The wall of prizes nobody can afford: shelves of plush suns, ducks and teddies.
  const shelves = canvas(512, 192);
  {
    const ctx = shelves.getContext('2d');
    ctx.fillStyle = '#ffe3f1'; ctx.fillRect(0, 0, 512, 192);
    for (let row = 0; row < 3; row++) {
      const y = 56 + row * 64;
      ctx.fillStyle = '#b8236f'; ctx.fillRect(0, y, 512, 6);
      for (let i = 0; i < 9; i++) {
        const x = 30 + i * 56 + (row % 2) * 20;
        const kind = (i + row) % 3;
        if (kind === 0) drawSunny(ctx, x, y - 20, 13);
        else {
          ctx.fillStyle = kind === 1 ? '#ffd23f' : '#c28a5a';
          ctx.beginPath(); ctx.arc(x, y - 18, 16, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y - 38, 11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1d1626'; ctx.beginPath(); ctx.arc(x + 4, y - 40, 2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    drawType(ctx, 'DISPLAY ONLY', 506, 16, { role: 'official', size: 15, fill: '#45246e', align: 'right', maxWidth: 200 });
  }
  // The teen's face: eyelids at half mast, a flat mouth, a gum bubble on its way.
  const face = canvas(128, 128);
  {
    const ctx = face.getContext('2d');
    ctx.fillStyle = '#f0c8a0'; ctx.fillRect(0, 0, 128, 128);
    for (const x of [40, 88]) {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, 52, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b2a20'; ctx.beginPath(); ctx.arc(x, 56, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d9a982'; ctx.fillRect(x - 15, 40, 30, 12); // the eyelid, half down
      ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 14, 52); ctx.lineTo(x + 14, 52); ctx.stroke();
    }
    ctx.strokeStyle = '#8a4b3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(46, 94); ctx.lineTo(74, 92); ctx.stroke();
  }
  art = {
    cards: Object.fromEntries(clawMachine.prizeCounter.prizes.map((p) => [p.id, card(p.id, p.name)])),
    header: new THREE.MeshBasicMaterial({ map: texture(header) }),
    shelves: new THREE.MeshBasicMaterial({ map: texture(shelves) }),
    face: new THREE.MeshBasicMaterial({ map: texture(face) }),
  };
  return art;
}

export function buildPrizeCounter({ kit, back, faces = '+z', floorY = 0, spec = PRIZE_BOOTH }) {
  const { frame, normal, world, place, sign, picture, collider } = wallFrame({ kit, back, faces, floorY });
  const { width, depth, height } = clawMachine.prizeCounter.size;
  const { colors, topY } = spec;
  const half = width / 2;
  const looks = boothArt();
  const solid = (hex, options = {}) => kit.mat(hex, { roughness: 0.6, flatShading: false, ...options });
  const chrome = solid(colors.chrome, { metalness: 0.6, roughness: 0.3 });

  // --- The one collider: the whole booth, 2.3 m (can't be stood on), its back just inside the wall ---
  collider(-half, 0, half, height, -0.01, depth);

  // --- The counter: body, chrome kick plate, a cream top that overhangs, a price tag under each prize ---
  place(-half, 0.135, half, topY, 0, depth, solid(colors.body), { collide: false, name: 'prize_counter' });
  place(-half - 0.02, 0, half + 0.02, 0.135, 0, depth + 0.02, chrome);
  place(-half - 0.03, topY, half + 0.03, topY + 0.05, 0, depth + 0.06, solid(colors.top));
  const prizes = clawMachine.prizeCounter.prizes;
  const slotU = (i) => (i - (prizes.length - 1) / 2) * spec.slotSpacing;
  prizes.forEach((prize, i) => {
    sign(`${prize.tickets} TICKETS`, slotU(i), 0.72, depth + 0.012,
      { width: 0.44, height: 0.16, background: '#ffc83d', color: '#45246e', font: 'priceTag' });
    picture(looks.cards[prize.id], slotU(i), topY + 0.24, depth - 0.2, 0.34, 0.34, frame.sign, 'prize_card');
    place(slotU(i) - 0.1, topY + 0.05, slotU(i) + 0.1, topY + 0.07, depth - 0.3, depth - 0.1, solid(colors.bodyDark)); // its little stand
  });
  sign('ALL PRIZES FINAL. TICKETS HAVE NO CASH VALUE. OR ANY VALUE.', 0, 0.36, depth + 0.012,
    { width: 2.3, height: 0.09, background: '#45246e', color: '#ffe3f1', font: 'officialBody' });

  // --- Behind the glass: the prize wall, posts, glass, and the teen ---
  place(-half, topY + 0.05, half, 2.05, 0, 0.08, solid(colors.bodyDark)); // back panel (thick enough to cover the wall's own trim)
  picture(looks.shelves, 0, 1.55, 0.09, width - 0.12, 0.92, frame.sign, 'prize_shelves');
  for (const side of [-1, 1]) place(side < 0 ? -half : half - 0.05, topY + 0.05, side < 0 ? -half + 0.05 : half, 2.05, depth - 0.05, depth, chrome);
  place(-half + 0.05, topY + 0.05, half - 0.05, 2.05, depth - 0.035, depth - 0.025,
    new THREE.MeshStandardMaterial({ color: colors.glass, transparent: true, opacity: 0.14, roughness: 0.1 }));
  // The animatronic (static: it has not moved since the mall opened): torso, arms on the counter, head propped on a hand, cap, gum.
  const tu = 0.78; // where along the counter it stands (to the right, so it never blocks a prize card)
  place(tu - 0.17, topY + 0.05, tu + 0.17, topY + 0.5, 0.22, 0.42, solid(colors.polo), { collide: false, name: 'prize_teen' }); // torso
  place(tu - 0.24, topY + 0.07, tu - 0.17, topY + 0.13, 0.3, 0.62, solid(colors.polo)); // left arm, on the counter
  place(tu + 0.17, topY + 0.07, tu + 0.24, topY + 0.38, 0.3, 0.38, solid(colors.skin)); // right forearm, propping the head
  place(tu - 0.1, topY + 0.5, tu + 0.1, topY + 0.74, 0.21, 0.43, solid(colors.skin), { collide: false, name: 'prize_teen' }); // head
  picture(looks.face, tu, topY + 0.62, 0.435, 0.19, 0.22, frame.sign, 'prize_teen_face');
  place(tu - 0.115, topY + 0.74, tu + 0.115, topY + 0.8, 0.2, 0.44, solid(colors.cap)); // cap
  place(tu - 0.09, topY + 0.745, tu + 0.09, topY + 0.765, 0.44, 0.55, solid(colors.cap)); // its brim
  const gum = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), solid(colors.gum));
  world(tu + 0.03, topY + 0.55, 0.48, gum.position);
  gum.name = 'prize_teen_gum';
  kit.group.add(gum);
  sign('NOW SERVING: NOBODY', tu, 1.92, depth - 0.015, { width: 0.6, height: 0.09, background: '#1d1626', color: '#7dffb0', font: 'led' });

  // --- The header ---
  place(-half - 0.03, 2.05, half + 0.03, height, 0, depth + 0.04, solid(colors.trim));
  picture(looks.header, 0, 2.175, depth + 0.05, width - 0.06, 0.22, frame.sign, 'prize_header');

  // --- One interaction point per prize, on the counter's front edge ---
  const slots = prizes.map((prize, i) => ({ id: prize.id, position: world(slotU(i), topY + 0.1, depth + 0.09) }));
  return { position: world(0, topY + 0.1, depth + 0.09), normal, slots };
}
