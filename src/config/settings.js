// =============================================================================
// PLAYER SETTINGS (the options menu)
// One entry per setting. The menu (ui/settingsMenu.js) and the saving/loading
// (game/settings.js) are built from this list, so adding a setting = adding one
// entry here. Nothing else needs touching.
//
// Entry fields:
//   id        unique key, also the name it's saved under
//   tab       which tab it appears on (must be in `settingsTabs`)
//   label     shown in the menu
//   type      'toggle' | 'slider' | 'select'
//   default   the starting value (usually read from the other config files)
//   min/max/step  (slider)    options: [{ value, label }] (select)
//   format(v) (optional) how the value is shown, e.g. '75°'
//   apply(v, ctx)  changes the game. `ctx` = { renderer, sound, hud }. Runs on load and on every change.
//
// PRESETS (settingPresets, below): one-click buttons at the top of a tab that set several settings at once
// (e.g. Video: Low / Medium / High). They are not settings themselves (nothing extra is saved).
//
// Most settings simply write into the same config objects the game already reads
// every frame (feel, controls, audio), so changes show up immediately.
// =============================================================================

import { feel } from './feel.js';
import { audio } from './audio.js';
import { gamepad, aimAssist } from './controls.js';

export const settingsTabs = ['Video', 'Mouse', 'Controller', 'Audio', 'Comfort'];
export const menuFeel = { confirmSeconds: 3 };

// The config values as shipped. "Multiplier" settings scale these, so reset always returns to them.
const base = {
  mouseSensitivity: feel.look.mouseSensitivity,
  yawSpeed: gamepad.yawDegreesPerSecond,
  pitchSpeed: gamepad.pitchDegreesPerSecond,
  walkBob: feel.sprintFx.walkBobHeight,
  sprintBob: feel.sprintFx.sprintBobHeight,
  sprintRoll: feel.sprintFx.sprintBobRollDegrees,
  speedLines: feel.sprintFx.speedLinesOpacity,
};

const percent = (v) => `${Math.round(v * 100)}%`;
const times = (v) => `${v.toFixed(2)}x`;
// Render scale is a pixel ratio (kept compatible with saved settings). Show its actual
// relationship to the display, rather than calling one CSS pixel "100%" on every monitor.
export const displayPixelRatio = () => window.devicePixelRatio || 1;
export const nativeRenderRatio = () => Math.min(displayPixelRatio(), 2);
const nativeRatio = nativeRenderRatio();

export const settingDefs = [
  // ---- Video ----
  {
    id: 'fov', tab: 'Video', label: 'Field of view', type: 'slider',
    min: 60, max: 110, step: 1, default: feel.camera.fov,
    format: (v) => `${v}°`,
    apply: (v) => { feel.camera.fov = v; }, // render() reads this every frame (ADS zoom scales from it)
  },
  {
    id: 'showFps', tab: 'Video', label: 'FPS counter', type: 'toggle', default: false,
    apply: (v, ctx) => ctx.hud.setFpsVisible(v),
  },
  {
    id: 'renderScale', tab: 'Video', label: 'Render resolution', type: 'slider',
    min: 0.5, max: 2, step: 0.05, default: nativeRatio,
    format: (v) => `${percent(v / displayPixelRatio())} native`,
    apply: (v, ctx) => ctx.renderer.setPixelRatio(v),
  },

  // ---- Mouse ----
  {
    id: 'mouseSensitivity', tab: 'Mouse', label: 'Mouse sensitivity', type: 'slider',
    min: 0.2, max: 3, step: 0.05, default: 1, format: times,
    apply: (v) => { feel.look.mouseSensitivity = base.mouseSensitivity * v; },
  },
  {
    id: 'mouseInvertY', tab: 'Mouse', label: 'Invert Y axis', type: 'toggle', default: feel.look.invertY,
    apply: (v) => { feel.look.invertY = v; },
  },
  {
    id: 'adsSensitivityScales', tab: 'Mouse', label: 'Slower mouse when zoomed in', type: 'toggle',
    default: feel.ads.sensitivityFollowsZoom,
    apply: (v) => { feel.ads.sensitivityFollowsZoom = v; },
  },

  // ---- Controller ----
  {
    id: 'padLookSpeed', tab: 'Controller', label: 'Look speed', type: 'slider',
    min: 0.5, max: 2, step: 0.05, default: 1, format: times,
    apply: (v) => {
      gamepad.yawDegreesPerSecond = base.yawSpeed * v;
      gamepad.pitchDegreesPerSecond = base.pitchSpeed * v;
    },
  },
  {
    id: 'padInvertY', tab: 'Controller', label: 'Invert Y axis', type: 'toggle', default: gamepad.invertY,
    apply: (v) => { gamepad.invertY = v; },
  },
  {
    id: 'padDeadzone', tab: 'Controller', label: 'Look stick deadzone', type: 'slider',
    min: 0.02, max: 0.4, step: 0.01, default: gamepad.lookDeadzone, format: percent,
    apply: (v) => { gamepad.lookDeadzone = v; },
  },
  {
    id: 'aimAssist', tab: 'Controller', label: 'Aim assist strength', type: 'slider',
    min: 0, max: 1.5, step: 0.05, default: aimAssist.strength, format: percent,
    apply: (v) => { aimAssist.strength = v; },
  },

  // ---- Audio ----
  {
    id: 'masterVolume', tab: 'Audio', label: 'Master volume', type: 'slider',
    min: 0, max: 1, step: 0.05, default: audio.masterVolume, format: percent,
    apply: (v, ctx) => {
      audio.masterVolume = v;
      ctx.sound.setMasterVolume(v);
    },
  },
  {
    id: 'ambienceVolume', tab: 'Audio', label: 'Mall ambience', type: 'slider',
    min: 0, max: 1, step: 0.05, default: audio.ambienceVolume, format: percent,
    apply: (v) => { audio.ambienceVolume = v; },
  },

  // ---- Comfort ----
  {
    id: 'headBob', tab: 'Comfort', label: 'Head bob', type: 'slider',
    min: 0, max: 1.5, step: 0.05, default: 1, format: percent,
    apply: (v) => {
      feel.sprintFx.walkBobHeight = base.walkBob * v;
      feel.sprintFx.sprintBobHeight = base.sprintBob * v;
      feel.sprintFx.sprintBobRollDegrees = base.sprintRoll * v;
    },
  },
  {
    id: 'splatter', tab: 'Comfort', label: 'Zombie splatter', type: 'select', default: 'confetti',
    options: [
      { value: 'confetti', label: 'Confetti' },
      { value: 'red', label: 'Red (blood)' },
      { value: 'off', label: 'Off' },
    ],
    apply: (v) => { feel.effects.blood.mode = v; }, // effects read it on every hit
  },
  {
    id: 'speedLines', tab: 'Comfort', label: 'Sprint speed lines', type: 'toggle', default: true,
    apply: (v) => { feel.sprintFx.speedLinesOpacity = v ? base.speedLines : 0; },
  },
];

// One-click presets per tab: { label, values: { settingId: value } } (shown as buttons at the top of that tab).
export const settingPresets = {
  Video: [
    { label: 'Low', values: { renderScale: Math.max(0.5, nativeRatio * 0.5) } }, // half resolution, within the slider range
    { label: 'Medium', values: { renderScale: Math.max(0.5, nativeRatio * 0.75) } },
    { label: 'High', values: { renderScale: nativeRatio } }, // native, capped at 2x for performance
  ],
  Comfort: [
    { label: 'Calm', values: { headBob: 0, speedLines: false } }, // for motion sickness
    { label: 'Standard', values: { headBob: 1, speedLines: true } },
  ],
};
