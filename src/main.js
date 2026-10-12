// =============================================================================
// MALL ZOMBIES: entry point
// Wires together the renderer, world, player, input, HUD, and the fixed-step loop.
// =============================================================================

import './style.css';
import * as THREE from 'three';
import { feel } from './config/feel.js';
import { debug } from './config/debug.js';
import { startLoop } from './core/loop.js';
import { Input } from './core/input.js';
import { buildMall } from './world/map.js';
import { createPlayerStats } from './player/stats.js';
import { PlayerController } from './player/controller.js';
import { createHud } from './ui/hud.js';

// --- Renderer, scene, camera ---------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
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

  player.update(dt);
  world.update(dt);
  input.endTick();
}

function render(alpha) {
  const { dx, dy } = input.consumeMouse();
  if (game.running) player.applyLook(dx, dy);
  player.syncCamera(alpha);
  hud.setSprint(player.sprintFraction, player.sprintExhausted, player.isSprinting);
  renderer.render(scene, camera);
}

startLoop({
  tickRate: feel.simulation.tickRate,
  maxFrameTime: feel.simulation.maxFrameTime,
  update,
  render,
});

if (debug.exposeToWindow) {
  window.__mall = { THREE, scene, camera, renderer, world, player, stats, input, game, hud };
}
