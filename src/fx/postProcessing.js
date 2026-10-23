// =============================================================================
// POST-PROCESSING PIPELINE
// Wraps the two-pass render (world scene + depth-cleared first-person viewmodel)
// in a 4x MSAA HalfFloat EffectComposer:
//   1. World RenderPass
//   2. UnrealBloomPass (world emissives only; the close-up muzzle sprite must not wash over the whole frame)
//   3. Viewmodel RenderPass (depth cleared on the active target so the gun never clips walls)
//   4. Cinema lens pass (subtle edge chromatic aberration + vignette, boosted slightly during sprint/slide)
//   5. OutputPass (ACES Filmic Tone Mapping + sRGB conversion)
// QUALITY (setQuality, Settings > Video > Visual effects):
//   high  everything above (the default)
//   low   no bloom, no lens pass, no MSAA: world + gun + tone mapping only
//   off   no composer at all: the world and the gun are drawn straight to the screen (the cheapest path)
// Automatically tracks renderer.getPixelRatio() and canvas dimensions so Video settings
// ("Render resolution" slider and Low/Medium/High presets) work seamlessly.
// =============================================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { atmosphere } from '../config/environment.js';

const CinemaLensShader = {
  name: 'CinemaLensShader',
  uniforms: {
    tDiffuse: { value: null },
    aberration: { value: 0.0008 },
    vignetteStrength: { value: 0.22 },
    vignetteSoftness: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float aberration;
    uniform float vignetteStrength;
    uniform float vignetteSoftness;
    varying vec2 vUv;

    void main() {
      vec2 offset = vUv - vec2(0.5);
      float distSq = dot(offset, offset);
      // Radial chromatic aberration only near the outer screen edges (center crosshair is 100% untouched)
      vec2 shift = offset * (distSq * 2.2) * aberration;
      float r = texture2D(tDiffuse, vUv + shift).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - shift).b;
      float a = texture2D(tDiffuse, vUv).a;

      // Subtle corner vignette
      float vig = 1.0 - smoothstep(0.8 - vignetteSoftness, 0.8, length(offset));
      vec3 color = mix(vec3(r, g, b) * (1.0 - vignetteStrength), vec3(r, g, b), vig);
      gl_FragColor = vec4(color, a);
    }
  `,
};

export function createPostProcessing({ renderer, scene, camera, viewmodel }) {
  const cfg = atmosphere.postProcessing ?? {
    exposure: 1.06,
    bloomStrength: 0.25,
    bloomRadius: 0.35,
    bloomThreshold: 0.9,
    aberrationBase: 0.0008,
    aberrationSprintBoost: 0.0018,
    vignetteStrength: 0.22,
    vignetteSoftness: 0.55,
    msaaSamples: 2,
  };

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.exposure;

  let lastWidth = Math.max(1, window.innerWidth);
  let lastHeight = Math.max(1, window.innerHeight);
  let lastPixelRatio = renderer.getPixelRatio();

  // This is the ONLY anti-aliasing in the game (the canvas itself is created without it, see main.js).
  // EffectComposer clones this target for its second buffer, so the sample count is paid twice per frame
  // on a 16-bit float target: it is the biggest single GPU cost knob here (config/environment.js).
  const renderTarget = new THREE.WebGLRenderTarget(
    Math.floor(lastWidth * lastPixelRatio),
    Math.floor(lastHeight * lastPixelRatio),
    { type: THREE.HalfFloatType, samples: cfg.msaaSamples ?? 2 },
  );

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(lastPixelRatio);
  composer.setSize(lastWidth, lastHeight);

  const worldPass = new RenderPass(scene, camera);
  composer.addPass(worldPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(lastWidth, lastHeight),
    cfg.bloomStrength,
    cfg.bloomRadius,
    cfg.bloomThreshold,
  );
  composer.addPass(bloomPass);

  // Composite the first-person gun after bloom. Its muzzle flash is centimetres from the camera;
  // blooming that sprite turns a local burst into a full-screen white flash.
  const viewmodelPass = new RenderPass(viewmodel.scene, viewmodel.camera);
  viewmodelPass.clear = false;
  viewmodelPass.render = (r, writeBuffer, readBuffer) => {
    const oldAutoClear = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(viewmodelPass.renderToScreen ? null : readBuffer);
    r.clearDepth();
    r.render(viewmodel.scene, viewmodel.camera);
    r.autoClear = oldAutoClear;
  };
  composer.addPass(viewmodelPass);

  const lensPass = new ShaderPass(CinemaLensShader);
  lensPass.uniforms.aberration.value = cfg.aberrationBase;
  lensPass.uniforms.vignetteStrength.value = cfg.vignetteStrength;
  lensPass.uniforms.vignetteSoftness.value = cfg.vignetteSoftness;
  composer.addPass(lensPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  // High / low / off (see the header). Switching only flips flags and the MSAA sample count, so it is safe mid-run.
  let quality = 'high';
  const highSamples = renderTarget.samples;
  function setQuality(next) {
    if (!['high', 'low', 'off'].includes(next)) throw new Error(`postProcessing: unknown quality "${next}"`);
    quality = next;
    bloomPass.enabled = next === 'high';
    lensPass.enabled = next === 'high';
    const samples = next === 'high' ? highSamples : 0;
    for (const target of [composer.renderTarget1, composer.renderTarget2]) {
      if (target.samples !== samples) {
        target.samples = samples;
        target.dispose(); // (re-created at the new sample count on its next use)
      }
    }
  }

  function syncSize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const dpr = renderer.getPixelRatio();
    if (width !== lastWidth || height !== lastHeight || dpr !== lastPixelRatio) {
      lastWidth = width;
      lastHeight = height;
      lastPixelRatio = dpr;
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
    }
  }

  return {
    composer,
    bloomPass,
    lensPass,
    setQuality,
    get quality() {
      return quality;
    },
    render({ showViewmodel = true, speedAmount = 0 } = {}) {
      if (quality === 'off') {
        // No composer: the world, then (depth cleared so the gun never clips walls) the gun, straight to the screen.
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(scene, camera);
        if (showViewmodel) {
          renderer.clearDepth();
          renderer.render(viewmodel.scene, viewmodel.camera);
        }
        return;
      }
      syncSize();
      viewmodelPass.enabled = showViewmodel;
      lensPass.uniforms.aberration.value = cfg.aberrationBase + cfg.aberrationSprintBoost * speedAmount;
      composer.render();
    },
    dispose() {
      composer.dispose();
      renderTarget.dispose();
    },
  };
}
