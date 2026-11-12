// =============================================================================
// THE ATRIUM'S MURALS (config/atrium.js murals): the ground floor's long south wall (the one shared with the Main Hallway)
// was 18 m of bare beige between its two doorways. Three painted 1986 sunset panels now run above the doors' height, each in
// a brass frame: a striped retro sun over a neon grid, palm silhouettes, and the mall's promises lettered across them.
// Paint, so they take the room's light (world/mapKit.js printedMaterial); one canvas and one draw call per panel, the frame
// is plain geometry the static batcher merges. Decoration only: nothing here collides.
//
//   buildAtriumMurals({ kit, layout })   layout = LAYOUT.atrium (rect: the room)
// =============================================================================

import * as THREE from 'three';
import { atriumDetails } from '../../config/atrium.js';
import { printedMaterial } from '../../world/mapKit.js';
import { seededRandom } from '../../world/textures.js';
import { drawType } from '../../world/typeKit.js';

/** Paints one mural panel onto a canvas context (pixels). Pure drawing: no textures, no scene. */
export function paintMural(ctx, w, h, { title, sub, seed = 1, sunAt = 0.5 }) {
  const rand = seededRandom(seed);
  const horizon = h * 0.64;
  // Sky: dusk purple down to a hot orange horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#2b1a4a');
  sky.addColorStop(0.45, '#8c2f6b');
  sky.addColorStop(0.8, '#f0605e');
  sky.addColorStop(1, '#ffb35c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  // The retro sun: a disc, cut by horizontal stripes that thicken towards the horizon.
  const sx = w * sunAt, r = h * 0.34;
  const sun = ctx.createLinearGradient(0, horizon - r, 0, horizon);
  sun.addColorStop(0, '#ffe58a');
  sun.addColorStop(1, '#ff6f91');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sx, horizon, r, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#e8546a';
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const y = horizon - r * (0.62 - t * 0.6);
    ctx.fillRect(sx - r, y, r * 2, 2 + i * (h * 0.012));
  }
  // The ground: a plum floor with a neon perspective grid running to the horizon.
  ctx.fillStyle = '#2a1838';
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = 'rgba(255, 94, 168, 0.75)';
  ctx.lineWidth = Math.max(1, h * 0.006);
  for (let i = -14; i <= 14; i++) {
    ctx.beginPath();
    ctx.moveTo(sx + i * (w / 28), horizon);
    ctx.lineTo(sx + i * (w / 5), h);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(99, 230, 255, 0.6)';
  for (let i = 1; i <= 5; i++) {
    const y = horizon + (h - horizon) * (i / 5) ** 1.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Palm silhouettes at both ends.
  ctx.fillStyle = '#1d1028';
  for (const [x, lean] of [[w * 0.06, 1], [w * 0.94, -1]]) {
    const base = h * 0.98, top = h * (0.18 + rand() * 0.08);
    const tipX = x + lean * h * 0.12;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.025, base);
    ctx.quadraticCurveTo(x + lean * h * 0.02, (base + top) / 2, tipX - h * 0.012, top);
    ctx.lineTo(tipX + h * 0.012, top);
    ctx.quadraticCurveTo(x + lean * h * 0.05, (base + top) / 2, x + h * 0.025, base);
    ctx.fill();
    for (let f = 0; f < 6; f++) { // fronds: long curved leaves from the crown
      const a = -Math.PI * (0.05 + f * 0.18) + (rand() - 0.5) * 0.2;
      const len = h * (0.2 + rand() * 0.08);
      ctx.beginPath();
      ctx.moveTo(tipX, top);
      ctx.quadraticCurveTo(tipX + Math.cos(a) * len * 0.6, top + Math.sin(a) * len * 0.4 - h * 0.03,
        tipX + Math.cos(a) * len, top + Math.sin(a) * len * 0.5 + h * 0.05);
      ctx.quadraticCurveTo(tipX + Math.cos(a) * len * 0.5, top + Math.sin(a) * len * 0.3, tipX, top);
      ctx.fill();
    }
  }
  // Lettering: the title in a chunky display face with a hot-pink drop shadow, the line under it in a clean grotesk.
  drawType(ctx, title, w / 2, h * 0.27, { role: 'chrome', size: h * 0.24, maxWidth: w * 0.78, fill: '#fff1d6', shadow: { color: '#ff3d8b', dx: 0.06, dy: 0.06 } });
  if (sub) drawType(ctx, sub, w / 2, h * 0.45, { role: 'wayfinding', size: h * 0.1, maxWidth: w * 0.7, fill: '#ffe9b8' });
}

export function buildAtriumMurals({ kit, layout }) {
  const M = atriumDetails.murals;
  const A = layout.rect;
  const group = new THREE.Group();
  group.name = 'atrium_murals';
  kit.group.add(group);
  const brass = kit.mat(M.frame.color, { roughness: 0.4, metalness: 0.5 });
  const wallZ = A.minZ; // (the south wall's face inside the room)
  M.panels.forEach((panel, i) => {
    const w = panel.to - panel.from, h = M.top - M.bottom;
    const cx = (panel.from + panel.to) / 2, cy = (M.bottom + M.top) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(2048, Math.round(w * M.pixelsPerMetre));
    canvas.height = Math.round(h * M.pixelsPerMetre);
    paintMural(canvas.getContext('2d'), canvas.width, canvas.height, { ...panel, seed: 1986 + i });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), printedMaterial(texture));
    mesh.position.set(cx, cy, wallZ + M.standOff);
    mesh.name = `atrium_mural_${i}`;
    group.add(mesh);
    // A brass frame round it, a little prouder than the paint (decoration: the batcher merges it).
    const t = M.frame.width, d = M.frame.depth;
    const z0 = wallZ, z1 = wallZ + d;
    kit.box(panel.from - t, M.bottom - t, z0, panel.to + t, M.bottom, z1, brass, { collide: false, name: 'atrium_mural_frame' });
    kit.box(panel.from - t, M.top, z0, panel.to + t, M.top + t, z1, brass, { collide: false, name: 'atrium_mural_frame' });
    kit.box(panel.from - t, M.bottom, z0, panel.from, M.top, z1, brass, { collide: false, name: 'atrium_mural_frame' });
    kit.box(panel.to, M.bottom, z0, panel.to + t, M.top, z1, brass, { collide: false, name: 'atrium_mural_frame' });
  });
  return group;
}
