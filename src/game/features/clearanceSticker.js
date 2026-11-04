import * as THREE from 'three';

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
  ctx.fillStyle = '#4a1932';
  ctx.font = 'bold 15px Arial';
  ctx.fillText('C L E A R A N C E', 28, 37);
  ctx.fillStyle = '#fff4d6';
  ctx.font = '900 75px Arial Black, Arial, sans-serif';
  ctx.fillText('99', 21, 106, 101);
  ctx.font = 'bold 43px Arial';
  ctx.fillText('¢', 126, 101);

  for (let y = 22; y < 110; y += 11) ctx.fillRect(186, y, 2, 6);
  let x = 196;
  for (const width of [2, 4, 2, 5, 2, 3, 2]) {
    ctx.fillRect(x, 63, width, 35);
    x += width + 3;
  }
  ctx.fillStyle = '#f9c669';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('SG', 205, 48);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
