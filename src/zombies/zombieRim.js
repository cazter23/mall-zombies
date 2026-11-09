// =============================================================================
// ZOMBIE EDGE GLOW: a soft rim of light round each zombie's silhouette, so it reads against the bright pastel walls
// (config/look.js zombieRim; colour by kind, bosses their own). A small addition to the standard material's shader
// (light added where a face turns away from the camera), so it costs no draw calls and survives hit flashes, which
// change the material's own emissive. Applied once, when a zombie's model is built (zombies/zombie.js).
//
//   applyZombieRim(root, type)   every standard material under root gets the rim in type's colour
//   rimColorFor(type)            the colour (hex) a kind gets
// =============================================================================

import * as THREE from 'three';
import { look } from '../config/look.js';

/** The rim colour of a zombie kind: bosses share one, kinds can have their own, everyone else the default. */
export function rimColorFor(type) {
  const colors = look.zombieRim.colors;
  if (type?.boss) return colors.boss;
  if (type?.mascot) return colors.mascot; // (every costume)
  if (type?.plastic) return colors.mannequin;
  return colors[type?.id] ?? colors.default;
}

function addRim(material, color) {
  if (material.userData.rim) return;
  const { power, strength } = look.zombieRim;
  const uniforms = { rimColor: { value: new THREE.Color(color).multiplyScalar(strength) }, rimPower: { value: power } };
  material.userData.rim = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n'
        + '  totalEmissiveRadiance += rimColor * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), rimPower);');
  };
  material.customProgramCacheKey = () => 'zombieRim'; // (one program for every rimmed material)
  material.needsUpdate = true;
}

/** Gives every standard material under `root` the rim, in the colour of `type`. */
export function applyZombieRim(root, type) {
  const color = rimColorFor(type);
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m?.isMeshStandardMaterial && !m.transparent) addRim(m, color);
    }
  });
}
