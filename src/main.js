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
import { createGamepad } from './core/gamepad.js';
import { buttonLabels } from './config/controls.js';
import { loadMap } from './maps/index.js';
import { buildTestRange } from './maps/testRange/testRange.js';
import { createPlayerStats } from './player/stats.js';
import { PlayerController } from './player/controller.js';
import { createHud } from './ui/hud.js';
import { weapons, melee as meleeWeapons } from './config/weapons.js';
import { createEffects } from './fx/effects.js';
import { createViewmodel } from './weapons/viewmodel.js';
import { createPlayerGun } from './weapons/playerGun.js';
import { createMelee } from './weapons/melee.js';
import { createAimAssist } from './weapons/aimAssist.js';
import { createPlayerBody } from './player/body.js';
import { createZombieManager } from './zombies/zombieManager.js';
import { createPlayerHealth } from './player/health.js';
import { createRunStats } from './game/runStats.js';
import { createWallet, pointsForHit } from './game/wallet.js';
import { createRounds } from './game/rounds.js';
import { createSound } from './audio/sound.js';

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

// One shared list of solid boxes: the map, debug add-ons and doors all write into it;
// the player, zombies and bullets all read it.
const colliders = [];
const map = loadMap('mall', scene, colliders);
// Debug-only open area for testing movement and shooting (press T).
const arena = debug.testArena ? buildTestRange(scene, colliders) : null;
const input = new Input(renderer.domElement);
const gamepad = createGamepad(input); // feeds controller buttons/sticks into `input`
const stats = createPlayerStats();
const player = new PlayerController({
  camera,
  input,
  stats,
  colliders,
  spawn: map.playerSpawn,
});
const hud = createHud();
// Points. Every gain/spend shows a "+60" / "-500" pop-up by the counter.
const wallet = createWallet({ onChange: (amount) => hud.pointsPopup(amount) });
const payForHit = (hit) => wallet.earn(pointsForHit(hit)); // +10 per hit, kill value + bonuses on kills
const body = createPlayerBody(scene); // legs + torso you see when looking down

// Everything the player can shoot. Practice dummies for now; zombies will join this list.
const shootables = [...(arena ? arena.shootables : [])];
const effects = createEffects(scene);
const sound = createSound(); // synthesized sound effects (starts on the first click/key press)
const viewmodel = createViewmodel(weapons.stapleGun, meleeWeapons.boxCutter);
scene.add(viewmodel.worldLight); // the muzzle flash lights up the room
const aimAssist = createAimAssist({ player, input, shootables, colliders });
const gun = createPlayerGun({
  def: weapons.stapleGun,
  stats,
  player,
  input,
  colliders,
  shootables,
  effects,
  viewmodel,
  hud,
  sound,
  onShot: (shot) => runStats.recordShot(shot),
  onHit: payForHit,
  aimAssist,
});
const melee = createMelee({
  def: meleeWeapons.boxCutter,
  stats,
  player,
  input,
  weapon: gun.weapon,
  shootables,
  colliders,
  effects,
  hud,
  onHit: payForHit,
});

// The game runs while the mouse is locked (Esc pauses) or while playing on a controller
// (Start pauses). A controller doesn't need the mouse locked.
const game = {
  forceRun: false, // debug: run without pointer lock (used by automated tests)
  over: false, // true once the player has died
  padPlaying: false, // started/resumed with a controller
  get running() {
    return input.locked || this.padPlaying || this.forceRun;
  },
};

// Button name for prompts on whichever device was used last ("R" vs "X" vs "□").
function buttonLabel(action) {
  const device = input.device === 'gamepad' ? gamepad.type : 'keyboard';
  return buttonLabels[device][action];
}

const DEG_TO_RAD = Math.PI / 180;
const runStats = createRunStats();
let rounds = null; // created below, once the zombie manager exists
const getRound = () => Math.max(1, rounds ? rounds.round : 1);
const death = { timer: 0, resultsShown: false };

// THE single place the player dies. A downed/revive system would hook in here later
// (e.g. go "downed" instead, and only call the rest of this if nobody revives you).
function onPlayerDeath() {
  game.over = true;
  death.timer = 0;
  death.resultsShown = false;
  hud.setDead(true);
  game.padPlaying = false;
  // Free the mouse now, so it's usable by the time the results screen appears
  // (browsers refuse to re-lock the pointer for about a second after it's released).
  if (document.pointerLockElement) document.exitPointerLock();
}

function showResults() {
  death.resultsShown = true;
  hud.showResults({
    timeAlive: runStats.timeAlive,
    round: rounds.round,
    pointsEarned: wallet.totalEarned,
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
  viewmodel.reset();
  effects.clear(); // no leftover splatter or tracers from the last run
  melee.reset();
  aimAssist.reset();
  wallet.reset();
  rounds.reset();
  hud.setRound(0);
  hud.setRoundFlashing(false);
  player.teleport(map.playerSpawn);
  map.reset(); // doors closed, zones locked
  game.over = false;
  death.timer = 0;
  death.resultsShown = false;
  hud.setDead(false);
  hud.hideResults();
}

const health = createPlayerHealth({ stats, onDeath: onPlayerDeath });

const zombies = createZombieManager({
  scene,
  colliders,
  player,
  shootables,
  effects,
  spawnPoints: map.spawnPoints,
  isZoneOpen: (zone) => map.zones[zone].open,
  getRound,
  canAttack: () => !health.isDead,
  onPlayerHit: (damage) => {
    health.takeDamage(damage);
    player.addViewKick(-feel.health.hitJoltDegrees * DEG_TO_RAD); // jolt the view down
  },
  onKill: (zombie) => runStats.recordKill(zombie),
});

rounds = createRounds({
  zombies,
  onRoundStart: (n) => {
    hud.setRound(n);
    hud.showRoundBanner(n);
  },
});

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
    if (input.consumeAction('confirm')) {
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
  if (!rounds.started) rounds.start(); // round 1 begins the first time the game actually runs

  if (debug.allowShutterToggle && input.consumePress('KeyO')) {
    for (const door of map.doors) door.toggle(); // debug: open/close doors for free
  }

  if (arena && input.consumePress('KeyT')) {
    player.teleport(arena.contains(player.position) ? map.playerSpawn : arena.playerSpawn);
  }

  if (debug.zombieKeys && input.consumePress('KeyZ')) zombies.spawn('shopper');
  if (debug.zombieKeys && input.consumePress('KeyX')) zombies.clear();
  if (debug.cheatKeys && input.consumePress('KeyN')) rounds.skipRound();
  if (debug.cheatKeys && input.consumePress('KeyP')) wallet.earn(5000);

  player.update(dt);
  melee.update(dt);
  gun.update(dt, melee.isBusy); // after the player moves, so shots come from this tick's eye position
  zombies.update(dt);
  // Rounds pause while you're off in the debug test range (zombies can't reach you there).
  if (!(arena && arena.contains(player.position))) rounds.update(dt);
  health.update(dt);
  map.update(dt);
  if (arena) arena.update(dt);
  player.updateView(dt); // recoil/jolt springs last, so this tick's kicks show on the next frame
  input.endTick();
}

const stickRate = { yaw: 0, pitch: 0 };

function render(alpha, frameTime) {
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
  player.lookScale = feel.ads.sensitivityFollowsZoom ? fov / feel.camera.fov : 1;

  const { dx, dy } = input.consumeMouse();
  if (game.running) {
    player.applyLook(dx, dy);
    // Controller look, slowed by aim assist when the crosshair is on a zombie.
    gamepad.lookRate(frameTime, stickRate);
    const slow = aimAssist.slowdown;
    player.applyStickLook(stickRate.yaw * frameTime * slow, stickRate.pitch * frameTime * slow);
  }
  player.syncCamera(alpha);
  if (game.over) applyDeathCamera(alpha);
  body.root.visible = !game.over;
  body.update(visualTime, player, alpha);
  zombies.render(visualTime, alpha);
  effects.update(visualTime);
  viewmodel.update(visualTime, camera, {
    weapon: gun.weapon,
    aimAmount,
    meleeProgress: melee.progress,
    player,
  });

  // Crosshair gap in pixels = where the spread cone's edge lands on screen at the current FOV.
  const halfSpread = gun.aim.spreadDegrees * DEG_TO_RAD;
  const gapPx = (Math.tan(halfSpread) / Math.tan((fov * DEG_TO_RAD) / 2)) * (window.innerHeight / 2);
  hud.setCrosshair(gapPx, aimAmount);

  hud.setHealth(health.fraction);
  hud.setHurt(health.overlay);
  hud.setSpeedLines(game.over ? 0 : player.sprintAmount * feel.sprintFx.speedLinesOpacity);
  hud.setSprint(player.sprintFraction, player.sprintExhausted, player.isSprinting);
  hud.setAmmo(gun.weapon, buttonLabel('reload'));
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
  update,
  render,
});

if (debug.exposeToWindow) {
  window.__mall = { THREE, scene, camera, renderer, map, world: map, colliders, arena, player, stats, input, game, hud, gun, effects, viewmodel, shootables, body, zombies, health, melee, runStats, death, resetRun, gamepad, aimAssist, wallet, rounds, sound };
  // Advance the real game loop by `ticks` fixed steps and draw one frame. For automated
  // testing when the browser isn't animating (e.g. a hidden tab). Pair with game.forceRun.
  window.__mall.step = (ticks = 1) => {
    const dt = 1 / feel.simulation.tickRate;
    for (let i = 0; i < ticks; i++) update(dt);
    render(1, dt);
  };
}
