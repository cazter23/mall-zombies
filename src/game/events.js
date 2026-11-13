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
//                magazineLeft = rounds left after it; a cone gun's (Leaf Blower) hits each carry interrupted = the gust shoved
//                that zombie out of an attack (zombie.isAttacking: a windup, a swing or a cart charge)
//   'warrantyClaim' { weaponId, round, pa }              a Platinum gun ran completely dry and its ammo was replaced for free (game/warranty.js)
//   'rungUp'      { zombie, seconds }                    a Barcode Scanner beam RANG UP a zombie it didn't kill (game/rungUp.js): more damage from
//                                                        everything for `seconds`, and a kill bonus
//   'rungUpKill'  { zombie, points }                     a zombie died while rung up: `points` paid on top of its kill (not once the run is over)
//   'shoplifterTheft' { zombie, points }                 a Shoplifter's hit stole `points` and it is running (game/shoplifting.js)
//   'shoplifterRecovered' { zombie, points }             it was killed before it got away: the points came back
//   'shoplifterEscaped' { zombie, points, position }     it got away with them: removed without a kill (no pay, no kill stats)
//   'meleeUpgrade' { tier, id }                          a box cutter tier was bought at Customer Service (game/meleeUpgrades.js; 1 sharpened, 2 pro)
//   'reload'      { weaponId }                           a reload began on the gun in hand
//   'hit'         { target, killed, headshot, melee, weaponId }  a PLAYER attack hit a shootable (one per target per shot
//                                                        or swing). Non-lethal zombie hits pay +10 here. weaponId = the gun (a
//                                                        ball's: the gun that threw it); none for the box cutter.
//   'kill'        { zombie, headshot, melee, source, weaponId }  a zombie died. weaponId is the gun that dealt the
//                                                        lethal hit or supplied the projectile or build effect, or null.
//                                                        Also distance, bounces, firstWound (for weapon skin challenges;
//                                                        nothing pays by them): distance = metres the lethal shot travelled
//                                                        (a ray to the hit, a ball's whole flight; null for burns, melee,
//                                                        hazards...), bounces = a ball's bounces before the lethal hit (else
//                                                        null), firstWound = { weaponId, seconds }: what first took health off
//                                                        it and how long before this kill (null if nothing ever did).
//                                                        woundedBy = every weaponId (or source, without one) that ever took
//                                                        health off it; projectile = the lethal ball's id, else null.
//                                                        All kill payouts and kill stats come from this event. After the
//                                                        player's death it still fires, but nothing is paid or counted.
//   'mascotHeadPop' { zombie, headshot, source, again }  a Mascot's helmet came off at half health (whatever hit it;
//                                                        zombie.type.variant = the costume; again = a second time,
//                                                        after Captain Coupon put it back on: no bonus)
//   'mascotReclaim' { zombie }                           Captain Coupon put his helmet back on (health restored)
//   'mascotPopBlast' { zombie, position, butter, butterSeconds, flung }   Poppy Corn's pop flung `flung` zombies;
//                                                        butter = the player was shoved too (the HUD's butter splat)
//   'mascotGold'  { zombie }                             an Employee of the Month (a gold Mascot) spawned; its kill
//                                                        always drops a power-up (game/powerUps.js, type.guaranteedDrop)
//   'playerHit'   { damage, zombie, knockback, attackerPosition, hitDirection }
//                                                        a zombie's swing (or a cart charge) landed;
//                                                        knockback = { x, z } m/s shove or null.
//                                                        attackerPosition = { x, z } world coords or null.
//                                                        hitDirection = { x, z } normalized vector from player toward attack source or null.
//                                                        damage is BEFORE clothes: createGame's listener applies stats.damageTakenMultiplier
//   'playerFall'  { drop, damage }                       a landing from a height hurt (feel.fall); damage is already taken
//   'gunBlast'    { weaponId, position, radius, hits, selfDamage, magazineLeft }   a rocket of a gun with `blast` burst (weapons/playerGun.js; the hits are already
//                                                        done, +10s and kills paid as usual); createGame's listener takes selfDamage off your health
//   'armourHit'   { absorbed, layers, popped }            Bubble Wrap absorbed damage from a zombie hit
//   'kioskStock'  { siteId, stock, pick, pa }            Kevin's cart opened for the run or moved to a new site: where he is, the
//                                                        block's three products and his Pick (PA stays silent when he stays put)
//   'kioskMoved'  { siteId, area, moved }                Kevin's site on a move-round 'roundStart' (moved false: he stays where he is); area = the PA's name
//   'kioskHawk'   { siteId, kind, line }                 Kevin shouted (game/features/kiosk.js; config/kiosk.js hawk): kind 'lines' (you're
//                                                        near his open cart), 'duck' (a zombie sent him under it) or 'back' (he's up again);
//                                                        his cart shows `line` in a speech bubble (presentation only)
//   'regenStart'  {}                                     health began climbing back (once per recovery: player/health.js)
//   'secondChance' { status }                            Second Chance changed (game/secondChance.js): 'held' = bought at Customer Service,
//                                                        'used' = it just covered a lethal hit (the player is already back at full health,
//                                                        protected, the shove done; no 'playerDeath' follows), 'available' = cleared by Play again.
//                                                        While its protection lasts no 'playerHit' / 'playerFall' is announced at all.
//   'playerDeath' {}                                     after the death is registered (onPlayerDeath)
//   'escapeVanStart' {}                                  the player finished the van's hold interaction
//   'runWon'      { summary }                            immutable win snapshot; simulation pauses for the choice
//   'overtimeStart' { round }                            the player chose Stay for overtime; round = the first overtime round (the next
//                                                        round after a win mid-wave, the already announced one after a win in the break)
//   'runEnd'      { summary }                            final run totals, emitted once per recorded run: on death, on Clock out,
//                                                        or when a won run is left from a menu (createGame's leaveRun)
//   'powerUpMeter' { progress, round, unlocked, available, capped, nearFull, dropped, maxPerRound, silent? }
//                                                        Employee of the Hour meter state changed (game/powerUps.js)
//   'powerUpDrop' { id, position, seconds }               earned incentive appeared on clear floor
//   'powerUpCollect' { id, name, pa, sound }              walk-through collection (instant effect or benefit start)
//   'incentiveDiscovered' { id, name, icon, tier, found, total }   first career pickup of an incentive type (game/guide.js)
//   'powerUpStart' { id, position, remaining, radius, ... } floor spill or temporary employee benefit began
//   'powerUpEnd'  { id, reason }                         benefit ended (including mopped by the Janitor or roundDiscard)
//   'incentiveComplete' { id, text }                     marked-target bonus earned (PA/HUD feedback)
//   'incentiveBurst' { position, radius, color }          deferred liquidation burst (visual/sound feedback)
//   'clearanceDetonated' { position, area, radius, kills, bossesHit, positions, flatBonus }  (area: the map area cleared, or null and radius)
//                                                        Store-Wide Clearance cleared its area's floor and damaged bosses
//   'powerUpExpire' { id, pointsInstead }                uncollected incentive timed out (a boss voucher left on the floor pays pointsInstead)
//   'roundStart'  { round }                              the round number flipped (game/rounds.js)
//   'clockIn'     { round, skipped }                     the player ended the break before `round` early (game/clockIn.js);
//                                                        skipped = seconds of the break given up
//   'waveEnding'  { round, remaining }                   no spawns left and 2 or fewer zombies alive (final clearance cue)
//   'stragglers'  { round, zombies, firstTime }          all spawns done, alive <= threshold, quiet delay elapsed (game/stragglers.js);
//                                                        `zombies` lists non-boss alive targets; `firstTime` = first activation this run
//   'stragglersCleared' { round, reason }                straggler helper turned off (roundEnd, disabled, bossOnly, reset, over)
//   'roundDiscard' { reason }                            the current wave was cleared: reason 'debug' (skipRound / jumpTo) or
//                                                        'overtime' (Stay for overtime with a wave live; an uncollected boss reward stays)
//   'typeIntro'   { typeId, zombie }                     a zombie type's first appearance this run (zombie = that spawn)
//   'mascotVariantIntro' { variant, zombie }             a Mascot costume's first appearance this run, after the type's
//                                                        own intro (game/rounds.js; banner: config/zombies.js mascotVariants)
//   'returnQuest' { step, stage, pa? }                   a step of the hidden Return to Sender quest was completed ('policy' |
//                                                        'damaged' | 'ticket' | 'called' | 'collect'). game/returnQuest.js
//   'returnLabel' { labelId, fitted?, pa? }              a return label was issued by a ticked duty, or (fitted) fitted at the
//                                                        Returns Desk's label slot (labelId null = no label)
//   'lostFound'   { itemId, found, total, complete, pa? } a piece of lost property was logged for good (game/lostFound.js;
//                                                        itemId null = the debug shortcut changed the record)
//   'guideEntry'  { entryId, stage, pa? }                a Survival Guide page appeared (stage 1) or gained a paragraph (2 = field
//                                                        notes, 3 = the tip; these carry a PA line). game/guide.js
//   'bossSpawn'   { zombie, round, encore }             a scheduled or debug-summoned boss entered the wave
//   'bossPhase'   { zombie, phase, round }               an encounter mechanic began (Janitor: wetFloor)
//   'bossDefeated' { zombie, round }                     an active boss died through the regular kill path
//   'bossVanished' { zombie, round }                     an active boss disappeared without a kill or an explicit round discard
//   'closingBriefing' { pa }                              once per run, shortly after round 1 is announced: the PA introduces the checklist
//   'closingKeyDrop' { bossId, position, pa }             a boss's checklist key appeared on clear floor
//   'closingKey' { bossId, pa }                           the player took a checklist key
//   'fountainKill' { zombie }                            the Electrified Fountain dealt a killing blow during a pulse
//   'fryerKill'   { zombie }                             the Fryer Blast dealt a killing blow during a pulse
//   'sprinklerKill' { zombie }                           the Fire Sprinklers dealt a killing blow during a pulse
//   'paLureKill'  { zombie }                             the PA System Lure dealt a killing blow on its feedback pop
//   'closingProgress' { line, count, needed }            a closing duty advanced (line is the boss id)
//   'closingLine' { line, done, total, pa? }              a checklist line was checked off; done counts completed lines
//   'closingValidated' { round, pa }                     parking validation paid once; closing time is the next round (never replayed on load)
//   'bossFlash' { zombie, seconds, opacity, dimOpacity } telegraphed phone flash; browser presentation respects Comfort settings
//   Fan actors carry noRewards: all hit/kill payouts, incentive and workshop credit ignore them.
//   'purchase'    { label, cost, kind, id }              something was bought; kind 'door' | 'weapon' | 'ammo' |
//                                                        'ammoCache' | 'tier' | 'attachment' | 'wardrobe' | 'fittingRoom' | 'secondChance' | 'other', id as it was BEFORE
//                                                        the purchase (buying a gun is kind 'weapon'; a fitting room emits the id of the item put on, cost 0)
//                                                        Area purchases also include areaId and openedDoorIds (one charge, many barriers).
//   'areaOpened'  { areaId, doorId, openedDoorIds, first, pa }  once per door purchase (game/doorOpenings.js); first = the area's
//                                                        first opening this run, pa = its welcome then (ifQuiet: dropped if
//                                                        another PA line is up). Never on a load or debug open-all
//   'barrierOpening' { door, doorId, areaId, bought, profile }  each barrier that purchase set rolling; bought = the one paid at,
//                                                        the others are free connections (the light show). profile: config/shutters.js
//   'barrierOpened'  { door, doorId, areaId, bought, profile, near }  that barrier clunked fully open (near = within the nudge range)
//   'wardrobeChange' { slot, worn, removed }              apparel equipped, item ids (removed is null for an empty slot)
//   'outfitPulse' { id, slot }                            a worn item just did its job (game/outfitRail.js): its tag on the outfit rail swings
//   'wardrobeBuy' { id, pa: { kicker, text } }            an item was bought from a showpiece (game/features/wardrobeFixtures.js): the mall PA reads `pa`
//   'flashSaleSoon'  { kind, id, label, categories, target, seconds, pa: { kicker, text } }  a Flash Sale or Doorbuster teaser began (game/flashSales.js)
//   'flashSaleStart' { kind, id, label, categories, target, discount, seconds, pa }            a Flash Sale or Doorbuster began
//   'flashSaleEnd'   { kind, id, label, reason 'expired' | 'sold' | 'reset' | 'cancelled', pa } it ended ('sold': a Doorbuster's item was bought,
//                                                        its rush is on the way; no banner on 'reset' or 'cancelled')
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
//   'equipmentThrown' { id, pocket, left }               a pocket's item was thrown (game/equipment.js; pocket 'lethal' | 'tactical',
//                                                        left = charges still in it)
//   'equipmentBurst'  { id, position, radius, hit }      a thrown Soda Bomb burst, or a Glitter Bomb opened (damage 0: hit = the
//                                                        zombies it confused); hit = [{ target, damage, killed }]. Equipment
//                                                        damage never emits 'hit' (no +10): its kills pay through 'kill', source 'equipment'
//   'airHornBlast'    { position, radius, pushed }       the Stadium Air Horn sounded where you stand (game/equipment.js; it isn't
//                                                        thrown); pushed = how many zombies it staggered. Presentation (the blast ring)
//   'sentryDeployed'  { position }                       a thrown SPIN-O-MATIC Sentry landed and stood up (game/equipment.js); its kills
//                                                        carry weaponId 'sentry'
//   'sentryExpired'   { position }                       its lifetime ran out and it fell apart (death and Play again just clear it)
//   'challengeProgress' { gunId, skinId, count, needed }  a challenge counter changed (game/challenges.js)
//   'skinUnlocked' { gunId, skinId, shared, pa }                  a skin was earned; PA and HUD toast listen here
//   'challengeLive' { gunId, skinId, value, needed, failed }  a feat's attempt in progress changed (game/challenges.js): value = how it
//                                                        stands (config/skins.js `track` words it), failed = it was just lost (the
//                                                        challenge tracker strikes it through); the next attempt reports failed false
//   'runReset'    {}                                     after Play again reset everything
//   'runSaved'    { round }                              Save & Quit wrote the slot (game/saveGame.js); the run ends next (main.js)
//   'runLoaded'   { round }                              a save was loaded: the run resumes at that round's break (horror relights, the PA welcomes you back)
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
