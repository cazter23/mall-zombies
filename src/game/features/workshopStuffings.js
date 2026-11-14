// =============================================================================
// STUFFINGS AND HEARTS: what a finished Build-A-Blaster gun does (built by game/features/workshop.js).
// A build pairs a Stuffing (WHAT happens) with a Heart (WHEN it happens), and the two never know about each other, so any
// pair works: a new one of either = one entry in config/workshop.js + one function in STUFFINGS or HEARTS below.
//   Hearts read 'shot', 'reload' and 'kill' events. Each Heart lists the events it wants; it returns { target } or { point } when it fires, or null.
//   Stuffings get that spot plus `power` (the build's quality x the Heart's strength) and `gunSecond` (workshop damage scale:
//   one second of this gun's fire, weapons/gunStats.js gunPower).
// A stuffing's damage goes through zombie.takeHit with source 'build', so a kill pays once on the 'kill' event like any other.
// Nothing here emits 'shot', and Every 10th only counts kills with source 'gun', which is why a stuffing's kills can't set a Heart off again.
// =============================================================================

import * as THREE from 'three';
import { workshopHearts, workshopReach, workshopStuffings, stuffingLook, buildOf, qualityById } from '../../config/workshop.js';
import { castShot } from '../../weapons/hitscan.js';
import { gunPower } from '../../weapons/gunStats.js';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const { chestHeight: CHEST_HEIGHT, missOffset: MISS_OFFSET, floorSearch: FLOOR_SEARCH } = workshopReach;

export function createBuildEffects({ events, gun, player, zombies, colliders, effects, stats, state, sound, scene }) {
  const heartCooldowns = new Map(); // weapon id -> seconds until its Heart can fire again
  let firing = null; // the weapon id whose stuffing is going off right now (its instant kills belong to that gun)
  const killCounts = new Map(); // weapon id -> kills for Every 10th
  let emberTimer = 0;
  let bubbleTimer = 0;
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

  // Popcorn Butter's puddles: a small fixed pool of flat discs, so a proc allocates nothing.
  const { puddle: puddleConfig } = workshopStuffings.popcornButter;
  const puddleGeometry = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  const puddleMaterial = new THREE.MeshBasicMaterial({ color: workshopStuffings.popcornButter.color, transparent: true, opacity: puddleConfig.opacity, depthWrite: false });
  const puddles = Array.from({ length: puddleConfig.maxPuddles }, () => {
    const mesh = new THREE.Mesh(puddleGeometry, puddleMaterial);
    mesh.name = 'butterPuddle';
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, radius: 0, remaining: 0 };
  });
  const floorUnder = (spot) => {
    from.copy(spot).setY(spot.y + CHEST_HEIGHT);
    const ray = castShot(from, DOWN, FLOOR_SEARCH, colliders, []);
    return ray.worldHit ? ray.end.y : null;
  };
  function placePuddle(spot, radius, seconds) {
    const y = floorUnder(spot);
    if (y === null) return;
    const puddle = puddles.reduce((oldest, p) => (p.remaining < oldest.remaining ? p : oldest)); // the oldest gives way
    puddle.radius = radius;
    puddle.remaining = seconds;
    puddle.mesh.position.set(spot.x, y + puddleConfig.lift, spot.z);
    puddle.mesh.scale.setScalar(radius);
    puddle.mesh.visible = true;
  }
  const bubbleSpot = new THREE.Vector3();
  function updatePuddles(dt) {
    bubbleTimer -= dt;
    for (const puddle of puddles) {
      if (puddle.remaining <= 0) continue;
      puddle.remaining -= dt;
      if (puddle.remaining <= 0) {
        puddle.mesh.visible = false;
        continue;
      }
      const { position } = puddle.mesh;
      for (const zombie of zombies.zombies) {
        if (canBeHit(zombie) && Math.abs(zombie.position.y - position.y) < 1
          && Math.hypot(zombie.position.x - position.x, zombie.position.z - position.z) <= puddle.radius) {
          zombie.applySlow(puddleConfig.slowSeconds, puddleConfig.slowFraction, 'butter');
          zombie.applySlip(puddleConfig.slipSeconds, puddleConfig.slipDrag); // (refused while it's down or just got up)
        }
      }
      // Bubbles pop on the butter, so the puddle looks alive.
      if (bubbleTimer <= 0) effects.confetti(bubbleSpot.set(position.x + (Math.random() - .5) * puddle.radius * 1.4, position.y + .04, position.z + (Math.random() - .5) * puddle.radius * 1.4), UP, stuffingLook.bubble);
    }
    if (bubbleTimer <= 0) bubbleTimer = puddleConfig.bubbleSeconds;
  }

  const STUFFINGS = {
    // Everything round the hit slows down.
    smoothie({ spot, target, power }) {
      const { slow, vulnerable } = workshopStuffings.smoothie;
      const seconds = slow.seconds * power;
      const hit = new Set(nearby(spot, slow.radius * Math.sqrt(power)));
      if (target && canBeHit(target)) hit.add(target);
      for (const zombie of hit) {
        zombie.applySlow(seconds, slow.fraction, 'smoothie');
        zombie.applyVulnerable(seconds, vulnerable.multiplier); // (slowed zombies take more from everything)
      }
      return hit;
    },

    // The target burns, and anything right next to it catches.
    fryerOil({ spot, target, power, gunSecond, weaponId }) {
      const { burn } = workshopStuffings.fryerOil;
      const hit = new Set(nearby(spot, burn.radius));
      if (target && canBeHit(target)) hit.add(target);
      for (const zombie of hit) zombie.applyBurn(gunSecond * burn.gunSeconds * power, burn.seconds, burn.tickSeconds, weaponId);
      return hit;
    },

    // An arc jumps from zombie to zombie, weaker each time.
    neonTube({ spot, target, power, gunSecond, weaponId }) {
      const { chain } = workshopStuffings.neonTube;
      const jumps = Math.min(chain.maxJumps, Math.round(chain.jumps * power));
      const hit = new Set(target ? [target] : []);
      let at = target ? target.position : spot, damage = gunSecond * chain.gunSeconds * power;
      for (let i = 0; i < jumps; i++) {
        const next = nearby(at, chain.range, hit)[0];
        if (!next) break;
        hit.add(next);
        effects.tracer(arcFrom.copy(at).setY(at.y + CHEST_HEIGHT), arcTo.copy(next.position).setY(next.position.y + CHEST_HEIGHT), workshopStuffings.neonTube.color, { width: chain.width, seconds: chain.seconds, flicker: 24 });
        effects.flash(arcTo, workshopStuffings.neonTube.color, { size: .5, seconds: chain.seconds });
        next.takeHit({ damage: Math.min(damage, next.maxHealth * chain.maxFraction), part: 'body', source: 'build', weaponId });
        damage *= chain.falloff;
        at = next.position;
      }
      return hit;
    },
  };

  STUFFINGS.popcornButter = ({ spot, target, power }) => {
    placePuddle(spot, puddleConfig.radius * Math.sqrt(power), puddleConfig.seconds * power);
    return new Set(target && canBeHit(target) ? [target] : []);
  };

  // Chilled zombies shatter; anything else nearby is chilled, so a second proc finishes what the first began.
  STUFFINGS.antifreeze = ({ spot, target, power, gunSecond, weaponId }) => {
    const { chill, shatter } = workshopStuffings.antifreeze;
    const hit = new Set(nearby(spot, chill.radius * Math.sqrt(power)));
    if (target && canBeHit(target)) hit.add(target);
    // Decide first, act after: a zombie the shards chill must not then shatter in the same proc.
    const shatterList = [], chillList = [];
    for (const zombie of hit) {
      if (zombie.type.boss) chillList.push(zombie);
      else if (zombie.slowTimer > 0 && shatterList.length < shatter.maxTargets) shatterList.push(zombie);
      else if (zombie.slowTimer <= 0) chillList.push(zombie);
    }
    for (const zombie of chillList) zombie.applySlow(chill.seconds * power, chill.fraction, 'antifreeze');
    const spots = shatterList.map((zombie) => zombie.position.clone());
    const shards = new Set(shatterList);
    for (const zombie of shatterList) {
      zombie.clearSlow();
      effects.confetti(chest(zombie), UP, stuffingLook.frost); // the ice bursts apart
      effects.flash(arcFrom.copy(zombie.position).setY(zombie.position.y + CHEST_HEIGHT), workshopStuffings.antifreeze.color,
        { size: stuffingLook.flash.size, seconds: stuffingLook.flash.seconds });
      zombie.takeHit({ damage: gunSecond * shatter.gunSeconds * power, part: 'body', source: 'build', weaponId });
    }
    // The shards hit, and chill, whatever stands round each one that shattered.
    const splashed = new Set();
    for (const spot of spots) {
      for (const other of nearby(spot, shatter.splashRadius, shards)) {
        if (splashed.has(other)) continue;
        splashed.add(other);
        other.applySlow(chill.seconds * power, chill.fraction, 'antifreeze');
        other.takeHit({ damage: gunSecond * shatter.splashGunSeconds * power, part: 'body', source: 'build', weaponId });
      }
    }
    for (const zombie of splashed) hit.add(zombie);
    return hit;
  };

  // The zombies round the hit forget you and turn on each other (zombies/confusion.js).
  STUFFINGS.glitter = ({ spot, target, power, gunSecond, weaponId }) => {
    const { confuse } = workshopStuffings.glitter;
    const hit = new Set(target && canBeHit(target) ? [target] : []);
    for (const zombie of nearby(spot, confuse.radius * Math.sqrt(power))) if (hit.size < confuse.maxTargets) hit.add(zombie);
    const seconds = Math.min(confuse.maxSeconds, confuse.seconds * power);
    for (const zombie of hit) if (!zombie.applyConfusion(seconds, gunSecond * confuse.gunSeconds * power, weaponId)) hit.delete(zombie);
    return hit;
  };

  const firstHeadHit = (shot) => shot.hits?.find((hit) => hit.part === 'head' && hit.target.type);
  const firstZombieHit = (shot) => shot.hits?.find((hit) => hit.target.type);
  const HEARTS = {
    headshot: { shot(shot) {
      const hit = firstHeadHit(shot);
      return hit ? { target: hit.target } : null;
    } },
    // The last round fires it whether or not it hits anything: at a miss, it goes off where the round landed.
    // A blast gun's round is its BURST, not its launch (the rocket is still in the air at the shot): it waits for 'gunBlast'.
    lastRound: { shot(shot) {
      if (shot.magazineLeft !== 0 || shot.blast) return null;
      const hit = firstZombieHit(shot);
      // (Stepped off the surface it hit, so the wall itself doesn't block the splash.)
      return hit ? { target: hit.target } : { point: shot.end.clone().addScaledVector(shot.endNormal, MISS_OFFSET) };
    }, blast({ magazineLeft, hits, position }) {
      if (magazineLeft !== 0) return null;
      const hit = hits.find((h) => h.target.type);
      return hit ? { target: hit.target } : { point: position.clone() }; // (where it burst: bursts are already off the surface)
    } },
    // A blast around you, wherever you are.
    // (Only with a zombie close: it's the panic button, so a reload in a quiet moment saves its cooldown.)
    reload: { reload: () => {
      const { nearRange } = workshopHearts.reload, p = player.position;
      const close = zombies.zombies.some((z) => canBeHit(z) && Math.abs(z.position.y - p.y) < 2 && Math.hypot(z.position.x - p.x, z.position.z - p.z) <= nearRange);
      return close ? { point: player.position.clone().setY(player.position.y + CHEST_HEIGHT), burst: true } : null;
    } },
    // Counts the kills this gun makes. It fires at the tenth corpse, which is why the stuffing has to cope with a dead target.
    everyTenth: { kill({ zombie }, weaponId) {
      const count = (killCounts.get(weaponId) ?? 0) + 1;
      killCounts.set(weaponId, count);
      return count % workshopHearts.everyTenth.everyKills === 0 ? { target: zombie } : null;
    } },
  };

  /** Fire a build's stuffing at a Heart's trigger: { target } a zombie, or { point } a spot in the air (a miss, a blast round you). */
  function fire(build, weaponId, { target = null, point = null, burst = false }) {
    const heart = workshopHearts[build.heart];
    const stuffing = workshopStuffings[build.stuffing];
    const spot = target ? target.position.clone() : point.clone().setY(point.y - CHEST_HEIGHT);
    const power = qualityById(build.quality).power * heart.strength;
    const gunSecond = gunPower(gun.defOf(weaponId), stats);
    firing = weaponId;
    const hit = STUFFINGS[build.stuffing]({ spot, target, power, gunSecond, weaponId });
    firing = null;
    for (const zombie of hit) {
      zombie.stuffedBy = weaponId; // (legacy confirmed-kill credit for the named gun's receipt)
      effects.confetti(chest(zombie), UP, stuffing.pop);
    }
    if (burst) effects.confetti(chest({ position: spot }), UP, stuffing.pop);
    // A burst of light where it goes off, in the stuffing's colour (bigger for a stronger build), so a proc reads even in a crowd.
    const { flash } = stuffingLook;
    effects.flash(arcTo.copy(spot).setY(spot.y + CHEST_HEIGHT), stuffing.color, { size: flash.size * Math.min(1.6, Math.sqrt(power)), seconds: flash.seconds, opacity: flash.opacity });
    sound?.play(stuffing.sound);
    events.emit('buildFired', { stuffing: build.stuffing, heart: build.heart, weaponId, hit: [...hit] });
  }

  // One gun's Heart and cooldown never touch another's: both guns can carry a build.
  function offer(name, payload, weaponId) {
    if (state.over || !weaponId) return;
    const build = buildOf(gun.modsFor(weaponId));
    const trigger = build && HEARTS[build.heart]?.[name]?.(payload, weaponId); // (asked first: Every 10th has to count every kill)
    if (!trigger || (heartCooldowns.get(weaponId) ?? 0) > 0) return;
    heartCooldowns.set(weaponId, workshopHearts[build.heart].cooldownSeconds * (qualityById(build.quality).heartCooldown ?? 1));
    fire(build, weaponId, trigger);
  }
  events.on('shot', (shot) => offer('shot', shot, shot.weaponId));
  events.on('reload', (reload) => offer('reload', reload, reload.weaponId));
  events.on('gunBlast', (blast) => offer('blast', blast, blast.weaponId));
  // A named gun's record: its own kills and its stuffing's, for the receipt. Nothing counts once you're dead.
  // (The gun that made the kill, kill.weaponId: a ball, rocket or balloon can land after you have switched guns.)
  function confirmKill({ zombie, source, weaponId: killer }) {
    const weaponId = source === 'gun' ? killer ?? gun.def.id : source === 'build' ? firing ?? zombie.stuffedBy : null;
    const build = !state.over && weaponId ? buildOf(gun.modsFor(weaponId)) : null;
    if (build) build.confirmed = (build.confirmed ?? 0) + 1;
  }
  events.on('kill', (kill) => {
    if (kill.zombie.noRewards) return;
    confirmKill(kill);
    if (kill.source === 'gun') offer('kill', kill, kill.weaponId ?? gun.def.id);
  });

  return {
    update(dt) {
      for (const [id, seconds] of heartCooldowns) heartCooldowns.set(id, Math.max(0, seconds - dt));
      updatePuddles(dt);
      emberTimer -= dt;
      if (emberTimer > 0) return;
      const { burn } = workshopStuffings.fryerOil, { sparkle } = workshopStuffings.glitter.confuse;
      emberTimer = Math.min(burn.emberSeconds, stuffingLook.statusSeconds);
      for (const zombie of zombies.zombies) {
        if (!zombie.isAlive) continue;
        if (zombie.burn) {
          effects.confetti(chest(zombie), UP, stuffingLook.flame); // flames lick up the burning zombie
          effects.confetti(chest(zombie), UP, burn.ember);
        }
        if (zombie.confusion) {
          effects.confetti(chest(zombie), UP, sparkle);
          effects.confetti(chest(zombie), UP, stuffingLook.hearts); // hearts float up off a confused one
        }
        if (zombie.slowTimer > 0 && zombie.slowKind === 'smoothie') effects.confetti(chest(zombie), DOWN, stuffingLook.drip); // goo drips
      }
    },
    reset() {
      heartCooldowns.clear();
      killCounts.clear();
      emberTimer = 0;
      bubbleTimer = 0;
      for (const puddle of puddles) {
        puddle.remaining = 0;
        puddle.mesh.visible = false;
      }
    },
  };
}
