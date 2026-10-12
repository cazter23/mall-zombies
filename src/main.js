// =============================================================================
// MALL ZOMBIES: entry point
// Wires together the renderer, world, player, weapon, effects, input, HUD, and the fixed-step loop.
// =============================================================================

import './style.css';
import * as THREE from 'three';
import { feel } from './config/feel.js';
import { debug } from './config/debug.js';
import { startLoop } from './core/loop.js';
import { Input } from './core/input.js';
import { buildMall } from './world/map.js';
import { buildTestArena } from './world/testArena.js';
import { createPlayerStats } from './player/stats.js';
import { PlayerController } from './player/controller.js';
import { createHud } from './ui/hud.js';
import { weapons } from './config/weapons.js';
import { createEffects } from './fx/effects.js';
import { createViewmodel } from './weapons/viewmodel.js';
import { createPlayerGun } from './weapons/playerGun.js';
import { createPlayerBody } from './player/body.js';

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

// --- Game objects --------------------------------------------------------------

const world = buildMall(scene);
// Debug-only open area for testing movement; shares the mall's collider list.
const arena = debug.testArena ? buildTestArena(scene, world.colliders) : null;
const input = new Input(renderer.domElement);
const stats = createPlayerStats();
const player = new PlayerController({
  camera,
  input,
  stats,
  colliders: world.colliders,
  spawn: world.playerSpawn,
});
const hud = createHud();
const body = createPlayerBody(scene); // legs + torso you see when looking down

// Everything the player can shoot. Practice dummies for now; zombies will join this list.
const shootables = [...(arena ? arena.shootables : [])];
const effects = createEffects(scene);
const viewmodel = createViewmodel(weapons.stapleGun);
const gun = createPlayerGun({
  def: weapons.stapleGun,
  stats,
  player,
  input,
  colliders: world.colliders,
  shootables,
  effects,
  viewmodel,
  hud,
});

// The game only runs while the mouse is locked; Esc pauses.
const game = {
  forceRun: false, // debug: run without pointer lock (used by automated tests)
  get running() {
    return input.locked || this.forceRun;
  },
};

hud.onStart(() => input.requestLock());
input.onLockChange((locked) => hud.setPaused(!locked));
hud.setPaused(true);

// --- Loop ------------------------------------------------------------------------

function update(dt) {
  if (!game.running) {
    player.freeze();
    input.endTick();
    return;
  }

  if (debug.allowShutterToggle && input.consumePress('KeyO')) {
    world.shutter.toggle();
  }

  if (arena && input.consumePress('KeyT')) {
    player.teleport(arena.contains(player.position) ? world.playerSpawn : arena.playerSpawn);
  }

  player.update(dt);
  gun.update(dt); // after the player moves, so shots come from this tick's eye position
  world.update(dt);
  if (arena) arena.update(dt);
  input.endTick();
}

const DEG_TO_RAD = Math.PI / 180;

function render(alpha, frameTime) {
  // ADS zoom: narrow the world camera's FOV, and slow the mouse to match if configured.
  const aimAmount = gun.aim.renderAmount(alpha);
  const fov = feel.camera.fov * (1 + (gun.weapon.def.ads.fovMultiplier - 1) * aimAmount);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  player.lookScale = feel.ads.sensitivityFollowsZoom ? fov / feel.camera.fov : 1;

  const { dx, dy } = input.consumeMouse();
  if (game.running) player.applyLook(dx, dy);
  player.syncCamera(alpha);
  body.update(game.running ? frameTime : 0, player, alpha);
  if (game.running) effects.update(frameTime);
  viewmodel.update(game.running ? frameTime : 0, camera, gun.weapon, aimAmount);

  // Crosshair gap in pixels = where the spread cone's edge lands on screen at the current FOV.
  const halfSpread = gun.aim.spreadDegrees * DEG_TO_RAD;
  const gapPx = (Math.tan(halfSpread) / Math.tan((fov * DEG_TO_RAD) / 2)) * (window.innerHeight / 2);
  hud.setCrosshair(gapPx, aimAmount);

  hud.setHealth(player.healthFraction);
  hud.setSprint(player.sprintFraction, player.sprintExhausted, player.isSprinting);
  hud.setAmmo(gun.weapon);

  // Pass 1: the world. Pass 2: the gun, with depth cleared so it never clips into walls.
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(viewmodel.scene, viewmodel.camera);
}

startLoop({
  tickRate: feel.simulation.tickRate,
  maxFrameTime: feel.simulation.maxFrameTime,
  update,
  render,
});

if (debug.exposeToWindow) {
  window.__mall = { THREE, scene, camera, renderer, world, arena, player, stats, input, game, hud, gun, effects, viewmodel, shootables, body };
}
