// Earned dynamic drops. No DOM/WebGL: the optional view only receives state.
import { powerUps as defaults } from '../config/powerUps.js';
import { bossVouchers } from '../config/bosses.js';
import { createFloorPickups } from './floorPickups.js';
import { createIncentiveEffects } from './incentiveEffects.js';

export function createPowerUps({ events, player, gun, zombies, colliders, state, stats, pricing, wallet, config = defaults, random = Math.random, view = null }) {
  let round = 0;
  let earned = 0;
  let threshold;
  let dropped = 0;
  let lastType = null;
  let lastWasJackpot = false;
  let pickup = null;
  let clock = 0;
  let lastKillAt = -Infinity;
  let pendingPosition = null;
  const bossRewards = []; // rewards outside the meter, waiting for clear floor: a boss's, an Employee of the Month's
  let seen = new WeakSet();
  let rotation = [];
  let jackpotRotation = [];
  const allIds = () => Object.keys(config.types);
  const commonIds = () => allIds().filter(id => config.types[id].tier !== 'jackpot');
  const jackpotIds = () => allIds().filter(id => config.types[id].tier === 'jackpot');
  const { findPosition, clearLine, reached } = createFloorPickups(colliders, config);
  const nextThreshold = () => config.threshold.min + random() * (config.threshold.max - config.threshold.min);
  threshold = nextThreshold();

  function weightedPick(pool) {
    if (!pool.length) return null;
    let pick = random() * pool.reduce((sum, id) => sum + config.types[id].weight, 0);
    for (const id of pool) {
      pick -= config.types[id].weight;
      if (pick <= 0) return id;
    }
    return pool.at(-1);
  }

  function useful(id) {
    if (!benefits.useful(id)) return false;
    if (id !== 'stockroomDelivery') return true;
    return gun.slots.some((slotId) => {
      const w = gun.weaponFor(slotId);
      const max = w.def.magazineSize + w.reserveCap;
      const canAdd = w.reserve < w.reserveCap || (w === gun.weapon && !w.isReloading && !w.isShellReload
        && w.magazine < Math.ceil(w.def.magazineSize * config.types.stockroomDelivery.magazineFraction));
      return canAdd && w.magazine + w.reserve < max * config.nearFullFraction;
    });
  }

  function nextInBag(bag, allOfTier, eligible) {
    // A weighted shuffled bag: finish eligible entries before replenishing it so
    // newly useful rewards join the next cycle rather than starving the others.
    if (!bag.some(id => eligible.includes(id) && id !== lastType)) {
      bag.length = 0;
      bag.push(...allOfTier);
    }
    const pool = bag.filter(id => eligible.includes(id) && id !== lastType);
    const id = weightedPick(pool);
    if (!id) return null;
    const idx = bag.indexOf(id);
    if (idx !== -1) bag.splice(idx, 1);
    return id;
  }

  function canRollJackpot() {
    const jp = config.jackpot;
    if (!jp || round < jp.firstRound || lastWasJackpot) return false;
    return jackpotIds().some(useful);
  }

  function chooseType() {
    const jackpots = canRollJackpot() ? jackpotIds().filter(useful) : [];
    if (jackpots.length && random() < config.jackpot.chance) {
      return nextInBag(jackpotRotation, jackpotIds(), jackpots);
    }
    const commons = commonIds().filter(useful);
    if (!commons.length) return null; // wait rather than repeat when no other common is useful
    return nextInBag(rotation, commonIds(), commons);
  }

  // A reward outside the meter (an Employee of the Month's): weighted choice respecting the
  // jackpot round gate and no-consecutive-jackpot rule, without disturbing the meter's bag.
  function chooseRewardType() {
    const queuedJackpot = bossRewards.some(r => config.types[r.id]?.tier === 'jackpot')
      || config.types[pickup?.id]?.tier === 'jackpot';
    const jackpots = !queuedJackpot && canRollJackpot() ? jackpotIds().filter(useful) : [];
    if (jackpots.length && random() < config.jackpot.chance) {
      return weightedPick(jackpots);
    }
    const commons = commonIds().filter(useful);
    const pool = commons.length ? commons : allIds().filter(useful);
    return weightedPick(pool);
  }

  const benefits = createIncentiveEffects({ events, player, gun, zombies, stats, pricing, wallet, state, config, clearLine, findPosition });

  function collect() {
    const item = pickup;
    const voucher = bossVouchers[item.id];
    const def = voucher ?? config.types[item.id];
    if (voucher && !pricing.setVoucher(voucher)) return; // keep the pickup while the previous voucher is held
    pickup = null; // remove first: listeners cannot collect the same reward twice
    if (item.id === 'stockroomDelivery') gun.restock(def.magazineFraction);
    else if (item.id === 'storeWideClearance') benefits.detonateClearance(item.position);
    else if (!voucher && !benefits.start(item.id, item.position, item.bossReward)) {
      events.emit('powerUpExpire', { id: item.id });
      return;
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
      benefits.reset('death');
      view?.update(null, 0);
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
    events.on('roundDiscard', ({ reason } = {}) => {
      // Stay for overtime discards the wave, not what a boss already paid out: its uncollected reward stays on the floor
      // (and one still waiting for clear floor stays queued). It is picked up, or it expires and a voucher pays its
      // pointsInstead, as always. A debug skip deletes it and pays nothing, as before.
      if (reason !== 'overtime') {
        bossRewards.length = 0;
        if (pickup?.bossReward) pickup = null;
      }
      benefits.clearBossRewards();
      view?.update(pickup, 0, benefits.active);
    }),
  ];

  const api = {
    get pickup() { return pickup; },
    get effects() { return benefits.active; },
    get progress() { return Math.min(1, earned / threshold); },
    get dropsThisRound() { return dropped; },
    get round() { return round; },
    get available() { return round >= config.firstRound && dropped < config.maxPerRound; },
    get lastWasJackpot() { return lastWasJackpot; },

    cleanSpill(position) {
      if (benefits.cleanSpill(position)) view?.update(pickup, 0, benefits.active);
    },

    stripEffectModifiers(targetStats) {
      return benefits.stripModifiers(targetStats);
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

    update(dt) {
      if (state.over) return;
      clock += dt;
      benefits.update(dt);
      if (!pickup && bossRewards.length) {
        const reward = bossRewards[0];
        const position = findPosition(reward.position) ?? findPosition(player.position);
        if (position) {
          bossRewards.shift();
          pickup = { id: reward.id, position, remaining: config.lifetime, age: 0, bossReward: true };
          lastWasJackpot = config.types[reward.id]?.tier === 'jackpot';
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
          lastWasJackpot = config.types[id]?.tier === 'jackpot';
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
        } else if (reached(player, pickup.position)) {
          collect();
        }
      }
      view?.update(pickup, dt, benefits.active);
    },

    // Save & Quit (game/saveGame.js): the drop meter and its rotation. Anything on the floor or running at the round's start is
    // not kept (a save restarts the round's break with no power-up out).
    serialize() {
      return {
        round, earned, threshold, dropped, lastType, lastWasJackpot,
        rotation: [...rotation], jackpotRotation: [...jackpotRotation],
      };
    },
    restore(data) {
      ({ round, earned, threshold, dropped, lastType } = data);
      lastWasJackpot = Boolean(data.lastWasJackpot);
      rotation = [...(data.rotation ?? [])];
      jackpotRotation = [...(data.jackpotRotation ?? [])];
    },

    reset() {
      benefits.reset();
      round = 0;
      earned = 0;
      threshold = nextThreshold();
      dropped = 0;
      lastType = null;
      lastWasJackpot = false;
      rotation = [];
      jackpotRotation = [];
      lastKillAt = -Infinity;
      clock = 0;
      pickup = null;
      pendingPosition = null;
      bossRewards.length = 0;
      seen = new WeakSet();
      view?.update(null, 0);
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
