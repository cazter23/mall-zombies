# Economy report and power-curve proposal

Status: 10 November 2026, measured on main at 7d633bf. **Nothing in this report is applied to the game.** Main has since gained the 20-second
shopping window (32a16d6: the break between rounds is 20 seconds instead of 10, and can be ended early). That changes no price or payout, so
income by round stands; round times here are 10 seconds short of it, and one-life survival was not re-measured with the longer break. Sections 1 to 5 are
measurements; section 6 PROPOSES numbers and waits for approval; section 7 is what the plans that were waiting on this report can take from it.

Every table here is printed by `npm run sim:economy` (tools/economySim.mjs). Run it again after any change to prices, payouts,
guns or upgrades. `npm run sim:economy -- --quick` gives every table in a couple of minutes from too few runs to quote.

## Summary

**What a run pays.** About 216,000 points by round 30 for either skill: 600 in round 1, 2,000 in round 5, 5,200 in round 10, 9,500
in round 20, 15,400 in round 30. Skill changes time and deaths, not income. A quarter to nearly half of it is +10 hits, so a weaker gun earns more.

**What a sensible buyer owns when.** Rivet Rifle in round 5, the first build in round 7, Premium in 8, Platinum in 11 or 12, both guns
fully upgraded and every door open by round 23. After that there is nothing to buy: 104,000 points are unspent at round 30.

**Who gets there.** In one-life runs the good bot is dead by round 7 half the time and reaches round 10 in 38% of runs; the average
bot dies in round 6 and never reaches round 10. Everything past round 14 was measured on bots that cannot die.

**The review's four findings are confirmed** (section 5).

**Proposals** (section 6; none applied):

| | Today | Proposed | What the bot measured |
|---|---|---|---|
| A. Price Gun damage | 70 | 58 | The Rivet Rifle goes from 1.11x its damage to 1.34x, the Coil Nailer from 1.24x to 1.49x. No clear survival cost: 28% of runs reach round 10, against 38 to 40% today, which is inside the noise |
| B. Build-A-Blaster | 1,500, any gun | **B1:** 4,000 and only a gun under Premium warranty (needs a rule in code). **B2:** 5,000. **B3:** 3,000 | First build in round 7 today, round 9 with B1, round 8 with B2. A price alone cannot do more. **It costs survival: 15% (B1), 13% (B2) and 28% (B3) of good-skill runs reach round 10, against 38 to 40% today** |
| C. Platinum and Renewals | x1.65; Renewals x1.06 for 3,000 to 10,000 | x1.9; Renewals x1.09 for 4,000 to 10,000 | Platinum costs 193 points per +1% damage instead of 435. Nothing changes before round 11. A run to round 30 takes 55 minutes instead of 61 |
| D. Claw grab | 1,000 | 1,500 | The first grab wins 1.01x its price in wall value instead of 1.52x, and comes in round 4 instead of round 3 |

My recommendation: A, C and D as they stand. B is the one that needs your decision: B1 does what was asked and makes rounds 7 to 10
harder for a good player; B3 is the mild version. Section 6.5 has the numbers.

## 1. How this was measured, and what it cannot tell you

The real game runs headless (tests/helpers/headlessGame.js, the same game the tests play) with a bot at the controls
(tools/economyBot.js). The bot aims with a turn-speed limit and a wandering error, fires when on target, reloads, swaps guns,
knifes up close, backs away from a crowd and sprints out of a pinch. It comes in two fixed skills: **average** (one target in five
aimed at the head) and **good** (one in two, steadier and quicker). Both land about three shots in four. Bosses, Flash Sales,
power-ups, vouchers and Limited Edition drops are all on, because it is the real game.

It shops in the break from a **buy order**, strictly in order, saving for the next thing on the list. The order used throughout is
SENSIBLE (tools/economyPlans.js, the review's order): Price Gun, start shutter, Grand Atrium, Rivet Rifle, Deluxe, Promenade, a
build, Premium, HOFFMAN'S, a cardigan, Food Court, Platinum, Cinema, Heavy Coil Nailer and its build and warranty, Mega Mart, a
fanny pack, ten Renewals, both box cutter tiers, the last two doors. 106,500 points in all.

Read every number with these limits in mind:

- **Shopping is a teleport.** The bot appears at the buy spot, holds F on the real prompt at the real price, and appears back in the
  hallway. No walking time, no risk on the way, no fight at the Build-A-Blaster (its builds come out Understuffed or Regular).
- **Rounds past about 10 are "if you get there".** Half of the one-life runs are over by round 6 (average skill) or round 7 (good
  skill), and none got past round 14. So runs to round 30 are **immortal**: a lethal hit is counted, health is refilled and the run carries on. From round 11 the good
  bot takes between 4 and 170 lethal hits every round. Late income is what the game would pay a player who survived, not what players earn.
- **The bot does not use** hazards, the Soda Bomb, attachments, fitting rooms, prize tickets or the claw (except where a table
  says so), and it picks up power-ups only by walking over them.
- **Runs are not repeatable.** The same seed and the same numbers can play out differently from about round 4 (something in the headless
  game is not seeded; not investigated). So compare averages across seeds, never one seed with itself, and treat a one-life result as
  noisy: section 6.5 says how noisy.
- Runs: 8 immortal runs a skill for today's numbers, 4 for each other buy order and each proposal, 40 one-life runs a set-up.
  "Min to max" is the spread across seeds.

## 2. Income: what a run pays

| Round | Zombies | Shopper hp | Good: earned (min to max) | Good: total so far | Model | Good: seconds | Good: points a minute | Average: earned (min to max) | Average: total so far | Average: seconds |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 150 | 596 (540 to 660) | 596 | 575 | 20 | 1,794 | 510 (460 to 570) | 510 | 20 |
| 2 | 9 | 225 | 904 (840 to 990) | 1,500 | 873 | 34 | 1,610 | 846 (810 to 900) | 1,356 | 34 |
| 3 | 11 | 300 | 1,203 (1,130 to 1,260) | 2,703 | 1,170 | 36 | 2,031 | 1,191 (1,140 to 1,270) | 2,548 | 39 |
| 4 | 14 | 375 | 1,905 (1,830 to 1,970) | 4,608 | 1,628 | 42 | 2,695 | 1,730 (1,640 to 1,790) | 4,278 | 50 |
| 5 | 16 | 450 | 1,976 (1,660 to 2,280) | 6,584 | 1,657 | 44 | 2,705 | 1,766 (1,570 to 2,240) | 6,044 | 46 |
| 6 | 19 | 525 | 2,555 (2,200 to 2,800) | 9,139 | 2,258 | 48 | 3,247 | 2,429 (2,110 to 2,700) | 8,473 | 61 |
| 7 | 21 | 600 | 2,930 (2,420 to 3,390) | 12,069 | 2,226 | 53 | 3,341 | 2,784 (2,250 to 3,490) | 11,256 | 62 |
| 8 | 24 | 675 | 2,689 (2,530 to 2,970) | 14,758 | 2,575 | 51 | 3,148 | 2,808 (2,570 to 2,950) | 14,064 | 88 |
| 9 | 26 | 750 | 3,530 (2,720 to 3,900) | 18,288 | 2,763 | 52 | 4,078 | 3,636 (2,750 to 5,450) | 17,700 | 76 |
| 10 | 29 | 806 | 5,214 (4,040 to 6,170) | 23,501 | 3,667 | 62 | 5,049 | 4,741 (3,850 to 6,010) | 22,441 | 127 |
| 11 | 31 | 867 | 4,949 (4,140 to 6,030) | 28,450 | 3,980 | 98 | 3,228 | 4,595 (3,630 to 6,140) | 27,036 | 125 |
| 12 | 34 | 932 | 7,336 (4,300 to 9,110) | 35,786 | 4,448 | 136 | 3,589 | 6,816 (3,860 to 9,920) | 33,853 | 153 |
| 13 | 36 | 1,002 | 6,211 (4,900 to 7,690) | 41,998 | 4,821 | 92 | 4,581 | 6,480 (5,540 to 8,210) | 40,333 | 132 |
| 14 | 39 | 1,077 | 6,410 (5,020 to 8,570) | 48,408 | 5,413 | 102 | 4,079 | 6,181 (4,430 to 7,950) | 46,514 | 115 |
| 15 | 41 | 1,157 | 6,048 (4,710 to 7,290) | 54,455 | 5,785 | 123 | 3,421 | 7,256 (4,980 to 9,860) | 53,770 | 212 |
| 16 | 44 | 1,244 | 6,359 (5,760 to 7,760) | 60,814 | 5,961 | 90 | 4,289 | 6,406 (5,640 to 7,300) | 60,176 | 158 |
| 17 | 46 | 1,338 | 7,623 (5,860 to 9,000) | 68,436 | 6,485 | 198 | 2,359 | 6,890 (5,590 to 8,350) | 67,066 | 204 |
| 18 | 49 | 1,438 | 7,503 (6,180 to 8,820) | 75,939 | 6,758 | 122 | 4,035 | 7,289 (5,810 to 8,430) | 74,355 | 154 |
| 19 | 51 | 1,546 | 8,404 (7,680 to 10,090) | 84,343 | 7,055 | 162 | 3,481 | 8,134 (6,650 to 9,240) | 82,489 | 155 |
| 20 | 54 | 1,662 | 9,471 (8,500 to 10,740) | 93,814 | 7,677 | 123 | 4,743 | 10,030 (7,420 to 11,690) | 92,519 | 199 |
| 21 | 56 | 1,786 | 9,095 (7,910 to 10,190) | 102,909 | 8,479 | 148 | 4,095 | 8,958 (8,170 to 10,040) | 101,476 | 167 |
| 22 | 59 | 1,920 | 9,139 (8,020 to 9,930) | 112,048 | 9,196 | 175 | 3,495 | 9,226 (7,820 to 10,300) | 110,703 | 168 |
| 23 | 61 | 2,064 | 9,670 (8,560 to 10,440) | 121,718 | 9,616 | 130 | 4,627 | 9,421 (8,690 to 9,920) | 120,124 | 160 |
| 24 | 64 | 2,219 | 12,120 (10,710 to 13,940) | 133,838 | 10,426 | 258 | 3,585 | 12,326 (10,920 to 13,950) | 132,450 | 248 |
| 25 | 66 | 2,386 | 11,258 (10,140 to 12,780) | 145,095 | 11,107 | 185 | 3,901 | 11,584 (10,380 to 13,200) | 144,034 | 201 |
| 26 | 69 | 2,565 | 11,695 (10,770 to 12,480) | 156,790 | 11,905 | 190 | 3,985 | 11,921 (9,860 to 13,000) | 155,955 | 244 |
| 27 | 71 | 2,757 | 12,461 (12,080 to 12,790) | 169,251 | 12,714 | 189 | 4,189 | 12,650 (11,620 to 13,250) | 168,605 | 258 |
| 28 | 74 | 2,964 | 15,838 (14,420 to 18,320) | 185,089 | 13,756 | 235 | 4,236 | 17,189 (13,410 to 19,710) | 185,794 | 403 |
| 29 | 76 | 3,186 | 15,113 (13,660 to 16,160) | 200,201 | 14,613 | 238 | 3,912 | 14,580 (13,970 to 15,380) | 200,374 | 265 |
| 30 | 79 | 3,425 | 15,404 (14,350 to 16,790) | 215,605 | 15,742 | 218 | 4,295 | 15,561 (14,180 to 16,500) | 215,935 | 336 |

- **A run to round 30 pays about 216,000 points** (good 215,605, average 215,935; the review measured 216,140 from 3 runs).
  5,000 a round by round 10, 9,500 by round 20, 15,400 by round 30.
- **Skill does not change income, only time and deaths.** Every zombie pays about the same whoever kills it. The average bot
  takes 10.1 / 36.9 / 77.7 minutes to clear rounds 10 / 20 / 30 against the good bot's 7.4 / 28.1 / 60.9, and takes 19 / 588 / 975
  lethal hits in rounds 1-10 / 11-20 / 21-30 against 1 / 255 / 554.
- **Points a minute level off** near 4,000 from round 9: rounds get longer as fast as they get richer.
- The Model column is the wave killed with the best gun carried, by the maths alone. It is a floor: it leaves out bosses, helmet
  pops, vouchers paid out as points, doubled kills and the knife. The bot earns up to 25% more than it in most rounds, and 40 to 65%
  more in rounds 10 and 12, where the first 750 and 1,000-point bosses arrive.

| Rounds | Points (a run) | Hits | Kills | Bosses | Other | Points a kill | Headshot kills | Box cutter kills |
|---|---|---|---|---|---|---|---|---|
| 1 to 5 | 6,584 | 31% | 66% | 2% | 0% | 117 | 45% | 0% |
| 6 to 10 | 16,918 | 25% | 65% | 4% | 6% | 141 | 44% | 0% |
| 11 to 15 | 30,954 | 29% | 59% | 5% | 7% | 155 | 45% | 3% |
| 16 to 20 | 39,359 | 29% | 61% | 4% | 6% | 131 | 50% | 2% |
| 21 to 25 | 51,281 | 36% | 58% | 1% | 4% | 144 | 44% | 4% |
| 26 to 30 | 70,510 | 43% | 53% | 1% | 2% | 175 | 42% | 8% |

- **A quarter to nearly half of all points are +10 hits**, and the share grows as guns fall behind zombie health: a kill is worth
  117 points on average in rounds 1 to 5 and 175 in rounds 26 to 30.
- So **a weaker gun earns more**. The same bot with only a Price Gun and its warranty earned 278,143 by round 30 (+29%), and without
  builds 258,843 (+20%). It paid for that in time (100 and 83 minutes against 61) and in lethal hits (table in section 4). Any nerf to a
  gun raises income a little, and any buff lowers it.

## 3. What a buyer can afford, and when

The round in each row is the round whose break the purchase was made in (the 10 seconds after the round number goes up).

| # | Purchase | Price | Total so far | Good: curve | Good: bought (min to max) | Average: curve | Average: bought (min to max) |
|---|---|---|---|---|---|---|---|
| 1 | Price Gun | 500 | 500 | 1 | 1.0 (1 to 1) | 1 | 1.0 (1 to 1) |
| 2 | Door: Start shutter | 500 | 1,000 | 2 | 2.0 (2 to 2) | 2 | 2.4 (2 to 3) |
| 3 | Door: Grand Atrium | 1,250 | 2,250 | 4 | 4.0 (4 to 4) | 4 | 4.0 (4 to 4) |
| 4 | Rivet Rifle | 1,500 | 3,750 | 5 | 5.0 (5 to 5) | 5 | 5.0 (5 to 5) |
| 5 | Rivet Rifle: Deluxe | 1,000 | 4,750 | 5 | 5.0 (5 to 5) | 6 | 5.8 (5 to 6) |
| 6 | Door: Promenade | 1,250 | 6,000 | 6 | 6.0 (6 to 6) | 7 | 6.4 (6 to 7) |
| 7 | Rivet Rifle: Build-A-Blaster | 1,500 | 7,500 | 7 | 7.0 (7 to 7) | 7 | 7.1 (7 to 8) |
| 8 | Rivet Rifle: Premium | 3,000 | 10,500 | 8 | 8.0 (8 to 8) | 9 | 8.4 (8 to 9) |
| 9 | Door: HOFFMAN'S | 1,250 | 11,750 | 9 | 8.8 (8 to 9) | 9 | 9.0 (9 to 9) |
| 10 | Apparel: cardigan | 2,500 | 14,250 | 10 | 9.6 (9 to 10) | 10 | 10.0 (10 to 10) |
| 11 | Door: Food Court | 1,000 | 15,250 | 10 | 10.0 (10 to 10) | 10 | 10.3 (10 to 11) |
| 12 | Rivet Rifle: Platinum | 6,000 | 21,250 | 11 | 11.4 (11 to 12) | 12 | 11.6 (11 to 12) |
| 13 | Door: Cinema | 1,250 | 22,500 | 12 | 11.4 (11 to 12) | 12 | 12.1 (12 to 13) |
| 14 | Heavy Coil Nailer | 2,500 | 25,000 | 12 | 12.0 (12 to 12) | 13 | 12.5 (12 to 13) |
| 15 | Heavy Coil Nailer: Build-A-Blaster | 1,500 | 26,500 | 13 | 12.4 (12 to 13) | 13 | 13.0 (13 to 13) |
| 16 | Heavy Coil Nailer: Deluxe | 1,000 | 27,500 | 13 | 13.4 (13 to 14) | 13 | 14.0 (14 to 14) |
| 17 | Heavy Coil Nailer: Premium | 3,000 | 30,500 | 13 | 13.4 (13 to 14) | 13 | 14.0 (14 to 14) |
| 18 | Door: Mega Mart | 750 | 31,250 | 13 | 13.4 (13 to 14) | 14 | 14.0 (14 to 14) |
| 19 | Apparel: fannyPack | 1,500 | 32,750 | 13 | 13.5 (13 to 14) | 14 | 14.0 (14 to 14) |
| 20 | Heavy Coil Nailer: Platinum | 6,000 | 38,750 | 14 | 14.1 (14 to 15) | 15 | 14.8 (14 to 15) |
| 21 | Rivet Rifle: Renewal 1 | 3,000 | 41,750 | 15 | 15.0 (15 to 15) | 15 | 15.1 (15 to 16) |
| 22 | Rivet Rifle: Renewal 2 | 4,000 | 45,750 | 16 | 15.8 (15 to 16) | 16 | 16.0 (16 to 16) |
| 23 | Rivet Rifle: Renewal 3 | 5,500 | 51,250 | 17 | 16.4 (16 to 17) | 17 | 16.8 (16 to 18) |
| 24 | Rivet Rifle: Renewal 4 | 7,500 | 58,750 | 18 | 17.8 (17 to 18) | 18 | 17.9 (17 to 19) |
| 25 | Rivet Rifle: Renewal 5 | 10,000 | 68,750 | 19 | 18.9 (18 to 19) | 19 | 19.5 (19 to 20) |
| 26 | Heavy Coil Nailer: Renewal 1 | 3,000 | 71,750 | 19 | 19.1 (18 to 20) | 20 | 19.8 (19 to 20) |
| 27 | Heavy Coil Nailer: Renewal 2 | 4,000 | 75,750 | 20 | 19.9 (19 to 20) | 20 | 20.4 (20 to 21) |
| 28 | Heavy Coil Nailer: Renewal 3 | 5,500 | 81,250 | 21 | 20.6 (20 to 21) | 21 | 21.1 (20 to 22) |
| 29 | Heavy Coil Nailer: Renewal 4 | 7,500 | 88,750 | 21 | 21.1 (21 to 22) | 22 | 21.8 (21 to 23) |
| 30 | Heavy Coil Nailer: Renewal 5 | 10,000 | 98,750 | 23 | 22.4 (22 to 23) | 23 | 22.5 (22 to 23) in 6/8 |
| 31 | Sharpened Blade | 1,500 | 100,250 | 23 | 22.8 (22 to 23) | 23 | 22.8 (22 to 23) in 6/8 |
| 32 | Box Cutter Pro | 4,000 | 104,250 | 23 | 22.9 (22 to 23) | 23 | 23.2 (23 to 24) in 6/8 |
| 33 | Door: Service Corridor | 1,000 | 105,250 | 23 | 23.0 (23 to 23) | 23 | 23.2 (23 to 24) in 6/8 |
| 34 | Door: Customer Parking | 1,250 | 106,500 | 23 | 23.1 (23 to 24) | 24 | 23.3 (23 to 24) in 6/8 |

- The starter kit (Price Gun, shutter) is in hand by round 2 and the Rivet Rifle by round 5.
- **The first build lands in round 7**, one round before Premium, for both skills.
- Platinum lands in round 11 or 12, the second gun is fully upgraded by round 15, and **the whole 106,500 list is bought by round 23**.
- The "curve" columns come from average income alone, and they agree with what the bot did to within a round. So the next table can
  place a price that is not in the game yet.

| Round (its break) | Good: spendable so far | Good: the round before paid | Average: spendable so far | Average: the round before paid |
|---|---|---|---|---|
| 1 | 500 | - | 500 | - |
| 2 | 1,096 | 596 | 1,010 | 510 |
| 3 | 2,000 | 904 | 1,856 | 846 |
| 4 | 2,984 | 1,203 | 2,798 | 1,191 |
| 5 | 4,871 | 1,905 | 4,496 | 1,730 |
| 6 | 6,648 | 1,976 | 5,850 | 1,766 |
| 7 | 8,709 | 2,555 | 7,866 | 2,429 |
| 8 | 11,420 | 2,930 | 10,413 | 2,784 |
| 9 | 13,709 | 2,689 | 12,664 | 2,808 |
| 10 | 16,859 | 3,530 | 15,919 | 3,636 |
| 11 | 21,688 | 5,214 | 20,139 | 4,741 |
| 12 | 26,280 | 4,949 | 24,403 | 4,595 |
| 13 | 33,216 | 7,336 | 30,875 | 6,816 |
| 14 | 39,143 | 6,211 | 37,105 | 6,480 |
| 15 | 45,153 | 6,410 | 42,786 | 6,181 |
| 16 | 51,100 | 6,048 | 49,793 | 7,256 |
| 17 | 57,309 | 6,359 | 55,899 | 6,406 |
| 18 | 64,681 | 7,623 | 62,539 | 6,890 |
| 19 | 71,934 | 7,503 | 69,378 | 7,289 |
| 20 | 80,060 | 8,404 | 77,236 | 8,134 |
| 21 | 89,231 | 9,471 | 87,216 | 10,030 |
| 22 | 98,026 | 9,095 | 96,024 | 8,958 |
| 23 | 106,965 | 9,139 | 105,250 | 9,226 |
| 24 | 116,435 | 9,670 | 114,621 | 9,421 |
| 25 | 128,405 | 12,120 | 126,748 | 12,326 |
| 26 | 139,513 | 11,258 | 138,081 | 11,584 |
| 27 | 151,058 | 11,695 | 149,753 | 11,921 |
| 28 | 163,169 | 12,461 | 161,403 | 12,650 |
| 29 | 178,656 | 15,838 | 178,341 | 17,189 |
| 30 | 193,419 | 15,113 | 192,171 | 14,580 |

| Round | Earned | Spent | of it ammo | Bank at the start | Earned so far | Spent so far |
|---|---|---|---|---|---|---|
| 1 | 596 | 500 | 0 | 500 | 596 | 500 |
| 2 | 904 | 500 | 0 | 596 | 1,500 | 1,000 |
| 3 | 1,203 | 0 | 0 | 1,000 | 2,703 | 1,000 |
| 4 | 1,905 | 1,469 | 219 | 2,203 | 4,608 | 2,469 |
| 5 | 1,976 | 2,425 | 18 | 2,639 | 6,584 | 4,894 |
| 6 | 2,555 | 1,450 | 200 | 2,190 | 9,139 | 6,344 |
| 7 | 2,930 | 1,994 | 494 | 3,295 | 12,069 | 8,338 |
| 8 | 2,689 | 3,531 | 219 | 4,231 | 14,758 | 11,869 |
| 9 | 3,530 | 2,151 | 400 | 3,389 | 18,288 | 14,020 |
| 10 | 5,214 | 2,880 | 380 | 4,768 | 23,501 | 16,900 |
| 11 | 4,949 | 4,916 | 385 | 7,101 | 28,450 | 21,816 |
| 12 | 7,336 | 6,513 | 356 | 7,134 | 35,786 | 28,329 |
| 13 | 6,211 | 4,681 | 400 | 7,958 | 41,998 | 33,010 |
| 14 | 6,410 | 8,066 | 285 | 9,488 | 48,408 | 41,076 |
| 15 | 6,048 | 5,150 | 400 | 7,831 | 54,455 | 46,226 |
| 16 | 6,359 | 6,538 | 100 | 8,729 | 60,814 | 52,764 |
| 17 | 7,623 | 4,050 | 150 | 8,550 | 68,436 | 56,814 |
| 18 | 7,503 | 6,769 | 250 | 12,123 | 75,939 | 63,583 |
| 19 | 8,404 | 11,375 | 250 | 12,856 | 84,343 | 74,958 |
| 20 | 9,471 | 6,590 | 278 | 9,885 | 93,814 | 81,548 |
| 21 | 9,095 | 10,300 | 300 | 12,766 | 102,909 | 91,848 |
| 22 | 9,139 | 7,988 | 300 | 11,561 | 112,048 | 99,835 |
| 23 | 9,670 | 10,529 | 200 | 12,713 | 121,718 | 110,364 |
| 24 | 12,120 | 356 | 200 | 11,854 | 133,838 | 110,720 |
| 25 | 11,258 | 150 | 150 | 23,618 | 145,095 | 110,870 |
| 26 | 11,695 | 150 | 150 | 34,725 | 156,790 | 111,020 |
| 27 | 12,461 | 150 | 150 | 46,270 | 169,251 | 111,170 |
| 28 | 15,838 | 350 | 350 | 58,581 | 185,089 | 111,520 |
| 29 | 15,113 | 350 | 350 | 74,069 | 200,201 | 111,870 |
| 30 | 15,404 | 350 | 350 | 88,831 | 215,605 | 112,220 |

- **After round 23 there is nothing left to buy.** Rounds 25 to 30 earned 81,768 and spent 1,500 (ammo); the run ends with 103,885
  unspent. The review saw the same (about 92,000 earned and 2,000 spent over rounds 24 to 30).
- **Ammo is not a sink**: 7,283 points over 30 rounds, 3% of income. The 400-point RESTOCK-O-MATIC and Platinum's free claim (used
  about 15 times a run) keep it trivial.
- Prices are flat and income is not: a round pays 26 times as much at round 30 as at round 1. Anything meant to matter late needs
  a price that climbs (as Renewals do) or has to be bought again and again (hazards, Kiosk Kevin's stock, grabs).

## 4. The power curve

| Round | Shopper hp | x round 1 | Best gun (most runs) | Its dps | x Staple Gun | Seconds a Shopper | Round seconds | Deaths |
|---|---|---|---|---|---|---|---|---|
| 1 | 150 | 1.0 | Price Gun | 524 | 4.1 | 0.29 | 20 | 0.0 |
| 2 | 225 | 1.5 | Price Gun | 524 | 4.1 | 0.43 | 34 | 0.0 |
| 3 | 300 | 2.0 | Price Gun | 524 | 4.1 | 0.57 | 36 | 0.0 |
| 4 | 375 | 2.5 | Price Gun | 524 | 4.1 | 0.72 | 42 | 0.0 |
| 5 | 450 | 3.0 | Rivet Rifle, Deluxe | 735 | 5.8 | 0.61 | 44 | 0.0 |
| 6 | 525 | 3.5 | Rivet Rifle, Deluxe | 735 | 5.8 | 0.71 | 48 | 0.1 |
| 7 | 600 | 4.0 | Rivet Rifle, Deluxe, built | 1,156 | 9.1 | 0.52 | 53 | 0.4 |
| 8 | 675 | 4.5 | Rivet Rifle, Premium, built | 1,401 | 11.0 | 0.48 | 51 | 0.0 |
| 9 | 750 | 5.0 | Rivet Rifle, Premium, built | 1,401 | 11.0 | 0.54 | 52 | 0.3 |
| 10 | 806 | 5.4 | Rivet Rifle, Premium, built | 1,401 | 11.0 | 0.58 | 62 | 0.5 |
| 11 | 867 | 5.8 | Rivet Rifle, Platinum, built (5/8) | 1,564 | 12.3 | 0.55 | 98 | 13.9 |
| 12 | 932 | 6.2 | Rivet Rifle, Platinum, built | 1,662 | 13.0 | 0.56 | 136 | 25.9 |
| 13 | 1,002 | 6.7 | Rivet Rifle, Platinum, built | 1,662 | 13.0 | 0.60 | 92 | 4.4 |
| 14 | 1,077 | 7.2 | Heavy Coil Nailer, Platinum, built (7/8) | 1,783 | 14.0 | 0.60 | 102 | 5.9 |
| 15 | 1,157 | 7.7 | Heavy Coil Nailer, Platinum, built (6/8) | 1,827 | 14.3 | 0.63 | 123 | 21.4 |
| 16 | 1,244 | 8.3 | Rivet Rifle, Platinum +3, built (5/8) | 1,985 | 15.5 | 0.63 | 90 | 15.5 |
| 17 | 1,338 | 8.9 | Rivet Rifle, Platinum +3, built (6/8) | 2,069 | 16.2 | 0.65 | 198 | 58.1 |
| 18 | 1,438 | 9.6 | Rivet Rifle, Platinum +4, built (7/8) | 2,198 | 17.2 | 0.65 | 122 | 19.4 |
| 19 | 1,546 | 10.3 | Rivet Rifle, Platinum +5, built | 2,324 | 18.2 | 0.67 | 162 | 62.4 |
| 20 | 1,662 | 11.1 | Rivet Rifle, Platinum +5, built | 2,324 | 18.2 | 0.72 | 123 | 27.8 |
| 21 | 1,786 | 11.9 | Heavy Coil Nailer, Platinum +4, built (7/8) | 2,333 | 18.3 | 0.77 | 148 | 25.5 |
| 22 | 1,920 | 12.8 | Heavy Coil Nailer, Platinum +5, built (5/8) | 2,431 | 19.0 | 0.79 | 175 | 34.1 |
| 23 | 2,064 | 13.8 | Heavy Coil Nailer, Platinum +5, built | 2,490 | 19.5 | 0.83 | 130 | 21.5 |
| 24 | 2,219 | 14.8 | Heavy Coil Nailer, Platinum +5, built | 2,490 | 19.5 | 0.89 | 258 | 169.0 |
| 25 | 2,386 | 15.9 | Heavy Coil Nailer, Platinum +5, built | 2,490 | 19.5 | 0.96 | 185 | 40.3 |
| 26 | 2,565 | 17.1 | Heavy Coil Nailer, Platinum +5, built | 2,490 | 19.5 | 1.03 | 190 | 40.3 |
| 27 | 2,757 | 18.4 | Heavy Coil Nailer, Platinum +5, built | 2,490 | 19.5 | 1.11 | 189 | 35.6 |
| 28 | 2,964 | 19.8 | Heavy Coil Nailer, Platinum +5, built | 2,490 | 19.5 | 1.19 | 235 | 88.9 |
| 29 | 3,186 | 21.2 | Heavy Coil Nailer, Platinum +5, built | 2,490 | 19.5 | 1.28 | 238 | 45.5 |
| 30 | 3,425 | 22.8 | Heavy Coil Nailer, Platinum +5, built | 2,490 | 19.5 | 1.38 | 218 | 53.1 |

- **Upgrades keep pace with zombie health until the list runs out.** A Shopper takes 0.3 to 0.85 seconds of sustained fire from
  round 1 to round 23, while its health grows 14 times over. After round 23 nothing more can be bought and the time climbs to 1.4
  seconds by round 30.
- **The build is the biggest single step**: the best gun goes from 735 to 1,156 dps in round 7, and a Shopper dies faster in rounds
  7 and 8 (0.5 seconds) than in round 4 (0.7).
- The difficulty wall is round 11, and it is not the gun: lethal hits go from under 1 a round to 14 in round 11 and never drop
  below 4 again, while the time to kill a Shopper stays flat. The worst rounds are boss rounds (17, 24 and 28 in these runs).

| Gun | Price | Route | dps at 5 m | x Price Gun | dps at 15 m | dps per 1,000 of route |
|---|---|---|---|---|---|---|
| Staple Gun | start | - | 128 | 0.24 | - | - |
| Price Gun | 500 | 500 | 524 | 1.00 | 492 | 1,047 |
| Nail Gun | 1,000 | 1,500 | 333 | 0.64 | 333 | 222 |
| Foam Dart Blaster | 1,200 | 2,450 | 570 | 1.09 | 570 | 232 |
| Confetti Cannon | 1,500 | 3,000 | 488 | 0.93 | 10 | 163 |
| Rivet Rifle | 1,500 | 3,250 | 582 | 1.11 | 542 | 179 |
| Heavy Coil Nailer | 2,500 | 5,250 | 647 | 1.24 | 647 | 123 |
| Barcode Scanner | 1,750 | 3,000 | 292 | 0.56 | 292 | 97 |

- **The 500-point Price Gun is the best deal in the mall by a wide margin**: 1,047 dps per 1,000 points of route, against 179 for the
  Rivet Rifle and 123 for the Heavy Coil Nailer. The Rivet Rifle is 11% stronger for 6.5 times the points.
- The Nail Gun (1,000) and the Barcode Scanner (1,750) do about 60% of the Price Gun's damage on one target. They are role guns
  (pierce, no falloff), and one-target dps undersells them; it is still what a new player compares.

| Purchase | Price | Spent on this line | Damage in total | This step adds | Points per +1% damage | Rounds of zombie health it buys back |
|---|---|---|---|---|---|---|
| Deluxe | 1,000 | 1,000 | x1.10 | +10% | 100 | 1.3 |
| Premium | 3,000 | 4,000 | x1.45 | +32% | 94 | 3.8 |
| Platinum | 6,000 | 10,000 | x1.65 | +14% | 435 | 1.8 |
| Renewal 1 | 3,000 | 13,000 | x1.75 | +6% | 500 | 0.8 |
| Renewal 2 | 4,000 | 17,000 | x1.85 | +6% | 667 | 0.8 |
| Renewal 3 | 5,500 | 22,500 | x1.97 | +6% | 917 | 0.8 |
| Renewal 4 | 7,500 | 30,000 | x2.08 | +6% | 1,250 | 0.8 |
| Renewal 5 | 10,000 | 40,000 | x2.21 | +6% | 1,667 | 0.8 |
| Build, Understuffed | 1,500 | 1,500 | x1.50 | +50% | 30 | 5.6 |
| Build, Regular | 1,500 | 1,500 | x1.70 | +70% | 21 | 7.3 |
| Build, Extra Stuffed | 1,500 | 1,500 | x1.90 | +90% | 17 | 8.9 |
| Build, Overstuffed | 1,500 | 1,500 | x2.20 | +120% | 12 | 10.9 |

- **A build is 4 to 8 times better value than any warranty step**: 12 to 30 points per +1% damage against 94 to 100 for Deluxe and
  Premium, before its stuffing effect is counted.
- **Platinum and the Renewals are 5 to 18 times worse value than Premium** (435 to 1,667 points per +1%). A Renewal does not keep up
  with one round of zombie health growth (0.8 rounds).

| Set-up | Runs | Earned by round 10 | Earned by round 20 | Earned by round 30 | Minutes to clear 10 | Minutes to clear 20 | Minutes to clear 30 | Deaths, rounds 1 to 10 | Deaths, rounds 11 to 20 | Deaths, rounds 21 to 30 | Unspent at the end |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SENSIBLE | 8 | 23,501 | 93,814 | 215,605 | 7.4 | 28.1 | 60.9 | 1.3 | 254.5 | 553.8 | 103,885 |
| Price Gun and its warranty only | 4 | 24,180 | 107,980 | 278,143 | 8.1 | 33.2 | 99.7 | 8.5 | 909.5 | 4033.3 | 223,328 |
| SENSIBLE without builds | 4 | 24,080 | 108,258 | 258,843 | 9.3 | 37.6 | 83.1 | 12.3 | 763.3 | 839.0 | 146,958 |

- **The Price Gun alone carries to round 10**: 8.1 minutes against 7.4, with 8.5 lethal hits against 1.3. From round 11 it falls
  apart (910 lethal hits in rounds 11 to 20).
- Without builds the first ten rounds take 9.3 minutes and 12 lethal hits: the build is what makes rounds 7 to 10 comfortable.

One life, the same bot and buy order, 40 runs a set-up (the full table, with the proposals, is in 6.5):

| Set-up | Died in round: mean | Median | Reached round 8 | Reached round 10 | Owned a build when it died |
|---|---|---|---|---|---|
| SENSIBLE, good skill | 8.1 | 7 | 45% | 38% | 19 of 40 |
| SENSIBLE, average skill | 6.0 | 6 | 18% | 0% | 8 of 40 |
| SENSIBLE without builds, good skill | 7.7 | 7 | 40% | 25% | 0 of 40 |

- **Good skill: half the runs are over by round 7, 38% reach round 10, none reaches round 15.** Runs split in two: one dies in round
  6 or 7, or it gets to rounds 10 to 12. So the median hardly moves between set-ups, and the share reaching round 10 is the number to watch.
- **Average skill: round 6, and never round 10.** 32 of 40 runs died before they owned a build.
- **Without builds, 25% reach round 10 instead of 38%, and no run got past round 10.**

## 5. The review's findings, re-measured

| The review said | Measured here | Verdict |
|---|---|---|
| The 500-point Price Gun does 524 sustained dps against the Rivet Rifle's 582 (1,500 plus a 1,250 door) and the Coil Nailer's 647 | 524, 582 and 647 at 5 m. Routes from the start room: 500, 3,250 and 5,250 points | Confirmed |
| Build-A-Blaster is 1,500 for 1.5x to 2.2x damage, reachable by round 6 or 7 | x1.5 to x2.2 by quality. Bought in round 7 by both skills (7 to 8). A rush on the Price Gun (shutter, Promenade, build: 3,750) is affordable in round 5 | Confirmed, and a rush is two rounds earlier |
| Platinum is 6,000 for about 14% over Premium; five Renewals are 30,000 for 34% | +13.8% (x1.45 to x1.65) and +33.8% (x1.06 five times) | Confirmed |
| A bot had bought every power upgrade by round 23; rounds 24 to 30 earned about 92,000 and spent about 2,000 | List finished in round 23.1 (23 to 24) over 8 runs. Rounds 24 to 30 earned 93,888; rounds 25 to 30 spent 1,500 | Confirmed |
| The claw at 1,000 in the hallway is worth more than its price | The first grab wins 1.52x its price in wall value (1.67x with a timed press). The bot's two grabs, the first in round 3, won a Foam Dart Blaster, Rivet Rifle or Coil Nailer 12 times in 16 | Confirmed |

## 6. Proposals (not applied)

Four changes were asked for. Each has its numbers in tools/economyPlans.js (PROPOSALS), where the sim applies them in memory only, so
the "after" columns below were played, not estimated. Read 6.5 before approving any of A or B: they do what was asked, and they cost survival.

### 6.1 A. A weaker Price Gun: 70 to 58 damage

`weapons.priceGun.damage` 70 -> 58. Nothing else about the gun changes.

| Damage | dps 5 m | dps 15 m | dps 30 m | x Staple Gun | Nail Gun / it | Foam / it | Rivet / it | Coil / it | Shots, round 1 | round 5 | round 8 | round 10 | Points a Shopper, round 5 | round 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 70 (today) | 524 | 492 | 317 | 4.10 | 0.64 | 1.09 | 1.11 | 1.24 | 3 | 7 | 10 | 12 | 120 | 170 |
| 62 | 464 | 435 | 281 | 3.63 | 0.72 | 1.23 | 1.25 | 1.39 | 3 | 8 | 11 | 13 | 130 | 180 |
| 58 | 434 | 407 | 263 | 3.40 | 0.77 | 1.31 | 1.34 | 1.49 | 3 | 8 | 12 | 14 | 130 | 190 |
| 56 | 419 | 393 | 254 | 3.28 | 0.80 | 1.36 | 1.39 | 1.54 | 3 | 9 | 13 | 15 | 140 | 200 |
| 52 | 389 | 365 | 236 | 3.05 | 0.86 | 1.46 | 1.50 | 1.66 | 3 | 9 | 13 | 16 | 140 | 210 |

- At 58 the later guns are upgrades: the Rivet Rifle does 1.34x its damage (today 1.11x), the Foam Dart Blaster 1.31x (1.09x), the
  Heavy Coil Nailer 1.49x (1.24x). 58 is the smallest cut that puts all three at 1.3x or more.
- It is still the starter: 3.4 times the Staple Gun, three body shots for a round-1 Shopper as today, and still the most damage per
  point in the mall (868 dps per 1,000 points against the Rivet Rifle route's 179).
- It pays slightly more (+10 points a Shopper from round 5, +20 by round 10): 23,978 by round 10 against 23,501.
- Played to round 30 it changes little: 8.0 minutes to clear round 10 against 7.4, the same total income. Its cost shows in one-life
  runs (6.5), because the Price Gun is the bot's only real gun until round 5 and its fallback while the Rivet Rifle is on the
  Build-A-Blaster conveyor.
- When applied: tests/balance.test.js pins the Price Gun at 10 body shots for a round-8 Shopper; it becomes 12.

### 6.2 B. Build-A-Blaster as the mid-game milestone

Today the build costs 1,500, less than Premium (3,000 after a 1,000 Deluxe), and does more. It is bought in round 7.

| Build price | Points per +1% (Regular build) | Points per +1% (Deluxe + Premium) | Build first: list total | Good: curve | Average: curve | Premium first: list total | Good: curve | Average: curve | Rush: list total | Good: curve | Average: curve | Rush, Premium needed: total | Good: curve | Average: curve |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1,500 (today) | 21 | 89 | 7,500 | 7 | 7 | 10,500 | 8 | 9 | 3,750 | 5 | 5 | 7,750 | 7 | 7 |
| 3,000 | 43 | 89 | 9,000 | 8 | 8 | 12,000 | 9 | 9 | 5,250 | 6 | 6 | 9,250 | 8 | 8 |
| 4,000 | 57 | 89 | 10,000 | 8 | 8 | 13,000 | 9 | 10 | 6,250 | 6 | 7 | 10,250 | 8 | 8 |
| 5,000 | 71 | 89 | 11,000 | 8 | 9 | 14,000 | 10 | 10 | 7,250 | 7 | 7 | 11,250 | 8 | 9 |
| 6,000 | 86 | 89 | 12,000 | 9 | 9 | 15,000 | 10 | 10 | 8,250 | 7 | 8 | 12,250 | 9 | 9 |

- **A price alone cannot make it a mid-game purchase.** Income climbs too fast: at 5,000 the sensible buyer still has it in round 8 or 9,
  and a player who skips everything else and builds the Price Gun has it in round 7. Even 6,000 lands in round 9.
- **B1 (recommended if you want it in round 9 or later): 4,000, and the bench only takes a gun under Premium warranty.** Played, the
  first build landed in round 9 in all four runs, one round after Premium, and a rush cannot beat round 8. At 4,000 a Regular build
  is 57 points per +1% damage: still better value than Premium (89), so it stays the thing to save for. It needs one new rule in
  the order form (a blocked prompt, "Premium warranty needed"), which is a code change, not only a number.
- **B2 (numbers only): 5,000, no rule.** Played, the first build landed in round 8.3 (8 to 9), bought before Premium. A rush still
  has it in round 7.
- Either way the re-stuff goes to half the build's price (2,000 or 2,500), as today.
- When applied: tests/workshopPower.test.js asserts a build costs less than Premium; that sentence has to go. The other workshop tests read config.

### 6.3 C. Platinum and Renewals worth their price

`upgrades.tiers` platinum damage x1.65 -> x1.9; `upgrades.renewals.effects.damage` x1.06 -> x1.09; `economy.upgrades.renewals`
3,000 / 4,000 / 5,500 / 7,500 / 10,000 -> 4,000 / 5,000 / 6,500 / 8,000 / 10,000. Platinum stays 6,000.

Today:

| Purchase | Price | Spent on this line | Damage in total | This step adds | Points per +1% damage | Rounds of zombie health it buys back |
|---|---|---|---|---|---|---|
| Deluxe | 1,000 | 1,000 | x1.10 | +10% | 100 | 1.3 |
| Premium | 3,000 | 4,000 | x1.45 | +32% | 94 | 3.8 |
| Platinum | 6,000 | 10,000 | x1.65 | +14% | 435 | 1.8 |
| Renewal 1 | 3,000 | 13,000 | x1.75 | +6% | 500 | 0.8 |
| Renewal 2 | 4,000 | 17,000 | x1.85 | +6% | 667 | 0.8 |
| Renewal 3 | 5,500 | 22,500 | x1.97 | +6% | 917 | 0.8 |
| Renewal 4 | 7,500 | 30,000 | x2.08 | +6% | 1,250 | 0.8 |
| Renewal 5 | 10,000 | 40,000 | x2.21 | +6% | 1,667 | 0.8 |

Proposed:

| Purchase | Price | Spent on this line | Damage in total | This step adds | Points per +1% damage | Rounds of zombie health it buys back |
|---|---|---|---|---|---|---|
| Deluxe | 1,000 | 1,000 | x1.10 | +10% | 100 | 1.3 |
| Premium | 3,000 | 4,000 | x1.45 | +32% | 94 | 3.8 |
| Platinum | 6,000 | 10,000 | x1.90 | +31% | 193 | 3.7 |
| Renewal 1 | 4,000 | 14,000 | x2.07 | +9% | 444 | 1.2 |
| Renewal 2 | 5,000 | 19,000 | x2.26 | +9% | 556 | 1.2 |
| Renewal 3 | 6,500 | 25,500 | x2.46 | +9% | 722 | 1.2 |
| Renewal 4 | 8,000 | 33,500 | x2.68 | +9% | 889 | 1.2 |
| Renewal 5 | 10,000 | 43,500 | x2.92 | +9% | 1,111 | 1.2 |

- Platinum goes from +14% over Premium to +31%: 193 points per +1% instead of 435, and it buys back 3.7 rounds of zombie health
  instead of 1.8. Its `holdsUntilRound` can go from 14 to 16.
- A Renewal now beats a round of zombie health (1.2 rounds, was 0.8). Five of them are +54% for 33,500, against +34% for 30,000.
- Nothing changes before round 11. Played to round 30: 54.8 minutes against 60.9, 164 lethal hits in rounds 11 to 20 against 255,
  and 393 against 554 in rounds 21 to 30.
- Stronger guns earn less: 200,980 by round 30 against 215,605 (-7%), and 84,790 left unspent against 103,885.
- When applied: no test pins these numbers (tests/upgrades.test.js checks a tier holds until its `holdsUntilRound`, which a stronger Platinum passes).

### 6.4 D. A claw price: 1,000 to 1,500

`economy.claw.grab` 1,000 -> 1,500.

| Grab price | First grab: value / price (3-in-4) | (timed) | (random lane) | Whole site: value per point (3-in-4) | Start shutter + one grab | Closest gun: claw (perfect) / its wall route |
|---|---|---|---|---|---|---|
| 1,000 (today) | 1.52 | 1.67 | 1.24 | 1.49 | 1,500 | 1.19 |
| 1,250 | 1.22 | 1.33 | 0.99 | 1.20 | 1,750 | 1.43 |
| 1,500 | 1.01 | 1.11 | 0.83 | 1.00 | 2,000 | 1.68 |
| 1,750 | 0.87 | 0.95 | 0.71 | 0.85 | 2,250 | 1.93 |

| Set-up | Runs | First grab: round | Prizes (both grabs, all runs) | Spent on grabs (a run) | Carrying a Rivet Rifle or better by round 5 | Rivet Rifle bought off the wall: round |
|---|---|---|---|---|---|---|
| Claw first, 1,000 a grab (today) | 8 | 3.0 (3.0 to 3.0) | Foam Dart Blaster 8, Price Gun 2, Rivet Rifle 2, Heavy Coil Nailer 2, Nail Gun (left) 1, Nail Gun 1 | 2,000 | 4/8 | 6.0 in 6/8 |
| Claw first, D. Claw grab 1,000 -> 1,500 | 8 | 4.0 (4.0 to 4.0) | Foam Dart Blaster 7, Rivet Rifle 5, Heavy Coil Nailer 2, Price Gun 1, Tennis Ball Launcher (left) 1 | 3,000 | 5/8 | 6.0 in 4/8 |

| Set-up | Runs | Earned by round 5 | Earned by round 10 | Earned by round 15 | Minutes to clear 5 | Minutes to clear 10 | Minutes to clear 15 | Deaths, rounds 1 to 5 | Deaths, rounds 6 to 10 | Deaths, rounds 11 to 15 | Unspent at the end |
|---|---|---|---|---|---|---|---|---|---|---|---|
| No claw (SENSIBLE) | 8 | 6,451 | 22,666 | 54,871 | 2.9 | 7.6 | 16.8 | 0.0 | 4.6 | 145.5 | 8,830 |
| Claw first, today | 8 | 6,585 | 23,004 | 54,875 | 2.9 | 8.3 | 17.4 | 0.1 | 3.0 | 93.0 | 10,331 |
| Claw first, dearer grab | 8 | 6,618 | 23,741 | 54,565 | 2.9 | 8.3 | 17.3 | 0.0 | 7.6 | 150.1 | 10,225 |

- At 1,000 the first grab wins 1.52 times its price in wall value. At 1,500 it wins what it costs (1.01x; 1.11x with a timed press),
  and every gun is at least 1.68 times cheaper on its wall than from the claw.
- The bot's first grab moves from round 3 to round 4. The prizes are the same: a Foam Dart Blaster, Rivet Rifle or Heavy Coil Nailer
  in most grabs, a round or two before the wall route could buy a Rivet Rifle.
- 1,250 is the half step (1.22x), which docs/history.md recommended before prize tickets existed. With tickets in, and with a weaker
  Price Gun making a Blue capsule a bigger jump (proposal A), 1,500 is the price where a grab is a gamble and not a bargain.
- The first fifteen rounds were no faster or slower with the claw at either price (17.3 and 17.4 minutes against 16.8 without it).
- When applied: no test pins the price.

### 6.5 What the proposals cost: survival

| Set-up | Runs | Died in round: mean | Median | Quarter to three-quarter | Min to max | Reached 8 | Reached 10 | Owned a build | Killed by (most often) |
|---|---|---|---|---|---|---|---|---|---|
| SENSIBLE, good skill | 40 | 8.1 | 7.0 | 6.0 to 10.0 | 4 to 12 | 45% | 38% | 19/40 | shopper (21) |
| SENSIBLE, average skill | 40 | 6.0 | 6.0 | 5.0 to 7.0 | 4 to 9 | 18% | 0% | 8/40 | shopper (26) |
| No build, good skill | 40 | 7.7 | 7.0 | 7.0 to 9.3 | 4 to 10 | 40% | 25% | 0/40 | shopper (25) |
| Claw first, 1,000 a grab (today), good skill | 40 | 8.6 | 8.0 | 7.0 to 11.0 | 5 to 14 | 57% | 30% | 20/40 | shopper (21) |
| A. Price Gun 70 -> 58 damage, good skill | 40 | 7.9 | 7.0 | 7.0 to 10.0 | 4 to 12 | 45% | 28% | 22/40 | shopper (21) |
| A2. Price Gun 70 -> 62 damage, good skill | 40 | 8.0 | 7.0 | 7.0 to 10.0 | 4 to 12 | 43% | 38% | 24/40 | mallWalker (17) |
| B3. Build 1,500 -> 3,000, no gate (re-stuff 750 -> 1,500), good skill | 40 | 7.8 | 7.0 | 6.0 to 10.0 | 4 to 13 | 40% | 28% | 15/40 | shopper (24) |
| B1. Build 1,500 -> 4,000, Premium warranty first (re-stuff 750 -> 2,000), good skill | 40 | 7.7 | 7.0 | 7.0 to 9.0 | 4 to 13 | 48% | 15% | 8/40 | shopper (22) |
| B2. Build 1,500 -> 5,000, no gate (re-stuff 750 -> 2,500), good skill | 40 | 7.3 | 7.0 | 6.0 to 8.0 | 4 to 12 | 38% | 13% | 7/40 | shopper (25) |
| C. Platinum x1.65 -> x1.9; Renewals x1.06 -> x1.09, 3,000-10,000 -> 4,000-10,000, good skill | 40 | 8.4 | 9.0 | 7.0 to 10.3 | 4 to 13 | 53% | 40% | 25/40 | shopper (18) |
| D. Claw grab 1,000 -> 1,500, good skill (claw-first buy order) | 40 | 8.1 | 7.5 | 7.0 to 9.3 | 5 to 13 | 50% | 25% | 17/40 | shopper (19) |
| A + B + C + D together, good skill | 40 | 7.7 | 7.5 | 7.0 to 9.0 | 4 to 12 | 50% | 15% | 9/40 | shopper (20) |
| A + B + C + D together, average skill | 40 | 5.8 | 6.0 | 4.8 to 7.0 | 3 to 8 | 13% | 0% | 0/40 | shopper (23) |

- **How much is noise.** Proposal C plays exactly today's game until Platinum is bought in round 11, so its row is a second sample of
  today: 40% reach round 10 against 38%, mean death round 8.4 against 8.1. Differences of that size mean nothing. (The first 20
  runs on today's numbers had a median of round 10; all 40 have 7.)
- **B costs survival, in either form.** 15% (B1) and 13% (B2) of runs reach round 10, against 38 to 40% today. That is below the 25%
  of a buyer who never builds at all, because this buyer is also saving 4,000 or 5,000 while it waits. Only 8 and 7 runs of 40 owned a
  build when they died, against 19 today. The round-7 build is what carries a good run through rounds 7 to 10.
- **B3 (3,000, no rule) is the mild version**: 28% reach round 10 and 15 of 40 owned a build. On the income curve it moves the first
  build one round, to round 8, and a rush to round 6. It was played for survival only.
- **A has no clear cost.** 28% reach round 10 at 58 damage and 38% at 62; the mean death round is 7.9 and 8.0 against 8.1. If you
  want the safer cut, 62 makes the Rivet Rifle 1.25x and the Foam Dart Blaster 1.23x.
- **D has no clear cost.** With a claw-first buy order, 30% reach round 10 at 1,000 a grab and 25% at 1,500.
- **Everything together costs what B1 costs**: 15% reach round 10, mean death round 7.7.
- **Average skill barely changes, because it was already not getting there.** With everything in, it dies in round 5.8 against 6.0,
  13% reach round 8 against 18%, and none of 40 runs ever owned a build (8 of 40 today).

So A, C and D can go in as proposed. B is a trade: the build becomes a round-9 milestone, and the good player's rounds 7 to 10 get
about as hard as they are for someone who never builds. If that is not wanted, either take B3, or pair B1 with something that gives
rounds 7 to 9 back (a cheaper Deluxe and Premium, or a slower climb in zombie health over those rounds). Neither pairing was measured.

### 6.6 Everything together (A, B1, C, D)

| Set-up | Runs | Earned by round 10 | Earned by round 20 | Earned by round 30 | Minutes to clear 10 | Minutes to clear 20 | Minutes to clear 30 | Deaths, rounds 1 to 10 | Deaths, rounds 11 to 20 | Deaths, rounds 21 to 30 | Unspent at the end |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Today | 8 | 23,501 | 93,814 | 215,605 | 7.4 | 28.1 | 60.9 | 1.3 | 254.5 | 553.8 | 103,885 |
| A. Price Gun 70 -> 58 damage | 4 | 23,978 | 93,400 | 216,550 | 8.0 | 27.9 | 59.7 | 1.0 | 311.5 | 442.0 | 105,455 |
| B1. Build 1,500 -> 4,000, Premium warranty first (re-stuff 750 -> 2,000) | 4 | 23,343 | 96,418 | 218,953 | 8.3 | 27.2 | 58.1 | 7.5 | 208.5 | 571.0 | 100,938 |
| B2. Build 1,500 -> 5,000, no gate (re-stuff 750 -> 2,500) | 4 | 23,078 | 96,623 | 218,615 | 8.6 | 31.2 | 66.4 | 4.8 | 427.8 | 582.0 | 102,563 |
| C. Platinum x1.65 -> x1.9; Renewals x1.06 -> x1.09, 3,000-10,000 -> 4,000-10,000 | 4 | 23,235 | 91,540 | 200,980 | 7.7 | 28.4 | 54.8 | 4.0 | 163.5 | 392.5 | 84,790 |
| A + B + C + D together | 4 | 24,893 | 94,540 | 202,460 | 8.7 | 28.2 | 52.8 | 18.3 | 339.8 | 295.3 | 79,445 |

| Set-up | First build | First Premium | First Platinum | Second gun built | Last Renewal |
|---|---|---|---|---|---|
| Today | 7.0 (7 to 7) | 8.0 (8 to 8) | 11.4 (11 to 12) | 12.4 (12 to 13) | 22.4 (22 to 23) |
| A. Price Gun 70 -> 58 damage | 6.5 (6 to 7) | 8.0 (8 to 8) | 11.0 (11 to 11) | 11.8 (11 to 12) | 22.3 (22 to 23) |
| B1. Build 1,500 -> 4,000, Premium warranty first (re-stuff 750 -> 2,000) | 9.0 (9 to 9) | 7.8 (7 to 8) | 12.0 (12 to 12) | 13.5 (13 to 14) | 22.8 (22 to 23) |
| B2. Build 1,500 -> 5,000, no gate (re-stuff 750 -> 2,500) | 8.3 (8 to 9) | 9.3 (9 to 10) | 12.0 (12 to 12) | 13.5 (13 to 14) | 22.7 (22 to 23) in 3/4 |
| C. Platinum x1.65 -> x1.9; Renewals x1.06 -> x1.09, 3,000-10,000 -> 4,000-10,000 | 7.0 (7 to 7) | 8.0 (8 to 8) | 11.5 (11 to 12) | 12.5 (12 to 13) | 23.3 (22 to 24) |
| A + B + C + D together | 9.0 (9 to 9) | 7.8 (7 to 8) | 12.0 (12 to 12) | 13.8 (13 to 14) | 23.8 (23 to 24) |

The buyer and the power curve with all four in (4 runs):

| # | Purchase | Price | Total so far | Good: curve | Good: bought (min to max) |
|---|---|---|---|---|---|
| 1 | Price Gun | 500 | 500 | 1 | 1.0 (1 to 1) |
| 2 | Door: Start shutter | 500 | 1,000 | 2 | 2.0 (2 to 2) |
| 3 | Door: Grand Atrium | 1,250 | 2,250 | 4 | 4.0 (4 to 4) |
| 4 | Rivet Rifle | 1,500 | 3,750 | 5 | 5.0 (5 to 5) |
| 5 | Rivet Rifle: Deluxe | 1,000 | 4,750 | 5 | 5.0 (5 to 5) |
| 6 | Door: Promenade | 1,250 | 6,000 | 6 | 6.0 (6 to 6) |
| 7 | Rivet Rifle: Premium | 3,000 | 9,000 | 8 | 7.8 (7 to 8) |
| 8 | Rivet Rifle: Build-A-Blaster | 4,000 | 13,000 | 9 | 9.0 (9 to 9) |
| 9 | Door: HOFFMAN'S | 1,250 | 14,250 | 10 | 10.0 (10 to 10) |
| 10 | Apparel: cardigan | 2,500 | 16,750 | 10 | 10.0 (10 to 10) |
| 11 | Door: Food Court | 1,000 | 17,750 | 11 | 10.5 (10 to 11) |
| 12 | Rivet Rifle: Platinum | 6,000 | 23,750 | 12 | 12.0 (12 to 12) |
| 13 | Door: Cinema | 1,250 | 25,000 | 12 | 12.0 (12 to 12) |
| 14 | Heavy Coil Nailer | 2,500 | 27,500 | 13 | 12.5 (12 to 13) |
| 15 | Heavy Coil Nailer: Deluxe | 1,000 | 28,500 | 13 | 13.0 (13 to 13) |
| 16 | Heavy Coil Nailer: Premium | 3,000 | 31,500 | 13 | 13.0 (13 to 13) |
| 17 | Heavy Coil Nailer: Build-A-Blaster | 4,000 | 35,500 | 14 | 13.8 (13 to 14) |
| 18 | Door: Mega Mart | 750 | 36,250 | 14 | 14.0 (14 to 14) |
| 19 | Apparel: fannyPack | 1,500 | 37,750 | 14 | 14.0 (14 to 14) |
| 20 | Heavy Coil Nailer: Platinum | 6,000 | 43,750 | 15 | 15.0 (15 to 15) |
| 21 | Rivet Rifle: Renewal 1 | 4,000 | 47,750 | 16 | 16.0 (16 to 16) |
| 22 | Rivet Rifle: Renewal 2 | 5,000 | 52,750 | 17 | 16.5 (16 to 17) |
| 23 | Rivet Rifle: Renewal 3 | 6,500 | 59,250 | 18 | 17.5 (17 to 18) |
| 24 | Rivet Rifle: Renewal 4 | 8,000 | 67,250 | 19 | 18.8 (18 to 19) |
| 25 | Rivet Rifle: Renewal 5 | 10,000 | 77,250 | 20 | 20.0 (20 to 20) |
| 26 | Heavy Coil Nailer: Renewal 1 | 4,000 | 81,250 | 21 | 21.0 (21 to 21) |
| 27 | Heavy Coil Nailer: Renewal 2 | 5,000 | 86,250 | 21 | 21.0 (21 to 21) |
| 28 | Heavy Coil Nailer: Renewal 3 | 6,500 | 92,750 | 22 | 21.8 (21 to 22) |
| 29 | Heavy Coil Nailer: Renewal 4 | 8,000 | 100,750 | 23 | 22.8 (22 to 23) |
| 30 | Heavy Coil Nailer: Renewal 5 | 10,000 | 110,750 | 24 | 23.8 (23 to 24) |
| 31 | Sharpened Blade | 1,500 | 112,250 | 24 | 23.8 (23 to 24) |
| 32 | Box Cutter Pro | 4,000 | 116,250 | 25 | 24.5 (24 to 25) |
| 33 | Door: Service Corridor | 1,000 | 117,250 | 25 | 24.5 (24 to 25) |
| 34 | Door: Customer Parking | 1,250 | 118,500 | 25 | 24.5 (24 to 25) |

| Round | Shopper hp | x round 1 | Best gun (most runs) | Its dps | x Staple Gun | Seconds a Shopper | Round seconds | Deaths |
|---|---|---|---|---|---|---|---|---|
| 1 | 150 | 1.0 | Price Gun | 434 | 3.4 | 0.35 | 20 | 0.0 |
| 2 | 225 | 1.5 | Price Gun | 434 | 3.4 | 0.52 | 34 | 0.0 |
| 3 | 300 | 2.0 | Price Gun | 434 | 3.4 | 0.69 | 36 | 0.0 |
| 4 | 375 | 2.5 | Price Gun | 434 | 3.4 | 0.86 | 43 | 0.0 |
| 5 | 450 | 3.0 | Rivet Rifle, Deluxe | 735 | 5.8 | 0.61 | 43 | 0.0 |
| 6 | 525 | 3.5 | Rivet Rifle, Deluxe | 735 | 5.8 | 0.71 | 52 | 0.0 |
| 7 | 600 | 4.0 | Rivet Rifle, Deluxe (3/4) | 770 | 6.0 | 0.78 | 56 | 0.0 |
| 8 | 675 | 4.5 | Rivet Rifle, Premium | 874 | 6.8 | 0.77 | 66 | 0.0 |
| 9 | 750 | 5.0 | Rivet Rifle, Premium, built | 1,401 | 11.0 | 0.54 | 61 | 15.0 |
| 10 | 806 | 5.4 | Rivet Rifle, Premium, built | 1,401 | 11.0 | 0.58 | 110 | 3.3 |
| 11 | 867 | 5.8 | Rivet Rifle, Premium, built | 1,401 | 11.0 | 0.62 | 90 | 0.8 |
| 12 | 932 | 6.2 | Rivet Rifle, Platinum, built | 1,914 | 15.0 | 0.49 | 111 | 23.5 |
| 13 | 1,002 | 6.7 | Rivet Rifle, Platinum, built | 1,914 | 15.0 | 0.52 | 102 | 23.3 |
| 14 | 1,077 | 7.2 | Rivet Rifle, Platinum, built | 1,914 | 15.0 | 0.56 | 87 | 6.3 |
| 15 | 1,157 | 7.7 | Heavy Coil Nailer, Platinum, built | 2,074 | 16.2 | 0.56 | 109 | 21.5 |
| 16 | 1,244 | 8.3 | Rivet Rifle, Platinum +2, built (2/4) | 2,218 | 17.4 | 0.56 | 86 | 10.8 |
| 17 | 1,338 | 8.9 | Rivet Rifle, Platinum +3, built (2/4) | 2,433 | 19.1 | 0.55 | 180 | 127.5 |
| 18 | 1,438 | 9.6 | Rivet Rifle, Platinum +3, built (3/4) | 2,610 | 20.4 | 0.55 | 113 | 47.3 |
| 19 | 1,546 | 10.3 | Rivet Rifle, Platinum +4, built | 2,807 | 22.0 | 0.55 | 119 | 28.8 |
| 20 | 1,662 | 11.1 | Rivet Rifle, Platinum +5, built | 3,076 | 24.1 | 0.54 | 176 | 50.3 |
| 21 | 1,786 | 11.9 | Rivet Rifle, Platinum +5, built | 3,076 | 24.1 | 0.58 | 148 | 18.5 |
| 22 | 1,920 | 12.8 | Rivet Rifle, Platinum +5, built | 3,076 | 24.1 | 0.62 | 131 | 12.3 |
| 23 | 2,064 | 13.8 | Rivet Rifle, Platinum +5, built (3/4) | 3,131 | 24.5 | 0.66 | 129 | 19.3 |
| 24 | 2,219 | 14.8 | Heavy Coil Nailer, Platinum +5, built | 3,296 | 25.8 | 0.67 | 127 | 36.5 |
| 25 | 2,386 | 15.9 | Heavy Coil Nailer, Platinum +5, built | 3,296 | 25.8 | 0.72 | 156 | 26.3 |
| 26 | 2,565 | 17.1 | Heavy Coil Nailer, Platinum +5, built | 3,296 | 25.8 | 0.78 | 145 | 23.3 |
| 27 | 2,757 | 18.4 | Heavy Coil Nailer, Platinum +5, built | 3,296 | 25.8 | 0.84 | 146 | 43.3 |
| 28 | 2,964 | 19.8 | Heavy Coil Nailer, Platinum +5, built | 3,296 | 25.8 | 0.90 | 161 | 31.3 |
| 29 | 3,186 | 21.2 | Heavy Coil Nailer, Platinum +5, built | 3,296 | 25.8 | 0.97 | 150 | 56.8 |
| 30 | 3,425 | 22.8 | Heavy Coil Nailer, Platinum +5, built | 3,296 | 25.8 | 1.04 | 182 | 28.0 |

- The build is a round-9 purchase, after Premium. The Rivet Rifle route is worth buying over the Price Gun in round 5 (735 dps against 434).
- The list now costs 118,500 and lasts until round 24 or 25.
- From round 12 the buyer is ahead of today: a Shopper takes 0.5 to 0.7 seconds through round 24 (today 0.55 to 0.9), and 1.04
  seconds at round 30 against 1.38.
- Rounds 7 and 8 are where it is behind: 0.78 and 0.77 seconds a Shopper against 0.52 and 0.48 today.

### 6.7 E. The late surplus (noted, not proposed)

Even with C in, the list is finished by round 25 and 79,445 points are unspent at round 30. Renewals 6 to 10 on the same price ladder
(12,500 up to about 29,000, roughly 100,000 a gun) would absorb it. This is maths only, and I would not spend design effort here yet:
only immortal bots ever see round 24. No one-life run got past round 14.

## 7. For the plans that were waiting on this report

A flat price means something different every round. Two numbers place any price: what a round pays, and what a buyer has had to
spend in total (the "spendable so far" table in section 3).

| Round | It pays about | Spendable so far (good / average) | A 750 purchase is | A 1,500 purchase is | A 4,000 purchase is |
|---|---|---|---|---|---|
| 3 | 1,200 | 2,000 / 1,856 | 62% of the round | more than the round | 3.3 rounds |
| 5 | 2,000 | 4,871 / 4,496 | 38% | 76% | 2 rounds |
| 8 | 2,700 | 11,420 / 10,413 | 28% | 56% | 1.5 rounds |
| 10 | 5,200 | 16,859 / 15,919 | 14% | 29% | 77% |
| 15 | 6,000 | 45,153 / 42,786 | 12% | 25% | 66% |
| 20 | 9,500 | 80,060 / 77,236 | 8% | 16% | 42% |
| 30 | 15,400 | 193,419 / 192,171 | 5% | 10% | 26% |

- **GRAB-A-GUN (docs/claw-machine-plan.md).** The price: proposal D. "No round gate" can stay: the bot's two early grabs won a
  Heavy Coil Nailer twice in 16 grabs, and the claw-first runs were no faster over 15 rounds (17.4 minutes against 16.8). What
  was not measured: prize tickets (the free grab about every 7 grabs), Refurbished attachments, and the three claw-only guns, which the
  bot cannot use.
- **Wardrobe (docs/wardrobe-plan.md).** Items cost 750 to 2,500: a third of a round to a whole round at rounds 4 to 6, when they
  compete with the Rivet Rifle route and Deluxe, and small change by round 10. One item for each of the four slots (3,750 to
  7,250) is about a round of income at round 10. All twelve (16,250) cost about what rounds 11 to 13 pay. The prices are in the right range for
  a round 5 to 12 purchase; nothing here says what an item does for survival (the bot wears a cardigan and a fanny pack and nothing else).
- **Kiosk Kevin (docs/kiosk-kevin-plan.md).** His stock is 500 to 1,500 and restocks every round, which makes him the repeatable sink
  the late game lacks. At flat prices a buyer past round 15 takes everything he has without noticing (750 is 12% of a round at 15,
  5% at 30), so what limits him late has to be stock, not price, unless his prices climb with the round as his damage already does
  (equipmentPower). Add a kiosk step to the bot (tools/economyPlans.js lists the step types) and replay the baseline in phase 7.
  Done in phase 7 (11 November 2026): the KIOSK buy order and the sim's 'kiosk' run set, `npm run kiosk`, and the prices it set (docs/history.md).
- **Hazards (docs/hazards-plan.md).** 500 to 750 a trigger with a 25 second cooldown: three or four triggers in a round is half of round
  10's income and a quarter of round 20's. A second cost is hidden: a hazard kill pays the kill value but none of the +10 hits, and
  hits are a quarter to nearly half of income, so each zombie a hazard kills pays about 55 to 115 points less than one shot down.
- **Build-A-Blaster's placeholder prices** (economy.upgrades.workshop): the ritual and the re-stuff are proposal B. Party Trap and Clearance
  Rack drop free now, so their 1,500 and 1,000 are unused.

## 8. What was not checked

- **No number in section 6 was played by a person.** Every "after" figure is the bot's. Whether a 58-damage Price Gun or a round-9
  build FEELS right needs a playtest.
- **Shopping was a teleport and builds were never fought for**, so every build came out Understuffed or Regular (x1.5 or x1.7). A
  player who fights in the room gets up to x2.2, which makes the build stronger than these tables show.
- **Everything past round 14 comes from immortal runs**, and most of what is past round 10. No one-life run got past round 14.
- The proposals were played at good skill. Average skill was played for today's numbers, and for one-life runs with everything in.
- One-life results are noisy even at 40 runs: the share reaching round 10 moves by a few points between two batches of the same game.
- The same seed with the same numbers does not always play the same run. That was not investigated; a test that seeds a scenario may be exposed to it.
- B3 and the 62-damage Price Gun were played for survival only (no runs to round 30).
- A build's stuffing effect (burn, arcs, slows) is in the played runs but not in the dps and points-per-percent tables.
- The bot never used the Confetti Cannon, the Barcode Scanner or a claw-only gun, an attachment, a hazard, the Soda Bomb or a prize ticket.
- Flash Sales and vouchers were on and are inside every number (about 16 sales a run); they were not measured apart.
- Proposal E (more Renewals) is maths only.
