// =============================================================================
// SUNSET GALLERIA: entry point (the browser side)
// The renderer, camera, pointer lock, menus, controller menus, look input, debug keys and drawing.
// All gameplay systems are built and ticked by game/createGame.js (which also runs headless in tests).
// =============================================================================

import './style.css';
import './ui/retail.css';
import './ui/readability.css';
import { createNoticesMenu } from './ui/noticesMenu.js';
import * as THREE from 'three';
import { feel } from './config/feel.js';
import { debug } from './config/debug.js';
import { startLoop } from './core/loop.js';
import { createIdleSaver } from './core/idleSaver.js';
import { Input } from './core/input.js';
import { createGamepad } from './core/gamepad.js';
import { createHaptics } from './core/haptics.js';
import { buttonLabels } from './config/controls.js';
import { buildTestRange } from './maps/testRange/testRange.js';
import { createHud } from './ui/hud.js';
import { weapons, melee as meleeWeapons } from './config/weapons.js';
import { createViewmodel } from './weapons/viewmodel.js';
import { createPlayerBody } from './player/body.js';
import { createSound } from './audio/sound.js';
import { createSettings, hasSavedSettings } from './game/settings.js';
import { settingPresets } from './config/settings.js';
import { createSettingsMenu } from './ui/settingsMenu.js';
import { createControlsMenu } from './ui/controlsMenu.js';
import { createGame } from './game/createGame.js';
import { tierById, tierOf, renewalsOf, attachmentsOf } from './weapons/upgrades.js';
import { upgrades } from './config/upgrades.js';
import { gunStyle } from './config/gunStyle.js';
import { buildOf, qualityById, workshopStuffings } from './config/workshop.js';
import { PRICE_CATEGORIES } from './game/pricing.js';
import { createDebugPanel } from './ui/debugPanel.js';
import { createTitleCamera } from './ui/titleCamera.js';
import { createBenchmark } from './fx/benchmark.js';
import { createLightPool, collectPointLights } from './fx/lightPool.js';
import { batchStatic } from './world/staticBatch.js';
import { createAutoGraphics } from './game/autoGraphics.js';
import { wireRunIntro } from './game/runIntro.js';
import { atmosphere } from './config/environment.js';
import { createPostProcessing } from './fx/postProcessing.js';
import { createZoneGrading } from './fx/zoneGrading.js';
import { createRoomCulling } from './fx/roomCulling.js';
import { look } from './config/look.js';
import { createCareerStats } from './game/careerStats.js';

// --- Renderer, scene, camera ---------------------------------------------------

// No canvas anti-aliasing: every frame is drawn through fx/postProcessing.js, whose last pass is one
// full-screen quad, so canvas MSAA would cost memory and bandwidth without smoothing anything.
// The game's anti-aliasing lives on the composer's buffers (atmosphere.postProcessing.msaaSamples).
const renderer = new THREE.WebGLRenderer({ antialias: false });
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
const noticesMenu = createNoticesMenu(hud.history);
const sound = createSound(); // synthesized sound effects (starts on the first click/key press)
const viewmodel = createViewmodel(Object.values(weapons), meleeWeapons.boxCutter); // a model for every gun
const postProcessing = createPostProcessing({ renderer, scene, camera, viewmodel });
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
const { state: game, death, map, player, gun, melee, zombies, rounds, health, wallet, effects, aimAssist, interactions, pricing, flashSales } = g;
const workshop = g.features.list.find(({ feature }) => feature.kind === 'workshop')?.instance; // Build-A-Blaster (the HUD reads its status)
const { ritual, drops: limitedEditions } = workshop ?? {};
const clawMachine = g.features.list.find(({ feature }) => feature.kind === 'clawMachine')?.instance; // GRAB-A-GUN (the HUD reads its status)
const resetRun = g.resetRun;
hud.connectEvents(g.events);
const haptics = createHaptics({ gamepad, input, state: game, health, events: g.events });

// Button name for prompts on whichever device was used last ("R" vs "X" vs "□").
function buttonLabel(action) {
  const device = input.device === 'gamepad' ? gamepad.type : 'keyboard';
  return buttonLabels[device][action];
}

const DEG_TO_RAD = Math.PI / 180;

// Debug keys (raw key codes are only used here, never in gameplay). Run by the game each live tick, just before the
// player moves. config/debug.js lists the keys; each press becomes g.debug.run(id) (game/debugCommands.js).
// (The window's own key is handled below, so it also works on the title and pause screens, not just while playing.)
const browserOnly = new Set(['panel', 'benchmark']); // (handled by the keydown listener below, on any screen)
const debugCodes = [...new Set(debug.commands.filter((c) => !browserOnly.has(c.id)).map((c) => c.key))];
function handleDebugKeys() {
  if (!debug.enabled) return;
  const shift = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  for (const code of debugCodes) {
    if (!input.consumePress(code)) continue;
    const command = g.debug.resolve(code, shift);
    if (command) g.debug.run(command.id);
  }
}

// Settings (config/settings.js is the list; changes apply to the game and are saved in the browser).
// Created after the HUD and sound so each setting's apply() can reach them.
// The light pool (fx/lightPool.js): on lower Graphics settings a few real lights follow the camera round the map's lamps.
const lightPool = createLightPool({ scene, sources: collectPointLights(map.group, g.arena?.group) });
// Zone lighting: the view eases to the colour grade of the area the camera is in (fx/zoneGrading.js, config/look.js grading).
const zoneGrading = createZoneGrading({ zones: map.gradeZones, ...look.grading });
// (map.horror.state: the horror layer's round darkness and power cuts, game/features/horror.js)
const gradeAt = (frameTime) => zoneGrading.update(frameTime, camera.position, look.runtime.zoneGrading, map.horror?.state);
const firstLaunch = !hasSavedSettings(); // (read before anything is saved)
const settings = createSettings({ renderer, sound, hud, postProcessing, lightPool, haptics });
// First launch: pick a Graphics preset that suits this computer from the title flyover's frame rate (game/autoGraphics.js).
const autoGraphics = createAutoGraphics({
  firstLaunch,
  visible: () => document.visibilityState === 'visible' && document.hasFocus(),
  choose: (label) => {
    const preset = settingPresets.Graphics.find((p) => p.label === label);
    for (const [id, value] of Object.entries(preset.values)) settings.set(id, value);
    console.log(`Graphics: picked ${label} for this computer (Settings > Graphics to change)`);
  },
});
const settingsMenu = createSettingsMenu(settings);
const controlsMenu = createControlsMenu();
// The debug window (the ` key): lists the debug keys with live numbers; hidden unless the game's debug state says so.
const debugPanel = debug.enabled ? createDebugPanel({ status: () => g.debug.status() }) : null;
if (debugPanel) {
  document.body.appendChild(debugPanel.element);
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const id = g.debug.resolve(e.code, e.shiftKey)?.id;
    if (id === 'panel') g.debug.run('panel');
    if (id === 'benchmark') runBenchmark();
  });
}

// The benchmark (fx/benchmark.js): a fixed camera route through every area (map.benchmarkShots), timed. Only while the
// game isn't ticking (title or pause screen), so nothing in the run moves. Every door is opened for the route (a closed
// shutter would hide whole rooms) and put back exactly as it was afterwards. Press Shift+B again to stop early.
const benchmark = createBenchmark({
  camera, renderer, draw: () => {
    lightPool.update(camera.position, 1 / 60);
    roomCulling.update(cullingOn);
    postProcessing.render({ showViewmodel: false, speedAmount: 0, grade: gradeAt(1 / 60) });
  },
});
async function runBenchmark() {
  if (benchmark.active) return benchmark.cancel();
  if (game.running) {
    hud.showAnnouncement({ kicker: 'Benchmark', text: 'Pause first (Esc), then press Shift+B' });
    return null;
  }
  const settle = () => { for (let i = 0; i < 240; i++) map.update(1 / 60); }; // (shutters finish rolling)
  const wasOpen = map.doors.map((d) => d.isOpen);
  for (const d of map.doors) if (!d.isOpen) d.open();
  settle();
  camera.fov = feel.camera.fov;
  camera.updateProjectionMatrix();
  const report = await benchmark.start(map.benchmarkShots ?? map.titleShots, debug.benchmark);
  map.doors.forEach((d, i) => { if (!wasOpen[i]) d.reset(); });
  settle();
  report.settings = Object.fromEntries(settings.defs.filter((d) => d.tab === 'Graphics').map((d) => [d.id, settings.get(d.id)]));
  const line = `${report.drawMs.avg} ms draw (p95 ${report.drawMs.p95}), ${report.fps} fps, ${report.calls} draw calls; slowest: ${report.slowestShot}`;
  g.debug.state.last = `Benchmark: ${line}`;
  hud.showAnnouncement({ kicker: report.cancelled ? 'Benchmark (stopped early)' : 'Benchmark', text: line });
  console.log('Benchmark', report);
  console.table(report.perShot);
  if (window.__mall) window.__mall.lastBenchmark = report;
  return report;
}
// Static batching (world/staticBatch.js): the map's still, opaque meshes merged by material and chunk, before the first frame
// (about 1,500 meshes -> about 450). Browser only: the map's own tests see every mesh as built.
// Room culling (fx/roomCulling.js): rooms the camera can't see aren't drawn. Tagged before batching, so batches keep rooms
// apart; updated before every draw. ?noculling: off, to compare.
const doorById = new Map(map.doors.map((d) => [d.id, d]));
const roomCulling = createRoomCulling({
  areas: map.cullAreas, portals: map.cullPortals, camera, isOpen: (id) => doorById.get(id)?.isOpen ?? true,
});
const cullingOn = !new URLSearchParams(location.search).has('noculling');
if (cullingOn) roomCulling.tag(map.group);
if (!new URLSearchParams(location.search).has('nobatch')) batchStatic(map.group); // (?nobatch: off, to compare)
effects.prepare(renderer, camera); // shared impact graphics warmed before the first shot

// --- Menus and the run's flow ------------------------------------------------------
// title (live flyover) -> playing <-> paused -> dead -> results receipt -> playing again / title.
// With the mouse, PLAYING means the pointer is locked (a click on Play/Resume asks for the lock; the game starts
// when the browser grants it). With a controller, the game runs without the lock (game.padPlaying).
const screens = hud.screens;
const titleCamera = createTitleCamera(map.titleShots, feel.titleScreen);
const careerStats = createCareerStats();
g.events.on('runEnd', ({ summary }) => screens.setCareerResult(careerStats.recordRun(summary)));

function enterPlaying() {
  // A delayed pointer-lock grant can arrive after another menu was opened.
  // Playing must remove every overlay, including its backdrop-filter layer.
  settingsMenu.close();
  controlsMenu.close();
  noticesMenu.close();
  screens.show(null);
  hud.setDimmed(false);
}
function play({ pad }) {
  sound.unlock(); // browsers only allow audio after a click / button press
  if (pad) {
    game.padPlaying = true;
    enterPlaying();
  } else {
    input.requestLock(); // playing starts when the lock is granted (onLockChange below)
  }
}
function runSoFar() {
  return { round: rounds.round, points: wallet.points, time: g.runStats.timeAlive, kills: g.runStats.kills };
}
function pauseRun() {
  haptics.stop();
  game.padPlaying = false;
  if (document.pointerLockElement) document.exitPointerLock();
  screens.show('pause', runSoFar());
  hud.setDimmed(true);
}
// A fresh run: everything reset, then straight into play (if the mouse lock is refused, "Back to work" waits).
function freshRun(how) {
  screens.setCareerResult(null);
  resetRun();
  screens.show('pause', { fresh: true });
  hud.setDimmed(true);
  play(how);
}
function goToTitle() {
  game.padPlaying = false;
  if (document.pointerLockElement) document.exitPointerLock();
  resetRun();
  screens.setCareerResult(null);
  titleCamera.restart();
  screens.show('title');
  hud.setDimmed(true);
}

screens.on('play', play);
screens.on('resume', play);
screens.on('restart', freshRun);
screens.on('playAgain', freshRun);
screens.on('quit', goToTitle);
screens.on('mainMenu', goToTitle);
screens.on('settings', () => settingsMenu.open());
screens.on('stats', () => screens.show('stats', careerStats.snapshot()));
screens.on('clearStats', () => screens.show('stats', careerStats.reset()));
screens.on('statsBack', () => screens.show('title'));
wireRunIntro({ events: g.events, hud, sound }); // the PA's opening line as round 1 begins
screens.on('controls', () => controlsMenu.open());
screens.on('notices', () => noticesMenu.open());

input.onLockChange((locked) => {
  if (locked) {
    game.padPlaying = false; // the mouse took over
    if (!game.over) enterPlaying();
  } else if (!game.over && !game.padPlaying && !screens.current) {
    pauseRun(); // Esc (or the browser) released the mouse mid-run
  }
});
goToTitle(); // the game opens on the main menu

// Controller: the open menu gets the buttons; in play, Start pauses. Unplugging the controller mid-run pauses
// (otherwise the zombies keep going with nobody playing).
let padWasConnected = false;
function handleControllerMenus() {
  if (noticesMenu.isOpen) {
    noticesMenu.padNav(input);
    return;
  }
  if (controlsMenu.isOpen) {
    controlsMenu.padNav(input);
    return;
  }
  if (settingsMenu.isOpen) {
    settingsMenu.padNav(input); // the controller drives the settings menu while it's up
    return;
  }
  if (padWasConnected && !gamepad.connected && game.padPlaying && !game.over) pauseRun();
  padWasConnected = gamepad.connected;

  if (screens.current) {
    screens.padNav(input);
  } else if (game.running && !game.over && input.consumeAction('pause')) {
    pauseRun();
  }
}

function update(dt) {
  gamepad.poll();
  haptics.update();
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
  if (debugPanel) debugPanel.update(frameTime);
  fpsMeter.frames++;
  fpsMeter.time += frameTime;
  if (fpsMeter.time >= 0.25) {
    hud.setFps(Math.round(fpsMeter.frames / fpsMeter.time));
    fpsMeter.frames = 0;
    fpsMeter.time = 0;
  }

  if (benchmark.active) {
    benchmark.frame(frameTime); // (it owns the camera and the draw until its route is done)
    return;
  }

  if (screens.showsFlyover) {
    renderTitle(frameTime);
    return;
  }

  // While paused nothing ticks, so interpolating between the last two ticks would make things
  // twitch: show the latest tick instead. Visual time keeps flowing after death (the world goes
  // on around the death camera) but stops while paused.
  const paused = !game.running && !game.over;
  if (paused) alpha = 1;
  const visualTime = paused ? 0 : frameTime;

  // ADS zoom + sprint FOV kick: narrow the world camera's FOV on ADS, widen slightly when sprinting.
  const aimAmount = gun.aim.renderAmount(alpha);
  const baseFov = feel.camera.fov * (1 + (gun.weapon.def.ads.fovMultiplier - 1) * aimAmount);
  const speedAmount = game.over ? 0 : player.sprintAmount * (1 - aimAmount);
  const fov = baseFov + (atmosphere.postProcessing?.sprintFovDegrees ?? 5.5) * speedAmount;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  player.lookScale = feel.ads.sensitivityFollowsZoom ? baseFov / feel.camera.fov : 1; // used by next frame's look

  player.syncCamera(alpha);
  lightPool.update(camera.position, frameTime);
  if (game.over) applyDeathCamera(alpha);
  body.root.visible = !game.over;
  body.update(visualTime, player, alpha);
  zombies.render(visualTime, alpha);
  g.contactShadows.update(zombies.zombies, alpha);
  effects.update(visualTime);
  viewmodel.update(visualTime, camera, {
    weapon: gun.weapon,
    shownDef: gun.shownDef, // mid-switch: the old gun while it drops away
    switchLower: gun.switchLower,
    aimAmount,
    meleeProgress: melee.progress,
    player,
    inspectProgress: gun.inspectProgress,
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
  {
    const mods = gun.modsFor(gun.def.id) ?? [];
    const build = buildOf(mods), fitted = attachmentsOf(mods);
    hud.setUpgradeRow({
      renewals: renewalsOf(mods),
      build: build && { color: workshopStuffings[build.stuffing]?.color ?? 0xffffff, accent: gunStyle.heart.colors[build.heart] ?? null, label: `${qualityById(build.quality)?.name ?? ''} ${workshopStuffings[build.stuffing]?.name ?? ''}`.trim() },
      slots: Object.entries(upgrades.attachmentSlots).map(([slot, def]) => ({ name: def.name, fitted: !!fitted[slot] })),
    });
  }
  const prompt = game.over || game.menu ? null : interactions.prompt; // (no shelf ticket behind an open menu)
  // A Flash Sale shows as a SALE mark on the price of whatever it discounted.
  hud.setInteract(prompt && {
    ...prompt,
    sale: !prompt.owned && PRICE_CATEGORIES.includes(prompt.kind) && pricing.discountOf(prompt.kind) > 0,
    originalCost: PRICE_CATEGORIES.includes(prompt.kind) ? pricing.basePriceOf(prompt.kind, prompt.pricingId ?? prompt.id) : prompt.cost,
  }, buttonLabel('interact'));
  hud.setFlashSale(game.over ? null : flashSales.active);
  hud.setPowerUps(game.over ? null : g.powerUps);
  hud.setRitual(game.over ? null : ritual?.status ?? null);
  hud.setOrderForm(game.over ? null : ritual?.form ?? null,
    { confirm: buttonLabel('menuConfirm'), back: buttonLabel('menuBack'), move: buttonLabel('menuMove'), switch: buttonLabel('menuSwitch') });
  hud.setLimitedEdition(game.over ? null : limitedEditions?.status ?? null);
  hud.setClawMachine?.(game.over ? null : clawMachine?.status ?? null);
  hud.setVaultPrompt(game.running && !game.over && g.vaultPromptVisible, buttonLabel('jump'));
  hud.setPoints(wallet.points);
  hud.setTickets?.(g.tickets.count); // (GRAB-A-GUN's prize tickets: shown only once you have some)
  hud.setRoundFlashing(rounds.inBreak && rounds.round > 1); // counter blinks in the break between rounds

  // Render world + viewmodel through HDR post-processing (UnrealBloom + lens vignette/aberration + ACES tone mapping).
  roomCulling.update(cullingOn);
  postProcessing.render({ showViewmodel: !game.over, speedAmount, grade: gradeAt(frameTime) });
}

// The main menu's backdrop: the camera glides through the mall (map.titleShots), fading through black at each cut.
// The game itself is frozen (nothing ticks without the mouse lock or a controller), and no gun or body is drawn.
function renderTitle(frameTime) {
  autoGraphics.frame(frameTime);
  titleCamera.update(frameTime);
  if (camera.fov !== feel.titleScreen.fov) {
    camera.fov = feel.titleScreen.fov;
    camera.updateProjectionMatrix();
  }
  screens.setFade(titleCamera.apply(camera));
  lightPool.update(camera.position, frameTime);
  body.root.visible = false;
  effects.update(frameTime);
  roomCulling.update(cullingOn);
  postProcessing.render({ showViewmodel: false, speedAmount: 0, grade: gradeAt(frameTime) });
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

const loop = startLoop({
  tickRate: feel.simulation.tickRate,
  maxFrameTime: feel.simulation.maxFrameTime,
  beforeUpdate: applyLookInput,
  update,
  render,
});

// Idle saver (core/idleSaver.js, config/idle.js): while nobody is playing (title, pause and results screens) the game draws
// slowly, then stops, and suspends its audio. Never during a live run, a benchmark, or the first launch's graphics measurement
// (unless that window is hidden, when the measurement is skipping frames anyway).
const idleSaver = createIdleSaver({
  loop, sound,
  eligible: () => !game.running && !benchmark.active
    && (autoGraphics.done || !(document.visibilityState === 'visible' && document.hasFocus())),
});

if (debug.exposeToWindow) {
  window.__mall = {
    THREE, scene, camera, renderer, postProcessing, map, world: map, colliders: g.colliders, arena: g.arena, player, stats: g.stats, input, game,
    hud, gun, effects, viewmodel, shootables: g.shootables, body, zombies, health, melee, runStats: g.runStats, death, resetRun,
    gamepad, aimAssist, wallet, rounds, sound, interactions, g, screens, titleCamera, roomCulling,
    menus: { play, pauseRun, freshRun, goToTitle }, // the menu flow, for testing
    benchmark: runBenchmark, // await __mall.benchmark() -> the report (title or pause screen)
    settings, lightPool, loop, idleSaver, // (settings.set(id, value) as the menu would; the light pool)
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
