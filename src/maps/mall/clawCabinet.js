// =============================================================================
// GRAB-A-GUN's CABINET (the machine itself is the map feature kind 'clawMachine', game/features/clawMachine.js; numbers in
// config/clawMachine.js). A pink arcade claw machine against a wall, built from blocks like the RESTOCK-O-MATIC
// (mall/restockMachine.js): a base with the screen, button and prize chute, a glass case with three lanes and the claw,
// and a header sign. ONE solid collider, 2.2 m tall, that never moves (moving a collider would rebuild navigation).
// Everything lights itself (unlit or plain materials, no real lights, no flicker).
//
// Built in world coordinates (every box axis-aligned, no rotated group), so the coplanar test reads its faces as they are.
// The parts that change at runtime (the claw, the capsules) are in `rig.group`, flagged userData.dynamic for the static
// batcher; their meshes are cylinders and spheres positioned in world space.
//
//   buildClawCabinet({ kit, back: { x, z }, faces: '+z' | '-z' | '+x' | '-x', floorY = 0 }) -> { position, normal, screen, rig }
//     back                the middle of the cabinet's back, on the wall's face
//     position / normal   where the player interacts (the glass front) and the way the front faces
//     screen.show({ title, lines: [3 strings], highlight, note, tone })   redraws only when the words change
//     rig.setCapsule(lane, color | null)   a capsule in that lane (null: none)
//     rig.setClaw(u, drop)                 the claw over local position u (rig.laneU[lane] = over that lane), drop 0 (up) .. 1 (down)
//     rig.carry(lane | null)               that lane's capsule rides with the claw
//     rig.chute                            { position, normal }: where the won gun sits, and the way it faces
//     rig.setLive(live)                    false: a dust sheet over it, "BACK SOON" (the machine is at another site)
//     rig.reset()                          no capsules, claw parked over the first lane
// =============================================================================

import * as THREE from 'three';
import { clawMachine } from '../../config/clawMachine.js';

export const CLAW_CABINET = {
  colors: {
    body: 0xff4fa3, // hot pink (the RESTOCK-O-MATIC is orange, the stores are teal and pastel)
    bodyDark: 0xb8236f,
    trim: 0x1d1626,
    pit: 0x2b1f3a,
    backdrop: 0xffd6ec,
    rail: 0x8a8f99,
    claw: 0xd9dde3,
    button: 0xff2a2a,
    tray: 0x14101a,
    glass: 0xbfe8ff,
    sheet: 0xd9d2c3, // the dust sheet over a machine that isn't here right now
  },
  laneU: [-0.38, 0, 0.38], // capsule lanes across the pit (local metres from the middle)
  capsuleRadius: 0.12,
  pitTop: 0.92, // the pit floor, above the base (0..0.9)
  clawUp: 1.78, // the claw head's height when parked
  chuteU: 0.42, // the claw lets go over the chute, here
};

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** The screen: a canvas redrawn only when the words change. Title, three lane lines (one highlighted) and a note. */
function createScreen() {
  const c = canvas(256, 192);
  const ctx = c.getContext('2d');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  let key = '';
  function show({ title = '', lines = [], highlight = -1, note = '', tone = '#ffd6ec' }) {
    const next = JSON.stringify([title, lines, highlight, note, tone]);
    if (next === key) return;
    key = next;
    ctx.fillStyle = '#1a0614';
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = 'rgba(255, 120, 200, 0.07)';
    for (let y = 0; y < 192; y += 4) ctx.fillRect(0, y, 256, 1); // scan lines
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff9fd2';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(title, 128, 22, 240);
    lines.forEach((line, i) => {
      const y = 62 + i * 34;
      if (i === highlight) {
        ctx.fillStyle = tone;
        ctx.fillRect(8, y - 15, 240, 30);
        ctx.fillStyle = '#1a0614';
      } else {
        ctx.fillStyle = tone;
      }
      ctx.font = 'bold 22px monospace';
      ctx.fillText(line, 128, y, 232);
    });
    ctx.fillStyle = '#ff9fd2';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(note, 128, 174, 240);
    texture.needsUpdate = true;
  }
  show({ title: clawMachine.name, lines: ['', 'EVERYONE\'S', 'A WINNER*'], note: '*Not everyone' });
  return { texture, show };
}

// Local (u along the wall, as seen from the front: + is the viewer's right; a out from the wall) to world x / z.
const FRAMES = {
  '+z': { x: (b, u) => b.x + u, z: (b, a) => b.z + a, normal: [0, 1], sign: 1 },
  '-z': { x: (b, u) => b.x - u, z: (b, a) => b.z - a, normal: [0, -1], sign: -1 },
  '+x': { x: (b, a) => b.x + a, z: (b, u) => b.z - u, normal: [1, 0], sign: 'x+', alongZ: true },
  '-x': { x: (b, a) => b.x - a, z: (b, u) => b.z + u, normal: [-1, 0], sign: 'x-', alongZ: true },
};

export function buildClawCabinet({ kit, back, faces = '+z', floorY = 0, spec = CLAW_CABINET }) {
  const frame = FRAMES[faces];
  if (!frame) throw new Error(`claw cabinet: unknown facing "${faces}"`);
  const { width, depth, height } = clawMachine.cabinet;
  const { colors } = spec;
  const half = width / 2;
  // World x / z of a local (u, a).
  const wx = (u, a) => (frame.alongZ ? frame.x(back, a) : frame.x(back, u));
  const wz = (u, a) => (frame.alongZ ? frame.z(back, u) : frame.z(back, a));
  const world = (u, y, a, out = new THREE.Vector3()) => out.set(wx(u, a), floorY + y, wz(u, a));
  const place = (u0, y0, u1, y1, a0, a1, material, options = { collide: false }) => {
    const xs = [wx(u0, a0), wx(u1, a1)];
    const zs = [wz(u0, a0), wz(u1, a1)];
    return kit.box(Math.min(...xs), floorY + y0, Math.min(...zs), Math.max(...xs), floorY + y1, Math.max(...zs), material, options);
  };
  const sign = (text, u, y, a, options) => kit.sign(text, { x: wx(u, a), y: floorY + y, z: wz(u, a), facing: frame.sign, ...options });
  const solid = (hex, options = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, ...options });
  const glow = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const normal = new THREE.Vector3(frame.normal[0], 0, frame.normal[1]);

  // --- The one collider: the whole cabinet, 2.2 m tall (can't be stood on), its back just inside the wall ---
  {
    const xs = [wx(-half, -0.01), wx(half, depth)];
    const zs = [wz(-half, -0.01), wz(half, depth)];
    kit.addCollider(Math.min(...xs), floorY, Math.min(...zs), Math.max(...xs), floorY + height, Math.max(...zs));
  }

  // --- The base: body, kick plate, the screen, the drop button and the prize chute ---
  // (Every back face sits exactly on the wall's face, where the wall hides it; the kick plate's top clears skirting boards.)
  place(-half, 0.135, half, 0.9, 0, depth, solid(colors.body), { collide: false, name: 'claw_base' });
  place(-half - 0.02, 0, half + 0.02, 0.135, 0, depth + 0.02, solid(colors.trim));
  const screen = createScreen();
  place(-0.58, 0.52, 0.16, 0.88, depth, depth + 0.01, solid(colors.trim)); // bezel
  place(-0.55, 0.55, 0.13, 0.85, depth + 0.01, depth + 0.012, new THREE.MeshBasicMaterial({ map: screen.texture }));
  place(0.24, 0.6, 0.6, 0.86, depth, depth + 0.015, solid(colors.bodyDark)); // button panel
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.05, 20), glow(colors.button));
  button.rotation.x = Math.PI / 2;
  if (frame.alongZ) button.rotation.z = Math.PI / 2;
  world(0.42, 0.73, depth + 0.04, button.position);
  button.name = 'claw_button';
  kit.group.add(button);
  // The chute: a dark mouth with a tray sticking out, where the won gun lands.
  place(-0.5, 0.18, 0.5, 0.48, depth, depth + 0.006, solid(colors.tray));
  place(-0.52, 0.16, 0.52, 0.2, depth, depth + 0.24, solid(colors.trim));
  place(-0.52, 0.2, 0.52, 0.27, depth + 0.21, depth + 0.24, solid(colors.bodyDark)); // the tray's front lip
  sign('PRIZE ▾', 0.0, 0.42, depth + 0.012, { width: 0.4, height: 0.08, background: '#14101a', color: '#ff9fd2' });

  // --- The glass case: back panel, a front post at each corner, glass on three sides, the pit and its lane dividers ---
  place(-half, 0.9, half, 1.95, 0, 0.04, solid(colors.bodyDark)); // back
  place(-0.6, 0.95, 0.6, 1.9, 0.04, 0.05, glow(colors.backdrop)); // a lit backdrop
  for (const side of [-1, 1]) {
    place(side < 0 ? -half : half - 0.05, 0.9, side < 0 ? -half + 0.05 : half, 1.95, depth - 0.05, depth, solid(colors.trim)); // front post
    place(side < 0 ? -half + 0.015 : half - 0.025, 0.9, side < 0 ? -half + 0.025 : half - 0.015, 1.95, 0.04, depth - 0.05,
      new THREE.MeshStandardMaterial({ color: colors.glass, transparent: true, opacity: 0.16, roughness: 0.1 })); // side glass
  }
  place(-half + 0.05, 0.9, half - 0.05, 1.95, depth - 0.035, depth - 0.025,
    new THREE.MeshStandardMaterial({ color: colors.glass, transparent: true, opacity: 0.14, roughness: 0.1 })); // front glass
  place(-0.6, 0.9, 0.6, spec.pitTop, 0.04, depth - 0.05, solid(colors.pit)); // pit floor
  for (const u of [-0.19, 0.19]) place(u - 0.01, spec.pitTop, u + 0.01, spec.pitTop + 0.08, 0.1, depth - 0.1, solid(colors.bodyDark)); // lane dividers
  place(-0.6, 1.88, 0.6, 1.91, depth / 2 - 0.04, depth / 2 + 0.04, solid(colors.rail)); // the gantry rail

  // --- The header: the name, and the small print ---
  place(-half - 0.02, 1.95, half + 0.02, height, 0, depth + 0.03, solid(colors.trim));
  sign(clawMachine.name, 0, 2.075, depth + 0.04, { width: 1.2, height: 0.2, background: '#1d1626', color: '#ff7ac4' });
  sign('*Not everyone', -0.21, 0.3, depth + 0.02, { width: 0.42, height: 0.07, background: '#b8236f', color: '#ffe3f1' });

  // --- The rig: what moves (the claw: carriage, cable, head, three prongs) and the capsules ---
  const rig = new THREE.Group();
  rig.name = 'claw_rig';
  rig.userData.dynamic = true; // (on the group: the static batcher leaves everything under it alone)
  kit.group.add(rig);
  const clawMaterial = solid(colors.claw, { metalness: 0.4 });
  // { mesh, u, y, a, hang }: its place relative to the claw's u; a part with `hang` sits that far from the head's height.
  const parts = [];
  const part = (geometry, u, y, a, rotate = null, hang = null) => {
    const mesh = new THREE.Mesh(geometry, clawMaterial);
    if (rotate) rotate(mesh);
    mesh.name = 'claw_part';
    rig.add(mesh);
    parts.push({ mesh, u, y, a, hang });
    return mesh;
  };
  const mid = depth / 2;
  part(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), 0, 1.86, mid); // carriage on the rail
  const cable = part(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), 0, 1.82, mid); // (scaled to the drop)
  part(new THREE.CylinderGeometry(0.045, 0.06, 0.06, 12), 0, 0, mid, null, 0); // head (its height follows the drop)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    part(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 6), Math.cos(angle) * 0.05, 0, mid + Math.sin(angle) * 0.05,
      (m) => { m.rotation.x = Math.sin(angle) * 0.35; m.rotation.z = -Math.cos(angle) * 0.35; }, -0.08); // prongs, under the head
  }
  const capsules = spec.laneU.map((u) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.capsuleRadius, 16, 12), solid(0xffffff, { roughness: 0.3 }));
    mesh.name = 'claw_capsule';
    world(u, spec.pitTop + spec.capsuleRadius, mid, mesh.position);
    mesh.visible = false;
    rig.add(mesh);
    return { mesh, u };
  });

  // The dust sheet (shown while the machine is at another site): a cloth box over the whole cabinet and its tray, a note pinned on.
  // Visual only: the collider is the same either way.
  const sheet = [
    place(-half - 0.04, 0.035, half + 0.04, height + 0.05, 0, depth + 0.28, new THREE.MeshStandardMaterial({ color: colors.sheet, roughness: 1 }), { collide: false, name: 'claw_sheet' }),
    sign('BACK SOON', 0, 1.35, depth + 0.29, { width: 0.7, height: 0.32, background: '#fff6d8', color: '#b8236f' }),
  ];
  for (const mesh of sheet) rig.add(mesh); // (into the dynamic group: it is shown and hidden at runtime)

  let clawU = spec.laneU[0];
  let clawDrop = 0;
  let carried = null;
  const headY = (drop) => spec.clawUp - drop * (spec.clawUp - (spec.pitTop + 2 * spec.capsuleRadius + 0.03));

  function setClaw(u, drop) {
    clawU = u;
    clawDrop = Math.max(0, Math.min(1, drop));
    const head = headY(clawDrop);
    for (const p of parts) {
      let y = p.y;
      if (p.mesh === cable) {
        const top = 1.86, bottom = head + 0.03;
        p.mesh.scale.y = Math.max(0.01, top - bottom);
        y = (top + bottom) / 2;
      } else if (p.hang !== null) {
        y = head + p.hang;
      }
      world(u + p.u, y, p.a, p.mesh.position);
    }
    if (carried !== null) world(u, head - 0.08 - spec.capsuleRadius, mid, capsules[carried].mesh.position);
  }

  rig.userData.capsules = capsules.map((c) => c.mesh); // (tests)
  const api = {
    group: rig,
    laneU: spec.laneU,
    chuteU: spec.chuteU,
    get clawU() { return clawU; },
    get clawDrop() { return clawDrop; },
    setCapsule(lane, color) {
      const { mesh, u } = capsules[lane];
      mesh.visible = color !== null && color !== undefined;
      if (mesh.visible) mesh.material.color.setHex(color);
      if (carried !== lane) world(u, spec.pitTop + spec.capsuleRadius, mid, mesh.position);
    },
    carry(lane) {
      const was = carried;
      carried = lane;
      if (was !== null && was !== lane) world(capsules[was].u, spec.pitTop + spec.capsuleRadius, mid, capsules[was].mesh.position);
      setClaw(clawU, clawDrop);
    },
    setClaw,
    setLive(live) {
      for (const mesh of sheet) mesh.visible = !live;
    },
    get live() { return !sheet[0].visible; },
    chute: { position: world(0, 0.34, depth + 0.12, new THREE.Vector3()) /* resting on the tray, above its lip */, normal: normal.clone() },
    reset() {
      carried = null;
      capsules.forEach((_, lane) => api.setCapsule(lane, null));
      setClaw(spec.laneU[0], 0);
    },
  };
  api.reset();

  // --- Where the player interacts: the middle of the glass front ---
  const position = world(0, 1.25, depth + 0.04);
  return { position, normal, screen, rig: api };
}
