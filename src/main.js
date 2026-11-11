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
import { save as saveConfig } from './config/save.js';
import { debug } from './config/debug.js';
import { ui } from './config/ui.js';
import { startLoop } from './core/loop.js';
import { createIdleSaver } from './core/idleSaver.js';
import { Input } from './core/input.js';
import { createGamepad } from './core/gamepad.js';
import { createHaptics } from './core/haptics.js';
import { buttonLabels } from './config/controls.js';
import { buildTestRange } from './maps/testRange/testRange.js';
import { createHud } from './ui/hud.js';
import { createDamageIndicatorQueue } from './ui/damageDirection.js';
import { weapons, melee as meleeWeapons } from './config/weapons.js';
import { createViewmodel } from './weapons/viewmodel.js';
import { createPlayerBody } from './player/body.js';
import { connectWardrobeAppearance } from './player/wardrobeAppearance.js';
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
import { createRunStart } from './ui/runStart.js';
import { createBenchmark } from './fx/benchmark.js';
import { createBallView } from './fx/ballView.js';
import { createThrowableView } from './fx/throwableView.js';
import { createLightPool, collectPointLights } from './fx/lightPool.js';
import { batchStatic } from './world/staticBatch.js';
import { sheenEnvironment, applyMetalSheen } from './fx/metalSheen.js';
import { createAutoGraphics } from './game/autoGraphics.js';
import { wireRunIntro } from './game/runIntro.js';
import { atmosphere } from './config/environment.js';
import { createPostProcessing } from './fx/postProcessing.js';
import { createZoneGrading } from './fx/zoneGrading.js';
import { createRoomCulling } from './fx/roomCulling.js';
import { look } from './config/look.js';
import { createCareerStats } from './game/careerStats.js';
import { createSkinSave } from './game/skinSave.js';
import { createLocker } from './ui/locker.js';
import { createGuideSave } from './game/guideSave.js';
import { createGuideScreen } from './ui/guide.js';

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
const skinSave = createSkinSave();
const locker = createLocker({ save: skinSave, onBack: () => hud.screens.show('title') });
const guideSave = createGuideSave();
const guideScreen = createGuideScreen({ save: guideSave, onBack: () => hud.screens.show('title') });
const hud = createHud({ locker, guide: guideScreen });
const noticesMenu = createNoticesMenu(hud.history);
const sound = createSound(); // synthesized sound effects (starts on the first click/key press)
const viewmodel = createViewmodel(Object.values(weapons), meleeWeapons.boxCutter, {
  skinFor: (gunId) => g.debug.skinFor(gunId) ?? g.skins.skinFor(gunId),
});
const postProcessing = createPostProcessing({ renderer, scene, camera, viewmodel });

const g = createGame({
  skinSave,
  guideSave,
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
const body = createPlayerBody(scene, effects); // legs + torso you see when looking down
connectWardrobeAppearance(g.events, { body, viewmodel });
const workshop = g.features.list.find(({ feature }) => feature.kind === 'workshop')?.instance; // Build-A-Blaster (the HUD reads its status)
const { ritual, drops: limitedEditions } = workshop ?? {};
const fittingRooms = g.features.list.filter(({ feature }) => feature.kind === 'fittingRoom').map(({ instance }) => instance); // (the HUD draws the open picker)
const clawMachine = g.features.list.find(({ feature }) => feature.kind === 'clawMachine')?.instance; // GRAB-A-GUN (the HUD reads its status)
const resetRun = g.resetRun;
hud.connectEvents(g.events);
const damageIndicators = createDamageIndicatorQueue({
  events: g.events,
  hud,
  getCameraYaw: () => camera.rotation.y,
  getPlayerPosition: () => player.position,
});
const haptics = createHaptics({ gamepad, input, state: game, health, events: g.events });

// Which button set prompts show: the device used last ('keyboard', or the controller's type: 'xbox', 'playstation'...).
function promptDevice() {
  return input.device === 'gamepad' ? gamepad.type : 'keyboard';
}
// Button name for prompts on whichever device was used last ("R" vs "X" vs "□").
function buttonLabel(action) {
  return buttonLabels[promptDevice()][action];
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
// The haze (config/look.js grading fog): built once (so no shader recompiles later), its colour and density follow the grade.
scene.fog = new THREE.FogExp2(0xffffff, 0);
const gradeAt = (frameTime) => {
  const grade = zoneGrading.update(frameTime, camera.position, look.runtime.zoneGrading, map.horror?.state);
  scene.fog.density = grade.fog;
  scene.fog.color.setRGB(grade.fogColor[0], grade.fogColor[1], grade.fogColor[2], THREE.SRGBColorSpace);
  return grade;
};
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
if (!new URLSearchParams(location.search).has('nobatch')) batchStatic(map.group, { shade: look.bakedShade }); // (?nobatch: off, to compare)
// Metal sheen (fx/metalSheen.js): a tiny baked gradient for metal materials only, after batching so the merged ones get it.
const metalSheen = sheenEnvironment(renderer, look.metalSheen);
for (const root of [map.group, g.arena?.group].filter(Boolean)) applyMetalSheen(root, metalSheen, look.metalSheen);
effects.prepare(renderer, camera); // shared impact graphics warmed before the first shot
const ballView = createBallView(scene, g.balls); // the Tennis Ball Launcher's balls in the air
const throwableView = createThrowableView(scene, g.equipment); // Kiosk Kevin's thrown equipment (a Soda Bomb on its fuse)

// --- Menus and the run's flow ------------------------------------------------------
// title (live flyover) -> playing <-> paused -> dead -> results receipt -> playing again / title.
// With the mouse, PLAYING means the pointer is locked (a click on Play/Resume asks for the lock; the game starts
// when the browser grants it). With a controller, the game runs without the lock (game.padPlaying).
const screens = hud.screens;
const titleCamera = createTitleCamera(map.titleShots, feel.titleScreen);
const careerStats = createCareerStats();
g.events.on('runEnd', ({ summary }) => screens.setCareerResult(careerStats.recordRun(summary)));
function showWin(summary, clockedOut = false) {
  hud.setDimmed(true);
  screens.show('results', { ...g.receiptFor(summary), shiftComplete: true, clockedOut }); // (Classic: no checklist line)
}
g.events.on('runWon', ({ summary }) => {
  haptics.stop();
  game.padPlaying = false;
  showWin(summary);
  if (document.pointerLockElement) document.exitPointerLock();
});

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
  return {
    round: rounds.round, points: wallet.points, time: g.runStats.timeAlive, kills: g.runStats.kills,
    outfit: g.outfitRail.snapshot(), closing: game.showClosingGuidance ? g.closing.checklist : null,
    canSave: g.saveGame.canSave(), // Save & quit: greyed with the reason when it can't save now
  };
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
  g.leaveRun(); // (a won run left by Restart run is recorded first)
  screens.setCareerResult(null);
  resetRun();
  screens.show('pause', { fresh: true, closing: game.showClosingGuidance ? [] : null });
  hud.setDimmed(true);
  play(how);
}
function goToTitle({ saved = false } = {}) {
  game.padPlaying = false;
  if (document.pointerLockElement) document.exitPointerLock();
  // A won run left by Quit to title is recorded first. Not after Save & quit: that run goes on after Continue and is
  // recorded once, when it really ends (a save that is never continued is never recorded, like any run left unwon).
  if (!saved) g.leaveRun();
  resetRun();
  screens.setCareerResult(null);
  screens.setContinue(g.saveGame.peek()); // "Continue · Round N" while a save exists
  if (g.saveGame.dropped) hud.showAnnouncement({ kicker: 'Save & quit', text: saveConfig.droppedNotice });
  titleCamera.restart();
  screens.show('title');
  hud.setDimmed(true);
}
// SAVE & QUIT (game/saveGame.js): the run ends at the title with its round-start snapshot in the one slot.
function saveAndQuit() {
  if (g.saveGame.saveAndQuit()) goToTitle({ saved: true });
}
// Continue: the save is used up, and the run resumes at the start of its round's break.
function continueRun(how) {
  screens.setCareerResult(null);
  if (!g.saveGame.load()) return goToTitle(); // (an unreadable save is dropped: back to a title without Continue)
  screens.setContinue(null);
  screens.show('pause', { fresh: true });
  hud.setDimmed(true);
  play(how);
}
// Play from the title starts a new shift: a save left in the slot is discarded (the button asked twice).
function newShift(how) {
  g.skins.reset(); // the locker may have changed after the title reset the previous run
  g.saveGame.discard();
  screens.setContinue(null);
  play(how);
}

// The title's mode chooser (ui/runStart.js): stores the mode and plays. The title already reset the run, so nothing is
// reset again, and the chooser stays up until play really starts.
// Starting a new shift there discards a save left in the slot (newShift).
const runStart = createRunStart({ game, screens, settings, play: newShift });
screens.on('continue', continueRun);
screens.on('saveQuit', saveAndQuit);
screens.on('resume', play);
screens.on('restart', freshRun);
screens.on('playAgain', freshRun);
screens.on('clockOut', () => {
  if (g.clockOut()) showWin(g.winSummary, true);
});
screens.on('overtime', (how) => {
  if (!g.stayForOvertime()) return;
  // A browser can refuse a quick re-lock. Leave Resume available until it grants the lock.
  screens.show('pause', runSoFar());
  play(how);
});
screens.on('quit', goToTitle);
screens.on('mainMenu', goToTitle);
screens.on('settings', () => settingsMenu.open());
screens.on('stats', () => screens.show('stats', careerStats.snapshot()));
screens.on('clearStats', () => screens.show('stats', careerStats.reset()));
screens.on('statsBack', () => screens.show('title'));
screens.on('locker', () => screens.show('locker'));
screens.on('guide', () => screens.show('guide'));
window.addEventListener('pagehide', () => { g.challenges.flush(); g.guide.flush(); }); // closing the tab mid-run keeps the skin progress it earned
wireRunIntro({ events: g.events, hud, sound }); // the PA's opening line as round 1 begins
screens.on('controls', () => controlsMenu.open());
screens.on('notices', () => noticesMenu.open());

input.onLockChange((locked) => {
  if (locked) {
    if (game.winPending || game.over || !runStart.acceptsLock()) {
      document.exitPointerLock();
      return;
    }
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
    locker.render(frameTime);
    guideScreen.render(frameTime);
    return;
  }

  // While paused nothing ticks, so interpolating between the last two ticks would make things
  // twitch: show the latest tick instead. Visual time keeps flowing after death (the world goes
  // on around the death camera) but stops while paused.
  const paused = !game.running && !death.summary;
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
  if (death.summary) applyDeathCamera(alpha);
  body.root.visible = !death.summary;
  body.update(visualTime, player, alpha);
  zombies.render(visualTime, alpha);
  g.contactShadows.update(zombies.zombies, alpha);
  effects.update(visualTime);
  ballView.update(alpha); // the Tennis Ball Launcher's balls in the air
  throwableView.update(alpha);
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

  hud.setHealth(health.fraction, health.regenWaitFraction);
  hud.setArmour(game.over ? 0 : health.armour.length);
  hud.setHurt(health.overlay);
  damageIndicators.flush();
  hud.setSpeedLines(game.over ? 0 : player.sprintAmount * feel.sprintFx.speedLinesOpacity);
  hud.setSprint(player.sprintFraction, player.sprintExhausted, player.isSprinting);
  {
    // The carried gun not in hand: its button is slot 1 / slot 2 on a keyboard, the swap button on a controller.
    const secondary = gun.inactiveSlot;
    const switchAction = promptDevice() !== 'keyboard' ? 'switchWeapon' : secondary?.index === 0 ? 'weapon1' : 'weapon2';
    hud.setAmmo(gun.weapon, buttonLabel('reload'), secondary, buttonLabel(switchAction));
  }
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
  const menuLabels = { confirm: buttonLabel('menuConfirm'), back: buttonLabel('menuBack'), move: buttonLabel('menuMove'), switch: buttonLabel('menuSwitch') };
  hud.setOrderForm(game.over ? null : ritual?.form ?? null, menuLabels);
  hud.setFittingRoom(game.over ? null : fittingRooms.find((room) => room.view)?.view ?? null, menuLabels);
  hud.setLimitedEdition(game.over ? null : limitedEditions?.status ?? null);
  const objectiveArea = ui.startObjective.until;
  hud.setObjective(game.over || g.map.zones[objectiveArea]?.open !== false ? null
    : ui.startObjective.text.replace('{price}', g.pricing.priceOf('door', objectiveArea).toLocaleString('en-US')));
  hud.setClosing(
    game.showClosingGuidance ? g.closing.checklist : null,
    game.showClosingGuidance && !game.over ? g.closing.markers : {},
  );
  hud.setOvertime(game.won && !game.winPending && !game.over);
  hud.setClawMachine?.(game.over ? null : clawMachine?.status ?? null, game.running ? frameTime : 0); // (its banner's clock stops while paused)
  hud.setPockets(game.over ? null : g.equipment.status, { lethal: buttonLabel('lethal'), tactical: buttonLabel('tactical') });
  hud.setVaultPrompt(game.running && !game.over && g.vaultPromptVisible, buttonLabel('jump'));
  hud.setPoints(wallet.points);
  hud.setTickets?.(g.tickets.count); // (GRAB-A-GUN's prize tickets: shown only once you have some)
  hud.setRoundFlashing(rounds.inBreak && rounds.round > 1); // counter blinks in the break between rounds
  hud.setOccupancy?.(rounds.remainingInWave, rounds.inBreak);
  const clockInPrompt = game.over || game.menu ? null : g.clockIn.prompt; // the shopping window: hold to call the next round
  hud.setClockIn?.(clockInPrompt, clockInPrompt && buttonLabel(clockInPrompt.action));

  // Render world + viewmodel through HDR post-processing (UnrealBloom + lens vignette/aberration + ACES tone mapping).
  roomCulling.update(cullingOn);
  postProcessing.render({ showViewmodel: !death.summary, speedAmount, grade: gradeAt(frameTime) });
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
    gamepad, aimAssist, wallet, rounds, sound, interactions, g, screens, locker, skinSave, titleCamera, roomCulling,
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
