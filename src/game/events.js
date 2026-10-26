// =============================================================================
// GAME EVENTS: a tiny synchronous event bus (createGame makes one: g.events).
// Systems announce what happened; anything interested listens. New features (Flash Sales,
// PA announcements, hazards, perk procs, challenges) listen here instead of being threaded
// through main/createGame as more callbacks.
//
//   const off = events.on('kill', ({ zombie }) => ...)   // returns an unsubscribe function
//   events.emit('kill', { zombie, ... })
// Listeners run in the order they were added, immediately, on the emitting tick.
//
// THE EVENTS (payloads):
//   'shot'        shot (including weaponId)              a gun fired (hitscan result): one per shot = one per staple /
//                                                        sticker / nail / Foam dart (3 per burst) / whole shotgun blast
//   'hit'         { target, killed, headshot, melee }    a PLAYER attack hit a shootable (one per target per shot
//                                                        or swing). Non-lethal zombie hits pay +10 here.
//   'kill'        { zombie, headshot, melee, source }    a zombie died, WHATEVER killed it ('gun', 'melee', or a
//                                                        future 'hazard' / 'effect'...). ALL kill payouts and kill
//                                                        stats come from this one event. After the player's death
//                                                        events still fire, but nothing more is paid or counted.
//   'playerHit'   { damage, zombie, knockback }          a zombie's swing (or a cart charge) landed;
//                                                        knockback = { x, z } m/s shove or null
//   'playerDeath' {}                                     after the death is registered (onPlayerDeath)
//   'runEnd'      { summary }                            immutable final run totals, emitted once on player death
//   'powerUpDrop' { id, position, seconds }               earned incentive appeared on clear floor
//   'powerUpCollect' { id, name, pa, sound }              walk-through collection (instant effect or zone start)
//   'powerUpStart' { id, position, remaining, radius, ... } zone or temporary employee benefit began
//   'powerUpEnd'  { id, reason }                         benefit ended: expired | reset | death | spent | completed | targetLost | replaced
//   'incentiveComplete' { id, text }                     marked-target bonus earned (PA/HUD feedback)
//   'incentiveBurst' { position, radius, color }          deferred liquidation burst (visual/sound feedback)
//   'powerUpExpire' { id }                               uncollected incentive timed out
//   'roundStart'  { round }                              the round number flipped (game/rounds.js)
//   'typeIntro'   { typeId }                             a zombie type's first appearance this run
//   'purchase'    { label, cost, kind, id }              something was bought; kind 'door' | 'weapon' | 'ammo' |
//                                                        'ammoCache' | 'tier' | 'attachment' | 'other', id = door / gun / tier / attachment id (as it was BEFORE
//                                                        the purchase: buying a gun is kind 'weapon', not its ammo)
//                                                        Area purchases also include areaId and openedDoorIds (one charge, many barriers).
//   'flashSaleStart' { id, label, categories, discount, seconds, pa: { kicker, text } }   a Flash Sale began (game/flashSales.js)
//   'flashSaleEnd'   { id, label, reason 'expired' | 'reset', pa }                         it ended (no banner on 'reset')
//   'runReset'    {}                                     after Play again reset everything
// =============================================================================

export function createEvents() {
  const listeners = new Map(); // name -> [fn]

  return {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(fn);
      return () => {
        const list = listeners.get(name);
        const i = list.indexOf(fn);
        if (i !== -1) list.splice(i, 1);
      };
    },

    emit(name, payload = {}) {
      const list = listeners.get(name);
      if (!list) return;
      // A copy, so a listener that unsubscribes (or subscribes) mid-emit doesn't skip anyone.
      for (const fn of [...list]) fn(payload);
    },

    /** How many listeners an event has (for tests / debugging). */
    count(name) {
      return listeners.get(name)?.length ?? 0;
    },
  };
}
