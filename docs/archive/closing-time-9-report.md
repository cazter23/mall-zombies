# Closing Time phase 9: the return and Returns Desk

Built on `claude/closing-time-9`, including the committed main changes through `d2c2192` (weapon skins and the capped, machine-wide locking npm test runner). Only phase 9 is added here; phases 10–12 remain planned.

## Behavior

Lorraine cannot cross 1 health through damage. Her empty bar enters the Speechless boss phase for 6 seconds. A Return to Sender beam at any range, or a nearby 1.5-second interact hold, returns her through the normal kill path with the existing cardboard box and stamp feedback. Both finishes carry `weaponId: 'returnToSender'`; beams retain their shot distance for skin challenges. Missing the window restores 25% health. The van continues refusing until she has been returned. The hand prompt has priority over the van and owns its full hold even with reload held.

The Returns Desk is on the hallway wall east of Customer Service, at x 11.8. Its prompt is (11.8, 1.42, 5.58), facing south. It sells Return to Sender for 10,000 after the first three duties, using the ordinary two-slot loadout path. Holding that gun changes the offer to its 2,500 half-rate refill, without a duty gate. Both prices use the closing pricing category, including discounts. RESTOCK-O-MATICs and the Prize Counter direct its holders to the desk without charging. Stockroom Delivery and Refurbished prizes retain their existing free refills.

The feature and registry entry are appended without reordering existing entries. Save version is 5. No new save step is needed: the desk's gun and ammunition use the existing gun step; the boss encounter, Speechless timer and hand prompt are transient and restart from the saved round's beginning. The director's existing schedule retains her booking.

## Measurements

`npm run balance`: sustained Platinum Rivet Rifle ADS body fire at 10 m, including reloads, with no crash bonus, headshots or misses:

| Closing round | Health | Seconds to Speechless |
|---|---:|---:|
| 16 | 19,904 | 16.4 |
| 18 | 23,008 | 18.9 |
| 20 | 26,592 | 21.9 |

These times are unchanged at the report's precision from phase 8. Emptying the bar now requires the additional return. The report adds her per-type beam damage: base Return to Sender takes 3% instead of the usual 12%, or 34 beams to reach the damage floor instead of 9. One subsequent beam during Speechless returns her. Other gun balance tables are unchanged.

`npm run sim:claw`: capsule weights, odds, grab costs and gun acquisition costs are unchanged. The guaranteed desk route replaces the claim that the claw is the only source. Reported Return to Sender value rises from its old nominal 4,000 to its actual desk price of 10,000; paid half-rate ammo is identified as 2,500 at the desk only. At the configured 1,000-point grab, first-grab value/price changes from 1.52 to 1.66 for 3-in-4 play and from 1.67 to 1.85 for timed play; whole-site value/point changes from 1.50 to 1.62. These are valuation changes, not changed prize probabilities or income.

## Validation

The quick loop was run while iterating; focused fixes were checked through npm only. Closing Time: 57 passed; Save & Quit: 14 passed; instant-kill/refill: 8 passed. Boss polish and coplanar checks also passed. The final `npm test` passed 1,430/1,430 tests in 158 files, with zero failures or skips, at four files a time. It took 281 seconds of testing, 338 seconds including the shared-lock wait.

Production build passed. An isolated Edge production preview using SwiftShader checked the desk gate and 10,000 purchase, 2,500 refill, RESTOCK-O-MATIC refusal, empty Speechless HUD bar, hand hold beside the van with reload held, attributed kill and SHIFT COMPLETE receipt. No game-origin browser exceptions. Screenshots and browser results are in this worktree's ignored `scratch/phase9-*`; the preview was stopped. Physical controller and GPU play were not checked.

## Shared files changed

- `src/config/bosses.js`, `clawMachine.js`, `closingTime.js`, `economy.js`, `save.js`.
- `src/game/bossDirector.js`, `createGame.js`, `interactions.js`; feature registry, `ammoCache.js`, `prizeCounter.js` (new `returnsDesk.js`).
- `src/maps/mall/mall.js`, `src/ui/hud.js`.
- `src/weapons/gunStats.js`, `playerGun.js` (new shared `returnToSender.js`).
- `src/zombies/zombie.js`, `zombieManager.js`, `bosses/lastCustomer.js`.
- Existing tests: bossPolish, clawSim, closingTime, features, instantKill, saveGame.
- Reports: `tools/clawOdds.js`, `clawSim.mjs`, `gunReport.mjs`; history, plan status, folder structure, map and test docs.

`CLAUDE.md` and the main checkout were not edited by this phase. The merged main commit supplies the test constraint.
