// =============================================================================
// STUFFINGS AND HEARTS: what a finished Build-A-Blaster gun does (built by game/features/workshop.js).
// A build pairs a Stuffing (WHAT happens) with a Heart (WHEN it happens), and the two never know about each other, so any
// pair works: a new one of either = one entry in config/workshop.js + one function in STUFFINGS or HEARTS below.
//   Hearts read 'shot' events. A Heart returns { origin, target } when it fires, or null.
//   Stuffings get that spot plus `power` (the build's quality x the Heart's strength) and `gunSecond` (workshop damage scale:
//   one second of this gun's fire, weapons/gunStats.js gunPower).
// A stuffing's damage goes through zombie.takeHit with source 'build', so a kill pays once on the 'kill' event like any other.
// Nothing here emits 'shot', which is why a stuffing's kills can't set a Heart off again.
// =============================================================================

import * as THREE from 'three';
import { workshopHearts, workshopStuffings, buildOf, qualityById } from '../../config/workshop.js';
import { castShot } from '../../weapons/hitscan.js';
import { gunPower } from '../../weapons/gunStats.js';

const UP = new THREE.Vector3(0, 1, 0);
const CHEST_HEIGHT = 1.1; // where a stuffing's line of sight is measured, above a zombie's feet
const MISS_OFFSET = .15; // metres out from a wall a missed Last Round goes off

export function createBuildEffects({ events, gun, zombies, colliders, effects, stats, state, sound }) {
  let heartCooldown = 0;
  let emberTimer = 0;
  const chest = (zombie) => from.copy(zombie.position).setY(zombie.position.y + CHEST_HEIGHT);
  const from = new THREE.Vector3(), to = new THREE.Vector3(), direction = new THREE.Vector3();
  const arcFrom = new THREE.Vector3(), arcTo = new THREE.Vector3();

  const canBeHit = (z) => z.isAlive && z.state !== 'spawning';
  const clearLine = (a, b) => {
    from.copy(a).setY(a.y + CHEST_HEIGHT);
    to.copy(b).setY(b.y + CHEST_HEIGHT);
    direction.subVectors(to, from);
    const distance = direction.length();
    return distance < 1e-3 || !castShot(from, direction.normalize(), distance, colliders, []).worldHit;
  };

  /** Living zombies within `radius` of a spot on the floor, in plain sight of it, nearest first. */
  function nearby(spot, radius, skip = new Set()) {
    return zombies.zombies
      .filter((z) => canBeHit(z) && !skip.has(z) && Math.abs(z.position.y - spot.y) < 2 && Math.hypot(z.position.x - spot.x, z.position.z - spot.z) <= radius
        && clearLine(spot, z.position))
      .sort((a, b) => a.position.distanceToSquared(spot) - b.position.distanceToSquared(spot));
  }

  const STUFFINGS = {
    // Everything round the hit slows down.
    smoothie({ spot, target, power }) {
      const { slow } = workshopStuffings.smoothie;
      const seconds = slow.seconds * power;
      const hit = new Set(nearby(spot, slow.radius * power));
      if (target && canBeHit(target)) hit.add(target);
      for (const zombie of hit) zombie.applySlow(seconds, slow.fraction);
      return hit;
    },

    // The target burns, and anything right next to it catches.
    fryerOil({ spot, target, power, gunSecond }) {
      const { burn } = workshopStuffings.fryerOil;
      const hit = new Set(nearby(spot, burn.radius));
      if (target && canBeHit(target)) hit.add(target);
      for (const zombie of hit) zombie.applyBurn(gunSecond * burn.gunSeconds * power, burn.seconds, burn.tickSeconds);
      return hit;
    },

    // An arc jumps from zombie to zombie, weaker each time.
    neonTube({ spot, target, power, gunSecond }) {
      const { chain } = workshopStuffings.neonTube;
      const jumps = Math.round(chain.jumps * power);
      const hit = new Set(target ? [target] : []);
      let at = target ? target.position : spot, damage = gunSecond * chain.gunSeconds * power;
      for (let i = 0; i < jumps; i++) {
        const next = nearby(at, chain.range, hit)[0];
        if (!next) break;
        hit.add(next);
        effects.tracer(arcFrom.copy(at).setY(at.y + CHEST_HEIGHT), arcTo.copy(next.position).setY(next.position.y + CHEST_HEIGHT), workshopStuffings.neonTube.color);
        next.takeHit({ damage, part: 'body', source: 'build' });
        damage *= chain.falloff;
        at = next.position;
      }
      return hit;
    },
  };

  const firstHeadHit = (shot) => shot.hits?.find((hit) => hit.part === 'head' && hit.target.type);
  const firstZombieHit = (shot) => shot.hits?.find((hit) => hit.target.type);
  const HEARTS = {
    headshot(shot) {
      const hit = firstHeadHit(shot);
      return hit ? { target: hit.target } : null;
    },
    // The last round fires it whether or not it hits anything: at a miss, it goes off where the round landed.
    lastRound(shot) {
      if (shot.magazineLeft !== 0) return null;
      const hit = firstZombieHit(shot);
      // (Stepped off the surface it hit, so the wall itself doesn't block the splash.)
      return hit ? { target: hit.target } : { point: shot.end.clone().addScaledVector(shot.endNormal, MISS_OFFSET) };
    },
  };

  /** Fire a build's stuffing at a Heart's trigger: { target } a zombie, or { point } a spot in the air (a miss, a blast round you). */
  function fire(build, weaponId, { target = null, point = null }) {
    const heart = workshopHearts[build.heart];
    const stuffing = workshopStuffings[build.stuffing];
    const spot = target ? target.position.clone() : point.clone().setY(point.y - CHEST_HEIGHT);
    const power = qualityById(build.quality).power * heart.strength;
    const gunSecond = gunPower(gun.defOf(weaponId), stats);
    const hit = STUFFINGS[build.stuffing]({ spot, target, power, gunSecond });
    for (const zombie of hit) {
      effects.confetti(chest(zombie), UP, stuffing.pop);
    }
    if (hit.size) sound?.play(stuffing.sound);
    events.emit('buildFired', { stuffing: build.stuffing, heart: build.heart, weaponId, hit: [...hit] });
  }

  events.on('shot', (shot) => {
    if (state.over || heartCooldown > 0 || !shot.weaponId) return;
    const build = buildOf(gun.modsFor(shot.weaponId));
    if (!build) return;
    const trigger = HEARTS[build.heart]?.(shot);
    if (!trigger) return;
    heartCooldown = workshopHearts[build.heart].cooldownSeconds;
    fire(build, shot.weaponId, trigger);
  });

  return {
    update(dt) {
      heartCooldown = Math.max(0, heartCooldown - dt);
      emberTimer -= dt;
      if (emberTimer > 0) return;
      const { burn } = workshopStuffings.fryerOil;
      emberTimer = burn.emberSeconds;
      for (const zombie of zombies.zombies) if (zombie.burn && zombie.isAlive) effects.confetti(chest(zombie), UP, burn.ember);
    },
    reset() {
      heartCooldown = 0;
      emberTimer = 0;
    },
  };
}
