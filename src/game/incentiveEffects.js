// Temporary employee benefits and detonated clearance effects. Damage is deferred until
// update where secondary kills could otherwise invalidate the shot currently being resolved.
import * as THREE from 'three';
import { INSTANT_KILL_DAMAGE } from '../weapons/gunStats.js';
import { PRICE_CATEGORIES } from './pricing.js';
import { zombieCountForRound } from '../config/economy.js';

/** Store-Wide Clearance's one flat credit in `round`: bonus.perRoundZombie x that round's wave size, rounded to bonus.roundTo. */
export function clearanceBonus(round, def) {
  const { perRoundZombie, roundTo } = def.bonus;
  return Math.round(perRoundZombie * zombieCountForRound(Math.max(1, round)) / roundTo) * roundTo;
}

// `areaAt(point)`: the map's area id for a point (map.areaAt), or null without one (Clearance then uses its radius).
// `getRound()`: the round now (Clearance's bonus grows with it).
export function createIncentiveEffects({ events, player, gun, zombies, stats, pricing, wallet, state, config, clearLine, findPosition,
  areaAt = null, getRound = () => 1 }) {
  const effects = new Map();
  let bursts = [];
  const direct = source => source === 'gun' || source === 'melee';
  const living = () => (zombies.zombies ?? []).filter(z => z.isAlive && z.state !== 'spawning' && !z.removed);
  const onFloorInRadius = (a, b, radius) => Math.abs(a.y - b.y) <= config.floorTolerance
    && Math.hypot(a.x - b.x, a.z - b.z) <= radius;
  const near = (a, b, radius) => onFloorInRadius(a, b, radius) && clearLine(a, b);
  const candidates = (radius) => living().filter(z => !z.type.boss && !z.noRewards && near(player.position, z.position, radius))
    .sort((a, b) => a.position.distanceToSquared(player.position) - b.position.distanceToSquared(player.position));

  function end(id, reason = 'expired') {
    const effect = effects.get(id);
    if (!effect) return;
    effects.delete(id);
    for (const [key, factor] of Object.entries(effect.modifiers ?? {})) stats[key] /= factor;
    if (id === 'blackFriday') stats.instantKill = false;
    if (id === 'employeeDiscount') pricing?.clearCoupon();
    events.emit('powerUpEnd', { id, reason });
  }

  function useful(id) {
    if (effects.has(id)) return false;
    if (id === 'paidBreak') return !!stats && stats.health < stats.maxHealth;
    if (id === 'mysteryShopper') return candidates(config.types[id].targetRadius).length > 0;
    return true;
  }

  function start(id, position, bossReward = false) {
    const def = config.types[id];
    end(id, 'replaced');
    const effect = { id, position: position.clone(), remaining: def.seconds, elapsed: 0, charges: def.charges, radius: def.radius, bossReward };
    if (id === 'shiftBonus') {
      effect.modifiers = {
        reloadSpeed: def.reloadMultiplier,
        switchSpeed: def.switchMultiplier,
        walkSpeed: def.speedMultiplier,
        sprintSpeed: def.speedMultiplier,
      };
    }
    if (id === 'lossPrevention') effect.modifiers = { meleeDamageMultiplier: def.damageMultiplier };
    if (id === 'paidBreak') effect.healing = def.healing;
    if (id === 'commissionDay') effect.modifiers = { pointsMultiplier: def.pointsMultiplier };
    if (id === 'blackFriday') {
      effect.modifiers = { bossDamageMultiplier: def.bossDamageMultiplier };
      stats.instantKill = true;
    }
    if (id === 'employeeDiscount') pricing?.setCoupon({ fraction: def.fraction, maxSaving: def.maxSaving });
    if (id === 'mysteryShopper') {
      effect.targets = candidates(def.targetRadius).slice(0, def.targets ?? 1);
      if (!effect.targets.length) return false;
    }
    if (id === 'spillCleanup') {
      const behind = player.position.clone();
      behind.x += Math.sin(player.yaw ?? 0) * def.behindMeters;
      behind.z += Math.cos(player.yaw ?? 0) * def.behindMeters;
      // Refuse to project through a wall; the pickup's safe floor is the fallback.
      const at = clearLine(player.position, behind) ? findPosition(behind) : null;
      effect.position.copy(at && clearLine(player.position, at) ? at : position);
    }
    for (const [key, factor] of Object.entries(effect.modifiers ?? {})) stats[key] *= factor;
    effects.set(id, effect);
    events.emit('powerUpStart', { ...effect, position: effect.position.clone() });
    return true;
  }

  function stagger(origin, def, targets = living()) {
    for (const z of targets) if (z.isAlive && near(origin, z.position, def.radius ?? Infinity)) z.staggerAway(origin, def.stagger);
  }

  // Kills non-boss zombies in the pickup's area, on its floor (no area: within radius), using source `'clearance'` (no
  // per-kill payout), deals capped non-lethal damage to bosses there, and pays the single flat clearance bonus once.
  function detonateClearance(origin) {
    const def = config.types.storeWideClearance;
    const area = areaAt?.(origin) ?? null;
    const inScope = area
      ? (p) => Math.abs(p.y - origin.y) <= config.floorTolerance && areaAt(p) === area
      : (p) => onFloorInRadius(origin, p, def.radius);
    const bonus = clearanceBonus(getRound(), def);
    const killedPositions = [];
    let bossesHit = 0;
    for (const z of [...living()]) {
      if (!inScope(z.position)) continue;
      if (z.type?.boss) {
        const crashScale = z.state === 'crashed' ? (z.type.charge?.crashDamageTakenMultiplier ?? 1) : 1;
        const scale = (z.damageTakenMultiplier ?? 1) * (z.vulnerableTimer > 0 ? (z.vulnerableMultiplier ?? 1) : 1) * crashScale;
        const floor = Math.max(1, (z.type.damageFloor ?? 0) + 1);
        const maxAllowed = Math.max(0, (z.health - floor) / Math.max(1, scale));
        const deal = Math.min(maxAllowed, (z.maxHealth * def.bossDamageFraction) / Math.max(1, scale));
        if (deal > 0) {
          z.takeHit({ damage: deal, part: 'body', source: 'clearance' });
          bossesHit += 1;
        }
      } else {
        const pos = z.position.clone();
        const result = z.takeHit({ damage: INSTANT_KILL_DAMAGE, part: 'body', source: 'clearance' });
        if (result?.killed) killedPositions.push(pos);
      }
    }
    wallet?.award(bonus);
    events.emit('clearanceDetonated', {
      position: origin.clone(),
      area,
      radius: area ? null : def.radius,
      kills: killedPositions.length,
      bossesHit,
      positions: killedPositions,
      flatBonus: bonus,
    });
  }

  const off = [
    events.on('kill', ({ zombie, source }) => {
      if (state.over || zombie.noRewards) return;
      const mystery = effects.get('mysteryShopper');
      if (mystery?.targets.includes(zombie)) {
        if (direct(source)) {
          wallet?.award(config.types.mysteryShopper.points);
          for (const id of gun.slots) {
            const weapon = gun.weaponFor(id);
            // Keep any rounds already held above the current cap.
            weapon.reserve = Math.max(weapon.reserve, Math.min(weapon.reserveCap,
              weapon.reserve + Math.ceil(weapon.reserveCap * config.types.mysteryShopper.ammoFraction)));
          }
          events.emit('incentiveComplete', { id: mystery.id, text: `Mystery Shopper complete · +${config.types.mysteryShopper.points} & ammo` });
        }
        end(mystery.id, direct(source) ? 'completed' : 'targetLost');
      }
      if (!direct(source)) return;
      const shift = effects.get('shiftBonus');
      if (shift) {
        const def = config.types.shiftBonus;
        shift.remaining = Math.min(def.maxSeconds - shift.elapsed, shift.remaining + def.killExtension);
      }
      const liquidation = effects.get('inventoryLiquidation');
      if (liquidation) {
        bursts.push(zombie.position.clone());
        if (--liquidation.charges === 0) end(liquidation.id, 'spent');
      }
    }),
    events.on('hit', ({ target, melee }) => {
      if (state.over || !melee || !target?.type || target.noRewards) return;
      const loss = effects.get('lossPrevention');
      if (!loss) return;
      stagger(target.position, config.types.lossPrevention);
      if (--loss.charges === 0) end(loss.id, 'spent');
    }),
    events.on('purchase', ({ kind, cost }) => {
      if (!state.over && cost > 0 && PRICE_CATEGORIES.includes(kind)) end('employeeDiscount', 'spent');
    }),
  ];

  return {
    get active() { return [...effects.values()]; },
    useful, start, detonateClearance,
    stripModifiers(targetStats) {
      for (const effect of effects.values()) {
        for (const [key, factor] of Object.entries(effect.modifiers ?? {})) targetStats[key] /= factor;
        if (effect.id === 'blackFriday') targetStats.instantKill = false;
      }
      return targetStats;
    },
    cleanSpill(position) {
      const spill = effects.get('spillCleanup');
      if (!spill || !near(position, spill.position, spill.radius)) return false;
      end(spill.id, 'mopped');
      return true;
    },
    clearBossRewards() {
      for (const effect of effects.values()) if (effect.bossReward) end(effect.id, 'roundDiscard');
    },
    update(dt) {
      let quiet = null; // (worked out once, only if a holdWhileQuiet benefit is running)
      for (const effect of [...effects.values()]) {
        const def = config.types[effect.id];
        // A jackpot's clock waits while no zombie is up to fight (between waves, the round break, all spawns still rising).
        if (def.holdWhileQuiet) {
          quiet ??= living().length === 0;
          effect.held = quiet;
          if (quiet) continue;
        }
        const step = Math.min(dt, effect.remaining);
        effect.remaining -= dt;
        effect.elapsed += step;
        if (effect.id === 'paidBreak' && near(effect.position, player.position, def.radius)) {
          const heal = Math.max(0, Math.min(effect.healing, def.healPerSecond * step, stats.maxHealth - stats.health));
          stats.health += heal;
          effect.healing -= heal;
          if (effect.healing <= 0) { end(effect.id, 'spent'); continue; }
        }
        if (effect.id === 'spillCleanup') {
          for (const z of living()) if (near(effect.position, z.position, def.radius)) z.applySlow(def.slowSeconds, def.slowFraction);
        }
        if (effect.id === 'lossPrevention') {
          effect.pulse = Math.max(0, (effect.pulse ?? 0) - dt);
          if (player.isSprinting && effect.pulse === 0) {
            stagger(player.position, { radius: def.shoveRadius, stagger: def.shoveStagger });
            effect.pulse = def.shovePulseSeconds;
          }
        }
        if (effect.targets) {
          effect.targets = effect.targets.filter(z => z.isAlive && !z.removed);
          if (!effect.targets.length) { end(effect.id, 'targetLost'); continue; }
        }
        if (effect.remaining <= 0) end(effect.id);
      }
      const pending = bursts;
      bursts = [];
      const def = config.types.inventoryLiquidation;
      for (const position of pending) {
        events.emit('incentiveBurst', { position, radius: def.radius, color: def.color });
        for (const z of living()) if (near(position, z.position, def.radius)) {
          z.takeHit({ damage: def.damage, part: 'body', source: 'incentive' });
        }
      }
    },
    reset(reason = 'reset') {
      for (const id of [...effects.keys()]) end(id, reason);
      bursts = [];
    },
    dispose() { this.reset(); off.forEach(fn => fn()); },
  };
}
