// =============================================================================
// CANVAS ATLAS: many painted panels (shop interiors, shop signs, blade signs) on ONE canvas texture, so a whole area's
// worth of them draws as a single mesh with a single material (one draw call instead of one per sign).
//
//   const atlas = createCanvasAtlas([{ aspect, draw(ctx, w, h) }, ...], { rowHeight })
//   atlas.texture            the shared CanvasTexture
//   atlas.uv(i)              [u0, v0, u1, v1] of cell i
//   atlasQuad(width, height, uvRect) -> a PlaneGeometry (facing +Z) showing that cell; place it, then merge them all
// Cells are packed in rows of equal height (`rowHeight` px), each as wide as its aspect asks, wrapping at `width`.
// =============================================================================

import * as THREE from 'three';

export function createCanvasAtlas(cells, { width = 2048, rowHeight = 256, padding = 4 } = {}) {
  const slots = [];
  let x = 0, y = 0;
  for (const cell of cells) {
    const w = Math.min(width, Math.max(16, Math.round(rowHeight * cell.aspect)));
    if (x + w > width) { x = 0; y += rowHeight + padding; }
    slots.push({ x, y, w, h: rowHeight });
    x += w + padding;
  }
  const height = y + rowHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  cells.forEach((cell, i) => {
    const s = slots[i];
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.beginPath();
    ctx.rect(0, 0, s.w, s.h);
    ctx.clip();
    cell.draw(ctx, s.w, s.h);
    ctx.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return {
    texture,
    width,
    height,
    // (canvas y runs down; texture v runs up, and CanvasTexture flips Y)
    uv: (i) => {
      const s = slots[i];
      return [s.x / width, 1 - (s.y + s.h) / height, (s.x + s.w) / width, 1 - s.y / height];
    },
  };
}

/** A width x height plane facing +Z whose UVs show one atlas cell. */
export function atlasQuad(width, height, [u0, v0, u1, v1]) {
  const g = new THREE.PlaneGeometry(width, height);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  return g;
}
