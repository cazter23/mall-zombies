import { returnToSender } from '../../weapons/returnToSender.js';

// Charge/crash reuse zombie.js; the only new state is the timed, returnable Speechless window.
export function createLastCustomerBehavior({ zombie, rounds, map, onPhase, interactions, effects, sound, state }) {
  const cfg = zombie.type.backup;
  const spawnPoints = map.spawnPoints.filter(({ zone }) => zone === cfg.zone);
  const hand = zombie.type.handReturn;
  const point = zombie.position.clone();
  let threshold = 0, pending = 0, left = 0;
  zombie.control = (dt, ctx) => {
    if (zombie.state !== 'speechless') return false;
    zombie.standStill(dt, ctx);
    return true;
  };
  const prompt = interactions.add({
    id: 'handReturn', label: hand.label, verb: hand.verb, priceLabel: hand.priceLabel,
    cost: 0, quiet: true, priority: hand.priority, holdSeconds: hand.holdSeconds,
    get position() { return point.copy(zombie.position).setY(zombie.position.y + hand.height); },
    available: () => !state.over && zombie.isAlive && zombie.state === 'speechless',
    use: () => returnToSender(zombie, { effects, sound, point: point.copy(zombie.position).setY(zombie.position.y + hand.height) }),
  });
  return {
    update(dt) {
      if (zombie.state === 'spawning' && zombie.health > zombie.type.damageFloor) return;
      if (zombie.state === 'speechless') {
        left = Math.max(0, left - dt);
        if (left === 0) {
          zombie.health = zombie.maxHealth * zombie.type.recoverHealthFraction;
          zombie.controlled = false;
          zombie.setState('chasing');
        }
      } else {
        while (threshold < cfg.thresholds.length && zombie.health <= zombie.maxHealth * cfg.thresholds[threshold]) {
          threshold += 1;
          pending += cfg.count;
          onPhase('backup');
        }
        if (zombie.health <= zombie.type.damageFloor) {
          zombie.setState('speechless');
          zombie.controlled = true;
          zombie.chargeLeft = 0;
          zombie.velocity.set(0, 0, 0);
          left = zombie.type.speechlessSeconds;
          onPhase('speechless');
        }
      }
      while (pending > 0 && rounds.remainingToSpawn > 0) {
        if (!rounds.spawnBackup(cfg.type, { spawnPoints })) break;
        pending -= 1;
      }
    },
    dispose() {
      pending = left = 0;
      zombie.control = null;
      zombie.controlled = false;
      interactions.remove(prompt);
    },
  };
}
