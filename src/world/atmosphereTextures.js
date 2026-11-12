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

/** Soft radial pinpoint sprite for floating dust motes caught in overhead light beams. */
export function makeDustMoteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const c = canvas.getContext('2d');
  const gradient = c.createRadialGradient(16, 16, 1, 16, 16, 15);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(235,245,255,0.65)');
  gradient.addColorStop(1, 'rgba(235,245,255,0)');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Linear data: grout stays matte while the broad waxed tile faces catch crisp specular light. */
// Both tile maps below have fixed seeds, so every floor's copy is the same: built once, handed out as clones (a clone shares
// the image and its GPU upload, and keeps its own repeat).
let roughnessTemplate = null;
let bumpTemplate = null;
export function makeTileRoughness() {
  roughnessTemplate ??= buildTileRoughness();
  return roughnessTemplate.clone();
}
export function makeTileBump() {
  bumpTemplate ??= buildTileBump();
  return bumpTemplate.clone();
}

function buildTileRoughness() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d'), random = seededRandom(89);
  const tile = size / 2;

  // Base polished wax surface (low grayscale = glossy when multiplied by material roughness).
  c.fillStyle = '#4e4e4e';
  c.fillRect(0, 0, size, size);

  // Subtle per-tile polish variation and diagonal floor-buffer sheen.
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const shade = Math.round(70 + (random() - 0.5) * 18);
      c.fillStyle = `rgb(${shade},${shade},${shade})`;
      c.fillRect(tx * tile, ty * tile, tile, tile);

      const g = c.createLinearGradient(tx * tile, ty * tile, (tx + 1) * tile, (ty + 1) * tile);
      g.addColorStop(0, 'rgba(0,0,0,0.14)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0.10)');
      c.fillStyle = g;
      c.fillRect(tx * tile, ty * tile, tile, tile);
    }
  }

  // Faint foot-traffic scuffs and buffer streaks (slightly rougher than the freshly waxed face).
  for (let i = 0; i < 64; i++) {
    c.fillStyle = `rgba(255,255,255,${0.05 + random() * 0.14})`;
    c.fillRect(random() * size, random() * size, 4 + random() * 28, 1 + random() * 2);
  }

  // Grout seams and slightly worn tile edges stay completely matte.
  c.fillStyle = '#b8b8b8';
  for (const p of [0, tile, size - 1]) {
    c.fillRect(p - 3, 0, 6, size);
    c.fillRect(0, p - 3, size, 6);
  }
  c.fillStyle = '#fafafa';
  for (const p of [0, tile, size - 1]) {
    c.fillRect(p - 1, 0, 3, size);
    c.fillRect(0, p - 1, size, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Linear heightmap: raised flat tile faces with beveled rims and recessed mortar channels. */
function buildTileBump() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d'), random = seededRandom(137);
  const tile = size / 2;

  // Raised tile plateau
  c.fillStyle = '#ebebeb';
  c.fillRect(0, 0, size, size);

  // Subtle micro-pitting across the terrazzo stone
  for (let i = 0; i < 90; i++) {
    c.fillStyle = `rgba(0,0,0,${0.03 + random() * 0.05})`;
    c.fillRect(random() * size, random() * size, 2 + random() * 4, 2 + random() * 4);
  }

  // Beveled shoulder sloping into the grout
  c.fillStyle = '#929292';
  for (const p of [0, tile, size - 1]) {
    c.fillRect(p - 3, 0, 6, size);
    c.fillRect(0, p - 3, size, 6);
  }

  // Deep recessed mortar channel
  c.fillStyle = '#141414';
  for (const p of [0, tile, size - 1]) {
    c.fillRect(p - 1, 0, 3, size);
    c.fillRect(0, p - 1, size, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
