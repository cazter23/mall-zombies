// =============================================================================
// POST-PROCESSING PIPELINE
// Wraps the two-pass render (world scene + depth-cleared first-person viewmodel)
// in a 4x MSAA HalfFloat EffectComposer:
//   1. World RenderPass
//   2. UnrealBloomPass (world emissives only; the close-up muzzle sprite must not wash over the whole frame)
//   3. Viewmodel RenderPass (depth cleared on the active target so the gun never clips walls)
//   3b. Grade pass (zone lighting, fx/zoneGrading.js: tint / saturation / contrast; exposure goes through the tone mapping)
//   3c. VHS pass (Graphics > VHS filter, config/look.js `vhs`, off by default: scanlines, colour bleed, grain, a tracking band)
//   4. Cinema lens pass (subtle edge chromatic aberration + vignette, boosted slightly during sprint/slide)
//   5. OutputPass (ACES Filmic Tone Mapping + sRGB conversion)
// QUALITY (setQuality, Settings > Video > Visual effects):
//   high  everything above (the default)
//   low   no bloom, no lens pass, no MSAA: world + gun + tone mapping only
//   off   no composer at all: the world and the gun are drawn straight to the screen (the cheapest path); a zone grade
//         keeps only its exposure there. With the VHS filter on, Off draws like Low instead (the filter needs the composer)
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
import { look } from '../config/look.js';

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

// Zone colour grading (a grade's extra `vignette` darkens the lens pass's edges, High only), in linear HDR before tone mapping: tint, then saturation round the luminance, then contrast round mid grey.
const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    tint: { value: new THREE.Vector3(1, 1, 1) },
    saturation: { value: 1 },
    contrast: { value: 1 },
  },
  vertexShader: CinemaLensShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 tint;
    uniform float saturation;
    uniform float contrast;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = max(texel.rgb * tint, vec3(0.0));
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(luma), c, saturation), vec3(0.0));
      c = 0.18 * pow(c / 0.18, vec3(contrast));
      gl_FragColor = vec4(c, texel.a);
    }
  `,
};

// The VHS tape look, in linear HDR before tone mapping (look.runtime.vhs picks the strength; numbers in look.vhs).
const VhsShader = {
  name: 'VhsShader',
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    strength: { value: 0 },
    resolution: { value: new THREE.Vector2(800, 600) },
    scanlines: { value: 0 },
    bleed: { value: 0 },
    wobble: { value: 0 },
    grain: { value: 0 },
    desaturate: { value: 0 },
    band: { value: new THREE.Vector4(0, 0, 0, 0) }, // height, speed, shift, streaks
  },
  vertexShader: CinemaLensShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float strength;
    uniform vec2 resolution;
    uniform float scanlines;
    uniform float bleed;
    uniform float wobble;
    uniform float grain;
    uniform float desaturate;
    uniform vec4 band;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      // The tracking band rolls down the screen; inside it the picture tears sideways and streaks.
      float bandY = 1.0 - fract(time * band.y);
      float inBand = 1.0 - smoothstep(0.0, band.x, abs(uv.y - bandY));
      float line = floor(uv.y * resolution.y);
      uv.x += sin(uv.y * 40.0 + time * 1.7) * wobble * strength;
      uv.x += (hash(vec2(line, floor(time * 30.0))) - 0.5) * band.z * inBand * strength;

      // Colour bleed: red and blue smeared to either side of the brightness.
      float b = bleed * strength;
      vec3 c;
      c.r = (texture2D(tDiffuse, uv + vec2(b, 0.0)).r + texture2D(tDiffuse, uv + vec2(b * 2.0, 0.0)).r) * 0.5;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = (texture2D(tDiffuse, uv - vec2(b, 0.0)).b + texture2D(tDiffuse, uv - vec2(b * 2.0, 0.0)).b) * 0.5;
      float a = texture2D(tDiffuse, uv).a;

      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, vec3(luma), desaturate * strength);
      // Scanlines (one dark line every 2 screen pixels), grain, and the band's streaks.
      float scan = 0.5 + 0.5 * cos(vUv.y * resolution.y * 3.14159265);
      c *= 1.0 - scanlines * strength * scan;
      float n = hash(vUv * resolution + fract(time) * 100.0) - 0.5;
      c += n * grain * strength * (0.4 + luma);
      c += inBand * band.w * strength * step(0.985, hash(vec2(floor(vUv.x * resolution.x * 0.25), line + floor(time * 24.0))));
      gl_FragColor = vec4(max(c, vec3(0.0)), a);
    }
  `,
};

/** How strong the VHS filter is for a setting value ('off' | 'subtle' | 'full'). */
export function vhsStrength(mode = look.runtime.vhs) {
  return look.vhs.strength[mode] ?? 0;
}

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
    { type: THREE.HalfFloatType, samples: cfg.msaaSamples ?? 2, stencilBuffer: true },
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

  const gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);

  const vhsPass = new ShaderPass(VhsShader);
  vhsPass.enabled = false;
  composer.addPass(vhsPass);

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
    /** Is the frame drawn through the composer's buffers (true) or straight to the screen (false: Off, no VHS filter)? */
    get usesComposer() {
      return !(quality === 'off' && vhsStrength() === 0);
    },
    gradePass,
    vhsPass,
    /** grade: { exposure, tint, saturation, contrast } (fx/zoneGrading.js), or null for none. */
    render({ showViewmodel = true, speedAmount = 0, grade = null } = {}) {
      renderer.toneMappingExposure = cfg.exposure * (grade?.exposure ?? 1);
      const vhs = vhsStrength();
      if (quality === 'off' && vhs === 0) {
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
      vhsPass.enabled = vhs > 0;
      if (vhs > 0) {
        const u = vhsPass.uniforms;
        const V = look.vhs;
        u.strength.value = vhs;
        u.time.value = performance.now() / 1000;
        u.resolution.value.set(lastWidth * lastPixelRatio, lastHeight * lastPixelRatio);
        u.scanlines.value = V.scanlines;
        u.bleed.value = V.bleed;
        u.wobble.value = V.wobble;
        u.grain.value = V.grain;
        u.desaturate.value = V.desaturate;
        u.band.value.set(V.trackingBand.height, V.trackingBand.speed, V.trackingBand.shift, V.trackingBand.streaks);
      }
      const neutral = !grade || (grade.saturation === 1 && grade.contrast === 1 && grade.tint.every((t) => t === 1));
      gradePass.enabled = !neutral; // (no extra full-screen pass while there's nothing to grade)
      if (!neutral) {
        gradePass.uniforms.tint.value.fromArray(grade.tint);
        gradePass.uniforms.saturation.value = grade.saturation;
        gradePass.uniforms.contrast.value = grade.contrast;
      }
      lensPass.uniforms.aberration.value = cfg.aberrationBase + cfg.aberrationSprintBoost * speedAmount;
      lensPass.uniforms.vignetteStrength.value = Math.min(0.9, cfg.vignetteStrength + (grade?.vignette ?? 0));
      composer.render();
    },
    dispose() {
      composer.dispose();
      renderTarget.dispose();
    },
  };
}
