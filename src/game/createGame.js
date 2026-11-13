// =============================================================================
// CREATE GAME: builds and wires every gameplay system, and runs one fixed tick.
// No DOM, no WebGL: main.js owns the browser side (renderer, pointer lock, menus,
// the controller menus, drawing) and passes in the parts that need a browser:
//   hud        ui/hud.js            (tests pass a do-nothing stand-in)
//   sound      audio/sound.js       (same)
//   viewmodel  weapons/viewmodel.js (the gun drawn in your hands; same)
//   input      core/input.js        (the real Input works in Node with stub window/document)
// Everything else (map, player, guns, zombies, rounds, points, buyables) is real, so a
// whole run can be played in a Node test (tests/fullRun.test.js).
//
//   const g = createGame({ scene, camera, input, hud, sound, viewmodel, ... })
//   g.update(dt)   one fixed tick (60 Hz) of gameplay
//   g.resetRun()   Play again: everything back to the start of a run
//   g.state        { forceRun, over, padPlaying, running }  (window.__mall.game)
//   g.events       the event bus (game/events.js lists every event): systems announce, features listen
//   g.pricing      every price the player pays (game/pricing.js): config base price + any discount
//   g.wardrobe     the current outfit and bag (game/wardrobe.js)
//   g.flashSales   the mall PA's timed discounts (game/flashSales.js); .active = the sale running now (or null)
//   g.debug        the developer shortcuts (game/debugCommands.js): run(id), resolve(key, shift), status()
//   g.equipment    Kiosk Kevin's equipment: the Lethal and Tactical pockets and the throw (game/equipment.js);
//                  g.throwables = the thrown things in the air (weapons/ballistics.js, bouncing off zombies)
//   g.rockets      the Bottle Rocket Bazooka's rockets in the air (weapons/ballistics.js, zombies 'bounce'; each bursts on its first contact)
//   g.<system>     map, colliders, arena, shootables, stats, player, wallet, runStats, effects, aimAssist,
//                  gun, interactions, melee, health, zombies, mascotCostumes, rounds, death
// =============================================================================

import { feel } from '../config/feel.js';
import { Vector3 } from 'three';
import { powerUps as incentiveConfig } from '../config/powerUps.js';
import { economy, maxAliveForRound } from '../config/economy.js';
import { upgrades } from '../config/upgrades.js';
import { bossTiming } from '../config/bosses.js';
import { createBossDirector } from './bossDirector.js';
import { configureBossVouchers } from './bossVouchers.js';
import { createShutterSounds } from './shutterSounds.js';
import { mascotGold } from '../config/zombies.js';
import { weapons, melee as meleeWeapons } from '../config/weapons.js';
import { loadMap } from '../maps/index.js';
import { createPlayerStats, resetPlayerStats } from '../player/stats.js';
import { PlayerController } from '../player/controller.js';
import { createPlayerHealth } from '../player/health.js';
import { createEffects } from '../fx/effects.js';
import { createContactShadows } from '../fx/contactShadows.js';
import { createAmbience } from './ambience.js';
import { createPowerUps } from './powerUps.js';
import { closingTime } from '../config/closingTime.js';
import { createClosingTime } from './closingTime.js';
import { createClosingKeyView } from '../fx/closingKeyView.js';
import { createPowerUpView } from '../fx/powerUpView.js';
import { createPlayerGun } from '../weapons/playerGun.js';
import { createMelee } from '../weapons/melee.js';
import { createAimAssist } from '../weapons/aimAssist.js';
import { createBalls } from '../weapons/ballistics.js';
import { createEquipment } from './equipment.js';
import { createZombieManager } from '../zombies/zombieManager.js';
import { createMascotCostumes } from './mascotCostumes.js';
import { createSurfaceSlows } from './surfaceSlows.js';
import { createEvents } from './events.js';
import { createPricing } from './pricing.js';
import { createFlashSales, saleEligibility, doorbusterCandidates, nearOpenSpawnPoints, reachableInTime } from './flashSales.js';
import { createAnnouncer } from './announcer.js';
import { createDebugCommands } from './debugCommands.js';
import { createWarranty } from './warranty.js';
import { createMeleeUpgrades } from './meleeUpgrades.js';
import { createSecondChance } from './secondChance.js';
import { createWardrobe } from './wardrobe.js';
import { createOutfitRail } from './outfitRail.js';
import { createRunStats } from './runStats.js';
import { createSkinSave } from './skinSave.js';
import { createSkins } from './skins.js';
import { createChallenges } from './challenges.js';
import { createGuideSave } from './guideSave.js';
import { createGuide } from './guide.js';
import { createLostFound } from './lostFound.js';
import { createReturnQuest } from './returnQuest.js';
import { createWallet, pointsForHit } from './wallet.js';
import { createRounds } from './rounds.js';
import { createClockIn } from './clockIn.js';
import { createStragglers } from './stragglers.js';
import { createInteractions } from './interactions.js';
import { createTickets } from './tickets.js';
import { buildFeatures, featuresOf } from './features/index.js';
import { ownedAttachments, unlockAttachment } from './features/attachmentCounter.js';
import { createSaveGame } from './saveGame.js';
import { comboName } from '../config/workshop.js';

const DEG_TO_RAD = Math.PI / 180;

/**
 * @param scene, camera   three.js scene (the map, zombies and effects go in it) and the world camera
 * @param input           core/input.js Input (or a test double with the same calls)
 * @param hud, sound, viewmodel  browser parts (see the header)
 * @param skinSave        optional permanent skin record (memory by default; main.js supplies browser storage)
 * @param guideSave       optional permanent Survival Guide record (memory by default; main.js supplies browser storage)
 * @param mapId           which map (maps/index.js)
 * @param buildTestRange  optional (scene, colliders) => arena: the debug movement/shooting range
 * @param debugTick       optional () => void, run each live tick just before the player moves
 *                        (main.js handles its debug keys there)
 * @param onPlayerDeath   optional () => void, after the game has registered the death (main.js
 *                        frees the mouse there)
 */
export function createGame({
  scene,
  camera,
  input,
  hud,
  sound,
  viewmodel,
  skinSave = createSkinSave({ storage: null }),
  guideSave = createGuideSave({ storage: null }),
  mapId = 'mall',
  buildTestRange = null,
  debugTick = null,
  onPlayerDeath: afterDeath = null,
  saveStorage = undefined, // Save & Quit's slot (game/saveGame.js): localStorage in the browser; tests pass their own
}) {
  // One shared list of solid boxes: the map, debug add-ons and doors all write into it;
  // the player, zombies and bullets all read it.
  const colliders = [];
  const map = loadMap(mapId, scene, colliders);
  // Debug-only open area for testing movement and shooting (press T).
  const arena = buildTestRange ? buildTestRange(scene, colliders) : null;
  // Live combat bodies also block a vault's path and landing, even without a world collider.
  const shootables = [...(arena ? arena.shootables : [])];
  const stats = createPlayerStats();
  // Player slows (a boss's: the Janitor's wet floor, the Guard's taser; Scoops' melt): each reports its factor here, the
  // lowest becomes stats.surfaceSpeed.
  const surfaces = createSurfaceSlows(stats);
  const player = new PlayerController({
    camera,
    input,
    stats,
    colliders,
    spawn: map.playerSpawn,
    getBodies: () => shootables, // live hitboxes also block vault paths/landings
  });
  // Systems announce what happened here; payouts, stats, HUD and sound listen (see the wiring below).
  const events = createEvents();
  // Every price the player pays goes through here (base price from config/economy.js + any discount).
  const pricing = createPricing();
  // Points. Every gain/spend shows a "+60" / "-500" pop-up by the counter.
  const wallet = createWallet({
    onChange: (amount, points, style) => style ? hud.pointsPopup(amount, style) : hud.pointsPopup(amount),
    getMultiplier: () => stats.pointsMultiplier,
  });
  const runStats = createRunStats();
  events.on('purchase', ({ kind, id, cost }) => pricing.spendVoucher(kind, id, cost));
  events.on('playerDeath', () => {
    pricing.clearVoucher();
    for (const zombie of zombies.zombies) zombie.clearBossEffects();
  });
  // A player attack (gun or box cutter) hit something: announce it.
  const announceHit = (hit) => events.emit('hit', hit);
  const effects = createEffects(scene, { surfaces: [map.group, ...(arena ? [arena.group] : [])] });
  const aimAssist = createAimAssist({ player, input, shootables, colliders });
  const balls = createBalls({ colliders, shootables }); // the Tennis Ball Launcher's balls in the air (weapons/ballistics.js); the gun throws them, main.js draws them
  const rockets = createBalls({ colliders, shootables, zombies: 'bounce' }); // the Bottle Rocket Bazooka's rockets: the burst does the damage (weapons/blast.js)
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
    balls,
    onProjectileHit: () => { if (!runFrozen()) runStats.shotsHit += 1; }, // a thrown ball's first hit makes its shot a hit
    onShot: (shot) => events.emit('shot', shot),
    onHit: announceHit,
    onReload: (reload) => events.emit('reload', reload),
    aimAssist,
    rockets,
    onBlast: (blast) => events.emit('gunBlast', blast),
  });
  // Buyables (hold F / X): the map's doors and wall buys.
  const interactions = createInteractions({
    input,
    player,
    wallet,
    sound,
    colliders, // buy spots must be in plain sight (no buying through walls)
    onReloadTap: () => gun.requestReload(), // controller X tapped next to a buyable: it was a reload
    onPurchase: (purchase) => events.emit('purchase', purchase),
  });
  const shutterSounds = createShutterSounds({ events, doors: map.doors, sound });
  for (const door of map.doors) {
    interactions.add({
      get label() {
        const area = map.areaUnlocks?.destination(door);
        return area ? map.zones[area].label : door.label;
      },
      get title() { return map.areaUnlocks ? `Unlock ${this.label}` : this.label; },
      kind: 'door', // (for the 'purchase' event)
      id: door.id,
      get pricingId() { return map.areaUnlocks ? map.areaUnlocks.destination(door) : door.id; },
      verb: map.areaUnlocks ? 'unlock' : (door.verb ?? 'open'),
      detail: map.areaUnlocks ? 'Includes connections to unlocked areas' : '',
      get cost() {
        return pricing.priceOf('door', map.areaUnlocks ? map.areaUnlocks.destination(door) : door.id);
      },
      position: door.position,
      seeThrough: [door.barrier.collider], // the shutter itself doesn't block the view of its own buy spot
      available: () => map.areaUnlocks ? map.areaUnlocks.destination(door) !== null : !door.isOpen,
      use: () => {
        if (!map.areaUnlocks) return door.open();
        const areaId = map.areaUnlocks.destination(door);
        return { areaId, openedDoorIds: map.areaUnlocks.unlock(areaId) };
      },
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
    sound,
    onHit: announceHit,
  });

  // The game runs while the mouse is locked (Esc pauses) or while playing on a controller
  // (Start pauses). A controller doesn't need the mouse locked.
  const state = {
    closingMode: 'directed', // Title confirmation selects the mode; fresh-run resets keep it.
    get showClosingGuidance() { return this.closingMode === 'directed'; },
    forceRun: false, // debug: run without pointer lock (used by automated tests)
    over: false, // death or Clock out
    won: false,
    winPending: false, // waiting for Clock out or Stay for overtime
    padPlaying: false, // started/resumed with a controller
    menu: null, // an in-game menu a feature has open (Build-A-Blaster's 'orderForm'): the player stands still, the world doesn't
    assisted: false, // gameplay-changing debug command used; career records ignore this run
    get running() {
      return !this.over && !this.winPending && (input.locked || this.padPlaying || this.forceRun);
    },
  };
  const challenges = createChallenges({ events, state, save: skinSave });
  const skins = createSkins({ save: skinSave });
  const guide = createGuide({ events, state, save: guideSave }); // the Staff Survival Guide's sightings and kill counts
  const lostFound = createLostFound({ events, state, save: guideSave }); // lost property logged for good (the same record)
  const runFrozen = () => state.over || state.winPending;
  // GRAB-A-GUN's prize tickets (game/tickets.js): their own currency, never points, pricing or income.
  const tickets = createTickets({ events, state });
  const ambience = createAmbience({ map, player, sound, colliders });
  const contactShadows = createContactShadows(scene, colliders);
  events.on('playerDeath', () => ambience.silence());
  events.on('playerDeath', () => sound.playDeathMusic?.({ receiptAt: feel.death.resultsDelay }));
  events.on('runReset', () => sound.stopDeathMusic?.());
  let rounds = null; // created below, once the zombie manager exists
  const getRound = () => Math.max(1, rounds ? rounds.round : 1);
  const death = { timer: 0, resultsShown: false, summary: null };
  let secondChance = null; // the one self-revive per run (game/secondChance.js): created below, once the zombie manager exists
  let winSummary = null;
  let overtimeFrom = null; // the first overtime round (set by Stay for overtime), or null

  function buildRunSummary() {
    return Object.freeze({
      timeAlive: runStats.timeAlive,
      round: rounds.round,
      pointsEarned: wallet.totalEarned,
      pointsSpent: wallet.totalSpent,
      pointsRemaining: wallet.points,
      shotsFired: runStats.shotsFired,
      shotsHit: runStats.shotsHit,
      kills: runStats.kills,
      headshotKills: runStats.headshotKills,
      meleeKills: runStats.meleeKills,
      bossesDefeated: runStats.bossesDefeated,
      accuracy: runStats.accuracy,
      assisted: state.assisted || health.invulnerable,
      killedBy: health.killedBy,
      secondChanceUsed: secondChance.status === 'used', // the receipt's "Second Chance · Used" line
      // What you were wearing (slot -> item id or null): the receipt's DIED WEARING line.
      wearing: Object.freeze(Object.fromEntries(outfitRail.snapshot().map(({ slot, id }) => [slot, id]))),
      // The guns you named at Build-A-Blaster (the receipt reads them out).
      survivedBy: gun.namedBuilds.map((build) => ({ name: build.name, combo: comboName(build), confirmed: build.confirmed ?? 0 })),
      skinsUnlocked: challenges.earned,
      ticketsWon: tickets.won, // (GRAB-A-GUN's prize tickets: not points, not income)
      closingDone: closing.done,
      closingMode: state.closingMode, // 'directed' | 'classic': the Closing Time rewards read it (game/challenges.js closingWin)
      won: state.won,
      winTime: state.won ? winSummary?.timeAlive ?? runStats.timeAlive : null,
      winRound: state.won ? winSummary?.round ?? rounds.round : null,
      // Whole overtime rounds survived, or null before overtime. (Not round - winRound: after a win in the break,
      // overtime starts with the round the win happened in.)
      overtimeRounds: overtimeFrom === null ? null : Math.max(0, rounds.round - overtimeFrom),
      keychains: tickets.tokens.keychain, // Sunny plush keychains redeemed (a joke for the receipt until the Wardrobe exists)
    });
  }

  // THE single place the player dies (player/health.js calls it once per lethal hit). A held Second Chance covers the
  // hit instead (game/secondChance.js: full health where you stand, a shove, a grace period) and the run goes on.
  function onPlayerDeath() {
    if (state.over) return;
    if (secondChance.redeem()) return;
    state.over = true;
    state.winPending = false;
    death.timer = 0;
    death.resultsShown = false;
    const summary = buildRunSummary();
    death.summary = summary;
    hud.setDead(true);
    state.padPlaying = false;
    if (afterDeath) afterDeath(); // main.js frees the mouse now, so it's usable by the results screen
    events.emit('playerDeath');
    events.emit('runEnd', { summary });
  }

  function onRunWon() {
    if (state.over || state.won || !closing.readyToLeave) return; // (all four keys, lines 1 to 3 and paid validation and the Last Customer defeated)
    state.won = true;
    state.winPending = true;
    closing.completeLeaving(); // line 4 is the win itself: ticked here, before the summary, so the receipt reads 4 of 4
    winSummary = buildRunSummary();
    ambience.silence();
    events.emit('runWon', { summary: winSummary });
  }
  events.on('escapeVanStart', onRunWon);

  function clockOut() {
    if (!state.winPending) return false;
    state.over = true;
    state.winPending = false;
    state.padPlaying = false;
    events.emit('runEnd', { summary: winSummary });
    return true;
  }

  // Leaving a run from a menu (Quit to title, Restart run): main.js calls this BEFORE it resets. A won run that is
  // still on the clock (the receipt's choice is pending, or overtime is being played) is recorded here, exactly once:
  // the win plus whatever overtime added. A run that was never won is not recorded, and a run that already ended
  // (death, Clock out) was recorded when it ended.
  function leaveRun() {
    if (state.over || !state.won) return false;
    const summary = state.winPending ? winSummary : buildRunSummary();
    state.over = true;
    state.winPending = false;
    state.padPlaying = false;
    events.emit('runEnd', { summary });
    return true;
  }

  function stayForOvertime() {
    if (!state.winPending) return false;
    state.winPending = false;
    interactions.reset();
    rounds.startOvertime();
    clockIn.reset(); // the fresh break can be cut short like any other
    overtimeFrom = rounds.round;
    events.emit('overtimeStart', { round: rounds.round });
    return true;
  }

  // A summary as its receipt shows it. Classic has no checklist line on a receipt, and closingDone: null is the ONE
  // value that says so (ui/screens.js receiptLinesFor). The death receipt below and main.js's win receipt both use this.
  // (A win's summary is taken the moment the van leaves, before the Closing Time rewards are paid: its receipt lists what the shift has earned now.)
  const receiptFor = (summary) => {
    const earned = challenges.earned; // (the same summary object comes back when it is already current: a death's was taken after)
    const shown = summary.won && earned.length !== summary.skinsUnlocked?.length ? { ...summary, skinsUnlocked: earned } : summary;
    return state.showClosingGuidance ? shown : { ...shown, closingDone: null };
  };

  function showResults() {
    death.resultsShown = true;
    hud.showResults(receiptFor(death.summary));
  }

  const health = createPlayerHealth({ stats, onDeath: onPlayerDeath, onRegenStart: () => events.emit('regenStart') });

  // Kiosk Kevin's equipment (game/equipment.js): the two pockets and the throw. Thrown things fly on their own ballistics
  // instance that bounces off zombies without hurting them (they only hurt where they burst); main.js draws them.
  const throwables = createBalls({ colliders, shootables, zombies: 'bounce' });
  const equipment = createEquipment({
    input, player, gun, melee, health, state, shootables, colliders, effects, sound, events, throwables, getRound,
  });

  const zombies = createZombieManager({
    scene,
    colliders,
    player,
    shootables,
    effects,
    spawnPoints: map.spawnPoints,
    isZoneOpen: (zone) => map.zones[zone].open,
    getRound,
    getRounds: () => rounds,
    getHealthMultiplier: () => closing.healthMultiplier, // (overtime's extra health; `closing` is built below, read at spawn time)
    canAttack: () => !health.isDead,
    onPlayerHit: (damage, zombie, knockback = null, attackerPosition = null) => {
      // Second Chance's grace period: the swing lands on nothing, so nothing reacts to it (no damage arrow, rumble, outfit
      // tag or boss effect for a hit that did no damage).
      if (health.isReviveProtected) return;
      const pos = attackerPosition || (zombie?.position ? { x: zombie.position.x, z: zombie.position.z } : null);
      let hitDirection = null;
      if (pos && player?.position) {
        const dx = pos.x - player.position.x;
        const dz = pos.z - player.position.z;
        const len = Math.hypot(dx, dz);
        if (len > 1e-4) {
          hitDirection = { x: dx / len, z: dz / len };
        }
      }
      events.emit('playerHit', {
        damage,
        zombie,
        knockback,
        attackerPosition: pos,
        hitDirection,
      });
    },
    onKill: (zombie) => events.emit('kill', {
      zombie,
      headshot: zombie.killedByHeadshot,
      melee: zombie.killedByMelee,
      source: zombie.killedBy,
      weaponId: zombie.killedByWeaponId,
      distance: zombie.killedAtDistance,
      bounces: zombie.killedAfterBounces,
      projectile: zombie.killedByProjectile,
      firstWound: zombie.firstWound ? { ...zombie.firstWound } : null,
      woundedBy: [...zombie.woundedBy],
    }),
    // (`again`: the helmet came off a second time, after Captain Coupon put it back on)
    onHeadPop: (zombie, { headshot, source }) => events.emit('mascotHeadPop', { zombie, headshot, source, again: zombie.mascotReclaims > 0 }),
    onReclaim: (zombie) => events.emit('mascotReclaim', { zombie }),
    onGold: (zombie) => events.emit('mascotGold', { zombie }),
    onSound: (name, volume) => sound.play(name, { volume }), // Mall Walker squeaks, huffs and pants
    navigation: map.navigation, // floors + the ramps between them (undefined = one ground floor)
  });

  // SECOND CHANCE (game/secondChance.js): bought at Customer Service, spent by onPlayerDeath. The HUD tag shows while it is
  // held; the PA confirms the revive.
  secondChance = createSecondChance({ health, zombies, player, events });
  events.on('secondChance', ({ status }) => {
    hud.setSecondChance?.(status === 'held');
    if (status !== 'used') return;
    hud.showAnnouncement({ kicker: 'Customer Service', text: 'Second Chance redeemed. Please return to your shift.', priority: 4 });
    sound.play('paChime');
  });

  rounds = createRounds({
    zombies,
    onRoundStart: (round) => events.emit('roundStart', { round }),
    onTypeIntro: (typeId, zombie) => events.emit('typeIntro', { typeId, zombie }),
    onVariantIntro: (variant, zombie) => events.emit('mascotVariantIntro', { variant, zombie }),
    onRoundDiscard: (reason) => events.emit('roundDiscard', { reason }),
    onWaveEnding: (data) => events.emit('waveEnding', data),
  });
  // The shopping window: hold Clock in during the break to call the next round early (announces 'clockIn').
  const clockIn = createClockIn({ input, rounds, events });
  // End-of-round straggler helper (announces 'stragglers' / 'stragglersCleared' after delay with <= threshold left).
  const stragglers = createStragglers({ rounds, zombies, events, state });
  let powerUps = null;

  // --- Who reacts to what (the event bus; game/events.js lists the events) ---
  // Points, COD style: +10 for each non-lethal hit by the player; a kill pays the zombie's kill
  // value (+ headshot / box cutter bonus) from the 'kill' event, whatever made the kill.
  // Once you're dead nothing more is paid or counted (a burning zombie dying later doesn't change
  // the results screen).
  events.on('hit', (hit) => {
    if (!runFrozen() && !hit.killed) wallet.award(pointsForHit(hit));
  });
  events.on('kill', ({ zombie, headshot, melee, source }) => {
    if (source === 'clearance') return;
    if (!runFrozen()) wallet.award(pointsForHit({
      target: zombie, killed: true, headshot, melee,
      killPayMultiplier: stats.killPayMultiplier,
    }), wardrobe.wearing('accessory') === 'goldCard' ? 'goldCard' : undefined);
  });
  events.on('shot', (shot) => {
    if (!runFrozen()) runStats.recordShot(shot);
  });
  events.on('kill', ({ zombie }) => {
    if (!runFrozen()) runStats.recordKill(zombie);
  });
  // Knocking a Mascot's helmet off with a gun headshot or the box cutter pays a bonus: stuffings and hazards don't aim. (Melee
  // never reports a head hit, COD-style, so the knife counts however it lands: getting that close is the risk.) Every costume
  // has its own PA line. A helmet Captain Coupon put back on pays nothing the second time (no farming him).
  events.on('mascotHeadPop', ({ zombie, headshot, source, again }) => {
    const earned = source === 'melee' || (source === 'gun' && headshot);
    if (runFrozen() || again || zombie.noRewards || !earned) return;
    wallet.award(economy.payouts.helmetPopBonus);
    hud.showAnnouncement({ ...zombie.type.mascot.helmetPopLine, priority: 0 });
  });
  // A hard landing (feel.fall): the same hurt as a zombie's swing, without a zombie.
  player.onFall = ({ drop, damage }) => {
    if (health.isReviveProtected) return; // (Second Chance's grace period: this landing can't hurt, so it isn't announced)
    events.emit('playerFall', { drop, damage });
    health.takeDamage(damage, { type: 'fall', fall: true });
    if (!health.isReviveProtected) player.addViewKick(-feel.fall.viewJoltDegrees * DEG_TO_RAD); // (not when this fall just spent it)
  };
  // Your own rocket's burst (the Bottle Rocket Bazooka; weapons/blast.js worked out selfDamage: capped below a one-shot, 0 behind a wall or in the
  // Hi-Vis Vest). Like a fall it goes straight to health, past armour; the death receipt names it (config/deathReports.js ownBlast).
  events.on('gunBlast', ({ selfDamage, weaponId }) => {
    if (runFrozen() || !(selfDamage > 0) || health.isReviveProtected) return;
    health.takeDamage(selfDamage, { type: 'ownBlast', weaponId });
    const jolt = weapons[weaponId]?.blast?.self?.joltDegrees ?? 0;
    if (jolt && !health.isReviveProtected) player.addViewKick(-jolt * DEG_TO_RAD);
  });
  events.on('mascotReclaim', ({ zombie }) => {
    hud.showAnnouncement({ ...zombie.type.mascot.reclaim.line, priority: 1 });
    sound.play('paChime');
  });
  // An Employee of the Month on the floor (its guaranteed drop: game/powerUps.js).
  events.on('mascotGold', () => {
    hud.showAnnouncement({ ...mascotGold.spawnLine, priority: 1 });
    sound.play('paChime');
  });
  // The costume twists that reach past the zombie (Poppy Corn's blast...): game/mascotCostumes.js.
  const mascotCostumes = createMascotCostumes({ events, scene, zombies, player, colliders, effects, surfaces, state, sound });
  events.on('playerHit', ({ damage, zombie, knockback }) => {
    if (runFrozen()) return;
    const isBoss = Boolean(zombie?.type?.boss);
    const source = zombie ? {
      type: 'zombie',
      id: zombie.type?.id ?? 'shopper',
      ...(zombie.type?.variant ? { variant: zombie.type.variant } : {}),
      ...(isBoss ? { boss: zombie.type.id } : {}),
    } : { type: 'zombie', id: 'shopper' };
    // Clothes scale zombie hits only (a fall goes straight to health); Bubble Wrap (Kiosk Kevin) soaks what is left first.
    const scaled = damage * stats.damageTakenMultiplier;
    const { damage: remaining, popped } = health.absorb(scaled);
    if (remaining < scaled) events.emit('armourHit', { absorbed: scaled - remaining, layers: health.armour.length, popped });
    if (popped) sound.play('bubbleWrapPop');
    health.takeDamage(remaining, source);
    if (health.isReviveProtected) return; // this hit just spent Second Chance: revived where you stand, no shove or jolt
    if (knockback) { // a Cart Pusher's charge shoves you along it (m/s, horizontal)
      player.velocity.x += knockback.x * stats.knockbackMultiplier;
      player.velocity.z += knockback.z * stats.knockbackMultiplier;
    }
    player.addViewKick(-feel.health.hitJoltDegrees * DEG_TO_RAD); // jolt the view down
  });
  events.on('roundStart', ({ round }) => {
    hud.setRound(round);
    hud.showRoundBanner(round, closing.isClosingRound(round) ? closingTime.finale.banner : null);
  });
  // Closing Time's own sounds, in both run modes (Classic has no PA text): a key picked up, a checklist line ticked.
  // (Before the PA tables: the sound plays before the chime.)
  events.on('closingKey', () => sound.play('closingKey'));
  events.on('closingLine', () => sound.play('closingDuty'));
  // THE MALL PA (game/announcer.js): which event says what. Its four tables are registered at four points in this
  // function, each where its listeners always were, because the order listeners are added is the order lines queue.
  // (A pooled line is picked with the PA's own cosmetic random, announcer.js paRandom: never Math.random.)
  const announcer = createAnnouncer({ events, hud, sound, state });
  announcer.runAndFeatures();
  events.on('ritualCollect', ({ certificate }) => hud.showCertificate(certificate)); // (after its PA line)

  powerUps = createPowerUps({
    events, player, gun, zombies, colliders, state, stats, pricing, wallet, interactions,
    areaAt: (point) => map.areaAt?.(point) ?? null, // (Store-Wide Clearance clears the area it lies in)
    view: createPowerUpView(scene, colliders),
  });
  configureBossVouchers({ pricing, wallet, map, gun, state });
  const bosses = createBossDirector({ events, rounds, zombies, scene, colliders, player, surfaces, powerUps, state, map, interactions, effects, sound });
  let displayedBoss = null, displayedBossHealth, displayedFollowers;
  function updateBossBar(zombie) {
    const hp = zombie?.health;
    const followers = zombie?.followers === undefined ? undefined : Math.floor(zombie.followers);
    if (displayedBoss === zombie && displayedBossHealth === hp && displayedFollowers === followers) return;
    displayedBoss = zombie;
    displayedBossHealth = hp;
    displayedFollowers = followers;
    hud.setBoss(zombie);
  }
  events.on('bossSpawn', ({ zombie }) => updateBossBar(zombie));
  events.on('bossDefeated', ({ zombie }) => {
    runStats.bossesDefeated += 1;
    updateBossBar(null);
    if (zombie.type.defeatBanner) hud.showAnnouncement({ ...zombie.type.defeatBanner, priority: bossTiming.introPriority });
  });
  // Register after the defeat banner so the key-drop PA queues behind it.
  const closing = createClosingTime({
    events, player, colliders, state, view: createClosingKeyView(scene), rounds, bosses, stats,
    // Overtime rounds begun so far (the first overtime round is 1), from the saved `overtimeFrom`: a loaded run needs no counter.
    getOvertimeRound: () => (overtimeFrom === null ? 0 : Math.max(0, rounds.round - overtimeFrom + 1)),
  });
  events.on('runLoaded', () => hud.showRoundBanner(rounds.round, closing.isClosingRound(rounds.round) ? closingTime.finale.banner : null));
  events.on('roundDiscard', () => updateBossBar(null));
  events.on('playerDeath', () => updateBossBar(null));
  announcer.bossesAndIncentives(); // a boss's spawn and phase lines, power-ups, employee incentives
  events.on('incentiveBurst', ({ position }) => {
    const visual = incentiveConfig.types.inventoryLiquidation;
    effects.splat(position, new Vector3(0, 1, 0), visual.splatColors, visual.splatCount);
    sound.play('incentiveSecurity');
  });
  events.on('clearanceDetonated', ({ positions }) => {
    const visual = incentiveConfig.types.storeWideClearance;
    for (const pos of positions) {
      effects.splat(pos, new Vector3(0, 1, 0), visual.splatColors, visual.splatCount);
    }
  });

  // Everything else in the map you interact with (wall buys, the ammo cache, later the claw machine,
  // hazards...): map.features, built by kind (game/features/). Built AFTER the core wiring above, so
  // payouts and stats always run before any feature's own event listeners, and with every system a
  // feature might need (game/features/index.js lists the context).
  // EXTENDED WARRANTY rules (game/warranty.js): the desk's offers, a warranty left on file by a replaced gun, and a Platinum claim.
  const warranty = createWarranty({ gun, events, rounds });
  const meleeUpgrades = createMeleeUpgrades({ stats, events }); // box cutter tiers (the desk's second window; tiers live in stats)
  events.on('meleeUpgrade', ({ tier }) => viewmodel.setMeleeColors?.(upgrades.melee[tier - 1].colors)); // (the headless test viewmodel has no hands)
  const wardrobe = createWardrobe({ stats, player, events });
  // THE RETURN: the hidden quest that issues Return to Sender, and its return labels (game/returnQuest.js). After
  // closing, so a ticked duty's own PA line is queued before the label's.
  const returnQuest = createReturnQuest({
    events, state, player, zombies, gun, wallet, effects, sound,
    desk: featuresOf(map, 'returnsDesk')[0]?.position ?? null,
  });
  const features = buildFeatures(map, {
    scene, map, events, pricing, interactions, gun, player, stats, wallet, health, zombies, rounds, state, warranty, meleeUpgrades, wardrobe,
    colliders, effects, sound, input, tickets, shootables, aimAssist, secondChance, equipment, closing, skins, lostFound, returnQuest, surfaces,
  });

  // The outfit rail's brain: which worn item's tag pulses when (game/outfitRail.js; the HUD draws it).
  const outfitRail = createOutfitRail({ events, wardrobe, stats, player, gun, state });

  // FLASH SALES & DOORBUSTERS: the mall PA discounts one group (or one specific item on Doorbuster with a shopper rush).
  const flashSales = createFlashSales({
    events,
    pricing,
    eligible: saleEligibility({ map, gun, warranty, wardrobe, kiosk: features.instanceOf('kiosk') }),
    doorbusters: () => doorbusterCandidates({
      map, gun, wardrobe, kiosk: features.instanceOf('kiosk'), equipment, health,
    }),
    // Only an item you can get to in time: its route cost to you (the zombies' nav field, which leads to the player)
    // within reachShareOfWindow of the Doorbuster's window at your sprint speed.
    reachable: (target) => reachableInTime(target, (p) => zombies.nav.distanceToTarget(p.x, p.z, p.y),
      stats.sprintSpeed * economy.flashSales.doorbuster.durationSeconds * economy.flashSales.doorbuster.reachShareOfWindow),
    getRound: () => rounds.round,
    canSpawnRush: () => zombies.aliveCount < maxAliveForRound(Math.max(1, rounds.round)),
    nearSpawnPoints: (target) => nearOpenSpawnPoints(map, target.position, economy.flashSales.doorbuster.rush.nearestMarkers),
    onRushSpawn: (points) => zombies.spawn('shopper', null, { spawnPoints: points }),
  });
  events.on('roundDiscard', () => flashSales.clearRush());
  // Developer shortcuts (config/debug.js lists the keys; main.js turns key presses into debug.run(id)).
  const debugCommands = createDebugCommands({
    map, zombies, rounds, wallet, gun, health, player, arena, flashSales, bosses, wardrobe, features, equipment, challenges, closing,
    onUse: (id) => {
      // Merely showing the panel or choosing the next spawn type changes no run outcome.
      if (id !== 'panel' && id !== 'cycleZombie' && id !== 'cycleBoss' && id !== 'benchmark') state.assisted = true;
    },
  });

  events.on('runReset', debugCommands.clearSkinOverrides);

  announcer.sales(); // Clock in and Flash Sales

  // PLAY AGAIN: every system that holds per-run state, put back in this order. A new system with
  // run state = one line here. (tests/fullRun.test.js plays a messy run, resets, and checks the game
  // equals a freshly built one, so anything forgotten here shows up as a failing test.)
  const resetSteps = [
    ['bosses', () => bosses.reset()],
    ['powerUps', () => powerUps.reset()],
    ['closing', () => closing.reset()],
    ['returnQuest', () => returnQuest.reset()],
    ['zombies', () => zombies.clear()],
    ['mascotCostumes', () => mascotCostumes.reset()],
    ['wardrobe', () => wardrobe.reset()],
    ['stats', () => resetPlayerStats(stats)], // perks / wardrobe / skill-tree changes don't carry over
    ['surfaces', () => surfaces.reset()], // no slow floor left over
    ['health', () => health.reset()], // (after stats: back to the base max health)
    ['secondChance', () => secondChance.reset()], // not held, and buyable again (its 'secondChance' event hides the HUD tag)
    ['runStats', () => runStats.reset()],
    ['challenges', () => challenges.reset()],
    ['skins', () => skins.reset()],
    ['guide', () => guide.reset()], // (only what the round being replayed was counted: the record itself is permanent)
    ['balls', () => balls.clear()], // (before the gun: a ball in the air reports to it)
    ['equipment', () => equipment.reset()], // empty pockets, nothing thrown left in the air or on the floor
    ['rockets', () => rockets.clear()], // (before the gun, like the balls: a rocket in the air is gone, silently, no burst)
    ['gun', () => gun.reset()], // just the staple gun again, no upgrades
    ['interactions', () => interactions.reset()],
    ['viewmodel', () => viewmodel.reset()],
    ['effects', () => effects.clear()], // no leftover splatter or tracers from the last run
    ['contactShadows', () => contactShadows.clear()],
    ['ambience', () => ambience.reset()],
    ['melee', () => melee.reset()],
    ['aimAssist', () => aimAssist.reset()],
    ['wallet', () => wallet.reset()],
    ['tickets', () => tickets.reset()], // (prize tickets and tokens are lost with the run)
    ['flashSales', () => flashSales.reset()], // (before pricing: it puts back the discounts it set)
    ['pricing', () => pricing.reset()], // no discounts carried into a new run
    ['rounds', () => rounds.reset()],
    ['clockIn', () => clockIn.reset()],
    ['stragglers', () => stragglers.reset()],
    ['player', () => player.teleport(map.playerSpawn)],
    ['map', () => map.reset()], // doors closed, zones locked
    ['features', () => features.reset()],
    ['outfitRail', () => outfitRail.reset()],
    ['warranty', () => warranty.reset()], // no warranty on file in a new run
    ['runOutcome', () => {
      state.over = false;
      state.won = false;
      state.winPending = false;
      winSummary = null;
      overtimeFrom = null;
      state.assisted = false;
      death.timer = 0;
      death.resultsShown = false;
      death.summary = null;
    }],
    ['hud', () => {
      hud.setVoucher?.(null);
      updateBossBar(null);
      hud.setRound(0);
      hud.setRoundFlashing(false);
      hud.setOccupancy?.(0, true);
      hud.setDead(false);
      hud.hideResults();
    }],
    ['saveGame', () => saveGame.reset()], // (no round-start snapshot yet; the slot itself is untouched)
  ];

  // Fresh run: everything back to the start without reloading the page.
  function resetRun() {
    for (const [, reset] of resetSteps) reset();
    events.emit('runReset');
  }

  // SAVE & QUIT (game/saveGame.js): what a save keeps, as [name, serialize, restore], in RESTORE order (a load runs
  // resetRun first). Every reset step above is either here or in transientSteps; tests/saveGame.test.js fails otherwise,
  // so a new system with run state decides whether a save keeps it.
  const saveSteps = [
    // The stats as they are (clothes, box cutter tiers and health included), stripped of any active
    // temporary incentive modifiers so a round-start snapshot never leaks timed bonuses into a loaded run.
    ['stats', () => powerUps.stripEffectModifiers({ ...stats }), (data) => {
      Object.assign(stats, data);
      stats.instantKill = false;
      if (stats.meleeTier > 0) viewmodel.setMeleeColors?.(upgrades.melee[stats.meleeTier - 1].colors);
    }],
    ['wardrobe', () => wardrobe.serialize(), (data) => wardrobe.restore(data)],
    ['secondChance', () => secondChance.serialize(), (data) => secondChance.restore(data)],
    ['armour', () => health.armour, (layers) => health.restoreArmour(layers)], // Bubble Wrap (health itself is transient: stats.health is saved)
    ['runStats', () => runStats.serialize(), (data) => runStats.restore(data)],
    ['challenges', () => challenges.serialize(), (data) => challenges.restore(data)],
    ['skins', () => skins.serialize(), (data) => skins.restore(data)],
    ['equipment', () => equipment.serialize(), (data) => equipment.restore(data)],
    ['gun', () => ({ ...gun.serialize(), attachments: ownedAttachments(gun) }), (data) => {
      gun.restore(data, weapons);
      for (const id of data.attachments) unlockAttachment(gun, id);
    }],
    ['wallet', () => wallet.serialize(), (data) => wallet.restore(data)],
    ['tickets', () => tickets.serialize(), (data) => tickets.restore(data)],
    ['pricing', () => pricing.serialize(), (data) => pricing.restore(data)],
    ['flashSales', () => flashSales.serialize(), (data) => flashSales.restore(data)],
    ['rounds', () => rounds.serialize(), (data) => {
      rounds.restore(data);
      hud.setRound(data.round);
      // The banner is shown on runLoaded, after the closing step has restored its round.
    }],
    ['bosses', () => bosses.serialize(), (data) => bosses.restore(data)],
    ['powerUps', () => powerUps.serialize(), (data) => powerUps.restore(data)],
    ['player', () => ({ position: player.position.toArray(), yaw: player.yaw }), (data) => {
      player.teleport({ position: new Vector3().fromArray(data.position), yaw: data.yaw });
    }],
    // Owned areas (an area unlock reopens the free connections) and any door opened outside the area system.
    ['map', () => ({
      zones: Object.keys(map.zones).filter((id) => map.zones[id].open),
      doors: map.doors.filter((d) => d.isOpen).map((d) => d.id),
    }), (data) => {
      for (const id of data.zones) {
        if (!Object.hasOwn(map.zones, id) || map.zones[id].open) continue;
        if (map.areaUnlocks) map.areaUnlocks.unlock(id);
        else map.zones[id].open = true;
      }
      for (const door of map.doors) if (data.doors.includes(door.id) && !door.isOpen) door.open();
    }],
    ['features', () => features.serialize(), (data) => features.restore(data)], // (after the gun and map: an order needs its gun away)
    ['outfitRail', () => outfitRail.serialize(), (data) => outfitRail.restore(data)],
    ['warranty', () => warranty.serialize(), (data) => warranty.restore(data)], // (after the gun)
    ['closing', () => closing.serialize(), (data) => closing.restore(data)], // the checklist and any key still on the floor
    ['returnQuest', () => returnQuest.serialize(), (data) => returnQuest.restore(data)], // signs down, the ticket, labels held and fitted
    // The run's mode (Classic / Directed) and its outcome so far: a debug run stays one, and a run saved in overtime is still
    // a won run (its win and overtime start are kept, so the receipt after Continue is right).
    ['runOutcome', () => ({ assisted: state.assisted, closingMode: state.closingMode, won: state.won, winSummary, overtimeFrom }), (data) => {
      state.assisted = data.assisted;
      state.closingMode = data.closingMode ?? state.closingMode;
      state.won = data.won ?? false;
      winSummary = data.winSummary ?? null;
      overtimeFrom = data.overtimeFrom ?? null;
    }],
  ];
  // Reset steps a save does not keep: nothing in them outlasts a round's start that matters (zombies, effects, timers).
  const transientSteps = [
    'zombies', 'mascotCostumes', 'surfaces', 'health', 'balls', 'rockets', 'interactions', 'viewmodel', 'effects', 'contactShadows',
    'ambience', 'melee', 'aimAssist', 'clockIn', 'stragglers', 'hud', 'saveGame',
    'guide', // (its replay count travels in the guide's own record, not the run save)
  ];
  const saveGame = createSaveGame({ steps: saveSteps, events, stats, state, rounds, resetRun, storage: saveStorage });
  events.on('roundStart', () => saveGame.markRoundStart()); // (the snapshot waits for the end of the tick: see update)
  // Stay for overtime in a break restarts the break without a 'roundStart': snapshot again, so a save there keeps the win.
  events.on('overtimeStart', () => saveGame.markRoundStart());
  announcer.welcomeBack(); // the PA welcomes you back after a load

  let vaultPromptVisible = false;

  // One fixed tick. (main.js polls the controller and runs its menus just before this.)
  function update(dt) {
    ambience.update(dt, state.running && !state.over);
    // Dead: the world keeps going (zombies wander to the body), the player doesn't.
    // Checked before the pause check, because the mouse is released on death.
    if (death.summary) {
      death.timer += dt;
      balls.clear(); // (a ball in the air when you died is gone: nothing more is paid or counted)
      rockets.clear(); // (so is a rocket: it never bursts)
      equipment.clearThrown(); // (so is a Soda Bomb on its fuse)
      zombies.update(dt);
      health.update(dt);
      if (!death.resultsShown && death.timer >= feel.death.resultsDelay) showResults();
      input.endTick();
      return;
    }

    if (!state.running) {
      player.freeze();
      input.endTick();
      return;
    }

    runStats.timeAlive += dt;
    if (!rounds.started) rounds.start(); // round 1 begins the first time the game actually runs

    if (debugTick) debugTick();

    pricing.update();
    hud.setVoucher?.(pricing.voucher);
    // An in-game menu (state.menu, set by a feature): the player stands still and can't shoot or buy, but zombies, rounds and
    // everything else carry on. The feature reads the menu's input in features.update. (The gun is skipped, not just blocked,
    // so it doesn't eat the mouse wheel the menu scrolls with.)
    const inMenu = !!state.menu;
    if (inMenu) {
      player.velocity.x = player.velocity.z = 0;
      player.freeze();
    } else {
      player.update(dt);
    }
    powerUps.update(dt); // collect escape rewards before this tick's zombie attacks; paused/dead timers freeze
    closing.update(dt);
    returnQuest.update(dt);
    // "[Space] Vault" prompt: would a jump press now end in a vault? (checked per tick, shown in render)
    vaultPromptVisible = !inMenu && player.grounded && !player.vault.active && player.vault.preview();
    const alreadyWon = state.won;
    if (!inMenu) interactions.update(dt); // before the gun: on controller X, a hold near a buyable buys instead of reloading
    // Stop this tick at the van, even if a runWon listener makes its choice synchronously.
    if (!alreadyWon && state.won) {
      player.freeze();
      input.endTick();
      return;
    }
    if (!inMenu) melee.update(dt, !gun.isSwitching && !equipment.isBusy);
    // Equipment (G / middle mouse): after melee, so a swing that started this tick refuses the throw. In a menu only its timer runs.
    equipment.update(dt, { inMenu });
    // Hands busy with a slash, a throw or a vault: no shooting. A vault only pauses a reload (it carries on after).
    if (!inMenu) gun.update(dt, melee.isBusy || equipment.isBusy || player.vault.active, player.vault.active);
    warranty.update(dt); // (a replaced gun's warranty goes on file; a dry Platinum gun makes its claim)
    zombies.update(dt);
    balls.update(dt); // after the zombies moved: a ball hits them where they are now
    rockets.update(dt); // (and a rocket bursts against them where they are now)
    throwables.update(dt); // (same for a thrown Soda Bomb)
    equipment.updateThrown(dt); // fuses run out and burst where the bottle is now
    mascotCostumes.update(dt);
    // Rounds pause while you're off in the debug test range (zombies can't reach you there).
    const inMall = !arena?.contains(player.position);
    if (!state.over) {
      bosses.update(dt, inMall);
      if (inMall) clockIn.update(dt, !inMenu); // before the rounds: a finished hold shortens this tick's break
      if (inMall) rounds.update(dt, !bosses.pending);
      if (inMall) stragglers.update(dt);
      updateBossBar(bosses.active);
    }
    health.update(dt);
    map.update(dt);
    shutterSounds.update(dt);
    features.update(dt);
    outfitRail.update(dt);
    challenges.update(dt);
    flashSales.update(dt);
    if (arena) arena.update(dt);
    player.updateView(dt); // recoil/jolt springs last, so this tick's kicks show on the next frame
    saveGame.update(); // a round began this tick: snapshot it now, after every 'roundStart' listener rolled its draws
    input.endTick();
  }

  return {
    state,
    events,
    pricing,
    death,
    get winSummary() { return winSummary; },
    receiptFor,
    get overtimeFrom() { return overtimeFrom; }, // the first overtime round, or null (tests compare it after Play again)
    clockOut,
    stayForOvertime,
    leaveRun,
    map,
    features,
    wardrobe,
    meleeUpgrades,
    secondChance,
    outfitRail,
    flashSales,
    warranty, // (read by the Flash Sale markers: game/flashSales.js collectSaleSpots needs it for Extended Warranty sales)
    powerUps,
    closing,
    bosses,
    debug: debugCommands,
    challenges,
    skins,
    guide,
    lostFound,
    returnQuest,
    colliders,
    arena,
    shootables,
    stats,
    player,
    wallet,
    tickets,
    runStats,
    effects,
    ambience,
    contactShadows,
    aimAssist,
    gun,
    balls,
    rockets,
    throwables,
    equipment,
    interactions,
    melee,
    health,
    zombies,
    mascotCostumes,
    surfaces,
    rounds,
    clockIn,
    stragglers,
    get vaultPromptVisible() {
      return vaultPromptVisible;
    },
    update,
    resetRun,
    resetSteps: resetSteps.map(([name]) => name), // (read-only list, for tests / debugging)
    saveGame, // Save & Quit's one slot (game/saveGame.js)
    saveSteps: saveSteps.map(([name]) => name), // (read-only lists, for tests: every reset step is saved or transient)
    transientSteps: [...transientSteps],
  };
}
