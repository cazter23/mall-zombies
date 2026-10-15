// =============================================================================
// MALL ZOMBIES: entry point (the browser side)
// The renderer, camera, pointer lock, menus, controller menus, look input, debug keys and drawing.
// All gameplay systems are built and ticked by game/createGame.js (which also runs headless in tests).
// =============================================================================

import './style.css';
import * as THREE from 'three';
import { feel } from './config/feel.js';
import { debug } from './config/debug.js';
import { startLoop } from './core/loop.js';
import { Input } from './core/input.js';
import { createGamepad } from './core/gamepad.js';
import { buttonLabels } from './config/controls.js';
import { buildTestRange } from './maps/testRange/testRange.js';
import { createHud } from './ui/hud.js';
import { weapons, melee as meleeWeapons } from './config/weapons.js';
import { createViewmodel } from './weapons/viewmodel.js';
import { createPlayerBody } from './player/body.js';
import { createSound } from './audio/sound.js';
import { createSettings } from './game/settings.js';
import { createSettingsMenu } from './ui/settingsMenu.js';
import { createControlsMenu } from './ui/controlsMenu.js';
import { createGame } from './game/createGame.js';
import { tierById, tierOf } from './weapons/upgrades.js';

// --- Renderer, scene, camera ---------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false; // we draw two passes per frame: the world, then the held gun on top
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1626);

const camera = new THREE.PerspectiveCamera(
  feel.camera.fov,
  window.innerWidth / window.innerHeight,
  feel.camera.near,
  feel.camera.far,
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Browser parts + the game ------------------------------------------------------

const input = new Input(renderer.domElement);
const gamepad = createGamepad(input); // feeds controller buttons/sticks into `input`
const hud = createHud();
const sound = createSound(); // synthesized sound effects (starts on the first click/key press)
const viewmodel = createViewmodel(Object.values(weapons), meleeWeapons.boxCutter); // a model for every gun
const body = createPlayerBody(scene); // legs + torso you see when looking down

const g = createGame({
  scene,
  camera,
  input,
  hud,
  sound,
  viewmodel,
  buildTestRange: debug.testArena ? buildTestRange : null,
  debugTick: handleDebugKeys,
  // Free the mouse as soon as you die, so it's usable by the time the results screen appears
  // (browsers refuse to re-lock the pointer for about a second after it's released).
  onPlayerDeath: () => {
    if (document.pointerLockElement) document.exitPointerLock();
  },
});
scene.add(viewmodel.worldLight); // the muzzle flash lights up the room
const { state: game, death, map, player, gun, melee, zombies, rounds, health, wallet, effects, aimAssist, interactions } = g;
const resetRun = g.resetRun;

// Button name for prompts on whichever device was used last ("R" vs "X" vs "□").
function buttonLabel(action) {
  const device = input.device === 'gamepad' ? gamepad.type : 'keyboard';
  return buttonLabels[device][action];
}

const DEG_TO_RAD = Math.PI / 180;

// Debug keys (raw key codes are only used here, never in gameplay). Run by the game each live tick,
// just before the player moves.
function handleDebugKeys() {
  if (debug.allowShutterToggle && input.consumePress('KeyO')) {
    for (const door of map.doors) door.toggle(); // debug: open/close doors for free
  }
  if (g.arena && input.consumePress('KeyT')) {
    player.teleport(g.arena.contains(player.position) ? map.playerSpawn : g.arena.playerSpawn);
  }
  if (debug.zombieKeys && input.consumePress('KeyZ')) {
    const shift = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    zombies.spawn(shift ? 'mallWalker' : 'shopper'); // Z = Shopper, Shift+Z = Mall Walker
  }
  if (debug.zombieKeys && input.consumePress('KeyX')) zombies.clear();
  if (debug.cheatKeys && input.consumePress('KeyN')) rounds.skipRound();
  if (debug.cheatKeys && input.consumePress('KeyP')) wallet.earn(5000);
  if (debug.cheatKeys && input.consumePress('Quote')) wallet.spend(wallet.points); // ' = points to 0
}

// Settings (config/settings.js is the list; changes apply to the game and are saved in the browser).
// Created after the HUD and sound so each setting's apply() can reach them.
const settings = createSettings({ renderer, sound, hud });
const settingsMenu = createSettingsMenu(settings);
hud.onOpenSettings(() => settingsMenu.open());
const controlsMenu = createControlsMenu();
hud.onOpenControls(() => controlsMenu.open());

hud.onStart(() => {
  sound.unlock(); // browsers only allow audio after a click
  input.requestLock();
});
input.onLockChange((locked) => {
  if (locked) game.padPlaying = false; // the mouse took over
  if (!game.over) hud.setPaused(!game.running); // when dead, the results screen is in charge
});
hud.setPaused(true);
hud.onPlayAgain(() => {
  resetRun();
  hud.setPaused(true, { restart: true }); // stays up if the browser refuses the lock; click again
  input.requestLock();
});

// --- Loop ------------------------------------------------------------------------

// Controller menus: A/Start starts or resumes, Start pauses, A on the results screen plays again.
// Unplugging the controller mid-game pauses (otherwise the zombies keep going with nobody playing).
let padWasConnected = false;
function handleControllerMenus() {
  if (controlsMenu.isOpen) {
    controlsMenu.padNav(input);
    return;
  }
  if (settingsMenu.isOpen) {
    settingsMenu.padNav(input); // the controller drives the settings menu while it's up
    return;
  }
  if (padWasConnected && !gamepad.connected && game.padPlaying) {
    game.padPlaying = false;
    if (!game.running && !game.over) hud.setPaused(true); // still running if the mouse is locked
  }
  padWasConnected = gamepad.connected;

  if (game.over) {
    if (death.resultsShown && input.consumeAction('confirm')) {
      sound.unlock(); // controller-only players never click, so try to start audio here too
      resetRun();
      game.padPlaying = true;
      hud.setPaused(false);
    }
  } else if (!game.running) {
    if (input.consumeAction('settings')) {
      settingsMenu.open();
    } else if (input.consumeAction('controlsScreen')) {
      controlsMenu.open();
    } else if (input.consumeAction('confirm')) {
      sound.unlock();
      game.padPlaying = true;
      hud.setPaused(false);
    }
  } else if (input.consumeAction('pause')) {
    game.padPlaying = false;
    if (document.pointerLockElement) document.exitPointerLock();
    hud.setPaused(true);
  }
}

function update(dt) {
  gamepad.poll();
  handleControllerMenus();
  g.update(dt);
}

const stickRate = { yaw: 0, pitch: 0 };

// Start of every frame, before the ticks: turn the view by this frame's mouse and stick input,
// so shots and movement in this frame's ticks use where you're looking NOW (a flick-and-click
// fires where the crosshair ended up, not one frame behind).
function applyLookInput(frameTime) {
  const { dx, dy } = input.consumeMouse();
  if (!game.running) return;
  player.applyLook(dx, dy);
  // Controller look, slowed by aim assist when the crosshair is on a zombie.
  gamepad.poll(); // fresh stick values for this frame (button presses are tracked on edges, so polling twice is safe)
  gamepad.lookRate(frameTime, stickRate);
  const slow = aimAssist.slowdown;
  player.applyStickLook(stickRate.yaw * frameTime * slow, stickRate.pitch * frameTime * slow);
}

// FPS counter: average over a quarter of a second so the number is readable.
const fpsMeter = { frames: 0, time: 0 };

function render(alpha, frameTime) {
  fpsMeter.frames++;
  fpsMeter.time += frameTime;
  if (fpsMeter.time >= 0.25) {
    hud.setFps(Math.round(fpsMeter.frames / fpsMeter.time));
    fpsMeter.frames = 0;
    fpsMeter.time = 0;
  }

  // While paused nothing ticks, so interpolating between the last two ticks would make things
  // twitch: show the latest tick instead. Visual time keeps flowing after death (the world goes
  // on around the death camera) but stops while paused.
  const paused = !game.running && !game.over;
  if (paused) alpha = 1;
  const visualTime = paused ? 0 : frameTime;

  // ADS zoom: narrow the world camera's FOV, and slow the mouse to match if configured.
  const aimAmount = gun.aim.renderAmount(alpha);
  const fov = feel.camera.fov * (1 + (gun.weapon.def.ads.fovMultiplier - 1) * aimAmount);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  player.lookScale = feel.ads.sensitivityFollowsZoom ? fov / feel.camera.fov : 1; // used by next frame's look

  player.syncCamera(alpha);
  if (game.over) applyDeathCamera(alpha);
  body.root.visible = !game.over;
  body.update(visualTime, player, alpha);
  zombies.render(visualTime, alpha);
  effects.update(visualTime);
  viewmodel.update(visualTime, camera, {
    weapon: gun.weapon,
    shownDef: gun.shownDef, // mid-switch: the old gun while it drops away
    switchLower: gun.switchLower,
    aimAmount,
    meleeProgress: melee.progress,
    player,
  });

  // Crosshair gap in pixels = where the spread cone's edge lands on screen at the current FOV.
  const halfSpread = gun.spreadDegreesForDisplay(aimAmount) * DEG_TO_RAD;
  const gapPx = (Math.tan(halfSpread) / Math.tan((fov * DEG_TO_RAD) / 2)) * (window.innerHeight / 2);
  hud.setCrosshair(gapPx, aimAmount);

  hud.setHealth(health.fraction);
  hud.setHurt(health.overlay);
  hud.setSpeedLines(game.over ? 0 : player.sprintAmount * feel.sprintFx.speedLinesOpacity);
  hud.setSprint(player.sprintFraction, player.sprintExhausted, player.isSprinting);
  hud.setAmmo(gun.weapon, buttonLabel('reload'));
  hud.setAmmoTier(tierById(tierOf(gun.modsFor(gun.def.id) ?? [])));
  hud.setInteract(game.over ? null : interactions.prompt, buttonLabel('interact'));
  hud.setVaultPrompt(game.running && !game.over && g.vaultPromptVisible, buttonLabel('jump'));
  hud.setPoints(wallet.points);
  hud.setRoundFlashing(rounds.inBreak && rounds.round > 1); // counter blinks in the break between rounds

  // Pass 1: the world. Pass 2: the gun, with depth cleared so it never clips into walls.
  renderer.clear();
  renderer.render(scene, camera);
  if (game.over) return; // no gun in your hands once you're down
  renderer.clearDepth();
  renderer.render(viewmodel.scene, viewmodel.camera);
}

// Dying: the view drops to the floor and rolls onto its side.
function applyDeathCamera(alpha) {
  const d = feel.death;
  const raw = Math.min(1, (death.timer + alpha / feel.simulation.tickRate) / d.cameraSeconds);
  const t = raw * raw * (3 - 2 * raw);
  const floorY = player.position.y + d.cameraHeight;
  camera.position.y += (floorY - camera.position.y) * t;
  camera.rotation.set(
    camera.rotation.x + (d.endPitch - camera.rotation.x) * t,
    camera.rotation.y,
    d.rollRadians * t,
  );
}

startLoop({
  tickRate: feel.simulation.tickRate,
  maxFrameTime: feel.simulation.maxFrameTime,
  beforeUpdate: applyLookInput,
  update,
  render,
});

if (debug.exposeToWindow) {
  window.__mall = {
    THREE, scene, camera, renderer, map, world: map, colliders: g.colliders, arena: g.arena, player, stats: g.stats, input, game,
    hud, gun, effects, viewmodel, shootables: g.shootables, body, zombies, health, melee, runStats: g.runStats, death, resetRun,
    gamepad, aimAssist, wallet, rounds, sound, interactions, g,
  };
  // Advance the real game loop by `ticks` fixed steps and draw one frame. For automated
  // testing when the browser isn't animating (e.g. a hidden tab). Pair with game.forceRun.
  window.__mall.step = (ticks = 1) => {
    const dt = 1 / feel.simulation.tickRate;
    applyLookInput(dt);
    for (let i = 0; i < ticks; i++) update(dt);
    render(1, dt);
  };
}
