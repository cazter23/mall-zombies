// Temporary employee benefits. Damage is deferred until update: secondary kills
// cannot recursively detonate or invalidate the shot currently being resolved.
import * as THREE from 'three';
import { PRICE_CATEGORIES } from './pricing.js';

export function createIncentiveEffects({ events, player, gun, zombies, stats, pricing, wallet, state, config, clearLine, findPosition }) {
  const effects = new Map();
  let bursts = [];
  const direct = source => source === 'gun' || source === 'melee';
  const living = () => (zombies.zombies ?? []).filter(z => z.isAlive && z.state !== 'spawning');
  const near = (a, b, radius) => Math.abs(a.y - b.y) <= config.floorTolerance
    && Math.hypot(a.x - b.x, a.z - b.z) <= radius && clearLine(a, b);
  const candidates = (radius) => living().filter(z => near(player.position, z.position, radius))
    .sort((a, b) => a.position.distanceToSquared(player.position) - b.position.distanceToSquared(player.position));

  function end(id, reason = 'expired') {
    const effect = effects.get(id);
    if (!effect) return;
    effects.delete(id);
    for (const [key, factor] of Object.entries(effect.modifiers ?? {})) stats[key] /= factor;
    if (id === 'employeeDiscount') pricing?.clearCoupon();
    events.emit('powerUpEnd', { id, reason });
  }

  function useful(id) {
    if (effects.has(id)) return false;
    if (id === 'paidBreak') return !!stats && stats.health < stats.maxHealth;
    if (id === 'mysteryShopper') return candidates(config.types[id].targetRadius).length > 0;
    if (id === 'productRecall') return candidates(config.types[id].targetRadius).length >= 2;
    return true;
  }

  function start(id, position) {
    const def = config.types[id];
    end(id, 'replaced');
    const effect = { id, position: position.clone(), remaining: def.seconds, elapsed: 0, charges: def.charges, radius: def.radius };
    if (id === 'expressCheckout') effect.modifiers = { reloadSpeed: def.reloadMultiplier, switchSpeed: def.switchMultiplier };
    if (id === 'overtimeApproved') effect.modifiers = { walkSpeed: def.speedMultiplier, sprintSpeed: def.speedMultiplier };
    if (id === 'lossPrevention') effect.modifiers = { meleeDamageMultiplier: def.damageMultiplier };
    if (id === 'paidBreak') effect.healing = def.healing;
    if (id === 'employeeDiscount') pricing?.setCoupon({ fraction: def.fraction, maxSaving: def.maxSaving });
    if (id === 'mysteryShopper' || id === 'productRecall') {
      effect.targets = candidates(def.targetRadius).slice(0, def.targets ?? 1);
      if (effect.targets.length < (id === 'productRecall' ? 2 : 1)) return false;
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

  const off = [
    events.on('kill', ({ zombie, source }) => {
      if (state.over) return;
      const mystery = effects.get('mysteryShopper');
      if (mystery?.targets.includes(zombie)) {
        if (direct(source)) {
          wallet?.earn(config.types.mysteryShopper.points);
          for (const id of gun.slots) {
            const weapon = gun.weaponFor(id);
            weapon.reserve = Math.min(weapon.def.startingReserve,
              weapon.reserve + Math.ceil(weapon.def.startingReserve * config.types.mysteryShopper.ammoFraction));
          }
          events.emit('incentiveComplete', { id: mystery.id, text: `Mystery Shopper complete · +${config.types.mysteryShopper.points} & ammo` });
        }
        end(mystery.id, direct(source) ? 'completed' : 'targetLost');
      }
      const recall = effects.get('productRecall');
      if (recall?.targets.includes(zombie)) {
        recall.targets = recall.targets.filter(z => z !== zombie && z.isAlive);
        stagger(zombie.position, config.types.productRecall, recall.targets);
        if (!recall.targets.length) end(recall.id, 'completed');
      }
      if (!direct(source)) return;
      const overtime = effects.get('overtimeApproved');
      if (overtime) {
        const def = config.types.overtimeApproved;
        overtime.remaining = Math.min(def.maxSeconds - overtime.elapsed, overtime.remaining + def.killExtension);
      }
      const liquidation = effects.get('inventoryLiquidation');
      if (liquidation) {
        bursts.push(zombie.position.clone());
        if (--liquidation.charges === 0) end(liquidation.id, 'spent');
      }
    }),
    events.on('hit', ({ target, melee }) => {
      if (state.over || !melee || !target?.type) return;
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
    useful, start,
    update(dt) {
      for (const effect of [...effects.values()]) {
        const def = config.types[effect.id];
        const step = Math.min(dt, effect.remaining);
        effect.remaining -= dt;
        effect.elapsed += step;
        if (effect.id === 'paidBreak' && near(effect.position, player.position, def.radius)) {
          const heal = Math.min(effect.healing, def.healPerSecond * step, stats.maxHealth - stats.health);
          stats.health += heal;
          effect.healing -= heal;
          if (effect.healing <= 0) { end(effect.id, 'spent'); continue; }
        }
        if (effect.id === 'spillCleanup') {
          for (const z of living()) if (near(effect.position, z.position, def.radius)) z.applySlow(def.slowSeconds, def.slowFraction);
        }
        if (effect.id === 'staffEntrance') {
          effect.pulse = Math.max(0, (effect.pulse ?? 0) - dt);
          if (player.isSprinting && effect.pulse === 0) {
            stagger(player.position, def);
            effect.pulse = def.pulseSeconds;
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
