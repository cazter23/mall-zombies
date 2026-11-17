// =============================================================================
// THE SHOOTING GALLERY (debug mode: part of the test range, maps/testRange/testRange.js; numbers: config/debug.js gallery)
// A hall through the range's north wall: targets at 5 to 40 m from a firing line, and a counter where F sets the round the targets
// stand in for (their health, and the round a gun with round scaling reads). It keeps the numbers the readout shows
// (ui/rangeReadout.js draws `view`):
//   - every hit: its damage, head or body, how far, and how much of the gun's damage the distance left (weapons/gunStats.js damageFalloff)
//   - each target's last kill: how many hit shots and how long from the first hit
//   - your hit rate at each distance: a shot counts toward the target you aimed nearest (within aimCone degrees), and a target hit
//     in a tick is one hit shot (a pellet gun's pellets, or a ball arriving later, count once)
// DOM-free: the tests run it on the real game.
//
//   const gallery = createGallery({ targets, cfg, healthFor })   targets: [{ dummy, distance }] (built by the range)
//   gallery.onHit(info, dummy)          the dummies call this (dummy.js onHit)
//   gallery.connect({ events, player, gun, interactions, counter })   once the game exists (createGame: arena.connect)
//   gallery.update(dt) / gallery.view / gallery.round / gallery.stepRound(+1 | -1) / gallery.clear()
// =============================================================================

import * as THREE from 'three';
import { damageFalloff } from '../../weapons/gunStats.js';

export function createGallery({ targets, cfg, healthFor }) {
  let roundIndex = 0;
  let tick = 0;
  let time = 0;
  let gun = null;
  let hits = []; // latest first: { distance, target, damage, part, falloff, killed }
  const lanes = new Map(); // dummy -> { distance, shots, hitShots, lastHitTick, firstHitAt, hitsThisLife, lastKill }

  function blankLane(distance) {
    return { distance, shots: 0, hitShots: 0, lastHitTick: -1, firstHitAt: null, hitsThisLife: 0, lastKill: null };
  }
  function clear() {
    hits = [];
    for (const { dummy, distance } of targets) lanes.set(dummy, blankLane(distance));
  }
  function setRound(index) {
    roundIndex = Math.max(0, Math.min(cfg.rounds.length - 1, index));
    const round = cfg.rounds[roundIndex];
    for (const { dummy } of targets) dummy.setRound(round, healthFor(round));
    clear();
  }
  setRound(0);

  // The share of the gun's damage the distance left: 1 = none lost. Only for the gun in hand (its resolved numbers: tiers, attachments).
  function falloffFor(weaponId, distance) {
    const def = gun?.def;
    if (!def || def.id !== weaponId || distance == null || !def.falloff) return null;
    return damageFalloff(distance, def.falloff);
  }

  function onHit({ damage, part, distance, weaponId, killed }, dummy) {
    const lane = lanes.get(dummy);
    if (!lane) return; // (not a gallery target: the range's old dummies)
    if (lane.lastHitTick !== tick) {
      lane.lastHitTick = tick;
      lane.hitShots++;
      lane.hitsThisLife++;
    }
    if (lane.firstHitAt === null) lane.firstHitAt = time;
    hits.unshift({ target: lane.distance, distance, damage, part, falloff: falloffFor(weaponId, distance), killed });
    hits.length = Math.min(hits.length, cfg.readoutHits);
    if (killed) {
      lane.lastKill = { hits: lane.hitsThisLife, seconds: time - lane.firstHitAt };
      lane.hitsThisLife = 0;
      lane.firstHitAt = null;
    }
  }

  // The target nearest the crosshair, within the cone (null: the shot was not aimed at the gallery).
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  function aimedTarget(player) {
    player.getAim(origin, direction);
    let best = null;
    let bestAngle = THREE.MathUtils.degToRad(cfg.aimCone);
    for (const { dummy } of targets) {
      if (!dummy.isAlive && lanes.get(dummy).lastHitTick !== tick) continue; // (down, unless this very shot just felled it)
      const centre = dummy.hitboxes.find((h) => h.part === 'body')?.box.getCenter(toTarget);
      if (!centre) continue;
      const angle = direction.angleTo(centre.sub(origin));
      if (angle < bestAngle) { bestAngle = angle; best = dummy; }
    }
    return best;
  }

  return {
    onHit,
    clear,
    get round() { return cfg.rounds[roundIndex]; },
    stepRound(step) { setRound(roundIndex + step); },

    /** Wire the gallery to the game: shots for the hit rate, the gun in hand for the falloff, the round counter's two prompts. */
    connect({ events, player, gun: playerGun, interactions, counter }) {
      gun = playerGun;
      events.on('shot', () => {
        const aimed = aimedTarget(player);
        if (aimed) lanes.get(aimed).shots++;
      });
      if (!interactions || !counter) return;
      const roundPrompt = (step, label, at) => interactions.add({
        kind: 'galleryRound', id: step > 0 ? 'harder' : 'easier', label, title: label, verb: 'set',
        get detail() { return `The targets are on round ${cfg.rounds[roundIndex]}: their health, and round scaling. Clears the readout.`; },
        get priceLabel() { return `Round ${cfg.rounds[Math.max(0, Math.min(cfg.rounds.length - 1, roundIndex + step))]}`; },
        cost: 0, quiet: true, instant: true,
        position: at, normal: counter.normal,
        available: () => (step > 0 ? roundIndex < cfg.rounds.length - 1 : roundIndex > 0),
        use: () => setRound(roundIndex + step),
      });
      roundPrompt(-1, 'Easier targets', counter.easier);
      roundPrompt(+1, 'Harder targets', counter.harder);
    },

    update(dt) {
      tick++;
      time += dt;
    },

    /** What ui/rangeReadout.js draws. */
    get view() {
      return {
        round: cfg.rounds[roundIndex],
        health: targets[0] ? targets[0].dummy.maxHealth : 0,
        gun: gun?.def?.name ?? null,
        hits: hits.map((h) => ({ ...h })),
        lanes: targets.map(({ dummy, distance }) => {
          const lane = lanes.get(dummy);
          return { distance, shots: lane.shots, hitShots: lane.hitShots, rate: lane.shots ? Math.min(1, lane.hitShots / lane.shots) : null, lastKill: lane.lastKill };
        }),
      };
    },
  };
}
