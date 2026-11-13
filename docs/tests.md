# Sunset Galleria: what each test file covers

`tests/challenges.test.js` covers all eleven Mastery challenges, per-gun and burn attribution, single unlock/PA/toast feedback, the 150/400 thresholds, eligibility before/after assistance and death, fans, reset and new-game persistence, one write for 50 non-unlocking kills, monotonic save merging, corrupt/missing/newer/throwing storage, debug add/complete/clear (including retry), and toast cleanup. It also covers the review fixes: a round replayed after Save & Quit is paid once (unit and real game, including a second save part-way and an unlock earned before the save), and Quit to title, Restart run and a closing page write new progress exactly once.

`tests/skinPatterns.test.js` covers every slot 2 pattern skin with a stub canvas: its palette roles land exactly as the same skin without a print would, only body-coloured meshes are printed (one material swapped, the same meshes: no draw call added; labels keep their own textures), the canvas starts as the body colour, top and right faces sample the upper region (a top face never leaning left), left faces the lower one, other faces the blank strip, every gun prints its top and its left side, after the print the keep-out round the sticker mount is painted back to the body colour and covers the build patch's and the warranty seal's corners, the held gun and its display share one texture, and default, wall-display and mastery builds carry no print.

`tests/challengeBoard.test.js` covers the Challenges tab and the tracker: pins go up to three in pin order, toggle off, are written each time and read back, a fourth is refused, a newer stored version is never overwritten and a blocked store keeps them in memory; the catalogue lists every weapon skin challenge by gun with its sentence, slot tag and progress (a feat's best attempt), and finds an entry by its pin id; a tracker line reads a running total from the save, a feat's attempt in progress in its own `track` words, and Done once earned; the board opens from the title (with the flyover), shows a gun's three challenges, pins, refuses a fourth with the "full" line, unpins, and goes back on B; the tracker setting is a Comfort toggle, off by default, and the board notes it while off; the tracker shows every pinned line in pin order when a pinned one moves (never for an unpinned one) and hides after showSeconds; a lost attempt is struck through with "Failed" and one soft sound, drops off, and comes back with the next attempt; Play again hides it; while off nothing shows or sounds.

`tests/skinTreatments.test.js` covers the slot 3 skins' treatments: all four kinds in use and every peak under skinTreatments.maxGlow; per feat skin, the same meshes as the plain recolour (no draw call), only unlit materials painted in its role are lit (same paint and finish, everything else untouched), the glow moves and stays within its low..high over a few periods (a shimmer: a band DataTexture sliding at high intensity), and the display wears it with its own controller; a shimmer's U runs along the gun from 0 at the back and its band moves toward the muzzle; the model's own animation still runs (the scanner's window brightens on charge, untreated); default, wall-display, mastery and pattern builds carry none.

`tests/featChallenges.test.js` covers the eleven slot 3 (feat) challenges (weapon skins phase 7): every gun has one, with a treatment and a tracker line; for each one the full feat from a fresh run unlocks exactly its skin (with the slot 3 PA line, written at once), the nearest attempt does not, and nothing counts while assisted; a feat records its best attempt, never a sum; the tracker hears an attempt fail (a body shot breaks a streak, a hit or a fall spoils a calm round, another gun spoils loyalty, which keeps the round reached); a debug jump decides no round and spoils loyalty; nothing after the death or on a noRewards fan; Save & Quit keeps a streak, the bosses so far, spoiled loyalty and the round a round feat is on, and Play again starts every feat over. In the real game: a kill's `woundedBy` (no zero-damage wounds) and lethal `projectile`, and a gun's 'hit' naming its gun.

`tests/closingRewards.test.js` covers the Closing Time rewards (weapon skins phase 9): every gun ends with the same two shared skins (slots 4 and 5, looks only, no print, After Hours the Classic one); a win on Directed unlocks Employee of the Month on all eleven guns with one notice and one receipt line, a win on Classic both (After Hours the better), and a later win announces nothing; a debug-assisted run, a flagged run, a summary that is not a win, an unknown mode and a death earn nothing; both can be equipped per gun; in the real game the summary records its mode and a win unlocks through the event bus, the win receipt listing the reward once; the badge finds one mesh of its own on the left face of every gun's model and display, clear of the sticker mount; After Hours lights every gun's trims; the Challenges tab lists the rewards once, under Closing Time, with one pin for all eleven guns.
`tests/roleChallenges.test.js` covers the eleven slot 2 (role) challenges (weapon skins phase 6): for each one a case that counts, the nearest case that must not, a single unlock with the role PA line, nothing while assisted or after the death, and a round replayed after Save & Quit paid once; noRewards fans in shot-based challenges; a magazine is the shots between refills. In the real game: a hitscan kill's `distance` and `firstWound`, a burn's null distance, a tennis ball kill's `bounces`, the Leaf Blower's `interrupted` hits, a real three-kill Confetti Cannon blast and a quick Price Gun kill, and the Nail Gun's magazine in progress saved at the round start, cleared by Play again and back after Continue.

`tests/killAttribution.test.js` checks the gun ID on the real kill event for direct fire, piercing hits, bosses, bouncing balls, all damaging builds, melee, hazards, equipment, Inventory Liquidation, and debug kills. It also checks out-of-world rescue, attribution after changing guns, and the scripted fight's wallet, counters, and receipt against the main baseline.

`tests/hazards.test.js` covers environmental hazards (docs/archive/hazards-plan.md): Grand Atrium Electrified Fountain, Food Court Fryer Blast, Main Hallway Fire Sprinklers, and Service Corridor PA System Lure triggering, `g.pricing` ('hazard') and Flash Sale discounts, Kiosk Kevin nearest-prompt-wins alongside the Fire Alarm Pull on the south hallway wall, active/recharging cooldowns, `source: 'hazard'` kill payouts (including fryer opening burst vs pulse scaling, normal zombie slip via `applySlip`, bosses ignoring `applySlip`, sprinkler chill + soak via `applyVulnerable` on zombies, bosses, and Mascots, and PA lure holds via `applyHold` + feedback pop with bosses ignoring `applyHold`), 3 m Service Corridor held-crowd failsafe & boss/unheld passage checks, Closing Time line 1 counting fountain kills only (`'fryerKill'`, `'sprinklerKill'`, and `'paLureKill'` leave line 1 untouched), Mascot helmet pop and regular power-up meter exclusions, Gold Mascot drops, boss/Mascot damage cap, player self-shock/scald and surface slow while standing inside (reported through game/surfaceSlows.js as its own source, so it never overwrites or wipes another slow), the stand-clear grace (the fountain and fryer spare the player for a moment after the switch is thrown, never the zombies), the sprinkler pull never taking the Food Court gate's prompt anywhere along the closed gate, nothing paid after death, Play again (`resetRun`) snapshot equality, and words-only prompt checks.

`tests/rounds.test.js` covers round flow, remaining wave occupancy tracking, waveEnding event firing, HUD occupancy presentation, the Last Shopper acceleration, and the shopping window: the break is long enough to shop and clocking in saves most of it, rounds.endBreak (lead time, seconds skipped, never lengthens a break), Clock in (a fresh full hold, once per break, not before round 1, not on the buy button, ignored behind a menu, offered again next break), the real game's PA line and early round, and the HUD prompt.

`tests/influencerModel.test.js` shoots the visible face during idle, movement and flash poses, checks that the compact
filming rig stays beside the head, verifies ponytail/phone animation, and checks costume buffer/material disposal.

`tests/bossPolish.test.js` walks Manager/Guard from every open zone and into the workshop without rescue; checks unique stings, death feedback, direct order-form voucher consumption, fans excluded from ritual credit, actual Employee Discount expiry, death/reset voucher cleanup and debug ids. Isolated headless Chrome captured all four models with zero browser exceptions; no real browser tabs were opened.

`tests/bossEncores.test.js` checks configurable cadence, type/Mascot debut exclusions, known-boss selection, one boss per round, alternatives and Play again.

`tests/influencer.test.js` covers follower crossings/headshots/viral reset, half-health fans and cap/queue/departure/round completion, no hit or kill rewards, filming cells in every open zone and workshop, physical routing upstairs without rescue, flash windup/looking away/Comfort, and voucher ordering/savings cap.

`tests/guard.test.js` covers lockdowns in every area, occupancy waiting, ownership preservation, three radio headshots, expiry and cleanup on every exit, quota-funded backup and round completion, taser telegraph/damage/movement/slow expiry/miss vulnerability, and Master Key door redemption/conversion.

`tests/manager.test.js` covers exact meeting cancellation, failure buff expiry, report target cap/visibility, every meeting cleanup path, reward collection, booth redemption and automatic conversion at the voucher tier cap.

`tests/debugCommands.test.js` also checks the overlay's grouped commands, selected next gun, active boss,
god mode, refresh timing and accessible visibility. (Keyless commands such as 'pockets' are not in its key table: tests/equipment.test.js checks that one.)

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

`tests/reviewFixes.test.js` covers review fixes: a free attachment refit keeps the Discount Code (a paid fitting and `spendVoucher` with a full-discount voucher still spend it), a boss voucher left on the floor while another is held pays its points on expiry, Signed Approval survives its gun being away at Build-A-Blaster, and a boss killing the player mid-update neither skips the next zombie's tick nor lingers after it.

`tests/announcer.test.js` covers the mall PA table (game/announcer.js) in the real game: a system's line shows with a chime and an event without one is silent, Closing Time lines and return labels only in Directed (the key sound in both, before the chime), a collect line before its certificate, a Flash Sale ended by a new run is silent, and features.instanceOf / instancesOf.

`tests/loop.test.js` covers the fixed-step loop surviving errors: a throwing tick, look input or render is caught on its own while the other stages and the next frame still run, a tick that always throws is used up rather than piling up owed ticks, a broken reporter is harmless, and the default report prints each distinct error once, not every tick.

`tests/idleSaver.test.js` covers the idle saver: awake / dim / asleep by time, a live run never throttled and the count starting when the game stops running, settings read live, an unfocused window counting as nobody there, the loop's frame cap / pause / resume (no replay of the sleep), the browser half (keys, pointer, wheel, focus, visibility, controller buttons and sticks, mute off, dispose) and the three settings.

`tests/fallAndLedge.test.js` covers fall damage (free short drops, damage per metre past the safe drop, god mode and the damage scale, stairs and jumps free) and the balcony rail climb (over the rail, onto the floor below, about 40 damage, measured from the balcony floor; refused from below and where the landing is blocked; the same rails work walking or sprinting, at any angle up to 60 degrees and from a standstill, and the Vault prompt shows exactly when a jump vaults; along every rail the climb is offered on at least 70% of the railing, and every drop it offers ends standing on the floor or an escalator).
`tests/workshopDetails.test.js` covers the room's detail pass: solid pieces only in corners (a lane of 2.5 m kept round the island), each solid piece too tall to stand on or a vaultable counter, entrances / bench / booth / lever / chute landings clear, every piece inside the shop or hall culling rooms, no added lights, and a triangle and draw budget.

`tests/workshopRitual.test.js` covers the ritual in the real game: the price, handing over, the Courtesy Loaner, kills counting only in the room, quality thresholds, the maximum time,
walking away and coming back, conveyor stages, the lever and booth only answering at the right time, gun purchases mid-ritual, upgrades staying on the gun, Play again and death
mid-ritual, the chute steering spawns only while you are in the room, a full round where the chute adds no zombies and the round still ends, and the debug shortcut.

`tests/warranty.test.js` covers the Extended Warranty rules (game/warranty.js): each tier's job, Renewals (compounding, priced one by one, capped), a replaced gun's warranty on file and moved onto the gun in hand for a share of the price, a gun away at Build-A-Blaster leaving nothing, the Platinum claim once per round, and Play again clearing it.

`tests/skins.test.js` uses the pre-edit `fixtures/weapon-materials-phase-1.json` baseline and the isolated `helpers/gunMaterials.js` capture runner to check material colours, emissive colours, names, finishes, geometry and canvas labels. It exercises test-only role palettes, including identical colours across roles, and rejects model colour literals outside canvas drawing.

`tests/skins.test.js` compares every Staple Gun and Rivet Rifle material colour with the pre-skin models, checks role placement and fallback, and exercises the debug override and the visual layers on skinned guns.

`tests/upgradeColors.test.js` covers the colour languages of upgrades: every warranty colour (steel, gold, pearl, Renewal copper) is far from every stuffing colour in Lab delta-E, the tiers and the stuffings and the Heart badges are told apart, every Heart has a badge colour and shape, every tier is metal and Platinum shimmers, and a better quality is more vivid and glows more.

`tests/gunStyle.test.js` covers how upgrades change a gun's shape (config/gunStyle.js): on every gun the warranty collar is chunkier tier by tier with a swinging tag, Renewals add studs on Platinum only, a build puffs the body with a pillow each side that grows with the quality and a glowing seam, all three show at once within a draw budget, and attachments are drawn chunkier. On every gun the build patch, the warranty tag and each collar have a dark rim just outside them in the rim ink (the patch's drawn by the stitch mesh, the tag's merged into its print, one rim mesh per collar inside the metal).

`tests/workshopPower.test.js` covers the power rework: a build powers the gun up by its quality and beats any warranty tier, the two stack, the gun returns loaded and refilled, Smoothie's extra damage, Popcorn Butter's slip (and its hitboxes, double headshots, immunity, bosses), Antifreeze's shatter and shards, Reload's only-with-a-zombie-close, the status glow, and the proc flash.

`tests/workshopBuilds.test.js` covers finished builds: every Stuffing + Heart pair set off for real, a Last Round miss, Reload's blast and cooldown, Every 10th counting only that gun's kills, puddles, Antifreeze's chill then shatter, Hearts per gun, burn ticks and no stacking, kills paying once, stuffing kills not firing a Heart, the Heart cooldown, walls and floors
stopping stuffings, quality scaling, picking at the bins and the Heart wall, today's stock and area stocking, re-stuffing, stacking with tiers and attachments, and the round curve (a stuffing adds less than the gun itself, one proc never kills a full-health zombie from round 5).

`tests/workshopNames.test.js` covers names (unique in a run until the list runs out, kept through a re-stuff), the Birth Certificate's fields and wording, the PA lines in order, the HUD label, and "Survived by" in the run summary, even for a gun still at the workshop. `tests/receiptReview.test.js` covers performance review evaluations, receipt lines, and the Form 109-C Incident Report cause of termination and loss prevention tip across all lethal sources (no keyboard keys in the tips; every hazard that can hurt you has its own report).

`tests/workshopSpectacle.test.js` covers ritual mode: moving parts out of batching, no added lights, tank fill and colour, kills flying into the tank and paying once, returns tumbling out of the chute, the lever, the arm, the jingle, the belt, PA narration priority, stuffing-coloured tracers, and Play again putting every part back. `tests/weaponModels.test.js` checks the stitched look on every gun: anchored to the gun, gun-sized, cheap, reversible.

`tests/limitedEditions.test.js` covers the drops: nothing on sale any more, bag zombies only, from the right round, one at a time, only what you can use, fitting free and keeping the gun's other upgrades, waiting for a swapped-away gun, not reachable through a floor, running out, and Play again.

`tests/zombieConfusion.test.js` covers Glitter's AI: fighting the nearest zombie, ignoring the player, kills paying once, walls and floors, standing dazzled alone, immunity afterwards, who can't be confused, Glitter on a real headshot, a round still ending, and its balance.

`tests/attachmentRework.test.js` covers paid run unlocks, discounted first purchases, free refits across replacement guns,
ownership reset, reload blocking, ammo conservation/full-reserve overflow, fully-owned sale eligibility and four-slot builds.

> Moved out of CLAUDE.md (verbatim) so the file every session loads stays small. Read it to find the test that guards something before you change it, or to see where a new test belongs.

The title mode chooser is tested for its order (Directed first) and default focus, focus on the remembered mode, Back by button, Escape or controller, and mode confirmation.
`tests/menus.test.js` also checks that the run mode is remembered through game/settings.js (no tab, in no preset, kept by Reset everything), and that starting from the chooser
(ui/runStart.js) stores the mode and plays once with no reset and no Fresh shift screen, the chooser staying up until play starts and a late pointer lock after Back being refused.
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
`tests/music.test.js` covers Galleria FM: note and chord parsing; six songs that each parse into a full form with drums, an early melody, notes in range and a length of 1.5 to 2.8 minutes; deterministic renders that are stereo, never clip, leave headroom, open with the station chime and have no silent stretch; tape wear by round (none with the horror layer off); and the radio player on fake Web Audio (only the playing song and the next rendered, a crossfade near the end with the next from its top, each song announced once and a resume not, the place kept across pauses, music volume alone, every song once before a repeat and never one twice running, a new run moving on, the tape's pitch sag and the timeline running at the sagged speed). It also covers the End of Shift death sting: receipt-timed bell, music volume, cancellation of future
notes, replacement-voice cleanup, and real-game death/reset wiring.
Phase 9 in `tests/closingTime.test.js` checks the all-source damage floor, Speechless freeze and timeout recovery, both real returns through the normal kill path (including weaponId), the per-type beam fraction, a long-range beam, and the hand hold winning over the nearby van and held reload. The desk tests cover each duty, full price and Discount Code, two-slot replacement, half-rate ammo without duties, full refusal, reset and separate prompts for all Customer Service windows, safe and Prize Counter.
`tests/saveGame.test.js` checks the purchased gun and ammunition through the existing loadout step, and a Speechless encounter rolling back to a fresh booked boss.
Phase 8 in `tests/closingTime.test.js` checks the booked-only boss, next-round scheduling including the round-20 encore slot, CLOSING TIME banner,
parking-gate entry, accepted return and van refusal/unlock, encore exclusion after winning, reset, crashes into all three vans and both quota-funded backup thresholds.
`tests/saveGame.test.js` saves the break before Closing Time and verifies the restored round still brings exactly one Last Customer with no validation PA replay.
Phase 7 in `tests/closingTime.test.js` checks each missing key and duty at the ticket machine in both modes, affordability, one paid validation, the next-round PA, discounts preserved on refusal and consumed on payment, the van blocked before validation and winning afterwards, and reset. The mounted machine stays within the van's bay, clear of the lot's spawns and approach.
`tests/closingTime.test.js` follows boss keys from defeat or disappearance to clear-floor drops and collection.
It also covers a Classic run that wins with every duty done: its short prompts (the safe and the van name the missing key, the van then names an unfinished duty by its place),
the key and duty sounds in both modes with no quest PA in Classic, career credit, run mode retention on reset, the fountain switch's count in both modes,
and mode-dependent markers, checklists and receipts (closingDone null from g.receiptFor is the one value for "no checklist line").
It checks one drop per boss alongside the usual rewards, persistence through round changes and cleanup, simultaneous drops, checklist events and PA, the death receipt, and Play again.
`tests/overtime.test.js` covers Closing Time's harder overtime: zombies and bosses spawned in overtime have the round's normal health times the per-round multiplier compounded by overtime round (first, fifth, tenth),
counts and the alive cap are unchanged, kill pay stacks with the Gold Card and is applied once, a Clock out and the time before the win change nothing, a save in overtime round 3 loads with the right health and an undoubled pay,
and Play again puts both back to normal.
`tests/closingTime.test.js` also checks the real van's hold and missing-key prompt, the paused win, Clock out, normal next-round overtime with the same loadout,
career credit on overtime death, and version 1 career migration with fastest-win persistence.
Phase 3 checks receipt modes and controller choice, and the clocked-out and completed-overtime lines on a death receipt.
The fix pass checks that the van refuses with four keys and an unfinished duty and names it; that the Van Keys tick nothing and the win ticks line 4 (3 before the van, 4 after, headless);
that a won run left from the menu is recorded once and a never-won one is not; that a win in the break keeps the announced round while a win mid-wave moves on;
that a boss voucher on the floor survives Stay for overtime and still pays on expiry (a debug skip deletes it); the once-per-run PA briefing; the Statistics wins, fastest win and won mark;
that a newer-version career save is left untouched; that a key from a boss killed on an escalator ramp or against a wall rests on clear floor and is collected there;
that a boss vanishing while the player is mid-jump drops its key once they come down; that Play again after a lost run, win + overtime + death, Clock out and leaving from the menu
equals a fresh game (`snapshot()` in tests/helpers/headlessGame.js includes the checklist, keys, pickups and win flags); and the HUD's four boxes, counts and key markers.
`tests/powerUps.test.js` also checks that the incentive HUD names a boss voucher lying on the floor and never throws on a pickup id it does not know (a throw in render stops the frame loop).
`tests/retailUi.test.js` also covers the PA queue's `keep` rule: a kept message survives a full queue and a preemption, and other messages trim and preempt as before.
Phase 4 checks that the key opens the fountain count, only fountain kills advance it (including bosses and Mascots), the tick and PA fire once, and Play again resets the duty.
Phase 5 checks the night safe’s prompt alongside both Customer Service windows and the Prize Counter. It covers refusals,
priced deposits with both discounts, four-hold completion, PA, and reset.
Phase 6 checks actual workshop collections before and after the Signature pickup, orders already running at pickup, Restuffs,
ritual pricing, both PA announcements, one tick per run, and Play again.

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
`mall.test.js` the REAL mall built in Node with a stub canvas: every material gets its colour (no Three.js "value of undefined" warning), dispose leaves no colliders + frees everything, door ladder, spawn points on clear floor, zones
sealed until any connecting door is bought (all 120 orders after the start shutter), shortcut-only entrances,
short nav paths and standing-player crossings in both directions, clear approaches, vaultable counters, the sealed escalator (a real PlayerController sprint-jumping
at it never gets on; you can walk under its high end), the ceiling hole, Food Court stalls/tables (queue spots and
table lanes reachable, nobody gets onto or behind a counter), `corridor.test.js` the modular corridor builder (floors
never overlap, walls never intrude into the walkway, sealed except where asked, doorways/gaps/open ends/branches, a real
nav grid end to end and through a branch doorway), `interactions.test.js` buying against the real mall (every door and wall buy
works from where you stand, both shortcuts buy from either side but not through adjacent walls, the cannon cannot be
bought across its shortcut, the Nail Gun can't be bought through its wall, other floors are out of reach, facing matters),
`clawMachine.test.js` GRAB-A-GUN through real input: the odds (by weight, no repeats, never the Staple Gun / a carried gun / one at
Build-A-Blaster), sweep timing, the press decides the prize, a held button never drops it, controller X never reloads, walking away
and death never hang it or leave a display, Play again equals a fresh game, sales / Employee Discount charge less and the Discount Code
doesn't apply, wallet.refund isn't income, the replace ticket, and each cabinet: one tall collider, clear stand point, reachable front,
a prompt from it. Relocation: plush odds by grab, a plush refunds exactly the charge (sale + coupon) and picks the next open site at
once, a sell-out closes only after its last prize, it reopens at a different open site at 'roundStart' (or restocks in place), never
in a locked zone (40 moves), never mid-grab, Play again after a move, and zombie routes from every spawn and stand point unchanged
(within 3 m) with all six cabinets in. Refurbished: a carried gun's attachment is for an empty slot and rolled with it, a full one isn't
offered, the take refills and fits it in hand or not (and refits are free), never over a fitted attachment, waits while reloading; late
changes (bought off the wall meanwhile: refill + spare; no longer carried: plain copy; handed to Build-A-Blaster: plain copy that the
finished gun replaces); Build-A-Blaster: grabs during a ritual, with the Courtesy Loaner (which never gets a Refurbished prize and still
goes back), a Refurbished attachment stacking with a build, and while the finished gun waits at the booth.
`clawSunny.test.js` Sunny runs away in the real game: from every site the next site is picked at the plush and he walks a real route on the
zombies' grid (only open floor) there, climbs in and the cabinet shakes and comes back to rest; with part of the mall locked his route stays
on open floor; with no other site open he walks a lap and climbs back in; a round starting first opens the machine there and he still
arrives; shooting him (real input) pops him for 25 tickets and re-picks the site, with no kill, no +10, no power-up credit and no kill stats;
the box cutter pops him too; aim assist (assistable) and the vault (blocksVault) skip him; Play again mid-walk equals a fresh game.
`prizeCounter.test.js` GRAB-A-GUN's prize tickets (game/tickets.js) and the Prize Counter through real input: tickets are their
own count (paid only while alive, spent only when enough, tokens, reset); every prize refuses without enough tickets (nothing spent) and
costs exactly its tickets and no points; each prize works (refill, Slow Claw doubles the next sweep, an attachment for an empty slot and
owned, a free grab, a keychain in the run summary); the voucher keeps the counter's rules (not mid-reload, never over a fitted slot, not
for the Courtesy Loaner); tickets never touch points, pricing or income, are lost on death and gone on Play again; the booth has one
tall collider, a clear reachable spot at every prize, no spawn within 5 m and unchanged zombie routes. clawMachine.test.js checks
every grab outcome's tickets; receiptReview.test.js the receipt's ticket and keychain lines.
`economySim.test.js` the economy sim (npm run sim:economy; tools/economyBot.js, economyPlans.js, economyModel.js): the bot plays two rounds headless, buys its
list in order at the shelf price, and its books balance (every point earned has a round and a source, every point spent a logged purchase);
a proposal changes config numbers in memory only and puts them back, and a typo in a proposal's path is an error; every proposal and every
buy order points at config that exists (a renamed door, gun or tier fails here, not in a 40-minute run); the maths side reads config (wave
shares add up, a weaker gun earns more from the same wave, the ladder's prices are the shop's); the claw step only wants guns the bot can fire.
`kioskBalance.test.js` Kiosk Kevin's balance bar (phase 7, from tools/kioskBalance.js, the maths `npm run kiosk` prints): no product is a
must-buy at round 2 (each costs at least 40% of what round 2 pays, and no pocket thrown into crowds deals more per point than the Price Gun's
own wall ammo at any round); the Soda Bomb at round 25 is weaker, not useless (40 to 60% of a Shopper at the centre, a Shopper's worth from a
crowd, a pocket at most 5% of the round's income) and power keeps rising every round; a full Bubble Wrap absorbs less than the player's
health and less than doubles Shopper hits to death, and those hits to death match the real game's health; the report prints every section.
`clawSim.test.js` GRAB-A-GUN's odds (tools/clawOdds.js): the wall stays the cheaper way to every specific gun even at perfect
timing, a site lasts 5 to 6 grabs, perfect timing never meets the plush while a random lane often does, better timing wins dearer guns,
and a plush grab costs nothing. clawMachine.test.js also plays the 'claw' Flash Sale (the PA, the sale price charged and refunded, the
Discount Code still kept out). The show: prongs open and shut and the capsule swings but the prize is still the one pressed,
the chute flap swings and rests exactly where it was built, the sounds (jingle, lane ticks, motor, fanfare; nothing from across the mall),
the hum follows the live machine and is silent while closed, a dust-sheeted cabinet hides its claw, the attract screen takes turns, and
every PA list has a few lines naming the area where it should.
`ammoCache.test.js` the vending machine (refills any gun in hand, flat price, label follows the gun, needs its area open, not
through the wall, solid + too tall to climb, zombies can reach its front; Atrium/Cinema machines also exercise real F purchases,
correct floor height, ownership and run reset), `balance.test.js` GUN ROLES on real measured numbers
(Cannon strongest up close / weakest at range, round-8 close-blast reliability, Price below premium automatics, Foam's
mid-range advantage, Nail's no-falloff penetration, Staple weakest, and round-8 body-shot targets; those compare the guns of the WALL, so a `clawOnly` gun is left out of them and has its own job test: the Leaf Blower only tickles, shoves harder than any bullet, reaches a few metres, runs its tank 4-8 s and refills in 4-9 s; the Tennis Ball Launcher is below the Price Gun at every range at one hit a ball, with a few bounces, a short seek and a best ball under a point-blank cannon blast; Return to Sender kills more zombies a second than anything else from about round 12, twice as many from round 20, but never more than about one a second, and carries and refills well under a round-25 wave).
`weaponProgression.test.js` runs real aimed shots, bloom, reloads and upgrades against
stationary round-8/10 targets through helpers/weaponTrial.js (perfect tracking; not a human survival playtest).
`gunStats.test.js` checks the per-hit formula + resolveGun (upgrades as data),
`fullRun.test.js` WHOLE RUNS of the real game headless (tests/helpers/headlessGame.js builds createGame with stand-in HUD/sound/
viewmodel: buy the shutter, rounds, shoot a zombie for exact payouts, die, results, and "Play again equals a freshly built game"
via snapshot(), which covers every stat incl. undeclared extras, run stats, features, prompt, reload and both equipment pockets (the messy run throws a Soda Bomb that is still on its fuse when you die); zombies keep walking
after you die; a natural round 1 -> 2; buy Food Court then its shortcut with real F holds and see natural Mega Mart spawns
while its hallway door stays shut; buy the start shutter, repair the escalator and buy the cinema, receive natural cinema
wave spawns, then reset its door/slide state; resetPlayerStats). New cross-system behaviour should get a full-run test there), `events.test.js` the event bus + every payout path
in the real game (body / headshot / box-cutter kills, a shotgun blast pays once per zombie, a non-player "hazard" kill still pays
and counts, purchase / round / player-hit / death / Play-again events, purchase kind/label as it was BEFORE buying, a kill
listener killing another zombie mid-shot pays each once (no +10 for a corpse), pierce/pellet multi-kills, dummies pay nothing,
nothing paid or counted after death), `pricing.test.js` prices = config exactly, category & per-item discounts
(rounded to economy.discountRoundTo, per-item Doorbuster discounts isolate one id, Flash Sale / Doorbuster + employee incentive coupon stacking unchanged, errors for unknown items/categories incl. inherited names like toString), the real game
charges + shows the sale price for doors, guns, ammo and the cache, a sale starting mid-hold charges the price at completion, a new run clears it),
`upgrades.test.js` gun upgrades (tiers + attachments on every gun, whole magazines/bursts, each tier holds until its round,
one attachment per slot, what fits, roles hold at every tier (near-ties within 3%) and with any one attachment, upgrades live
with the carried gun in the real game), `meleeUpgrades.test.js` the box cutter tiers (the desk's second window, tiers one at a time at pricing's price, damage x1/x3/x5 stacking with meleeDamageMultiplier, Sharpened keeps one target and the plain cone, the Pro hits the nearest two and reaches wider, walls still block, the 70-point melee bonus per kill and the helmet-pop bonus at every tier, Play again), `upgradeDesk.test.js` the Customer Service desk in the real game/mall (one desk in the hallway, LAYOUT.serviceDesk moves
prop + collider + buy spot, solid and too tall to climb, tiers one at a time at pricing's price, gun in hand only, no refill,
nothing past Platinum (including the exact purchase frame and switching back to a Platinum gun), Flash Sale applies,
no prompt while closed / switching / facing away, Play again resets),
`saveGame.test.js` also pays parking validation through the real machine, keeps the round-start rollback rule, restores validation and points without another charge, and verifies no closingValidated event or PA replays on load.
`saveGame.test.js` covers Save & Quit: every Play again step is either saved or named transient (so a new system has to decide); a load gives back the run as it was at the START of the round (points earned and areas bought mid-round are gone), at that round's break, with the slot used up, and what the loaded game would save is exactly what was saved; a replay keeps the same boss schedule, Flash Sale and feature state; a gun away at Build-A-Blaster with the loaner in hand comes back the same; saving needs a started round, a live player and full health; an older version's save is dropped, never loaded; saving is not a death (no runEnd, no career record).
`saveGame.test.js` covers Save & Quit: every Play again step is either saved or named transient (so a new system has to decide); a load gives back the run as it was at the START of the round (points earned and areas bought mid-round are gone), at that round's break, with the slot used up, and what the loaded game would save is exactly what was saved; a replay keeps the same boss schedule, Flash Sale (including pending teasers and active Doorbuster item discounts), and feature state; a gun away at Build-A-Blaster with the loaner in hand comes back the same; saving needs a started round, a live player and full health; an older version's save is dropped, never loaded; saving is not a death (no runEnd, no career record); Kiosk Kevin reopens where he stood at the round's start (not the first site, and not where a mid-round move took him) and does not move again on the load; a save made with a SPIN-O-MATIC Sentry out loads without one (the pockets as of the round's start).

`secondChance.test.js` covers the Customer Service purchase and shared pricing, the one-use limit, lethal Cart Pusher charges, falls and fountain shocks, the local shove, paused protection, the PA, the final receipt, and Play again; that a hit or a hard landing during the protection is not announced at all (no 'playerHit' / 'playerFall', no outfit tag, no shove of the player) and is an ordinary hit again afterwards; that the revive itself is not read as the Cardigan soaking a hit; and that 'secondChance' announces held / used / available once each, with Play again mid-protection leaving the new run unprotected.
`tests/effectWords.test.js` guards the words-only rule: the size bands (fixed, ordered, symmetric, {size}/{Size} fill), the number detector, and a scan of every tier, It also covers GRAB-A-GUN: every claw and Prize Counter string in config and the real prompts they build (pay, drop, take, Refurbished, each prize card) carry no stat number and no multiplier word; the claw sale keeps its percentage.
renewal, attachment, wardrobe, stuffing, heart, incentive and boss string (and a Flash Sale line's words around its percentage) plus the real prompts built from them (every attachment counter, every Customer Service
offer, every wardrobe ticket and rail line) for a digit followed by %, x, s, m, ° or an arrow, and spelled-out percentages.
`tests/outfitRail.test.js` covers the outfit rail's brain: every item names a known trigger, icon and colour (and every slot a silhouette); each trigger,
driven through the real game (events, real keys for sprint / slide / aim, real zombies, a real refill), pulses only the worn items that name it,
all 12 items across three outfits; the Cardigan only when the hit landed above the base max health; an owned-but-not-worn item never pulses; a gun swap is
not a refill and a fan actor's kill is not a paid kill; nothing pulses after death; the death summary's `wearing`; Play again clears the rail; the snapshot's
lines are right (upsides first, numbers equal the live stat).
`tests/wardrobe.test.js` exercises all 12 racks and three fitting rooms with real input, fixture clearance, PadX tap vs. hold,
apparel discounts, reset, stat stacking and clamps, live ammo and combat modifiers, and Gold Card payouts.
The fitting-room picker: every one of the 81 outfits is put on through key presses (two at most inside a slot), it is free and spends
neither the Discount Code nor Employee Discount, the player stands still while it is open, and it closes on back, a zombie hit, being moved
away, death and Play again. Tickets are WORDS ONLY: every factor has a direction and exactly one line in its item, every rack ticket has an upside and a downside with no digit in it, the size words
follow the fixed bands and do not move with running incentives, and a replacement is named.
Limits: no item raises jump, vault height or walk speed, and the fastest outfit sprints slower than a Cart charge. Clothes scale a
'playerHit' but not a fall; 'regenStart' fires once per recovery; the debug command grants everything without undressing you; the
aim-assist multiplier scales the rotational follow on a controller only.
The Wardrobe test also checks solid clearance, label sightlines and room culling from four angles per display.
`tests/showpieces.test.js` covers the Food Court showpieces: a clear 2.4 m approach (in or along the front), the shop door lane free of their solids,
no spawn within 2.5 m, prompts 1.2 m apart and each its own item's, the standable rule (step / vaultable / 2.1 m, nothing climbable on the roof),
a clear sight line from across the entrance doorway to each one's tallest part (the burger lid, the NO RUNNING sign, the fingertip), the burger
under the 6 m ceiling at the top of its bob and its pose with the duct gap above Burger Barn leaving it room,
no coplanar faces against each other or the mall, idle motion while unsold, the buying pose (still lit, PA line, 'wardrobeBuy') then still + dim +
SOLD OUT card and banner, Play again unsold, and the motif only within range while unsold.
The other nine fixtures add continuous 2 m approaches, clear bases and spawn/door lanes, entrance-facing signs, independent Customer Service
and fitting-room prompts, coplanar checks on rotated fixtures, and the same idle, register, PA, sold-out, reset and motif checks. Both Shoe-Per Sale
fixtures and its mirror retain their own prompt, and the upstairs motifs stay on their floor.
`tests/wardrobeAppearance.test.js` checks sleeve changes across all guns, ADS, finished workshop combinations and limited editions, plus a real fitting-room
swap, shoe footfalls and slide sparks, the look-down pack and board, the melee foam finger, paid Gold Card popups and the regen tick.
It also checks geometry against the reticle ray and confirms HUD styles, reticle and reserve rendering during equip and Play Again.
`tests/coplanar.test.js` checks the new signs and axis-aligned display faces against nearby surfaces. A second test there checks EVERY flat sign in the mall (by its real world normal,
so a sign hung with flipped Euler angles, like atmosphere.js's, is not skipped) against every box face that faces the same way and shares its plane, ignoring anything hidden behind a
solid or in a switched-off group; it caught the hallway directory flickering against the boarded vent's planks.

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
floats), `features.test.js` map features (the mall's list, unknown kind = error, saves keyed by feature name so a reordered map with a new feature still restores, an old place-keyed save still loads, a saving feature without its own name = error, a new kind's update/reset hooks run, inert wall buy for a
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

- `concourse.test.js`: the concourse pass stays cheap (painted panels one mesh per area on one atlas, one glass mesh, one mesh per glow set, campaign and lanes), its floor pieces obey the standable rule and keep clear of spawns, and the canvas atlas gives each cell its own pixels.
- `fontsReady.test.js`: startup waits for canvas fonts, never hangs on a stuck network or failed font, and the page boots through the wait with fonts from the local bundle (no font host).
- `typefaces.test.js`: the type system. Every role uses a bundled family and weight; every sign kind and poster typeface names real roles; every configured font has an @font-face, a file and an OFL/Apache licence and is waited for at startup; NO module writes a raw font string (a typo or system fallback would silently draw in the wrong face; the HUD/minimap are exempt); drawType/fontFor shrink to fit, apply treatments in order, leak no canvas state, and an unknown role throws.
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

## Files not described above (filled in 8 November 2026)

- `autoGraphics.test.js`: the first-launch preset pick: tiers by frame rate, measured once after a warm-up, hidden windows and hitches ignored, never on a later launch.
- `benchmark.test.js`: the benchmark report maths, a whole route driven frame by frame (warm-up skipped, every shot visited, renderer put back), cancel, Shift+B; and no shot's camera path passes through a collider (the Food Court dolly once ran through two shops' walls).
- `cartPusher.test.js`: the Cart Pusher from round 6 (mix, health, value, its intro), the telegraph then a straight charge, standing still gets you run over.
- `coilAndScanner.test.js`: the Heavy Coil Nailer (rate, drum, reload, piercing two, model animation) and the Barcode Scanner.
- `decor.test.js`: every decoration model builds valid floor-standing geometry within budget; scatter is deterministic per seed and keeps off colliders and keep-clear areas.
- `escalatorWalk.test.js`: the escalator is a real way up once repaired (a player walks up and down, zombies path both ways) and blocked while its barrier is up.
- `flashSales.test.js`: Flash Sale timing, PA warning teaser (`flashSaleSoon`, 10 s lead time, go-live eligibility re-check, quiet cancel, reset), category discounts in 5% steps from 25 to 50%, Doorbusters (weight, `fromRound` gate, per-item 65-75% discount, 20 s window, PA item+area line, round-scaled capped open-zone shopper rush: exactly that many spawns go through `zombies.spawn` with the near open markers, pay normal points, and a round (also one with a break-time rush) still ends once everything is dead), in-world pooled 3D `saleTagView` marks (teaser/live/Doorbuster/beacon/removal) and its dispose(), an Extended Warranty sale marking the Customer Service desk, attachment Doorbusters only for an attachment that fits a carried gun, and real-game checks.
- `levelTwo.test.js`: the Promenade: closed in, a standable floor, the well fenced, vents sealed until the escalator is repaired, balcony voids you cannot walk into.
- `lightPool.test.js`: N real lights follow the camera to the nearest lamps, fading rather than popping, copying flicker, skipping lamps that are off.
- `metalSheen.test.js`: only metal materials without a reflection of their own get the shared sheen, each once; paint and mirrors are left alone.
- `navFloors.test.js`: zombie navigation over several floors and stairs on small synthetic maps (a floor with no link is unreachable). Standing still keeps the field in hand, but a wall that goes or a step (the same position object, moved) still redraws it.
- `neon.test.js`: the neon stroke font (every character), text sizing and multi-line, facing like kit.sign.
- `newGuns.test.js`: burst fire (Foam Dart Blaster) and the Confetti Cannon's shells and reload, plus upgrades on a carried gun through resolveGun.
- `posterTextures.test.js`: every poster kind builds (unknown kinds throw); the hallway hangs them 3 cm proud with their copy in config.
- `ramps.test.js`: walkable ramps: surface height, walking up and down without falls, jumping off, walking under, switched off.
- `rivetRifle.test.js`: the Rivet Rifle's auto fire, magazine and reserve, its role against the Foam Dart Blaster, hip bloom and tighter ADS.
- `roomCulling.test.js`: rooms and portals are consistent, what is drawn follows doors and the view, room meshes on their layers, batching keeps rooms apart.
- `runIntro.test.js`: the PA's run-opening line on round 1 only, every run including Play again; it changes nothing else.
- `setPieces.test.js`: each solid set piece is one collider, too tall to climb and clear of spawns, buy spots and doors; the TV wall and arcade animate and hold still when switched off.
- `settingsPresets.test.js`: every preset sets real settings of its own tab to valid values; Standard comfort is the defaults; Graphics presets differ in resolution.
- `staticBatch.test.js`: batching the real mall: far fewer meshes, every triangle kept, nothing dynamic or see-through merged, the escalator barrier still hides, dispose frees it.
- `titleCamera.test.js`: the title flyover plays shots in order and loops, glides and looks where each shot says, fades only at cuts; a map without shots is an error.
- `uiReadability.test.js`: the run's notice history (kept, bounded, reset apart from PA visibility) and UI/text scale saved independently of render resolution.
- `vhsFilter.test.js`: the VHS filter: off by default, untouched by Graphics presets, and its pass runs only when on (even with Visual effects Off).
- `visualEffects.test.js`: Visual effects High / Low / Off on a stand-in renderer (Off skips the composer), and the Video presets that set it.
- `zoneGrading.test.js`: each area's colour grade and haze, easing between areas, late hours multiplying onto a grade (a dark room only gets darker), the setting, and every Graphics preset deciding it.
- `zombieRim.test.js`: the edge glow's colour per kind (bosses, every mascot costume, mannequins), applied once to opaque standard materials, one shared shader program; the dark edge drawn last, every material sharing one daylight value, bright views dark-edged and dim views (back of house, power cuts) light-rimmed, blended in between.
- `beacon.test.js`: beacons share geometry and same-colour materials, the ring pulses out and fades; a power-up on the floor and a dropped Closing Time key each show one where they lie and lose it when they go.
- `detailCulling.test.js`: Small detail manages only small textured printed meshes (not big signs, neon, glow, plain props or dynamic parts), hides far ones on near / close, brings them back on all, never re-shows what another system hid; Potato and Low use it, Medium and High don't; sign canvases sized by metres within min..max.
- `wallBuyMerge.test.js`: mergeByMaterial makes one mesh per material with the same bounds and root transform; every gun that hangs on a wall merges to under half its meshes and keeps its size.
- `fuel.test.js` / `coneBlast.test.js`: the Leaf Blower's two engine pieces alone. The tank refills by itself after a delay, running dry locks the trigger until `restartAt`, a Weapon on a tank has no reload, a refill or new run unlocks it, a plain gun is untouched. The cone finds only living targets inside its range and angle (a wide body at the edge counts, height is forgiving), a wall blocks it (an `ignoreShots` box does not), the shove is stronger up close and gentler on a Mascot, a close zombie goes down, a boss or a zombie already sliding is left alone, the +10 pay ledger, and real zombies pushed down the hallway.
- `instantKill.test.js`: Return to Sender, the wonder weapon: hitDamage's instant kill (any returnable zombie, at any health) and the big fixed hit on a boss or Mascot (tiers and the damage stat scale it, never a kill), a round-30 Shopper returned in one beam with the normal kill pay and only one zombie a beam, a boss takes the big hit twice over two beams, the half-rate refill (a refill fills the magazine and half the reserve, `isFull` agrees, nothing is taken away, other guns refill fully), desk/claw availability, paid-refill refusal at all RESTOCK-O-MATICs and the Prize Counter (including full ammo), unchanged free Stockroom refills, and a stuffed build still returns in one beam with the Last Round heart firing.
- `equipment.test.js`: The Soda Bomb's damage curve, blast falloff and wall cover, fixed boss share, keyboard and
  controller pocket actions, shared lockout, reload cancellation, ballistics, payouts, debug controls and cleanup.
- `equipmentStatus.test.js`: Kiosk Kevin phase 5, the Glitter Bomb and the Sparkler Cake in the real game. The tickets are words
  only and name bosses. The card confuses Shoppers, a charging Cart Pusher (the charge is called off) and a Mascot round it, through
  applyConfusion with source 'equipment' and swings scaled by equipmentPower; a boss and anything out of reach are untouched, and the
  card hurts and pays nobody. A confused zombie's kill pays the kill value through 'kill' only (no 'hit', no +10, no meter) and it never
  turns on you. The cake lights Shoppers, a Cart Pusher and a Mascot with the round's burn (source 'equipment') and a boss at half
  strength, sprays for its time then is gone; its kill pays through 'kill' only, nothing after death. The gold Mascot still drops its
  power-up when a cake burn or a confused zombie kills it. Real input: G throws a cake that lands on the floor and sprays, middle click
  a card that opens where it lands. Death and Play again leave no cake behind.
- `sentry.test.js`: Kiosk Kevin phase 6, the SPIN-O-MATIC Sentry in the real game. Its ticket is words only; it rotates through the
  Lethal slot and is never Kevin's Pick, while every other product gets its turn. Thrown with G it deploys on the floor where it
  lands, adds no collider, and shoots only the nearest zombie it can see, every shot a body hit of the round's damage with weaponId
  'sentry'. It never targets Sunny, a dummy, the dead or a zombie behind the shut start shutter, and its shot passes Sunny to the
  zombie behind. Its kills pay through 'kill' only (source 'equipment', weaponId 'sentry', no headshot, no 'hit', no +10, no meter);
  a boss takes full damage. One out at a time (a second throw keeps its charge), it falls apart after its lifetime
  ('sentryExpired'), stops while paused, is gone on death, and Play again leaves nothing.
- `kiosk.test.js`: Bubble Wrap's damage order, cap and reset. All six products bought through real input at the cart (each slot
  rotates round by round, the Pick goes to whatever has waited longest; a Sparkler Cake replaces the Soda Bombs, a Sentry the
  cakes, in their pocket), Pick bonuses, hiding, pricing and vouchers (phase 7: Kevin's Flash Sale group waits until his cart is open,
  not before round 2 or behind the locked start shutter, and ends back at the shelf prices; the Discount Code halves the Sentry once and is
  spent by that purchase, which is one Sentry (never the Pick); the Master Key and Signed Approval never apply). Air Horn input, cover, charge interruption, Mascot weight,
  boss immunity and zero payout. Kevin's five sites (phase 4): each has one collider (a vaultable counter or >= 2.1 m),
  a clear stand point zombies reach, no zombie spawn within `spawnClearance`, a real prompt there, and ducking measured
  from that cart; the carts leave every spawn's route to the hub alone (no more than 3 m longer); he opens first in
  the Hallway at round 2 and moves from round 3 with the PA naming the place (one line a round); 40 round starts with
  part of the mall locked only ever open him in an open zone, always somewhere new, and with nowhere to go he stays;
  a round that starts during a held buy waits for it (the site is already picked) and Play again puts him back.
- `ballistics.test.js`: the Tennis Ball Launcher's bouncing ball alone: gravity's arc, a spent ball (time, bounces, too slow, `clear()` silent), a wall and the floor reflect it at the restitution, a zombie is hit for the gun's damage (head or body), the ball is sent on at the nearest other zombie in view (not through a wall), passes through the zombie it just hit to the one right behind, skips corpses, and the real mall's floor is solid to it.
- `tennisBallLauncher.test.js`: the gun in the real game: claw-only (no wall price, the wall-buy feature refuses it), one pull is one ball and one shot, each zombie a ball touches is a hit (+10 each, one accuracy hit per throw, a kill pays), a ball in the air when you die is gone, THE ROLE (a lone zombie in the open is one hit a ball, a clump in a line is three or more times that, a lone zombie in the Service Corridor is hit again off the walls), the reload, upgrades, Play again.
- `leafBlower.test.js`: the gun in the real game: claw-only (no wall price, the wall-buy feature refuses it even with a price), holding fire pulses and burns fuel, pushes and drops a close Shopper and only tickles it, pays the +10 only now and then and a kill when it kills, a boss isn't moved, the tank runs dry / locks / refills / unlocks, no reload, upgrades (Jumbo Pack = bigger tank, Speed Loader = quicker refill, Extended Nozzle = longer reach), a refill and Play again put everything back.
- `controls.test.js`: accessibility toggle settings registration (toggleSprint, toggleCrouch, toggleAds; no Comfort preset changes them), crouch flip with low-ceiling headroom checks, sprint latching on tap, ADS toggle with sprint/switch cancellation, and the toggles together in the game's tick order: toggle ADS can aim out of a sprint (which ends it), a toggle-sprint press while aiming lowers the sights and starts the sprint, and a sprint press stands up from a toggled crouch.
- `damageDirection.test.js`: relative damage angle calculation across camera yaws (0° front, 90° right, 180° back, 270° left), headless createGame playerHit vector emission, and HUD multi-arc damage indicator presentation and cleanup.
- `hud.test.js`: compact secondary weapon HUD indicator in the vitals area: inactive weapon name, switch key, loaded / spare ammo, warranty tier dot / build swatch pip, update on weapon pickup and switch, cleanup on run reset, and DOM-free headless compatibility.
- `docs.test.js`: every file in src/ has an entry in docs/folder-structure.md, every test file is described here, and every doc CLAUDE.md links to exists.
- `testRunner.test.js`: the test runner (tools/runTests.mjs): MALL_TEST_JOBS parsing and its ceiling; only runs of more than 8 files take the machine-wide lock; one holder at a time, only the holder releases, a dead run's or a too-old lock is taken over, an unreadable lock file counts as held briefly then stale. It uses its own lock file, never the real one.

`tests/uiInformationPriority.test.js` checks exhausted reward visibility, first-activation benefit teaching, live timers/charges on repeat pickups, run reset, and workshop countdown/quality priority.


Weapon locker (phase 5):
- tests/locker.test.js covers all eleven guns, Default plus both skins per gun with each challenge's own sentence and progress, readable locked challenges/progress, immediate durable equip/Default, mouse, arrows, controller A/B, all Back paths, the unchanged Play mode chooser, rendering only while open, and disposal of real preview geometries/materials/label textures.
- tests/skinEquipment.test.js covers real held models, mid-run wall purchases, the player's conveyor model and built return, default displays, invalid saved choices, Play again/fresh storage, exact Save & Quit round trips with skin/challenge state, run-only receipt names, all skin/stuffing/tier contrast pairs (each passes directly or through the dark rim ink, which itself contrasts with every stuffing and tier; a cream body shows what the rim opens up) and concurrent preference writes. Maps are built before any random mocking. It also checks that only default gun models exist at start, that a skinned model is built once on first use, and that it wears and sheds the sleeves like the rest.
- tests/locker.test.js covers all eleven guns, readable locked challenges/progress, immediate durable equip/Default, mouse, arrows, controller A/B, all Back paths, the unchanged Play mode chooser, rendering only while open, and disposal of real preview geometries/materials/label textures.
- tests/skinEquipment.test.js covers real held models, mid-run wall purchases, the player's conveyor model and built return, default displays, invalid saved choices, Play again/fresh storage, exact Save & Quit round trips with skin/challenge state, run-only receipt names, all skin/stuffing/tier contrast pairs and concurrent preference writes. Maps are built before any random mocking. It also checks that only default gun models exist at start, that a skinned model is built once on first use, and that it wears and sheds the sleeves like the rest.

Staff Survival Guide:
- tests/guide.test.js covers the book (one page per zombie type, Mascot costume and boss; a zombie finds its own page, gold on its own; no hole in any text; quoted facts equal the config), the stages (unseen, memo, notes, tip; only the Shopper starts open), the record (blank from bad storage, unknown pages dropped, memory-only counting, merge with another tab, a newer record never overwritten), the counters (silent first sighting, PA on a new paragraph, never a write per kill; fans, assisted runs and kills after death ignored; a Save & Quit round counted once; a quit writes once), the developer shortcut, and the real game (each kind of kill on its page, a boss seen on arrival, the PA line, a quit reaching storage).
- tests/guideScreen.test.js covers the screen: every page listed by section with unseen ones as ??? and no model, what a page shows at each stage and how many more it asks for, the per-section complete count rebuilt on reopening, Back by button, Escape and controller B freeing the preview exactly once, keyboard and controller walking the index, and the real preview building, posing and freeing every subject without WebGL. After the binder restyle it also covers: the stage on the sheet and its rubber stamp, the pen notes and the sticky note arriving one stage at a time, the right form per section (a boss is a personnel file with its extra line), the captioned photo and camera number, the blank form for an unseen page, tally marks in fives with the number written out past the cap, and the page-turn callback firing once per different page.

Lost and Found:
- tests/lostFound.test.js covers the items (eleven, one per area, a tag line, a cue sound that exists, a small model wearing the property tag), the record (logged for good and written at once, announced with the count, never twice, nothing on an assisted run or after death, kept beside the kill counts, unknown items dropped, an older record read as nothing found, another tab merged), the developer shortcut, and the real game: every item is in the map once, clear of colliders, within reach of a walkable point and offers ITS OWN prompt from there; the badge is logged by holding the use key, costs and pays nothing, and stays as a faded item with no prompt on the next shift; the cue plays near an unlogged item and not from across the room.
- tests/guideScreen.test.js also covers the Lost & Found pages: an item not found gives away no name, tag or area; a found one shows them with its model; the summary stays sealed with the count until all are logged; the preview shows and frees a prop.

The Return (Return to Sender quest and labels):
- tests/returnQuest.test.js covers the quest alone (the steps only in order; a crash far away, on another floor or a zombie merely near does not count; only kills near the desk on its floor by real zombies are served; the number is called once; the gun is reissued free when lost), the labels (one per working duty, issued once, the slot cycling through those held and back to none), one-run rules (serialize / restore mid-quest with no announcements, reset, nothing after death), that its words and sounds exist and the claw keeps the gun as its smallest weight, and the real game: the signs are in the map, clear of colliders, shootable, pay nothing, fall and stand up again on a new shift; the desk's prompt at every stage, a cart crashed beside it leaving the parcel, 47 beams calling the number, the free issue that is not a purchase, the ammo counter afterwards and the reissue; labels announced in Directed only and fitted at the slot only with the gun in hand; Chain Return and Product Recall returning exactly who they should and never a Mascot, a boss, another gun's kill or a stuffing's; Full Refund's bonus and its round back up to the cap; Save & Quit keeping the quest.
- tests/closingTime.test.js: the desk no longer sells the gun or waits for the duties, and the gun the quest issues is free and spends no Discount Code. tests/lostFound.test.js also covers the Challenges tab's Lost and Found entry and its tracker line.

Phase 11 extends `economySim.test.js` with a short quest-driver run: mode selection, inherited real purchases and balanced wallet, without fabricated keys or quest progress. Full route and overtime measurements are exercised by sim:closing rather than long unit-test jobs.
The quest tool's accounting regression also checks the first overtime row (whose roundStart precedes overtimeStart), ammo/all-spend separation, net bank change, and the payload-free playerDeath event's real health source and location.
The quest policy also reserves parking money before optional ammo and keeps its last beam for Speechless, with an immediate switch back to perform the return.
- tests/minimap.test.js covers the mall directory: both floors and every area on one, upstairs holes, every ramp on both floors, every shutter on the floor of its doorway, places only of the listed kinds (never lost property, refund signs or the horror layer) with wall buys naming their gun; the store index (numbers 1..n, every place on it, the attachment counters as one entry, every kind in a group); every area coloured, every place with a pictogram, every shutter with a doorway; the corner naming your area; the live state (you, bought zones, shutter prices only where one side is bought, an opened shutter leaving the board, active/teased Flash Sale and Doorbuster markers on open/adjacent items only, nothing about zombies), Kevin's cart only while open, a dropped key only with guidance; the binding (Tab and PadBack, shared with no other action, on the Controls screen; the setting hidden by default); and the board on the fake DOM: tap toggles the corner map and reports it, a hold shows the directory with prices and the index (gun names, Kevin's cart) without toggling, nothing in a menu, a press carried out of a menu does nothing.
