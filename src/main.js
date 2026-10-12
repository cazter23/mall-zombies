// =============================================================================
// MALL ZOMBIES: entry point
// Wires together the renderer, world, player, weapon, zombies, effects, input, HUD, and the fixed-step loop.
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
import { weapons, melee as meleeWeapons } from './config/weapons.js';
import { createEffects } from './fx/effects.js';
import { createViewmodel } from './weapons/viewmodel.js';
import { createPlayerGun } from './weapons/playerGun.js';
import { createMelee } from './weapons/melee.js';
import { createPlayerBody } from './player/body.js';
import { createZombieManager } from './zombies/zombieManager.js';
import { createPlayerHealth } from './player/health.js';
import { createRunStats } from './game/runStats.js';

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
const viewmodel = createViewmodel(weapons.stapleGun, meleeWeapons.boxCutter);
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
  onShot: (shot) => runStats.recordShot(shot),
});
const melee = createMelee({
  def: meleeWeapons.boxCutter,
  stats,
  player,
  input,
  weapon: gun.weapon,
  shootables,
  colliders: world.colliders,
  effects,
  hud,
});

// The game only runs while the mouse is locked; Esc pauses.
const game = {
  forceRun: false, // debug: run without pointer lock (used by automated tests)
  over: false, // true once the player has died
  get running() {
    return input.locked || this.forceRun;
  },
};

const DEG_TO_RAD = Math.PI / 180;
const runStats = createRunStats();
const getRound = () => 1; // no waves yet (step 4)
const death = { timer: 0, resultsShown: false };

// THE single place the player dies. A downed/revive system would hook in here later
// (e.g. go "downed" instead, and only call the rest of this if nobody revives you).
function onPlayerDeath() {
  game.over = true;
  death.timer = 0;
  death.resultsShown = false;
  hud.setDead(true);
  // Free the mouse now, so it's usable by the time the results screen appears
  // (browsers refuse to re-lock the pointer for about a second after it's released).
  if (document.pointerLockElement) document.exitPointerLock();
}

function showResults() {
  death.resultsShown = true;
  hud.showResults({
    timeAlive: runStats.timeAlive,
    round: getRound(),
    kills: runStats.kills,
    headshotKills: runStats.headshotKills,
    meleeKills: runStats.meleeKills,
    accuracy: runStats.accuracy,
  });
}

// Fresh run: everything back to the start without reloading the page.
function resetRun() {
  zombies.clear();
  health.reset();
  runStats.reset();
  gun.reset();
  melee.reset();
  player.teleport(world.playerSpawn);
  world.shutter.close();
  game.over = false;
  death.timer = 0;
  death.resultsShown = false;
  hud.setDead(false);
  hud.hideResults();
}

const health = createPlayerHealth({ stats, onDeath: onPlayerDeath });

const zombies = createZombieManager({
  scene,
  colliders: world.colliders,
  player,
  shootables,
  effects,
  spawnPoints: world.markers.spawnPoints,
  getRound,
  canAttack: () => !health.isDead,
  onPlayerHit: (damage) => {
    health.takeDamage(damage);
    player.addViewKick(-feel.health.hitJoltDegrees * DEG_TO_RAD); // jolt the view down
  },
  onKill: (zombie) => runStats.recordKill(zombie),
});

hud.onStart(() => input.requestLock());
input.onLockChange((locked) => {
  if (!game.over) hud.setPaused(!locked); // when dead, the results screen is in charge
});
hud.setPaused(true);
hud.onPlayAgain(() => {
  resetRun();
  hud.setPaused(true, { restart: true }); // stays up if the browser refuses the lock; click again
  input.requestLock();
});

// --- Loop ------------------------------------------------------------------------

function update(dt) {
  // Dead: the world keeps going (zombies wander to the body), the player doesn't.
  // Checked before the pause check, because the mouse is released on death.
  if (game.over) {
    death.timer += dt;
    zombies.update(dt);
    health.update(dt);
    if (!death.resultsShown && death.timer >= feel.death.resultsDelay) showResults();
    input.endTick();
    return;
  }

  if (!game.running) {
    player.freeze();
    input.endTick();
    return;
  }

  runStats.timeAlive += dt;

  if (debug.allowShutterToggle && input.consumePress('KeyO')) {
    world.shutter.toggle();
  }

  if (arena && input.consumePress('KeyT')) {
    player.teleport(arena.contains(player.position) ? world.playerSpawn : arena.playerSpawn);
  }

  if (debug.zombieKeys && input.consumePress('KeyZ')) zombies.spawn('shopper');
  if (debug.zombieKeys && input.consumePress('KeyX')) zombies.clear();

  player.update(dt);
  melee.update(dt);
  gun.update(dt, melee.isBusy); // after the player moves, so shots come from this tick's eye position
  zombies.update(dt);
  health.update(dt);
  world.update(dt);
  if (arena) arena.update(dt);
  input.endTick();
}

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
  if (game.over) applyDeathCamera(alpha);
  body.root.visible = !game.over;
  body.update(game.running ? frameTime : 0, player, alpha);
  zombies.render(game.running ? frameTime : 0, alpha);
  if (game.running) effects.update(frameTime);
  viewmodel.update(
    game.running ? frameTime : 0,
    camera,
    gun.weapon,
    aimAmount,
    melee.progress,
    player.sprintAmount,
    player.bobPhase,
  );

  // Crosshair gap in pixels = where the spread cone's edge lands on screen at the current FOV.
  const halfSpread = gun.aim.spreadDegrees * DEG_TO_RAD;
  const gapPx = (Math.tan(halfSpread) / Math.tan((fov * DEG_TO_RAD) / 2)) * (window.innerHeight / 2);
  hud.setCrosshair(gapPx, aimAmount);

  hud.setHealth(health.fraction);
  hud.setHurt(health.overlay);
  hud.setSpeedLines(game.over ? 0 : player.sprintAmount * feel.sprintFx.speedLinesOpacity);
  hud.setSprint(player.sprintFraction, player.sprintExhausted, player.isSprinting);
  hud.setAmmo(gun.weapon);

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
  update,
  render,
});

if (debug.exposeToWindow) {
  window.__mall = { THREE, scene, camera, renderer, world, arena, player, stats, input, game, hud, gun, effects, viewmodel, shootables, body, zombies, health, melee, runStats, death, resetRun };
  // Advance the real game loop by `ticks` fixed steps and draw one frame. For automated
  // testing when the browser isn't animating (e.g. a hidden tab). Pair with game.forceRun.
  window.__mall.step = (ticks = 1) => {
    const dt = 1 / feel.simulation.tickRate;
    for (let i = 0; i < ticks; i++) update(dt);
    render(1, dt);
  };
}
