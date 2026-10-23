// Shared, tiny impact signatures. Vertex-coloured models batch each signature into one draw call;
// price stickers use three small shared procedural textures rather than one texture per shot.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from '../world/textures.js';

export function buildImpactModel(kind, variant) {
  if (kind === 'sticker') {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 160);
    ctx.fillStyle = '#56504a'; ctx.fillRect(12, 20, 232, 126); // scuffed backing
    ctx.fillStyle = ['#ffe16a', '#f3d9b1', '#ff9e9e'][variant]; ctx.fillRect(20, 12, 216, 128);
    ctx.fillStyle = '#933c38'; ctx.fillRect(25, 17, 206, 28);
    ctx.fillStyle = '#f9edcb'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('MEGA MARKDOWN', 128, 37);
    ctx.fillStyle = '#352d32'; ctx.font = 'bold 30px sans-serif';
    ctx.fillText(['REDUCED', 'FINAL SALE', '$0.01'][variant], 128, 88);
    for (let i = 0; i < 23; i++) ctx.fillRect(48 + i * 7, 104, i % 3 ? 2 : 4, 20);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return {
      geometry: new THREE.PlaneGeometry(0.12, 0.075),
      material: new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    };
  }
  const parts = [];
  function part(geometry, color, x, y, z, rotation = [0, 0, 0]) {
    // Some Three.js primitives are indexed and some aren't; use non-indexed geometry throughout.
    if (geometry.index) { const source = geometry; geometry = source.toNonIndexed(); source.dispose(); }
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(matrix);
    const colors = new Float32Array(geometry.attributes.position.count * 3), c = new THREE.Color(color);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(geometry);
  }
  const box = (w, h, d, color, x, y, z, rotation) => part(new THREE.BoxGeometry(w, h, d), color, x, y, z, rotation);
  const pin = (radius, length, color, x, y, z) => part(new THREE.CylinderGeometry(radius, radius, length, 6), color, x, y, z, [Math.PI / 2, 0, 0]);
  const hole = (x, y, radius) => part(new THREE.CircleGeometry(radius, 8), 0x3c3835, x, y, 0.001);
  if (kind === 'staple') {
    for (const x of [-0.015, 0.015]) { hole(x, 0, 0.005); pin(0.0025, 0.012, 0xb9c5cb, x, 0, 0.006); }
    box(0.035, 0.005, 0.005, 0xc3cbd0, 0, 0, 0.013, [0, variant ? 0.12 : 0, variant ? 0.08 : 0]);
  } else if (kind === 'nail') {
    hole(0, 0, 0.011);
    for (let i = 0; i < 3; i++) box(0.003, 0.018, 0.001, 0x52483e, 0, 0, 0.0015, [0, 0, i * 2.1 + variant]);
    pin(0.003, 0.055, 0xa6b1bc, 0, 0, 0.028);
    pin(0.008, 0.004, 0x697d8c, 0, 0, 0.057);
  } else if (kind === 'dart') {
    hole(0, 0, 0.010);
    pin(0.010, 0.012, 0xf39b48, 0, 0, 0.007);
    part(new THREE.CylinderGeometry(0.009, 0.009, 0.055, 7), [0x5eadd4, 0x9b72c5, 0x7ec9a4][variant],
      0, -0.002, 0.039, [Math.PI / 2 + 0.10, 0, 0]);
    pin(0.010, 0.004, 0xf6dc86, 0, -0.005, 0.068);
  } else if (kind === 'confetti') {
    const random = seededRandom(97 + variant * 123);
    const colors = [0xffcf42, 0xd95695, 0x6e5bbb, 0x50bfba, 0xf0e5c0];
    for (let i = 0; i < 7; i++) box(0.009, 0.017, 0.001, colors[i % colors.length],
      (random() - 0.5) * 0.09, (random() - 0.5) * 0.09, 0.002 + i * 0.0004, [0, 0, random() * Math.PI]);
    // A short curled streamer alongside the paper flecks.
    for (let i = 0; i < 5; i++) box(0.006, 0.018, 0.001, colors[variant],
      -0.015 + Math.sin(i * 1.4) * 0.009, -0.04 + i * 0.014, 0.006, [0, 0, Math.cos(i * 1.4) * 0.5]);
  } else throw new Error(`Unknown impact signature: ${kind}`);
  const geometry = mergeGeometries(parts); parts.forEach((g) => g.dispose());
  return { geometry, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
}
