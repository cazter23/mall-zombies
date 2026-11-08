// =============================================================================
// METAL SHEEN: something for metal to reflect.
// A PBR metal gets almost all of its colour from reflections, and the mall has no environment map, so steel, chrome and
// brass (escalators, rails, shutter tracks, shelving) rendered nearly black. Lighting the whole scene with an environment
// lifts every wall too, so instead a tiny gradient (ceiling above, horizon, floor below: config/look.js metalSheen) is
// baked ONCE and handed to metal materials only. No draw calls, no per-frame work; a 64 x 32 bake at load.
// Browser side only (it needs the renderer): main.js calls it after static batching, so the merged materials get it too.
//
//   const env = sheenEnvironment(renderer, look.metalSheen)
//   applyMetalSheen(map.group, env, look.metalSheen)   -> how many materials got it
// =============================================================================

import * as THREE from 'three';

/** The gradient as a prefiltered environment texture (PMREM). `size` = the gradient's width in pixels (height = size / 2). */
export function sheenEnvironment(renderer, { ceiling, horizon, floor, size }) {
  const width = size, height = size / 2;
  const data = new Uint8Array(width * height * 4);
  const low = new THREE.Color(floor), mid = new THREE.Color(horizon), high = new THREE.Color(ceiling), c = new THREE.Color();
  for (let row = 0; row < height; row++) {
    const v = row / (height - 1); // row 0 = straight down, the last row = straight up (equirectangular)
    if (v < 0.5) c.copy(low).lerp(mid, v * 2);
    else c.copy(mid).lerp(high, (v - 0.5) * 2);
    for (let x = 0; x < width; x++) {
      const i = (row * width + x) * 4;
      data[i] = Math.round(c.r * 255); data[i + 1] = Math.round(c.g * 255); data[i + 2] = Math.round(c.b * 255); data[i + 3] = 255;
    }
  }
  const gradient = new THREE.DataTexture(data, width, height);
  gradient.mapping = THREE.EquirectangularReflectionMapping;
  gradient.colorSpace = THREE.SRGBColorSpace;
  gradient.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(gradient).texture;
  pmrem.dispose();
  gradient.dispose();
  return env;
}

/** Every standard material under `root` metallic enough to need a reflection and without one already (each once). */
export function metalMaterials(root, minMetalness) {
  const found = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m?.isMeshStandardMaterial && m.metalness >= minMetalness && !m.envMap) found.add(m);
    }
  });
  return [...found];
}

/** Hands `envMap` to every metal material under `root`. Returns how many. */
export function applyMetalSheen(root, envMap, { minMetalness, intensity }) {
  const materials = metalMaterials(root, minMetalness);
  for (const m of materials) {
    m.envMap = envMap;
    m.envMapIntensity = intensity;
    m.needsUpdate = true;
  }
  return materials.length;
}
