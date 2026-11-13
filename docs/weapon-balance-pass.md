# Weapon balance pass — 25 October 2026

Historical record of the 25 October pass. The newer base-weapon pass and measurements are at the top of `docs/history.md`.

## 13 November 2026 — Rivet Rifle and Heavy Coil Nailer separation

Both guns previously shared `damage: 95` and `fireInterval: 0.1` (`src/config/weapons.js`). Numbers-only pass (`npm run balance`, 5 m ADS against a Shopper):

- **Heavy Coil Nailer (`coilNailer`, 2500 pts):** `damage` `95 → 120`, `fireInterval` `0.1 → 0.125` (`8.0` shots/s, `7.9` s drum).
  - Burst DPS `950 → 960`; sustained DPS (2–15 / 20 / 30 m) `647 / 575 / 424 → 700 / 622 / 459`.
  - Shots to kill a Shopper at 5 m (rounds 1 / 2 / 3 / 5 / 8 / 10 / 15): `2 / 3 / 4 / 5 / 8 / 9 / 13 → 2 / 2 / 3 / 4 / 6 / 7 / 10`.
- **Rivet Rifle (`rivetRifle`, 1500 pts):** `damage` `95 → 80`, `fireInterval` `0.1 → 0.085` (`11.8` shots/s, `2.5` s mag).
  - Burst DPS `950 → 941`; sustained DPS (2–10 / 15 / 20 / 30 m) `582 / 542 / 469 / 349 → 538 / 501 / 433 / 323`.
  - Shots to kill a Shopper at 5 m (rounds 1 / 2 / 3 / 5 / 8 / 10 / 15): `2 / 3 / 4 / 5 / 8 / 9 / 13 → 2 / 3 / 4 / 6 / 9 / 11 / 15`.
  - Because `0.085` s empties the 30-round magazine faster (`2.9 → 2.5` s) while `reloadTime: 2.0` s stayed unchanged, sustained DPS fell from `582` to `538`, dropping below `0.95 ×` Foam Dart Blaster (`570` at 5 m, `tests/rivetRifle.test.js:40`).

## 13 November 2026 — Tennis Ball Launcher and Barcode Scanner rework

Playtest feedback: both guns "felt weird"; the Tennis Ball Launcher was too weak, the Barcode Scanner needed a real rework.
Numbers from `npm run balance` (5 m, aimed, Shopper, chest; claw guns' per-round hits by the round the zombie spawned in).

**Tennis Ball Launcher (claw only).** It was a flat 50 a hit: 3 hits a round-1 Shopper, 24 by round 15. Its ball also left 8 cm under
the eye with no compensation for gravity: ~0.23 m under the crosshair at 5 m, ~0.74 m at 10 m, ~2.9 m at 20 m.
- Damage 50 → 60 a hit, times (that round's Shopper health / 150) ^ 0.85 (`roundScaling`, weapons/gunStats.js `roundDamageScale`,
  using zombie.round): 60 / 153 / 251 / 341 / 463 / 630 / 857 a hit at rounds 1 / 5 / 10 / 15 / 20 / 25 / 30. A Shopper takes 3 hits
  to round 5 and 4 from round 8 to 30, so one ball chaining three zombies in a corridor stays worth it all game. In the open (one hit a
  ball) it stays under the Price Gun early and passes the unupgraded Price Gun from about round 20.
- The ball: 21 → 28 m/s, gravity 6.5 → 4, and the throw is zeroed (`zeroDistance` 10 m): within ~2 cm of the crosshair to 10 m, 14 cm
  under at 15 m, 41 cm at 20 m. seekRange 3.5 → 4.5 m (it finds the next zombie a little further away).
- Sustained dps at round 1, one hit a ball: 66 → 79 (all bounces hitting: 330 → 396, and it scales with the round).

**Barcode Scanner (wall, 1750).** Tap = a 91-damage 1-target snap; hold 0.42 s and release = a 260 4-target beam. Every other gun fires
on press, so it felt laggy; played normally it was under the Price Gun (sustained 292 vs 434), the lowest sustained damage of any wall gun.
- Hold to scan, it fires itself when the 0.45 s scan completes, every shot a full 420 (2x headshots), pierce 4 at 1 / 0.85 / 0.7 / 0.55.
  Let go early: nothing fires, no ammo spent. Fire interval 0.28 → 0.2 s (a beam every 0.65 s while held).
- RUNG UP (game/rungUp.js): what a beam hits and doesn't kill takes x1.35 from everything for 4 s and pays +40 if killed while marked.
- Range falloff from full to 16 m / 74% at 34 m to full to 12 m / 60% at 30 m: the Stargazer keeps the long hits.
- Sustained dps 292 → 494 raw (Price Gun 434, Rivet Rifle 582); ~645 on its own marked target (every beam after the first in a
  magazine hits a rung-up zombie). Burst 371 → 646. Shots to kill a round-8 Shopper 3 → 2. Biggest single headshot on the wall (840,
  1134 on a marked zombie) and the most damage a second down a line of four.
- tests/balance.test.js: the Bazooka's "beats any wall gun on a clump, even counting its pierce" now counts pierce at what it really deals
  (the falloff sum, 3.1 for the scanner) instead of 4 full hits.

Implemented the agreed changes. Prices, zombie health, fire rates, recoil, spread,
ADS/movement handling and reload durations are unchanged.

| Weapon | Changes |
|---|---|
| Price Gun | 28-round magazine, 168 reserve; damage remains 28 |
| Rivet Rifle | Damage 52 → 58 |
| Heavy Coil Nailer | Damage 34 → 44; full damage to 15 m, falling to 65% at 30 m |
| Foam Dart Blaster | Damage 52 → 56 per dart |

Headshot multipliers: Staple/Nail/Scanner 2×; Price/Coil 1.5×;
Foam/Rivet 1.75×; Cannon 1.2×. Headshots remain worthwhile, but most weapons'
head damage is lower than before. Rivet's head multiplier is unchanged.

## Evaluation method

156 controlled trials use the real headless game with real weapon state,
hitboxes, spread/bloom, recoil compensation, damage, ammo, burst and reload timing.
Every weapon was tested at rounds 1, 3, 5, 8, 10, 15 and 20, aiming at body and
head. The four retuned guns also received 15/30 m tests, five-target hip/ADS
sequences, round-8 Mall Walker/Cart Pusher tests and equal-tier tests at
Deluxe/12, Premium/17 and Platinum/24.

Targets are stationary, with perfect tracking/recoil compensation. Automatic and
charge weapons hold the trigger; semi/burst weapons receive repeated requests at
their allowed cadence. Timings run from the first shot to the killing shot;
they include intervening reloads but exclude initial ADS/charge/switch time.
This is a controlled combat comparison, not human survival playtesting or a
claim that the game feels fun under real movement pressure. Single seeded
hip-fire samples are illustrative, not accuracy averages.

Eight browser trials repeated the four guns at rounds 8 and 10, with rendered
firing/reloads. They matched headless shot counts and kill times, with no runtime
exceptions. No new weapon visual/audio behavior was introduced.

## Base guns: close aimed chest kills

Seconds to kill a Shopper at 5 m; no upgrades, perks or attachments:

| Weapon | Round 5 | Round 8 | Round 10 | Round 15 | Round 20 |
|---|---:|---:|---:|---:|---:|
| Staple Gun | 3.22 | 4.18 | 6.18 | 9.15 | 12.72 |
| Price Gun | 1.33 | 2.00 | 3.57 | 4.65 | 7.38 |
| Nail Gun | 1.02 | 1.77 | 2.02 | 4.85 | 6.35 |
| Foam Dart Blaster | 1.13 | 1.97 | 2.12 | 3.08 | 4.57 |
| Confetti Cannon (aimed) | 0.57 | 0.57 | 1.12 | 1.12 | 2.22 |
| Rivet Rifle | 0.95 | 1.48 | 1.75 | 2.55 | 5.67 |
| Heavy Coil Nailer | 1.02 | 1.52 | 1.82 | 2.62 | 3.72 |
| Barcode Scanner (full charge) | 1.40 | 2.80 | 3.50 | 4.90 | 8.55 |

The Cannon's strong aimed result at 5 m must not be extrapolated to hip fire or
long range. Scanner timings exclude charging the first shot; its benefit is
piercing multiple targets, not single-target body DPS.

## Findings

- **Price:** still good early. Round 10 takes 29 body hits, exceeding its new
  28-round magazine and requiring a reload. Round-8 headshots take 17 hits
  (1.33 s). Five successive round-8 aimed body kills take 15.27 s and four
  reloads. Its 250-point refill remains economical, and upgrades deliberately
  keep it usable rather than forcing a replacement.
- **Rivet:** now a meaningful upgrade. Round 8 takes 12 body hits (1.48 s) or
  seven head hits (0.82 s); round 10 takes 14 body hits. Five aimed body kills
  take 11.72 s and two reloads. At round 20, 29 body hits exceed the magazine:
  an upgrade or headshots are increasingly important. Its hip bloom, slower ADS
  and ADS movement penalty still reward aimed firing windows over spraying
  while using movement tech. Those movement scenarios were not playtested here.
- **Coil:** fulfils the strong sustained-fire role. Five aimed round-8 body
  kills take 10.97 s and one reload. A round-20 Shopper still fits in its drum
  (38 body hits). Existing 50% second-target piercing increases horde output
  beyond these single-target figures. The 3.1 s reload and slow aiming/strafe
  remain its commitments; reserve capacity is still generous.
- **Foam:** the buff is small and useful, especially at round 10 (15 body darts).
  Round 8 still takes 13 darts/five bursts, so a single chest kill is almost
  as slow as Price's. It has more kills per magazine, less ammo use, quicker ADS
  than Rivet/Coil and better sustained-fire accuracy at range. At 30 m in round
  8, chest kills took 2.47 s versus Price's 5.23 s. Five close aimed body kills
  took 14.23 s. Its identity relies more on accuracy/handling than raw damage.
- **Other guns:** Staple still encourages an early purchase; Nail retains its
  range/penetration niche and takes four round-8 headshots; Cannon retains its
  close aimed power while random head pellets contribute less; Scanner remains
  a charged crowd weapon, with reduced headshot burst power.

Equal-tier upgrades remain viable: at Premium/round 17, close body kills take
Price 1.83 s, Foam 1.62 s, Rivet 1.35 s and Coil 1.42 s. Price remains behind the
premium guns even though upgrading it keeps it relevant.

## Watch in normal play

1. Coil is the main potential overperformer: it costs 1,250 versus Rivet's
   1,500, has ample reserve and pierces. Keep the agreed values for this pass;
   evaluate whether reload/mobility impose enough real risk before another buff
   or price change. Its weapon-specific movement penalty applies while ADS;
   sprinting and chain sliding retain normal movement. Skilled players can
   therefore reposition quickly by dropping ADS, which this stationary test
   does not measure.
2. Foam and Rivet remain close in sustained output. Foam's shorter ADS and
   accurate bursts must feel valuable; the slight damage buff does not produce
   a faster kill at every health breakpoint.
3. Lower head multipliers slow most precision kills. If later rounds feel
   spongey, evaluate progression/upgrades before automatically restoring 3×
   multipliers or increasing zombie health. No health change was made.

Tests now enforce the intended premium-over-Price hierarchy, headshot bounds,
real round-8/10 combat, Price's reload breakpoint, ranged accuracy advantage,
upgrades and existing burst/pellet payout behavior. Older role tests were updated
to allow the agreed stronger Coil and Foam: Nail retains a 10% base advantage at
30 m; an attached competitor may challenge it there, while Nail retains 40 m.
