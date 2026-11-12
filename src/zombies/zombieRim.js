// =============================================================================
// ZOMBIE EDGES: what makes a zombie's silhouette read against the background (config/look.js zombieRim). In bright areas
// a DARK edge (faces turning away from the camera shade towards deep plum, like an ink line: a light rim is invisible
// on pastel walls); where the view is dim (back of house, late rounds, power cuts) a soft LIGHT rim in the kind's colour
// instead (bosses their own). A small addition to the standard material's shader, so it costs no draw calls and survives
// hit flashes, which change the material's own emissive. Applied once, when a zombie's model is built (zombies/zombie.js).
//
//   applyZombieRim(root, type)   every standard material under root gets the edge, its light rim in type's colour
//   rimColorFor(type)            the light rim's colour (hex) a kind gets
//   setRimDaylight(exposure)     main.js, each frame: the view's exposure picks dark edge vs light rim (rimDaylightFor)
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

// Shared by every rimmed material: 1 = dark edge (bright areas), 0 = light rim (dim areas). main.js sets it each frame
// from the view's exposure (setRimDaylight), so no material needs touching when the light changes.
const darkEdge = look.zombieRim.darkEdge;
export const rimShared = {
  rimDaylight: { value: 1 },
  edgeColor: { value: new THREE.Color(darkEdge.color) },
  edgePower: { value: darkEdge.power },
  edgeStrength: { value: darkEdge.strength },
};

/** How dark-edged the zombies are for a view exposure (0 = light rim, 1 = dark edge). Pure (tested). */
export function rimDaylightFor(exposure) {
  const [light, dark] = look.zombieRim.darkBelow;
  const t = (exposure - light) / (dark - light);
  return Math.min(1, Math.max(0, t));
}

/** main.js, every frame: the view's exposure (zone grade x horror) decides between the dark edge and the light rim. */
export function setRimDaylight(exposure) {
  rimShared.rimDaylight.value = rimDaylightFor(exposure);
}

function addRim(material, color) {
  if (material.userData.rim) return;
  const { power, strength } = look.zombieRim;
  const uniforms = { rimColor: { value: new THREE.Color(color).multiplyScalar(strength) }, rimPower: { value: power } };
  material.userData.rim = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, rimShared);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;\n'
        + 'uniform float rimDaylight;\nuniform vec3 edgeColor;\nuniform float edgePower;\nuniform float edgeStrength;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n'
        + '  float rimFacing = 1.0 - saturate(dot(normal, normalize(vViewPosition)));\n'
        + '  totalEmissiveRadiance += rimColor * pow(rimFacing, rimPower) * (1.0 - rimDaylight);')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n'
        + '  gl_FragColor.rgb = mix(gl_FragColor.rgb, edgeColor, saturate(pow(rimFacing, edgePower) * edgeStrength * rimDaylight));');
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
