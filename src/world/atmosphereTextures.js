import * as THREE from 'three';
import { seededRandom } from './textures.js';

/** A soft footprint, also reused for dusty/leaked patches. No postprocessing. */
export function makeSoftFootprint() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  const gradient = c.createRadialGradient(32, 32, 3, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gradient; c.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Linear data: grout stays matte while the broad tile faces catch a little light. */
export function makeTileRoughness() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d'), random = seededRandom(89);
  c.fillStyle = '#a5a5a5'; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 38; i++) {
    c.fillStyle = `rgba(255,255,255,${0.04 + random() * 0.09})`;
    c.fillRect(random() * 128, random() * 128, 2 + random() * 18, 1);
  }
  c.fillStyle = '#fafafa';
  for (const p of [0, 64, 127]) { c.fillRect(p, 0, 2, 128); c.fillRect(0, p, 128, 2); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
