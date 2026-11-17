// =============================================================================
// THE ZOMBIE PEN (debug mode: part of the test range, maps/testRange/testRange.js). A walled room through the range's west wall with a
// console just inside (a bench form, benchForm.js): spawn any zombie, Mascot costume (or the gold Employee of the Month) or mall boss at
// the far end, make them stand still or come at you, and clear the pen. For checking hit reactions, splatter and each one's own move
// (the Mannequin freezing, the Cart Pusher's charge, the Shoplifter's grab, a costume's beat, a boss's phases).
//   - Spawned zombies pay nothing (noRewards) and the run is a debug run anyway (benchForm marks it).
//   - Stand still: a zombie is held where it stands, facing you (zombie.applyHold, refreshed each tick); a boss, which ignores holds, is pinned.
//     The zombie failsafe never "rescues" a pen zombie back to the mall (its stuck timer is reset each tick).
//   - Bosses come through the boss director, so their health bar and phases are real: one boss at a time, once per round (N moves on).
//   - Leaving the range (T, or walking off) clears the pen: nothing from it follows you into the mall.
//
//   const pen = createPen({ position, spawnSpots, contains })   the console's buy spot; where zombies appear; is a point in the range?
//   pen.connect({ input, state, events, sound, player, interactions, zombies, bosses, rounds }); pen.update(dt); pen.zombies (tests)
//   the console form: benchForm.js (pen.form)
// =============================================================================

import * as THREE from 'three';
import { zombieTypes, mascotVariants } from '../../config/zombies.js';
import { bossTypes } from '../../config/bosses.js';
import { economy } from '../../config/economy.js';
import { createBenchForm } from './benchForm.js';

const HOLD_SECONDS = 0.3; // a held zombie's hold, refreshed every tick while Stand still is on
const MALL_BOSSES = Object.keys(bossTypes).filter((id) => id !== 'lastCustomer'); // (the Last Customer is Closing Time's, not a summons)
const MASCOT_COSTUMES = Object.keys(mascotVariants);
const nameOfCostume = (id) => mascotVariants[id].name ?? id;
// A zombie type's words (the plain types carry no name: 'cartPusher' -> 'Cart Pusher', as the debug window says it).
const nameOfType = (type) => type.name ?? type.id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export function createPen({ position, spawnSpots, contains }) {
  let ctx = null;
  let still = true;
  let next = 0;
  const penned = new Map(); // zombie -> its pinned spot
  const holdSource = { isAlive: true, position: new THREE.Vector3() }; // (applyHold's source: a hold lasts while its source is alive)

  function nextSpot() {
    const spot = spawnSpots[next % spawnSpots.length];
    next++;
    return spot.clone();
  }

  function adopt(zombie, at) {
    zombie.noRewards = true;
    zombie.position.copy(at);
    zombie.updateHitboxes?.();
    penned.set(zombie, at.clone());
    return zombie;
  }

  function spawn(choice) {
    const at = nextSpot();
    const [kind, id] = choice.split(':');
    let zombie = null;
    if (kind === 'type') zombie = ctx.zombies.spawn(id, at);
    if (kind === 'mascot' || kind === 'gold') {
      zombie = ctx.zombies.spawn('mascot', at, { variant: id, gold: kind === 'gold' });
      // The game allows only so many Mascots alive at once and makes any more a Shopper: say so instead.
      if (zombie && !zombie.type.mascot) {
        zombie.noRewards = true;
        zombie.takeHit({ damage: zombie.health + zombie.maxHealth, part: 'body', source: 'debug' });
        throw new Error(`Only ${economy.zombieMix.mascot.maxAlive} Mascots at once (the game's own cap): clear the pen first`);
      }
      if (zombie && kind === 'gold' && !zombie.type.gold) {
        zombie.noRewards = true;
        zombie.takeHit({ damage: zombie.health + zombie.maxHealth, part: 'body', source: 'debug' });
        throw new Error('Only one gold Mascot at once: clear the pen first');
      }
    }
    if (kind === 'boss') {
      if (!ctx.rounds.started) ctx.rounds.start();
      zombie = ctx.bosses.summon(id, at);
      if (!zombie) throw new Error('One boss at a time, once per round: N moves to the next round');
    }
    if (!zombie) throw new Error('Could not spawn that here');
    adopt(zombie, at);
    return `Spawned ${nameOfType(zombie.type)}`;
  }

  function clear() {
    let cleared = 0;
    for (const zombie of penned.keys()) {
      if (!zombie.isAlive) continue;
      zombie.takeHit({ damage: zombie.health + zombie.maxHealth, part: 'body', source: 'debug' });
      cleared++;
    }
    penned.clear();
    return cleared;
  }

  const form = createBenchForm({
    position,
    normal: new THREE.Vector3(0, 0, -1),
    menu: 'zombiePen',
    kicker: 'Test range · Zombie pen · Free',
    prompt: {
      kind: 'zombiePen', id: 'console', label: 'Zombie pen console',
      detail: 'Spawn any zombie, costume or boss at the far end; make them stand still or come at you. Marks the run as a debug run.',
      title: () => `In the pen: ${[...penned.keys()].filter((z) => z.isAlive).length}`,
    },
    columns: () => [
      { page: 'Zombie pen', id: 'zombie', name: 'Zombie',
        options: () => Object.entries(zombieTypes).filter(([id]) => id !== 'mascot').map(([id, type]) => ({ id: `type:${id}`, name: nameOfType({ ...type, id }) })),
        current: () => null, apply: spawn },
      { page: 'Zombie pen', id: 'mascot', name: 'Mascot',
        options: () => [
          ...MASCOT_COSTUMES.map((id) => ({ id: `mascot:${id}`, name: nameOfCostume(id) })),
          ...MASCOT_COSTUMES.map((id) => ({ id: `gold:${id}`, name: `${nameOfCostume(id)} (gold)`, color: 0xffc61a })),
        ],
        current: () => null, apply: spawn },
      { page: 'Zombie pen', id: 'boss', name: 'Boss',
        options: () => MALL_BOSSES.map((id) => ({ id: `boss:${id}`, name: bossTypes[id].name })),
        current: () => null, apply: spawn },
      { page: 'Zombie pen', id: 'behaviour', name: 'They...',
        options: () => [{ id: 'still', name: 'Stand still' }, { id: 'walk', name: 'Come at me' }],
        current: () => (still ? 'still' : 'walk'),
        apply: (id) => { still = id === 'still'; return still ? 'They stand still' : 'They come at you'; } },
      { page: 'Zombie pen', id: 'pen', name: 'Pen',
        options: () => [{ id: 'clear', name: 'Clear the pen' }],
        current: () => null,
        apply: () => `Cleared ${clear()}` },
    ],
  });

  return {
    form,
    /** The pen's zombies that are still alive (tests). */
    get zombies() { return [...penned.keys()].filter((z) => z.isAlive); },
    get still() { return still; },

    connect(gameContext) {
      ctx = gameContext;
      form.connect(gameContext);
    },

    update(dt) {
      form.update(dt);
      if (!ctx || !penned.size) return;
      // Leaving the range clears the pen (nothing from it follows you into the mall).
      if (!contains(ctx.player.position)) { clear(); return; }
      for (const [zombie, pin] of penned) {
        if (!zombie.isAlive) { penned.delete(zombie); continue; }
        zombie.stuckTimer = 0; // (the failsafe would otherwise "rescue" it to a spawn point in the mall)
        zombie.stuckFrom.x = zombie.position.x;
        zombie.stuckFrom.z = zombie.position.z;
        if (!still || zombie.state === 'spawning') continue;
        if (zombie.type.boss) { // (bosses ignore holds: pin it)
          zombie.position.x = pin.x;
          zombie.position.z = pin.z;
          zombie.velocity?.set?.(0, 0, 0);
          continue;
        }
        holdSource.position.copy(zombie.position);
        zombie.applyHold(holdSource, HOLD_SECONDS, ctx.player.position); // (held, it turns to face you)
      }
    },
  };
}
