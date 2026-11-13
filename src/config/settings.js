// =============================================================================
// PLAYER SETTINGS (the options menu)
// One entry per setting. The menu (ui/settingsMenu.js) and the saving/loading
// (game/settings.js) are built from this list, so adding a setting = adding one
// entry here. Nothing else needs touching.
//
// Entry fields:
//   id        unique key, also the name it's saved under
//   tab       which tab it appears on (must be in `settingsTabs`); null = not in the menu: a remembered choice
//             (the run mode), which no preset sets and "Reset everything" leaves alone
//   label     shown in the menu
//   type      'toggle' | 'slider' | 'select'
//   default   the starting value (usually read from the other config files)
//   min/max/step  (slider)    options: [{ value, label }] (select)
//   format(v) (optional) how the value is shown, e.g. '75°'
//   apply(v, ctx)  changes the game. `ctx` = { renderer, sound, hud }. Runs on load and on every change.
//   cost      (Graphics settings) how much it costs to run: 'low' | 'medium' | 'high' (shown as a tag in the menu)
//
// PRESETS (settingPresets, below): one-click buttons at the top of a tab that set several settings at once
// (e.g. Graphics: Potato / Low / Medium / High). They are not settings themselves (nothing extra is saved).
//
// GRAPHICS: every visual feature that costs performance is one entry on the Graphics tab, with its `cost`, and each
// Graphics preset sets all of them. A new effect (neon glow, reflections, fog, clutter...) = one entry here + its value
// in every Graphics preset (tests/settingsPresets.test.js checks no Graphics setting is left out of a preset).
//
// Most settings simply write into the same config objects the game already reads
// every frame (feel, controls, audio), so changes show up immediately.
// =============================================================================

import { feel } from './feel.js';
import { audio } from './audio.js';
import { haptics } from './haptics.js';
import { gamepad, aimAssist } from './controls.js';
import { atmosphere } from './environment.js';
import { look } from './look.js';
import { bossComfort } from './bosses.js';
import { idle } from './idle.js';
import { closingTime } from './closingTime.js';

export const settingsTabs = ['Graphics', 'Mouse', 'Controller', 'Audio', 'Comfort'];
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
  // ---- Graphics (was Video) ----
  {
    id: 'fov', tab: 'Graphics', label: 'Field of view', type: 'slider',
    min: 60, max: 110, step: 1, default: feel.camera.fov,
    format: (v) => `${v}°`,
    apply: (v) => { feel.camera.fov = v; }, // render() reads this every frame (ADS zoom scales from it)
  },
  {
    id: 'showFps', tab: 'Graphics', label: 'FPS counter', type: 'toggle', default: false,
    apply: (v, ctx) => ctx.hud.setFpsVisible(v),
  },
  {
    id: 'idleSaver', tab: 'Graphics', label: 'Save power when idle', type: 'toggle', default: idle.enabled,
    hint: 'On the title, pause and results screens: draws slowly, then stops, when nothing is pressed. Any key, click or controller button wakes it. Never touches a live run.',
    apply: (v) => { idle.enabled = v; }, // the idle saver reads config/idle.js every check
  },
  {
    id: 'idleDelay', tab: 'Graphics', label: 'Idle delay', type: 'select', default: idle.delay,
    options: [
      { value: 'short', label: 'Short (15 s, then 1 min)' },
      { value: 'normal', label: 'Normal (30 s, then 2 min)' },
      { value: 'long', label: 'Long (1 min, then 5 min)' },
    ],
    apply: (v) => { idle.delay = v; },
  },
  {
    id: 'renderScale', tab: 'Graphics', label: 'Render resolution', type: 'slider',
    min: 0.5, max: 2, step: 0.05, default: nativeRatio, cost: 'high',
    format: (v) => `${percent(v / displayPixelRatio())} native`,
    apply: (v, ctx) => ctx.renderer.setPixelRatio(v),
  },

  {
    id: 'visualEffects', tab: 'Graphics', label: 'Visual effects', type: 'select', default: 'high', cost: 'high',
    options: [
      { value: 'high', label: 'High' }, // bloom glow, lens vignette / colour fringing, smooth edges
      { value: 'low', label: 'Low' }, // no bloom or lens, no anti-aliasing
      { value: 'off', label: 'Off' }, // drawn straight to the screen: the fastest
    ],
    apply: (v, ctx) => ctx.postProcessing?.setQuality(v),
  },
  {
    id: 'ambientEffects', tab: 'Graphics', label: 'Dust and flickering lights', type: 'toggle', default: true, cost: 'medium',
    apply: (v) => { atmosphere.ambient.enabled = v; },
  },
  {
    // Real lamps cost on every lit surface. Below 'All', a few real lights follow you round the map's lamps (fx/lightPool.js).
    id: 'lampCount', tab: 'Graphics', label: 'Lamps', type: 'select', default: 'all', cost: 'high',
    options: [
      { value: 'all', label: 'All' },
      { value: 8, label: '8 nearest' },
      { value: 6, label: '6 nearest' },
      { value: 4, label: '4 nearest' },
    ],
    apply: (v, ctx) => ctx.lightPool?.setSize(v),
  },
  {
    // Neon halos and the soft painted light under signs and trim (maps/mall/hallwayLook.js reads it every tick).
    id: 'neonGlow', tab: 'Graphics', label: 'Neon glow', type: 'toggle', default: true, cost: 'medium',
    apply: (v) => { look.runtime.neonGlow = v; },
  },
  {
    // Scattered trash, receipts, puddles... (world/scatter.js; read every tick).
    id: 'clutter', tab: 'Graphics', label: 'Clutter', type: 'select', default: 'full', cost: 'medium',
    options: [
      { value: 'full', label: 'Full' },
      { value: 'some', label: 'Some' },
      { value: 'none', label: 'None' },
    ],
    apply: (v) => { look.runtime.clutter = v; },
  },
  {
    // Small signs, posters and labels hidden beyond a distance (fx/detailCulling.js): each is its own draw call, which is
    // what weak computers choke on. Read every frame.
    id: 'detailDistance', tab: 'Graphics', label: 'Small detail', type: 'select', default: 'all', cost: 'medium',
    options: [
      { value: 'all', label: 'Everywhere' },
      { value: 'near', label: 'Near (22 m)' },
      { value: 'close', label: 'Close (14 m)' },
    ],
    apply: (v) => { look.runtime.detailDistance = v; },
  },
  {
    // Zone lighting: each area's colour grade (dark, sickly back of house; fx/zoneGrading.js). One cheap full-screen pass.
    id: 'zoneGrading', tab: 'Graphics', label: 'Zone lighting', type: 'toggle', default: true, cost: 'low',
    apply: (v) => { look.runtime.zoneGrading = v; },
  },
  {
    // The VHS tape look (fx/postProcessing.js VhsShader): a style choice, so no cost tag and no preset changes it.
    // One cheap full-screen pass; with Visual effects Off it still shows (that frame is drawn like Low).
    id: 'vhsFilter', tab: 'Graphics', label: 'VHS filter', type: 'select', default: 'off',
    options: [
      { value: 'off', label: 'Off' },
      { value: 'subtle', label: 'Subtle' },
      { value: 'full', label: 'Full' },
    ],
    apply: (v) => { look.runtime.vhs = v; },
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

  {
    id: 'padVibration', tab: 'Controller', label: 'Controller vibration', type: 'slider',
    min: 0, max: 1, step: 0.05, default: haptics.strength, format: percent,
    apply: (v, ctx) => { haptics.strength = v; ctx.haptics?.setStrength(v); },
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

  {
    id: 'musicVolume', tab: 'Audio', label: 'Background music', type: 'slider',
    min: 0, max: 1, step: 0.05, default: audio.musicVolume, format: percent,
    apply: (v, ctx) => { audio.musicVolume = v; ctx.sound.setMusicVolume?.(v); },
  },
  {
    id: 'idleMute', tab: 'Audio', label: 'Mute when asleep', type: 'toggle', default: idle.muteWhenAsleep,
    hint: 'When Save power when idle has put the game to sleep, the sound stops too, and carries on when you come back.',
    apply: (v) => { idle.muteWhenAsleep = v; },
  },

  // ---- Comfort ----
  {
    id: 'uiScale', tab: 'Comfort', label: 'UI scale', type: 'slider',
    min: 0.85, max: 1.35, step: 0.05, default: 1, format: percent,
    hint: 'Size of menus and HUD panels. Independent of 3D render resolution.',
    apply: (v, ctx) => ctx.hud?.setUiScale?.(v),
  },
  {
    id: 'textSize', tab: 'Comfort', label: 'Text size', type: 'slider',
    min: 1, max: 1.5, step: 0.05, default: 1, format: percent,
    hint: 'Enlarges readable text; panels wrap and scroll to fit.',
    apply: (v, ctx) => ctx.hud?.setTextSize?.(v),
  },
  {
    id: 'toggleSprint', tab: 'Comfort', label: 'Toggle sprint', type: 'toggle', default: false,
    hint: 'Press sprint once to run until you stop moving or fire.',
    apply: (v) => { feel.sprint.toggle = v; },
  },
  {
    id: 'toggleCrouch', tab: 'Comfort', label: 'Toggle crouch', type: 'toggle', default: false,
    hint: 'Press crouch once to crouch; press again or jump to stand.',
    apply: (v) => { feel.crouch.toggle = v; },
  },
  {
    id: 'toggleAds', tab: 'Comfort', label: 'Toggle aim down sights', type: 'toggle', default: false,
    hint: 'Press aim once to zoom; press again or sprint to lower weapon.',
    apply: (v) => { feel.ads.toggle = v; },
  },
  {
    id: 'challengeTracker', tab: 'Comfort', label: 'Challenge tracker', type: 'toggle', default: false,
    hint: 'Shows the challenges you pinned (title screen › Challenges) under the round counter for a few seconds whenever one moves.',
    apply: (v, ctx) => ctx.hud?.setChallengeTrackerEnabled?.(v),
  },
  {
    id: 'incentiveMeter', tab: 'Comfort', label: 'Employee of the hour meter', type: 'toggle', default: true,
    hint: 'Shows the drop progress bar under the round counter once incentives unlock.',
    apply: (v, ctx) => ctx.hud?.setIncentiveMeterEnabled?.(v),
  },
  {
    id: 'dimPhoneFlash', tab: 'Comfort', label: 'Dim instead of phone flashes', type: 'toggle', default: false,
    apply: v => { bossComfort.dimPhoneFlash = v; },
  },
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
  {
    // The horror layer (game/features/horror.js): lamps and neon die as the rounds climb, power cuts to emergency red.
    // Its flicker stays under 3 flashes a second; Calm turns it off.
    id: 'horrorLighting', tab: 'Comfort', label: 'Horror effects (lighting, displays, eerie sounds)', type: 'toggle', default: true,
    apply: (v) => { look.runtime.horror = v; },
  },
  {
    // Highlights and pings the last few zombies at the end of a round (game/stragglers.js).
    id: 'stragglerHelper', tab: 'Comfort', label: 'Last-zombie tracker (outline & minimap ping)', type: 'toggle',
    default: true,
    apply: (v) => { feel.stragglers.enabled = v; },
  },
];

// First launch only (game/autoGraphics.js): measure the title flyover's frame rate for a few seconds, then pick the best
// Graphics preset whose fps floor this computer reaches. tiers: best first; the last one is the fallback.
// ---- Remembered choices (tab null: saved like a setting, never shown in the menu, in no preset) ----
settingDefs.push({
  // The run mode last confirmed on the title's chooser (ui/runStart.js): it is focused there next time.
  id: 'closingMode', tab: null, label: 'Run mode', type: 'select', default: closingTime.modes.default,
  options: closingTime.modes.list.map(({ id, label }) => ({ value: id, label })),
  apply: () => {}, // (the game takes the mode when a run starts, not when the value changes)
});
settingDefs.push({
  // The corner minimap, shown or hidden with a tap of the minimap button (ui/minimap.js). Hidden until asked for.
  id: 'minimap', tab: null, label: 'Corner map', type: 'toggle', default: false,
  apply: (v, ctx) => ctx.hud?.minimap?.setCornerOn(v),
});

export const autoGraphics = {
  measureSeconds: 3, // seconds of good frames to measure
  warmupFrames: 30, // first frames ignored (shader compiles)
  maxFrameSeconds: 0.25, // a frame longer than this is a hitch / background tab, not a measurement
  tiers: [
    { label: 'High', minFps: 50 },
    { label: 'Medium', minFps: 38 },
    { label: 'Low', minFps: 26 },
    { label: 'Potato', minFps: 0 },
  ],
};

// One-click presets per tab: { label, values: { settingId: value } } (shown as buttons at the top of that tab).
export const settingPresets = {
  Graphics: [
    // Potato / Low are for weak computers (a school laptop): lower resolution, no post-processing, no dust / flickering lights.
    { label: 'Potato', values: { renderScale: Math.max(0.5, nativeRatio * 0.5), visualEffects: 'off', ambientEffects: false, lampCount: 4, neonGlow: false, clutter: 'none', detailDistance: 'close', zoneGrading: false } },
    { label: 'Low', values: { renderScale: Math.max(0.5, nativeRatio * 0.65), visualEffects: 'off', ambientEffects: false, lampCount: 6, neonGlow: false, clutter: 'some', detailDistance: 'near', zoneGrading: true } },
    { label: 'Medium', values: { renderScale: Math.max(0.5, nativeRatio * 0.8), visualEffects: 'low', ambientEffects: true, lampCount: 8, neonGlow: true, clutter: 'some', detailDistance: 'all', zoneGrading: true } },
    { label: 'High', values: { renderScale: nativeRatio, visualEffects: 'high', ambientEffects: true, lampCount: 'all', neonGlow: true, clutter: 'full', detailDistance: 'all', zoneGrading: true } }, // native, capped at 2x for performance
  ],
  Comfort: [
    { label: 'Calm', values: { headBob: 0, speedLines: false, horrorLighting: false, dimPhoneFlash: true } }, // for motion sickness (and no flicker)
    { label: 'Standard', values: { headBob: 1, speedLines: true, horrorLighting: true, dimPhoneFlash: false } }, // (the toggle controls are a choice, not comfort: no preset changes them)
  ],
};
