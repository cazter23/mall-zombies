// Shared, tiny impact signatures. Vertex-coloured models batch each signature into one draw call;
// price stickers use three small shared procedural textures rather than one texture per shot.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from '../world/textures.js';
import { drawType } from '../world/typeKit.js';

export function buildImpactModel(kind, variant) {
  if (kind === 'sticker') {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 160);
    // Drop shadow & scuffed adhesive backing
    ctx.fillStyle = 'rgba(20, 18, 22, 0.55)'; ctx.fillRect(14, 18, 232, 130);
    ctx.fillStyle = '#56504a'; ctx.fillRect(12, 16, 230, 126);
    // Fluorescent retail label stock
    ctx.fillStyle = ['#ffe44d', '#ffd28a', '#ff858d'][variant]; ctx.fillRect(18, 10, 220, 132);
    // Subtle paper crease sheen
    const sheen = ctx.createLinearGradient(18, 10, 238, 142);
    sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = sheen; ctx.fillRect(18, 10, 220, 132);
    // Red retail header bar
    ctx.fillStyle = '#b8252a'; ctx.fillRect(23, 15, 210, 30);
    drawType(ctx, 'MEGA MARKDOWN', 128, 31, { role: 'clearance', size: 26, fill: '#fff6dc', maxWidth: 196 });
    // Main price / clearance stamp
    drawType(ctx, ['REDUCED', 'FINAL SALE', '$0.01'][variant], 128, 76, { role: 'clearance', size: 44, fill: '#241e22', maxWidth: 200 });
    // Crisp UPC barcode + feed notches
    ctx.fillStyle = '#1e191d';
    for (let i = 0; i < 26; i++) ctx.fillRect(42 + i * 6.6, 100, i % 4 === 0 ? 4 : i % 2 ? 2 : 3, 24);
    ctx.clearRect(120, 8, 16, 5);
    ctx.clearRect(120, 139, 16, 5);
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
  const hole = (x, y, radius) => {
    part(new THREE.CircleGeometry(radius * 1.38, 8), 0x6e675f, x, y, 0.0006);
    part(new THREE.CircleGeometry(radius, 8), 0x262320, x, y, 0.0012);
  };
  if (kind === 'staple') {
    for (const x of [-0.015, 0.015]) { hole(x, 0, 0.005); pin(0.0026, 0.013, 0xbecad2, x, 0, 0.0065); }
    const tilt = [0, variant ? 0.12 : 0, variant ? 0.08 : 0];
    box(0.036, 0.0055, 0.005, 0xd4dde4, 0, 0, 0.0135, tilt);
    box(0.034, 0.0022, 0.002, 0xf2f7fa, 0, 0.0015, 0.016, tilt);
  } else if (kind === 'rivet') {
    hole(0, 0, 0.018);
    pin(0.013, 0.008, 0xb8c7cc, 0, 0, 0.005);
    pin(0.006, 0.004, 0xe0e8e8, 0, 0, 0.011);
    for (let i = 0; i < 3; i++) box(0.002, 0.022, 0.001, 0x514a41, 0, 0, 0.0016, [0, 0, i * Math.PI / 3 + variant]);
  } else if (kind === 'coilNail') {
    hole(0, 0, 0.012);
    pin(0.0038, 0.046, 0xc7923e, 0, 0, 0.023);
    pin(0.0105, 0.0045, 0xd8a24a, 0, 0, 0.047);
    box(0.016, 0.0025, 0.0018, 0xb87333, 0, 0, 0.049, [0, 0, variant * 0.65]);
  } else if (kind === 'laserBurn') {
    hole(0, 0, 0.02);
    part(new THREE.CircleGeometry(0.014, 8), 0x7a1616, 0, 0, 0.0018);
    part(new THREE.CircleGeometry(0.0075, 8), 0xff3b30, 0, 0, 0.0024);
    for (let i = 0; i < 4; i++) {
      box(0.0024, 0.032, 0.0012, 0x3b1714, 0, 0, 0.0015, [0, 0, i * Math.PI / 4 + variant * 0.4]);
    }
  } else if (kind === 'nail') {
    hole(0, 0, 0.011);
    for (let i = 0; i < 4; i++) box(0.0032, 0.02, 0.0012, 0x4d433a, 0, 0, 0.0016, [0, 0, i * 1.57 + variant]);
    pin(0.0032, 0.056, 0xb2bec9, 0, 0, 0.028);
    pin(0.0088, 0.0045, 0x7c8f9e, 0, 0, 0.057);
    box(0.011, 0.002, 0.0015, 0xdce6ee, 0, 0, 0.06, [0, 0, variant * 0.7]);
  } else if (kind === 'dart') {
    hole(0, 0, 0.010);
    pin(0.013, 0.004, 0xff7b29, 0, 0, 0.003); // squashed suction-cup flange
    pin(0.0095, 0.011, 0xf39b48, 0, 0, 0.008);
    part(new THREE.CylinderGeometry(0.009, 0.009, 0.055, 7), [0x3aa6ff, 0xa864ff, 0x4CE0B3][variant],
      0, -0.002, 0.039, [Math.PI / 2 + 0.10, 0, 0]);
    pin(0.0105, 0.005, 0xffe066, 0, -0.005, 0.068);
  } else if (kind === 'confetti') {
    const random = seededRandom(97 + variant * 123);
    const colors = [0xffcf42, 0xff4f9a, 0x7b5cff, 0x2ec4b6, 0xf1faee, 0xff8a3d];
    for (let i = 0; i < 10; i++) box(0.01, 0.018, 0.0012, colors[i % colors.length],
      (random() - 0.5) * 0.095, (random() - 0.5) * 0.095, 0.002 + i * 0.0003, [0, 0, random() * Math.PI]);
    // Curled party streamers alongside the paper flecks.
    for (let i = 0; i < 6; i++) box(0.0065, 0.019, 0.0012, colors[(variant + i) % colors.length],
      -0.016 + Math.sin(i * 1.35) * 0.011, -0.042 + i * 0.014, 0.006, [0, 0, Math.cos(i * 1.35) * 0.55]);
  } else if (kind === 'returnStamp') {
    // A red rubber-stamp box (RETURNED), a little crooked, with a strip of brown packing tape across a corner.
    const tilt = [0, 0, (variant ? 0.14 : -0.1)];
    const red = 0xd23a3a;
    for (const y of [-0.014, 0.014]) box(0.068, 0.004, 0.0012, red, 0, y, 0.0012, tilt);
    for (const x of [-0.034, 0.034]) box(0.004, 0.032, 0.0012, red, x, 0, 0.0012, tilt);
    for (let i = 0; i < 3; i++) box(0.016, 0.005, 0.0012, red, -0.018 + i * 0.018, 0, 0.0014, tilt); // the lettering, as dashes
    box(0.03, 0.012, 0.001, 0xc9954f, 0.03, 0.02, 0.0022, [0, 0, 0.6 + variant * 0.3]);
  } else if (kind === 'bearing') {
    // The Stargazer 3000: a steel ball bearing half sunk in a cratered dent, with cracks running out from it.
    hole(0, 0, 0.016);
    part(new THREE.SphereGeometry(0.008, 8, 6), 0xd8dee6, 0, 0, 0.003);
    for (let i = 0; i < 5; i++) box(0.0018, 0.03, 0.001, 0x3a342e, 0, 0, 0.0016, [0, 0, i * 1.26 + variant * 0.5]);
  } else throw new Error(`Unknown impact signature: ${kind}`);
  const geometry = mergeGeometries(parts); parts.forEach((g) => g.dispose());
  return { geometry, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.22,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
}
