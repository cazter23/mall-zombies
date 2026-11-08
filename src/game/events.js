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
//                workshopPlacement / clearanceHit carry the corresponding build's resolved shot data
//   'warrantyClaim' { weaponId, round, pa }              a Platinum gun ran completely dry and its ammo was replaced for free (game/warranty.js)
//   'reload'      { weaponId }                           a reload began on the gun in hand
//   'hit'         { target, killed, headshot, melee }    a PLAYER attack hit a shootable (one per target per shot
//                                                        or swing). Non-lethal zombie hits pay +10 here.
//   'kill'        { zombie, headshot, melee, source }    a zombie died, WHATEVER killed it ('gun', 'melee', or a
//                                                        future 'hazard' / 'effect'...). ALL kill payouts and kill
//                                                        stats come from this one event. After the player's death
//                                                        events still fire, but nothing more is paid or counted.
//   'mascotHeadPop' { zombie, headshot, source, again }  a Mascot's helmet came off at half health (whatever hit it;
//                                                        zombie.type.variant = the costume; again = a second time,
//                                                        after Captain Coupon put it back on: no bonus)
//   'mascotReclaim' { zombie }                           Captain Coupon put his helmet back on (health restored)
//   'mascotPopBlast' { zombie, position, butter, butterSeconds, flung }   Poppy Corn's pop flung `flung` zombies;
//                                                        butter = the player was shoved too (the HUD's butter splat)
//   'mascotGold'  { zombie }                             an Employee of the Month (a gold Mascot) spawned; its kill
//                                                        always drops a power-up (game/powerUps.js, type.guaranteedDrop)
//   'playerHit'   { damage, zombie, knockback }          a zombie's swing (or a cart charge) landed;
//                                                        knockback = { x, z } m/s shove or null
//   'playerFall'  { drop, damage }                       a landing from a height hurt (feel.fall); damage is already taken
//   'playerDeath' {}                                     after the death is registered (onPlayerDeath)
//   'runEnd'      { summary }                            immutable final run totals, emitted once on player death
//   'powerUpDrop' { id, position, seconds }               earned incentive appeared on clear floor
//   'powerUpCollect' { id, name, pa, sound }              walk-through collection (instant effect or zone start)
//   'powerUpStart' { id, position, remaining, radius, ... } zone or temporary employee benefit began
//   'powerUpEnd'  { id, reason }                         benefit ended (including mopped by the Janitor or roundDiscard)
//   'incentiveComplete' { id, text }                     marked-target bonus earned (PA/HUD feedback)
//   'incentiveBurst' { position, radius, color }          deferred liquidation burst (visual/sound feedback)
//   'powerUpExpire' { id, pointsInstead }                uncollected incentive timed out (a boss voucher left on the floor pays pointsInstead)
//   'roundStart'  { round }                              the round number flipped (game/rounds.js)
//   'roundDiscard' {}                                    a debug skip cleared the current wave
//   'typeIntro'   { typeId, zombie }                     a zombie type's first appearance this run (zombie = that spawn)
//   'mascotVariantIntro' { variant, zombie }             a Mascot costume's first appearance this run, after the type's
//                                                        own intro (game/rounds.js; banner: config/zombies.js mascotVariants)
//   'bossSpawn'   { zombie, round }                      a scheduled or debug-summoned boss entered the wave
//   'bossPhase'   { zombie, phase, round }               an encounter mechanic began (Janitor: wetFloor)
//   'bossDefeated' { zombie, round }                     an active boss died through the regular kill path
//   'bossFlash' { zombie, seconds, opacity, dimOpacity } telegraphed phone flash; browser presentation respects Comfort settings
//   Fan actors carry noRewards: all hit/kill payouts, incentive and workshop credit ignore them.
//   'purchase'    { label, cost, kind, id }              something was bought; kind 'door' | 'weapon' | 'ammo' |
//                                                        'ammoCache' | 'tier' | 'attachment' | 'other', id = door / gun / tier / attachment id (as it was BEFORE
//                                                        the purchase: buying a gun is kind 'weapon', not its ammo)
//                                                        Area purchases also include areaId and openedDoorIds (one charge, many barriers).
//   'flashSaleStart' { id, label, categories, discount, seconds, pa: { kicker, text } }   a Flash Sale began (game/flashSales.js)
//   'flashSaleEnd'   { id, label, reason 'expired' | 'reset', pa }                         it ended (no banner on 'reset')
//   'ritualStart' { gunId, gunName, loaner, restuff, pa }  Build-A-Blaster took a gun (game/features/workshopRitual.js)
//   'ritualStage' { stage, pa }                           the gun reached the next stage of the conveyor
//   'chuteDrop'   {}                                      a zombie fell out of the Returns Chute
//   'ritualKill'  { zombie, kills, quality }              a kill in the room went into the tank
//   'ritualQuality' { quality, pa }                       the gauge reached a new quality
//   'ritualReady' { gunId, kills, quality, reason 'lever' | 'time', pa }  the gun is waiting at the Naming Booth
//   'ritualWaiting' { gunId, pa }                         done, but taking it would replace a gun: it waits at the Naming Booth
//   'ritualCollect' { gunId, build, certificate, pa }     the player took the finished gun (certificate = the Birth Certificate's fields)
//   'buildFired'  { stuffing, heart, weaponId, hit: [zombie] }  a finished build's Heart fired its stuffing (game/features/workshopStuffings.js)
//   'limitedEditionDrop'   { id, position, pa }           a bag-carrying zombie dropped a Limited Edition (game/features/limitedEditions.js)
//   'limitedEditionFitted' { id, weapon, pa }             the player walked over it
//   'clawGrab'    { siteId, capsules: [{ gunId, capsule } | null] }   GRAB-A-GUN was paid: the capsules in its lanes (game/features/clawMachine.js)
//   'clawDrop'    { lane, gunId, plush, reason 'press' | 'time' }  the claw dropped; gunId = the prize (null: the plush or an empty lane)
//   'clawPrize'   { gunId, refurbished, outcome }        the player took the prize from the chute: outcome 'new' | 'refill' | 'refurbish'
//                                                        (game/features/clawMachine.js takeOutcome); refurbished = the attachment fitted, or null
//   'clawClosed'  { reason 'plush' | 'soldOut', siteId, nextSiteId, pa }   out of service (a plush refunds; nextSiteId: picked at the plush)
//   'clawMoved'   { siteId, area, moved, pa }            reopened at the next 'roundStart' (moved false: restocked where it stood)
//   'ticketsWon'  { amount, total, reason }              prize tickets paid out (game/tickets.js; reason 'prize' | 'plush' | 'sunny'): never points
//   'prizeRedeemed' { id, tickets }                      a Prize Counter prize was taken (game/features/prizeCounter.js)
//   'sunnyEscape' { fromId, toId, lap }                  the plush climbed out and is walking to the next site (game/features/clawSunny.js)
//   'sunnyArrived' { siteId }                            he climbed into that cabinet (it shakes)
//   'sunnyPopped' { siteId }                             shot or slashed: stuffing everywhere, tickets paid, the next site re-picked
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
