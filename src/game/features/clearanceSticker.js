import * as THREE from 'three';
import { drawType } from '../../world/typeKit.js';

export function makeClearanceSticker() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Die-cut retail ticket, with a clipped tear-off stub and a warm paper edge.
  function ticket(inset, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(8 + inset, 10 + inset);
    ctx.lineTo(228 - inset, 10 + inset);
    ctx.lineTo(248 - inset, 30 + inset);
    ctx.lineTo(248 - inset, 98 - inset);
    ctx.lineTo(228 - inset, 118 - inset);
    ctx.lineTo(8 + inset, 118 - inset);
    ctx.closePath();
    ctx.fill();
  }
  ticket(0, '#fff0cb');
  ticket(5, '#962447');

  ctx.fillStyle = '#f9c669';
  ctx.fillRect(19, 21, 160, 21);
  drawType(ctx, 'CLEARANCE', 28, 32, { role: 'wayfinding', size: 20, fill: '#4a1932', align: 'left', tracking: 0.3, maxWidth: 146 });
  drawType(ctx, '99', 21, 78, { role: 'clearance', size: 100, fill: '#fff4d6', align: 'left', maxWidth: 101 });
  drawType(ctx, '¢', 126, 80, { role: 'clearance', size: 56, fill: '#fff4d6', align: 'left' });
  ctx.fillStyle = '#fff4d6';

  for (let y = 22; y < 110; y += 11) ctx.fillRect(186, y, 2, 6);
  let x = 196;
  for (const width of [2, 4, 2, 5, 2, 3, 2]) {
    ctx.fillRect(x, 63, width, 35);
    x += width + 3;
  }
  drawType(ctx, 'SG', 205, 48, { role: 'priceTag', size: 22, fill: '#f9c669', align: 'left', baseline: 'alphabetic' });

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
