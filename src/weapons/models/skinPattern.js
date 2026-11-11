// =============================================================================
// SKIN PATTERNS: the printed pattern of a slot 2 (role) skin (config/skins.js `pattern`, numbers in skinPatterns).
//
//   applySkinPattern(root, def, skinId)   after a model or display is built in a skin: prints its body
//
// The body material (every material whose colour is the skin's body colour and has no texture of its own) is swapped for ONE
// patterned clone, so the gun draws exactly as many meshes as before: no draw call is added. Its texture is made once per skin and
// shared (the gun in hand, the locker preview and the conveyor), and marked userData.sharedSkinPattern so a preview's release
// leaves it alone. The body meshes' UVs are rewritten in the gun's own frame: faces that point up or to the right take the print,
// every other face samples the canvas's blank strip, which is painted the body colour. Without a canvas (Node) nothing changes.
// =============================================================================
import * as THREE from 'three';
import { gunSkin, skinPatterns as cfg } from '../../config/skins.js';
import { resolveGunColors } from '../skinPalette.js';

const css = color => '#' + color.toString(16).padStart(6, '0');
const textures = new Map(); // 'gunId/skinId' -> CanvasTexture

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
  // Repeated words in rows, alternate rows offset (a canvas font from config/fonts.js, already loaded at boot).
  text(ctx, p, { m, size }) {
    ctx.fillStyle = css(p.ink);
    ctx.font = `${p.weight ?? 400} ${Math.max(6, Math.round(m(p.height)))}px ${p.font}`;
    ctx.textBaseline = 'middle';
    for (let row = 0, y = m(p.rowSpacing) / 2; y < size + m(p.rowSpacing); row++, y += m(p.rowSpacing)) {
      const word = p.words[row % p.words.length];
      for (let x = (row % 2) * -m(p.wordSpacing) / 2; x < size; x += m(p.wordSpacing)) ctx.fillText(word, x, y);
    }
  },
};

/** The skin's shared canvas texture, made on first use; null without a canvas. */
export function skinPatternTexture(gunId, skin) {
  const key = `${gunId}/${skin.id}`;
  if (textures.has(key)) return textures.get(key);
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cfg.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const size = cfg.size;
  const blank = Math.ceil(size * cfg.blankFraction);
  ctx.fillStyle = css(skin.palette.body);
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, blank, size, size - blank);
  ctx.clip();
  DRAW[skin.pattern.kind](ctx, skin.pattern, { m: metres => metres * size / cfg.metres, size });
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = cfg.anisotropy;
  texture.name = `skinPattern:${key}`;
  texture.userData.sharedSkinPattern = true;
  textures.set(key, texture);
  return texture;
}

/** Where a face samples, by its outward normal in the gun's frame: 'top', 'right' or null (the blank strip). */
export function printedSide(normal) {
  if (normal.x < cfg.leftLimit) return null;
  if (normal.y >= cfg.faceDot) return 'top';
  if (normal.x >= cfg.faceDot) return 'right';
  return null;
}

/** The blank strip's UV: body colour at every mip level (all of a face's UVs are this one point). */
export const blankUv = Object.freeze([0.5, 1 - cfg.blankFraction / 2]);

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();

// The body geometry, unshared, with every triangle's UVs set by the side it faces (a planar print in gun-space metres).
function printGeometry(geometry, toGun, centre) {
  const out = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = out.attributes.position;
  const uv = new Float32Array(position.count * 2);
  const printed = 1 - cfg.blankFraction, edge = 1e-3;
  const clampU = u => Math.min(1 - edge, Math.max(edge, u));
  const clampV = v => Math.min(printed - edge, Math.max(edge, v));
  const corners = [a, b, c];
  for (let i = 0; i + 2 < position.count; i += 3) {
    for (let k = 0; k < 3; k++) corners[k].fromBufferAttribute(position, i + k).applyMatrix4(toGun);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const side = printedSide(n);
    for (let k = 0; k < 3; k++) {
      const p = corners[k];
      let u = blankUv[0], v = blankUv[1];
      if (side === 'top') { u = clampU(0.5 - (p.z - centre.z) / cfg.metres); v = clampV(printed / 2 + (p.x - centre.x) / cfg.metres); }
      if (side === 'right') { u = clampU(0.5 - (p.z - centre.z) / cfg.metres); v = clampV(printed / 2 + (p.y - centre.y) / cfg.metres); }
      uv[(i + k) * 2] = u; uv[(i + k) * 2 + 1] = v;
    }
  }
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

export function applySkinPattern(root, def, skinId) {
  const skin = gunSkin(def.id, skinId);
  if (!skin?.pattern || !root) return root;
  const texture = skinPatternTexture(def.id, skin);
  if (!texture) return root;
  const body = resolveGunColors(def, skinId).bodyColor;
  root.updateMatrixWorld(true);
  const fromRoot = root.matrixWorld.clone().invert();
  const centre = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()).applyMatrix4(fromRoot);
  const printedMaterials = new Map(); // the model's body material -> its one patterned clone
  root.traverse(mesh => {
    const material = mesh.isMesh && !Array.isArray(mesh.material) ? mesh.material : null;
    if (!material?.color || material.map || material.color.getHex() !== body) return;
    if (!printedMaterials.has(material)) {
      const print = material.clone();
      print.name = `${material.name || 'body'}:pattern`;
      print.map = texture;
      print.color.set(0xffffff); // (the canvas carries the body colour: the ink may be lighter than it)
      print.userData = { ...material.userData, skinPattern: skin.id, bodyColor: body };
      printedMaterials.set(material, print);
    }
    mesh.geometry = printGeometry(mesh.geometry, fromRoot.clone().multiply(mesh.matrixWorld), centre);
    mesh.material = printedMaterials.get(material);
  });
  return root;
}
