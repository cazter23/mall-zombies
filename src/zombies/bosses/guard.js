import { feel } from '../../config/feel.js';

export function createGuardBehavior({ zombie, zombies, rounds, map, player, onPhase }) {
  const cfg = zombie.type.lockdown;
  let threshold = 0, phase = 'chasing', left = 0, headshots = 0, broken = false, backup = 0, slow = 0;
  let shutters = [];
  const closed = new Set();
  function release(announce = false) {
    for (const barrier of closed) barrier.open();
    closed.clear(); shutters = []; backup = 0; phase = 'chasing';
    if (announce) onPhase('released');
  }
  function occupied(box) {
    return [player, ...zombies.zombies.filter(z => z.isAlive)].some(body => {
      const r = body.type?.radius ?? feel.player.radius;
      const h = body.type?.height ?? body.height;
      const p = body.position;
      return p.x + r > box.min.x && p.x - r < box.max.x && p.z + r > box.min.z && p.z - r < box.max.z
        && p.y < box.max.y && p.y + h > box.min.y;
    });
  }
  return {
    get surfaceSpeed() { return slow > 0 ? zombie.type.taserSlow.speed : 1; },
    onPlayerHit() { if (zombie.state === 'charging') slow = zombie.type.taserSlow.seconds; },
    onHit({ headshot, melee }) {
      if (!headshot || melee || broken || !['alarm', 'lockdown'].includes(phase)) return;
      if (++headshots < cfg.headshots) return;
      broken = true; release(); onPhase('radioBroken');
    },
    update(dt) {
      slow = Math.max(0, slow - dt);
      if (zombie.state === 'spawning') return;
      if (phase === 'chasing') {
        if (!broken && threshold < cfg.thresholds.length && zombie.health <= zombie.maxHealth * cfg.thresholds[threshold]) {
          threshold += 1; phase = 'alarm'; left = cfg.alarmSeconds;
          onPhase('alarm');
        }
        return;
      }
      left -= dt;
      if (phase === 'alarm') {
        if (left > 1e-9) return;
        // Resolve the player's CURRENT area after the warning, so crossing the
        // boundary during the alarm cannot close a different room around them.
        shutters = map.barriersAround(player.position).filter(d => d.isOpen).map(d => d.barrier);
        phase = 'lockdown'; left = cfg.seconds; backup = cfg.backup;
        onPhase('lockdown');
      }
      if (left <= 1e-9) { release(true); return; }
      for (const barrier of shutters) {
        if (closed.has(barrier) || occupied(barrier.collider)) continue;
        barrier.close(); closed.add(barrier);
      }
      while (backup > 0 && rounds.remainingToSpawn > 0) {
        if (!rounds.spawnBackup(cfg.backupType)) break;
        backup -= 1;
      }
    },
    dispose() { release(); slow = 0; },
  };
}
