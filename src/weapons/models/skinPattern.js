// =============================================================================
// SKIN PATTERNS: the printed pattern of a slot 2 (role) skin (config/skins.js `pattern`, numbers in skinPatterns).
//
//   applySkinPattern(root, def, skinId, mounts)   after a model or display is built in a skin: prints its body
//
// The body material (every material whose colour is the skin's body colour and has no texture of its own) is swapped for ONE
// patterned clone, so the gun draws exactly as many meshes as before: no draw call is added. Its texture is made once per skin and
// layout and shared (the gun in hand, the locker preview and the conveyor), and marked userData.sharedSkinPattern so a preview's
// release leaves it alone. The body meshes' UVs are rewritten in the gun's own frame. The canvas has two printed regions:
//   upper   faces that point up or to the right
//   lower   faces that point left: the side you see in your hands. Round the sticker mount (the build patch, the warranty seal) a
//           keep-out is painted back to the body colour (skinPatterns.keepOut), so those always sit on plain paint.
// Every other face (front, back, underneath) samples the blank strip at the top, also body colour. Without a canvas (Node) nothing changes.
// =============================================================================
import * as THREE from 'three';
import { gunSkin, skinPatterns as cfg } from '../../config/skins.js';
import { resolveGunColors } from '../skinPalette.js';
import { drawType } from '../../world/typeKit.js';

const css = color => '#' + color.toString(16).padStart(6, '0');
const textures = new Map(); // 'gunId/skinId|layout' -> CanvasTexture

// Each draws `p` (numbers in metres; m(x) = pixels) over the whole canvas, which is already filled with the body colour.
const DRAW = {
  // Ruled paper: thin lines and, every marginEvery metres, a margin line across them.
  lines(ctx, p, { m, size }) {
    ctx.fillStyle = css(p.ink);
    for (let y = 0; y < size; y += m(p.spacing)) ctx.fillRect(0, y, size, Math.max(1, m(p.width)));
    if (!p.margin) return;
    ctx.fillStyle = css(p.margin.color);
    for (let x = m(p.margin.offset); x < size; x += m(p.margin.every)) ctx.fillRect(x, 0, Math.max(1, m(p.margin.width)), size);
  },
  // Blueprint paper: a fine grid with a heavier line every majorEvery cells.
  grid(ctx, p, { m, size }) {
    ctx.fillStyle = css(p.ink);
    for (let i = 0, at = 0; at < size; i++, at += m(p.spacing)) {
      const w = Math.max(1, m(i % p.majorEvery === 0 ? p.majorWidth : p.width));
      ctx.fillRect(at, 0, w, size);
      ctx.fillRect(0, at, size, w);
    }
  },
  // Polka dots, every other row offset by half a step.
  dots(ctx, p, { m, size }) {
    ctx.fillStyle = css(p.ink);
    const step = m(p.spacing);
    for (let row = 0, y = step / 2; y < size + step; row++, y += step) {
      for (let x = (row % 2) * step / 2; x < size + step; x += step) {
        ctx.beginPath(); ctx.arc(x, y, m(p.radius), 0, Math.PI * 2); ctx.fill();
      }
    }
  },
  // Diagonal bands (angle in degrees).
  stripes(ctx, p, { m, size }) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(p.angle * Math.PI / 180);
    ctx.fillStyle = css(p.ink);
    const reach = size * 1.5;
    for (let x = -reach; x < reach; x += m(p.spacing)) ctx.fillRect(x, -reach, m(p.width), reach * 2);
    ctx.restore();
  },
  checker(ctx, p, { m, size }) {
    ctx.fillStyle = css(p.ink);
    const cell = m(p.size);
    for (let row = 0; row * cell < size; row++) for (let col = row % 2; col * cell < size; col += 2) ctx.fillRect(col * cell, row * cell, cell, cell);
  },
  // Gingham: translucent bands both ways, solid where they cross.
  gingham(ctx, p, { m, size }) {
    ctx.fillStyle = css(p.ink);
    const cell = m(p.size);
    ctx.globalAlpha = p.alpha;
    for (let at = 0; at < size; at += cell * 2) { ctx.fillRect(at, 0, cell, size); ctx.fillRect(0, at, size, cell); }
    ctx.globalAlpha = 1;
  },
  // Scattered paper squares in several colours, the same every time (seeded).
  confetti(ctx, p, { m, size }) {
    let seed = p.seed;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const count = Math.round(p.perSquareMetre * (size / m(1)) ** 2);
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.translate(random() * size, random() * size);
      ctx.rotate(random() * Math.PI);
      ctx.fillStyle = css(p.colors[i % p.colors.length]);
      const s = m(p.minSize + random() * (p.maxSize - p.minSize));
      ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      ctx.restore();
    }
  },
  // Diamond tread plate: short raised bars, alternating direction.
  tread(ctx, p, { m, size }) {
    ctx.fillStyle = css(p.ink);
    const step = m(p.spacing), long = m(p.length), wide = Math.max(1, m(p.width));
    for (let row = 0, y = 0; y < size + step; row++, y += step) {
      for (let col = 0, x = 0; x < size + step; col++, x += step) {
        ctx.save();
        ctx.translate(x + (row % 2) * step / 2, y);
        ctx.rotate(((row + col) % 2 ? 1 : -1) * Math.PI / 4);
        ctx.fillRect(-long / 2, -wide / 2, long, wide);
        ctx.restore();
      }
    }
  },
  // Argyle: diamonds in ink2 on alternate cells, crossed by thin ink lines.
  argyle(ctx, p, { m, size }) {
    const w = m(p.width), h = m(p.height);
    ctx.fillStyle = css(p.ink2);
    for (let row = 0, y = 0; y < size + h; row++, y += h / 2) {
      for (let x = (row % 2) * w / 2; x < size + w; x += w) {
        if ((Math.round(x / w) + row) % 2) continue;
        ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w / 2, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x - w / 2, y); ctx.closePath(); ctx.fill();
      }
    }
    ctx.strokeStyle = css(p.ink);
    ctx.lineWidth = Math.max(1, m(p.line));
    for (let x = -size; x < size * 2; x += w) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + size * w / h, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - size * w / h, size); ctx.stroke();
    }
  },
  // Repeated words in rows, alternate rows offset (p.font is a type ROLE from config/typefaces.js, already loaded at boot).
  text(ctx, p, { m, size }) {
    const o = { role: p.font, size: Math.max(6, Math.round(m(p.height))), fill: css(p.ink), align: 'left', weight: p.weight, outline: false, shadow: false, glow: false };
    for (let row = 0, y = m(p.rowSpacing) / 2; y < size + m(p.rowSpacing); row++, y += m(p.rowSpacing)) {
      const word = p.words[row % p.words.length];
      for (let x = (row % 2) * -m(p.wordSpacing) / 2; x < size; x += m(p.wordSpacing)) drawType(ctx, word, x, y, o);
    }
  },
};

// Canvas layout: size wide, 2 x size tall; rows [0, blank) are the blank strip, [blank, size) the upper region, [size, 2 x size) the lower.
// Both regions have square pixels at size / metres per metre, so v moves 1 / (2 x metres) per metre.
const layout = () => {
  const width = cfg.size, height = cfg.size * 2, blank = Math.ceil(height * cfg.blankFraction / 2);
  return { width, height, blank, perMetre: width / cfg.metres, top: 1 - blank / height, middle: 0.5 };
};

/** The blank strip's UV: body colour at every mip level (all of a face's UVs are this one point). */
export const blankUv = Object.freeze([0.5, 1 - layout().blank / layout().height / 2]);

/** A gun-space point on a face of this side, as UV (unclamped). centre = the body's centre: the print is laid out from it. */
export function sideUv(side, point, centre) {
  const { top, middle } = layout();
  const across = 1 / (2 * cfg.metres);
  if (side === 'left') return [0.5 + (point.z - centre.z) / cfg.metres, middle / 2 + (point.y - centre.y) * across]; // (read from the left: +z is to your right)
  const upper = (middle + top) / 2;
  if (side === 'top') return [0.5 - (point.z - centre.z) / cfg.metres, upper + (point.x - centre.x) * across];
  return [0.5 - (point.z - centre.z) / cfg.metres, upper + (point.y - centre.y) * across]; // right
}

/** The keep-outs on the left face round each mount there, as gun-space boxes { z: [min, max], y: [min, max] }. */
export function keepOuts(mounts = {}) {
  const k = cfg.keepOut;
  return k.mounts.map(name => mounts[name]?.position).filter(Boolean)
    .map(([, y, z]) => ({ z: [z - k.halfLength, z + k.halfLength], y: [y - k.halfHeight, y + k.halfHeight] }));
}

/** The skin's canvas texture for this layout (the body's centre and its keep-outs), made on first use and shared; null without a canvas. */
export function skinPatternTexture(gunId, skin, centre = new THREE.Vector3(), holes = []) {
  const round = n => Math.round(n * 1e4);
  const key = `${gunId}/${skin.id}|${[centre.x, centre.y, centre.z].map(round)}|${holes.map(h => [...h.z, ...h.y].map(round)).join(';')}`;
  if (textures.has(key)) return textures.get(key);
  if (typeof document === 'undefined') return null;
  const { width, height, blank, perMetre } = layout();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = css(skin.palette.body);
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, blank, width, height - blank);
  ctx.clip();
  DRAW[skin.pattern.kind](ctx, skin.pattern, { m: metres => metres * perMetre, size: height });
  ctx.restore();
  // The keep-outs, painted back to the body colour last (tests read this order: nothing is drawn over them).
  ctx.fillStyle = css(skin.palette.body);
  for (const hole of holes) {
    const [u0, v0] = sideUv('left', { z: hole.z[0], y: hole.y[0] }, centre), [u1, v1] = sideUv('left', { z: hole.z[1], y: hole.y[1] }, centre);
    ctx.fillRect(Math.floor(u0 * width), Math.floor((1 - v1) * height), Math.ceil((u1 - u0) * width), Math.ceil((v1 - v0) * height));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = cfg.anisotropy;
  texture.name = `skinPattern:${key}`;
  texture.userData.sharedSkinPattern = true;
  textures.set(key, texture);
  return texture;
}

/** Which printed side a face is, by its outward normal in the gun's frame: 'top', 'right', 'left' or null (the blank strip). */
export function printedSide(normal) {
  if (normal.y >= cfg.faceDot && normal.x >= cfg.leftLimit) return 'top';
  if (normal.x >= cfg.faceDot) return 'right';
  if (normal.x <= -cfg.faceDot) return 'left';
  return null;
}

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();

// The body geometry, unshared, with every triangle's UVs set by the side it faces (a planar print in gun-space metres).
function printGeometry(geometry, toGun, centre) {
  const out = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = out.attributes.position;
  const uv = new Float32Array(position.count * 2);
  const { top, middle } = layout(), edge = 1e-3;
  const clamp = (value, lo, hi) => Math.min(hi - edge, Math.max(lo + edge, value));
  const corners = [a, b, c];
  for (let i = 0; i + 2 < position.count; i += 3) {
    for (let k = 0; k < 3; k++) corners[k].fromBufferAttribute(position, i + k).applyMatrix4(toGun);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const side = printedSide(n);
    for (let k = 0; k < 3; k++) {
      let [u, v] = blankUv;
      if (side) {
        [u, v] = sideUv(side, corners[k], centre);
        u = clamp(u, 0, 1);
        v = side === 'left' ? clamp(v, 0, middle) : clamp(v, middle, top);
      }
      uv[(i + k) * 2] = u; uv[(i + k) * 2 + 1] = v;
    }
  }
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/** The meshes a skin prints on: body-coloured, untextured. */
function bodyMeshes(root, body) {
  const list = [];
  root.traverse(mesh => {
    const material = mesh.isMesh && !Array.isArray(mesh.material) ? mesh.material : null;
    if (material?.color && !material.map && material.color.getHex() === body) list.push(mesh);
  });
  return list;
}

/** mounts: the model's (weapons/models/index.js supplies a display's): the keep-outs sit round them. */
export function applySkinPattern(root, def, skinId, mounts = {}) {
  const skin = gunSkin(def.id, skinId);
  if (!skin?.pattern || !root) return root;
  const body = resolveGunColors(def, skinId).bodyColor;
  root.updateMatrixWorld(true);
  const fromRoot = root.matrixWorld.clone().invert();
  const meshes = bodyMeshes(root, body);
  if (!meshes.length) return root;
  // Laid out from the sticker mount (on the gun's centre line), which the gun in hand and its display share, so they share one texture too.
  // (Not the body's bounds: some guns' hand models carry body-coloured reload props.) Without a sticker mount: the body's centre.
  const sticker = mounts.sticker?.position;
  const bounds = new THREE.Box3();
  if (!sticker) for (const mesh of meshes) bounds.expandByObject(mesh);
  const centre = sticker ? new THREE.Vector3(0, sticker[1], sticker[2]) : bounds.getCenter(new THREE.Vector3()).applyMatrix4(fromRoot);
  const texture = skinPatternTexture(def.id, skin, centre, keepOuts(mounts));
  if (!texture) return root;
  const printedMaterials = new Map(); // the model's body material -> its one patterned clone
  for (const mesh of meshes) {
    const material = mesh.material;
    if (!printedMaterials.has(material)) {
      const print = material.clone();
      print.name = `${material.name || 'body'}:pattern`;
      print.map = texture;
      print.color.set(0xffffff); // (the canvas carries the body colour: the ink may be lighter than it)
      print.userData = { ...material.userData, skinPattern: skin.id, bodyColor: body, patternCentre: centre.toArray() };
      printedMaterials.set(material, print);
    }
    mesh.geometry = printGeometry(mesh.geometry, fromRoot.clone().multiply(mesh.matrixWorld), centre);
    mesh.material = printedMaterials.get(material);
  }
  return root;
}
