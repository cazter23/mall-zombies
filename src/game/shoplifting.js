// =============================================================================
// SHOPLIFTING: the Shoplifter's theft and getaway (config/zombies.js shoplifter.theft). On the bus, DOM-free (runs headless in tests).
//   'playerHit' by a zombie with `theft` that holds no loot yet -> it takes some of your points (wallet.lose: neither spending nor
//               income), announces 'shoplifterTheft' { zombie, points }, and runs: its movement is taken over (zombie.control) to flee
//               AWAY from you through the mall (navigation.directionAway, the player field walked uphill) at theft.fleeSpeed. A dead end
//               corners it. After theft.fleeSeconds it gets away: removed without a kill (nothing paid, nothing counted), a puff of dust,
//               'shoplifterEscaped' { zombie, points, position }.
//   'kill'      of a zombie holding loot -> the points come back (wallet.recover), 'shoplifterRecovered' { zombie, points }; its kill pays
//               as usual through the normal 'kill' payout. Nothing moves once the run is over (the points are still taken back from a
//               Play again, which clears the zombies).
// A shoplifter steals once: holding loot it never swings again (it only runs). fx/lootView.js draws the gold marker over it (browser).
// =============================================================================

import * as THREE from 'three';

const DUST = [0xd8d2c4, 0xb8b0a0, 0x8a8478];

/** How much a theft takes from `points` (config/zombies.js shoplifter.theft): fraction, clamped to [min, max], rounded down, never more than there is. */
export function theftAmount(points, theft) {
  if (!(points > 0)) return 0;
  const wanted = Math.min(theft.max, Math.max(theft.min, points * theft.fraction));
  const rounded = Math.floor(wanted / theft.roundTo) * theft.roundTo;
  return Math.min(points, Math.max(theft.roundTo, rounded));
}

export function createShoplifting({ events, wallet, effects = null, runFrozen = () => false }) {
  const away = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function getaway(zombie) {
    const theft = zombie.type.theft;
    zombie.fleeTimer = theft.fleeSeconds;
    zombie.control = (dt, ctx) => {
      if (zombie.state !== 'chasing') zombie.setState('chasing'); // (out of the swing it stole in: it runs, it doesn't finish the swing)
      // Away from you along the route (round corners); with nowhere further to go (cornered), straight away from you if it can.
      if (!ctx.nav.directionAway?.(zombie.position, away)) {
        away.set(zombie.position.x - ctx.player.position.x, 0, zombie.position.z - ctx.player.position.z);
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        away.normalize();
      }
      zombie.walkToward(away.x, away.z, theft.fleeSpeed * (zombie.slowFraction ?? 1), dt, ctx);
      zombie.fleeTimer -= dt;
      if (zombie.fleeTimer <= 0 && !zombie.removed) escape(zombie);
      return true;
    };
  }

  function escape(zombie) {
    const points = zombie.loot ?? 0;
    zombie.loot = 0;
    zombie.removed = true; // (gone this tick: no kill, no payout, no kill stats; the round carries on)
    zombie.control = null;
    effects?.splat?.(zombie.position.clone().setY(zombie.position.y + 0.1), up, DUST, 18);
    events.emit('shoplifterEscaped', { zombie, points, position: zombie.position.clone() });
  }

  const off = [
    events.on('playerHit', ({ zombie }) => {
      const theft = zombie?.type?.theft;
      if (!theft || zombie.loot > 0 || !zombie.isAlive || runFrozen()) return;
      const taken = wallet.lose(theftAmount(wallet.points, theft));
      if (!taken) return; // (nothing to take: it keeps coming, and swings again)
      zombie.loot = taken;
      getaway(zombie);
      events.emit('shoplifterTheft', { zombie, points: taken });
    }),
    events.on('kill', ({ zombie }) => {
      if (!(zombie?.loot > 0)) return;
      const points = zombie.loot;
      zombie.loot = 0;
      if (runFrozen()) return;
      wallet.recover(points);
      events.emit('shoplifterRecovered', { zombie, points });
    }),
  ];

  return {
    dispose() { for (const unsubscribe of off) unsubscribe(); },
  };
}
