// =============================================================================
// SKIN TREATMENTS: the shared glow and motion of slot 3 (feat) skins. A skin's `treatment` (config/skins.js, numbers in skinTreatments)
// lights the meshes painted in one palette ROLE with emissive light and animates it from the model's own animate(): no lights, no new
// meshes (so no draw calls). Four kinds, shared by all eleven feat skins:
//   pulse      the role breathes, all together
//   edgeGlow   a steady glow with a slight flicker (for trims: role 'dark')
//   shimmer    a band of light runs from the back of the gun to the muzzle: a tiny band texture (a DataTexture, so it needs no canvas)
//              as the emissive map, the lit meshes' UVs laid along the gun, and the texture's offset slid each frame
//   drift      the glow's colour wanders through the skin's `colors`
// A material that already glows (a sight, the scanner's window and coil) is the model's own light: a treatment never touches it.
//
//   applySkinTreatment(root, def, skinId) -> { kind, materials, animate(time) } | null   (also root.userData.skinTreatment)
//   peakGlow(treatment) -> the brightest it gets, as a share of full unlit colour (tests keep it under skinTreatments.maxGlow)
// =============================================================================

import * as THREE from 'three';
import { gunSkin } from '../../config/skins.js';
import { gunPaletteKeys } from '../../config/gunPalettes.js';
import { resolveGunColors } from '../skinPalette.js';

// The model keys every gun has, by role (a gun's extra keys and their roles: config/gunPalettes.js).
const CORE_KEYS = { bodyColor: 'body', darkColor: 'dark', metalColor: 'metal', gripColor: 'grip', accentColor: 'accent', sightColor: 'sight' };
const BAND_TEXELS = 128;

/** The colours a role is painted in on this gun in this skin (several model keys can share one role). */
export function roleColors(def, skinId, role) {
  const colors = resolveGunColors(def, skinId);
  const keys = Object.entries({ ...CORE_KEYS, ...(gunPaletteKeys[def.id] ?? {}) }).filter(([, r]) => r === role).map(([key]) => key);
  return new Set(keys.map(key => colors[key]).filter(Number.isInteger));
}

/** The brightest a treatment glows: its brightest colour's brightest channel, at its high intensity (1 = full unlit colour). */
export function peakGlow(treatment) {
  const colors = treatment.colors ?? [treatment.color];
  const channel = Math.max(...colors.map(hex => Math.max(hex >> 16 & 255, hex >> 8 & 255, hex & 255))) / 255;
  return channel * treatment.high;
}

const TAU = Math.PI * 2;
const smooth = x => x * x * (3 - 2 * x);

// The glow's strength (0..1, between low and high) at `time`, for the kinds that light everything at once.
const STRENGTH = {
  pulse: (t, p) => 0.5 - 0.5 * Math.cos(TAU * t / p.period),
  edgeGlow: (t, p) => { const a = TAU * t / p.period; return 1 - (0.5 + 0.5 * Math.sin(a)) * (0.5 + 0.5 * Math.sin(a * 1.7 + 1)); },
  drift: (t, p) => 0.5 - 0.5 * Math.cos(TAU * t / p.period),
};
const KINDS = new Set([...Object.keys(STRENGTH), 'shimmer']);

// Shimmer: the gun spans `span` of the texture's width (the rest is the dark gap between sweeps); the band is `width` of the gun's
// length either side of its centre, at low/high of full strength elsewhere.
function bandTexture(p) {
  const span = 1 / (1 + 2 * p.width), half = p.width * span, floor = p.low / p.high;
  const data = new Uint8Array(BAND_TEXELS * 4);
  for (let i = 0; i < BAND_TEXELS; i++) {
    const u = (i + 0.5) / BAND_TEXELS;
    const k = smooth(Math.max(0, 1 - Math.abs(u - 0.5) / half));
    const v = Math.round(255 * (floor + (1 - floor) * k));
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, BAND_TEXELS, 1);
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, span };
}

// A copy of the mesh's geometry whose U runs along the gun: 0 at the back, `span` at the muzzle (V is unused: the band is 1 texel tall).
function alongGeometry(mesh, toRoot, back, length, span) {
  const geometry = mesh.geometry.clone();
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  const matrix = toRoot.clone().multiply(mesh.matrixWorld), p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i).applyMatrix4(matrix);
    uv[i * 2] = (back - p.z) / length * span;
    uv[i * 2 + 1] = 0.5;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** Lights a built gun (or display) in its skin's treatment. Returns the controller, or null when the skin has none. */
export function applySkinTreatment(root, def, skinId) {
  const skin = gunSkin(def.id, skinId);
  const treatment = skin?.treatment;
  if (!treatment || !root || !KINDS.has(treatment.kind)) return null;
  const hexes = roleColors(def, skinId, treatment.role);
  const meshes = [];
  root.traverse(mesh => {
    const material = mesh.isMesh && !Array.isArray(mesh.material) ? mesh.material : null;
    const glowing = material?.emissive && material.emissiveIntensity > 0 && material.emissive.getHex() !== 0;
    if (material?.emissive && material.color && !material.map && !glowing && hexes.has(material.color.getHex())) meshes.push(mesh);
  });
  if (!meshes.length) return null;

  let band = null;
  if (treatment.kind === 'shimmer') {
    root.updateMatrixWorld(true);
    const toRoot = root.matrixWorld.clone().invert();
    const bounds = new THREE.Box3(), box = new THREE.Box3();
    for (const mesh of meshes) bounds.union(box.setFromObject(mesh).applyMatrix4(toRoot));
    band = bandTexture(treatment);
    const length = Math.max(1e-3, bounds.max.z - bounds.min.z);
    for (const mesh of meshes) mesh.geometry = alongGeometry(mesh, toRoot, bounds.max.z, length, band.span);
  }

  const lit = new Map(); // the model's material -> its one lit clone
  for (const mesh of meshes) {
    if (!lit.has(mesh.material)) {
      const material = mesh.material.clone();
      material.name = `${mesh.material.name || 'skin'}:${treatment.kind}`;
      material.emissive.setHex(treatment.colors?.[0] ?? treatment.color);
      material.emissiveIntensity = band ? treatment.high : treatment.low;
      if (band) material.emissiveMap = band.texture;
      material.userData = { ...mesh.material.userData, skinTreatment: skin.id };
      lit.set(mesh.material, material);
    }
    mesh.material = lit.get(mesh.material);
  }

  const materials = [...lit.values()];
  const strength = STRENGTH[treatment.kind];
  const from = new THREE.Color(), to = new THREE.Color();
  const controller = {
    kind: treatment.kind,
    materials,
    /** `time` in seconds (any clock that keeps running). */
    animate(time) {
      if (band) { band.texture.offset.x = -(time / treatment.period % 1); return; } // (sampling u + offset: the band moves to higher u, the muzzle)
      if (treatment.kind === 'drift') {
        const colors = treatment.colors, u = time / treatment.period, i = Math.floor(u), n = colors.length;
        from.setHex(colors[((i % n) + n) % n]).lerp(to.setHex(colors[(((i + 1) % n) + n) % n]), smooth(u - i));
      }
      const intensity = treatment.low + (treatment.high - treatment.low) * strength(time, treatment);
      for (const material of materials) {
        material.emissiveIntensity = intensity;
        if (treatment.kind === 'drift') material.emissive.copy(from);
      }
    },
  };
  controller.animate(0);
  root.userData.skinTreatment = controller;
  return controller;
}
