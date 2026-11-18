# Open ideas

Everything planned or proposed that is NOT built, in one place. None of it is promised; each line says where the detail is.
Decided against (not to be built): the skill tree and meta progression (17 November 2026), elevators, escalator reversal and
toppling shelves (docs/archive/hazards-plan.md says why).

## Balance proposals (playtest first)
From docs/archive/balance-review.md (judged for a human player; G1-G10 and P1-P6 are already applied):
- **P7** builds that pre-fill the Headshot heart (Smoothie, Neon Tube, Antifreeze) pre-fill Last Round instead (config/workshop.js `defaultHeart`).
- **P8** Soda Bomb fuse 1.8 -> 1.0 s and less bounce (config/kiosk.js), so the blast lands where the crowd is.
- **P9** Bubble Wrap layers 30 -> 40, at most 2 (config/kiosk.js).
- **P10** power-ups last 25 s instead of 15, a bigger pickup radius, a stronger Paid Break heal (config/powerUps.js).
- **P11** Flash Sales last 60 s instead of 45; Doorbusters only for things you can reach (config/economy.js `flashSales`).
- **Platinum 6,000 -> 5,000** (economy.js `upgrades.tiers.platinum`), so its help arrives a round sooner (section 6).
- **A short hit grace** (e.g. 0.4 s) so three swings landing at once don't down you instantly (player/health.js; section 8).
- **Guns or zombies** (section 8): a small gun damage pass, or slower health growth after round 9 (1.075 -> 1.065). Only after playtesting.
- **C1-C4**, the extra modes and Closing Time notes (section 7).
- The Build-A-Blaster price: proposal B in docs/economy-report.md.

## Features
- **Kiosk Kevin** (docs/archive/kiosk-kevin-plan.md, "Later"): Prize Counter equipment for tickets; a "Utility Belt" Wardrobe
  accessory (+1 charge in each pocket); a decoy. (A site in the Parking lot already exists beside the family van.)
- **Bosses** (docs/archive/boss-zombies-plan.md, "Later"): Food Court Karen and Santa.
