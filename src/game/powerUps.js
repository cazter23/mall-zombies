// Earned dynamic drops. No DOM/WebGL: the optional view only receives state.
import * as THREE from 'three';
import { powerUps as defaults } from '../config/powerUps.js';
import { bossVouchers } from '../config/bosses.js';
import { overlapsSolid, rampHeightAt } from '../world/collision.js';
import { createIncentiveEffects } from './incentiveEffects.js';

export function createPowerUps({ events, player, gun, zombies, colliders, state, stats, pricing, wallet, config = defaults, random = Math.random, view = null }) {
  let round = 0;
  let earned = 0;
  let threshold;
  let dropped = 0;
  let lastType = null;
  let pickup = null;
  let active = null;
  let clock = 0;
  let lastKillAt = -Infinity;
  let pendingPosition = null;
  const bossRewards = []; // rewards outside the meter, waiting for clear floor: a boss's, an Employee of the Month's
  let seen = new WeakSet();
  let rotation = [];
  const ray = new THREE.Ray();
  const intersection = new THREE.Vector3();
  const probe = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const nextThreshold = () => config.threshold.min + random() * (config.threshold.max - config.threshold.min);
  threshold = nextThreshold();

  // A floor close to the corpse's feet; never silently drop to the storey underneath.
  function floorAt(x, z, nearY) {
    let best = null;
    for (const box of colliders) {
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
      if (Math.abs(box.max.y - nearY) <= config.floorTolerance && (best === null || box.max.y > best)) best = box.max.y;
    }
    for (const ramp of colliders.ramps ?? []) {
      const y = rampHeightAt(ramp, x, z);
      if (y !== null && Math.abs(y - nearY) <= config.floorTolerance && (best === null || y > best)) best = y;
    }
    return best;
  }

  function clearLine(a, b) {
    ray.origin.copy(a).y += config.sightHeight;
    to.copy(b).y += config.sightHeight;
    ray.direction.subVectors(to, ray.origin);
    const distance = ray.direction.length();
    if (distance < 1e-6) return true;
    ray.direction.divideScalar(distance);
    return !colliders.some((box) => ray.intersectBox(box, intersection) && intersection.distanceTo(ray.origin) < distance);
  }

  function findPosition(at) {
    for (const radius of config.placementRadii) {
      for (let i = 0; i < (radius === 0 ? 1 : config.placementDirections); i++) {
        const angle = i * Math.PI * 2 / config.placementDirections;
        probe.set(at.x + Math.cos(angle) * radius, at.y, at.z + Math.sin(angle) * radius);
        const y = floorAt(probe.x, probe.z, at.y);
        if (y === null) continue;
        probe.y = y;
        if (overlapsSolid(probe, config.clearRadius, config.clearHeight, colliders, 0)) continue;
        if (!clearLine(at, probe)) continue;
        return probe.clone();
      }
    }
    return null;
  }

  function useful(id) {
    if (!benefits.useful(id)) return false;
    if (id === 'blueLightSpecial' && active) return false;
    if (id !== 'stockroomDelivery') return true;
    return gun.slots.some((id) => {
      const w = gun.weaponFor(id);
      const max = w.def.magazineSize + w.reserveCap;
      const canAdd = w.reserve < w.reserveCap || (w === gun.weapon && !w.isReloading && !w.isShellReload
        && w.magazine < Math.ceil(w.def.magazineSize * config.types.stockroomDelivery.magazineFraction));
      return canAdd && w.magazine + w.reserve < max * config.nearFullFraction;
    });
  }

  function chooseType() {
    const eligible = Object.keys(config.types).filter(useful);
    // A weighted shuffled bag: finish eligible entries before replenishing it.
    // Newly useful rewards join the next cycle rather than starving the others.
    if (!rotation.some(id => eligible.includes(id) && id !== lastType)) {
      rotation = Object.keys(config.types);
    }
    const pool = rotation.filter(id => eligible.includes(id) && id !== lastType);
    if (!pool.length) return null; // wait rather than repeat when no other type is useful
    let pick = random() * pool.reduce((sum, id) => sum + config.types[id].weight, 0);
    for (const id of pool) {
      pick -= config.types[id].weight;
      if (pick <= 0) { rotation = rotation.filter(entry => entry !== id); return id; }
    }
    const id = pool.at(-1);
    rotation = rotation.filter(entry => entry !== id);
    return id;
  }

  // A reward outside the meter (an Employee of the Month's): any useful type by weight, without touching the meter's
  // rotation or its "not the same twice" rule.
  function chooseRewardType() {
    const pool = Object.keys(config.types).filter(useful);
    if (!pool.length) return null;
    let pick = random() * pool.reduce((sum, id) => sum + config.types[id].weight, 0);
    for (const id of pool) {
      pick -= config.types[id].weight;
      if (pick <= 0) return id;
    }
    return pool.at(-1);
  }

  const benefits = createIncentiveEffects({ events, player, gun, zombies, stats, pricing, wallet, state, config, clearLine, findPosition });

  function endZone(reason) {
    if (!active) return;
    const id = active.id;
    active = null;
    events.emit('powerUpEnd', { id, reason });
  }

  function collect() {
    const item = pickup;
    const voucher = bossVouchers[item.id];
    const def = voucher ?? config.types[item.id];
    if (voucher && !pricing.setVoucher(voucher)) return; // keep the pickup while the previous voucher is held
    pickup = null; // remove first: listeners cannot collect the same reward twice
    if (item.id === 'stockroomDelivery') gun.restock(def.magazineFraction);
    if (item.id === 'securitySweep') zombies.securitySweep(player.position, def);
    if (item.id === 'blueLightSpecial') {
      active = { id: item.id, position: item.position.clone(), remaining: def.seconds, radius: def.radius };
      events.emit('powerUpStart', { ...active, position: active.position.clone() });
    }
    if (!voucher && !['stockroomDelivery', 'securitySweep', 'blueLightSpecial'].includes(item.id)) {
      if (!benefits.start(item.id, item.position, item.bossReward)) {
        events.emit('powerUpExpire', { id: item.id });
        return;
      }
    }
    events.emit('powerUpCollect', { id: item.id, name: def.name, pa: def.pa, sound: def.sound });
  }

  const off = [
    events.on('roundStart', (event) => { round = event.round; dropped = 0; }),
    events.on('kill', ({ zombie, headshot, melee, source }) => {
      if (state.over || round < config.firstRound || dropped >= config.maxPerRound || pickup || pendingPosition) return;
      if ((source !== 'gun' && source !== 'melee') || !zombie?.type || zombie.noRewards || zombie.type.boss || seen.has(zombie)) return;
      seen.add(zombie);
      earned += melee ? config.credit.melee : headshot ? config.credit.headshot : config.credit.kill;
      if (clock - lastKillAt <= config.credit.multiKillSeconds) earned += config.credit.multiKillBonus;
      lastKillAt = clock;
      if (earned >= threshold) pendingPosition = zombie.position.clone();
    }),
    events.on('playerDeath', () => {
      pickup = null;
      pendingPosition = null;
      bossRewards.length = 0;
      endZone('death');
      benefits.reset('death');
      view?.update(null, null, 0);
    }),
    events.on('bossDefeated', ({ zombie }) => {
      if (zombie.type.reward) bossRewards.push({ id: zombie.type.reward, position: zombie.position.clone() });
    }),
    // A zombie whose type promises a drop (zombie.type.guaranteedDrop: the Employee of the Month) leaves one at its body,
    // whatever killed it, through the same queue as a boss's reward: it never counts against maxPerRound or the meter.
    events.on('kill', ({ zombie }) => {
      if (state.over || !zombie?.type?.guaranteedDrop || zombie.noRewards) return;
      const id = chooseRewardType();
      if (id) bossRewards.push({ id, position: zombie.position.clone() });
    }),
    events.on('roundDiscard', () => {
      bossRewards.length = 0;
      if (pickup?.bossReward) pickup = null;
      benefits.clearBossRewards();
      view?.update(pickup, active, 0, benefits.active);
    }),
  ];

  const api = {
    get pickup() { return pickup; },
    get active() { return active; },
    get effects() { return benefits.active; },
    get progress() { return Math.min(1, earned / threshold); },
    get dropsThisRound() { return dropped; },
    get round() { return round; },
    get available() { return round >= config.firstRound && dropped < config.maxPerRound; },

    cleanSpill(position) {
      if (benefits.cleanSpill(position)) view?.update(pickup, active, 0, benefits.active);
    },

    // Explicit testing hook; cannot silently create a career-record-eligible run.
    debugDrop(id, at = player.position) {
      if (!Object.hasOwn(config.types, id)) throw new Error(`Unknown incentive: ${id}`);
      if (state.over) return false;
      const position = findPosition(at);
      if (!position) return false;
      state.assisted = true;
      pickup = { id, position, remaining: config.lifetime, age: 0 };
      pendingPosition = null;
      return true;
    },

    // Blue Light Special boosts just the base kill value, never hit/head/melee bonuses.
    killMultiplier(position) {
      if (!active || state.over || Math.abs(position.y - active.position.y) > config.floorTolerance) return 1;
      if (Math.hypot(position.x - active.position.x, position.z - active.position.z) > active.radius) return 1;
      return clearLine(active.position, position) ? config.types.blueLightSpecial.killMultiplier : 1;
    },

    update(dt) {
      if (state.over) return;
      clock += dt;
      benefits.update(dt);
      if (active) {
        active.remaining -= dt;
        if (active.remaining <= 0) endZone('expired');
      }
      if (!pickup && bossRewards.length) {
        const reward = bossRewards[0];
        const position = findPosition(reward.position) ?? findPosition(player.position);
        if (position) {
          bossRewards.shift();
          pickup = { id: reward.id, position, remaining: config.lifetime, age: 0, bossReward: true };
          events.emit('powerUpDrop', { id: reward.id, position: position.clone(), seconds: config.lifetime });
        }
      }
      if (pendingPosition && !pickup && !bossRewards.length) {
        const position = findPosition(pendingPosition);
        const id = chooseType();
        pendingPosition = null;
        if (position && id) {
          pickup = { id, position, remaining: config.lifetime, age: 0 };
          earned = 0;
          threshold = nextThreshold();
          dropped += 1;
          lastType = id;
          events.emit('powerUpDrop', { id, position: position.clone(), seconds: config.lifetime });
        }
      }
      if (pickup) {
        pickup.remaining -= dt;
        pickup.age += dt;
        if (pickup.remaining <= 0) {
          const id = pickup.id;
          pickup = null;
          // A boss voucher left on the floor because you were still holding another one: it pays its points instead of vanishing.
          const voucher = bossVouchers[id];
          if (voucher && !state.over) wallet.earn(voucher.pointsInstead);
          events.emit('powerUpExpire', { id, pointsInstead: voucher?.pointsInstead ?? 0 });
        } else {
          // Swept collection: a fast slide must not jump over a small pickup between ticks.
          const a = player.prevPosition ?? player.position;
          const b = player.position;
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const lengthSq = dx * dx + dz * dz;
          const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((pickup.position.x - a.x) * dx + (pickup.position.z - a.z) * dz) / lengthSq)) : 1;
          from.lerpVectors(a, b, t);
          if (Math.abs(from.y - pickup.position.y) <= config.floorTolerance
              && Math.hypot(from.x - pickup.position.x, from.z - pickup.position.z) <= config.pickupRadius
              && clearLine(from, pickup.position)) collect();
        }
      }
      view?.update(pickup, active, dt, benefits.active);
    },

    reset() {
      benefits.reset();
      endZone('reset');
      round = 0;
      earned = 0;
      threshold = nextThreshold();
      dropped = 0;
      lastType = null;
      rotation = [];
      lastKillAt = -Infinity;
      clock = 0;
      pickup = null;
      pendingPosition = null;
      bossRewards.length = 0;
      seen = new WeakSet();
      view?.update(null, null, 0);
    },

    dispose() {
      api.reset();
      off.forEach((unsubscribe) => unsubscribe());
      benefits.dispose();
      view?.dispose();
    },
  };
  return api;
}
