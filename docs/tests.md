# Sunset Galleria: what each test file covers

`tests/bossPolish.test.js` walks Manager/Guard from every open zone and into the workshop without rescue; checks unique stings, death feedback, direct order-form voucher consumption, fans excluded from ritual credit, actual Employee Discount expiry, death/reset voucher cleanup and debug ids. Isolated headless Chrome captured all four models with zero browser exceptions; no real browser tabs were opened.

`tests/bossEncores.test.js` checks configurable cadence, type/Mascot debut exclusions, known-boss selection, one boss per round, alternatives and Play again.

`tests/influencer.test.js` covers follower crossings/headshots/viral reset, half-health fans and cap/queue/departure/round completion, no hit or kill rewards, filming cells in every open zone and workshop, physical routing upstairs without rescue, flash windup/looking away/Comfort, and voucher ordering/savings cap.

`tests/guard.test.js` covers lockdowns in every area, occupancy waiting, ownership preservation, three radio headshots, expiry and cleanup on every exit, quota-funded backup and round completion, taser telegraph/damage/movement/slow expiry/miss vulnerability, and Master Key door redemption/conversion.

`tests/manager.test.js` covers exact meeting cancellation, failure buff expiry, report target cap/visibility, every meeting cleanup path, reward collection, booth redemption and automatic conversion at the voucher tier cap.

`tests/debugCommands.test.js` also checks the overlay's grouped commands, selected next gun, active boss,
god mode, refresh timing and accessible visibility.

`tests/bosses.test.js` covers the round 5/7 schedule, the regular wave budget, safe-spawn retries and the round
waiting for Murray. It checks the active Build-A-Blaster ritual, boss intro, kill payouts from several sources,
guaranteed incentive, receipt counter, control resistance and exclusion from incentive marks.

`tests/janitor.test.js` covers the mop wind-up and hit, puddle lifetime and cap, floor-specific slowdown,
Spill Cleanup removal, Antifreeze, and death, Play again and debug skip cleanup. It walks Murray from every open
zone and up to Build-A-Blaster from directly below the player, without a rescue teleport.

`tests/workshop.test.js` covers workshop purchases, ammo conservation during slides, trap arming, target shielding and run reset.

`tests/workshop.test.js` covers Promenade purchase gating and pricing, retaining upgrades, reserve-fed slides, and real trap shots, arming, damage and reset.

`tests/workshopRoom.test.js` covers the Build-A-Blaster room: plot limits, lanes of at least 3 m round the island, a player lap both ways, every floor point
reachable by zombies, a zombie following round each side, the hall as its own culling room and its grade.

`tests/workshopBuilds.test.js` also covers the order form: everything listed, today's first and the rest with a reason, pre-filled, keys / wheel / stick / D-pad, unavailable rows skipped, Q and B cancel, the last order remembered, standing still but still getting hit, death closing it.

`tests/orderFormView.test.js` covers the order form's summary line: every stuffing and heart pair reads as one short sentence.

`tests/fallAndLedge.test.js` covers fall damage (free short drops, damage per metre past the safe drop, god mode and the damage scale, stairs and jumps free) and the balcony rail climb (over the rail, onto the floor below, about 40 damage, measured from the balcony floor; refused from below and where the landing is blocked; the same rails work walking or sprinting).
`tests/workshopDetails.test.js` covers the room's detail pass: solid pieces only in corners (a lane of 2.5 m kept round the island), each solid piece too tall to stand on or a vaultable counter, entrances / bench / booth / lever / chute landings clear, every piece inside the shop or hall culling rooms, no added lights, and a triangle and draw budget.

`tests/workshopRitual.test.js` covers the ritual in the real game: the price, handing over, the Courtesy Loaner, kills counting only in the room, quality thresholds, the maximum time,
walking away and coming back, conveyor stages, the lever and booth only answering at the right time, gun purchases mid-ritual, upgrades staying on the gun, Play again and death
mid-ritual, the chute steering spawns only while you are in the room, a full round where the chute adds no zombies and the round still ends, and the debug shortcut.

`tests/workshopBuilds.test.js` covers finished builds: every Stuffing + Heart pair set off for real, a Last Round miss, Reload's blast and cooldown, Every 10th counting only that gun's kills, puddles, Antifreeze's chill then shatter, Hearts per gun, burn ticks and no stacking, kills paying once, stuffing kills not firing a Heart, the Heart cooldown, walls and floors
stopping stuffings, quality scaling, picking at the bins and the Heart wall, today's stock and area stocking, re-stuffing, stacking with tiers and attachments, and the round curve (a stuffing adds less than the gun itself, one proc never kills a full-health zombie from round 5).

`tests/workshopNames.test.js` covers names (unique in a run until the list runs out, kept through a re-stuff), the Birth Certificate's fields and wording, the PA lines in order, the HUD label, and "Survived by" in the run summary, even for a gun still at the workshop. `tests/receiptReview.test.js` covers the receipt line.

`tests/workshopSpectacle.test.js` covers ritual mode: moving parts out of batching, no added lights, tank fill and colour, kills flying into the tank and paying once, returns tumbling out of the chute, the lever, the arm, the jingle, the belt, PA narration priority, stuffing-coloured tracers, and Play again putting every part back. `tests/weaponModels.test.js` checks the stitched look on every gun: anchored to the gun, gun-sized, cheap, reversible.

`tests/limitedEditions.test.js` covers the drops: nothing on sale any more, bag zombies only, from the right round, one at a time, only what you can use, fitting free and keeping the gun's other upgrades, waiting for a swapped-away gun, not reachable through a floor, running out, and Play again.

`tests/zombieConfusion.test.js` covers Glitter's AI: fighting the nearest zombie, ignoring the player, kills paying once, walls and floors, standing dazzled alone, immunity afterwards, who can't be confused, Glitter on a real headshot, a round still ending, and its balance.

`tests/attachmentRework.test.js` covers paid run unlocks, discounted first purchases, free refits across replacement guns,
ownership reset, reload blocking, ammo conservation/full-reserve overflow, fully-owned sale eligibility and four-slot builds.

> Moved out of CLAUDE.md (verbatim) so the file every session loads stays small. Read it to find the test that guards something before you change it, or to see where a new test belongs.

Menu regressions: `tests/menus.test.js` covers modal inert/focus isolation, Tab/Escape, controller presets including
equal/custom values, reset buttons/confirmation and native-resolution readout. `tests/blood.test.js` also changes
splatter while paused, clearing flesh effects/pools immediately without removing dust or tracers.
`tests/retailUi.test.js` covers PA message priority, duplicates, bounded queues/cancellation, real purchase-ticket shortages,
sale/base prices, weapon/ammo distinctions, attachment replacement/tradeoff text and warranty transitions.
`tests/haptics.test.js` covers distinct gun pulses (including every dart in a real burst), damage priority, pickups,
intensity/off, unsupported/rejected actuator APIs, legacy pulse fallback, gamepad snapshots/unplug, focus/pause/death/reset
cleanup and keyboard suppression. Settings -> Controller -> Controller vibration is saved with the other settings.
`tests/prone.test.js` covers toggle controls, crawl speed from stats, smooth eye/collision lowering, low roofs,
safe stand/crouch recovery, slide/jump/melee/vault constraints, gun use, zombie damage, body clearance, controller sprint latch and run reset.
`tests/shopperAppearance.test.js` covers coordinated wardrobe choices and rarity, every clothing/hair/accessory/wear variant,
valid geometry and mesh budgets, animation, isolated hit flashes, owned-resource disposal, fixed hitboxes and unchanged Mall Walkers.
`tests/atmosphere.test.js` checks decorative triangles against protected routes/vaults and the escalator ceiling well,
zero added collision, batching/motion reset, interpolated supporting-surface shadows and disposal, spatial sound
occlusion/zones/panning/caps, pause/death/reset silence, closed-shutter rattles and Web Audio voice cleanup.
`tests/atriumDetails.test.js` checks the new authored atrium triangles against the fountain lap, all entrances/vents,
upper-ring walking lanes and the escalator; zero added collision/lights, varied displays/stock, geometry/batching budgets,
resource disposal, ripple/mobile animation/reset/settings and the fountain's existing spatial-ambience path.
`tests/atriumStorefronts.test.js` checks physical shop depth/shells, visible openings through the atrium masonry, arcade-facing
glazing, continuous window/door barriers on both floors and a shared lettering material.
`tests/retailUnease.test.js` checks sighting/look-away and quiet-interval gates, distant silhouette duration, TV feed visibility
after static batching, reset/comfort restoration, and local sound ownership/pause/comfort gates.
`tests/shutters.test.js` checks both wall axes/upstairs, fixed frame clearance, physical slat pitch/UV cropping, original
collision timing/reversal/reset, finishes/aspects, static batching/disposal, real F purchases and motor/roll/stop sounds
(pause freezes progress; death/reset cancel; debug open-all is silent), and unobscured low destination signs.
`tests/promenade.test.js` checks independent upper-floor expansion/support, the widened southern route, sealed future
connections, a real two-entrance shoe-store loop in both directions, momentum vaults, the eastern junction and live zombie
routes from both escalators plus a 12-zombie horde using both lanes. `tests/promenadeDetails.test.js` checks actual decorative
triangles against routes/vents/vaults, resource disposal, batching/geometry budgets and the expanded room-culling areas.
`tests/departmentStore.test.js` covers HOFFMAN'S: real F-hold buys of the 1250 gate (hallway) and the 1250 side door (start room,
before the start shutter; from either side, never through the wall), sealed until bought, spawns clear and reachable, a real walk in,
routes both ways through both doors, lanes and clear straight runs, real vaults over all three counters, "nothing to perch on"
(every exposed top is a step, a vaultable counter or >= 2.1 m, even jumping from a counter top), a 12-zombie horde, culling, grade, horror, and that
nothing else lies on a face of the store's walls. `tests/departmentStoreDetails.test.js` covers its detail pass: departments on every rack, only two
added colliders (the shelving, 2.2 m), nothing over 12 cm in any lane / door approach / buy spot / spawn (checked on the real triangles), floor
litter, the open/taped fitting rooms, ambience emitters, mesh/triangle budgets and the cinema seam (receiving door, one-sheets, ticket stubs).
`tests/cinema.test.js` covers the priced two-sided F purchase/reset, sealed unlock, upper-floor spawns, standing loop traversal,
display vault, live zombie routes through both entrances/front crossover, local selection, vulnerable seat perches and slide
clock/settings/reset/disposal. `tests/cinemaDetails.test.js` checks real triangle clearance, batching/resource budgets and all
three room-culling areas/portals. `coplanar.test.js` includes the cinema and its shared Promenade wall.
`tests/cinemaStairs.test.js` covers the lower two-sided F purchase/discount/reset, independent shared-zone holders, sealed
unlocks, real player walking/sliding, all three zombie types up/down and a mixed 12-zombie horde without rescue teleports,
and stairwell/return culling, including the closed lower shutter staying visible from the Service Corridor.
`tests/cinemaVisuals.test.js` protects service-detail triangle clearance, geometry/batching budgets, resource disposal,
visible-screen upload limits, ambient/clutter controls, pause/death/reset and spatial ambience. `tests/ambientPulse.test.js`
checks the quiet periodic projector relay buffer, its silent intervals and unchanged random stream.
fullRun.test.js also enters the cinema through Service Corridor without repairing the escalator, then buys the cinema's
Promenade shutter from inside and receives natural upstairs spawns.
`tests/careerStats.test.js` checks persistent lifetime totals, weighted accuracy, personal bests, bounded recent runs,
debug-run exclusion, reset, corrupt saves and unavailable browser storage.
`tests/music.test.js` also covers the End of Shift death sting: receipt-timed bell, music volume, cancellation of future
notes, replacement-voice cleanup, and real-game death/reset wiring.
`tests/powerUps.test.js` checks earned incentive thresholds, skill credit, single drops, caps/repeats, expiry, safe floor/ramp
placement, swept slide collection, wall/storey rejection, Blue Light payouts/timers, reserve delivery without bypassing
reloads/upgrades, Security Sweep through all zombie attack/charge states, visuals/disposal and HUD. fullRun.test.js also
earns and collects a drop with production tuning, then checks Play again cleanup.
`tests/incentiveEffects.test.js` covers all ten additional incentives through the real game: reload/swap timing,
bounded healing, deferred secondary kills, coupon composition/consumption, marked-target payouts, slow chase/charge,
capped overtime, three melee charges, sprint pulses, recall interrupts, reward rotation, death/reset cleanup,
concurrent HUD counters, floor zones and target markers.

Gameplay regression tests live in `tests/` (`gameplay.test.js` movement/melee/vault, `aim.test.js` spread
(including the Laser Pointer's hip benefit / ADS penalty through repeated shots and recovery),
`impactMarks.test.js` all six cosmetic signatures, visible-surface/edge checks, floor/ceiling/instanced normals,
misses/targets/pierce/shutters, shared cap/reuse/disposal, map unloading, startup preparation, debug sprites,
Cannon projection budget, unchanged wall-shot payouts/accuracy/ammo and Play-again cleanup,
`startRoom.test.js` clearance-store dressing adds no collision, leaves central/spawn/vault spaces visually clear,
and preserves a real checkout vault and the original Price Gun purchase,
`megaMartDetails.test.js` protects aisle/crossing/entrance/spawn/vault clearance against the actual decorative triangles,
validates geometry and trolley placement, and vaults all four checkouts plus buys the Foam Dart Blaster at its original price,
`zombies.test.js` zombie types/mix/rounds, `maps.test.js` wall pieces, single/multi-zone shared doors, nav rebuilds,
`mall.test.js` the REAL mall built in Node with a stub canvas: dispose leaves no colliders + frees everything, door ladder, spawn points on clear floor, zones
sealed until any connecting door is bought (all 120 orders after the start shutter), shortcut-only entrances,
short nav paths and standing-player crossings in both directions, clear approaches, vaultable counters, the sealed escalator (a real PlayerController sprint-jumping
at it never gets on; you can walk under its high end), the ceiling hole, Food Court stalls/tables (queue spots and
table lanes reachable, nobody gets onto or behind a counter), `corridor.test.js` the modular corridor builder (floors
never overlap, walls never intrude into the walkway, sealed except where asked, doorways/gaps/open ends/branches, a real
nav grid end to end and through a branch doorway), `interactions.test.js` buying against the real mall (every door and wall buy
works from where you stand, both shortcuts buy from either side but not through adjacent walls, the cannon cannot be
bought across its shortcut, the Nail Gun can't be bought through its wall, other floors are out of reach, facing matters),
`ammoCache.test.js` the vending machine (refills any gun in hand, flat price, label follows the gun, needs its area open, not
through the wall, solid + too tall to climb, zombies can reach its front; Atrium/Cinema machines also exercise real F purchases,
correct floor height, ownership and run reset), `balance.test.js` GUN ROLES on real measured numbers
(Cannon strongest up close / weakest at range, round-8 close-blast reliability, Price below premium automatics, Foam's
mid-range advantage, Nail's no-falloff penetration, Staple weakest, and round-8 body-shot targets).
`weaponProgression.test.js` runs real aimed shots, bloom, reloads and upgrades against
stationary round-8/10 targets through helpers/weaponTrial.js (perfect tracking; not a human survival playtest).
`gunStats.test.js` checks the per-hit formula + resolveGun (upgrades as data),
`fullRun.test.js` WHOLE RUNS of the real game headless (tests/helpers/headlessGame.js builds createGame with stand-in HUD/sound/
viewmodel: buy the shutter, rounds, shoot a zombie for exact payouts, die, results, and "Play again equals a freshly built game"
via snapshot(), which covers every stat incl. undeclared extras, run stats, features, prompt and reload; zombies keep walking
after you die; a natural round 1 -> 2; buy Food Court then its shortcut with real F holds and see natural Mega Mart spawns
while its hallway door stays shut; buy the start shutter, repair the escalator and buy the cinema, receive natural cinema
wave spawns, then reset its door/slide state; resetPlayerStats). New cross-system behaviour should get a full-run test there), `events.test.js` the event bus + every payout path
in the real game (body / headshot / box-cutter kills, a shotgun blast pays once per zombie, a non-player "hazard" kill still pays
and counts, purchase / round / player-hit / death / Play-again events, purchase kind/label as it was BEFORE buying, a kill
listener killing another zombie mid-shot pays each once (no +10 for a corpse), pierce/pellet multi-kills, dummies pay nothing,
nothing paid or counted after death), `pricing.test.js` prices = config exactly, discounts
(one category, rounded to economy.discountRoundTo, errors for unknown items incl. inherited names like toString), the real game
charges + shows the sale price for doors, guns, ammo and the cache, a sale starting mid-hold charges the price at completion, a new run clears it),
`upgrades.test.js` gun upgrades (tiers + attachments on every gun, whole magazines/bursts, each tier holds until its round,
one attachment per slot, what fits, roles hold at every tier (near-ties within 3%) and with any one attachment, upgrades live
with the carried gun in the real game), `upgradeDesk.test.js` the Customer Service desk in the real game/mall (one desk in the hallway, LAYOUT.serviceDesk moves
prop + collider + buy spot, solid and too tall to climb, tiers one at a time at pricing's price, gun in hand only, no refill,
nothing past Platinum (including the exact purchase frame and switching back to a Platinum gun), Flash Sale applies,
no prompt while closed / switching / facing away, Play again resets),
`attachmentCounter.test.js` the store counters in the real game/mall (every attachment at its store, real F buys fit the gun in
hand + replace its slot at pricing's price, no prompt when fitted / doesn't fit / area closed / mid switch, cases solid + too tall,
visible glass matches bullet collision, the four stores are real rooms (walls, solid wall-to-wall counter so nobody reaches the
clerk strip, windows are glass, you can walk in), a LAYOUT.stores entry moves a whole store),
`coplanar.test.js` no z-fighting (flicker) in the stores or the Customer Service booth: builds the real mall and checks every box face and
sign in those rooms for another face within 4 mm that faces the same way, overlaps and looks different (hidden faces pressed against a
solid are fine); run it after adding anything to a store (hang things on a wall 2cm+ proud, not on its plane),
`viewmodel.test.js` real player-gun/model recoil with attachments, including firing and dry-clicking immediately after fitting/removing one
before rendering, `weaponModels.test.js` also checks upgrade parts (every gun has every
mount, parts show only when fitted, the Extended Nozzle moves the muzzle + flash and back, tier sticker hidden at Standard, no part
floats), `features.test.js` map features (the mall's list, unknown kind = error, a new kind's update/reset hooks run, inert wall buy for a
gun that doesn't exist, inherited names aren't kinds, features get the game's systems and tick only while playing (not paused /
dead) + reset on Play again, buy a wall gun + refill at the RESTOCK-O-MATIC in the real game);
`spawning.test.js` covers local selection/safety/cooldowns/rescues plus the real mall at six positions with hallway
entrances only, shortcut entrances only, and both loops open. Mall tests also include the real debug range: shifting
grid bounds must not disconnect either shortcut; floor covers both shared walls. The Mart sign clears its brand stripes.
there is no linter yet.
`npm run build` is the compile check (it only bundles; it
does not run the game, so also try changes in `npm run dev`).

## Area ownership

`tests/lateWallGuns.test.js` checks seven unique wall buys, Cinema-only Coil access, both ownership routes, and a real
5250-point Hallway -> Service Corridor -> Cinema -> Coil purchase sequence. The relocated Coil's F-hold purchase,
650-point refill, full-ammo hiding, spawn clearance and restart use the real interaction system.

`tests/areaUnlocks.test.js` buys all nine areas through the real interaction system for 9500 points, verifies all 15 barriers open, automatic connection sound/collision/navigation, reverse destination pricing and mid-hold sales, denied purchases, no cascade, and repeatable reset. Existing geometry tests may use raw door.open/reset to isolate a particular physical route; production purchases use map.areaUnlocks.

`tests/parkingLot.test.js` checks a real discounted parking purchase, player traversal in both directions, flush threshold, restart/disposal, all outdoor spawn routes and lanes with and without the debug range, vehicle collision and the fenced perimeter. It also checks RVs against the actual rendered bay lines and raycasts the exterior from two parking positions with the Atrium closed, before and after static batching. The coplanar test includes the exterior.

The parking detail checks protect the front/rear fighting lanes, both central gaps and every spawn approach from detail
geometry; confirm real trolley collision and complete collider cleanup; and verify haze/sign comfort settings, reset and
shared-texture disposal. Atmosphere tests cover authored loop gain/pulses, local-event range/unlock/pause/reset/no-backlog
behavior, and Web Audio source/panner cleanup for sign rattle, indistinct PA and distant traffic recipes.

`tests/mannequin.test.js` covers fixed-tick observation (aspect/pitch/edges/ADS and world occlusion), release delay,
attack cancellation and real damage, frozen crowd/rescue protection, kill payouts/reset, round mix/health/live cap/quota,
plastic pose retention/resource disposal, real cinema stairs and pause.

`tests/mascot.test.js` runs the round 10 introduction through the live wave and PA systems. It covers health scaling,
the two-alive cap, one kill payout, foam splatter in Red mode, and the one-time half-health rush, pop and stuffing burst.
Shot rays cover the helmet and torso, the smaller exposed head, and a miss through the fallen helmet. Reset removes
the model and debris and disposes their shared geometry and materials.

- `fontsReady.test.js`: startup waits for canvas fonts, never hangs on a stuck network or failed font, and the page boots through the wait.
- `workshopRitual.test.js`, `mascot.test.js` also guard where the two meet: nothing fills the gauge after death, a rescued zombie rises normally, and the Mascot falls out of the Returns Chute with its hitboxes.
- `workshopNames.test.js`: every Stuffing and Heart pair has its own model name; a named gun's record counts its own and its stuffing's kills, survives a re-stuff, and stops at death.
- `workshopBuilds.test.js`: Overstuffed is stronger than Extra Stuffed and recharges its Heart twice as fast. `workshopRitual.test.js`: the certificate's Courtesy Loaner line, returned or lost.
- `limitedEditions.test.js`: the HUD marker's bearing, distance, floor and time. `weaponModels.test.js`: only the Loaner wears the security tag.
- `mascot.test.js`: the warning before the rush, which also cancels a swing; the helmet-pop bonus (gun or melee headshot only, once, never after death); helmets outlive the body, face the player, stop short of walls, go with the round, and are capped.
- `mascotVariants.test.js` (Mascot costumes): every costume resolves to a whole Mascot with its own banner, pop line and head, sharing the base numbers; Sir Waffles is the type itself and the zombieMix slot is untouched. Costumes appear only from their unlock round, lean to home zones (a made-up table, then the real manager in Mega Mart; the Returns Chute has no bias), and one costume draws no dice. With a stand-in manager, the same dice give the same waves with or without costumes, debut rounds aside (+1 Mascot at most). Each debut round opens with its costume and announces it once; the debug key spawns each costume in turn.
- `captainCoupon.test.js`: he walks back, lifts his helmet on and is suited again at 3/4 health with the PA line; only once (the second pop rushes, pays no bonus); he gives up when guarded, too slow, or when the round sweeps the helmet up; a dead Coupon stops (mid-lift the helmet goes with the body); the leftover-helmet cap never evicts the helmet he still wants.
- `poppyCorn.test.js`: the pop flings and stuns zombies in range only (not through a wall), shoves and butters the player only in range, never hurts or pays, once per Poppy and only Poppy.
- `scoops.test.js`: puddles every dropEvery while walking, twice as often bare-headed, none piled up standing still; the slow (player only, really slower walking); the surface collector (lowest factor wins) alone and with the real Janitor's wet floor; the pool never grows; round end, death and Play again clear it. `janitor.test.js` still guards the wet floor through the collector.
- `employeeOfTheMonth.test.js`: every costume's gold version (palette, badge, guaranteedDrop); the round gate and the exact chance threshold, never two alive; health x1.5, the PA line and chime; the guaranteed drop at the body outside the meter (any killer), none after death; the debug key.
- `play.test.js`: the launcher rebuilds only for newer source and watches all of it; the dev server skips folders the game never loads from, but not this checkout's own code, even in a worktree. `singleFile.test.js` now also parses the inline script.

`tests/bossGroundwork.test.js` covers timed speed/damage buffs, hold timeout/source death/player death/reset, voucher stacking and immediate points conversion. Existing Janitor tests guard unchanged behavior.
