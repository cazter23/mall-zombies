// =============================================================================
// SET PIECES (visual overhaul step 6): one signature scene per area, built from boxes and canvas textures (no image files).
//   hallway     a bank of dead arcade cabinets at the west end of the south wall, one still running its attract mode
//   startRoom   a wall of CRT TVs on the back wall: static, and two that keep looping the store's last SALE ad
//   megaMart    a collapsed PYRAMID OF SAVINGS: cans spilled across the back walkway's east corner (no collision)
//   level2      a mannequin display in the Promenade's south-east corner: one faces the wall, one has lost its head
// Each solid set piece is ONE collider, too tall to climb, placed off the routes, spawns and buy spots (tests/setPieces.test.js).
// Animated parts (screens, the attract mode) are in groups flagged userData.dynamic so static batching leaves them alone;
// they follow Graphics > Dust and flickering lights (atmosphere.ambient.enabled): off = the screens hold still.
//
// buildSetPieces({ kit, layout, floorY }) -> { update(dt), reset(), parts }   (floorY = level 2's floor height)
// =============================================================================

import * as THREE from 'three';
import { atmosphere } from '../../config/environment.js';
import { seededRandom } from '../../world/textures.js';
import { drawType } from '../../world/typeKit.js';

// Where they go (data, so moving one is one line). Footprints are x0, z0, x1, z1.
export const SET_PIECES = {
  arcade: { x0: -19.7, x1: -16.6, wallZ: -2, facing: 1, depth: 0.85, height: 1.9 }, // the hallway's south wall, west end (under a banner)
  tvWall: { x0: -1.9, x1: 1.9, wallZ: 16, depth: 0.7 }, // the start room's back wall, under EVERYTHING MUST GO
  pyramid: { x0: 33.05, x1: 33.95, z0: -22.6, z1: -19.9 }, // the Mega Mart's back walkway, east corner
  mannequins: { x0: 17.5, x1: 19.6, z0: -1.95, z1: -0.85 }, // level 2's south-east corner
};

// ---- canvas textures -------------------------------------------------------------------------------------------------------

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// TV static: grey noise with faint horizontal banding. One image; each screen shows a different window of it.
function makeStaticTexture() {
  const c = canvas(128, 96);
  const g = c.getContext('2d');
  const rand = seededRandom(77);
  for (let y = 0; y < 96; y++) {
    const band = 0.85 + 0.15 * Math.sin(y * 0.7);
    for (let x = 0; x < 128; x++) {
      const v = Math.floor(255 * band * (0.25 + 0.75 * rand()));
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.5, 0.5);
  t.magFilter = THREE.NearestFilter;
  return t;
}

// The store's last ad, two frames: SALE! / EVERYTHING MUST GO.
function makeAdTexture(frame) {
  const c = canvas(128, 96);
  const g = c.getContext('2d');
  g.fillStyle = frame ? '#1d3a8a' : '#c8102e';
  g.fillRect(0, 0, 128, 96);
  if (frame) {
    drawType(g, 'EVERYTHING', 64, 36, { role: 'clearance', size: 28, fill: '#ffd23f', maxWidth: 116 });
    drawType(g, 'MUST GO', 64, 64, { role: 'clearance', size: 28, fill: '#ffd23f', maxWidth: 116 });
  } else {
    drawType(g, 'SALE!', 64, 42, { role: 'clearance', size: 56, fill: '#ffffff', maxWidth: 116 });
    drawType(g, '70% OFF FOREVER', 64, 78, { role: 'wayfinding', size: 16, fill: '#ffffff', maxWidth: 116 });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSetPieces({ kit, layout, floorY }) {
  const { box, mat, sign, addCollider } = kit;
  const animated = new THREE.Group();
  animated.name = 'setpiece_animated';
  animated.userData.dynamic = true;
  kit.group.add(animated);
  const ticking = []; // (dt) => void
  const resets = [];
  const parts = {};

  // A box in the animated group (kit.box puts everything in the map group; these must stay out of static batching).
  const liveBox = (x0, y0, z0, x1, y1, z1, material, name) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.name = name;
    animated.add(m);
    return m;
  };
  const liveMat = (options) => {
    const m = new THREE.MeshBasicMaterial(options);
    m.userData.animated = true;
    return m;
  };

  // --- Hallway: dead arcade cabinets ---------------------------------------------------------------------------------------
  {
    const A = SET_PIECES.arcade;
    const f = A.facing; // +1: the wall is at wallZ and the cabinets face +z (into the hallway)
    const at = (a) => A.wallZ + f * a; // a point `a` metres out from the wall
    const span = (a0, a1) => [Math.min(at(a0), at(a1)), Math.max(at(a0), at(a1))];
    const zBox = (x0, y0, a0, x1, y1, a1, material, opts = {}) => {
      const [z0, z1] = span(a0, a1);
      return box(x0, y0, z0, x1, y1, z1, material, { collide: false, ...opts });
    };
    const [c0, c1] = span(0, A.depth);
    addCollider(A.x0, 0, c0, A.x1, A.height, c1).name = 'setpiece_arcade';
    const games = [
      { name: 'PAC-SHOPPER', body: 0x2b2f8f, art: '#ffd23f' },
      { name: 'GALAXY RAIDERS', body: 0x1f1f24, art: '#22e8ff' },
      { name: 'STREET MALL II', body: 0x8f1f3a, art: '#ff7a1f' },
      { name: 'OUT OF ORDER', body: 0x3a3a40, art: '#ff2fa8' },
    ];
    const w = (A.x1 - A.x0) / games.length;
    const d = A.depth;
    const dark = mat(0x0c0d10, { roughness: 0.2 });
    const panel = mat(0x26262c);
    const coin = mat(0xb9a15a, { metalness: 0.6, roughness: 0.35 });
    const red = mat(0xe0352b);
    games.forEach((game, i) => {
      const x0 = A.x0 + i * w + 0.02;
      const x1 = x0 + w - 0.04;
      const cx = (x0 + x1) / 2;
      zBox(x0, 0, 0.02, x1, A.height, d - 0.1, mat(game.body), { name: 'arcade_cabinet' });
      zBox(x0 + 0.04, 0.95, d - 0.35, x1 - 0.04, 1.02, d, panel, { name: 'arcade_controls' }); // control deck
      zBox(cx - 0.1, 1.02, d - 0.15, cx - 0.07, 1.12, d - 0.12, dark); // joystick
      for (const dx of [0.03, 0.1]) zBox(cx + dx, 1.02, d - 0.16, cx + dx + 0.04, 1.04, d - 0.12, red);
      zBox(cx - 0.08, 0.45, d - 0.1, cx + 0.08, 0.62, d - 0.09, coin, { name: 'arcade_coin_door' });
      sign(game.name, { x: cx, y: A.height - 0.14, z: at(d - 0.09), width: w - 0.1, height: 0.2, facing: f, background: '#0c0d10', color: game.art, font: 'arcade' });
      if (i === 1) {
        // GALAXY RAIDERS still runs its attract mode: the screen cycles colours (in the animated group).
        const screen = liveMat({ color: 0x22e8ff, toneMapped: false });
        const [z0, z1] = span(d - 0.1, d - 0.09);
        liveBox(x0 + 0.07, 1.18, z0, x1 - 0.07, 1.55, z1, screen, 'arcade_attract_screen');
        let t = 0;
        const hsl = { h: 0, s: 0, l: 0 };
        screen.color.getHSL(hsl);
        ticking.push((dt) => {
          t += dt;
          screen.color.setHSL((hsl.h + t * 0.08) % 1, 0.9, 0.35 + 0.15 * (Math.sin(t * 9) > 0.7 ? 1 : 0));
        });
        resets.push(() => { t = 0; screen.color.setHSL(hsl.h, hsl.s, hsl.l); });
      } else {
        zBox(x0 + 0.07, 1.18, d - 0.1, x1 - 0.07, 1.55, d - 0.09, dark, { name: 'arcade_dead_screen' });
      }
      if (game.name === 'OUT OF ORDER') { // taped across
        const tape = mat(0xf2c230);
        zBox(x0, 1.3, d - 0.085, x1, 1.36, d - 0.075, tape).rotation.z = 0.25;
        zBox(x0, 1.3, d - 0.09, x1, 1.36, d - 0.08, tape).rotation.z = -0.25;
      }
    });
    parts.arcade = { collider: [A.x0, c0, A.x1, c1] };
  }

  // --- Start room: the CRT TV wall -----------------------------------------------------------------------------------------
  {
    const T = SET_PIECES.tvWall;
    const front = T.wallZ - T.depth;
    const standTop = 0.45;
    addCollider(T.x0, 0, front, T.x1, 1.95, T.wallZ).name = 'setpiece_tv_wall';
    box(T.x0, 0, front, T.x1, standTop, T.wallZ - 0.01, mat(0x3b2a20), { collide: false, name: 'tv_stand' });
    const staticTexture = makeStaticTexture();
    const ads = [makeAdTexture(0), makeAdTexture(1)];
    const cols = 4;
    const rows = 3;
    const cw = (T.x1 - T.x0) / cols;
    const rh = 0.5;
    const shell = [mat(0x2a2a2e), mat(0x6b5a48), mat(0x3a3530)];
    const screens = [];
    const rand = seededRandom(31);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = T.x0 + c * cw + 0.03;
        const x1 = x0 + cw - 0.06;
        const y0 = standTop + r * rh + 0.02;
        const y1 = y0 + rh - 0.04;
        const z0 = front + 0.05 + rand() * 0.08; // a slightly uneven stack
        box(x0, y0, z0, x1, y1, T.wallZ - 0.02, shell[(r + c) % shell.length], { collide: false, name: 'tv_shell' });
        const texture = staticTexture.clone();
        texture.offset.set(rand(), rand());
        const material = liveMat({ map: texture, color: 0xdfe8ee });
        liveBox(x0 + 0.06, y0 + 0.06, z0 - 0.01, x1 - 0.06, y1 - 0.08, z0, material, 'tv_screen');
        const dead = r === 2 && c === 0; // one set has died for good
        if (dead) { material.map = null; material.color.set(0x0b0c0e); }
        screens.push({ material, texture, dead, ad: (r === 1 && (c === 1 || c === 2)) });
      }
    }
    let t = 0;
    let frameTimer = 0;
    ticking.push((dt) => {
      t += dt;
      frameTimer -= dt;
      if (frameTimer > 0) return;
      frameTimer = 1 / 15; // static at 15 fps
      const adOn = (t % 7) < 4; // the ad plays 4 s out of every 7, then dissolves into static
      const adFrame = Math.floor(t / 1.2) % 2;
      for (const s of screens) {
        if (s.dead) continue;
        if (s.ad && adOn) {
          s.material.map = ads[adFrame];
        } else {
          s.material.map = s.texture;
          s.texture.offset.set(Math.random(), Math.random());
        }
      }
    });
    resets.push(() => { t = 0; frameTimer = 0; });
    parts.tvWall = { screens, collider: [T.x0, front, T.x1, T.wallZ] };
  }

  // --- Mega Mart: the collapsed PYRAMID OF SAVINGS (decoration only: low cans in a corner strip, no collision) ----------------
  {
    const P = SET_PIECES.pyramid;
    const can = new THREE.CylinderGeometry(0.055, 0.055, 0.13, 10);
    const labels = [mat(0xc8102e), mat(0xffd23f), mat(0x2f6fb5), mat(0x3aa35b)];
    const rand = seededRandom(19);
    const cans = new THREE.Group();
    cans.name = 'setpiece_pyramid';
    kit.group.add(cans);
    const put = (x, y, z, rx, rz, i) => {
      const m = new THREE.Mesh(can, labels[i % labels.length]);
      m.position.set(x, y, z);
      m.rotation.set(rx, rand() * Math.PI, rz);
      m.name = 'pyramid_can';
      cans.add(m);
    };
    // What's left standing: the bottom two rows of a pyramid against the wall.
    let i = 0;
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 6 - row * 2; k++) put(P.x0 + 0.38 + (row % 2) * 0.06, 0.065 + row * 0.13, P.z0 + 0.25 + row * 0.12 + k * 0.12, 0, 0, i++);
    }
    // The rest: rolled across the corner, on their sides.
    for (let k = 0; k < 26; k++) {
      put(P.x0 + 0.06 + rand() * (P.x1 - P.x0 - 0.12), 0.055, P.z0 + rand() * (P.z1 - P.z0), Math.PI / 2, rand() * Math.PI, i++);
    }
    // Its sign, knocked flat.
    const card = sign('PYRAMID OF SAVINGS!', { x: P.x0 + 0.45, y: 0.02, z: P.z1 - 0.5, width: 0.8, height: 0.3, facing: 1, background: '#ffd23f', color: '#c8102e', font: 'clearance' });
    card.rotation.set(-Math.PI / 2, 0, 0.3);
    parts.pyramid = { cans };
  }

  // --- Level 2: the mannequin display -----------------------------------------------------------------------------------------
  {
    const M = SET_PIECES.mannequins;
    const y = (h) => floorY + h;
    addCollider(M.x0, floorY, M.z0, M.x1, y(2.0), M.z1).name = 'setpiece_mannequins';
    box(M.x0, floorY, M.z0, M.x1, y(0.15), M.z1, mat(0xe9dcc8), { collide: false, name: 'mannequin_platform' });
    const skin = mat(0xe8dccb, { roughness: 0.35 });
    const clothes = [mat(0xff8ab3), mat(0x7fd3c8), mat(0xc9b6e4)];
    const figure = (x, z, turn, { headless = false, tilt = 0, point = false, outfit }) => {
      const g = new THREE.Group();
      g.position.set(x, y(0.15), z);
      g.rotation.y = turn;
      const part = (w, h, d, px, py, material, rz = 0) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        m.position.set(px, py, 0);
        m.rotation.z = rz;
        g.add(m);
        return m;
      };
      part(0.04, 0.12, 0.04, 0, 0.06, skin); // the stand's pole
      part(0.12, 0.78, 0.13, -0.1, 0.47, skin); // legs
      part(0.12, 0.78, 0.13, 0.1, 0.47, skin);
      part(0.36, 0.2, 0.22, 0, 0.92, outfit); // hips
      part(0.44, 0.58, 0.25, 0, 1.3, outfit); // torso
      part(0.1, 0.1, 0.1, 0, 1.64, skin); // neck
      part(0.1, 0.62, 0.11, -0.29, 1.28, skin, 0.1); // left arm, hanging
      if (point) { // the right arm raised, pointing out at the walkway
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.11), skin); // (reaches ~10 cm past the collider)
        arm.position.set(0.42, 1.5, 0);
        arm.rotation.z = 0.25;
        g.add(arm);
      } else part(0.1, 0.62, 0.11, 0.29, 1.28, skin, -0.1);
      if (!headless) part(0.24, 0.3, 0.26, 0, 1.84, skin, tilt);
      g.name = 'mannequin';
      kit.group.add(g);
      return g;
    };
    figure(M.x0 + 0.4, (M.z0 + M.z1) / 2, -Math.PI / 2, { outfit: clothes[0], tilt: 0.35, point: true }); // head cocked, pointing out at you
    figure((M.x0 + M.x1) / 2, (M.z0 + M.z1) / 2, Math.PI, { outfit: clothes[1] }); // facing the wall
    figure(M.x1 - 0.4, (M.z0 + M.z1) / 2, -0.4, { outfit: clothes[2], headless: true });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.26), skin); // ... its head, on the floor in front
    head.position.set(M.x1 - 0.55, y(0.28), M.z1 + 0.35);
    head.rotation.set(0.4, 0.8, Math.PI / 2);
    head.name = 'mannequin_head';
    kit.group.add(head);
    sign('NEW SEASON · SAME SHOPPERS', { x: (M.x0 + M.x1) / 2, y: y(2.25), z: layout.hallway.minZ + 0.02, width: 2.0, height: 0.32, facing: 1, background: '#2a1838', color: '#ff9ec7', font: 'hoffmanSub' });
    parts.mannequins = { collider: [M.x0, M.z0, M.x1, M.z1] };
  }

  return {
    parts,
    update(dt) {
      if (!atmosphere.ambient.enabled) return; // (Graphics > Dust and flickering lights off: the screens hold still)
      for (const tick of ticking) tick(dt);
    },
    reset() {
      for (const r of resets) r();
    },
  };
}
