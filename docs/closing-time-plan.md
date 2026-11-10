# Closing Time: plan for a run goal, an ending and a final boss

Status: PHASES 1–3 BUILT (10 November 2026, Phase 3 on `codex/closing-time-3`). Phases 4–12 are planned. The ten decisions below are made.
Every number is a starting point for `src/config/closingTime.js` and `config/economy.js`, to be tuned in phase 11. Build one phase at a
time, each in its own worktree.

## The ten decisions (made by the user, 10 November 2026)

1. **Fiction: a staff closing checklist.** Four lines, one per boss, each a closing duty.
2. **Final boss: the Last Customer**, a new character. Working name Lorraine Pruitt.
3. **The one new mechanic: she must be returned.** Damage cannot kill her; at zero she is Speechless and is finished with a Return to Sender
   beam or a hand stamp.
4. **The ending opens as soon as the checklist is done.** There is no round gate: the round after you validate your parking is the Closing
   Time round. This moves the win from the brief's "about round 20" to round 16 or 18 for a player who keeps up (see the numbers below).
5. **After the win: a choice, and overtime is harder.** The receipt offers Clock out or Stay for overtime. In overtime zombies scale faster and
   kills pay more.
6. **Return to Sender is bought:** 10,000 at a Returns Desk, once lines 1 to 3 are ticked. The claw keeps its rare copy.
7. **Prices stay light:** 12,000 for the required steps.
8. **Return to Sender's ammo is sold only at the Returns Desk**, at a steep price. That is the overtime point sink.
9. **A key is a floor pickup**, dropped where its boss fell.
10. **Four boxes always on the HUD**, the full checklist on the pause screen.

## The idea

You are the last associate on shift, and the staff watch on your wrist always reads closing time. The mall cannot close until the
**closing checklist** is done. It has four lines, and each line belongs to a member of staff who is now a boss zombie: beat the boss, pick up
what it drops, and you have the thing that line needs. Three lines are closing duties somewhere in the mall. The fourth is leaving: the last
vehicle in Customer Parking is Skylar Sparkle's van, and her keys start it.

When you try to leave, one customer is still on the premises. She has come to make a return, at closing time. Beat her, drive off, and the
run is WON. You can clock out there, or stay for overtime, which is harder and pays more.

Nothing is hidden. The PA announces the checklist, each key and each line as it opens, and the HUD shows the four boxes all run.

## What the review measured (the numbers this plan is built on)

These come from the review bot's saved runs (`.claude/worktrees/review-fun-1/scratch/out`, summarised with its `report.mjs`). I did not re-run
the bot for this plan. The bot does not do the quest, so the times are for reaching a round, not for winning.

| | good bot, cannot die (3 runs) | average bot, cannot die (2 runs) |
|---|---|---|
| End of round 16 (earliest Closing Time round: Skylar came in 15) | 20.9 min, 62,000 earned | 22.5 min, 60,500 earned |
| End of round 18 (Skylar came in 17) | 24.7 min, 76,000 earned | 33.1 min, 75,800 earned |
| End of round 20 (the brief's target) | 30.3 min, 95,700 earned | 39.2 min, 94,300 earned |
| Earned per round, rounds 15 to 18 | 6,600 to 7,800 | 5,200 to 8,500 |

- **Decision 4 makes the win earlier and shorter than the brief asked for**: 21 to 33 bot-minutes instead of 30 to 39. A player who is slow
  with the duties wins later; nothing forces round 16.
- **Where the surplus is.** The bot's shopping list (nine doors, two guns to Platinum with five Renewals each, two builds, both box cutter
  tiers, two wardrobe items) takes its income until round 23. From round 24 it spends 130 to 670 a round and earns 10,400 to 16,100; one run
  ends round 30 with 105,980 unspent. So the surplus is an overtime problem, which is what decisions 5 and 8 are for.
- **Even round 16 is far beyond the bot when it can die.** In 40 mortal runs the good bot died in rounds 6 to 11 (9 of 20 in round 7) and the
  average bot in rounds 4 to 10. A win assumes the survival fixes from the review's other steps. This plan does not fix that.

## From the brief

- A visible checklist announced by the PA. Endless overtime after the win.
- Reuse what exists: the four bosses' drops are the keys, the parking lot and its vans are the exit and the final arena, and Build-A-Blaster,
  the fountain hazard and the death receipt are used.
- No step depends on claw luck. At most one new mechanic for the final boss. A guaranteed route to Return to Sender.
- Quest steps are point sinks.

## Assumed (say if you disagree)

- **A dropped key can never be lost** (decision 9 needs a rule for a key left behind, and this is it). It lies where the boss fell, on floor
  the player can reach, and never times out: it stays through round changes until it is picked up. While one is down, the HUD points to it the
  way it points to a Limited Edition bag. Murray cannot mop it. A cheaper-to-build alternative, if a key on the floor for ten rounds looks
  wrong: after a while it goes to Lost Property at Customer Service and costs 1,000 to reclaim.
- **The bosses keep their current rewards as well** (Spill Cleanup, Master Key, Signed Approval, Discount Code), so a boss drops two things.
- **A boss must die for its round to end** (it counts as a live zombie in `rounds.js`), so every key has dropped by the end of round 17.
  If a boss ever leaves without dying (the director's 'vanished' case), its key drops at the player's feet.
- **Duties can be done in any order**, each as soon as its key is held, during rounds or breaks.
- **Quest prices are ordinary prices**: a new `closing` category in `g.pricing`, so the Discount Code and Employee Discount apply. There is no
  Flash Sale group for them. Saving Skylar's Discount Code for the parking validation is a choice the player gets to make.
- **No arena lock in the first version.** The Last Customer chases the player like every zombie; the van is in the lot, so the fight ends there.
- **No driving.** "Drive off" is a fade to the receipt.

## The checklist

| # | Line on the checklist | Key (from) | Debut round | Where | What you do | Points |
|---|---|---|---|---|---|---|
| 1 | Water features off | Murray's Key Ring (Mopwater Murray) | 5 or 7 | Grand Atrium fountain | Run the Electrified Fountain until 12 zombies have died in it | 750 an activation (the hazard's own price), about 2 |
| 2 | Takings banked | Kettle's Safe Key (Officer Kettle) | 9 or 11 | Night safe at Customer Service, Main Hallway | Deposit 4,000 points, 1,000 a hold | 4,000 |
| 3 | Last orders signed off | Fairweather's Signature (Dennis Fairweather) | 12 or 14 | Build-A-Blaster | Order, fight for and collect one build (a Restuff counts) | 1,500, or 750 for a Restuff (today's prices) |
| 4 | Car park cleared | Skylar's Van Keys (Skylar Sparkle) | 15 or 17 | The mauve van, Customer Parking bay 4 (about x 55.3, z -11) | Validate your parking, beat the Last Customer, start the van | 5,000 validation |

- **Total the quest requires: 12,000** (11,250 with a Restuff). That is 19% of what the good bot has earned by the end of round 16 and 16% by
  the end of round 18. The four areas it sends you to cost another 4,500 if you had not bought them (Atrium 1,250, Promenade 1,250, Mega Mart
  750, Customer Parking 1,250).
- **Optional: Return to Sender at the Returns Desk, 10,000** (below). With it the quest takes 22,000: 35% of that income at round 16, 29% at 18.
- Each line pays nothing back. The reward is the tick, a PA line and, for line 3, the build you were buying anyway.
- Line 1 counts a kill made by the fountain while it is active. Line 3 counts a 'ritualCollect' that happens while the Signature is held, so a
  build finished in round 7 does not tick it: the point is a second visit, late, when a Restuff or a second gun's build is worth having.

## The ending

1. **Validated.** With lines 1 to 3 ticked and the Van Keys held, the ticket machine by the van takes the 5,000 validation. The PA: closing
   time is the next round.
2. **The Closing Time round.** A normal wave with the Last Customer as its boss, booked through the boss director's own schedule. She enters at
   the lot's delivery gate. The round banner reads CLOSING TIME. If that round is an encore round (20, 24...), she takes the encore's slot.
3. **The return.** Her bar cannot be emptied to death: at zero she is Speechless for 6 s, and has to be returned (below).
4. **The van.** Once she is gone the van's prompt becomes Start the van (hold). Zombies still alive do not matter. Hold it and the run is won.
5. **The receipt.** The results receipt, headed SHIFT COMPLETE instead of the death report, with two buttons: **Clock out** (the run ends
   here, as a win) and **Stay for overtime** (the receipt closes and the next round starts; a later death shows the usual death receipt with
   a CLOCKED OUT line and the overtime rounds survived).

A death receipt gains one line too, the checklist as it stood ("Closing checklist: 2 of 4"), so a lost run shows how close it came.

## Overtime

Overtime starts at the round after the win and never ends. Two things change, both in `closingTime.overtime`:

- **Zombies scale faster.** Health gains an extra x1.03 for every overtime round, on top of the normal x1.075 (so about x1.107 a round).
  Counts, spawn pace and the alive cap stay as they are.
- **Kills pay more.** Kill pay x1.25, written to the stats object's existing `killPayMultiplier` (the Gold Card's stat), so Play again's
  stats reset removes it.

These two pull against decision 8: more pay makes the surplus bigger. The Returns Desk's ammo price is what has to absorb it, and phase 11
measures whether it does. If it does not, lower the pay before raising prices.

## The final boss: the Last Customer

Working name **Lorraine Pruitt, The Last Customer**. She arrived a minute before closing with a full trolley and a receipt.

Everything she does except the return already exists:

| Part | Reused from | Notes |
|---|---|---|
| Trolley charge, telegraphed | Cart Pusher's charge, as Kettle uses it (`type.charge`) | A charge that hits something solid crashes: stunned and taking extra damage. The three vans are solid, so luring her into one is the opening. No new code, only the arena |
| Backup at health thresholds | Kettle's `lockdown.backup` / Skylar's fans | Mall Walkers through the lot's four fence spawns |
| Health bar, intro and defeat banners, sting | `config/bosses.js` fields and the boss bar | Bar notice: "Returns accepted with receipt" |
| **Speechless, then returned (NEW)** | Return to Sender's box-and-stamp effect | See below |

**The one new mechanic: she has to be returned.** Damage cannot take her below 1 health. When her bar is empty she is Speechless for 6 s
(`speechlessSeconds`), and during that window she is returnable: one Return to Sender beam boxes her from any range, or you walk up and hold
interact for 1.5 s to stamp her RETURNED by hand. Miss the window and she stands up at 25% health. So the win never depends on owning the
wonder weapon, and owning it makes the last step safe instead of a 1.5 s hold in the middle of the wave.

Starting numbers (`config/bosses.js`, `lastCustomer`): health 16x a Shopper's (Skylar is 8x, Kettle and Fairweather 10x), which is 19,900 at
round 16, 23,000 at round 18 and 26,600 at round 20; speed 2.6, attack 60, kill value 2,500, backup of 4 Mall Walkers at 66% and 33%.

**A rule this needs:** Return to Sender takes 12% of any boss's maximum health a beam today, so 8 beams (one reload) would empty her bar in
under 10 s. She needs a per-type override of that fraction, read in `gunStats.hitDamage` (starting value 3%). Without it the bought gun
deletes the fight.

## The Returns Desk: the guaranteed Return to Sender and its ammo

The desk stands at Customer Service and has two things to sell, both through `g.pricing.priceOf('closing', id)`:

- **The gun, 10,000**, once lines 1 to 3 are ticked. It is the biggest single sink in the game, it opens at round 12 to 14 at the earliest,
  just as the gun starts to out-kill everything else (1.5x the Coil Nailer at round 15, 2.2x at 20: docs/history.md, 9 November), and it is
  the natural gun for the finisher and for overtime. The claw keeps its rainbow capsule: a lucky grab is a 1,000-point shortcut to a
  10,000-point gun, not the only way to it.
- **Its ammo, 2,500 a refill** (the half-rate refill it has today: the magazine and half the reserve), to anyone holding the gun, whether it
  came from the desk or the claw, and whether or not the checklist is done.

**Nowhere else sells its ammo.** The RESTOCK-O-MATICs (400) and the Prize Counter's ammo refill (60 tickets) refuse Return to Sender and say
where to go. Free refills are unchanged: a Stockroom Delivery and a Refurbished grab still top it up at the half rate. This applies all run,
not only in overtime, so a claw-won copy gets dearer to feed from the day this is built.

## Side systems the quest uses

| System | Used? | How |
|---|---|---|
| The four bosses | Yes, all | One key each. The quest is why you want them dead rather than a tax on a round |
| Boss vouchers | Not required | They help: the Master Key opens an area the quest needs, the Discount Code takes 2,000 off the validation or the Returns Desk |
| Hazards: Electrified Fountain | Yes | Line 1 |
| Hazards: Fryer Blast, Fire Sprinklers, PA Lure (planned, not built) | No | |
| Build-A-Blaster ritual | Yes | Line 3 |
| Customer Parking and its vans | Yes | The exit, the arena, cover that crashes her charge |
| Death receipt | Yes | The win receipt and the checklist line on a death |
| Return to Sender | Yes | The finisher, the Returns Desk and the overtime sink |
| Customer Service booth | As a place | Night safe and Returns Desk stand at or beside it |
| Mall PA, event bus, boss director, career stats | Yes | Plumbing |
| RESTOCK-O-MATIC and the Prize Counter's ammo refill | Changed, not used | Both stop refilling Return to Sender (decision 8) |
| Power-ups (employee incentives) | No | They drop at random; a step that needed one would be a luck step. The key pickup may reuse their drop-placement code |
| Attachments | No | |
| Prize tickets and the Prize Counter | No | Tickets only come from claw grabs |
| Limited Editions (Party Trap, Clearance Rack) | No | Random drops. The key's HUD pointer reuses the bag's |
| GRAB-A-GUN | No | It stops being the only route to Return to Sender |
| Wardrobe, Kiosk Kevin's equipment, wall buys, tiers, box cutter tiers, Flash Sales | No | |

So power-ups, attachments, prize tickets, Limited Editions, the claw, the wardrobe and Kevin can each be cut without touching the quest's
steps. Two small pieces of code are borrowed (drop placement from power-ups, the pointer from Limited Editions) and would have to move, not
vanish, if those systems go. Cutting hazards removes line 1 and cutting Build-A-Blaster removes line 3; either line can be replaced by a
second deposit without changing the rest.

## How it fits the code

- **`src/config/closingTime.js`** (new): the lines, keys, counts, hold times, overtime numbers, PA lines and receipt words.
  **`economy.closing`**: `{ nightSafe: 1000, validation: 5000, returnsDesk: 10000, returnsAmmo: 2500 }`, read through `g.pricing.priceOf('closing', id)`.
- **`src/game/closingTime.js`** (new, `g.closing`): built and ticked in createGame.js; one new `resetSteps` entry. It listens: 'bossDefeated'
  drops a key, 'kill' with source 'hazard' counts line 1, 'ritualCollect' ticks line 3, 'purchase' counts the deposits. It owns the key
  pickups (drop, pointer status, collection, reset).
- **Events it announces** (to add to game/events.js): 'closingKeyDrop' { bossId, position, pa }, 'closingKey' { bossId, pa } (picked up),
  'closingProgress' { line, count, needed }, 'closingLine' { line, done, total, pa }, 'closingValidated' { round, pa }, 'runWon' { summary },
  'overtimeStart' { round }. The Speechless state is a 'bossPhase' like any other.
- **Winning is one function, `onRunWon` in createGame.js**, beside `onPlayerDeath`. It sets `state.won`, emits 'runWon' once and pauses the game
  for the receipt. Clock out then sets `state.over`, so the existing rule holds unchanged: once the run is over nothing is paid or counted.
- **Map features** (data in `map.features`, one module each in game/features/, one registry line each): `nightSafe`, `escapeVan` (the ticket
  machine and the van's prompt, on the existing 'abandoned' van from config/parkingLot.js), `returnsDesk`. No new area, door, zone or spawn.
- **The boss**: a `lastCustomer` entry in config/bosses.js with no `firstRounds`, so `chooseBossSchedule` never picks it; `g.closing` books it with
  a small new `bosses.book(round, id)`. Its behaviour is one file in zombies/bosses/. `met` must not include it, or encores would bring her back.
- **Overtime**: the extra health is a multiplier `g.closing` hands the zombie manager (its `spawn` already takes a `healthMultiplier`); the pay
  is the `killPayMultiplier` stat.
- **Browser side** (main.js, ui/): the four boxes and pause list, the key pointer, the CLOSING TIME banner, the win receipt, the OVERTIME tag.
- **Career stats**: `wins` and `fastestWin`, with a version bump and a migration test (careerStats.js is persisted in localStorage).

## Phases

Each phase leaves the game working and is worth having without the later ones. After phase 3 there is already a complete ending.

| # | Phase | What exists afterwards | Main files (shared files in bold) | New mechanic? |
|---|---|---|---|---|
| 1 | Keys and the checklist | Each boss drops its key; the pickup never expires and the HUD points to it; four boxes on the HUD, the full list on the pause screen, PA lines, "Closing checklist: n of 4" on the death receipt. Changes no balance | config/closingTime.js, game/closingTime.js, **createGame.js**, **events.js**, ui/hud.js, **main.js**, **debugCommands.js** (a keyless `closing` command) | No |
| 2 | The win, headless | `onRunWon`, 'runWon', Clock out and overtime as game state (overtime rounds unchanged for now); the van's prompt wins once all four keys are held; career `wins` | **createGame.js**, game/features/escapeVan.js, **features/index.js**, **mall.js** (one feature entry), careerStats.js | No |
| 3 | The win, browser side | The SHIFT COMPLETE receipt with its two buttons, the OVERTIME tag, the checklist's fourth box | **main.js**, ui/, style.css | No |
| 4 | Line 1: the fountain | Murray's Key Ring opens the count; 12 fountain kills tick it | game/closingTime.js, features/fountainHazard.js (mark its kills) | No |
| 5 | Line 2: the night safe | The safe, the deposits, the `closing` price category | features/nightSafe.js, **economy.js**, **pricing.js**, **mall.js** | No |
| 6 | Line 3: last orders | A build collected while the Signature is held ticks it | game/closingTime.js only | No |
| 7 | Parking validation | The ticket machine and its 5,000; the PA calls closing time for the next round; the van now also needs lines 1 to 3 | features/escapeVan.js, **economy.js** | No |
| 8 | The Last Customer, reused parts only | She is booked for the Closing Time round, charges, crashes into vans, calls backup, and dies like any boss; the van needs her gone | **config/bosses.js**, **bossDirector.js**, zombies/bosses/lastCustomer.js, **economy.js** (kill value), config/deathReports.js | No |
| 9 | The return and the Returns Desk | Speechless, the two ways to return her, the per-boss Return to Sender fraction, the desk selling the gun and its ammo, and the two ammo machines refusing it | zombies/bosses/lastCustomer.js, **weapons/gunStats.js**, features/returnsDesk.js, features/ammoCache.js, features/prizeCounter.js, **economy.js**, **mall.js** | **Yes, the one** |
| 10 | Harder overtime | The extra health per overtime round and the kill pay | game/closingTime.js, zombies/zombieManager.js (read the multiplier), config only otherwise | No |
| 11 | Measure and tune | A bot that does the quest: minutes to the win, points in hand at the win, what share of income the quest took, how often the finale kills, and what overtime does to the surplus. Prices, her health and the overtime numbers set from that | tools/ (the review's bot is throwaway and gitignored: copy what is needed), config only | No |
| 12 | Spectacle | Her model and trolley, the van's lights and engine, music for the last round, the receipt's art | models, audio, ui | No |

Notes for whoever builds a phase:

- **Phases 4, 5 and 6 are independent** of each other and of phases 2 and 3, and can be built in any order or in parallel worktrees. Until a
  line's duty is built, holding its key ticks its box. So after phase 3 the ending is: four bosses, their keys, the van.
- **Phase 1**: the key must land on floor the player can reach (a boss can die on an escalator, on a counter or against a wall; power-ups
  already solve this placement). Test that a key survives a round change and Play again removes it, and that two keys can lie at once.
- **Phase 2 is the risky one.** It is the first time a run ends without a death. Everything that listens for 'playerDeath' or reads
  `state.over` needs a look: death music, the results delay, career stats, pointer lock, the idle saver. Overtime must leave no trace
  of the pause. Run the full suite, not test:quick.
- **Phase 4** needs the fountain to say which kills are its own. 'kill' carries only source 'hazard', and three more hazards are planned.
- **Phase 5 and 9** add things at the Customer Service booth, which already has two windows where the nearest wins the prompt. Pick positions
  with the prompt tests and tests/coplanar.test.js; the Prize Counter is on the same wall (x -13).
- **Phase 8**: with no round gate she usually comes at round 16 or 18, but a late player can land on an encore round (20, 24...). Booking her
  in the director's schedule is what stops two bosses arriving together; test a Closing Time round at 20 has exactly one.
- **Phase 9**: the hand return is an interaction that exists only while she is Speechless. It must lose to nothing: check it against a held
  reload and against the van's prompt if she falls beside it. The ammo change touches tests/instantKill.test.js (the half-rate refill at the
  machines) and the claw's odds report, which values a copy partly by what it costs to feed.
- **Phase 10** changes zombie health, a shared system: run the full suite and `npm run balance`.
- **Tests**: one file, tests/closingTime.test.js, grown a phase at a time (and described in docs/tests.md, or tests/docs.test.js fails). Build
  the map before seeding `Math.random`. Each phase adds a history entry and its folder-structure lines.
- **The shopping window** (branch `claude/shopping-window`, in progress: a 20 s break with a hold to end it early) fits this: duties are things
  to do in the break. Nothing here depends on it.

## Risks

- **Reaching round 16 at all**, as measured above. If the survival fixes do not land, the ending is something only the bot's immortal runs see.
- **The win is earlier than the brief asked for** (decision 4): round 16 to 18, 21 to 33 bot-minutes. Phase 11 reports the real figure. If it is
  too short, the lever is a round gate in config, not more duties.
- **The quest competes with upgrades.** At round 16 the bot is still spending nearly all it earns on its shopping list, so the 12,000 comes out of
  guns and tiers, and it is a bigger share of income than it would have been at round 20 (19% against 12.5%).
- **Overtime pay against the overtime sink**, as said under Overtime.
- **HUD space.** A fifth permanent element next to the outfit rail, pockets and incentive HUD. docs/ui-readability.md is the judge.
- **Line 3 and the loadout.** The ritual takes a gun away for a fight. Doing that at round 14 is harder than at round 7.
- **A slow fountain.** Twelve fountain kills is easy with a crowd and tedious with two zombies left. The count wants measuring in phase 4.
- **Two drops from one boss.** A key and a voucher land together; the key must read as the one that matters.
