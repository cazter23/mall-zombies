# Weapon balance pass — 25 October 2026

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
