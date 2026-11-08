// =============================================================================
// ZOMBIE MANAGER
// Owns every zombie: spawning at the map's spawn markers, the shared flow-field
// navigation, handing out surround slots near the player, ticking each zombie,
// keeping zombies from overlapping each other or the player (never through
// walls), adding/removing them from the shootables list, and death effects.
// Waves (how many, how often, which type) are decided by game/rounds.js, which calls spawn(typeId).
// =============================================================================

import * as THREE from 'three';
import { createPartyTrapDeaths } from './partyTrapDeath.js';
import { createTankDeaths } from './tankDeath.js';
import { feel } from '../config/feel.js';
import { mascotTypes, zombieTypes, zombieCrowd, zombieFailsafe, zombieSpawn } from '../config/zombies.js';
import { pickMascotVariant } from './mascotVariants.js';
import { bossTypes } from '../config/bosses.js';
import { economy, zombieHealthFor } from '../config/economy.js';
import { createNavigation } from './navigation.js';
import { overlapsSolid } from '../world/collision.js';
import { castShot } from '../weapons/hitscan.js';
import { Zombie } from './zombie.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * @param scene        three.js scene to add zombie models to
 * @param colliders    shared world collider list (walls, props, shutter, ...)
 * @param player       PlayerController (the target)
 * @param shootables   shared list the gun shoots at; zombies are added/removed here
 * @param effects      fx (splatter, dust)
 * @param spawnPoints  map markers: [{ name, zone, position }]
 * @param isZoneOpen   (zoneId) => boolean; zombies only spawn in zones the player has opened
 * @param getRound     () => current round number (for health scaling)
 * @param canAttack    () => false once the player is dead
 * @param onPlayerHit  (damage, zombie) => apply a landed zombie hit to the player
 * @param onKill       optional (zombie) => called when a zombie dies (run stats, later points)
 * @param onHeadPop    optional (zombie, { headshot, source }) => the Mascot's helmet came off
 * @param onSound      optional (name, volume) => play a zombie sound (Mall Walker squeaks, huffs, pants)
 * @param navigation   optional { floors, links } for maps with more than one floor (zombies/navigation.js)
 */
export function createZombieManager({
  scene,
  colliders,
  player,
  shootables,
  effects,
  spawnPoints,
  isZoneOpen = () => true,
  getRound,
  canAttack,
  onPlayerHit,
  onKill = null,
  onHeadPop = null,
  onSound = null,
  navigation = undefined,
}) {
  // Every zombie type shares one grid for now; sized for the shopper.
  const base = zombieTypes.shopper;
  const nav = createNavigation(colliders, { radius: base.radius, height: base.height }, navigation);
  const zombies = [];
  let spawnClock = 0;
  const lastSpawnAt = new Map();
  // Zombie sounds go through here: the same sound never stacks within soundMinGapSeconds,
  // so a group of Mall Walkers squeaks like a group, not a wall of noise.
  let soundClock = 0;
  const lastSoundAt = new Map();
  function playZombieSound(name, volume) {
    if (!onSound) return;
    if (soundClock - (lastSoundAt.get(name) ?? -Infinity) < zombieCrowd.soundMinGapSeconds) return;
    lastSoundAt.set(name, soundClock);
    onSound(name, volume);
  }
  const ctx = { nav, player, colliders, zombies, canAttack: true, onPlayerHit, onSound: playZombieSound };
  const scratch = new THREE.Vector3();
  let steered = null; // spawn markers tried before the map's own (Build-A-Blaster's Returns Chute), or null
  let chuteDrop = 0, onChuteDrop = null;

  // Hard safety checks first. A rising zombie reserves its full ground-level body,
  // and a rescue ignores only the zombie being relocated. No safe point => retry later.
  // `nearest`: the safe point with the shortest route to the player, no dice (a debug spawn "near you").
  function pickSpawnPoint(type, ignoredZombie = null, points = spawnPoints, nearest = false) {
    const candidates = [];
    for (const point of points) {
      if (!isZoneOpen(point.zone)) continue;
      const p = point.position;
      if (Math.hypot(p.x - player.position.x, p.z - player.position.z) < zombieCrowd.minSpawnDistance) continue;
      const cost = nav.distanceToTarget(p.x, p.z, p.y);
      if (!Number.isFinite(cost)) continue;
      const occupied = zombies.some((z) => {
        if (z === ignoredZombie || !z.isAlive) return false;
        // Actors on another floor, above or below that body, do not occupy the point.
        if (z.position.y >= p.y + type.height || z.position.y + z.type.height <= p.y) return false;
        const clearance = type.radius + z.type.radius + zombieSpawn.clearanceGap;
        return Math.hypot(p.x - z.position.x, p.z - z.position.z) < clearance;
      });
      if (!occupied) candidates.push({ point, cost });
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.cost - b.cost);
    if (nearest) return candidates[0].point;
    // The field includes wall penalties: cost is a route ranking, not literal walking meters.
    const maxCost = candidates[0].cost + zombieSpawn.neighbourhoodCostAllowance;
    const neighbourhood = candidates.filter((c) => c.cost <= maxCost);
    const ready = neighbourhood.filter(({ point }) =>
      spawnClock - (lastSpawnAt.get(point) ?? -Infinity) >= zombieSpawn.reuseCooldownSeconds,
    );
    // Relax cooldowns inside the neighbourhood, never player distance or body clearance.
    const pool = ready.length > 0 ? ready : neighbourhood;
    const count = Math.random() < zombieSpawn.nearbyChance
      ? Math.min(pool.length, zombieSpawn.nearestCount) : pool.length;
    return pool[Math.floor(Math.random() * count)].point;
  }

  // Walk / jog / run, picked by chance from the round's row in type.gaitsByRound.
  function pickGaitSpeed(type, round) {
    if (!type.gaitsByRound) return type.speed;
    let row = type.gaitsByRound[0];
    for (const r of type.gaitsByRound) if (round >= r.fromRound) row = r;
    let roll = Math.random();
    for (const gait of Object.keys(type.gaits)) {
      const chance = row[gait] ?? 0;
      if (roll < chance) return type.gaits[gait];
      roll -= chance;
    }
    return type.speed;
  }

  const partyDeaths = createPartyTrapDeaths({ scene, effects, playPop: (position) => {
    const volume = Math.max(0, 1 - position.distanceTo(player.position) / 14);
    if (volume > 0) playZombieSound('partySnap', volume);
  } });
  const tankDeaths = createTankDeaths();
  function onZombieDeath(zombie) {
    if (zombie.killedBy === 'partyTrap') {
      if (onKill) onKill(zombie);
      return;
    }
    // A final burst of splatter from the chest, carrying the killing blow's directional momentum.
    scratch.copy(zombie.position);
    scratch.y += zombie.type.hitbox.bodyTop * 0.75;
    effects.splat(scratch, UP, zombie.type.splatColors, zombie.type.deathSplatCount, {
      flesh: !zombie.type.plastic,
      speedScale: zombie.deathImpulse ?? 1,
      direction: zombie.lastHitDir ?? null,
    });
    if (!zombie.type.plastic) effects.pool(zombie.position.x, zombie.position.z); // (red splatter only)
    if (onKill) onKill(zombie);
  }

  // Sir Waffles' fallen helmets: on the floor until the round ends, whatever became of the body.
  const helmets = []; // [{ helmet, round }]
  const helmetRay = new THREE.Vector3();
  function keepHelmet(zombie, { helmet, headshot, source }) {
    const { leftHelmets } = zombie.type.mascot;
    // It lands short of any wall in the way, or it would sit half inside it for the rest of the round.
    scratch.copy(zombie.position).setY(zombie.position.y + leftHelmets.rayHeight);
    helmetRay.copy(helmet.landing).setY(scratch.y).sub(scratch);
    const length = helmetRay.length();
    if (length > 1e-3) {
      const { worldHit, end } = castShot(scratch, helmetRay.normalize(), length, colliders, []);
      if (worldHit) helmet.setReach(Math.max(0, (end.distanceTo(scratch) - leftHelmets.wallMargin) / length));
    }
    helmets.push({ helmet, round: getRound() });
    while (helmets.length > leftHelmets.max) helmets.shift().helmet.dispose();
    if (onHeadPop) onHeadPop(zombie, { headshot, source });
  }
  function updateHelmets(dt) {
    const round = getRound();
    for (let i = helmets.length - 1; i >= 0; i--) {
      if (helmets[i].round === round) helmets[i].helmet.update(dt, player.position);
      else helmets.splice(i, 1)[0].helmet.dispose();
    }
  }

  const stepTol = feel.movement.stepTolerance;
  const trial = new THREE.Vector3();

  // Move `pos` by (mx, mz) only if that doesn't put the body inside a wall or prop.
  // Returns true if it moved. (A crowd must never shove anyone through a wall.)
  function shoveIfClear(pos, mx, mz, radius, height) {
    trial.set(pos.x + mx, pos.y, pos.z + mz);
    if (overlapsSolid(trial, radius, height, colliders, stepTol)) return false;
    pos.x = trial.x;
    pos.z = trial.z;
    return true;
  }

  // Push the player out of any zombie they're overlapping, so zombies are solid to walk into.
  // If the player is pinned against a wall, the zombie is pushed back instead.
  function keepPlayerOutOfZombies() {
    const p = player.position;
    for (const z of zombies) {
      if (!z.isAlive || z.state === 'spawning') continue;
      const verticalOverlap = p.y < z.position.y + z.type.height && p.y + player.height > z.position.y;
      if (!verticalOverlap) continue;
      let dx = p.x - z.position.x;
      let dz = p.z - z.position.z;
      let d = Math.hypot(dx, dz);
      const minD = z.type.radius + feel.player.radius;
      if (d >= minD) continue;
      if (d < 1e-4) {
        dx = 1; // exactly on top of each other: pick any direction
        dz = 0;
        d = 0;
      }
      const len = Math.hypot(dx, dz);
      const push = minD - d;
      const nx = dx / len;
      const nz = dz / len;
      if (!shoveIfClear(p, nx * push, nz * push, feel.player.radius, player.height)) {
        if (!z.frozen) shoveIfClear(z.position, -nx * push, -nz * push, z.type.radius, z.type.height);
      }
    }
  }

  // Hard rule after moving: no two zombies overlap. Each gives way half (or all, if the other is
  // against a wall). Spacing steering keeps this rare; this catches what it can't (doorways, crowds).
  function resolveZombieOverlaps() {
    const minSpacing = zombieCrowd.minSpacing;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < zombies.length; i++) {
        const a = zombies[i];
        if (!a.isAlive || a.state === 'spawning') continue;
        for (let j = i + 1; j < zombies.length; j++) {
          const b = zombies[j];
          if (!b.isAlive || b.state === 'spawning') continue;
          let dx = b.position.x - a.position.x;
          let dz = b.position.z - a.position.z;
          let d = Math.hypot(dx, dz);
          if (d >= minSpacing) continue;
          if (d < 1e-4) {
            dx = Math.random() - 0.5;
            dz = Math.random() - 0.5;
            d = Math.hypot(dx, dz);
          }
          const nx = dx / d;
          const nz = dz / d;
          const overlap = minSpacing - Math.min(d, minSpacing);
          const half = overlap / 2;
          const aMoved = !a.frozen && shoveIfClear(a.position, -nx * half, -nz * half, a.type.radius, a.type.height);
          const bMoved = !b.frozen && shoveIfClear(b.position, nx * (aMoved ? half : overlap), nz * (aMoved ? half : overlap), b.type.radius, b.type.height);
          if (!bMoved && aMoved) shoveIfClear(a.position, -nx * half, -nz * half, a.type.radius, a.type.height);
        }
      }
    }
  }

  // --- Failsafe: stuck / lost zombies ------------------------------------------------
  // A zombie that fell out of the world, or that's far from the player and has barely moved (or
  // can't reach them) for a while, rises again at a fresh spawn point. It keeps its health and
  // nobody gets points, so a round can't hang on one wedged zombie. Zombies near the player
  // (crowding, attacking) are never touched.
  function rescueStuckZombies(dt) {
    const fs = zombieFailsafe;
    for (const z of zombies) {
      if (!z.isAlive || z.state === 'spawning') continue;
      if (z.frozen && z.position.y >= fs.fallOutHeight) {
        z.stuckTimer = 0; z.stuckFrom.x = z.position.x; z.stuckFrom.z = z.position.z; continue;
      }
      if (z.position.y < fs.fallOutHeight) {
        rescue(z);
        continue;
      }
      z.stuckTimer += dt;
      if (z.stuckTimer < fs.checkSeconds) continue;
      const moved = Math.hypot(z.position.x - z.stuckFrom.x, z.position.z - z.stuckFrom.z);
      const far = z.distanceTo(player) > fs.ignoreWithinMeters;
      const unreachable = nav.distanceToTarget(z.position.x, z.position.z, z.position.y) === Infinity;
      if (far && (moved < fs.minMoveMeters || unreachable)) rescue(z);
      z.stuckTimer = 0;
      z.stuckFrom.x = z.position.x;
      z.stuckFrom.z = z.position.z;
    }
  }

  function rescue(z) {
    const point = pickSpawnPoint(z.type, z);
    if (!point) return; // nowhere better right now: try again at the next check
    const yaw = Math.atan2(-(player.position.x - point.position.x), -(player.position.z - point.position.z));
    z.respawnAt(point.position, yaw);
    lastSpawnAt.set(point, spawnClock);
    z.stuckTimer = 0;
    z.stuckFrom.x = z.position.x;
    z.stuckFrom.z = z.position.z;
    scratch.copy(z.position);
    scratch.y += 0.05;
    effects.splat(scratch, UP, zombieCrowd.spawnDustColors, zombieCrowd.spawnDustCount);
  }

  // --- Surround slots -------------------------------------------------------------
  // Rings of spots around the player (inner ring at arm's length). Zombies near the player
  // (with a clear line to them) each claim one, so a crowd fans out around you instead of
  // queueing behind each other. A zombie keeps its slot while it stays free and valid.
  const slotPoint = { x: 0, z: 0 };
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  let playerStillTime = 0; // seconds the player has been (nearly) standing still

  function assignSurroundSlots(dt) {
    const crowd = zombieCrowd;
    const p = player.position;
    const contact = base.radius + feel.player.radius + crowd.contactGap;

    // How far around the player a zombie may go: only its own side while the player keeps moving,
    // widening to the full circle once they've stood still for a moment.
    const playerSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    playerStillTime = playerSpeed < crowd.playerStillSpeed ? playerStillTime + dt : 0;
    const wrap = Math.max(0, Math.min(1, (playerStillTime - crowd.wrapAfterStillSeconds) / crowd.wrapSeconds));
    const sector = (crowd.surroundSectorDegrees + (180 - crowd.surroundSectorDegrees) * wrap) * (Math.PI / 180);

    // Build this tick's valid slots (walkable, and no wall between the player and the slot).
    const slots = new Map(); // key -> { x, z, ring }
    for (let ring = 0; ring < crowd.surroundRings; ring++) {
      const radius = contact + ring * crowd.surroundRingSpacing;
      const count = Math.max(1, Math.floor((2 * Math.PI * radius) / crowd.surroundSlotSpacing));
      const stagger = (ring % 2) * (Math.PI / count); // rings offset so outer zombies stand in the gaps
      for (let k = 0; k < count; k++) {
        const angle = stagger + (k * 2 * Math.PI) / count;
        slotPoint.x = p.x + Math.cos(angle) * radius;
        slotPoint.z = p.z + Math.sin(angle) * radius;
        if (!nav.isWalkableAt(slotPoint.x, slotPoint.z, p.y)) continue;
        if (!nav.clearLine(p.x, p.z, slotPoint.x, slotPoint.z, p.y)) continue;
        slots.set(ring * 1000 + k, { x: slotPoint.x, z: slotPoint.z, ring, angle });
      }
    }

    // Who's close enough to take a slot? Nearest first, so the front of the crowd gets the inner ring.
    const candidates = [];
    for (const z of zombies) {
      z.slot = null;
      if (!z.isAlive || z.type.boss || z.state === 'spawning') continue;
      const d = z.distanceTo(player);
      if (d > crowd.surroundRadius) continue;
      if (nav.layerOf(z.position.y) !== nav.layerOf(p.y)) continue; // (a zombie on another floor takes the route to you, not a slot)
      if (!nav.clearLine(z.position.x, z.position.z, p.x, p.z, p.y)) continue;
      candidates.push({ z, d });
    }
    candidates.sort((a, b) => a.d - b.d);

    const taken = new Set();
    for (const { z } of candidates) {
      // Only slots on my side of the player (the sector widens when the player stands still).
      const bearing = Math.atan2(z.position.z - p.z, z.position.x - p.x);
      const onMySide = (s) => Math.abs(wrapAngle(s.angle - bearing)) <= sector;
      // Innermost ring with a free slot on my side (inner rings fill first, so zombies close in).
      let freeRing = Infinity;
      for (const [k, s] of slots) if (!taken.has(k) && s.ring < freeRing && onMySide(s)) freeRing = s.ring;
      if (freeRing === Infinity) {
        z.slotKey = null;
        continue; // nothing free on my side: follow the route with spacing (bunching up behind)
      }
      // Keep my slot if it's still there, on my side, nobody nearer took it, and nothing's free further in.
      const prev = z.slotKey !== null ? slots.get(z.slotKey) : null;
      let key = prev && !taken.has(z.slotKey) && onMySide(prev) && prev.ring <= freeRing ? z.slotKey : null;
      if (key === null) {
        // Otherwise the free slot on that ring, on my side, closest to me.
        let best = Infinity;
        for (const [k, s] of slots) {
          if (taken.has(k) || s.ring !== freeRing || !onMySide(s)) continue;
          const d = Math.hypot(s.x - z.position.x, s.z - z.position.z);
          if (d < best) {
            best = d;
            key = k;
          }
        }
      }
      if (key === null) {
        z.slotKey = null;
        continue; // all slots taken: just follow the route with spacing
      }
      taken.add(key);
      const s = slots.get(key);
      z.slot = { x: s.x, z: s.z };
      z.slotKey = key;
    }
    for (const z of zombies) if (!z.slot) z.slotKey = null;
  }

  function removeActor(index) {
    const [zombie] = zombies.splice(index, 1);
    zombie.model.dispose();
    const target = shootables.indexOf(zombie);
    if (target !== -1) shootables.splice(target, 1);
  }

  return {
    zombies,
    nav,

    get aliveCount() {
      return zombies.reduce((n, z) => n + (z.isAlive ? 1 : 0), 0);
    },

    securitySweep(origin, tuning) {
      let count = 0;
      for (const z of zombies) if (z.staggerAway(origin, tuning)) count += 1;
      return count;
    },

    // Steer new spawns to these markers ({ zone, position }) while they are usable; null = back to normal. Only WHERE
    // changes: rounds still decides how many, so this adds no zombies. A failsafe rescue ignores it.
    steerSpawns(points, { dropHeight = 0, onDrop = null } = {}) {
      steered = points;
      chuteDrop = dropHeight;
      onChuteDrop = onDrop;
    },

    // A corpse flies into `mouth` (Build-A-Blaster's Stuffing Tank) instead of lying where it fell.
    playTankDeath(zombie, mouth) {
      if (partyDeaths.has(zombie) || zombie.killedBy === 'partyTrap') return;
      tankDeaths.start(zombie, mouth);
    },

    // Spawn one zombie of `typeId` at a good spawn point (or at `at`, a Vector3, if given).
    // Returns the zombie, or null if no spawn point is usable right now.
    // Options: `variant` = the Mascot costume to wear (otherwise picked here, see below); `nearest` = the safe spawn
    // point closest to the player instead of a random nearby one (debug).
    spawn(typeId = 'shopper', at = null, { variant = null, nearest = false } = {}) {
      const cap = economy.zombieMix[typeId]?.maxAlive;
      if (cap && zombies.filter(z => z.isAlive && z.type.id === typeId).length >= cap) typeId = 'shopper';
      let type = bossTypes[typeId] ?? zombieTypes[typeId];
      const chute = type.boss ? null : steered;
      const chutePoint = at || !chute ? null : pickSpawnPoint(type, null, chute, nearest);
      const point = at ? null : chutePoint || pickSpawnPoint(type, null, spawnPoints, nearest);
      if (!at && !point) return null;
      const position = at ? at.clone() : point.position.clone();
      position.y = point ? point.position.y : 0; // (a spawn marker stands on its own floor; an explicit spot goes on the ground)
      const yaw = Math.atan2(-(player.position.x - position.x), -(player.position.z - position.z));
      const round = getRound();
      // A Mascot's costume, now the spot is known: a costume's home zones make it likelier there (no bias out of the
      // Returns Chute or at an explicit spot). Every costume shares the Mascot's size, so the spot suits them all.
      if (type.mascot) type = mascotTypes[variant ?? pickMascotVariant(round, point && !chutePoint ? point.zone : null)];
      const speed = pickGaitSpeed(type, round);
      const zombie = new Zombie({ type, health: zombieHealthFor(typeId, round), position, yaw, speed, round });
      zombie.onDeath = onZombieDeath;
      zombie.onHeadPop = keepHelmet;
      zombie.stuckTimer = 0; // failsafe bookkeeping (see rescueStuckZombies)
      zombie.stuckFrom = { x: position.x, z: position.z };
      scene.add(zombie.model.root);
      zombies.push(zombie);
      shootables.push(zombie);
      if (point) lastSpawnAt.set(point, spawnClock);
      // Out of the Returns Chute: it falls out of the hatch rather than rising through the floor (no dust).
      if (point && chute?.includes(point)) {
        zombie.dropHeight = chuteDrop;
        zombie.updateHitboxes();
        onChuteDrop?.(zombie);
        return zombie;
      }
      // Floor-tile dust as it breaks through.
      scratch.copy(position);
      scratch.y += 0.05;
      effects.splat(scratch, UP, zombieCrowd.spawnDustColors, zombieCrowd.spawnDustCount);
      return zombie;
    },

    clearBosses() {
      partyDeaths.clear(zombie => zombie.type.boss); // ribbons can outlive the corpse
      for (let i = zombies.length - 1; i >= 0; i--) {
        if (!zombies[i].type.boss) continue;
        tankDeaths.remove(zombies[i]);
        removeActor(i);
      }
    },

    // Remove every zombie immediately (debug).
    playPartyTrapDeath: partyDeaths.start,

    clear() {
      partyDeaths.clear();
      tankDeaths.clear();
      for (let i = zombies.length - 1; i >= 0; i--) removeActor(i);
      lastSpawnAt.clear();
      spawnClock = 0;
      for (const { helmet } of helmets) helmet.dispose();
      helmets.length = 0;
    },

    // Fixed-tick update.
    update(dt) {
      spawnClock += dt;
      soundClock += dt;
      nav.update(dt, player.position);
      ctx.canAttack = canAttack();
      assignSurroundSlots(dt);
      for (const z of zombies) z.update(dt, ctx);
      partyDeaths.update(dt);
      tankDeaths.update(dt);
      updateHelmets(dt);
      resolveZombieOverlaps();
      keepPlayerOutOfZombies();
      rescueStuckZombies(dt);
      // The shoves above move zombies after they placed their hitboxes: move the hitboxes too,
      // or a shot at a shoved zombie's head could miss what you see.
      for (const z of zombies) if (z.isAlive) z.updateHitboxes();

      // Clean up corpses that have finished sinking.
      for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        if (!z.removed) continue;
        removeActor(i);
      }
    },

    // Every rendered frame: animate and interpolate the models.
    render(frameTime, alpha) {
      for (const z of zombies) if (!partyDeaths.has(z) && !tankDeaths.has(z)) z.model.update(frameTime, z, alpha);
      partyDeaths.render(alpha);
      tankDeaths.render(alpha);
    },
  };
}
