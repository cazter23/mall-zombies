// =============================================================================
// BALANCE ANALYSIS (pure maths over config/weapons.js; no rendering, no game loop)
// Used by `npm run balance` (tools/gunReport.mjs prints it) and tests/balance.test.js
// (role checks that must survive retunes and future upgrades / Build-A-Blaster mods).
//
// Every gun is measured the same way: a player standing still, aiming at a Shopper's chest
// at a given distance, resting spread (no bloom: the first shots of a burst of fire). Each
// ray gets the gun's own spread cone, plus the pellet cone for pellet guns, exactly as the
// game samples it (aim.applyConeSpread), against the Shopper's real hitboxes. Damage uses the
// game's own per-hit formula (weapons/gunStats.js hitDamage). Random sampling is seeded, so
// results are repeatable.
//
//   cycleSeconds(def)              one trigger cycle (a burst counts as one cycle)
//   magazineSeconds(def)           emptying a full magazine: first shot to last shot (the last shot's recovery
//                                  overlaps the reload, as in weapon.js)
//   reloadSeconds(def)             a full reload from empty (shell-by-shell aware)
//   expectedShotDamage(def, m, o)  average damage of one trigger pull (all pellets) at m meters
//   sustainedDps(def, m, o)        damage per second over magazine + reload, at m meters
//   burstDps(def, m, o)            damage per second while the magazine lasts (no reload)
//   shotsToKill(def, hp, m, o)     trigger pulls for an average kill of `hp` at m meters
// Options `o`: { ads: false, samples: 2000, seed: 7 }.
// "A shot" = one dart / nail / sticker / staple, or one whole blast for pellet guns (all its pellets).
// Absolute numbers assume RESTING spread (no bloom from sustained fire) and a target that doesn't move:
// use them to compare guns and to see the effect of a change, not as exact in-game time-to-kill.
// =============================================================================

import * as THREE from 'three';
import { applyConeSpread, pelletSpreadDegrees } from '../src/weapons/aim.js';
import { hitDamage } from '../src/weapons/gunStats.js';
import { zombieTypes } from '../src/config/zombies.js';
import { feel } from '../src/config/feel.js';
import { seededRandom } from '../src/world/textures.js';

const hb = zombieTypes.shopper.hitbox;
const EYE = feel.player.eyeHeight;
const CHEST = hb.bodyTop * 0.7; // aim point: the middle of the chest
const NO_STATS = { damageMultiplier: 1 };

export function cycleSeconds(def) {
  if (def.fireMode === 'burst') return def.burst.interval * (def.burst.count - 1) + def.fireInterval;
  return def.fireInterval;
}

export function magazineSeconds(def) {
  if (def.fireMode === 'burst') {
    const bursts = def.magazineSize / def.burst.count;
    return (bursts - 1) * cycleSeconds(def) + (def.burst.count - 1) * def.burst.interval;
  }
  return (def.magazineSize - 1) * def.fireInterval;
}

export function reloadSeconds(def) {
  const sr = def.shellReload;
  return sr ? sr.startSeconds + def.magazineSize * sr.shellSeconds + sr.endSeconds : def.reloadTime;
}

// Run `fn` with Math.random replaced by a seeded generator (the game's spread uses Math.random).
function seeded(seed, fn) {
  const real = Math.random;
  Math.random = seededRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}

/** Average damage of ONE shot (one dart of a burst; all pellets of a blast) at `distance` m. */
export function expectedShotDamage(def, distance, { ads = false, samples = 2000, seed = 7 } = {}) {
  const origin = new THREE.Vector3(0, EYE, 0);
  const body = new THREE.Box3(
    new THREE.Vector3(-hb.bodyHalfWidth, 0, -distance - hb.bodyHalfWidth),
    new THREE.Vector3(hb.bodyHalfWidth, hb.bodyTop, -distance + hb.bodyHalfWidth),
  );
  const head = new THREE.Box3(
    new THREE.Vector3(-hb.headHalfSize, hb.headBottom, -distance - hb.headHalfSize),
    new THREE.Vector3(hb.headHalfSize, hb.headTop, -distance + hb.headHalfSize),
  );
  const aimCone = def.spread.base * (ads ? def.spread.adsMultiplier : 1);
  const pelletCone = pelletSpreadDegrees(def, ads ? 1 : 0);
  const rays = def.pellets?.count ?? 1;
  const point = new THREE.Vector3();
  return seeded(seed, () => {
    let total = 0;
    for (let n = 0; n < samples; n++) {
      for (let i = 0; i < rays; i++) {
        const dir = new THREE.Vector3(0, CHEST - EYE, -distance).normalize();
        applyConeSpread(dir, aimCone);
        applyConeSpread(dir, pelletCone);
        const ray = new THREE.Ray(origin, dir);
        let part = null;
        let dist = Infinity;
        if (ray.intersectBox(head, point)) { part = 'head'; dist = point.distanceTo(origin); }
        if (ray.intersectBox(body, point) && point.distanceTo(origin) < dist) { part = 'body'; dist = point.distanceTo(origin); }
        if (part) total += hitDamage(def, { part, distance: dist }, 0, NO_STATS);
      }
    }
    return total / samples;
  });
}

export function burstDps(def, distance, options) {
  const perCycle = def.fireMode === 'burst' ? def.burst.count : 1;
  return (expectedShotDamage(def, distance, options) * perCycle) / cycleSeconds(def);
}

export function sustainedDps(def, distance, options) {
  const magDamage = def.magazineSize * expectedShotDamage(def, distance, options);
  return magDamage / (magazineSeconds(def) + reloadSeconds(def));
}

/** Shots (darts / nails / blasts) for an average kill of `hp`. Burst guns: divide by burst.count for trigger pulls. */
export function shotsToKill(def, hp, distance, options) {
  const perShot = expectedShotDamage(def, distance, options);
  return perShot > 0 ? Math.ceil(hp / perShot) : Infinity;
}
