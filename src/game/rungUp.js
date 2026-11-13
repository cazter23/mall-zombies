// =============================================================================
// RUNG UP: the Barcode Scanner's mark (config/weapons.js barcodeScanner.rungUp).
// Every zombie its beam hits and doesn't kill is RUNG UP for rungUp.seconds: it takes rungUp.damageTaken x damage from
// everything (zombie.takeHit) and a kill while it is marked pays rungUp.killBonus on top of the kill's own pay. A new
// beam restarts the clock. The mark lives on the zombie (zombie.applyRungUp / rungUpTimer); this system only listens:
//   'hit'  from a gun with a `rungUp` block, not a kill -> mark the target, announce 'rungUp' { zombie, seconds }
//   'kill' of a zombie still marked                     -> pay the bonus (not once the run is over, not a no-rewards fan),
//                                                          announce 'rungUpKill' { zombie, points }, and clear the mark
// fx/rungUpView.js draws the price tag over marked zombies (browser only). DOM-free: runs headless in tests.
// =============================================================================

import { weapons } from '../config/weapons.js';

export function createRungUp({ events, wallet, runFrozen = () => false }) {
  const markOf = (weaponId) => weapons[weaponId]?.rungUp ?? null;
  const off = [
    events.on('hit', ({ target, killed, weaponId }) => {
      const mark = markOf(weaponId);
      if (!mark || killed || !target?.applyRungUp) return;
      if (!target.applyRungUp(mark.seconds, mark.damageTaken)) return;
      target.rungUpBonus = mark.killBonus; // (what this mark's kill pays)
      events.emit('rungUp', { zombie: target, seconds: mark.seconds });
    }),
    events.on('kill', ({ zombie }) => {
      if (!(zombie?.rungUpTimer > 0)) return;
      zombie.rungUpTimer = 0; // (the mark ends with it)
      const points = zombie.rungUpBonus ?? 0;
      if (runFrozen() || zombie.noRewards) return;
      wallet.award(points);
      events.emit('rungUpKill', { zombie, points });
    }),
  ];
  return {
    dispose() { for (const unsubscribe of off) unsubscribe(); },
  };
}
