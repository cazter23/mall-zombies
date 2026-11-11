# Closing Time phase 11: measure and tune

Base: main f73f91e. Before work, phase 7 (360dd69), 8 (f3d0046), 9 (e9e5d40), and integrated phase 10 (e956f35) were verified as ancestors of main. Branch: claude/closing-time-11; no merge to main.

## Method and limits

The real headless game is played through economyBot.js, a quest driver and the SENSIBLE order from economyPlans.js, using economySim's bounded job/cache pattern. Every condition has seeds 1-20; affected overtime groups get additional consecutive seeds until at least 20 complete ten overtime rounds. All failed attempts remain in the data. Seeds are paired across conditions, not independent replications across mode/purchase cells. At most four child processes run together.

Run `npm run sim:closing -- --seeds=20 --workers=4 --out=scratch/closing-time-final`. Supplemental commands below reproduce the larger groups. Raw cached results are in scratch; compact per-seed evidence is in closing-time-11-results.json. Changes to source/config invalidate the cache.

The bot buys real doors, weapons and upgrades, collects real floor keys, pays the fountain and safe, completes a timed build/Restuff after the Signature, validates, returns Lorraine and holds to start the van. Every charge uses the real prompt and g.pricing. It buys an early rifle build and later Restuff; required cost includes fountain activations, deposits, that later build and validation. Area unlocks and the earlier build are loadout costs. Optional cost includes the gun and pre-win ammo. Shares exclude the starting 500 points from income.

The bought gun replaces the Price Gun before validation. Ammo spending reserves validation funds; the last beam is saved for Speechless while rifle ammunition remains. In overtime the rifle-only route continues SENSIBLE through the Coil Nailer, builds, warranties, Renewals, apparel and doors. The Returns route retains the wonder weapon and buys rifle Renewals. Empty affordable Returns ammo is bought mid-wave; otherwise the rifle is used. Net banked subtracts ALL spending, not just ammo.

Shopping, key pickups, the fountain journey and hand-stamp approach are teleports: travel time and risk are omitted. Duties generally wait for breaks, which can instead delay the ending by a round. The actual stamp hold and combat run normally. Teleporting the hand approach understates the beam's safety advantage. The bot knows the route in Classic, so it cannot judge clue discovery or readability. Good/average are fixed aim/steering presets, not human skill percentiles. It does not deliberately arrange van crashes. It ignores unrewarded fans as threats, which can stall an Influencer encore; those failures are bot limitations, not evidence that ammo pricing breaks the game. Immortal runs refill health on lethal hits and continue: these are counterfactual lethal hits, not mortal deaths. Fun, readability, and how the fight feels require human play.

## Wins

Means among quest wins only. A quest win can precede an overtime stall; the OT10 column distinguishes that. Quest+Returns includes pre-win ammo, which the plan's original gun-only cost sketch excluded.

| Mode | Life | Skill | RTS | Wins/attempts | Minutes | Win round | Win bank | Required % | Quest+Returns % | OT10 complete | Outcomes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| classic | mortal | average | no | 0/20 | - | - | - | - | - | 0 | {'died': 20} |
| classic | mortal | average | yes | 0/20 | - | - | - | - | - | 0 | {'died': 20} |
| classic | mortal | good | no | 0/20 | - | - | - | - | - | 0 | {'died': 20} |
| classic | mortal | good | yes | 0/20 | - | - | - | - | - | 0 | {'died': 20} |
| classic | immortal | average | no | 20/20 | 34.0 | 18.1 | 36504 | 14.3 | 14.3 | 20 | {'won': 20} |
| classic | immortal | average | yes | 21/21 | 35.8 | 18.7 | 3982 | 15.0 | 56.5 | 20 | {'stuck': 1, 'won': 20} |
| classic | immortal | good | no | 20/20 | 27.0 | 18.1 | 38650 | 13.7 | 13.7 | 20 | {'won': 20} |
| classic | immortal | good | yes | 20/20 | 27.8 | 18.2 | 5580 | 14.7 | 55.9 | 20 | {'won': 20} |
| directed | mortal | average | no | 0/20 | - | - | - | - | - | 0 | {'died': 20} |
| directed | mortal | average | yes | 0/20 | - | - | - | - | - | 0 | {'died': 20} |
| directed | mortal | good | no | 0/20 | - | - | - | - | - | 0 | {'died': 20} |
| directed | mortal | good | yes | 0/20 | - | - | - | - | - | 0 | {'died': 20} |
| directed | immortal | average | no | 20/20 | 34.0 | 18.1 | 36504 | 14.3 | 14.3 | 20 | {'won': 20} |
| directed | immortal | average | yes | 21/21 | 35.8 | 18.7 | 3982 | 15.0 | 56.5 | 20 | {'stuck': 1, 'won': 20} |
| directed | immortal | good | no | 20/20 | 27.0 | 18.1 | 38650 | 13.7 | 13.7 | 20 | {'won': 20} |
| directed | immortal | good | yes | 20/20 | 27.8 | 18.2 | 5580 | 14.7 | 55.9 | 20 | {'won': 20} |

Win ranges (successful quests):

- ('classic', True, 'average', False): 25.4-48.5 minutes, rounds 17-20.
- ('classic', True, 'average', True): 26.3-53.1 minutes, rounds 17-23.
- ('classic', True, 'good', False): 21.1-33.7 minutes, rounds 17-20.
- ('classic', True, 'good', True): 21.8-36.8 minutes, rounds 17-20.
- ('directed', True, 'average', False): 25.4-48.5 minutes, rounds 17-20.
- ('directed', True, 'average', True): 26.3-53.1 minutes, rounds 17-23.
- ('directed', True, 'good', False): 21.1-33.7 minutes, rounds 17-20.
- ('directed', True, 'good', True): 21.8-36.8 minutes, rounds 17-20.

## Deaths, finale and fountain

All mortal attempts died before the finale: actual mortal finale death rate is unmeasured, because there were no entrants. Immortal exposure below counts lethal hits while Lorraine was active; it is not a predicted human death rate.

Across the 160 mortal attempts, every run died in rounds 4-13. Good skill's median death round was 7 (range 4-13); average skill's was 6 (range 4-10). Mode and planned Returns purchase produced paired identical mortal outcomes: none lived long enough to buy the optional gun. These are repeated conditions on the same seeds, not 160 independent survival samples.

| Mortal death cause | Attempts | Share |
|---|---|---|
| Shopper | 68 | 42.5% |
| Cart Pusher | 48 | 30.0% |
| Mall Walker | 40 | 25.0% |
| Mannequin | 4 | 2.5% |

| Mortal death location | Attempts | Share |
|---|---|---|
| Atrium | 72 | 45.0% |
| Hallway | 56 | 35.0% |
| Start room | 24 | 15.0% |
| Food Court | 8 | 5.0% |

By duty stage, 64 deaths occurred while the fountain duty was outstanding and 96 during other waves; none was caused by fountain damage. The rows below retain the complete per-condition histograms, including immortal exposure throughout the quest and overtime. Two average/Returns immortal attempts (seed 1 in each mode) won the quest in round 20, then stalled in overtime round 9 (round 28) on the Influencer encore; seeds 21 supplied the missing complete overtime samples. Both stalled attempts remain included.

| (mode, immortal, skill, RTS) | Lethals by round | Locations | Causes | Finale exposed/entered | Finale lethal hits | Finale seconds | Finishers | Fountain seconds | Activations |
|---|---|---|---|---|---|---|---|---|---|
| ('classic', False, 'average', False) | {7: 2, 8: 4, 6: 7, 4: 4, 5: 1, 9: 1, 10: 1} | {'hallway': 10, 'atrium': 7, 'startRoom': 3} | {'cartPusher': 6, 'shopper': 8, 'mallWalker': 5, 'mannequin': 1} | 0/0 | 0 | - | {} | 55.7 | 1.3 |
| ('classic', False, 'average', True) | {7: 2, 8: 4, 6: 7, 4: 4, 5: 1, 9: 1, 10: 1} | {'hallway': 10, 'atrium': 7, 'startRoom': 3} | {'cartPusher': 6, 'shopper': 8, 'mallWalker': 5, 'mannequin': 1} | 0/0 | 0 | - | {} | 55.7 | 1.3 |
| ('classic', False, 'good', False) | {5: 1, 8: 3, 6: 6, 7: 6, 9: 1, 13: 1, 12: 1, 4: 1} | {'hallway': 4, 'atrium': 11, 'startRoom': 3, 'foodCourt': 2} | {'shopper': 9, 'mallWalker': 5, 'cartPusher': 6} | 0/0 | 0 | - | {} | 82.0 | 1.7 |
| ('classic', False, 'good', True) | {5: 1, 8: 3, 6: 6, 7: 6, 9: 1, 13: 1, 12: 1, 4: 1} | {'hallway': 4, 'atrium': 11, 'startRoom': 3, 'foodCourt': 2} | {'shopper': 9, 'mallWalker': 5, 'cartPusher': 6} | 0/0 | 0 | - | {} | 82.0 | 1.7 |
| ('classic', True, 'average', False) | {7: 31, 8: 21, 10: 110, 11: 281, 12: 527, 13: 655, 14: 407, 16: 539, 17: 3256, 18: 774, 19: 733, 20: 859, 21: 413, 22: 454, 23: 461, 24: 2698, 25: 958, 26: 1089, 27: 1230, 28: 1288, 29: 1522, 9: 102, 15: 1781, 6: 56, 4: 14, 5: 8} | {'hallway': 445, 'startRoom': 325, 'atrium': 680, 'departmentStore': 837, 'foodCourt': 12315, 'parkingLot': 4171, 'megaMart': 1309, 'unmapped': 13, 'cinemaStairwell': 61, 'cinemaReturn': 107, 'serviceCorridor': 4} | {'cartPusher': 3679, 'shopper': 6111, 'mallWalker': 8855, 'mascot': 1081, 'manager': 96, 'mannequin': 289, 'lastCustomer': 77, 'janitor': 50, 'guard': 29} | 19/20 | 751 | 138.0 | {'hand': 20} | 64.1 | 1.8 |
| ('classic', True, 'average', True) | {7: 33, 8: 22, 10: 111, 11: 285, 12: 558, 13: 664, 14: 257, 15: 3105, 16: 726, 17: 3837, 18: 802, 19: 496, 20: 821, 21: 741, 22: 1231, 23: 1289, 24: 3765, 25: 1766, 26: 2751, 27: 2532, 28: 5289, 9: 103, 6: 63, 29: 1547, 4: 14, 5: 9, 30: 141, 31: 47, 32: 90} | {'hallway': 894, 'startRoom': 497, 'atrium': 711, 'departmentStore': 1382, 'foodCourt': 22960, 'megaMart': 1852, 'parkingLot': 4776, 'unmapped': 23} | {'cartPusher': 5683, 'shopper': 10126, 'mallWalker': 14647, 'mascot': 1776, 'manager': 82, 'mannequin': 474, 'guard': 107, 'janitor': 137, 'lastCustomer': 63} | 21/21 | 690 | 142.2 | {'beam': 15, 'hand': 6} | 65.3 | 1.8 |
| ('classic', True, 'good', False) | {5: 1, 11: 69, 13: 294, 16: 217, 17: 1621, 18: 364, 19: 190, 20: 246, 21: 209, 22: 150, 23: 212, 24: 1122, 25: 289, 26: 428, 27: 547, 28: 1161, 29: 704, 8: 31, 12: 57, 15: 1511, 6: 32, 9: 17, 14: 121, 7: 21, 10: 1, 4: 1} | {'hallway': 175, 'foodCourt': 4808, 'departmentStore': 425, 'megaMart': 820, 'parkingLot': 2611, 'atrium': 381, 'cinemaReturn': 50, 'cinemaStairwell': 56, 'startRoom': 235, 'unmapped': 14, 'serviceCorridor': 41} | {'shopper': 2505, 'mallWalker': 4888, 'mannequin': 66, 'guard': 9, 'cartPusher': 1576, 'mascot': 484, 'lastCustomer': 19, 'manager': 39, 'janitor': 29, 'fountain': 1} | 17/20 | 171 | 91.1 | {'hand': 20} | 92.3 | 1.8 |
| ('classic', True, 'good', True) | {5: 1, 11: 69, 13: 294, 15: 1348, 17: 1470, 18: 304, 19: 590, 20: 494, 21: 685, 22: 397, 23: 604, 24: 3438, 25: 1174, 26: 886, 27: 2019, 28: 2835, 29: 981, 8: 31, 12: 57, 14: 267, 16: 575, 6: 32, 9: 17, 7: 21, 10: 1, 4: 1} | {'hallway': 391, 'foodCourt': 10825, 'atrium': 533, 'megaMart': 2057, 'parkingLot': 3835, 'unmapped': 31, 'departmentStore': 556, 'startRoom': 363} | {'shopper': 5236, 'mallWalker': 8757, 'mannequin': 201, 'guard': 42, 'cartPusher': 2973, 'mascot': 1263, 'lastCustomer': 54, 'janitor': 8, 'manager': 56, 'fountain': 1} | 18/20 | 499 | 96.0 | {'beam': 17, 'hand': 3} | 92.3 | 1.8 |
| ('directed', False, 'average', False) | {7: 2, 8: 4, 6: 7, 4: 4, 5: 1, 9: 1, 10: 1} | {'hallway': 10, 'atrium': 7, 'startRoom': 3} | {'cartPusher': 6, 'shopper': 8, 'mallWalker': 5, 'mannequin': 1} | 0/0 | 0 | - | {} | 55.7 | 1.3 |
| ('directed', False, 'average', True) | {7: 2, 8: 4, 6: 7, 4: 4, 5: 1, 9: 1, 10: 1} | {'hallway': 10, 'atrium': 7, 'startRoom': 3} | {'cartPusher': 6, 'shopper': 8, 'mallWalker': 5, 'mannequin': 1} | 0/0 | 0 | - | {} | 55.7 | 1.3 |
| ('directed', False, 'good', False) | {5: 1, 8: 3, 6: 6, 7: 6, 9: 1, 13: 1, 12: 1, 4: 1} | {'hallway': 4, 'atrium': 11, 'startRoom': 3, 'foodCourt': 2} | {'shopper': 9, 'mallWalker': 5, 'cartPusher': 6} | 0/0 | 0 | - | {} | 82.0 | 1.7 |
| ('directed', False, 'good', True) | {5: 1, 8: 3, 6: 6, 7: 6, 9: 1, 13: 1, 12: 1, 4: 1} | {'hallway': 4, 'atrium': 11, 'startRoom': 3, 'foodCourt': 2} | {'shopper': 9, 'mallWalker': 5, 'cartPusher': 6} | 0/0 | 0 | - | {} | 82.0 | 1.7 |
| ('directed', True, 'average', False) | {7: 31, 8: 21, 10: 110, 11: 281, 12: 527, 13: 655, 14: 407, 16: 539, 17: 3256, 18: 774, 19: 733, 20: 859, 21: 413, 22: 454, 23: 461, 24: 2698, 25: 958, 26: 1089, 27: 1230, 28: 1288, 29: 1522, 9: 102, 15: 1781, 6: 56, 4: 14, 5: 8} | {'hallway': 445, 'startRoom': 325, 'atrium': 680, 'departmentStore': 837, 'foodCourt': 12315, 'parkingLot': 4171, 'megaMart': 1309, 'unmapped': 13, 'cinemaStairwell': 61, 'cinemaReturn': 107, 'serviceCorridor': 4} | {'cartPusher': 3679, 'shopper': 6111, 'mallWalker': 8855, 'mascot': 1081, 'manager': 96, 'mannequin': 289, 'lastCustomer': 77, 'janitor': 50, 'guard': 29} | 19/20 | 751 | 138.0 | {'hand': 20} | 64.1 | 1.8 |
| ('directed', True, 'average', True) | {7: 33, 8: 22, 10: 111, 11: 285, 12: 558, 13: 664, 14: 257, 15: 3105, 16: 726, 17: 3837, 18: 802, 19: 496, 20: 821, 21: 741, 22: 1231, 23: 1289, 24: 3765, 25: 1766, 26: 2751, 27: 2532, 28: 5289, 9: 103, 6: 63, 29: 1547, 4: 14, 5: 9, 30: 141, 31: 47, 32: 90} | {'hallway': 894, 'startRoom': 497, 'atrium': 711, 'departmentStore': 1382, 'foodCourt': 22960, 'megaMart': 1852, 'parkingLot': 4776, 'unmapped': 23} | {'cartPusher': 5683, 'shopper': 10126, 'mallWalker': 14647, 'mascot': 1776, 'manager': 82, 'mannequin': 474, 'guard': 107, 'janitor': 137, 'lastCustomer': 63} | 21/21 | 690 | 142.2 | {'beam': 15, 'hand': 6} | 65.3 | 1.8 |
| ('directed', True, 'good', False) | {5: 1, 11: 69, 13: 294, 16: 217, 17: 1621, 18: 364, 19: 190, 20: 246, 21: 209, 22: 150, 23: 212, 24: 1122, 25: 289, 26: 428, 27: 547, 28: 1161, 29: 704, 8: 31, 12: 57, 15: 1511, 6: 32, 9: 17, 14: 121, 7: 21, 10: 1, 4: 1} | {'hallway': 175, 'foodCourt': 4808, 'departmentStore': 425, 'megaMart': 820, 'parkingLot': 2611, 'atrium': 381, 'cinemaReturn': 50, 'cinemaStairwell': 56, 'startRoom': 235, 'unmapped': 14, 'serviceCorridor': 41} | {'shopper': 2505, 'mallWalker': 4888, 'mannequin': 66, 'guard': 9, 'cartPusher': 1576, 'mascot': 484, 'lastCustomer': 19, 'manager': 39, 'janitor': 29, 'fountain': 1} | 17/20 | 171 | 91.1 | {'hand': 20} | 92.3 | 1.8 |
| ('directed', True, 'good', True) | {5: 1, 11: 69, 13: 294, 15: 1348, 17: 1470, 18: 304, 19: 590, 20: 494, 21: 685, 22: 397, 23: 604, 24: 3438, 25: 1174, 26: 886, 27: 2019, 28: 2835, 29: 981, 8: 31, 12: 57, 14: 267, 16: 575, 6: 32, 9: 17, 7: 21, 10: 1, 4: 1} | {'hallway': 391, 'foodCourt': 10825, 'atrium': 533, 'megaMart': 2057, 'parkingLot': 3835, 'unmapped': 31, 'departmentStore': 556, 'startRoom': 363} | {'shopper': 5236, 'mallWalker': 8757, 'mannequin': 201, 'guard': 42, 'cartPusher': 2973, 'mascot': 1263, 'lastCustomer': 54, 'janitor': 8, 'manager': 56, 'fountain': 1} | 18/20 | 499 | 96.0 | {'beam': 17, 'hand': 3} | 92.3 | 1.8 |

## Overtime

Completed rounds only; partial stalled rounds are excluded. Every cell has at least 20 completed samples. The base Returns refill is 2,500; actual ammo spending below includes discounts. Large early negative net values on the rifle route are remaining upgrades. Later surplus and ammo absorption must be assessed separately by route.

| Mode | Skill | RTS | OT | N | Income | All spending | Returns ammo | Net banked | End bank |
|---|---|---|---|---|---|---|---|---|---|
| classic | average | False | 1 | 20 | 11214 | 5297 | 0 | 5917 | 42421 |
| classic | average | False | 2 | 20 | 8820 | 36012 | 0 | -27192 | 15230 |
| classic | average | False | 3 | 20 | 9772 | 11062 | 0 | -1290 | 13940 |
| classic | average | False | 4 | 20 | 9344 | 10620 | 0 | -1276 | 12664 |
| classic | average | False | 5 | 20 | 11332 | 8535 | 0 | 2797 | 15462 |
| classic | average | False | 6 | 20 | 10992 | 8374 | 0 | 2618 | 18079 |
| classic | average | False | 7 | 20 | 13008 | 4770 | 0 | 8238 | 26316 |
| classic | average | False | 8 | 20 | 13402 | 3420 | 0 | 9982 | 36299 |
| classic | average | False | 9 | 20 | 15064 | 560 | 0 | 14504 | 50802 |
| classic | average | False | 10 | 20 | 15248 | 540 | 0 | 14708 | 65511 |
| classic | average | True | 1 | 21 | 8148 | 10724 | 10343 | -2576 | 1406 |
| classic | average | True | 2 | 21 | 8706 | 8657 | 8452 | 49 | 1455 |
| classic | average | True | 3 | 21 | 9289 | 9124 | 8914 | 165 | 1620 |
| classic | average | True | 4 | 21 | 9510 | 9308 | 9048 | 202 | 1822 |
| classic | average | True | 5 | 21 | 10744 | 10910 | 10357 | -165 | 1657 |
| classic | average | True | 6 | 21 | 10908 | 11330 | 10833 | -423 | 1234 |
| classic | average | True | 7 | 21 | 11908 | 11458 | 10819 | 450 | 1684 |
| classic | average | True | 8 | 21 | 11783 | 12042 | 11533 | -259 | 1425 |
| classic | average | True | 9 | 20 | 13662 | 13894 | 13000 | -232 | 1214 |
| classic | average | True | 10 | 20 | 14200 | 13921 | 12875 | 279 | 1493 |
| classic | good | False | 1 | 20 | 11140 | 4688 | 0 | 6452 | 45103 |
| classic | good | False | 2 | 20 | 9026 | 34288 | 0 | -25261 | 19842 |
| classic | good | False | 3 | 20 | 9956 | 15400 | 0 | -5444 | 14398 |
| classic | good | False | 4 | 20 | 9827 | 11272 | 0 | -1446 | 12952 |
| classic | good | False | 5 | 20 | 11172 | 9025 | 0 | 2147 | 15099 |
| classic | good | False | 6 | 20 | 11026 | 6775 | 0 | 4252 | 19350 |
| classic | good | False | 7 | 20 | 12696 | 6263 | 0 | 6432 | 25783 |
| classic | good | False | 8 | 20 | 12854 | 1325 | 0 | 11530 | 37312 |
| classic | good | False | 9 | 20 | 14668 | 610 | 0 | 14058 | 51370 |
| classic | good | False | 10 | 20 | 14650 | 444 | 0 | 14206 | 65576 |
| classic | good | True | 1 | 20 | 8465 | 11965 | 10000 | -3500 | 2080 |
| classic | good | True | 2 | 20 | 8277 | 8870 | 8750 | -593 | 1487 |
| classic | good | True | 3 | 20 | 9702 | 9725 | 9625 | -24 | 1464 |
| classic | good | True | 4 | 20 | 9110 | 9208 | 9095 | -98 | 1365 |
| classic | good | True | 5 | 20 | 10916 | 10834 | 10360 | 82 | 1447 |
| classic | good | True | 6 | 20 | 10120 | 10270 | 10110 | -150 | 1298 |
| classic | good | True | 7 | 20 | 12178 | 11400 | 10750 | 778 | 2076 |
| classic | good | True | 8 | 20 | 11734 | 12110 | 11500 | -376 | 1700 |
| classic | good | True | 9 | 20 | 13619 | 13558 | 12750 | 61 | 1761 |
| classic | good | True | 10 | 20 | 13226 | 13639 | 13125 | -414 | 1348 |
| directed | average | False | 1 | 20 | 11214 | 5297 | 0 | 5917 | 42421 |
| directed | average | False | 2 | 20 | 8820 | 36012 | 0 | -27192 | 15230 |
| directed | average | False | 3 | 20 | 9772 | 11062 | 0 | -1290 | 13940 |
| directed | average | False | 4 | 20 | 9344 | 10620 | 0 | -1276 | 12664 |
| directed | average | False | 5 | 20 | 11332 | 8535 | 0 | 2797 | 15462 |
| directed | average | False | 6 | 20 | 10992 | 8374 | 0 | 2618 | 18079 |
| directed | average | False | 7 | 20 | 13008 | 4770 | 0 | 8238 | 26316 |
| directed | average | False | 8 | 20 | 13402 | 3420 | 0 | 9982 | 36299 |
| directed | average | False | 9 | 20 | 15064 | 560 | 0 | 14504 | 50802 |
| directed | average | False | 10 | 20 | 15248 | 540 | 0 | 14708 | 65511 |
| directed | average | True | 1 | 21 | 8148 | 10724 | 10343 | -2576 | 1406 |
| directed | average | True | 2 | 21 | 8706 | 8657 | 8452 | 49 | 1455 |
| directed | average | True | 3 | 21 | 9289 | 9124 | 8914 | 165 | 1620 |
| directed | average | True | 4 | 21 | 9510 | 9308 | 9048 | 202 | 1822 |
| directed | average | True | 5 | 21 | 10744 | 10910 | 10357 | -165 | 1657 |
| directed | average | True | 6 | 21 | 10908 | 11330 | 10833 | -423 | 1234 |
| directed | average | True | 7 | 21 | 11908 | 11458 | 10819 | 450 | 1684 |
| directed | average | True | 8 | 21 | 11783 | 12042 | 11533 | -259 | 1425 |
| directed | average | True | 9 | 20 | 13662 | 13894 | 13000 | -232 | 1214 |
| directed | average | True | 10 | 20 | 14200 | 13921 | 12875 | 279 | 1493 |
| directed | good | False | 1 | 20 | 11140 | 4688 | 0 | 6452 | 45103 |
| directed | good | False | 2 | 20 | 9026 | 34288 | 0 | -25261 | 19842 |
| directed | good | False | 3 | 20 | 9956 | 15400 | 0 | -5444 | 14398 |
| directed | good | False | 4 | 20 | 9827 | 11272 | 0 | -1446 | 12952 |
| directed | good | False | 5 | 20 | 11172 | 9025 | 0 | 2147 | 15099 |
| directed | good | False | 6 | 20 | 11026 | 6775 | 0 | 4252 | 19350 |
| directed | good | False | 7 | 20 | 12696 | 6263 | 0 | 6432 | 25783 |
| directed | good | False | 8 | 20 | 12854 | 1325 | 0 | 11530 | 37312 |
| directed | good | False | 9 | 20 | 14668 | 610 | 0 | 14058 | 51370 |
| directed | good | False | 10 | 20 | 14650 | 444 | 0 | 14206 | 65576 |
| directed | good | True | 1 | 20 | 8465 | 11965 | 10000 | -3500 | 2080 |
| directed | good | True | 2 | 20 | 8277 | 8870 | 8750 | -593 | 1487 |
| directed | good | True | 3 | 20 | 9702 | 9725 | 9625 | -24 | 1464 |
| directed | good | True | 4 | 20 | 9110 | 9208 | 9095 | -98 | 1365 |
| directed | good | True | 5 | 20 | 10916 | 10834 | 10360 | 82 | 1447 |
| directed | good | True | 6 | 20 | 10120 | 10270 | 10110 | -150 | 1298 |
| directed | good | True | 7 | 20 | 12178 | 11400 | 10750 | 778 | 2076 |
| directed | good | True | 8 | 20 | 11734 | 12110 | 11500 | -376 | 1700 |
| directed | good | True | 9 | 20 | 13619 | 13558 | 12750 | 61 | 1761 |
| directed | good | True | 10 | 20 | 13226 | 13639 | 13125 | -414 | 1348 |

## Tuning: retained values and questions

No gameplay balance changes were applied. Required costs remain light, while the bought-gun route already absorbs overtime income. The bot's early mortality and fan-targeting failures do not support changing Lorraine's health or making ammo dearer. Retaining current settings is a measured decision, not a claim that human feel is settled. The developer-only bot settings are new config; no round gate or new duties were added.

| Setting | Before | Proposed candidate (question only) | Applied after | Reason / question |
|---|---|---|---|---|
| Fountain activation | 750 | 750 | 750 | Keep the existing light charge |
| Safe deposit / count | 1000 / 4 | 1000 / 4 | 1000 / 4 | Required spending remains light |
| Build / Restuff | 1500 / 750 | 1500 / 750 | 1500 / 750 | The bot buys the useful early build and later Restuff |
| Validation | 5000 | 5000 | 5000 | No evidence for increasing required burden |
| Returns gun | 10000 | 10000 | 10000 | Keep the decided guaranteed purchase |
| Returns ammo | 2500 | 2000 | 2500 | Would you prefer less backup-rifle use? Lowering this is a preference requiring another measured run, not a fix for the fan stall |
| Lorraine health multiplier | 16 | 14 | 16 | Would a shorter rifle fight feel better? The bot lacks crash tactics; reducing HP does not reduce fixed-fraction beam count |
| Fountain kills | 12 | 10 | 12 | Would you prefer a shorter lure duty? Observed activation/time tables do not establish tedium |
| OT extra health per round | 1.03 | 1.02 | 1.03 | Would less steep late pressure be preferable? Human survival/feel is unmeasured |
| OT kill pay | 1.25 | 1.10 | 1.25 | Should normal-gun surplus be reduced despite making dear ammo harder to fund? A global cut does not target the routes equally |

Candidate after-values above are unapplied proposals, not simulated after-results. The supported applied before/after values remain equal. Prices continue through g.pricing. Early good-bot wins remain possible, as decision 4 allows. If the ending is judged too early, the plan names a round gate as the lever; this phase reports that and does not build it or add duties.

## Reproduction and evidence

Supplement: `npm run sim:closing -- --modes=classic --life=immortal --skill=average --returns=yes --seeds=21 --workers=4 --out=scratch/closing-time-final`

Supplement: `npm run sim:closing -- --modes=directed --life=immortal --skill=average --returns=yes --seeds=21 --workers=4 --out=scratch/closing-time-final`

Total attempts: 322. Fingerprint: fa16a4f0ae42d048bd0f337c474e8524b55372b62c4c4fbec677105a519f30e2. Compact evidence preserves all attempts, outcomes, wins, completed overtime rows and aggregated death locations/causes.
