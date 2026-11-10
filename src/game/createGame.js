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
//   g.<system>     map, colliders, arena, shootables, stats, player, wallet, runStats, effects, aimAssist,
//                  gun, interactions, melee, health, zombies, mascotCostumes, rounds, death
// =============================================================================

import { feel } from '../config/feel.js';
import { Vector3 } from 'three';
import { powerUps as incentiveConfig } from '../config/powerUps.js';
import { economy } from '../config/economy.js';
import { upgrades } from '../config/upgrades.js';
import { bossTiming } from '../config/bosses.js';
import { createBossDirector } from './bossDirector.js';
import { configureBossVouchers } from './bossVouchers.js';
import { createShutterSounds } from './shutterSounds.js';
import { mascotGold, mascotTypes, zombieTypes } from '../config/zombies.js';
import { weapons, melee as meleeWeapons } from '../config/weapons.js';
import { loadMap } from '../maps/index.js';
import { createPlayerStats, resetPlayerStats } from '../player/stats.js';
import { PlayerController } from '../player/controller.js';
import { createPlayerHealth } from '../player/health.js';
import { createEffects } from '../fx/effects.js';
import { createContactShadows } from '../fx/contactShadows.js';
import { createAmbience } from './ambience.js';
import { createPowerUps } from './powerUps.js';
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
import { createFlashSales } from './flashSales.js';
import { createDebugCommands } from './debugCommands.js';
import { createWarranty } from './warranty.js';
import { createMeleeUpgrades } from './meleeUpgrades.js';
import { createWardrobe } from './wardrobe.js';
import { createOutfitRail } from './outfitRail.js';
import { createRunStats } from './runStats.js';
import { createWallet, pointsForHit } from './wallet.js';
import { createRounds } from './rounds.js';
import { createClockIn } from './clockIn.js';
import { createInteractions } from './interactions.js';
import { createTickets } from './tickets.js';
import { buildFeatures, featuresOf } from './features/index.js';
import { ownsAttachment } from './features/attachmentCounter.js';
import { comboName } from '../config/workshop.js';

const DEG_TO_RAD = Math.PI / 180;

/**
 * @param scene, camera   three.js scene (the map, zombies and effects go in it) and the world camera
 * @param input           core/input.js Input (or a test double with the same calls)
 * @param hud, sound, viewmodel  browser parts (see the header)
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
  mapId = 'mall',
  buildTestRange = null,
  debugTick = null,
  onPlayerDeath: afterDeath = null,
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
  const wallet = createWallet({ onChange: (amount, points, style) => style ? hud.pointsPopup(amount, style) : hud.pointsPopup(amount) });
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
      // What you were wearing (slot -> item id or null): the receipt's DIED WEARING line.
      wearing: Object.freeze(Object.fromEntries(outfitRail.snapshot().map(({ slot, id }) => [slot, id]))),
      // The guns you named at Build-A-Blaster (the receipt reads them out).
      survivedBy: gun.namedBuilds.map((build) => ({ name: build.name, combo: comboName(build), confirmed: build.confirmed ?? 0 })),
      ticketsWon: tickets.won, // (GRAB-A-GUN's prize tickets: not points, not income)
      closingDone: closing.done,
      won: state.won,
      winTime: state.won ? winSummary?.timeAlive ?? runStats.timeAlive : null,
      winRound: state.won ? winSummary?.round ?? rounds.round : null,
      // Whole overtime rounds survived, or null before overtime. (Not round - winRound: after a win in the break,
      // overtime starts with the round the win happened in.)
      overtimeRounds: overtimeFrom === null ? null : Math.max(0, rounds.round - overtimeFrom),
      keychains: tickets.tokens.keychain, // Sunny plush keychains redeemed (a joke for the receipt until the Wardrobe exists)
    });
  }

  // THE single place the player dies. A downed/revive system would hook in here later
  // (e.g. go "downed" instead, and only call the rest of this if nobody revives you).
  function onPlayerDeath() {
    if (state.over) return;
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
    if (state.over || state.won || !closing.readyToLeave) return; // (all four keys and lines 1 to 3; no round gate)
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

  function showResults() {
    death.resultsShown = true;
    hud.showResults(death.summary);
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
    canAttack: () => !health.isDead,
    onPlayerHit: (damage, zombie, knockback = null, attackerPosition = null) => {
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
    }),
    // (`again`: the helmet came off a second time, after Captain Coupon put it back on)
    onHeadPop: (zombie, { headshot, source }) => events.emit('mascotHeadPop', { zombie, headshot, source, again: zombie.mascotReclaims > 0 }),
    onReclaim: (zombie) => events.emit('mascotReclaim', { zombie }),
    onGold: (zombie) => events.emit('mascotGold', { zombie }),
    onSound: (name, volume) => sound.play(name, { volume }), // Mall Walker squeaks, huffs and pants
    navigation: map.navigation, // floors + the ramps between them (undefined = one ground floor)
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
  let powerUps = null;

  // --- Who reacts to what (the event bus; game/events.js lists the events) ---
  // Points, COD style: +10 for each non-lethal hit by the player; a kill pays the zombie's kill
  // value (+ headshot / box cutter bonus) from the 'kill' event, whatever made the kill.
  // Once you're dead nothing more is paid or counted (a burning zombie dying later doesn't change
  // the results screen).
  events.on('hit', (hit) => {
    if (!runFrozen() && !hit.killed) wallet.earn(pointsForHit(hit));
  });
  events.on('kill', ({ zombie, headshot, melee }) => {
    if (!runFrozen()) wallet.earn(pointsForHit({
      target: zombie, killed: true, headshot, melee,
      killMultiplier: powerUps?.killMultiplier(zombie.position) ?? 1,
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
    wallet.earn(economy.payouts.helmetPopBonus);
    hud.showAnnouncement({ ...zombie.type.mascot.helmetPopLine, priority: 0 });
  });
  // A hard landing (feel.fall): the same hurt as a zombie's swing, without a zombie.
  player.onFall = ({ drop, damage }) => {
    events.emit('playerFall', { drop, damage });
    health.takeDamage(damage, { type: 'fall', fall: true });
    player.addViewKick(-feel.fall.viewJoltDegrees * DEG_TO_RAD);
  };
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
  const mascotCostumes = createMascotCostumes({ events, scene, zombies, player, colliders, effects, surfaces, state });
  events.on('playerHit', ({ damage, zombie, knockback }) => {
    if (runFrozen()) return;
    const isBoss = Boolean(zombie?.type?.boss);
    const source = zombie ? {
      type: 'zombie',
      id: zombie.type?.id ?? 'shopper',
      ...(zombie.type?.variant ? { variant: zombie.type.variant } : {}),
      ...(isBoss ? { boss: zombie.type.id } : {}),
    } : { type: 'zombie', id: 'shopper' };
    health.takeDamage(damage * stats.damageTakenMultiplier, source); // (clothes scale zombie hits only: a fall goes straight to health)
    if (knockback) { // a Cart Pusher's charge shoves you along it (m/s, horizontal)
      player.velocity.x += knockback.x * stats.knockbackMultiplier;
      player.velocity.z += knockback.z * stats.knockbackMultiplier;
    }
    player.addViewKick(-feel.health.hitJoltDegrees * DEG_TO_RAD); // jolt the view down
  });
  events.on('roundStart', ({ round }) => {
    hud.setRound(round);
    hud.showRoundBanner(round);
  });
  events.on('waveEnding', () => {
    hud.showAnnouncement({
      kicker: 'Attention shoppers',
      text: 'Final clearance — registers closing shortly!',
      priority: 1,
    });
    sound.play('paChime');
  });
  // A zombie type's first appearance this run (Mall Walkers, round 4): PA chime + banner. (A Mascot announces the
  // costume it came in: Sir Waffles in round 10.) Each later costume's first appearance gets its own.
  events.on('typeIntro', ({ typeId, zombie }) => {
    const intro = (zombie?.type ?? zombieTypes[typeId])?.introBanner;
    if (!intro) return;
    hud.showAnnouncement({ ...intro, priority: 2 });
    sound.play('paChime');
  });
  events.on('mascotVariantIntro', ({ variant }) => {
    hud.showAnnouncement({ ...mascotTypes[variant].introBanner, priority: 2 });
    sound.play('paChime');
  });

  // PA notices from workshop orders, shop events and closing duties.
  for (const name of ['ritualStart', 'ritualQuality', 'ritualReady', 'ritualWaiting', 'ritualCollect', 'limitedEditionDrop', 'limitedEditionFitted', 'wardrobeBuy', 'clawClosed', 'clawMoved', 'closingBriefing', 'closingKeyDrop', 'closingKey', 'closingLine']) {
    events.on(name, ({ pa }) => {
      if (!pa) return;
      hud.showAnnouncement({ ...pa, priority: 1 });
      sound.play('paChime');
    });
  }

  events.on('ritualCollect', ({ certificate }) => hud.showCertificate(certificate));
  // A Platinum warranty claim (game/warranty.js).
  events.on('warrantyClaim', ({ pa }) => {
    hud.showAnnouncement({ ...pa, priority: 1 });
    sound.play('paChime');
  });
  events.on('ritualStage', ({ pa }) => hud.showAnnouncement({ ...pa, priority: 0, archiveOnly: true })); // (narration: quality and ready lines beat it)

  powerUps = createPowerUps({
    events, player, gun, zombies, colliders, state, stats, pricing, wallet,
    view: createPowerUpView(scene, colliders),
  });
  configureBossVouchers({ pricing, wallet, map, gun, state });
  const bosses = createBossDirector({ events, rounds, zombies, scene, colliders, player, surfaces, powerUps, state, map });
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
  events.on('bossSpawn', ({ zombie }) => {
    updateBossBar(zombie);
    hud.showAnnouncement({ ...zombie.type.introBanner, priority: bossTiming.introPriority });
    sound.play(zombie.type.introSound);
  });
  events.on('bossDefeated', ({ zombie }) => {
    runStats.bossesDefeated += 1;
    updateBossBar(null);
    if (zombie.type.defeatBanner) hud.showAnnouncement({ ...zombie.type.defeatBanner, priority: bossTiming.introPriority });
  });
  // Register after the defeat banner so the key-drop PA queues behind it.
  const closing = createClosingTime({ events, player, colliders, state, view: createClosingKeyView(scene) });
  events.on('bossPhase', ({ zombie, phase }) => {
    const pa = zombie.type.phases?.[phase];
    if (pa) { hud.showAnnouncement({ ...pa, priority: bossTiming.introPriority }); sound.play('paChime'); }
  });
  events.on('roundDiscard', () => updateBossBar(null));
  events.on('playerDeath', () => updateBossBar(null));
  events.on('powerUpCollect', ({ pa, sound: name }) => {
    hud.showAnnouncement({ ...pa, priority: 1 });
    sound.play(name);
  });
  events.on('incentiveComplete', ({ text }) => {
    hud.showAnnouncement({ kicker: 'Employee incentive complete', text, priority: 1 });
    sound.play('incentiveRestock');
  });
  events.on('incentiveBurst', ({ position }) => {
    const visual = incentiveConfig.types.inventoryLiquidation;
    effects.splat(position, new Vector3(0, 1, 0), visual.splatColors, visual.splatCount);
    sound.play('incentiveSecurity');
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
  const features = buildFeatures(map, {
    scene, map, events, pricing, interactions, gun, player, stats, wallet, health, zombies, rounds, state, warranty, meleeUpgrades, wardrobe,
    colliders, effects, sound, input, tickets, shootables, aimAssist, closing,
  });

  // The outfit rail's brain: which worn item's tag pulses when (game/outfitRail.js; the HUD draws it).
  const outfitRail = createOutfitRail({ events, wardrobe, stats, player, gun, state });

  // FLASH SALES: the mall PA discounts one group of prices for a while (game/flashSales.js). A group is only picked
  // when it would be of use right now.
  const flashSales = createFlashSales({
    events,
    pricing,
    eligible: (group) => {
      if (group.id === 'doors') return map.areaUnlocks
        ? Object.keys(economy.doors).some(id => !map.zones[id].open)
        : map.doors.some((d) => !d.isOpen);
      if (group.id === 'weapons') return featuresOf(map, 'wallBuy').some((w) => !gun.owns(w.weapon));
      if (group.id === 'tiers') return gun.slots.some((id) => warranty.offer(id));
      if (group.id === 'attachments') return featuresOf(map, 'attachmentCounter').some(s => !ownsAttachment(gun, s.attachment));
      if (group.id === 'apparel') return featuresOf(map, 'wardrobeRack').some(r => map.zones[r.zone].open && !wardrobe.owns(r.item));
      return true;
    },
  });
  // Developer shortcuts (config/debug.js lists the keys; main.js turns key presses into debug.run(id)).
  const debugCommands = createDebugCommands({
    map, zombies, rounds, wallet, gun, health, player, arena, flashSales, bosses, wardrobe, features, equipment, closing,
    onUse: (id) => {
      // Merely showing the panel or choosing the next spawn type changes no run outcome.
      if (id !== 'panel' && id !== 'cycleZombie' && id !== 'cycleBoss' && id !== 'benchmark') state.assisted = true;
    },
  });

  events.on('clockIn', () => {
    hud.showAnnouncement(economy.rounds.clockIn.pa);
    sound.play('paChime');
  });
  events.on('flashSaleStart', ({ pa }) => {
    hud.showAnnouncement(pa);
    sound.play('paChime');
  });
  events.on('flashSaleEnd', ({ reason, pa }) => {
    if (reason !== 'expired') return; // a new run ends it silently
    hud.showAnnouncement(pa);
    sound.play('paChime');
  });

  // PLAY AGAIN: every system that holds per-run state, put back in this order. A new system with
  // run state = one line here. (tests/fullRun.test.js plays a messy run, resets, and checks the game
  // equals a freshly built one, so anything forgotten here shows up as a failing test.)
  const resetSteps = [
    ['bosses', () => bosses.reset()],
    ['powerUps', () => powerUps.reset()],
    ['closing', () => closing.reset()],
    ['zombies', () => zombies.clear()],
    ['mascotCostumes', () => mascotCostumes.reset()],
    ['wardrobe', () => wardrobe.reset()],
    ['stats', () => resetPlayerStats(stats)], // perks / wardrobe / skill-tree changes don't carry over
    ['surfaces', () => surfaces.reset()], // no slow floor left over
    ['health', () => health.reset()], // (after stats: back to the base max health)
    ['runStats', () => runStats.reset()],
    ['balls', () => balls.clear()], // (before the gun: a ball in the air reports to it)
    ['equipment', () => equipment.reset()], // empty pockets, nothing thrown left in the air or on the floor
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
  ];

  // Fresh run: everything back to the start without reloading the page.
  function resetRun() {
    for (const [, reset] of resetSteps) reset();
    events.emit('runReset');
  }

  let vaultPromptVisible = false;

  // One fixed tick. (main.js polls the controller and runs its menus just before this.)
  function update(dt) {
    ambience.update(dt, state.running && !state.over);
    // Dead: the world keeps going (zombies wander to the body), the player doesn't.
    // Checked before the pause check, because the mouse is released on death.
    if (death.summary) {
      death.timer += dt;
      balls.clear(); // (a ball in the air when you died is gone: nothing more is paid or counted)
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
    throwables.update(dt); // (same for a thrown Soda Bomb)
    equipment.updateThrown(dt); // fuses run out and burst where the bottle is now
    mascotCostumes.update(dt);
    // Rounds pause while you're off in the debug test range (zombies can't reach you there).
    const inMall = !arena?.contains(player.position);
    if (!state.over) {
      bosses.update(dt, inMall);
      if (inMall) clockIn.update(dt, !inMenu); // before the rounds: a finished hold shortens this tick's break
      if (inMall) rounds.update(dt, !bosses.pending);
      updateBossBar(bosses.active);
    }
    health.update(dt);
    map.update(dt);
    shutterSounds.update(dt);
    features.update(dt);
    outfitRail.update(dt);
    flashSales.update(dt);
    if (arena) arena.update(dt);
    player.updateView(dt); // recoil/jolt springs last, so this tick's kicks show on the next frame
    input.endTick();
  }

  return {
    state,
    events,
    pricing,
    death,
    get winSummary() { return winSummary; },
    clockOut,
    stayForOvertime,
    leaveRun,
    map,
    features,
    wardrobe,
    meleeUpgrades,
    outfitRail,
    flashSales,
    powerUps,
    closing,
    bosses,
    debug: debugCommands,
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
    get vaultPromptVisible() {
      return vaultPromptVisible;
    },
    update,
    resetRun,
    resetSteps: resetSteps.map(([name]) => name), // (read-only list, for tests / debugging)
  };
}
