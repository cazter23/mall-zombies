// =============================================================================
// ZOMBIE EDGES: what makes a zombie's silhouette read against the background (config/look.js zombieRim). In bright areas
// a DARK edge (faces turning away from the camera shade towards deep plum, like an ink line: a light rim is invisible
// on pastel walls); where the view is dim (back of house, late rounds, power cuts) a soft LIGHT rim in the kind's colour
// instead (bosses their own). A small addition to the standard material's shader, so it costs no draw calls and survives
// hit flashes, which change the material's own emissive. Applied once, when a zombie's model is built (zombies/zombie.js).
//
//   applyZombieRim(root, type)       every standard material under root gets the edge, its light rim in type's colour
//   rimColorFor(type)                the light rim's colour (hex) a kind gets
//   setRimDaylight(exposure)         main.js, each frame: the view's exposure picks dark edge vs light rim (rimDaylightFor)
//   setZombieStraggler(root, on)     toggles the per-zombie straggler rim uniform + shared through-walls silhouette mesh
//   syncStragglerHighlights(roots)   reconciles highlighted zombie roots with the active straggler list
//   setStragglerPulse(time)          main.js, each frame when stragglers active: updates the shared pulse uniform
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
const strag = look.zombieRim.straggler;
export const rimShared = {
  rimDaylight: { value: 1 },
  edgeColor: { value: new THREE.Color(darkEdge.color) },
  edgePower: { value: darkEdge.power },
  edgeStrength: { value: darkEdge.strength },
  stragglerColor: { value: new THREE.Color(strag.color) },
  stragglerEdgeColor: { value: new THREE.Color(strag.darkEdgeColor) },
  stragglerPower: { value: strag.power },
  stragglerStrength: { value: strag.strength },
  stragglerEdgeStrength: { value: strag.edgeStrength },
  stragglerPulse: { value: 1 },
};

const throughWallShared = {
  uColor: { value: new THREE.Color(strag.throughWallColor) },
  uOpacity: { value: strag.throughWallOpacity },
  uPower: { value: strag.throughWallPower },
  uCore: { value: strag.throughWallCore },
  uPulse: rimShared.stragglerPulse,
};

let sharedThroughWallMaterial = null;
function getThroughWallMaterial() {
  if (sharedThroughWallMaterial) return sharedThroughWallMaterial;
  // Rendered only where depth is GREATER than the scene buffer (i.e. occluded behind a wall/pillar) with negative
  // polygonOffset so visible front faces of the zombie itself never self-fight against this silhouette pass.
  sharedThroughWallMaterial = new THREE.ShaderMaterial({
    uniforms: throughWallShared,
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPower;
      uniform float uCore;
      uniform float uPulse;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0);
        float factor = mix(uCore, 1.0, pow(rim, uPower));
        float alpha = clamp(uOpacity * factor * uPulse, 0.0, 1.0);
        gl_FragColor = vec4(uColor * (1.25 * uPulse), alpha);
      }
    `,
    depthTest: true,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
    transparent: true,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
    toneMapped: false,
  });
  sharedThroughWallMaterial.userData.shared = true;
  return sharedThroughWallMaterial;
}

/** Updates the breathing pulse shared by visible straggler rims and through-wall silhouettes. */
export function setStragglerPulse(time) {
  const { pulseSpeed, pulseMin } = look.zombieRim.straggler;
  const wave = 0.5 + 0.5 * Math.sin(time * pulseSpeed);
  rimShared.stragglerPulse.value = pulseMin + (1 - pulseMin) * wave;
}

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
  const uniforms = {
    rimColor: { value: new THREE.Color(color).multiplyScalar(strength) },
    rimPower: { value: power },
    straggler: { value: 0 },
  };
  material.userData.rim = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, rimShared);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;\nuniform float straggler;\n'
        + 'uniform float rimDaylight;\nuniform vec3 edgeColor;\nuniform float edgePower;\nuniform float edgeStrength;\n'
        + 'uniform vec3 stragglerColor;\nuniform vec3 stragglerEdgeColor;\nuniform float stragglerPower;\n'
        + 'uniform float stragglerStrength;\nuniform float stragglerEdgeStrength;\nuniform float stragglerPulse;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n'
        + '  float rimFacing = 1.0 - saturate(dot(normal, normalize(vViewPosition)));\n'
        + '  totalEmissiveRadiance += rimColor * pow(rimFacing, rimPower) * (1.0 - rimDaylight);\n'
        + '  totalEmissiveRadiance += stragglerColor * pow(rimFacing, stragglerPower) * (stragglerStrength * straggler * stragglerPulse);')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n'
        + '  gl_FragColor.rgb = mix(gl_FragColor.rgb, edgeColor, saturate(pow(rimFacing, edgePower) * edgeStrength * rimDaylight));\n'
        + '  if (straggler > 0.0) {\n'
        + '    float sGold = saturate(pow(rimFacing, stragglerPower) * stragglerStrength * straggler * stragglerPulse);\n'
        + '    float sInk = saturate(pow(rimFacing, stragglerPower + 1.8) * stragglerEdgeStrength * straggler * rimDaylight);\n'
        + '    gl_FragColor.rgb = mix(gl_FragColor.rgb, stragglerColor * (1.1 * stragglerPulse), sGold * rimDaylight);\n'
        + '    gl_FragColor.rgb = mix(gl_FragColor.rgb, stragglerEdgeColor, sInk);\n'
        + '  }');
  };
  material.customProgramCacheKey = () => 'zombieRim'; // (one program for every rimmed material)
  material.needsUpdate = true;
}

const activeStragglers = new Set();
const overlayMeshesByRoot = new WeakMap();

/** Gives every standard material under `root` the rim, in the colour of `type`. */
export function applyZombieRim(root, type) {
  const color = rimColorFor(type);
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.stragglerOverlay) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m?.isMeshStandardMaterial && !m.transparent) addRim(m, color);
    }
  });
}

function detachStragglerOverlays(root) {
  const overlays = overlayMeshesByRoot.get(root);
  if (!overlays) return;
  for (const m of overlays) m.removeFromParent();
  overlayMeshesByRoot.delete(root);
}

function attachStragglerOverlays(root) {
  if (overlayMeshesByRoot.has(root)) return;
  const mat = getThroughWallMaterial();
  const targets = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.stragglerOverlay || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m?.userData?.rim)) targets.push(o);
  });
  const created = [];
  for (const host of targets) {
    const overlay = new THREE.Mesh(host.geometry, mat);
    overlay.renderOrder = 5;
    overlay.frustumCulled = host.frustumCulled;
    overlay.userData.stragglerOverlay = true;
    host.add(overlay);
    created.push(overlay);
  }
  overlayMeshesByRoot.set(root, created);
}

/** Toggles the straggler highlight (on-screen rim uniform + shared through-walls silhouette) on one zombie root. */
export function setZombieStraggler(root, on) {
  if (!root) return;
  const value = on ? 1 : 0;
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.stragglerOverlay) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m?.userData?.rim) continue;
      m.userData.rim.straggler.value = value;
      // Write stencil = 1 where the straggler's real mesh is visible (passes depth test) so the
      // GreaterDepth through-wall overlay never bleeds over visible recessed body parts.
      m.stencilWrite = !!on;
      if (on) {
        m.stencilRef = 1;
        m.stencilFunc = THREE.AlwaysStencilFunc;
        m.stencilFail = THREE.KeepStencilOp;
        m.stencilZFail = THREE.KeepStencilOp;
        m.stencilZPass = THREE.ReplaceStencilOp;
      }
    }
  });
  if (on) {
    activeStragglers.add(root);
    attachStragglerOverlays(root);
  } else {
    activeStragglers.delete(root);
    detachStragglerOverlays(root);
  }
}

/** Reconciles all active straggler highlights against the current target roots (pass [] to clear all). */
export function syncStragglerHighlights(roots = []) {
  const next = new Set(roots.filter(Boolean));
  for (const prev of [...activeStragglers]) {
    if (!next.has(prev)) setZombieStraggler(prev, false);
  }
  for (const root of next) {
    if (!activeStragglers.has(root)) setZombieStraggler(root, true);
    else {
      // Ensure uniform remains set if new material appeared.
      setZombieStraggler(root, true);
    }
  }
}
