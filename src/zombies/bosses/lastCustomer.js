// Charge/telegraph/crash are the shared type.charge state machine in zombie.js, as for Kettle.
// Backup spends the existing wave quota, retries safe parking markers and obeys the usual alive cap.
export function createLastCustomerBehavior({ zombie, rounds, map, onPhase }) {
  const cfg = zombie.type.backup;
  const spawnPoints = map.spawnPoints.filter(({ zone }) => zone === cfg.zone);
  let threshold = 0, pending = 0;
  return {
    update() {
      if (zombie.state === 'spawning') return;
      while (threshold < cfg.thresholds.length && zombie.health <= zombie.maxHealth * cfg.thresholds[threshold]) {
        threshold += 1;
        pending += cfg.count;
        onPhase('backup');
      }
      while (pending > 0 && rounds.remainingToSpawn > 0) {
        if (!rounds.spawnBackup(cfg.type, { spawnPoints })) break;
        pending -= 1;
      }
    },
    dispose() { pending = 0; },
  };
}
