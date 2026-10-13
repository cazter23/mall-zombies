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
import { createInteractions } from './game/interactions.js';
import { economy } from './config/economy.js';
import { buildWeaponDisplay } from './weapons/models/index.js';
import { createWallBuyDisplay } from './world/wallBuy.js';
import { createSettings } from './game/settings.js';
import { createSettingsMenu } from './ui/settingsMenu.js';
import { createControlsMenu } from './ui/controlsMenu.js';

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
// Live combat bodies also block a vault's path and landing, even without a world collider.
const shootables = [...(arena ? arena.shootables : [])];
const input = new Input(renderer.domElement);
const gamepad = createGamepad(input); // feeds controller buttons/sticks into `input`
const stats = createPlayerStats();
const player = new PlayerController({
  camera,
  input,
  stats,
  colliders,
  spawn: map.playerSpawn,
  getBodies: () => shootables, // live hitboxes also block vault paths/landings
});
const hud = createHud();
// Points. Every gain/spend shows a "+60" / "-500" pop-up by the counter.
const wallet = createWallet({ onChange: (amount) => hud.pointsPopup(amount) });
const payForHit = (hit) => wallet.earn(pointsForHit(hit)); // +10 per hit, kill value + bonuses on kills
const body = createPlayerBody(scene); // legs + torso you see when looking down

const effects = createEffects(scene);
const sound = createSound(); // synthesized sound effects (starts on the first click/key press)
const viewmodel = createViewmodel(Object.values(weapons), meleeWeapons.boxCutter); // a model for every gun
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
// Buyables (hold F / X): the map's doors and wall buys.
const interactions = createInteractions({
  input,
  player,
  wallet,
  sound,
  onReloadTap: () => gun.requestReload(), // controller X tapped next to a buyable: it was a reload
});
for (const door of map.doors) {
  interactions.add({
    label: door.label,
    verb: 'open',
    cost: door.price,
    position: door.position,
    available: () => !door.isOpen,
    use: () => door.open(),
  });
}
// Wall buys: buy the gun, or (once you own it) refill its ammo. Markers for guns that don't
// exist yet in config/weapons.js are skipped.
for (const wb of map.wallBuys) {
  const def = weapons[wb.weapon];
  const prices = economy.wallBuys[wb.weapon];
  if (!def || !prices) continue;
  scene.add(
    createWallBuyDisplay({
      position: wb.position,
      normal: wb.normal,
      name: def.name,
      gunModel: buildWeaponDisplay(def),
      cfg: feel.world.wallBuyDisplay,
    }),
  );
  const owned = () => gun.owns(def.id);
  interactions.add({
    get label() {
      return owned() ? `${def.name} ammo` : def.name;
    },
    verb: 'buy',
    get cost() {
      return owned() ? prices.ammo : prices.weapon;
    },
    position: wb.position,
    // Only in an opened area, and not when you already have it with full ammo.
    available: () => map.zones[wb.zone].open && !(owned() && gun.weaponFor(def.id).isFull),
    use: () => gun.give(def),
  });
}

const melee = createMelee({
  def: meleeWeapons.boxCutter,
  stats,
  player,
  input,
  getWeapon: () => gun.weapon, // the gun in hand (knifing cancels its reload)
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
  interactions.reset();
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
  if (debug.cheatKeys && input.consumePress('Quote')) wallet.spend(wallet.points); // ' = points to 0

  player.update(dt);
  // "[Space] Vault" prompt: would a jump press now end in a vault? (checked per tick, shown in render)
  vaultPromptVisible = player.grounded && !player.vault.active && player.vault.preview();
  interactions.update(dt); // before the gun: on controller X, a hold near a buyable buys instead of reloading
  melee.update(dt, !gun.isSwitching);
  // Hands busy with a slash or a vault: no shooting. A vault only pauses a reload (it carries on after).
  gun.update(dt, melee.isBusy || player.vault.active, player.vault.active);
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
let vaultPromptVisible = false;

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
  const halfSpread = gun.aim.spreadDegrees * DEG_TO_RAD;
  const gapPx = (Math.tan(halfSpread) / Math.tan((fov * DEG_TO_RAD) / 2)) * (window.innerHeight / 2);
  hud.setCrosshair(gapPx, aimAmount);

  hud.setHealth(health.fraction);
  hud.setHurt(health.overlay);
  hud.setSpeedLines(game.over ? 0 : player.sprintAmount * feel.sprintFx.speedLinesOpacity);
  hud.setSprint(player.sprintFraction, player.sprintExhausted, player.isSprinting);
  hud.setAmmo(gun.weapon, buttonLabel('reload'));
  hud.setInteract(game.over ? null : interactions.prompt, buttonLabel('interact'));
  hud.setVaultPrompt(game.running && !game.over && vaultPromptVisible, buttonLabel('jump'));
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
  window.__mall = { THREE, scene, camera, renderer, map, world: map, colliders, arena, player, stats, input, game, hud, gun, effects, viewmodel, shootables, body, zombies, health, melee, runStats, death, resetRun, gamepad, aimAssist, wallet, rounds, sound, interactions };
  // Advance the real game loop by `ticks` fixed steps and draw one frame. For automated
  // testing when the browser isn't animating (e.g. a hidden tab). Pair with game.forceRun.
  window.__mall.step = (ticks = 1) => {
    const dt = 1 / feel.simulation.tickRate;
    applyLookInput(dt);
    for (let i = 0; i < ticks; i++) update(dt);
    render(1, dt);
  };
}
