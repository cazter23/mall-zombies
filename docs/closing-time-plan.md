# Closing Time: plan for a run goal, an ending and a final boss

Status: PLAN ONLY (10 November 2026, branch `claude/closing-time-plan`). Nothing here is built. Checked against main at 7d633bf.
Every number is a starting point for `src/config/closingTime.js` and `config/economy.js`, to be tuned in phase 10. The ten decisions at the
end are the user's: no phase should start before the ones it names are answered. Build one phase at a time, each in its own worktree.

## The idea

You are the last associate on shift, and the staff watch on your wrist always reads closing time. The mall cannot close until the
**closing checklist** is done. It has four lines, and each line belongs to a member of staff who is now a boss zombie: beat the boss and
you get the thing that line needs. Three lines are closing duties somewhere in the mall. The fourth is leaving: the last vehicle in
Customer Parking is Skylar Sparkle's van, and her keys start it.

When you try to leave, one customer is still on the premises. She has come to make a return, at closing time. Beat her, drive off, and the
run is WON. You can clock out there, or stay for overtime and play on for as long as you last.

Nothing is hidden. The PA announces the checklist, each key and each line as it opens, and the HUD shows the four boxes all run.

## What the review measured (the numbers this plan is built on)

These come from the review bot's saved runs (`.claude/worktrees/review-fun-1/scratch/out`, summarised with its `report.mjs`). I did not re-run
the bot for this plan.

| | good bot, cannot die (3 runs) | average bot, cannot die (2 runs) |
|---|---|---|
| End of round 17 (every boss has debuted) | 22.8 min | 30.5 min |
| End of round 20 | 30.3 min | 39.2 min |
| Points earned by the end of round 20 | 95,700 | 94,300 |
| Earned per round, rounds 17 to 20 | 6,900 to 10,900 | 6,800 to 10,400 |

- **Where the surplus is.** The bot's shopping list (nine doors, two guns to Platinum with five Renewals each, two builds, both box cutter
  tiers, two wardrobe items) takes its income until round 23. From round 24 it spends 130 to 670 a round and earns 10,400 to 16,100; one run
  ends round 30 with 105,980 unspent. A player who stops at Platinum has the surplus several rounds earlier.
- **Round 20 is far beyond the bot when it can die.** In 40 mortal runs the good bot died in rounds 6 to 11 (9 of 20 in round 7) and the
  average bot in rounds 4 to 10. A round-20 win assumes the survival fixes from the review's other steps. This plan does not fix that; it
  makes sure a run that dies early has still ticked something (the first key arrives in round 5 or 7).

## Decided (from the brief)

- A win at about round 20. Endless overtime continues after it.
- A visible checklist announced by the PA.
- Reuse what exists: the four bosses' drops are the keys, the parking lot and its vans are the exit and the final arena, and Build-A-Blaster,
  the fountain hazard and the death receipt are used.
- No step depends on claw luck. At most one new mechanic for the final boss. A guaranteed route to Return to Sender.
- Quest steps are point sinks.

## Assumed (say if you disagree)

- **A key can never be missed.** It is granted the moment its boss dies ('bossDefeated'), with no pickup on the floor and no timer. The boss
  still drops its current reward as well (Spill Cleanup, Master Key, Signed Approval, Discount Code).
- **A boss must die for its round to end** (it counts as a live zombie in `rounds.js`), so anyone who survives round 17 holds all four keys.
  If a boss ever leaves without dying (the director's 'vanished' case), its key is granted anyway.
- **Duties can be done in any order**, each as soon as its key is held, during rounds or breaks.
- **Quest prices are ordinary prices**: a new `closing` category in `g.pricing`, so the Discount Code and Employee Discount apply. There is no
  Flash Sale group for them. Saving Skylar's Discount Code for the parking validation is a choice the player gets to make.
- **No arena lock in the first version.** The Last Customer chases the player like every zombie; the van is in the lot, so the fight ends there.
- **No driving.** "Drive off" is a fade to the receipt.
- **Overtime changes nothing about the rounds.** Encores, health and counts go on as they do today.

## The checklist

| # | Line on the checklist | Key (from) | Debut round | Where | What you do | Points |
|---|---|---|---|---|---|---|
| 1 | Water features off | Murray's Key Ring (Mopwater Murray) | 5 or 7 | Grand Atrium fountain | Run the Electrified Fountain until 12 zombies have died in it | 750 an activation (the hazard's own price), about 2 |
| 2 | Takings banked | Kettle's Safe Key (Officer Kettle) | 9 or 11 | Night safe at Customer Service, Main Hallway | Deposit 4,000 points, 1,000 a hold | 4,000 |
| 3 | Last orders signed off | Fairweather's Signature (Dennis Fairweather) | 12 or 14 | Build-A-Blaster | Order, fight for and collect one build (a Restuff counts) | 1,500, or 750 for a Restuff (today's prices) |
| 4 | Car park cleared | Skylar's Van Keys (Skylar Sparkle) | 15 or 17 | The mauve van, Customer Parking bay 4 (about x 55.3, z -11) | Validate your parking, beat the Last Customer, start the van | 5,000 validation |

- **Total the quest requires: 12,000** (11,250 with a Restuff): 12.5% of what the good bot has earned by the end of round 20. The four areas it
  sends you to cost another 4,500 if you had not bought them (Atrium 1,250, Promenade 1,250, Mega Mart 750, Customer Parking 1,250).
- **Optional: the Returns Desk, 10,000** (below). With it the quest takes 22,000, 23% of the same income.
- Each line pays nothing back. The reward is the tick, a PA line and, for line 3, the build you were buying anyway.
- Line 1 counts a kill made by the fountain while it is active. Line 3 counts a 'ritualCollect' that happens while the Signature is held, so a
  build finished in round 7 does not tick it: the point is a second visit, late, when a Restuff or a second gun's build is worth having.

## The ending

1. **Validated.** With lines 1 to 3 ticked and the Van Keys held, the ticket machine by the van takes the 5,000 validation. The PA:
   closing time is the next round, or round 20 if that is later (`closingTime.finalRound: 20`).
2. **The Closing Time round.** A normal wave with the Last Customer as its boss, booked through the boss director's own schedule (so it takes
   round 20's encore slot rather than adding to it). She enters at the lot's delivery gate. The round banner reads CLOSING TIME.
3. **The return.** Her bar cannot be emptied to death: at zero she is Speechless for 6 s, and has to be returned (the one new mechanic, below).
4. **The van.** Once she is gone the van's prompt becomes Start the van (hold). Zombies still alive do not matter. Hold it and the run is won.
5. **The receipt.** The results receipt, headed SHIFT COMPLETE instead of the death report, with two buttons: **Clock out** (the run ends
   here, as a win) and **Stay for overtime** (the receipt closes and the next round starts; a later death shows the usual death receipt with
   a CLOCKED OUT line and the overtime rounds survived).

A death receipt gains one line too, the checklist as it stood ("Closing checklist: 2 of 4"), so a lost run shows how close it came.

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

Starting numbers (`config/bosses.js`, `lastCustomer`): health 16x a Shopper's (Skylar is 8x, Kettle and Fairweather 10x: 26,600 at round 20),
speed 2.6, attack 60, kill value 2,500, backup of 4 Mall Walkers at 66% and 33%.

**A rule this needs:** Return to Sender takes 12% of any boss's maximum health a beam today, so 8 beams (one reload) would empty her bar in under 10 s. She
needs a per-type override of that fraction, read in `gunStats.hitDamage` (starting value 3%). Without it the guaranteed gun deletes the fight.

## The guaranteed Return to Sender: the Returns Desk

When lines 1 to 3 are ticked, the Returns Desk opens at Customer Service and sells Return to Sender for 10,000, with its ammo afterwards at wall
buy rules. It is the biggest single sink in the game, it opens at round 12 to 14 at the earliest, just as the gun starts to out-kill everything else
(1.5x the Coil Nailer at round 15, 2.2x at 20: docs/history.md, 9 November), and it is the natural gun for the finisher and for overtime.
The claw keeps its rainbow capsule: a lucky grab is now a 1,000-point shortcut to a 10,000-point gun, not the only way to it.

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
| Return to Sender | Yes | The finisher and the Returns Desk |
| Customer Service booth | As a place | Night safe and Returns Desk stand at or beside it |
| Mall PA, event bus, boss director, career stats | Yes | Plumbing |
| Power-ups (employee incentives) | No | They drop at random; a step that needed one would be a luck step |
| Attachments | No | |
| Prize tickets and the Prize Counter | No | Tickets only come from claw grabs |
| Limited Editions (Party Trap, Clearance Rack) | No | Random drops |
| GRAB-A-GUN | No | It stops being the only route to Return to Sender |
| Wardrobe, Kiosk Kevin's equipment, wall buys, tiers, box cutter tiers, RESTOCK-O-MATIC, Flash Sales | No | |

So power-ups, attachments, prize tickets, Limited Editions, the claw, the wardrobe and Kevin can each be cut without touching the quest. Cutting
hazards removes line 1 and cutting Build-A-Blaster removes line 3; either line can be replaced by a second deposit without changing the rest.

## How it fits the code

- **`src/config/closingTime.js`** (new): the lines, keys, counts, hold times, final round, PA lines and receipt words.
  **`economy.closing`**: `{ nightSafe: 1000, validation: 5000, returnsDesk: 10000 }`, read through `g.pricing.priceOf('closing', id)`.
- **`src/game/closingTime.js`** (new, `g.closing`): built and ticked in createGame.js; one new `resetSteps` entry. It only listens:
  'bossDefeated' gives a key, 'kill' with source 'hazard' counts line 1, 'ritualCollect' ticks line 3, 'purchase' counts the deposits.
- **Events it announces** (to add to game/events.js): 'closingKey' { bossId, pa }, 'closingProgress' { line, count, needed },
  'closingLine' { line, done, total, pa }, 'closingValidated' { round, pa }, 'runWon' { summary }, 'overtimeStart' { round }. The Speechless
  state is a 'bossPhase' like any other.
- **Winning is one function, `onRunWon` in createGame.js**, beside `onPlayerDeath`. It sets `state.won`, emits 'runWon' once and pauses the game
  for the receipt. Clock out then sets `state.over`, so the existing rule holds unchanged: once the run is over nothing is paid or counted.
- **Map features** (data in `map.features`, one module each in game/features/, one registry line each): `nightSafe`, `escapeVan` (the ticket
  machine and the van's prompt, on the existing 'abandoned' van from config/parkingLot.js), `returnsDesk`. No new area, door, zone or spawn.
- **The boss**: a `lastCustomer` entry in config/bosses.js with no `firstRounds`, so `chooseBossSchedule` never picks it; `g.closing` books it with
  a small new `bosses.book(round, id)`. Its behaviour is one file in zombies/bosses/. `met` must not include it, or encores would bring her back.
- **Browser side** (main.js, ui/): the checklist chip and pause list, the CLOSING TIME banner, the win receipt, the OVERTIME tag.
- **Career stats**: `wins` and `fastestWin`, with a version bump and a migration test (careerStats.js is persisted in localStorage).

## Phases

Each phase leaves the game working and is worth having without the later ones. After phase 3 there is already a complete ending.

| # | Phase | What exists afterwards | Main files (shared files in bold) | New mechanic? |
|---|---|---|---|---|
| 1 | Keys and the checklist | Each boss gives its key; a four-box chip on the HUD, the full list on the pause screen, PA lines, "Closing checklist: n of 4" on the death receipt. Changes no balance | config/closingTime.js, game/closingTime.js, **createGame.js**, **events.js**, ui/hud.js, **main.js**, **debugCommands.js** (a keyless `closing` command) | No |
| 2 | The win, headless | `onRunWon`, 'runWon', Clock out and overtime as game state; the van's prompt wins once all four keys are held and the round is 20 or later; career `wins` | **createGame.js**, game/features/escapeVan.js, **features/index.js**, **mall.js** (one feature entry), careerStats.js | No |
| 3 | The win, browser side | The SHIFT COMPLETE receipt with its two buttons, the OVERTIME tag, the checklist's fourth box | **main.js**, ui/, style.css | No |
| 4 | Line 1: the fountain | Murray's Key Ring opens the count; 12 fountain kills tick it | game/closingTime.js, features/fountainHazard.js (mark its kills) | No |
| 5 | Line 2: the night safe | The safe, the deposits, the `closing` price category | features/nightSafe.js, **economy.js**, **pricing.js**, **mall.js** | No |
| 6 | Line 3: last orders | A build collected while the Signature is held ticks it | game/closingTime.js only | No |
| 7 | Parking validation and the countdown | The ticket machine and its 5,000; the PA counts the rounds to closing time; the van now also needs lines 1 to 3 | features/escapeVan.js, **economy.js** | No |
| 8 | The Last Customer, reused parts only | She is booked for the Closing Time round, charges, crashes into vans, calls backup, and dies like any boss; the van needs her gone | **config/bosses.js**, **bossDirector.js**, zombies/bosses/lastCustomer.js, **economy.js** (kill value), config/deathReports.js | No |
| 9 | The return and the Returns Desk | Speechless, the two ways to return her, the per-boss Return to Sender fraction, and the desk selling the gun | zombies/bosses/lastCustomer.js, **weapons/gunStats.js**, features/returnsDesk.js, **mall.js** | **Yes, the one** |
| 10 | Measure and tune | A bot that does the quest: minutes to the win, points in hand at the win, what share of income the quest took, how often the finale kills. Prices and her health set from that | tools/ (the review's bot is throwaway and gitignored: copy what is needed), config only | No |
| 11 | Spectacle | Her model and trolley, the van's lights and engine, music for the last round, the receipt's art | models, audio, ui | No |

Notes for whoever builds a phase:

- **Phases 4, 5 and 6 are independent** of each other and of phases 2 and 3, and can be built in any order or in parallel worktrees. Until a
  line's duty is built, holding its key ticks its box. So after phase 3 the ending is: four bosses, round 20, the van.
- **Phase 2 is the risky one.** It is the first time a run ends without a death. Everything that listens for 'playerDeath' or reads
  `state.over` needs a look: death music, the results delay, career stats, pointer lock, the idle saver. Overtime must leave no trace
  of the pause. Run the full suite, not test:quick.
- **Phase 4** needs the fountain to say which kills are its own. 'kill' carries only source 'hazard', and three more hazards are planned.
- **Phase 5 and 9** add things at the Customer Service booth, which already has two windows where the nearest wins the prompt. Pick positions
  with the prompt tests and tests/coplanar.test.js; the Prize Counter is on the same wall (x -13).
- **Phase 8**: round 20 is also the first encore round (`bossTiming.encores.fromRound`). Booking her in the director's schedule is what stops
  two bosses arriving together; test that round 20 has exactly one.
- **Phase 9**: the hand return is an interaction that exists only while she is Speechless. It must lose to nothing: check it against a held
  reload and against the van's prompt if she falls beside it.
- **Tests**: one file, tests/closingTime.test.js, grown a phase at a time (and described in docs/tests.md, or tests/docs.test.js fails). Build
  the map before seeding `Math.random`. Each phase adds a history entry and its folder-structure lines.
- **The shopping window** (branch `claude/shopping-window`, in progress: a 20 s break with a hold to end it early) fits this: duties are things
  to do in the break. Nothing here depends on it.

## Risks

- **Reaching round 20 at all**, as measured above. If the survival fixes do not land, the ending is something only the bot's immortal runs see.
- **The quest competes with upgrades before round 20; it does not soak the surplus**, which piles up after it. The 12,000 comes out of the same
  rounds 9 to 20 that pay for Platinum. The sink that reaches the surplus is the Returns Desk, and after the win nothing does (decision 8).
- **HUD space.** A fifth permanent element next to the outfit rail, pockets and incentive HUD. docs/ui-readability.md is the judge.
- **Line 3 and the loadout.** The ritual takes a gun away for a fight. Doing that at round 14 is harder than at round 7.
- **A slow fountain.** Twelve fountain kills is easy with a crowd and tedious with two zombies left. The count wants measuring in phase 4.

## Decisions that are yours

1. **The fiction.** A staff closing checklist with four lines, one per boss, as above? The alternative is a plain "four keys open the exit".
2. **Who the final boss is.** Recommended: the Last Customer (new, cheap, fits Return to Sender). Others: a Regional Manager from head office;
   Food Court Karen from the old boss list; all four bosses again, one after another, with no new character at all. And her name.
3. **The one new mechanic.** Recommended: she must be returned (Speechless, then a beam or a hand stamp). Or none: she dies like any boss,
   phase 9 shrinks to the Returns Desk, and the quest's link to Return to Sender is only the shop.
4. **When the ending opens.** Recommended: never before round 20, then the next round once you validate. Or as soon as the checklist is done,
   which a strong player reaches at round 16 to 18. Or exactly round 20 with no way to be late.
5. **After the win.** Recommended: a choice between Clock out and Stay for overtime. Or overtime starts by itself after the receipt. And should
   overtime differ at all (more pay, faster scaling)? Recommended: no.
6. **Return to Sender's guaranteed route.** Recommended: buy it at the Returns Desk for 10,000 once lines 1 to 3 are ticked. Or free, handed
   over when the checklist completes. Or only as the prize for winning, for overtime.
7. **The prices.** 750 an activation, 4,000, 1,500 and 5,000 required, 10,000 optional. Should the required part be heavier (it is 12.5% of a
   good bot's income by round 20), or stay light so it does not slow the upgrades a player needs to survive that long?
8. **A sink for overtime.** The measured surplus is after round 23, which is after the win. Do you want a repeatable overtime sink, and should
   Return to Sender stop taking the 400-point RESTOCK-O-MATIC refill once it can be bought? Neither is in the phases above.
9. **Keys.** Granted on the kill with nothing to pick up, and the bosses keep their current rewards as well? Or should the key replace the
   voucher, or be a pickup like one?
10. **Where the checklist shows.** Recommended: four small boxes always on the HUD and the full list on the pause screen. Or the pause screen
    and PA only, to keep the HUD as it is.
